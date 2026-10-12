/* Drawing helpers shared by the environment libraries (envs-*.js). Pure string builders → SVG markup.
 * World drawing extent: x from X0 to X1 (wider than the 1920 frame so the camera can pan), y 0..1080. */
(function () {
  const X0 = -260, X1 = 2180;

  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const shade = (c, k) => (k < 0 ? mix(c, '#000000', -k) : mix(c, '#ffffff', k));
  const f1 = v => (Math.round(v * 10) / 10).toString();

  const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
  const rg = (id, stops, cx = '50%', cy = '50%', r = '50%') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;

  // Time-of-day palettes. tone() pulls a base colour toward the light of the scene.
  const TIMES = {
    day: { name: 'day', top: '#5aa9ea', mid: '#97cdf2', low: '#dff2fb', haze: '#d3e9f7', sun: '#fff4c4', glow: '#ffe28a', dark: false },
    sunset: { name: 'sunset', top: '#2f3b78', mid: '#c56c8c', low: '#ffb47c', haze: '#f6b896', sun: '#ffe0a8', glow: '#ff8f52', dark: false },
    night: { name: 'night', top: '#060a20', mid: '#121a44', low: '#27336b', haze: '#232c58', sun: '#f4f0d2', glow: '#b9c6ff', dark: true },
  };
  const TIME = t => TIMES[t] || TIMES.day;
  const tone = (c, T, k = 1) => (T.name === 'night' ? mix(c, '#141c45', 0.58 * k) : T.name === 'sunset' ? mix(c, '#b8586a', 0.2 * k) : c);
  const haze = (c, T, k) => mix(tone(c, T), T.haze, k);

  function skyDefs(T, id = 'e-sky') {
    return lg(id, [[0, T.top], [0.55, T.mid], [1, T.low]]) + rg(`${id}-glow`, [[0, T.glow, 0.85], [0.35, T.glow, 0.35], [1, T.glow, 0]]);
  }
  function cloud(x, y, s, T, k = 0) {
    const c = T.name === 'night' ? '#3a4680' : T.name === 'sunset' ? '#ffd6c0' : '#ffffff';
    const sh = T.name === 'night' ? '#2b3568' : T.name === 'sunset' ? '#e79a9a' : '#d9e9f6';
    return `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})" opacity="${1 - k}"><ellipse cx="0" cy="14" rx="118" ry="26" fill="${sh}"/><circle cx="-56" cy="-4" r="40" fill="${c}"/><circle cx="-6" cy="-30" r="56" fill="${c}"/><circle cx="50" cy="-8" r="42" fill="${c}"/><ellipse cx="0" cy="8" rx="112" ry="26" fill="${c}"/><ellipse cx="-14" cy="-40" rx="26" ry="14" fill="#fff" opacity="${T.name === 'night' ? 0.08 : 0.45}"/></g>`;
  }
  /** Sky layer: gradient, sun/moon with glow, drifting clouds (day/sunset) or twinkling stars (night). */
  function skyLayer(T, rnd, o = {}) {
    const sx = o.sunX ?? 1500, sy = o.sunY ?? (T.name === 'sunset' ? 520 : 200);
    let s = `<rect x="${X0}" y="-200" width="${X1 - X0}" height="1500" fill="url(#e-sky)"/>`;
    if (T.name === 'night') {
      let st = '';
      for (let i = 0; i < (o.stars ?? 120); i++) st += `<circle cx="${f1(X0 + rnd() * (X1 - X0))}" cy="${f1(rnd() * (o.starH ?? 620))}" r="${f1(0.8 + rnd() * 2.2)}" fill="#fff" opacity="${f1(0.35 + rnd() * 0.6)}"/>`;
      s += `<g data-amb="twinkle" data-s="1.7" data-lo=".55">${st}</g>`;
    }
    if (o.sun !== false) {
      s += `<circle cx="${sx}" cy="${sy}" r="${T.name === 'sunset' ? 420 : 260}" fill="url(#e-sky-glow)"/>`;
      s += T.name === 'night'
        ? `<circle cx="${sx}" cy="${sy}" r="54" fill="${T.sun}"/><circle cx="${sx - 16}" cy="${sy - 10}" r="9" fill="#e2dcb8"/><circle cx="${sx + 18}" cy="${sy + 14}" r="6" fill="#e2dcb8"/>`
        : `<circle cx="${sx}" cy="${sy}" r="${T.name === 'sunset' ? 90 : 70}" fill="${T.sun}"/>`;
    }
    if (o.clouds !== false) {
      let cl = '';
      const n = o.clouds ?? (T.name === 'night' ? 3 : 5);
      for (let i = 0; i < n; i++) cl += cloud(X0 + 200 + (i + rnd() * 0.6) * ((X1 - X0 - 300) / n), 110 + rnd() * 220, 0.55 + rnd() * 0.6, T, T.name === 'night' ? 0.5 : 0);
      s += `<g data-amb="drift" data-s="${o.wind ?? 7}">${cl}</g>`;
    }
    return s;
  }
  /** Smooth rolling ridge closed to the bottom. */
  function ridge(rnd, y, amp, step = 160, x0 = X0, x1 = X1, bottom = 1200) {
    const pts = [];
    for (let x = x0 - step; x <= x1 + step; x += step * (0.7 + rnd() * 0.6)) pts.push([x, y - amp * (0.25 + rnd() * 0.75)]);
    let d = `M${x0 - step},${bottom} L${f1(pts[0][0])},${f1(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) { const [xa, ya] = pts[i - 1], [xb, yb] = pts[i]; d += ` Q${f1(xa)},${f1(ya)} ${f1((xa + xb) / 2)},${f1((ya + yb) / 2)}`; }
    return d + ` L${x1 + step},${bottom} Z`;
  }
  /** Jagged mountain range with sharp peaks; returns { d, peaks: [[x,y]] }. */
  function peaks(rnd, y, amp, n, x0 = X0, x1 = X1, bottom = 1200) {
    const pts = [[x0 - 200, y]], ps = [];
    for (let i = 0; i < n; i++) {
      const cx = x0 + ((i + 0.3 + rnd() * 0.4) / n) * (x1 - x0), h = amp * (0.55 + rnd() * 0.45), w = (x1 - x0) / n * (0.55 + rnd() * 0.3);
      pts.push([cx - w * 0.5, y - h * 0.25 - rnd() * 30], [cx - w * 0.16, y - h * 0.75], [cx, y - h], [cx + w * 0.2, y - h * 0.7], [cx + w * 0.5, y - h * 0.2 - rnd() * 30]);
      ps.push([cx, y - h, w, h]);
    }
    pts.push([x1 + 200, y]);
    return { d: `M${x0 - 200},${bottom} ` + pts.map(([x, yy]) => `L${f1(x)},${f1(yy)}`).join(' ') + ` L${x1 + 200},${bottom} Z`, peaks: ps };
  }
  function snowCaps(ps, col = '#ffffff') {
    return ps.map(([cx, top, w, h]) => `<path d="M${f1(cx - w * 0.16 * 0.42)},${f1(top + h * 0.75 * 0.42 - 0)} L${f1(cx)},${f1(top)} L${f1(cx + w * 0.2 * 0.42)},${f1(top + h * 0.7 * 0.42)} L${f1(cx + w * 0.04)},${f1(top + h * 0.28)} L${f1(cx - w * 0.03)},${f1(top + h * 0.34)} Z" fill="${col}" opacity=".92"/>`).join('');
  }
  /** Vietnamese limestone karst towers (Hạ Long / Ninh Bình). */
  function karst(rnd, y, n, hmin, hmax, x0 = X0, x1 = X1) {
    let d = `M${x0 - 100},1200 L${x0 - 100},${y}`;
    let x = x0 - 100;
    while (x < x1 + 100) {
      const w = 110 + rnd() * 170, h = hmin + rnd() * (hmax - hmin), lean = (rnd() - 0.5) * 40;
      d += ` C${f1(x + w * 0.05)},${f1(y - h * 0.8)} ${f1(x + w * 0.25 + lean)},${f1(y - h * 1.05)} ${f1(x + w * 0.5 + lean)},${f1(y - h)} C${f1(x + w * 0.78 + lean)},${f1(y - h * 0.98)} ${f1(x + w * 0.95)},${f1(y - h * 0.7)} ${f1(x + w)},${f1(y - rnd() * 30)}`;
      x += w * (0.75 + rnd() * 0.35);
    }
    return d + ` L${x1 + 100},1200 Z`;
  }
  // ── vegetation ──
  const treeRound = (x, y, s, c, trunk = '#7a5233') => `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})"><path d="M-9,0 L-6,-120 L6,-120 L9,0 Z" fill="${trunk}"/><path d="M0,-70 L-30,-104 M0,-84 L26,-112" stroke="${trunk}" stroke-width="7" stroke-linecap="round"/><circle cx="0" cy="-160" r="66" fill="${c}"/><circle cx="-50" cy="-122" r="46" fill="${c}"/><circle cx="52" cy="-126" r="48" fill="${c}"/><circle cx="20" cy="-196" r="40" fill="${c}"/><circle cx="-24" cy="-190" r="30" fill="${shade(c, 0.12)}" opacity=".85"/><path d="M-90,-120 Q0,-60 92,-124 Q60,-96 0,-92 Q-60,-96 -90,-120 Z" fill="${shade(c, -0.14)}" opacity=".55"/></g>`;
  const treePine = (x, y, s, c, trunk = '#6b4a2e') => `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})"><rect x="-7" y="-30" width="14" height="30" fill="${trunk}"/><path d="M0,-210 L-46,-120 L-24,-124 L-62,-62 L-30,-66 L-74,-24 L74,-24 L30,-66 L62,-62 L24,-124 L46,-120 Z" fill="${c}"/><path d="M0,-210 L46,-120 L24,-124 L62,-62 L30,-66 L74,-24 L0,-24 Z" fill="${shade(c, -0.15)}" opacity=".6"/></g>`;
  const palm = (x, y, s, c = '#3f9a52', amb = true) => `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})"><path d="M-6,0 Q-14,-120 14,-250 L24,-248 Q4,-120 10,0 Z" fill="#9b7246"/>${[0, 1, 2, 3, 4].map(i => `<path d="M0,0 Q${-40 + i * 6},-12 ${-80 + i * 10},6" fill="none" stroke="#7d5a37" stroke-width="2" opacity=".0"/>`).join('')}<g ${amb ? 'data-amb="sway" data-a="3" data-s="0.9" data-cx="18" data-cy="-250"' : ''}>${[-150, -110, -60, -20, 25, 70].map((a, i) => `<path d="M18,-250 Q${f1(18 + Math.cos(a * Math.PI / 180) * 70)},${f1(-250 + Math.sin(a * Math.PI / 180) * 70 - 30)} ${f1(18 + Math.cos(a * Math.PI / 180) * 140)},${f1(-250 + Math.sin(a * Math.PI / 180) * 140 + 40)} Q${f1(18 + Math.cos(a * Math.PI / 180) * 60)},${f1(-250 + Math.sin(a * Math.PI / 180) * 60 + 5)} 18,-250 Z" fill="${i % 2 ? shade(c, -0.12) : c}"/>`).join('')}<circle cx="14" cy="-244" r="9" fill="#6b4a2e"/><circle cx="26" cy="-240" r="8" fill="#6b4a2e"/></g></g>`;
  const bamboo = (x, y, s, c = '#6ea84a') => `<g data-amb="sway" data-a="1.4" data-s="0.7" data-p="${f1(x % 7)}" data-cx="${f1(x)}" data-cy="${f1(y)}"><g transform="translate(${f1(x)},${f1(y)}) scale(${s})">${[-26, -8, 10, 28].map((dx, i) => `<path d="M${dx},0 Q${dx + (i - 1.5) * 10},-170 ${dx + (i - 1.5) * 34},-330" fill="none" stroke="${i % 2 ? shade(c, -0.15) : c}" stroke-width="9" stroke-linecap="round"/>`).join('')}${Array.from({ length: 16 }, (_, i) => { const a = (i * 47) % 360, r = 50 + (i * 13) % 40, cx = Math.cos(a * Math.PI / 180) * r, cy = -280 + Math.sin(a * Math.PI / 180) * r * 0.7; return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="34" ry="11" fill="${i % 3 ? c : shade(c, -0.18)}" transform="rotate(${a} ${f1(cx)} ${f1(cy)})"/>`; }).join('')}</g></g>`;
  const banana = (x, y, s, c = '#5fae4a') => `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})"><path d="M-8,0 Q-4,-90 0,-150 L10,-150 Q8,-90 10,0 Z" fill="#8aa04a"/>${[-160, -120, -70, -30, 15].map((a, i) => `<path d="M4,-150 Q${f1(4 + Math.cos(a * Math.PI / 180) * 60)},${f1(-150 + Math.sin(a * Math.PI / 180) * 60 - 40)} ${f1(4 + Math.cos(a * Math.PI / 180) * 130)},${f1(-150 + Math.sin(a * Math.PI / 180) * 110 + 30)} Q${f1(4 + Math.cos(a * Math.PI / 180) * 50)},${f1(-150 + Math.sin(a * Math.PI / 180) * 40)} 4,-150 Z" fill="${i % 2 ? shade(c, -0.12) : c}"/>`).join('')}</g>`;
  function grass(rnd, y, x0, x1, c, h = 26, step = 14) {
    let d = '';
    for (let x = x0; x < x1; x += step * (0.6 + rnd() * 0.8)) { const hh = h * (0.5 + rnd()); d += `M${f1(x)},${y} q${f1(2 + rnd() * 4)},${f1(-hh * 0.6)} ${f1(-4 + rnd() * 8)},${f1(-hh)} q${f1(4)},${f1(hh * 0.5)} ${f1(6)},${f1(hh)} `; }
    return `<path d="${d}" fill="${c}"/>`;
  }
  // ── built environment ──
  function windows(x, y, w, h, rnd, T, c, lit = 0.45) {
    const cols = Math.max(2, Math.floor(w / 44)), rows = Math.max(2, Math.floor((h - 50) / 58)), gw = (w - 26) / cols;
    let s = '';
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const on = T.name === 'night' ? rnd() < lit : false;
      const fill = on ? '#ffd77a' : T.name === 'night' ? shade(c, -0.55) : mix('#cfe6f7', c, 0.25);
      s += `<rect x="${f1(x + 15 + k * gw)}" y="${f1(y + 26 + r * 58)}" width="${f1(gw - 14)}" height="34" rx="3" fill="${fill}"/>`;
      if (!on && T.name !== 'night') s += `<rect x="${f1(x + 15 + k * gw)}" y="${f1(y + 26 + r * 58)}" width="${f1((gw - 14) * 0.35)}" height="34" fill="#ffffff" opacity=".35"/>`;
    }
    return s;
  }
  function building(x, base, w, h, c, rnd, T, o = {}) {
    let s = `<g><rect x="${f1(x)}" y="${f1(base - h)}" width="${f1(w)}" height="${f1(h + 4)}" fill="${c}"/>`;
    s += `<rect x="${f1(x + w - 16)}" y="${f1(base - h)}" width="16" height="${f1(h + 4)}" fill="${shade(c, -0.12)}"/>`;
    if (o.roof === 'tri') s += `<path d="M${f1(x - 10)},${f1(base - h)} L${f1(x + w / 2)},${f1(base - h - w * 0.36)} L${f1(x + w + 10)},${f1(base - h)} Z" fill="${shade(c, -0.3)}"/>`;
    else {
      s += `<rect x="${f1(x - 6)}" y="${f1(base - h - 12)}" width="${f1(w + 12)}" height="14" fill="${shade(c, -0.22)}"/>`;
      if (rnd() < 0.4) s += `<g transform="translate(${f1(x + w * 0.7)},${f1(base - h - 12)})"><rect x="-20" y="-46" width="40" height="40" rx="6" fill="${shade(c, -0.35)}"/><rect x="-16" y="-6" width="4" height="8" fill="#555"/><rect x="12" y="-6" width="4" height="8" fill="#555"/></g>`;
      if (rnd() < 0.3) s += `<line x1="${f1(x + w * 0.3)}" y1="${f1(base - h - 12)}" x2="${f1(x + w * 0.3)}" y2="${f1(base - h - 70)}" stroke="${shade(c, -0.4)}" stroke-width="4"/>`;
    }
    s += windows(x, base - h, w - 10, h - (o.shop ? 120 : 0), rnd, T, c, o.lit);
    if (o.shop) {
      const ac = o.awning || '#e8574b';
      s += `<rect x="${f1(x + 10)}" y="${f1(base - 112)}" width="${f1(w - 30)}" height="112" fill="${shade(c, -0.18)}"/>`;
      s += `<rect x="${f1(x + 26)}" y="${f1(base - 92)}" width="${f1(w - 62)}" height="80" fill="${T.name === 'night' ? '#ffe3a0' : '#bfe0f2'}" opacity="${T.name === 'night' ? 0.9 : 0.85}"/>`;
      for (let k = 0; k < Math.floor((w - 30) / 30); k++) s += `<path d="M${f1(x + 10 + k * 30)},${f1(base - 126)} h30 v18 q-15,14 -30,0 Z" fill="${k % 2 ? '#ffffff' : ac}"/>`;
    }
    return s + '</g>';
  }
  function car(color, flip = false, s = 1) {
    const b = color, d = shade(color, -0.25);
    return `<g transform="scale(${flip ? -s : s},${s})"><path d="M-92,-20 L-92,-44 Q-90,-54 -76,-56 L-46,-58 L-22,-86 Q-16,-92 -6,-92 L44,-92 Q56,-92 62,-84 L80,-58 L94,-54 Q104,-50 104,-38 L104,-20 Z" fill="${b}"/><path d="M-16,-82 L-2,-82 L-2,-60 L-36,-60 Z M6,-82 L42,-82 Q50,-82 54,-76 L64,-60 L6,-60 Z" fill="#cfe8f7"/><rect x="-92" y="-36" width="196" height="8" fill="${d}" opacity=".5"/><circle cx="96" cy="-44" r="5" fill="#fff3b0"/><circle cx="-56" cy="-18" r="20" fill="#2b2b33"/><circle cx="-56" cy="-18" r="9" fill="#c9ccd6"/><circle cx="62" cy="-18" r="20" fill="#2b2b33"/><circle cx="62" cy="-18" r="9" fill="#c9ccd6"/></g>`;
  }
  function moto(color, flip = false) { return `<g transform="scale(${flip ? -0.9 : 0.9},0.9)"><circle cx="-40" cy="-18" r="18" fill="#2b2b33"/><circle cx="40" cy="-18" r="18" fill="#2b2b33"/><path d="M-40,-18 L-10,-44 L28,-44 L40,-18" fill="none" stroke="#555" stroke-width="6"/><path d="M-26,-50 Q0,-62 26,-50 L22,-38 L-22,-38 Z" fill="${color}"/><circle cx="2" cy="-96" r="16" fill="#f7d5b8"/><path d="M-14,-100 Q2,-124 18,-100 Z" fill="${color}"/><path d="M-6,-80 L-12,-48 L14,-48 L10,-80 Z" fill="${shade(color, -0.3)}"/></g>`; }
  /** Looping traffic in a lane: n vehicles crossing at speed (px/s, negative = leftward). */
  function traffic(rnd, y, n, speed, colors, kinds = ['car', 'car', 'moto']) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const k = kinds[Math.floor(rnd() * kinds.length)], c = colors[Math.floor(rnd() * colors.length)];
      const v = speed * (0.85 + rnd() * 0.3);
      s += `<g data-amb="move" data-x0="${X0 - 300}" data-x1="${X1 + 300}" data-s="${f1(v)}" data-p="${f1(i * (X1 - X0 + 600) / n + rnd() * 200)}" data-y="${y}">${k === 'moto' ? moto(c, v < 0) : car(c, v < 0, 0.9)}</g>`;
    }
    return s;
  }
  function birds(rnd, n, y, T) {
    const c = T.name === 'night' ? '#0d1230' : '#3a4256';
    let s = '';
    for (let i = 0; i < n; i++) s += `<g data-amb="move" data-x0="${X0}" data-x1="${X1}" data-s="${f1(40 + rnd() * 30)}" data-p="${f1(rnd() * 2400)}" data-y="${f1(y + rnd() * 120)}"><path d="M-12,0 Q-6,-8 0,0 Q6,-8 12,0" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/></g>`;
    return s;
  }
  function stars(rnd, n, h = 900, x0 = X0, x1 = X1) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<circle cx="${f1(x0 + rnd() * (x1 - x0))}" cy="${f1(rnd() * h)}" r="${f1(0.7 + rnd() * 2)}" fill="#fff" opacity="${f1(0.3 + rnd() * 0.7)}"/>`;
    return s;
  }
  function brightStars(rnd, n, h = 800) {
    let s = '';
    for (let i = 0; i < n; i++) { const x = X0 + rnd() * (X1 - X0), y = rnd() * h, r = 2 + rnd() * 2.5; s += `<g data-amb="twinkle" data-s="${f1(1 + rnd() * 2)}" data-p="${f1(rnd() * 6)}" data-lo=".35"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * 3)}" fill="#cfe0ff" opacity=".18"/><path d="M${f1(x - r * 4)},${f1(y)} L${f1(x + r * 4)},${f1(y)} M${f1(x)},${f1(y - r * 4)} L${f1(x)},${f1(y + r * 4)}" stroke="#fff" stroke-width="1.6" opacity=".7"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="#fff"/></g>`; }
    return s;
  }
  function lamp(x, y, T, s = 1) {
    const on = T.name !== 'day';
    return `<g transform="translate(${f1(x)},${f1(y)}) scale(${s})">${on ? '<circle cx="46" cy="-226" r="70" fill="url(#e-lampglow)"/>' : ''}<rect x="-5" y="-232" width="10" height="232" fill="#4b5060"/><path d="M0,-228 Q20,-246 46,-240" fill="none" stroke="#4b5060" stroke-width="8"/><path d="M30,-244 L62,-244 L56,-226 L36,-226 Z" fill="#3c404d"/><ellipse cx="46" cy="-226" rx="12" ry="5" fill="${on ? '#fff3c0' : '#e8ecf2'}"/></g>`;
  }

  window.EnvKit = { X0, X1, hex, mix, shade, f1, lg, rg, TIMES, TIME, tone, haze, skyDefs, skyLayer, cloud, ridge, peaks, snowCaps, karst, treeRound, treePine, palm, bamboo, banana, grass, windows, building, car, moto, traffic, birds, stars, brightStars, lamp };
})();
