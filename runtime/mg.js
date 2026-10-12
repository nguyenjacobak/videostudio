/* Motion-graphics toolkit: kit.mg(opts) → a composable stage for explainer scenes built from AI illustrations
 * (transparent sprites + backgrounds), vector library objects, kinetic text, numbers, drawn arrows, callouts,
 * particles and a camera. Layouts place things for the viewer (models are bad at coordinates).
 * Everything is a pure function of time: state objects are tweened on the scene timeline and drawn in onFrame(t). */
(function () {
  const W = 1920, H = 1080, NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FONT = "'Be Vietnam Pro', sans-serif";
  const AREA = { x0: 140, x1: 1780, y0: 240, y1: 860 };   // top band is for titles   // content stays above the captions band
  const PALETTES = {
    warm: ['#fff6ea', '#ffe2c4', ['#ffb57a', '#ffd38a', '#ff9f8a']], cool: ['#eef4ff', '#d3e2ff', ['#8fb6ff', '#b3d0ff', '#9ad8ff']],
    mint: ['#effcf6', '#cff2e2', ['#7fdcb6', '#a8ecd0', '#8fd7e8']], paper: ['#faf5e9', '#efe3c8', ['#e8c88c', '#f0d9a8', '#d9c29a']],
    sunset: ['#fff0e6', '#ffd0c8', ['#ff9e7d', '#ffbf87', '#f59ab0']], lilac: ['#f5f0ff', '#e0d4ff', ['#b39cff', '#d1c2ff', '#9fc3ff']],
    night: ['#1f2647', '#0d1229', ['#4a5bd4', '#7b5bd6', '#2f8fd6']], deep: ['#15283a', '#08131f', ['#1f7a8c', '#2b5fa8', '#3aa38f']],
  };
  const PAL_ORDER = ['cool', 'warm', 'mint', 'lilac', 'paper', 'sunset'];
  const COLORS = { blue: '#3b7cf6', red: '#e5484d', orange: '#f08a3c', teal: '#14a38b', green: '#3fa34d', purple: '#7b5bd6', gold: '#e2a400', pink: '#e5679a', grey: '#6b7280', ink: '#1f2433', white: '#ffffff' };
  const col = c => COLORS[c] || c || COLORS.blue;
  const FAKE_ICONS = new Set(['fire', 'lightning', 'lock', 'cloud', 'rain-cloud', 'bomb', 'warning', 'cross', 'check', 'like', 'heart', 'star', 'snowflake', 'tornado', 'wave', 'water-drop', 'magnet', 'stock-up', 'stock-down', 'inflation', 'tax', 'loan', 'play', 'wifi', 'megaphone', 'lightbulb', 'nuclear']);
  const ease = (name, k) => gsap.parseEase(name)(clamp(k, 0, 1));
  const fmtNum = (v, d = 0) => Number(v).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });

  function mkEl(tag, cls, parent, style) { const e = document.createElement(tag); if (cls) e.className = cls; if (style) e.style.cssText = style; parent?.appendChild(e); return e; }
  function mkSvg(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e; }

  const CSS = `
  .mg{position:absolute;inset:0;overflow:hidden;font-family:${FONT}}
  .mg-bg,.mg-cam,.mg-hud{position:absolute;inset:0}
  .mg-cam{transform-origin:0 0}
  .mg-bg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 50%}
  .mg-blob{position:absolute;border-radius:50%;filter:blur(2px)}
  .mg-item{position:absolute;left:0;top:0;transform-origin:50% 50%;will-change:transform}
  .mg-item img,.mg-item svg{width:100%;height:100%;display:block}
  .mg-item.sh img{filter:drop-shadow(0 18px 22px rgba(20,25,40,.22))}
  .mg-dark .mg-item.sh img{filter:drop-shadow(0 18px 26px rgba(0,0,0,.45))}
  .mg-svg{position:absolute;inset:0;width:${W}px;height:${H}px;overflow:visible;pointer-events:none}
  .mg-pill{position:absolute;left:0;top:0;white-space:nowrap;font-weight:800;font-size:38px;padding:10px 24px;border-radius:999px;background:#1f2433;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18)}
  .mg-dark .mg-pill{background:#fff;color:#1f2433}
  .mg-title{position:absolute;left:0;right:0;text-align:center;font-weight:900;color:#1f2433;letter-spacing:-.01em;line-height:1.1;padding:0 160px}
  .mg-dark .mg-title,.mg-dark .mg-num{color:#fff}
  .mg-title span{display:inline-block;white-space:pre}
  .mg-num{position:absolute;left:0;top:0;font-weight:900;color:#1f2433;white-space:nowrap;letter-spacing:-.02em}
  .mg-onpic .mg-num{color:#fff;text-shadow:0 3px 4px rgba(0,0,0,.75),0 8px 28px rgba(0,0,0,.6)}
  .mg-title .mg-panel{display:inline-block;max-width:1500px}
  .mg-onpic .mg-title{color:#fff}
  .mg-onpic .mg-title .mg-panel{background:rgba(14,18,32,.78);padding:16px 40px 20px;border-radius:26px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
  `;

  function createMG(kit, ctx, opts = {}) {
    const { stage, tl, D, frameFns, clampT } = ctx;
    const T = at => clampT(at ?? 0);
    const rt = window.__rt;
    const images = rt?.data?.images || {};
    const warn = m => rt?.warn?.(m);
    if (!stage.querySelector('style[data-mg]')) { const st = document.createElement('style'); st.dataset.mg = '1'; st.textContent = CSS; stage.appendChild(st); }
    let hs = 0; for (const ch of String(ctx.sceneId || '')) hs = (hs * 31 + ch.charCodeAt(0)) >>> 0;
    const sceneIdx = hs;
    const palName = opts.color || (opts.bg ? null : PAL_ORDER[sceneIdx % PAL_ORDER.length]);
    const dark = opts.dark ?? (palName === 'night' || palName === 'deep');
    const root = mkEl('div', `mg${dark ? ' mg-dark' : ''}`, stage);
    const bgL = mkEl('div', 'mg-bg', root), cam = mkEl('div', 'mg-cam', root), hud = mkEl('div', 'mg-hud', root);
    const itemsL = mkEl('div', '', cam, 'position:absolute;inset:0');
    const svg = mkSvg('svg', { class: 'mg-svg', viewBox: `0 0 ${W} ${H}` }, cam);
    const tagsL = mkEl('div', '', cam, 'position:absolute;inset:0');
    // kit.gfx diagrams drawn after kit.mg go inside the camera, under labels (so zoom and attached labels line up)
    const gfxHost = mkEl('div', '', null, 'position:absolute;inset:0'); cam.insertBefore(gfxHost, tagsL); stage.__gfxHost = gfxHost;
    const camSt = { cx: W / 2, cy: H / 2, z: 1, zEff: 1 };
    // keep a camera-space point inside the visible frame (labels/numbers attached to things while the camera zooms)
    const keepIn = (x, y, mx, myTop, myBot) => { const z = camSt.zEff || 1, cx = camSt.vx ?? camSt.cx, cy = camSt.vy ?? camSt.cy; let X = W / 2 + (x - cx) * z, Y = H / 2 + (y - cy) * z; X = clamp(X, mx, W - mx); Y = clamp(Y, myTop, H - myBot); return { x: cx + (X - W / 2) / z, y: cy + (Y - H / 2) / z }; };
    const drift = opts.drift === false ? 0 : 0.045;
    let rndSeed = 7;
    const rnd = () => { rndSeed = (rndSeed * 16807) % 2147483647; return (rndSeed - 1) / 2147483646; };

    // ── situation illustration: a full-frame picture inside the camera layer — the camera frames parts of it ──
    let pic = null;
    if (opts.scene && images[opts.scene]) {
      pic = mkEl('img', 'mg-pic', null, `position:absolute;left:0;top:0;width:${W}px;height:${H}px;object-fit:cover`);
      pic.src = images[opts.scene].url; cam.insertBefore(pic, itemsL); root.classList.add('mg-onpic');
      rt?.pending?.push(pic.decode().catch(() => {}));
      const f = opts.frame || {}; camSt.z = f.z ?? 1.12; camSt.cx = (f.x ?? 0.5) * W; camSt.cy = (f.y ?? 0.5) * H;
      bgL.style.background = '#000';
    } else if (opts.scene) warn(`Tranh minh họa không có: "${opts.scene}"`);
    // ── background ──
    let bgImg = null;
    if (pic) { /* the picture is the background */ }
    else if (opts.bg && images[opts.bg]) {
      bgImg = mkEl('img', '', bgL); bgImg.src = images[opts.bg].url;
      rt?.pending?.push(bgImg.decode().catch(() => {}));
      if (opts.tint !== false) mkEl('div', '', bgL, `position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%, rgba(255,255,255,0) 45%, rgba(${dark ? '0,0,0,.45' : '20,25,45,.22'}) 100%)`);
    } else {
      if (opts.bg) warn(`Ảnh nền không có: "${opts.bg}"`);
      const [c0, c1, blobs] = PALETTES[palName] || PALETTES.cool;
      bgL.style.background = `linear-gradient(160deg, ${c0} 0%, ${c1} 100%)`;
      blobs.forEach((c, i) => {
        const b = mkEl('div', 'mg-blob', bgL, `width:${700 + i * 160}px;height:${700 + i * 160}px;background:radial-gradient(circle, ${c}55 0%, ${c}00 70%)`);
        const ph = i * 2.1 + 0.7, bx = [260, 1500, 900][i], by = [260, 780, 120][i];
        frameFns.push(t => { b.style.transform = `translate(${bx - 350 + Math.sin(t * 0.17 + ph) * 90}px,${by - 350 + Math.cos(t * 0.13 + ph) * 70}px)`; });
      });
      if (opts.pattern !== false) mkEl('div', '', bgL, `position:absolute;inset:0;opacity:${dark ? 0.12 : 0.08};background-image:radial-gradient(${dark ? '#fff' : '#1f2433'} 1.6px, transparent 1.8px);background-size:46px 46px`);
    }

    // ── camera ──
    frameFns.push(t => {
      const z = camSt.zEff = camSt.z * (1 + drift * clamp(t / Math.max(1, D), 0, 1));
      root.dataset.zoom = z.toFixed(3);
      let vx = camSt.cx, vy = camSt.cy;
      if (pic) { const hw = W / (2 * z), hh = H / (2 * z); vx = clamp(vx, hw, W - hw); vy = clamp(vy, hh, H - hh); }   // never show past the picture's edges
      camSt.vx = vx; camSt.vy = vy;
      cam.style.transform = `translate(${W / 2}px,${H / 2}px) scale(${z.toFixed(4)}) translate(${-vx}px,${-vy}px)`;
      if (bgImg) bgImg.style.transform = `scale(${(1.04 + (z - 1) * 0.35 + 0.03 * clamp(t / Math.max(1, D), 0, 1)).toFixed(4)}) translate(${((W / 2 - camSt.cx) * 0.08).toFixed(1)}px,${((H / 2 - camSt.cy) * 0.08).toFixed(1)}px)`;
      else bgL.style.transform = `scale(${(1 + (z - 1) * 0.3).toFixed(4)})`;
    });

    // ── items ──
    const objKey = n => { const G = window.Gfx; if (!G) return null; return G.OBJ[n] ? n : G.ALIAS?.[n] && G.OBJ[G.ALIAS[n]] ? G.ALIAS[n] : null; };
    function content(id, holder) {
      const im = images[id];
      if (im && im.frames?.length) {   // animation sequence: frames stacked, the item cycles through them
        holder.style.position = 'relative';
        holder._frames = im.frames.map((u, i) => { const f = mkEl('img', '', holder, `position:absolute;inset:0;width:100%;height:100%;opacity:${i ? 0 : 1}`); f.src = u; rt?.pending?.push(f.decode().catch(() => {})); return f; });
        return im.w / im.h;
      }
      if (im && im.kind !== 'bg') {
        const img = mkEl('img', '', holder); img.src = im.url; img.alt = '';
        rt?.pending?.push(img.decode().catch(() => {}));
        return im.w / im.h;
      }
      const key = objKey(id);
      // flat effect/emoji-like icons look fake next to the illustrations: they are not drawn at all
      if (key && FAKE_ICONS.has(key)) { warn(`Không dùng icon "${id}" (trông giả, không hợp tranh) — hãy TỰ VẼ hiện tượng bằng m.draw hoặc dùng ảnh AI trong danh sách`); holder._missing = true; return 1; }
      if (key) {
        const s = mkSvg('svg', { viewBox: '-100 -100 200 200', preserveAspectRatio: 'xMidYMid meet' }, holder);
        s.innerHTML = window.Gfx.OBJ[key]({});
        holder._vec = true;
        try { const b = s.getBBox(); if (b.width > 0) { s.setAttribute('viewBox', `${b.x - 4} ${b.y - 4} ${b.width + 8} ${b.height + 8}`); return (b.width + 8) / (b.height + 8); } } catch { /* not laid out */ }
        return 1;
      }
      warn(`Hình không có: "${id}" — chỉ dùng id trong danh sách hình của video hoặc tên vật thể vector`);
      holder._missing = true;   // unknown id: draw nothing in the video (QA already reports it)
      return 1;
    }

    const all = [];
    let seq = 0;
    /**
     * m.img(id, { x, y, h | w, at, in, out, dur, rot, flip, idle, shadow, z })
     * in: 'pop' | 'rise' | 'drop' | 'slide-left' | 'slide-right' | 'zoom' | 'fade' | 'wipe' | 'iris' | 'flip' | 'none'
     */
    function img(id, o = {}) {
      const el = mkEl('div', `mg-item${o.shadow === false ? '' : ' sh'}`, itemsL);
      el.dataset.id = id;
      if (o.z != null) el.style.zIndex = o.z;
      const holder = mkEl('div', '', el, 'width:100%;height:100%');
      const aspect = content(id, holder) || 1;
      let cur = holder;   // the picture currently shown (swap chains)
      if (holder._frames) { const fr = holder._frames, fps = o.fps ?? 8, ta = T(o.at); frameFns.push(t => { const k = Math.floor(Math.max(0, t - ta) * fps) % fr.length; fr.forEach((f, i) => { f.style.opacity = i === k ? 1 : 0; }); }); }
      let h = o.h ?? (o.w ? o.w / aspect : 360), w = h * aspect;
      const capH = holder._vec ? 300 : 1200;
      if (h > capH) { h = capH; w = h * aspect; }
      if (w > 1500) { w = 1500; h = w / aspect; }
      el.style.width = `${w}px`; el.style.height = `${h}px`;
      const st = { x: o.x ?? W / 2, y: o.y ?? H / 2, s: 1, rot: o.rot || 0, op: 1, bx: 0, by: 0, sx: 1, clip: 1, clipKind: null };
      const ph = (seq++ * 1.37 + st.x * 0.001) % 6.28;
      const idle = o.idle === false ? 0 : (o.idle ?? 1);
      const motions = [];
      const h_ = {
        el, st, id, get w() { return w * st.s; }, get h() { return h * st.s; }, get x() { return st.x; }, get y() { return st.y; },
        center() { return { x: st.x + st.bx, y: st.y + st.by }; },
        top() { return { x: st.x + st.bx, y: st.y + st.by - h * st.s / 2 }; },
        bottom() { return { x: st.x + st.bx, y: st.y + st.by + h * st.s / 2 }; },
        radius() { return Math.max(w, h) * st.s * 0.42; },
        halfH() { return h * st.s / 2; }, halfW() { return w * st.s / 2; },
        moveTo(x, y, at, dur = 1, e = 'power3.inOut') { const v = {}; if (x != null) v.x = x; if (y != null) v.y = y; tl.to(st, { ...v, duration: dur, ease: e }, T(at)); return h_; },
        moveBy(dx = 0, dy = 0, at, dur = 1, e = 'power3.inOut') { tl.to(st, { x: `+=${dx}`, y: `+=${dy}`, duration: dur, ease: e }, T(at)); return h_; },
        scaleTo(k, at, dur = 0.8, e = 'power3.inOut') { tl.to(st, { s: Math.min(k, (holder._vec ? 380 : 1200) / h), duration: dur, ease: e }, T(at)); return h_; },
        grow(at, k = 1.3) { return h_.scaleTo(k, at, 0.7, 'back.out(1.6)'); },
        shrink(at, k = 0.6) { return h_.scaleTo(k, at, 0.7); },
        pulse(at, k = 1.15) { tl.to(st, { s: `+=${k - 1}`, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, T(at)); return h_; },
        rotateTo(deg, at, dur = 0.8) { tl.to(st, { rot: deg, duration: dur, ease: 'power3.inOut' }, T(at)); return h_; },
        spin(at, turns = 1, dur = 1) { tl.to(st, { rot: `+=${360 * turns}`, duration: dur, ease: 'power2.inOut' }, T(at)); return h_; },
        shake() { return h_; },   // removed on purpose: jittering reads as cheap (kept so older scene code still runs)
        float(amp = 10, period = 3) { motions.push(t => ({ dy: Math.sin(t / period * 6.283 + ph) * amp })); return h_; },
        dim(at, op = 0.3) { tl.to(st, { op, duration: 0.5 }, T(at)); return h_; },
        show(at) { tl.to(st, { op: 1, duration: 0.4 }, T(at)); return h_; },
        hide(at, how = 'shrink') {
          const t0 = T(at);
          if (how === 'fade') tl.to(st, { op: 0, duration: 0.45 }, t0);
          else if (how === 'drop') tl.to(st, { by: 500, op: 0, duration: 0.6, ease: 'power2.in' }, t0);
          else tl.to(st, { s: 0, op: 0, duration: 0.45, ease: 'back.in(1.7)' }, t0);
          return h_;
        },
        /** Turn into another picture in place (flip by default). */
        swap(other, at, how = 'flip') {
          const t0 = T(at), holder2 = mkEl('div', '', el, 'position:absolute;inset:0;opacity:0');
          content(other, holder2);
          if (how === 'flip') {
            tl.to(st, { sx: 0, duration: 0.22, ease: 'power2.in' }, t0);
            tl.set(cur, { opacity: 0 }, t0 + 0.22); tl.set(holder2, { opacity: 1 }, t0 + 0.22);
            tl.to(st, { sx: 1, duration: 0.3, ease: 'back.out(2)' }, t0 + 0.22);
          } else {
            tl.to(cur, { opacity: 0, duration: 0.35 }, t0); tl.to(holder2, { opacity: 1, duration: 0.35 }, t0);
            tl.to(st, { s: '+=0.12', duration: 0.17, yoyo: true, repeat: 1 }, t0);
          }
          cur = holder2;
          return h_;
        },
        /** Follow a smooth path through points [[x,y],…]. */
        path(points, at, dur = 1.6, e = 'power2.inOut') {
          const t0 = T(at), pts = [[st.x, st.y], ...points], prog = { k: 0 };
          tl.to(prog, { k: 1, duration: dur, ease: e }, t0);
          const n = pts.length - 1;
          const cr = (a, b, c, d, u) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
          motions.push(t => {
            if (t < t0) return null;
            const k = Math.min(1, prog.k), sg = Math.min(n - 1, Math.floor(k * n)), u = k * n - sg, P = i => pts[clamp(i, 0, n)];
            st.x = cr(P(sg - 1)[0], P(sg)[0], P(sg + 1)[0], P(sg + 2)[0], u); st.y = cr(P(sg - 1)[1], P(sg)[1], P(sg + 1)[1], P(sg + 2)[1], u);
            return null;
          });
          return h_;
        },
        label(text, at, o2 = {}) { return label(h_, text, { ...o2, at }); },
        /** Balloon-like swelling (inflation, bubbles) / shrinking with a shiver. */
        inflate(at, k = 1.6, dur = 1.4) { tl.to(st, { s: k, duration: dur, ease: 'elastic.out(1, 0.45)' }, T(at)); return h_; },
        deflate(at, k = 0.55, dur = 0.8) { const t0 = T(at); tl.to(st, { s: k, duration: dur, ease: 'power2.in' }, t0); return h_; },
        /** Fly into another thing and hit it (cause → effect): it shakes, pulses, a ring flashes. */
        hitTo(target, at, dur = 0.6) { const t0 = T(at), p = target.center ? target.center() : target; tl.to(st, { x: p.x, y: p.y, bx: 0, by: 0, duration: dur, ease: 'power2.in' }, t0); tl.to(st, { op: 0, s: 0.4, duration: 0.15 }, t0 + dur); target.pulse?.(t0 + dur + 0.05, 1.12); return h_; },
        dissolve(at, o2 = {}) { dissolve(h_, { ...o2, at }); return h_; },
      };
      // appear
      const how = o.in || (o.at != null ? 'pop' : 'none'), t0 = T(o.at), d = o.dur;
      if (how === 'pop') tl.fromTo(st, { s: 0, op: 0 }, { s: 1, op: 1, duration: d ?? 0.6, ease: 'back.out(1.8)' }, t0);
      else if (how === 'rise') tl.fromTo(st, { by: 80, op: 0 }, { by: 0, op: 1, duration: d ?? 0.7, ease: 'power3.out' }, t0);
      else if (how === 'drop') tl.fromTo(st, { by: -700, op: 1 }, { by: 0, duration: d ?? 0.9, ease: 'bounce.out' }, t0);
      else if (how === 'slide-left') tl.fromTo(st, { bx: -1200, op: 1 }, { bx: 0, duration: d ?? 0.9, ease: 'power3.out' }, t0);
      else if (how === 'slide-right') tl.fromTo(st, { bx: 1200, op: 1 }, { bx: 0, duration: d ?? 0.9, ease: 'power3.out' }, t0);
      else if (how === 'zoom') tl.fromTo(st, { s: 2.2, op: 0 }, { s: 1, op: 1, duration: d ?? 0.8, ease: 'power3.out' }, t0);
      else if (how === 'fade') tl.fromTo(st, { op: 0 }, { op: 1, duration: d ?? 0.7 }, t0);
      else if (how === 'flip') tl.fromTo(st, { sx: 0, op: 1 }, { sx: 1, duration: d ?? 0.6, ease: 'back.out(1.7)' }, t0);
      else if (how === 'wipe' || how === 'iris') { st.clipKind = how; tl.fromTo(st, { clip: 0 }, { clip: 1, duration: d ?? 0.8, ease: 'power2.inOut' }, t0); }
      if (o.out != null) h_.hide(o.out, o.outHow);
      if (o.float) h_.float(typeof o.float === 'number' ? o.float : 10);
      frameFns.push(t => {
        let dx = 0, dy = 0, dr = 0;
        for (const m of motions) { const r = m(t); if (r) { dx += r.dx || 0; dy += r.dy || 0; dr += r.rot || 0; } }
        const bob = idle ? Math.sin(t * 1.3 + ph) * 5 * idle : 0, sway = idle ? Math.sin(t * 0.9 + ph) * 1.2 * idle : 0;
        const x = st.x + st.bx + dx - w / 2, y = st.y + st.by + dy + bob - h / 2;
        el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(st.rot + dr + sway).toFixed(2)}deg) scale(${(st.s * st.sx * (o.flip ? -1 : 1)).toFixed(4)},${st.s.toFixed(4)})`;
        el.style.opacity = clamp(st.op, 0, 1).toFixed(3);
        if (st.clipKind === 'wipe') el.style.clipPath = st.clip >= 1 ? '' : `inset(0 ${((1 - st.clip) * 100).toFixed(1)}% 0 0)`;
        else if (st.clipKind === 'iris') el.style.clipPath = st.clip >= 1 ? '' : `circle(${(st.clip * 75).toFixed(1)}% at 50% 50%)`;
      });
      all.push(h_);
      return h_;
    }

    // ── layouts (sizes and positions chosen for the viewer) ──
    const areaOf = a => {
      const A = AREA, mid = (A.x0 + A.x1) / 2;
      if (a === 'left') return { ...A, x1: mid - 40 };
      if (a === 'right') return { ...A, x0: mid + 40 };
      if (a === 'top') return { ...A, y1: (A.y0 + A.y1) / 2 };
      if (a === 'bottom') return { ...A, y0: (A.y0 + A.y1) / 2 };
      return typeof a === 'object' && a ? { ...A, ...a } : A;
    };
    const stag = (o, i, n) => (o.at != null ? o.at + i * (o.stagger ?? Math.min(0.35, 2 / Math.max(1, n))) : undefined);
    const group = arr => {
      arr.center = () => { const c = arr.map(h => h.center()); return { x: c.reduce((a, p) => a + p.x, 0) / c.length, y: c.reduce((a, p) => a + p.y, 0) / c.length }; };
      arr.radius = () => Math.max(...arr.map(h => Math.hypot(h.center().x - arr.center().x, h.center().y - arr.center().y) + h.radius()));
      arr.top = () => { const c = arr.center(); return { x: c.x, y: Math.min(...arr.map(h => h.top().y)) }; };
      arr.hide = (at, how) => { arr.forEach(h => h.hide(at, how)); return arr; };
      arr.pulse = at => { arr.forEach((h, i) => h.pulse((at ?? 0) + i * 0.05)); return arr; };
      arr.label = (text, at, o2) => label(arr, text, { ...o2, at });
      return arr;
    };
    /** One main subject, big, centred (or in an area). */
    function hero(id, o = {}) { const A = areaOf(o.area); return img(id, { h: o.h ?? Math.min(480, (A.y1 - A.y0) * 0.8), x: (A.x0 + A.x1) / 2, y: (A.y0 + A.y1) / 2 + (o.dy || 0), in: o.in || 'pop', ...o }); }
    /** Things in a row, evenly spaced. ids: ['a','b'] — sizes fit the area. */
    function row(ids, o = {}) {
      const A = areaOf(o.area), n = ids.length, cw = (A.x1 - A.x0) / n;
      const hh = o.h ?? Math.min(420, (A.y1 - A.y0) * 0.6, cw * 0.85);
      return group(ids.map((id, i) => img(id, { ...o, h: hh, x: A.x0 + cw * (i + 0.5), y: o.y ?? (A.y0 + A.y1) / 2, at: stag(o, i, n), in: o.in || 'pop' })));
    }
    /** n copies of one picture in neat rows — for counting (10 coconuts). */
    function count(id, n, o = {}) {
      n = clamp(Math.round(n), 1, 40);
      const A = areaOf(o.area), aw = A.x1 - A.x0, ah = A.y1 - A.y0;
      let cols = Math.ceil(Math.sqrt(n * aw / ah)); cols = clamp(cols, 1, n); const rows = Math.ceil(n / cols);
      const cell = Math.min(aw / cols, ah / rows), hh = Math.min(o.h ?? cell * 0.78, cell * 0.85);   // copies never overlap
      return group(Array.from({ length: n }, (_, i) => {
        const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
        return img(id, { ...o, h: hh, x: (A.x0 + A.x1) / 2 + (c - (inRow - 1) / 2) * cell, y: (A.y0 + A.y1) / 2 + (r - (rows - 1) / 2) * cell, at: stag(o, i, n), in: o.in || 'pop', idle: o.idle ?? 0.4 });
      }));
    }
    /** Two things side by side with an optional link: 'arrow' | 'vs' | 'equals' | 'neq' | null. */
    function pair(a, b, o = {}) {
      const hh = o.h ?? 440;
      const L = img(a, { ...o, h: hh, x: 560, y: o.y ?? 500, at: o.at, in: o.in || 'slide-left' });
      const R = img(b, { ...o, h: hh, x: 1360, y: o.y ?? 500, at: o.at != null ? o.at + (o.gap ?? 0.5) : undefined, in: o.in || 'slide-right' });
      const lt = o.at != null ? o.at + (o.gap ?? 0.5) + 0.3 : undefined;
      if (o.link === 'arrow') arrow(L, R, { at: lt });
      else if (o.link) text({ vs: 'VS', equals: '=', neq: '≠' }[o.link] || o.link, { at: lt, x: 960, y: (o.y ?? 500), size: 110, hud: false });
      if (o.labels) { label(L, o.labels[0], { at: o.at != null ? o.at + 0.4 : undefined, side: 'bottom' }); label(R, o.labels[1], { at: lt, side: 'bottom' }); }
      return group([L, R]);
    }
    /** A centre thing with satellites around it, joined by lines. */
    function orbit(center, ids, o = {}) {
      const C = img(center, { h: o.centerH ?? 260, x: 960, y: 550, at: o.at, in: 'pop' });
      const n = ids.length, rx = o.rx ?? 620, ry = o.ry ?? 260;
      const sats = ids.map((id, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n;
        const s = img(id, { h: o.h ?? Math.min(190, 800 / n), x: 960 + Math.cos(a) * rx, y: 550 + Math.sin(a) * ry, at: stag({ ...o, at: (o.at ?? 0) + 0.5 }, i, n), in: 'pop' });
        if (o.lines !== false) line(C, s, { at: stag({ ...o, at: (o.at ?? 0) + 0.5 }, i, n), dashed: true });
        return s;
      });
      return group([C, ...sats]);
    }
    /** A process: things left → right joined by arrows drawn in sequence (times: cue times per step). */
    function flow(ids, o = {}) {
      const A = areaOf(o.area), n = ids.length, cw = (A.x1 - A.x0) / n, hh = o.h ?? Math.min(340, cw * 0.62);
      const times = o.times || ids.map((_, i) => (o.at ?? 0) + i * (o.stagger ?? 1));
      const items = ids.map((id, i) => img(id, { h: hh, x: A.x0 + cw * (i + 0.5), y: o.y ?? (A.y0 + A.y1) / 2 + (o.zigzag ? (i % 2 ? 80 : -80) : 0), at: times[i], in: o.in || 'pop' }));
      if (o.link === 'arrow') items.forEach((it, i) => { if (i) arrow(items[i - 1], it, { at: times[i] - 0.35, dur: 0.45, curve: o.curve ?? 0.15 }); });
      else if (o.link !== 'none') items.forEach((it, i) => { if (i) line(items[i - 1], it, { at: times[i] - 0.3, dashed: true }); });
      if (o.labels) items.forEach((it, i) => o.labels[i] && label(it, o.labels[i], { at: times[i] + 0.3, side: 'bottom' }));
      return group(items);
    }
    /** A loop: things around a circle with curved arrows between them. */
    function cycle(ids, o = {}) {
      const n = ids.length, R = o.r ?? 300;
      const items = ids.map((id, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return img(id, { h: o.h ?? 230, x: 960 + Math.cos(a) * R * 1.35, y: 500 + Math.sin(a) * R, at: stag(o, i, n), in: 'pop' }); });
      items.forEach((it, i) => arrow(it, items[(i + 1) % n], { at: stag(o, i, n) != null ? stag(o, i, n) + 0.3 : undefined, curve: 0.35 }));
      return group(items);
    }
    /** Size comparison at a true ratio (big / small). */
    function scale(small, big, o = {}) {
      const ratio = Math.max(1, o.ratio ?? 4), bh = o.h ?? 620, sh = Math.max(24, bh / ratio);
      const B = img(big, { h: bh, x: 1180, y: 860 - bh / 2, at: o.at, in: 'rise' });
      const S = img(small, { h: sh, x: 560, y: 860 - sh / 2, at: o.at != null ? o.at + 0.5 : undefined, in: 'pop' });
      return group([S, B]);
    }

    // ── connectors & callouts ──
    const posOf = t => (t?.center ? t.center() : { x: t?.x ?? W / 2, y: t?.y ?? H / 2 });
    const radOf = t => (t?.radius ? t.radius() : 0);
    function arrow(a, b, o = {}) {
      const c = col(o.color || (dark ? 'white' : 'ink'));
      const g = mkSvg('g', { opacity: 0 }, svg);
      const p = mkSvg('path', { fill: 'none', stroke: c, 'stroke-width': o.width ?? 9, 'stroke-linecap': 'round', ...(o.dashed ? { 'stroke-dasharray': '2 22' } : {}) }, g);
      const head = mkSvg('path', { fill: c }, g);
      const s = { k: 0 }, t0 = T(o.at);
      tl.fromTo(s, { k: 0 }, { k: 1, duration: o.dur ?? 0.6, ease: 'power2.inOut' }, t0);
      frameFns.push(t => {
        g.setAttribute('opacity', t >= t0 ? 1 : 0);
        if (t < t0) return;
        const A = posOf(a), B = posOf(b), dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        const ra = radOf(a) * 0.8 + 14, rb = radOf(b) * 0.8 + 24;
        const x0 = A.x + ux * ra, y0 = A.y + uy * ra, x1 = B.x - ux * rb, y1 = B.y - uy * rb;
        const cv = (o.curve ?? 0.2) * L, mx = (x0 + x1) / 2 - uy * cv, my = (y0 + y1) / 2 + ux * cv;
        const k = s.k, q = (u) => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1];
        const N = 24, pts = []; for (let i = 0; i <= N; i++) pts.push(q(i / N * k));
        p.setAttribute('d', 'M' + pts.map(v => v.map(n => n.toFixed(1)).join(',')).join(' L'));
        const [ex, ey] = pts[N], [px, py] = pts[N - 1], ang = Math.atan2(ey - py, ex - px), hs = (o.width ?? 9) * 3.2 * Math.min(1, k * 3);
        head.setAttribute('d', o.head === false || k < 0.05 ? '' : `M${ex + Math.cos(ang) * hs * 0.6},${ey + Math.sin(ang) * hs * 0.6} L${ex + Math.cos(ang + 2.5) * hs},${ey + Math.sin(ang + 2.5) * hs} L${ex + Math.cos(ang - 2.5) * hs},${ey + Math.sin(ang - 2.5) * hs} Z`);
      });
      if (o.label) {
        const mid = { center: () => { const A = posOf(a), B = posOf(b); return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 - 40 }; }, radius: () => 0 };
        label(mid, o.label, { at: (o.at ?? 0) + 0.4, side: 'top', line: false });
      }
      return g;
    }
    function line(a, b, o = {}) { return arrow(a, b, { ...o, head: false, curve: o.curve ?? 0, width: o.width ?? 5, color: o.color || (dark ? '#ffffff88' : '#1f243366') }); }
    /** Pill label attached to a thing (follows it), with a short leader line. side: 'top' | 'bottom' | 'left' | 'right'. */
    function label(target, txt, o = {}) {
      const el = mkEl('div', 'mg-pill', tagsL);
      el.textContent = txt;
      if (o.color) el.style.background = col(o.color);
      if (o.size) el.style.fontSize = `${o.size}px`;
      const ln = o.line === false ? null : mkSvg('line', { stroke: dark ? '#fff' : '#1f2433', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0 }, svg);
      const s = { op: 0, y: 14 }, t0 = T(o.at), side = o.side || 'top';
      const reg = { t0, mul: 1 }; tags.push(reg);
      tl.fromTo(s, { op: 0, y: 14 }, { op: 1, y: 0, duration: 0.4, ease: 'power3.out' }, t0);
      if (o.out != null) tl.to(s, { op: 0, duration: 0.3 }, T(o.out));
      frameFns.push(() => {
        const c = posOf(target), r = radOf(target) || 60, bw = el.offsetWidth, bh = el.offsetHeight;
        const hh = target?.halfH ? target.halfH() : r, hw = target?.halfW ? target.halfW() : r;
        let x = c.x, y = c.y - hh - bh / 2 - 26, ax = c.x, ay = c.y - hh * 0.8;
        if (side === 'bottom') { y = c.y + hh + bh / 2 + 22; ay = c.y + hh * 0.85; }
        else if (side === 'left') { x = c.x - hw - bw / 2 - 36; y = c.y; ax = c.x - hw * 0.8; ay = c.y; }
        else if (side === 'right') { x = c.x + hw + bw / 2 + 36; y = c.y; ax = c.x + hw * 0.8; ay = c.y; }
        const zz = camSt.zEff || 1;
        ({ x, y } = keepIn(x, y, 40 + bw * zz / 2, 235 + bh * zz / 2, 190 + bh * zz / 2));   // never into the title band
        el.style.transform = `translate(${(x - bw / 2).toFixed(1)}px,${(y - bh / 2 + s.y).toFixed(1)}px)`;
        const live = target?.alive && !target.alive() ? 0 : 1;   // anchor gone (a planet burnt away) → label goes too
        el.style.opacity = (s.op * reg.mul * live).toFixed(3);
        if (ln) { ln.setAttribute('x1', ax); ln.setAttribute('y1', ay); ln.setAttribute('x2', x); ln.setAttribute('y2', side === 'top' ? y + bh / 2 : side === 'bottom' ? y - bh / 2 : y); ln.setAttribute('opacity', (s.op * reg.mul * live * 0.7).toFixed(3)); }
      });
      return el;
    }
    /** Pulsing highlight ring around a thing. */
    function ring() { return mkSvg('g', {}, null); }   // removed on purpose: pulsing concentric circles clutter the frame
    function ringOld(target, o = {}) {
      const c = mkSvg('circle', { fill: 'none', stroke: col(o.color || 'orange'), 'stroke-width': 8, opacity: 0 }, svg);
      const t0 = T(o.at), dur = o.dur ?? 1.6;
      frameFns.push(t => {
        const on = t >= t0 && t <= t0 + dur && !(target?.alive && !target.alive()); c.setAttribute('opacity', on ? (1 - (t - t0) / dur).toFixed(3) : 0);
        if (!on) return; const p = posOf(target), k = (t - t0) / dur;
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', (radOf(target) * (1.05 + k * 0.35) + 10).toFixed(1));
      });
      return c;
    }
    /** Red strike-through over a thing (a price that no longer holds…). */
    function strike(target, o = {}) {
      const p = mkSvg('line', { stroke: col(o.color || 'red'), 'stroke-width': 14, 'stroke-linecap': 'round', opacity: 0 }, svg);
      const s = { k: 0 }, t0 = T(o.at);
      tl.fromTo(s, { k: 0 }, { k: 1, duration: 0.35, ease: 'power2.out' }, t0);
      frameFns.push(t => { p.setAttribute('opacity', t >= t0 ? 1 : 0); const c = posOf(target), r = radOf(target) * 0.9; p.setAttribute('x1', c.x - r); p.setAttribute('y1', c.y + r * 0.6); p.setAttribute('x2', c.x - r + 2 * r * s.k); p.setAttribute('y2', c.y + r * 0.6 - 1.2 * r * s.k); });
      return p;
    }

    // ── text & numbers ──
    const texts = [], tags = [];
    let ordered = false;
    const order = () => { if (ordered) return; ordered = true; texts.sort((a, b) => a.t0 - b.t0); tags.sort((a, b) => a.t0 - b.t0); };
    frameFns.push(t => {
      order();
      texts.forEach((x, i) => { const nx = texts[i + 1]; const end = nx ? nx.t0 - 0.05 : 1e9; x.el.style.opacity = (t < x.t0 ? 0 : t < end ? Math.min(1, (t - x.t0) / 0.3) : Math.max(0, 1 - (t - end) / 0.25)).toFixed(3); });
      tags.forEach((x, i) => { const nx = tags[i + 2]; const end = nx ? nx.t0 - 0.05 : 1e9; x.mul = t < end ? 1 : Math.max(0, 1 - (t - end) / 0.25); });
    });
    /** Kinetic text: words rise in one by one. { at, y: 'top'|'center'|'bottom'|px, size, color, highlight: ['từ'], out, hud } */
    function text(str, o = {}) {
      const layer = o.hud === false ? tagsL : hud;
      const box = mkEl('div', 'mg-title', layer), el = mkEl('div', 'mg-panel', box);
      texts.push({ t0: T(o.at), el: box });
      const size = Math.min(o.size ?? 84, 96);
      box.style.fontSize = `${size}px`;
      if (o.color && !pic) box.style.color = col(o.color);
      const yPos = o.y === 'center' ? 470 : o.y === 'bottom' ? 740 : typeof o.y === 'number' ? clamp(o.y, 120, 760) : 140;
      box.style.top = `${yPos - size * 0.6}px`;
      const hl = (o.highlight || []).map(s => s.toLowerCase());
      const words = String(str).split(/\s+/).filter(Boolean);
      const spans = words.map((w, i) => { const s = mkEl('span', '', el); s.textContent = w + (i < words.length - 1 ? ' ' : ''); if (hl.some(h => w.toLowerCase().includes(h))) s.style.color = col(o.accent || 'orange'); return s; });
      const t0 = T(o.at);
      spans.forEach((s, i) => tl.fromTo(s, { opacity: 0, y: size * 0.5 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, t0 + i * (o.stagger ?? 0.08)));
      if (o.out != null) tl.to(spans, { opacity: 0, y: -size * 0.3, duration: 0.35, stagger: 0.03 }, T(o.out));
      return box;
    }
    /** Big counting number. { at, from, dur, prefix, suffix, decimals, x, y, size, color } */
    function number(value, o = {}) {
      const el = mkEl('div', 'mg-num', o.attach ? tagsL : hud);
      const size = o.size ?? 150; el.style.fontSize = `${size}px`;
      if (o.color) el.style.color = col(o.color);
      const s = { v: o.from ?? 0, op: 0, sc: 0.6 }, t0 = T(o.at);
      tl.fromTo(s, { op: 0, sc: 0.6 }, { op: 1, sc: 1, duration: 0.5, ease: 'back.out(1.8)' }, t0);
      tl.fromTo(s, { v: o.from ?? 0 }, { v: value, duration: o.dur ?? 1.4, ease: 'power2.out' }, t0);
      if (o.out != null) tl.to(s, { op: 0, duration: 0.3 }, T(o.out));
      frameFns.push(() => {
        el.textContent = `${o.prefix || ''}${fmtNum(s.v, o.decimals ?? Math.min(2, (String(value).split(".")[1] || "").length))}${o.suffix || ''}`;
        const c = o.attach ? (() => { const p = posOf(o.attach); return { x: p.x, y: Math.max(size * 0.75, p.y - (o.attach.halfH ? o.attach.halfH() : radOf(o.attach)) - size * 0.45) }; })() : { x: o.x ?? W / 2, y: o.y ?? 480 };
        // attached numbers live in the camera layer: size them for the zoomed screen, not the scene
        const z = o.attach ? (camSt.zEff || 1) : 1, fit = Math.min(1, (W - 160) / Math.max(1, el.offsetWidth * z)), ew = el.offsetWidth * fit;
        const k = o.attach ? keepIn(c.x, c.y, 60 + ew * z / 2, size * fit * z * 0.7, 200) : c;
        const kx = o.attach ? k.x : clamp(k.x, 80 + ew / 2, W - 80 - ew / 2);
        el.style.transformOrigin = '50% 60%';
        el.style.transform = `translate(${(kx - el.offsetWidth / 2).toFixed(1)}px,${(k.y - size * 0.6).toFixed(1)}px) scale(${(s.sc * fit).toFixed(3)})`;
        el.style.opacity = s.op.toFixed(3);
      });
      return el;
    }

    // ── particles & travelling things ──
    /** Copies of a picture travelling from a to b (money flowing, goods shipping). */
    function travel(id, a, b, o = {}) {
      const n = o.n ?? 5, dur = o.dur ?? 1.4, t0 = T(o.at), hh = o.h ?? 90, span = o.span ?? Math.max(dur, (D - (o.at ?? 0)) * 0.7);
      for (let i = 0; i < n; i++) {
        const it = img(id, { h: hh, idle: 0, shadow: false });
        it.st.op = 0;
        const off = i * (span / n);
        frameFns.push(t => {
          const lt = t - t0 - off; if (lt < 0) { it.st.op = 0; return; }
          const k = (lt % span) / dur; if (k > 1) { it.st.op = 0; return; }
          const A = posOf(a), B = posOf(b), e = ease('power1.inOut', k), arc = (o.arc ?? 120) * Math.sin(Math.PI * k);
          it.st.x = A.x + (B.x - A.x) * e; it.st.y = A.y + (B.y - A.y) * e - arc; it.st.op = Math.min(1, k * 6, (1 - k) * 6);
        });
      }
    }
    /** Particles: 'confetti' | 'sparkle' | 'rain' | 'snow' | 'smoke' | 'steam' | 'burst' | 'fall' (copies of o.item falling). */
    function fx(type, o = {}) {
      const t0 = T(o.at), dur = o.dur ?? (type === 'burst' ? 0.8 : D - (o.at ?? 0));
      const layer = mkEl('div', '', type === 'rain' || type === 'snow' || type === 'confetti' ? hud : tagsL, 'position:absolute;inset:0;pointer-events:none');
      const n = o.n ?? { confetti: 70, sparkle: 18, rain: 90, snow: 60, smoke: 12, steam: 8, burst: 14, fall: 14 }[type] ?? 30;
      const cx = o.x ?? (o.on ? posOf(o.on).x : W / 2), cy = o.y ?? (o.on ? posOf(o.on).y - radOf(o.on) * 0.8 : H / 2);
      const parts = Array.from({ length: n }, (_, i) => {
        const p = { r1: rnd(), r2: rnd(), r3: rnd() };
        if (type === 'fall' && o.item) { p.h = img(o.item, { h: o.h ?? 80, idle: 0, shadow: false }); p.h.st.op = 0; return p; }
        const e = mkEl('div', '', layer, 'position:absolute;left:0;top:0');
        if (type === 'confetti') e.style.cssText += `width:16px;height:10px;background:${['#e5484d', '#f2c14e', '#3b7cf6', '#14a38b', '#7b5bd6', '#f08a3c'][i % 6]}`;
        else if (type === 'sparkle') e.style.cssText += `width:26px;height:26px;background:radial-gradient(circle,#fff 0,#ffe68a 30%,rgba(255,230,138,0) 70%)`;
        else if (type === 'rain') e.style.cssText += 'width:3px;height:34px;background:rgba(190,215,255,.7);border-radius:2px';
        else if (type === 'snow') e.style.cssText += 'width:10px;height:10px;border-radius:50%;background:#fff';
        else if (type === 'smoke' || type === 'steam') e.style.cssText += `width:70px;height:70px;border-radius:50%;background:radial-gradient(circle,${type === 'smoke' ? 'rgba(120,125,135,.55)' : 'rgba(255,255,255,.75)'} 0,rgba(255,255,255,0) 70%)`;
        else if (type === 'burst') e.style.cssText += `width:10px;height:70px;border-radius:5px;background:${col(o.color || 'gold')}`;
        p.e = e; return p;
      });
      frameFns.push(t => {
        const lt = t - t0, on = lt >= 0 && lt <= dur;
        layer.style.opacity = on ? Math.min(1, lt * 4, (dur - lt) * 3).toFixed(3) : 0;
        if (!on) { parts.forEach(p => { if (p.h) p.h.st.op = 0; }); return; }
        parts.forEach((p, i) => {
          let x, y, r = 0, s = 1, op = 1;
          if (type === 'confetti' || type === 'snow') { const sp = type === 'snow' ? 70 : 260; y = ((p.r1 * 1300 + lt * (sp + p.r2 * sp)) % 1300) - 100; x = p.r3 * W + Math.sin(lt * 2 + i) * 40; r = lt * 300 * (p.r2 - 0.5); }
          else if (type === 'rain') { y = ((p.r1 * 1300 + lt * 1500) % 1300) - 100; x = p.r3 * W - y * 0.15; r = 10; }
          else if (type === 'sparkle') { x = cx + (p.r1 - 0.5) * (o.w ?? 600); y = cy + (p.r2 - 0.5) * (o.h ?? 400); const k = (lt * (0.8 + p.r3) + p.r1) % 1; s = Math.sin(k * Math.PI) * 1.4; }
          else if (type === 'smoke' || type === 'steam') { const k = ((lt * (type === 'steam' ? 0.5 : 0.25)) + p.r1) % 1; x = cx + Math.sin(k * 5 + i) * 30 + (p.r2 - 0.5) * 40; y = cy - k * (type === 'steam' ? 220 : 420); s = 0.5 + k * 2.2; op = (1 - k) * Math.min(1, k * 6); }
          else if (type === 'burst') { const a = i / n * 6.283, k = ease('power3.out', lt / dur), d = 60 + k * 160; x = cx + Math.cos(a) * d; y = cy + Math.sin(a) * d; r = a * 180 / Math.PI + 90; op = 1 - k; s = 1 - k * 0.5; }
          else if (type === 'fall') { const k = ((lt * 0.35) + p.r1) % 1; x = (o.x0 ?? 200) + p.r3 * ((o.x1 ?? 1720) - (o.x0 ?? 200)); y = -100 + k * 1200; r = Math.sin(lt * 2 + i) * 30; if (p.h) { p.h.st.x = x; p.h.st.y = y; p.h.st.rot = r; p.h.st.op = 1; } return; }
          p.e.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg) scale(${s.toFixed(3)})`;
          p.e.style.opacity = op.toFixed(3);
        });
      });
    }

    // ── camera ──
    /** Push the camera in on a thing / point. { at, dur, z } */
    function zoomTo(target, o = {}) { const p = posOf(target); tl.to(camSt, { cx: clamp(p.x, 600, 1320), cy: clamp(p.y, 340, 740), z: o.z ?? 1.5, duration: o.dur ?? 1.2, ease: o.ease || 'power3.inOut' }, T(o.at)); return api; }
    /** Camera move across the picture: m.shot({ x: 0..1, y: 0..1, z }, { at, dur }) — x/y = centre of view as a fraction of the picture. */
    function shot(f, o = {}) { tl.to(camSt, { cx: (f.x ?? 0.5) * W, cy: (f.y ?? 0.5) * H, z: f.z ?? camSt.z, duration: o.dur ?? 2, ease: o.ease || 'power2.inOut' }, T(o.at)); return api; }
    /** A point of the picture (fractions) usable as a target for labels, rings, magnify, pour, hitTo… */
    function spot(fx, fy, r = 90) { const c = { x: fx * W, y: fy * H }; return { center: () => c, top: () => ({ x: c.x, y: c.y - r }), radius: () => r, halfH: () => r, halfW: () => r }; }
    function zoomOut(o = {}) { tl.to(camSt, { cx: W / 2, cy: H / 2, z: 1, duration: o.dur ?? 1, ease: 'power3.inOut' }, T(o.at)); return api; }
    function pan(dx, o = {}) { tl.to(camSt, { cx: `+=${dx}`, duration: o.dur ?? 1.5, ease: 'power2.inOut' }, T(o.at)); return api; }


    // ── visual devices: relationships shown physically (no "A → arrow → B") ──
    const holdAt = (h, fn) => { h._pinned = fn; };   // position driven by a device each frame
    frameFns.unshift(t => { for (const h of all) if (h._pinned) h._pinned(t); });

    /** Beam balance: m.balance(['coin', 'coin'], ['basket'], { at, tilt: [[cue, -12], [cue, 10]] }) — things sit in the pans, the beam tilts. */
    function balance(left, right, o = {}) {
      const px = 960, py = o.y ?? 400, L = o.arm ?? 430, strL = 170, c = dark ? '#e8ecf5' : '#3b4252';
      const g = mkSvg('g', { opacity: 0 }, svg);
      mkSvg('path', { d: `M${px - 120},860 L${px + 120},860 L${px + 40},830 L${px - 40},830 Z`, fill: c }, g);
      mkSvg('rect', { x: px - 12, y: py, width: 24, height: 440, rx: 10, fill: c }, g);
      const beam = mkSvg('rect', { x: px - L - 20, y: py - 9, width: 2 * L + 40, height: 18, rx: 9, fill: c }, g);
      mkSvg('circle', { cx: px, cy: py, r: 22, fill: col('gold') }, g);
      const pans = [0, 1].map(() => { const pg = mkSvg('g', {}, g); const s1 = mkSvg('line', { stroke: c, 'stroke-width': 4 }, pg), s2 = mkSvg('line', { stroke: c, 'stroke-width': 4 }, pg); const dish = mkSvg('path', { fill: c }, pg); return { s1, s2, dish }; });
      const bs = { a: 0, op: 0 }, t0 = T(o.at);
      tl.fromTo(bs, { op: 0 }, { op: 1, duration: 0.5 }, t0);
      for (const [at, deg] of o.tilt || []) tl.to(bs, { a: deg, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, T(at));
      const panPos = (side, a) => { const r = a * Math.PI / 180, sx = side ? 1 : -1; return { x: px + Math.cos(r) * L * sx, y: py + Math.sin(r) * L * sx + strL }; };
      const lay = (ids, side) => (Array.isArray(ids) ? ids : [ids]).map((id, i, arr) => {
        const it = img(typeof id === 'string' ? id : id.id, { h: o.h ?? 130, at: (o.at ?? 0) + 0.4 + i * 0.15, in: 'drop', idle: 0 });
        const n = arr.length, col_ = i % 3, row_ = Math.floor(i / 3), inRow = Math.min(3, n - row_ * 3);
        holdAt(it, () => { const p = panPos(side, bs.a); it.st.x = p.x + (col_ - (inRow - 1) / 2) * (o.h ?? 130) * 0.8; it.st.y = p.y - (o.h ?? 130) * 0.45 - row_ * (o.h ?? 130) * 0.55; });
        return it;
      });
      const api2 = { left: [], right: [], tilt(deg, at) { tl.to(bs, { a: deg, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, T(at)); return api2; } };
      frameFns.push(() => {
        g.setAttribute('opacity', bs.op.toFixed(3));
        beam.setAttribute('transform', `rotate(${bs.a.toFixed(2)} ${px} ${py})`);
        pans.forEach((pn, side) => {
          const p = panPos(side, bs.a), top = { x: p.x, y: p.y - strL };
          pn.s1.setAttribute('x1', top.x); pn.s1.setAttribute('y1', top.y); pn.s1.setAttribute('x2', p.x - 120); pn.s1.setAttribute('y2', p.y);
          pn.s2.setAttribute('x1', top.x); pn.s2.setAttribute('y1', top.y); pn.s2.setAttribute('x2', p.x + 120); pn.s2.setAttribute('y2', p.y);
          pn.dish.setAttribute('d', `M${p.x - 140},${p.y} L${p.x + 140},${p.y} Q${p.x + 110},${p.y + 46} ${p.x},${p.y + 46} Q${p.x - 110},${p.y + 46} ${p.x - 140},${p.y} Z`);
        });
      });
      api2.left = lay(left, 0); api2.right = lay(right, 1);
      return api2;
    }

    /** Tower of copies that grows/shrinks: m.stack('coin', { x, from: 2, to: 9, at, dur, label }) — a bar chart made of things. */
    function stack(id, o = {}) {
      const hh = o.h ?? 110, step = hh * (o.step ?? 0.32), max = clamp(Math.max(o.from ?? 0, o.to ?? 5), 1, 40);
      const base = o.y ?? 830, x = o.x ?? 960, s = { n: o.from ?? 0 }, t0 = T(o.at);
      tl.to(s, { n: o.to ?? 5, duration: o.dur ?? 1.6, ease: 'power1.inOut' }, t0);
      const items = Array.from({ length: max }, (_, i) => {
        const it = img(id, { h: hh, x: x + (i % 2 ? 4 : -4), y: base - hh / 2 - i * step, idle: 0, shadow: i === 0 });
        it.el.style.zIndex = 10 + i;
        holdAt(it, () => { const vis = clamp(s.n - i, 0, 1); it.st.op = vis; it.st.by = (1 - vis) * -60; });
        return it;
      });
      const g = group(items.slice());
      g.top = () => ({ x, y: base - hh - Math.max(0, s.n - 1) * step });
      g.center = () => ({ x, y: base - hh / 2 - Math.max(0, s.n - 1) * step / 2 });
      g.halfH = () => (hh + Math.max(0, s.n - 1) * step) / 2;
      g.radius = () => hh * 0.5;
      g.to = (n, at, dur = 1.2) => { tl.to(s, { n, duration: dur, ease: 'power1.inOut' }, T(at)); return g; };
      if (o.label) label({ center: () => ({ x, y: base + 12 }), radius: () => 0, halfH: () => 0 }, o.label, { at: o.at, side: 'bottom', line: false });
      return g;
    }
    /** Several towers side by side for comparing amounts: m.stacks([{ id, from, to, label }, …], { at }) */
    function stacks(list, o = {}) { const n = list.length, A = areaOf(o.area); return list.map((it, i) => stack(it.id, { ...o, ...it, x: A.x0 + (A.x1 - A.x0) * (i + 0.5) / n, at: it.at ?? (o.at != null ? o.at + i * 0.3 : undefined) })); }

    /** Copies drop from above into a target, which reacts (pulse, optional growth): m.pour('coin', basket, { at, n, grow: 0.04 }) */
    function pour(id, target, o = {}) {
      const n = o.n ?? 8, every = o.every ?? 0.22, t0 = T(o.at);
      for (let i = 0; i < n; i++) {
        const it = img(id, { h: o.h ?? 80, idle: 0, shadow: false }); it.st.op = 0;
        const ts = t0 + i * every, fall = 0.55, sx = (rnd() - 0.5) * 160;
        holdAt(it, t => {
          const k = (t - ts) / fall; if (k < 0 || k > 1) { it.st.op = 0; return; }
          const p = posOf(target), e = k * k;
          it.st.x = p.x + sx * (1 - e); it.st.y = -80 + (p.y - (target.halfH ? target.halfH() * 0.3 : 0) + 80) * e; it.st.rot = k * 200; it.st.op = 1;
        });
        if (target?.st) { tl.to(target.st, { s: `+=${o.grow ?? 0}`, duration: 0.12, ease: 'power2.out' }, ts + fall); if (!o.grow) target.pulse?.(ts + fall, 1.06); }
      }
    }
    /** Break a thing into drifting dust (losing value, vanishing): m.dissolve(h, { at, color }) */
    function dissolve(h, o = {}) {
      const t0 = T(o.at), dur = o.dur ?? 1.4, colr = col(o.color || 'gold');
      tl.to(h.st, { op: 0, s: '+=0.08', duration: dur * 0.6, ease: 'power1.in' }, t0 + 0.15);
      const layer = mkEl('div', '', tagsL, 'position:absolute;inset:0;pointer-events:none');
      const ps = Array.from({ length: o.n ?? 46 }, (_, i) => ({ e: mkEl('div', '', layer, `position:absolute;left:0;top:0;width:${8 + (i % 3) * 5}px;height:${8 + (i % 3) * 5}px;border-radius:${i % 2 ? 2 : 50}%;background:${i % 4 ? colr : (dark ? '#ffffff' : '#9aa3b5')}`), r1: rnd(), r2: rnd(), r3: rnd() }));
      frameFns.push(t => {
        const k = (t - t0) / dur; layer.style.opacity = k < 0 || k > 1 ? 0 : 1; if (k < 0 || k > 1) return;
        const c = h.center(), hw = h.halfW ? h.halfW() : 120, hh = h.halfH ? h.halfH() : 120;
        ps.forEach(p => { const sx = c.x + (p.r1 - 0.5) * 2 * hw, sy = c.y + (p.r2 - 0.5) * 2 * hh, d = ease('power2.out', clamp(k * 1.3 - p.r3 * 0.3, 0, 1));
          p.e.style.transform = `translate(${(sx + d * (120 + p.r3 * 260)).toFixed(1)}px,${(sy - d * (180 + p.r1 * 200)).toFixed(1)}px) rotate(${(d * 360 * p.r2).toFixed(0)}deg)`;
          p.e.style.opacity = (d > 0 ? 1 - d : 0).toFixed(3); });
      });
    }
    /** Before/after on the same spot: a divider sweeps across revealing the second picture. */
    function reveal(before, after, o = {}) {
      const hh = o.h ?? 440, x = o.x ?? 960, y = o.y ?? 560, t0 = T(o.at), dur = o.dur ?? 1.4;
      const A = img(before, { h: hh, x, y, at: o.at != null ? o.at - 0.6 : undefined, in: 'pop' });
      const B = img(after, { h: hh, x, y, idle: 0 }); B.st.clipKind = 'wipe'; B.st.clip = 0;
      tl.to(B.st, { clip: 1, duration: dur, ease: 'power2.inOut' }, t0);
      const bar = mkEl('div', '', tagsL, `position:absolute;left:0;top:0;width:8px;height:${hh + 80}px;border-radius:4px;background:${dark ? '#fff' : '#1f2433'};opacity:0`);
      frameFns.push(t => { const k = B.st.clip, on = t >= t0 && k < 1; bar.style.opacity = on ? 1 : 0; const w = B.w; bar.style.transform = `translate(${(x - w / 2 + w * k - 4).toFixed(1)}px,${(y - hh / 2 - 40).toFixed(1)}px)`; });
      if (o.labels) { label(A, o.labels[0], { at: o.at != null ? o.at - 0.4 : undefined, side: 'top' }); label({ center: () => ({ x: x + 1, y }), radius: () => 0, halfH: () => hh / 2 }, o.labels[1], { at: t0 + dur, side: 'bottom', line: false }); }
      return group([A, B]);
    }
    /** Magnifying lens over a thing showing what is inside: m.magnify(h, 'cell', { at, r }) */
    function magnify(target, inside, o = {}) {
      const r = o.r ?? 190, t0 = T(o.at), s = { k: 0 };
      const lens = mkEl('div', '', tagsL, `position:absolute;left:0;top:0;width:${2 * r}px;height:${2 * r}px;border-radius:50%;overflow:hidden;border:14px solid ${dark ? '#e8ecf5' : '#2b3040'};background:${dark ? '#1b2440' : '#f7f9ff'};box-shadow:0 20px 50px rgba(0,0,0,.3)`);
      const hold = mkEl('div', '', lens, 'position:absolute;inset:12%');
      content(inside, hold);
      const handle = mkEl('div', '', tagsL, `position:absolute;left:0;top:0;width:26px;height:${r * 0.9}px;border-radius:13px;background:${dark ? '#e8ecf5' : '#2b3040'};transform-origin:50% 0`);
      tl.fromTo(s, { k: 0 }, { k: 1, duration: 0.6, ease: 'back.out(1.7)' }, t0);
      frameFns.push(() => {
        const c = posOf(target), x = c.x + (o.dx ?? 60), y = c.y + (o.dy ?? -40), k = s.k;
        lens.style.transform = `translate(${(x - r).toFixed(1)}px,${(y - r).toFixed(1)}px) scale(${k.toFixed(3)})`; lens.style.opacity = k > 0.01 ? 1 : 0;
        handle.style.transform = `translate(${(x + r * 0.62 - 13).toFixed(1)}px,${(y + r * 0.62).toFixed(1)}px) rotate(-45deg) scale(${k.toFixed(3)})`; handle.style.opacity = k > 0.01 ? 1 : 0;
      });
      return lens;
    }
    /** Many copies fly in and crowd around a target (demand, pressure): m.swarm('coin', 14, basket, { at }) */
    function swarm(id, n, target, o = {}) {
      const t0 = T(o.at), dur = o.dur ?? 1.2;
      const items = Array.from({ length: n }, (_, i) => {
        const it = img(id, { h: o.h ?? 90, idle: 0, shadow: false }); it.st.op = 0;
        const a = i / n * 6.283 + rnd() * 0.3, from = { x: W / 2 + Math.cos(a) * 1400, y: H / 2 + Math.sin(a) * 900 }, ts = t0 + i * (o.stagger ?? 0.06), rr = o.r ?? 1;
        holdAt(it, t => {
          const k = clamp((t - ts) / dur, 0, 1), p = posOf(target), R = (radOf(target) + 70) * rr * (1 + 0.06 * Math.sin(t * 3 + i)), aa = a + t * 0.4;
          const to = { x: p.x + Math.cos(aa) * R * 1.25, y: p.y + Math.sin(aa) * R }, e = ease('power3.out', k);
          it.st.x = from.x + (to.x - from.x) * e; it.st.y = from.y + (to.y - from.y) * e; it.st.op = t >= ts ? 1 : 0; it.st.rot = Math.sin(t * 6 + i) * 12;
        });
        return it;
      });
      return group(items);
    }
    /** Concentric waves spreading from a thing (influence, news, shock). */
    function ripple() {}   // removed on purpose (see ring)
    function rippleOld(target, o = {}) {
      const t0 = T(o.at), n = o.n ?? 3, dur = o.dur ?? 2;
      const cs = Array.from({ length: n }, () => mkSvg('circle', { fill: 'none', stroke: col(o.color || 'orange'), 'stroke-width': 6, opacity: 0 }, svg));
      frameFns.push(t => cs.forEach((c, i) => { const k = (t - t0 - i * 0.35) / dur; if (k < 0 || k > 1) { c.setAttribute('opacity', 0); return; } const p = posOf(target); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', (radOf(target) + 20 + k * (o.size ?? 520)).toFixed(1)); c.setAttribute('opacity', ((1 - k) * 0.8).toFixed(3)); }));
    }
    /** A chain of transformations in one spot (seed → sprout → tree): each step morphs into the next and the earlier states shrink into a trail below. times: cue per step. */
    function morph(ids, o = {}) {
      const times = o.times || ids.map((_, i) => (o.at ?? 0) + i * (o.every ?? 1.2));
      const hh = o.h ?? 420, x = o.x ?? 960, y = o.y ?? 500, n = ids.length;
      const main = img(ids[0], { h: hh, x, y, at: times[0], in: 'pop' });
      for (let i = 1; i < n; i++) main.swap(ids[i], times[i], 'flip');
      if (o.trail !== false) ids.slice(0, -1).forEach((id, i) => img(id, { h: 110, x: x - (n - 2) * 80 + i * 160, y: 830, at: times[i + 1] + 0.2, in: 'rise', idle: 0.3 }).dim(times[i + 1] + 0.2, 0.7));
      return main;
    }

    /**
     * m.draw({ layer: 'back'|'front' }) → a vector canvas in scene coordinates (1920×1080, moves with the camera).
     * Shapes return real SVG elements: animate them with tl.to(el, { attr: {...} }), drawSVG, morphSVG, motionPath, or kit.onFrame.
     * style: { fill, stroke, width, opacity, dash, cap, at (fade in), dur, blur, glow }
     */
    let gradN = 0;
    function draw(o = {}) {
      const host = mkSvg('svg', { class: 'mg-draw', viewBox: '0 0 ' + W + ' ' + H, style: 'position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:visible;pointer-events:none' }, null);
      if (o.layer === 'back') cam.insertBefore(host, itemsL); else cam.insertBefore(host, gfxHost);
      const defs = mkSvg('defs', {}, host);
      const styleOf = (el, s = {}) => {
        const a = {};
        if (s.fill !== undefined) a.fill = s.fill; if (s.stroke !== undefined) a.stroke = s.stroke;
        if (s.width != null) a['stroke-width'] = s.width;
        if (s.opacity != null) a.opacity = s.opacity;
        if (s.dash) a['stroke-dasharray'] = s.dash;
        if (s.cap) { a['stroke-linecap'] = 'round'; a['stroke-linejoin'] = 'round'; }
        for (const k in a) el.setAttribute(k, a[k]);
        if (s.blur || s.glow) {
          const id = 'mgf' + (gradN++) + '_' + seq, f = mkSvg('filter', { id, filterUnits: 'userSpaceOnUse', x: -W, y: -H, width: 3 * W, height: 3 * H }, defs);   // user space: a straight line has a zero-height bbox
          if (s.glow) { mkSvg('feGaussianBlur', { stdDeviation: s.glow, result: 'b' }, f); const mm = mkSvg('feMerge', {}, f); mkSvg('feMergeNode', { in: 'b' }, mm); mkSvg('feMergeNode', { in: 'SourceGraphic' }, mm); }
          else mkSvg('feGaussianBlur', { stdDeviation: s.blur }, f);
          el.setAttribute('filter', 'url(#' + id + ')');
        }
        if (s.at != null) tl.fromTo(el, { opacity: 0 }, { opacity: s.opacity ?? 1, duration: s.dur ?? 0.6, ease: 'power2.out' }, T(s.at));
        return el;
      };
      const shape = (s, defaults) => ({ fill: 'none', ...defaults, ...(s || {}) });
      const make = parent => ({
        el: parent,
        circle: (cx, cy, r, s) => styleOf(mkSvg('circle', { cx, cy, r }, parent), shape(s)),
        ellipse: (cx, cy, rx, ry, s) => styleOf(mkSvg('ellipse', { cx, cy, rx, ry }, parent), shape(s)),
        rect: (x, y, w, h, s) => { if (x <= 0 && y <= 0 && x + w >= W && y + h >= H) { x = -W; y = -H; w = 3 * W; h = 3 * H; }   // a full-frame backdrop must not show its edges when the camera pulls back
          return styleOf(mkSvg('rect', { x, y, width: w, height: h, rx: (s && s.r) || 0 }, parent), shape(s)); },
        line: (x1, y1, x2, y2, s) => styleOf(mkSvg('line', { x1, y1, x2, y2 }, parent), shape(s, { stroke: '#ffffff', width: 4, cap: true })),
        path: (dd, s) => styleOf(mkSvg('path', { d: dd }, parent), shape(s)),
        poly: (pts, s) => styleOf(mkSvg(s && s.closed === false ? 'polyline' : 'polygon', { points: pts.map(p => p.join(',')).join(' ') }, parent), shape(s)),
        image: (id, x, y, w, h, s) => {
          const im = images[id];
          if (!im) warn('Hình không có: "' + id + '" — chỉ dùng id trong danh sách hình của video');
          const e = mkSvg('image', { href: im ? im.url : '', x, y, width: w, height: h, preserveAspectRatio: 'xMidYMid meet' }, parent);
          if (im) rt?.pending?.push(new Promise(r => { const i2 = new Image(); i2.onload = i2.onerror = r; i2.src = im.url; }));
          return styleOf(e, s || {});
        },
        group: s => make(styleOf(mkSvg('g', {}, parent), s || {})),
        /** gradient for fill/stroke: d.grad(['#7fd3ff', '#0b3d91'], { type: 'radial' }) — a stop may be [color, opacity] */
        grad: (stops, gs = {}) => {
          const id = 'mgg' + (gradN++) + '_' + seq, ang = (gs.angle ?? 90) * Math.PI / 180;
          const g = gs.type === 'radial' ? mkSvg('radialGradient', { id, cx: gs.cx ?? '50%', cy: gs.cy ?? '50%', r: gs.r ?? '50%' }, defs)
            : mkSvg('linearGradient', { id, x1: Math.round(50 - 50 * Math.cos(ang)) + '%', y1: Math.round(50 - 50 * Math.sin(ang)) + '%', x2: Math.round(50 + 50 * Math.cos(ang)) + '%', y2: Math.round(50 + 50 * Math.sin(ang)) + '%' }, defs);
          stops.forEach((c, i) => { const [color, op] = Array.isArray(c) ? c : [c, 1]; mkSvg('stop', { offset: (i / Math.max(1, stops.length - 1)) * 100 + '%', 'stop-color': col(color), 'stop-opacity': op }, g); });
          return 'url(#' + id + ')';
        },
        /** an anchor for m.label / m.number / m.fx: d.anchor(x, y, r) or d.anchor(svgElement) */
        anchor: (x, y, r = 80) => (typeof x === 'object'
          ? { center: () => { const b = x.getBBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, radius: () => { const b = x.getBBox(); return Math.max(b.width, b.height) / 2; } }
          : { center: () => ({ x, y }), radius: () => r }),
      });
      return make(host);
    }

    const api = { draw, img, hero, row, count, pair, orbit, flow, cycle, scale, balance, stack, stacks, pour, dissolve, reveal, magnify, swarm, ripple, morph, arrow, line, label, ring, strike, text, number, travel, fx, zoomTo, zoomOut, pan, shot, spot, dark, area: AREA, items: all };
    return api;
  }

  window.MG = { create: createMG, extend(kit, ctx) { kit.mg = (opts) => createMG(kit, ctx, opts); } };
})();
