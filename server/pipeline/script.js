import { chatJson } from '../llm.js';
import { outlinePrompt, chapterPrompt, editorPrompt, scriptPlanPrompt, scriptVisualsPrompt } from '../prompts.js';
import { save, log, progress, usageRecorder } from '../store.js';
import { uid, pMap, countWords } from '../util.js';
import { wordsPerMinute } from '../config.js';
import { STYLES, CATEGORIES } from '../styles.js';
import { castFromLibrary, rememberCast } from '../castLibrary.js';
import { ENV_NAMES, SHOT_NAMES, shotToType } from '../visualSpec.js';

const clean = s => String(s || '')
  .replace(/[*#_`~>]/g, '')
  .replace(/\s*\([^)]*\)/g, m => (m.length < 40 ? m.replace(/[()]/g, '') : m))
  .replace(/\s+/g, ' ')
  .trim();

const pickEnv = v => { const e = String(v || '').toLowerCase().trim(); return ENV_NAMES.includes(e) ? e : null; };
const pickShot = v => { const e = String(v || '').toLowerCase().trim(); return SHOT_NAMES.includes(e) ? e : null; };
const pickTime = v => (['day', 'sunset', 'night'].includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : null);

const DEFAULT_ENV = { economics: 'city', politics: 'city', history: 'ancient', space: 'space', science: 'lab', technology: 'digital' };
/**
 * The plain 'abstract' backdrop reads as a slide, so it is only for diagram/data shots. Any other shot set there moves
 * to the nearest real environment of the same chapter (or the category's default world).
 */
export function groundAbstractScenes(p) {
  const real = s => s.env && s.env !== 'abstract';
  p.scenes.forEach((s, i) => {
    if (s.env !== 'abstract' || s.shot === 'diagram' || s.shot === 'data') return;
    const same = x => x && x.chapterId === s.chapterId && real(x);
    let env = null;
    for (let k = 1; k < p.scenes.length && !env; k++) env = (same(p.scenes[i - k]) && p.scenes[i - k].env) || (same(p.scenes[i + k]) && p.scenes[i + k].env) || null;
    s.env = s.setting = env || DEFAULT_ENV[p.brief.category] || 'city';
  });
}

const TRANSITIONS = ['cut', 'fade', 'slide', 'zoom', 'wipe', 'iris', 'whip'];
export function makeScene(chapter, raw) {
  const shot = pickShot(raw.shot);
  return {
    id: uid('s_'),
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    narration: clean(raw.narration),
    visualType: raw.visualType || (shot ? shotToType(shot) : 'illustration'),
    visual: String(raw.visual || '').trim(),
    form: String(raw.form || '').trim().slice(0, 60),
    items: Array.isArray(raw.items) ? raw.items.map(x => String(x).trim()).filter(Boolean).slice(0, 8) : [],
    backdrop: String(raw.backdrop || 'plain').trim().slice(0, 80),
    illustration: String(raw.illustration || '').trim().slice(0, 400),
    transition: TRANSITIONS.includes(raw.transition) ? raw.transition : null,
    env: pickEnv(raw.env),
    time: pickTime(raw.time),
    shot,
    onScreenText: String(raw.onScreenText || '').trim(),
    setting: pickEnv(raw.env) || (raw.setting ? String(raw.setting).toLowerCase() : null),
    characters: Array.isArray(raw.characters) ? raw.characters.map(String) : [],
    data: raw.data || null,
    audio: null,
    code: null,
    duration: 0,
    start: 0,
  };
}

const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'nv';

/**
 * Recurring cartoon cast: stable ids, at most 5 people, looks kept as given (the runtime fills defaults).
 * { "reuse": "<id>" } pulls a character saved from an earlier video (same look), then the cast is remembered for later videos.
 */
export function normalizeCast(list) {
  const seen = new Set();
  const cast = (Array.isArray(list) ? list : []).slice(0, 5).map((c, i) => {
    const lib = c?.reuse ? castFromLibrary(String(c.reuse)) : null;
    if (lib) c = { ...lib, role: c.role || lib.role };
    let id = slug(c.id || c.name) || `nv${i + 1}`;
    while (seen.has(id)) id += '_';
    seen.add(id);
    return { id, name: c.name || id, role: c.role || '', look: c.look && typeof c.look === 'object' ? c.look : {}, reused: !!lib };
  });
  rememberCast(cast);
  return cast;
}

const HEADING = /^(#{1,6}\s+|(chương|phần|mục|part|chapter)\s+[\dIVXLC]+\b|\*\*[^*]+\*\*$)/i;
const DIRECTION = /^(\[.*\]|\(.*\)|(hình|hình ảnh|visual|cảnh|minh họa|b-roll)\s*\d*\s*[:：].*)$/i;
const SPEAKER = /^(người dẫn|lời dẫn|mc|narrator|voice ?over|vo|thuyết minh|host)\s*[:：]\s*/i;

/**
 * Cut a pasted script into scene-sized pieces (≈18–45 words) on sentence boundaries, keeping every word.
 * Headings ("## Phần 2", "Chương 3: ...", "**Tiêu đề**", short unpunctuated lines) become chapter starts;
 * bracketed/"Hình:" lines become visual hints for the next scene. Returns { scenes: [{narration, hint}], headings: {sceneIndex: title} }.
 */
export function segmentScript(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim());
  const content = lines.filter(Boolean);
  const punctuated = content.filter(l => /[.!?…"”]$/.test(l)).length / Math.max(1, content.length) > 0.6;
  const segs = [], headings = {};
  let cur = [], curW = 0, curHint = '', hint = '', heading = null;
  const push = () => {
    if (!cur.length) return;
    if (heading != null) { headings[segs.length] = heading; heading = null; }
    segs.push({ narration: clean(cur.join(' ')), hint: curHint });
    cur = []; curW = 0; curHint = '';
  };
  const add = s => {
    const w = countWords(s);
    if (!w) return;
    if (curW && curW + w > 45) push();
    if (!cur.length && hint) { curHint = hint; hint = ''; }
    cur.push(s); curW += w;
    if (curW >= 28) push();
  };
  for (const raw of lines) {
    if (!raw) { if (curW >= 12) push(); continue; }
    const l = raw.replace(SPEAKER, '');
    if (DIRECTION.test(l)) { hint = [hint, l.replace(/^[[(]|[\])]$/g, '').replace(/^(hình|hình ảnh|visual|cảnh|minh họa|b-roll)\s*\d*\s*[:：]\s*/i, '')].filter(Boolean).join('; '); continue; }
    if (HEADING.test(l) || (punctuated && countWords(l) <= 8 && !/[.!?…,;:"”)]$/.test(l))) {
      push();
      heading = l.replace(/^#+\s*|\*\*/g, '').replace(/^(chương|phần|mục|part|chapter)\s+[\dIVXLC]+\s*[:.\-–]?\s*/i, m => (l.replace(m, '').trim() ? '' : m)).replace(/[:.]$/, '').trim() || heading;
      continue;
    }
    for (const sentence of l.split(/(?<=[.!?…])\s+/u)) {
      if (countWords(sentence) <= 50) add(sentence);
      else sentence.split(/(?<=[,;:])\s+/u).forEach(add);
    }
  }
  push();
  // A tiny trailing piece reads better merged into the previous scene of the same chapter.
  const last = segs.length - 1;
  if (last > 0 && countWords(segs[last].narration) < 8 && headings[last] == null) { segs[last - 1].narration += ` ${segs[last].narration}`; segs.pop(); }
  return { scenes: segs, headings };
}

/** Chapters for a pasted script: the user's headings when given, else Flash's split, else fixed-size parts. */
function pastedChapters(plan, n, headings) {
  const starts = Object.keys(headings).map(Number);
  const byStart = new Map((plan.chapters || []).map(c => [Number(c.start), c]));
  if (starts.length >= 2) {
    const list = starts[0] > 0 ? [{ start: 0, title: byStart.get(0)?.title || 'Mở đầu' }] : [];
    starts.forEach(s => list.push({ start: s, title: headings[s], purpose: byStart.get(s)?.purpose }));
    return list;
  }
  let list = (plan.chapters || []).map(c => ({ ...c, start: Math.round(Number(c.start)) })).filter(c => c.start >= 0 && c.start < n).sort((a, b) => a.start - b.start);
  list = list.filter((c, i) => i === 0 || c.start > list[i - 1].start);
  if (list.length) list[0].start = 0;
  if (list.length >= 2 || n < 8) return list.length ? list : [{ start: 0, title: plan.title || 'Nội dung' }];
  const size = Math.ceil(n / Math.ceil(n / 8));
  return Array.from({ length: Math.ceil(n / size) }, (_, i) => ({ start: i * size, title: `Phần ${i + 1}` }));
}

async function planPastedScript(p, cartoon, onUsage, signal) {
  const b = p.brief;
  const { scenes: segs, headings } = segmentScript(b.script);
  if (segs.length < 2) throw new Error('Kịch bản quá ngắn — cần ít nhất vài câu');
  const words = segs.reduce((a, s) => a + countWords(s.narration), 0), wpm = wordsPerMinute(p.settings.voice);
  progress(p, 'script', 0, 3, 'Phân tích kịch bản');
  log(p, `Kịch bản của bạn: ${words} từ → ${segs.length} cảnh (≈ ${(words / wpm).toFixed(1)} phút). Flash chia chương và nghĩ hình minh họa — giữ nguyên lời thoại...`);
  let plan = {};
  try {
    plan = await chatJson({ role: 'flash', messages: scriptPlanPrompt(b, segs, headings, { cartoon }), temperature: 0.5, maxTokens: 8000, onUsage, signal });
  } catch (err) {
    if (err.fatal || signal?.aborted) throw err;
    log(p, `Không phân tích được kịch bản (${err.message}) — chia chương tự động.`, 'warn');
  }
  if (b.category === 'auto') b.category = CATEGORIES[plan.category] ? plan.category : 'other';
  const chapters = pastedChapters(plan, segs.length, headings).map((c, i, all) => {
    const end = all[i + 1]?.start ?? segs.length;
    return { id: uid('c_'), title: String(c.title || `Phần ${i + 1}`).slice(0, 60), purpose: c.purpose || '', points: [], start: c.start, end, words: segs.slice(c.start, end).reduce((a, s) => a + countWords(s.narration), 0) };
  });
  p.outline = { title: plan.title || p.title, angle: plan.angle || '', category: b.category, minutes: Math.round((words / wpm) * 10) / 10, chapters, fromScript: true };
  p.cast = [];   // motion graphics: no recurring cast
  p.title = p.outline.title;
  save(p);

  let done = 0;
  progress(p, 'script', 1, 3, `Nghĩ hình minh họa 0/${chapters.length} chương`);
  const results = await pMap(chapters, 4, async (ch, idx) => {
    const list = segs.slice(ch.start, ch.end).map((s, k) => ({ ...s, i: ch.start + k }));
    const r = await chatJson({ role: 'flash', messages: scriptVisualsPrompt(b, { ...p.outline, cast: p.cast || [] }, idx, list, { cartoon }), temperature: 0.7, maxTokens: 12000, onUsage, signal });
    const byI = new Map((r.scenes || []).map(v => [Number(v.i), v]));
    progress(p, 'script', 1, 3, `Nghĩ hình minh họa ${++done}/${chapters.length} chương`);
    return list.map(s => {
      const v = byI.get(s.i) || {};
      const scene = makeScene(ch, { ...v, narration: s.narration, visual: v.visual || s.hint || `Minh họa trực quan cho: ${s.narration}` });
      scene.narration = s.narration; // verbatim, never the model's copy
      return scene;
    });
  });
  const failed = results.findIndex(r => !r.ok);
  if (failed >= 0) throw new Error(`Nghĩ hình cho chương ${failed + 1} thất bại: ${results[failed].error.message}`);
  p.scenes = results.flatMap(r => r.value);
  save(p);
}

export async function editPass(p, cartoon, userScript, onUsage, signal) {
  const b = p.brief;
  progress(p, 'script', 2, 3, 'Biên tập & soát lỗi');
  log(p, userScript ? 'Flash soát hình minh họa (đa dạng, đúng thời đại) và đánh dấu chỗ nên kiểm chứng...' : 'Flash biên tập toàn bộ kịch bản (soát sự thật, lặp ý, chuyển mạch)...');
  try {
    const ed = await chatJson({ role: 'flash', messages: editorPrompt(b, p.outline, p.scenes, cartoon, userScript), temperature: 0.4, maxTokens: 12000, onUsage, signal });
    let applied = 0, visuals = 0;
    for (const e of ed.edits || []) {
      const s = p.scenes[e.index];
      if (!s) continue;
      if (!userScript && e.narration && countWords(e.narration) >= 5) { s.narration = clean(e.narration); applied++; }
      if (e.visual && String(e.visual).length > 20) { s.visual = String(e.visual).trim(); visuals++; }
      if (pickEnv(e.env)) { s.env = pickEnv(e.env); s.setting = s.env; }
      if (pickShot(e.shot)) { s.shot = pickShot(e.shot); s.visualType = shotToType(s.shot); }
      if (e.form) s.form = String(e.form).slice(0, 60);
      if (typeof e.illustration === 'string') s.illustration = e.illustration.slice(0, 400);
      if (Array.isArray(e.items) && e.items.length) s.items = e.items.map(String).slice(0, 8);
      if (TRANSITIONS.includes(e.transition)) s.transition = e.transition;
    }
    p.factWarnings = (ed.factWarnings || []).slice(0, 12);
    log(p, `Biên tập: ${userScript ? 'giữ nguyên lời thoại' : `sửa ${applied} lời thoại`}${visuals ? `, đổi ${visuals} ý tưởng hình cho đa dạng` : ''}${p.factWarnings.length ? `, ${p.factWarnings.length} điểm nên tự kiểm chứng` : ''}.`);
  } catch (err) {
    if (err.fatal || signal?.aborted) throw err;
    log(p, `Bỏ qua bước biên tập: ${err.message}`, 'warn');
  }
}

export async function runScriptStage(p, signal) {
  const onUsage = usageRecorder(p);
  const b = p.brief;
  const cartoon = true; // one visual style: illustrated 2D

  if (b.script && !p.scenes.length) {
    await planPastedScript(p, cartoon, onUsage, signal);
    await editPass(p, cartoon, true, onUsage, signal);
  }

  if (!p.outline) {
    progress(p, 'script', 0, 3, 'Lập dàn ý');
    log(p, b.minutes ? `Flash đang lập dàn ý cho video ~${b.minutes} phút...` : 'Flash đang lập dàn ý (tự chọn độ dài theo nội dung)...');
    const o = await chatJson({ role: 'flash', messages: outlinePrompt(b, { cartoon, wpm: wordsPerMinute(p.settings.voice) }), temperature: 0.8, maxTokens: 8000, onUsage, signal });
    if (!Array.isArray(o.chapters) || o.chapters.length < 2) throw new Error('Dàn ý không hợp lệ (thiếu chương)');
    o.minutes = b.minutes || Math.min(18, Math.max(3, Number(o.minutes) || 8));
    const target = o.minutes * wordsPerMinute(p.settings.voice);
    const sum = o.chapters.reduce((a, c) => a + (Number(c.words) || 0), 0) || target;
    o.chapters = o.chapters.map(c => ({ ...c, id: uid('c_'), words: Math.max(80, Math.round(((Number(c.words) || target / o.chapters.length) * target) / sum)) }));
    p.outline = o;
    p.cast = [];
    p.title = o.title || p.title;
    log(p, `Dàn ý: "${o.title}" — ${o.chapters.length} chương, ~${o.minutes} phút.`);
    save(p);
  }

  if (!p.scenes.length) {
    const chapters = p.outline.chapters;
    let done = 0;
    progress(p, 'script', 1, 3, `Viết chương 0/${chapters.length}`);
    log(p, `Flash viết song song ${chapters.length} chương...`);
    const results = await pMap(chapters, 4, async (ch, i) => {
      const r = await chatJson({ role: 'flash', messages: chapterPrompt(b, { ...p.outline, cast: p.cast || [] }, i, { cartoon }), temperature: 0.85, maxTokens: 12000, onUsage, signal });
      if (!Array.isArray(r.scenes) || !r.scenes.length) throw new Error(`Chương ${i + 1} không có cảnh`);
      progress(p, 'script', 1, 3, `Viết chương ${++done}/${chapters.length}`);
      return r.scenes.filter(s => s?.narration).map(s => makeScene(ch, s));
    });
    const failed = results.findIndex(r => !r.ok);
    if (failed >= 0) throw new Error(`Viết chương ${failed + 1} thất bại: ${results[failed].error.message}`);
    p.scenes = results.flatMap(r => r.value);
    save(p);
    await editPass(p, cartoon, false, onUsage, signal);
  }

  groundAbstractScenes(p);
  const words = p.scenes.reduce((a, s) => a + countWords(s.narration), 0);
  log(p, `Kịch bản xong: ${p.scenes.length} cảnh, ${words} từ (≈ ${(words / wordsPerMinute(p.settings.voice)).toFixed(1)} phút).`);
  progress(p, 'script', 3, 3, 'Xong');
  save(p);
}
