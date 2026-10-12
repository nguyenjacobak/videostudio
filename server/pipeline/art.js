import fs from 'fs';
import path from 'path';
import { chat, chatJson } from '../llm.js';
import { artDirectionPrompt, assetPrompt, libraryPickPrompt, assetReviewPrompt } from '../prompts.js';
import { snapshotSvg } from '../browser.js';
import { gfxNames } from '../cartoonPrompt.js';
import { STYLES, ASTRA_MAX_NEW_DRAWINGS } from '../styles.js';
import { LIBRARY_DIR, getSettings } from '../config.js';
import { save, log, progress, usageRecorder, projectDir } from '../store.js';
import { normalizeText, readJson, writeJsonAtomic, pMap } from '../util.js';

const LIB_INDEX = path.join(LIBRARY_DIR, 'index.json');

function libraryKey(styleId, name) {
  return `${styleId}__${normalizeText(name).replace(/\s+/g, '_')}`.slice(0, 90);
}

export function listLibrary() {
  return readJson(LIB_INDEX, {});
}

// Drawings that must not be reused: hand-drawn maps/flags/territory (never accurate) and static presenter portraits
// (cartoon videos have rigged characters).
export const BLOCKED = /bản đồ|lãnh thổ|biên giới|quốc kỳ|quốc huy|cờ|(^|[s_-])(map|flag)([s_-]|$)|dẫn chuyện|(^|_)host(_|$)/i;

/** Library drawings of this style that later videos may reuse for free (most used first). */
function reusableAssets(lib, styleId) {
  return Object.entries(lib)
    .filter(([, e]) => e.style === styleId && e.review?.ok !== false && !BLOCKED.test(`${e.id} ${e.name}`) && fs.existsSync(path.join(LIBRARY_DIR, e.file)))
    .map(([key, e]) => ({ key, ...e }))
    .sort((a, b) => (b.uses || 0) - (a.uses || 0) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 60);
}

/** Library entries chosen by the model → planned assets (reused, no Astra call). */
function reusedAssets(picks, reusable) {
  const byKey = new Map(reusable.map(e => [e.key, e])), seen = new Set();
  return (Array.isArray(picks) ? picks : []).map(r => byKey.get(String(r?.key || r))).filter(e => e && !seen.has(e.id) && seen.add(e.id)).slice(0, 10)
    .map(e => ({ id: e.id, name: e.name, description: e.description || e.name, parts: [], scenes: (picks.find(r => (r?.key || r) === e.key)?.scenes || []).filter(Number.isInteger), reuseKey: e.key }));
}

/** Exact key first, then a same-style entry whose name contains (or is contained in) this one. */
function findInLibrary(lib, styleId, name) {
  const key = libraryKey(styleId, name);
  if (lib[key] && !BLOCKED.test(`${lib[key].id} ${lib[key].name}`)) return lib[key];
  const n = ` ${normalizeText(name)} `;
  return Object.values(lib).find(e => {
    if (e.style !== styleId || BLOCKED.test(`${e.id} ${e.name}`)) return false;
    const m = ` ${normalizeText(e.name)} `;
    return m.trim().length >= 8 && (n.includes(m) || m.includes(n));
  }) || null;
}

/** Strip anything executable/external from an SVG and make it scale to its container. */
export function sanitizeSvg(raw, idPrefix) {
  let svg = String(raw).replace(/```(?:svg|xml|html)?/gi, '').trim();
  const start = svg.indexOf('<svg'), end = svg.lastIndexOf('</svg>');
  if (start < 0 || end < 0) throw new Error('Không có thẻ <svg>');
  svg = svg.slice(start, end + 6)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<image[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/(href|xlink:href)="(?!#)[^"]*"/gi, '');
  svg = svg.replace(/<svg([^>]*)>/i, (m, attrs) => {
    let a = attrs.replace(/\s(width|height)="[^"]*"/gi, '');
    if (!/viewBox=/i.test(a)) a += ' viewBox="0 0 800 800"';
    return `<svg${a} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" data-asset-id="${idPrefix}">`;
  });
  if (svg.length < 200) throw new Error('SVG quá sơ sài');
  return svg;
}

function assetParts(svg, id) {
  const ids = [...svg.matchAll(/<g[^>]*\sid="([^"]+)"/g)].map(m => m[1]).filter(x => x.startsWith(`${id}-`));
  return [...new Set(ids)].slice(0, 12);
}

/** Luna looks at the rendered drawing; any failure of the check itself counts as a pass (never blocks the video). */
async function reviewAsset(a, svg, onUsage, signal) {
  if (getSettings().llm?.visionReview === false) return { ok: true, issues: [] };
  try {
    const v = await chatJson({ role: 'vision', messages: assetReviewPrompt(a, await snapshotSvg(svg)), temperature: 0.2, maxTokens: 1500, onUsage, signal });
    return { ok: v.ok !== false, issues: (v.issues || []).map(String) };
  } catch (err) {
    if (err.fatal || signal?.aborted) throw err;
    return { ok: true, issues: [] };
  }
}

export async function runArtStage(p, signal) {
  const onUsage = usageRecorder(p);
  const preset = STYLES.cartoon;

  if (!p.style) {
    const style = { presetId: 'cartoon', ambient: preset.ambient, tokens: { ...preset.tokens }, visualLanguage: [], motif: '', by: 'preset' };
    let plannedAssets = [];
    const reusable = reusableAssets(listLibrary(), 'cartoon');
    let directed = false;
    {
      // Astra is always consulted once; it decides from the content how many new drawings (0..max) are worth making.
      progress(p, 'art', 0, 1, 'Astra chỉ đạo mỹ thuật');
      log(p, 'GPT-6 Astra đang chỉ đạo mỹ thuật cho toàn video (1 lần gọi)...');
      try {
        const art = await chatJson({ role: 'astra', messages: artDirectionPrompt(p, preset, ASTRA_MAX_NEW_DRAWINGS, gfxNames(), reusable), temperature: 0.7, maxTokens: 6000, onUsage, signal });
        directed = true;
        for (const [k, v] of Object.entries(art.palette || {})) if (k in style.tokens && /^#[0-9a-f]{3,8}$/i.test(String(v))) style.tokens[k] = v;
        style.visualLanguage = (art.visualLanguage || []).slice(0, 12);
        style.motif = art.motif || '';
        style.by = 'astra';
        const reused = reusedAssets(art.reuse, reusable);
        plannedAssets = [...reused, ...(art.heroAssets || []).filter(a => !reused.some(r => r.id === a.id)).slice(0, ASTRA_MAX_NEW_DRAWINGS).map(a => ({
          id: String(a.id || a.name).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32),
          name: a.name, description: a.description || a.name, parts: (a.parts || []).slice(0, 6), scenes: (a.scenes || []).filter(Number.isInteger),
        }))];
        const fresh = plannedAssets.length - reused.length;
        log(p, `Astra quyết định: ${fresh ? `vẽ mới ${fresh} hình (${plannedAssets.slice(reused.length).map(a => a.name).join(', ')})` : 'không cần vẽ hình mới — thư viện vật thể và bối cảnh đã đủ'}${reused.length ? `, dùng lại ${reused.length} hình từ thư viện` : ''}.`);
      } catch (err) {
        if (err.fatal) throw err;
        log(p, `Astra chỉ đạo mỹ thuật lỗi, dùng phong cách gốc: ${err.message}`, 'warn');
      }
    }
    if (!directed && reusable.length) {
      // Astra unavailable: Flash (cheap) still picks drawings from earlier videos that fit this one.
      try {
        const r = await chatJson({ role: 'flash', messages: libraryPickPrompt(p, reusable), temperature: 0.3, maxTokens: 3000, onUsage, signal });
        plannedAssets = reusedAssets(r.reuse, reusable);
      } catch (err) {
        if (err.fatal) throw err;
        log(p, `Không chọn được hình từ thư viện: ${err.message}`, 'warn');
      }
    }
    p.style = style;
    p.assets = plannedAssets.map(a => ({ ...a, status: 'pending' }));
    save(p);
  }

  const pending = p.assets.filter(a => a.status !== 'done');
  if (pending.length) {
    const lib = listLibrary();
    let done = p.assets.length - pending.length;
    log(p, `Chuẩn bị ${pending.length} hình minh họa chủ lực...`);
    await pMap(pending, 2, async a => {
      if (signal?.aborted) return;
      const key = libraryKey(p.style.presetId, a.name);
      const file = projectDir(p.id, 'assets', `${a.id}.svg`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      try {
        const hit = a.reuseKey ? lib[a.reuseKey] : findInLibrary(lib, p.style.presetId, a.name);
        if (hit && fs.existsSync(path.join(LIBRARY_DIR, hit.file))) {
          // Reuse from library: rewrite the stored id prefix to this asset's id.
          const svg = fs.readFileSync(path.join(LIBRARY_DIR, hit.file), 'utf8').split(`${hit.id}-`).join(`${a.id}-`).replace(/data-asset-id="[^"]*"/, `data-asset-id="${a.id}"`);
          fs.writeFileSync(file, svg);
          a.source = 'library';
          hit.uses = (hit.uses || 0) + 1; hit.lastUsed = Date.now();
          writeJsonAtomic(LIB_INDEX, lib);
          log(p, `♻ Dùng lại "${a.name}" từ thư viện (không tốn Astra).`);
        } else {
          // Draw → Luna checks it (one object, no frame/background/insets/labels, true to life) → one redraw with the feedback.
          let svg = '', feedback = '', passed = false;
          for (let attempt = 0; attempt < 2 && !passed; attempt++) {
            const r = await chat({ role: 'astra', messages: assetPrompt(a, p.style.tokens, p.style.visualLanguage, feedback), temperature: 0.6, maxTokens: 16000, onUsage, signal });
            svg = sanitizeSvg(r.content, a.id);
            const review = await reviewAsset(a, svg, onUsage, signal);
            passed = review.ok;
            if (!passed) {
              feedback = review.issues.join('; ').slice(0, 900);
              log(p, `Luna soát "${a.name}": ${feedback.slice(0, 180)}${attempt === 0 ? ' — Astra vẽ lại.' : ' — dùng tạm cho video này, không lưu thư viện.'}`, 'warn');
            }
          }
          fs.writeFileSync(file, svg);
          if (passed) {
            const libFile = `${key}.svg`;
            fs.writeFileSync(path.join(LIBRARY_DIR, libFile), svg);
            lib[key] = { id: a.id, name: a.name, description: a.description, style: p.style.presetId, file: libFile, createdAt: Date.now(), review: { ok: true, at: Date.now() } };
            writeJsonAtomic(LIB_INDEX, lib);
          }
          a.source = 'astra';
          log(p, `🎨 Astra vẽ xong "${a.name}"${passed ? ' (đã soát, lưu thư viện)' : ''}.`);
        }
        a.parts = assetParts(fs.readFileSync(file, 'utf8'), a.id);
        a.status = 'done';
      } catch (err) {
        if (err.fatal) throw err;
        a.status = 'failed';
        a.error = err.message;
        log(p, `Không vẽ được "${a.name}": ${err.message}`, 'warn');
      }
      progress(p, 'art', ++done, p.assets.length, 'Vẽ hình chủ lực');
      save(p);
    });
    p.assets = p.assets.filter(a => a.status === 'done');
  }
  save(p);
}

export function loadAssetsSvg(p) {
  const out = {};
  for (const a of p.assets || []) {
    try { out[a.id] = fs.readFileSync(projectDir(p.id, 'assets', `${a.id}.svg`), 'utf8'); } catch {}
  }
  return out;
}
