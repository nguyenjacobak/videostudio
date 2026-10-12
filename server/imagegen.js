// AI image generation (gemini flash image via the proxy) + local post-processing in headless Chrome:
//  - sprite sheets: several items drawn on a flat chroma background in one call (one call ≈ 65 credits, so items are
//    batched), keyed out to transparency and cut into separate PNG sprites;
//  - backgrounds: square images cropped to 16:9 and softened so animated subjects stand out in front of them.
import { chat } from './llm.js';
import { getBrowser } from './browser.js';

const GREENISH = /green|xanh lá|leaf|leaves|plant|tree|grass|forest|jungle|cactus|lettuce|vegetable|herb|frog|lime|cây|lá|rau|cỏ|rừng|dollar|money|banknote|cash|tiền|đô la|emerald|jade/i;
export const keyColorFor = text => (GREENISH.test(text) ? 'magenta' : 'green');

/** One image call → JPEG/PNG buffer. */
export async function generateImage(prompt, { onUsage, signal } = {}) {
  const r = await chat({ role: 'image', messages: [{ role: 'user', content: prompt }], temperature: 0.8, maxTokens: 4000, onUsage, signal, retries: 3 });
  const m = r.content.match(/data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error(`Model ảnh không trả về ảnh: ${r.content.slice(0, 160)}`);
  return Buffer.from(m[2], 'base64');
}

export function sheetLayout(n) {
  return n <= 1 ? { cols: 1, rows: 1 } : n === 2 ? { cols: 2, rows: 1 } : n <= 4 ? { cols: 2, rows: 2 } : n <= 6 ? { cols: 3, rows: 2 } : { cols: 3, rows: 3 };
}

/** Prompt for a sheet of items (already in reading order) on a flat key colour. */
export function sheetPrompt(items, style, key, context) {
  const { cols, rows } = sheetLayout(items.length);
  const bg = key === 'magenta' ? 'perfectly flat solid pure magenta (#FF00FF)' : 'perfectly flat solid pure green (#00FF00)';
  const list = items.map((it, i) => `(${i + 1}) ${it.prompt}`).join('; ');
  return `Create ONE image: a sprite sheet of EXACTLY ${items.length} separate illustration${items.length > 1 ? 's' : ''} (one object per cell, never draw an item twice, no extra objects) arranged in a ${cols}x${rows} grid (reading order left→right, top→bottom) with wide empty spacing between them, on a ${bg} background. Items: ${list}. Style: ${style}. Each item complete, large within its own cell, not touching other items or the image edges, drawn directly on the flat background (NOT on white cards, tiles, stickers or panels), no outline around the item, no cast shadow on the background, no ground, no frame, no text, no letters, no labels, no numbers unless part of the object.${context ? ` These objects are separate animation layers that will be composited onto this scene: ${context} — match its lighting, colour palette, rendering style and viewing angle.` : ''}`;
}

/** A full situation illustration (real scene or visual metaphor) — the camera will frame parts of it. */
export function scenePrompt(desc, style) {
  return `Create ONE wide cinematic illustration (it will be cropped to 16:9 — keep every important element inside the central horizontal band, nothing important near the top or bottom edge): ${desc}. A storytelling explainer-video frame: one clear focal subject, readable staging, rich but uncluttered detail, expressive lighting. No text, no letters, no numbers, no logos, no watermark, no frame. Style: ${style}.`;
}

/** One subject in N consecutive poses of a looping action (sprite animation), same size/position in every cell. */
export function animPrompt(item, frames, style, key) {
  const { cols, rows } = sheetLayout(frames);
  const bg = key === 'magenta' ? 'perfectly flat solid pure magenta (#FF00FF)' : 'perfectly flat solid pure green (#00FF00)';
  return `Create ONE image: an animation sprite sheet — ${frames} frames of ONE smooth looping motion of the SAME subject: ${item.prompt}, ${item.action || 'idle motion'}. Frames arranged in a ${cols}x${rows} grid in reading order (left→right, top→bottom). The subject must be IDENTICAL in every frame (same design, colours, size and scale, same camera angle), centred in its cell with its base/feet at the same height in every cell; each frame shows a CLEARLY DIFFERENT phase of the motion (e.g. walking: contact, down, passing, up, contact, passing — limbs visibly in different positions), changing progressively so the frames play as a seamless loop. Background: ${bg}, flat, no ground, no shadow, no frame lines, no numbers, no text. Style: ${style}.`;
}

export function backgroundPrompt(desc, style) {
  return `Create ONE wide landscape image (it will be cropped to 16:9, keep important content in the middle band): ${desc}. Use it as the background of an animated explainer video: calm composition, open empty area in the middle/foreground for animated objects, no people, no text, no letters. Style: ${style}.`;
}

/* eslint-disable */
// Runs inside the page (serialised with toString): remove a uniform light "card" behind an item and stray fragments.
function cleanCanvasFn(o, opt) {
  opt = opt || {};
  const w = o.width, h = o.height;
  const oc = o.getContext('2d'), od = oc.getImageData(0, 0, w, h), q = od.data, edge = [];
  // connected opaque components with their bounding boxes
  const components = () => {
    const lab = new Int32Array(w * h), comps = [];
    for (let p0 = 0; p0 < w * h; p0++) {
      if (q[p0 * 4 + 3] < 40 || lab[p0]) continue;
      const c = { id: comps.length + 1, mem: [], x0: w, y0: h, x1: 0, y1: 0 }, qq = [p0]; lab[p0] = c.id;
      while (qq.length) { const p = qq.pop(); c.mem.push(p); const px = p % w, py = (p / w) | 0;
        if (px < c.x0) c.x0 = px; if (px > c.x1) c.x1 = px; if (py < c.y0) c.y0 = py; if (py > c.y1) c.y1 = py;
        for (const n of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]) if (n >= 0 && !lab[n] && q[n * 4 + 3] >= 40) { lab[n] = c.id; qq.push(n); } }
      comps.push(c);
    }
    return comps;
  };
  // 1) the model sometimes paints an item on a white card: if the crop's border is a uniform light colour, key that out too
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;   // opaque bounding box (the crop keeps a transparent margin)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (q[(j * w + i) * 4 + 3] > 200) { if (i < bx0) bx0 = i; if (i > bx1) bx1 = i; if (j < by0) by0 = j; if (j > by1) by1 = j; }
  bx0 += 4; by0 += 4; bx1 -= 4; by1 -= 4;   // a few px inside: the card's own outline is anti-aliased
  if (bx1 > bx0 && by1 > by0) { for (let i = bx0; i <= bx1; i++) edge.push(by0 * w + i, by1 * w + i); for (let j = by0; j <= by1; j++) edge.push(j * w + bx0, j * w + bx1); }
  const op = edge.filter(p => q[p * 4 + 3] > 200);
  if (op.length > edge.length * 0.5) {
    const m = [0, 1, 2].map(c => op.reduce((a2, p) => a2 + q[p * 4 + c], 0) / op.length);
    const close = p => Math.abs(q[p * 4] - m[0]) + Math.abs(q[p * 4 + 1] - m[1]) + Math.abs(q[p * 4 + 2] - m[2]) < 80;
    if (m[0] + m[1] + m[2] > 600 && op.filter(close).length > op.length * 0.8) {
      const seen = new Uint8Array(w * h), st = op.filter(close);
      st.forEach(p => { seen[p] = 1; });
      while (st.length) { const p = st.pop(); q[p * 4 + 3] = 0; const px2 = p % w, py2 = (p / w) | 0;
        for (const n of [px2 > 0 ? p - 1 : -1, px2 < w - 1 ? p + 1 : -1, py2 > 0 ? p - w : -1, py2 < h - 1 ? p + w : -1]) if (n >= 0 && !seen[n] && q[n * 4 + 3] > 0 && close(n)) { seen[n] = 1; st.push(n); } }
      // drop leftover fragments (the card's thin outline): keep only components ≥ 4% of the opaque area
      const comps = components(), total = comps.reduce((a2, c2) => a2 + c2.mem.length, 0);
      for (const c2 of comps) if (c2.mem.length < total * 0.04) for (const p of c2.mem) q[p * 4 + 3] = 0;
    }
  }
  // 2) isolate ONE object: the largest component plus whatever sits right next to it (steam, handles, sparkles touching it).
  //    Separate objects (a duplicate drawn below, a neighbour that leaked into the cell) are erased.
  let keep = null;
  if (opt.isolate !== false) {
    const comps = components();
    if (comps.length) {
      comps.sort((x, y) => y.mem.length - x.mem.length);
      const main = comps[0], thr = Math.max(10, 0.06 * Math.max(main.x1 - main.x0, main.y1 - main.y0));
      const gap = (a2, b2) => Math.max(0, a2.x0 - b2.x1, b2.x0 - a2.x1, a2.y0 - b2.y1, b2.y0 - a2.y1);
      const kept = [main]; let grew = true;
      while (grew) { grew = false; for (const c of comps) if (!kept.includes(c) && kept.some(k => gap(c, k) <= thr)) { kept.push(c); grew = true; } }
      for (const c of comps) if (!kept.includes(c)) for (const p of c.mem) q[p * 4 + 3] = 0;
      keep = kept.reduce((u, c) => ({ x0: Math.min(u.x0, c.x0), y0: Math.min(u.y0, c.y0), x1: Math.max(u.x1, c.x1), y1: Math.max(u.y1, c.y1) }), { x0: w, y0: h, x1: 0, y1: 0 });
    }
  }
  oc.putImageData(od, 0, 0);
  if (!keep || opt.crop === false) return o;
  const pad = 6, x = Math.max(0, keep.x0 - pad), y = Math.max(0, keep.y0 - pad), cw = Math.min(w, keep.x1 + 1 + pad) - x, ch = Math.min(h, keep.y1 + 1 + pad) - y;
  const out = document.createElement('canvas'); out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(o, x, y, cw, ch, 0, 0, cw, ch);
  return out;
}
const CLEAN_CANVAS = `window.cleanCanvas = ${cleanCanvasFn.toString()};`;

async function withCanvasPage(fn) {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  try { const page = await context.newPage(); await page.setContent('<body></body>'); await page.evaluate(CLEAN_CANVAS); return await fn(page); }
  finally { await context.close().catch(() => {}); }
}

/**
 * Key out the flat background (flood fill from the borders, so key-coloured parts inside an object survive), soften and
 * despill the edges, then cut the sheet into `expected` sprites ordered by grid cell. Returns [{ png: Buffer, w, h }].
 */
export async function keyAndSplit(buf, { expected = 1, key = 'green', uniform = false } = {}) {
  const src = `data:image/${buf[0] === 0x89 ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
  const { cols, rows } = sheetLayout(expected);
  const out = await withCanvasPage(page => page.evaluate(async ({ src, expected, key, cols, rows, uniform }) => {
    const img = new Image(); img.src = src; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, W, H), px = d.data;
    // how strongly a pixel looks like the key colour: 0 (not at all) … 1 (pure key)
    const keyness = i => {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const s = key === 'magenta' ? Math.min(r, b) - g : g - Math.max(r, b);
      return s <= 40 ? 0 : Math.min(1, (s - 40) / 110);
    };
    const bg = new Uint8Array(W * H), stack = [];
    const seed = (x, y) => { const p = y * W + x; if (!bg[p] && keyness(p * 4) > 0.5) { bg[p] = 1; stack.push(p); } };
    for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
    for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0;
      if (x > 0) seed(x - 1, y);
      if (x < W - 1) seed(x + 1, y);
      if (y > 0) seed(x, y - 1);
      if (y < H - 1) seed(x, y + 1);
    }
    // alpha: background → 0; pixels bordering it → partial by keyness (anti-aliased edge); remove the key colour's spill
    for (let p = 0; p < W * H; p++) {
      const i = p * 4;
      // pure key colour enclosed by the object (the hole of a price tag) is background too
      if (bg[p] || keyness(i) > 0.92) { px[i + 3] = 0; continue; }
      const x = p % W, y = (p / W) | 0;
      const edge = (x > 0 && bg[p - 1]) || (x < W - 1 && bg[p + 1]) || (y > 0 && bg[p - W]) || (y < H - 1 && bg[p + W]);
      const k = keyness(i);
      if (edge) px[i + 3] = Math.round(255 * (1 - k * 0.9));
      if (key === 'magenta') { if ((edge || k > 0) && px[i] > px[i + 1] + 30 && px[i + 2] > px[i + 1] + 30) px[i] = px[i + 2] = Math.min(px[i], px[i + 2], px[i + 1] + 40); }
      else if ((edge || k > 0) && px[i + 1] > Math.max(px[i], px[i + 2]) + 10) px[i + 1] = Math.max(px[i], px[i + 2]) + 10;
    }
    cx.putImageData(d, 0, 0);
    // connected components of opaque pixels (8-neighbour, coarse grid for speed)
    const S = 4, gw = Math.ceil(W / S), gh = Math.ceil(H / S), occ = new Uint8Array(gw * gh);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (px[(y * W + x) * 4 + 3] > 40) occ[((y / S) | 0) * gw + ((x / S) | 0)] = 1;
    const lab = new Int32Array(gw * gh), comps = [];
    for (let s0 = 0; s0 < gw * gh; s0++) {
      if (!occ[s0] || lab[s0]) continue;
      const id = comps.length + 1, q = [s0]; lab[s0] = id;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
      while (q.length) {
        const c = q.pop(), x = c % gw, y = (c / gw) | 0; n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const nc = ny * gw + nx; if (occ[nc] && !lab[nc]) { lab[nc] = id; q.push(nc); }
        }
      }
      comps.push({ x0: x0 * S, y0: y0 * S, x1: Math.min(W, (x1 + 1) * S), y1: Math.min(H, (y1 + 1) * S), n });
    }
    // assign components to grid cells by centre; a cell's sprite = union of its components (steam wisps, chopsticks…)
    const big = comps.filter(c => c.n * S * S > W * H * 0.0015);
    const cells = Array.from({ length: cols * rows }, () => null);
    const unite = (u, c) => ({ x0: Math.min(u.x0, c.x0), y0: Math.min(u.y0, c.y0), x1: Math.max(u.x1, c.x1), y1: Math.max(u.y1, c.y1), n: u.n + c.n });
    // Preferred: the model often drifts off the grid — take the real objects in reading order. Small fragments
    // (steam, chopsticks, sparkles) join the nearest main object; used when the count matches what was asked for.
    if (!uniform && big.length >= expected) {
      const sorted = big.slice().sort((a, b) => b.n - a.n), med = sorted[Math.min(sorted.length - 1, Math.floor(expected / 2))].n;
      let mains = big.filter(c => c.n >= med * 0.25).map(c => ({ ...c }));
      const cx = c => (c.x0 + c.x1) / 2, cy = c => (c.y0 + c.y1) / 2;
      for (const c of big.filter(c => c.n < med * 0.25)) { let best = null, bd = 1e12; for (const m of mains) { const d = (cx(m) - cx(c)) ** 2 + (cy(m) - cy(c)) ** 2; if (d < bd) { bd = d; best = m; } } if (best) Object.assign(best, unite(best, c)); }
      if (mains.length === expected) {
        const hMed = mains.map(m => m.y1 - m.y0).sort((a, b) => a - b)[Math.floor(mains.length / 2)];
        mains.sort((a, b) => cy(a) - cy(b));
        const rowsArr = [];
        for (const m of mains) { const r = rowsArr.find(r => Math.abs(cy(r[0]) - cy(m)) < hMed * 0.55); if (r) r.push(m); else rowsArr.push([m]); }
        const ordered = rowsArr.flatMap(r => r.sort((a, b) => cx(a) - cx(b)));
        ordered.forEach((m, k) => { cells[k] = m; });
        big.length = 0;   // skip the grid assignment below
      }
    }
    for (const c of big) {
      const ccx = (c.x0 + c.x1) / 2, ccy = (c.y0 + c.y1) / 2;
      const k = Math.min(rows - 1, Math.floor(ccy / H * rows)) * cols + Math.min(cols - 1, Math.floor(ccx / W * cols));
      const u = cells[k];
      cells[k] = u ? { x0: Math.min(u.x0, c.x0), y0: Math.min(u.y0, c.y0), x1: Math.max(u.x1, c.x1), y1: Math.max(u.y1, c.y1), n: u.n + c.n } : { ...c };
    }
    // animation frames: crop every cell with the same box (relative to its cell) so the frames stay registered
    if (uniform) {
      const cw = W / cols, ch = H / rows; let u = null;
      cells.slice(0, expected).forEach((c, k) => { if (!c) return; const ox = (k % cols) * cw, oy = Math.floor(k / cols) * ch; const r = { x0: c.x0 - ox, y0: c.y0 - oy, x1: c.x1 - ox, y1: c.y1 - oy }; u = u ? { x0: Math.min(u.x0, r.x0), y0: Math.min(u.y0, r.y0), x1: Math.max(u.x1, r.x1), y1: Math.max(u.y1, r.y1) } : r; });
      if (u) for (let k = 0; k < expected; k++) { const ox = (k % cols) * cw, oy = Math.floor(k / cols) * ch; cells[k] = { x0: Math.max(0, ox + u.x0), y0: Math.max(0, oy + u.y0), x1: Math.min(W, ox + u.x1), y1: Math.min(H, oy + u.y1) }; }
    }
    const res = [];
    for (let k = 0; k < expected; k++) {
      const c = cells[k];
      if (!c) { res.push(null); continue; }
      const pad = 6, x = Math.max(0, c.x0 - pad), y = Math.max(0, c.y0 - pad), w = Math.min(W, c.x1 + pad) - x, h = Math.min(H, c.y1 + pad) - y;
      const o = document.createElement('canvas'); o.width = w; o.height = h;
      o.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, w, h);
      const oc2 = window.cleanCanvas(o, uniform ? { isolate: false, crop: false } : {});
      res.push({ url: oc2.toDataURL('image/png'), w: oc2.width, h: oc2.height });
    }
    return res;
  }, { src, expected, key, cols, rows, uniform }));
  return out.map(r => (r ? { png: Buffer.from(r.url.split(',')[1], 'base64'), w: r.w, h: r.h } : null));
}

/** Square/any image → 1920×1080 cover crop, slightly softened (depth of field) → JPEG buffer. */
export async function prepBackground(buf, { blur = 1.6 } = {}) {
  const src = `data:image/${buf[0] === 0x89 ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
  const url = await withCanvasPage(page => page.evaluate(async ({ src, blur }) => {
    const img = new Image(); img.src = src; await img.decode();
    const W = 1920, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
    cx.filter = `blur(${blur}px) saturate(0.92)`;
    cx.drawImage(img, (W - w) / 2, (H - h) / 2 - h * 0.02, w, h);
    return cv.toDataURL('image/jpeg', 0.88);
  }, { src, blur }));
  return Buffer.from(url.split(',')[1], 'base64');
}

/** Clean an already keyed sprite PNG (white card leftovers, stray fragments) → PNG buffer. */
export async function cleanSprite(buf) {
  const src = 'data:image/png;base64,' + buf.toString('base64');
  const url = await withCanvasPage(page => page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const o = document.createElement('canvas'); o.width = img.naturalWidth; o.height = img.naturalHeight;
    o.getContext('2d').drawImage(img, 0, 0); return window.cleanCanvas(o).toDataURL('image/png');
  }, src));
  return Buffer.from(url.split(',')[1], 'base64');
}
