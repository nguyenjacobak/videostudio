/* Scene toolkit. One kit instance per mounted scene; every helper writes into that scene's paused GSAP
 * timeline (tl) or registers an onFrame(t) callback, so the whole scene is a pure function of time. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9%]+/g, ' ').trim();
  }

  // TTS word timings often write numbers as digits ("10 đồng") while the narration spells them ("mười đồng"):
  // cue() falls back to comparing both sides with number words folded to digits.
  const NUM_WORDS = { mot: '1', hai: '2', ba: '3', bon: '4', tu: '4', nam: '5', lam: '5', sau: '6', bay: '7', tam: '8', chin: '9', muoi: '10', tram: '100', nghin: '1000', ngan: '1000' };
  const fold = w => NUM_WORDS[w] || w;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const COUNTRY_ALIASES = {
    'viet nam': 'Vietnam', 'vn': 'Vietnam', 'my': 'United States of America', 'hoa ky': 'United States of America', 'usa': 'United States of America', 'us': 'United States of America', 'united states': 'United States of America',
    'trung quoc': 'China', 'nga': 'Russia', 'nhat ban': 'Japan', 'han quoc': 'South Korea', 'korea': 'South Korea', 'trieu tien': 'North Korea', 'an do': 'India', 'anh': 'United Kingdom', 'uk': 'United Kingdom', 'phap': 'France', 'duc': 'Germany',
    'uc': 'Australia', 'lao': 'Laos', 'campuchia': 'Cambodia', 'thai lan': 'Thailand', 'ukraine': 'Ukraine', 'y': 'Italy', 'tay ban nha': 'Spain', 'brazil': 'Brazil', 'canada': 'Canada', 'mexico': 'Mexico', 'indonesia': 'Indonesia',
    'philippines': 'Philippines', 'malaysia': 'Malaysia', 'singapore': 'Singapore', 'dai loan': 'Taiwan', 'iran': 'Iran', 'israel': 'Israel', 'a rap xe ut': 'Saudi Arabia', 'saudi arabia': 'Saudi Arabia', 'ai cap': 'Egypt', 'nam phi': 'South Africa',
    'tho nhi ky': 'Turkey', 'turkey': 'Turkey', 'argentina': 'Argentina', 'myanmar': 'Myanmar', 'pakistan': 'Pakistan', 'ba lan': 'Poland', 'thuy dien': 'Sweden', 'na uy': 'Norway', 'ha lan': 'Netherlands', 'thuy si': 'Switzerland',
  };

  function formatNumber(v, decimals = 0, sep = '.', dec = ',') {
    const fixed = Math.abs(v).toFixed(decimals);
    let [int, frac] = fixed.split('.');
    int = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return (v < 0 ? '−' : '') + int + (frac ? dec + frac : '');
  }

  function el(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function iconSvg(name, { size = 64, color = 'currentColor', stroke = 2 } = {}) {
    const lib = window.lucide?.icons || {};
    const key = String(name || '').replace(/(^|[-_\s])(\w)/g, (_, __, c) => c.toUpperCase());
    const node = lib[key] || lib[name] || lib.CircleHelp || lib.Circle;
    if (!lib[key] && !lib[name]) window.__rt?.warn?.(`Icon không tồn tại: "${name}"`);
    const inner = (node || []).map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
    return `<svg xmlns="${NS}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" class="k-icon-svg">${inner}</svg>`;
  }

  window.createKit = function createKit(ctx) {
    const { stage, tl, D, words = [], sceneId, assets = {}, tokens = {} } = ctx;
    const frameFns = ctx.frameFns;
    const rnd = mulberry32(hashSeed(sceneId || 'scene'));
    const wordNorm = words.map(w => norm(w.w));

    const resolve = t => (typeof t === 'string' ? stage.querySelectorAll(t) : t);
    const one = t => (typeof t === 'string' ? stage.querySelector(t) : (t && t.length !== undefined && !t.nodeType ? t[0] : t));
    const clampT = t => Math.max(0, Math.min(Number(t) || 0, Math.max(0, D - 0.2)));

    const kit = {
      D, words, tokens,
      $: sel => stage.querySelector(sel),
      $$: sel => Array.from(stage.querySelectorAll(sel)),
      random: () => rnd(),
      rand: (a, b) => a + rnd() * (b - a),
      pick: arr => arr[Math.floor(rnd() * arr.length)],
      at: f => clampT(f * D),
      onFrame: fn => { frameFns.push(fn); },

      /** Time (seconds, scene-local) when the narrator starts saying `phrase`. */
      cue(phrase, occurrence = 1) {
        const q = norm(phrase).split(' ').filter(Boolean);
        if (!q.length || !words.length) return 0;
        const find = (list, qq, prefix) => {
          let seen = 0;
          for (let i = 0; i <= list.length - qq.length; i++) {
            let ok = true;
            for (let j = 0; j < qq.length; j++) {
              const w = list[i + j];
              if (!(w === qq[j] || (prefix && j === qq.length - 1 && w.startsWith(qq[j])))) { ok = false; break; }
            }
            if (ok && ++seen === occurrence) return i;
          }
          return -1;
        };
        // whole words first ("tro" must not land on an earlier "trốn"), then a prefix of the last word
        let hit = find(wordNorm, q, false);
        if (hit < 0) hit = find(wordNorm.map(fold), q.map(fold), false);
        if (hit < 0) hit = find(wordNorm, q, true);
        if (hit < 0) hit = find(wordNorm.map(fold), q.map(fold), true);
        if (hit >= 0) return clampT(words[hit].t);
        for (let i = 0; i < wordNorm.length; i++) if (wordNorm[i].includes(q[0])) return clampT(words[i].t);
        window.__rt?.warn?.(`cue("${phrase}") không khớp từ nào trong lời thoại`);
        return 0;
      },
      /** Time when the narrator finishes saying `phrase`. */
      cueEnd(phrase, occurrence = 1) {
        const start = kit.cue(phrase, occurrence);
        const q = norm(phrase).split(' ').filter(Boolean);
        const i = words.findIndex(w => Math.abs(w.t - start) < 0.001);
        if (i < 0) return start;
        const last = words[Math.min(words.length - 1, i + q.length - 1)];
        return clampT(last.t + last.d);
      },

      icon: (name, opts) => iconSvg(name, opts),
      asset: id => assets[id] || '',

      /** HTML string for a library illustration (use inside innerHTML / template strings). */
      illus(name, o = {}) {
        const svg = window.__rt?.data?.illus?.[name];
        if (!svg) window.__rt?.warn?.(`Hình minh họa không có trong thư viện: "${name}"`);
        return `<div class="k-illus ${o.cls || ''}" style="width:${o.size || 160}px;height:${o.size || 160}px">${svg || ''}</div>`;
      },
      flag(code, o = {}) {
        const svg = window.__rt?.data?.flags?.[code];
        if (!svg) window.__rt?.warn?.(`Không có cờ: "${code}"`);
        return `<div class="k-illus k-flag ${o.cls || ''}" style="width:${o.size || 120}px;height:${o.size || 120}px">${svg || ''}</div>`;
      },
      /** Fill `target` with `count` copies of an illustration in a grid and pop them in one by one.
       *  Great for quantities: 10 apples, 20 coins, a crowd of workers. Returns the item elements. */
      crowd(target, name, count, o = {}) {
        const host = one(target);
        if (!host) return [];
        const size = o.size || 90, cols = o.cols || Math.ceil(Math.sqrt(count * 1.8));
        host.style.display = 'grid';
        host.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
        host.style.gap = `${o.gap ?? Math.round(size * 0.15)}px`;
        host.style.justifyContent = 'center';
        host.innerHTML = Array.from({ length: count }, () => kit.illus(name, { size, cls: 'k-crowd-item' })).join('');
        const items = Array.from(host.children);
        if (o.at != null) tl.fromTo(items, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.45, stagger: o.stagger ?? Math.min(0.12, 1.6 / count), ease: 'back.out(2)' }, clampT(o.at));
        return items;
      },
      /** Move an element along an SVG path (selector of a <path> inside the scene). */
      moveAlong(target, path, at = 0, dur = 1.5, o = {}) {
        tl.to(resolve(target), { motionPath: { path: one(path), align: one(path), alignOrigin: [0.5, 0.5], autoRotate: !!o.rotate }, duration: dur, ease: o.ease || 'power1.inOut' }, clampT(at));
        return kit;
      },

      reveal(targets, at = 0, o = {}) {
        // fromTo with explicit end state: works even if the CSS starts the element at opacity 0.
        const from = { opacity: 0, y: o.y ?? 40, x: o.x ?? 0 }, to = { opacity: 1, y: 0, x: 0, duration: o.dur ?? 0.7, stagger: o.stagger ?? 0.1, ease: o.ease || 'power3.out' };
        if (o.blur) { from.filter = 'blur(10px)'; to.filter = 'blur(0px)'; }
        tl.fromTo(resolve(targets), from, to, clampT(at));
        return kit;
      },
      pop(targets, at = 0, o = {}) {
        tl.fromTo(resolve(targets), { opacity: 0, scale: o.from ?? 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: o.dur ?? 0.6, stagger: o.stagger ?? 0.08, ease: o.ease || 'back.out(1.8)' }, clampT(at));
        return kit;
      },
      exit(targets, at, o = {}) {
        tl.to(resolve(targets), { opacity: 0, y: o.y ?? -30, scale: o.scale ?? 1, duration: o.dur ?? 0.5, stagger: o.stagger ?? 0.05, ease: 'power2.in' }, clampT(at));
        return kit;
      },
      draw(targets, at = 0, dur = 1.2, o = {}) {
        tl.fromTo(resolve(targets), { drawSVG: o.from || '0%' }, { drawSVG: o.to || '100%', duration: dur, stagger: o.stagger ?? 0.1, ease: o.ease || 'power2.inOut' }, clampT(at));
        return kit;
      },
      splitText(target, at = 0, o = {}) {
        const node = one(target);
        if (!node) return kit;
        const split = new SplitText(node, { type: o.type === 'chars' ? 'chars,words' : 'words', wordsClass: 'k-w', charsClass: 'k-c' });
        const parts = o.type === 'chars' ? split.chars : split.words;
        gsap.set(node, { opacity: 1 });
        tl.fromTo(parts, { opacity: 0, y: o.y ?? 28, rotateX: o.rotate ? -60 : 0 }, { opacity: 1, y: 0, rotateX: 0, duration: o.dur ?? 0.5, stagger: o.stagger ?? (o.type === 'chars' ? 0.025 : 0.07), ease: 'power3.out' }, clampT(at));
        return kit;
      },
      typewriter(target, at = 0, dur = 1.5) {
        const node = one(target);
        if (!node) return kit;
        const full = node.textContent;
        const start = clampT(at);
        node.textContent = '';
        frameFns.push(t => {
          const p = Math.max(0, Math.min(1, (t - start) / dur));
          node.textContent = full.slice(0, Math.round(full.length * p));
        });
        return kit;
      },
      countUp(target, to, at = 0, o = {}) {
        const node = one(target);
        if (!node) return kit;
        const from = o.from ?? 0, dur = o.dur ?? 1.6, dec = o.decimals ?? (Number.isInteger(to) ? 0 : 1);
        const start = clampT(at), ease = gsap.parseEase(o.ease || 'power2.out');
        frameFns.push(t => {
          const p = ease(Math.max(0, Math.min(1, (t - start) / dur)));
          node.textContent = (o.prefix || '') + formatNumber(from + (to - from) * p, dec) + (o.suffix || '');
        });
        return kit;
      },
      highlight(target, at = 0, o = {}) {
        const nodes = resolve(target);
        const hc = o.color || 'color-mix(in srgb, var(--accent) 45%, transparent)';
        gsap.set(nodes, { backgroundImage: `linear-gradient(${hc}, ${hc})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 88%', backgroundSize: '0% 38%' });
        tl.to(nodes, { backgroundSize: '100% 38%', duration: o.dur ?? 0.6, ease: 'power2.out', stagger: 0.15 }, clampT(at));
        return kit;
      },
      /** Slow continuous push-in/drift over the whole scene so nothing is ever frozen. */
      camera(target, o = {}) {
        const node = resolve(target);
        tl.fromTo(node, { scale: o.fromScale ?? 1, x: o.fromX ?? 0, y: o.fromY ?? 0 }, { scale: o.toScale ?? 1.06, x: o.toX ?? 0, y: o.toY ?? 0, duration: D, ease: 'none' }, 0);
        return kit;
      },
      float(target, o = {}) {
        const nodes = Array.from(resolve(target) || []);
        const amp = o.amp ?? 10, period = o.period ?? 4;
        nodes.forEach((n, i) => {
          const phase = rnd() * Math.PI * 2;
          frameFns.push(t => { gsap.set(n, { y: Math.sin((t / period) * Math.PI * 2 + phase) * amp, rotation: o.rotate ? Math.sin(t / period * 3 + phase) * o.rotate : 0 }); });
        });
        return kit;
      },
      math(target, tex, o = {}) {
        const node = one(target);
        if (node && window.katex) katex.render(tex, node, { throwOnError: false, displayMode: o.display ?? true });
        return kit;
      },
      rough: svg => rough.svg(one(svg)),

      /** Animated SVG arrow between two points inside an <svg> (viewBox coordinates). */
      arrow(svg, from, to, o = {}) {
        const host = one(svg);
        if (!host) return null;
        const color = o.color || 'var(--accent)', width = o.width ?? 6;
        const [x1, y1] = from, [x2, y2] = to;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, bend = o.curve ?? 0.2;
        const cx = mx - (y2 - y1) * bend, cy = my + (x2 - x1) * bend;
        const g = el('g', { class: 'k-arrow' }, host);
        const path = el('path', { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', ...(o.dashed ? { 'stroke-dasharray': '4 14' } : {}) }, g);
        const ang = Math.atan2(y2 - cy, x2 - cx), hs = width * 3.2;
        const head = el('path', { d: `M${x2},${y2} L${x2 - hs * Math.cos(ang - 0.45)},${y2 - hs * Math.sin(ang - 0.45)} L${x2 - hs * Math.cos(ang + 0.45)},${y2 - hs * Math.sin(ang + 0.45)} Z`, fill: color }, g);
        const at = clampT(o.at ?? 0), dur = o.dur ?? 0.8;
        if (o.dashed) tl.from(path, { opacity: 0, duration: dur }, at);
        else tl.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, ease: 'power2.inOut' }, at);
        tl.from(head, { opacity: 0, scale: 0, transformOrigin: `${x2}px ${y2}px`, duration: 0.3 }, at + dur * 0.85);
        return g;
      },

      /** Particles on a canvas filling `target`; pure function of time. */
      particles(target, o = {}) {
        const host = one(target);
        if (!host) return kit;
        const W = host.clientWidth || 1920, H = host.clientHeight || 1080;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H; cv.className = 'k-particles';
        cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
        host.appendChild(cv);
        const c = cv.getContext('2d');
        const n = o.count ?? 60, color = o.color || tokens.primary || '#fff', speed = o.speed ?? 30, size = o.size ?? 3;
        const pts = Array.from({ length: n }, () => ({ x: rnd() * W, y: rnd() * H, a: rnd() * Math.PI * 2, s: 0.4 + rnd() * 0.9, r: size * (0.5 + rnd()), p: rnd() * 6 }));
        frameFns.push(t => {
          c.clearRect(0, 0, W, H);
          c.fillStyle = color;
          for (const p of pts) {
            const dir = o.direction === 'up' ? -Math.PI / 2 : p.a;
            const x = ((p.x + Math.cos(dir) * speed * p.s * t) % W + W) % W;
            const y = ((p.y + Math.sin(dir) * speed * p.s * t) % H + H) % H;
            c.globalAlpha = (o.opacity ?? 0.6) * (0.5 + 0.5 * Math.sin(t * 1.5 + p.p));
            c.beginPath(); c.arc(x, y, p.r, 0, Math.PI * 2); c.fill();
          }
        });
        return kit;
      },

      barChart(target, data, o = {}) {
        const host = one(target);
        if (!host || !data?.length) return kit;
        const W = o.width || host.clientWidth || 1200, H = o.height || host.clientHeight || 620;
        const horizontal = !!o.horizontal;
        const m = { t: 40, r: horizontal ? 160 : 30, b: horizontal ? 20 : 90, l: horizontal ? 260 : 30 };
        const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', '100%').attr('class', 'k-chart');
        const max = o.max ?? d3.max(data, d => d.value) * 1.08;
        const band = d3.scaleBand().domain(data.map(d => d.label)).range(horizontal ? [m.t, H - m.b] : [m.l, W - m.r]).padding(0.28);
        const val = d3.scaleLinear().domain([Math.min(0, d3.min(data, d => d.value)), max]).range(horizontal ? [m.l, W - m.r] : [H - m.b, m.t]);
        const color = (d, i) => d.color || (o.highlight != null && (o.highlight === i || o.highlight === d.label) ? (tokens.accent || '#fb0') : (o.color || tokens.primary || '#58f'));
        const at = clampT(o.at ?? 0), dur = o.dur ?? 1.2, stg = o.stagger ?? 0.12, dec = o.decimals ?? 0;
        const fmt = v => (o.prefix || '') + formatNumber(v, dec) + (o.unit || '');
        svg.append('g').selectAll('line').data(val.ticks(4)).join('line')
          .attr(horizontal ? 'x1' : 'y1', d => val(d)).attr(horizontal ? 'x2' : 'y2', d => val(d))
          .attr(horizontal ? 'y1' : 'x1', horizontal ? m.t : m.l).attr(horizontal ? 'y2' : 'x2', horizontal ? H - m.b : W - m.r)
          .attr('stroke', 'var(--line)').attr('stroke-width', 2);
        data.forEach((d, i) => {
          const g = svg.append('g');
          const zero = val(0);
          const rect = g.append('rect').attr('rx', 10).attr('fill', color(d, i));
          const label = g.append('text').text(d.label).attr('fill', 'var(--text)').attr('font-size', o.labelSize || 34).attr('font-weight', 600).attr('font-family', 'var(--font-body)');
          const value = g.append('text').attr('fill', 'var(--text)').attr('font-size', o.valueSize || 40).attr('font-weight', 800).attr('font-family', 'var(--font-display)');
          const start = at + i * stg;
          if (horizontal) {
            const y = band(d.label), h = band.bandwidth();
            rect.attr('x', zero).attr('y', y).attr('height', h).attr('width', 0);
            label.attr('x', m.l - 24).attr('y', y + h / 2).attr('text-anchor', 'end').attr('dominant-baseline', 'middle');
            value.attr('y', y + h / 2).attr('dominant-baseline', 'middle');
            tl.to(rect.node(), { attr: { width: Math.abs(val(d.value) - zero) }, duration: dur, ease: 'power3.out' }, start);
            frameFns.push(t => { const p = gsap.parseEase('power3.out')(Math.max(0, Math.min(1, (t - start) / dur))); value.attr('x', zero + Math.abs(val(d.value) - zero) * p + 18).text(fmt(d.value * p)).attr('opacity', p > 0 ? 1 : 0); });
          } else {
            const x = band(d.label), w = band.bandwidth();
            rect.attr('x', x).attr('width', w).attr('y', zero).attr('height', 0);
            label.attr('x', x + w / 2).attr('y', H - m.b + 50).attr('text-anchor', 'middle');
            value.attr('x', x + w / 2).attr('text-anchor', 'middle');
            tl.to(rect.node(), { attr: { y: val(Math.max(0, d.value)), height: Math.abs(val(d.value) - zero) }, duration: dur, ease: 'power3.out' }, start);
            frameFns.push(t => { const p = gsap.parseEase('power3.out')(Math.max(0, Math.min(1, (t - start) / dur))); value.attr('y', zero - Math.abs(val(d.value) - zero) * p - 18).text(fmt(d.value * p)).attr('opacity', p > 0 ? 1 : 0); });
          }
          tl.from(label.node(), { opacity: 0, duration: 0.4 }, start);
        });
        return kit;
      },

      lineChart(target, series, o = {}) {
        const host = one(target);
        if (!host || !series?.length) return kit;
        const W = o.width || host.clientWidth || 1400, H = o.height || host.clientHeight || 640;
        const m = { t: 40, r: 140, b: 70, l: 110 };
        const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', '100%').attr('class', 'k-chart');
        const all = series.flatMap(s => s.points);
        const x = d3.scaleLinear().domain(o.xDomain || d3.extent(all, p => p[0])).range([m.l, W - m.r]);
        const y = d3.scaleLinear().domain(o.yDomain || [Math.min(0, d3.min(all, p => p[1])), d3.max(all, p => p[1]) * 1.1]).nice().range([H - m.b, m.t]);
        const at = clampT(o.at ?? 0), dur = o.dur ?? 2.2;
        const axis = svg.append('g').attr('class', 'k-axis');
        y.ticks(5).forEach(v => {
          axis.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'var(--line)').attr('stroke-width', 2);
          axis.append('text').attr('x', m.l - 18).attr('y', y(v)).attr('text-anchor', 'end').attr('dominant-baseline', 'middle').attr('fill', 'var(--muted)').attr('font-size', 26).attr('font-family', 'var(--font-mono)').text((o.yPrefix || '') + formatNumber(v, o.yDecimals ?? 0) + (o.yUnit || ''));
        });
        (o.xTicks || x.ticks(Math.min(8, all.length))).forEach(v => {
          axis.append('text').attr('x', x(v)).attr('y', H - m.b + 44).attr('text-anchor', 'middle').attr('fill', 'var(--muted)').attr('font-size', 26).attr('font-family', 'var(--font-mono)').text(o.xFormat ? o.xFormat(v) : v);
        });
        tl.from(axis.node(), { opacity: 0, duration: 0.5 }, at);
        const palette = [tokens.primary, tokens.accent, tokens.accent2, tokens.danger, tokens.muted];
        series.forEach((s, i) => {
          const col = s.color || palette[i % palette.length];
          const line = d3.line().x(p => x(p[0])).y(p => y(p[1])).curve(o.curve === 'step' ? d3.curveStepAfter : d3.curveMonotoneX);
          if (o.area) {
            const area = d3.area().x(p => x(p[0])).y0(y(y.domain()[0])).y1(p => y(p[1])).curve(d3.curveMonotoneX);
            const a = svg.append('path').attr('d', area(s.points)).attr('fill', col).attr('opacity', 0.15);
            tl.from(a.node(), { opacity: 0, duration: 0.8 }, at + dur * 0.6);
          }
          const path = svg.append('path').attr('d', line(s.points)).attr('fill', 'none').attr('stroke', col).attr('stroke-width', s.width || 7).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
          const st = at + 0.3 + i * (o.seriesStagger ?? 0.4);
          tl.fromTo(path.node(), { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, ease: 'power1.inOut' }, st);
          const last = s.points[s.points.length - 1];
          const dot = svg.append('circle').attr('cx', x(last[0])).attr('cy', y(last[1])).attr('r', 12).attr('fill', col);
          const lab = svg.append('text').attr('x', x(last[0]) + 22).attr('y', y(last[1])).attr('dominant-baseline', 'middle').attr('fill', col).attr('font-size', 32).attr('font-weight', 800).attr('font-family', 'var(--font-display)').text(s.name || '');
          tl.from([dot.node(), lab.node()], { opacity: 0, scale: 0, transformOrigin: 'left center', duration: 0.4 }, st + dur);
        });
        (o.annotations || []).forEach((a, i) => {
          const g = svg.append('g');
          g.append('line').attr('x1', x(a.x)).attr('x2', x(a.x)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', a.color || tokens.accent).attr('stroke-width', 3).attr('stroke-dasharray', '10 10');
          g.append('text').attr('x', x(a.x) + 14).attr('y', m.t + 30 + (i % 2) * 44).attr('fill', a.color || tokens.accent).attr('font-size', 30).attr('font-weight', 700).attr('font-family', 'var(--font-body)').text(a.label);
          tl.from(g.node(), { opacity: 0, duration: 0.5 }, clampT(a.at ?? at + dur * 0.7));
        });
        return kit;
      },

      pieChart(target, data, o = {}) {
        const host = one(target);
        if (!host || !data?.length) return kit;
        const S = o.size || Math.min(host.clientWidth || 700, host.clientHeight || 700);
        const svg = d3.select(host).append('svg').attr('viewBox', `${-S / 2} ${-S / 2} ${S} ${S}`).attr('width', '100%').attr('height', '100%').attr('class', 'k-chart');
        const palette = [tokens.primary, tokens.accent, tokens.accent2, tokens.danger, tokens.muted, tokens.success];
        const pie = d3.pie().value(d => d.value).sort(null)(data);
        const r = S / 2 - 10, inner = o.donut === false ? 0 : r * 0.58;
        const arc = d3.arc().innerRadius(inner).outerRadius(r).cornerRadius(6).padAngle(0.012);
        const at = clampT(o.at ?? 0), dur = o.dur ?? 1.4;
        pie.forEach((p, i) => {
          const path = svg.append('path').attr('fill', data[i].color || palette[i % palette.length]);
          const start = at + (p.startAngle / (Math.PI * 2)) * dur;
          const span = ((p.endAngle - p.startAngle) / (Math.PI * 2)) * dur;
          frameFns.push(t => {
            const k = Math.max(0, Math.min(1, (t - start) / Math.max(0.05, span)));
            path.attr('d', k > 0 ? arc({ ...p, endAngle: p.startAngle + (p.endAngle - p.startAngle) * k }) : null);
          });
          if (o.labels !== false) {
            const c = d3.arc().innerRadius((inner + r) / 2).outerRadius((inner + r) / 2).centroid(p);
            const txt = svg.append('text').attr('x', c[0]).attr('y', c[1]).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', '#fff').attr('font-size', S * 0.05).attr('font-weight', 800).attr('font-family', 'var(--font-display)').text(data[i].text ?? `${formatNumber(data[i].value, o.decimals ?? 0)}${o.unit ?? '%'}`);
            tl.from(txt.node(), { opacity: 0, duration: 0.3 }, start + span);
          }
        });
        return kit;
      },

      /** World map. highlight: { "Vietnam": "#f00", "Mỹ": null (→ accent) }, focus: [lon, lat, zoom]. */
      worldMap(target, o = {}) {
        const host = one(target);
        // Zoomed-in regional views use the detailed 1:10m borders (1:110m looks wrong up close).
        const topo = (o.focus && (o.focus[2] ?? 3) >= 2.5 && window.__rt?.world10) || window.__rt?.world;
        if (!host || !topo) return kit;
        const W = o.width || host.clientWidth || 1600, H = o.height || host.clientHeight || 900;
        // drop wrongly wound rings (e.g. Maldives in the 1:10m set) — they would fill the whole map
        const features = topojson.feature(topo, topo.objects.countries).features.filter(f => d3.geoArea(f) < 2 * Math.PI);
        const proj = d3.geoNaturalEarth1();
        if (o.focus) {
          const [lon, lat, zoom = 3] = o.focus;
          proj.rotate([-lon, 0]).fitSize([W, H], { type: 'Sphere' });
          proj.scale(proj.scale() * zoom);
          const [px, py] = proj([lon, lat]), [tx, ty] = proj.translate();
          proj.translate([tx + W / 2 - px, ty + H / 2 - py]);
        } else proj.fitSize([W, H], { type: 'Sphere' });
        const path = d3.geoPath(proj);
        const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', '100%').attr('class', 'k-map');
        const hl = {};
        for (const [name, col] of Object.entries(o.highlight || {})) hl[COUNTRY_ALIASES[norm(name)] || name] = col || tokens.accent;
        const at = clampT(o.at ?? 0);
        const g = svg.append('g');
        features.forEach(f => {
          const isHl = hl[f.properties.name] !== undefined;
          const p = g.append('path').attr('d', path(f)).attr('fill', isHl ? hl[f.properties.name] : (o.land || 'var(--surface2)')).attr('stroke', o.border || 'var(--bg)').attr('stroke-width', 1.2);
          if (isHl) tl.from(p.node(), { fill: o.land || tokens.surface2, duration: 0.8 }, at + 0.4);
        });
        tl.from(g.node(), { opacity: 0, duration: 0.8 }, at);
        (o.labels || []).forEach((l, i) => {
          const [px, py] = proj([l.lon, l.lat]);
          const lg = svg.append('g');
          lg.append('circle').attr('cx', px).attr('cy', py).attr('r', 10).attr('fill', l.color || tokens.accent);
          lg.append('text').attr('x', px + 18).attr('y', py).attr('dominant-baseline', 'middle').attr('fill', 'var(--text)').attr('font-size', l.size || 34).attr('font-weight', 700).attr('font-family', 'var(--font-body)').attr('paint-order', 'stroke').attr('stroke', 'var(--bg)').attr('stroke-width', 8).text(l.text);
          tl.from(lg.node(), { opacity: 0, y: 10, duration: 0.5 }, clampT(l.at ?? at + 0.8 + i * 0.3));
        });
        return kit;
      },

      /** Horizontal timeline: items [{label:'1929', text:'Đại suy thoái'}]. */
      timeline(target, items, o = {}) {
        const host = one(target);
        if (!host || !items?.length) return kit;
        host.classList.add('k-timeline');
        host.innerHTML = `<div class="k-tl-line"></div>` + items.map(it => `<div class="k-tl-item"><div class="k-tl-dot"></div><div class="k-tl-label">${it.label}</div><div class="k-tl-text">${it.text || ''}</div></div>`).join('');
        const at = clampT(o.at ?? 0), stg = o.stagger ?? Math.min(1.2, (D - at - 1) / items.length);
        tl.from(host.querySelector('.k-tl-line'), { scaleX: 0, transformOrigin: 'left center', duration: 1, ease: 'power2.inOut' }, at);
        host.querySelectorAll('.k-tl-item').forEach((n, i) => tl.from(n, { opacity: 0, y: 30, duration: 0.5 }, clampT(items[i].at ?? at + 0.4 + i * stg)));
        return kit;
      },
    };
    if (window.Gfx) kit.gfx = window.Gfx.create({ ...ctx, clampT });
    if (window.Cartoon) window.Cartoon.extend(kit, { ...ctx, clampT });
    if (window.MG) window.MG.extend(kit, { ...ctx, clampT });
    return kit;
  };

  window.kitIconSvg = iconSvg;
})();
