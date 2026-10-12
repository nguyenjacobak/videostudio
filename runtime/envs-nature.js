/* Environments: nature, space, the microscopic world, digital space and an abstract backdrop for diagram shots. */
(function () {
  const K = window.EnvKit, C = window.Cartoon;
  if (!K || !C) return;
  const { X0, X1, mix, shade, f1, lg, rg, TIME, tone, haze, skyDefs, skyLayer, ridge, peaks, snowCaps, karst, treeRound, treePine, palm, grass, birds, stars, brightStars } = K;
  const WW = X1 - X0;
  const R = (name, fn) => C.registerSetting(name, fn);

  // ───────────────────────── sea / beach / port ─────────────────────────
  function waves(rnd, y0, y1, T, n = 7) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const y = y0 + (i / n) * (y1 - y0) + rnd() * 10, a = 8 + i * 4, len = 60 + i * 22;
      let d = '';
      for (let x = X0 - 200; x < X1 + 200; x += len * 2.4 + rnd() * 120) d += `M${f1(x)},${f1(y)} q${f1(len / 2)},${f1(-a)} ${f1(len)},0 `;
      s += `<g data-amb="wave" data-a="${f1(14 + i * 6)}" data-s="${f1(0.5 + rnd() * 0.4)}" data-p="${f1(rnd() * 6)}"><path d="${d}" fill="none" stroke="${T.dark ? '#5d74b8' : '#ffffff'}" stroke-width="${f1(2 + i * 0.7)}" stroke-linecap="round" opacity="${f1(0.25 + i * 0.07)}"/></g>`;
    }
    return s;
  }
  R('ocean', (o, rnd) => {
    const T = TIME(o.time), N = T.dark, v = o.variant || 'open';
    const sea0 = tone('#5fb8e6', T), sea1 = tone('#1f6fb2', T);
    const defs = skyDefs(T) + lg('e-sea', [[0, mix(sea0, T.haze, 0.35)], [0.35, sea0], [1, sea1]]) + lg('e-sand', [[0, tone('#f2dcaa', T)], [1, tone('#e2c48a', T)]]);
    const hz = 560;
    const sx = o.sunX ?? 1300;
    let sea = `<rect x="${X0}" y="${hz}" width="${WW}" height="700" fill="url(#e-sea)"/>`;
    sea += `<path d="M${X0},${hz} ${Array.from({ length: 9 }, (_, i) => `Q${X0 + i * 300 + 150},${hz - 18 - rnd() * 22} ${X0 + i * 300 + 300},${hz}`).join(' ')} Z" fill="${haze('#5f8f7a', T, 0.55)}"/>`;
    if (!N || true) for (let i = 0; i < 26; i++) sea += `<g data-amb="twinkle" data-s="${f1(2 + rnd() * 3)}" data-p="${f1(rnd() * 6)}" data-lo=".05"><rect x="${f1(sx - 60 + rnd() * 120 - (i % 2) * 40)}" y="${f1(hz + 10 + i * 14)}" width="${f1(30 + rnd() * 70)}" height="4" rx="2" fill="${T.sun}"/></g>`;
    sea += waves(rnd, hz + 30, 1040, T, 8);
    const layers = [
      { depth: 0.02, svg: skyLayer(T, rnd, { sunX: sx, sunY: T.name === 'sunset' ? 520 : 210, clouds: 4 }) + (N ? '' : birds(rnd, 4, 170, T)) },
      { depth: 0.35, svg: sea },
    ];
    let ground = 1000, lanes = { sea: { y: 700, depth: 0.45 }, near: { y: 860, depth: 0.12 }, horizon: { y: hz + 12, depth: 0.85 }, sky: { y: 220, depth: 0.7, air: true } }, spots = { sea: { x: 960, y: 760, depth: 0.35 }, horizon: { x: 1300, y: hz + 10, depth: 0.85 } };
    if (v === 'beach') {
      layers.push({ depth: 0.85, svg: `<path d="M${X0},880 Q600,840 1100,872 T${X1},860 L${X1},1200 L${X0},1200 Z" fill="url(#e-sand)"/><path d="M${X0},880 Q600,840 1100,872 T${X1},860" fill="none" stroke="#ffffff" stroke-width="10" opacity=".7" data-amb="wave" data-a="10" data-s=".7"/>` + palm(160, 920, 1.1, tone('#3f9a52', T)) + palm(1780, 900, 0.95, tone('#3f9a52', T)) + `<g transform="translate(1400,930)"><path d="M0,0 L0,-170" stroke="#6b4a2e" stroke-width="8"/><path d="M-120,-150 Q0,-230 120,-150 Z" fill="#e8574b"/><path d="M-120,-150 Q-60,-175 0,-150 Q60,-175 120,-150" fill="none" stroke="#fff" stroke-width="6"/></g>` });
      ground = 935; spots = { ...spots, beach: { x: 800 } };
    } else if (v === 'port') {
      let port = `<rect x="${X0}" y="820" width="${WW}" height="300" fill="${tone('#9aa0ab', T)}"/><rect x="${X0}" y="820" width="${WW}" height="16" fill="${tone('#7c828c', T)}"/>`;
      const cc = ['#e8574b', '#3f7fd6', '#f2b43a', '#58b36a', '#8b6bd6', '#e5677d'];
      for (let s = 0; s < 4; s++) for (let r = 0; r < 3 - (s % 2); r++) port += `<rect x="${1100 + s * 230}" y="${820 - (r + 1) * 66}" width="222" height="62" rx="3" fill="${tone(cc[(s * 3 + r) % 6], T)}"/>` + Array.from({ length: 9 }, (_, k) => `<line x1="${1112 + s * 230 + k * 23}" y1="${826 - (r + 1) * 66}" x2="${1112 + s * 230 + k * 23}" y2="${876 - (r + 1) * 66}" stroke="#000" stroke-opacity=".12" stroke-width="3"/>`).join('');
      port += [400, 900].map(x => `<g transform="translate(${x},820)"><rect x="-90" y="-520" width="22" height="520" fill="${tone('#f2b43a', T)}"/><rect x="68" y="-520" width="22" height="520" fill="${tone('#f2b43a', T)}"/><rect x="-200" y="-540" width="460" height="30" fill="${tone('#f2b43a', T)}"/><path d="M-90,-300 L90,-300 M-90,-140 L90,-140" stroke="${tone('#d99a1e', T)}" stroke-width="10"/><g data-amb="wave" data-a="60" data-s=".35"><rect x="-30" y="-510" width="60" height="26" fill="#454c5c"/><line x1="0" y1="-484" x2="0" y2="-330" stroke="#333" stroke-width="4"/><rect x="-60" y="-330" width="120" height="50" fill="${tone(cc[x % 5], T)}"/></g></g>`).join('');
      port += `<g data-amb="bob" data-a="3" data-s="1.1"><g transform="translate(-60,690)"><path d="M0,0 L760,0 L700,90 L40,90 Z" fill="${tone('#2f3f5e', T)}"/><rect x="0" y="-12" width="760" height="14" fill="${tone('#e8574b', T)}"/>${Array.from({ length: 10 }, (_, k) => `<rect x="${40 + (k % 5) * 120}" y="${-74 - Math.floor(k / 5) * 60}" width="112" height="58" fill="${tone(cc[k % 6], T)}"/>`).join('')}<rect x="640" y="-160" width="90" height="150" fill="${tone('#f3f3f3', T)}"/></g></g>`;
      layers.push({ depth: 0.8, svg: port });
      ground = 900; lanes = { ...lanes, dock: { y: 900, depth: 0 } }; spots = { ...spots, dock: { x: 600 }, crane: { x: 900, depth: 0.2 }, containers: { x: 1500, depth: 0.15 } };
    }
    return { actorScale: v === 'port' ? 0.55 : 0.6, ground, horizon: hz + 20, defs, dark: N, layers, lanes, spots };
  });

  // ───────────────────────── river (karst valley) ─────────────────────────
  R('river', (o, rnd) => {
    const T = TIME(o.time || 'day'), N = T.dark;
    const defs = skyDefs(T) + lg('e-riv', [[0, tone('#8fc9e4', T)], [1, tone('#3a86b8', T)]]) + lg('e-mist', [[0, T.haze, 0], [0.5, T.haze, 0.7], [1, T.haze, 0]]);
    const far = `<path d="${karst(rnd, 620, 0, 160, 380)}" fill="${haze('#6f9a86', T, 0.55)}"/><rect x="${X0}" y="500" width="${WW}" height="160" fill="url(#e-mist)" data-amb="drift" data-s="4"/>`;
    const banks = `<path d="${ridge(rnd, 660, 60, 200)}" fill="${haze('#7fae6a', T, 0.25)}"/>` + Array.from({ length: 6 }, (_, i) => treeRound(X0 + 150 + i * 420 + rnd() * 100, 668, 0.45 + rnd() * 0.2, haze('#4f9a48', T, 0.2))).join('');
    let river = `<rect x="${X0}" y="660" width="${WW}" height="240" fill="url(#e-riv)"/>`;
    for (let i = 0; i < 9; i++) { const y = 690 + i * 22; river += `<path d="M${X0},${y} H${X1}" stroke="#ffffff" stroke-width="${2 + i * 0.3}" stroke-dasharray="${40 + i * 10} ${90 + i * 20}" opacity="${0.18 + i * 0.03}" data-amb="flow" data-s="${f1(30 + i * 6)}"/>`; }
    river += `<path d="M${X0},${660} Q960,650 ${X1},664" fill="none" stroke="${tone('#5a8a4a', T)}" stroke-width="10"/>`;
    const reeds = (x0, x1, y) => { let s = ''; for (let x = x0; x < x1; x += 22 + rnd() * 20) { const h = 50 + rnd() * 60; s += `<g data-amb="sway" data-a="4" data-s="1.2" data-p="${f1(x % 9)}" data-cx="${f1(x)}" data-cy="${y}"><path d="M${f1(x)},${y} q${f1(-6 + rnd() * 12)},${f1(-h / 2)} ${f1(-4 + rnd() * 8)},${f1(-h)}" stroke="${tone('#6e8f3a', T)}" stroke-width="4" fill="none"/><ellipse cx="${f1(x)}" cy="${f1(y - h)}" rx="4" ry="12" fill="${tone('#8a6a3a', T)}"/></g>`; } return s; };
    const near = `<path d="M${X0},880 Q700,860 1100,890 T${X1},880 L${X1},1200 L${X0},1200 Z" fill="${tone('#7cb85a', T)}"/>${reeds(X0, 600, 896)}${reeds(1300, X1, 900)}${grass(rnd, 896, X0, X1, tone('#5a9a46', T), 22, 16)}`;
    return {
      actorScale: 0.55, ground: 930, horizon: 670, defs, dark: N,
      layers: [
        { depth: 0.03, svg: skyLayer(T, rnd, { sunX: 1500, clouds: 4 }) + birds(rnd, 4, 160, T) },
        { depth: 0.12, svg: far },
        { depth: 0.3, svg: banks },
        { depth: 0.6, svg: river },
        { depth: 0.92, svg: near },
      ],
      lanes: { river: { y: 790, depth: 0.25 }, far: { y: 700, depth: 0.55 }, bank: { y: 930, depth: 0 }, sky: { y: 230, depth: 0.7, air: true } },
      spots: { river: { x: 960, y: 790, depth: 0.25 }, bank: { x: 960 } },
    };
  });

  // ───────────────────────── underwater ─────────────────────────
  R('underwater', (o, rnd) => {
    const deep = o.variant === 'deep';
    const defs = lg('e-uw', [[0, deep ? '#0b3a63' : '#1b8ac2'], [0.55, deep ? '#06213f' : '#0f5c93'], [1, deep ? '#020c1c' : '#0a3a63']]) + lg('e-ray', [[0, '#ffffff', 0.32], [1, '#ffffff', 0]]);
    let water = `<rect x="${X0}" y="-100" width="${WW}" height="1300" fill="url(#e-uw)"/>`;
    if (!deep) { water += `<path d="M${X0},20 ${Array.from({ length: 16 }, (_, i) => `Q${X0 + i * 160 + 80},${i % 2 ? 6 : 34} ${X0 + i * 160 + 160},20`).join(' ')}" fill="none" stroke="#bfe8ff" stroke-width="5" opacity=".6" data-amb="wave" data-a="30" data-s=".6"/>`; for (let i = 0; i < 7; i++) { const x = X0 + 200 + i * 360 + rnd() * 100; water += `<path d="M${f1(x)},0 L${f1(x + 90)},0 L${f1(x + 300)},1100 L${f1(x - 120)},1100 Z" fill="url(#e-ray)" data-amb="pulse" data-s="${f1(0.4 + rnd() * 0.5)}" data-p="${f1(rnd() * 6)}" data-lo=".25"/>`; } }
    let fish = '';
    const fishShape = c => `<path d="M-26,0 Q0,-18 22,0 Q0,18 -26,0 Z" fill="${c}"/><path d="M20,0 L36,-12 L36,12 Z" fill="${c}"/><circle cx="-14" cy="-4" r="3" fill="#123"/>`;
    for (let s = 0; s < 3; s++) {
      const y = 260 + s * 170 + rnd() * 60, dir = s % 2 ? 1 : -1, c = ['#f2b43a', '#ff8a5a', '#8ad8ff'][s];
      let school = '';
      for (let k = 0; k < 9; k++) school += `<g transform="translate(${f1((k % 3) * 60 + rnd() * 20)},${f1(Math.floor(k / 3) * 34 + rnd() * 10)}) scale(${dir < 0 ? 1 : -1},1)">${fishShape(c)}</g>`;
      fish += `<g data-amb="move" data-x0="${X0 - 300}" data-x1="${X1 + 300}" data-s="${dir * (50 + rnd() * 40)}" data-p="${f1(rnd() * 2000)}" data-y="${f1(y)}"><g data-amb="bob" data-a="12" data-s="1.4">${school}</g></g>`;
    }
    let bed = `<path d="M${X0},900 Q500,860 960,890 T${X1},880 L${X1},1200 L${X0},1200 Z" fill="${deep ? '#1f2a3a' : '#d9c48c'}"/>`;
    for (let i = 0; i < 9; i++) { const x = X0 + 120 + i * 290 + rnd() * 80; bed += `<ellipse cx="${f1(x)}" cy="${f1(900 + rnd() * 30)}" rx="${f1(50 + rnd() * 50)}" ry="${f1(26 + rnd() * 20)}" fill="${deep ? '#2c3a4e' : '#8a8f9c'}"/>`; }
    const kelp = x => `<g data-amb="sway" data-a="7" data-s="${f1(0.6 + rnd() * 0.4)}" data-p="${f1(x % 7)}" data-cx="${f1(x)}" data-cy="900"><path d="M${f1(x)},900 C${f1(x - 30)},760 ${f1(x + 30)},640 ${f1(x - 10)},${f1(480 + rnd() * 80)}" fill="none" stroke="#2f8a4a" stroke-width="16" stroke-linecap="round"/>${[0, 1, 2, 3].map(k => `<ellipse cx="${f1(x + (k % 2 ? 22 : -22))}" cy="${f1(820 - k * 90)}" rx="26" ry="10" fill="#3fa65a" transform="rotate(${k % 2 ? -30 : 30} ${f1(x)} ${f1(820 - k * 90)})"/>`).join('')}</g>`;
    const coral = (x, c) => `<g transform="translate(${f1(x)},905)"><path d="M0,0 L0,-60 M0,-40 L-30,-80 M0,-50 L28,-96 M-30,-80 L-40,-110 M28,-96 L44,-120" stroke="${c}" stroke-width="16" stroke-linecap="round" fill="none"/></g>`;
    if (!deep) bed += kelp(X0 + 160) + kelp(260) + kelp(1720) + kelp(1960) + coral(560, '#ff7a8a') + coral(1300, '#ffa64d') + coral(1500, '#e56bd6');
    else bed += Array.from({ length: 14 }, () => `<g data-amb="twinkle" data-s="${f1(1 + rnd() * 2)}" data-p="${f1(rnd() * 6)}" data-lo=".1"><circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(200 + rnd() * 600)}" r="${f1(3 + rnd() * 5)}" fill="#7ff7ff"/></g>`).join('');
    let bubbles = '';
    for (let i = 0; i < 26; i++) bubbles += `<g data-amb="rise" data-h="${f1(500 + rnd() * 400)}" data-s="${f1(50 + rnd() * 60)}" data-p="${f1(rnd() * 800)}" data-a="10"><circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(900 + rnd() * 120)}" r="${f1(3 + rnd() * 8)}" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.75)" stroke-width="2"/></g>`;
    return {
      actorScale: 0.6, ground: 935, horizon: 640, defs, dark: true,
      layers: [
        { depth: 0.05, svg: water },
        { depth: 0.4, svg: fish },
        { depth: 0.85, svg: bed },
        { depth: 1.08, svg: bubbles, front: true },
      ],
      lanes: { water: { y: 480, depth: 0.3, air: true }, seabed: { y: 935, depth: 0 } },
      spots: { center: { x: 960, y: 500, depth: 0.3 }, seabed: { x: 960 } },
    };
  });

  // ───────────────────────── mountains / volcano ─────────────────────────
  R('mountains', (o, rnd) => {
    const T = TIME(o.time), N = T.dark, volcano = o.variant === 'volcano';
    const defs = skyDefs(T) + lg('e-mist', [[0, T.haze, 0], [0.5, T.haze, 0.75], [1, T.haze, 0]]) + rg('e-lava', [[0, '#ffd36b', 0.95], [0.5, '#ff6a2a', 0.6], [1, '#ff3a1a', 0]]);
    const r1 = peaks(rnd, 640, 420, 4), r2 = peaks(rnd, 700, 300, 5);
    let far = `<path d="${r1.d}" fill="${haze('#7f90b8', T, 0.55)}"/>${snowCaps(r1.peaks, mix('#ffffff', T.haze, 0.25))}<rect x="${X0}" y="520" width="${WW}" height="180" fill="url(#e-mist)" data-amb="drift" data-s="5"/>`;
    let mid = `<path d="${r2.d}" fill="${haze('#6a8aa0', T, 0.32)}"/>${snowCaps(r2.peaks, '#f4f8fb')}`;
    if (volcano) {
      mid += `<g transform="translate(980,700)"><path d="M-520,60 L-120,-380 L-60,-360 L0,-392 L60,-360 L120,-380 L520,60 Z" fill="${tone('#5a4a48', T)}"/><path d="M-90,-372 L0,-392 L90,-372 L60,-350 L-60,-350 Z" fill="#ff7a3c"/><circle cx="0" cy="-380" r="160" fill="url(#e-lava)" data-amb="pulse" data-s="2.5" data-lo=".6"/><path d="M-20,-360 Q-60,-240 -40,-120 Q-10,-40 -30,40" fill="none" stroke="#ff7a3c" stroke-width="18" stroke-linecap="round" opacity=".9"/><path d="M-20,-360 Q-60,-240 -40,-120 Q-10,-40 -30,40" fill="none" stroke="#ffd36b" stroke-width="6" stroke-linecap="round" stroke-dasharray="30 40" data-amb="flow" data-s="40"/></g>`;
      for (let i = 0; i < 10; i++) mid += `<g data-amb="rise" data-h="520" data-s="${f1(26 + rnd() * 14)}" data-p="${f1(i * 52)}" data-a="40"><circle cx="${f1(980 + (rnd() - 0.5) * 40)}" cy="300" r="${f1(50 + rnd() * 40)}" fill="${N ? '#4a4458' : '#8a8592'}" opacity=".8"/></g>`;
    }
    let forest = `<path d="${ridge(rnd, 760, 80, 220)}" fill="${tone('#4f7f5a', T)}"/>`;
    for (let x = X0; x < X1; x += 46 + rnd() * 30) forest += treePine(x, 780 + rnd() * 40, 0.42 + rnd() * 0.25, tone(rnd() < 0.5 ? '#2f6b46' : '#3a7a50', T));
    const meadow = `<path d="M${X0},880 Q700,850 1200,880 T${X1},870 L${X1},1200 L${X0},1200 Z" fill="${tone('#8cc972', T)}"/><path d="M800,1100 Q900,960 980,880 L1030,880 Q980,960 960,1100 Z" fill="${tone('#d9c49a', T)}"/>${grass(rnd, 888, X0, X1, tone('#5a9a46', T), 24, 16)}` + Array.from({ length: 30 }, () => `<circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(920 + rnd() * 140)}" r="5" fill="${['#ffffff', '#f2c14e', '#e5677d'][Math.floor(rnd() * 3)]}"/>`).join('');
    return {
      actorScale: 0.5, ground: 935, horizon: 700, defs, dark: N,
      layers: [
        { depth: 0.02, svg: skyLayer(T, rnd, { sunX: 1550, clouds: 3 }) + (N ? '' : birds(rnd, 4, 220, T)) },
        { depth: 0.1, svg: far },
        { depth: 0.25, svg: mid },
        { depth: 0.55, svg: forest },
        { depth: 0.92, svg: meadow },
      ],
      lanes: { sky: { y: 250, depth: 0.7, air: true }, path: { y: 935, depth: 0 } },
      spots: volcano ? { volcano: { x: 980, y: 320, depth: 0.75 }, center: { x: 960 } } : { peak: { x: r2.peaks[2]?.[0] ?? 960, y: r2.peaks[2]?.[1] ?? 400, depth: 0.75 }, center: { x: 960 } },
    };
  });

  // ───────────────────────── forest ─────────────────────────
  R('forest', (o, rnd) => {
    const T = TIME(o.time), N = T.dark;
    const defs = skyDefs(T) + lg('e-ray', [[0, '#fff6c8', 0.38], [1, '#fff6c8', 0]]);
    let back = '';
    for (let i = 0; i < 26; i++) back += treeRound(X0 + i * 100 + rnd() * 40, 720 + rnd() * 30, 0.7 + rnd() * 0.4, haze('#4f8f5a', T, 0.45));
    let mid = '';
    for (let i = 0; i < 12; i++) { const x = X0 + 80 + i * 210 + rnd() * 60, c = tone(['#3f7a46', '#4a8a50', '#356b40'][i % 3], T); mid += `<rect x="${f1(x - 18)}" y="200" width="36" height="640" fill="${tone('#6b4a2e', T)}"/><circle cx="${f1(x)}" cy="${f1(240 + rnd() * 80)}" r="${f1(150 + rnd() * 60)}" fill="${c}"/><circle cx="${f1(x - 90)}" cy="${f1(330 + rnd() * 60)}" r="${f1(100 + rnd() * 40)}" fill="${shade(c, 0.08)}"/>`; }
    if (!N) for (let i = 0; i < 5; i++) { const x = X0 + 300 + i * 480; mid += `<path d="M${x},0 L${x + 70},0 L${x + 320},900 L${x + 120},900 Z" fill="url(#e-ray)" data-amb="pulse" data-s="${f1(0.4 + rnd() * 0.3)}" data-p="${i}" data-lo=".35"/>`; }
    const floor = `<rect x="${X0}" y="840" width="${WW}" height="300" fill="${tone('#5a8f3e', T)}"/>${grass(rnd, 850, X0, X1, tone('#4a7f36', T), 24, 14)}` + Array.from({ length: 12 }, () => `<ellipse cx="${f1(X0 + rnd() * WW)}" cy="${f1(880 + rnd() * 120)}" rx="${f1(30 + rnd() * 40)}" ry="${f1(10 + rnd() * 10)}" fill="${tone('#4a7f36', T)}"/>`).join('');
    const fern = (x, y, s, flip) => `<g data-amb="sway" data-a="3" data-s="1.1" data-p="${f1(x % 5)}" data-cx="${f1(x)}" data-cy="${f1(y)}"><g transform="translate(${f1(x)},${f1(y)}) scale(${flip ? -s : s},${s})">${[-60, -35, -10, 15].map((a, i) => `<path d="M0,0 Q${f1(Math.cos(a * Math.PI / 180) * 120)},${f1(Math.sin(a * Math.PI / 180) * 120 - 60)} ${f1(Math.cos(a * Math.PI / 180) * 230)},${f1(Math.sin(a * Math.PI / 180) * 160 - 20)}" fill="none" stroke="${tone(i % 2 ? '#2f6b36' : '#3a7f40', T)}" stroke-width="20" stroke-linecap="round"/>`).join('')}</g></g>`;
    let fireflies = '';
    if (N) for (let i = 0; i < 30; i++) fireflies += `<g data-amb="twinkle" data-s="${f1(1 + rnd() * 2)}" data-p="${f1(rnd() * 6)}" data-lo=".05"><circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(380 + rnd() * 480)}" r="10" fill="#ffe680" opacity=".3"/><circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(380 + rnd() * 480)}" r="3" fill="#fff6b0"/></g>`;
    return {
      actorScale: 0.6, ground: 930, horizon: 740, defs, dark: N,
      layers: [
        { depth: 0.03, svg: skyLayer(T, rnd, { sunX: 1300, clouds: 2 }) },
        { depth: 0.2, svg: back },
        { depth: 0.5, svg: mid },
        { depth: 0.9, svg: floor + fireflies },
        { depth: 1.15, svg: fern(X0 + 120, 1090, 1, false) + fern(X1 - 120, 1090, 1.1, true), front: true },
      ],
      lanes: { floor: { y: 930, depth: 0 } },
      spots: { center: { x: 960 }, clearing: { x: 960, depth: 0.2 } },
    };
  });

  // ───────────────────────── desert ─────────────────────────
  R('desert', (o, rnd) => {
    const T = TIME(o.time || 'day'), N = T.dark;
    const defs = skyDefs({ ...T, low: T.name === 'day' ? '#fbe7c0' : T.low });
    const dune = (y, amp, c) => `<path d="${ridge(rnd, y, amp, 320)}" fill="${c}"/>`;
    let d = dune(680, 80, haze('#e8b878', T, 0.45)) + dune(760, 90, tone('#e6ad6a', T)) + dune(860, 70, tone('#d99a55', T));
    for (let i = 0; i < 6; i++) d += `<path d="M${X0 + i * 420},${880 + (i % 2) * 40} q140,-24 280,0" fill="none" stroke="${tone('#c98a48', T)}" stroke-width="4" opacity=".6"/>`;
    const cactus = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})"><rect x="-16" y="-200" width="32" height="200" rx="16" fill="${tone('#4f9a5a', T)}"/><path d="M-16,-90 h-40 v-60" fill="none" stroke="${tone('#4f9a5a', T)}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M16,-120 h34 v-50" fill="none" stroke="${tone('#4f9a5a', T)}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    const near = `<path d="M${X0},920 Q900,880 ${X1},930 L${X1},1200 L${X0},1200 Z" fill="${tone('#f0c27e', T)}"/>` + cactus(320, 930, 0.9) + cactus(1650, 940, 1.1) + `<ellipse cx="1150" cy="960" rx="70" ry="26" fill="${tone('#b98a5a', T)}"/>`;
    const shimmer = Array.from({ length: 6 }, (_, i) => `<path d="M${X0 + i * 420},${640 + (i % 3) * 20} q100,-6 200,0" fill="none" stroke="#fff6e0" stroke-width="3" opacity=".35" data-amb="wave" data-a="20" data-s="${f1(1 + i * 0.2)}"/>`).join('');
    return {
      actorScale: 0.55, ground: 945, horizon: 700, defs, dark: N,
      layers: [
        { depth: 0.02, svg: skyLayer(T, rnd, { sunX: 1450, sunY: 240, clouds: 1 }) },
        { depth: 0.4, svg: d + shimmer },
        { depth: 0.92, svg: near },
      ],
      lanes: { sand: { y: 945, depth: 0 }, far: { y: 760, depth: 0.5 }, sky: { y: 250, depth: 0.7, air: true } },
      spots: { center: { x: 960 }, dunes: { x: 960, depth: 0.5 } },
    };
  });

  // ───────────────────────── arctic ─────────────────────────
  R('arctic', (o, rnd) => {
    const T = TIME(o.time || 'day'), N = T.dark;
    const defs = skyDefs(T) + lg('e-ice', [[0, '#ffffff'], [1, '#cfe6f5']]) + lg('e-polar', [[0, tone('#3f8ac7', T)], [1, tone('#1d5a95', T)]]) + lg('e-aur', [[0, '#5bffb0', 0], [0.5, '#5bffb0', 0.55], [1, '#8a6bff', 0]], 0, 1);
    let sky = skyLayer(T, rnd, { sunX: 1450, clouds: N ? 0 : 3 });
    if (N) for (let i = 0; i < 3; i++) sky += `<g data-amb="wave" data-a="${40 + i * 20}" data-s="${f1(0.2 + i * 0.1)}"><path d="M${X0},${170 + i * 70} ${Array.from({ length: 8 }, (_, k) => `Q${X0 + k * 320 + 160},${f1(120 + i * 70 + (k % 2 ? 80 : -40))} ${X0 + k * 320 + 320},${170 + i * 70}`).join(' ')} L${X1},${330 + i * 70} L${X0},${330 + i * 70} Z" fill="url(#e-aur)" opacity="${0.55 - i * 0.12}"/></g>`;
    const r = peaks(rnd, 620, 260, 5);
    const far = `<path d="${r.d}" fill="${haze('#dfeaf5', T, 0.3)}"/>`;
    let sea = `<rect x="${X0}" y="640" width="${WW}" height="300" fill="url(#e-polar)"/>` + Array.from({ length: 6 }, (_, i) => `<path d="M${X0},${670 + i * 34} H${X1}" stroke="#ffffff" stroke-dasharray="${60 + i * 20} ${120 + i * 30}" stroke-width="3" opacity=".25" data-amb="flow" data-s="${12 + i * 4}"/>`).join('');
    for (let i = 0; i < 5; i++) { const x = X0 + 260 + i * 520 + rnd() * 100, w = 90 + rnd() * 120, h = 50 + rnd() * 80, y = 700 + rnd() * 120; sea += `<g data-amb="bob" data-a="5" data-s="${f1(0.6 + rnd() * 0.5)}" data-p="${i}"><path d="M${f1(x - w)},${f1(y)} L${f1(x - w * 0.6)},${f1(y - h)} L${f1(x + w * 0.2)},${f1(y - h * 1.2)} L${f1(x + w)},${f1(y)} Z" fill="url(#e-ice)"/><path d="M${f1(x - w)},${f1(y)} L${f1(x + w)},${f1(y)} L${f1(x + w * 0.7)},${f1(y + h * 0.7)} L${f1(x - w * 0.7)},${f1(y + h * 0.7)} Z" fill="#9fd0ee" opacity=".55"/></g>`; }
    const shelf = `<path d="M${X0},880 L300,850 L700,872 L1200,846 L1700,870 L${X1},850 L${X1},1200 L${X0},1200 Z" fill="url(#e-ice)"/><path d="M${X0},880 L300,850 L700,872 L1200,846 L1700,870 L${X1},850" fill="none" stroke="#9fd0ee" stroke-width="8"/>`;
    let snow = '';
    for (let i = 0; i < 60; i++) snow += `<g data-amb="fall" data-h="1200" data-s="${f1(40 + rnd() * 50)}" data-p="${f1(rnd() * 1200)}" data-a="20"><circle cx="${f1(X0 + rnd() * WW)}" cy="-60" r="${f1(2 + rnd() * 4)}" fill="#ffffff" opacity=".85"/></g>`;
    return {
      actorScale: 0.55, ground: 930, horizon: 660, defs, dark: N,
      layers: [
        { depth: 0.02, svg: sky },
        { depth: 0.12, svg: far },
        { depth: 0.45, svg: sea },
        { depth: 0.9, svg: shelf },
        { depth: 1.05, svg: snow, front: true },
      ],
      lanes: { sea: { y: 760, depth: 0.4 }, ice: { y: 930, depth: 0 } },
      spots: { center: { x: 960 }, sea: { x: 960, y: 760, depth: 0.4 } },
    };
  });

  // ───────────────────────── deep space ─────────────────────────
  function nebula(rnd, colors, n = 6) {
    let s = '';
    for (let i = 0; i < n; i++) { const c = colors[i % colors.length]; s += `<ellipse cx="${f1(X0 + rnd() * WW)}" cy="${f1(100 + rnd() * 700)}" rx="${f1(300 + rnd() * 500)}" ry="${f1(160 + rnd() * 300)}" fill="url(#e-neb${i % colors.length})" transform="rotate(${f1(-30 + rnd() * 60)})"/>`; }
    return s;
  }
  // A tilted barred spiral galaxy (logarithmic arms of stars, pink star-forming knots, glowing bulge) for the backdrop.
  function spiralGalaxy(rnd, cx, cy, Rg) {
    let arms = '';
    const pitch = Math.tan(13 * Math.PI / 180);
    [[0, 1, 380], [Math.PI, 1, 380], [Math.PI / 2, 0.55, 160], [-Math.PI / 2, 0.55, 160]].forEach(([ph, wgt, n]) => {
      for (let i = 0; i < n; i++) {
        const k = i / n, th = k * 3.4 * Math.PI, r = Rg * 0.14 * Math.exp(pitch * th);
        if (r > Rg) break;
        const sp = Rg * 0.05 * (0.4 + k) * (rnd() - 0.5) * 2, a = th + ph + sp / Math.max(r, 1);
        arms += `<circle cx="${f1(Math.cos(a) * (r + sp))}" cy="${f1(Math.sin(a) * (r + sp))}" r="${f1((1.4 + rnd() * 2.2) * (0.7 + wgt * 0.5))}" fill="${rnd() < 0.5 ? '#cfe0ff' : '#efe2ff'}" opacity="${f1(0.35 + 0.6 * (1 - k) * wgt)}"/>`;
        if (i % 11 === 0 && wgt === 1) arms += `<circle cx="${f1(Math.cos(a) * r)}" cy="${f1(Math.sin(a) * r)}" r="${f1(3 + rnd() * 3)}" fill="#ff8fc7" opacity=".7"/>`;
      }
    });
    return `<g transform="translate(${cx},${cy}) rotate(-18)"><g transform="scale(1,.42)"><circle r="${Rg * 1.05}" fill="url(#e-neb0)"/><g data-amb="spin" data-s="1.2">${arms}</g></g><ellipse rx="${f1(Rg * 0.2)}" ry="${f1(Rg * 0.12)}" fill="#fff4d6" opacity=".55"/><ellipse rx="${f1(Rg * 0.09)}" ry="${f1(Rg * 0.06)}" fill="#fffbe8"/></g>`;
  }
  R('space', (o, rnd) => {
    const v = o.variant || 'nebula';
    const pal = { nebula: ['#7a4be0', '#2fb3c8', '#e04b9a'], deep: ['#2c3c9a', '#1f6aa8', '#3a2a7a'], warm: ['#e0703a', '#c03a5a', '#f2b43a'], galaxy: ['#6a5ae0', '#3a8ad0', '#c04ba0'] }[v] || ['#7a4be0', '#2fb3c8', '#e04b9a'];
    const defs = lg('e-space', [[0, '#04061a'], [0.6, '#0b1033'], [1, '#141a4a']]) + pal.map((c, i) => rg(`e-neb${i}`, [[0, c, 0.42], [0.5, c, 0.16], [1, c, 0]])).join('') + rg('e-pglow', [[0.6, '#7fb2ff', 0.45], [1, '#7fb2ff', 0]]) + lg('e-pl', [[0, '#e7b98a'], [0.5, '#c98b5a'], [1, '#8a5a3a']], 1, 1);
    let back = `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-space)"/>` + nebula(rnd, pal, 7) + stars(rnd, 260, 1080);
    if (v === 'galaxy') back += spiralGalaxy(rnd, 980, 430, 520);
    let mid = `<g data-amb="twinkle" data-s="1.3" data-lo=".5">${stars(rnd, 140, 1080)}</g>` + brightStars(rnd, 14, 1000);
    let near = '';
    if (o.planet !== false && v !== 'galaxy') near += `<g transform="translate(1720,900)"><circle r="380" fill="url(#e-pglow)"/><circle r="300" fill="url(#e-pl)"/><path d="M-300,-40 Q0,-90 300,-30 M-290,60 Q0,20 296,70 M-250,150 Q0,120 260,160" stroke="#000" stroke-opacity=".08" stroke-width="22" fill="none"/><path d="M-300,0 A300,300 0 0 0 300,0 A240,300 0 0 1 -300,0" fill="#000" opacity=".25" transform="rotate(-35)"/></g>`;
    let shoot = `<g data-amb="move" data-x0="${X0 - 600}" data-x1="${X1 + 2600}" data-s="900" data-p="300" data-y="0"><g transform="rotate(18)"><line x1="0" y1="120" x2="-220" y2="120" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".7"/></g></g>`;
    return {
      actorScale: 0.6, ground: 1000, horizon: 540, defs, dark: true, drift: 0.05,
      layers: [
        { depth: 0.02, svg: back },
        { depth: 0.06, svg: mid + shoot },
        { depth: 0.18, svg: near },
      ],
      lanes: { space: { y: 520, depth: 0.2, air: true } },
      spots: { center: { x: 960, y: 520, depth: 0.2 }, left: { x: 520, y: 520, depth: 0.2 }, right: { x: 1400, y: 500, depth: 0.2 } },
    };
  });

  // ───────────────────────── Earth from orbit / Earth globe ─────────────────────────
  function earthPaths(R, lon, lat) {
    const topo = window.__rt?.world;
    if (!topo || !window.topojson || !window.d3) return '';
    const feats = topojson.feature(topo, topo.objects.countries).features.filter(f => d3.geoArea(f) < 2 * Math.PI);
    const path = d3.geoPath(d3.geoOrthographic().scale(R).translate([0, 0]).rotate([-lon, -lat]).clipAngle(90));
    return feats.map(f => { const d = path(f); return d ? `<path d="${d}"/>` : ''; }).join('');
  }
  function earthBody(id, R, lon, lat, o = {}) {
    // land drawn once; slow spin via a horizontal ocean-texture drift keeps it alive without re-projecting every frame
    return `<g><circle r="${R + R * 0.06}" fill="url(#${id}-atm)"/><circle r="${R}" fill="url(#${id}-ocean)"/><g fill="${o.land || '#6fbf73'}" stroke="#4f9a55" stroke-width="${f1(Math.max(0.6, R / 300))}" data-amb="earth" data-r="${R}" data-lon="${lon}" data-lat="${lat}" data-s="${o.spin ?? 4}">${earthPaths(R, lon, lat)}</g><g opacity=".55">${Array.from({ length: 14 }, (_, i) => { const a = i * 2.3, rr = R * (0.2 + (i * 0.137) % 0.75); return `<ellipse cx="${f1(Math.cos(a) * rr)}" cy="${f1(Math.sin(a) * rr * 0.9)}" rx="${f1(R * (0.12 + (i % 3) * 0.05))}" ry="${f1(R * 0.035)}" fill="#ffffff" opacity=".7" transform="rotate(${f1(-20 + (i * 17) % 40)} ${f1(Math.cos(a) * rr)} ${f1(Math.sin(a) * rr * 0.9)})"/>`; }).join('')}</g><circle r="${R}" fill="url(#${id}-shade)"/></g>`;
  }
  const earthDefs = id => rg(`${id}-ocean`, [[0, '#4aa3e8'], [1, '#1d5fa8']], '40%', '35%', '70%') + rg(`${id}-atm`, [[0.86, '#7fc4ff', 0], [0.94, '#7fc4ff', 0.6], [1, '#7fc4ff', 0]]) + rg(`${id}-shade`, [[0.55, '#000a20', 0], [1, '#000a20', 0.55]], '35%', '30%', '75%');
  R('orbit', (o, rnd) => {
    const defs = lg('e-space', [[0, '#04061a'], [1, '#0d1440']]) + earthDefs('e-orb') + rg('e-sun', [[0, '#fffbe6', 1], [0.2, '#fff1b0', 0.7], [1, '#ffcf6b', 0]]);
    const R = 1500, cx = 960, cy = 690 + R;
    return {
      actorScale: 0.55, ground: 1000, horizon: 700, defs, dark: true, drift: 0.04,
      layers: [
        { depth: 0.02, svg: `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-space)"/>${stars(rnd, 220, 760)}<circle cx="200" cy="160" r="260" fill="url(#e-sun)"/>` },
        { depth: 0.12, svg: `<g transform="translate(${cx},${cy})">${earthBody('e-orb', R, o.lon ?? 105, (o.lat ?? 15) - 62, { spin: 1.2 })}</g>` },
      ],
      lanes: { orbit: { y: 420, depth: 0.15, air: true } },
      spots: { center: { x: 960, y: 420, depth: 0.15 }, earth: { x: 960, y: 900, depth: 0.12 } },
    };
  });
  R('earth', (o, rnd) => {
    const defs = lg('e-space', [[0, '#04061a'], [1, '#0d1440']]) + earthDefs('e-glb') + rg('e-neb0', [[0, '#3a5ae0', 0.25], [1, '#3a5ae0', 0]]);
    const Rr = o.size || 360;
    return {
      actorScale: 0.5, ground: 1000, horizon: 540, defs, dark: true, drift: 0.04,
      layers: [
        { depth: 0.02, svg: `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-space)"/><ellipse cx="960" cy="520" rx="900" ry="500" fill="url(#e-neb0)"/>${stars(rnd, 240, 1080)}` },
        { depth: 0.1, svg: `<g transform="translate(${o.x ?? 960},${o.y ?? 520})">${earthBody('e-glb', Rr, o.lon ?? 105, o.lat ?? 15, { spin: 6 })}</g>` },
      ],
      spots: { earth: { x: o.x ?? 960, y: o.y ?? 520, depth: 0.1 }, left: { x: 360, y: 520, depth: 0.1 }, right: { x: 1560, y: 520, depth: 0.1 } },
    };
  });
  // Rotating Earth land: re-project at a few frames per second of rotation (cheap at 1:110m).
  C.AMB && (C.AMB.earth = d => {
    const R = +d.r, lat = +d.lat, lon0 = +d.lon, s = +d.s || 4;
    let last = null;
    return (e, t) => { const lon = lon0 + t * s; const k = Math.round(lon * 4) / 4; if (k === last) return; last = k; e.innerHTML = earthPaths(R, k, lat); };
  });

  // ───────────────────────── Moon / Mars surface ─────────────────────────
  R('moon', (o, rnd) => {
    const mars = o.variant === 'mars';
    const defs = (mars ? lg('e-msky', [[0, '#c98a5a'], [1, '#f2c79a']]) : lg('e-msky', [[0, '#020412'], [1, '#0b1030']])) + lg('e-ground', mars ? [[0, '#c4643a'], [1, '#8f3e22']] : [[0, '#b9bccb'], [1, '#868a9c']]) + earthDefs('e-me');
    let sky = `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-msky)"/>`;
    if (!mars) sky += stars(rnd, 200, 700) + `<g transform="translate(1500,230)">${earthBody('e-me', 110, o.lon ?? 105, o.lat ?? 10, { spin: 3 })}</g>`;
    else sky += `<circle cx="1500" cy="200" r="40" fill="#fff6e0" opacity=".8"/><circle cx="1500" cy="200" r="120" fill="#fff6e0" opacity=".15"/>`;
    const far = mars ? `<path d="${ridge(rnd, 700, 140, 300)}" fill="#b5653f" opacity=".75"/><path d="M200,700 L320,560 L520,560 L640,700 Z M1300,700 L1380,600 L1560,600 L1660,700 Z" fill="#a0552f"/>` : `<path d="${ridge(rnd, 700, 60, 300)}" fill="#9fa2b2"/>`;
    let ground = `<path d="M${X0},760 Q960,700 ${X1},760 L${X1},1200 L${X0},1200 Z" fill="url(#e-ground)"/>`;
    for (let i = 0; i < 14; i++) { const x = X0 + rnd() * WW, y = 780 + rnd() * 260, r = 30 + rnd() * 80; ground += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * 0.28)}" fill="${mars ? '#7a3418' : '#767a8c'}"/><ellipse cx="${f1(x)}" cy="${f1(y - r * 0.05)}" rx="${f1(r * 0.82)}" ry="${f1(r * 0.2)}" fill="${mars ? '#9a4626' : '#8d91a3'}"/>`; }
    for (let i = 0; i < 18; i++) { const x = X0 + rnd() * WW, y = 800 + rnd() * 260, r = 8 + rnd() * 20; ground += `<path d="M${f1(x - r)},${f1(y)} Q${f1(x - r * 0.6)},${f1(y - r)} ${f1(x + r * 0.2)},${f1(y - r * 0.9)} Q${f1(x + r)},${f1(y - r * 0.4)} ${f1(x + r)},${f1(y)} Z" fill="${mars ? '#6a2e16' : '#6e7284'}"/>`; }
    let dust = '';
    if (mars) for (let i = 0; i < 40; i++) dust += `<g data-amb="drift" data-s="${f1(20 + rnd() * 30)}"><circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(500 + rnd() * 500)}" r="${f1(1.5 + rnd() * 2.5)}" fill="#f2c79a" opacity=".5"/></g>`;
    return {
      actorScale: 0.65, ground: 930, horizon: 730, defs, dark: !mars,
      layers: [
        { depth: 0.02, svg: sky },
        { depth: 0.2, svg: far },
        { depth: 0.9, svg: ground, under: true },
        { depth: 1.05, svg: dust, front: true },
      ],
      lanes: { surface: { y: 930, depth: 0 }, sky: { y: 300, depth: 0.7, air: true } },
      spots: { center: { x: 960 }, earth: { x: 1500, y: 230, depth: 0.95 }, horizon: { x: 960, depth: 0.6 } },
    };
  });

  // ───────────────────────── inside a blood vessel ─────────────────────────
  R('bloodstream', (o, rnd) => {
    const defs = rg('e-vein', [[0, '#3a0610'], [0.45, '#7a1424'], [1, '#c23a48']], '50%', '48%', '75%') + rg('e-rbc', [[0, '#9a1020'], [0.55, '#d8303c'], [1, '#e8505a']]) + rg('e-wbc', [[0, '#ffffff'], [1, '#e8dce8']]);
    let tunnel = `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-vein)"/>`;
    for (let i = 0; i < 9; i++) tunnel += `<ellipse data-ring="${i}" cx="960" cy="520" rx="200" ry="150" fill="none" stroke="#ff8a96" stroke-width="10" opacity=".2"/>`;
    const cells = Array.from({ length: 26 }, (_, i) => `<g data-cell="${i}"><ellipse rx="64" ry="54" fill="url(#e-rbc)"/><ellipse rx="34" ry="26" fill="#a3141f" opacity=".7"/><ellipse cx="-18" cy="-20" rx="18" ry="8" fill="#fff" opacity=".18"/></g>`).join('') + Array.from({ length: 3 }, (_, i) => `<g data-wbc="${i}">${Array.from({ length: 9 }, (_, k) => `<circle cx="${f1(Math.cos(k * 0.7) * 46)}" cy="${f1(Math.sin(k * 0.7) * 46)}" r="34" fill="url(#e-wbc)"/>`).join('')}<circle r="50" fill="url(#e-wbc)"/><circle r="22" fill="#b39ad6" opacity=".8"/></g>`).join('');
    return {
      actorScale: 0.5, ground: 1000, horizon: 520, defs, dark: true, drift: 0.02,
      layers: [
        { depth: 0.05, svg: tunnel },
        { depth: 0.3, svg: cells },
      ],
      spots: { center: { x: 960, y: 520, depth: 0.2 } },
      ambient(w, ctx) {
        // fly-through: rings and cells stream outward from the vanishing point
        const rings = [...w.set.querySelectorAll('[data-ring]')], cs = [...w.set.querySelectorAll('[data-cell]')], ws = [...w.set.querySelectorAll('[data-wbc]')];
        const seeds = cs.map((_, i) => ({ a: (i * 2.399) % (Math.PI * 2), ph: (i * 0.137) % 1, sp: 0.16 + ((i * 7) % 5) * 0.025, rot: (i * 47) % 360 }));
        ctx.frameFns.push(t => {
          rings.forEach((r, i) => { const k = ((t * 0.22 + i / rings.length) % 1), s = 0.3 + Math.pow(k, 2) * 9; r.setAttribute('rx', f1(200 * s)); r.setAttribute('ry', f1(150 * s)); r.setAttribute('stroke-width', f1(4 + k * 40)); r.setAttribute('opacity', f1(Math.min(1, k * 4) * 0.22)); });
          cs.forEach((c, i) => { const p = seeds[i], k = ((t * p.sp + p.ph) % 1), d = 40 + Math.pow(k, 2.2) * 1400, s = 0.15 + Math.pow(k, 2) * 2.6; c.setAttribute('transform', `translate(${f1(960 + Math.cos(p.a) * d)},${f1(520 + Math.sin(p.a) * d * 0.8)}) rotate(${f1(p.rot + t * 30)}) scale(${f1(s)})`); c.setAttribute('opacity', f1(Math.min(1, k * 5))); });
          ws.forEach((c, i) => { const k = ((t * 0.09 + i / 3) % 1), a = 1 + i * 2.1, d = 60 + Math.pow(k, 2) * 1100; c.setAttribute('transform', `translate(${f1(960 + Math.cos(a) * d)},${f1(520 + Math.sin(a) * d * 0.8)}) scale(${f1(0.2 + k * 2)})`); c.setAttribute('opacity', f1(Math.min(1, k * 5))); });
        });
      },
    };
  });

  // ───────────────────────── inside a cell ─────────────────────────
  R('cell', (o, rnd) => {
    const defs = rg('e-cyto', [[0, '#fde3ea'], [1, '#f2b9c8']], '50%', '50%', '80%') + rg('e-nuc', [[0, '#b99af0'], [1, '#7d5bc8']]);
    let back = `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-cyto)"/><path d="M${X0},-40 Q960,120 ${X1},-40" fill="none" stroke="#e58aa6" stroke-width="60" opacity=".5"/><path d="M${X0},1120 Q960,960 ${X1},1120" fill="none" stroke="#e58aa6" stroke-width="60" opacity=".5"/>`;
    back += `<g transform="translate(2050,540)"><circle r="520" fill="url(#e-nuc)"/>${Array.from({ length: 14 }, (_, i) => `<circle cx="${f1(Math.cos(Math.PI * 0.75 + i * 0.12) * 520)}" cy="${f1(Math.sin(Math.PI * 0.75 + i * 0.12) * 520)}" r="12" fill="#e8dcff"/>`).join('')}</g>`;
    let mid = '';
    const mito = (x, y, a, s) => `<g data-amb="bob" data-a="10" data-s="${f1(0.4 + rnd() * 0.4)}" data-p="${f1(rnd() * 6)}"><g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(a)}) scale(${f1(s)})"><ellipse rx="110" ry="50" fill="#f08a5a"/><ellipse rx="96" ry="38" fill="#ffb08a"/><path d="M-80,0 q16,-26 32,0 t32,0 t32,0 t32,0" fill="none" stroke="#d96a3a" stroke-width="7"/></g></g>`;
    for (let i = 0; i < 6; i++) mid += mito(X0 + 200 + i * 360 + rnd() * 100, 200 + rnd() * 640, rnd() * 180, 0.7 + rnd() * 0.5);
    for (let i = 0; i < 3; i++) { const x = X0 + 400 + i * 700, y = 300 + rnd() * 400; mid += `<g data-amb="bob" data-a="8" data-s=".5" data-p="${i}">${[0, 1, 2, 3].map(k => `<path d="M${x - 120},${y + k * 34} q60,-30 120,0 t120,0" fill="none" stroke="#7fb2ff" stroke-width="16" stroke-linecap="round" opacity=".8"/>`).join('')}${Array.from({ length: 10 }, (_, k) => `<circle cx="${x - 110 + k * 26}" cy="${y - 14 + (k % 4) * 34}" r="5" fill="#3a5ab8"/>`).join('')}</g>`; }
    let fg = '';
    for (let i = 0; i < 26; i++) fg += `<g data-amb="drift" data-s="${f1(-10 + rnd() * 20)}"><circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(rnd() * 1080)}" r="${f1(6 + rnd() * 14)}" fill="${['#ffffff', '#ffd6e0', '#c9b4ff'][i % 3]}" opacity=".55"/></g>`;
    return { actorScale: 0.5, ground: 1000, horizon: 540, defs, dark: false, drift: 0.04, layers: [{ depth: 0.05, svg: back }, { depth: 0.35, svg: mid }, { depth: 1.1, svg: fg, front: true }], spots: { center: { x: 900, y: 540, depth: 0.2 }, nucleus: { x: 1700, y: 540, depth: 0.05 } } };
  });

  // ───────────────────────── molecules / atomic scale ─────────────────────────
  R('molecules', (o, rnd) => {
    const defs = rg('e-mol', [[0, '#123a5a'], [1, '#06182a']], '50%', '45%', '80%') + rg('e-bok', [[0, '#7fd0ff', 0.4], [1, '#7fd0ff', 0]]) + rg('e-O', [[0, '#ff9a8a'], [1, '#d8303c']], '35%', '35%') + rg('e-H', [[0, '#ffffff'], [1, '#c9d3e0']], '35%', '35%') + rg('e-Cc', [[0, '#8a93a6'], [1, '#3a4152']], '35%', '35%');
    let back = `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-mol)"/>` + Array.from({ length: 18 }, () => `<circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(rnd() * 1080)}" r="${f1(40 + rnd() * 120)}" fill="url(#e-bok)"/>`).join('');
    const h2o = (x, y, s, a) => `<g data-amb="bob" data-a="20" data-s="${f1(0.3 + rnd() * 0.3)}" data-p="${f1(rnd() * 6)}"><g data-amb="spin" data-s="${f1(-14 + rnd() * 28)}" data-cx="${f1(x)}" data-cy="${f1(y)}"><g transform="translate(${f1(x)},${f1(y)}) scale(${f1(s)}) rotate(${f1(a)})"><line x1="0" y1="0" x2="-58" y2="44" stroke="#c9d3e0" stroke-width="14"/><line x1="0" y1="0" x2="58" y2="44" stroke="#c9d3e0" stroke-width="14"/><circle r="46" fill="url(#e-O)"/><circle cx="-58" cy="44" r="28" fill="url(#e-H)"/><circle cx="58" cy="44" r="28" fill="url(#e-H)"/></g></g></g>`;
    const co2 = (x, y, s, a) => `<g data-amb="bob" data-a="16" data-s="${f1(0.3 + rnd() * 0.3)}" data-p="${f1(rnd() * 6)}"><g data-amb="spin" data-s="${f1(-12 + rnd() * 24)}" data-cx="${f1(x)}" data-cy="${f1(y)}"><g transform="translate(${f1(x)},${f1(y)}) scale(${f1(s)}) rotate(${f1(a)})"><line x1="-90" y1="-8" x2="90" y2="-8" stroke="#c9d3e0" stroke-width="10"/><line x1="-90" y1="8" x2="90" y2="8" stroke="#c9d3e0" stroke-width="10"/><circle r="40" fill="url(#e-Cc)"/><circle cx="-90" r="44" fill="url(#e-O)"/><circle cx="90" r="44" fill="url(#e-O)"/></g></g></g>`;
    let mid = '';
    const kinds = o.molecules || ['h2o', 'co2'];
    for (let i = 0; i < 9; i++) { const x = X0 + 150 + (i % 5) * 520 + rnd() * 120, y = 140 + Math.floor(i / 5) * 520 + rnd() * 220, s = 0.5 + rnd() * 0.5; mid += (kinds[i % kinds.length] === 'co2' ? co2 : h2o)(x, y, s, rnd() * 360); }
    return { actorScale: 0.5, ground: 1000, horizon: 540, defs, dark: true, drift: 0.04, layers: [{ depth: 0.04, svg: back }, { depth: 0.3, svg: mid }], spots: { center: { x: 960, y: 520, depth: 0.2 } } };
  });

  // ───────────────────────── digital / cyber space ─────────────────────────
  R('digital', (o, rnd) => {
    const defs = lg('e-dig', [[0, '#050a1f'], [0.6, '#0b1a40'], [1, '#102a5a']]) + lg('e-floor', [[0, '#0e2a5a'], [1, '#04102a']]) + rg('e-node', [[0, '#7ff7ff', 0.9], [1, '#7ff7ff', 0]]);
    const vx = 960, vy = 600;
    let back = `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-dig)"/>` + stars(rnd, 80, 600);
    for (let i = 0; i < 9; i++) { const x = X0 + 150 + i * 290, h = 120 + rnd() * 260; back += `<rect x="${x}" y="${vy - h}" width="${60 + rnd() * 60}" height="${h}" fill="#13306a" opacity=".7"/>` + Array.from({ length: 6 }, (_, k) => `<rect x="${x + 10}" y="${vy - h + 12 + k * 20}" width="${30 + rnd() * 30}" height="4" fill="#5bc0eb" opacity="${f1(0.3 + rnd() * 0.5)}"/>`).join(''); }
    let floor = `<rect x="${X0}" y="${vy}" width="${WW}" height="600" fill="url(#e-floor)"/>`;
    for (let i = -14; i <= 14; i++) floor += `<line x1="${vx + i * 40}" y1="${vy}" x2="${vx + i * 260}" y2="1200" stroke="#3fd0ff" stroke-width="2" opacity=".35"/>`;
    for (let k = 0; k < 10; k++) floor += `<line data-hline="${k}" x1="${X0}" y1="${vy}" x2="${X1}" y2="${vy}" stroke="#3fd0ff" stroke-width="2" opacity=".3"/>`;
    floor += `<rect x="${X0}" y="${vy - 3}" width="${WW}" height="6" fill="#7ff7ff" opacity=".8"/>`;
    let circuit = '';
    for (let i = 0; i < 10; i++) { const y = 120 + rnd() * 380, x = X0 + rnd() * WW, len = 200 + rnd() * 400; const d = `M${f1(x)},${f1(y)} h${f1(len * 0.4)} l40,40 h${f1(len * 0.6)}`; circuit += `<path d="${d}" fill="none" stroke="#1f5aa0" stroke-width="4"/><path d="${d}" fill="none" stroke="#7ff7ff" stroke-width="4" stroke-dasharray="20 ${f1(len)}" data-amb="flow" data-s="${f1(120 + rnd() * 100)}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="7" fill="#7ff7ff"/>`; }
    for (let i = 0; i < 6; i++) { const x = X0 + 260 + i * 420, y = 260 + rnd() * 200; circuit += `<g data-amb="bob" data-a="14" data-s="${f1(0.5 + rnd() * 0.4)}" data-p="${i}"><path d="M${x},${y - 60} l52,30 v60 l-52,30 l-52,-30 v-60 Z" fill="#0e2a5a" stroke="#3fd0ff" stroke-width="3" opacity=".8"/><circle cx="${x}" cy="${y}" r="40" fill="url(#e-node)" data-amb="pulse" data-s="2" data-p="${i}" data-lo=".3"/></g>`; }
    return {
      actorScale: 0.65, ground: 960, horizon: vy, defs, dark: true, drift: 0.05, layers: [{ depth: 0.04, svg: back }, { depth: 0.2, svg: circuit }, { depth: 0.85, svg: floor, under: true }], lanes: { floor: { y: 960, depth: 0 }, air: { y: 420, depth: 0.3, air: true } }, spots: { center: { x: 960, y: 420, depth: 0.3 } },
      ambient(w, ctx) {
        // grid lines glide toward the camera
        const ls = [...w.set.querySelectorAll('[data-hline]')];
        ctx.frameFns.push(t => ls.forEach((l, i) => { const k = ((i / ls.length + t * 0.12) % 1), y = f1(vy + k * k * 620); l.setAttribute('y1', y); l.setAttribute('y2', y); l.setAttribute('opacity', f1(0.1 + k * 0.4)); }));
      },
    };
  });

  // ───────────────────────── abstract backdrop (diagram / data shots) ─────────────────────────
  R('abstract', (o, rnd) => {
    const P = { warm: ['#fff3e6', '#ffd9bf', '#ffc2a0', '#ffb08a'], cool: ['#eef5ff', '#cfe0ff', '#b5ccff', '#9fb8ff'], mint: ['#eafaf3', '#c9f0de', '#a8e6c9', '#8fd8b8'], night: ['#0d1430', '#1c2a5a', '#2c3f80', '#3a2a7a'], sunset: ['#2a2350', '#7a3a7a', '#e0705a', '#ffb07a'], paper: ['#fbfaf6', '#f0ece2', '#e6dfcf', '#d9cfb8'] }[o.color || o.variant || 'cool'] || ['#eef5ff', '#cfe0ff', '#b5ccff', '#9fb8ff'];
    const dark = ['night', 'sunset'].includes(o.color || o.variant);
    const defs = lg('e-abs', [[0, P[0]], [1, P[1]]]) + P.map((c, i) => rg(`e-blob${i}`, [[0, c, 0.9], [1, c, 0]])).join('');
    let s = `<rect x="${X0}" y="-200" width="${WW}" height="1500" fill="url(#e-abs)"/>`;
    for (let i = 0; i < 7; i++) s += `<g data-amb="drift" data-s="${f1(-8 + rnd() * 16)}"><circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(rnd() * 1080)}" r="${f1(220 + rnd() * 320)}" fill="url(#e-blob${1 + (i % 3)})" opacity=".8"/></g>`;
    for (let i = 0; i < 40; i++) s += `<circle cx="${f1(X0 + rnd() * WW)}" cy="${f1(rnd() * 1080)}" r="${f1(2 + rnd() * 4)}" fill="${dark ? '#ffffff' : P[3]}" opacity=".35"/>`;
    return { actorScale: 0.8, ground: 960, horizon: 600, defs, dark, drift: 0.03, layers: [{ depth: 0.05, svg: s }], spots: { center: { x: 960, y: 520, depth: 0 } } };
  });

  // Legacy names → new environments.
  C.registerSetting('port', (o, rnd) => C.getSetting('ocean')({ ...o, variant: 'port' }, rnd));
  C.registerSetting('sea', (o, rnd) => C.getSetting('ocean')(o, rnd));
  C.registerSetting('beach', (o, rnd) => C.getSetting('ocean')({ ...o, variant: 'beach' }, rnd));
  C.registerSetting('volcano', (o, rnd) => C.getSetting('mountains')({ ...o, variant: 'volcano' }, rnd));
  C.registerSetting('mars', (o, rnd) => C.getSetting('moon')({ ...o, variant: 'mars' }, rnd));
})();
