/* More layout recipes so scenes don't all look like "a row of icons with arrows":
 * chain (redesigned: zig-zag steps on plates, travelling connector, focus on the current step), hub (centre + spokes),
 * tree (one → many / many → one), callouts (annotated object), sizes (true-proportion size comparison),
 * fill (an object filling up to a percentage). Same rules as the core recipes: the AI says WHAT, the layout decides WHERE. */
(function () {
  const FONT = "'Be Vietnam Pro',sans-serif";
  const STEP_COLORS = ['#4f8ef7', '#2bb3a3', '#f08a3c', '#9b6bd6', '#e8574b'];
  let uidN = 0;

  window.Gfx.extend((gfx, I) => {
    const { tl, frameFns, T, getLayer, appear, mk, handle, placed, resolve, OBJ, C, pal } = I;
    const text = (p, x, y, s, str, fill = C.ink, o = {}) => {
      const t = mk('text', { x, y, 'font-size': s, 'font-weight': o.weight || 800, fill, 'text-anchor': o.anchor || 'middle', 'font-family': FONT }, p);
      if (o.halo) { t.setAttribute('stroke', o.halo); t.setAttribute('stroke-width', 7); t.setAttribute('paint-order', 'stroke'); t.setAttribute('stroke-linejoin', 'round'); }
      t.textContent = str;
      return t;
    };
    const objSvg = (name, o = {}) => { const k = resolve(name); if (!k) window.__rt?.warn?.(`Đồ họa không có: "${name}"`); return OBJ[k || 'box']({ ...o, color: pal(o.color) }); };
    const drawOn = (el, at, dur = 0.6) => tl.fromTo(el, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, ease: 'power2.inOut' }, T(at));
    const head = (p, x, y, ang, col, s = 22) => mk('path', { d: `M${x + Math.cos(ang) * 4},${y + Math.sin(ang) * 4} L${x - s * Math.cos(ang - 0.5)},${y - s * Math.sin(ang - 0.5)} L${x - s * Math.cos(ang + 0.5)},${y - s * Math.sin(ang + 0.5)} Z`, fill: col }, p);
    const pillW = (str, fs) => Math.max(90, String(str).length * fs * 0.56 + fs * 1.2);

    /** Round plate with an object inside (+ optional number badge). Returns { outer, x, y, R }. */
    function plate(it, x, y, R, col, at, num) {
      const [outer, g] = placed('gfx-plate', `translate(${x},${y})`);
      mk('circle', { r: R + 12, fill: col, opacity: 0.16 }, g);
      mk('circle', { r: R, fill: '#fff', stroke: col, 'stroke-width': Math.max(5, R * 0.07) }, g);
      const inner = mk('g', { transform: `scale(${(R * 1.45) / 200})` }, g);
      inner.innerHTML = objSvg(it.item, it);
      if (num != null) {
        const b = mk('g', { transform: `translate(${-R * 0.74},${-R * 0.74})` }, g);
        mk('circle', { r: Math.max(20, R * 0.2), fill: col, stroke: '#fff', 'stroke-width': 5 }, b);
        text(b, 0, Math.max(20, R * 0.2) * 0.36, Math.max(22, R * 0.22), String(num), '#fff', { weight: 900 });
      }
      appear(outer, at, it.anim || 'pop');
      return { outer, x, y, R };
    }

    Object.assign(gfx, {
      /** Cause → effect steps (2–5) on a gentle zig-zag; each link draws itself carrying a token; earlier steps dim while the current one speaks. */
      chain(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), items = o.items || [], n = Math.max(1, items.length);
        const slot = z.w / n, R = Math.max(62, Math.min((o.size || 230) * 0.62, slot * 0.3, z.h * 0.2));
        const amp = n >= 3 ? Math.min(z.h * 0.15, 100) : 0, t0 = T(o.at), stg = o.stagger ?? 0.9;
        const ats = items.map((it, i) => T(it.at ?? t0 + i * stg));
        const nodes = items.map((it, i) => {
          const x = z.x0 + slot * (i + 0.5), y = z.cy - 10 + (n >= 3 ? (i % 2 ? amp : -amp) : 0), col = pal(it.color) || STEP_COLORS[i % STEP_COLORS.length];
          const nd = plate(it, x, y, R, col, ats[i], o.numbers === false ? null : i + 1);
          if (it.label) gfx.label(it.label, { x, y: y + R + 44, at: ats[i] + 0.25, size: Math.max(26, Math.min(36, slot / 8)) });
          return { ...nd, col };
        });
        const links = [];
        for (let i = 0; i < n - 1; i++) {
          const a = nodes[i], b = nodes[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
          const sx = a.x + ux * (a.R + 16), sy = a.y + uy * (a.R + 16), ex = b.x - ux * (b.R + 26), ey = b.y - uy * (b.R + 26);
          const bend = amp ? 0.12 : 0.18, mx = (sx + ex) / 2 - uy * d * bend * (i % 2 ? -1 : 1), my = (sy + ey) / 2 + ux * d * bend * (i % 2 ? -1 : 1);
          const g = mk('g', { class: 'gfx-link' }, getLayer());
          const path = mk('path', { d: `M${sx},${sy} Q${mx},${my} ${ex},${ey}`, fill: 'none', stroke: a.col, 'stroke-width': 10, 'stroke-linecap': 'round' }, g);
          const hd = head(g, ex, ey, Math.atan2(ey - my, ex - mx), a.col, 26);
          const at = ats[i + 1] - 0.55;
          drawOn(path, at, 0.5);
          tl.fromTo(hd, { opacity: 0 }, { opacity: 1, duration: 0.15 }, at + 0.45);
          // one traveller rides the link while it draws — reads as "this causes that"
          const tok = mk('g', { opacity: 0 }, g), ts = Math.max(40, R * 0.5);
          tok.innerHTML = o.token || items[i].token ? `<g transform="scale(${ts / 200})">${objSvg(items[i].token || o.token)}</g>` : `<circle r="12" fill="${a.col}" stroke="#fff" stroke-width="4"/>`;
          const len = () => path.getTotalLength();
          frameFns.push(t => {
            const k = (t - at) / 0.5;
            if (k < 0 || k > 1.25) { tok.setAttribute('opacity', 0); return; }
            const p = path.getPointAtLength(Math.min(1, k) * len());
            tok.setAttribute('transform', `translate(${p.x},${p.y})`);
            tok.setAttribute('opacity', k > 1 ? (1.25 - k) * 4 : 1);
          });
          if (o.token || items[i].token) gfx.stream(path, { item: items[i].token || o.token, at: ats[n - 1] + 0.8, size: ts, count: 2, speed: 0.4 });
          links.push({ el: g, path });
        }
        if (o.focus !== false && n >= 3) {
          nodes.slice(0, -1).forEach((nd, i) => tl.to(nd.outer, { opacity: 0.45, duration: 0.3 }, ats[i + 1]));
          tl.to(nodes.slice(0, -1).map(nd => nd.outer), { opacity: 1, duration: 0.4 }, T(o.overviewAt ?? ats[n - 1] + 1.6));
        }
        return { items: nodes.map(nd => handle(nd.outer, nd)), links };
      },

      /** Hub & spokes: a centre idea with 3–6 related things around it (inward: factors → centre; default: centre → effects). */
      hub(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), items = o.items || [], n = Math.max(1, items.length), t0 = T(o.at), stg = o.stagger ?? 0.55;
        const cx = z.cx, cy = z.cy + 10, rx = z.w * 0.36, ry = z.h * 0.34, Rc = Math.min(120, z.h * 0.17), Rs = Math.max(52, Math.min(86, z.h * 0.11, (rx * 2) / n * 0.35));
        const center = plate(o.center || { item: 'lightbulb' }, cx, cy, Rc, pal(o.color) || C.orange, t0);
        if (o.center?.label) gfx.label(o.center.label, { x: cx, y: cy + Rc + 40, at: t0 + 0.3, size: 34, color: pal(o.color) || C.orange });
        const sats = items.map((it, i) => {
          const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (n % 2 ? 0 : Math.PI / n), x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
          const at = T(it.at ?? t0 + 0.7 + i * stg), col = pal(it.color) || STEP_COLORS[i % STEP_COLORS.length];
          const d = Math.hypot(x - cx, y - cy), ux = (x - cx) / d, uy = (y - cy) / d;
          const [p1, p2] = o.inward ? [[x - ux * (Rs + 10), y - uy * (Rs + 10)], [cx + ux * (Rc + 20), cy + uy * (Rc + 20)]] : [[cx + ux * (Rc + 10), cy + uy * (Rc + 10)], [x - ux * (Rs + 20), y - uy * (Rs + 20)]];
          const g = mk('g', { class: 'gfx-spoke' }, getLayer());
          const line = mk('path', { d: `M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`, stroke: col, 'stroke-width': 8, 'stroke-linecap': 'round', fill: 'none' }, g);
          const hd = head(g, p2[0], p2[1], Math.atan2(p2[1] - p1[1], p2[0] - p1[0]), col, 20);
          drawOn(line, at - 0.35, 0.35);
          tl.fromTo(hd, { opacity: 0 }, { opacity: 1, duration: 0.12 }, at - 0.02);
          const nd = plate(it, x, y, Rs, col, at);
          if (it.label) gfx.label(it.label, { x, y: y + (uy < -0.3 ? -Rs - 34 : Rs + 38), at: at + 0.2, size: 28 });
          return handle(nd.outer, nd);
        });
        return { center: handle(center.outer, center), items: sats };
      },

      /** One root fanning out to 2–5 results (or merge:true → many causes converging into one). Labels sit beside each leaf. */
      tree(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), items = o.items || [], n = Math.max(1, items.length), t0 = T(o.at), stg = o.stagger ?? 0.6, merge = !!o.merge;
        const Rr = Math.min(120, z.h * 0.18), Rl = Math.max(44, Math.min(78, (z.h - 40) / n * 0.34));
        const rootX = merge ? z.x1 - Rr - 30 : z.x0 + Rr + 30, leafX = merge ? z.x0 + z.w * 0.36 : z.x0 + z.w * 0.52, cy = z.cy + 10;
        const root = plate(o.root || { item: 'lightbulb' }, rootX, cy, Rr, pal(o.color) || C.orange, merge ? T(o.rootAt ?? t0 + n * stg + 0.3) : t0);
        if (o.root?.label) gfx.label(o.root.label, { x: rootX, y: cy + Rr + 42, at: (merge ? T(o.rootAt ?? t0 + n * stg + 0.3) : t0) + 0.25, size: 32, color: pal(o.color) || C.orange });
        const gap = (z.h - 40) / n, leaves = items.map((it, i) => {
          const y = z.y0 + 20 + gap * (i + 0.5), at = T(it.at ?? (merge ? t0 : t0 + 0.7) + i * stg), col = pal(it.color) || STEP_COLORS[i % STEP_COLORS.length];
          const [ax, bx] = merge ? [leafX + Rl + 10, rootX - Rr - 22] : [rootX + Rr + 10, leafX - Rl - 22];
          const [ay, by] = merge ? [y, cy] : [cy, y], mx = (ax + bx) / 2;
          const g = mk('g', { class: 'gfx-branch' }, getLayer());
          const path = mk('path', { d: `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`, stroke: col, 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' }, g);
          const hd = head(g, bx, by, 0, col, 20);
          const lineAt = merge ? at + 0.3 : at - 0.4;
          drawOn(path, lineAt, 0.4);
          tl.fromTo(hd, { opacity: 0 }, { opacity: 1, duration: 0.12 }, lineAt + 0.38);
          const nd = plate(it, leafX, y, Rl, col, at);
          if (it.label) {
            const fs = Math.max(24, Math.min(34, Rl * 0.5)), w = pillW(it.label, fs);
            const lx = merge ? leafX - Rl - 18 - w / 2 : leafX + Rl + 18 + w / 2;
            gfx.label(it.label, { x: lx, y, at: at + 0.2, size: fs, color: col });
          }
          return handle(nd.outer, nd);
        });
        return { root: handle(root.outer, root), items: leaves };
      },

      /**
       * One big object with labelled callouts. parts: [{ label, part: '<asset part id>' | x/y: % of the object box (0–100, top-left origin), at }].
       * Without part/x/y the leader just points at the object's edge (never at a guessed spot).
       */
      callouts(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), parts = o.parts || [], t0 = T(o.at), stg = o.stagger ?? 0.6;
        const size = Math.min(z.h * 0.85, z.w * 0.5, o.size || 900), cx = z.cx, cy = z.cy + 10;
        const h = gfx.item(o.item, { x: cx, y: cy + size / 2, size, at: t0, anim: o.anim || 'pop', color: o.color, shadow: false });
        // Wide/flat objects sit bottom-aligned in their square box: re-centre on the actual drawing and enlarge it to the area.
        let fit = { k: 1, bx: 0, by: 0, w: size, h: size };
        try {
          const pos = h.el.firstChild, b = pos.getBBox();
          if (b.width > 0 && b.height > 0) {
            fit = { k: Math.min(1.7, (z.w * 0.52) / b.width, (z.h * 0.78) / b.height), bx: b.x + b.width / 2, by: b.y + b.height / 2, w: b.width, h: b.height };
            pos.setAttribute('transform', `translate(${cx},${cy}) scale(${fit.k}) translate(${-fit.bx},${-fit.by})`);
          }
        } catch {}
        const toLayer = (px, py) => [cx + fit.k * (px - fit.bx), cy + fit.k * (py - fit.by)];
        const anchorOf = (p, i) => {
          if (p.part) {
            try {
              const el = h.el.querySelector(`[id="${p.part}"],[id$="-${p.part}"]`);
              // Measure relative to the object's own (un-animated) group: nested <svg> viewBoxes and the pop-in scale cancel out.
              const pos = h.el.firstChild, A = el && pos?.getScreenCTM(), B = el?.getScreenCTM();
              if (A && B) {
                const b = el.getBBox(), pt = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(A.inverse().multiply(B));
                if (b.width > 0 && Math.abs(pt.x - fit.bx) <= fit.w && Math.abs(pt.y - fit.by) <= fit.h) return [...toLayer(pt.x, pt.y), true];
              }
            } catch {}
          }
          if (p.x != null && p.y != null) return [...toLayer(fit.bx + (p.x / 100 - 0.5) * fit.w, fit.by + (p.y / 100 - 0.5) * fit.h), true];
          const a = (i / Math.max(1, parts.length)) * Math.PI * 2 - Math.PI / 2;
          return [cx + Math.cos(a) * fit.w * fit.k * 0.3, cy + Math.sin(a) * fit.h * fit.k * 0.3, false];
        };
        const list = parts.map((p, i) => { const [ax, ay, exact] = anchorOf(p, i); return { ...p, ax, ay, exact, side: p.side || (ax < cx ? 'left' : 'right'), at: T(p.at ?? t0 + 0.8 + i * stg) }; });
        const fs = 32;
        ['left', 'right'].forEach(side => {
          const col = list.filter(p => p.side === side).sort((a, b) => a.ay - b.ay);
          let prev = -1e9;
          col.forEach(p => {
            const half = (fit.w * fit.k) / 2, w = pillW(p.label, fs), y = Math.min(z.y1 - 30, Math.max(z.y0 + 30, Math.max(p.ay, prev + fs * 2.2)));
            prev = y;
            const lx = side === 'left' ? Math.max(z.x0 + w / 2, cx - half - 50 - w / 2) : Math.min(z.x1 - w / 2, cx + half + 50 + w / 2);
            const ex = side === 'left' ? lx + w / 2 + 6 : lx - w / 2 - 6, kx = side === 'left' ? ex + 30 : ex - 30;
            const g = mk('g', { class: 'gfx-callout' }, getLayer()), col2 = pal(p.color) || C.ink;
            const line = mk('path', { d: `M${p.ax},${p.ay} L${kx},${y} L${ex},${y}`, stroke: col2, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
            const dot = mk('circle', { cx: p.ax, cy: p.ay, r: p.exact ? 11 : 0, fill: col2, stroke: '#fff', 'stroke-width': 4 }, g);
            tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.2 }, p.at);
            drawOn(line, p.at + 0.1, 0.4);
            gfx.label(p.label, { x: lx, y, at: p.at + 0.4, size: fs, color: p.color });
            if (p.exact) tl.to(dot, { attr: { r: 16 }, duration: 0.2, yoyo: true, repeat: 1 }, p.at + 0.5);
          });
        });
        return { item: h };
      },

      /** True-proportion size comparison: items: [{ item, label, value }] drawn at sizes ∝ value (e.g. planet diameters). */
      sizes(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), items = (o.items || []).filter(it => Number(it.value) > 0), t0 = T(o.at), stg = o.stagger ?? 0.7;
        if (!items.length) return { items: [] };
        const max = Math.max(...items.map(it => +it.value)), H = Math.min(z.h - 170, 520);
        let px = items.map(it => (+it.value / max) * H);
        const totalW = px.reduce((a, s) => a + Math.max(s, 30), 0) + (items.length - 1) * 60;
        if (totalW > z.w - 40) { const k = (z.w - 40 - (items.length - 1) * 60) / (totalW - (items.length - 1) * 60); px = px.map(s => s * k); }
        const base = z.y1 - 90;
        let x = z.cx - (px.reduce((a, s) => a + Math.max(s, 30), 0) + (items.length - 1) * 60) / 2;
        const hs = items.map((it, i) => {
          const s = px[i], w = Math.max(s, 30), cx = x + w / 2, at = T(it.at ?? t0 + i * stg);
          x += w + 60;
          const tiny = s < 18;
          const h = gfx.item(it.item, { x: cx, y: base, size: Math.max(s, 6), at, anim: 'rise', color: it.color, shadow: false });
          if (tiny) { const g = mk('g', {}, getLayer()); mk('circle', { cx, cy: base - 3, r: 26, fill: 'none', stroke: C.red, 'stroke-width': 4, 'stroke-dasharray': '6 6' }, g); tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.3 }, at + 0.2); }
          const lab = it.label || '';
          if (lab) gfx.label(lab, { x: cx, y: base + 48, at: at + 0.25, size: 28 });
          if (it.valueLabel) { const g = mk('g', {}, getLayer()); text(g, cx, base - Math.max(s, 20) - 22, 28, it.valueLabel, C.ink, { halo: '#fff' }); tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.3 }, at + 0.4); }
          return h;
        });
        const g = mk('g', {}, getLayer());
        mk('line', { x1: z.x0 + 20, x2: z.x1 - 20, y1: base + 2, y2: base + 2, stroke: C.ink, 'stroke-opacity': 0.25, 'stroke-width': 4, 'stroke-dasharray': '2 12', 'stroke-linecap': 'round' }, g);
        tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.4 }, t0);
        if (o.note !== false) { const ng = mk('g', {}, getLayer()); text(ng, z.x1 - 20, z.y0 + 20, 22, 'đúng tỉ lệ', C.ink, { anchor: 'end' }).setAttribute('opacity', 0.55); tl.fromTo(ng, { opacity: 0 }, { opacity: 1, duration: 0.4 }, t0 + 0.4); }
        return { items: hs };
      },

      /** An object that fills up (from the bottom) to a share: value 0..1, levels: [{ at, value }] to animate later. */
      fill(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), size = Math.min(z.h * 0.62, z.w * 0.5, o.size || 440), cx = z.cx, cy = z.cy + 40, t0 = T(o.at);
        const col = pal(o.color) || C.orange, id = `gfx-fill-${++uidN}`;
        const [outer, g] = placed('gfx-fill', `translate(${cx},${cy}) scale(${size / 200})`);
        const ghost = mk('g', { opacity: 0.22 }, g); ghost.innerHTML = objSvg(o.item || 'person', { color: '#9aa3b2' });
        const defs = mk('defs', {}, g), cp = mk('clipPath', { id }, defs), rect = mk('rect', { x: -110, width: 220, y: 100, height: 0 }, cp);
        const full = mk('g', { 'clip-path': `url(#${id})` }, g); full.innerHTML = objSvg(o.item || 'person', { color: col });
        appear(outer, t0, 'pop');
        const st = { v: 0 }, levels = [{ at: (o.at ?? 0) + 0.4, value: o.value ?? 0.5 }, ...(o.levels || [])];
        levels.forEach(l => tl.to(st, { v: Math.max(0, Math.min(1, l.value)), duration: l.dur || 1.2, ease: 'power2.inOut' }, T(l.at)));
        const lg = mk('g', {}, getLayer()), num = text(lg, cx, cy - size / 2 - 30, 96, '', col, { weight: 900, halo: '#fff' });
        tl.fromTo(lg, { opacity: 0 }, { opacity: 1, duration: 0.3 }, t0 + 0.3);
        frameFns.push(() => { const h = st.v * 200; rect.setAttribute('y', 100 - h); rect.setAttribute('height', h); num.textContent = `${Math.round(st.v * 100)}%`; });
        if (o.label) gfx.label(o.label, { x: cx, y: cy + size / 2 + 46, at: t0 + 0.3, size: 34 });
        return { el: outer, to: (v, at, dur = 1.2) => tl.to(st, { v, duration: dur, ease: 'power2.inOut' }, T(at)) };
      },
    });
  });
})();
