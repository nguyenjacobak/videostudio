/* Detailed, accurate, animated explainer diagrams. Each lays itself out inside gfx.zone() (the area not used
 * by characters), animates on the scene timeline / onFrame, and returns handles for further choreography. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const FONT = "'Be Vietnam Pro',sans-serif";

  // Bohr-model data: symbol, Vietnamese name, protons, neutrons (most common isotope), electron shells.
  const ELEMENTS = {
    H: ['Hiđrô', 1, 0, [1]], He: ['Heli', 2, 2, [2]], Li: ['Liti', 3, 4, [2, 1]], Be: ['Beri', 4, 5, [2, 2]], B: ['Bo', 5, 6, [2, 3]], C: ['Cacbon', 6, 6, [2, 4]],
    N: ['Nitơ', 7, 7, [2, 5]], O: ['Oxy', 8, 8, [2, 6]], F: ['Flo', 9, 10, [2, 7]], Ne: ['Neon', 10, 10, [2, 8]], Na: ['Natri', 11, 12, [2, 8, 1]], Mg: ['Magie', 12, 12, [2, 8, 2]],
    Al: ['Nhôm', 13, 14, [2, 8, 3]], Si: ['Silic', 14, 14, [2, 8, 4]], P: ['Photpho', 15, 16, [2, 8, 5]], S: ['Lưu huỳnh', 16, 16, [2, 8, 6]], Cl: ['Clo', 17, 18, [2, 8, 7]], Ar: ['Agon', 18, 22, [2, 8, 8]],
    K: ['Kali', 19, 20, [2, 8, 8, 1]], Ca: ['Canxi', 20, 20, [2, 8, 8, 2]], Fe: ['Sắt', 26, 30, [2, 8, 14, 2]], Cu: ['Đồng', 29, 35, [2, 8, 18, 1]], Ag: ['Bạc', 47, 61, [2, 8, 18, 18, 1]],
    Au: ['Vàng', 79, 118, [2, 8, 18, 32, 18, 1]], U: ['Urani', 92, 146, [2, 8, 18, 32, 21, 9, 2]],
  };
  const PLANETS = [
    ['mercury', 'Sao Thủy', 0.39, 8, '#a9a39c'], ['venus', 'Sao Kim', 0.72, 13, '#e8c77f'], ['earth', 'Trái Đất', 1, 14, '#3b82d6'], ['mars', 'Sao Hỏa', 1.52, 10, '#d1633c'],
    ['jupiter', 'Sao Mộc', 5.2, 34, '#e5c49a'], ['saturn', 'Sao Thổ', 9.58, 29, '#e9d6a5'], ['uranus', 'Sao Thiên Vương', 19.2, 20, '#9fdde6'], ['neptune', 'Sao Hải Vương', 30.05, 19, '#3f6fe0'],
  ];
  const CPK = { H: '#f2f4f8', C: '#3a3f4b', O: '#e8574b', N: '#4f8ef7', Cl: '#5cc26b', Na: '#8a6bd6', S: '#f6c445' };

  window.Gfx.extend((gfx, I) => {
    const { tl, frameFns, T, getLayer, appear, mk, C, shade, pal } = I;
    const g0 = (cls, parent) => mk('g', { class: cls }, parent || getLayer());
    const text = (p, x, y, s, str, fill = C.ink, w = 800, anchor = 'middle') => { const t = mk('text', { x, y, 'font-size': s, 'font-weight': w, fill, 'text-anchor': anchor, 'font-family': FONT }, p); t.textContent = str; return t; };
    const pop = (el, at, d = 0.5) => tl.fromTo(el, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: d, ease: 'back.out(2)' }, T(at));
    const fade = (el, at, d = 0.5) => tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: d }, T(at));
    const draw = (el, at, d = 1) => tl.fromTo(el, { drawSVG: '0%' }, { drawSVG: '100%', duration: d, ease: 'power2.inOut' }, T(at));
    const leader = (p, x1, y1, x2, y2, label, at, color = C.ink) => {
      const g = g0('gfx-leader', p);
      mk('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': 3 }, g);
      mk('circle', { cx: x1, cy: y1, r: 6, fill: color }, g);
      const right = x2 >= x1;
      text(g, x2 + (right ? 10 : -10), y2 + 10, 30, label, color, 800, right ? 'start' : 'end');
      fade(g, at, 0.4);
      return g;
    };
    const begin = o => { if (!o._nested) gfx._begin(o); };
    let bhN = 0;

    Object.assign(gfx, {
      /** Solar system in 3/4 view: 8 planets in the right order, moving at Kepler-scaled speeds. */
      solarSystem(o = {}) {
        begin(o);
        const z = gfx.zone(), cx = z.cx, cy = z.cy + 20, maxR = Math.min(z.w * 0.48, 820);
        const g = g0('gfx-solar'), t0 = T(o.at);
        const glow = mk('circle', { cx, cy, r: 64, fill: '#ffb13b', 'fill-opacity': 0.25 }, g);
        const orbits = g0('', g), back = g0('', g), sunG = g0('', g), front = g0('', g);
        const sunO = mk('circle', { cx, cy, r: 46, fill: '#ffc94d' }, sunG), sunI = mk('circle', { cx, cy, r: 38, fill: '#ffd76b' }, sunG);
        pop(sunG, t0); pop(glow, t0);
        // red-giant phase: sun.r grows, planets whose orbit it reaches flash and burn away
        const sun = { r: 46, red: 0 }, burn = {}, grows = [], mix = (a, b, k) => '#' + [0, 2, 4].map(i => Math.round(parseInt(a.substr(i + 1, 2), 16) * (1 - k) + parseInt(b.substr(i + 1, 2), 16) * k).toString(16).padStart(2, '0')).join('');
        frameFns.push(() => {
          sunO.setAttribute('r', sun.r); sunI.setAttribute('r', sun.r * 0.83); glow.setAttribute('r', sun.r * (1.4 - 0.25 * sun.red));
          sunO.setAttribute('fill', mix('#ffc94d', '#d9442b', sun.red)); sunI.setAttribute('fill', mix('#ffd76b', '#f0703a', sun.red)); glow.setAttribute('fill', mix('#ffb13b', '#ff4a2a', sun.red));
        });
        const bodies = PLANETS.map(([id, name, au, r0, col], i) => {
          let r = r0;
          const rx = 150 + Math.pow(i / 7, 0.8) * (maxR - 150), ry = rx * 0.3; r = r * 1.75;
          const orb = mk('ellipse', { cx, cy, rx, ry, fill: 'none', stroke: o.dark ? '#ffffff' : '#8b93a6', 'stroke-opacity': 0.35, 'stroke-width': 2.5 }, orbits);
          draw(orb, t0 + 0.2 + i * 0.12, 0.8);
          const pg = mk('g', { opacity: 0 }, front);
          if (id === 'saturn') mk('ellipse', { rx: r * 1.9, ry: r * 0.55, fill: 'none', stroke: '#d9c59a', 'stroke-width': 5 }, pg);
          if (id === 'uranus') mk('ellipse', { rx: r * 0.35, ry: r * 1.6, fill: 'none', stroke: '#a6dbe2', 'stroke-width': 3 }, pg);
          mk('circle', { r, fill: col }, pg);
          if (id === 'jupiter') { mk('rect', { x: -r, y: -r * 0.3, width: 2 * r, height: r * 0.18, fill: '#c98f5e' }, pg); mk('rect', { x: -r * 0.95, y: r * 0.15, width: 1.9 * r, height: r * 0.16, fill: '#b5774a' }, pg); mk('ellipse', { cx: r * 0.35, cy: r * 0.42, rx: r * 0.22, ry: r * 0.12, fill: '#c0503a' }, pg); }
          if (id === 'earth') mk('path', { d: `M${-r * 0.5},${-r * 0.4} q${r * 0.4},${-r * 0.3} ${r * 0.6},${r * 0.1} q${-r * 0.2},${r * 0.6} ${-r * 0.5},${r * 0.2} Z`, fill: '#5fb85a' }, pg);
          mk('path', { d: `M0,${-r} A${r},${r} 0 0 1 0,${r} A${r * 0.55},${r} 0 0 0 0,${-r} Z`, fill: '#000', opacity: 0.2 }, pg);
          const hl = o.highlight === id;
          const lab = (o.labels === 'all' || hl) ? text(pg, 0, i < 4 && i % 2 ? -r - 16 : r + 34, hl ? 36 : 26, name, o.dark ? '#fff' : C.ink, 800) : null;
          if (hl) mk('circle', { r: r + 10, fill: 'none', stroke: C.orange, 'stroke-width': 5 }, pg);
          const period = Math.pow(au, 1.5), w = (o.speed ?? 1) * 28 / period, a0 = i * 0.9 + 0.6;
          const appearAt = t0 + 0.4 + i * 0.12;
          const posAt = t => { const a = a0 + Math.max(0, t - t0) * w * Math.PI / 180; return { a, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }; };
          frameFns.push(t => {
            const { a, x, y } = posAt(t);
            pg.setAttribute('transform', `translate(${x},${y}) scale(${0.85 + 0.15 * Math.sin(a)})`);
            let op = t >= appearAt ? Math.min(1, (t - appearAt) / 0.3) : 0;
            const burnAt = burn[id];   // fixed when growSun is scheduled, so seeking is deterministic
            if (burnAt != null && t >= burnAt) { const k = Math.min(1, (t - burnAt) / 0.6); op *= 1 - k; pg.style.filter = `brightness(${1 + 2 * (1 - k)}) sepia(${k})`; } else pg.style.filter = '';
            pg.setAttribute('opacity', op);
            (Math.sin(a) < 0 ? back : front).appendChild(pg);
          });
          // usable as an anchor by kit.mg (m.label(ss.planets.venus, …), m.ring, m.fx on:)
          return { id, el: pg, label: lab, rx, center: () => posAt(tl.time()), radius: () => r, alive: () => burn[id] == null || tl.time() < burn[id] + 0.3 };
        });
        const order = bodies.filter(b => b.label).sort((a, b) => (b.id === o.highlight) - (a.id === o.highlight));
        let tNow = 0;
        frameFns.push(t => {
          tNow = t;
          const shown = [];
          order.forEach(b => {
            const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(b.el.getAttribute('transform') || '');
            if (!m) return;
            const fs = +b.label.getAttribute('font-size'), w = b.label.textContent.length * fs * 0.56, x = +m[1], y = +m[2] + +b.label.getAttribute('y');
            const box = { x0: x - w / 2, x1: x + w / 2, y0: y - fs, y1: y + fs * 0.3 };
            const gone = (burn[b.id] != null && tNow >= burn[b.id]) || Math.max(Math.abs(box.x0 - cx), Math.abs(box.x1 - cx)) < sun.r + 12 && Math.max(Math.abs(box.y0 - cy), Math.abs(box.y1 - cy)) < sun.r + 12 || Math.hypot(x - cx, y - fs / 2 - cy) < sun.r + 30;
            if (gone) { b.label.setAttribute('opacity', 0); return; }
            const hit = shown.some(q => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0);
            b.label.setAttribute('opacity', hit ? 0 : 1);
            if (!hit) shown.push(box);
          });
        });
        const planets = Object.fromEntries(bodies.map(b => [b.id, b]));
        /** Sun swells into a red giant until it swallows the given planet ('mercury' | 'venus' | 'earth' | 'mars'). */
        const growSun = (at, upTo = 'venus', dur = 2.5) => {
          const p = planets[upTo] || planets.venus, t1 = T(at), from = grows.length ? grows[grows.length - 1].to : 46, to = Math.max(from, p.rx * 1.08);
          grows.push({ to });
          tl.to(sun, { r: to, red: 1, duration: dur, ease: 'power1.inOut' }, t1);
          // when the swelling surface reaches each orbit (inverse of the power1.inOut ease)
          const inv = v => (v < 0.5 ? Math.sqrt(v / 2) : 1 - Math.sqrt((1 - v) / 2));
          bodies.forEach(b => { if (burn[b.id] == null && b.rx * 0.97 <= to) burn[b.id] = t1 + dur * inv(Math.min(1, Math.max(0, (b.rx * 0.97 - from) / Math.max(1, to - from)))); });
        };
        return { el: g, planets, growSun, sun };
      },

      /** Earth cut-away: crust, mantle, outer core, inner core (radii to scale; crust exaggerated) on a globe with real continents. */
      earthLayers(o = {}) {
        begin(o);
        const z = gfx.zone(), R = Math.min(z.h * 0.44, z.w * 0.3, 290), cx = z.x0 + z.w * 0.36, cy = z.cy + 10;
        const g = g0('gfx-earth-layers'), t0 = T(o.at);
        const globe = mk('g', { transform: `translate(${cx},${cy}) scale(${R / 94})` }, g);
        globe.innerHTML = (window.Gfx.OBJ.globe || (() => `<circle r="94" fill="#3b82d6"/>`))({ lon: o.lon ?? 20, lat: o.lat ?? 10 });
        pop(g, t0, 0.6);
        const wedge = g0('', g);
        const layers = [[1, '#8a6a55'], [0.985, '#e8743b'], [0.546, '#f6a93b'], [0.19, '#ffe38a']];
        layers.forEach(([k, col]) => mk('path', { d: `M${cx},${cy} L${cx + R * k},${cy} A${R * k},${R * k} 0 0 0 ${cx},${cy - R * k} Z`, fill: col, stroke: 'rgba(0,0,0,.12)', 'stroke-width': 1 }, wedge));
        tl.fromTo(wedge, { scale: 0, transformOrigin: `${cx}px ${cy}px` }, { scale: 1, duration: 0.8, ease: 'back.out(1.4)' }, t0 + 0.8);
        const lx = cx + R + 70;
        const pts = [[cx + R * 0.99, cy - R * 0.1, 'Vỏ Trái Đất'], [cx + R * 0.75, cy - R * 0.45, 'Lớp manti'], [cx + R * 0.36, cy - R * 0.3, 'Nhân ngoài (lỏng)'], [cx + R * 0.08, cy - R * 0.08, 'Nhân trong (rắn)']];
        const labels = pts.map(([x, y, l], i) => leader(g, x, y, lx, cy - R * 0.75 + i * R * 0.5, o.labels?.[i] || l, o.labelAt?.[i] ?? t0 + 1.6 + i * 0.6));
        return { el: g, labels };
      },
      /** Bohr model of an element (by symbol): real proton/neutron counts and electron shells, glowing electrons orbiting. */
      atom(o = {}) {
        begin(o);
        const el = ELEMENTS[o.element] || ELEMENTS.C, [name, Z, N, shells] = el;
        const z = gfx.zone(), cx = z.cx, cy = z.cy, Rmax = Math.min(z.h * 0.42, z.w * 0.42, 310);
        const g = g0('gfx-atom'), t0 = T(o.at);
        const total = Z + N, nr = Math.min(115, 36 + Math.sqrt(total) * 8), draws = Math.min(total, 60), ball = Math.max(9, nr * (draws > 30 ? 0.16 : 0.24));
        const nuc = g0('', g);
        mk('circle', { cx, cy, r: nr * 1.25, fill: '#ffd7c7', opacity: 0.35 }, nuc);
        // protons (red) and neutrons (grey) mixed in the right proportion
        for (let i = 0; i < draws; i++) {
          const a = i * 2.399, d = Math.sqrt((i + 0.5) / draws) * (nr - ball * 0.6), proton = Math.floor(((i + 1) * Z) / total) > Math.floor((i * Z) / total);
          const col = proton ? '#e8574b' : '#9aa3b5', x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
          mk('circle', { cx: x, cy: y, r: ball, fill: col, stroke: shade(col, -0.25), 'stroke-width': 2 }, nuc);
          mk('circle', { cx: x - ball * 0.3, cy: y - ball * 0.3, r: ball * 0.3, fill: '#fff', opacity: 0.45 }, nuc);
        }
        pop(nuc, t0);
        if (o.showCounts !== false) {
          const tg = g0('', g), ly = Math.min(z.y1 + 30, cy + Rmax + 58);
          mk('circle', { cx: cx - 150, cy: ly - 10, r: 11, fill: '#e8574b' }, tg); text(tg, cx - 132, ly, 28, `${Z} proton`, C.ink, 800, 'start');
          mk('circle', { cx: cx + 30, cy: ly - 10, r: 11, fill: '#9aa3b5' }, tg); text(tg, cx + 48, ly, 28, `${N} nơtron`, C.ink, 800, 'start');
          fade(tg, t0 + 0.6);
        }
        shells.forEach((n, k) => {
          const r = nr + 36 + (k + 1) * ((Rmax - nr - 36) / shells.length);
          const ring = mk('circle', { cx, cy, r, fill: 'none', stroke: '#6f7a93', 'stroke-opacity': 0.55, 'stroke-width': 3, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round' }, g);
          draw(ring, t0 + 0.4 + k * 0.3, 0.7);
          const es = Array.from({ length: n }, () => { const eg = mk('g', { opacity: 0 }, g); mk('circle', { r: 20, fill: '#4f8ef7', opacity: 0.22 }, eg); mk('circle', { r: 10, fill: '#4f8ef7', stroke: '#fff', 'stroke-width': 3 }, eg); return eg; });
          const w = 60 / (k + 1), appearAt = t0 + 0.8 + k * 0.3;
          frameFns.push(t => es.forEach((e, i) => { const a = (i / n) * Math.PI * 2 + Math.max(0, t - t0) * w * Math.PI / 180 + k; e.setAttribute('transform', `translate(${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)})`); e.setAttribute('opacity', t >= appearAt ? 1 : 0); }));
        });
        if (o.label !== false) gfx.label(`${o.element || 'C'} · ${name}`, { x: cx, y: Math.max(z.y0 + 10, cy - Rmax - 34), at: t0 + 0.3, size: 36, color: C.teal });
        return { el: g };
      },
      /** Ball-and-stick molecule with correct geometry: H2O (104.5°), CO2, O2, N2, H2, CH4, NH3, NaCl lattice. */
      molecule(o = {}) {
        begin(o);
        const f = (o.formula || 'H2O').toUpperCase().replace('NACL', 'NaCl');
        const z = gfx.zone(), cx = z.cx, cy = z.cy, s = Math.min(z.h, z.w) / 520;
        const g = g0('gfx-molecule'), spin = g0('', g), t0 = T(o.at);
        const atoms = [], bonds = [];
        const A = (el, x, y, r) => atoms.push({ el, x, y, r });
        const B = (i, j, n = 1) => bonds.push([i, j, n]);
        if (f === 'H2O') { const a = 104.5 / 2 * Math.PI / 180, L = 150; A('O', 0, -30, 70); A('H', -Math.sin(a) * L, -30 + Math.cos(a) * L, 44); A('H', Math.sin(a) * L, -30 + Math.cos(a) * L, 44); B(0, 1); B(0, 2); }
        else if (f === 'CO2') { A('C', 0, 0, 62); A('O', -170, 0, 66); A('O', 170, 0, 66); B(0, 1, 2); B(0, 2, 2); }
        else if (f === 'O2') { A('O', -80, 0, 70); A('O', 80, 0, 70); B(0, 1, 2); }
        else if (f === 'N2') { A('N', -80, 0, 68); A('N', 80, 0, 68); B(0, 1, 3); }
        else if (f === 'H2') { A('H', -60, 0, 50); A('H', 60, 0, 50); B(0, 1); }
        else if (f === 'CH4') { A('C', 0, 0, 62); A('H', 0, -150, 42); A('H', -135, 70, 42); A('H', 135, 70, 42); A('H', 30, 110, 36); B(0, 1); B(0, 2); B(0, 3); B(0, 4); }
        else if (f === 'NH3') { A('N', 0, -20, 64); A('H', -130, 60, 42); A('H', 130, 60, 42); A('H', 0, 110, 40); B(0, 1); B(0, 2); B(0, 3); }
        else if (f === 'NaCl') { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const cl = (r + c) % 2 === 0; A(cl ? 'Cl' : 'Na', (c - 1) * 150, (r - 1) * 150, cl ? 56 : 38); } for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const i = r * 3 + c; if (c < 2) B(i, i + 1); if (r < 2) B(i, i + 3); } }
        bonds.forEach(([i, j, n], k) => {
          const a = atoms[i], b = atoms[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
          for (let m = 0; m < n; m++) { const off = (m - (n - 1) / 2) * 16; const l = mk('line', { x1: cx + (a.x + nx * off) * s, y1: cy + (a.y + ny * off) * s, x2: cx + (b.x + nx * off) * s, y2: cy + (b.y + ny * off) * s, stroke: '#8b93a6', 'stroke-width': 12 * s, 'stroke-linecap': 'round' }, spin); draw(l, t0 + 0.3 + k * 0.1, 0.4); }
        });
        atoms.forEach((a, i) => {
          const ag = g0('', spin), col = CPK[a.el] || C.grey;
          mk('circle', { cx: cx + a.x * s, cy: cy + a.y * s, r: a.r * s, fill: col, stroke: shade(col, -0.2), 'stroke-width': 3 }, ag);
          mk('circle', { cx: cx + (a.x - a.r * 0.3) * s, cy: cy + (a.y - a.r * 0.3) * s, r: a.r * 0.25 * s, fill: '#fff', opacity: 0.45 }, ag);
          text(ag, cx + a.x * s, cy + (a.y + a.r * 0.32) * s, a.r * 0.8 * s, a.el, a.el === 'H' ? C.ink : '#fff', 900);
          pop(ag, t0 + i * 0.12, 0.45);
        });
        frameFns.push(t => spin.setAttribute('transform', `rotate(${Math.sin(t * 0.6) * 6} ${cx} ${cy})`));
        if (o.label !== false) gfx.label(o.name || f.replace(/(\d)/g, m => '₀₁₂₃₄₅₆₇₈₉'[m]), { x: cx, y: z.y1 - 20, at: t0 + 0.8, size: 40, color: C.teal });
        return { el: g };
      },

      /** Labelled cell diagram (animal or plant) — organelles appear one by one with leader labels. */
      cell(o = {}) {
        begin(o);
        const plant = o.type === 'plant';
        const z = gfx.zone(), cx = z.x0 + z.w * 0.4, cy = z.cy + 20, W = Math.min(z.w * 0.3, 300), H = Math.min(z.h * 0.36, 230);
        const g = g0('gfx-cell'), t0 = T(o.at);
        if (plant) { mk('rect', { x: cx - W - 16, y: cy - H - 16, width: 2 * W + 32, height: 2 * H + 32, rx: 40, fill: '#6fb35a' }, g); }
        const body = plant ? mk('rect', { x: cx - W, y: cy - H, width: 2 * W, height: 2 * H, rx: 30, fill: '#dff3cf', stroke: '#9fd08a', 'stroke-width': 6 }, g) : mk('ellipse', { cx, cy, rx: W, ry: H, fill: '#ffe1d6', stroke: '#f2a58e', 'stroke-width': 8 }, g);
        pop(g, t0, 0.6);
        const parts = [];
        const nuc = g0('', g); mk('circle', { cx: cx - W * 0.1, cy: cy - H * 0.05, r: H * 0.34, fill: '#8a6bd6' }, nuc); mk('circle', { cx: cx - W * 0.05, cy: cy - H * 0.1, r: H * 0.12, fill: '#5d43a8' }, nuc); parts.push([nuc, cx - W * 0.1, cy - H * 0.4, 'Nhân tế bào']);
        const mito = g0('', g); [[0.55, -0.45, 20], [-0.6, 0.45, 35], [0.45, 0.5, -15]].forEach(([dx, dy, a]) => { mk('ellipse', { cx: cx + dx * W, cy: cy + dy * H, rx: W * 0.16, ry: H * 0.09, fill: C.orange, transform: `rotate(${a} ${cx + dx * W} ${cy + dy * H})` }, mito); mk('path', { d: `M${cx + dx * W - W * 0.1},${cy + dy * H} q${W * 0.05},-8 ${W * 0.1},0 t${W * 0.1},0`, stroke: '#b35a1c', 'stroke-width': 3, fill: 'none', transform: `rotate(${a} ${cx + dx * W} ${cy + dy * H})` }, mito); }); parts.push([mito, cx + 0.55 * W, cy - 0.45 * H, 'Ty thể']);
        const er = g0('', g); for (let k = 0; k < 3; k++) mk('path', { d: `M${cx + W * 0.2},${cy + H * (0.02 + k * 0.1)} q${W * 0.1},-12 ${W * 0.2},0 t${W * 0.2},0`, stroke: '#5b8def', 'stroke-width': 6, fill: 'none' }, er); parts.push([er, cx + W * 0.4, cy + H * 0.1, 'Lưới nội chất']);
        const golgi = g0('', g); for (let k = 0; k < 3; k++) mk('path', { d: `M${cx - W * 0.35},${cy + H * (0.25 + k * 0.08)} q${W * 0.12},-14 ${W * 0.24},0`, stroke: '#e5677d', 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round' }, golgi); parts.push([golgi, cx - W * 0.23, cy + H * 0.3, 'Bộ máy Golgi']);
        const ribo = g0('', g); for (let k = 0; k < 14; k++) mk('circle', { cx: cx + Math.cos(k * 2.3) * W * (0.5 + (k % 3) * 0.12), cy: cy + Math.sin(k * 2.3) * H * (0.55 + (k % 2) * 0.1), r: 5, fill: '#2f3a55' }, ribo); parts.push([ribo, cx + Math.cos(0) * W * 0.5, cy, 'Ribôxôm']);
        if (plant) {
          const ch = g0('', g); [[-0.65, -0.55], [0.7, 0.1], [-0.2, 0.65], [0.6, -0.7]].forEach(([dx, dy]) => { mk('ellipse', { cx: cx + dx * W, cy: cy + dy * H, rx: W * 0.14, ry: H * 0.08, fill: '#3f9a45' }, ch); }); parts.push([ch, cx - 0.65 * W, cy - 0.55 * H, 'Lục lạp']);
          const vac = g0('', g); mk('rect', { x: cx + W * 0.05, y: cy - H * 0.75, width: W * 0.45, height: H * 0.55, rx: 30, fill: '#cfeaff', opacity: 0.9 }, vac); parts.push([vac, cx + W * 0.28, cy - H * 0.5, 'Không bào']);
          parts.push([null, cx - W - 8, cy + H * 0.6, 'Thành tế bào']);
        } else parts.push([null, cx - W * 0.98, cy + H * 0.1, 'Màng tế bào']);
        const lx = cx + W + 90, n = parts.length;
        parts.forEach(([p, x, y, l], i) => {
          const at = (o.partAt?.[i]) ?? t0 + 0.9 + i * (o.stagger ?? 0.55);
          if (p) pop(p, at, 0.45);
          leader(g, x, y, lx, cy - H + (i * 2 * H) / Math.max(1, n - 1), l, at + 0.15);
        });
        return { el: g };
      },

      /** DNA double helix with depth: two sugar-phosphate backbones winding round each other, base pairs A–T / G–C between them. */
      dna(o = {}) {
        begin(o);
        const z = gfx.zone(), cx = z.cx, top = z.y0 + 20, h = z.h - 40, amp = Math.min(150, z.w * 0.16), n = 22, turns = 2;
        const g = g0('gfx-dna'), t0 = T(o.at);
        const cols = { A: '#4f8ef7', T: '#f08a3c', G: '#2bb36b', C: '#e8574b' };
        const backB = mk('path', { fill: 'none', 'stroke-linecap': 'round' }, g), backA = mk('path', { fill: 'none', 'stroke-linecap': 'round' }, g);
        const rungs = Array.from({ length: n }, (_, i) => { const pair = ['AT', 'GC', 'TA', 'CG', 'AT', 'CG'][i % 6]; return { pair, l: mk('line', { 'stroke-width': 11, 'stroke-linecap': 'round', stroke: cols[pair[0]] }, g), r: mk('line', { 'stroke-width': 11, 'stroke-linecap': 'round', stroke: cols[pair[1]] }, g) }; });
        const frontA = mk('path', { fill: 'none', 'stroke-linecap': 'round' }, g), frontB = mk('path', { fill: 'none', 'stroke-linecap': 'round' }, g);
        fade(g, t0, 0.8);
        if (o.legend !== false) {
          const lg = g0('', g), lx = z.x1 - 190, ly = z.y0 + 60;
          [['A', 'T', 'A – T'], ['G', 'C', 'G – C']].forEach(([a, b, l], k) => { mk('rect', { x: lx, y: ly + k * 56 - 14, width: 34, height: 14, rx: 7, fill: cols[a] }, lg); mk('rect', { x: lx + 34, y: ly + k * 56 - 14, width: 34, height: 14, rx: 7, fill: cols[b] }, lg); text(lg, lx + 84, ly + k * 56, 30, l, C.ink, 800, 'start'); });
          fade(lg, t0 + 1);
        }
        const strand = (sign, ph, from, to, front) => {
          // only the segments on the near (front) or far side of the helix
          let d = '', pen = false;
          for (let s = 0; s <= 120; s++) {
            const k = s / 120, y = top + k * h, a = k * turns * Math.PI * 2 + ph, x = cx + sign * Math.sin(a) * amp, near = sign * Math.cos(a) > 0;
            if (near === front) { d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `; pen = true; } else pen = false;
          }
          return d;
        };
        frameFns.push(t => {
          const ph = Math.max(0, t - t0) * 1.1, grow = Math.max(0, Math.min(1, (t - t0) / 1.2));
          [[backA, 1, false], [backB, -1, false], [frontA, 1, true], [frontB, -1, true]].forEach(([el, sign, front]) => {
            el.setAttribute('d', strand(sign, ph, 0, 1, front));
            el.setAttribute('stroke', sign > 0 ? '#2f3a55' : '#7a5bd0');
            el.setAttribute('stroke-width', front ? 16 : 11);
            el.setAttribute('opacity', front ? 1 : 0.45);
          });
          rungs.forEach((q, i) => {
            const k = (i + 0.5) / n, y = top + k * h, a = k * turns * Math.PI * 2 + ph, x1 = cx + Math.sin(a) * amp, x2 = cx - Math.sin(a) * amp, mx = (x1 + x2) / 2;
            const depth = 0.5 + 0.5 * Math.abs(Math.cos(a)), vis = Math.max(0, Math.min(1, grow * n - i));
            q.l.setAttribute('x1', x1); q.l.setAttribute('y1', y); q.l.setAttribute('x2', mx); q.l.setAttribute('y2', y);
            q.r.setAttribute('x1', mx); q.r.setAttribute('y1', y); q.r.setAttribute('x2', x2); q.r.setAttribute('y2', y);
            q.l.setAttribute('opacity', (vis * depth).toFixed(2)); q.r.setAttribute('opacity', (vis * depth).toFixed(2));
          });
        });
        return { el: g };
      },
      /** Water cycle: evaporation → condensation → precipitation → runoff, with moving arrows and rain. */
      waterCycle(o = {}) {
        begin(o);
        const z = gfx.zone(), g = g0('gfx-water'), t0 = T(o.at);
        const x0 = z.x0, w = z.w, yb = z.y1, sea = g0('', g), land = g0('', g);
        mk('path', { d: `M${x0},${yb - 90} Q${x0 + w * 0.25},${yb - 110} ${x0 + w * 0.5},${yb - 90} L${x0 + w * 0.5},${yb} L${x0},${yb} Z`, fill: '#4f8ef7' }, sea);
        mk('path', { d: `M${x0 + w * 0.45},${yb} L${x0 + w * 0.7},${z.y0 + 190} L${x0 + w * 0.85},${yb - 160} L${x0 + w},${z.y0 + 240} L${x0 + w},${yb} Z`, fill: '#7d8aa6' }, land);
        mk('path', { d: `M${x0 + w * 0.7},${z.y0 + 190} l24,50 l-30,6 l-18,-26 Z`, fill: '#fff' }, land);
        mk('path', { d: `M${x0 + w * 0.8},${yb - 120} Q${x0 + w * 0.65},${yb - 40} ${x0 + w * 0.48},${yb - 70}`, stroke: '#4f8ef7', 'stroke-width': 14, fill: 'none', 'stroke-linecap': 'round' }, land);
        fade(sea, t0); fade(land, t0 + 0.2);
        const sun = gfx.item('sun', { _nested: true, x: x0 + 110, y: z.y0 + 190, size: 170, at: t0 + 0.3, shadow: false });
        const cloud = gfx.item('rain-cloud', { x: x0 + w * 0.66, y: z.y0 + 250, size: 190, at: t0 + 1.8, shadow: false });
        const arrow = (d, at, label, lx, ly) => { const p = mk('path', { d, stroke: C.ink, 'stroke-width': 7, fill: 'none', 'stroke-dasharray': '16 12', class: 'a-flow' }, g); fade(p, at); gfx.label(label, { x: lx, y: ly, at: at + 0.2, size: 30 }); return p; };
        arrow(`M${x0 + w * 0.22},${yb - 110} C${x0 + w * 0.2},${yb - 260} ${x0 + w * 0.35},${z.y0 + 300} ${x0 + w * 0.5},${z.y0 + 220}`, (o.stepAt?.[0]) ?? t0 + 1, o.labels?.[0] || 'Bốc hơi', x0 + w * 0.2, yb - 250);
        arrow(`M${x0 + w * 0.52},${z.y0 + 200} L${x0 + w * 0.6},${z.y0 + 190}`, (o.stepAt?.[1]) ?? t0 + 1.8, o.labels?.[1] || 'Ngưng tụ', x0 + w * 0.5, z.y0 + 120);
        gfx.label(o.labels?.[2] || 'Mưa', { x: x0 + w * 0.88, y: z.y0 + 330, at: (o.stepAt?.[2]) ?? t0 + 2.6, size: 30 });
        gfx.label(o.labels?.[3] || 'Dòng chảy', { x: x0 + w * 0.62, y: yb - 30, at: (o.stepAt?.[3]) ?? t0 + 3.2, size: 30 });
        // flow arrows on the dashed paths
        const g2 = g.querySelectorAll('.a-flow');
        frameFns.push(t => g2.forEach(p => p.setAttribute('stroke-dashoffset', (-t * 50).toFixed(1))));
        return { el: g, sun, cloud };
      },

      /**
       * Black hole as seen in simulations (Interstellar / EHT): black shadow, thin photon ring, tilted accretion disk whose far
       * side is lensed into an arc OVER (and faintly under) the shadow, Doppler-brighter approaching side, rotating disk,
       * infalling matter. disk: false → quiet black hole lensing the starfield. labels: true → horizon / photon ring / disk callouts.
       */
      blackHole(o = {}) {
        begin(o);
        const z = gfx.zone(), cx = z.cx, cy = z.cy + 10, R = Math.min(z.w * 0.44, z.h * 0.95, 430), r = R * 0.3;
        const g = g0('gfx-blackhole'), t0 = T(o.at), id = `bh${++bhN}`;
        const defs = mk('defs', {}, g);
        const grad = (gid, kind, attrs, stops) => { const el = mk(kind, { id: `${id}-${gid}`, ...attrs }, defs); stops.forEach(([off, col, op = 1]) => mk('stop', { offset: off, 'stop-color': col, 'stop-opacity': op }, el)); return `url(#${id}-${gid})`; };
        const glow = grad('glow', 'radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffb35c', 0.55], [0.35, '#ff7a1a', 0.18], [1, '#ff7a1a', 0]]);
        // approaching side (left) brighter and whiter, receding side (right) dimmer and redder
        const doppler = grad('dop', 'linearGradient', { x1: '0', x2: '1', y1: '0', y2: '0' }, [[0, '#fff6dc'], [0.3, '#ffd27a'], [0.65, '#ff9a3c'], [1, '#b8410e']]);
        const arcGrad = grad('arc', 'linearGradient', { x1: '0', x2: '1', y1: '0', y2: '0' }, [[0, '#fff3cf'], [0.45, '#ffc76a'], [1, '#e0611c']]);
        const blur = mk('filter', { id: `${id}-blur`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs); mk('feGaussianBlur', { stdDeviation: r * 0.05 }, blur);
        const front = mk('clipPath', { id: `${id}-front` }, defs); mk('rect', { x: cx - R * 2, y: cy, width: R * 4, height: R * 2 }, front);
        const disk = o.disk !== false;

        // starfield, pushed outward around the shadow the way gravitational lensing does
        const stars = g0('', g);
        for (let i = 0; i < 70; i++) {
          const a = i * 2.399, k = ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1, d = r * (1.5 + k * 3.4), lens = 1 + (r * r * 1.3) / (d * d);
          mk('circle', { cx: cx + Math.cos(a) * d * lens, cy: cy + Math.sin(a) * d * lens * 0.8, r: 1.2 + (i % 4) * 0.6, fill: '#fff', opacity: 0.35 + (i % 3) * 0.2 }, stars);
        }
        if (!disk) for (let i = 0; i < 4; i++) { const rr = r * (1.25 + i * 0.12); mk('circle', { cx, cy, r: rr, fill: 'none', stroke: '#cfe0ff', 'stroke-width': 2, 'stroke-dasharray': `${6 + i * 3} ${18 + i * 6}`, opacity: 0.45 - i * 0.08 }, stars); }
        mk('circle', { cx, cy, r: R * 1.05, fill: disk ? glow : 'none' }, g);

        const band = (inner, outer, ry) => `M${cx - outer},${cy} A${outer},${outer * ry} 0 1 0 ${cx + outer},${cy} A${outer},${outer * ry} 0 1 0 ${cx - outer},${cy} Z M${cx - inner},${cy} A${inner},${inner * ry} 0 1 1 ${cx + inner},${cy} A${inner},${inner * ry} 0 1 1 ${cx - inner},${cy} Z`;
        const tilt = 0.13, streaks = [];
        const streakSet = parent => [1.35, 1.6, 1.9, 2.25, 2.65, 3.0].forEach((k, i) => {
          const e = mk('ellipse', { cx, cy, rx: r * k, ry: r * k * tilt, fill: 'none', stroke: i % 2 ? '#fff4d6' : '#ffd08a', 'stroke-width': r * (0.03 + (i % 3) * 0.012), 'stroke-dasharray': `${r * (0.5 + i * 0.15)} ${r * (0.35 + (i % 2) * 0.4)}`, 'stroke-linecap': 'round', opacity: 0.55 - i * 0.05 }, parent);
          streaks.push({ e, k });
        });
        let lensTop = null, lensBottom = null;
        if (disk) {
          // far side of the disk, lensed up over the shadow (and a thin secondary image under it)
          const top = `M${cx - r * 1.55},${cy} A${r * 1.55},${r * 1.4} 0 0 1 ${cx + r * 1.55},${cy}`;
          lensTop = mk('path', { d: top, fill: 'none', stroke: arcGrad, 'stroke-width': r * 0.34, 'stroke-linecap': 'round', opacity: 0.95 }, g);
          mk('path', { d: top, fill: 'none', stroke: '#fff8e6', 'stroke-width': r * 0.06, opacity: 0.8, filter: `url(#${id}-blur)` }, g);
          lensBottom = mk('path', { d: `M${cx - r * 1.2},${cy} A${r * 1.2},${r * 1.05} 0 0 0 ${cx + r * 1.2},${cy}`, fill: 'none', stroke: arcGrad, 'stroke-width': r * 0.08, opacity: 0.6 }, g);
          // flat disk behind the hole
          mk('path', { d: band(r * 1.15, r * 3.1, tilt * 1.15), fill: doppler, 'fill-rule': 'evenodd', opacity: 0.92 }, g);
          streakSet(g0('', g));
        }
        // photon ring + shadow (the event horizon lies inside the shadow)
        mk('circle', { cx, cy, r: r * 1.06, fill: 'none', stroke: '#fff1cc', 'stroke-width': r * 0.05, filter: `url(#${id}-blur)`, opacity: 0.9 }, g);
        mk('circle', { cx, cy, r: r * 1.03, fill: 'none', stroke: '#fffaf0', 'stroke-width': r * 0.022 }, g);
        mk('circle', { cx, cy, r, fill: '#000' }, g);
        // the event horizon itself is ~2.6x smaller than the shadow we see
        const horizon = mk('circle', { cx, cy, r: r / 2.6, fill: 'none', stroke: '#7f93bd', 'stroke-width': 2.5, 'stroke-dasharray': '6 7', opacity: 0 }, g);
        if (disk) {
          // near half of the disk crosses in front of the shadow
          const fg = g0('', g); fg.setAttribute('clip-path', `url(#${id}-front)`);
          mk('path', { d: band(r * 1.15, r * 3.1, tilt * 1.15), fill: doppler, 'fill-rule': 'evenodd' }, fg);
          streakSet(fg);
          mk('ellipse', { cx, cy, rx: r * 1.18, ry: r * 1.18 * tilt * 1.15, fill: 'none', stroke: '#fffaf0', 'stroke-width': r * 0.04, opacity: 0.9 }, fg);
        }
        // matter spiralling in (hidden while it passes behind the shadow)
        const bits = disk ? Array.from({ length: 18 }, (_, i) => mk('circle', { r: r * 0.025 + (i % 3), fill: '#fff3d6' }, g)) : [];
        pop(g, t0, 0.9);
        const spin = o.speed ?? 1;
        frameFns.push(t => {
          streaks.forEach(({ e, k }) => e.setAttribute('stroke-dashoffset', (-t * r * 1.6 * spin / Math.sqrt(k)).toFixed(1)));
          if (lensTop) { lensTop.setAttribute('opacity', (0.88 + 0.08 * Math.sin(t * 3.1)).toFixed(2)); lensBottom.setAttribute('opacity', (0.5 + 0.12 * Math.sin(t * 2.3 + 1)).toFixed(2)); }
          bits.forEach((p, i) => {
            const k = (t * 0.09 * spin + i / bits.length) % 1, rr = r * (3 - k * 1.85), a = -(i * 2.1 + t * spin * (0.8 + k * 2.4));
            const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * tilt;
            p.setAttribute('cx', x.toFixed(1)); p.setAttribute('cy', y.toFixed(1));
            p.setAttribute('opacity', (Math.sin(a) < 0 && Math.abs(x - cx) < r ? 0 : 1 - k).toFixed(2));
          });
        });
        // optional callouts (the geometry is known, so the pointers are exact)
        const L = o.labels === true ? ['horizon', 'photon', 'disk'] : Array.isArray(o.labels) ? o.labels : [];
        const la = T(o.labelAt ?? t0 + 1.2);
        if (L.includes('horizon')) tl.to(horizon, { opacity: 0.9, duration: 0.4 }, la);
        if (L.includes('horizon')) leader(g, cx - r * 0.27, cy - r * 0.27, cx - R * 0.95, cy - R * 0.55, o.horizonLabel || 'Chân trời sự kiện', la, '#ffffff');
        if (L.includes('photon')) leader(g, cx + r * 0.75, cy - r * 0.75, cx + R * 0.95, cy - R * 0.6, o.photonLabel || 'Vòng photon', la + 0.5, '#ffe2a8');
        if (L.includes('disk') && disk) leader(g, cx + r * 2.6, cy + r * 0.2, cx + R * 0.95, cy + R * 0.45, o.diskLabel || 'Đĩa bồi tụ', la + 1, '#ffc46b');
        if (o.label) gfx.label(o.label, { x: cx, y: Math.min(z.y1 - 10, cy + R * 0.62), at: t0 + 1, size: 32 });
        return { el: g };
      },

      /**
       * Barred spiral galaxy like the Milky Way: logarithmic arms (2 major + 2 minor), star clouds, dust lanes, pink star-forming
       * knots, glowing bulge. The disc rotates IN ITS OWN PLANE (rotate, then tilt), and the Sun marker rides along with it.
       */
      galaxy(o = {}) {
        begin(o);
        const z = gfx.zone(), cx = z.cx, cy = z.cy + 10, R = Math.min(z.w * 0.46, z.h * 1.05, 620), incl = o.tilt ?? 0.5;
        const g = g0('gfx-galaxy'), t0 = T(o.at), id = `gx${++bhN}`;
        const defs = mk('defs', {}, g);
        const rg = (gid, stops) => { const el = mk('radialGradient', { id: `${id}-${gid}` }, defs); stops.forEach(([off, col, op]) => mk('stop', { offset: off, 'stop-color': col, 'stop-opacity': op }, el)); return `url(#${id}-${gid})`; };
        const disc = mk('g', { transform: `translate(${cx},${cy}) scale(1,${incl})` }, g), rot = mk('g', {}, disc);
        mk('circle', { r: R * 1.02, fill: rg('halo', [[0, '#c9b8ff', 0.35], [0.55, '#8f7cf0', 0.12], [1, '#8f7cf0', 0]]) }, rot);
        mk('ellipse', { rx: R * 0.26, ry: R * 0.09, fill: rg('bar', [[0, '#fff1c9', 0.9], [1, '#ffd98a', 0]]), transform: 'rotate(28)' }, rot);
        const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
        const pitch = Math.tan((13 * Math.PI) / 180);
        [[0, 1, 420], [Math.PI, 1, 420], [Math.PI / 2, 0.6, 200], [-Math.PI / 2, 0.6, 200]].forEach(([phase, weight, count], arm) => {
          for (let i = 0; i < count; i++) {
            const k = i / count, theta = k * 3.6 * Math.PI, rr = R * 0.16 * Math.exp(pitch * theta * 0.95);
            if (rr > R * 0.98) break;
            const spread = R * 0.05 * (0.5 + k) * (rnd(i + arm * 999) - 0.5) * 2, a = theta + phase + 0.5 + spread / Math.max(rr, 1);
            const x = Math.cos(a) * (rr + spread), y = Math.sin(a) * (rr + spread), big = rnd(i * 3 + arm) > 0.92;
            mk('circle', { cx: x, cy: y, r: (big ? 3.2 : 1.6 + rnd(i + 7) * 1.4) * (0.7 + weight * 0.5), fill: big ? '#ffffff' : rnd(i + 5) > 0.5 ? '#cfe0ff' : '#e9ddff', opacity: 0.35 + 0.6 * (1 - k) * weight }, rot);
            if (i % 9 === 0) mk('circle', { cx: Math.cos(a - 0.06) * rr * 0.97, cy: Math.sin(a - 0.06) * rr * 0.97, r: 3 + rnd(i) * 3, fill: '#3a2a3f', opacity: 0.18 * weight }, rot); // dust lane
            if (weight === 1 && i % 37 === 11) mk('circle', { cx: x, cy: y, r: 4 + rnd(i) * 3, fill: '#ff8fc7', opacity: 0.7 }, rot); // star-forming knot
          }
        });
        // bulge: a spheroid, so it stays round-ish instead of being flattened with the disc
        mk('ellipse', { cx, cy, rx: R * 0.2, ry: R * 0.15, fill: rg('bulge', [[0, '#fffbe8', 1], [0.35, '#ffe9a8', 0.85], [1, '#ffcf6b', 0]]) }, g);
        fade(g, t0, 1);
        const w = (o.speed ?? 1) * 5, sunR = R * 0.42, sunA = 2.3;
        let marker = null, mDot = null, mLine = null;
        if (o.youAreHere !== false) {
          marker = g0('', g);
          mDot = mk('circle', { r: 11, fill: C.orange, stroke: '#fff', 'stroke-width': 3 }, marker);
          mLine = mk('line', { stroke: '#fff', 'stroke-width': 3 }, marker);
          const lx = z.x0 + 40, ly = z.y1 - 40;
          text(marker, lx, ly, 30, o.markerLabel || 'Hệ Mặt Trời', '#fff', 800, 'start');
          mLine.setAttribute('x2', lx + 40); mLine.setAttribute('y2', ly - 34);
          fade(marker, t0 + 1.5);
        }
        frameFns.push(t => {
          const ang = Math.max(0, t - t0) * w;
          rot.setAttribute('transform', `rotate(${ang})`);
          if (mDot) { const a = sunA + (ang * Math.PI) / 180, x = cx + Math.cos(a) * sunR, y = cy + Math.sin(a) * sunR * incl; mDot.setAttribute('cx', x); mDot.setAttribute('cy', y); mLine.setAttribute('x1', x); mLine.setAttribute('y1', y); }
        });
        return { el: g, marker };
      },
      /** Eight moon phases in order, lit side facing the sun (left→right = new → full → new). */
      moonPhases(o = {}) {
        begin(o);
        const z = gfx.zone(), n = 8, slot = z.w / n, r = Math.min(slot * 0.36, 70), y = z.cy + 10;
        const g = g0('gfx-moonphases'), t0 = T(o.at);
        const names = ['Trăng mới', 'Lưỡi liềm đầu', 'Bán nguyệt đầu', 'Trăng khuyết đầu', 'Trăng tròn', 'Trăng khuyết cuối', 'Bán nguyệt cuối', 'Lưỡi liềm cuối'];
        for (let i = 0; i < n; i++) {
          const p = i / n, x = z.x0 + slot * (i + 0.5), mg = g0('', g);
          mk('circle', { cx: x, cy: y, r, fill: '#2f3548' }, mg);
          const c = Math.cos(2 * Math.PI * p), rx = Math.abs(c) * r, waxing = p <= 0.5;
          if (i !== 0) {
            const side = waxing ? 1 : 0, bulge = (waxing ? c < 0 : c < 0) ? 1 : 0;
            mk('path', { d: `M${x},${y - r} A${r},${r} 0 0 ${side} ${x},${y + r} A${rx},${r} 0 0 ${waxing ? (c > 0 ? 0 : 1) : (c > 0 ? 1 : 0)} ${x},${y - r} Z`, fill: '#f4f1d0' }, mg);
          }
          if (o.labels !== false && (o.labels === 'all' || i % 2 === 0)) text(mg, x, y + r + 44 + (o.labels === 'all' && i % 2 ? 34 : 0), Math.min(28, slot / 5), names[i], o.dark ? '#fff' : C.ink, 800);
          pop(mg, t0 + i * (o.stagger ?? 0.25), 0.4);
        }
        return { el: g };
      },

      /** Supply & demand with an animated shift and the new equilibrium. shift: demand-up|demand-down|supply-up|supply-down */
      supplyDemand(o = {}) {
        begin(o);
        const z = gfx.zone(), X = z.x0 + 80, Y = z.y1 - 40, W = Math.min(z.w - 160, 900), H = z.h - 110;
        const g = g0('gfx-sd'), t0 = T(o.at);
        const ax = mk('path', { d: `M${X},${Y - H} L${X},${Y} L${X + W},${Y}`, stroke: C.ink, 'stroke-width': 6, fill: 'none' }, g);
        draw(ax, t0, 0.6);
        text(g, X - 24, Y - H + 10, 34, o.yLabel || 'Giá', C.ink, 900, 'end'); text(g, X + W, Y + 50, 34, o.xLabel || 'Lượng', C.ink, 900, 'end');
        const line = (x1, y1, x2, y2, col, dash) => mk('line', { x1, y1, x2, y2, stroke: col, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-dasharray': dash || null }, g);
        const S = [[X + W * 0.1, Y - H * 0.1], [X + W * 0.9, Y - H * 0.9]], D = [[X + W * 0.1, Y - H * 0.9], [X + W * 0.9, Y - H * 0.1]];
        const s1 = line(...S[0], ...S[1], C.teal), d1 = line(...D[0], ...D[1], C.orange);
        draw(s1, t0 + 0.5, 0.8); draw(d1, t0 + 0.9, 0.8);
        text(g, S[1][0] + 16, S[1][1], 36, o.supplyLabel || 'Cung', C.teal, 900, 'start'); text(g, D[1][0] + 16, D[1][1] + 10, 36, o.demandLabel || 'Cầu', C.orange, 900, 'start');
        const eq = (x, y, at, lab) => { const e = g0('', g); mk('line', { x1: X, y1: y, x2: x, y2: y, stroke: C.greyD, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, e); mk('line', { x1: x, y1: y, x2: x, y2: Y, stroke: C.greyD, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, e); mk('circle', { cx: x, cy: y, r: 14, fill: C.ink }, e); text(e, x + 20, y - 18, 30, lab, C.ink, 900, 'start'); pop(e, at, 0.4); return e; };
        eq(X + W * 0.5, Y - H * 0.5, t0 + 1.6, 'E');
        if (o.shift) {
          const at = T(o.shiftAt ?? t0 + 3), dx = W * 0.2 * (/(up)$/.test(o.shift) ? 1 : -1), isD = o.shift.startsWith('demand');
          const base = isD ? D : S, col = isD ? C.orange : C.teal;
          const nl = line(base[0][0], base[0][1], base[1][0], base[1][1], col); nl.setAttribute('opacity', 0.9);
          (isD ? d1 : s1).setAttribute('stroke-opacity', 1);
          tl.fromTo(nl, { attr: { x1: base[0][0], x2: base[1][0] } }, { attr: { x1: base[0][0] + dx, x2: base[1][0] + dx }, duration: 1.2, ease: 'power2.inOut' }, at);
          tl.to(isD ? d1 : s1, { strokeOpacity: 0.3, duration: 0.5 }, at);
          // new equilibrium: intersection after shift
          const ex = X + W * 0.5 + dx / 2, ey = Y - H * 0.5 - (isD ? 1 : -1) * dx / 2 * (H / W);
          eq(ex, ey, at + 1.2, "E'");
          const up = ey < Y - H * 0.5;
          gfx.label(up ? (o.priceUpLabel || 'Giá tăng') : (o.priceDownLabel || 'Giá giảm'), { x: X + W * 0.2, y: Math.min(ey, Y - H * 0.5) - 50, at: at + 1.6, size: 32, color: up ? 'red' : 'teal' });
        }
        return { el: g };
      },

      /** Candlestick chart that builds candle by candle. trend: up | down | crash | volatile */
      candles(o = {}) {
        begin(o);
        const z = gfx.zone(), n = o.count || 22, X = z.x0 + 50, W = z.w - 100, Y = z.y1 - 40, H = z.h - 120;
        const g = g0('gfx-candles'), t0 = T(o.at), dur = o.dur || 3;
        mk('rect', { x: X - 30, y: Y - H - 30, width: W + 60, height: H + 60, rx: 20, fill: '#1f2433' }, g);
        let seed = 7, v = 50; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const drift = { up: 1.6, down: -1.6, crash: 0.8, volatile: 0 }[o.trend || 'up'] ?? 1;
        const data = Array.from({ length: n }, (_, i) => { const d = o.trend === 'crash' && i > n * 0.6 ? -6 : drift; const open = v, close = v + d + (rnd() - 0.5) * 10; v = close; return { open, close, hi: Math.max(open, close) + rnd() * 5, lo: Math.min(open, close) - rnd() * 5 }; });
        const lo = Math.min(...data.map(d => d.lo)), hi = Math.max(...data.map(d => d.hi)), sy = val => Y - ((val - lo) / (hi - lo || 1)) * H;
        const cw = W / n;
        data.forEach((d, i) => {
          const x = X + cw * (i + 0.5), up = d.close >= d.open, col = up ? '#3fb950' : '#f85149', cg = g0('', g);
          mk('line', { x1: x, y1: sy(d.hi), x2: x, y2: sy(d.lo), stroke: col, 'stroke-width': 3 }, cg);
          mk('rect', { x: x - cw * 0.3, y: sy(Math.max(d.open, d.close)), width: cw * 0.6, height: Math.max(3, Math.abs(sy(d.open) - sy(d.close))), rx: 2, fill: col }, cg);
          tl.fromTo(cg, { opacity: 0, scaleY: 0, transformOrigin: `${x}px ${sy(d.open)}px` }, { opacity: 1, scaleY: 1, duration: 0.25 }, t0 + (i / n) * dur);
        });
        return { el: g, last: data[n - 1] };
      },

      /** Simple circuit: battery, switch, bulb; electrons flow once the switch closes at `onAt`. */
      circuit(o = {}) {
        begin(o);
        const z = gfx.zone(), W = Math.min(z.w * 0.7, 760), H = Math.min(z.h * 0.6, 420), X = z.cx - W / 2, Y = z.cy - H / 2 + 30;
        const g = g0('gfx-circuit'), t0 = T(o.at), onAt = T(o.onAt ?? t0 + 1.5);
        const wire = mk('path', { d: `M${X},${Y + H * 0.35} L${X},${Y} L${X + W},${Y} L${X + W},${Y + H} L${X},${Y + H} L${X},${Y + H * 0.65}`, stroke: C.ink, 'stroke-width': 10, fill: 'none', 'stroke-linejoin': 'round' }, g);
        draw(wire, t0, 1);
        const bat = g0('', g); mk('rect', { x: X - 60, y: Y + H * 0.35, width: 120, height: H * 0.3, rx: 12, fill: C.gold }, bat); mk('rect', { x: X - 60, y: Y + H * 0.35, width: 120, height: H * 0.1, rx: 10, fill: C.red }, bat); text(bat, X, Y + H * 0.35 + 36, 34, '+', '#fff', 900); text(bat, X, Y + H * 0.62, 40, '−', C.ink, 900); pop(bat, t0 + 0.3);
        const bulb = g0('', g); const bx = X + W, by = Y + H * 0.5;
        const glow = mk('circle', { cx: bx, cy: by, r: 90, fill: C.yellow, opacity: 0 }, bulb);
        const glass = mk('circle', { cx: bx, cy: by, r: 46, fill: '#eef1f5', stroke: C.greyD, 'stroke-width': 5 }, bulb);
        mk('path', { d: `M${bx - 16},${by + 10} q8,-24 16,0 q8,-24 16,0`, stroke: C.greyD, 'stroke-width': 4, fill: 'none' }, bulb);
        pop(bulb, t0 + 0.5);
        const sw = g0('', g); const sx = X + W * 0.5; mk('circle', { cx: sx - 40, cy: Y, r: 10, fill: C.ink }, sw); mk('circle', { cx: sx + 40, cy: Y, r: 10, fill: C.ink }, sw);
        const lever = mk('line', { x1: sx - 40, y1: Y, x2: sx + 34, y2: Y - 44, stroke: C.red, 'stroke-width': 10, 'stroke-linecap': 'round' }, sw);
        pop(sw, t0 + 0.7);
        tl.to(lever, { attr: { x2: sx + 40, y2: Y }, duration: 0.3, ease: 'power2.in' }, onAt);
        tl.to(glow, { opacity: 0.45, duration: 0.3 }, onAt + 0.2); tl.to(glass, { attr: { fill: '#ffe066' }, duration: 0.3 }, onAt + 0.2);
        const len = wire.getTotalLength(), es = Array.from({ length: 14 }, () => mk('circle', { r: 8, fill: C.gold, stroke: '#fff', 'stroke-width': 2, opacity: 0 }, g));
        frameFns.push(t => es.forEach((e, i) => { if (t < onAt) { e.setAttribute('opacity', 0); return; } const p = wire.getPointAtLength((((t - onAt) * 0.12 + i / es.length) % 1) * len); e.setAttribute('cx', p.x); e.setAttribute('cy', p.y); e.setAttribute('opacity', 1); }));
        if (o.labels !== false) { gfx.label('Pin', { x: X - 120, y: Y + H * 0.5, at: t0 + 0.4, size: 30 }); gfx.label('Công tắc', { x: sx, y: Y - 80, at: t0 + 0.8, size: 30 }); gfx.label('Bóng đèn', { x: bx, y: by + 90, at: t0 + 0.6, size: 30 }); }
        return { el: g };
      },

      /** Neural network: layers of nodes, edges, signal pulses travelling input → output. */
      neuralNet(o = {}) {
        begin(o);
        const layers = o.layers || [3, 5, 5, 2], z = gfx.zone(), g = g0('gfx-nn'), t0 = T(o.at);
        const L = layers.length, lx = i => z.x0 + 80 + (i / (L - 1)) * (z.w - 160);
        const pos = layers.map((n, i) => Array.from({ length: n }, (_, k) => [lx(i), z.cy + 20 + (k - (n - 1) / 2) * Math.min(110, (z.h - 120) / Math.max(...layers))]));
        const edges = [];
        for (let i = 0; i < L - 1; i++) for (const a of pos[i]) for (const b of pos[i + 1]) { const e = mk('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#8b93a6', 'stroke-opacity': 0.35, 'stroke-width': 3 }, g); edges.push([e, a, b, i]); fade(e, t0 + 0.3 + i * 0.3, 0.4); }
        const cols = [C.blue, C.purple, C.purple, C.teal, C.orange];
        pos.forEach((ly, i) => ly.forEach(([x, y]) => { const c = mk('circle', { cx: x, cy: y, r: 26, fill: i === 0 ? C.blue : i === L - 1 ? C.orange : C.purple, stroke: '#fff', 'stroke-width': 5 }, g); pop(c, t0 + i * 0.3, 0.35); }));
        const pulses = edges.filter((_, i) => i % 3 === 0).map(([, a, b, i]) => ({ a, b, i, el: mk('circle', { r: 7, fill: C.gold, opacity: 0 }, g) }));
        const start = t0 + L * 0.3;
        frameFns.push(t => pulses.forEach(p => { const cyc = ((t - start) * 0.8) % L; const k = cyc - p.i; if (t < start || k < 0 || k > 1) { p.el.setAttribute('opacity', 0); return; } p.el.setAttribute('cx', p.a[0] + (p.b[0] - p.a[0]) * k); p.el.setAttribute('cy', p.a[1] + (p.b[1] - p.a[1]) * k); p.el.setAttribute('opacity', 1); }));
        if (o.labels !== false) { gfx.label(o.inputLabel || 'Đầu vào', { x: lx(0), y: z.y1 - 10, at: t0, size: 28 }); gfx.label(o.outputLabel || 'Đầu ra', { x: lx(L - 1), y: z.y1 - 10, at: t0 + L * 0.3, size: 28 }); }
        return { el: g };
      },

      /** Devices → router → internet/cloud → server, with data packets travelling both ways. */
      network(o = {}) {
        begin(o);
        const z = gfx.zone(), t0 = T(o.at), s = Math.min(170, z.w / 6);
        const pts = { phone: [z.x0 + s * 0.7, z.cy - 60], laptop: [z.x0 + s * 0.7, z.cy + 170], router: [z.x0 + z.w * 0.38, z.cy + 90], cloud: [z.x0 + z.w * 0.65, z.cy - 20], server: [z.x1 - s * 0.7, z.cy + 160] };
        const items = {};
        [['phone', 'phone', 'Điện thoại'], ['laptop', 'laptop', 'Máy tính'], ['router', 'router', 'Bộ định tuyến'], ['cloud', 'cloud-server', 'Internet'], ['server', 'server', 'Máy chủ']].forEach(([k, it, lab], i) => { items[k] = gfx.item(it, { x: pts[k][0], y: pts[k][1] + s / 2, size: s, at: t0 + i * 0.35, label: o.labels === false ? null : lab, labelSize: 26 }); });
        [['phone', 'router'], ['laptop', 'router'], ['router', 'cloud'], ['cloud', 'server']].forEach(([a, b], i) => {
          const [x1, y1] = pts[a], [x2, y2] = pts[b];
          const ar = gfx.arrow({ from: [x1 + s * 0.45, y1], to: [x2 - s * 0.45, y2], at: t0 + 1.2 + i * 0.3, curve: 0.08, width: 8, color: 'grey' });
          gfx.stream(ar.path, { item: 'envelope', at: t0 + 1.8 + i * 0.3, size: 40, count: 2, speed: 0.5 });
        });
        return { items };
      },

      /** Orthographic globe that spins to a country; highlight: { 'Vietnam': 'red', ... } (real borders). */
      globe(o = {}) {
        begin(o);
        const topo = window.__rt?.world;
        const z = gfx.zone(), R = Math.min(z.h * 0.46, z.w * 0.4, 320), cx = z.cx, cy = z.cy + 10;
        const g = g0('gfx-globe'), t0 = T(o.at);
        if (!topo || !window.topojson || !window.d3) { window.__rt?.warn?.('Không tải được dữ liệu bản đồ cho globe()'); return { el: g }; }
        const feats = topojson.feature(topo, topo.objects.countries).features.filter(f => d3.geoArea(f) < 2 * Math.PI);
        const aliases = { 'Mỹ': 'United States of America', 'Hoa Kỳ': 'United States of America', USA: 'United States of America', 'Trung Quốc': 'China', 'Việt Nam': 'Vietnam', 'Nga': 'Russia', 'Nhật Bản': 'Japan', 'Hàn Quốc': 'South Korea', 'Ấn Độ': 'India', 'Anh': 'United Kingdom', 'Pháp': 'France', 'Đức': 'Germany', 'Úc': 'Australia', 'Thái Lan': 'Thailand', 'Lào': 'Laos', 'Campuchia': 'Cambodia', 'Ukraina': 'Ukraine', 'Brazil': 'Brazil', 'Ai Cập': 'Egypt' };
        const name = n => aliases[n] || n;
        const hl = {}; for (const [k, v] of Object.entries(o.highlight || {})) hl[name(k)] = pal(v) || C.orange;
        const focusF = feats.find(f => f.properties.name === name(o.focus || Object.keys(o.highlight || {})[0] || 'Vietnam'));
        const [flon, flat] = focusF ? d3.geoCentroid(focusF) : [105, 16];
        const proj = d3.geoOrthographic().scale(R).translate([cx, cy]).clipAngle(90), path = d3.geoPath(proj);
        mk('circle', { cx, cy, r: R + 14, fill: C.blue, opacity: 0.18 }, g);
        const ocean = mk('circle', { cx, cy, r: R, fill: '#3b82d6' }, g);
        const grat = mk('path', { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.15, 'stroke-width': 1.5 }, g);
        const paths = feats.map(f => ({ f, el: mk('path', { fill: hl[f.properties.name] || '#6fbf73', stroke: '#2f6f3a', 'stroke-width': 0.8 }, g) }));
        mk('path', { d: `M${cx - R * 0.6},${cy - R * 0.55} A${R * 0.9},${R * 0.9} 0 0 1 ${cx + R * 0.1},${cy - R * 0.85}`, stroke: '#fff', 'stroke-width': 14, fill: 'none', opacity: 0.18, 'stroke-linecap': 'round' }, g);
        pop(g, t0, 0.7);
        const graticule = d3.geoGraticule10(), st = { lon: o.fromLon ?? flon - 120, lat: 0 };
        tl.to(st, { lon: flon, lat: Math.max(-40, Math.min(40, flat)), duration: o.dur || 2.4, ease: 'power2.inOut' }, t0 + 0.3);
        let marker = null;
        if (o.label !== false && focusF) marker = gfx.label(o.label || (o.focus || 'Việt Nam'), { x: cx, y: cy - R * 0.1 - 60, at: t0 + (o.dur || 2.4) + 0.3, size: 34, color: 'red' });
        frameFns.push(t => { proj.rotate([-st.lon, -st.lat]); grat.setAttribute('d', path(graticule) || ''); paths.forEach(p => p.el.setAttribute('d', path(p.f) || '')); });
        return { el: g, marker };
      },

      /** Flat world map with curved routes between countries and items travelling on them. */
      routes(o = {}) {
        begin(o);
        const topo = window.__rt?.world, z = gfx.zone(), g = g0('gfx-routes'), t0 = T(o.at);
        if (!topo || !window.topojson) { window.__rt?.warn?.('Không tải được dữ liệu bản đồ cho routes()'); return { el: g }; }
        const feats = topojson.feature(topo, topo.objects.countries).features.filter(f => d3.geoArea(f) < 2 * Math.PI);
        const proj = d3.geoNaturalEarth1().fitExtent([[z.x0, z.y0], [z.x1, z.y1 - 20]], { type: 'Sphere' }), path = d3.geoPath(proj);
        const by = n => feats.find(f => f.properties.name === n || f.properties.name === ({ 'Mỹ': 'United States of America', 'Việt Nam': 'Vietnam', 'Trung Quốc': 'China', 'Nhật Bản': 'Japan', 'Hàn Quốc': 'South Korea', 'Nga': 'Russia', 'Ấn Độ': 'India', 'Đức': 'Germany', 'Anh': 'United Kingdom', 'Pháp': 'France', 'Úc': 'Australia' })[n]);
        const hl = new Set([o.from, ...(o.to || [])].map(n => by(n)?.properties.name));
        feats.forEach(f => mk('path', { d: path(f), fill: hl.has(f.properties.name) ? C.orange : '#cfd5e1', stroke: '#fff', 'stroke-width': 0.8 }, g));
        fade(g, t0, 0.6);
        const a = by(o.from); if (!a) return { el: g };
        const [ax, ay] = proj(d3.geoCentroid(a));
        (o.to || []).forEach((n, i) => {
          const b = by(n); if (!b) return;
          const [bx, by2] = proj(d3.geoCentroid(b)), mx = (ax + bx) / 2, my = Math.min(ay, by2) - Math.abs(bx - ax) * 0.25;
          const p = mk('path', { d: `M${ax},${ay} Q${mx},${my} ${bx},${by2}`, fill: 'none', stroke: pal(o.color) || C.red, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
          const at = t0 + 0.8 + i * 0.5; draw(p, at, 1);
          if (o.token) gfx.stream(p, { item: o.token, at: at + 1, size: 50, count: 2, speed: 0.35 });
          if (o.labels) gfx.label(o.labels[i] || n, { x: bx, y: by2 - 40, at: at + 0.8, size: 28 });
        });
        if (o.fromLabel) gfx.label(o.fromLabel, { x: ax, y: ay - 40, at: t0 + 0.6, size: 30, color: 'red' });
        return { el: g };
      },

      /** Human body silhouette with organs; highlight: 'heart'|'lungs'|'brain'|'stomach'|'liver'|'kidneys'|'intestines'. */
      body(o = {}) {
        begin(o);
        const z = gfx.zone(), H = z.h - 30, s = H / 700, cx = z.x0 + z.w * 0.4, top = z.y0 + 10;
        const g = g0('gfx-body'), t0 = T(o.at), P = (x, y) => [cx + x * s, top + y * s];
        const sil = g0('', g), skin = '#ffe1d6';
        mk('circle', { cx: P(0, 60)[0], cy: P(0, 60)[1], r: 55 * s, fill: skin }, sil);
        mk('rect', { x: P(-95, 130)[0], y: P(0, 130)[1], width: 190 * s, height: 280 * s, rx: 70 * s, fill: skin }, sil);
        [[-130, 150, -60], [130, 150, 60]].forEach(([x, y, a]) => mk('rect', { x: P(x - 22, y)[0], y: P(0, y)[1], width: 44 * s, height: 250 * s, rx: 22 * s, fill: skin, transform: `rotate(${a * 0.15} ${P(x, y)[0]} ${P(x, y)[1]})` }, sil));
        [-50, 50].forEach(x => mk('rect', { x: P(x - 30, 380)[0], y: P(0, 380)[1], width: 60 * s, height: 310 * s, rx: 30 * s, fill: skin }, sil));
        fade(sil, t0, 0.5);
        const organs = {
          brain: ['M-40,45 Q-45,10 0,8 Q45,10 40,45 Q30,60 0,58 Q-30,60 -40,45 Z', '#f28bb0', 'Não'],
          lungs: ['M-12,170 Q-80,160 -78,240 Q-76,290 -30,280 Q-12,270 -12,230 Z M12,170 Q80,160 78,240 Q76,290 30,280 Q12,270 12,230 Z', '#f5a3b5', 'Phổi'],
          heart: ['M18,262 C-40,232 -30,190 0,200 C8,188 40,190 36,220 C34,240 26,252 18,262 Z', '#e8574b', 'Tim'],
          liver: ['M-80,285 Q-20,270 30,290 Q10,320 -70,318 Q-86,300 -80,285 Z', '#a8473a', 'Gan'],
          stomach: ['M20,290 Q70,285 64,320 Q58,352 20,345 Q0,338 10,316 Z', '#f0a060', 'Dạ dày'],
          kidneys: ['M-58,320 q-18,10 -10,30 q10,8 18,-10 Z M58,320 q18,10 10,30 q-10,8 -18,-10 Z', '#8a4a3a', 'Thận'],
          intestines: ['M-60,350 Q0,340 60,350 Q70,380 40,395 Q0,405 -40,395 Q-70,380 -60,350 Z', '#e8a07a', 'Ruột'],
        };
        const show = o.organs || Object.keys(organs), res = {};
        show.forEach((k, i) => {
          const [d, col, lab] = organs[k] || []; if (!d) return;
          const og = g0('', g);
          const pth = mk('path', { d, fill: col, transform: `translate(${cx},${top}) scale(${s})` }, og);
          const at = o.organAt?.[k] ?? t0 + 0.5 + i * 0.25;
          fade(og, at, 0.4);
          if (o.highlight === k) { tl.to(og, { scale: 1.12, transformOrigin: '50% 50%', duration: 0.3, yoyo: true, repeat: 5 }, T(o.highlightAt ?? at + 1)); leader(g, cx + 30 * s, top + ({ brain: 30, lungs: 220, heart: 225, liver: 300, stomach: 318, kidneys: 335, intestines: 375 }[k]) * s, cx + 260 * s, top + 150 * s, o.label || lab, T(o.highlightAt ?? at + 1), C.red); }
          res[k] = og;
        });
        return { el: g, organs: res };
      },

      /** Stacked pyramid of levels (bottom = first item): Maslow, food pyramid, social classes... */
      pyramid(o = {}) {
        begin(o);
        const levels = o.levels || ['Cơ bản', 'An toàn', 'Xã hội', 'Tôn trọng', 'Hoàn thiện'], n = levels.length;
        const z = gfx.zone(), H = z.h - 40, W = Math.min(z.w * 0.85, H * 1.3), cx = z.cx, base = z.y1 - 10, lh = H / n;
        const g = g0('gfx-pyramid'), t0 = T(o.at), cols = [C.blue, C.teal, C.green, C.gold, C.orange, C.red, C.purple];
        levels.forEach((lab, i) => {
          const y1 = base - i * lh, y0 = y1 - lh + 6, w1 = W * (1 - i / n), w0 = W * (1 - (i + 1) / n), lg = g0('', g);
          mk('path', { d: `M${cx - w1 / 2},${y1} L${cx + w1 / 2},${y1} L${cx + w0 / 2},${y0} L${cx - w0 / 2},${y0} Z`, fill: pal(o.colors?.[i]) || cols[i % cols.length] }, lg);
          text(lg, cx, (y0 + y1) / 2 + 12, Math.min(34, lh * 0.4), lab, '#fff', 800);
          tl.fromTo(lg, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' }, (o.levelAt?.[i]) ?? t0 + i * (o.stagger ?? 0.5));
        });
        return { el: g };
      },

      /** Iceberg metaphor: small visible tip vs huge hidden part, with labels for each. */
      iceberg(o = {}) {
        begin(o);
        const z = gfx.zone(), cx = z.cx, wl = z.y0 + z.h * 0.32, W = Math.min(z.w * 0.6, 560), g = g0('gfx-iceberg'), t0 = T(o.at);
        mk('rect', { x: z.x0 - 40, y: wl, width: z.w + 80, height: z.y1 - wl + 40, fill: '#4f8ef7', opacity: 0.35 }, g);
        const tip = mk('path', { d: `M${cx - W * 0.2},${wl} L${cx - W * 0.05},${wl - z.h * 0.22} L${cx + W * 0.08},${wl - z.h * 0.12} L${cx + W * 0.2},${wl} Z`, fill: '#ffffff' }, g);
        const under = mk('path', { d: `M${cx - W * 0.22},${wl} L${cx + W * 0.22},${wl} L${cx + W * 0.5},${wl + z.h * 0.35} L${cx + W * 0.2},${z.y1 - 10} L${cx - W * 0.3},${z.y1 - 30} L${cx - W * 0.5},${wl + z.h * 0.3} Z`, fill: '#bfe3ff', opacity: 0.9 }, g);
        mk('line', { x1: z.x0 - 40, y1: wl, x2: z.x1 + 40, y2: wl, stroke: '#2f63c9', 'stroke-width': 4 }, g);
        pop(tip, t0, 0.5); fade(under, T(o.hiddenAt ?? t0 + 1.2), 0.8);
        if (o.top) gfx.label(o.top, { x: cx + W * 0.36, y: wl - z.h * 0.14, at: t0 + 0.4, size: 32 });
        (o.hidden || []).forEach((l, i) => gfx.label(l, { x: cx + (i % 2 ? W * 0.18 : -W * 0.18), y: wl + z.h * (0.18 + i * 0.13), at: T(o.hiddenAt ?? t0 + 1.2) + 0.4 + i * 0.4, size: 30, color: 'blue' }));
        return { el: g };
      },

      /** Two-set Venn diagram with left / right / overlap labels. */
      venn(o = {}) {
        begin(o);
        const z = gfx.zone(), r = Math.min(z.h * 0.4, z.w * 0.26), cx = z.cx, cy = z.cy + 10, d = r * 0.62, g = g0('gfx-venn'), t0 = T(o.at);
        const a = mk('circle', { cx: cx - d, cy, r, fill: C.blue, opacity: 0.55 }, g), b = mk('circle', { cx: cx + d, cy, r, fill: C.orange, opacity: 0.55 }, g);
        tl.fromTo(a, { attr: { cx: cx - d - 120 }, opacity: 0 }, { attr: { cx: cx - d }, opacity: 0.55, duration: 0.8, ease: 'power3.out' }, t0);
        tl.fromTo(b, { attr: { cx: cx + d + 120 }, opacity: 0 }, { attr: { cx: cx + d }, opacity: 0.55, duration: 0.8, ease: 'power3.out' }, t0 + 0.3);
        if (o.left) { const t = text(g, cx - d - r * 0.35, cy + 12, 36, o.left, '#fff', 900); fade(t, t0 + 0.6); }
        if (o.right) { const t = text(g, cx + d + r * 0.35, cy + 12, 36, o.right, '#fff', 900); fade(t, t0 + 0.9); }
        if (o.middle) gfx.label(o.middle, { x: cx, y: cy, at: T(o.middleAt ?? t0 + 1.4), size: 30 });
        return { el: g };
      },

      /** Funnel of narrowing stages with optional values. */
      funnel(o = {}) {
        begin(o);
        const st = o.stages || [], n = st.length || 1, z = gfx.zone(), W = Math.min(z.w * 0.8, 820), cx = z.cx, lh = (z.h - 40) / n, g = g0('gfx-funnel'), t0 = T(o.at), cols = [C.blue, C.teal, C.gold, C.orange, C.red];
        st.forEach((s, i) => {
          const y0 = z.y0 + 20 + i * lh, w0 = W * (1 - i / (n + 0.6)), w1 = W * (1 - (i + 1) / (n + 0.6)), sg = g0('', g);
          mk('path', { d: `M${cx - w0 / 2},${y0} L${cx + w0 / 2},${y0} L${cx + w1 / 2},${y0 + lh - 6} L${cx - w1 / 2},${y0 + lh - 6} Z`, fill: cols[i % cols.length] }, sg);
          text(sg, cx, y0 + lh / 2 + 12, Math.min(34, lh * 0.35), typeof s === 'string' ? s : `${s.label}${s.value != null ? ` · ${s.value}` : ''}`, '#fff', 800);
          tl.fromTo(sg, { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }, t0 + i * (o.stagger ?? 0.5));
        });
        return { el: g };
      },
    });
  });
})();
