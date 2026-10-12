/* 2D cartoon layer: rigged characters + full-frame settings + a camera.
 * Everything is driven by state objects tweened on the scene's paused timeline and rendered in onFrame(t),
 * so scenes stay a pure function of time (frame-exact export). */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1920, H = 1080;
  const rad = d => (d * Math.PI) / 180;
  const esc = s => String(s).replace(/[<&"]/g, c => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));

  function mk(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function mulberry(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** A named drawing of `size` px centred on (0, cy): the object library (Gfx.OBJ, incl. this video's assets) first, then the icon library. */
  function artMarkup(name, size, cy = 0) {
    const G = window.Gfx, key = G && (G.OBJ[name] ? name : G.ALIAS?.[name] && G.OBJ[G.ALIAS[name]] ? G.ALIAS[name] : null);
    if (key) return `<g transform="translate(0,${cy}) scale(${size / 200})">${G.OBJ[key]({})}</g>`;
    const svg = window.__rt?.data?.illus?.[name];
    if (!svg) { window.__rt?.warn?.(`Vật thể không có: "${name}" — xem danh sách vật thể`); return ''; }
    return `<svg x="${-size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" viewBox="${svg.match(/viewBox="([^"]+)"/)?.[1] || '0 0 32 32'}">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ───────────────────────── character looks ─────────────────────────
  const SKIN = { light: '#f7d5b8', tan: '#eab68f', brown: '#c98b63', dark: '#8e5b3e' };
  const HAIRC = { black: '#2a2220', brown: '#6b4428', grey: '#b8b2aa', white: '#ece8e2', blonde: '#e7c068', red: '#b5502f' };
  const OUTFIT_DEFAULTS = {
    casual: { shirt: '#4f8ef7', pants: '#34405e' },
    suit: { shirt: '#2f3a55', pants: '#2f3a55', tie: '#d9483b' },
    labcoat: { shirt: '#7fb3e8', pants: '#3b4460' },
    farmer: { shirt: '#6a9f58', pants: '#5a4634', hat: 'straw' },
    dress: { shirt: '#e5677d', pants: null },
    uniform: { shirt: '#3f5a3a', pants: '#3f5a3a', hat: 'cap' },
    worker: { shirt: '#f08a3c', pants: '#3a4b6e', hat: 'hardhat' },
    hoodie: { shirt: '#8a6bd6', pants: '#2e3448' },
    aodai: { shirt: '#e8453c', pants: '#f4efe6' },
    astronaut: { shirt: '#f4f6fa', pants: '#e6e9f0' },
  };

  function normalizeLook(look = {}) {
    const outfit = OUTFIT_DEFAULTS[look.outfit] ? look.outfit : 'casual';
    const d = OUTFIT_DEFAULTS[outfit];
    const female = look.gender === 'female';
    const age = look.age || 'adult';
    const skin = SKIN[look.skin] || (/^#/.test(look.skin || '') ? look.skin : SKIN.light);
    const hairColor = HAIRC[look.hairColor] || (/^#/.test(look.hairColor || '') ? look.hairColor : age === 'elder' ? HAIRC.grey : HAIRC.black);
    return {
      outfit, female, age, skin, hairColor,
      hair: look.hair || (female ? 'long' : age === 'elder' ? 'bald' : 'short'),
      shirt: look.shirt || d.shirt,
      pants: look.pants || d.pants || skin,
      tie: look.tie || d.tie || '#d9483b',
      hat: look.hat === 'none' ? null : (look.hat || d.hat || null),
      glasses: !!look.glasses || look.accessory === 'glasses',
      mustache: !!look.mustache || look.accessory === 'mustache',
      shoes: look.shoes || '#2d2a32',
    };
  }

  // Poses: upper-arm / forearm angles (0 = hanging down, + = outward, 180 = straight up),
  // thigh / knee, lean, head tilt. L/R are the character's screen-left/right before facing flip.
  const POSES = {
    idle: { aLu: 8, aLf: 4, aRu: 8, aRf: 4, lean: 0, tilt: 0 },
    point: { aRu: 96, aRf: 92, aLu: 8, aLf: 4, lean: 3, tilt: 4 },
    'point-up': { aRu: 150, aRf: 168, aLu: 10, aLf: 6, lean: 0, tilt: -8 },
    present: { aRu: 60, aRf: 105, aLu: 10, aLf: 6, lean: 2, tilt: 5 },
    wave: { aRu: 140, aRf: 175, aLu: 8, aLf: 4, lean: 0, tilt: 6 },
    cheer: { aLu: 150, aLf: 165, aRu: 150, aRf: 165, lean: 0, tilt: 0 },
    shrug: { aLu: 42, aLf: 128, aRu: 42, aRf: 128, lean: 0, tilt: 10 },
    think: { aRu: 22, aRf: -150, aLu: 26, aLf: -80, lean: -2, tilt: 12 },
    worried: { aLu: 30, aLf: -160, aRu: 30, aRf: -160, lean: 0, tilt: 0 },
    sad: { aLu: 4, aLf: -2, aRu: 4, aRf: -2, lean: 6, tilt: 14 },
    surprised: { aLu: 55, aLf: 150, aRu: 55, aRf: 150, lean: -4, tilt: -4 },
    hold: { aRu: 34, aRf: 95, aLu: 8, aLf: 4, lean: 0, tilt: 0 },
    'hold-both': { aLu: 30, aLf: 80, aRu: 30, aRf: 80, lean: 0, tilt: 0 },
    give: { aRu: 80, aRf: 86, aLu: 8, aLf: 4, lean: 6, tilt: 4 },
    receive: { aRu: 55, aRf: 95, aLu: 55, aLf: 95, lean: 4, tilt: 2 },
    'arms-crossed': { aLu: 20, aLf: -115, aRu: 20, aRf: -115, lean: -2, tilt: 0 },
    facepalm: { aRu: 25, aRf: -168, aLu: 8, aLf: 4, lean: 5, tilt: 18 },
    angry: { aLu: 22, aLf: -40, aRu: 22, aRf: -40, lean: 5, tilt: -3 },
    celebrate: { aLu: 150, aLf: 160, aRu: 110, aRf: 175, lean: 0, tilt: 6 },
    count: { aRu: 70, aRf: 150, aLu: 30, aLf: 70, lean: 0, tilt: 6 },
    explain: { aRu: 28, aRf: 72, aLu: 10, aLf: 6, lean: 1, tilt: 4 },
    'explain-left': { aLu: 28, aLf: 72, aRu: 10, aRf: 6, lean: 1, tilt: -4 },
    'explain-both': { aLu: 26, aLf: 68, aRu: 26, aRf: 68, lean: 0, tilt: 0 },
    'open-arms': { aLu: 62, aLf: 78, aRu: 62, aRf: 78, lean: -1, tilt: 3 },
    'hands-hips': { aLu: 36, aLf: -96, aRu: 36, aRf: -96, lean: -2, tilt: -3 },
    'hand-chest': { aRu: 26, aRf: -142, aLu: 8, aLf: 4, lean: 2, tilt: 6 },
    'scratch-head': { aRu: 150, aRf: -118, aLu: 8, aLf: 4, lean: 3, tilt: 12 },
    chin: { aRu: 24, aRf: -152, aLu: 8, aLf: 4, lean: 1, tilt: 10 },
    emphasis: { aRu: 44, aRf: 26, aLu: 12, aLf: 8, lean: 4, tilt: -2 },
    'present-screen': { aRu: 74, aRf: 58, aLu: 10, aLf: 6, lean: -2, tilt: 8 },
    relax: { aLu: 14, aLf: 10, aRu: 16, aRf: 18, lean: 0, tilt: 2 },
    stop: { aRu: 84, aRf: 168, aLu: 8, aLf: 4, lean: -3, tilt: -2 },
    'lean-in': { aRu: 30, aRf: 70, aLu: 30, aLf: 70, lean: 9, tilt: 6 },
  };
  const POSE_EMOTE = { 'scratch-head': 'confused', 'hands-hips': 'determined', sad: 'sad', worried: 'worried', surprised: 'surprised', cheer: 'happy', celebrate: 'happy', think: 'thinking', facepalm: 'sad', angry: 'angry', wave: 'happy', shrug: 'neutral' };

  const HEAD_R = 64, HIP_Y = -196, NECK_Y = -330, UPPER = 80, LOWER = 74, THIGH = 100, SHIN = 96, SEAT_DROP = 92;

  class Character {
    constructor(world, look, o = {}) {
      this.world = world;
      this.look = normalizeLook(look);
      const k = this.look.age === 'kid' ? 0.72 : this.look.age === 'elder' ? 0.97 : 1;
      const depth = this.depth = o.depth ?? 0;
      // y: stand somewhere other than the ground (a ledge, a boat deck, floating in space)
      this.base = { scale: (o.scale ?? 1) * (world.actorScale ?? 1) * k * (1 - depth * 0.45), groundY: o.y ?? world.groundAt(depth) };
      this.p = {
        x: o.x ?? 960, y: 0, face: o.face ?? 1, jump: 0,
        aLu: 8, aLf: 4, aRu: 8, aRf: 4, lL: 0, kL: 0, lR: 0, kR: 0, lean: this.look.age === 'elder' ? 6 : 0, tilt: 0,
        walk: 0, talk: 0, opacity: 1, squash: 0, lookX: 0, brow: 0,
        dy: 0, rot: 0, sx: 1, sy: 1, sit: 0,
      };
      this.deskRanges = [];
      this.x0 = this.p.x;   // where the character was put (auto-framing uses this, never the animated x)
      this.floatRanges = [];
      this.workRanges = [];
      if (o.float) this.float(0);
      this.s = { emote: o.emote || 'neutral', mouth: null, look: 'camera' };
      this.propState = { name: null, x: 0, y: 0, hand: 'R', give: 0, target: null };
      this.rnd = mulberry(Math.round((o.x || 1) * 7919) + world.chars.length * 104729);
      this.blinkAt = Array.from({ length: 30 }, (_, i) => i * 3.4 + this.rnd() * 2.4);
      this.talkRanges = [];
      this.build();
      world.chars.push(this);
    }

    build() {
      const lay = typeof this.world.layerFor === 'function' ? this.world.layerFor(this.depth) : null;
      this.f = lay ? lay.f : 1;
      const L = this.look, root = this.root = mk('g', { class: 'k-char' }, lay ? lay.par : this.world.actors);
      this.shadow = mk('ellipse', { cx: 0, cy: 2, rx: 78, ry: 13, fill: 'rgba(40,30,20,.18)' }, root);
      const legs = mk('g', {}, root);
      const leg = () => ({
        thigh: mk('line', { stroke: L.pants, 'stroke-width': 36, 'stroke-linecap': 'round' }, legs),
        shin: mk('line', { stroke: L.female && L.outfit === 'dress' ? L.skin : L.pants, 'stroke-width': 32, 'stroke-linecap': 'round' }, legs),
        shoe: mk('ellipse', { rx: 27, ry: 14, fill: L.shoes }, legs),
      });
      this.legL = leg(); this.legR = leg();
      const body = this.body = mk('g', {}, root);
      if (L.outfit === 'astronaut') {
        // life-support backpack behind the suit
        mk('rect', { x: -70, y: NECK_Y - 4, width: 140, height: 150, rx: 22, fill: '#cfd5df', stroke: '#aab2c0', 'stroke-width': 4 }, body);
        mk('rect', { x: -52, y: NECK_Y + 12, width: 26, height: 40, rx: 6, fill: '#9aa3b5' }, body);
      }
      // coat tail / skirt / áo dài flaps drawn behind the torso
      if (L.outfit === 'labcoat') mk('path', { d: `M-62,${NECK_Y + 18} L-70,-120 L70,-120 L62,${NECK_Y + 18} Z`, fill: '#f7f8fb', stroke: '#dfe3ea', 'stroke-width': 3 }, body);
      if (L.outfit === 'dress') mk('path', { d: `M-52,${HIP_Y - 10} L-86,-92 Q0,-80 86,-92 L52,${HIP_Y - 10} Z`, fill: L.shirt }, body);
      if (L.outfit === 'aodai') mk('path', { d: `M-44,${HIP_Y - 6} L-58,-70 L58,-70 L44,${HIP_Y - 6} Z`, fill: L.shirt }, body);
      const shirt = L.outfit === 'labcoat' ? '#f7f8fb' : L.shirt;
      mk('rect', { x: -14, y: NECK_Y - 26, width: 28, height: 34, rx: 10, fill: shade(L.skin, -0.08) }, body);
      this.torso = mk('path', { d: `M-58,${NECK_Y + 6} Q-62,${NECK_Y} -50,${NECK_Y - 4} L50,${NECK_Y - 4} Q62,${NECK_Y} 58,${NECK_Y + 6} L50,${HIP_Y + 6} Q48,${HIP_Y + 16} 38,${HIP_Y + 16} L-38,${HIP_Y + 16} Q-48,${HIP_Y + 16} -50,${HIP_Y + 6} Z`, fill: shirt }, body);
      if (L.outfit === 'suit') {
        mk('path', { d: `M-20,${NECK_Y - 4} L0,${NECK_Y + 50} L20,${NECK_Y - 4} Z`, fill: '#ffffff' }, body);
        mk('path', { d: `M-7,${NECK_Y + 2} L7,${NECK_Y + 2} L10,${NECK_Y + 60} L0,${NECK_Y + 74} L-10,${NECK_Y + 60} Z`, fill: L.tie }, body);
        mk('path', { d: `M-20,${NECK_Y - 4} L-4,${NECK_Y + 56} L-30,${NECK_Y + 30} Z M20,${NECK_Y - 4} L4,${NECK_Y + 56} L30,${NECK_Y + 30} Z`, fill: shade(shirt, -0.18) }, body);
      } else if (L.outfit === 'labcoat') {
        mk('path', { d: `M-16,${NECK_Y - 4} L0,${NECK_Y + 40} L16,${NECK_Y - 4} Z`, fill: L.shirt }, body);
        mk('line', { x1: 0, y1: NECK_Y + 40, x2: 0, y2: HIP_Y + 14, stroke: '#dfe3ea', 'stroke-width': 3 }, body);
        mk('rect', { x: 20, y: NECK_Y + 30, width: 22, height: 16, rx: 3, fill: 'none', stroke: '#c9ced8', 'stroke-width': 3 }, body);
      } else if (L.outfit === 'farmer') {
        mk('path', { d: `M-40,${HIP_Y - 60} L40,${HIP_Y - 60} L46,${HIP_Y + 14} L-46,${HIP_Y + 14} Z`, fill: shade(L.pants, 0.1) }, body);
        mk('line', { x1: -30, y1: NECK_Y, x2: -30, y2: HIP_Y - 58, stroke: shade(L.pants, 0.1), 'stroke-width': 10 }, body);
        mk('line', { x1: 30, y1: NECK_Y, x2: 30, y2: HIP_Y - 58, stroke: shade(L.pants, 0.1), 'stroke-width': 10 }, body);
      } else if (L.outfit === 'uniform' || L.outfit === 'worker') {
        mk('rect', { x: -50, y: HIP_Y - 8, width: 100, height: 12, fill: shade(shirt, -0.35) }, body);
        mk('rect', { x: -10, y: HIP_Y - 10, width: 20, height: 16, rx: 3, fill: '#e7c35a' }, body);
        if (L.outfit === 'worker') { mk('rect', { x: -50, y: NECK_Y + 60, width: 100, height: 10, fill: '#f4f06a', opacity: 0.9 }, body); }
      } else if (L.outfit === 'hoodie') {
        mk('path', { d: `M-36,${NECK_Y - 2} Q0,${NECK_Y + 40} 36,${NECK_Y - 2}`, fill: 'none', stroke: shade(shirt, -0.2), 'stroke-width': 8 }, body);
        mk('rect', { x: -30, y: HIP_Y - 50, width: 60, height: 30, rx: 10, fill: shade(shirt, -0.12) }, body);
      } else if (L.outfit === 'aodai') {
        mk('path', { d: `M0,${NECK_Y - 4} Q16,${NECK_Y + 30} 34,${NECK_Y + 40}`, fill: 'none', stroke: shade(shirt, -0.25), 'stroke-width': 4 }, body);
      } else if (L.outfit === 'astronaut') {
        // chest control panel + flag patch + belt joint
        mk('rect', { x: -30, y: NECK_Y + 40, width: 60, height: 40, rx: 8, fill: '#dfe4ec', stroke: '#b9c1ce', 'stroke-width': 3 }, body);
        [['#e5484d', -16], ['#3fb950', 0], ['#3b7cf6', 16]].forEach(([c, x]) => mk('circle', { cx: x, cy: NECK_Y + 60, r: 5, fill: c }, body));
        mk('rect', { x: -54, y: HIP_Y - 4, width: 108, height: 14, rx: 6, fill: '#c3cad6' }, body);
      } else {
        mk('path', { d: `M-18,${NECK_Y - 4} Q0,${NECK_Y + 16} 18,${NECK_Y - 4}`, fill: shade(shirt, -0.15) }, body);
      }
      // arms (drawn after torso)
      const longSleeve = ['suit', 'labcoat', 'uniform', 'hoodie', 'farmer', 'aodai', 'worker', 'astronaut'].includes(L.outfit);
      const sleeve = L.outfit === 'labcoat' ? '#f7f8fb' : shirt;
      const arm = () => ({
        up: mk('line', { stroke: sleeve, 'stroke-width': 28, 'stroke-linecap': 'round' }, body),
        fore: mk('line', { stroke: longSleeve ? sleeve : L.skin, 'stroke-width': 25, 'stroke-linecap': 'round' }, body),
        hand: mk('circle', { r: 15, fill: L.skin }, body),
        prop: mk('g', { opacity: 0 }, body),
      });
      this.armL = arm(); this.armR = arm();
      // head
      const head = this.head = mk('g', { class: 'k-head' }, body);
      const R = HEAD_R, hc = L.hairColor;
      if (L.hair === 'long' || L.hair === 'ponytail') mk('path', { d: L.hair === 'long' ? `M${-R - 8},-6 Q${-R - 16},${R + 36} ${-R + 10},${R + 50} L${R - 10},${R + 50} Q${R + 16},${R + 36} ${R + 8},-6 Z` : `M${R - 6},-10 Q${R + 50},10 ${R + 30},${R + 40} Q${R + 14},20 ${R - 10},14 Z`, fill: hc }, head);
      mk('circle', { cx: -R + 2, cy: 6, r: 13, fill: shade(L.skin, -0.06) }, head);
      mk('circle', { cx: R - 2, cy: 6, r: 13, fill: shade(L.skin, -0.06) }, head);
      mk('ellipse', { cx: 0, cy: 0, rx: R, ry: R + 2, fill: L.skin }, head);
      const hairD = {
        short: `M${-R},4 C${-R - 4},${-R} ${-R / 2},${-R - 20} 0,${-R - 20} C${R / 2},${-R - 20} ${R + 6},${-R} ${R},4 C${R - 10},-22 ${R - 26},-36 ${R / 3},-38 C0,-26 ${-R / 2},-36 ${-R},4 Z`,
        side: `M${-R},6 C${-R - 6},${-R} ${-R / 3},${-R - 22} ${R / 4},${-R - 18} C${R},${-R - 10} ${R + 6},${-R / 2} ${R},6 C${R - 8},-30 ${R / 2},-44 ${-R / 3},-26 C${-R / 2},-20 ${-R + 8},-12 ${-R},6 Z`,
        long: `M${-R - 2},10 C${-R - 8},${-R} ${-R / 2},${-R - 20} 0,${-R - 20} C${R / 2},${-R - 20} ${R + 8},${-R} ${R + 2},10 C${R - 14},-30 ${R / 3},-40 0,-34 C${-R / 3},-40 ${-R + 14},-30 ${-R - 2},10 Z`,
        ponytail: `M${-R},4 C${-R - 4},${-R} ${-R / 2},${-R - 20} 0,${-R - 20} C${R / 2},${-R - 20} ${R + 6},${-R} ${R},4 C${R - 10},-26 ${R / 3},-40 0,-36 C${-R / 3},-40 ${-R + 10},-26 ${-R},4 Z`,
        bun: `M${-R},4 C${-R - 4},${-R} ${-R / 2},${-R - 20} 0,${-R - 20} C${R / 2},${-R - 20} ${R + 6},${-R} ${R},4 C${R - 10},-26 ${R / 3},-40 0,-36 C${-R / 3},-40 ${-R + 10},-26 ${-R},4 Z`,
        spiky: `M${-R},4 L${-R - 6},${-R + 4} L${-R / 2},${-R - 10} L${-R / 4},${-R - 34} L${R / 8},${-R - 14} L${R / 2},${-R - 30} L${R / 1.6},${-R - 6} L${R + 8},${-R + 6} L${R},4 C${R - 10},-26 ${R / 3},-40 0,-34 C${-R / 3},-40 ${-R + 10},-26 ${-R},4 Z`,
        curly: null, bald: null,
      };
      if (hairD[L.hair]) mk('path', { d: hairD[L.hair], fill: hc }, head);
      if (L.hair === 'bun') mk('circle', { cx: 0, cy: -R - 26, r: 24, fill: hc }, head);
      if (L.hair === 'curly') for (let i = 0; i < 9; i++) { const a = rad(-170 + i * 20); mk('circle', { cx: Math.cos(a) * (R - 4), cy: Math.sin(a) * (R - 4) - 6, r: 22, fill: hc }, head); }
      if (L.hair === 'bald') { mk('path', { d: `M${-R + 2},10 Q${-R - 4},-20 ${-R + 14},-30 L${-R + 18},4 Z M${R - 2},10 Q${R + 4},-20 ${R - 14},-30 L${R - 18},4 Z`, fill: hc }, head); }
      // face
      this.eyes = [-24, 24].map(x => {
        const g = mk('g', { transform: `translate(${x},4)` }, head);
        return { g, ball: mk('ellipse', { rx: 7.5, ry: 10, fill: '#2a2220' }, g), glint: mk('circle', { cx: 2.5, cy: -3.5, r: 2.6, fill: '#fff' }, g), arc: mk('path', { d: 'M-9,3 Q0,-8 9,3', fill: 'none', stroke: '#2a2220', 'stroke-width': 4.5, 'stroke-linecap': 'round', opacity: 0 }, g) };
      });
      this.brows = [-24, 24].map(x => mk('line', { stroke: shade(hc, -0.1), 'stroke-width': 5.5, 'stroke-linecap': 'round', 'data-x': x }, head));
      mk('circle', { cx: -38, cy: 26, r: 11, fill: '#ff8a80', opacity: 0.28 }, head);
      mk('circle', { cx: 38, cy: 26, r: 11, fill: '#ff8a80', opacity: 0.28 }, head);
      if (L.mustache) mk('path', { d: 'M-22,24 Q-10,16 0,22 Q10,16 22,24 Q10,30 0,26 Q-10,30 -22,24 Z', fill: hc }, head);
      this.mouth = mk('path', { fill: '#5a2a2a', stroke: '#5a2a2a', 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, head);
      this.tongue = mk('ellipse', { rx: 8, ry: 4, fill: '#ff8f8f' }, head);
      if (L.glasses) {
        mk('circle', { cx: -24, cy: 4, r: 17, fill: 'rgba(255,255,255,.18)', stroke: '#2a2a33', 'stroke-width': 4.5 }, head);
        mk('circle', { cx: 24, cy: 4, r: 17, fill: 'rgba(255,255,255,.18)', stroke: '#2a2a33', 'stroke-width': 4.5 }, head);
        mk('line', { x1: -7, y1: 4, x2: 7, y2: 4, stroke: '#2a2a33', 'stroke-width': 4 }, head);
      }
      const hat = L.hat;
      if (hat === 'straw') { mk('path', { d: `M${-R - 50},-26 L0,${-R - 64} L${R + 50},-26 Q0,-10 ${-R - 50},-26 Z`, fill: '#ecd08f', stroke: '#c9a45d', 'stroke-width': 3 }, head); mk('path', { d: `M-40,-38 L0,${-R - 50} L40,-38`, fill: 'none', stroke: '#c9a45d', 'stroke-width': 2.5 }, head); }
      if (hat === 'cap') { mk('path', { d: `M${-R + 2},-22 C${-R},${-R - 6} ${R},${-R - 6} ${R - 2},-22 Z`, fill: shade(L.shirt, -0.1) }, head); mk('path', { d: `M${R - 20},-26 Q${R + 34},-26 ${R + 40},-16 L${R - 14},-16 Z`, fill: shade(L.shirt, -0.25) }, head); }
      if (hat === 'hardhat') { mk('path', { d: `M${-R - 2},-24 C${-R},${-R - 22} ${R},${-R - 22} ${R + 2},-24 Z`, fill: '#ffc930' }, head); mk('rect', { x: -R - 14, y: -28, width: 2 * R + 28, height: 12, rx: 6, fill: '#f0b41c' }, head); }
      if (hat === 'crown') mk('path', { d: `M-40,${-R + 6} L-46,${-R - 40} L-22,${-R - 16} L0,${-R - 48} L22,${-R - 16} L46,${-R - 40} L40,${-R + 6} Z`, fill: '#ffcc3d', stroke: '#e0a81e', 'stroke-width': 3 }, head);
      if (hat === 'grad') { mk('path', { d: `M-80,${-R - 10} L0,${-R - 40} L80,${-R - 10} L0,${-R + 18} Z`, fill: '#2d2f3a' }, head); mk('rect', { x: -40, y: -R - 8, width: 80, height: 26, fill: '#2d2f3a' }, head); }
      if (L.outfit === 'astronaut') {
        // glass helmet: tinted visor over the face, white rim, specular highlight
        mk('circle', { cx: 0, cy: 2, r: R + 26, fill: 'rgba(150,200,255,.22)', stroke: '#f4f6fa', 'stroke-width': 14 }, head);
        mk('path', { d: `M${-R + 2},${-R + 18} A${R + 6},${R + 6} 0 0 1 ${R / 3},${-R - 12}`, fill: 'none', stroke: '#fff', 'stroke-width': 9, 'stroke-linecap': 'round', opacity: 0.7 }, head);
        mk('rect', { x: -R - 6, y: R + 10, width: 2 * R + 12, height: 22, rx: 10, fill: '#c3cad6' }, head);
      }
      this.render(0);
    }

    // ── timeline helpers ──
    get tl() { return this.world.tl; }
    T(at) { return this.world.clampT(at); }

    pose(name, at = 0, dur = 0.45) {
      const pz = POSES[name] || POSES.idle;
      this.tl.to(this.p, { ...pz, duration: dur, ease: 'back.out(1.4)' }, this.T(at));
      if (POSE_EMOTE[name]) this.emote(POSE_EMOTE[name], at);
      return this;
    }
    emote(name, at = 0) { this.tl.set(this.s, { emote: name }, this.T(at)); return this; }
    moveTo(x, at, dur = 1.2, o = {}) {
      const t0 = this.T(at), from = this._plannedX ?? this.p.x;
      const dir = x >= from ? 1 : -1;
      this.tl.to(this.p, { face: dir, duration: 0.18, ease: 'power1.inOut' }, t0);
      if (o.run) this.tl.to(this.p, { lean: 10 * dir, duration: 0.2 }, t0);
      this.tl.to(this.p, { walk: o.run ? 1.6 : 1, duration: 0.15 }, t0);
      this.tl.to(this.p, { x, duration: dur, ease: o.ease || 'none' }, t0);
      this.tl.to(this.p, { walk: 0, duration: 0.18 }, t0 + dur - 0.05);
      if (o.run) this.tl.to(this.p, { lean: 0, duration: 0.2 }, t0 + dur - 0.05);
      if (o.faceBack !== false && o.face != null) this.tl.to(this.p, { face: o.face, duration: 0.18 }, t0 + dur + 0.05);
      this._plannedX = x;
      return this;
    }
    walkTo(x, at, dur, o = {}) { return this.moveTo(x, at, dur ?? Math.max(0.6, Math.abs(x - (this._plannedX ?? this.p.x)) / 420), o); }
    runTo(x, at, dur, o = {}) { return this.moveTo(x, at, dur ?? Math.max(0.4, Math.abs(x - (this._plannedX ?? this.p.x)) / 900), { ...o, run: true }); }
    enter(side = 'left', at = 0, dur) {
      const target = this.p.x;
      this.p.x = side === 'left' ? -220 : W + 220;
      this._plannedX = this.p.x;
      this.render(0);
      return this.walkTo(target, at, dur, { face: side === 'left' ? 1 : -1 });
    }
    exit(side = 'right', at, dur) { return this.walkTo(side === 'left' ? -260 : W + 260, at, dur); }
    face(dir, at = 0) { this.tl.to(this.p, { face: dir === 'left' ? -1 : dir === 'right' ? 1 : dir, duration: 0.2 }, this.T(at)); return this; }
    lookAt(other, at = 0) { const x = typeof other === 'number' ? other : other._plannedX ?? other.p.x; return this.face(x >= (this._plannedX ?? this.p.x) ? 1 : -1, at); }
    jump(at, h = 80) {
      const t = this.T(at);
      this.tl.to(this.p, { squash: 1, duration: 0.1 }, t).to(this.p, { squash: 0, jump: h, duration: 0.25, ease: 'power2.out' }, t + 0.1)
        .to(this.p, { jump: 0, duration: 0.25, ease: 'power2.in' }, t + 0.35).to(this.p, { squash: 0.6, duration: 0.07 }, t + 0.6).to(this.p, { squash: 0, duration: 0.15 }, t + 0.67);
      return this;
    }
    nod(at) { const t = this.T(at); this.tl.to(this.p, { tilt: 12, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' }, t); return this; }
    shakeHead(at) { const t = this.T(at); this.tl.to(this.p, { lookX: 8, duration: 0.12, yoyo: true, repeat: 5, ease: 'sine.inOut' }, t).set(this.p, { lookX: 0 }, t + 0.75); return this; }
    /** Mouth moves while this character speaks (seconds from, to). */
    say(from, to) { this.talkRanges.push([this.T(from), this.T(to)]); return this; }
    /** Lip-sync to the narrator's words over [from, to] (defaults to whole scene). Use for the host character. */
    narrate(from = 0, to = 1e9) { this.talkRanges.push({ words: true, from, to }); return this; }
    /** Eyes look 'camera' | 'left' | 'right' | 'up' | 'down' | 'screen' (toward where the character faces). */
    gaze(dir = 'camera', at = 0) { this.tl.set(this.s, { look: dir }, this.T(at)); return this; }
    /**
     * Presenter mode: lip-sync + natural talking gestures chosen from the narration's rhythm
     * (a new gesture at pauses / every ~1.5–2.3 s, never the same twice in a row), eyebrow raises on stressed words,
     * small head tilts and glances. Explicit pose()/emote() calls made afterwards still win at their moments.
     */
    explain(from = 0, to = 1e9, o = {}) {
      this.narrate(from, to);
      const W = this.world.words || [];
      const t0 = this.T(from), t1 = Math.min(this.world.D - 0.4, to);
      const pool = o.gestures || ['explain', 'explain-both', 'present', 'open-arms', 'hand-chest', 'count', 'relax', 'explain-left', 'emphasis', 'chin', 'hands-hips', 'point', 'shrug', 'present-screen'];
      const beats = [];
      let last = t0 - 10;
      W.forEach((w, i) => {
        if (w.t < t0 || w.t > t1) return;
        const gap = i ? w.t - (W[i - 1].t + W[i - 1].d) : 1;
        if ((gap > 0.2 && w.t - last > 1.1) || w.t - last > 1.6 + this.rnd() * 0.8) { beats.push(w.t); last = w.t; }
      });
      let prev = null;
      beats.forEach(bt => {
        let g, guard = 0;
        do { g = pool[Math.floor(this.rnd() * pool.length)]; } while ((g === prev || (g === 'shrug' && this.rnd() < 0.6)) && guard++ < 8);
        prev = g;
        const pz = POSES[g] || POSES.explain;
        this.tl.to(this.p, { ...pz, tilt: (pz.tilt || 0) + (this.rnd() - 0.5) * 9, lean: (pz.lean || 0) + (this.rnd() - 0.5) * 4, duration: 0.38 + this.rnd() * 0.22, ease: 'power2.out' }, Math.max(0, bt - 0.12));
        if (o.lookScreen && this.rnd() < 0.35) { this.gaze('screen', bt); this.gaze('camera', bt + 0.9 + this.rnd() * 0.6); }
      });
      W.forEach(w => { if (w.t >= t0 && w.t <= t1 && w.d > 0.42 && this.rnd() < 0.55) this.tl.to(this.p, { brow: 5, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, w.t); });
      if (beats.length) this.tl.to(this.p, { ...POSES.relax, duration: 0.5, ease: 'power2.inOut' }, Math.min(this.world.D - 0.5, (W.filter(w => w.t <= t1).pop()?.t ?? t1) + 0.5));
      return this;
    }
    hold(name, at = 0, o = {}) {
      const hand = o.hand === 'L' ? this.armL : this.armR;
      const size = o.size || 96;
      hand.prop.innerHTML = artMarkup(name, size, -size * 0.22);
      this.tl.fromTo(hand.prop, { opacity: 0 }, { opacity: 1, duration: 0.2 }, this.T(at));
      if (o.pose !== false) this.pose(o.hand === 'L' ? 'hold-both' : 'hold', at, 0.35);
      this._held = { name, size, hand: o.hand === 'L' ? 'L' : 'R' };
      return this;
    }
    drop(at = 0) { this.tl.to([this.armL.prop, this.armR.prop], { opacity: 0, duration: 0.2 }, this.T(at)); return this.pose('idle', at); }
    /** Hand the held prop to another character: it flies from this hand to theirs. */
    give(other, at = 0, dur = 0.8) {
      const held = this._held || { name: 'money-bag', size: 96, hand: 'R' };
      const t = this.T(at);
      this.lookAt(other, t);
      other.lookAt(this, t);
      this.pose('give', t, 0.35);
      other.pose('receive', t + 0.1, 0.35);
      const fly = this.world.flyingProp(held.name, held.size);
      this.tl.set(this.armR.prop, { opacity: 0 }, t + 0.3).set(this.armL.prop, { opacity: 0 }, t + 0.3);
      this.world.frameFns.push(tt => {
        const k = Math.max(0, Math.min(1, (tt - t - 0.3) / dur));
        const on = tt >= t + 0.3 && tt < t + 0.3 + dur;
        fly.setAttribute('opacity', on ? 1 : 0);
        if (!on) return;
        const a = this.handWorld('R'), b = other.handWorld('R');
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e - Math.sin(Math.PI * k) * 120;
        fly.setAttribute('transform', `translate(${x},${y})`);
      });
      other.hold(held.name, t + 0.3 + dur, { size: held.size, pose: false });
      other.pose('hold', t + 0.3 + dur, 0.3);
      this.pose('idle', t + 0.4 + dur, 0.4);
      return this;
    }
    fadeIn(at = 0, dur = 0.4) { this.tl.fromTo(this.p, { opacity: 0 }, { opacity: 1, duration: dur }, this.T(at)); return this; }
    fadeOut(at, dur = 0.4) { this.tl.to(this.p, { opacity: 0, duration: dur }, this.T(at)); return this; }
    popIn(at = 0) { this.tl.fromTo(this.p, { opacity: 0, squash: -0.6, jump: 40 }, { opacity: 1, squash: 0, jump: 0, duration: 0.5, ease: 'back.out(2)' }, this.T(at)); return this; }
    /** Zero-gravity drift (space, water): limbs loosen, the body bobs and slowly turns; spin = degrees per second. */
    float(from = 0, to = 1e9, o = {}) { this.floatRanges.push({ from: this.T(from), to, spin: o.spin || 0, amp: o.amp ?? 14 }); return this; }
    /** Fall / sink by dy px while tumbling `spin` degrees (falling into a hole, off a cliff, toward a black hole). */
    fall(at, dur = 1.6, o = {}) { this.tl.to(this.p, { dy: o.dy ?? 700, rot: o.spin ?? 160, duration: dur, ease: o.ease || 'power2.in' }, this.T(at)); return this; }
    /** Stretch the whole body (sy > 1 taller/thinner, < 1 squashed) — e.g. spaghettification near a black hole. */
    stretch(sy = 2, at = 0, dur = 1.2, sx) { this.tl.to(this.p, { sy, sx: sx ?? 1 / Math.sqrt(sy), duration: dur, ease: 'power2.in' }, this.T(at)); return this; }
    rotateTo(deg, at = 0, dur = 0.8) { this.tl.to(this.p, { rot: deg, duration: dur, ease: 'power2.inOut' }, this.T(at)); return this; }
    moveY(dy, at = 0, dur = 1) { this.tl.to(this.p, { dy, duration: dur, ease: 'power2.inOut' }, this.T(at)); return this; }
    /** Repeated activity between from..to: 'hammer' | 'type' | 'dig' | 'carry' | 'wave' | 'cheer' | 'count' | 'plant'. */
    work(kind = 'type', from = 0, to = 1e9) { this.workRanges.push({ kind, from: this.T(from), to }); return this; }
    lookUp(at = 0) { this.gaze('up', at); this.tl.to(this.p, { tilt: -14, duration: 0.4 }, this.T(at)); return this; }
    /** Sit down (a stool appears under them unless chair: false — e.g. on a sofa/bench of the set). */
    sit(at = 0, o = {}) {
      if (o.chair !== false && !this.seat) {
        const c = o.color || '#7d5a37';
        this.seat = mk('g', { class: 'k-seat', opacity: 0 }, this.root);
        this.root.insertBefore(this.seat, this.shadow.nextSibling);
        this.seat.innerHTML = `<rect x="-62" y="${HIP_Y + 16}" width="124" height="20" rx="8" fill="${shade(c, 0.15)}"/><rect x="-52" y="${HIP_Y + 34}" width="14" height="${-SEAT_DROP - HIP_Y - 34}" fill="${c}"/><rect x="38" y="${HIP_Y + 34}" width="14" height="${-SEAT_DROP - HIP_Y - 34}" fill="${c}"/><rect x="-46" y="${(HIP_Y + 34 - SEAT_DROP) / 2}" width="92" height="8" fill="${shade(c, -0.2)}"/>`;
      }
      this.tl.to(this.p, { sit: 1, duration: o.dur ?? 0.5, ease: 'power2.inOut' }, this.T(at));
      return this;
    }
    stand(at = 0) { this.tl.to(this.p, { sit: 0, duration: 0.45, ease: 'power2.inOut' }, this.T(at)); return this; }
    /**
     * Work at a desk/counter facing the camera (office worker, bank teller, shopkeeper, student): a desk appears in front
     * of the character, hiding the legs, with item on it ('laptop' | 'monitor' | 'papers' | any object name | null),
     * and they work ('type' by default). Follows the character if they move.
     */
    atDesk(from = 0, to = 1e9, o = {}) {
      const t0 = this.T(from), t1 = to >= 1e8 ? 1e9 : this.T(to);
      const g = mk('g', { class: 'k-desk', opacity: 0 }, this.root.parentNode);
      const wood = o.color || '#a97a4c', top = shade(wood, 0.15), dark = shade(wood, -0.28);
      const item = o.item === undefined ? 'laptop' : o.item;
      const ITEM = {
        laptop: `<rect x="-86" y="-330" width="172" height="94" rx="9" fill="#c9ced8"/><rect x="-86" y="-330" width="172" height="94" rx="9" fill="none" stroke="#aab2c3" stroke-width="4"/><circle cx="0" cy="-283" r="12" fill="#eef1f5"/><rect x="-104" y="-240" width="208" height="10" rx="4" fill="#aab2c3"/>`,
        monitor: `<rect x="20" y="-404" width="220" height="140" rx="10" fill="#3b4250"/><rect x="116" y="-266" width="28" height="28" fill="#3b4250"/><rect x="86" y="-242" width="88" height="8" rx="3" fill="#2c3240"/>`,
        papers: `<g transform="rotate(-4)"><rect x="-80" y="-262" width="120" height="22" rx="3" fill="#f4f1ea"/><rect x="-76" y="-282" width="120" height="22" rx="3" fill="#ffffff"/><rect x="-72" y="-300" width="120" height="20" rx="3" fill="#f4f1ea"/></g><rect x="70" y="-290" width="10" height="52" rx="4" fill="#3b7cf6" transform="rotate(20 75 -264)"/>`,
      };
      const itemSvg = !item ? '' : ITEM[item] || artMarkup(item, o.itemSize || 120, -236 - (o.itemSize || 120) * 0.47);
      g.innerHTML = `<rect x="-210" y="-250" width="420" height="24" rx="8" fill="${top}"/><rect x="-196" y="-228" width="392" height="200" rx="6" fill="${wood}"/><rect x="-196" y="-228" width="392" height="14" fill="${dark}" opacity=".45"/><rect x="-150" y="-180" width="300" height="10" rx="5" fill="${dark}" opacity=".25"/><rect x="-180" y="-30" width="26" height="30" fill="${dark}"/><rect x="154" y="-30" width="26" height="30" fill="${dark}"/>${itemSvg}`;
      this.deskRanges.push([t0, t1]);
      this.world.frameFns.push(t => {
        const on = t >= t0 && t <= t1;
        g.setAttribute('opacity', on ? 1 : 0);
        if (on) g.setAttribute('transform', `translate(${this.p.x},${this.base.groundY + this.p.dy}) scale(${this.base.scale})`);
      });
      if (o.work !== false) this.work(o.work || 'type', from, to);
      return this;
    }

    handWorld(side) {
      const h = (side === 'L' ? this.armL : this.armR).hand;
      const m = h.getScreenCTM(), a = this.world.actors.getScreenCTM();
      if (!m || !a) return { x: this.p.x, y: this.base.groundY - 250 };
      const pt = new DOMPoint(0, 0).matrixTransform(a.inverse().multiply(m));
      return { x: pt.x, y: pt.y };
    }

    // ── per-frame render ──
    render(t) {
      const p = this.p, L = this.look, s = this.base.scale;
      const fl = this.floatRanges.find(r => t >= r.from && t <= r.to);
      const wk = this.workRanges.find(r => t >= r.from && t <= r.to);
      const walkPh = t * 9.5 * Math.max(1, p.walk);
      const walkAmt = fl ? 0 : Math.min(1, p.walk);
      const bob = walkAmt * Math.abs(Math.sin(walkPh)) * 8 + Math.sin(t * 2.1 + this.base.groundY) * 1.6 + (wk?.kind === 'carry' ? Math.abs(Math.sin(t * 6)) * 5 : 0);
      const swing = Math.sin(walkPh) * 30 * walkAmt;
      const sq = p.squash;
      const sway = (1 - walkAmt) * Math.sin(t * 0.8 + this.base.groundY * 0.01 + p.x * 0.003) * 3.5;
      const fdy = fl ? Math.sin(t * 0.9 + p.x * 0.01) * fl.amp : 0;
      const frot = fl ? Math.sin(t * 0.45 + 1) * 7 + fl.spin * (t - fl.from) : 0;
      const rot = p.rot + frot, cy = -250 * s;
      this.root.setAttribute('transform', `translate(${p.x + sway},${this.base.groundY - p.jump + p.dy + fdy + p.sit * SEAT_DROP * s})${rot ? ` translate(0,${cy}) rotate(${rot}) translate(0,${-cy})` : ''} scale(${s * p.face * (1 + sq * 0.12) * p.sx},${s * (1 - sq * 0.12) * p.sy})`);
      this.root.setAttribute('opacity', p.opacity);
      this.shadow.setAttribute('opacity', fl || Math.abs(p.dy) > 20 || rot ? 0 : 1);
      this.shadow.setAttribute('rx', 78 * (1 - Math.min(0.5, p.jump / 300)));
      this.shadow.setAttribute('transform', `translate(0,${p.jump / s - p.sit * SEAT_DROP})`);
      if (this.seat) this.seat.setAttribute('opacity', p.sit > 0.6 ? 1 : 0);
      // legs
      const leg = (lg, side, th, kn) => {
        const hx = side * 24, hy = HIP_Y - bob;
        const kx = hx + Math.sin(rad(th)) * THIGH, ky = hy + Math.cos(rad(th)) * THIGH;
        const fa = th - kn;
        const fx = kx + Math.sin(rad(fa)) * SHIN, fy = Math.min(-8, ky + Math.cos(rad(fa)) * SHIN);
        lg.thigh.setAttribute('x1', hx); lg.thigh.setAttribute('y1', hy); lg.thigh.setAttribute('x2', kx); lg.thigh.setAttribute('y2', ky);
        lg.shin.setAttribute('x1', kx); lg.shin.setAttribute('y1', ky); lg.shin.setAttribute('x2', fx); lg.shin.setAttribute('y2', fy);
        lg.shoe.setAttribute('cx', fx + 10); lg.shoe.setAttribute('cy', fy + 4);
      };
      const knee = walkAmt * 14;
      const fL = fl ? -14 + Math.sin(t * 0.7) * 7 : 0, fR = fl ? 12 + Math.sin(t * 0.6 + 2) * 7 : 0;
      const sk = p.sit;   // sitting: thighs forward, shins down
      leg(this.legL, -1, (p.lL + swing + fL) * (1 - sk) + 84 * sk, (p.kL + (swing > 0 ? knee : 0) + (fl ? 26 : 0)) * (1 - sk) + 84 * sk);
      leg(this.legR, 1, (p.lR - swing + fR) * (1 - sk) + 80 * sk, (p.kR + (swing < 0 ? knee : 0) + (fl ? 34 : 0)) * (1 - sk) + 80 * sk);
      // body
      const breathe = Math.sin(t * 2.2 + this.base.groundY) * 0.012;
      const lean = p.lean + (wk && (wk.kind === 'dig' || wk.kind === 'plant') ? 14 + Math.sin(t * 4) * 6 : 0);
      this.body.setAttribute('transform', `translate(0,${-bob}) rotate(${lean} 0 ${HIP_Y}) translate(0,${HIP_Y}) scale(1,${1 + breathe}) translate(0,${-HIP_Y})`);
      const arm = (a, side, up, fo) => {
        const sx = side * 58, sy = NECK_Y + 14;
        const ex = sx + side * Math.sin(rad(up)) * UPPER, ey = sy + Math.cos(rad(up)) * UPPER;
        const hx = ex + side * Math.sin(rad(fo)) * LOWER, hy = ey + Math.cos(rad(fo)) * LOWER;
        a.up.setAttribute('x1', sx); a.up.setAttribute('y1', sy); a.up.setAttribute('x2', ex); a.up.setAttribute('y2', ey);
        a.fore.setAttribute('x1', ex); a.fore.setAttribute('y1', ey); a.fore.setAttribute('x2', hx); a.fore.setAttribute('y2', hy);
        a.hand.setAttribute('cx', hx); a.hand.setAttribute('cy', hy);
        a.prop.setAttribute('transform', `translate(${hx},${hy})`);
      };
      const armSwing = -swing * 0.8;
      let aLu = p.aLu + (walkAmt ? armSwing : 0), aLf = p.aLf + (walkAmt ? armSwing * 0.6 : 0);
      let aRu = p.aRu - (walkAmt ? armSwing : 0), aRf = p.aRf - (walkAmt ? armSwing * 0.6 : 0);
      if (fl) { aLu += 42 + Math.sin(t * 0.8) * 10; aLf += 30; aRu += 48 + Math.sin(t * 0.7 + 1) * 10; aRf += 26; }
      if (wk) {
        const k = wk.kind, f = t * 1.0;
        if (k === 'hammer') { aRu = 125 + Math.sin(f * 9) * 45; aRf = 70 + Math.sin(f * 9) * 35; }
        else if (k === 'type' && this.deskRanges.some(r => t >= r[0] && t <= r[1])) { aLu = 22; aRu = 22; aLf = -92 + Math.sin(f * 14) * 8; aRf = -92 + Math.sin(f * 13 + 1) * 8; }
        else if (k === 'type') { aLu = 34; aRu = 34; aLf = 80 + Math.sin(f * 14) * 9; aRf = 80 + Math.sin(f * 13 + 1) * 9; }
        else if (k === 'dig' || k === 'plant') { aLu = 70 + Math.sin(f * 4) * 25; aLf = 40; aRu = 60 + Math.sin(f * 4) * 25; aRf = 50; }
        else if (k === 'carry') { aLu = 34; aLf = 84; aRu = 34; aRf = 84; }
        else if (k === 'wave') { aRu = 140; aRf = 170 + Math.sin(f * 8) * 18; }
        else if (k === 'cheer') { aLu = 150 + Math.sin(f * 7) * 10; aLf = 165; aRu = 150 + Math.sin(f * 7 + 1) * 10; aRf = 165; }
        else if (k === 'count') { aRu = 70; aRf = 150 + Math.sin(f * 5) * 12; }
      }
      arm(this.armL, -1, aLu, aLf);
      arm(this.armR, 1, aRu, aRf);
      // head
      const nod = Math.sin(t * 1.7 + this.base.groundY * 0.3) * 1.5;
      this.head.setAttribute('transform', `translate(${p.lookX},${NECK_Y - HEAD_R + 12}) rotate(${p.tilt + nod})`);
      // face
      const em = this.s.emote;
      const blink = this.blinkAt.some(b => t >= b && t < b + 0.13);
      const arcEyes = em === 'happy' || em === 'laugh' || em === 'proud';
      const wide = em === 'surprised' || em === 'excited' || em === 'shock';
      const LOOK = { camera: [0, 0], left: [-4.5, 0], right: [4.5, 0], up: [0, -4], down: [0, 3.5], screen: [4.5, -1.5] };
      const lk = LOOK[this.s.look] || [0, 0];
      const lx = lk[0] * (this.s.look === 'left' || this.s.look === 'right' || this.s.look === 'screen' ? p.face : 1), ly = lk[1];
      this.eyes.forEach((e, i) => {
        const small = em === 'shock';
        e.ball.setAttribute('ry', blink || em === 'sleepy' ? 1.5 : small ? 6 : wide ? 12.5 : em === 'determined' ? 7.5 : 10);
        e.ball.setAttribute('rx', small ? 6 : wide ? 9 : 7.5);
        e.ball.setAttribute('cx', lx); e.ball.setAttribute('cy', ly);
        e.glint.setAttribute('cx', 2.5 + lx); e.glint.setAttribute('cy', -3.5 + ly);
        e.ball.setAttribute('opacity', arcEyes ? 0 : 1);
        e.glint.setAttribute('opacity', arcEyes || blink ? 0 : 1);
        e.arc.setAttribute('opacity', arcEyes ? 1 : 0);
      });
      // brows: [raise, slant] per eye; slant > 0 = inner ends up (sad), < 0 = inner ends down (angry)
      const BROW = {
        neutral: [[0, 0], [0, 0]], happy: [[-4, 0], [-4, 0]], laugh: [[-6, 0], [-6, 0]], proud: [[-2, -4], [-2, -4]], excited: [[-12, 2], [-12, 2]],
        sad: [[0, 14], [0, 14]], worried: [[-2, 16], [-2, 16]], angry: [[4, -16], [4, -16]], surprised: [[-12, 0], [-12, 0]], shock: [[-14, 4], [-14, 4]],
        thinking: [[-6, 10], [2, -4]], skeptical: [[4, -6], [-12, 2]], confused: [[-8, 10], [2, -6]], determined: [[3, -10], [3, -10]],
      }[em] || [[0, 0], [0, 0]];
      const raise = p.brow || 0;
      this.brows.forEach((b, i) => {
        const x = +b.getAttribute('data-x'), sgn = i === 0 ? -1 : 1, [r, sl] = BROW[i];
        const y = -22 + r - raise;
        b.setAttribute('x1', x - sgn * 11); b.setAttribute('y1', y - sl * 0.5);
        b.setAttribute('x2', x + sgn * 11); b.setAttribute('y2', y + sl * 0.25);
      });
      // mouth: talking beats emotion
      let open = 0;
      for (const r of this.talkRanges) {
        if (Array.isArray(r)) { if (t >= r[0] && t <= r[1]) open = Math.max(open, 0.25 + 0.75 * Math.abs(Math.sin(t * 13) * Math.cos(t * 5.3))); }
        else if (t >= r.from && t <= r.to) {
          const w = this.world.words.find(w => t >= w.t && t < w.t + w.d);
          if (w) { const k = (t - w.t) / Math.max(0.05, w.d); open = Math.max(open, 0.2 + 0.8 * Math.sin(Math.PI * Math.min(1, k * 1.15))); }
        }
      }
      let d, fill = 'none', tongue = 0;
      const smiley = ['happy', 'laugh', 'excited', 'proud', 'neutral', 'determined'].includes(em);
      if (open > 0.08) {
        const ry = 3 + 13 * open, wdt = smiley ? 15 : 12;
        d = smiley ? `M-${wdt},24 Q0,${22 - ry * 0.2} ${wdt},24 Q0,${26 + ry * 1.7} -${wdt},24 Z` : `M-${wdt},26 Q0,${26 - ry * 0.35} ${wdt},26 Q0,${26 + ry * 1.6} -${wdt},26 Z`;
        fill = '#5a2a2a'; tongue = open > 0.4 ? 1 : 0;
      }
      else if (em === 'happy' || em === 'excited') { d = em === 'excited' ? 'M-22,18 Q0,52 22,18 Z' : 'M-18,20 Q0,46 18,20 Z'; fill = '#5a2a2a'; tongue = 1; }
      else if (em === 'laugh') { d = 'M-20,16 Q0,58 20,16 Z'; fill = '#5a2a2a'; tongue = 1; }
      else if (em === 'proud') d = 'M-17,22 Q0,38 17,20';
      else if (em === 'sad' || em === 'worried') d = 'M-13,32 Q0,20 13,32';
      else if (em === 'surprised') { d = 'M-9,28 Q0,14 9,28 Q0,44 -9,28 Z'; fill = '#5a2a2a'; }
      else if (em === 'shock') { d = 'M-12,26 Q0,8 12,26 Q0,50 -12,26 Z'; fill = '#5a2a2a'; }
      else if (em === 'angry') d = 'M-14,30 Q0,24 14,30';
      else if (em === 'thinking') d = 'M-10,28 Q4,24 14,22';
      else if (em === 'skeptical') d = 'M-14,28 L6,28 Q12,27 15,23';
      else if (em === 'confused') d = 'M-15,28 q7,-7 14,0 t14,0';
      else if (em === 'determined') d = 'M-15,25 Q0,32 15,25';
      else d = 'M-15,22 Q0,36 15,22';
      this.mouth.setAttribute('d', d);
      this.mouth.setAttribute('fill', fill);
      this.tongue.setAttribute('opacity', tongue);
      this.tongue.setAttribute('cx', 0); this.tongue.setAttribute('cy', (em === 'happy' || em === 'excited' || em === 'laugh') && open <= 0.08 ? 34 : 26 + (3 + 13 * open) * 1.1);
    }
  }

  // ───────────────────────── settings ─────────────────────────
  const SKY = {
    day: ['#8fd0ff', '#dff3ff', '#ffd45c'],
    sunset: ['#ff9468', '#ffd9a1', '#ff7043'],
    night: ['#1a2250', '#3b4b8a', '#f4f1d0'],
  };
  const P = {
    grass: '#8cc972', grass2: '#6fb35a', grassDark: '#4f9447', soil: '#b98a5b', path: '#e7d3a8',
    road: '#5b6070', walk: '#d7d4da', curb: '#b9b5bf',
    wall: '#f6ecd9', wall2: '#eadcc3', floor: '#c99a68', floorDark: '#b1834f', wood: '#a8733f',
    bld: ['#f2a65a', '#e8746a', '#6b9be8', '#f5cf5e', '#7dc6a4', '#b392e0', '#f08fb1'],
  };

  function cloud(x, y, s, fill = '#fff', cls = 'k-cloud') {
    return `<g class="${cls}" transform="translate(${x},${y}) scale(${s})"><ellipse cx="0" cy="0" rx="70" ry="34" fill="${fill}"/><circle cx="-30" cy="-18" r="34" fill="${fill}"/><circle cx="18" cy="-30" r="42" fill="${fill}"/><circle cx="52" cy="-8" r="28" fill="${fill}"/></g>`;
  }
  function tree(x, y, s = 1, c = P.grass2) {
    return `<g transform="translate(${x},${y}) scale(${s})"><rect x="-12" y="-120" width="24" height="120" rx="8" fill="#8b5a33"/><circle cx="0" cy="-160" r="70" fill="${c}"/><circle cx="-46" cy="-126" r="46" fill="${c}"/><circle cx="48" cy="-124" r="48" fill="${c}"/><circle cx="-18" cy="-190" r="30" fill="${shade(c, 0.12)}" opacity=".7"/></g>`;
  }
  function building(x, y, w, h, c, rnd, night, roof = 'flat') {
    let s = `<g transform="translate(${x},${y})"><rect x="0" y="${-h}" width="${w}" height="${h}" fill="${c}"/>`;
    if (roof === 'tri') s += `<path d="M-10,${-h} L${w / 2},${-h - w * 0.4} L${w + 10},${-h} Z" fill="${shade(c, -0.25)}"/>`;
    else s += `<rect x="-6" y="${-h - 10}" width="${w + 12}" height="14" fill="${shade(c, -0.2)}"/>`;
    const cols = Math.max(2, Math.floor(w / 46)), rows = Math.max(2, Math.floor((h - 40) / 60));
    const gw = (w - 24) / cols;
    for (let r = 0; r < rows; r++) for (let c2 = 0; c2 < cols; c2++) {
      const lit = night ? rnd() < 0.55 : false;
      s += `<rect x="${14 + c2 * gw}" y="${-h + 22 + r * 60}" width="${gw - 16}" height="34" rx="4" fill="${lit ? '#ffe28a' : night ? shade(c, -0.45) : '#dff1ff'}" opacity="${night ? 1 : 0.85}"/>`;
    }
    return s + `</g>`;
  }
  function skyGrad(id, time) {
    const [a, b] = SKY[time] || SKY.day;
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  }
  function sunMoon(x, y, time) {
    if (time === 'night') return `<g class="k-sun"><circle cx="${x}" cy="${y}" r="56" fill="#f6f1cf"/><circle cx="${x + 22}" cy="${y - 12}" r="48" fill="${SKY.night[0]}" opacity=".0"/><circle cx="${x - 18}" cy="${y + 10}" r="10" fill="#e3ddb5"/></g>`;
    const c = (SKY[time] || SKY.day)[2];
    return `<g class="k-sun"><circle cx="${x}" cy="${y}" r="110" fill="${c}" opacity=".25"/><circle cx="${x}" cy="${y}" r="68" fill="${c}"/></g>`;
  }
  function stars(rnd, n = 70) { let s = ''; for (let i = 0; i < n; i++) s += `<circle class="k-star" cx="${rnd() * 2400 - 240}" cy="${rnd() * 620}" r="${1 + rnd() * 2.6}" fill="#fff" opacity="${0.4 + rnd() * 0.6}"/>`; return s; }

  // Each setting: layers [{depth, svg}] in a 2400-wide world (x from -240), ground y, optional HTML screen rect.
  const SETTINGS = {
    city(o, rnd) {
      const night = o.time === 'night';
      let far = '', mid = '';
      for (let x = -240; x < 2200; x += 90 + rnd() * 60) far += `<rect x="${x}" y="${420 - rnd() * 220}" width="${80 + rnd() * 70}" height="600" fill="${night ? '#2c3668' : '#b9c9e6'}"/>`;
      for (let x = -220, i = 0; x < 2180; i++) { const w = 170 + rnd() * 110, h = 300 + rnd() * 260; mid += building(x, 790, w, h, P.bld[i % P.bld.length], rnd, night, rnd() < 0.2 ? 'tri' : 'flat'); x += w + 18 + rnd() * 30; }
      let near = '';
      for (let x = -160; x < 2200; x += 520) near += tree(x + 120, 800, 0.8) + `<g transform="translate(${x + 380},800)"><rect x="-6" y="-230" width="12" height="230" fill="#5b5f6e"/><rect x="-6" y="-236" width="60" height="10" rx="5" fill="#5b5f6e"/><ellipse cx="50" cy="-222" rx="18" ry="9" fill="${night ? '#ffe38a' : '#f0f0f0'}"/></g>`;
      return {
        ground: 880,
        layers: [
          { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#sky)"/>${night ? stars(rnd) : ''}${sunMoon(1560, 190, o.time)}${night ? '' : cloud(300, 180, 1) + cloud(1200, 130, 0.8) + cloud(1800, 230, 0.7)}` },
          { depth: 0.2, svg: far },
          { depth: 0.5, svg: mid },
          { depth: 0.85, svg: `<rect x="-240" y="790" width="2400" height="40" fill="${P.curb}"/><rect x="-240" y="828" width="2400" height="260" fill="${P.walk}"/>${near}<rect x="-240" y="1010" width="2400" height="80" fill="${P.road}"/>` },
        ],
      };
    },
    countryside(o, rnd) {
      const night = o.time === 'night';
      let field = '';
      for (let i = 0; i < 7; i++) field += `<path d="M-240,${780 + i * 14} Q960,${740 + i * 18} 2160,${790 + i * 14}" fill="none" stroke="${P.grass2}" stroke-width="5" opacity=".5"/>`;
      let near = tree(160, 860, 1.1) + tree(1720, 870, 1.25, P.grassDark);
      near += `<g transform="translate(1320,830)"><rect x="0" y="-150" width="220" height="150" fill="#f3e1c0"/><path d="M-24,-150 L110,-250 L244,-150 Z" fill="#c75d43"/><rect x="86" y="-86" width="50" height="86" fill="#8b5a33"/><rect x="24" y="-120" width="44" height="40" fill="#bfe6ff" stroke="#fff" stroke-width="6"/><rect x="156" y="-120" width="44" height="40" fill="#bfe6ff" stroke="#fff" stroke-width="6"/></g>`;
      for (let x = -200; x < 1100; x += 60) near += `<rect x="${x}" y="835" width="10" height="60" fill="#d8b07a"/>`;
      near += `<rect x="-200" y="848" width="1300" height="9" fill="#d8b07a"/><rect x="-200" y="872" width="1300" height="9" fill="#d8b07a"/>`;
      return {
        ground: 900,
        layers: [
          { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#sky)"/>${night ? stars(rnd) : ''}${sunMoon(420, 200, o.time)}${night ? '' : cloud(900, 170, 1) + cloud(1650, 240, 0.8)}` },
          { depth: 0.18, svg: `<ellipse cx="300" cy="820" rx="760" ry="300" fill="${night ? '#35507a' : '#a9d6a0'}"/><ellipse cx="1500" cy="840" rx="900" ry="330" fill="${night ? '#2f4a70' : '#9bcf8f'}"/>` },
          { depth: 0.45, svg: `<ellipse cx="960" cy="1010" rx="1500" ry="300" fill="${night ? '#3f6a55' : P.grass}"/>${field}` },
          { depth: 0.85, svg: `<rect x="-240" y="880" width="2400" height="200" fill="${night ? '#355a45' : P.grass2}"/><path d="M700,1080 Q900,930 1100,880 L1180,880 Q1060,960 1000,1080 Z" fill="${P.path}"/>${near}` },
        ],
      };
    },
    ricefield(o, rnd) {
      let paddies = '';
      for (let i = 0; i < 5; i++) {
        const y = 700 + i * 70;
        paddies += `<path d="M-240,${y} Q960,${y - 30 + i * 6} 2160,${y}" fill="none" stroke="#5c9a45" stroke-width="10"/><path d="M-240,${y + 8} Q960,${y - 22 + i * 6} 2160,${y + 8} L2160,${y + 64} Q960,${y + 40} -240,${y + 64} Z" fill="${i % 2 ? '#a6d37b' : '#bfe08d'}"/>`;
        for (let x = -200; x < 2160; x += 38 + rnd() * 20) paddies += `<path d="M${x},${y + 40} l-6,-26 M${x},${y + 40} l0,-30 M${x},${y + 40} l7,-24" stroke="#4f8f3a" stroke-width="3" stroke-linecap="round"/>`;
      }
      let bamboo = '';
      for (let x = -200; x < 2200; x += 260 + rnd() * 200) bamboo += `<g transform="translate(${x},700)"><rect x="-6" y="-300" width="12" height="300" fill="#6e9b3e"/><rect x="14" y="-260" width="10" height="260" fill="#7aa847"/><ellipse cx="0" cy="-300" rx="70" ry="40" fill="#5f9a3a"/><ellipse cx="30" cy="-250" rx="60" ry="30" fill="#6caa44"/></g>`;
      return {
        ground: 920,
        layers: [
          { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#sky)"/>${sunMoon(1500, 190, o.time)}${cloud(500, 160, 1) + cloud(1100, 230, 0.7)}` },
          { depth: 0.2, svg: `<path d="M-240,640 L200,420 L520,600 L900,380 L1350,620 L1700,450 L2160,640 L2160,760 L-240,760 Z" fill="#8fb3a3"/>` },
          { depth: 0.4, svg: bamboo },
          { depth: 0.8, svg: `${paddies}<rect x="-240" y="900" width="2400" height="180" fill="#c7a36a"/>` },
        ],
      };
    },
    office(o, rnd) {
      let skyline = '';
      for (let x = 0; x < 900; x += 70 + rnd() * 30) skyline += `<rect x="${x}" y="${120 + rnd() * 140}" width="${60 + rnd() * 30}" height="400" fill="#aebfdc"/>`;
      return {
        ground: 900,
        screen: { x: 1080, y: 150, w: 640, h: 400, kind: 'whiteboard' },
        layers: [
          { depth: 0.1, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="${P.wall}"/><clipPath id="officeWin"><rect x="160" y="140" width="700" height="440" rx="10"/></clipPath><g clip-path="url(#officeWin)"><g transform="translate(160,140)"><rect width="700" height="440" rx="10" fill="url(#sky)"/>${skyline}</g></g><g transform="translate(160,140)"><rect width="700" height="440" rx="10" fill="none" stroke="#fff" stroke-width="20"/><rect x="340" y="0" width="20" height="440" fill="#fff"/></g><rect x="1060" y="130" width="680" height="440" rx="16" fill="#8a8f9c"/><rect x="1080" y="150" width="640" height="400" rx="8" fill="#ffffff"/><rect x="1260" y="570" width="280" height="14" rx="7" fill="#b0b4bf"/>` },
          { depth: 0.9, svg: `<rect x="-240" y="760" width="2400" height="30" fill="${P.wall2}"/><rect x="-240" y="790" width="2400" height="300" fill="${P.floor}"/>${[0, 1, 2, 3, 4, 5, 6].map(i => `<line x1="${-240 + i * 400}" y1="790" x2="${-420 + i * 440}" y2="1080" stroke="${P.floorDark}" stroke-width="3"/>`).join('')}<g transform="translate(150,780)"><rect x="-40" y="-110" width="80" height="110" rx="12" fill="#d77a52"/><circle cx="0" cy="-160" r="60" fill="#5daa58"/><circle cx="-44" cy="-130" r="36" fill="#4d9a4a"/><circle cx="44" cy="-126" r="38" fill="#63b35e"/></g>` },
        ],
      };
    },
    classroom(o, rnd) {
      return {
        ground: 900,
        screen: { x: 420, y: 150, w: 1080, h: 460, kind: 'chalkboard' },
        layers: [
          { depth: 0.1, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="#e7efe1"/><rect x="390" y="120" width="1140" height="520" rx="14" fill="#9b6b3f"/><rect x="420" y="150" width="1080" height="460" rx="6" fill="#2f5d4a"/><rect x="560" y="640" width="800" height="16" rx="6" fill="#8a5c33"/><rect x="600" y="628" width="60" height="12" rx="3" fill="#fff"/><g transform="translate(1720,190)"><circle r="62" fill="#fff" stroke="#6d5a4a" stroke-width="10"/><line x1="0" y1="0" x2="0" y2="-40" stroke="#333" stroke-width="7" stroke-linecap="round"/><line x1="0" y1="0" x2="28" y2="12" stroke="#333" stroke-width="7" stroke-linecap="round"/></g><g transform="translate(40,300)"><rect width="220" height="420" rx="8" fill="#a97a4c"/>${[0, 1, 2, 3].map(r => `<rect x="14" y="${16 + r * 100}" width="192" height="12" fill="#8a5c33"/>` + [0, 1, 2, 3, 4].map(b => `<rect x="${22 + b * 36}" y="${40 + r * 100}" width="26" height="${56 - (b % 2) * 12}" y2="0" fill="${P.bld[(r + b) % 7]}"/>`).join('')).join('')}</g>` },
          { depth: 0.9, svg: `<rect x="-240" y="780" width="2400" height="300" fill="#d7a871"/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<line x1="-240" y1="${800 + i * 36}" x2="2160" y2="${800 + i * 36}" stroke="#c6955f" stroke-width="3"/>`).join('')}` },
        ],
      };
    },
    bank(o, rnd) {
      let cols = '';
      for (let i = 0; i < 6; i++) { const x = -120 + i * 420; cols += `<g transform="translate(${x},0)"><rect x="-10" y="120" width="120" height="40" fill="#e9dcc2"/><rect x="0" y="160" width="100" height="600" fill="#f3eadb"/>${[0, 1, 2, 3].map(k => `<rect x="${12 + k * 22}" y="170" width="10" height="580" fill="#e2d6bf"/>`).join('')}<rect x="-10" y="740" width="120" height="30" fill="#e9dcc2"/></g>`; }
      return {
        ground: 900,
        layers: [
          { depth: 0.1, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="#e8dcc6"/><rect x="-240" y="0" width="2400" height="120" fill="#d7c7a8"/><g transform="translate(1540,300)"><circle r="190" fill="#9aa3b5"/><circle r="160" fill="#c3cad8" stroke="#8b93a6" stroke-width="10"/>${[0, 1, 2, 3, 4, 5].map(k => `<line x1="0" y1="0" x2="${Math.cos(k) * 120}" y2="${Math.sin(k) * 120}" stroke="#8b93a6" stroke-width="12" stroke-linecap="round"/>`).join('')}<circle r="36" fill="#8b93a6"/></g>${cols}` },
          { depth: 0.9, svg: `<rect x="-240" y="770" width="2400" height="310" fill="#cdbb9b"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${-240 + i * 180}" y="${770 + (i % 2) * 0}" width="90" height="310" fill="#c1ad8a" opacity=".6"/>`).join('')}<rect x="-240" y="640" width="820" height="150" rx="8" fill="#8f6440"/><rect x="-240" y="600" width="820" height="40" rx="6" fill="#a8774d"/><rect x="-200" y="470" width="740" height="130" fill="#cfe8f5" opacity=".55"/>` },
        ],
      };
    },
    market(o, rnd) {
      let stalls = '';
      const awn = ['#e8574b', '#f2b43a', '#3fa7d6', '#58b36a', '#e57ab0'];
      for (let i = 0, x = -200; x < 2200; i++, x += 420) {
        const c = awn[i % awn.length];
        let stripes = '';
        for (let k = 0; k < 8; k++) stripes += `<rect x="${k * 45}" y="0" width="45" height="60" fill="${k % 2 ? '#fff' : c}"/>`;
        stripes += Array.from({ length: 8 }, (_, k) => `<circle cx="${22 + k * 45}" cy="60" r="22" fill="${k % 2 ? '#fff' : c}"/>`).join('');
        stalls += `<g transform="translate(${x},470)"><rect x="10" y="40" width="12" height="360" fill="#8b5a33"/><rect x="338" y="40" width="12" height="360" fill="#8b5a33"/><g>${stripes}</g><rect x="0" y="260" width="360" height="140" rx="6" fill="#b98352"/><rect x="0" y="250" width="360" height="20" rx="4" fill="#9c6a3e"/>${[0, 1, 2].map(k => `<ellipse cx="${60 + k * 120}" cy="248" rx="46" ry="22" fill="${['#f2c14e', '#e8574b', '#7cc36b'][(i + k) % 3]}"/>`).join('')}</g>`;
      }
      let lanterns = '';
      for (let x = -200; x < 2200; x += 160) lanterns += `<g transform="translate(${x},${160 + Math.sin(x) * 12})"><line x1="0" y1="-40" x2="0" y2="0" stroke="#7a4a2a" stroke-width="3"/><ellipse cx="0" cy="22" rx="22" ry="28" fill="#e8453c"/><rect x="-10" y="-4" width="20" height="8" fill="#f2c14e"/></g>`;
      return {
        ground: 900,
        layers: [
          { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#sky)"/>${sunMoon(1700, 150, o.time)}` },
          { depth: 0.3, svg: Array.from({ length: 9 }, (_, i) => building(-220 + i * 290, 560, 260, 240 + (i % 3) * 60, ['#f1d9b0', '#e9c79a', '#f4e4c6'][i % 3], rnd, o.time === 'night', 'tri')).join('') + `<path d="M-240,120 Q960,60 2160,120" fill="none" stroke="#7a4a2a" stroke-width="3"/>${lanterns}` },
          { depth: 0.85, svg: `${stalls}<rect x="-240" y="860" width="2400" height="220" fill="#d9c6a3"/>` },
        ],
      };
    },
    lab(o, rnd) {
      let shelf = '';
      for (let r = 0; r < 2; r++) { shelf += `<rect x="120" y="${250 + r * 170}" width="620" height="14" fill="#9aa9bd"/>`; for (let k = 0; k < 6; k++) { const c = ['#6fd3c3', '#f28b82', '#a78bfa', '#fbbf24'][(k + r) % 4]; shelf += `<g transform="translate(${160 + k * 100},${250 + r * 170})"><path d="M-14,-90 L14,-90 L14,-60 L34,-6 Q34,0 28,0 L-28,0 Q-34,0 -34,-6 L-14,-60 Z" fill="#e8f4fb" stroke="#b7c7d8" stroke-width="3"/><path d="M-24,-26 L24,-26 L32,-6 Q32,-2 28,-2 L-28,-2 Q-32,-2 -32,-6 Z" fill="${c}"/></g>`; } }
      return {
        ground: 900,
        screen: { x: 1040, y: 150, w: 700, h: 420, kind: 'monitor' },
        layers: [
          { depth: 0.1, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="#e3eef7"/>${shelf}<rect x="1020" y="130" width="740" height="460" rx="20" fill="#2c3445"/><rect x="1040" y="150" width="700" height="420" rx="8" fill="#0f1a2b"/><rect x="1360" y="590" width="60" height="90" fill="#4a5568"/>` },
          { depth: 0.9, svg: `<rect x="-240" y="700" width="2400" height="30" fill="#cfd8e3"/><rect x="-240" y="730" width="2400" height="360" fill="#b8c4d2"/><rect x="-240" y="660" width="1100" height="50" rx="6" fill="#f2f5f9"/><rect x="-200" y="710" width="1020" height="120" fill="#dfe6ee"/>` },
        ],
      };
    },
    home(o, rnd) {
      return {
        ground: 910,
        screen: { x: 1120, y: 260, w: 560, h: 320, kind: 'tv' },
        layers: [
          { depth: 0.1, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="#f4e3cf"/><rect x="-240" y="0" width="2400" height="1080" fill="url(#wallpaper)" opacity=".15"/><g transform="translate(180,150)"><rect width="440" height="360" rx="10" fill="url(#sky)"/><rect width="440" height="360" rx="10" fill="none" stroke="#fff" stroke-width="18"/><rect x="211" y="0" width="18" height="360" fill="#fff"/><path d="M-30,-10 L470,-10 L440,40 L0,40 Z" fill="#e57373"/></g><rect x="1100" y="240" width="600" height="360" rx="18" fill="#2b2f3a"/><rect x="1120" y="260" width="560" height="320" rx="8" fill="#141821"/><rect x="1060" y="640" width="680" height="140" rx="10" fill="#a7744a"/><g transform="translate(860,300)"><line x1="0" y1="0" x2="0" y2="470" stroke="#6b5a4a" stroke-width="10"/><path d="M-70,0 L70,0 L44,-110 L-44,-110 Z" fill="#f7d77c"/></g>` },
          { depth: 0.9, svg: `<rect x="-240" y="780" width="2400" height="300" fill="#b98e62"/><ellipse cx="760" cy="960" rx="520" ry="70" fill="#d98c6f" opacity=".6"/><g transform="translate(20,640)"><rect x="0" y="60" width="560" height="170" rx="40" fill="#5e8fd6"/><rect x="0" y="0" width="560" height="110" rx="40" fill="#6d9ee0"/><rect x="-30" y="80" width="80" height="150" rx="30" fill="#5585cc"/><rect x="510" y="80" width="80" height="150" rx="30" fill="#5585cc"/></g>` },
        ],
      };
    },
    studio(o, rnd) {
      return {
        ground: 900,
        screen: { x: 460, y: 130, w: 1000, h: 520, kind: 'screen' },
        layers: [
          { depth: 0.1, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#studio)"/><rect x="440" y="110" width="1040" height="560" rx="28" fill="#1d2233"/><rect x="460" y="130" width="1000" height="520" rx="16" fill="#f8f5ef"/>` },
          { depth: 0.9, svg: `<rect x="-240" y="780" width="2400" height="300" fill="#e7ded0"/><ellipse cx="960" cy="920" rx="760" ry="90" fill="#fff" opacity=".5"/>` },
        ],
      };
    },
    port(o, rnd) {
      let cont = '';
      const cc = ['#e8574b', '#3f7fd6', '#f2b43a', '#58b36a', '#8b6bd6'];
      for (let s = 0; s < 3; s++) for (let r = 0; r < 3 - (s % 2); r++) cont += `<rect x="${1150 + s * 250}" y="${780 - (r + 1) * 70}" width="240" height="66" rx="4" fill="${cc[(s * 3 + r) % 5]}"/>`;
      return {
        ground: 900,
        layers: [
          { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#sky)"/>${sunMoon(400, 180, o.time)}${cloud(1000, 150, 1) + cloud(1700, 210, 0.7)}` },
          { depth: 0.25, svg: `<rect x="-240" y="560" width="2400" height="300" fill="#4f9fd8"/><g class="k-ship" transform="translate(200,560)"><path d="M0,0 L520,0 L470,70 L40,70 Z" fill="#2f3f5e"/><rect x="60" y="-70" width="120" height="70" fill="#e8574b"/><rect x="190" y="-70" width="120" height="70" fill="#f2b43a"/><rect x="320" y="-70" width="120" height="70" fill="#3f7fd6"/><rect x="420" y="-150" width="70" height="80" fill="#f3f3f3"/></g>` },
          { depth: 0.6, svg: `${cont}<g transform="translate(900,780)"><rect x="0" y="-520" width="30" height="520" fill="#f2b43a"/><rect x="-260" y="-520" width="560" height="26" fill="#f2b43a"/><line x1="-200" y1="-494" x2="-200" y2="-300" stroke="#333" stroke-width="4"/></g>` },
          { depth: 0.9, svg: `<rect x="-240" y="780" width="2400" height="300" fill="#9aa0ab"/><rect x="-240" y="780" width="2400" height="16" fill="#7c828c"/>` },
        ],
      };
    },
    factory(o, rnd) {
      let fac = '';
      for (let i = 0; i < 3; i++) { const x = 300 + i * 560; fac += `<g transform="translate(${x},780)"><rect x="0" y="-260" width="480" height="260" fill="${['#c9cdd6', '#b9bec9', '#d3d6dd'][i]}"/><path d="M0,-260 L80,-330 L80,-260 L160,-330 L160,-260 L240,-330 L240,-260 L320,-330 L320,-260 L400,-330 L400,-260 L480,-330 L480,-260 Z" fill="#9aa1ad"/><rect x="380" y="-460" width="50" height="200" fill="#8a4b3a"/>${[0, 1, 2, 3].map(k => `<rect x="${30 + k * 110}" y="-200" width="80" height="60" fill="#8fc5ea"/>`).join('')}<rect x="200" y="-110" width="90" height="110" fill="#6b7280"/></g>`; }
      let smoke = '';
      for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) smoke += `<circle class="k-smoke" data-i="${k}" cx="${300 + i * 560 + 405}" cy="${320 - k * 60}" r="${30 + k * 12}" fill="#e6e6ea" opacity=".8"/>`;
      return {
        ground: 900,
        layers: [
          { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#sky)"/>${sunMoon(1700, 170, o.time)}` },
          { depth: 0.4, svg: fac + smoke },
          { depth: 0.9, svg: `<rect x="-240" y="780" width="2400" height="300" fill="#a3a8b3"/><rect x="-240" y="880" width="2400" height="12" fill="#f2d24b"/>` },
        ],
      };
    },
    space(o, rnd) {
      return {
        ground: 920,
        layers: [
          { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#space)"/>${stars(rnd, 160)}` },
          { depth: 0.2, svg: `<g transform="translate(1500,300)"><circle r="170" fill="#6f8ef2"/><ellipse rx="280" ry="40" fill="none" stroke="#c8d3ff" stroke-width="14" transform="rotate(-18)"/></g><circle cx="300" cy="220" r="60" fill="#f2a65a"/>` },
          { depth: 0.9, svg: `<ellipse cx="960" cy="1260" rx="1500" ry="420" fill="#b7b9c7"/>${[[400, 960, 60], [1300, 990, 80], [900, 1040, 40], [1700, 950, 44]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.35}" fill="#9fa2b2"/>`).join('')}` },
        ],
      };
    },
  };
  // Themed backdrops for explainers (dark ones flip graphic text to light colours).
  const BACKDROPS = {
    space: rnd => {
      let st = '';
      for (let i = 0; i < 140; i++) st += `<circle class="k-star" cx="${rnd() * 2400 - 240}" cy="${rnd() * 840}" r="${0.8 + rnd() * 2.4}" fill="#fff" opacity="${0.35 + rnd() * 0.65}"/>`;
      return { ground: 900, layers: [
        { depth: 0.03, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="url(#space)"/><circle cx="300" cy="260" r="360" fill="#6d4bd6" opacity=".16"/><circle cx="1650" cy="420" r="420" fill="#2fb3c8" opacity=".12"/>${st}` },
        { depth: 0.9, svg: `<ellipse cx="960" cy="1300" rx="1700" ry="470" fill="#9ea2b3"/><ellipse cx="500" cy="960" rx="70" ry="16" fill="#878b9c"/><ellipse cx="1450" cy="990" rx="90" ry="20" fill="#878b9c"/>` } ] };
    },
    parchment: rnd => {
      let lines = '';
      for (let i = 0; i < 18; i++) lines += `<path d="M-240,${60 + i * 50 + rnd() * 10} Q960,${40 + i * 50 + rnd() * 20} 2160,${60 + i * 50}" stroke="#d9c49a" stroke-width="${1 + rnd() * 2}" opacity=".35" fill="none"/>`;
      return { ground: 900, layers: [
        { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="#f1e2bf"/>${lines}<rect x="-240" y="0" width="2400" height="1080" fill="url(#vignette)"/>` },
        { depth: 0.9, svg: `<rect x="-240" y="860" width="2400" height="220" fill="#e3cd9d"/><rect x="-240" y="860" width="2400" height="8" fill="#c9ad76"/>` } ] };
    },
    blueprint: () => {
      let grid = '';
      for (let x = -240; x < 2160; x += 60) grid += `<line x1="${x}" y1="0" x2="${x}" y2="1080" stroke="#fff" stroke-opacity="${x % 240 ? 0.07 : 0.16}" stroke-width="2"/>`;
      for (let y = 0; y < 1080; y += 60) grid += `<line x1="-240" y1="${y}" x2="2160" y2="${y}" stroke="#fff" stroke-opacity="${y % 240 ? 0.07 : 0.16}" stroke-width="2"/>`;
      return { ground: 900, layers: [
        { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="#1d4f91"/>${grid}` },
        { depth: 0.9, svg: `<rect x="-240" y="860" width="2400" height="220" fill="#173f74"/><rect x="-240" y="860" width="2400" height="4" fill="#9cc3ff" opacity=".6"/>` } ] };
    },
    chalkboard: rnd => {
      let dust = '';
      for (let i = 0; i < 40; i++) dust += `<ellipse cx="${rnd() * 2400 - 240}" cy="${rnd() * 800}" rx="${40 + rnd() * 120}" ry="${10 + rnd() * 30}" fill="#fff" opacity=".025"/>`;
      return { ground: 900, layers: [
        { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="#2f5d4a"/>${dust}` },
        { depth: 0.9, svg: `<rect x="-240" y="850" width="2400" height="30" fill="#8a5c33"/><rect x="-240" y="880" width="2400" height="200" fill="#6d4a2c"/><rect x="400" y="842" width="70" height="12" rx="3" fill="#fff"/>` } ] };
    },
    paper: () => {
      let grid = '';
      for (let x = -240; x < 2160; x += 48) grid += `<line x1="${x}" y1="0" x2="${x}" y2="1080" stroke="#9cc3ff" stroke-opacity=".25" stroke-width="1.5"/>`;
      for (let y = 0; y < 1080; y += 48) grid += `<line x1="-240" y1="${y}" x2="2160" y2="${y}" stroke="#9cc3ff" stroke-opacity=".25" stroke-width="1.5"/>`;
      return { ground: 900, layers: [
        { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="#fbfbf7"/>${grid}<line x1="140" y1="0" x2="140" y2="1080" stroke="#f28b8b" stroke-width="3" opacity=".6"/>` },
        { depth: 0.9, svg: `<rect x="-240" y="880" width="2400" height="200" fill="#eef0f5"/>` } ] };
    },
  };
  SETTINGS.stage = (o, rnd) => {
    if (BACKDROPS[o.color]) return BACKDROPS[o.color](rnd);
    const pal = { cream: ['#fdf3e4', '#f6e6cd', '#ecd6b5'], blue: ['#e8f2ff', '#d3e5fc', '#bcd4f2'], mint: ['#e7f8f0', '#d0efe0', '#b5e1cc'], peach: ['#fff0e6', '#fcdcca', '#f2c4ab'], lilac: ['#f2edff', '#e0d6fb', '#cdbff2'], sand: ['#faf4e8', '#efe3cc', '#e0cfae'] }[o.color] || ['#fdf3e4', '#f6e6cd', '#ecd6b5'];
    let dots = '';
    for (let i = 0; i < 26; i++) dots += `<circle cx="${rnd() * 2400 - 240}" cy="${rnd() * 700}" r="${4 + rnd() * 7}" fill="${pal[2]}" opacity=".55"/>`;
    return {
      ground: 900,
      layers: [
        { depth: 0.05, svg: `<rect x="-240" y="0" width="2400" height="1080" fill="${pal[0]}"/><circle cx="260" cy="200" r="260" fill="${pal[1]}" opacity=".7"/><circle cx="1700" cy="330" r="340" fill="${pal[1]}" opacity=".6"/><circle cx="980" cy="-80" r="300" fill="${pal[1]}" opacity=".45"/>${dots}` },
        { depth: 0.9, svg: `<rect x="-240" y="850" width="2400" height="240" fill="${pal[1]}"/><rect x="-240" y="850" width="2400" height="10" fill="${pal[2]}"/><ellipse cx="960" cy="930" rx="820" ry="70" fill="#fff" opacity=".35"/>` },
      ],
    };
  };
  SETTINGS.village = SETTINGS.countryside;
  SETTINGS.street = SETTINGS.city;

  class World {
    constructor(ctx, name, o = {}) {
      Object.assign(this, { tl: ctx.tl, D: ctx.D, words: ctx.words, frameFns: ctx.frameFns, clampT: ctx.clampT });
      this.name = SETTINGS[name] ? name : 'stage';
      if (!SETTINGS[name]) window.__rt?.warn?.(`Bối cảnh không tồn tại: "${name}" — dùng: ${Object.keys(SETTINGS).join(', ')}`);
      this.chars = [];
      this.cam = { x: 0, y: 0, zoom: 1, fx: 960, fy: 540 };
      this.kit = ctx.kit;
      this.opts = o;
      const time = o.time || 'day';
      const rnd = this.rnd = mulberry(name.length * 7777 + 13 + (o.seed || 0));
      const def = this.def = SETTINGS[this.name]({ ...o, time }, rnd);
      this.ground = def.ground;
      this.horizon = def.horizon ?? this.ground - 260;
      this.lanes = def.lanes || {};
      // how big a person standing at the front is in this set (shop doors, rice fields, space...)
      this.actorScale = o.actorScale ?? def.actorScale ?? 1;
      this.spots = def.spots || {};
      // Gentle camera drift keeps every shot alive (zoom creeps in over the scene); kit.world(name, { drift: false }) to lock.
      this.driftAmt = o.drift === false ? 0 : typeof o.drift === 'number' ? o.drift : (def.drift ?? 0.04);
      this.shakes = [];
      this.objList = [];
      const el = this.el = document.createElement('div');
      el.className = 'k-world';
      el.style.cssText = 'position:absolute;inset:0;overflow:hidden;transform-origin:0 0';
      const back = def.layers.filter(l => !l.front), front = def.layers.filter(l => l.front);
      const layerSvg = l => `<g class="k-layer" data-depth="${l.depth}"${l.under ? ' data-under="1"' : ''}>${l.svg}</g>`;
      el.innerHTML = `<svg class="k-set" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;inset:0"><defs>${skyGrad('sky', time)}<linearGradient id="space" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1030"/><stop offset="1" stop-color="#27306a"/></linearGradient><linearGradient id="studio" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf3e4"/><stop offset="1" stop-color="#f1e2cc"/></linearGradient><radialGradient id="vignette" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#8a6a3a" stop-opacity="0"/><stop offset="100%" stop-color="#8a6a3a" stop-opacity=".35"/></radialGradient><pattern id="wallpaper" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="30" cy="30" r="6" fill="#c08a5a"/></pattern>${def.defs || ''}</defs>${back.map(layerSvg).join('')}</svg>
        <svg class="k-actors" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;inset:0;overflow:visible"></svg>
        <svg class="k-front" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;inset:0;overflow:visible;pointer-events:none">${front.map(layerSvg).join('')}</svg>`;
      ctx.stage.insertBefore(el, ctx.stage.firstChild);
      ctx.stage.__world = this;
      this.dark = def.dark ?? (this.name === 'space' || (this.name === 'stage' && ['space', 'blueprint', 'chalkboard'].includes(o.color)) || o.time === 'night');
      this.set = el.querySelector('.k-set');
      this.frontSvg = el.querySelector('.k-front');
      this.layers = [...el.querySelectorAll('.k-layer')].map(g => ({ g, depth: +g.dataset.depth }));
      this.actors = el.querySelector('.k-actors');
      this.propsLayer = mk('g', {}, this.actors);
      this.flyLayer = null;
      // Screen inside the set (whiteboard / chalkboard / TV / monitor) for charts, numbers, maps.
      this.screen = null;
      if (def.screen) {
        const s = def.screen, sc = document.createElement('div');
        sc.className = `k-screen k-screen-${s.kind}`;
        sc.style.cssText = `position:absolute;left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px;display:flex;align-items:center;justify-content:center;overflow:hidden;`;
        el.insertBefore(sc, el.querySelector('.k-actors'));
        this.screen = sc;
      }
      const clouds = [...el.querySelectorAll('.k-cloud')], smoke = [...el.querySelectorAll('.k-smoke')], starsEl = [...el.querySelectorAll('.k-star')], ship = el.querySelector('.k-ship');
      ctx.frameFns.push(t => {
        clouds.forEach((c, i) => { c.style.transform = `translateX(${Math.sin(t / 9 + i) * 40 + t * 6}px)`; });
        smoke.forEach((s2, i) => { const k = ((t * 0.35 + +s2.dataset.i * 0.25) % 1); s2.setAttribute('transform', `translate(${k * 30},${-k * 160})`); s2.setAttribute('opacity', (0.85 * (1 - k)).toFixed(3)); });
        starsEl.forEach((s2, i) => { if (i % 5 === 0) s2.setAttribute('opacity', (0.5 + 0.5 * Math.sin(t * 2 + i)).toFixed(2)); });
        if (ship) ship.style.transform = `translateY(${Math.sin(t * 1.3) * 4}px)`;
        this.applyCamera(t);
        for (const c of this.chars) c.render(t);
      });
      // Extensions (ambient animation driver, environment extras) hook in here.
      for (const h of window.Cartoon?.onWorld || []) h(this, ctx, def);
      if (def.ambient) def.ambient(this, ctx);
    }
    /** Ground line for something standing `depth` (0 = front, 1 = horizon) into the picture. */
    groundAt(depth = 0) { return this.ground + (this.horizon - this.ground) * Math.max(0, Math.min(1, depth)) * 0.9; }
    /** Parallax factor of something at `depth` (front moves with the camera, the horizon barely does). */
    parallax(depth = 0) { return 1 - Math.max(0, Math.min(1, depth)) * 0.85; }
    applyCamera(t = 0) {
      const c = { ...this.cam };
      // Sets are drawn 240px beyond each frame edge — never pan past that (zoom-in adds a little slack).
      const lim = 200 + (Math.max(1, c.zoom) - 1) * 500;
      c.x = Math.max(-lim, Math.min(lim, c.x));
      c.y = Math.max(-120, Math.min(120, c.y));
      c.zoom = Math.max(1, c.zoom) * (1 + this.driftAmt * Math.min(1, t / Math.max(1, this.D)));
      // camera shake (deterministic)
      let sx = 0, sy = 0;
      for (const s of this.shakes) if (t >= s.t && t <= s.t + s.dur) { const k = 1 - (t - s.t) / s.dur; sx += Math.sin(t * 53) * s.amp * k; sy += Math.cos(t * 47) * s.amp * k; }
      for (const l of this.layers) l.g.setAttribute('transform', `translate(${-c.x * l.depth + sx * l.depth},${-c.y * l.depth + sy * l.depth})`);
      for (const ob of this.objList) ob.par.setAttribute('transform', `translate(${-c.x * ob.f + sx * ob.f},${-c.y * ob.f + sy * ob.f})`);
      this.actors.style.transform = `translate(${-c.x + sx}px,${-c.y + sy}px)`;
      if (this.screen) this.screen.style.transform = `translate(${-c.x * 0.1}px,${-c.y * 0.1}px)`;
      // Auto-framing: a shot that never steers the camera is framed on its people + main things (computed once).
      if (this.autoFrame === undefined) this.autoFrame = !this.camManual && this.computeAutoFrame ? this.computeAutoFrame() : null;
      const af = this.autoFrame;
      // w.focus still pushes in on top of the framing (total zoom capped)
      if (af) { const cz = Math.min(1 + (c.zoom - 1) * 0.6, 2 / af.z); this.el.style.transform = `translate(${af.px}px,${af.py}px) scale(${af.z.toFixed(4)}) translate(${-af.px}px,${-af.py}px)` + (cz > 1.001 ? ` translate(${c.fx}px,${c.fy}px) scale(${cz.toFixed(4)}) translate(${-c.fx}px,${-c.fy}px)` : ''); }
      else this.el.style.transform = c.zoom === 1 ? '' : `translate(${c.fx}px,${c.fy}px) scale(${c.zoom}) translate(${-c.fx}px,${-c.fy}px)`;
    }
    /** Camera move: pan x/y (px, parallax by depth) and/or zoom toward focus point fx,fy. */
    camera(o, at = 0, dur = 1.2) {
      this.camManual = true;
      const t = this.clampT(at);
      if (o.fx != null || o.fy != null) this.tl.set(this.cam, { fx: o.fx ?? this.cam.fx, fy: o.fy ?? this.cam.fy }, t);
      const to = {};
      for (const k of ['x', 'y', 'zoom']) if (o[k] != null) to[k] = o[k];
      this.tl.to(this.cam, { ...to, duration: dur, ease: o.ease || 'power2.inOut' }, t);
      return this;
    }
    character(look, o = {}) {
      const cast = window.__rt?.data?.cast || {};
      const l = typeof look === 'string' ? cast[look] : look;
      if (typeof look === 'string' && !l) window.__rt?.warn?.(`Nhân vật "${look}" không có trong dàn nhân vật`);
      return new Character(this, l || {}, o);
    }
    /** A library illustration standing on the ground (or at y), e.g. a tree, a house, a car. */
    prop(name, o = {}) {
      const size = o.size || 180;
      const depth = o.depth ?? 0;
      const y = o.y ?? this.groundAt(depth);
      const g = mk('g', { class: 'k-prop', transform: `translate(${o.x ?? 960},${y})` }, this.propsLayer);
      mk('ellipse', { cx: 0, cy: 0, rx: size * 0.38, ry: size * 0.06, fill: 'rgba(40,30,20,.16)', opacity: o.y != null ? 0 : 1 }, g);
      const inner = mk('g', {}, g);
      inner.innerHTML = artMarkup(name, size, -size * 0.47);
      return inner;
    }
    /** Speech/thought bubble above a character: {text:'Đắt quá!'} (≤ 4 words) or {illus:'money-bag'}. */
    bubble(char, content, at = 0, dur = 2, o = {}) {
      const thought = !!o.thought;
      const text = content.text ? String(content.text) : '';
      const art = content.illus ? true : false;
      const w = text ? Math.max(170, text.length * 27 + 70) : 190, h = text ? 110 : 170;
      const g = mk('g', { class: 'k-bubble', opacity: 0 }, this.actors);
      const inner = mk('g', {}, g);
      if (thought) {
        mk('rect', { x: -w / 2, y: -h, width: w, height: h, rx: h / 2, fill: '#fff', stroke: '#2b2118', 'stroke-width': 5 }, inner);
        mk('circle', { cx: -w * 0.18, cy: 26, r: 16, fill: '#fff', stroke: '#2b2118', 'stroke-width': 5 }, inner);
        mk('circle', { cx: -w * 0.26, cy: 60, r: 9, fill: '#fff', stroke: '#2b2118', 'stroke-width': 4 }, inner);
      } else {
        mk('path', { d: `M${-w / 2 + 28},0 L${-w / 2},0 Q${-w / 2 - 0},${-h} ${-w / 2 + 28},${-h} L${w / 2 - 28},${-h} Q${w / 2},${-h} ${w / 2},${-h / 2} Q${w / 2},0 ${w / 2 - 28},0 L${-w * 0.08},0 L${-w * 0.22},44 L${-w * 0.2},0 Z`, fill: '#fff', stroke: '#2b2118', 'stroke-width': 5, 'stroke-linejoin': 'round' }, inner);
      }
      if (text) { const tx = mk('text', { x: 0, y: -h / 2 + 14, 'text-anchor': 'middle', 'font-size': 46, 'font-weight': 800, fill: '#2b2118', 'font-family': "'Be Vietnam Pro', sans-serif" }, inner); tx.textContent = text; }
      if (art) { const s = h - 36; inner.insertAdjacentHTML('beforeend', artMarkup(content.illus, s, -h + 18 + s / 2)); }
      const t0 = this.clampT(at), t1 = t0 + dur;
      this.frameFns.push(t => {
        const on = t >= t0 && t <= t1;
        g.setAttribute('opacity', on ? 1 : 0);
        if (!on) return;
        const k = Math.min(1, (t - t0) / 0.25), out = Math.max(0, Math.min(1, (t1 - t) / 0.2));
        const sc = (k < 1 ? 0.3 + 0.7 * (1 - Math.pow(1 - k, 3)) * 1.05 : 1) * out;
        const pk = 1 - (char.f ?? 1), s = char.base.scale, x = char.p.x + 70 * s * char.p.face + this.cam.x * pk, y = char.base.groundY - char.p.jump - 470 * s + this.cam.y * pk;
        g.setAttribute('transform', `translate(${x},${y}) scale(${sc})`);
      });
      return g;
    }
    flyingProp(name, size) {
      if (!this.flyLayer) this.flyLayer = mk('g', {}, this.actors);
      const g = mk('g', { opacity: 0 }, this.flyLayer);
      g.innerHTML = artMarkup(name, size, -size * 0.22);
      return g;
    }
  }

  window.Cartoon = {
    get SETTINGS() { return Object.keys(SETTINGS); },
    POSES: Object.keys(POSES),
    World, Character, mk, shade, mulberry, W, H,
    onWorld: [],
    /** Add (or replace) an environment: fn(opts, rnd) → { ground, horizon, layers: [{ depth, svg, front? }], defs?, lanes?, spots?, dark?, ambient? }. */
    registerSetting(name, fn) { SETTINGS[name] = fn; },
    getSetting: name => SETTINGS[name],
    extend(kit, ctx) {
      kit.world = (name, o) => new World({ ...ctx, kit }, name, o);
    },
  };
})();
