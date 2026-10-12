/* Hand-coded explainer graphics in the same flat style as the cartoon characters.
 * Objects are drawn in a -100..100 box with the base at y = 100. Every animation is written on the scene
 * timeline or computed from t in onFrame, so graphics stay frame-exact like the rest of the runtime. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    gold: '#f6c445', goldD: '#d9951c', cash: '#6cc07a', cashD: '#3f9a57', blue: '#4f8ef7', blueD: '#2f63c9', red: '#e8574b', redD: '#b8382e',
    orange: '#f08a3c', purple: '#8a6bd6', teal: '#2fb38a', tealD: '#1f8a69', grey: '#aab2c3', greyD: '#6f788c', ink: '#2b2f3a', cream: '#fff6e5',
    white: '#ffffff', brown: '#a8733f', brownD: '#7d5128', sky: '#bfe3ff', pink: '#f28bb0', yellow: '#ffd84a', green: '#7cc36b', greenD: '#4f9a45',
  };
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const PALETTE = [C.blue, C.red, C.orange, C.teal, C.purple, C.gold, C.green, C.pink, C.cash, C.ink, C.greyD, C.brown];
  const NAMED = { blue: C.blue, red: C.red, orange: C.orange, teal: C.teal, green: C.green, purple: C.purple, gold: C.gold, yellow: C.gold, pink: C.pink, grey: C.greyD, gray: C.greyD, black: C.ink, dark: C.ink, brown: C.brown };
  function pal(c) {
    if (!c) return c;
    const k = String(c).trim().toLowerCase();
    if (NAMED[k]) return NAMED[k];
    const m = k.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (!m) return c.startsWith('var(') ? c : C.blue;
    const hex = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    let best = PALETTE[0], bd = 1e9;
    for (const p of PALETTE) { const n = parseInt(p.slice(1), 16), d = (r - (n >> 16)) ** 2 + (g - ((n >> 8) & 255)) ** 2 + (b - (n & 255)) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }
  const esc = s => String(s).replace(/[<&"]/g, c => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));
  function mk(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // ───────────────────────── objects ─────────────────────────
  // Each returns SVG markup; `o.color` recolors the main body where it makes sense.
  const coinSvg = (x, y, r, sym = '₫') => `<g transform="translate(${x},${y})"><ellipse cx="0" cy="${r * 0.16}" rx="${r}" ry="${r * 0.98}" fill="${C.goldD}"/><circle r="${r}" fill="${C.gold}"/><circle r="${r * 0.74}" fill="none" stroke="${C.goldD}" stroke-width="${r * 0.1}"/><text y="${r * 0.34}" text-anchor="middle" font-size="${r}" font-weight="900" fill="${C.goldD}" font-family="Be Vietnam Pro,sans-serif">${sym}</text><path d="M${-r * 0.55},${-r * 0.5} A${r * 0.75},${r * 0.75} 0 0 1 ${r * 0.2},${-r * 0.72}" stroke="#fff" stroke-width="${r * 0.12}" fill="none" opacity=".55" stroke-linecap="round"/></g>`;
  const bill = (x, y, w, h, rot = 0) => `<g transform="translate(${x},${y}) rotate(${rot})"><rect x="${-w / 2}" y="${-h / 2 + 4}" width="${w}" height="${h}" rx="${h * 0.12}" fill="${C.cashD}"/><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h * 0.12}" fill="${C.cash}"/><rect x="${-w / 2 + h * 0.14}" y="${-h / 2 + h * 0.14}" width="${w - h * 0.28}" height="${h * 0.72}" rx="${h * 0.08}" fill="none" stroke="${C.cashD}" stroke-width="${h * 0.06}"/><circle r="${h * 0.24}" fill="${C.cashD}" opacity=".55"/><text y="${h * 0.12}" text-anchor="middle" font-size="${h * 0.34}" font-weight="900" fill="#e9ffe9" font-family="Be Vietnam Pro,sans-serif">₫</text></g>`;
  const OBJ = {
    coin: o => coinSvg(0, 40, 58, o.symbol || '₫'),
    coins: o => [0, 1, 2, 3, 4].map(i => `<g transform="translate(${(i % 2) * 6 - 3},${70 - i * 22})"><ellipse rx="62" ry="20" cy="8" fill="${C.goldD}"/><ellipse rx="62" ry="20" fill="${C.gold}"/><ellipse rx="44" ry="12" fill="none" stroke="${C.goldD}" stroke-width="5"/></g>`).join(''),
    banknote: () => bill(0, 40, 170, 86),
    cash: () => [0, 1, 2, 3].map(i => bill(i * 4 - 6, 78 - i * 16, 170, 70, i % 2 ? 4 : -3)).join('') + `<rect x="-14" y="0" width="28" height="92" rx="4" fill="${C.cream}" opacity=".9"/>`,
    'money-bag': () => `<path d="M-30,-44 Q-40,-66 -22,-72 Q0,-60 22,-72 Q40,-66 30,-44 Z" fill="${C.goldD}"/><path d="M-30,-44 C-92,-10 -88,98 0,98 C88,98 92,-10 30,-44 Z" fill="${C.gold}"/><rect x="-34" y="-50" width="68" height="14" rx="7" fill="${C.brownD}"/><text y="52" text-anchor="middle" font-size="70" font-weight="900" fill="${C.goldD}" font-family="Be Vietnam Pro,sans-serif">₫</text><path d="M-54,10 Q-58,50 -34,74" stroke="#fff" stroke-width="9" fill="none" opacity=".45" stroke-linecap="round"/>`,
    'piggy-bank': () => `<ellipse cx="0" cy="30" rx="86" ry="62" fill="${C.pink}"/><circle cx="70" cy="18" r="30" fill="${C.pink}"/><ellipse cx="92" cy="22" rx="14" ry="12" fill="${shade(C.pink, -0.18)}"/><circle cx="88" cy="20" r="3" fill="${C.ink}"/><circle cx="96" cy="20" r="3" fill="${C.ink}"/><circle cx="64" cy="4" r="6" fill="${C.ink}"/><path d="M40,-24 L54,-50 L64,-20 Z" fill="${shade(C.pink, -0.12)}"/><rect x="-54" y="80" width="22" height="22" rx="6" fill="${shade(C.pink, -0.15)}"/><rect x="30" y="80" width="22" height="22" rx="6" fill="${shade(C.pink, -0.15)}"/><rect x="-22" y="-34" width="44" height="10" rx="5" fill="${shade(C.pink, -0.35)}"/><path d="M-86,24 q-26,-4 -18,-24" stroke="${shade(C.pink, -0.15)}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
    wallet: () => `<rect x="-90" y="-20" width="180" height="120" rx="20" fill="${C.brown}"/><rect x="-90" y="-20" width="180" height="40" rx="20" fill="${C.brownD}"/>${bill(0, -30, 150, 60, -4)}<rect x="30" y="20" width="66" height="44" rx="14" fill="${C.brownD}"/><circle cx="72" cy="42" r="8" fill="${C.gold}"/>`,
    'credit-card': () => `<rect x="-100" y="-10" width="200" height="120" rx="16" fill="${C.blue}"/><rect x="-100" y="14" width="200" height="22" fill="${C.ink}"/><rect x="-80" y="56" width="42" height="30" rx="6" fill="${C.gold}"/><rect x="-24" y="66" width="100" height="10" rx="5" fill="#fff" opacity=".6"/>`,
    house: o => { const c = o.color || C.orange; return `<rect x="-78" y="-8" width="156" height="108" fill="${C.cream}"/><rect x="-78" y="-8" width="156" height="14" fill="${shade(C.cream, -0.1)}"/><path d="M-98,0 L0,-86 L98,0 Z" fill="${c}"/><path d="M-98,0 L0,-86 L0,-72 L-84,2 Z" fill="${shade(c, 0.15)}"/><rect x="-22" y="34" width="44" height="66" rx="6" fill="${C.brown}"/><circle cx="12" cy="68" r="4" fill="${C.gold}"/><rect x="-66" y="20" width="34" height="32" rx="4" fill="${C.sky}" stroke="#fff" stroke-width="5"/><rect x="32" y="20" width="34" height="32" rx="4" fill="${C.sky}" stroke="#fff" stroke-width="5"/><rect x="44" y="-64" width="20" height="40" fill="${shade(c, -0.25)}"/>`; },
    apartment: o => { const c = o.color || C.blue; let w = ''; for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) w += `<rect x="${-46 + k * 34}" y="${-84 + r * 28}" width="22" height="18" rx="3" fill="${C.sky}"/>`; return `<rect x="-62" y="-100" width="124" height="200" rx="6" fill="${c}"/><rect x="-62" y="-100" width="20" height="200" fill="${shade(c, -0.12)}"/>${w}<rect x="-16" y="70" width="32" height="30" fill="${C.ink}" opacity=".7"/>`; },
    bank: () => `<rect x="-96" y="84" width="192" height="16" fill="${C.greyD}"/><rect x="-86" y="72" width="172" height="14" fill="${C.grey}"/><path d="M-100,-26 L0,-92 L100,-26 Z" fill="${C.grey}"/><rect x="-100" y="-30" width="200" height="16" fill="${C.greyD}"/>${[-66, -22, 22, 66].map(x => `<rect x="${x - 12}" y="-14" width="24" height="86" fill="#e6e9f0"/><rect x="${x - 12}" y="-14" width="7" height="86" fill="#cfd4de"/>`).join('')}${coinSvg(0, -48, 18)}`,
    factory: () => `<path d="M-100,100 L-100,-10 L-50,-40 L-50,-10 L0,-40 L0,-10 L50,-40 L50,100 Z" fill="${C.grey}"/><rect x="50" y="-90" width="34" height="190" fill="${C.redD}"/><rect x="50" y="-90" width="34" height="14" fill="${shade(C.redD, -0.2)}"/>${[-80, -40, 0].map(x => `<rect x="${x}" y="20" width="26" height="22" rx="3" fill="${C.gold}"/>`).join('')}<rect x="-20" y="60" width="40" height="40" fill="${C.greyD}"/><g class="gfx-smoke">${[0, 1, 2].map(i => `<circle class="puff" data-i="${i}" cx="67" cy="-100" r="${16 + i * 6}" fill="#dfe3ea"/>`).join('')}</g>`,
    shop: () => `<rect x="-90" y="-10" width="180" height="110" fill="${C.cream}"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${-96 + i * 32},-50 h32 v34 a16,16 0 0 1 -32,0 Z" fill="${i % 2 ? '#fff' : C.red}"/>`).join('')}<rect x="-96" y="-60" width="192" height="14" rx="4" fill="${C.redD}"/><rect x="-70" y="30" width="60" height="70" fill="${C.sky}" stroke="#fff" stroke-width="5"/><rect x="14" y="30" width="56" height="70" fill="${C.brown}"/>`,
    car: o => { const c = o.color || C.red; return `<path d="M-96,60 L-96,20 Q-90,4 -64,0 L-40,-34 Q-34,-42 -20,-42 L36,-42 Q50,-42 58,-30 L78,0 Q98,6 98,24 L98,60 Z" fill="${c}"/><path d="M-30,-32 L-8,-32 L-8,0 L-52,0 Z" fill="${C.sky}"/><path d="M4,-32 L34,-32 L56,0 L4,0 Z" fill="${C.sky}"/><circle cx="-52" cy="64" r="26" fill="${C.ink}"/><circle cx="-52" cy="64" r="11" fill="${C.grey}"/><circle cx="54" cy="64" r="26" fill="${C.ink}"/><circle cx="54" cy="64" r="11" fill="${C.grey}"/><rect x="82" y="14" width="14" height="10" rx="3" fill="${C.yellow}"/>`; },
    truck: () => `<rect x="-100" y="-40" width="130" height="100" rx="6" fill="${C.orange}"/><path d="M34,-10 L70,-10 L96,22 L96,60 L34,60 Z" fill="${C.blue}"/><path d="M44,0 L66,0 L84,22 L44,22 Z" fill="${C.sky}"/>${[-66, -16, 66].map(x => `<circle cx="${x}" cy="66" r="22" fill="${C.ink}"/><circle cx="${x}" cy="66" r="9" fill="${C.grey}"/>`).join('')}`,
    ship: () => `<path d="M-100,30 L100,30 L78,80 L-80,80 Z" fill="${C.ink}"/><path d="M-100,30 L100,30 L96,42 L-96,42 Z" fill="${C.red}"/>${[[-88, C.red], [-44, C.blue], [0, C.gold], [44, C.teal]].map(([x, c]) => `<rect x="${x}" y="-6" width="40" height="34" rx="3" fill="${c}"/>`).join('')}<rect x="54" y="-50" width="34" height="78" fill="#f2f2f2"/><rect x="60" y="-40" width="22" height="12" fill="${C.sky}"/><path d="M-110,92 Q-80,82 -50,92 T10,92 T70,92 T130,92" stroke="${C.blue}" stroke-width="8" fill="none"/>`,
    plane: () => `<path d="M-100,10 Q-100,-10 -70,-10 L80,-10 Q104,-6 104,6 Q104,18 80,20 L-70,20 Q-100,20 -100,10 Z" fill="#f2f4f8"/><path d="M-10,-8 L30,-8 L-20,-70 L-40,-70 Z" fill="${C.blue}"/><path d="M-10,18 L30,18 L-20,76 L-40,76 Z" fill="${C.blueD}"/><path d="M-90,-8 L-70,-8 L-86,-46 L-100,-46 Z" fill="${C.blue}"/>${[40, 56, 72].map(x => `<circle cx="${x}" cy="2" r="5" fill="${C.sky}"/>`).join('')}`,
    phone: () => `<rect x="-52" y="-100" width="104" height="200" rx="18" fill="${C.ink}"/><rect x="-44" y="-84" width="88" height="160" rx="8" fill="${C.sky}"/><rect x="-32" y="-66" width="64" height="30" rx="6" fill="#fff"/><rect x="-32" y="-26" width="64" height="12" rx="6" fill="#fff" opacity=".7"/><rect x="-32" y="-6" width="44" height="12" rx="6" fill="#fff" opacity=".7"/><circle cx="0" cy="88" r="6" fill="${C.greyD}"/>`,
    laptop: () => `<rect x="-80" y="-60" width="160" height="110" rx="10" fill="${C.ink}"/><rect x="-70" y="-50" width="140" height="90" rx="4" fill="${C.sky}"/><path d="M-100,56 L100,56 L90,76 L-90,76 Z" fill="${C.grey}"/><rect x="-60" y="-36" width="70" height="12" rx="6" fill="#fff"/><rect x="-60" y="-14" width="110" height="10" rx="5" fill="#fff" opacity=".7"/>`,
    document: () => `<path d="M-66,-96 L40,-96 L70,-66 L70,100 L-66,100 Z" fill="#fff"/><path d="M40,-96 L40,-66 L70,-66 Z" fill="#dfe3ea"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="-46" y="${-60 + i * 26}" width="${i === 5 ? 60 : 96}" height="10" rx="5" fill="#cfd5e1"/>`).join('')}<path d="M-40,86 q14,-24 26,0 t26,0" stroke="${C.blue}" stroke-width="5" fill="none"/>`,
    calendar: () => `<rect x="-86" y="-70" width="172" height="170" rx="14" fill="#fff"/><rect x="-86" y="-70" width="172" height="44" rx="14" fill="${C.red}"/><rect x="-86" y="-40" width="172" height="14" fill="${C.red}"/>${[-50, 50].map(x => `<rect x="${x - 6}" y="-88" width="12" height="34" rx="6" fill="${C.greyD}"/>`).join('')}${Array.from({ length: 12 }, (_, i) => `<rect x="${-66 + (i % 4) * 36}" y="${-14 + Math.floor(i / 4) * 34}" width="24" height="22" rx="4" fill="${i === 6 ? C.red : '#e3e7ef'}"/>`).join('')}`,
    clock: () => `<circle cx="0" cy="0" r="92" fill="${C.ink}"/><circle r="80" fill="#fff"/>${Array.from({ length: 12 }, (_, i) => `<rect x="-3" y="-72" width="6" height="${i % 3 ? 8 : 16}" fill="${C.ink}" transform="rotate(${i * 30})"/>`).join('')}<rect class="hand-h" x="-5" y="-44" width="10" height="48" rx="5" fill="${C.ink}"/><rect class="hand-m" x="-3" y="-64" width="6" height="68" rx="3" fill="${C.red}"/><circle r="9" fill="${C.ink}"/>`,
    hourglass: () => `<rect x="-70" y="-100" width="140" height="18" rx="6" fill="${C.brown}"/><rect x="-70" y="82" width="140" height="18" rx="6" fill="${C.brown}"/><path d="M-54,-82 L54,-82 Q54,-30 8,0 Q54,30 54,82 L-54,82 Q-54,30 -8,0 Q-54,-30 -54,-82 Z" fill="${C.sky}" opacity=".7"/><path class="sand-top" d="M-40,-60 L40,-60 Q30,-24 0,-4 Q-30,-24 -40,-60 Z" fill="${C.gold}"/><path class="sand-bot" d="M-44,80 Q0,30 44,80 Z" fill="${C.gold}"/>`,
    lock: () => `<path d="M-50,-10 L-50,-50 A50,50 0 0 1 50,-50 L50,-10" stroke="${C.grey}" stroke-width="22" fill="none"/><rect x="-80" y="-14" width="160" height="114" rx="18" fill="${C.gold}"/><rect x="-80" y="-14" width="160" height="22" rx="10" fill="${shade(C.gold, 0.2)}"/><circle cy="36" r="16" fill="${C.goldD}"/><rect x="-7" y="36" width="14" height="36" rx="6" fill="${C.goldD}"/>`,
    key: () => `<circle cx="-50" cy="0" r="46" fill="${C.gold}"/><circle cx="-50" cy="0" r="18" fill="${C.cream}"/><rect x="-10" y="-12" width="110" height="24" rx="8" fill="${C.gold}"/><rect x="60" y="8" width="16" height="30" rx="4" fill="${C.gold}"/><rect x="84" y="8" width="16" height="22" rx="4" fill="${C.gold}"/>`,
    shield: o => `<path d="M0,-100 L84,-70 Q84,50 0,100 Q-84,50 -84,-70 Z" fill="${o.color || C.teal}"/><path d="M0,-100 L0,100 Q-84,50 -84,-70 Z" fill="${shade(o.color || C.teal, 0.15)}"/><path d="M-36,0 L-8,28 L40,-26" stroke="#fff" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    globe: () => `<circle r="94" fill="${C.blue}"/><path d="M-60,-54 q30,-16 46,4 q10,20 -12,30 q-24,6 -20,30 q-18,-4 -26,-24 q-6,-24 12,-40 Z M20,-70 q30,-6 50,20 q-10,14 -30,6 q-20,4 -20,-26 Z M10,10 q40,-10 60,20 q-4,34 -36,50 q-14,-30 -24,-70 Z M-70,30 q20,6 26,30 q-10,20 -30,4 Z" fill="${C.green}"/><circle r="94" fill="none" stroke="${C.blueD}" stroke-width="6"/><path d="M-60,-60 A90,90 0 0 1 40,-86" stroke="#fff" stroke-width="10" fill="none" opacity=".35" stroke-linecap="round"/>`,
    gear: o => { const c = o.color || C.greyD; let t = ''; for (let i = 0; i < 10; i++) t += `<rect x="-14" y="-100" width="28" height="34" rx="6" fill="${c}" transform="rotate(${i * 36})"/>`; return `<g class="gear-spin">${t}<circle r="74" fill="${c}"/><circle r="30" fill="${C.cream}"/></g>`; },
    lightbulb: () => `<circle class="glow" cy="-20" r="96" fill="${C.yellow}" opacity=".25"/><path d="M-50,-30 A56,56 0 1 1 50,-30 Q40,4 30,28 L-30,28 Q-40,4 -50,-30 Z" fill="${C.yellow}"/><path d="M-26,-48 A30,30 0 0 1 4,-74" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" opacity=".7"/><rect x="-30" y="30" width="60" height="16" rx="6" fill="${C.grey}"/><rect x="-26" y="48" width="52" height="16" rx="6" fill="${C.greyD}"/><rect x="-16" y="66" width="32" height="14" rx="6" fill="${C.grey}"/>`,
    battery: o => { const lv = Math.max(0, Math.min(1, o.level ?? 0.7)); const c = lv < 0.25 ? C.red : lv < 0.5 ? C.orange : C.green; return `<rect x="-90" y="-50" width="170" height="100" rx="16" fill="${C.ink}"/><rect x="80" y="-22" width="18" height="44" rx="6" fill="${C.ink}"/><rect class="battery-level" x="-78" y="-38" width="${146 * lv}" height="76" rx="8" fill="${c}"/>`; },
    'oil-barrel': () => `<rect x="-62" y="-90" width="124" height="190" rx="14" fill="${C.ink}"/><rect x="-62" y="-40" width="124" height="12" fill="${C.greyD}"/><rect x="-62" y="30" width="124" height="12" fill="${C.greyD}"/><path d="M0,-18 q-20,26 0,40 q20,-14 0,-40 Z" fill="${C.gold}"/>`,
    'gas-pump': () => `<rect x="-70" y="-90" width="110" height="190" rx="12" fill="${C.red}"/><rect x="-56" y="-72" width="82" height="50" rx="6" fill="#fff"/><text x="-15" y="-38" text-anchor="middle" font-size="30" font-weight="900" fill="${C.ink}" font-family="Be Vietnam Pro,sans-serif">₫</text><path d="M40,-40 Q86,-40 86,0 L86,60 Q86,80 66,80" stroke="${C.ink}" stroke-width="10" fill="none"/><rect x="-80" y="92" width="130" height="10" rx="4" fill="${C.greyD}"/>`,
    cart: () => `<path d="M-100,-70 L-70,-70 L-40,40 L70,40 L90,-40 L-58,-40" stroke="${C.ink}" stroke-width="12" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M-52,-34 L84,-34 L68,32 L-36,32 Z" fill="${C.blue}" opacity=".35"/><circle cx="-30" cy="70" r="16" fill="${C.ink}"/><circle cx="60" cy="70" r="16" fill="${C.ink}"/><circle cx="-10" cy="-50" r="22" fill="${C.red}"/><rect x="20" y="-76" width="34" height="46" rx="6" fill="${C.orange}"/>`,
    basket: () => `<circle cx="-40" cy="-30" r="30" fill="${C.red}"/><circle cx="10" cy="-44" r="30" fill="${C.green}"/><circle cx="50" cy="-26" r="28" fill="${C.orange}"/><path d="M-60,-40 Q0,-130 60,-40" stroke="${C.brownD}" stroke-width="10" fill="none"/><path d="M-96,-16 L96,-16 L76,96 L-76,96 Z" fill="${C.brown}"/>${[-60, -20, 20, 60].map(x => `<rect x="${x - 4}" y="-10" width="8" height="100" fill="${C.brownD}" opacity=".6"/>`).join('')}`,
    'rice-bowl': () => `<path d="M-80,-10 Q0,-90 80,-10 Z" fill="#fff"/>${[-40, -10, 20, 50, -25, 5, 35].map((x, i) => `<ellipse cx="${x}" cy="${-30 - (i > 3 ? 16 : 0)}" rx="8" ry="5" fill="#eef1f5"/>`).join('')}<path d="M-100,-10 L100,-10 Q90,80 0,90 Q-90,80 -100,-10 Z" fill="${C.blue}"/><path d="M-100,-10 L100,-10 L98,6 L-98,6 Z" fill="${C.blueD}"/><rect x="-40" y="86" width="80" height="14" rx="6" fill="${C.blueD}"/>`,
    tree: () => `<rect x="-14" y="10" width="28" height="90" rx="8" fill="${C.brown}"/><circle cy="-30" r="66" fill="${C.green}"/><circle cx="-50" cy="6" r="42" fill="${C.green}"/><circle cx="50" cy="4" r="44" fill="${C.greenD}"/><circle cx="-20" cy="-56" r="26" fill="#9ad489" opacity=".7"/>`,
    sun: () => `<g class="sun-rays">${Array.from({ length: 12 }, (_, i) => `<rect x="-8" y="-100" width="16" height="30" rx="8" fill="${C.orange}" transform="rotate(${i * 30})"/>`).join('')}</g><circle r="62" fill="${C.yellow}"/><circle cx="-20" cy="-20" r="18" fill="#fff" opacity=".35"/>`,
    cloud: () => `<ellipse cx="0" cy="40" rx="96" ry="44" fill="#fff"/><circle cx="-36" cy="10" r="44" fill="#fff"/><circle cx="24" cy="-6" r="56" fill="#fff"/><ellipse cx="0" cy="60" rx="90" ry="20" fill="#e6ecf5"/>`,
    person: o => `<circle cy="-50" r="34" fill="${o.color || C.blue}"/><path d="M-56,100 Q-56,0 0,0 Q56,0 56,100 Z" fill="${o.color || C.blue}"/>`,
    people: o => [-60, 0, 60].map((x, i) => `<g transform="translate(${x},${i === 1 ? -6 : 10}) scale(${i === 1 ? 0.9 : 0.75})"><circle cy="-50" r="34" fill="${[C.blue, C.orange, C.teal][i]}"/><path d="M-56,100 Q-56,0 0,0 Q56,0 56,100 Z" fill="${[C.blue, C.orange, C.teal][i]}"/></g>`).join(''),
    thermometer: o => `<rect x="-24" y="-100" width="48" height="160" rx="24" fill="#fff" stroke="${C.greyD}" stroke-width="6"/><circle cy="70" r="36" fill="${C.red}" stroke="${C.greyD}" stroke-width="6"/><rect class="thermo-level" x="-12" y="${-88 + 140 * (1 - (o.level ?? 0.5))}" width="24" height="${150 * (o.level ?? 0.5)}" rx="12" fill="${C.red}"/>${[0, 1, 2, 3].map(i => `<rect x="26" y="${-80 + i * 34}" width="18" height="5" fill="${C.greyD}"/>`).join('')}`,
    flask: () => `<path d="M-24,-100 L24,-100 L24,-40 L84,76 Q92,100 66,100 L-66,100 Q-92,100 -84,76 L-24,-40 Z" fill="#eaf6fb" stroke="${C.greyD}" stroke-width="5"/><path d="M-52,30 L52,30 L78,82 Q82,94 66,94 L-66,94 Q-82,94 -78,82 Z" fill="${C.teal}"/>${[[-20, 54, 10], [16, 66, 7], [30, 44, 5]].map(([x, y, r]) => `<circle class="bubble" cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".7"/>`).join('')}`,
    atom: () => `<circle r="20" fill="${C.red}"/>${[0, 60, 120].map(a => `<ellipse rx="92" ry="34" fill="none" stroke="${C.blue}" stroke-width="8" transform="rotate(${a})"/>`).join('')}<circle class="electron" cx="92" cy="0" r="10" fill="${C.teal}"/>`,
    dna: () => { let s = ''; for (let i = 0; i < 9; i++) { const y = -90 + i * 22, x = Math.sin(i * 0.8) * 50; s += `<line x1="${-x}" y1="${y}" x2="${x}" y2="${y}" stroke="#cfd5e1" stroke-width="6"/><circle cx="${-x}" cy="${y}" r="11" fill="${C.blue}"/><circle cx="${x}" cy="${y}" r="11" fill="${C.pink}"/>`; } return s; },
    magnifier: () => `<rect x="30" y="30" width="26" height="90" rx="12" fill="${C.brown}" transform="rotate(-45 30 30)"/><circle cx="-20" cy="-20" r="66" fill="${C.sky}" opacity=".6" stroke="${C.greyD}" stroke-width="16"/><path d="M-60,-40 A46,46 0 0 1 -30,-72" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/>`,
    megaphone: () => `<path d="M-60,-20 L50,-80 L50,80 L-60,20 Z" fill="${C.red}"/><rect x="-96" y="-30" width="40" height="60" rx="10" fill="${C.redD}"/><ellipse cx="50" cy="0" rx="16" ry="80" fill="${C.redD}"/><rect x="-70" y="20" width="20" height="50" rx="8" fill="${C.ink}"/>`,
    'arrow-up': o => `<path d="M0,-100 L80,-10 L34,-10 L34,100 L-34,100 L-34,-10 L-80,-10 Z" fill="${o.color || C.teal}"/><path d="M0,-100 L0,100 L-34,100 L-34,-10 L-80,-10 Z" fill="${shade(o.color || C.teal, 0.15)}"/>`,
    'arrow-down': o => `<path d="M0,100 L80,10 L34,10 L34,-100 L-34,-100 L-34,10 L-80,10 Z" fill="${o.color || C.red}"/><path d="M0,100 L0,-100 L-34,-100 L-34,10 L-80,10 Z" fill="${shade(o.color || C.red, 0.15)}"/>`,
    check: () => `<circle r="90" fill="${C.teal}"/><path d="M-44,0 L-12,34 L48,-30" stroke="#fff" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    cross: () => `<circle r="90" fill="${C.red}"/><path d="M-36,-36 L36,36 M36,-36 L-36,36" stroke="#fff" stroke-width="22" stroke-linecap="round"/>`,
    warning: () => `<path d="M0,-96 L96,80 Q100,96 84,96 L-84,96 Q-100,96 -96,80 Z" fill="${C.gold}"/><rect x="-10" y="-40" width="20" height="80" rx="10" fill="${C.ink}"/><circle cy="64" r="11" fill="${C.ink}"/>`,
    'price-tag': o => `<path d="M-90,-50 L40,-50 L96,0 L40,50 L-90,50 Q-100,50 -100,40 L-100,-40 Q-100,-50 -90,-50 Z" fill="${o.color || C.orange}"/><circle cx="46" cy="0" r="12" fill="${C.cream}"/><text x="-30" y="16" text-anchor="middle" font-size="48" font-weight="900" fill="#fff" font-family="Be Vietnam Pro,sans-serif">${esc(o.text || '₫')}</text>`,
    'bar-chart': () => `<rect x="-96" y="-96" width="192" height="192" rx="18" fill="#fff"/>${[[-60, 40, C.blue], [-12, 0, C.teal], [36, -50, C.orange]].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="36" height="${76 - y}" rx="6" fill="${c}"/>`).join('')}<rect x="-76" y="76" width="152" height="6" rx="3" fill="${C.greyD}"/>`,
    brain: () => `<path d="M-10,-80 Q-60,-90 -76,-44 Q-100,-20 -80,14 Q-90,52 -50,66 Q-30,96 0,76 Z" fill="${C.pink}"/><path d="M10,-80 Q60,-90 76,-44 Q100,-20 80,14 Q90,52 50,66 Q30,96 0,76 Z" fill="${shade(C.pink, -0.08)}"/><path d="M-50,-40 q20,10 10,30 M-60,20 q24,-4 30,20 M50,-40 q-20,10 -10,30 M60,20 q-24,-4 -30,20" stroke="${shade(C.pink, -0.3)}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
    handshake: () => `<path d="M-100,-10 L-40,-30 L10,-10 L60,-30 L100,-10 L100,40 L60,40 L20,70 Q0,84 -20,66 L-60,40 L-100,40 Z" fill="${C.orange}"/><path d="M-40,-30 L10,-10 L-10,10 Q-30,20 -44,4 Z" fill="${shade(C.orange, 0.2)}"/><rect x="-110" y="-20" width="30" height="70" rx="6" fill="${C.blue}"/><rect x="80" y="-20" width="30" height="70" rx="6" fill="${C.teal}"/>`,
    crown: () => `<path d="M-90,60 L-100,-50 L-44,0 L0,-80 L44,0 L100,-50 L90,60 Z" fill="${C.gold}"/><rect x="-90" y="56" width="180" height="30" rx="8" fill="${C.goldD}"/>${[-60, 0, 60].map(x => `<circle cx="${x}" cy="72" r="8" fill="${C.red}"/>`).join('')}`,
    trophy: () => `<path d="M-60,-90 L60,-90 L50,0 Q40,40 0,44 Q-40,40 -50,0 Z" fill="${C.gold}"/><path d="M-60,-70 Q-100,-70 -90,-30 Q-80,0 -50,0" stroke="${C.goldD}" stroke-width="12" fill="none"/><path d="M60,-70 Q100,-70 90,-30 Q80,0 50,0" stroke="${C.goldD}" stroke-width="12" fill="none"/><rect x="-14" y="40" width="28" height="30" fill="${C.goldD}"/><rect x="-54" y="70" width="108" height="30" rx="8" fill="${C.brown}"/>`,
    fire: () => `<path class="flame" d="M0,100 Q-80,100 -70,20 Q-60,-30 -20,-60 Q-24,-20 0,-10 Q10,-60 -6,-100 Q70,-60 70,20 Q80,100 0,100 Z" fill="${C.orange}"/><path d="M0,100 Q-40,100 -34,50 Q-30,20 -6,6 Q-6,40 10,40 Q20,10 14,-10 Q44,20 40,56 Q40,100 0,100 Z" fill="${C.yellow}"/>`,
    bomb: () => `<circle cy="20" r="76" fill="${C.ink}"/><rect x="30" y="-70" width="30" height="40" rx="6" fill="${C.greyD}" transform="rotate(30 45 -50)"/><path d="M58,-72 q20,-30 40,-20" stroke="${C.brown}" stroke-width="6" fill="none"/><circle cx="98" cy="-92" r="10" fill="${C.orange}"/><circle cx="-26" cy="-10" r="16" fill="#fff" opacity=".25"/>`,
    box: o => `<path d="M-90,-40 L0,-80 L90,-40 L0,0 Z" fill="${shade(o.color || C.brown, 0.18)}"/><path d="M-90,-40 L0,0 L0,100 L-90,60 Z" fill="${o.color || C.brown}"/><path d="M90,-40 L0,0 L0,100 L90,60 Z" fill="${shade(o.color || C.brown, -0.15)}"/><path d="M-45,-60 L45,-20" stroke="${C.cream}" stroke-width="12" opacity=".6"/>`,
    chip: () => `<rect x="-70" y="-70" width="140" height="140" rx="16" fill="${C.ink}"/><rect x="-40" y="-40" width="80" height="80" rx="8" fill="${C.teal}"/>${[-50, -25, 0, 25, 50].map(k => `<rect x="${k - 5}" y="-96" width="10" height="26" fill="${C.grey}"/><rect x="${k - 5}" y="70" width="10" height="26" fill="${C.grey}"/><rect x="-96" y="${k - 5}" width="26" height="10" fill="${C.grey}"/><rect x="70" y="${k - 5}" width="26" height="10" fill="${C.grey}"/>`).join('')}`,
    virus: () => `${Array.from({ length: 10 }, (_, i) => `<g transform="rotate(${i * 36})"><rect x="-5" y="-96" width="10" height="36" fill="${C.greenD}"/><circle cy="-96" r="12" fill="${C.red}"/></g>`).join('')}<circle r="64" fill="${C.green}"/><circle cx="-20" cy="-10" r="12" fill="${C.greenD}"/><circle cx="24" cy="20" r="9" fill="${C.greenD}"/>`,
    planet: () => `<circle r="66" fill="${C.purple}"/><ellipse rx="110" ry="24" fill="none" stroke="${C.gold}" stroke-width="12" transform="rotate(-18)"/><circle cx="-20" cy="-22" r="14" fill="#fff" opacity=".25"/>`,
    rocket: () => `<path d="M0,-100 Q50,-40 40,50 L-40,50 Q-50,-40 0,-100 Z" fill="#f2f4f8"/><circle cy="-20" r="20" fill="${C.sky}" stroke="${C.blue}" stroke-width="7"/><path d="M-40,20 L-76,70 L-40,60 Z M40,20 L76,70 L40,60 Z" fill="${C.red}"/><path class="flame" d="M-24,52 Q0,120 24,52 Z" fill="${C.orange}"/>`,
  };
  const ALIAS = { money: 'money-bag', tien: 'cash', bills: 'cash', note: 'banknote', home: 'house', building: 'apartment', skyscraper: 'apartment', store: 'shop', market: 'shop', auto: 'car', lorry: 'truck', boat: 'ship', airplane: 'plane', mobile: 'phone', computer: 'laptop', paper: 'document', contract: 'document', time: 'clock', padlock: 'lock', earth: 'globe', world: 'globe', idea: 'lightbulb', bulb: 'lightbulb', oil: 'oil-barrel', fuel: 'gas-pump', 'shopping-cart': 'cart', food: 'basket', rice: 'rice-bowl', crowd: 'people', population: 'people', user: 'person', temperature: 'thermometer', science: 'flask', up: 'arrow-up', down: 'arrow-down', ok: 'check', no: 'cross', danger: 'warning', tag: 'price-tag', price: 'price-tag', chart: 'bar-chart', deal: 'handshake', king: 'crown', win: 'trophy', crisis: 'fire', explosion: 'bomb', package: 'box', goods: 'box', cpu: 'chip', germ: 'virus', space: 'planet' };
  const resolve = n => (OBJ[n] ? n : ALIAS[n] || null);

  /**
   * Astra hero SVG → gfx objects. Decorative layers (backgrounds, frames, starfields, rulers, labels…) are dropped, and a sheet
   * whose top-level groups sit apart (several views / variants / insets drawn side by side) is split: '<id>' is the largest
   * drawing, every other one is '<id>-<its group name>'. Each viewBox is cropped to its drawing so nothing looks tiny.
   */
  const DECOR = /(^|[-_])(background|backdrop|bg|starfield|star_?field|frame|border|panel|card|plate|scale_?bar|measurement|ruler|guides?|labels?|markers?|callouts?|annotations?|caption)s?([-_]|$)/i;
  const VARIANT = /(^|[-_])(view|variant|version|alt|alternative|option|inset|schematic|diagram|detail|cutaway|state|stage|step|before|after)s?([-_]|$|\d)/i;
  const NON_DRAWING = /^(defs|style|title|desc|metadata|filter|clippath|mask|lineargradient|radialgradient|pattern|symbol)$/i;
  function assetVariants(id, svg) {
    const wrap = (root, inner) => `<svg${[...root.attributes].filter(a => !/^(width|height|x|y|preserveAspectRatio|viewBox)$/i.test(a.name)).map(a => ` ${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join('')}` +
      (() => { const b = root.getBBox(); if (!(b.width > 1 && b.height > 1)) return ` viewBox="${root.getAttribute('viewBox') || '0 0 800 800'}"`; const p = Math.max(b.width, b.height) * 0.02; return ` viewBox="${b.x - p} ${b.y - p} ${b.width + 2 * p} ${b.height + 2 * p}"`; })() +
      ` x="-100" y="-100" width="200" height="200" preserveAspectRatio="xMidYMax meet">${inner}</svg>`;
    const fallback = [[id, svg.replace(/<svg([^>]*)>/i, (m, a) => `<svg${a.replace(/\s(width|height|x|y|preserveAspectRatio)="[^"]*"/gi, '')} x="-100" y="-100" width="200" height="200" preserveAspectRatio="xMidYMax meet">`)]];
    const probe = document.createElement('div');
    try {
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;height:800px;visibility:hidden';
      probe.innerHTML = svg;
      document.body.appendChild(probe);
      const root = probe.querySelector('svg');
      if (!root) return fallback;
      const short = el => (el.id || '').replace(`${id}-`, '');
      // 1. drop decoration, unless that would leave nothing to show
      const decor = [...root.querySelectorAll('[id]')].filter(el => !el.closest('defs') && !NON_DRAWING.test(el.tagName) && DECOR.test(short(el)));
      decor.forEach(el => { el.dataset.decor = '1'; el.style.display = 'none'; });
      if (!(root.getBBox().width > 1)) decor.forEach(el => { el.style.display = ''; delete el.dataset.decor; });
      root.querySelectorAll('[data-decor]').forEach(el => el.remove());
      // 2. split side-by-side drawings into separate objects
      let tops = [...root.children].filter(el => !NON_DRAWING.test(el.tagName));
      if (tops.length === 1 && tops[0].children.length > 1) tops = [...tops[0].children].filter(el => !NON_DRAWING.test(el.tagName));
      const rects = tops.map(el => el.getBoundingClientRect());
      const all = root.getBoundingClientRect(), gap = Math.max(all.width, all.height) * 0.025;
      const parent = tops.map((_, i) => i), find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      const live = rects.map(r => r.width * r.height > 4);
      for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
        const a = rects[i], b = rects[j];
        // Parts of one drawing touch or overlap; separate drawings have a clear gap. Groups NAMED as another view/variant/inset
        // stay separate unless they truly overlap (an inset may graze the main view's bounding box).
        if (!live[i] || !live[j]) continue;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const named = VARIANT.test(short(tops[i])) || VARIANT.test(short(tops[j]));
        const same = named ? w > 0 && h > 0 && w * h > 0.15 * Math.min(a.width * a.height, b.width * b.height) : w > -gap && h > -gap;
        if (same) parent[find(i)] = find(j);
      }
      const groups = new Map();
      tops.forEach((el, i) => { if (!live[i]) return; const k = find(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
      const clusters = [...groups.values()].map(ix => {
        const l = Math.min(...ix.map(i => rects[i].left)), r = Math.max(...ix.map(i => rects[i].right)), t = Math.min(...ix.map(i => rects[i].top)), b = Math.max(...ix.map(i => rects[i].bottom));
        return { ix, area: (r - l) * (b - t), cx: (l + r) / 2, cy: (t + b) / 2 };
      }).sort((a, b) => b.area - a.area);
      // small pieces (a flag, a lone star) are not separate drawings — they belong to the nearest big one
      const real = clusters.filter(c => c.area > clusters[0].area * 0.08);
      clusters.filter(c => !real.includes(c)).forEach(c => { const near = real.reduce((m, r) => (Math.hypot(r.cx - c.cx, r.cy - c.cy) < Math.hypot(m.cx - c.cx, m.cy - c.cy) ? r : m), real[0]); near.ix.push(...c.ix); });
      tops.forEach((el, i) => { if (!live[i]) real[0].ix.push(i); });
      if (real.length < 2) return [[id, wrap(root, root.innerHTML)]];
      tops.forEach((el, i) => { el.dataset.k = i; });
      const out = [];
      real.forEach((c, n) => {
        tops.forEach((el, i) => { el.style.display = c.ix.includes(i) ? '' : 'none'; });
        const clone = root.cloneNode(true);
        clone.querySelectorAll('[data-k]').forEach(el => { if (!c.ix.includes(+el.dataset.k)) el.remove(); else { el.removeAttribute('data-k'); el.style.display = ''; } });
        const name = n === 0 ? id : `${id}-${short(tops[c.ix[0]]) || `v${n + 1}`}`;
        out.push([name, wrap(root, clone.innerHTML)]);
      });
      return out;
    } catch { return fallback; } finally { probe.remove(); }
  }

  // Things that physically pile up; anything else (ships, people, trees...) is counted on a unit grid instead.
  const STACKABLE = new Set(['coin', 'coins', 'cash', 'banknote', 'gold-bar', 'gold-bars', 'box', 'book', 'container', 'ancient-coin', 'money-bag', 'rice-bowl']);

  // Idle life for objects that have moving parts (smoke, gears, flames, sun rays...).
  function animatePartsWith(frameFns, g, seed) {
    const gen = g.querySelectorAll('.a-spin, .a-bob, .a-blink, .a-sway, .a-flow, .a-pulse');
    if (gen.length) frameFns.push(t => gen.forEach((e, i) => {
      const d = e.dataset, sp = +(d.s || 1), cx = +(d.cx || 0), cy = +(d.cy || 0), ph = i * 1.7 + seed * 0.01;
      const c = e.classList;
      if (c.contains('a-spin')) e.setAttribute('transform', `rotate(${t * 40 * sp} ${cx} ${cy})`);
      else if (c.contains('a-bob')) e.setAttribute('transform', `translate(0,${Math.sin(t * 2.2 * sp + ph) * (+(d.a || 6))})`);
      else if (c.contains('a-sway')) e.setAttribute('transform', `rotate(${Math.sin(t * 1.6 * sp + ph) * (+(d.a || 6))} ${cx} ${cy})`);
      else if (c.contains('a-pulse')) e.setAttribute('transform', `translate(${cx},${cy}) scale(${1 + Math.sin(t * 3 * sp + ph) * (+(d.a || 0.06))}) translate(${-cx},${-cy})`);
      if (c.contains('a-blink')) e.setAttribute('opacity', (0.55 + 0.45 * Math.sin(t * 4 * sp + ph)).toFixed(2));
      if (c.contains('a-flow')) e.setAttribute('stroke-dashoffset', (-t * 60 * sp).toFixed(1));
    }));
    const puffs = g.querySelectorAll('.puff'), gear = g.querySelector('.gear-spin'), flames = g.querySelectorAll('.flame'), rays = g.querySelector('.sun-rays'),
      glow = g.querySelector('.glow'), el = g.querySelector('.electron'), bubbles = g.querySelectorAll('.bubble'), hm = g.querySelector('.hand-m'), hh = g.querySelector('.hand-h');
    if (!puffs.length && !gear && !flames.length && !rays && !glow && !el && !bubbles.length && !hm) return;
    frameFns.push(t => {
      puffs.forEach(p => { const k = ((t * 0.45 + +p.dataset.i * 0.33) % 1); p.setAttribute('transform', `translate(${k * 24},${-k * 90})`); p.setAttribute('opacity', (0.9 * (1 - k)).toFixed(3)); });
      if (gear) gear.setAttribute('transform', `rotate(${t * 40 + seed})`);
      flames.forEach(f => f.setAttribute('transform', `translate(0,100) scale(${1 + Math.sin(t * 11 + seed) * 0.05},${1 + Math.sin(t * 13) * 0.08}) translate(0,-100)`));
      if (rays) rays.setAttribute('transform', `rotate(${t * 12})`);
      if (glow) glow.setAttribute('opacity', (0.22 + 0.12 * Math.sin(t * 3)).toFixed(3));
      if (el) el.setAttribute('transform', `rotate(${t * 180})`);
      bubbles.forEach((b, i) => b.setAttribute('transform', `translate(0,${-((t * 30 + i * 20) % 50)})`));
      if (hm) hm.setAttribute('transform', `rotate(${t * 60})`);
      if (hh) hh.setAttribute('transform', `rotate(${t * 5})`);
    });
  }

  // ───────────────────────── layer & helpers ─────────────────────────
  function createGfx(ctx) {
    for (const [id, svg] of Object.entries(window.__rt?.data?.assets || {})) {
      if (OBJ[id] || !svg) continue;
      for (const [name, s] of assetVariants(id, svg)) { const inner = s; OBJ[name] = () => inner; }
    }
    const { stage, tl, frameFns, clampT } = ctx;
    let layer = null;
    const getLayer = () => {
      if (layer && layer.isConnected) return layer;
      const world = stage.querySelector('.k-world');
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 1920 1080');
      svg.setAttribute('class', world?.__owner?.dark || stage.__world?.dark ? 'k-gfx dark' : 'k-gfx');
      svg.style.cssText = 'position:absolute;inset:0;width:1920px;height:1080px;overflow:visible';
      if (world) world.insertBefore(svg, world.querySelector('.k-actors'));
      else if (stage.__gfxHost?.isConnected) stage.__gfxHost.appendChild(svg);
      else stage.appendChild(svg);
      layer = svg;
      return svg;
    };
    const T = at => clampT(at ?? 0);
    const placed = (cls, transform) => { const outer = mk('g', { class: cls }, getLayer()); const inner = mk('g', { transform }, outer); return [outer, inner]; };
    const appear = (g, at, kind = 'pop', dur) => {
      const t = T(at);
      if (kind === 'none') return;
      if (kind === 'fade') tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: dur || 0.5 }, t);
      else if (kind === 'drop') tl.fromTo(g, { opacity: 0, y: -160 }, { opacity: 1, y: 0, duration: dur || 0.7, ease: 'bounce.out' }, t);
      else if (kind === 'rise') tl.fromTo(g, { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: dur || 0.6, ease: 'power3.out' }, t);
      else if (kind === 'slide-left') tl.fromTo(g, { opacity: 0, x: -260 }, { opacity: 1, x: 0, duration: dur || 0.7, ease: 'power3.out' }, t);
      else if (kind === 'slide-right') tl.fromTo(g, { opacity: 0, x: 260 }, { opacity: 1, x: 0, duration: dur || 0.7, ease: 'power3.out' }, t);
      else tl.fromTo(g, { opacity: 0, scale: 0.2, transformOrigin: '50% 100%' }, { opacity: 1, scale: 1, duration: dur || 0.6, ease: 'back.out(2.2)' }, t);
    };

    function animateParts(g, seed) { animatePartsWith(frameFns, g, seed); }

    function handle(g, box) {
      const h = {
        el: g,
        move(x, y, at, dur = 1, ease = 'power2.inOut') { tl.to(g, { x: x - box.x, y: y - box.y, duration: dur, ease }, T(at)); return h; },
        pulse(at, s = 1.18) { tl.to(g, { scale: s, transformOrigin: '50% 50%', duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, T(at)); return h; },
        shake() { return h; },   // removed on purpose: jittering reads as cheap
        grow(at, s = 1.4, dur = 0.8) { tl.to(g, { scale: s, transformOrigin: '50% 100%', duration: dur, ease: 'back.out(1.6)' }, T(at)); return h; },
        shrink(at, s = 0.6, dur = 0.8) { tl.to(g, { scale: s, transformOrigin: '50% 100%', duration: dur, ease: 'power2.inOut' }, T(at)); return h; },
        hide(at, dur = 0.4) { tl.to(g, { opacity: 0, scale: 0.6, transformOrigin: '50% 100%', duration: dur, ease: 'power2.in' }, T(at)); return h; },
        fade(at, to = 0.35, dur = 0.5) { tl.to(g, { opacity: to, duration: dur }, T(at)); return h; },
        spin(at, turns = 1, dur = 1) { tl.to(g, { rotation: 360 * turns, transformOrigin: '50% 50%', duration: dur, ease: 'power2.inOut' }, T(at)); return h; },
        float(amp = 8, period = 3) { const ph = box.x * 0.01, tgt = g.firstChild?.firstChild || g.firstChild; frameFns.push(t => { tgt?.setAttribute('transform', `translate(0,${Math.sin(t / period * Math.PI * 2 + ph) * amp})`); }); return h; },
      };
      return h;
    }

    /** Count of non-stackable things (ships, soldiers, people…) as an icon grid with a live counter; ≤40 icons, each worth `unit`. */
    function unitGrid(o, item, zz, maxN) {
      const unit = maxN <= 40 ? 1 : [2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 5000, 10000, 100000].find(u => maxN / u <= 40) || Math.ceil(maxN / 40);
      const n = Math.ceil(maxN / unit), top = unit > 1 ? 195 : 150, W = zz.w - 80, H = zz.h - top - 60;
      const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * W / H)))), rows = Math.ceil(n / cols);
      const cell = Math.min(W / cols, H / rows, 190), x0 = zz.cx - (cols * cell) / 2 + cell / 2, y0 = zz.y0 + top + (H - rows * cell) / 2 + cell / 2;
      const g = mk('g', { class: 'gfx-stack gfx-unit-grid' }, getLayer());
      const els = [];
      for (let i = 0; i < n; i++) {
        const cx = x0 + (i % cols) * cell, cy = y0 + Math.floor(i / cols) * cell;
        const e = mk('g', {}, g);
        e.innerHTML = `<g transform="scale(${(cell * 0.82) / 200})">${OBJ[item]({ color: o.color })}</g>`;
        els.push({ e, cx, cy });
      }
      const fs = 92, counter = mk('text', { x: zz.cx, y: zz.y0 + 100, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 900, fill: pal(o.color) || C.orange, 'font-family': "'Be Vietnam Pro',sans-serif", stroke: '#fff', 'stroke-width': 8, 'paint-order': 'stroke' }, g);
      if (unit > 1) { const lg = mk('text', { x: zz.cx, y: zz.y0 + 148, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 800, fill: C.ink, 'font-family': "'Be Vietnam Pro',sans-serif" }, g); lg.textContent = `mỗi hình = ${unit.toLocaleString('vi-VN')}`; }
      const st = { n: o.from ?? 0 }, at0 = T(o.at);
      if (o.at != null && o.to != null) tl.to(st, { n: o.to, duration: o.dur || 1.8, ease: o.ease || 'power1.inOut' }, at0);
      frameFns.push(t => {
        const k = st.n / unit;
        els.forEach(({ e, cx, cy }, i) => { const s = Math.max(0, Math.min(1, (k - i) * 2.5)); e.setAttribute('transform', `translate(${cx},${cy}) scale(${s === 1 ? 1 : 0.4 + s * 0.6})`); e.setAttribute('opacity', s); });
        counter.textContent = `${Math.round(st.n).toLocaleString('vi-VN')}${o.suffix || ''}`;
        g.setAttribute('opacity', t >= at0 - 0.05 ? 1 : 0);
      });
      if (o.label) gfx.label(o.label, { x: zz.cx, y: zz.y1 + 10, at: o.at ?? 0, size: 34 });
      return { el: g, to: (v, at, dur = 1.2) => tl.to(st, { n: v, duration: dur, ease: 'power1.inOut' }, T(at)) };
    }

    const gfx = {
      names: Object.keys(OBJ),
      // ─────────── auto-layout recipes: the AI says WHAT, the layout decides WHERE ───────────
      _begin(o = {}) {
        const layer = getLayer(), kids = [...layer.children];
        const prev = kids.slice(gfx._mark || 0);
        if (prev.length && o.keep && gfx._mark != null && !gfx._zoneOverride) {
          // keep:true → split screen: the previous graphic shrinks into the left half, the new one gets the right half.
          const z = gfx.zone(), wrap = mk('g', { class: 'gfx-kept' });
          layer.insertBefore(wrap, prev[0]);
          prev.forEach(el => wrap.appendChild(el));
          tl.to(wrap, { scale: 0.56, x: -z.w * 0.24, duration: 0.6, ease: 'power2.inOut', svgOrigin: `${z.cx} ${z.cy}` }, Math.max(0, T(o.at) - 0.5));
          gfx._zoneOverride = { x0: z.cx + 10, x1: z.x1, y0: z.y0 + 60, y1: z.y1 - 40 };
          gfx._mark = [...layer.children].indexOf(wrap);
          return;
        }
        if (prev.length && !o.keep && gfx._mark != null) tl.to(prev, { opacity: 0, duration: 0.35, ease: 'power2.in' }, Math.max(0, T(o.at) - 0.4));
        if (!o.keep) gfx._zoneOverride = null;
        gfx._mark = kids.length;
      },
      /** Free area for graphics, i.e. the part of the frame not used by characters standing on stage. */
      zone() {
        const zo = gfx._zoneOverride;
        if (zo) return { ...zo, w: zo.x1 - zo.x0, h: zo.y1 - zo.y0, cx: (zo.x0 + zo.x1) / 2, cy: (zo.y0 + zo.y1) / 2 };
        const w = stage.__world;
        const xs = (w?.chars || []).filter(c => (c.base?.scale ?? 1) > 0.6).map(c => c._plannedX ?? c.p.x);
        let x0 = 150, x1 = 1770;
        const left = xs.filter(x => x < 960), right = xs.filter(x => x >= 960);
        if (left.length) x0 = Math.max(x0, Math.max(...left) + 250);
        if (right.length) x1 = Math.min(x1, Math.min(...right) - 250);
        if (x1 - x0 < 700) { x0 = 150; x1 = 1770; }
        const y0 = 150, y1 = 850;
        return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
      },
      /** One big object (+ optional big number above and label below) in the middle of the free area. */
      hero(o = {}) {
        gfx._begin(o);
        const z = gfx.zone(), size = Math.max(240, o.size || Math.min(400, z.h * 0.55, z.w * 0.6));
        const base = o.big ? z.y1 - 40 : z.cy + size / 2 + 20;
        const h = gfx.item(o.item, { x: z.cx, y: base, size, at: o.at, anim: o.anim || 'pop', label: o.label, color: o.color });
        let big = null;
        if (o.big) big = gfx.big(o.big, { x: z.cx, y: base - size - 50, size: o.bigSize || 130, at: o.bigAt ?? (o.at ?? 0) + 0.5, color: o.bigColor, countTo: o.countTo, prefix: o.prefix, suffix: o.suffix, decimals: o.decimals });
        return { item: h, big };
      },
      /** Evenly spaced row of objects; arrows:true turns it into a cause → effect chain (with tokens flowing). */
      row(o = {}) {
        gfx._begin(o);
        const z = gfx.zone(), items = o.items || [], n = Math.max(1, items.length);
        const slot = z.w / n, size = Math.max(150, Math.min(300, o.size || Math.min(280, slot * (o.arrows ? 0.58 : 0.68), z.h * 0.45)));
        const labelSize = Math.max(26, Math.min(40, slot / 7));
        const base = z.cy + size / 2 + (o.arrows ? 10 : 30);
        const t0 = T(o.at), stg = o.stagger ?? 0.6;
        const hs = items.map((it, i) => gfx.item(it.item, { ...it, x: z.x0 + slot * (i + 0.5), y: base, size, at: it.at ?? t0 + i * stg, anim: it.anim || o.anim || 'pop', label: it.label, labelSize, color: it.color }));
        const arrows = [];
        if (o.arrows) for (let i = 0; i < n - 1; i++) {
          const ax = z.x0 + slot * (i + 0.5) + size * 0.62, bx = z.x0 + slot * (i + 1.5) - size * 0.62, ay = base - size / 2;
          const at = items[i + 1].at ?? t0 + (i + 1) * stg - 0.25;
          const ar = gfx.arrow({ from: [ax, ay], to: [bx, ay], at, curve: 0.1, width: 13, color: o.arrowColor });
          if (o.token || items[i].token) gfx.stream(ar.path, { item: items[i].token || o.token, at: at + 0.7, size: 50, count: 3, speed: 0.55 });
          arrows.push(ar);
        }
        return { items: hs, arrows };
      },
      chain(o = {}) { return gfx.row({ ...o, arrows: true }); },
      /** Two-sided comparison: object + value + label on each side, "VS" in the middle, optional winner. */
      compare(o = {}) {
        gfx._begin(o);
        const z = gfx.zone(), size = Math.max(180, o.size || Math.min(300, z.w * 0.26, z.h * 0.45));
        const lx = z.x0 + z.w * 0.25, rx = z.x0 + z.w * 0.75, base = z.y1 - 60;
        const t0 = T(o.at), sides = {};
        [['left', lx, 0], ['right', rx, 0.7]].forEach(([k, x, d]) => {
          const c = o[k]; if (!c) return;
          const at = c.at ?? t0 + d;
          const it = c.count > 1 ? gfx.stack({ _nested: true, x, y: base, item: c.item, from: 0, to: c.count, at, dur: 1, size: size * 0.5, perRow: 3 }) : gfx.item(c.item, { x, y: base, size, at, label: c.label, color: c.color });
          if (c.count > 1 && c.label) gfx.label(c.label, { x, y: base + 58, at });
          const val = c.value != null ? gfx.big(String(c.value), { x, y: base - size - 45, size: o.valueSize || 96, at: at + 0.4, color: c.valueColor || (k === 'left' ? '#4f8ef7' : '#f08a3c') }) : null;
          sides[k] = { item: it, value: val, x };
        });
        if (o.vs !== false && o.left && o.right) gfx.label('VS', { x: z.cx, y: base - size * 0.5, at: t0 + 0.5, size: 44, color: '#e8574b' });
        if (o.winner && sides[o.winner]) {
          const wAt = T(o.winnerAt ?? t0 + 2), loser = sides[o.winner === 'left' ? 'right' : 'left'];
          if (sides[o.winner].item.grow) sides[o.winner].item.grow(wAt, 1.15);
          gfx.burst(sides[o.winner].x, base - size - 60, wAt);
          if (loser?.item.fade) loser.item.fade(wAt, 0.35);
        }
        return sides;
      },
      /** Feedback loop: 3–5 objects on a circle joined by curved arrows (optionally with tokens). */
      cycle(o = {}) {
        gfx._begin(o);
        const z = gfx.zone(), items = o.items || [], n = items.length || 1;
        const r = Math.min(z.w, z.h) * 0.4, size = Math.max(120, o.size || Math.min(160, r * 0.58));
        const cx = z.cx, cy = z.cy + 30, t0 = T(o.at), stg = o.stagger ?? 0.7;
        const pos = items.map((_, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
        const hs = items.map((it, i) => gfx.item(it.item, { x: pos[i][0], y: pos[i][1] + size / 2, size, at: it.at ?? t0 + i * stg, label: it.label, color: it.color }));
        items.forEach((it, i) => {
          const a = pos[i], b = pos[(i + 1) % n];
          const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, k = size * 0.62;
          const ar = gfx.arrow({ from: [a[0] + (dx / d) * k, a[1] + (dy / d) * k], to: [b[0] - (dx / d) * k, b[1] - (dy / d) * k], at: (items[(i + 1) % n].at ?? t0 + (i + 1) * stg) - 0.3, curve: -0.22, width: 12 });
          if (o.token) gfx.stream(ar.path, { item: o.token, at: t0 + n * stg, size: 44, count: 2, speed: 0.45 });
        });
        if (o.center) gfx.label(o.center, { x: cx, y: cy, at: t0 + n * stg, size: 40 });
        return hs;
      },
      /** Fade out every graphic drawn so far (to start a second idea within the same scene). */
      clear(at, dur = 0.45) {
        const kids = [...getLayer().children];
        if (kids.length) tl.to(kids, { opacity: 0, duration: dur, ease: 'power2.in' }, T(at));
        gfx._mark = kids.length;
        return gfx;
      },

      /** Draw a hand-coded object. Base (bottom-centre) sits at (x, y). */
      item(name, o = {}) {
        const key = resolve(name);
        if (!key) window.__rt?.warn?.(`Đồ họa không có: "${name}" — dùng: ${Object.keys(OBJ).join(', ')}`);
        // Icons blown up past ~700px look broken (a 'wave' stretched into a sea) — big areas belong to diagrams like waterLevel.
        if (o.size > 720) window.__rt?.warn?.(`Vật thể '${name}' size ${o.size} quá lớn (tối đa 720) — mặt nước/nền rộng hãy dùng sơ đồ (g.waterLevel, g.battleMap...)`);
        const size = Math.min(o.size || 200, 720), s = size / 200, x = o.x ?? 960, y = o.y ?? 860;
        const [g, pos] = placed(`gfx gfx-${key || 'missing'}`, `translate(${x},${y - size / 2})`);
        const inner = mk('g', {}, pos);
        const body = mk('g', { transform: `scale(${s * (o.flip ? -1 : 1)},${s})` }, inner);
        if (o.shadow !== false) mk('ellipse', { cx: 0, cy: 100, rx: 80, ry: 10, fill: 'rgba(40,30,20,.14)' }, body);
        body.insertAdjacentHTML('beforeend', key ? OBJ[key]({ ...o, color: pal(o.color) }) : `<circle r="60" fill="${C.grey}"/>`);
        animateParts(body, x);
        appear(g, o.at, o.anim);
        if (o.label) gfx.label(o.label, { x, y: y + 58, at: (o.at ?? 0) + 0.3, size: o.labelSize, color: o.labelColor });
        return handle(g, { x, y });
      },
      /** Rounded label pill (≤ 4 words). */
      label(text, o = {}) {
        const fs = o.size || 40, w = Math.max(90, String(text).length * fs * 0.56 + fs * 1.2), h = fs * 1.7;
        const [g, pos] = placed('gfx-label', `translate(${o.x ?? 960},${o.y ?? 540})`);
        const bg = pal(o.color) || C.ink;
        mk('rect', { x: -w / 2, y: -h / 2 + 5, width: w, height: h, rx: h / 2, fill: shade(bg, -0.25) }, pos);
        mk('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2, fill: bg }, pos);
        const t = mk('text', { y: fs * 0.36, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 800, fill: o.textColor || '#fff', 'font-family': "'Be Vietnam Pro',sans-serif" }, pos);
        t.textContent = text;
        appear(g, o.at, o.anim || 'pop', 0.45);
        return handle(g, { x: o.x ?? 960, y: o.y ?? 540 });
      },
      /** Big bold number/word with a soft shadow; optional count-up. */
      big(text, o = {}) {
        // Fit the widest text it will show (count-up final value included) inside the free area, and keep it on screen.
        const zz = gfx.zone(), longest = Math.max(String(text).length, o.countTo != null ? String(o.countTo).length + String(o.suffix || '').length + 1 : 0);
        const fs = Math.max(56, Math.min(o.size || 150, (zz.w - 40) / (longest * 0.62))), x = o.x ?? zz.cx, y = Math.max(fs * 0.85, o.y ?? zz.y0 + 110);
        const [g, pos] = placed('gfx-big', `translate(${x},${y})`);
        const shadow = mk('text', { x: 6, y: 8, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 900, fill: 'rgba(40,30,20,.18)', 'font-family': "'Be Vietnam Pro',sans-serif" }, pos);
        const main = mk('text', { 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 900, fill: pal(o.color) || C.orange, 'font-family': "'Be Vietnam Pro',sans-serif" }, pos);
        shadow.textContent = main.textContent = text;
        appear(g, o.at, o.anim || 'pop', 0.5);
        if (o.countTo != null) {
          const t0 = T(o.at) + 0.1, dur = o.countDur || 1.4, from = o.countFrom || 0, dec = o.decimals || 0;
          frameFns.push(t => {
            const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
            const v = (from + (o.countTo - from) * e).toFixed(dec).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            shadow.textContent = main.textContent = (o.prefix || '') + v + (o.suffix || '');
          });
        }
        return handle(g, { x, y });
      },
      /** Chunky curved arrow that draws itself. */
      arrow(o = {}) {
        const [x1, y1] = o.from || [700, 540], [x2, y2] = o.to || [1220, 540];
        const bend = o.curve ?? 0.18, c = pal(o.color) || C.ink, w = o.width || 16;
        const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
        const g = mk('g', { class: 'gfx-arrow' }, getLayer());
        const path = mk('path', { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-dasharray': o.dashed ? `${w * 0.1} ${w * 2}` : null }, g);
        const ang = Math.atan2(y2 - my, x2 - mx), hs = w * 2.6;
        const head = mk('path', { d: `M${x2 + Math.cos(ang) * w * 0.6},${y2 + Math.sin(ang) * w * 0.6} L${x2 - hs * Math.cos(ang - 0.55)},${y2 - hs * Math.sin(ang - 0.55)} L${x2 - hs * Math.cos(ang + 0.55)},${y2 - hs * Math.sin(ang + 0.55)} Z`, fill: c, 'stroke-linejoin': 'round' }, g);
        const t = T(o.at), dur = o.dur || 0.8;
        if (o.dashed) tl.fromTo(path, { opacity: 0 }, { opacity: 1, duration: dur }, t);
        else tl.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, ease: 'power2.inOut' }, t);
        tl.fromTo(head, { opacity: 0, scale: 0, transformOrigin: `${x2}px ${y2}px` }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, t + dur * 0.85);
        if (o.label) gfx.label(o.label, { x: mx, y: my - 10, at: t + dur * 0.6, size: 32, color: o.labelColor || '#fff', textColor: C.ink });
        return { el: g, path };
      },
      /** Tokens (coins, bills, boxes...) travelling along a path in a loop, from `at` for `dur` seconds. */
      stream(pathEl, o = {}) {
        const item = resolve(o.item || 'coin') || 'coin', n = o.count || 4, size = o.size || 60, t0 = T(o.at), end = t0 + (o.dur ?? 1e9), speed = o.speed || 0.6;
        const len = pathEl.getTotalLength();
        const toks = Array.from({ length: n }, () => { const g = mk('g', { opacity: 0 }, getLayer()); g.insertAdjacentHTML('beforeend', `<g transform="scale(${size / 200}) translate(0,-100)">${OBJ[item]({})}</g>`); return g; });
        frameFns.push(t => toks.forEach((g, i) => {
          if (t < t0 || t > end) { g.setAttribute('opacity', 0); return; }
          const k = ((t - t0) * speed + i / n) % 1;
          const p = pathEl.getPointAtLength(k * len);
          g.setAttribute('transform', `translate(${p.x},${p.y + size * 0.5})`);
          g.setAttribute('opacity', Math.min(1, k * 8, (1 - k) * 8).toFixed(2));
        }));
        return toks;
      },
      /** Flow diagram: nodes (objects + labels), arrows between them, optional tokens moving along each link. */
      flow(o = {}) {
        const at = T(o.at), stg = o.stagger ?? 0.5, nodes = {};
        (o.nodes || []).forEach((n, i) => { nodes[n.id] = { ...n, h: gfx.item(n.item, { x: n.x, y: n.y, size: n.size || 170, at: n.at ?? at + i * stg, label: n.label }) }; });
        const links = (o.links || []).map((l, i) => {
          const a = nodes[l.from], b = nodes[l.to];
          if (!a || !b) return null;
          const sa = (a.size || 170), sb = (b.size || 170);
          const ay = a.y - sa / 2, by = b.y - sb / 2;
          const dx = b.x - a.x, dy = by - ay, d = Math.hypot(dx, dy) || 1;
          const from = [a.x + (dx / d) * sa * 0.62, ay + (dy / d) * sa * 0.62], to = [b.x - (dx / d) * sb * 0.62, by - (dy / d) * sb * 0.62];
          const la = l.at ?? at + (o.nodes.length * stg) + i * stg;
          const ar = gfx.arrow({ from, to, at: la, curve: l.curve ?? 0.12, color: l.color, label: l.label, width: 14 });
          if (l.token) gfx.stream(ar.path, { item: l.token, at: la + 0.8, size: l.tokenSize || 56, count: l.count || 3, speed: l.speed || 0.5 });
          return ar;
        });
        return { nodes, links };
      },
      /** Cartoon bar chart. Bars grow with a bounce; values count up; optional object on top of each bar. */
      bars(o = {}) {
        if (!o._nested) gfx._begin(o);
        const data = o.data || [], z = gfx.zone(), x = o.x ?? z.x0 + 30, y = o.y ?? z.y1 - 40, w = o.w ?? z.w - 60, h = o.h ?? z.h - (data.some(d => d.item) ? 330 : 240);
        const max = o.max ?? Math.max(...data.map(d => d.value)) * 1.1;
        const g = mk('g', { class: 'gfx-bars' }, getLayer());
        const bw = (w / data.length) * 0.58, gap = w / data.length;
        const base = mk('rect', { x: x - 20, y, width: w + 40, height: 10, rx: 5, fill: C.greyD }, g);
        const t0 = T(o.at), unit = o.unit && /^\p{L}/u.test(o.unit) ? ' ' + o.unit : (o.unit || '');
        tl.fromTo(base, { scaleX: 0, transformOrigin: `${x - 20}px ${y}px` }, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, t0);
        const pals = [C.blue, C.orange, C.teal, C.purple, C.red, C.gold];
        data.forEach((d, i) => {
          const bx = x + i * gap + (gap - bw) / 2, bh = (d.value / max) * h, col = pal(d.color) || pals[i % pals.length];
          const st = t0 + 0.3 + i * (o.stagger ?? 0.25), dur = o.dur || 1;
          const bar = mk('g', {}, g);
          const r1 = mk('rect', { x: bx, y: y - bh, width: bw, height: bh, rx: Math.min(18, bw / 4), fill: col }, bar);
          mk('rect', { x: bx, y: y - bh, width: bw * 0.28, height: bh, rx: Math.min(18, bw / 4), fill: '#fff', opacity: 0.18 }, bar);
          tl.fromTo(bar, { scaleY: 0, transformOrigin: `${bx}px ${y}px` }, { scaleY: 1, duration: dur, ease: 'elastic.out(1,0.75)' }, st);
          const lab = mk('text', { x: bx + bw / 2, y: y + 54, 'text-anchor': 'middle', 'font-size': o.labelSize || 36, 'font-weight': 700, fill: C.ink, 'font-family': "'Be Vietnam Pro',sans-serif" }, g);
          lab.textContent = d.label;
          tl.fromTo(lab, { opacity: 0 }, { opacity: 1, duration: 0.3 }, st);
          const val = mk('text', { x: bx + bw / 2, y: y - bh - 22, 'text-anchor': 'middle', 'font-size': o.valueSize || 46, 'font-weight': 900, fill: col, 'font-family': "'Be Vietnam Pro',sans-serif" }, g);
          const dec = o.decimals ?? (Number.isInteger(d.value) ? 0 : 1);
          frameFns.push(t => {
            const k = Math.max(0, Math.min(1, (t - st) / dur)), e = 1 - Math.pow(1 - k, 3);
            val.textContent = (o.prefix || '') + (d.value * e).toFixed(Number.isInteger(d.value) ? 0 : dec).replace('.', ',') + unit;
            val.setAttribute('opacity', k > 0 ? 1 : 0);
          });
          if (d.item) {
            const ih = gfx.item(d.item, { x: bx + bw / 2, y: y - bh - (o.valueSize || 46) - 30, size: Math.min(120, bw * 0.9), at: st + dur * 0.6, shadow: false });
            ih.el.classList.add('gfx-bar-item');
          }
          r1.setAttribute('data-v', d.value);
        });
        return g;
      },
      /** Thick line chart that draws itself with a dot riding the tip. points: [[x, y], ...] in data units. */
      line(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), X = o.x ?? z.x0 + 70, Y = o.y ?? z.y1 - 50, w = o.w ?? z.w - 140, h = o.h ?? z.h - 210, pts = o.points || [];
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = o.min ?? Math.min(0, ...ys), y1 = o.max ?? Math.max(...ys) * 1.1;
        const sx = v => X + ((v - x0) / (x1 - x0 || 1)) * w, sy = v => Y - ((v - y0) / (y1 - y0 || 1)) * h;
        const g = mk('g', { class: 'gfx-line' }, getLayer());
        const col = pal(o.color) || C.red, t0 = T(o.at), dur = o.dur || 2;
        mk('rect', { x: X - 10, y: Y, width: w + 20, height: 8, rx: 4, fill: C.greyD }, g);
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])},${sy(p[1])}`).join(' ');
        const area = mk('path', { d: `${d} L${sx(x1)},${Y} L${sx(x0)},${Y} Z`, fill: col, opacity: 0.14 }, g);
        const path = mk('path', { d, fill: 'none', stroke: col, 'stroke-width': o.width || 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
        const dot = mk('circle', { r: 18, fill: col, stroke: '#fff', 'stroke-width': 6 }, g);
        tl.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, ease: 'power1.inOut' }, t0);
        tl.fromTo(area, { opacity: 0 }, { opacity: 0.14, duration: 0.6 }, t0 + dur * 0.8);
        const len = path.getTotalLength(), ease = gsap.parseEase('power1.inOut');
        frameFns.push(t => { const k = ease(Math.max(0, Math.min(1, (t - t0) / dur))); const p = path.getPointAtLength(k * len); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('opacity', t >= t0 ? 1 : 0); });
        (o.xLabels || [pts[0]?.[0], pts[pts.length - 1]?.[0]]).forEach(v => { if (v == null) return; const tx = mk('text', { x: sx(v), y: Y + 50, 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 700, fill: C.ink, 'font-family': "'Be Vietnam Pro',sans-serif" }, g); tx.textContent = v; });
        (o.marks || []).forEach(m => { const px = sx(m.x), py = sy(m.y); gfx.label(m.label, { x: px, y: py - 60, at: m.at ?? t0 + dur, size: 32, color: m.color || col }); });
        return { el: g, path };
      },
      donut(o = {}) {
        if (!o._nested) gfx._begin(o);
        const zz = gfx.zone(), cx = o.x ?? zz.cx, cy = o.y ?? zz.cy + 20, r = o.r || Math.min(190, zz.h * 0.3), data = o.data || [], sum = data.reduce((a, d) => a + d.value, 0) || 1;
        const g = mk('g', { class: 'gfx-donut' }, getLayer());
        const pals = [C.blue, C.orange, C.teal, C.purple, C.red, C.gold];
        let acc = 0; const t0 = T(o.at), dur = o.dur || 1.4;
        data.forEach((d, i) => {
          const frac = d.value / sum, start = acc; acc += frac;
          const c = mk('circle', { cx, cy, r, fill: 'none', stroke: pal(d.color) || pals[i % pals.length], 'stroke-width': r * 0.42, transform: `rotate(${start * 360 - 90} ${cx} ${cy})`, 'stroke-dasharray': `${frac * 2 * Math.PI * r} ${2 * Math.PI * r}` }, g);
          tl.fromTo(c, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur * frac + 0.2, ease: 'power2.out' }, t0 + start * dur);
          if (d.label) { const a = (start + frac / 2) * Math.PI * 2 - Math.PI / 2; gfx.label(d.label, { x: cx + Math.cos(a) * r * 1.55, y: cy + Math.sin(a) * r * 1.55, at: t0 + (start + frac) * dur, size: 32, color: pal(d.color) || pals[i % pals.length] }); }
        });
        if (o.center) gfx.big(o.center, { x: cx, y: cy + r * 0.18, size: r * 0.5, at: t0 + dur, color: C.ink });
        return g;
      },
      /** Balance scale; tilt steps: [{at, value:-1..1}] (−1 = left side heavier/down). */
      scale(o = {}) {
        if (!o._nested) gfx._begin(o);
        const zz = gfx.zone(), x = o.x ?? zz.cx, y = o.y ?? zz.y1 + 10, s = (o.size || Math.min(640, zz.w * 0.85)) / 600;
        const [outer, root] = placed('gfx-scale', `translate(${x},${y}) scale(${s})`);
        mk('ellipse', { cx: 0, cy: 0, rx: 150, ry: 16, fill: 'rgba(40,30,20,.14)' }, root);
        mk('path', { d: 'M-110,0 L110,0 L70,-40 L-70,-40 Z', fill: C.brown }, root);
        mk('rect', { x: -14, y: -420, width: 28, height: 390, rx: 10, fill: C.brownD }, root);
        const beam = mk('g', { transform: 'translate(0,-400)' }, root);
        mk('rect', { x: -270, y: -12, width: 540, height: 24, rx: 12, fill: C.brown }, beam);
        mk('circle', { r: 26, fill: C.gold }, beam);
        const pans = [-250, 250].map(px => {
          const pg = mk('g', {}, beam);
          mk('line', { x1: px, y1: 0, x2: px - 90, y2: 170, stroke: C.greyD, 'stroke-width': 5 }, pg);
          mk('line', { x1: px, y1: 0, x2: px + 90, y2: 170, stroke: C.greyD, 'stroke-width': 5 }, pg);
          mk('path', { d: `M${px - 120},170 L${px + 120},170 Q${px + 100},220 ${px},222 Q${px - 100},220 ${px - 120},170 Z`, fill: C.gold }, pg);
          return pg;
        });
        const side = (conf, i) => {
          if (!conf) return;
          const pg = pans[i], px = i ? 250 : -250, s2 = (conf.size || 140) / 200;
          const holder = mk('g', { transform: `translate(${px},${170 - 100 * s2}) scale(${s2})` }, pg);
          if (conf.item) holder.innerHTML = OBJ[resolve(conf.item) || 'box'](conf);
          if (conf.label) { const tx = mk('text', { x: px, y: 280, 'text-anchor': 'middle', 'font-size': 44, 'font-weight': 800, fill: C.ink, 'font-family': "'Be Vietnam Pro',sans-serif" }, pg); tx.textContent = conf.label; }
        };
        side(o.left, 0); side(o.right, 1);
        const st = { a: o.tilt0 ? o.tilt0 * 16 : 0 };
        (o.tilt || []).forEach(k => tl.to(st, { a: k.value * 16, duration: k.dur || 1, ease: 'elastic.out(1,0.5)' }, T(k.at)));
        frameFns.push(() => { beam.setAttribute('transform', `translate(0,-400) rotate(${st.a})`); pans.forEach(p => p.setAttribute('transform', `rotate(${-st.a} ${p === pans[0] ? -250 : 250} 0)`)); });
        appear(outer, o.at, 'rise');
        return { el: outer, tilt: (value, at, dur = 1) => tl.to(st, { a: value * 16, duration: dur, ease: 'elastic.out(1,0.5)' }, T(at)) };
      },
      /** A pile of items (coins, bills, boxes) whose count animates from `from` to `to`. */
      stack(o = {}) {
        if (!o._nested) gfx._begin(o);
        const zz = gfx.zone(), item = resolve(o.item || 'coin') || 'coin', x = o.x ?? zz.cx, y = o.y ?? zz.y1 - 20, size = o.size || 110, perRow = o.perRow || 1, maxN = Math.max(o.from ?? 0, o.to ?? 10);
        if (!STACKABLE.has(item) && !o.pile) return unitGrid(o, item, zz, maxN);
        const g = mk('g', { class: 'gfx-stack' }, getLayer());
        const step = item === 'coin' ? size * 0.22 : item === 'cash' || item === 'banknote' ? size * 0.28 : size * 0.9;
        const flat = item === 'coin' ? (i, gx) => `<g transform="translate(${gx},0)"><ellipse rx="${size * 0.5}" ry="${size * 0.16}" cy="${size * 0.07}" fill="${C.goldD}"/><ellipse rx="${size * 0.5}" ry="${size * 0.16}" fill="${C.gold}"/><ellipse rx="${size * 0.34}" ry="${size * 0.09}" fill="none" stroke="${C.goldD}" stroke-width="${size * 0.04}"/></g>` : (i, gx) => `<g transform="translate(${gx},${-size / 2}) scale(${size / 200})">${OBJ[item]({})}</g>`;
        const els = [];
        for (let i = 0; i < maxN; i++) {
          const row = Math.floor(i / perRow), col = i % perRow;
          const e = mk('g', { transform: `translate(${x + (col - (perRow - 1) / 2) * size * 1.1 + (row % 2 ? 4 : -4)},${y - size * 0.1 - row * step})` }, g);
          e.innerHTML = flat(i, 0);
          els.push(e);
        }
        const st = { n: o.from ?? 0 };
        if (o.at != null && o.to != null) tl.to(st, { n: o.to, duration: o.dur || 1.5, ease: o.ease || 'power1.inOut' }, T(o.at));
        frameFns.push(() => els.forEach((e, i) => e.setAttribute('opacity', i < Math.round(st.n) ? 1 : 0)));
        if (o.label) gfx.label(o.label, { x, y: y + 60, at: o.at ?? 0, size: 34 });
        return { el: g, to: (n, at, dur = 1.2) => tl.to(st, { n, duration: dur, ease: 'power1.inOut' }, T(at)) };
      },
      /** Gauge (speedometer-like) with needle moving from `from` to `to` (0..1). */
      gauge(o = {}) {
        if (!o._nested) gfx._begin(o);
        const zz = gfx.zone(), x = o.x ?? zz.cx, y = o.y ?? zz.cy + 130, r = o.r || Math.min(220, zz.w * 0.3);
        const [outerG, g] = placed('gfx-gauge', `translate(${x},${y})`);
        [[C.teal, 0, 0.33], [C.gold, 0.33, 0.66], [C.red, 0.66, 1]].forEach(([c, a, b]) => {
          const p = (k) => [Math.cos(Math.PI + k * Math.PI) * r, Math.sin(Math.PI + k * Math.PI) * r];
          const [ax, ay] = p(a), [bx, by] = p(b);
          mk('path', { d: `M${ax},${ay} A${r},${r} 0 0 1 ${bx},${by}`, fill: 'none', stroke: c, 'stroke-width': r * 0.22 }, g);
        });
        const needle = mk('g', {}, g);
        mk('path', { d: `M-10,0 L0,${-r * 0.9} L10,0 Z`, fill: C.ink }, needle);
        mk('circle', { r: r * 0.1, fill: C.ink }, g);
        const st = { v: o.from ?? 0 };
        if (o.to != null) tl.to(st, { v: o.to, duration: o.dur || 1.6, ease: 'elastic.out(1,0.6)' }, T((o.at ?? 0) + 0.3));
        frameFns.push(t => needle.setAttribute('transform', `rotate(${-90 + st.v * 180 + Math.sin(t * 9) * 1.2})`));
        if (o.label) gfx.label(o.label, { x: 0 + x, y: y + 70, at: o.at, size: 36 });
        appear(outerG, o.at, 'pop');
        return { el: outerG, to: (v, at, dur = 1.2) => tl.to(st, { v, duration: dur, ease: 'elastic.out(1,0.6)' }, T(at)) };
      },
      /** Horizontal timeline with milestone dots, labels and optional objects. */
      timeline(o = {}) {
        if (!o._nested) gfx._begin(o);
        const zz = gfx.zone(), x = o.x ?? zz.x0 + 70, y = o.y ?? zz.cy + 70, w = o.w ?? zz.w - 140, items = o.items || [];
        const g = mk('g', { class: 'gfx-timeline' }, getLayer());
        const line = mk('rect', { x, y: y - 6, width: w, height: 12, rx: 6, fill: C.greyD }, g);
        const t0 = T(o.at), stg = o.stagger ?? 0.6;
        tl.fromTo(line, { scaleX: 0, transformOrigin: `${x}px ${y}px` }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, t0);
        items.forEach((it, i) => {
          const px = x + (items.length === 1 ? w / 2 : (i / (items.length - 1)) * w), at = it.at ?? t0 + 0.4 + i * stg;
          const dg = mk('g', {}, g);
          mk('circle', { cx: px, cy: y, r: 26, fill: '#fff', stroke: it.color || C.orange, 'stroke-width': 10 }, dg);
          const lab = mk('text', { x: px, y: y + 76, 'text-anchor': 'middle', 'font-size': 44, 'font-weight': 900, fill: it.color || C.orange, 'font-family': "'Be Vietnam Pro',sans-serif" }, dg);
          lab.textContent = it.label;
          if (it.text) { const tx = mk('text', { x: px, y: y + 122, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 600, fill: C.ink, 'font-family': "'Be Vietnam Pro',sans-serif" }, dg); tx.textContent = it.text; }
          tl.fromTo(dg, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }, at);
          if (it.item) gfx.item(it.item, { x: px, y: y - 40, size: it.size || 150, at: at + 0.15, shadow: false });
        });
        return g;
      },
      /** Confetti-like burst for emphasis at (x, y). */
      burst(x, y, at, o = {}) {
        const g = mk('g', { class: 'gfx-burst' }, getLayer());
        const n = o.count || 14, t0 = T(at), cols = [C.gold, C.orange, C.teal, C.blue, C.pink];
        const parts = Array.from({ length: n }, (_, i) => mk(i % 2 ? 'circle' : 'rect', i % 2 ? { r: 9, fill: cols[i % 5] } : { x: -7, y: -7, width: 14, height: 14, rx: 3, fill: cols[i % 5] }, g));
        frameFns.push(t => parts.forEach((p, i) => {
          const k = (t - t0) / 0.9;
          if (k < 0 || k > 1) { p.setAttribute('opacity', 0); return; }
          const a = (i / n) * Math.PI * 2, d = (o.radius || 170) * (1 - Math.pow(1 - k, 3));
          p.setAttribute('transform', `translate(${x + Math.cos(a) * d},${y + Math.sin(a) * d + k * k * 80}) rotate(${k * 360})`);
          p.setAttribute('opacity', (1 - k).toFixed(2));
        }));
        return g;
      },
    };
    // Diagram packs (gfx-diagrams.js) plug in here with access to the internals.
    for (const ext of window.Gfx?.extenders || []) ext(gfx, { tl, frameFns, T, getLayer, appear, mk, handle, placed, resolve, OBJ, C, shade, pal, stage });
    return gfx;
  }

  window.Gfx = {
    create: createGfx, OBJ, ALIAS, C, shade, coinSvg, bill, pal, animateParts: animatePartsWith,
    get names() { return Object.keys(OBJ); },
    /** Add objects from other files: Gfx.register({ name: o => svg }, { alias: 'name' }). */
    register(objs, aliases = {}) { Object.assign(OBJ, objs); Object.assign(ALIAS, aliases); },
    extenders: [],
    extend(fn) { this.extenders.push(fn); },
  };
})();
