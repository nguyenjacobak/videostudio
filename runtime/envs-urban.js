/* Environments: city & daily life & work & history. Registered into the cartoon world as kit.world('<name>', opts).
 * Each returns { ground, horizon, layers: [{ depth, svg, front? }], defs, lanes, spots, dark }. */
(function () {
  const K = window.EnvKit, C = window.Cartoon;
  if (!K || !C) return;
  const { X0, X1, mix, shade, f1, lg, rg, TIME, tone, haze, skyDefs, skyLayer, ridge, karst, treeRound, palm, bamboo, banana, grass, building, traffic, birds, lamp } = K;
  const WW = X1 - X0;
  const CARS = ['#e8574b', '#3b7cf6', '#f2c14e', '#2fb38a', '#ffffff', '#5a6378', '#8a6bd6'];
  const lampDefs = () => rg('e-lampglow', [[0, '#fff3c0', 0.75], [1, '#fff3c0', 0]]);
  const R = (name, fn) => C.registerSetting(name, fn);

  // ───────────────────────── city skyline + street ─────────────────────────
  R('city', (o, rnd) => {
    const T = TIME(o.time), N = T.dark;
    const defs = skyDefs(T) + lampDefs() + lg('e-road', [[0, N ? '#2a2e3d' : '#5b6070'], [1, N ? '#20232f' : '#4b505e']]) + lg('e-hz', [[0, T.haze, 0], [1, T.haze, 0.8]]);
    let far = '';
    for (let x = X0; x < X1;) {
      const w = 50 + rnd() * 90, h = 160 + rnd() * 290, c = haze(N ? '#33406f' : '#8ea3c6', T, 0.5);
      far += `<rect x="${f1(x)}" y="${f1(660 - h)}" width="${f1(w)}" height="${f1(h + 60)}" fill="${c}"/>`;
      if (rnd() < 0.22) far += `<rect x="${f1(x + w / 2 - 3)}" y="${f1(660 - h - 60)}" width="6" height="60" fill="${c}"/>`;
      if (N) for (let k = 0; k < h / 30; k++) if (rnd() < 0.35) far += `<rect x="${f1(x + 6 + rnd() * (w - 14))}" y="${f1(660 - h + 10 + k * 28)}" width="5" height="7" fill="#ffd77a" opacity=".7"/>`;
      x += w + 6 + rnd() * 26;
    }
    far += `<rect x="${X0}" y="480" width="${WW}" height="220" fill="url(#e-hz)"/>`;
    const pal = ['#e9a46a', '#d97a6c', '#7aa0dc', '#e8c56a', '#86c3a6', '#a993d8', '#e88fae', '#9fb0c7'];
    let mid = '';
    for (let x = X0, i = 0; x < X1; i++) { const w = 120 + rnd() * 110, h = 230 + rnd() * 230; mid += building(x, 770, w, h, haze(pal[(i * 5) % pal.length], T, 0.38), rnd, T, { lit: 0.35, roof: rnd() < 0.12 ? 'tri' : 'flat' }); x += w + 8 + rnd() * 22; }
    let near = '';
    const awn = ['#e8574b', '#2f9fd8', '#f2b43a', '#3fa66a', '#8a6bd6'];
    for (let x = X0, i = 0; x < X1; i++) { const w = 230 + rnd() * 120, h = 360 + rnd() * 270; near += building(x, 870, w, h, tone(pal[(i * 3 + 1) % pal.length], T), rnd, T, { shop: true, awning: awn[i % awn.length], lit: 0.55 }); x += w + 14 + rnd() * 18; }
    let street = `<rect x="${X0}" y="866" width="${WW}" height="46" fill="${tone('#d9d3c9', T)}"/>`;
    for (let x = X0; x < X1; x += 90) street += `<line x1="${x}" y1="866" x2="${x - 14}" y2="910" stroke="${tone('#c6bfb4', T)}" stroke-width="2"/>`;
    street += `<rect x="${X0}" y="906" width="${WW}" height="10" fill="${tone('#aaa39a', T)}"/><rect x="${X0}" y="916" width="${WW}" height="200" fill="url(#e-road)"/><line x1="${X0}" y1="998" x2="${X1}" y2="998" stroke="#f4f1e8" stroke-width="6" stroke-dasharray="70 60" opacity=".65"/>`;
    for (let x = X0 + 120; x < X1; x += 560) street += treeRound(x, 886, 0.72, tone('#58a650', T)) + lamp(x + 280, 890, T, 0.95);
    street += traffic(rnd, 968, 3, 280, CARS) + traffic(rnd, 1048, 3, -330, CARS);
    return {
      actorScale: 0.62, ground: 900, horizon: 700, defs, dark: N,
      layers: [
        { depth: 0.03, svg: skyLayer(T, rnd, { sunX: 1460 }) + (N ? '' : birds(rnd, 4, 150, T)) },
        { depth: 0.14, svg: far },
        { depth: 0.32, svg: mid },
        { depth: 0.6, svg: near },
        { depth: 0.9, svg: street },
      ],
      lanes: { road: { y: 990, depth: 0 }, sidewalk: { y: 900, depth: 0 }, sky: { y: 240, depth: 0.7, air: true } },
      spots: { left: { x: 420 }, center: { x: 960 }, right: { x: 1500 }, sky: { x: 960, y: 260, depth: 0.7 } },
    };
  });

  // ───────────────────────── shopping street (eye level) ─────────────────────────
  const EMBLEM = {
    bakery: c => `<ellipse cx="0" cy="0" rx="34" ry="18" fill="#d99a52"/><path d="M-18,-8 l8,14 M-2,-12 l8,16 M14,-10 l8,14" stroke="#a8692c" stroke-width="4" stroke-linecap="round"/>`,
    cafe: () => `<path d="M-22,-14 L22,-14 L18,18 L-18,18 Z" fill="#fff"/><path d="M22,-6 q14,0 12,12 q-2,8 -14,6" fill="none" stroke="#fff" stroke-width="5"/><path d="M-8,-22 q-6,-10 0,-18 M6,-22 q-6,-10 0,-18" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/>`,
    pharmacy: () => `<path d="M-10,-28 h20 v18 h18 v20 h-18 v18 h-20 v-18 h-18 v-20 h18 Z" fill="#3fbf6a" stroke="#fff" stroke-width="4"/>`,
    bank: () => `<circle r="26" fill="#f6c445" stroke="#fff" stroke-width="4"/><text y="11" text-anchor="middle" font-size="32" font-weight="900" fill="#b07a12" font-family="'Be Vietnam Pro',sans-serif">₫</text>`,
    grocery: () => `<circle cx="-12" cy="4" r="18" fill="#e8574b"/><circle cx="14" cy="6" r="16" fill="#f2b43a"/><path d="M-12,-14 q6,-12 14,-10" stroke="#3fa66a" stroke-width="5" fill="none"/>`,
    electronics: () => `<rect x="-30" y="-20" width="60" height="38" rx="4" fill="#cfe8ff" stroke="#fff" stroke-width="4"/><rect x="-8" y="20" width="16" height="6" fill="#fff"/>`,
    goldshop: () => `<path d="M-30,14 L-20,-6 L20,-6 L30,14 Z" fill="#f6c445" stroke="#fff" stroke-width="3"/><path d="M-14,-6 L-8,-22 L8,-22 L14,-6 Z" fill="#ffd970" stroke="#fff" stroke-width="3"/>`,
  };
  const WINDOW_GOODS = {
    bakery: (x, y, w, rnd) => Array.from({ length: 6 }, (_, i) => `<ellipse cx="${f1(x + 30 + (i % 3) * (w - 60) / 2)}" cy="${f1(y + 70 + Math.floor(i / 3) * 80)}" rx="30" ry="16" fill="${['#d99a52', '#c98a3f', '#e3b06a'][i % 3]}"/>`).join('') + `<rect x="${x}" y="${y + 92}" width="${w}" height="6" fill="#b48b5a"/><rect x="${x}" y="${y + 172}" width="${w}" height="6" fill="#b48b5a"/>`,
    cafe: (x, y, w) => `<path d="M${x + 30},${y + 150} h50 l-6,40 h-38 Z" fill="#fff"/><path d="M${x + 110},${y + 120} h60 v70 h-60 Z" fill="#f2c9a0"/><circle cx="${x + 140}" cy="${y + 110}" r="12" fill="#e5677d"/>`,
    pharmacy: (x, y, w) => Array.from({ length: 8 }, (_, i) => `<rect x="${f1(x + 16 + (i % 4) * (w - 30) / 4)}" y="${f1(y + 40 + Math.floor(i / 4) * 80)}" width="34" height="46" rx="4" fill="${['#ffffff', '#9fd3f3', '#bde8c8', '#ffd6a8'][i % 4]}"/>`).join(''),
    grocery: (x, y, w) => Array.from({ length: 10 }, (_, i) => `<circle cx="${f1(x + 26 + (i % 5) * (w - 50) / 4)}" cy="${f1(y + 150 + Math.floor(i / 5) * 34)}" r="15" fill="${['#e8574b', '#f2b43a', '#7cc36b', '#f08a3c', '#e5677d'][i % 5]}"/>`).join(''),
    electronics: (x, y, w) => [0, 1].map(i => `<rect x="${f1(x + 16 + i * (w / 2))}" y="${y + 50}" width="${f1(w / 2 - 30)}" height="80" rx="6" fill="#1d2433"/><rect x="${f1(x + 22 + i * (w / 2))}" y="${y + 56}" width="${f1(w / 2 - 42)}" height="68" rx="3" fill="${['#5bc0eb', '#8a6bd6'][i]}" opacity=".85" data-amb="pulse" data-s="${2 + i}" data-lo=".6"/>`).join(''),
    goldshop: (x, y, w) => Array.from({ length: 6 }, (_, i) => `<path transform="translate(${f1(x + 34 + (i % 3) * (w - 60) / 2)},${f1(y + 90 + Math.floor(i / 3) * 70)})" d="M-24,10 L-16,-6 L16,-6 L24,10 Z" fill="#f6c445" stroke="#d9a21c" stroke-width="2"/>`).join(''),
    bank: () => '',
  };
  R('street', (o, rnd) => {
    const T = TIME(o.time), N = T.dark;
    const defs = skyDefs(T) + lampDefs() + lg('e-road', [[0, N ? '#2a2e3d' : '#5b6070'], [1, N ? '#20232f' : '#4b505e']]) + lg('e-glass', [[0, N ? '#ffe3a0' : '#d6eefb'], [1, N ? '#f2c46a' : '#a9d3ee']]);
    const order = o.shops || ['grocery', 'bakery', 'cafe', 'bank', 'pharmacy', 'electronics', 'goldshop'];
    const facade = ['#f1c27d', '#e8a29a', '#a8c8ec', '#f3dfb4', '#b5dcc6', '#d7c3ec', '#f5b98a'];
    const awn = ['#2fb38a', '#e8574b', '#8a5a3c', '#3b5bb5', '#3fbf6a', '#5a6378', '#c9902a'];
    let shops = '', spots = {};
    order.forEach((type, i) => {
      const x = X0 + 20 + i * 352, w = 344, c = tone(facade[i % facade.length], T);
      shops += `<rect x="${x}" y="0" width="${w}" height="880" fill="${c}"/><rect x="${x + w - 12}" y="0" width="12" height="880" fill="${shade(c, -0.12)}"/>`;
      for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
        const wx = x + 28 + k * 104, wy = 60 + r * 190, lit = N && rnd() < 0.5;
        shops += `<rect x="${wx}" y="${wy}" width="78" height="120" rx="6" fill="${lit ? '#ffd77a' : N ? shade(c, -0.5) : '#cfe6f7'}"/><rect x="${wx - 6}" y="${wy + 120}" width="90" height="10" rx="3" fill="${shade(c, -0.25)}"/>`;
        if (rnd() < 0.35) shops += `<ellipse cx="${wx + 39}" cy="${wy + 116}" rx="34" ry="12" fill="${tone('#5aa651', T)}"/>`;
      }
      if (type === 'bank') {
        shops += `<path d="M${x + 10},470 L${x + w / 2},400 L${x + w - 10},470 Z" fill="${shade(c, -0.15)}"/>` + [0, 1, 2, 3].map(k => `<rect x="${x + 34 + k * 78}" y="490" width="34" height="340" fill="${shade(c, 0.25)}"/>`).join('') + `<rect x="${x + 20}" y="830" width="${w - 40}" height="20" fill="${shade(c, -0.1)}"/><rect x="${x + 10}" y="850" width="${w - 20}" height="30" fill="${shade(c, -0.18)}"/>`;
        shops += `<g transform="translate(${x + w / 2},440)">${EMBLEM.bank()}</g>`;
      } else {
        shops += `<rect x="${x + 22}" y="472" width="${w - 44}" height="62" rx="10" fill="${shade(awn[i % awn.length], -0.15)}"/><g transform="translate(${x + w / 2},503) scale(.95)">${EMBLEM[type] ? EMBLEM[type]() : ''}</g>`;
        for (let k = 0; k < 11; k++) shops += `<path d="M${x + 4 + k * 31},540 h31 v34 q-15.5,18 -31,0 Z" fill="${k % 2 ? '#ffffff' : tone(awn[i % awn.length], T)}"/>`;
        shops += `<rect x="${x + 24}" y="600" width="200" height="230" rx="4" fill="url(#e-glass)"/>${(WINDOW_GOODS[type] || (() => ''))(x + 24, 600, 200, rnd)}<path d="M${x + 40},610 l40,0 l-60,200 l-30,0 Z" fill="#ffffff" opacity=".22"/><rect x="${x + 24}" y="600" width="200" height="230" rx="4" fill="none" stroke="${shade(c, -0.3)}" stroke-width="8"/>`;
        shops += `<rect x="${x + 244}" y="620" width="78" height="260" rx="4" fill="${shade(c, -0.35)}"/><rect x="${x + 254}" y="632" width="58" height="110" rx="3" fill="url(#e-glass)" opacity=".85"/><circle cx="${x + 304}" cy="760" r="5" fill="#f6c445"/>`;
        if (type === 'cafe') shops += `<g transform="translate(${x + 120},880)"><rect x="-40" y="-70" width="80" height="8" rx="3" fill="#8a5a3c"/><rect x="-4" y="-62" width="8" height="62" fill="#8a5a3c"/><path d="M-70,0 v-40 h22 v40 M48,0 v-40 h22 v40" stroke="#5a3e2a" stroke-width="6" fill="none"/></g>`;
        if (type === 'grocery') shops += `<g transform="translate(${x + 60},880)">${[0, 1].map(k => `<rect x="${k * 90}" y="-50" width="80" height="50" fill="#b98352"/>${[0, 1, 2].map(m => `<circle cx="${k * 90 + 16 + m * 24}" cy="-54" r="13" fill="${['#e8574b', '#f2b43a', '#7cc36b'][(m + k) % 3]}"/>`).join('')}`).join('')}</g>`;
      }
      spots[type] = { x: x + w / 2, depth: 0 };
    });
    let walk = `<rect x="${X0}" y="878" width="${WW}" height="40" fill="${tone('#d9d3c9', T)}"/><rect x="${X0}" y="914" width="${WW}" height="10" fill="${tone('#aaa39a', T)}"/><rect x="${X0}" y="924" width="${WW}" height="200" fill="url(#e-road)"/><line x1="${X0}" y1="1004" x2="${X1}" y2="1004" stroke="#f4f1e8" stroke-width="6" stroke-dasharray="70 60" opacity=".6"/>`;
    for (let x = X0 + 200; x < X1; x += 700) walk += lamp(x, 900, T, 0.9);
    walk += traffic(rnd, 1000, 2, 300, CARS) + traffic(rnd, 1068, 2, -320, CARS);
    return {
      actorScale: 0.5, ground: 905, horizon: 640, defs, dark: N,
      layers: [
        { depth: 0.6, svg: `<rect x="${X0}" y="-100" width="${WW}" height="400" fill="url(#e-sky)"/>${shops}` },
        { depth: 0.92, svg: walk },
      ],
      lanes: { road: { y: 1010, depth: 0 }, sidewalk: { y: 905, depth: 0 } },
      spots,
    };
  });

  // ───────────────────────── Vietnamese market ─────────────────────────
  R('market', (o, rnd) => {
    const T = TIME(o.time), N = T.dark;
    const defs = skyDefs(T) + lampDefs();
    let houses = '';
    for (let x = X0, i = 0; x < X1; i++) {
      const w = 170 + rnd() * 70, h = 260 + rnd() * 140, c = haze(['#f3d9a4', '#e9b98f', '#d9e2b0', '#f2c7b0', '#cfd8e8'][i % 5], T, 0.2);
      houses += `<rect x="${f1(x)}" y="${f1(640 - h)}" width="${f1(w)}" height="${f1(h)}" fill="${c}"/><rect x="${f1(x)}" y="${f1(640 - h)}" width="${f1(w)}" height="14" fill="${shade(c, -0.3)}"/>`;
      for (let r = 0; r < 2; r++) houses += `<rect x="${f1(x + 24)}" y="${f1(640 - h + 40 + r * 110)}" width="${f1(w - 48)}" height="70" rx="4" fill="${N ? (rnd() < 0.5 ? '#ffd77a' : '#2a3160') : '#bcdcef'}"/><rect x="${f1(x + 14)}" y="${f1(640 - h + 110 + r * 110)}" width="${f1(w - 28)}" height="8" fill="${shade(c, -0.35)}"/>`;
      x += w + 4;
    }
    let lines = `<path d="M${X0},90 Q960,170 ${X1},80" fill="none" stroke="#3b3b44" stroke-width="3" opacity=".6"/>`;
    for (let x = X0 + 40; x < X1; x += 150) { const y = 90 + Math.sin((x - X0) / WW * Math.PI) * 70; lines += `<g data-amb="sway" data-a="3" data-s="1.2" data-p="${f1(x % 5)}" data-cx="${f1(x)}" data-cy="${f1(y)}"><line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x)}" y2="${f1(y + 30)}" stroke="#7a4a2a" stroke-width="3"/><ellipse cx="${f1(x)}" cy="${f1(y + 54)}" rx="22" ry="28" fill="${N ? '#ff6b4a' : '#e8453c'}"/><rect x="${f1(x - 10)}" y="${f1(y + 24)}" width="20" height="8" fill="#f2c14e"/>${N ? `<circle cx="${f1(x)}" cy="${f1(y + 54)}" r="44" fill="#ff8a5a" opacity=".22"/>` : ''}</g>`; }
    const tarp = ['#3b7cf6', '#e8574b', '#2fb38a', '#f2b43a', '#8a6bd6'];
    const goods = [
      x => Array.from({ length: 9 }, (_, i) => `<ellipse cx="${f1(x + 40 + (i % 5) * 60 + (i > 4 ? 30 : 0))}" cy="${f1(752 - (i > 4 ? 22 : 0))}" rx="30" ry="16" fill="${['#5aa651', '#7cc36b', '#3f8a46'][i % 3]}"/>`).join(''),
      x => Array.from({ length: 11 }, (_, i) => `<circle cx="${f1(x + 40 + (i % 6) * 52 + (i > 5 ? 26 : 0))}" cy="${f1(748 - (i > 5 ? 24 : 0))}" r="20" fill="${['#f08a3c', '#f2c14e', '#e8574b'][i % 3]}"/>`).join(''),
      x => `<rect x="${x + 30}" y="742" width="320" height="22" rx="10" fill="#c9d3dd"/>` + Array.from({ length: 5 }, (_, i) => `<path transform="translate(${x + 70 + i * 60},748)" d="M-26,0 Q0,-16 26,0 Q0,16 -26,0 Z M26,0 l14,-12 l0,24 Z" fill="${['#9fb0c7', '#b9c6d6'][i % 2]}"/>`).join(''),
      x => Array.from({ length: 4 }, (_, i) => `<path transform="translate(${x + 60 + i * 80},770)" d="M-30,0 Q-36,-60 0,-66 Q36,-60 30,0 Z" fill="#e9d8b0"/><path transform="translate(${x + 60 + i * 80},770)" d="M-20,-62 Q0,-74 20,-62" fill="none" stroke="#c9b083" stroke-width="5"/>`).join(''),
      x => Array.from({ length: 12 }, (_, i) => `<circle cx="${f1(x + 40 + (i % 6) * 54)}" cy="${f1(740 - Math.floor(i / 6) * 26)}" r="16" fill="${['#e5677d', '#f2c14e', '#ffffff', '#ff9ec4'][i % 4]}"/>`).join(''),
    ];
    let stalls = '', spots = {};
    for (let i = 0, x = X0 + 40; x < X1 - 100; i++, x += 470) {
      const c = tone(tarp[i % tarp.length], T);
      stalls += `<rect x="${x + 6}" y="560" width="10" height="320" fill="#6b4a2e"/><rect x="${x + 384}" y="560" width="10" height="320" fill="#6b4a2e"/><path d="M${x - 20},560 Q${x + 200},600 ${x + 420},560 L${x + 400},500 Q${x + 200},530 ${x},500 Z" fill="${c}"/><path d="M${x - 20},560 Q${x + 200},600 ${x + 420},560" fill="none" stroke="${shade(c, -0.25)}" stroke-width="6"/>`;
      stalls += `<rect x="${x}" y="770" width="400" height="20" rx="4" fill="#a97a4c"/><rect x="${x + 10}" y="790" width="380" height="90" fill="#8f6440"/>${goods[i % goods.length](x)}`;
      stalls += `<g transform="translate(${x + 60},880)"><ellipse cx="0" cy="-26" rx="44" ry="26" fill="#c8a06a"/><path d="M-40,-30 Q0,-10 40,-30" stroke="#a37d4c" stroke-width="3" fill="none"/></g>`;
      spots[`stall${i + 1}`] = { x: x + 200, depth: 0.05 };
    }
    return {
      actorScale: 0.7, ground: 915, horizon: 660, defs, dark: N,
      layers: [
        { depth: 0.04, svg: skyLayer(T, rnd, { sunX: 1600, clouds: 3 }) },
        { depth: 0.3, svg: houses + `<rect x="${X0}" y="636" width="${WW}" height="260" fill="${tone('#cdbb9b', T)}"/>` },
        { depth: 0.7, svg: lines + stalls },
        { depth: 0.92, svg: `<rect x="${X0}" y="880" width="${WW}" height="220" fill="${tone('#d9c6a3', T)}"/>` + Array.from({ length: 14 }, (_, i) => `<ellipse cx="${X0 + 90 + i * 180}" cy="${930 + (i % 3) * 40}" rx="40" ry="8" fill="${tone('#c9b38c', T)}"/>`).join('') },
      ],
      spots: { ...spots, center: { x: 960 } },
    };
  });

  // ───────────────────────── Vietnamese countryside ─────────────────────────
  R('village', (o, rnd) => {
    const T = TIME(o.time), N = T.dark, ancient = o.variant === 'ancient';
    const defs = skyDefs(T) + lg('e-paddy', [[0, tone('#bfe3f2', T)], [1, tone('#8fc7e0', T)]]) + lg('e-mist', [[0, T.haze, 0], [0.5, T.haze, 0.7], [1, T.haze, 0]]);
    const far = `<path d="${karst(rnd, 640, 0, 140, 330)}" fill="${haze('#6f9a86', T, 0.55)}"/><rect x="${X0}" y="520" width="${WW}" height="140" fill="url(#e-mist)" data-amb="drift" data-s="4"/>`;
    const hills = `<path d="${ridge(rnd, 690, 90, 220)}" fill="${haze('#7fae6a', T, 0.25)}"/>` + Array.from({ length: 5 }, (_, i) => `<path d="M${X0},${700 + i * 18} Q960,${660 + i * 24} ${X1},${704 + i * 18}" fill="none" stroke="${haze('#a6cf7d', T, 0.2)}" stroke-width="5" opacity=".7"/>`).join('');
    let houses = '';
    const house = (x, y, s, thatch) => {
      const wall = tone(thatch ? '#d8b98a' : '#f3dfa2', T), roof = tone(thatch ? '#b8925a' : '#a5452f', T);
      return `<g transform="translate(${x},${y}) scale(${s})"><rect x="-110" y="-120" width="220" height="120" fill="${wall}"/><path d="M-140,-112 L0,-210 L140,-112 Z" fill="${roof}"/>${thatch ? '<path d="M-130,-118 L0,-206 L130,-118" fill="none" stroke="#8f6e3e" stroke-width="5" stroke-dasharray="6 10"/>' : '<path d="M-140,-112 L140,-112" stroke="#7d3322" stroke-width="10"/>'}<rect x="-26" y="-80" width="52" height="80" fill="${tone('#6b4a2e', T)}"/><rect x="-88" y="-90" width="40" height="34" fill="${N ? '#ffd77a' : '#4a3a2a'}"/><rect x="48" y="-90" width="40" height="34" fill="${N ? '#ffd77a' : '#4a3a2a'}"/></g>`;
    };
    houses += bamboo(80, 760, 0.85, tone('#5f9a3a', T)) + house(420, 758, 0.8, ancient || rnd() < 0.3) + banana(640, 760, 0.8, tone('#5fae4a', T)) + house(1380, 752, 0.9, ancient) + `<g data-amb="rise" data-h="200" data-s="40"><circle cx="1430" cy="560" r="22" fill="#e9e9ee" opacity=".7"/></g><g data-amb="rise" data-h="200" data-s="40" data-p="100"><circle cx="1430" cy="560" r="26" fill="#e9e9ee" opacity=".6"/></g>` + bamboo(1640, 765, 0.95, tone('#6ea84a', T)) + palm(1880, 768, 0.75, tone('#3f9a52', T)) + banana(1100, 770, 0.7, tone('#5fae4a', T)) + bamboo(-120, 770, 0.8, tone('#5f9a3a', T));
    let paddy = `<rect x="${X0}" y="760" width="${WW}" height="160" fill="${tone('#7cbf5a', T)}"/>`;
    for (let r = 0; r < 4; r++) {
      const y = 774 + r * 36;
      paddy += `<path d="M${X0},${y} Q960,${y - 10} ${X1},${y} L${X1},${y + 22} Q960,${y + 12} ${X0},${y + 22} Z" fill="url(#e-paddy)" opacity=".85"/>`;
      for (let x = X0 + 10; x < X1; x += 34 + rnd() * 10) paddy += `<path d="M${f1(x)},${y + 20} l-5,-22 M${f1(x)},${y + 20} l0,-26 M${f1(x)},${y + 20} l6,-20" stroke="${tone('#4f8f3a', T)}" stroke-width="3" stroke-linecap="round"/>`;
    }
    const path = `<rect x="${X0}" y="905" width="${WW}" height="200" fill="${tone('#8cc972', T)}"/><path d="M${X0},918 Q960,898 ${X1},920 L${X1},960 Q960,940 ${X0},962 Z" fill="${tone('#d8b886', T)}"/>${grass(rnd, 912, X0, X1, tone('#5a9a46', T), 22, 16)}`;
    const front = grass(rnd, 1085, X0, X0 + 360, tone('#3f7a38', T), 120, 12) + grass(rnd, 1085, X1 - 360, X1, tone('#3f7a38', T), 130, 12);
    return {
      actorScale: 0.55, ground: 930, horizon: 700, defs, dark: N,
      layers: [
        { depth: 0.03, svg: skyLayer(T, rnd, { sunX: 520, clouds: 4 }) + (N ? '' : birds(rnd, 5, 160, T)) },
        { depth: 0.12, svg: far },
        { depth: 0.3, svg: hills },
        { depth: 0.55, svg: houses },
        { depth: 0.75, svg: paddy },
        { depth: 0.92, svg: path },
        { depth: 1.12, svg: front, front: true },
      ],
      lanes: { path: { y: 935, depth: 0 }, field: { y: 830, depth: 0.25 }, sky: { y: 220, depth: 0.7, air: true } },
      spots: { house: { x: 1380, depth: 0.3 }, field: { x: 560, depth: 0.2 }, path: { x: 960 } },
    };
  });

  // ───────────────────────── farm ─────────────────────────
  R('farm', (o, rnd) => {
    const T = TIME(o.time), N = T.dark;
    const defs = skyDefs(T);
    const hills = `<path d="${ridge(rnd, 640, 80, 240)}" fill="${haze('#9ccb7a', T, 0.35)}"/><path d="${ridge(rnd, 700, 60, 200)}" fill="${haze('#8cbf66', T, 0.15)}"/>`;
    const barn = c => `<g transform="translate(1320,780)"><rect x="-160" y="-200" width="320" height="200" fill="${c}"/><path d="M-185,-196 L-120,-300 L120,-300 L185,-196 Z" fill="${shade(c, -0.25)}"/><path d="M-60,0 v-130 h120 v130 M-60,-130 l120,130 M60,-130 l-120,130" stroke="#fff" stroke-width="10" fill="none"/><rect x="-40" y="-250" width="80" height="40" fill="#fff"/></g><g transform="translate(1590,780)"><rect x="-60" y="-330" width="120" height="330" fill="${tone('#c9cfd8', T)}"/><path d="M-60,-330 Q0,-400 60,-330 Z" fill="${tone('#9aa3b5', T)}"/>${[0, 1, 2, 3, 4].map(k => `<line x1="-60" y1="${-60 - k * 60}" x2="60" y2="${-60 - k * 60}" stroke="${tone('#aeb6c4', T)}" stroke-width="5"/>`).join('')}</g>`;
    const mill = `<g transform="translate(560,760)"><path d="M-14,0 L-8,-300 L8,-300 L14,0 Z" fill="${tone('#e8e4dc', T)}"/><g data-amb="spin" data-s="40" data-cx="0" data-cy="-300">${[0, 120, 240].map(a => `<path transform="rotate(${a} 0 -300)" d="M0,-300 L-10,-460 Q0,-470 10,-460 Z" fill="${tone('#ffffff', T)}" stroke="${tone('#cfd3da', T)}" stroke-width="3"/>`).join('')}</g><circle cx="0" cy="-300" r="12" fill="${tone('#9aa3b5', T)}"/></g>`;
    let wheat = `<rect x="${X0}" y="770" width="${WW}" height="150" fill="${tone('#e8c55a', T)}"/>`;
    for (let r = 0; r < 6; r++) for (let x = X0 + (r % 2) * 20; x < X1; x += 40) wheat += `<path d="M${x},${790 + r * 22} q4,-20 0,-34" stroke="${tone('#c9a23a', T)}" stroke-width="4" fill="none"/><ellipse cx="${x}" cy="${757 + r * 22}" rx="5" ry="10" fill="${tone('#f2d27a', T)}"/>`;
    let fence = '';
    for (let x = X0; x < X1; x += 70) fence += `<rect x="${x}" y="880" width="10" height="56" fill="${tone('#a77b4f', T)}"/>`;
    fence += `<rect x="${X0}" y="892" width="${WW}" height="9" fill="${tone('#a77b4f', T)}"/><rect x="${X0}" y="916" width="${WW}" height="9" fill="${tone('#a77b4f', T)}"/>`;
    return {
      actorScale: 0.55, ground: 960, horizon: 700, defs, dark: N,
      layers: [
        { depth: 0.03, svg: skyLayer(T, rnd, { sunX: 1700 }) + (N ? '' : birds(rnd, 4, 150, T)) },
        { depth: 0.2, svg: hills },
        { depth: 0.45, svg: barn(tone('#c0392b', T)) + mill + treeRound(240, 760, 0.8, tone('#5aa651', T)) + treeRound(1900, 770, 0.9, tone('#4f9a48', T)) },
        { depth: 0.7, svg: wheat },
        { depth: 0.92, svg: `<rect x="${X0}" y="930" width="${WW}" height="200" fill="${tone('#c9a26a', T)}"/>${fence}` },
      ],
      lanes: { road: { y: 975, depth: 0 }, field: { y: 820, depth: 0.25 }, sky: { y: 230, depth: 0.7, air: true } },
      spots: { barn: { x: 1320, depth: 0.35 }, field: { x: 760, depth: 0.25 }, mill: { x: 560, depth: 0.35 } },
    };
  });

  // ───────────────────────── factory floor ─────────────────────────
  R('factory', (o, rnd) => {
    const night = o.time === 'night';
    const defs = lg('e-wall', [[0, '#c9d1dd'], [1, '#aeb8c8']]) + lg('e-beam', [[0, '#ffffff', 0.35], [1, '#ffffff', 0]]) + lg('e-belt', [[0, '#3a3f4c'], [1, '#2a2e38']]);
    let wall = `<rect x="${X0}" y="-100" width="${WW}" height="1300" fill="url(#e-wall)"/>`;
    for (let x = X0 + 60; x < X1; x += 420) wall += `<rect x="${x}" y="70" width="300" height="320" rx="6" fill="${night ? '#1d2a4d' : '#d9ecfa'}"/><path d="M${x + 100},70 v320 M${x + 200},70 v320 M${x},180 h300 M${x},290 h300" stroke="#8a95a8" stroke-width="8"/><path d="M${x + 40},390 L${x + 260},390 L${x + 420},900 L${x - 140},900 Z" fill="url(#e-beam)" opacity="${night ? 0 : 0.5}" data-amb="pulse" data-s="0.6" data-lo=".55"/>`;
    wall += `<path d="M${X0},40 L${X1},40" stroke="#6b7486" stroke-width="18"/>` + Array.from({ length: 12 }, (_, i) => `<path d="M${X0 + i * 220},40 l110,-60 l110,60" fill="none" stroke="#6b7486" stroke-width="7"/>`).join('');
    wall += `<path d="M${X0},470 H${X1}" stroke="#e8574b" stroke-width="18"/><path d="M${X0},500 H${X1}" stroke="#3b7cf6" stroke-width="12"/>` + Array.from({ length: 10 }, (_, i) => `<rect x="${X0 + 100 + i * 260}" y="458" width="20" height="54" rx="4" fill="#5a6378"/>`).join('');
    // machines
    let mach = `<g transform="translate(260,780)"><rect x="-150" y="-300" width="300" height="300" rx="10" fill="#5b7ec2"/><rect x="-120" y="-270" width="240" height="90" rx="6" fill="#3c5a99"/>${[0, 1, 2].map(k => `<circle cx="${-70 + k * 70}" cy="-225" r="12" fill="${['#3fbf6a', '#f2c14e', '#e5484d'][k]}" data-amb="twinkle" data-s="${2 + k}" data-lo=".4"/>`).join('')}<g data-amb="bob" data-a="40" data-s="2.2"><rect x="-30" y="-170" width="60" height="110" fill="#c9cfd8"/><rect x="-70" y="-70" width="140" height="26" fill="#9aa3b5"/></g><rect x="-150" y="-30" width="300" height="30" fill="#3c4a66"/></g>`;
    mach += `<g transform="translate(980,700)"><g data-amb="spin" data-s="45" data-cx="0" data-cy="0">${gearPath(110, 14, '#8a95a8')}</g><circle r="34" fill="#5a6378"/><g transform="translate(180,40)" ><g data-amb="spin" data-s="-75" data-cx="0" data-cy="0">${gearPath(70, 10, '#a5aebd')}</g><circle r="22" fill="#5a6378"/></g></g>`;
    mach += `<g transform="translate(1620,780)"><rect x="-60" y="-40" width="120" height="40" rx="8" fill="#e8a23a"/><g data-amb="sway" data-a="22" data-s="0.9" data-cx="0" data-cy="-40"><rect x="-16" y="-260" width="32" height="230" rx="14" fill="#f2b43a"/><circle cx="0" cy="-40" r="26" fill="#d98a1e"/><g transform="translate(0,-250)" ><g data-amb="sway" data-a="30" data-s="1.3" data-cx="0" data-cy="0"><rect x="-14" y="-12" width="190" height="28" rx="12" fill="#f2b43a"/><circle r="22" fill="#d98a1e"/><path d="M176,-24 l30,-10 v36 l-30,-10 Z M176,26 l30,10 v-36" fill="#5a6378"/></g></g></g></g>`;
    // conveyor belt with rollers + moving boxes
    let belt = `<rect x="${X0}" y="772" width="${WW}" height="34" rx="8" fill="url(#e-belt)"/>`;
    for (let x = X0 + 20; x < X1; x += 60) belt += `<g data-amb="spin" data-s="220" data-cx="${x}" data-cy="789"><circle cx="${x}" cy="789" r="13" fill="#9aa3b5"/><line x1="${x - 11}" y1="789" x2="${x + 11}" y2="789" stroke="#5a6378" stroke-width="3"/></g>`;
    for (let i = 0; i < 7; i++) belt += `<g data-amb="move" data-x0="${X0 - 200}" data-x1="${X1 + 200}" data-s="120" data-p="${i * 400}" data-y="772"><rect x="-44" y="-70" width="88" height="70" rx="5" fill="#c99a62"/><path d="M-44,-46 h88 M0,-70 v24" stroke="#a37a46" stroke-width="5"/></g>`;
    belt += `<rect x="${X0}" y="806" width="${WW}" height="90" fill="#5a6378"/>` + Array.from({ length: 16 }, (_, i) => `<rect x="${X0 + 20 + i * 160}" y="806" width="16" height="90" fill="#454c5c"/>`).join('');
    const floor = `<rect x="${X0}" y="896" width="${WW}" height="220" fill="#8d96a6"/><rect x="${X0}" y="896" width="${WW}" height="16" fill="#f2c14e"/>` + Array.from({ length: 40 }, (_, i) => `<path d="M${X0 + i * 64},896 l32,0 l-16,16 l-32,0 Z" fill="#2b2f3a"/>`).join('');
    const lamps = Array.from({ length: 6 }, (_, i) => `<g transform="translate(${X0 + 250 + i * 420},0)"><line x1="0" y1="0" x2="0" y2="150" stroke="#454c5c" stroke-width="5"/><path d="M-50,190 L-22,150 L22,150 L50,190 Z" fill="#454c5c"/><ellipse cx="0" cy="192" rx="48" ry="9" fill="#fff6d0"/><path d="M-48,192 L-160,560 L160,560 L48,192 Z" fill="#fff6d0" opacity=".1"/></g>`).join('');
    return {
      actorScale: 0.72, ground: 905, horizon: 640, defs, dark: false, drift: 0.035,
      layers: [
        { depth: 0.2, svg: wall + lamps },
        { depth: 0.55, svg: mach },
        { depth: 0.8, svg: belt },
        { depth: 0.95, svg: floor },
      ],
      lanes: { belt: { y: 772, depth: 0.18 }, floor: { y: 905, depth: 0 } },
      spots: { press: { x: 260, depth: 0.35 }, gears: { x: 1060, depth: 0.4 }, robot: { x: 1620, depth: 0.35 }, belt: { x: 960, y: 772, depth: 0.18 } },
    };
  });
  function gearPath(r, n, c) {
    let d = '';
    for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n * 0.5, a2 = a0 + Math.PI / n, a3 = a2 + Math.PI / n * 0.5; d += `${i ? 'L' : 'M'}${f1(Math.cos(a0) * r)},${f1(Math.sin(a0) * r)} L${f1(Math.cos(a1) * r * 1.16)},${f1(Math.sin(a1) * r * 1.16)} L${f1(Math.cos(a2) * r * 1.16)},${f1(Math.sin(a2) * r * 1.16)} L${f1(Math.cos(a3) * r)},${f1(Math.sin(a3) * r)} `; }
    return `<path d="${d}Z" fill="${c}"/><circle r="${r * 0.62}" fill="${shade(c, -0.12)}"/>`;
  }
  K.gearPath = gearPath;

  // ───────────────────────── science lab ─────────────────────────
  R('lab', (o, rnd) => {
    const defs = lg('e-lwall', [[0, '#e9f4f8'], [1, '#d3e7ee']]) + lg('e-scr', [[0, '#0f1a2e'], [1, '#14284a']]) + skyDefs(TIME('day'));
    let wall = `<rect x="${X0}" y="-100" width="${WW}" height="1300" fill="url(#e-lwall)"/>` + Array.from({ length: 30 }, (_, i) => `<line x1="${X0 + i * 90}" y1="520" x2="${X0 + i * 90}" y2="760" stroke="#c9dde5" stroke-width="2"/>`).join('') + Array.from({ length: 4 }, (_, i) => `<line x1="${X0}" y1="${520 + i * 60}" x2="${X1}" y2="${520 + i * 60}" stroke="#c9dde5" stroke-width="2"/>`).join('');
    wall += `<g transform="translate(-120,90)"><rect width="360" height="300" rx="10" fill="url(#e-sky)"/><path d="M180,0 v300 M0,150 h360" stroke="#fff" stroke-width="14"/><rect width="360" height="300" rx="10" fill="none" stroke="#fff" stroke-width="18"/></g>`;
    let shelves = '';
    for (let r = 0; r < 2; r++) { shelves += `<rect x="330" y="${250 + r * 170}" width="560" height="14" rx="4" fill="#9aa9bd"/>`; for (let k = 0; k < 6; k++) { const c = ['#5bc0eb', '#e5677d', '#a78bfa', '#f2c14e', '#3fbf6a', '#ff8a5a'][(k + r * 2) % 6]; shelves += `<g transform="translate(${370 + k * 90},${250 + r * 170})"><path d="M-12,-86 L12,-86 L12,-58 L30,-8 Q30,0 24,0 L-24,0 Q-30,0 -30,-8 L-12,-58 Z" fill="#eef7fb" stroke="#b7c7d8" stroke-width="3"/><path d="M-22,-28 L22,-28 L28,-8 Q28,-3 24,-3 L-24,-3 Q-28,-3 -28,-8 Z" fill="${c}"/></g>`; } }
    const screen = `<g transform="translate(1180,120)"><rect x="-20" y="-20" width="640" height="420" rx="18" fill="#2c3445"/><rect width="600" height="380" rx="8" fill="url(#e-scr)"/><path d="M30,300 ${Array.from({ length: 12 }, (_, i) => `L${f1(30 + i * 48)},${f1(200 - Math.sin(i * 0.9) * 90 - i * 6)}`).join(' ')}" fill="none" stroke="#5bc0eb" stroke-width="5" stroke-dasharray="14 8" data-amb="flow" data-s="30"/>${Array.from({ length: 7 }, (_, i) => `<rect x="${380 + i * 28}" y="${f1(320 - (40 + (i * 37) % 120))}" width="18" height="${f1(40 + (i * 37) % 120)}" fill="#3fbf6a" opacity=".85"/>`).join('')}<circle cx="560" cy="34" r="8" fill="#3fbf6a" data-amb="twinkle" data-s="3"/></g><rect x="1440" y="520" width="80" height="70" fill="#4a5568"/>`;
    let bench = `<rect x="${X0}" y="738" width="${WW}" height="34" rx="6" fill="#f2f5f9"/><rect x="${X0}" y="772" width="${WW}" height="130" fill="#cfd8e3"/>` + Array.from({ length: 10 }, (_, i) => `<rect x="${X0 + 60 + i * 240}" y="790" width="200" height="96" rx="6" fill="#dfe6ee" stroke="#b9c4d2" stroke-width="3"/><circle cx="${X0 + 160 + i * 240}" cy="838" r="7" fill="#9aa9bd"/>`).join('');
    bench += `<g transform="translate(460,738)"><path d="M-30,0 L30,0 L20,-16 L-20,-16 Z" fill="#3c4a66"/><rect x="-8" y="-120" width="16" height="104" fill="#5a6378"/><rect x="-40" y="-150" width="70" height="40" rx="10" fill="#3c4a66" transform="rotate(-25 0 -130)"/><rect x="-6" y="-188" width="16" height="50" rx="4" fill="#2b2f3a" transform="rotate(-25 0 -130)"/><rect x="-46" y="-70" width="80" height="12" rx="4" fill="#9aa9bd"/></g>`;
    bench += [['#5bc0eb', 820], ['#3fbf6a', 960], ['#e5677d', 1100]].map(([c, x], i) => `<g transform="translate(${x},738)"><path d="M-36,0 L-36,-100 L36,-100 L36,0 Z" fill="#eef7fb" stroke="#b7c7d8" stroke-width="4"/><rect x="-32" y="-60" width="64" height="58" fill="${c}" opacity=".8"/>${[0, 1, 2].map(k => `<g data-amb="rise" data-h="70" data-s="${30 + k * 8}" data-p="${k * 20 + i * 10}" data-a="4"><circle cx="${-14 + k * 14}" cy="-12" r="${5 + (k % 2) * 3}" fill="#fff" opacity=".8"/></g>`).join('')}</g>`).join('');
    bench += `<g transform="translate(1660,738)"><rect x="-90" y="-16" width="180" height="16" fill="#9aa9bd"/>${[0, 1, 2, 3, 4].map(k => `<rect x="${-76 + k * 34}" y="-96" width="16" height="84" rx="8" fill="#eef7fb" stroke="#b7c7d8" stroke-width="3"/><rect x="${-74 + k * 34}" y="-50" width="12" height="36" rx="6" fill="${['#e5677d', '#f2c14e', '#5bc0eb', '#a78bfa', '#3fbf6a'][k]}"/>`).join('')}</g>`;
    const floor = `<rect x="${X0}" y="902" width="${WW}" height="220" fill="#b8c4d2"/>` + Array.from({ length: 16 }, (_, i) => `<line x1="${X0 + i * 170}" y1="902" x2="${X0 + i * 170 - 60}" y2="1080" stroke="#a7b3c2" stroke-width="3"/>`).join('');
    return {
      actorScale: 0.8, ground: 905, horizon: 640, defs, dark: false, drift: 0.035,
      screen: { x: 1180, y: 120, w: 600, h: 380, kind: 'monitor' },
      layers: [
        { depth: 0.2, svg: wall + shelves + screen },
        { depth: 0.85, svg: bench },
        { depth: 0.95, svg: floor },
      ],
      lanes: { bench: { y: 738, depth: 0.12 } },
      spots: { bench: { x: 960, y: 738, depth: 0.12 }, microscope: { x: 460, y: 738, depth: 0.12 }, screen: { x: 1480, y: 310, depth: 0.6 } },
    };
  });

  // ───────────────────────── office / trading floor ─────────────────────────
  R('office', (o, rnd) => {
    const T = TIME(o.time), N = T.dark, trading = o.variant === 'trading';
    const defs = skyDefs(T) + lg('e-scr', [[0, '#0f1a2e'], [1, '#14284a']]);
    let win = `<rect x="${X0}" y="-100" width="${WW}" height="1300" fill="${N ? '#3a3f55' : '#eef0f3'}"/><g><rect x="${X0 + 60}" y="60" width="${WW - 120}" height="560" fill="url(#e-sky)"/>`;
    for (let x = X0 + 60; x < X1 - 60;) { const w = 60 + rnd() * 100, h = 120 + rnd() * 320; win += `<rect x="${f1(x)}" y="${f1(620 - h)}" width="${f1(w)}" height="${f1(h)}" fill="${haze(N ? '#2c3668' : '#9fb3d4', T, 0.3)}"/>`; if (N) for (let k = 0; k < h / 32; k++) if (rnd() < 0.4) win += `<rect x="${f1(x + 8 + rnd() * (w - 16))}" y="${f1(620 - h + 12 + k * 30)}" width="6" height="8" fill="#ffd77a"/>`; x += w + 10; }
    win += `</g>` + Array.from({ length: 9 }, (_, i) => `<rect x="${X0 + 50 + i * 300}" y="50" width="20" height="580" fill="${N ? '#4a5068' : '#c9cfd8'}"/>`).join('') + `<rect x="${X0}" y="40" width="${WW}" height="24" fill="${N ? '#4a5068' : '#c9cfd8'}"/><rect x="${X0}" y="618" width="${WW}" height="24" fill="${N ? '#4a5068' : '#c9cfd8'}"/>`;
    if (trading) {
      win += `<rect x="${X0 + 120}" y="90" width="${WW - 240}" height="470" fill="#141a26"/>`;
      for (let i = 0; i < 6; i++) {
        const x = X0 + 150 + i * 360, y = 110;
        win += `<rect x="${x}" y="${y}" width="330" height="200" rx="6" fill="url(#e-scr)"/>` + Array.from({ length: 12 }, (_, k) => { const up = ((i * 7 + k * 3) % 5) > 1, h = 20 + ((i * 13 + k * 29) % 70), base = 150 + Math.sin(k * 0.8 + i) * 30 - k * 3 * (i % 2 ? 1 : -1); return `<line x1="${x + 22 + k * 25}" y1="${f1(y + base - h / 2 - 10)}" x2="${x + 22 + k * 25}" y2="${f1(y + base + h / 2 + 10)}" stroke="${up ? '#3fb950' : '#f85149'}" stroke-width="2"/><rect x="${x + 16 + k * 25}" y="${f1(y + base - h / 2)}" width="12" height="${h}" fill="${up ? '#3fb950' : '#f85149'}"/>`; }).join('');
        win += `<rect x="${x}" y="${y + 230}" width="330" height="200" rx="6" fill="url(#e-scr)"/><path d="M${x + 20},${y + 400} ${Array.from({ length: 10 }, (_, k) => `L${x + 20 + k * 32},${f1(y + 380 - (Math.sin(k * 0.7 + i) * 40 + k * 8))}`).join(' ')}" fill="none" stroke="${i % 2 ? '#3fb950' : '#5bc0eb'}" stroke-width="5" stroke-dasharray="16 6" data-amb="flow" data-s="25"/>`;
      }
      win += `<rect x="${X0}" y="570" width="${WW}" height="44" fill="#0b0f14"/><g data-amb="move" data-x0="${X0 - 1200}" data-x1="${X1}" data-s="-120" data-p="0" data-y="0">${Array.from({ length: 22 }, (_, k) => `<rect x="${k * 130}" y="584" width="${60 + (k * 17) % 50}" height="16" rx="3" fill="${k % 3 ? '#3fb950' : '#f85149'}" opacity=".9"/>`).join('')}</g>`;
    } else {
      win += `<g transform="translate(1080,130)"><rect x="-16" y="-16" width="672" height="432" rx="14" fill="#8a8f9c"/><rect width="640" height="400" rx="8" fill="#ffffff"/><g opacity=".5" fill="none" stroke-linecap="round"><path d="M60,340 L60,80 M60,340 L330,340" stroke="#3b4250" stroke-width="5"/><rect x="88" y="262" width="40" height="78" fill="#5bc0eb" stroke="none"/><rect x="148" y="222" width="40" height="118" fill="#5bc0eb" stroke="none"/><rect x="208" y="170" width="40" height="170" fill="#5bc0eb" stroke="none"/><rect x="268" y="120" width="40" height="220" fill="#f08a3c" stroke="none"/><path d="M380,100 L590,100 M380,150 L550,150 M380,200 L570,200 M380,250 L510,250" stroke="#3b4250" stroke-width="6"/><path d="M400,300 q40,-30 80,0 t80,0" stroke="#e8574b" stroke-width="6"/></g><rect x="40" y="392" width="120" height="10" rx="4" fill="#cfd3da"/><rect x="60" y="384" width="34" height="8" rx="3" fill="#e8574b"/><rect x="100" y="384" width="34" height="8" rx="3" fill="#3b7cf6"/></g>`;
    }
    let desks = '';
    for (let i = 0; i < 5; i++) {
      const x = X0 + 150 + i * 520;
      desks += `<g transform="translate(${x},760)"><rect x="-170" y="0" width="340" height="22" rx="6" fill="#a97a4c"/><rect x="-160" y="22" width="16" height="120" fill="#7d5a37"/><rect x="144" y="22" width="16" height="120" fill="#7d5a37"/><rect x="-90" y="-150" width="180" height="120" rx="8" fill="#2c3445"/><rect x="-80" y="-140" width="160" height="100" rx="4" fill="url(#e-scr)"/><path d="M-70,-60 ${Array.from({ length: 6 }, (_, k) => `L${-70 + k * 28},${f1(-70 - ((i * 3 + k * 7) % 5) * 12)}`).join(' ')}" fill="none" stroke="${i % 2 ? '#3fb950' : '#5bc0eb'}" stroke-width="4"/><rect x="-12" y="-30" width="24" height="30" fill="#4a5568"/><rect x="-60" y="-8" width="120" height="8" rx="3" fill="#cfd3da"/>${i % 2 ? `<g transform="translate(130,0)"><path d="M-14,0 L-18,-30 L18,-30 L14,0 Z" fill="#fff"/><g data-amb="rise" data-h="50" data-s="20"><circle cx="0" cy="-34" r="6" fill="#fff" opacity=".7"/></g></g>` : `<g transform="translate(-130,0)"><path d="M-16,0 L-20,-34 L20,-34 L16,0 Z" fill="#d77a52"/><circle cx="0" cy="-60" r="30" fill="#5daa58"/></g>`}</g>`;
    }
    const floor = `<rect x="${X0}" y="900" width="${WW}" height="220" fill="${N ? '#2f3448' : '#c7bfae'}"/>`;
    return {
      actorScale: 0.8, ground: 905, horizon: 660, defs, dark: N, drift: 0.035,
      screen: trading ? null : { x: 1080, y: 130, w: 640, h: 400, kind: 'whiteboard' },
      layers: [
        { depth: 0.25, svg: win },
        { depth: 0.85, svg: desks },
        { depth: 0.95, svg: floor },
      ],
      lanes: { floor: { y: 905, depth: 0 } },
      spots: { desk: { x: X0 + 150 + 2 * 520, depth: 0.1 }, screen: { x: trading ? 960 : 1400, y: 330, depth: 0.6 }, window: { x: 600, y: 330, depth: 0.7 } },
    };
  });

  // ───────────────────────── home ─────────────────────────
  R('home', (o, rnd) => {
    const T = TIME(o.time), N = T.dark, kitchen = o.variant === 'kitchen';
    const defs = skyDefs(T) + rg('e-lampglow', [[0, '#fff1c0', 0.6], [1, '#fff1c0', 0]]);
    const wallC = N ? '#5a5068' : '#f4e3cf';
    let wall = `<rect x="${X0}" y="-100" width="${WW}" height="1300" fill="${wallC}"/><rect x="${X0}" y="640" width="${WW}" height="14" fill="${shade(wallC, -0.12)}"/>`;
    wall += `<g transform="translate(140,140)"><rect width="460" height="380" rx="10" fill="url(#e-sky)"/>${N ? '' : `<circle cx="340" cy="90" r="40" fill="#fff4c4"/>`}<path d="M0,260 Q120,220 230,250 T460,230 L460,380 L0,380 Z" fill="${tone('#8cc972', T)}"/><rect width="460" height="380" rx="10" fill="none" stroke="#fff" stroke-width="18"/><rect x="221" y="0" width="18" height="380" fill="#fff"/><path d="M-40,-20 L60,-20 Q40,190 70,400 L-40,400 Z M500,-20 L400,-20 Q420,190 390,400 L500,400 Z" fill="#e5677d" opacity=".9"/></g>`;
    if (kitchen) {
      wall += Array.from({ length: 14 }, (_, i) => `<rect x="${X0 + 700 + (i % 7) * 120}" y="${120 + Math.floor(i / 7) * 120}" width="110" height="110" rx="6" fill="${N ? '#6a6178' : '#ffffff'}" stroke="${shade(wallC, -0.1)}" stroke-width="4"/>`).join('');
      wall += `<g transform="translate(1680,880)"><rect x="-120" y="-520" width="240" height="520" rx="16" fill="#e8ecf2"/><line x1="-120" y1="-330" x2="120" y2="-330" stroke="#c9cfd8" stroke-width="5"/><rect x="88" y="-480" width="10" height="110" rx="5" fill="#9aa3b5"/><rect x="88" y="-300" width="10" height="160" rx="5" fill="#9aa3b5"/></g>`;
    } else {
      wall += `<g transform="translate(1180,250)"><rect x="-10" y="-10" width="520" height="320" rx="14" fill="#2b2f3a"/><rect width="500" height="300" rx="6" fill="#141821"/><rect x="10" y="10" width="480" height="280" rx="4" fill="#5bc0eb" opacity=".25" data-amb="pulse" data-s="1.1" data-lo=".6"/></g>` + `<g transform="translate(860,250)"><rect x="-60" y="-40" width="120" height="90" fill="#fff" stroke="#c49a6c" stroke-width="10"/><path d="M-40,30 L-10,-10 L10,10 L30,-20 L40,30 Z" fill="#7cc36b"/></g>`;
    }
    let furn = '';
    if (kitchen) furn += `<g transform="translate(900,880)"><rect x="-520" y="-240" width="1040" height="240" fill="#a97a4c"/><rect x="-540" y="-262" width="1080" height="26" rx="6" fill="#e8e1d6"/>${[0, 1, 2, 3].map(k => `<rect x="${-490 + k * 255}" y="-210" width="225" height="180" rx="6" fill="#b98a5b" stroke="#8f6440" stroke-width="4"/>`).join('')}<g transform="translate(-200,-262)"><rect x="-80" y="-10" width="160" height="10" fill="#4a4f5c"/><path d="M-60,-10 L-60,-70 L60,-70 L60,-10 Z" fill="#9aa3b5"/><g data-amb="rise" data-h="140" data-s="40"><circle cx="0" cy="-80" r="16" fill="#fff" opacity=".7"/></g><g data-amb="rise" data-h="140" data-s="40" data-p="70"><circle cx="20" cy="-80" r="12" fill="#fff" opacity=".6"/></g></g></g>`;
    else furn += `<g transform="translate(560,900)"><rect x="-330" y="-170" width="660" height="140" rx="40" fill="#5e8fd6"/><rect x="-330" y="-260" width="660" height="120" rx="40" fill="#6d9ee0"/><rect x="-370" y="-190" width="90" height="190" rx="34" fill="#5585cc"/><rect x="280" y="-190" width="90" height="190" rx="34" fill="#5585cc"/><rect x="-300" y="-30" width="20" height="30" fill="#4a3a2a"/><rect x="280" y="-30" width="20" height="30" fill="#4a3a2a"/></g><g transform="translate(1300,900)"><rect x="-150" y="-80" width="300" height="20" rx="6" fill="#a97a4c"/><rect x="-130" y="-60" width="14" height="60" fill="#7d5a37"/><rect x="116" y="-60" width="14" height="60" fill="#7d5a37"/><path d="M-20,-80 L-24,-110 L20,-110 L16,-80 Z" fill="#fff"/><g data-amb="rise" data-h="60" data-s="20"><circle cx="-2" cy="-118" r="7" fill="#fff" opacity=".7"/></g></g><g transform="translate(1860,900)">${N ? '<circle cx="0" cy="-470" r="160" fill="url(#e-lampglow)"/>' : ''}<rect x="-6" y="-440" width="12" height="440" fill="#6b5a4a"/><path d="M-70,-430 L70,-430 L44,-540 L-44,-540 Z" fill="#f7d77c"/><ellipse cx="0" cy="-4" rx="60" ry="12" fill="#6b5a4a"/></g>`;
    const floor = `<rect x="${X0}" y="880" width="${WW}" height="240" fill="${N ? '#4a3a3a' : '#b98e62'}"/>` + Array.from({ length: 22 }, (_, i) => `<line x1="${X0 + i * 120}" y1="880" x2="${X0 + i * 120 - 40}" y2="1080" stroke="${N ? '#3a2e2e' : '#a77b52'}" stroke-width="3"/>`).join('') + (kitchen ? '' : `<ellipse cx="900" cy="980" rx="560" ry="70" fill="#d98c6f" opacity=".55"/>`);
    return {
      actorScale: 0.85, ground: 915, horizon: 640, defs, dark: N, drift: 0.035,
      screen: kitchen ? null : { x: 1190, y: 260, w: 480, h: 280, kind: 'tv' },
      layers: [
        { depth: 0.25, svg: wall },
        { depth: 0.85, svg: furn },
        { depth: 0.95, svg: floor },
      ],
      lanes: { floor: { y: 915, depth: 0 } },
      spots: { sofa: { x: 560, depth: 0.05 }, table: { x: 1300, depth: 0.05 }, window: { x: 370, y: 330, depth: 0.6 }, tv: { x: 1430, y: 400, depth: 0.6 } },
    };
  });

  // ───────────────────────── history: citadel / camp / palace ─────────────────────────
  R('ancient', (o, rnd) => {
    const v = o.variant || 'citadel', T = TIME(o.time || (v === 'palace' ? 'day' : 'sunset')), N = T.dark;
    const defs = skyDefs(T) + rg('e-fire', [[0, '#ffd36b', 0.9], [0.4, '#ff8a3c', 0.5], [1, '#ff5a3c', 0]]) + lg('e-lacq', [[0, '#b8322a'], [1, '#8f2620']]);
    const banner = (x, y, c, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><rect x="-4" y="-240" width="8" height="240" fill="#6b4a2e"/><g data-amb="sway" data-a="5" data-s="1.6" data-p="${f1(x % 7)}" data-cx="4" data-cy="-230"><path d="M4,-232 L104,-222 Q86,-190 104,-160 L4,-150 Z" fill="${c}"/><circle cx="46" cy="-190" r="14" fill="#f2c14e" opacity=".9"/></g></g>`;
    const torch = (x, y) => `<g transform="translate(${x},${y})"><rect x="-5" y="-110" width="10" height="110" fill="#6b4a2e"/><circle cx="0" cy="-130" r="60" fill="url(#e-fire)" data-amb="pulse" data-s="7" data-lo=".6"/><g data-amb="breathe" data-a=".12" data-s="9" data-cx="0" data-cy="-118"><path d="M0,-162 Q16,-136 8,-118 Q0,-110 -8,-118 Q-16,-136 0,-162 Z" fill="#ffb347"/></g></g>`;
    if (v === 'palace') {
      let hall = `<rect x="${X0}" y="-100" width="${WW}" height="1300" fill="#f1dfb6"/><rect x="${X0}" y="0" width="${WW}" height="120" fill="#8f2620"/>` + Array.from({ length: 24 }, (_, i) => `<rect x="${X0 + i * 110}" y="100" width="90" height="26" fill="#d9a21c"/>`).join('');
      hall += `<g transform="translate(960,560)"><rect x="-300" y="-300" width="600" height="300" fill="#e6c97a"/><path d="M-300,-300 h600" stroke="#d9a21c" stroke-width="16"/><circle cx="0" cy="-170" r="90" fill="none" stroke="#c9902a" stroke-width="12"/><path d="M-60,-170 q30,-50 60,0 t60,0" fill="none" stroke="#c9902a" stroke-width="10"/></g>`;
      for (let i = 0; i < 6; i++) { const x = X0 + 200 + i * 420; hall += `<rect x="${x - 40}" y="80" width="80" height="820" fill="url(#e-lacq)"/><rect x="${x - 54}" y="80" width="108" height="40" fill="#d9a21c"/><rect x="${x - 54}" y="860" width="108" height="40" fill="#d9a21c"/>`; }
      hall += Array.from({ length: 5 }, (_, i) => `<g data-amb="sway" data-a="2" data-s="1" data-p="${i}" data-cx="${X0 + 410 + i * 420}" data-cy="120"><line x1="${X0 + 410 + i * 420}" y1="120" x2="${X0 + 410 + i * 420}" y2="220" stroke="#6b4a2e" stroke-width="4"/><ellipse cx="${X0 + 410 + i * 420}" cy="260" rx="34" ry="44" fill="#e8453c"/><rect x="${X0 + 396 + i * 420}" y="212" width="28" height="12" fill="#f2c14e"/></g>`).join('');
      const floor = `<rect x="${X0}" y="900" width="${WW}" height="220" fill="#b8322a"/><path d="M${X0},900 H${X1}" stroke="#d9a21c" stroke-width="10"/><rect x="560" y="820" width="800" height="80" fill="#9e2a22"/><rect x="620" y="760" width="680" height="60" fill="#b8322a"/>`;
      return { actorScale: 0.75, ground: 915, horizon: 650, defs, dark: false, drift: 0.035, layers: [{ depth: 0.25, svg: hall }, { depth: 0.95, svg: floor }], spots: { throne: { x: 960, y: 760, depth: 0.2 }, left: { x: 420 }, right: { x: 1500 } } };
    }
    const far = `<path d="${ridge(rnd, 600, 160, 260)}" fill="${haze('#6a7a8a', T, 0.5)}"/><path d="${ridge(rnd, 660, 90, 200)}" fill="${haze('#7a8a6a', T, 0.3)}"/>`;
    if (v === 'camp') {
      let tents = '';
      const tent = (x, y, s, c) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-140,0 L0,-170 L140,0 Z" fill="${tone(c, T)}"/><path d="M0,-170 L140,0 L60,0 Z" fill="${shade(tone(c, T), -0.18)}"/><path d="M-30,0 L0,-120 L30,0 Z" fill="#3a2e22"/><line x1="0" y1="-170" x2="0" y2="-210" stroke="#6b4a2e" stroke-width="6"/></g>`;
      [[180, 760, 0.8, '#d9c39a'], [520, 740, 0.65, '#c9b083'], [1300, 750, 0.75, '#d9c39a'], [1700, 770, 0.9, '#e2cfa6'], [-60, 750, 0.7, '#c9b083']].forEach(([x, y, s, c]) => { tents += tent(x, y, s, c); });
      tents += banner(380, 770, '#c0392b', 0.9) + banner(1080, 760, '#f2b43a', 0.85) + banner(1520, 780, '#c0392b', 0.9);
      const fire = `<g transform="translate(960,900)"><circle cx="0" cy="-40" r="180" fill="url(#e-fire)" data-amb="pulse" data-s="6" data-lo=".55"/>${[0, 1, 2].map(k => `<g data-amb="breathe" data-a=".14" data-s="${8 + k * 2}" data-p="${k}" data-cx="${-24 + k * 24}" data-cy="-20"><path d="M${-24 + k * 24},-${70 + (k % 2) * 30} Q${-4 + k * 24},-30 ${-12 + k * 24},-10 Q${-24 + k * 24},0 ${-36 + k * 24},-10 Q${-44 + k * 24},-30 ${-24 + k * 24},-${70 + (k % 2) * 30} Z" fill="${['#ff8a3c', '#ffd36b', '#ff5a3c'][k]}"/></g>`).join('')}<path d="M-60,0 L60,-20 M-60,-20 L60,0" stroke="#5a3e2a" stroke-width="14" stroke-linecap="round"/></g>`;
      return {
        actorScale: 0.6, ground: 915, horizon: 680, defs, dark: N,
        layers: [
          { depth: 0.03, svg: skyLayer(T, rnd, { sunX: 1500, clouds: 3 }) },
          { depth: 0.15, svg: far },
          { depth: 0.5, svg: `<rect x="${X0}" y="700" width="${WW}" height="400" fill="${tone('#a8956a', T)}"/>` + tents },
          { depth: 0.9, svg: `<rect x="${X0}" y="890" width="${WW}" height="220" fill="${tone('#8f7a52', T)}"/>${grass(rnd, 896, X0, X1, tone('#6e7a42', T), 20, 18)}` + fire },
        ],
        spots: { fire: { x: 960, depth: 0 }, tent: { x: 1300, depth: 0.3 }, left: { x: 420 }, right: { x: 1500 } },
      };
    }
    // citadel
    const wallC = tone('#b9a98c', T);
    let wall = `<rect x="${X0}" y="560" width="${WW}" height="340" fill="${wallC}"/>` + Array.from({ length: 34 }, (_, i) => `<rect x="${X0 + i * 72}" y="530" width="44" height="36" fill="${wallC}"/>`).join('');
    for (let r = 0; r < 6; r++) for (let x = X0 + (r % 2) * 50; x < X1; x += 100) wall += `<rect x="${x}" y="${580 + r * 52}" width="96" height="48" fill="none" stroke="${shade(wallC, -0.15)}" stroke-width="3"/>`;
    wall += `<g transform="translate(960,900)"><rect x="-230" y="-430" width="460" height="430" fill="${shade(wallC, -0.06)}"/><path d="M-110,0 L-110,-200 Q0,-300 110,-200 L110,0 Z" fill="#3a2e22"/><rect x="-260" y="-480" width="520" height="60" fill="${tone('#8f2620', T)}"/><path d="M-300,-470 Q0,-560 300,-470 L260,-440 L-260,-440 Z" fill="${tone('#5a3e2a', T)}"/><rect x="-170" y="-560" width="340" height="80" fill="${tone('#8f2620', T)}"/><path d="M-220,-550 Q0,-640 220,-550 L190,-520 L-190,-520 Z" fill="${tone('#5a3e2a', T)}"/></g>`;
    wall += banner(700, 540, '#c0392b') + banner(1220, 540, '#f2b43a') + banner(300, 540, '#c0392b', 0.9) + banner(1640, 540, '#f2b43a', 0.9) + torch(820, 900) + torch(1100, 900);
    return {
      actorScale: 0.55, ground: 930, horizon: 690, defs, dark: N,
      layers: [
        { depth: 0.03, svg: skyLayer(T, rnd, { sunX: 1600, clouds: 3 }) + birds(rnd, 4, 140, T) },
        { depth: 0.15, svg: far },
        { depth: 0.6, svg: wall },
        { depth: 0.92, svg: `<rect x="${X0}" y="900" width="${WW}" height="220" fill="${tone('#a58b62', T)}"/>${grass(rnd, 904, X0, X1, tone('#7d8a4a', T), 18, 20)}` },
      ],
      spots: { gate: { x: 960, depth: 0.15 }, wall: { x: 500, depth: 0.25 }, left: { x: 420 }, right: { x: 1500 } },
    };
  });

  // Legacy names → new environments.
  C.registerSetting('countryside', (o, rnd) => C.getSetting('village')(o, rnd));
  C.registerSetting('ricefield', (o, rnd) => C.getSetting('village')(o, rnd));
})();
