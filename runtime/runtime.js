/* Scene runtime. The whole video is a pure function of time t:
 *   rt.seek(t) → mounts the scene(s) visible at t, seeks their paused GSAP timelines, runs onFrame hooks,
 *   updates ambient background + captions. Preview drives t from the <audio> clock; the renderer calls
 *   seek(frame / fps) and screenshots — so preview and export are identical. */
(function () {
  const W = 1920, H = 1080, TRANSITION = 0.5;
  const params = new URLSearchParams(location.search);
  const MODE = params.get('render') ? 'render' : params.get('qa') ? 'qa' : 'preview';

  const $ = id => document.getElementById(id);
  const stageEl = $('stage'), scenesEl = $('scenes'), ambientEl = $('ambient'), captionsEl = $('captions');
  const audio = $('audio');

  const rt = window.__rt = {
    mode: MODE, data: null, duration: 0, errors: [], warnings: [], world: null, ready: null,
    warn(msg) { if (!rt.warnings.includes(msg)) rt.warnings.push(msg); },
  };

  let kitCss = '', katexCss = '';
  let scenes = [];
  const mounted = new Map(); // scene id → instance
  let captionChunks = [];
  let ambientFrame = () => {};
  let currentT = 0;

  // ---------- deterministic environment ----------
  let seedState = 1;
  Math.random = function () {
    seedState = (seedState * 16807) % 2147483647;
    return (seedState - 1) / 2147483646;
  };
  gsap.registerPlugin(DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, SplitText, TextPlugin, ScrambleTextPlugin, CustomEase);
  gsap.ticker.lagSmoothing(0);
  gsap.config({ nullTargetWarn: false });

  function showError(msg) {
    if (MODE !== 'preview') return;
    const box = $('errorToast');
    box.hidden = false;
    box.textContent = (box.textContent ? box.textContent + '\n' : '') + msg;
  }
  window.addEventListener('error', e => { rt.errors.push({ scene: null, message: String(e.message) }); });

  // ---------- tokens ----------
  function tokenCss(tokens) {
    const map = { bg: '--bg', bg2: '--bg2', surface: '--surface', surface2: '--surface2', line: '--line', text: '--text', muted: '--muted', primary: '--primary', accent: '--accent', accent2: '--accent2', danger: '--danger', success: '--success', fontDisplay: '--font-display', fontBody: '--font-body', fontMono: '--font-mono', radius: '--radius' };
    return Object.entries(map).filter(([k]) => tokens[k] != null).map(([k, v]) => `${v}: ${tokens[k]};`).join(' ') + ' --safe: 110px;';
  }

  // ---------- ambient background ----------
  function buildAmbient(kind, tokens) {
    ambientEl.innerHTML = '';
    ambientFrame = () => {};
    const noise = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
    const add = (cls, css) => { const d = document.createElement('div'); d.className = cls; d.style.cssText = css; ambientEl.appendChild(d); return d; };
    if (kind === 'aurora' || kind === 'dots' || kind === 'paper' || kind === 'soft') {
      const cols = kind === 'aurora' || kind === 'soft' ? [tokens.primary, tokens.accent2, tokens.accent] : [tokens.primary, tokens.accent];
      const blobs = cols.map((c, i) => add('blob', `background: radial-gradient(circle at center, ${c} 0%, transparent 62%); opacity: ${kind === 'aurora' ? 0.22 : kind === 'soft' ? 0.16 : 0.08}; left: ${[-300, 900, 300][i]}px; top: ${[-500, 100, 400][i]}px;`));
      if (kind === 'dots') add('pattern', `background-image: radial-gradient(${tokens.line} 2.5px, transparent 2.6px); background-size: 44px 44px;`);
      if (kind === 'paper') add('grain', `background-image: ${noise}; opacity: .12; mix-blend-mode: multiply;`);
      const pat = ambientEl.querySelector('.pattern');
      ambientFrame = t => {
        blobs.forEach((b, i) => { b.style.transform = `translate(${Math.sin(t / (9 + i * 3) + i) * 160}px, ${Math.cos(t / (11 + i * 2) + i * 2) * 120}px)`; });
        if (pat) pat.style.transform = `translate(${(t * 6) % 44}px, ${(t * 4) % 44}px)`;
      };
    } else if (kind === 'grid' || kind === 'ticker') {
      const size = kind === 'grid' ? 80 : 60;
      const pat = add('pattern', `background-image: linear-gradient(${tokens.line} 1.5px, transparent 1.5px), linear-gradient(90deg, ${tokens.line} 1.5px, transparent 1.5px); background-size: ${size}px ${size}px; opacity: ${kind === 'grid' ? 0.55 : 0.35}; mask-image: radial-gradient(ellipse at center, #000 20%, transparent 80%);`);
      const blob = add('blob', `background: radial-gradient(circle at center, ${tokens.primary} 0%, transparent 60%); opacity: .14; left: 260px; top: -300px;`);
      ambientFrame = t => {
        pat.style.transform = `translate(${(t * 10) % size}px, ${(t * 5) % size}px)`;
        blob.style.transform = `translate(${Math.sin(t / 12) * 300}px, ${Math.cos(t / 15) * 160}px)`;
      };
    } else if (kind === 'film') {
      const blob = add('blob', `background: radial-gradient(circle at center, ${tokens.primary} 0%, transparent 60%); opacity: .1; left: 300px; top: -400px;`);
      const grain = add('grain', `background-image: ${noise};`);
      add('vignette', '');
      ambientFrame = (t, frame) => {
        blob.style.transform = `translate(${Math.sin(t / 14) * 260}px, ${Math.cos(t / 17) * 140}px)`;
        grain.style.transform = `translate(${(frame * 37) % 60 - 30}px, ${(frame * 53) % 60 - 30}px)`;
      };
    }
  }

  // ---------- captions ----------
  function buildCaptions() {
    captionChunks = [];
    if (!rt.data.captions) return;
    for (const s of scenes) {
      let cur = [];
      const flush = () => { if (cur.length) captionChunks.push({ words: cur, start: cur[0].t, end: cur[cur.length - 1].t + cur[cur.length - 1].d }); cur = []; };
      (s.words || []).forEach((w, i) => {
        const gw = { w: w.w, t: s.start + w.t, d: w.d };
        const prev = s.words[i - 1];
        const gap = prev ? w.t - (prev.t + prev.d) : 0;
        const chars = cur.reduce((a, x) => a + x.w.length + 1, 0);
        if (cur.length && (gap > 0.28 || cur.length >= 8 || chars + w.w.length > 42)) flush();
        cur.push(gw);
      });
      flush();
    }
    captionChunks.forEach((c, i) => { const next = captionChunks[i + 1]; c.until = next ? Math.min(next.start, c.end + 0.6) : c.end + 0.6; });
  }
  let lastChunk = -1;
  function updateCaptions(t) {
    if (!captionChunks.length) return;
    let idx = -1;
    for (let i = 0; i < captionChunks.length; i++) { if (captionChunks[i].start - 0.05 <= t && t < captionChunks[i].until) { idx = i; break; } if (captionChunks[i].start > t) break; }
    if (idx < 0) { captionsEl.style.opacity = 0; lastChunk = -1; return; }
    const c = captionChunks[idx];
    if (idx !== lastChunk) {
      captionsEl.innerHTML = c.words.map(w => `<span class="cw">${w.w.replace(/</g, '&lt;')}</span>`).join(' ');
      lastChunk = idx;
    }
    captionsEl.style.opacity = 1;
    const spans = captionsEl.children;
    c.words.forEach((w, i) => spans[i]?.classList.toggle('on', t >= w.t && t < (c.words[i + 1]?.t ?? c.until)));
  }

  // ---------- scenes ----------
  function fallbackCode(s) {
    const text = (s.narration || '').split(/(?<=[.!?])\s+/)[0].slice(0, 140);
    return {
      html: `<div class="k-center"><div class="k-kicker">${s.chapter?.title || ''}</div><div class="k-h1 fb-text">${text}</div><div class="k-divider"></div></div>`,
      css: '.fb-text{max-width:1500px}',
      js: `kit.splitText('.fb-text', 0.2); kit.pop('.k-divider', 0.8); kit.camera('.k-center', {toScale: 1.05});`,
    };
  }

  class SceneInstance {
    constructor(s) { this.s = s; this.frameFns = []; this.failed = false; }

    mount() {
      const s = this.s;
      const host = this.host = document.createElement('div');
      host.className = 'scene-host';
      host.dataset.scene = s.id;
      scenesEl.appendChild(host);
      const shadow = this.shadow = host.attachShadow({ mode: 'open' });
      let code = s.html || s.js ? s : fallbackCode(s);
      try {
        this.build(code);
      } catch (err) {
        this.fail(err);
        if (MODE !== 'qa') {
          this.frameFns = [];
          this.build(fallbackCode(s));
        }
      }
    }

    build(code) {
      const s = this.s, shadow = this.shadow;
      const usesMath = /data-math|kit\.math/.test((code.html || '') + (code.js || ''));
      shadow.innerHTML = `<style>${kitCss}\n${usesMath ? katexCss : ''}\n:host{${tokenCss(rt.data.style.tokens)}}\n${code.css || ''}</style><div class="stage">${code.html || ''}</div>`;
      const stage = this.stage = shadow.querySelector('.stage');
      stage.querySelectorAll('[data-icon]').forEach(n => {
        n.innerHTML = kitIconSvg(n.dataset.icon, { size: n.dataset.size || 96, color: n.dataset.color || 'currentColor', stroke: n.dataset.stroke || 2 });
      });
      stage.querySelectorAll('[data-asset]').forEach(n => {
        const svg = rt.data.assets?.[n.dataset.asset];
        if (svg) { n.innerHTML = svg; n.classList.add('k-asset-host'); } else rt.warn(`Asset không tồn tại: ${n.dataset.asset}`);
      });
      stage.querySelectorAll('[data-illus]').forEach(n => {
        const svg = rt.data.illus?.[n.dataset.illus];
        n.classList.add('k-illus');
        if (svg) n.innerHTML = svg; else rt.warn(`Hình minh họa không có trong thư viện: "${n.dataset.illus}" — chọn tên khác trong danh mục`);
      });
      stage.querySelectorAll('[data-flag]').forEach(n => {
        const svg = rt.data.flags?.[n.dataset.flag];
        n.classList.add('k-illus', 'k-flag');
        if (svg) n.innerHTML = svg; else rt.warn(`Không có cờ: "${n.dataset.flag}" (dùng mã ISO 2 chữ: vn, us, cn, jp...)`);
      });
      stage.querySelectorAll('[data-math]').forEach(n => { try { katex.render(n.dataset.math, n, { throwOnError: false, displayMode: true }); } catch {} });

      seedState = hash(s.id);
      const tl = this.tl = gsap.timeline({ paused: true });
      const D = s.duration;
      const kit = createKit({ stage, tl, D, words: s.words || [], sceneId: s.id, assets: rt.data.assets || {}, tokens: rt.data.style.tokens, frameFns: this.frameFns });
      const G = Object.create(gsap);
      const lift = v => { const { delay = 0, ...rest } = v || {}; return [rest, delay]; };
      G.to = (t, v) => { const [r, d] = lift(v); return tl.to(t, r, d); };
      G.from = (t, v) => { const [r, d] = lift(v); return tl.from(t, r, d); };
      G.fromTo = (t, a, b) => { const [r, d] = lift(b); return tl.fromTo(t, a, r, d); };
      G.timeline = (v = {}) => { const { delay = 0, paused, ...rest } = v; const c = gsap.timeline(rest); tl.add(c, delay); return c; };
      const fn = new Function('stage', 'tl', 'D', 'kit', 'cue', '$', '$$', 'gsap', 'd3', 'rough', 'katex', 'topojson', code.js || '');
      this.ctx = gsap.context(() => {
        fn(stage, tl, D, kit, kit.cue, kit.$, kit.$$, G, d3, rough, katex, topojson);
      }, stage);
      this.seekLocal(0);
    }

    fail(err) {
      this.failed = true;
      const msg = `${err && err.message || err}`;
      rt.errors.push({ scene: this.s.id, message: msg, stack: String(err?.stack || '').split('\n').slice(0, 3).join(' | ') });
      showError(`Cảnh ${this.s.index + 1}: ${msg}`);
    }

    seekLocal(lt) {
      const t = Math.max(0, Math.min(lt, this.s.duration));
      try {
        this.tl.seek(t, false);
        for (const a of this.shadow.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
        for (const f of this.frameFns) f(t, this.s.duration);
      } catch (err) {
        if (!this.seekErr) { this.seekErr = true; this.fail(err); }
      }
    }

    destroy() {
      try { this.ctx?.revert(); } catch {}
      try { this.tl?.kill(); } catch {}
      this.host.remove();
    }
  }

  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; }

  function sceneIndexAt(t) {
    let lo = 0, hi = scenes.length - 1, ans = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (scenes[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }

  let frameCounter = 0;
  function seekSync(t) {
    if (!scenes.length) return;
    t = Math.max(0, Math.min(t, rt.duration));
    currentT = t;
    const i = sceneIndexAt(t);
    const cur = scenes[i];
    const local = t - cur.start;
    const inTransition = i > 0 && local < TRANSITION;
    const needed = new Set([cur.id]);
    if (inTransition) needed.add(scenes[i - 1].id);
    for (const [id, inst] of mounted) if (!needed.has(id)) { inst.destroy(); mounted.delete(id); }
    for (const id of needed) if (!mounted.has(id)) {
      const inst = new SceneInstance(scenes.find(s => s.id === id));
      inst.mount();
      mounted.set(id, inst);
    }
    const curInst = mounted.get(cur.id);
    const kind = cur.transition || (cur.setting ? null : cur.isChapterStart ? (cur.index % 2 ? 'wipe' : 'iris') : 'fade');
    if (inTransition && kind && kind !== 'cut') {
      const prev = mounted.get(scenes[i - 1].id);
      prev.seekLocal(scenes[i - 1].duration);
      const p = gsap.parseEase('power3.inOut')(Math.min(1, local / TRANSITION)), q = Math.sin(Math.PI * p);
      if (kind === 'slide') {
        prev.host.style.cssText = `z-index:1; transform: translateX(${-p * W * 0.35}px) scale(${1 - p * 0.06}); opacity:${1 - p * 0.6}`;
        curInst.host.style.cssText = `z-index:2; transform: translateX(${(1 - p) * W}px); box-shadow: -30px 0 60px rgba(0,0,0,${0.25 * q})`;
      } else if (kind === 'zoom') {
        prev.host.style.cssText = `z-index:1; transform: scale(${1 + p * 1.2}); opacity:${1 - p}`;
        curInst.host.style.cssText = `z-index:2; transform: scale(${0.72 + p * 0.28}); opacity:${p}`;
      } else if (kind === 'wipe') {
        prev.host.style.cssText = 'z-index:1';
        const x = (1 - p) * 130 - 15;
        curInst.host.style.cssText = `z-index:2; clip-path: polygon(${x}% 0, 100% 0, 100% 100%, ${x - 15}% 100%)`;
      } else if (kind === 'iris') {
        prev.host.style.cssText = `z-index:1; transform: scale(${1 + p * 0.08})`;
        curInst.host.style.cssText = `z-index:2; clip-path: circle(${p * 120}% at 50% 50%)`;
      } else if (kind === 'whip') {
        prev.host.style.cssText = `z-index:1; transform: translateX(${-p * W}px); filter: blur(${(q * 14).toFixed(1)}px)`;
        curInst.host.style.cssText = `z-index:2; transform: translateX(${(1 - p) * W}px); filter: blur(${(q * 14).toFixed(1)}px)`;
      } else {
        prev.host.style.cssText = 'z-index:1';
        curInst.host.style.cssText = `z-index:2; opacity:${p}`;
      }
    } else if (inTransition && kind === 'cut') {
      curInst.host.style.cssText = 'z-index:2';
    } else if (inTransition) {
      const prev = mounted.get(scenes[i - 1].id);
      prev.seekLocal(scenes[i - 1].duration);
      prev.host.style.cssText = 'z-index:1';
      const prevS = scenes[i - 1];
      const sameSet = cur.setting && cur.setting === prevS.setting;
      const changeSet = cur.setting && prevS.setting && !sameSet;
      // Same cartoon set → near-invisible dissolve (the world continues); new set → camera whip-pan.
      const p = gsap.parseEase(changeSet ? 'power3.inOut' : 'power2.inOut')(Math.min(1, local / (sameSet ? 0.22 : TRANSITION)));
      if (cur.isChapterStart && !sameSet) curInst.host.style.cssText = `z-index:2; clip-path: circle(${p * 120}% at 50% 50%)`;
      else if (changeSet) {
        prev.host.style.cssText = `z-index:1; transform: translateX(${-p * W}px)`;
        curInst.host.style.cssText = `z-index:2; transform: translateX(${(1 - p) * W}px)`;
      } else curInst.host.style.cssText = sameSet ? `z-index:2; opacity:${p}` : `z-index:2; opacity:${p}; transform: scale(${1.04 - 0.04 * p})`;
    } else {
      curInst.host.style.cssText = 'z-index:2';
    }
    curInst.seekLocal(local);
    ambientFrame(t, frameCounter++);
    updateCaptions(t);
    rt.currentScene = cur;
  }

  rt.pending = [];
  rt.seek = async function (t) {
    seekSync(t);
    if (document.fonts.status !== 'loaded') await document.fonts.ready;
    while (rt.pending.length) await Promise.all(rt.pending.splice(0));
  };

  rt.inspect = function (opts = {}) {
    // Layout QA for the current frame: overflow, overlaps, tiny text, clutter, empty frame.
    const inst = rt.currentScene && mounted.get(rt.currentScene.id);
    if (!inst) return { issues: ['Không có cảnh nào được dựng'], texts: 0 };
    const scale = stageEl.getBoundingClientRect().width / W;
    const base = stageEl.getBoundingClientRect();
    const rel = r => ({ x: (r.left - base.left) / scale, y: (r.top - base.top) / scale, w: r.width / scale, h: r.height / scale });
    const visible = n => {
      let op = 1;
      for (let e = n; e && e !== inst.stage; e = e.parentElement || e.parentNode) {
        if (!(e instanceof Element)) break;
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
        op *= parseFloat(cs.opacity);
      }
      return op;
    };
    const texts = [];
    const walker = document.createTreeWalker(inst.stage, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const str = node.textContent.trim();
      if (!str) continue;
      const elx = node.parentElement;
      if (!elx || elx.closest('.katex-mathml') || elx.closest('style') || elx.closest('.k-set, .k-front')) continue;
      if (str.length <= 2 && elx.closest('.k-thing, .k-char, .k-desk')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const op = visible(elx);
      if (op < 0.35) continue;
      texts.push({ el: elx, text: str.slice(0, 60), len: str.length, box: rel(r), fontSize: parseFloat(getComputedStyle(elx).fontSize) });
    }
    const issues = [];
    const capTop = rt.data.captions ? H - 175 : H;
    const overlap = (a, b) => {
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return ix * iy;
    };
    const wm = $('watermark');
    const wmBox = wm.textContent ? rel(wm.getBoundingClientRect()) : null;
    // Nearest ancestor that draws a box (background or border) — text must stay inside it.
    const boxOf = n => {
      for (let e = n.parentElement; e && e !== inst.stage; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const painted = (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
        if (painted && !(e instanceof SVGElement)) return e;
      }
      return null;
    };
    // Does this element itself put pixels at a hit-tested point? (Transparent wrappers and <svg> roots don't.)
    const paints = e => {
      if (e instanceof SVGElement) {
        if (e.tagName === 'svg' || e.tagName === 'g' || e.tagName === 'foreignObject') return false;
        return getComputedStyle(e).fill !== 'none' || getComputedStyle(e).stroke !== 'none';
      }
      if (e.tagName === 'CANVAS') return false;
      if (e.tagName === 'IMG') return true;
      const cs = getComputedStyle(e);
      return !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0;
    };
    for (const t of texts) {
      const b = t.box;
      if (b.x < -6 || b.y < -6 || b.x + b.w > W + 6 || b.y + b.h > H + 6) issues.push(`Chữ "${t.text}" bị tràn ra ngoài khung hình (x=${Math.round(b.x)}, y=${Math.round(b.y)}, w=${Math.round(b.w)}, h=${Math.round(b.h)})`);
      else if (b.y + b.h > capTop && rt.data.captions) issues.push(`Chữ "${t.text}" nằm trong vùng phụ đề (đáy khung, y>${capTop}px) — dời lên trên`);
      if (wmBox && overlap(b, { x: wmBox.x - 20, y: wmBox.y - 20, w: wmBox.w + 40, h: wmBox.h + 40 }) > 0) issues.push(`Chữ "${t.text}" đè lên tên kênh ở góc trên phải — dời chỗ khác`);
      const svgText = t.el instanceof SVGElement;
      if (!svgText && t.fontSize < 24) issues.push(`Chữ "${t.text}" quá nhỏ (${Math.round(t.fontSize)}px, tối thiểu 26px)`);
      if (!svgText) {
        const box = boxOf(t.el);
        if (box) {
          const r = rel(box.getBoundingClientRect());
          const vt = Math.max(4, t.fontSize * 0.3);
          if (b.x < r.x - 4 || b.y < r.y - vt || b.x + b.w > r.x + r.w + 4 || b.y + b.h > r.y + r.h + vt) issues.push(`Chữ "${t.text}" tràn ra khỏi hộp/khung chứa nó — nới rộng hộp, giảm cỡ chữ hoặc dùng white-space:nowrap`);
        }
      }
      // Occlusion: something else painted on top of the text's middle.
      const hits = [0.1, 0.3, 0.5, 0.7, 0.9].map(fx => {
        const px = base.left + (b.x + b.w * fx) * scale, py = base.top + (b.y + b.h / 2) * scale;
        const stack = inst.shadow.elementsFromPoint(px, py).filter(e => inst.stage.contains(e) && e !== inst.stage);
        const top = stack.find(e => e === t.el || t.el.contains(e) || e.contains(t.el) || (paints(e) && visible(e) > 0.3));
        return top && top !== t.el && !top.contains(t.el) && !t.el.contains(top) ? top : null;
      }).filter(Boolean);
      if (hits.length >= 1) issues.push(`Hình/khối khác (<${hits[0].tagName.toLowerCase()}${hits[0].getAttribute('class') ? ` class="${hits[0].getAttribute('class')}"` : ''}>) đang che lên chữ "${t.text}" — tách vị trí hoặc đưa chữ lên lớp trên`);
    }
    // Hand-coded graphics (kit.gfx objects / Astra drawings) must stay inside the frame and off the channel name.
    for (const gEl of inst.stage.querySelectorAll('.k-gfx > g')) {
      if (visible(gEl) < 0.35 || /gfx-(battlemap|water-level|routes|globe|kept)/.test(gEl.getAttribute('class') || '')) continue;
      const r = gEl.getBoundingClientRect();
      if (r.width * r.height < 400) continue;
      const b = rel(r), name = (gEl.getAttribute('class') || 'đồ họa').replace(/^gfx\s*/, '').replace(/gfx-/g, '');
      const out = Math.max(0, -b.x) + Math.max(0, -b.y) + Math.max(0, b.x + b.w - W) + Math.max(0, b.y + b.h - H);
      if (out > Math.min(b.w, b.h) * 0.12) issues.push(`Đồ họa "${name}" bị tràn/cắt ra ngoài khung hình (x=${Math.round(b.x)}, y=${Math.round(b.y)}, w=${Math.round(b.w)}, h=${Math.round(b.h)}) — đặt lại trong vùng x 120–1800, y 120–880 hoặc dùng công thức bố cục tự động`);
      else if (wmBox && overlap(b, { x: wmBox.x - 20, y: wmBox.y - 20, w: wmBox.w + 40, h: wmBox.h + 40 }) > 0) issues.push(`Đồ họa "${name}" đè lên tên kênh ở góc trên phải — dời xuống/sang trái`);
    }
    // Graphics (standalone svg, assets, painted boxes) that partially overlap a text block.
    const bigSvg = s => { const r = s.getBoundingClientRect(); return r.width * r.height / (scale * scale) >= W * H * 0.55; };
    const graphics = [...inst.stage.querySelectorAll('svg, img, [data-asset], [data-icon], div, span, svg > g, svg > path, svg > rect, svg > circle, svg > ellipse, svg > polygon')].filter(g => {
      if (g instanceof SVGElement && g.tagName !== 'svg') {
        // Top-level parts of a full-screen illustration svg (e.g. a building drawn inside a scene-wide canvas).
        const root = g.ownerSVGElement;
        if (!root || root.ownerSVGElement || !bigSvg(root)) return false;
        const r = g.getBoundingClientRect();
        if (r.width / scale < 14 || r.height / scale < 14) return false;
      } else if (g instanceof SVGElement && g.ownerSVGElement) return false; // only outermost <svg>
      if (g.matches('div, span') && !paints(g)) return false;
      if (g.closest('.k-chart, .k-map') && !g.matches('.k-chart, .k-map')) return false;
      if (g.closest('.k-set, .k-front, .mg-bg, .mg-svg, .mg-pic, .mg-draw')) return false; // environment layers / motion-graphics backgrounds are scenery by design
      if (visible(g) < 0.3) return false;
      const r = g.getBoundingClientRect();
      return r.width * r.height / (scale * scale) < W * H * 0.55 && r.width > 8 && r.height > 8;
    }).map(g => ({ g, box: rel(g.getBoundingClientRect()) }));
    for (const t of texts) {
      const tb = t.box, area = tb.w * tb.h;
      // Very short labels (₫, 1đ, %) sitting on a shape are intentional (coin symbols, badges).
      if (!area || t.len <= 3) continue;
      for (const { g, box } of graphics) {
        if (g.contains(t.el) || t.el.contains(g)) continue;
        const contains = box.x <= tb.x + 3 && box.y <= tb.y + 3 && box.x + box.w >= tb.x + tb.w - 3 && box.y + box.h >= tb.y + tb.h - 3;
        if (contains) continue;
        if (overlap(tb, box) / area > 0.1) { issues.push(`Chữ "${t.text}" bị chồng lên hình/khối <${g.tagName.toLowerCase()}${g.getAttribute('class') ? ` class="${g.getAttribute('class')}"` : ''}> — tách hai thứ ra, không để chồng lấn`); break; }
      }
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const small = Math.min(a.box.w * a.box.h, b.box.w * b.box.h);
      if (small > 0 && overlap(a.box, b.box) / small > 0.12) issues.push(`Chữ "${a.text}" đè lên chữ "${b.text}"`);
    }
    const totalChars = texts.filter(t => !(t.el instanceof SVGElement && t.el.closest('.k-chart, .k-map'))).reduce((s, t) => s + t.len, 0);
    const charLimit = inst.stage.querySelector('.k-world') ? 85 : 55;
    if (totalChars > charLimit) issues.push(`Quá nhiều chữ trên màn hình (${totalChars} ký tự, tối đa ~${charLimit}) — xoá tiêu đề/nhãn/thẻ chữ, để hình minh họa và giọng đọc kể chuyện`);
    // Hand-drawn objects: complex paths/polygons outside library art, charts, maps and arrows.
    const LIB = '[data-illus], [data-flag], [data-asset], [data-icon], .k-illus, .k-chart, .k-map, .k-arrow, .k-world, .mg, .katex, defs, clipPath, mask';
    const drawn = [...inst.stage.querySelectorAll('path, polygon, polyline')].filter(n => {
      if (n.closest(LIB)) return false;
      const len = (n.getAttribute('d') || n.getAttribute('points') || '').length;
      return len > 260;
    });
    if (drawn.length >= 2) issues.push(`Cảnh tự vẽ ${drawn.length} hình phức tạp bằng <path>/<polygon> (dễ méo, vỡ) — thay mọi vật thể bằng hình trong thư viện data-illus; SVG tự viết chỉ dùng cho nền, mặt đất, quầng sáng, đường nối, mũi tên`);
    // Illustrations partially overlapping each other look cluttered. Fully stacked (a bag held in front of a person) is fine.
    const arts = [...inst.stage.querySelectorAll('.k-illus, [data-asset], .k-gfx > g')].filter(n => !n.classList.contains('k-crowd-item') && visible(n) > 0.5)
      .map(n => ({ n, b: rel(n.getBoundingClientRect()) })).filter(a => a.b.w >= 110 && a.b.h >= 110);
    let clutter = 0;
    for (let i = 0; i < arts.length; i++) for (let j = i + 1; j < arts.length; j++) {
      const A = arts[i].b, B = arts[j].b;
      // Vertically aligned = one stands on the other (tree on an island) — intentional.
      if (Math.abs((A.x + A.w / 2) - (B.x + B.w / 2)) < 0.3 * Math.max(A.w, B.w)) continue;
      const small = Math.min(A.w * A.h, B.w * B.h);
      const r = overlap({ x: A.x + A.w * .12, y: A.y + A.h * .12, w: A.w * .76, h: A.h * .76 }, { x: B.x + B.w * .12, y: B.y + B.h * .12, w: B.w * .76, h: B.h * .76 }) / (small * .5776);
      if (r > 0.18 && r < 0.75) clutter++;
    }
    if (clutter >= 1) issues.push(`${clutter} cặp hình minh họa chồng lấn một phần lên nhau trông lộn xộn — giãn vị trí cho các hình tách bạch (chỉ xếp chồng khi có chủ ý, vd vật được cầm trước người)`);
    const world = inst.stage.querySelector('.k-world');
    if (world) {
      // Anything painted outside the cartoon world (and not text) is an invented block.
      const blocks = [...inst.stage.querySelectorAll('*')].filter(n => !world.contains(n) && !n.closest('.k-chart, .k-map') && paints(n) && visible(n) > 0.3).filter(n => {
        const r = rel(n.getBoundingClientRect());
        return r.w * r.h > W * H * 0.02;
      });
      if (blocks.length) issues.push(`Có ${blocks.length} khối/hình tự vẽ nằm ngoài thế giới hoạt hình (<${blocks[0].tagName.toLowerCase()}${blocks[0].getAttribute('class') ? ` class="${blocks[0].getAttribute('class')}"` : ''}>) — xoá đi; mọi thứ phải là bối cảnh kit.world, vật thể w.place, nhân vật, hiệu ứng w.fx, nhãn w.label hoặc sơ đồ kit.gfx`);
      const chars = [...world.querySelectorAll('.k-char')].filter(n => visible(n) > 0.5).map(n => rel(n.getBoundingClientRect()));
      const props = [...world.querySelectorAll('.k-prop')].filter(n => visible(n) > 0.5).map(n => rel(n.getBoundingClientRect()));
      let hidden = 0;
      for (const pb of props) for (const cb of chars) if (overlap(pb, cb) / Math.max(1, pb.w * pb.h) > 0.6) hidden++;
      if (props.length > 5) issues.push(`Quá nhiều đồ vật (${props.length} w.prop) — tối đa 4, bỏ đồ vật trang trí/thời tiết/hiệu ứng, giữ thứ có vai trò trong câu chuyện`);
      if (hidden) issues.push(`${hidden} đồ vật (w.prop) bị nhân vật che gần hết — dời đồ vật ra xa nhân vật (x khác ≥ 250px), hoặc cho nhân vật cầm bằng hold()`);
      const offstage = [...world.querySelectorAll('.k-char:not(.k-extra)')].filter(n => visible(n) > 0.5).map(n => rel(n.getBoundingClientRect())).filter(b => b.x + b.w * 0.5 < 0 || b.x + b.w * 0.5 > W);
      if (opts.final && offstage.length && !/exit\(/.test(inst.s.js || '')) issues.push('Có nhân vật đứng ngoài khung hình ở cuối cảnh');
      const tags = [...world.querySelectorAll('.k-tag')].filter(n => visible(n) > 0.5).length;
      if (tags > 2) issues.push(`Quá nhiều nhãn chữ cùng lúc (${tags} w.label) — tối đa 2, để hình ảnh tự kể chuyện`);
      // Things hanging in mid-air that don't fly (a pillow, a wallet, a clock in the sky) read as stickers — the slide look.
      const floating = [...world.querySelectorAll('.k-thing[data-gy]')].filter(n => visible(n) > 0.5 && +n.dataset.gy - +n.dataset.by > 60 && n.getBoundingClientRect().width / scale >= 40);
      if (opts.final && floating.length) issues.push(`Vật lơ lửng giữa không trung: ${[...new Set(floating.map(n => n.getAttribute('class').replace(/.*k-thing-/, '')))].join(', ')} — đặt lên mặt đất, lên bàn/quầy (on:), cho người cầm (p.hold), cho người nghĩ tới (w.bubble), hoặc bỏ đi`);
      // Too many things competing for attention (each price tag, prop and floating number) makes a shot unreadable.
      // a row laid out by w.subject counts as one subject
      const things = new Set([...world.querySelectorAll('.k-thing')].filter(n => visible(n) > 0.5 && n.getBoundingClientRect().width / scale >= 30).map(n => n.dataset.grp || n)).size;
      if (opts.final && things > 6) issues.push(`Cảnh rối: ${things} đồ vật cùng lúc — chỉ giữ 1 chủ thể chính + 2–3 thứ phụ đúng ý lời thoại, bỏ đồ trang trí/thẻ giá/biểu tượng thừa`);
      // A main character whose face is hidden behind something (a monitor, papers, a giant prop) reads as a mistake.
      for (const ch of world.querySelectorAll('.k-char:not(.k-extra)')) {
        const hd = ch.querySelector('.k-head');
        if (!hd || visible(ch) < 0.5) continue;
        const r = hd.getBoundingClientRect();
        if (r.width < 8) continue;
        let covered = 0;
        for (const [fx, fy] of [[0.5, 0.55], [0.35, 0.5], [0.65, 0.5]]) {
          const top = inst.shadow.elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy).find(e => inst.stage.contains(e) && paints(e) && visible(e) > 0.3);
          if (top && !ch.contains(top)) covered++;
        }
        if (covered >= 2) { issues.push('Mặt nhân vật bị vật khác che (màn hình, giấy tờ, đồ vật to đặt trước mặt) — dời vật sang bên, thu nhỏ, hoặc dời nhân vật'); break; }
      }
    }
    if (opts.final && !inst.stage.querySelector('.k-chart, .k-map')) {
      const art = [...inst.stage.querySelectorAll('.k-illus, [data-asset], .k-char, .k-prop, .k-thing, .mg-item, .mg-pic, .mg-title, .mg-num, .k-gfx > g, .mg-draw > :not(defs)')].filter(n => visible(n) > 0.3 && n.getBoundingClientRect().width / scale >= 60);
      if (art.length === 0) issues.push('Cuối cảnh không có chủ thể nào (vật thể w.place, nhân vật, sơ đồ kit.gfx) — mỗi cảnh cần ít nhất 1 chủ thể chính thật lớn');
    }
    let painted = 0;
    inst.stage.querySelectorAll('*').forEach(n => {
      const r = n.getBoundingClientRect();
      if (r.width * r.height / (scale * scale) > 12000 && visible(n) > 0.2) painted++;
    });
    if (painted === 0 && texts.length === 0) issues.push('Khung hình trống — không có gì hiển thị');
    for (const m of rt.warnings) if (/^Vật thể không có|^Hình không có|^Ảnh nền không có|^Vật thể hình người|không có trong dàn nhân vật|^Bối cảnh không tồn tại|không có trong thư viện/.test(m)) issues.push(`${m} (đang hiện thành hình giữ chỗ) — chỉ dùng tên có trong danh sách; vật không có thì chọn vật gần nghĩa nhất hoặc bỏ`);
    const mgRoot = inst.stage.querySelector('.mg');
    if (mgRoot && opts.final) {
      const its = [...mgRoot.querySelectorAll('.mg-item')].filter(n => visible(n) > 0.5);
      const kinds = new Set(its.map(n => n.dataset.id)).size;
      const cnt = {}; its.forEach(n => { cnt[n.dataset.id] = (cnt[n.dataset.id] || 0) + 1; });
      const tiny = its.filter(n => cnt[n.dataset.id] < 3 && rel(n.getBoundingClientRect()).h < 120);
      if (tiny.length) issues.push(`Hình quá nhỏ, khó thấy: ${[...new Set(tiny.map(n => n.dataset.id))].join(', ')} — tăng h (≥ 200) hoặc bỏ`);
      if (kinds > 7) issues.push(`Cảnh rối: ${kinds} loại hình cùng lúc — giữ 1 chủ thể chính + vài thứ phụ đúng lời thoại`);
      const off = +(mgRoot.dataset.zoom || 1) > 1.12 ? [] : its.filter(n => { const b = rel(n.getBoundingClientRect()); if (b.w * b.h < 900) return false; const out = Math.max(0, -b.x) + Math.max(0, b.x + b.w - W) + Math.max(0, -b.y) + Math.max(0, b.y + b.h - (rt.data.captions ? H - 150 : H)); return out > Math.min(b.w, b.h) * 0.25; });
      if (off.length) issues.push(`${off.length} hình bị tràn ra ngoài khung hoặc xuống vùng phụ đề (${[...new Set(off.map(n => n.dataset.id))].join(', ')}) — dùng bố cục m.row/m.pair/m.count/m.hero hoặc đặt trong vùng x 140–1780, y 130–860`);
    }
    if (opts.final && !world && !mgRoot && window.Cartoon) issues.push("Cảnh không có bối cảnh — luôn mở đầu bằng const w = kit.world(...) (cảnh sơ đồ/số liệu dùng kit.world('abstract') hoặc bối cảnh đang dùng)");
    if (opts.final) {
      // By the end of the scene nearly everything that was authored should be on screen.
      const parts = [...inst.stage.querySelectorAll('path, rect, circle, ellipse, polygon, text, [data-icon], [data-asset]')].filter(n => !n.closest('defs, clipPath, mask, .k-chart, .k-map'));
      const hidden = parts.filter(n => visible(n) < 0.15);
      if (parts.length >= 8 && hidden.length / parts.length > 0.6) issues.push(`Cuối cảnh vẫn còn ${hidden.length}/${parts.length} phần tử vô hình (opacity 0) — thường do CSS đặt opacity:0 rồi dùng tl.from({opacity:0}) nên không bao giờ hiện ra. Bỏ opacity:0 trong CSS, hoặc dùng tl.fromTo(..., {opacity:0}, {opacity:1})`);
    }
    return { issues: [...new Set(issues)].slice(0, 12), texts: texts.length, chars: totalChars, elements: painted };
  };

  // ---------- loading ----------
  rt.load = async function (data) {
    rt.data = data;
    // AI illustrations: start fetching/decoding everything up front
    for (const im of Object.values(data.images || {})) for (const u of [im.url, ...(im.frames || [])]) { const i = new Image(); i.src = u; rt.pending.push(i.decode().catch(() => {})); }
    rt.errors = []; rt.warnings = [];
    for (const [, inst] of mounted) inst.destroy();
    mounted.clear();
    scenes = data.scenes.slice().sort((a, b) => a.start - b.start);
    rt.duration = data.duration ?? scenes.reduce((a, s) => Math.max(a, s.start + s.duration), 0);
    document.documentElement.setAttribute('style', tokenCss(data.style.tokens));
    buildAmbient(data.style.ambient, data.style.tokens);
    $('watermark').textContent = ''; // videos are rendered clean — no channel watermark
    buildCaptions();
    const tk = data.style.tokens;
    const sample = 'Tiếng Việt ẮẰẲẴẶ ỄỀỂẾ ƯỨỪỬỮỰ đĐ 0123456789';
    const fams = [tk.fontDisplay, tk.fontBody, tk.fontMono].map(f => (f || '').split(',')[0].trim()).filter(Boolean);
    await Promise.all(fams.flatMap(f => ['400', '700', '800'].map(wt => document.fonts.load(`${wt} 40px ${f}`, sample).catch(() => {}))));
    // Real map data (Natural Earth): 1:110m is small and always loaded (globe/earth icons use it too);
    // the detailed 1:10m set (~3.7 MB) only when a scene draws a regional map.
    const allJs = scenes.map(s => s.js).join('');
    if (!rt.world) rt.world = await fetch('/vendor/world/countries-110m.json').then(r => r.json()).catch(() => null);
    if (/region\s*:|focus\s*:\s*\[/.test(allJs) && !rt.world10) rt.world10 = await fetch('/vendor/world/countries-10m.json').then(r => r.json()).catch(() => null);
    await rt.seek(0);
    return { duration: rt.duration, scenes: scenes.length };
  };

  async function boot() {
    [kitCss, katexCss] = await Promise.all([
      fetch('/runtime/kit.css').then(r => r.text()),
      fetch('/vendor/katex/katex.min.css').then(r => r.text()).then(css => css.replace(/@font-face\s*{[^}]*}/g, '')),
    ]);
    fitStage();
    window.addEventListener('resize', fitStage);
    const project = params.get('project');
    if (!project) return;
    const url = `/api/projects/${project}/runtime${params.get('scene') ? `?scene=${params.get('scene')}` : ''}`;
    const data = await fetch(url).then(r => r.json());
    await rt.load(data);
    if (MODE === 'preview') setupControls();
  }

  function fitStage() {
    const reserve = MODE === 'preview' && params.get('controls') !== '0' ? 0 : 0;
    const s = Math.min(window.innerWidth / W, (window.innerHeight - reserve) / H);
    stageEl.style.transform = `scale(${s})`;
  }

  // ---------- preview controls ----------
  function setupControls() {
    const ctr = $('controls');
    ctr.hidden = params.get('controls') === '0';
    const fmt = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    if (rt.data.audio) audio.src = rt.data.audio;
    let playing = false, clockStart = 0, clockT = 0;
    const now = () => (rt.data.audio ? audio.currentTime : clockT + (playing ? (performance.now() - clockStart) / 1000 : 0));
    const setPlaying = p => {
      playing = p;
      $('icoPlay').hidden = p; $('icoPause').hidden = !p;
      if (rt.data.audio) { p ? audio.play().catch(() => {}) : audio.pause(); }
      else { if (p) clockStart = performance.now(); else clockT = now(); }
      parent.postMessage({ type: 'rt-state', playing: p }, '*');
    };
    const seekTo = t => {
      t = Math.max(0, Math.min(t, rt.duration - 0.01));
      if (rt.data.audio) audio.currentTime = t; else { clockT = t; clockStart = performance.now(); }
      rt.seek(t);
      render();
    };
    const marks = $('scrubMarks');
    scenes.filter(s => s.isChapterStart && s.start > 0).forEach(s => { const m = document.createElement('div'); m.className = 'mk'; m.style.left = `${(s.start / rt.duration) * 100}%`; marks.appendChild(m); });
    const render = () => {
      const t = now();
      const pct = (t / rt.duration) * 100;
      $('scrubFill').style.width = pct + '%';
      $('scrubKnob').style.left = pct + '%';
      $('time').textContent = `${fmt(t)} / ${fmt(rt.duration)}`;
      $('sceneLabel').textContent = rt.currentScene ? `Cảnh ${rt.currentScene.index + 1}` : '';
    };
    const loop = () => {
      if (playing) {
        const t = now();
        if (t >= rt.duration - 0.02) { setPlaying(false); seekTo(params.get('loop') ? 0 : rt.duration - 0.02); if (params.get('loop')) setPlaying(true); }
        else { seekSync(t); render(); }
        parent.postMessage({ type: 'rt-time', t, scene: rt.currentScene?.id }, '*');
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    audio.addEventListener('ended', () => setPlaying(false));
    $('btnPlay').onclick = () => setPlaying(!playing);
    stageEl.onclick = () => setPlaying(!playing);
    $('btnFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
    const scrub = $('scrub');
    const scrubAt = e => { const r = scrub.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * rt.duration); };
    let dragging = false;
    scrub.onpointerdown = e => { dragging = true; scrub.setPointerCapture(e.pointerId); scrubAt(e); };
    scrub.onpointermove = e => { if (dragging) scrubAt(e); };
    scrub.onpointerup = () => { dragging = false; };
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
      if (e.code === 'ArrowRight') seekTo(now() + 5);
      if (e.code === 'ArrowLeft') seekTo(now() - 5);
      if (e.code === 'KeyF') $('btnFull').click();
    });
    window.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type === 'rt-seek') { seekTo(m.t); if (m.play) setPlaying(true); }
      if (m.type === 'rt-play') setPlaying(true);
      if (m.type === 'rt-pause') setPlaying(false);
    });
    let idleTimer;
    const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => playing && document.body.classList.add('idle'), 2200); };
    window.addEventListener('pointermove', wake);
    wake();
    render();
    if (rt.errors.length === 0 && rt.warnings.length) console.warn(rt.warnings);
    if (params.get('autoplay')) setPlaying(true);
    const t0 = parseFloat(params.get('t') || '0');
    if (t0) seekTo(t0);
  }

  rt.ready = boot().catch(err => { rt.errors.push({ scene: null, message: 'Boot: ' + err.message }); showError(err.message); });
})();
