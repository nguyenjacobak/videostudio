/* History & geography diagrams: battle/campaign map with moving forces, and a water-level cross-section (tides, floods,
 * sea-level rise). Geography is only ever drawn from real data (Natural Earth via world-atlas) — never invented. */
(function () {
  const FONT = "'Be Vietnam Pro',sans-serif";
  const COUNTRY_VI = { 'Việt Nam': 'Vietnam', 'Trung Quốc': 'China', 'Mỹ': 'United States of America', 'Hoa Kỳ': 'United States of America', 'Nhật Bản': 'Japan', 'Hàn Quốc': 'South Korea', 'Triều Tiên': 'North Korea', 'Lào': 'Laos', 'Campuchia': 'Cambodia', 'Thái Lan': 'Thailand', 'Nga': 'Russia', 'Pháp': 'France', 'Anh': 'United Kingdom', 'Đức': 'Germany', 'Ấn Độ': 'India', 'Mông Cổ': 'Mongolia', 'Ukraina': 'Ukraine', 'Ba Lan': 'Poland', 'Ý': 'Italy', 'Tây Ban Nha': 'Spain', 'Ai Cập': 'Egypt', 'Úc': 'Australia', 'Singapore': 'Singapore', 'Indonesia': 'Indonesia', 'Philippines': 'Philippines', 'Malaysia': 'Malaysia', 'Myanmar': 'Myanmar' };
  const countryName = n => COUNTRY_VI[n] || n;

  // Earth icons show REAL continents (Natural Earth 1:110m). Without map data only the ocean sphere is drawn — never invented land.
  const earthCache = {};
  function earthSvg(r, o = {}) {
    const topo = window.__rt?.world;
    let land = '', lon = o.lon ?? 105, lat = o.lat ?? 12;
    if (topo && window.topojson && window.d3) {
      const feats = topojson.feature(topo, topo.objects.countries).features, want = o.country ? countryName(o.country) : null;
      const focus = want ? feats.find(f => f.properties.name === want) : null;
      if (focus) [lon, lat] = d3.geoCentroid(focus);
      const key = [r, lon.toFixed(1), lat.toFixed(1), want].join('|');
      land = earthCache[key] ||= (() => {
        const path = d3.geoPath(d3.geoOrthographic().scale(r).translate([0, 0]).rotate([-lon, -Math.max(-50, Math.min(50, lat))]).clipAngle(90));
        return feats.filter(f => d3.geoArea(f) < 2 * Math.PI).map(f => { const d = path(f); return d ? `<path d="${d}" fill="${f === focus ? '#f08a3c' : '#6fbf73'}" stroke="${f === focus ? '#b55a1c' : '#3f8a4a'}" stroke-width="0.5"/>` : ''; }).join('');
      })();
    }
    return `<circle r="${r}" fill="#3b82d6"/>${land}<circle r="${r}" fill="none" stroke="#2a5fa8" stroke-width="3"/><path d="M${-r * 0.62},${-r * 0.5} A${r * 0.85},${r * 0.85} 0 0 1 ${r * 0.05},${-r * 0.86}" stroke="#fff" stroke-width="${r * 0.1}" fill="none" opacity=".25" stroke-linecap="round"/>`;
  }
  window.Gfx.register({ globe: o => earthSvg(94, o), earth: o => earthSvg(80, o) });
  // Invented geography is not allowed: no fake treasure/river maps.
  delete window.Gfx.OBJ['treasure-map'];
  delete window.Gfx.OBJ['river-map'];
  window.Gfx.extend((gfx, I) => {
    const { tl, frameFns, T, getLayer, mk, C, shade, pal, OBJ, resolve } = I;
    const g0 = (cls, p) => mk('g', { class: cls }, p || getLayer());
    const text = (p, x, y, s, str, fill = C.ink, w = 800, halo) => { const t = mk('text', { x, y, 'font-size': s, 'font-weight': w, fill, 'text-anchor': 'middle', 'font-family': FONT }, p); if (halo) { t.setAttribute('stroke', halo); t.setAttribute('stroke-width', 7); t.setAttribute('paint-order', 'stroke'); t.setAttribute('stroke-linejoin', 'round'); } t.textContent = str; return t; };
    const itemSvg = (name, size, o = {}) => { const k = resolve(name) || 'box'; return `<g transform="scale(${size / 200}) translate(0,-100)">${OBJ[k]({ ...o })}</g>`; };
    const SIDE = { red: C.red, blue: C.blue, green: C.teal, gold: C.goldD, purple: C.purple };
    let clipN = 0;

    Object.assign(gfx, {
      /**
       * Campaign / battle map. With region ({ center: [lon, lat], km } or { lon: [w, e], lat: [s, n] }) it draws the REAL
       * coastline and borders and every position is [lon, lat]; without region it is a schematic board (no terrain), positions in %.
       * units: [{ side, item, count, from, to, at, dur, label }], marks: [{ item?, pos, label, at }], highlight: [country]
       */
      battleMap(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), X = z.x0 + 10, Y = z.y0, W = z.w - 20, H = z.h - 10;
        const g = g0('gfx-battlemap'), t0 = T(o.at), cid = 'bm' + (++clipN);
        const defs = mk('defs', {}, g); const cp = mk('clipPath', { id: cid }, defs); mk('rect', { x: X, y: Y, width: W, height: H, rx: 24 }, cp);
        const mapG = mk('g', { 'clip-path': `url(#${cid})` }, g);
        let P, land = '#eadcb8';
        const topo = window.__rt?.world10 || window.__rt?.world;
        if (o.terrain || o.riverLabel) window.__rt?.warn?.('battleMap: đã bỏ địa hình tự vẽ (terrain/riverLabel) vì không chính xác — dùng region: { center: [kinh độ, vĩ độ], km } để có bản đồ thật (bờ biển, biên giới), hoặc bỏ trống để thành sơ đồ chiến thuật không địa hình.');
        if (o.region && topo && window.topojson && window.d3) {
          // Real basemap (Natural Earth): sea, land, country borders. Positions are [longitude, latitude].
          const r = o.region, half = (r.km || 200) / 111 / 2;
          const [w, e, sLat, nLat] = r.lon && r.lat ? [r.lon[0], r.lon[1], r.lat[0], r.lat[1]] : [r.center[0] - half / Math.cos((r.center[1] * Math.PI) / 180) * (W / H), r.center[0] + half / Math.cos((r.center[1] * Math.PI) / 180) * (W / H), r.center[1] - half, r.center[1] + half];
          const proj = d3.geoMercator().fitExtent([[X, Y], [X + W, Y + H]], { type: 'MultiPoint', coordinates: [[w, sLat], [e, nLat]] });
          proj.clipExtent([[X - 20, Y - 20], [X + W + 20, Y + H + 20]]);
          const path = d3.geoPath(proj), [[vw, vs], [ve, vn]] = [proj.invert([X, Y + H]), proj.invert([X + W, Y])];
          mk('rect', { x: X, y: Y, width: W, height: H, fill: '#a9cdee' }, mapG);
          const hl = new Set((o.highlight || []).map(countryName));
          for (const f of topojson.feature(topo, topo.objects.countries).features) {
            // only countries that touch the visible window (far-away shapes can project into giant fills)
            if (d3.geoArea(f) > 2 * Math.PI) continue; // wrongly wound ring (e.g. Maldives) = whole globe minus the island
            const [[bw, bs], [be, bn]] = d3.geoBounds(f);
            if (bw <= be && (be < vw || bw > ve)) continue;
            if (bn < vs || bs > vn) continue;
            const d = path(f); if (!d) continue;
            mk('path', { d, 'data-country': f.properties.name, fill: hl.has(f.properties.name) ? '#f6d7a7' : land, stroke: '#9b8a66', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, mapG);
          }
          P = (a, b) => proj([a, b]);
          const sg = mk('g', {}, g); text(sg, X + W - 16, Y + H - 14, 18, 'Bản đồ: Natural Earth', '#51606f', 600).setAttribute('text-anchor', 'end');
        } else {
          if (o.region) window.__rt?.warn?.('battleMap: chưa tải được dữ liệu bản đồ khu vực — hiển thị sơ đồ chiến thuật');
          // Schematic board: no invented rivers or coastlines, just a grid to move forces on. Positions are % of the board.
          land = '#efe4c8';
          mk('rect', { x: X, y: Y, width: W, height: H, fill: land }, mapG);
          for (let i = 1; i < 12; i++) mk('line', { x1: X + (W * i) / 12, x2: X + (W * i) / 12, y1: Y, y2: Y + H, stroke: '#cdbb91', 'stroke-width': 2, 'stroke-dasharray': '4 10' }, mapG);
          for (let i = 1; i < 7; i++) mk('line', { x1: X, x2: X + W, y1: Y + (H * i) / 7, y2: Y + (H * i) / 7, stroke: '#cdbb91', 'stroke-width': 2, 'stroke-dasharray': '4 10' }, mapG);
          P = (px, py) => [X + (px / 100) * W, Y + (py / 100) * H];
          const sg = mk('g', {}, g); text(sg, X + W - 16, Y + H - 14, 20, 'Sơ đồ minh họa', '#8a7a5a', 700).setAttribute('text-anchor', 'end');
        }
        const shade2 = shade;
        mk('rect', { x: X, y: Y, width: W, height: H, rx: 24, fill: 'none', stroke: shade2(land, -0.35), 'stroke-width': 6 }, g);
        // Label placement: every label tries below / above / right / left of its object and takes the first spot
        // that stays inside the map and clears all labels (and mark icons) placed before it.
        const box = (x, y, str, fs) => ({ x0: x - str.length * fs * 0.3, x1: x + str.length * fs * 0.3, y0: y - fs, y1: y + fs * 0.3 });
        const hits = (b, list) => list.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
        const inside = b => b.x0 > X + 6 && b.x1 < X + W - 6 && b.y0 > Y + 6 && b.y1 < Y + H - 6;
        const place = (x, y, hw, hh, str, fs, list) => {
          const tw = str.length * fs * 0.3;
          const c = [[x, y + hh + fs], [x, y - hh - 8], [x + hw + tw + 10, y + fs * 0.35], [x - hw - tw - 10, y + fs * 0.35], [x, y + hh + fs * 2.2], [x, y - hh - fs * 1.3]];
          for (const [cx, cy] of c) { const b = box(cx, cy, str, fs); if (inside(b) && !hits(b, list)) return [cx, cy, b]; }
          return [c[0][0], c[0][1], box(c[0][0], c[0][1], str, fs)];
        };
        const staticBoxes = [];
        tl.fromTo(g, { opacity: 0, scale: 0.94, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, t0);
        const markLabels = [];
        (o.marks || []).forEach((m, i) => {
          const [mx, my] = m.pos ? P(...m.pos) : P(m.x, m.y), mg = g0('', g), at = T(m.at ?? t0 + 0.6 + i * 0.3);
          const ms = m.item ? m.size || 90 : 24;
          if (m.item) mg.insertAdjacentHTML('beforeend', `<g transform="translate(${mx},${my + ms / 2})">${itemSvg(m.item, ms, m)}</g>`);
          else { mk('circle', { cx: mx, cy: my, r: 11, fill: C.ink, stroke: '#fff', 'stroke-width': 4 }, mg); }
          staticBoxes.push({ x0: mx - ms / 2, x1: mx + ms / 2, y0: my - ms / 2, y1: my + ms / 2 });
          if (m.label) markLabels.push({ mx, my, half: ms / 2, str: m.label, at });
          tl.fromTo(mg, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, at);
        });
        const unitList = [];
        const units = (o.units || []).map((u, i) => {
          const col = SIDE[u.side] || pal(u.side) || C.red, [fx, fy] = P(...u.from), [tx, ty] = u.to ? P(...u.to) : [fx, fy];
          const at = T(u.at ?? t0 + 0.8 + i * 0.4), dur = u.dur || 2, size = u.size || 84, n = u.count || 3;
          const ug = g0('', g);
          const flag = mk('g', {}, ug);
          if (u.to) {
            const mxp = (fx + tx) / 2 + (ty - fy) * 0.15, myp = (fy + ty) / 2 - (tx - fx) * 0.15;
            const path = mk('path', { d: `M${fx},${fy} Q${mxp},${myp} ${tx},${ty}`, stroke: col, 'stroke-width': 8, fill: 'none', 'stroke-dasharray': '18 12', opacity: 0.85 }, g);
            tl.fromTo(path, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, ease: 'none' }, at);
            const ang = Math.atan2(ty - myp, tx - mxp), hs = 26;
            const head = mk('path', { d: `M${tx},${ty} L${tx - hs * Math.cos(ang - 0.5)},${ty - hs * Math.sin(ang - 0.5)} L${tx - hs * Math.cos(ang + 0.5)},${ty - hs * Math.sin(ang + 0.5)} Z`, fill: col }, g);
            tl.fromTo(head, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at + dur);
          }
          for (let k = 0; k < n; k++) { const ox = (k - (n - 1) / 2) * size * 0.75, oy = (k % 2) * size * 0.25; flag.insertAdjacentHTML('beforeend', `<g transform="translate(${ox},${oy + size / 2})">${itemSvg(u.item || 'ancient-soldier', size, { flag: col, color: u.color })}</g>`); }
          mk('circle', { cx: 0, cy: -size * 0.1, r: size * 0.18, fill: col, opacity: 0 }, flag);
          const st = { k: 0 };
          if (u.to) tl.to(st, { k: 1, duration: dur, ease: 'power1.inOut' }, at);
          const lab = u.label ? text(ug, 0, 0, 28, u.label, col, 900, '#fff') : null;
          const unit = { lab, str: u.label, hw: ((n - 1) / 2 * 0.75 + 0.5) * size, hh: size * 0.75, x: fx, y: fy, at };
          frameFns.push(t => {
            const k = st.k, mx = (fx + tx) / 2 + (ty - fy) * 0.15, my = (fy + ty) / 2 - (tx - fx) * 0.15;
            const x = (1 - k) * (1 - k) * fx + 2 * (1 - k) * k * mx + k * k * tx, y = (1 - k) * (1 - k) * fy + 2 * (1 - k) * k * my + k * k * ty;
            flag.setAttribute('transform', `translate(${x},${y})`);
            unit.x = x; unit.y = y;
            ug.setAttribute('opacity', t >= at - 0.4 ? Math.min(1, (t - at + 0.4) / 0.3) : 0);
          });
          unitList.push(unit);
          return { el: ug, hide: (when, d = 0.4) => { unit.hideAt = T(when); tl.to(ug, { opacity: 0, duration: d }, T(when)); } };
        });
        // mark labels on top of everything so moving units never cover them
        markLabels.forEach(m => {
          const [lx, ly, b] = place(m.mx, m.my, m.half, m.half, m.str, 26, staticBoxes); staticBoxes.push(b);
          const t = text(g, lx, ly, 26, m.str, C.ink, 800, '#fff'); tl.fromTo(t, { opacity: 0 }, { opacity: 1, duration: 0.4 }, m.at);
        });
        frameFns.push(t => {
          const taken = staticBoxes.slice();
          unitList.forEach(u => {
            if (!u.lab || t < u.at - 0.4 || (u.hideAt != null && t > u.hideAt + 0.5)) return;
            const [lx, ly, b] = place(u.x, u.y, u.hw, u.hh, u.str, 28, taken); taken.push(b);
            u.lab.setAttribute('x', lx); u.lab.setAttribute('y', ly);
          });
        });
        return { el: g, units };
      },

      /** Cross-section of water: level animates through levels [{at, value 0..1, label}]; objects float or stay fixed. */
      waterLevel(o = {}) {
        if (!o._nested) gfx._begin(o);
        const z = gfx.zone(), X = z.x0 + 20, W = z.w - 40, top = z.y0 + 40, bed = z.y1 - 30, H = bed - top;
        const g = g0('gfx-water-level'), t0 = T(o.at);
        const ground = `M${X},${bed} ${Array.from({ length: 9 }, (_, i) => `L${X + (i / 8) * W},${bed - 24 - Math.sin(i * 1.3) * 16}`).join(' ')} L${X + W},${bed + 40} L${X},${bed + 40} Z`;
        const water = mk('rect', { x: X, y: bed - H * 0.5, width: W, height: H, fill: '#4f8ef7', opacity: 0.55 }, g);
        const surface = mk('path', { fill: 'none', stroke: '#2f63c9', 'stroke-width': 6 }, g);
        mk('path', { d: ground, fill: '#a67c52' }, g);
        const st = { v: o.levels?.[0]?.value ?? 0.5 };
        (o.levels || []).slice(1).forEach(l => tl.to(st, { v: l.value, duration: l.dur || 1.6, ease: 'sine.inOut' }, T(l.at)));
        const objs = (o.objects || []).map((ob, i) => {
          const og = g0('', g), size = ob.size || 150, x = X + (ob.x / 100) * W;
          og.innerHTML = itemSvg(ob.item, size, ob);
          return { og, x, size, floats: ob.floats !== false && !/stake|coc/.test(ob.item), at: T(ob.at ?? t0 + 0.4 + i * 0.3) };
        });
        const levelLabel = o.showLevel !== false ? text(g, X + W - 90, 0, 34, '', '#1f3f7a', 900) : null;
        if (levelLabel) { levelLabel.setAttribute('stroke', '#fff'); levelLabel.setAttribute('stroke-width', 6); levelLabel.setAttribute('paint-order', 'stroke'); }
        tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.6 }, t0);
        frameFns.push(t => {
          const yS = bed - 30 - st.v * (H - 60);
          water.setAttribute('y', yS); water.setAttribute('height', bed + 40 - yS);
          surface.setAttribute('d', `M${X},${yS} ${Array.from({ length: 13 }, (_, i) => `L${X + (i / 12) * W},${yS + Math.sin(t * 2 + i) * 5}`).join(' ')}`);
          objs.forEach(ob => {
            const y = ob.floats ? yS + 6 + Math.sin(t * 2 + ob.x) * 4 : bed - 20;
            ob.og.setAttribute('transform', `translate(${ob.x},${y})`);
            ob.og.setAttribute('opacity', t >= ob.at ? 1 : 0);
          });
          if (levelLabel) { const cur = (o.levels || []).filter(l => t >= T(l.at ?? t0)).pop(); levelLabel.textContent = cur?.label || ''; levelLabel.setAttribute('y', yS - 18); }
        });
        return { el: g };
      },
    });
  });
})();
