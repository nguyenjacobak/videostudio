/* Illustrated-world toolkit on top of cartoon.js: ambient life for environments, objects placed INSIDE the world
 * (depth → size/parallax/ground line), motion verbs, particle effects, attached labels, crowds and camera moves.
 * Everything is a pure function of time: state lives in plain objects tweened on the scene timeline and is drawn
 * in onFrame(t), so frames export exactly. */
(function () {
  const C = window.Cartoon;
  if (!C) return;
  const { World, mk, mulberry } = C;
  const W = 1920, H = 1080;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FONT = "'Be Vietnam Pro', sans-serif";

  // ───────────────────────── ambient driver ─────────────────────────
  // Environments tag living parts with data-amb="type" (+ data-s speed, data-a amplitude, data-p phase,
  // data-cx/cy pivot, data-x0/x1 range, data-y, data-h height, data-lo/hi opacity). The tagged <g> carries no
  // transform of its own — its children are positioned inside it.
  const AMB = {
    drift: d => (e, t) => e.setAttribute('transform', `translate(${(t * (+d.s || 6)).toFixed(1)},0)`),
    bob: d => (e, t) => e.setAttribute('transform', `translate(0,${(Math.sin(t * (+d.s || 1.2) + (+d.p || 0)) * (+d.a || 6)).toFixed(2)})`),
    wave: d => (e, t) => e.setAttribute('transform', `translate(${(Math.sin(t * (+d.s || 0.8) + (+d.p || 0)) * (+d.a || 20)).toFixed(2)},0)`),
    sway: d => (e, t) => e.setAttribute('transform', `rotate(${(Math.sin(t * (+d.s || 1) + (+d.p || 0)) * (+d.a || 4)).toFixed(2)} ${d.cx || 0} ${d.cy || 0})`),
    spin: d => (e, t) => e.setAttribute('transform', `rotate(${(t * (+d.s || 30) + (+d.p || 0)).toFixed(1)} ${d.cx || 0} ${d.cy || 0})`),
    move: d => {
      const x0 = +d.x0, x1 = +d.x1, s = +d.s || 200, span = Math.abs(x1 - x0), ph = +d.p || 0;
      return (e, t) => { const k = (((t * Math.abs(s) + ph) % span) + span) % span; e.setAttribute('transform', `translate(${(s > 0 ? x0 + k : x1 - k).toFixed(1)},${d.y || 0})`); };
    },
    rise: d => {
      const h = +d.h || 300, s = +d.s || 60, ph = +d.p || 0, a = +d.a || 10;
      return (e, t) => { const k = ((t * s + ph) % h) / h; e.setAttribute('transform', `translate(${(Math.sin(t * 2 + ph) * a).toFixed(1)},${(-k * h).toFixed(1)})`); e.setAttribute('opacity', (Math.min(1, k * 6) * (1 - k)).toFixed(3)); };
    },
    fall: d => {
      const h = +d.h || 1200, s = +d.s || 120, ph = +d.p || 0, a = +d.a || 20;
      return (e, t) => { const k = ((t * s + ph) % h); e.setAttribute('transform', `translate(${(Math.sin(t * 1.3 + ph) * a).toFixed(1)},${k.toFixed(1)})`); };
    },
    twinkle: d => (e, t) => e.setAttribute('opacity', ((+d.lo || 0.25) + ((+d.hi || 1) - (+d.lo || 0.25)) * (0.5 + 0.5 * Math.sin(t * (+d.s || 2) + (+d.p || 0)))).toFixed(3)),
    pulse: d => (e, t) => e.setAttribute('opacity', ((+d.lo || 0.4) + ((+d.hi || 1) - (+d.lo || 0.4)) * (0.5 + 0.5 * Math.sin(t * (+d.s || 1.5) + (+d.p || 0)))).toFixed(3)),
    flow: d => (e, t) => e.setAttribute('stroke-dashoffset', (-t * (+d.s || 40)).toFixed(1)),
    breathe: d => (e, t) => { const k = 1 + Math.sin(t * (+d.s || 1) + (+d.p || 0)) * (+d.a || 0.03); e.setAttribute('transform', `translate(${d.cx || 0},${d.cy || 0}) scale(${k.toFixed(4)}) translate(${-(d.cx || 0)},${-(d.cy || 0)})`); },
  };
  C.AMB = AMB;
  function animateAmbient(roots, frameFns) {
    const items = [];
    for (const r of roots) r.querySelectorAll('[data-amb]').forEach(e => { const f = AMB[e.dataset.amb]; if (f) items.push([e, f(e.dataset)]); });
    if (items.length) frameFns.push(t => { for (const [e, f] of items) f(e, t); });
  }
  C.onWorld.push((w, ctx) => {
    animateAmbient([w.set, w.frontSvg], ctx.frameFns);
    w._ctx = ctx;
  });
  C.animateAmbient = animateAmbient;

  // ───────────────────────── objects inside the world ─────────────────────────
  const objKey = n => { const G = window.Gfx; if (!G) return null; return G.OBJ[n] ? n : G.ALIAS?.[n] && G.OBJ[G.ALIAS[n]] ? G.ALIAS[n] : null; };
  const palOf = c => (window.Gfx?.pal ? window.Gfx.pal(c) : c);

  /** Insert a parallax group into the set so it sits behind every env layer that is nearer than it. */
  function insertByParallax(w, node, f) {
    const kids = [...w.set.children].filter(k => k.classList?.contains('k-layer') || k.classList?.contains('k-obj'));
    // ground planes (data-under) stay beneath everything standing on them, whatever their parallax
    const after = kids.find(k => (k.classList.contains('k-layer') ? (k.dataset.under ? -1 : +k.dataset.depth) : +k.dataset.par) > f);
    if (after) w.set.insertBefore(node, after); else w.set.appendChild(node);
  }

  World.prototype.layerFor = function (depth = 0, front = false) {
    const f = this.parallax(depth);
    const par = mk('g', { class: 'k-obj', 'data-par': f });
    if (front) this.frontSvg.appendChild(par); else insertByParallax(this, par, f);
    this.objList.push({ par, f });
    return { par, f };
  };

  // Flat pictograms of people clash with the rigged characters — people are always w.character / w.crowd.
  const HUMAN_ICONS = new Set(['person', 'people', 'family', 'worker', 'farmer', 'doctor', 'scientist', 'student', 'elderly', 'baby', 'crowd', 'politician', 'soldier', 'police', 'teacher', 'astronaut']);
  let glowSeq = 0;
  // Worlds where things drift freely, and things that really do fly/hang — everything else must rest on something.
  const FREE_ENVS = new Set(['space', 'orbit', 'earth', 'underwater', 'bloodstream', 'cell', 'molecules', 'abstract', 'digital']);
  const FLYERS = new Set(['plane', 'bird', 'drone', 'rocket', 'satellite', 'space-station', 'satellite-dish', 'helicopter', 'balloon', 'cloud', 'rain-cloud', 'sun', 'sun-real', 'moon', 'star', 'planet', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'comet', 'asteroid', 'meteor', 'galaxy', 'black-hole', 'parachute', 'butterfly', 'bee', 'dove', 'leaf', 'snowflake', 'lightning', 'tornado', 'price-tag', 'lantern', 'banner', 'wifi', 'bubble', 'fire']);
  // Real-world height of things relative to a standing adult (1.0): objects come out believable next to people by default.
  const H_REL = {};
  const sizeClass = (h, names) => names.split(' ').forEach(n => { H_REL[n] = h; });
  sizeClass(0.13, 'coin ancient-coin gold-ring key house-key usb pill chip ice-cube water-drop bug bee snowflake tooth fingerprint');
  sizeClass(0.22, 'coins banknote cash wallet credit-card phone document calendar receipt tax envelope newspaper book scroll quill calculator price-tag tablet lightbulb battery magnifier thermometer flask test-tube beaker syringe compass gavel camera microphone headphones gamepad vr-headset qr-code bread pho coffee rice-bowl water-bottle gold-bar gold-bars money-bag shopping-bag briefcase lock clock hourglass trophy crown sprout flower mushroom leaf heart lungs brain eye bone egg fish conical-hat roman-helmet lantern bitcoin dollar euro yuan like play wifi router candles stethoscope petri-dish for-sale megaphone');
  sizeClass(0.36, 'box basket sack coconut laptop monitor microscope pillow piggy-bank chicken vegetables globe magnet ballot-box knight-shield bronze-drum dove bird drone torch sword bow cart');
  sizeClass(0.5, 'oil-barrel safe war-drum server telescope cactus podium cannon solar-panel satellite-dish');
  sizeClass(0.45, 'table');
  sizeClass(0.7, 'bicycle motorbike stakes catapult');
  sizeClass(0.85, 'atm gas-pump cow buffalo robot charging-station car electric-car spear');
  sizeClass(1.0, 'ancient-soldier general');
  sizeClass(1.15, 'horse tent');
  sizeClass(1.5, 'truck tank flag banner cloud-server');
  sizeClass(2.2, 'tree train sampan war-elephant container');
  sizeClass(3, 'house shop thatched-house bank warehouse galleon war-boat ship plane wind-turbine tower oil-rig');
  sizeClass(4, 'apartment factory power-plant nuclear citadel castle pagoda one-pillar-pagoda greek-temple colosseum torii parliament pyramid eiffel great-wall bridge dam');
  const relHeight = key => H_REL[key] ?? 0.5;
  /** On-screen height of a standing adult at this depth. */
  World.prototype.personH = function (depth = 0) { return 446 * (this.actorScale ?? 1) * (1 - clamp(depth, 0, 1) * 0.45); };
  const measure = g => { try { const b = g.getBBox(); if (b.width > 0 && b.height > 0) return { x: b.x, y: b.y, width: b.width, height: b.height }; } catch { /* not rendered */ } return { x: -100, y: -100, width: 200, height: 200 }; };

  World.prototype.place = function (name, o = {}) {
    const w = this, key = objKey(name);
    if (!key) window.__rt?.warn?.(`Vật thể không có: "${name}" — xem danh sách vật thể`);
    else if (HUMAN_ICONS.has(key)) window.__rt?.warn?.(`Vật thể hình người "${name}" không hợp phong cách — người phải dựng bằng w.character(...) hoặc w.crowd(...)`);
    const support = o.on && typeof o.on.top === 'function' ? o.on : null;
    const depth = clamp(o.depth ?? support?.depth ?? 0, 0, 0.98);
    const lane = o.lane && w.lanes[o.lane];
    const grounded = (o.y == null || !!support) && !(lane && lane.air);
    const y0 = support ? support.top().y + 4 : o.y ?? (lane ? lane.y : w.groundAt(depth));
    const { par, f } = support ? { par: support.el.parentNode, f: support.f } : w.layerFor(lane?.depth ?? depth, o.front);
    const pos = mk('g', { class: `k-thing k-thing-${key || 'missing'}` }, par);
    if (o.group) pos.dataset.grp = o.group;
    const restY = support ? y0 : lane ? lane.y : w.groundAt(depth);
    if (!FREE_ENVS.has(w.name) && !(lane && lane.air) && !FLYERS.has(key)) pos.dataset.gy = Math.round(restY);
    const body = mk('g', {}, pos);
    const art = mk('g', {}, body);
    art.innerHTML = key ? window.Gfx.OBJ[key]({ ...o, color: palOf(o.color) }) : `<circle r="70" fill="#aab"/>`;
    // Size from the drawing's real extent: a believable height next to people unless asked otherwise; explicit sizes
    // can't make everyday things giant/tiny beside people (close-ups are camera moves); huge things stay in frame.
    const bb = measure(art);
    const free = FREE_ENVS.has(w.name) || !!(lane && lane.air);
    const want = relHeight(key) * w.personH(lane?.depth ?? depth);
    let size = o.size ? o.size : want * 200 / bb.height;
    if (o.size && !o.exactSize && !free && key) { const r = (bb.height / 200 * size) / want; size *= clamp(r, 0.5, 2.2) / r; }
    size *= Math.min(1, (free ? 900 : Math.max(160, y0 - 70)) / (bb.height / 200 * size), 1700 / (bb.width / 200 * size));
    size = Math.round(size);
    const kk = size / 200, hDrawn = bb.height * kk;
    // rest the drawing's real bottom on the ground (or centre it on y when it floats)
    const offY = b => (grounded ? -(b.y + b.height) : -(b.y + b.height / 2));
    const oy = offY(bb);
    art.setAttribute('transform', `scale(${kk}) translate(0,${oy.toFixed(2)})`);
    if (grounded && o.shadow !== false) body.insertBefore(mk('ellipse', { cx: ((bb.x + bb.width / 2) * kk).toFixed(1), cy: 2, rx: (bb.width * kk * 0.42).toFixed(1), ry: Math.max(4, bb.width * kk * 0.06).toFixed(1), fill: 'rgba(30,25,20,.18)' }, body), art);
    if (window.Gfx?.animateParts) window.Gfx.animateParts(w._ctx.frameFns, art, o.x || 0);
    const st = { x: o.x ?? support?.x ?? 960, y: y0, rot: o.rot || 0, s: 1, op: 1, flip: o.flip ? -1 : 1, bx: 0, by: 0 };
    const box = () => bb;
    const cxOff = (bb.x + bb.width / 2) * kk, hw0 = bb.width / 2 * kk;
    const home = [st.x + cxOff - hw0, y0 + (bb.y + oy) * kk, st.x + cxOff + hw0, y0 + (bb.y + bb.height + oy) * kk];
    const pivot = grounded ? -hDrawn * 0.5 : 0;
    const at2 = (ox, oyObj) => ({ x: st.x + st.bx + ox * kk * st.s * st.flip, y: st.y + st.by + ((oyObj + oy) * kk - pivot) * st.s + pivot });
    const T = at => w.clampT(at ?? 0);
    const tl = w.tl;
    const motions = [];   // continuous motions: (t) => {dx, dy, rot}
    const h = {
      el: pos, st, size, depth, f, name: key,
      get x() { return st.x; }, get y() { return st.y; },
      /** Visual centre (for labels, camera focus, emitters). */
      center() { const b = box(); return { ...at2(b.x + b.width / 2, b.y + b.height / 2), f }; },
      top() { const b = box(); return { ...at2(b.x + b.width / 2, b.y), f }; },
      halfWidth() { return box().width / 2 * kk * st.s; },
      moveTo(x, y, at, dur = 1.2, ease = 'power2.inOut') { const to = {}; if (x != null) to.x = x; if (y != null) to.y = y; tl.to(st, { ...to, duration: dur, ease }, T(at)); return h; },
      moveBy(dx = 0, dy = 0, at, dur = 1, ease = 'power2.inOut') { tl.to(st, { x: `+=${dx}`, y: `+=${dy}`, duration: dur, ease }, T(at)); return h; },
      /** Drive/sail along the ground to x (faces the travel direction, bounces a little). */
      drive(x, at, dur = 2, o2 = {}) {
        const t0 = T(at), from = h._plannedX ?? st.x, dir = x >= from ? 1 : -1;
        if (o2.face !== false) tl.set(st, { flip: dir * (o.flip ? -1 : 1) * (o2.reverse ? -1 : 1) }, t0);
        tl.to(st, { x, duration: dur, ease: o2.ease || 'power1.inOut' }, t0);
        motions.push(t => (t >= t0 && t <= t0 + dur ? { dy: -Math.abs(Math.sin(t * (o2.bounce ?? 11))) * 3 } : null));
        h._plannedX = x;
        return h;
      },
      /** Fly through points [[x,y],...] (smooth curve); orient: tilt along the path. */
      fly(points, at, dur = 2, o2 = {}) {
        const t0 = T(at), pts = [[h._plannedX ?? st.x, h._plannedY ?? st.y], ...points], prog = { k: 0 };
        tl.to(prog, { k: 1, duration: dur, ease: o2.ease || 'power1.inOut' }, t0);
        const cr = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u; return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); };
        const at2 = k => { const n = pts.length - 1, seg = Math.min(n - 1, Math.floor(k * n)), u = k * n - seg; const P = i => pts[clamp(i, 0, n)]; return [cr(P(seg - 1)[0], P(seg)[0], P(seg + 1)[0], P(seg + 2)[0], u), cr(P(seg - 1)[1], P(seg)[1], P(seg + 1)[1], P(seg + 2)[1], u)]; };
        motions.push(t => {
          if (t < t0) return null;
          const k = prog.k, [x, y] = at2(Math.min(1, k));
          st.x = x; st.y = y;
          if (o2.orient) { const [x2, y2] = at2(Math.min(1, k + 0.01)); return { rot: Math.atan2(y2 - y, x2 - x) * 180 / Math.PI + (o2.orient === 'up' ? 90 : 0) }; }
          return null;
        });
        const last = points[points.length - 1]; h._plannedX = last[0]; h._plannedY = last[1];
        return h;
      },
      /** Endless orbit around (cx, cy) — moons, satellites, electrons. period in seconds. */
      orbit(o2 = {}) {
        const cx = o2.cx ?? 960, cy = o2.cy ?? 540, rx = o2.r ?? 300, ry = o2.ry ?? rx * 0.35, per = o2.period ?? 6, a0 = o2.from ?? 0;
        motions.push(t => { const a = a0 + (t / per) * Math.PI * 2 * (o2.reverse ? -1 : 1); st.x = cx + Math.cos(a) * rx; st.y = cy + Math.sin(a) * ry; return o2.depthScale ? { s: 0.85 + 0.15 * Math.sin(a) } : null; });
        return h;
      },
      float(amp = 10, period = 3) { const ph = (st.x % 97) / 10; motions.push(t => ({ dy: Math.sin(t / period * Math.PI * 2 + ph) * amp, rot: Math.sin(t / period * Math.PI + ph) * amp * 0.15 })); return h; },
      spin(at, turns = 1, dur = 1) { tl.to(st, { rot: `+=${360 * turns}`, duration: dur, ease: 'power2.inOut' }, T(at)); return h; },
      /** Constant rotation (deg/s) from `at` — wheels, turbines, planets. */
      rotate(speed = 30, at = 0) { const t0 = T(at); motions.push(t => (t >= t0 ? { rot: (t - t0) * speed } : null)); return h; },
      tilt(deg, at, dur = 0.6) { tl.to(st, { rot: deg, duration: dur, ease: 'power2.out' }, T(at)); return h; },
      scaleTo(k, at, dur = 0.8, ease = 'power2.inOut') { tl.to(st, { s: k, duration: dur, ease }, T(at)); return h; },
      grow(at, k = 1.35, dur = 0.8) { tl.to(st, { s: k, duration: dur, ease: 'back.out(1.6)' }, T(at)); return h; },
      shrink(at, k = 0.6, dur = 0.8) { tl.to(st, { s: k, duration: dur, ease: 'power2.inOut' }, T(at)); return h; },
      pulse(at, k = 1.15) { tl.to(st, { s: k, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, T(at)); return h; },
      shake(at, dur = 0.6, amp = 6) { const t0 = T(at); motions.push(t => (t >= t0 && t <= t0 + dur ? { rot: Math.sin(t * 60) * amp * (1 - (t - t0) / dur) } : null)); return h; },
      hide(at, dur = 0.4) { tl.to(st, { op: 0, s: 0.6, duration: dur, ease: 'power2.in' }, T(at)); return h; },
      fadeTo(op, at, dur = 0.5) { tl.to(st, { op, duration: dur }, T(at)); return h; },
      show(at, dur = 0.4) { tl.to(st, { op: 1, duration: dur }, T(at)); return h; },
      /** Cross-fade into another drawing in place (price tag changes, a star becomes a black hole...). */
      swap(other, at, o2 = {}) {
        const k2 = objKey(other);
        if (!k2) { window.__rt?.warn?.(`Vật thể không có: "${other}"`); return h; }
        const art2 = mk('g', { opacity: 0 }, body);
        art2.innerHTML = window.Gfx.OBJ[k2]({ ...o, ...o2, color: palOf(o2.color ?? o.color) });
        const b2 = measure(art2), k2s = (o2.size ? o2.size : hDrawn * 200 / b2.height) / 200;
        art2.setAttribute('transform', `scale(${k2s}) translate(0,${offY(b2).toFixed(2)})`);
        const t0 = T(at);
        tl.to(art, { opacity: 0, duration: 0.35 }, t0); tl.to(art2, { opacity: 1, duration: 0.35 }, t0);
        tl.to(st, { s: 1.12, duration: 0.17, yoyo: true, repeat: 1 }, t0);
        return h;
      },
      /** Soft glow behind the object (energy, heat, importance). */
      glow(color = '#ffd36b', at = 0, o2 = {}) {
        const gid = `k-glow-${++glowSeq}`, defs = w.set.querySelector('defs');
        if (defs) defs.insertAdjacentHTML('beforeend', `<radialGradient id="${gid}"><stop offset="0" stop-color="${palOf(color)}" stop-opacity="1"/><stop offset=".45" stop-color="${palOf(color)}" stop-opacity=".5"/><stop offset="1" stop-color="${palOf(color)}" stop-opacity="0"/></radialGradient>`);
        const cyG = (bb.y + bb.height / 2 + oy) * kk, rG = Math.max(bb.width, bb.height) * kk * (o2.r ?? 0.75);
        const g = mk('circle', { cx: 0, cy: cyG, r: rG, fill: defs ? `url(#${gid})` : palOf(color), opacity: 0 }, body);
        body.insertBefore(g, body.firstChild);
        tl.to(g, { opacity: o2.opacity ?? 0.7, duration: 0.6 }, T(at));
        w._ctx.frameFns.push(t => g.setAttribute('r', (rG * (1 + Math.sin(t * 2.4) * 0.05)).toFixed(1)));
        return h;
      },
      emit(type, o2 = {}) { const c = o2.from === 'center' ? h.center() : o2.from === 'bottom' ? { x: st.x, y: st.y + (grounded ? 0 : hDrawn * 0.5 * st.s) } : h.top(); w.fx(type, { ...o2, x: c.x, y: c.y, depth, follow: o2.follow === false ? null : h }); return h; },
      label(text, at, o2 = {}) { w.label(h, text, { ...o2, at }); return h; },
      /** [x0, y0, x1, y1] where it was placed — for auto-framing (fixed at creation, independent of time). */
      home,
    };
    // appear
    const anim = o.anim || (o.at != null ? 'pop' : 'none');
    if (anim !== 'none') {
      const t0 = T(o.at);
      if (anim === 'pop') tl.fromTo(st, { s: 0.15, op: 0 }, { s: 1, op: 1, duration: 0.6, ease: 'back.out(2)' }, t0);
      else if (anim === 'grow') tl.fromTo(st, { s: 0, op: 1 }, { s: 1, op: 1, duration: 0.9, ease: 'power2.out' }, t0);
      else if (anim === 'fade') tl.fromTo(st, { op: 0 }, { op: 1, duration: 0.6 }, t0);
      else if (anim === 'rise') tl.fromTo(st, { by: 90, op: 0 }, { by: 0, op: 1, duration: 0.7, ease: 'power3.out' }, t0);
      else if (anim === 'drop') tl.fromTo(st, { by: -520, op: 1 }, { by: 0, op: 1, duration: 0.9, ease: 'bounce.out' }, t0);
      else if (anim === 'slide-left') tl.fromTo(st, { bx: -900, op: 1 }, { bx: 0, op: 1, duration: 1, ease: 'power3.out' }, t0);
      else if (anim === 'slide-right') tl.fromTo(st, { bx: 900, op: 1 }, { bx: 0, op: 1, duration: 1, ease: 'power3.out' }, t0);
    }
    (w.things ||= []).push(h);
    h.big = hDrawn > 620;   // buildings & ships are scenery for framing purposes
    if (o.float) h.float(typeof o.float === 'number' ? o.float : 10);
    if (o.spin) h.rotate(o.spin);
    w._ctx.frameFns.push(t => {
      let dx = 0, dy = 0, rot = 0, s = 1;
      for (const m of motions) { const r = m(t); if (r) { dx += r.dx || 0; dy += r.dy || 0; rot += r.rot || 0; if (r.s) s *= r.s; } }
      pos.setAttribute('transform', `translate(${(st.x + st.bx + dx).toFixed(1)},${(st.y + st.by + dy).toFixed(1)})`);
      body.setAttribute('transform', `translate(0,${pivot}) rotate(${(st.rot + rot).toFixed(2)}) scale(${(st.s * s * st.flip).toFixed(4)},${(st.s * s).toFixed(4)}) translate(0,${-pivot})`);
      pos.setAttribute('opacity', clamp(st.op, 0, 1).toFixed(3));
      if (pos.dataset.gy) pos.dataset.by = Math.round(st.y + st.by + dy + (grounded ? 0 : hDrawn * 0.5 * st.s * s));
    });
    return h;
  };

  /**
   * Main subject(s) of a shot, laid out for the viewer: real-world size, a neat countable row (two rows when many),
   * optionally on a table sized to fit. Returns an array of things with center()/top()/halfWidth() for focus & labels.
   * w.subject('coconut', { count: 10, side: 'left'|'right'|'center', on: 'ground'|'table'|<thing>, depth, at, stagger, scale, anim })
   */
  World.prototype.subject = function (name, o = {}) {
    const w = this, key = objKey(name), n = clamp(Math.round(o.count || 1), 1, 30);
    const depth = o.depth ?? 0.06;
    const cx = o.x ?? ({ left: 520, right: 1400, center: 960 }[o.side] ?? 960);
    // proportions of one drawing
    const probe = mk('g', { opacity: 0 }, w.set);
    probe.innerHTML = key ? window.Gfx.OBJ[key]({ ...o, color: palOf(o.color) }) : '<circle r="70"/>';
    const pb = measure(probe); probe.remove();
    const onTable = o.on === 'table';
    const support = o.on && typeof o.on.top === 'function' ? o.on : null;
    let itemH = relHeight(key) * w.personH(depth) * (o.scale ?? 1);
    let itemW = itemH * pb.width / pb.height;
    const perRow = o.perRow || (onTable || support ? n : n <= 7 ? n : Math.ceil(n / 2));
    const rows = Math.ceil(n / perRow);
    const maxW = onTable ? 1100 : support ? support.halfWidth() * 1.8 : 1400;
    let gap = itemW * 0.2, rowW = perRow * itemW + (perRow - 1) * gap;
    if (rowW > maxW) { const k = maxW / rowW; itemH *= k; itemW *= k; gap *= k; rowW = maxW; }
    let table = null;
    if (onTable) {
      const tH = 0.45 * w.personH(depth);
      table = w.place('table', { x: cx, depth, size: tH * 200 / 106, w: Math.max(200, (rowW + itemW * 0.8) / (tH / 106)), at: o.at != null ? Math.max(0, o.at - 0.3) : undefined, anim: o.at != null ? 'fade' : undefined });
    }
    const things = [], grp = `g${++glowSeq}`;
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / perRow), c = i % perRow, inRow = Math.min(perRow, n - r * perRow);
      const rw = inRow * itemW + (inRow - 1) * gap;
      const x = cx - rw / 2 + itemW / 2 + c * (itemW + gap) + (r % 2 ? itemW * 0.3 : 0);
      const at = o.at != null ? o.at + i * (o.stagger ?? Math.min(0.18, 1.6 / n)) : undefined;
      things.push(w.place(name, { group: grp, ...o, x, depth: depth + r * 0.05, on: table || support || undefined, size: itemH * 200 / pb.height, exactSize: true, at, anim: o.anim || (at != null ? 'pop' : 'none'), count: undefined }));
    }
    const pts = () => things.map(t => t.center());
    things.table = table;
    things.center = () => { const p = pts(); return { x: p.reduce((a, q) => a + q.x, 0) / p.length, y: p.reduce((a, q) => a + q.y, 0) / p.length, f: p[0].f }; };
    things.top = () => { const c = things.center(); return { x: c.x, y: Math.min(...things.map(t => t.top().y)), f: c.f }; };
    things.halfWidth = () => rowW / 2;
    things.size = itemH;
    return things;
  };

  /** Frame the shot on its main people + things: zoom so they fill the frame comfortably (1–1.6×), centred. */
  World.prototype.computeAutoFrame = function () {
    // diagrams/charts (kit.gfx) are laid out for the full frame — never crop them
    if (this.el.querySelector('.k-gfx g, .k-chart, .k-map')) return null;
    const boxes = [];
    for (const c of this.chars) {
      if (c.root.classList.contains('k-extra')) continue;
      const s = c.base.scale, x = c._plannedX ?? c.x0, gy = c.base.groundY;
      if (x < -60 || x > W + 60) continue;
      boxes.push([x - 120 * s, gy - 480 * s, x + 120 * s, gy]);
    }
    for (const t of this.things || []) if (!t.big && t.home) boxes.push(t.home);
    if (!boxes.length) return null;
    const x0 = Math.min(...boxes.map(b => b[0])) - 70, y0 = Math.min(...boxes.map(b => b[1])) - 80;
    const x1 = Math.max(...boxes.map(b => b[2])) + 70, y1 = Math.max(...boxes.map(b => b[3])) + 40;
    // biggest zoom (≤ 1.6) whose clamped zoom centre still keeps the whole box inside the frame, above the captions
    const fits = (z, px, py) => [[x0, y0], [x1, y1]].every(([x, y]) => { const X = px + (x - px) * z, Y = py + (y - py) * z; return X >= 30 && X <= W - 30 && Y >= 30 && Y <= H - 185; });
    for (let z = clamp(Math.min(W * 0.92 / (x1 - x0), (H - 220) / (y1 - y0)), 1, 1.6); z >= 1.06; z -= 0.04) {
      const px = clamp((W / 2 - (x0 + x1) / 2 * z) / (1 - z), 0, W), py = clamp((H * 0.44 - (y0 + y1) / 2 * z) / (1 - z), 0, H);
      if (fits(z, px, py)) return { z, px, py };
    }
    return null;
  };

  // ───────────────────────── labels & numbers ─────────────────────────
  /** Small tag pointing at an object / character / point: w.label(target, 'Lãi suất', { at, side: 'top'|'left'|'right' }). */
  World.prototype.label = function (target, text, o = {}) {
    const w = this, t0 = w.clampT(o.at ?? 0), t1 = o.dur ? t0 + o.dur : 1e9;
    const fs = o.size || 30, padX = fs * 0.6, wd = String(text).length * fs * 0.56 + padX * 2, ht = fs * 1.6;
    const dark = o.dark ?? !w.dark;
    const g = mk('g', { class: 'k-tag', opacity: 0 }, w.actors);
    const line = mk('path', { fill: 'none', stroke: dark ? '#2b2118' : '#ffffff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.85 }, g);
    const dot = mk('circle', { r: 6, fill: dark ? '#2b2118' : '#ffffff' }, g);
    const box = mk('g', {}, g);
    mk('rect', { x: -wd / 2, y: -ht / 2, width: wd, height: ht, rx: ht / 2, fill: dark ? '#2b2118' : '#ffffff', opacity: 0.92 }, box);
    const tx = mk('text', { x: 0, y: fs * 0.36, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 800, fill: dark ? '#ffffff' : '#1d2433', 'font-family': FONT }, box);
    tx.textContent = text;
    const where = () => {
      if (target?.center) { const c = target.center(), tp = target.top(); return { x: c.x, y: c.y, top: tp.y, f: c.f ?? 1, r: target.halfWidth ? target.halfWidth() : target.size ? target.size * 0.45 : 80 }; }
      if (target?.p && target.base) { const s = target.base.scale; return { x: target.p.x, y: target.base.groundY - 260 * s + target.p.dy, top: target.base.groundY - 500 * s + target.p.dy, f: target.f ?? 1, r: 90 * s }; }
      return { x: target?.x ?? 960, y: target?.y ?? 540, top: (target?.y ?? 540) - 20, f: target?.f ?? 1, r: 20 };
    };
    const side = o.side || 'top';
    w._ctx.frameFns.push(t => {
      const on = t >= t0 && t <= t1;
      g.setAttribute('opacity', on ? Math.min(1, (t - t0) / 0.25, (t1 - t) / 0.2).toFixed(3) : 0);
      if (!on) return;
      const c = where(), cam = w.cam, k = 1 - c.f;   // the actors layer pans fully; compensate for the target's parallax
      const ax = c.x + cam.x * k, ay = (side === 'top' ? c.top : c.y) + cam.y * k;
      let bx = ax, by = ay - 70;
      if (side === 'left') { bx = ax - c.r - wd / 2 - 40; by = c.y + cam.y * k; } else if (side === 'right') { bx = ax + c.r + wd / 2 + 40; by = c.y + cam.y * k; }
      bx = clamp(bx, 120 + wd / 2, 1800 - wd / 2); by = clamp(by, 90, 860);
      box.setAttribute('transform', `translate(${bx.toFixed(1)},${by.toFixed(1)})`);
      dot.setAttribute('cx', ax.toFixed(1)); dot.setAttribute('cy', ay.toFixed(1));
      const ex = side === 'top' ? bx : side === 'left' ? bx + wd / 2 : bx - wd / 2, ey = side === 'top' ? by + ht / 2 : by;
      line.setAttribute('d', `M${ax.toFixed(1)},${ay.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`);
    });
    return g;
  };

  /** Big number / short word in the shot (count-up supported). */
  World.prototype.number = function (text, o = {}) {
    const g = this.kit?.gfx;
    if (!g) return null;
    return g.big(String(text), { at: o.at, x: o.x, y: o.y, size: o.size || 130, color: o.color, countTo: o.countTo, countFrom: o.countFrom, prefix: o.prefix, suffix: o.suffix, decimals: o.decimals });
  };

  // ───────────────────────── camera ─────────────────────────
  const posOf = t => (t?.center ? t.center() : t?.p && t.base ? { x: t.p.x, y: t.base.groundY - 260 * t.base.scale + t.p.dy, f: 1 } : { x: t?.x ?? 960, y: t?.y ?? 540, f: 1 });
  /** Push the camera in on a target (object / character / {x, y}). */
  World.prototype.focus = function (target, o = {}) {
    const t0 = this.clampT(o.at ?? 0), dur = o.dur ?? 1.4, c = posOf(target);
    const fx = clamp(c.x, 200, 1720), camX = (c.x - 960) * (o.center ?? 0.3);
    // never push the main characters out of frame: back the zoom off until they all stay in shot
    let zoom = o.zoom ?? 1.35;
    if (o.keep !== false) for (const ch of this.chars) {
      if (ch.root.classList.contains('k-extra') || ch === target) continue;
      const x = ch._plannedX ?? ch.p.x;
      if (x < 0 || x > W) continue;
      while (zoom > 1.02) { const sx = fx + (x - camX - fx) * zoom; if (sx >= 90 && sx <= W - 90) break; zoom -= 0.05; }
    }
    this.tl.set(this.cam, { fx, fy: clamp(c.y, 160, 900) }, t0);
    this.tl.to(this.cam, { zoom, x: camX, y: (c.y - 540) * (o.center ?? 0.3) * 0.5, duration: dur, ease: o.ease || 'power2.inOut' }, t0);
    return this;
  };
  World.prototype.pan = function (x, at = 0, dur = 2, o = {}) { this.camManual = true; this.tl.to(this.cam, { x, y: o.y ?? this.cam.y, duration: dur, ease: o.ease || 'power1.inOut' }, this.clampT(at)); return this; };
  World.prototype.zoomTo = function (zoom, at = 0, dur = 1.2, o = {}) { this.camManual = true; const t0 = this.clampT(at); if (o.fx != null || o.fy != null) this.tl.set(this.cam, { fx: o.fx ?? 960, fy: o.fy ?? 540 }, t0); this.tl.to(this.cam, { zoom, duration: dur, ease: o.ease || 'power2.inOut' }, t0); return this; };
  World.prototype.shake = function (at = 0, dur = 0.6, amp = 14) { this.shakes.push({ t: this.clampT(at), dur, amp }); return this; };

  // ───────────────────────── places ─────────────────────────
  World.prototype.spot = function (name) {
    const s = this.spots[name];
    if (!s) { window.__rt?.warn?.(`Bối cảnh "${this.name}" không có vị trí "${name}" — có: ${Object.keys(this.spots).join(', ') || '(không)'}`); return { x: 960, y: this.ground, depth: 0 }; }
    return { depth: 0, ...s, y: s.y ?? this.groundAt(s.depth || 0) };
  };
  World.prototype.lane = function (name) { return this.lanes[name] || null; };

  // ───────────────────────── crowds ─────────────────────────
  const SHIRTS = ['#4f8ef7', '#f08a3c', '#2fb38a', '#e5677d', '#8a6bd6', '#f2c14e', '#5bc0eb', '#e8574b', '#6d7f99'];
  /** Background people: n characters spread between x0..x1 at depth, walking across or standing. */
  // 'bench' = working at a workbench/desk facing the camera (legs hidden), 'carry' = walking with a load.
  const WORK_BY_ENV = { factory: ['bench', 'bench', 'carry'], office: ['bench'], lab: ['bench'], farm: ['plant', 'dig', 'carry'], village: ['plant', 'dig', 'carry'], countryside: ['plant', 'dig', 'carry'], ricefield: ['plant', 'plant', 'dig'], market: ['count', 'carry', 'wave'] };
  const BENCH_ITEMS = { factory: ['gear', 'box', 'chip'], office: ['laptop', 'monitor', 'laptop'], lab: ['microscope', 'beaker', 'test-tube'] };
  const LOADS = { factory: 'box', farm: 'basket', village: 'basket', countryside: 'basket', ricefield: 'basket', market: 'basket' };
  const OUTFITS_BY_ENV = { factory: ['worker', 'worker', 'uniform'], office: ['suit', 'casual', 'dress'], lab: ['labcoat'], farm: ['farmer', 'worker'], village: ['farmer'], countryside: ['farmer'], ricefield: ['farmer'] };
  const WORKPLACES = new Set(['factory', 'office', 'lab', 'farm', 'village', 'countryside', 'ricefield']);
  /** Background people: n characters spread between x0..x1 at depth — mode 'walk' | 'stand' | 'mixed' | 'work' (default in workplaces). */
  World.prototype.crowd = function (o = {}) {
    const rnd = mulberry(Math.round((o.x0 ?? 0) + (o.depth ?? 0) * 1000 + (o.n ?? 6) * 77 + 5));
    const n = o.n ?? 6, x0 = o.x0 ?? 120, x1 = o.x1 ?? 1800, depth = o.depth ?? 0.35, mode = o.mode || (WORKPLACES.has(this.name) ? 'work' : 'mixed');
    const outfits = o.outfits || OUTFITS_BY_ENV[this.name] || ['casual', 'casual', 'hoodie', 'worker', 'suit', 'dress', 'farmer'];
    const jobs = o.work ? [].concat(o.work) : WORK_BY_ENV[this.name] || ['carry', 'count'];
    const people = [];
    for (let i = 0; i < n; i++) {
      const female = rnd() < 0.5, outfit = outfits[Math.floor(rnd() * outfits.length)];
      const look = { gender: female ? 'female' : 'male', age: rnd() < 0.12 ? 'elder' : rnd() < 0.1 ? 'kid' : 'adult', skin: ['light', 'tan', 'brown'][Math.floor(rnd() * 3)], hair: female ? ['long', 'ponytail', 'bun'][Math.floor(rnd() * 3)] : ['short', 'side', 'spiky'][Math.floor(rnd() * 3)], outfit: outfit === 'dress' && !female ? 'casual' : outfit, shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)], hat: o.hats ? o.hats[Math.floor(rnd() * o.hats.length)] : undefined };
      const x = x0 + ((i + 0.5) / n) * (x1 - x0) + (rnd() - 0.5) * 60;
      const d = depth + (rnd() - 0.5) * 0.1;
      const c = this.character(look, { x, depth: clamp(d, 0, 0.9), face: rnd() < 0.5 ? 1 : -1, scale: o.scale ?? 1 });
      c.root.classList.add('k-extra');
      const walker = mode === 'walk' || (mode === 'mixed' && rnd() < 0.7);
      if (mode === 'work') {
        const job = jobs[Math.floor(rnd() * jobs.length)], t0 = (o.at ?? 0) + rnd() * 0.5;
        if (job === 'bench') { const items = BENCH_ITEMS[this.name] || ['box']; c.atDesk(o.at ?? 0, 1e9, { item: items[Math.floor(rnd() * items.length)], itemSize: 90 }); }
        else if (job === 'carry') { const dir = rnd() < 0.5 ? 1 : -1; c.hold(LOADS[this.name] || 'box', t0, { size: 80 }); c.work('carry', t0, 1e9); c.moveTo(x + dir * (60 + rnd() * 40) * this.D, t0, this.D, { face: dir }); }
        else c.work(job, t0, 1e9);
      }
      else if (walker) { const dir = rnd() < 0.5 ? 1 : -1, speed = 90 + rnd() * 70; c.moveTo(x + dir * speed * this.D, o.at ?? 0, this.D, { face: dir }); }
      else {
        const r = rnd(), t0 = (o.at ?? 0) + rnd() * 0.4;
        if (r < 0.3) { c.hold('phone', t0, { size: 56 }); c.gaze('down', t0); }
        else if (r < 0.5) c.hold('shopping-bag', t0, { size: 70 });
        else if (r < 0.8) { c.face(i % 2 ? -1 : 1, 0).gaze(i % 2 ? 'left' : 'right', 0); ['present', 'open-arms', 'shrug', 'hand-chest', 'chin'].forEach((ps, k) => c.pose(ps, t0 + k * (1.6 + rnd()))); }
        else c.gaze(rnd() < 0.5 ? 'left' : 'right', t0);
      }
      if (o.at != null) c.fadeIn(o.at);
      people.push(c);
    }
    return people;
  };

  // ───────────────────────── particle effects ─────────────────────────
  // Deterministic: every particle's position is a closed-form function of t and its seed.
  const FX = {
    rain: { n: 150, front: true, make: (g, r) => mk('line', { x1: 0, y1: 0, x2: -10, y2: 38, stroke: '#cfe0ff', 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0.35 + r() * 0.35 }, g), pos: (p, t, a) => { const y = (p.r1 * (a.h + 200) + t * (1300 + p.r2 * 500)) % (a.h + 200) - 100; return { x: a.x + p.r3 * a.w - y * 0.25 % 60, y: a.y + y }; } },
    snow: { n: 110, front: true, make: (g, r) => mk('circle', { r: 2 + r() * 4.5, fill: '#ffffff', opacity: 0.55 + r() * 0.4 }, g), pos: (p, t, a) => { const y = (p.r1 * (a.h + 100) + t * (60 + p.r2 * 80)) % (a.h + 100) - 50; return { x: a.x + p.r3 * a.w + Math.sin(t * (0.8 + p.r2) + p.r1 * 9) * 30, y: a.y + y }; } },
    dust: { n: 60, front: false, make: (g, r) => mk('circle', { r: 1.5 + r() * 3, fill: '#fff6dc', opacity: 0.25 + r() * 0.35 }, g), pos: (p, t, a) => ({ x: a.x + ((p.r3 * a.w + t * (8 + p.r2 * 14)) % a.w), y: a.y + p.r1 * a.h + Math.sin(t * 0.7 + p.r2 * 8) * 20 }) },
    bubbles: { n: 45, front: true, make: (g, r) => mk('circle', { r: 4 + r() * 10, fill: 'rgba(255,255,255,.12)', stroke: 'rgba(255,255,255,.7)', 'stroke-width': 2 }, g), pos: (p, t, a) => { const y = (p.r1 * a.h + t * (70 + p.r2 * 90)) % a.h; return { x: a.x + p.r3 * a.w + Math.sin(t * 2 + p.r1 * 9) * 12, y: a.y + a.h - y }; } },
    fireflies: { n: 40, front: true, make: (g, r) => { const e = mk('g', {}, g); mk('circle', { r: 9, fill: '#ffe680', opacity: 0.25 }, e); mk('circle', { r: 3, fill: '#fff6b0' }, e); return e; }, pos: (p, t, a) => ({ x: a.x + p.r3 * a.w + Math.sin(t * 0.5 + p.r1 * 7) * 60, y: a.y + p.r1 * a.h + Math.cos(t * 0.6 + p.r2 * 7) * 40, op: 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + p.r2 * 9)) }) },
    leaves: { n: 26, front: true, make: (g, r) => mk('path', { d: 'M0,-12 Q12,0 0,12 Q-12,0 0,-12 Z', fill: ['#7cc36b', '#f2a65a', '#e8c547', '#d96c3f'][Math.floor(r() * 4)] }, g), pos: (p, t, a) => { const y = (p.r1 * (a.h + 100) + t * (70 + p.r2 * 60)) % (a.h + 100) - 50; return { x: a.x + p.r3 * a.w + Math.sin(t * 1.3 + p.r1 * 9) * 50, y: a.y + y, rot: t * 90 * (p.r2 - 0.5) * 3 }; } },
    confetti: { n: 130, front: true, make: (g, r) => mk('rect', { x: -6, y: -4, width: 12, height: 8, fill: ['#e5484d', '#f2c14e', '#3b7cf6', '#2fb38a', '#8a6bd6', '#ff7a45'][Math.floor(r() * 6)] }, g), pos: (p, t, a) => { const y = (p.r1 * (a.h + 100) + t * (180 + p.r2 * 140)) % (a.h + 100) - 50; return { x: a.x + p.r3 * a.w + Math.sin(t * 2 + p.r1 * 9) * 30, y: a.y + y, rot: t * 300 * (p.r2 - 0.5) }; } },
    coins: { n: 36, front: true, make: (g, r) => { const e = mk('g', {}, g); mk('ellipse', { rx: 18, ry: 18, fill: '#f6c445', stroke: '#c9902a', 'stroke-width': 3 }, e); mk('ellipse', { rx: 10, ry: 10, fill: 'none', stroke: '#c9902a', 'stroke-width': 2 }, e); return e; }, pos: (p, t, a) => { const y = (p.r1 * (a.h + 120) + t * (260 + p.r2 * 200)) % (a.h + 120) - 60; return { x: a.x + p.r3 * a.w, y: a.y + y, sx: Math.cos(t * 6 + p.r1 * 9) }; } },
    cash: { n: 28, front: true, make: (g, r) => { const e = mk('g', {}, g); mk('rect', { x: -26, y: -13, width: 52, height: 26, rx: 4, fill: '#7cc36b', stroke: '#4f8f3a', 'stroke-width': 2.5 }, e); mk('circle', { r: 7, fill: '#4f8f3a', opacity: 0.6 }, e); return e; }, pos: (p, t, a) => { const y = (p.r1 * (a.h + 120) + t * (120 + p.r2 * 90)) % (a.h + 120) - 60; return { x: a.x + p.r3 * a.w + Math.sin(t * 1.8 + p.r1 * 9) * 50, y: a.y + y, rot: Math.sin(t * 2 + p.r2 * 9) * 50 }; } },
    warp: { n: 120, front: false, make: (g, r) => mk('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: '#ffffff', 'stroke-width': 1.5 + r() * 2.5, 'stroke-linecap': 'round', opacity: 0.8 }, g), line: true, pos: (p, t, a) => { const k = (p.r1 + t * (0.5 + p.r2 * 0.6)) % 1, ang = p.r3 * Math.PI * 2, d0 = 30 + Math.pow(k, 2.2) * 1500, d1 = d0 + 20 + k * 220; return { x1: a.cx + Math.cos(ang) * d0, y1: a.cy + Math.sin(ang) * d0, x2: a.cx + Math.cos(ang) * d1, y2: a.cy + Math.sin(ang) * d1, op: Math.min(1, k * 3) }; } },
    sparks: { n: 40, front: true, burst: true, make: (g, r) => mk('circle', { r: 2 + r() * 3, fill: ['#fff3b0', '#ffc94d', '#ff8a3c'][Math.floor(r() * 3)] }, g), pos: (p, t, a) => { const k = ((t * (1.2 + p.r2) + p.r1) % 1), ang = -Math.PI / 2 + (p.r3 - 0.5) * 2.2, v = 260 + p.r2 * 260; return { x: a.x + Math.cos(ang) * v * k, y: a.y + Math.sin(ang) * v * k + 420 * k * k, op: 1 - k }; } },
    embers: { n: 40, front: true, make: (g, r) => mk('circle', { r: 2 + r() * 3, fill: ['#ffd36b', '#ff8a3c', '#ff5a3c'][Math.floor(r() * 3)] }, g), pos: (p, t, a) => { const k = ((t * (0.35 + p.r2 * 0.4) + p.r1) % 1); return { x: a.x + (p.r3 - 0.5) * a.w + Math.sin(t * 2 + p.r1 * 9) * 30, y: a.y - k * a.h, op: (1 - k) * 0.9 }; } },
    smoke: { n: 14, front: false, make: (g, r) => mk('circle', { r: 30, fill: '#e9e9ee', opacity: 0.6 }, g), pos: (p, t, a) => { const k = ((t * (0.18 + p.r2 * 0.1) + p.r1) % 1); return { x: a.x + Math.sin(k * 3 + p.r3 * 6) * 40 + k * 80 * (a.wind ?? 1), y: a.y - k * a.h, s: 0.5 + k * 2.2, op: (1 - k) * 0.75 * Math.min(1, k * 8) }; } },
    steam: { n: 10, front: false, make: (g, r) => mk('circle', { r: 16, fill: '#ffffff', opacity: 0.5 }, g), pos: (p, t, a) => { const k = ((t * (0.35 + p.r2 * 0.2) + p.r1) % 1); return { x: a.x + Math.sin(k * 6 + p.r3 * 6) * 14, y: a.y - k * 160, s: 0.4 + k * 1.6, op: (1 - k) * 0.6 * Math.min(1, k * 8) }; } },
    fire: { n: 18, front: false, make: (g, r) => mk('path', { d: 'M0,-34 Q16,-10 10,6 Q0,16 -10,6 Q-16,-10 0,-34 Z', fill: ['#ffd36b', '#ff9a3c', '#ff5a3c'][Math.floor(r() * 3)], opacity: 0.85 }, g), pos: (p, t, a) => { const k = ((t * (1.1 + p.r2 * 0.8) + p.r1) % 1); return { x: a.x + (p.r3 - 0.5) * (a.w || 80) * (1 - k), y: a.y - k * (a.h || 120), s: 1.4 * (1 - k * 0.8), op: 1 - k }; } },
    stars: { n: 90, front: false, make: (g, r) => mk('circle', { r: 1 + r() * 2.4, fill: '#ffffff' }, g), pos: (p, t, a) => ({ x: a.x + p.r3 * a.w, y: a.y + p.r1 * a.h, op: 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + p.r2 * 2) + p.r1 * 9)) }) },
  };
  /**
   * Particle effect: w.fx('rain'|'snow'|'dust'|'bubbles'|'fireflies'|'leaves'|'confetti'|'coins'|'cash'|'warp'|'sparks'|'embers'|'smoke'|'steam'|'fire'|'stars',
   *   { at, dur, x, y, w, h, n, wind }) — area defaults to the whole frame; point effects (sparks/smoke/steam/fire/embers) use x, y.
   * One-shots: 'explosion' | 'shockwave' | 'flash' | 'lightning' at { at, x, y }.
   */
  World.prototype.fx = function (type, o = {}) {
    const w = this, t0 = w.clampT(o.at ?? 0), t1 = o.dur ? t0 + o.dur : 1e9;
    if (type === 'explosion' || type === 'shockwave' || type === 'flash' || type === 'lightning') return oneShot(w, type, o, t0);
    const spec = FX[type];
    if (!spec) { window.__rt?.warn?.(`Hiệu ứng không có: "${type}" — có: ${Object.keys(FX).join(', ')}, explosion, shockwave, flash, lightning`); return null; }
    const front = o.front ?? spec.front;
    const { par } = o.depth != null && !front ? w.layerFor(o.depth) : { par: front ? mk('g', { class: 'k-fx' }, w.frontSvg) : mk('g', { class: 'k-fx' }, w.actors) };
    const g = mk('g', { opacity: 0 }, par);
    const rnd = mulberry(Math.round((o.x ?? 3) * 13 + (o.y ?? 7) * 7 + type.length * 101));
    const n = o.n ?? spec.n;
    const pointy = ['sparks', 'embers', 'smoke', 'steam', 'fire'].includes(type);
    const area = { x: o.x ?? (pointy ? 960 : -120), y: o.y ?? (pointy ? 600 : -60), w: o.w ?? (pointy ? 120 : 2160), h: o.h ?? (pointy ? 420 : 1200), cx: o.x ?? 960, cy: o.y ?? 480, wind: o.wind };
    const parts = Array.from({ length: n }, () => ({ el: spec.make(g, rnd), r1: rnd(), r2: rnd(), r3: rnd() }));
    w._ctx.frameFns.push(t => {
      const on = t >= t0 && t <= t1;
      g.setAttribute('opacity', on ? Math.min(1, (t - t0) / 0.4, (t1 - t) / 0.4).toFixed(3) : 0);
      if (!on) return;
      if (o.follow) { const c = o.from === 'center' ? o.follow.center() : o.from === 'bottom' ? { x: o.follow.st.x, y: o.follow.st.y } : o.follow.top(); area.x = c.x + (o.dx || 0); area.y = c.y + (o.dy || 0); area.cx = area.x; area.cy = area.y; }
      const lt = t - t0;
      for (const p of parts) {
        const q = spec.pos(p, lt, area);
        if (spec.line) { p.el.setAttribute('x1', q.x1.toFixed(1)); p.el.setAttribute('y1', q.y1.toFixed(1)); p.el.setAttribute('x2', q.x2.toFixed(1)); p.el.setAttribute('y2', q.y2.toFixed(1)); }
        else p.el.setAttribute('transform', `translate(${q.x.toFixed(1)},${q.y.toFixed(1)})${q.rot ? ` rotate(${q.rot.toFixed(1)})` : ''}${q.s ? ` scale(${q.s.toFixed(3)})` : ''}${q.sx != null ? ` scale(${q.sx.toFixed(3)},1)` : ''}`);
        if (q.op != null) p.el.setAttribute('opacity', clamp(q.op, 0, 1).toFixed(3));
      }
    });
    return g;
  };

  function oneShot(w, type, o, t0) {
    const g = mk('g', { opacity: 0, class: 'k-fx' }, type === 'flash' || type === 'lightning' ? w.frontSvg : w.actors);
    const x = o.x ?? 960, y = o.y ?? 540, sz = o.size || 1;
    if (type === 'flash') {
      mk('rect', { x: -300, y: -300, width: W + 600, height: H + 600, fill: o.color || '#ffffff' }, g);
      w.tl.fromTo(g, { opacity: 0 }, { opacity: o.opacity ?? 0.85, duration: 0.06 }, t0).to(g, { opacity: 0, duration: 0.6 }, t0 + 0.06);
      return g;
    }
    if (type === 'lightning') {
      const rnd = mulberry(Math.round(x * 7 + 11));
      let d = `M${x},${-20}`, cx = x;
      for (let yy = 40; yy < y; yy += 60) { cx += (rnd() - 0.5) * 120; d += ` L${cx.toFixed(0)},${yy}`; }
      mk('path', { d, fill: 'none', stroke: '#e8f0ff', 'stroke-width': 10, 'stroke-linejoin': 'round', opacity: 0.5 }, g);
      mk('path', { d, fill: 'none', stroke: '#ffffff', 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
      w.tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.04 }, t0).to(g, { opacity: 0.2, duration: 0.08 }, t0 + 0.1).to(g, { opacity: 1, duration: 0.04 }, t0 + 0.2).to(g, { opacity: 0, duration: 0.4 }, t0 + 0.3);
      return oneShot(w, 'flash', { ...o, opacity: 0.45, color: '#dfe8ff' }, t0);
    }
    const ring = mk('circle', { cx: x, cy: y, r: 10, fill: 'none', stroke: o.color || '#fff3c4', 'stroke-width': 18 * sz }, g);
    const st = { k: 0 };
    w.tl.to(st, { k: 1, duration: type === 'shockwave' ? 1.2 : 0.9, ease: 'power2.out' }, t0);
    let core = null, debris = [];
    if (type === 'explosion') {
      core = mk('g', {}, g);
      [[1, '#fff6c8'], [0.75, '#ffc94d'], [0.5, '#ff7a3c']].forEach(([k, c]) => mk('circle', { cx: x, cy: y, r: 90 * sz * k, fill: c, opacity: 0.9 }, core));
      const rnd = mulberry(Math.round(x + y));
      debris = Array.from({ length: 16 }, () => ({ a: rnd() * Math.PI * 2, v: 200 + rnd() * 300, el: mk('circle', { r: 5 + rnd() * 8, fill: ['#5a4a42', '#ff9a3c', '#ffd36b'][Math.floor(rnd() * 3)] }, g) }));
    }
    w._ctx.frameFns.push(t => {
      const on = t >= t0 && t <= t0 + 1.6;
      g.setAttribute('opacity', on ? 1 : 0);
      if (!on) return;
      const k = st.k;
      ring.setAttribute('r', (10 + k * 380 * sz).toFixed(1)); ring.setAttribute('opacity', (1 - k).toFixed(3)); ring.setAttribute('stroke-width', (18 * sz * (1 - k) + 1).toFixed(1));
      if (core) { core.setAttribute('transform', `translate(${x},${y}) scale(${(0.3 + k * 1.1).toFixed(3)}) translate(${-x},${-y})`); core.setAttribute('opacity', (1 - k).toFixed(3)); }
      const lt = t - t0;
      debris.forEach(d => { d.el.setAttribute('cx', (x + Math.cos(d.a) * d.v * lt).toFixed(1)); d.el.setAttribute('cy', (y + Math.sin(d.a) * d.v * lt + 300 * lt * lt).toFixed(1)); d.el.setAttribute('opacity', Math.max(0, 1 - lt / 1.4).toFixed(3)); });
    });
    if (type === 'explosion' && o.smoke !== false) w.fx('smoke', { at: t0 + 0.2, dur: o.smokeDur ?? 4, x, y, h: 360 });
    if (o.shake !== false) w.shake(t0, 0.6, type === 'explosion' ? 16 * sz : 8 * sz);
    return g;
  }
})();
