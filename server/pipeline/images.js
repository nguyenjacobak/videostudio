// "Ảnh AI" stage of the motion-graphics style: Flash plans the illustrations the script needs (reusing the library
// first), the image model draws them — sprites batched 4 per call on a chroma sheet, backgrounds one per call — and
// they are keyed, cut and saved into the project and the shared library for later videos.
import fs from 'fs';
import path from 'path';
import { chatJson } from '../llm.js';
import { generateImage, keyAndSplit, prepBackground, sheetPrompt, backgroundPrompt, scenePrompt, animPrompt, keyColorFor } from '../imagegen.js';
import { imagePlanPrompt } from '../prompts.js';
import { STYLES } from '../styles.js';
import { LIBRARY_DIR, getSettings } from '../config.js';
import { save, log, progress, usageRecorder, projectDir } from '../store.js';
import { normalizeText, readJson, writeJsonAtomic, pMap } from '../util.js';

export const IMAGE_STYLE = 'clean flat vector illustration with soft gradients, gentle shading and subtle grain, rounded friendly shapes, rich harmonious colours, crisp edges — the look of Kurzgesagt / TED-Ed explainer animations';
const LIB_DIR = path.join(LIBRARY_DIR, 'images');
const LIB_INDEX = path.join(LIB_DIR, 'index.json');
const PER_SHEET = 6;

export const listImageLibrary = () => readJson(LIB_INDEX, {});
const libKey = (kind, name) => `${kind}__${normalizeText(name).replace(/\s+/g, '_')}`.slice(0, 90);
const cleanId = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'img';

function remember(entry, buf) {
  fs.mkdirSync(LIB_DIR, { recursive: true });
  const lib = listImageLibrary();
  const key = libKey(entry.kind, entry.name);
  const file = `${key}.${entry.kind === 'sprite' ? 'png' : 'jpg'}`;
  fs.writeFileSync(path.join(LIB_DIR, file), buf);
  lib[key] = { key, name: entry.name, description: entry.description || entry.name, kind: entry.kind, file, w: entry.w, h: entry.h, style: 'motion', createdAt: Date.now(), uses: 1 };
  writeJsonAtomic(LIB_INDEX, lib);
}

/** Images every scene can use: { id: { url, w, h, kind, name } } (runtime data). */
export function imagesForRuntime(p) {
  const out = {};
  for (const im of p.images || []) if (im.status === 'done') out[im.id] = { url: `/files/${p.id}/images/${im.file}?v=${im.v || 1}`, w: im.w, h: im.h, kind: im.kind, name: im.name, ...(im.frames ? { frames: im.frames.map(f => `/files/${p.id}/images/${f}?v=${im.v || 1}`) } : {}) };
  return out;
}

export async function runImagesStage(p, signal) {
  const onUsage = usageRecorder(p);
  // budget: explicit number, or 'auto' ≈ one picture per two scenes + a sprite sheet or two (≈65 credits per call)
  const cfg = getSettings().llm.imageBudget;
  const budget = Number.isFinite(+cfg) && cfg !== 'auto' && cfg !== '' ? Math.max(0, +cfg) : Math.min(8, Math.max(3, Math.ceil(p.scenes.length / 4) + 2));
  const dir = projectDir(p.id, 'images');
  fs.mkdirSync(dir, { recursive: true });
  if (!p.style?.tokens) p.style = { presetId: 'motion', tokens: { ...STYLES.cartoon.tokens }, ambient: 'none', by: 'preset' };

  if (!Array.isArray(p.images)) {
    progress(p, 'art', 0, 1, 'Lập danh sách hình');
    const lib = Object.values(listImageLibrary()).filter(e => fs.existsSync(path.join(LIB_DIR, e.file))).sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, 80);
    log(p, `Flash lập danh sách hình minh họa cần vẽ (thư viện có ${lib.length} hình dùng lại được, tối đa ${budget} lượt vẽ mới)...`);
    let plan = { sprites: [], backgrounds: [], illustrations: [], reuse: [] };
    try {
      plan = await chatJson({ role: 'flash', messages: imagePlanPrompt(p, lib, budget, PER_SHEET), temperature: 0.4, maxTokens: 6000, onUsage, signal });
    } catch (err) {
      if (err.fatal) throw err;
      log(p, `Không lập được danh sách hình: ${err.message} — dựng cảnh bằng hình vector sẵn có.`, 'warn');
    }
    const images = [], used = new Set();
    const uniq = id => { let k = cleanId(id), n = 2; while (used.has(k)) k = `${cleanId(id)}_${n++}`; used.add(k); return k; };
    // reuse from the library (free)
    const byKey = new Map(lib.map(e => [e.key, e]));
    for (const r of plan.reuse || []) {
      const e = byKey.get(r?.key);
      if (!e) continue;
      const id = uniq(r.id || e.name), file = `${id}.${e.kind === 'sprite' ? 'png' : 'jpg'}`;
      fs.copyFileSync(path.join(LIB_DIR, e.file), path.join(dir, file));
      images.push({ id, name: e.name, description: e.description, kind: e.kind, file, w: e.w, h: e.h, scenes: (plan.reuse.find(x => x?.key === r.key)?.scenes || []).filter(Number.isInteger), status: 'done', reused: true });
      const all = listImageLibrary(); if (all[e.key]) { all[e.key].uses = (all[e.key].uses || 0) + 1; writeJsonAtomic(LIB_INDEX, all); }
    }
    // new drawings within the budget: backgrounds first (≤ 2), the rest of the calls go to sprite sheets
    // layered pictures: an empty plate + its moving parts drawn as one sheet in the same light (2+ calls each)
    const layered = [];
    let layerCalls = 0;
    for (const L of (plan.layered || []).filter(x => x?.plate && Array.isArray(x.parts) && x.parts.some(q => q?.prompt)).slice(0, 2)) {
      const cost = 1 + Math.ceil(Math.min(PER_SHEET, L.parts.length) / PER_SHEET);
      if (layerCalls + cost > budget - 1) break;
      layered.push(L); layerCalls += cost;
    }
    const ills = (plan.illustrations || []).filter(b => b?.prompt).slice(0, Math.max(0, Math.min(budget - 1 - layerCalls, Math.ceil(p.scenes.length / 4) - layered.length)));
    const bgs = (plan.backgrounds || []).filter(b => b?.prompt).slice(0, Math.max(0, Math.min(2, budget - layerCalls - ills.length - 1)));
    const anims = (plan.animations || []).filter(a => a?.prompt).slice(0, Math.max(0, Math.min(3, budget - layerCalls - bgs.length - ills.length - 1)));
    const sheetCalls = Math.max(0, budget - layerCalls - bgs.length - ills.length - anims.length);
    const sprites = (plan.sprites || []).filter(s => s?.prompt).slice(0, sheetCalls * PER_SHEET);
    const sc = x => (Array.isArray(x?.scenes) ? x.scenes.filter(Number.isInteger) : []);
    for (const a of anims) images.push({ id: uniq(a.id || a.name), name: a.name || a.id, description: `${a.prompt} — ${a.action || ''}`, prompt: a.prompt, action: a.action, frames: undefined, nFrames: [4, 6].includes(+a.frames) ? +a.frames : 6, kind: 'anim', key: keyColorFor(`${a.name} ${a.prompt}`), scenes: sc(a), status: 'pending' });
    for (const L of layered) {
      const plateId = uniq(L.id || L.name), parts = L.parts.filter(q => q?.prompt).slice(0, PER_SHEET);
      const partIds = parts.map(q => uniq(q.id || q.name));
      images.push({ id: plateId, name: L.name || L.id, description: L.plate, prompt: L.plate, kind: 'scene', layers: partIds, scenes: sc(L), status: 'pending' });
      parts.forEach((q, k) => images.push({ id: partIds[k], name: q.name || q.id, description: q.prompt, prompt: q.prompt, kind: 'sprite', layerOf: plateId, context: L.plate, key: keyColorFor(`${q.name} ${q.prompt}`), scenes: sc(L), status: 'pending' }));
    }
    for (const b of ills) images.push({ id: uniq(b.id || b.name), name: b.name || b.id, description: b.prompt, prompt: b.prompt, kind: 'scene', scenes: sc(b), status: 'pending' });
    for (const b of bgs) images.push({ id: uniq(b.id || b.name), name: b.name || b.id, description: b.prompt, prompt: b.prompt, kind: 'bg', scenes: sc(b), status: 'pending' });
    for (const s of sprites) images.push({ id: uniq(s.id || s.name), name: s.name || s.id, description: s.prompt, prompt: s.prompt, kind: 'sprite', key: keyColorFor(`${s.name} ${s.prompt}`), scenes: sc(s), status: 'pending' });
    p.images = images;
    p.imageStyle = IMAGE_STYLE;
    save(p);
    const fresh = images.filter(i => !i.reused);
    log(p, `Hình minh họa: ${images.filter(i => i.reused).length} dùng lại từ thư viện, ${fresh.length} vẽ mới (${fresh.filter(i => i.kind === 'scene' && i.layers).length} tranh tách lớp, ${fresh.filter(i => i.kind === 'scene' && !i.layers).length} tranh tình huống, ${fresh.filter(i => i.kind === 'bg').length} ảnh nền, ${fresh.filter(i => i.kind === 'sprite').length} hình tách nền).`);
  }

  // jobs: one per background, sprites grouped into sheets of the same key colour
  const pending = p.images.filter(i => i.status !== 'done' && i.status !== 'failed');
  const jobs = pending.filter(i => i.kind === 'bg' || i.kind === 'scene' || i.kind === 'anim').map(i => ({ kind: i.kind, items: [i] }));
  // a picture's layers share one sheet (same light and palette as the plate), split only by key colour
  const plates = [...new Set(pending.filter(i => i.kind === 'sprite' && i.layerOf).map(i => i.layerOf))];
  for (const plate of plates) for (const key of ['green', 'magenta']) {
    const list = pending.filter(i => i.kind === 'sprite' && i.layerOf === plate && i.key === key);
    if (list.length) jobs.push({ kind: 'sheet', key, items: list, context: list[0].context });
  }
  for (const key of ['green', 'magenta']) {
    const list = pending.filter(i => i.kind === 'sprite' && !i.layerOf && i.key === key);
    for (let k = 0; k < list.length; k += PER_SHEET) jobs.push({ kind: 'sheet', key, items: list.slice(k, k + PER_SHEET) });
  }
  if (!jobs.length) return;
  let done = 0;
  progress(p, 'art', 0, jobs.length, 'Vẽ hình minh họa');
  log(p, `Model ảnh đang vẽ ${jobs.length} lượt (≈ ${jobs.length * 65} credit)...`);
  const results = await pMap(jobs, 3, async job => {
    if (signal?.aborted) throw new Error('Đã huỷ');
    try {
      if (job.kind === 'anim') {
        const im = job.items[0];
        const raw = await generateImage(animPrompt(im, im.nFrames, p.imageStyle || IMAGE_STYLE, im.key), { onUsage, signal });
        const parts = await keyAndSplit(raw, { expected: im.nFrames, key: im.key, uniform: true });
        if (parts.filter(Boolean).length < Math.ceil(im.nFrames * 0.75)) throw new Error('chuỗi động tác cắt không đủ khung');
        im.frames = []; im.v = Date.now();
        parts.forEach((part, k) => { if (!part) return; const f = `${im.id}_f${k + 1}.png`; fs.writeFileSync(path.join(dir, f), part.png); im.frames.push(f); im.w = part.w; im.h = part.h; });
        im.file = im.frames[0]; im.status = 'done';
      } else if (job.kind === 'bg' || job.kind === 'scene') {
        const im = job.items[0], style = p.imageStyle || IMAGE_STYLE;
        const buf = await prepBackground(await generateImage(job.kind === 'scene' ? scenePrompt(im.prompt, style) : backgroundPrompt(im.prompt, style), { onUsage, signal }), { blur: job.kind === 'scene' ? 0 : 1.6 });
        im.file = `${im.id}.jpg`; im.w = 1920; im.h = 1080; im.status = 'done'; im.v = Date.now();
        fs.writeFileSync(path.join(dir, im.file), buf);
        remember(im, buf);
      } else {
        const raw = await generateImage(sheetPrompt(job.items, p.imageStyle || IMAGE_STYLE, job.key, job.context), { onUsage, signal });
        // keep the uncut sheet so it can be re-split later without paying for a new image
        try { fs.mkdirSync(path.join(dir, 'raw'), { recursive: true }); fs.writeFileSync(path.join(dir, 'raw', `${job.items.map(i => i.id).join('+').slice(0, 120)}.jpg`), raw); } catch {}
        const parts = await keyAndSplit(raw, { expected: job.items.length, key: job.key });
        job.items.forEach((im, k) => {
          const part = parts[k];
          if (!part) { im.status = 'failed'; return; }
          im.file = `${im.id}.png`; im.w = part.w; im.h = part.h; im.status = 'done'; im.v = Date.now();
          fs.writeFileSync(path.join(dir, im.file), part.png);
          remember(im, part.png);
        });
      }
    } catch (err) {
      if (err.fatal) throw err;
      job.items.forEach(im => { im.status = 'failed'; im.error = err.message; });
      log(p, `Không vẽ được ${job.items.map(i => i.name).join(', ')}: ${err.message.slice(0, 160)}`, 'warn');
    }
    progress(p, 'art', ++done, jobs.length, 'Vẽ hình minh họa');
    save(p);
  });
  const fatal = results.find(r => !r.ok && r.error?.fatal);
  if (fatal) throw fatal.error;
  const ok = p.images.filter(i => i.status === 'done').length;
  log(p, `Hình minh họa sẵn sàng: ${ok}/${p.images.length}.`);
  save(p);
}
