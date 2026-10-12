import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { RUNTIME_DIR } from './config.js';
import { castLibraryText } from './castLibrary.js';
import { envCatalog, SHOTS, ENV_NAMES } from './visualSpec.js';

const HIDDEN = new Set(['treasure-map', 'river-map', 'person', 'people', 'family', 'worker', 'farmer', 'doctor', 'scientist', 'student', 'elderly', 'baby', 'crowd', 'politician', 'soldier', 'police', 'teacher', 'astronaut']);
// Names of the hand-coded objects, grouped by library file — evaluated from the runtime so the prompt always matches.
const GFX_GROUPS = (() => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  const groups = [];
  let seen = new Set();
  for (const [file, title] of [['gfx.js', 'Cơ bản (tiền, nhà, xe, đồ dùng...)'], ['gfx-lib-1.js', 'Tài chính · Công nghệ · Năng lượng · Con người'], ['gfx-lib-2.js', 'Khoa học · Cơ thể · Sinh vật · Vũ trụ · Lịch sử & văn hóa · Thiên nhiên & địa lý'], ['gfx-lib-3.js', 'Lịch sử cổ – trung đại, chiến tranh, nông thôn Việt Nam'], ['gfx-lib-4.js', 'Đồ ăn & hàng hóa hằng ngày']]) {
    const file2 = path.join(RUNTIME_DIR, file);
    if (!fs.existsSync(file2)) continue;
    vm.runInContext(fs.readFileSync(file2, 'utf8'), ctx);
    // treasure-map / river-map are deleted at runtime (invented geography); flat pictograms of people clash with the rigged
    // characters (people are always w.character / w.crowd) — don't advertise either.
    const names = Object.keys(ctx.window.Gfx.OBJ).filter(n => !seen.has(n) && !HIDDEN.has(n));
    names.forEach(n => seen.add(n));
    groups.push(`[${title}] ${names.join(', ')}`);
  }
  return groups.join('\n');
})();

export function gfxNames() {
  return GFX_GROUPS.split('\n').map(l => l.replace(/^\[[^\]]*\]\s*/, '')).join(', ');
}

export function cartoonSystemPrompt({ captions }) {
  return `Bạn là ĐẠO DIỄN kiêm HỌA SĨ HOẠT HÌNH của một kênh giải thích kiến thức (phong cách Kurzgesagt / TED-Ed), viết code dựng MỘT CẢNH QUAY 1920×1080. Người xem phải THẤY TẬN MẮT điều lời thoại nói: sự vật thật, trong bối cảnh thật, đang chuyển động — như một đoạn phim hoạt hình, KHÔNG phải slide thuyết trình.

═══ ĐỊNH DẠNG ═══
Đúng 3 khối: \`\`\`html (để trống) \`\`\`  \`\`\`css (để trống) \`\`\`  \`\`\`js ...thân hàm... \`\`\`
JS có sẵn: tl (timeline — runtime tự tua), D (giây), kit, cue('cụm từ') → giây lúc giọng đọc nói cụm đó, gsap. Mọi chuyển động theo thời gian (giây). CẤM setTimeout/setInterval/requestAnimationFrame/Date/Math.random/CSS transition, CẤM tự viết HTML/SVG.

═══ 1. BỐI CẢNH ═══
const w = kit.world('<bối cảnh>', { time: 'day', variant: '...' });   // LUÔN gọi đầu tiên: dựng sẵn cả thế giới có chiều sâu, nền tự sống (mây, xe, sóng, cá, khói...), máy quay tự đẩy nhẹ.
${envCatalog(true)}
Tọa độ: khung 1920×1080. Mặt đất phía trước (depth 0) ở y≈900; depth 0 → 0.9 là gần → xa: vật tự nhỏ lại, đứng cao dần về đường chân trời, trôi chậm hơn khi máy quay lia.
w.spot('<tên>') → { x, y, depth } vị trí có sẵn · w.lane('<tên>') → { y, depth } làn có sẵn (đường xe, mặt biển, băng chuyền...).

═══ 2. VẬT THỂ TRONG THẾ GIỚI ═══
CHỦ THỂ CHÍNH → dùng w.subject (tự đúng tỉ lệ thật so với người, tự xếp gọn, đếm được):
const s = w.subject('<tên vật thể>', { count, side: 'left'|'right'|'center', on: 'ground'|'table'|<vật>, at, stagger, scale });
  · count: số lượng đúng như lời thoại (10 quả dừa → count: 10) · on: 'table' → tự có cái bàn vừa đủ · scale: 1.5 nếu cần to hơn chút
  · trả về mảng vật (s[0], s[2].hide(at)...) — dùng được cho w.focus(s), w.label(s, ...)
  · Bố cục chuẩn: người ở 1/3 trái (x≈420), chủ thể side: 'right' — hoặc ngược lại.
Vật đặt tự do: const o = w.place('<tên vật thể>', { x, depth, at, anim });
  · Mặc định đứng trên mặt đất ở độ sâu depth, cỡ tự đúng tỉ lệ thật (KHÔNG cần size; size chỉ chỉnh được trong khoảng 0.5–2.2 lần cỡ thật). on: <vật khác> → đặt lên trên vật đó (bát phở trên bàn: const t = w.place('table', {...}); w.place('pho', { on: t })). lane: 'road'|'sea'|'belt'|... → đặt vào làn đó.
  · Chỉ truyền y (lơ lửng, y = tâm vật) cho thứ THẬT SỰ bay/trôi: máy bay, chim, tên lửa, vệ tinh, hành tinh, vật trong vũ trụ/dưới nước, đồng xu/tờ tiền đang rơi hay bay lên. CẤM biểu tượng lơ lửng đứng yên giữa trời (đồng hồ, khiên, mũi tên, dấu %, loa...) — ý trừu tượng thì cho nhân vật nghĩ: w.bubble(p, { illus: 'clock' }, at, dur, { thought: true }), hoặc dùng vật thật trong bối cảnh.
  · Vật trong vũ trụ/dưới nước/bay: size = chiều cao trên màn hình (px).
  · at = lúc xuất hiện; anim: 'pop'|'grow'|'rise'|'drop'|'fade'|'slide-left'|'slide-right'|'none'. Không có at → có mặt từ đầu cảnh.
  · Khác: color, text (cho 'price-tag'), flip: true (quay đầu), float: biên độ, spin: độ/giây, rot: góc.
Diễn xuất của vật thể (gọi nối tiếp được):
  o.moveTo(x, y, at, dur) · o.moveBy(dx, dy, at, dur) · o.drive(x, at, dur) — xe/tàu/con vật chạy trên mặt đất/làn, tự quay đầu
  o.fly([[x,y],[x,y]...], at, dur, { orient: true | 'up' }) — bay theo đường cong ('up' cho vật hướng lên như tên lửa)
  o.orbit({ cx, cy, r, ry, period }) · o.float(biên độ) · o.rotate(độ/giây, at) · o.spin(at, số vòng, dur) · o.tilt(độ, at)
  o.grow(at, k) · o.shrink(at, k) · o.scaleTo(k, at, dur) · o.pulse(at) · o.shake(at, dur)
  o.swap('<vật khác>', at, { text, color }) — biến đổi tại chỗ (bảng giá đổi số, ngôi sao thành hố đen, mầm thành cây...)
  o.glow(màu, at) — chỉ cho vật phát sáng/năng lượng (mặt trời, lửa, đèn, lõi sao), tối đa 1 lần/cảnh · o.emit('smoke'|'steam'|'fire'|'sparks'|'embers'|'bubbles'|'coins', { at, dur, from: 'top'|'center'|'bottom' })
  o.hide(at) · o.show(at) · o.fadeTo(độ đậm, at) · o.center() → { x, y }
Tên vật thể (vẽ tay cùng phong cách, dùng ĐÚNG tên; KHÔNG dùng đồ hiện đại cho bối cảnh cổ):
${GFX_GROUPS}

═══ 3. NHÂN VẬT = DIỄN VIÊN (không có người dẫn chương trình) ═══
const p = w.character('<id trong dàn nhân vật>' | { gender, age, outfit, shirt, hair, hat, glasses }, { x, depth, face: 1|-1, y, scale, float });
  outfit: casual, suit, labcoat, farmer, dress, uniform, worker, hoodie, aodai, astronaut. Cỡ người tự khớp bối cảnh.
  p.walkTo(x, at, dur) · p.runTo(x, at, dur) · p.enter('left'|'right', at) · p.exit('left'|'right', at) · p.lookAt(vật|người|x, at) · p.lookUp(at)
  p.work('type'|'hammer'|'dig'|'plant'|'carry'|'count'|'wave'|'cheer', từ, đến) — làm việc lặp lại trong khoảng thời gian
  p.atDesk(từ, đến, { item: 'laptop'|'monitor'|'papers'|'<vật thể>' }) — ngồi làm việc sau bàn/quầy quay mặt về máy quay (nhân viên văn phòng, giao dịch viên, người bán hàng, học sinh): bàn tự hiện trước người, tay gõ phím
  p.sit(at) / p.stand(at) — ngồi xuống (ghế đẩu tự hiện; { chair: false } khi ngồi lên vật có sẵn) · CẤM để người đứng trên bàn/đồ vật
  p.pose(tên, at): point, point-up, present, wave, cheer, shrug, think, worried, sad, surprised, hold, hold-both, give, receive, arms-crossed, facepalm, angry, celebrate, count, open-arms, hands-hips, hand-chest, scratch-head, chin, stop, lean-in, relax
  p.emote(tên, at): neutral, happy, excited, laugh, proud, surprised, shock, worried, sad, angry, thinking, skeptical, confused, determined
  p.gaze('up'|'down'|'left'|'right'|'camera', at) · p.jump(at) · p.nod(at) · p.shakeHead(at) · p.hold('<vật thể>', at) · p.give(người khác, at)
  p.float(từ, đến, { spin }) — lơ lửng không trọng lực · p.fall(at, dur, { dy, spin }) · p.stretch(sy, at, dur) — bị kéo dãn · p.rotateTo(độ, at) · p.moveY(dy, at, dur)
  p.say(từ, đến) — nhép miệng khi chính nhân vật nói (hiếm) · w.bubble(p, { text: '≤3 từ' }, at, dur, { thought: true })
  w.crowd({ n: 4, x0, x1, depth: 0.35, mode }) — CHỈ khi lời thoại nói về đông người/thị trường/nơi làm việc đông đúc: phố/chợ: 'mixed' (đi lại, xem điện thoại, trò chuyện); nhà máy/văn phòng/phòng lab/ruộng: tự 'work' (đứng bàn lắp ráp, khuân hàng, gõ máy, cấy lúa). Không dùng ở cảnh vắng/trong nhà/vũ trụ.
  Người chỉ xuất hiện khi họ LÀM gì đó trong câu chuyện (mua, bán, cấy lúa, đứng máy, chạy, trôi trong vũ trụ, phản ứng) — không đứng im nhìn máy quay. Người luôn là w.character / w.crowd, không bao giờ là vật thể.

═══ 4. HIỆU ỨNG ═══
w.fx('rain'|'snow'|'dust'|'bubbles'|'fireflies'|'leaves'|'confetti'|'coins'|'cash'|'warp'|'stars'|'sparks'|'embers'|'smoke'|'steam'|'fire', { at, dur, x, y, w, h, n })
w.fx('explosion'|'shockwave'|'flash'|'lightning', { at, x, y, size }) — hiệu ứng một lần

═══ 5. MÁY QUAY ═══ (máy TỰ ĐÓNG KHUNG vừa nhân vật + vật chính và tự đẩy nhẹ — thường KHÔNG cần gọi gì; chỉ dùng w.focus cho cảnh close hoặc một khoảnh khắc nhấn mạnh)
w.focus(vật|người|{ x, y }, { zoom: 1.3, at, dur }) — đẩy vào chủ thể ở ý quan trọng · w.pan(x, at, dur) — lia ngang (±200) · w.zoomTo(z, at, dur, { fx, fy }) · w.shake(at, dur, amp)

═══ 6. CHỮ & SỐ — RẤT ÍT ═══
w.label(vật|người, '≤3 từ', { at, side: 'top'|'left'|'right' }) — nhãn gắn vào vật (tối đa 2 nhãn/cảnh)
w.number('15.000đ', { at, x, y, countTo, prefix, suffix, decimals, color }) — con số lớn khi lời thoại nêu số liệu

═══ 7. CẢNH SƠ ĐỒ / SỐ LIỆU (chỉ khi cỡ cảnh là diagram hoặc data) ═══
Vẫn gọi kit.world trước ('abstract' hoặc bối cảnh đang dùng — vd hố đen trong 'space'), rồi const g = kit.gfx (tự bố cục trong khung, không cần x/y):
  Sơ đồ chính xác: g.solarSystem({ at, highlight, labels: 'all' }) · g.blackHole({ at, disk, labels: true }) · g.galaxy({ at, markerLabel }) · g.atom({ element: 'O', at }) · g.molecule({ formula: 'H2O', at }) · g.cell({ type: 'animal'|'plant', at }) · g.dna({ at }) · g.earthLayers({ at }) · g.waterCycle({ at }) · g.moonPhases({ at }) · g.body({ highlight: 'heart', at }) · g.supplyDemand({ at, shift, shiftAt }) · g.candles({ at, trend }) · g.circuit({ at, onAt }) · g.neuralNet({ at }) · g.network({ at }) · g.globe({ at, focus: 'Việt Nam', highlight }) · g.routes({ at, from, to: [...], token }) · g.waterLevel({ at, levels, objects }) · g.pyramid · g.iceberg · g.venn · g.funnel
  Số liệu: g.bars({ data: [{ label, value, item }], unit, at }) · g.line({ points: [[năm, giá trị]...], at }) · g.donut({ data, center, at }) · g.compare({ left: { item, label, value }, right: {...}, at, winner }) · g.sizes({ items: [{ item, label, value }], at }) (kích thước đúng tỉ lệ) · g.fill({ item, value: 0..1, label, at }) · g.stack({ item, from, to, at }) · g.gauge({ from, to, label, at }) · g.timeline({ items: [{ label: '1990', text, item }], at })
  Quan hệ: g.hub({ center: { item, label }, items, inward, at }) · g.tree({ root, items, merge, at }) · g.chain({ items, at }) (chỉ chuỗi nhân quả ≥3 bước) · g.callouts({ item, parts: [{ label }], at }) · g.big('+7%', { at, countTo })
  Thêm keep: true vào công thức thứ hai → chia đôi màn hình. MÀU: blue, red, orange, teal, green, purple, gold, pink, grey.

═══ NGUYÊN TẮC ═══
0. ĐƠN GIẢN & ĐÚNG Ý (quan trọng nhất): cảnh chỉ minh họa ĐÚNG điều câu thoại nói — người xem nhìn 1 giây là hiểu. 1 chủ thể chính + tối đa 2–3 thứ phụ thật cần; tối đa 1–2 nhân vật; KHÔNG đám đông (trừ khi lời thoại nói về đông người/thị trường), KHÔNG thẻ giá/con số/nhãn mà lời thoại không nhắc, KHÔNG đồ trang trí thêm — bối cảnh đã đủ sinh động. Thứ gì trên màn hình cũng phải ứng với một ý trong lời thoại. Ý tưởng cảnh quay rườm rà thì chọn phần cốt lõi nhất, bỏ phần còn lại.
1. CẢNH QUAY, KHÔNG PHẢI SLIDE: chủ thể chính là sự vật THẬT của lời thoại, nằm TRONG bối cảnh (đứng trên đất, đặt trên bàn/quầy, trong tay người, chạy trên đường, bơi dưới nước, trôi trong vũ trụ), to và rõ. Mọi vật phải có chỗ đứng hợp lý như ngoài đời. CẤM: xếp hàng biểu tượng kèm nhãn chữ; người đứng thuyết trình; biểu tượng/hình dán lơ lửng giữa trời; quầng sáng tròn quanh đồ vật bình thường; vật to bất thường so với người (trừ cảnh close có chủ đích).
2. SỐNG ĐỘNG NHƯNG GỌN: 2–3 nhịp diễn rõ ràng bám đúng từ khóa (cue) — chủ thể xuất hiện/di chuyển/biến đổi, người phản ứng, máy quay đẩy vào ở ý quan trọng. Nền tự chuyển động sẵn, không cần thêm.
3. BỐ CỤC ĐIỆN ẢNH: chủ thể ở 1/3 khung hoặc giữa; có tiền cảnh – hậu cảnh (depth khác nhau); ÍT MÀ RÕ — 1–4 vật thể có vai trò, chủ thể đủ to (không rải thẻ giá, số, biểu tượng khắp nơi); không để vật chồng lấp lộn xộn hay che mặt người; mọi thứ quan trọng trong vùng x 120–1800, y 100–880${captions ? ' (dưới y 890 là phụ đề)' : ''}.
4. ĐÚNG CỠ CẢNH: wide = thấy cả bối cảnh, nhiều thứ cùng diễn ra (đám đông, xe cộ, tàu thuyền); medium = một chủ thể và hành động của nó; close = máy quay đẩy sát (w.focus zoom 1.7–2.3) vào một vật/chi tiết đặt đúng chỗ thật của nó (không phóng to vật lơ lửng); macro = thế giới vi mô; diagram/data = mục 7.
5. LIỀN MẠCH: đúng bối cảnh & thời điểm được giao; nhân vật cùng vai dùng đúng id; cảnh cùng bối cảnh với cảnh trước như một đoạn phim liên tục.
6. CHÍNH XÁC: đúng khoa học/lịch sử; bản đồ/quốc gia/cờ CHỈ qua dữ liệu thật (g.globe, g.routes, kit.worldMap, vật 'globe'/'earth'), không tự vẽ; sự kiện cổ không dùng cờ/đồ hiện đại.
7. Không hiện tên nhân vật trên màn hình; tối đa 1 nhãn ≤ 3 từ (thường không cần nhãn).

═══ VÍ DỤ 1 — kinh tế, trung cảnh ═══
Lời thoại: "Năm ngoái, tờ năm mươi nghìn của bạn mua được ba ổ bánh mì. Năm nay, cũng tờ tiền ấy chỉ đủ cho hai ổ."
\`\`\`html
\`\`\`
\`\`\`css
\`\`\`
\`\`\`js
const w = kit.world('street', { time: 'day' });
const me = w.character('ban', { x: 160, face: 1 });
me.walkTo(420, cue('năm ngoái'), 1.4);
me.hold('banknote', cue('năm mươi'));
const breads = w.subject('bread', { count: 3, on: 'table', side: 'right', at: cue('ba ổ'), scale: 1.4 });
const tag = w.place('price-tag', { on: breads.table, x: breads[2].x + 150, text: '17k', at: cue('mua được') });
tag.swap('price-tag', cue('năm nay'), { text: '25k', color: 'red' });
w.focus(breads, { zoom: 1.5, at: cue('năm nay'), dur: 1.2 });
breads[2].hide(cue('chỉ đủ'));
me.pose('surprised', cue('chỉ đủ')).emote('shock', cue('chỉ đủ'));
\`\`\`

═══ VÍ DỤ 2 — vũ trụ, cận cảnh + sơ đồ ═══
Lời thoại: "Khi một ngôi sao khổng lồ cạn nhiên liệu, lõi của nó sụp đổ chỉ trong vài giây, để lại một hố đen."
\`\`\`js
const w = kit.world('space', { variant: 'deep', planet: false });
const star = w.place('sun-real', { x: 960, y: 520, size: 420 });
star.glow('orange', 0).shake(cue('cạn nhiên liệu'), 1.2);
star.shrink(cue('sụp đổ'), 0.2, 0.9);
w.fx('flash', { at: cue('vài giây') });
w.fx('shockwave', { at: cue('vài giây'), x: 960, y: 520, size: 1.6 });
star.hide(cue('vài giây') + 0.2);
kit.gfx.blackHole({ at: cue('hố đen') });
w.focus({ x: 960, y: 520 }, { zoom: 1.2, at: cue('hố đen'), dur: 2 });
\`\`\``;
}

const SHOT_TIPS = {
  wide: 'toàn cảnh: thấy cả bối cảnh, nhiều thứ cùng diễn ra (đám đông, xe cộ, tàu, khói...), máy quay lia hoặc đẩy chậm',
  medium: 'trung cảnh: một chủ thể và hành động của nó chiếm phần lớn khung',
  close: 'cận cảnh: vật/chi tiết chính đặt ĐÚNG CHỖ THẬT (trên bàn, trong tay, trên đất), máy quay đẩy sát vào nó bằng w.focus(vật, { zoom: 1.7–2.3 }) — KHÔNG phóng to vật lơ lửng giữa khung',
  macro: 'thế giới vi mô: vật thể nhỏ xíu được phóng to (tế bào, virus, phân tử, linh kiện) trong bối cảnh vi mô',
  diagram: 'cảnh sơ đồ chính xác (mục 7) — sơ đồ là chủ thể, có chuyển động',
  data: 'cảnh số liệu (mục 7) — biểu đồ / con số lớn / so sánh, gọn và rõ',
};
const DEFAULT_ENV = { economics: 'city', politics: 'city', history: 'ancient', space: 'space', science: 'lab', technology: 'digital', other: 'abstract' };
const SHOT_CYCLE = ['wide', 'medium', 'close', 'medium', 'diagram', 'close'];

export function cartoonUserPrompt(p, i) {
  const s = p.scenes[i];
  const chIdx = p.outline.chapters.findIndex(c => c.id === s.chapterId);
  const ch = p.outline.chapters[chIdx];
  const prev = p.scenes[i - 1], next = p.scenes[i + 1];
  const isChapterStart = !prev || prev.chapterId !== s.chapterId;
  const env = ENV_NAMES.includes(s.env) ? s.env : (ENV_NAMES.includes(prev?.env) && !isChapterStart ? prev.env : DEFAULT_ENV[p.brief.category] || 'abstract');
  const shot = SHOTS[s.shot] ? s.shot : SHOT_CYCLE[i % SHOT_CYCLE.length];
  const cast = (p.cast || []).map(c => `- '${c.id}': ${c.role}`).join('\n') || '(không có nhân vật cố định — cần người thì dùng w.character({ gender, outfit, ... }))';
  const fmtWords = ws => ws.map(w => `${w.t.toFixed(2)} ${w.w}`).join(' | ');
  const sceneLine = x => x ? `${x.env || '?'} · ${x.shot || '?'} — ${x.visual.slice(0, 150)}` : '';
  return `CẢNH ${i + 1}/${p.scenes.length} — chương ${chIdx + 1}: "${ch?.title}"${isChapterStart ? ' (mở chương mới — mở bằng một cú máy thiết lập bối cảnh)' : ''}
D = ${s.duration.toFixed(2)} giây.
BỐI CẢNH: kit.world('${env}', { time: '${s.time || prev?.time || 'day'}' })${prev && prev.env === env && !isChapterStart ? ' — giống cảnh trước: nối tiếp như cùng một đoạn phim' : ''} (được chọn variant phù hợp trong danh mục)
CỠ CẢNH: ${shot} — ${SHOT_TIPS[shot]}

LỜI THOẠI: "${s.narration}"
MỐC TỪNG TỪ (giây): ${fmtWords(s.audio.words)}

CẢNH QUAY (ý tưởng của đạo diễn): ${s.visual}
${s.characters?.length ? `NGƯỜI TRONG CẢNH: ${s.characters.join(', ')}\n` : ''}${s.data ? `DỮ LIỆU: ${JSON.stringify(s.data)}\n` : ''}${s.instruction ? `YÊU CẦU CHỈNH SỬA CỦA NGƯỜI DÙNG (ưu tiên cao nhất): ${s.instruction}\n` : ''}
DÀN NHÂN VẬT (diễn viên):
${cast}
${(p.assets || []).length ? `HÌNH VẼ RIÊNG CỦA VIDEO (vật thể đặc thù chủ đề, dùng như vật thể thường: w.place('<id>', {...}); nếu mục 7 đã có SƠ ĐỒ ĐỘNG cho đúng thứ đó thì ưu tiên sơ đồ):\n${p.assets.map(a => `- '${a.id}': ${a.name} — ${String(a.description).slice(0, 120)}`).join('\n')}` : ''}

CẢNH TRƯỚC: ${prev ? sceneLine(prev) : '(mở đầu phim)'}
CẢNH SAU: ${next ? sceneLine(next) : '(hết phim)'}`;
}

export function castPrompt(p) {
  return [
    { role: 'system', content: 'Bạn là đạo diễn phim hoạt hình giáo dục. Trả về DUY NHẤT JSON hợp lệ.' },
    { role: 'user', content: `Phim: "${p.outline.title}" — ${p.outline.angle}
Kịch bản tóm tắt: ${p.scenes.slice(0, 40).map(s => s.narration).join(' ').slice(0, 5000)}

Chọn 0–3 NHÂN VẬT LẶP LẠI xuất hiện như DIỄN VIÊN trong các cảnh minh họa (không có người dẫn chương trình): vd "bạn" (hình đại diện người xem khi lời thoại nói "bạn"), người nông dân, công nhân, nhà đầu tư, nhà khoa học, phi hành gia... Không cần thì trả mảng rỗng. "name" chỉ là nhãn nội bộ.${castLibraryText() ? `
NHÂN VẬT KÊNH ĐÃ CÓ — dùng lại khi đúng vai bằng { "reuse": "id", "role": "..." }:
${castLibraryText()}` : ''}
JSON: { "cast": [ { "id": "khong_dau", "name": "Tên", "role": "vai trò", "look": { "gender": "male|female", "age": "kid|adult|elder", "skin": "light|tan|brown|dark", "hair": "short|side|long|ponytail|bun|curly|spiky|bald", "hairColor": "black|brown|grey|white|blonde", "outfit": "casual|suit|labcoat|farmer|dress|uniform|worker|hoodie|aodai|astronaut", "shirt": "#hex", "pants": "#hex", "hat": "none|straw|cap|hardhat|crown|grad", "glasses": false, "mustache": false } } ] }` },
  ];
}
