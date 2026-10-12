import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { chat, chatJson, extractCodeBlocks, modelFor } from '../llm.js';
import { repairPrompt, visionReviewPrompt } from '../prompts.js';
import { getSettings } from '../config.js';
import { motionSystemPrompt, motionUserPrompt } from '../motionPrompt.js';
import { normalizeCast } from './script.js';
import { STYLES } from '../styles.js';
import { inspectScene } from '../browser.js';
import { buildRuntimeData } from '../runtimeData.js';
import { save, log, progress, usageRecorder, projectDir } from '../store.js';
import { pMap, sleep } from '../util.js';

// env/shot only enter the key when present, so scenes made before they existed keep their code.
export const codeKey = s => crypto.createHash('md5').update(s.narration + '|' + s.visual + '|' + (s.instruction || '') + (s.env || s.shot ? `|${s.env || ''}|${s.shot || ''}` : '')).digest('hex').slice(0, 10);

function problemsOf(qa) {
  return [
    ...qa.errors.map(e => `Lỗi JavaScript khi chạy: ${e.message}${e.stack ? ` (${e.stack.slice(0, 160)})` : ''}`),
    ...qa.issues,
    ...qa.warnings,
  ];
}

const scoreOf = qa => qa.errors.length * 100 + qa.issues.length * 6 + qa.warnings.length * 2;
// Vision verdict → penalty: a shot the reviewer scores ≤ 4/10 counts as broken (≥ 40) and gets rebuilt from scratch.
const visionPenalty = (score, n) => (!n || score >= 8 ? 0 : score >= 6 ? 4 + n : score >= 5 ? 12 + n * 2 : 45);

/**
 * Generate one scene's code: write → run in headless Chrome → feed problems back → retry.
 * Keeps the best attempt. A scene that still throws falls back to the runtime's safe template.
 * `round` > 0 means an automatic re-do of a scene that came out broken: a fresh conversation, no memory of the failed one.
 */
export async function generateScene(p, i, { signal, round = 0 } = {}) {
  const s = p.scenes[i];
  if (!s.audio) throw new Error('Cảnh chưa có giọng đọc');
  const onUsage = usageRecorder(p);
  const preset = STYLES.cartoon;
  const messages = [{ role: 'system', content: motionSystemPrompt({ captions: p.settings.captions }) }, { role: 'user', content: motionUserPrompt(p, i) }];
  if (round > 0 && s.code?.issues?.length) messages[1].content += `\n\nLẦN DỰNG TRƯỚC CỦA CẢNH NÀY BỊ LỖI (tránh lặp lại): ${s.code.issues.slice(0, 6).join(' · ')}`;

  const wantVision = getSettings().llm.visionReview !== false;
  let reviews = 0;
  let best = null;
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('Đã huỷ');
    const r = await chat({ role: 'coder', messages, temperature: attempt === 0 ? (round ? 0.95 : 0.85) : 0.4, maxTokens: 16000, onUsage, signal });
    const code = extractCodeBlocks(r.content);
    let qa;
    if (!code.html && !code.js) {
      qa = { errors: [{ message: 'Không tìm thấy các khối ```html / ```css / ```js trong câu trả lời' }], issues: [], warnings: [], frames: [] };
    } else {
      qa = await inspectScene(buildRuntimeData(p, { sceneId: s.id, code }), { frames: wantVision && reviews < maxAttempts });
    }
    // pictures drawn specifically for this scene must actually appear (they cost an image call)
    if (code.js && !/\.(solarSystem|blackHole|galaxy|atom|molecule|cell|dna|earthLayers|waterCycle|body|globe)\(/.test(code.js)) for (const im of (p.images || []).filter(m => m.status === 'done' && m.kind !== 'bg' && m.scenes?.includes(i)).slice(0, 3))
      if (!code.js.includes(im.id)) qa.warnings.push(`Chưa dùng hình đã vẽ riêng cho cảnh này: '${im.id}' (${im.name}) — dùng nếu nó đúng hiện tượng, không thì bỏ qua`);
    const cand = { code, qa, score: scoreOf(qa) };
    let problems = problemsOf(qa);
    const domClean = qa.errors.length === 0 && qa.issues.length === 0 && qa.warnings.length <= 1;

    // Once the DOM checks pass, a vision model looks at real frames for what DOM can't see — again after a repair.
    if (qa.errors.length === 0 && qa.issues.length <= 3 && wantVision && reviews < maxAttempts && qa.frames?.length) {
      reviews++;
      try {
        const v = await chatJson({ role: 'vision', messages: visionReviewPrompt(s, qa.frames, p.settings.captions), temperature: 0.2, maxTokens: 3000, onUsage, signal });
        const issues = (v.issues || []).filter(Boolean).slice(0, 8);
        const vs = Number(v.score) || 10;
        cand.visionScore = vs;
        // repair only clearly weak scenes (≤ 6): every review now covers every attempt, and 7s cost a lot to polish
        if (issues.length && vs <= 6) {
          problems = issues.map(x => `Soát hình: ${x}`);
          cand.score += visionPenalty(vs, issues.length);
          cand.visionIssues = problems;
        }
      } catch (err) {
        if (err.fatal) throw err;
        log(p, `Soát hình cảnh ${i + 1} không chạy được: ${String(err.message).slice(0, 160)}`, 'warn');
      }
    }
    if (!best || cand.score < best.score) best = cand;
    if (domClean && !cand.visionIssues) break;
    if (attempt < maxAttempts - 1) {
      messages.push({ role: 'assistant', content: r.content.slice(0, 30000) }, { role: 'user', content: repairPrompt(code, problems.slice(0, 14)) });
    }
  }
  best.qa.issues = [...best.qa.issues, ...(best.visionIssues || [])];

  const failed = best.qa.errors.length > 0;
  s.code = failed
    ? { html: '', css: '', js: '', by: 'fallback', key: codeKey(s), issues: problemsOf(best.qa).slice(0, 8), score: best.score, at: Date.now() }
    : { ...best.code, by: 'coder', model: modelFor('coder'), key: codeKey(s), issues: problemsOf(best.qa).slice(0, 8), score: best.score, visionScore: best.visionScore ?? null, at: Date.now() };
  if (best.qa.thumb && !failed) {
    const file = projectDir(p.id, 'thumbs', `${s.id}.jpg`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, best.qa.thumb);
    s.thumb = `thumbs/${s.id}.jpg?v=${Date.now()}`;
  } else if (failed) {
    s.thumb = null;
  }
  delete s.instruction;
  return s.code;
}

/** Cartoon videos need a cast list (may be empty); projects created before get one from the script. */
export async function ensureCast(p, signal) {
  // motion graphics: no recurring cartoon cast
  if (!Array.isArray(p.cast)) { p.cast = []; save(p); }
}

/** A scene that came out unusable: code failed, or the checks still find a lot wrong. */
const broken = s => !s.code || s.code.by === 'fallback' || (s.code.score ?? 0) >= 40;

/** Generate a scene, retrying on transient API/network failures (fatal ones — bad key, no credit — still stop). */
async function generateWithRetry(p, i, opts) {
  let lastErr;
  for (let k = 0; k < 4; k++) {
    try { return await generateScene(p, i, opts); }
    catch (err) {
      lastErr = err;
      if (err.fatal || opts.signal?.aborted) throw err;
      log(p, `Cảnh ${i + 1}: lỗi tạm thời (${err.message.slice(0, 120)}) — tự thử lại sau ${15 * (k + 1)} giây.`, 'warn');
      await sleep(15000 * (k + 1));
    }
  }
  throw lastErr;
}

export async function runScenesStage(p, signal) {
  await ensureCast(p, signal);
  const todo = p.scenes.map((s, i) => i).filter(i => !p.scenes[i].code || p.scenes[i].code.key !== codeKey(p.scenes[i]));
  if (todo.length) {
    let done = p.scenes.length - todo.length;
    progress(p, 'scenes', done, p.scenes.length, 'Dựng cảnh');
    log(p, `Dựng ${todo.length} cảnh (${modelFor('coder')} viết code, tự kiểm tra trong trình duyệt${getSettings().llm.visionReview !== false ? ` + ${modelFor('vision')} soát hình` : ''})...`);
    const results = await pMap(todo, getSettings().llm.coderConcurrency || 6, async i => {
      if (signal?.aborted) throw new Error('Đã huỷ');
      await generateWithRetry(p, i, { signal });
      progress(p, 'scenes', ++done, p.scenes.length, 'Dựng cảnh');
      save(p);
    });
    const fatal = results.find(r => !r.ok && r.error.fatal);
    if (fatal) throw fatal.error;
  }
  // Automatic re-do: scenes that are still broken (or never got built) are rebuilt from scratch, up to 2 more rounds.
  for (let round = 1; round <= 2; round++) {
    const bad = p.scenes.map((s, i) => i).filter(i => broken(p.scenes[i]));
    if (!bad.length || signal?.aborted) break;
    log(p, `Tự làm lại ${bad.length} cảnh còn lỗi (vòng ${round}/2): ${bad.map(i => i + 1).join(', ')}.`, 'warn');
    const thumbFile = s => projectDir(p.id, 'thumbs', `${s.id}.jpg`);
    const before = new Map(bad.map(i => {
      const s = p.scenes[i];
      let img = null;
      try { img = s.thumb ? fs.readFileSync(thumbFile(s)) : null; } catch { /* no thumbnail yet */ }
      return [i, { code: s.code, thumb: s.thumb, img }];
    }));
    const results = await pMap(bad, getSettings().llm.coderConcurrency || 6, async i => {
      await generateWithRetry(p, i, { signal, round });
      // keep whichever version is better (with its thumbnail)
      const old = before.get(i), s = p.scenes[i], now = s.code;
      if (old.code && old.code.by !== 'fallback' && (now.by === 'fallback' || (now.score ?? 0) > (old.code.score ?? 0))) {
        s.code = old.code;
        s.thumb = old.thumb;
        if (old.img) fs.writeFileSync(thumbFile(s), old.img);
      }
      save(p);
    });
    const fatal = results.find(r => !r.ok && r.error.fatal);
    if (fatal) throw fatal.error;
  }
  const still = p.scenes.filter(broken).length;
  log(p, still ? `Dựng cảnh xong — ${still} cảnh vẫn chưa đạt sau khi tự làm lại (dùng bản tốt nhất).` : 'Dựng cảnh xong.', still ? 'warn' : 'info');
  save(p);
}
