import { CATEGORIES, TONES } from './styles.js';
import { WORDS_PER_MINUTE } from './config.js';
import { castLibraryText } from './castLibrary.js';
import { envCatalog, shotList, ENV_NAMES } from './visualSpec.js';

const CATEGORY_RULES = {
  science: 'Khoa học: chính xác tuyệt đối về khái niệm, tránh ngộ nhận phổ biến (và chủ động sửa chúng). Dùng phép so sánh quy mô đời thường (bằng bao nhiêu sân bóng, bao nhiêu lần sợi tóc...). Giải thích CƠ CHẾ, không chỉ liệt kê sự thật.',
  economics: 'Kinh tế: giải thích chuỗi nhân–quả (A dẫn tới B vì sao), dùng số liệu có năm và nguồn (Ngân hàng Thế giới, IMF, Tổng cục Thống kê...). Lấy ví dụ từ ví tiền của người xem. Nêu cả tác động hai chiều, tránh kết luận một phía.',
  politics: 'Chính trị–xã hội: TRUNG LẬP và cân bằng. Trình bày lập luận của các bên, quy trích dẫn cho đúng chủ thể ("theo...", "phía X cho rằng..."), phân biệt rõ sự kiện và quan điểm. Không bôi nhọ cá nhân, không kêu gọi, không suy diễn thiếu căn cứ. Với chủ đề nhạy cảm, dùng ngôn ngữ thận trọng.',
  history: 'Lịch sử: mốc thời gian rõ ràng, bối cảnh → nguyên nhân → diễn biến → hệ quả → bài học. Nhân vật có động cơ. Khi sử liệu còn tranh cãi thì nói rõ.',
  space: 'Vũ trụ – thiên văn: số liệu chính xác (khoảng cách, kích thước, nhiệt độ có đơn vị), so sánh quy mô dễ hình dung (nếu Trái Đất bằng hạt đậu thì...), phân biệt điều đã chứng minh và giả thuyết. Mô tả đúng hình dạng, màu sắc thiên thể.',
  technology: 'Công nghệ: giải thích nguyên lý hoạt động bằng phép ẩn dụ trực quan trước, rồi mới tới thuật ngữ. Nêu ứng dụng thực tế và giới hạn.',
  other: 'Kiến thức tổng hợp: rõ ràng, chính xác, ví dụ cụ thể, có góc nhìn riêng.',
};

const FACT_RULES = `QUY TẮC CHÍNH XÁC:
- Chỉ dùng số liệu/năm/tên mà bạn chắc chắn. Nếu không chắc con số chính xác, dùng cách nói xấp xỉ có trách nhiệm ("khoảng", "hơn", "gần gấp đôi") thay vì bịa số lẻ.
- Không bịa trích dẫn, không bịa nghiên cứu.
- Nếu người dùng cung cấp TÀI LIỆU THAM KHẢO, ưu tiên thông tin trong đó.`;

export const NAME_RULES = `KHÔNG BỊA TÊN NGƯỜI TRONG LỜI THOẠI:
- Người dẫn chuyện hoạt hình KHÔNG tự xưng tên, không "hãy cùng Minh..."; lời thoại không gọi tên nhân vật hoạt hình ("anh Tuấn đang...").
- Cần ví dụ về một người → dùng "bạn", "một người thợ", "một gia đình", "nhà đầu tư"... Tên riêng CHỈ cho người thật / nhân vật lịch sử liên quan tới nội dung.
- Chỉ đặt tên cho một nhân vật giả định khi nhân vật đó là trục của cả một câu chuyện kéo dài nhiều cảnh — khi đó dùng nhất quán đến cuối, không bỏ lửng.`;

const TTS_RULES = `LỜI THOẠI SẼ ĐƯỢC ĐỌC BẰNG MÁY (TTS tiếng Việt), nên:
- Câu ngắn-vừa (8–25 từ), nhịp tự nhiên, xen câu ngắn tạo điểm nhấn. Tiếng Việt chuẩn, có dấu đầy đủ.
- Không markdown, không emoji, không ngoặc đơn, không gạch đầu dòng, không ký hiệu (/, &, →, ~).
- Số viết để đọc được: "3,5 phần trăm" (không viết "3.5%"), "2 nghìn tỷ đô la", năm viết số "năm 2008". Viết tắt phổ biến giữ nguyên (GDP, AI, NASA) nhưng lần đầu nên giải thích.
- Xưng hô với người xem là "bạn", giọng kể tự nhiên như người dẫn chuyện trên YouTube.`;

const AUTO_LENGTH = wpm => `ĐỘ DÀI: bạn TỰ QUYẾT theo lượng nội dung thật sự cần để giải thích trọn vẹn — không kéo dài lê thê, không cắt xén:
- chủ đề hẹp / 1 cơ chế đơn giản: 5–7 phút
- chủ đề vừa: 8–11 phút
- chủ đề rộng, nhiều cơ chế/dữ kiện/giai đoạn, hoặc tài liệu tham khảo dày: 12–16 phút (tối đa 18)
Mỗi phút ≈ ${wpm} từ lời thoại. Ghi số phút đã chọn vào "minutes".`;

export function outlinePrompt(b, o = {}) {
  const auto = !b.minutes, wpm = o.wpm || WORDS_PER_MINUTE;
  const words = auto ? null : Math.round(b.minutes * wpm);
  const chapters = auto ? null : Math.max(b.minutes <= 2 ? 3 : 4, Math.min(10, Math.round(b.minutes / 1.6)));
  return [
    { role: 'system', content: `Bạn là biên kịch trưởng của một kênh YouTube giải thích kiến thức tiếng Việt hàng đầu (phong cách Kurzgesagt, Vox, Johnny Harris, Economics Explained). Bạn giỏi biến chủ đề khô khan thành câu chuyện có sức hút, giữ chân người xem đến giây cuối.

${CATEGORY_RULES[b.category] || CATEGORY_RULES.other}

${FACT_RULES}

Trả về DUY NHẤT JSON hợp lệ.` },
    { role: 'user', content: `Lập DÀN Ý cho một video giải thích. ${auto ? AUTO_LENGTH(wpm) : `Độ dài khoảng ${b.minutes} phút (~${words} từ lời thoại).`}

CHỦ ĐỀ / Ý TƯỞNG: ${b.topic}
LĨNH VỰC: ${CATEGORIES[b.category] || b.category}
KHÁN GIẢ: ${b.audience}
GIỌNG ĐIỆU: ${TONES[b.tone] || b.tone}
${b.notes ? `YÊU CẦU THÊM: ${b.notes}\n` : ''}${b.sources ? `TÀI LIỆU THAM KHẢO (ưu tiên dùng):\n${b.sources.slice(0, 15000)}\n` : ''}
Yêu cầu cấu trúc:
- Chương 1 là HOOK (${auto ? '7–10% tổng số từ' : `${Math.round(words * 0.07)}–${Math.round(words * 0.1)} từ`}): mở bằng một câu hỏi gây tò mò, nghịch lý, hoặc tình huống cụ thể gây sốc; hứa hẹn điều người xem sẽ hiểu được. KHÔNG chào hỏi dài dòng, không "xin chào các bạn".
- ${auto ? 'Các' : chapters - 2} chương thân bài${auto ? ' (tổng 4–10 chương, ≈ 1 chương mỗi 1,5–2 phút)' : ''}, mỗi chương một bước tiến của câu chuyện/lập luận, có "vòng lặp mở" (câu hỏi dẫn sang chương sau).
- Chương cuối: tổng kết ý lớn + góc nhìn đọng lại + 1 câu kêu gọi đăng ký nhẹ nhàng.
- Tổng số từ các chương cộng lại ≈ ${auto ? `số phút × ${wpm}` : words}.

JSON:
{
  "title": "tiêu đề video hấp dẫn, ≤ 70 ký tự",
  "angle": "luận điểm/góc nhìn trung tâm của cả video trong 1–2 câu",${auto ? '\n  "minutes": 9,' : ''}
  "chapters": [
    { "title": "tên chương ngắn (≤ 6 từ)", "purpose": "chương này làm gì trong câu chuyện", "points": ["ý chính cụ thể, có dữ kiện/ví dụ", "..."], "words": 250 }
  ]${o.cartoon ? castSpec() : ''}
}` },
  ];
}

export const castSpec = () => '';
const castSpecLegacy = () => {
  const lib = castLibraryText();
  return `,
  "cast": [
    { "reuse": "id nhân vật có sẵn của kênh (chỉ khi đúng vai)", "role": "vai trong video này" },
    { "id": "ban", "name": "Bạn", "role": "vai trong câu chuyện — vd: 'người xem (bạn)', 'nông dân', 'nhà đầu tư', 'phi hành gia'",
      "look": { "gender": "male|female", "age": "kid|adult|elder", "skin": "light|tan|brown|dark", "hair": "short|side|long|ponytail|bun|curly|spiky|bald", "hairColor": "black|brown|grey|white|blonde", "outfit": "casual|suit|labcoat|farmer|dress|uniform|worker|hoodie|aodai|astronaut", "shirt": "#màu áo", "pants": "#màu quần", "hat": "none|straw|cap|hardhat|crown|grad", "glasses": false, "mustache": false } }
  ]
// "cast": 0–3 NHÂN VẬT LẶP LẠI xuất hiện trong các cảnh minh họa như DIỄN VIÊN (không có người dẫn chương trình đứng nói). Thường gặp: "bạn" (hình đại diện người xem khi lời thoại nói "bạn..."), người lao động / người mua / nhà đầu tư / nhà khoa học / phi hành gia... tùy chủ đề. Chủ đề không cần người thì để mảng rỗng. Người Việt nếu hợp chủ đề. id viết thường không dấu. Màu áo khác nhau rõ rệt.
// "name" chỉ là nhãn nội bộ — KHÔNG BAO GIỜ xuất hiện trong lời thoại hay trên màn hình.${lib ? `
// NHÂN VẬT KÊNH ĐÃ CÓ (dùng lại bằng { "reuse": "id", "role": "..." } khi đúng vai, giữ nguyên ngoại hình):
${lib.split('\n').map(l => '//   ' + l).join('\n')}` : ''}`;
};

// Ways of telling a scene — a palette, not a template list: mix, invent, vary with the content.
const FORMS = `TÌNH HUỐNG THỰC TẾ (tranh vẽ một cảnh đời thật đang diễn ra: gia đình ở quán phở, người mua tranh nhau ở chợ, công nhân trong nhà máy — máy quay lướt qua tranh, chi tiết được nhấn, chữ/số/vật chồng lên) · ẨN DỤ MINH HỌA (tranh vẽ một hình ảnh tượng trưng: cỗ máy khổng lồ hút tiền từ ví, tiền tan chảy dưới nắng, quả bóng giá cả phình to trên thành phố) · biến đổi tại chỗ (vật này hóa thành vật kia, phình to/xì hơi, tan thành bụi) · cân & đánh đổi (cái cân nghiêng khi thêm vật) · chồng vật tăng/giảm (tháp đồng xu cao lên/thấp xuống, so các chồng) · đổ vào (vật rơi vào một đích làm nó thay đổi) · va chạm nhân quả (vật lao vào vật khác gây phản ứng) · bầy vật vây quanh (nhiều thứ tranh giành một thứ) · gợn sóng lan tỏa · trước/sau (thanh trượt quét qua cùng một chỗ) · kính lúp soi bên trong · đếm & số lượng · tỉ lệ kích thước · phóng to vào chi tiết · dòng thời gian · bản đồ thật · biểu đồ động · con số lớn · chữ động`;

const SHOT_BRIEF = () => `
ĐÂY LÀ VIDEO MINH HỌA GIẢI THÍCH (kiểu Kurzgesagt / TED-Ed / Vox): TRANH MINH HỌA đẹp (AI vẽ) kể bằng TÌNH HUỐNG cụ thể hoặc ẨN DỤ hình ảnh, kết hợp chuyển động: máy quay lướt trên tranh, vật tách nền chuyển động chồng lên, chữ/số/biểu đồ, chuyển cảnh mượt. Ý trừu tượng phải được "đặt vào" một cảnh tình huống hay một hình ảnh ẩn dụ cụ thể — không trình bày kiểu "hình A → mũi tên → hình B", không slide chữ. Không người dẫn chương trình, không nhân vật cố định (người xuất hiện tự nhiên trong tranh tình huống khi cần).
Mỗi cảnh TỰ CHỌN cách kể hợp nhất với câu thoại — cảnh liền nhau phải khác nhau. TRANH toàn khung (tình huống/ẩn dụ) TỐN KÉM — chỉ dùng cho vài khoảnh khắc then chốt thật sự cần không khí/bối cảnh (tối đa ~1/4 số cảnh, các cảnh liền nhau dùng chung một tranh); phần lớn cảnh kể bằng hình tách nền + thiết bị chuyển động/biểu đồ trên nền màu. Bảng gợi ý (kết hợp/sáng tạo thêm thoải mái): ${FORMS}.
Mỗi cảnh ghi:
- "form": cách kể đã chọn (vài chữ).
- "visual": 1–3 câu tả HIỆN TƯỢNG/CƠ CHẾ THẬT mà câu thoại nói tới, đúng như nó xảy ra (lực hút Mặt Trăng → nước đại dương phồng về phía Mặt Trăng; mất mỏ neo trọng lực → trục Trái Đất chao đảo lệch góc; lạm phát → cùng tờ tiền mua được ít hàng hơn) — KHÔNG vẽ theo từ khóa/ẩn dụ chữ (câu nói "mỏ neo" không có nghĩa là vẽ cái mỏ neo; "thảm họa" không phải vẽ tia sét). Người xem THẤY gì và nó CHUYỂN ĐỘNG thế nào theo lời (máy quay lướt tới đâu, chi tiết nào được nhấn, vật gì xuất hiện/biến đổi, chữ/số nào nếu cần).
- "illustration": CHỈ khi cảnh thật sự cần một bức tranh bối cảnh (hiếm): tả bức tranh tình huống/ẩn dụ CỤ THỂ (nơi chốn, ai/cái gì, đang làm gì, không khí, thời đại/văn hóa đúng — vd "gia đình Việt bốn người ngồi quanh bàn inox ở quán phở vỉa hè Hà Nội, bốn bát phở bốc khói, tờ 100.000 đồng trên bàn"); các cảnh liền nhau cùng tình huống thì ghi CÙNG MỘT mô tả (dùng chung một tranh, máy quay khung vào chỗ khác). Không cần tranh thì "".
- "items": vật CỤ THỂ cần hình tách nền để chuyển động chồng lên (tên tiếng Việt ngắn); [] nếu không cần.
- "transition": chuyển VÀO cảnh này: "cut" | "fade" | "slide" | "zoom" | "wipe" | "iris" | "whip" (zoom khi đi sâu, slide ý kế tiếp, wipe/iris sang chương, fade chậm lại, cut nhịp nhanh). Đa dạng.
TRÁNH: minh họa theo từ khóa (vẽ đúng chữ trong câu thay vì hiện tượng); icon tượng trưng (sét, lửa, ổ khóa, ngôi sao, trái tim); sơ đồ hình–mũi tên–hình; slide chữ; hình không liên quan; quá nhiều thứ; bản đồ/cờ tự vẽ (bản đồ chỉ từ dữ liệu thật).`;

const SCENE_JSON = first => `{
  "scenes": [
    {
      ${first}
      "form": "tình huống thực tế",
      "visual": "1–3 câu: thấy gì, chuyển động thế nào theo lời",
      "illustration": "tả tranh tình huống/ẩn dụ cụ thể, hoặc \\"\\"",
      "items": ["tờ 100.000 đồng"],
      "transition": "slide",
      "onScreenText": "thường để rỗng; chỉ khi thật cần: 1 con số hoặc ≤ 4 từ",
      "data": null
    }
  ]
}
Với cảnh biểu đồ/số liệu: data = {"kind":"bar|line|pie","unit":"...","series":[{"name":"...","points":[[2000,1.2],[2010,3.4]]}]} hoặc {"kind":"bar","items":[{"label":"Việt Nam","value":7.1}]} hoặc {"value": 2.5, "unit": "nghìn tỷ USD", "context": "..."}.`;

/** Art director for the AI image model: what to draw (within a call budget), what to reuse. */
export function imagePlanPrompt(p, library, budget, perSheet) {
  const scenes = p.scenes.map((s, i) => `[${i}] ${s.form ? `(${s.form}) ` : ''}${s.visual}${s.illustration ? ` | TRANH: ${s.illustration}` : ''}${s.items?.length ? ` | VẬT: ${s.items.join(', ')}` : ''}`).join('\n').slice(0, 24000);
  const kindName = { bg: 'ảnh nền', scene: 'tranh tình huống', sprite: 'hình tách nền' };
  const lib = library.map(e => `- "${e.key}" (${kindName[e.kind] || e.kind}): ${e.name} — ${String(e.description || '').slice(0, 90)}`).join('\n');
  return [
    { role: 'system', content: 'Bạn là giám đốc mỹ thuật của kênh video minh họa giải thích kiến thức. Bạn quyết định vẽ những tranh/hình nào cho video, tiết kiệm chi phí (mỗi lượt vẽ tốn tiền). Trả về DUY NHẤT JSON hợp lệ.' },
    { role: 'user', content: `VIDEO: "${p.outline.title}"
CÁC CẢNH:
${scenes}

${lib ? `THƯ VIỆN ĐÃ VẼ (dùng lại MIỄN PHÍ khi thật sự đúng):\n${lib}\n` : ''}
NGÂN SÁCH: tối đa ${budget} lượt vẽ mới. Mỗi lượt vẽ được MỘT trong ba thứ: 1 tấm gồm tối đa ${perSheet} hình tách nền khác nhau (rẻ nhất — gom vật vào chung tấm); HOẶC 1 CHUỖI ĐỘNG TÁC (một nhân vật/vật ở 4–6 tư thế liên tiếp của một động tác lặp: người đi bộ, vẫy tay, đếm tiền, tim đập, máy bơm, cờ bay, ngọn lửa…) — dùng khi có thứ cần cử động sống động; HOẶC 1 TRANH TÌNH HUỐNG toàn khung (đắt về ý nghĩa, dùng hiếm).
TRANH TÁCH LỚP ("layered", tốn 2 lượt): khi khoảnh khắc chính cần chủ thể CHUYỂN ĐỘNG/BIẾN ĐỔI trong bối cảnh (Mặt Trăng tắt dần trên bầu trời đêm, mực nước rút khỏi bờ, con tàu rời cảng, người bước qua phố) thì vẽ RIÊNG: "plate" = bối cảnh KHÔNG có các chủ thể đó (chừa chỗ trống cho chúng), "parts" = từng chủ thể (≤ ${perSheet}, mỗi cái một vật, không trong suốt) — code đặt chúng lên tranh rồi cho di chuyển, mờ dần, phình, rơi… Ưu tiên tách lớp hơn tranh liền khối khi cảnh cần chuyển động.
TRANH toàn khung TỐN KÉM: chỉ vẽ cho cảnh mà bối cảnh/tình huống là cốt lõi không thể kể bằng vật tách nền (tối đa ~1/4 số cảnh, gộp các cảnh liền nhau cùng tình huống vào một tranh); cảnh nào kể được bằng vật + chuyển động thì KHÔNG vẽ tranh. Ưu tiên hình tách nền cho các vật chính phải chuyển động, đếm, biến đổi. Không cần dùng hết ngân sách.
"prompt" viết bằng TIẾNG ANH. Tranh: tả cụ thể bố cục (chủ thể ở giữa, cảnh rộng), nơi chốn, người/vật, hành động, cảm xúc, ánh sáng, đúng văn hóa Việt Nam/thời đại khi liên quan; không chữ. Hình tách nền: tả đúng MỘT vật, góc 3/4 trước.
Vẽ THỨ THẬT SỰ CÓ trong hiện tượng (hành tinh, đại dương, con vật, cỗ máy, con người…), KHÔNG vẽ vật tượng trưng theo chữ trong lời (mỏ neo cho "neo trọng lực", xiềng xích, ổ khóa, tia sét, trái tim, cái cân cho "cân bằng" vũ trụ) — cơ chế (lực, quỹ đạo, trục nghiêng, dòng chảy) do code tự vẽ. KHÔNG vẽ: bản đồ, cờ, biên giới; chữ, số, biểu đồ, mũi tên (làm bằng code); hình tách nền trong suốt/kính, khói, lửa, ánh sáng (không tách nền được). Mỗi hình tách nền MỘT vật (cần 10 đồng xu thì vẽ 1, code tự nhân bản). Không nhắc phong cách (hệ thống tự thêm). Hiện tượng lớn then chốt của kịch bản (bức tường plasma nuốt hành tinh, biển dung nham, tinh vân, vụ nổ, bão…) không tách nền được → nếu là khoảnh khắc chính thì vẽ thành TRANH TÌNH HUỐNG (code không có cách nào vẽ đẹp chúng bằng icon).
JSON:
{
  "reuse": [ { "key": "khóa trong thư viện", "id": "id_dung_trong_video", "scenes": [0] } ],
  "illustrations": [ { "id": "pho_family", "name": "Gia đình ở quán phở", "prompt": "English...", "scenes": [0, 1] } ],
  "layered": [ { "id": "night_harbor", "name": "Bến cảng đêm", "plate": "English: the setting only, with clear empty sky/space where the parts will go", "parts": [ { "id": "full_moon", "name": "Trăng tròn", "prompt": "English: one object" } ], "scenes": [0, 1] } ],
  "animations": [ { "id": "worker_walk", "name": "Nhân viên đi bộ", "prompt": "English: the subject (one person/thing)", "action": "English: the looping action, side view", "frames": 6, "scenes": [9] } ],
  "sprites": [ { "id": "coconut", "name": "Quả dừa", "prompt": "English...", "scenes": [3, 4] } ]
}` },
  ];
}

export function chapterPrompt(b, outline, idx, o = {}) {
  const ch = outline.chapters[idx];
  const list = outline.chapters.map((c, i) => `${i + 1}. ${c.title} — ${c.purpose}${i === idx ? '   ◀◀ CHƯƠNG BẠN VIẾT' : ''}`).join('\n');
  const scenesTarget = Math.max(2, Math.round(ch.words / 32));
  return [
    { role: 'system', content: `Bạn là biên kịch kiêm đạo diễn motion graphics của kênh giải thích kiến thức tiếng Việt. Bạn viết lời dẫn cuốn hút VÀ hình dung từng câu thành một cảnh motion graphics rõ ràng, đẹp, đúng sự thật — mỗi cảnh một cách diễn đạt hợp nội dung.

${CATEGORY_RULES[b.category] || CATEGORY_RULES.other}

${FACT_RULES}

${TTS_RULES}

${NAME_RULES}

Trả về DUY NHẤT JSON hợp lệ.` },
    { role: 'user', content: `VIDEO: "${outline.title}"
LUẬN ĐIỂM: ${outline.angle}
GIỌNG ĐIỆU: ${TONES[b.tone] || b.tone}
KHÁN GIẢ: ${b.audience}
${b.sources ? `TÀI LIỆU THAM KHẢO:\n${b.sources.slice(0, 8000)}\n` : ''}
DÀN Ý TOÀN VIDEO:
${list}

VIẾT CHƯƠNG ${idx + 1}: "${ch.title}"
Mục đích: ${ch.purpose}
Ý chính: ${(ch.points || []).map(p => `\n- ${p}`).join('')}
Độ dài: ${ch.words} từ (TỐI ĐA ${Math.round(ch.words * 1.1)} từ — video có thời lượng cố định, viết dư sẽ bị cắt), đúng ${scenesTarget} CẢNH.
${SHOT_BRIEF(outline.cast)}
${idx > 0 ? `Câu đầu tiên nối mạch tự nhiên từ chương trước ("${outline.chapters[idx - 1].title}").` : 'Đây là HOOK: 2 câu đầu phải khiến người xem không thể lướt qua; cảnh đầu là một hình ảnh/chuyển động gây ấn tượng mạnh.'}
${idx < outline.chapters.length - 1 ? `Kết chương bằng một câu mở vòng lặp dẫn sang chương sau ("${outline.chapters[idx + 1].title}").` : 'Đây là chương kết.'}

MỖI CẢNH = MỘT CẢNH QUAY, lời thoại 18–45 từ (≈ 6–15 giây).

JSON:
${SCENE_JSON('"narration": "lời thoại của cảnh",')}` },
  ];
}

// ---------------- pasted script (narration is the user's, verbatim) ----------------

export function scriptPlanPrompt(b, scenes, headings, o = {}) {
  const text = scenes.map((s, i) => `${headings[i] ? `### ${headings[i]}\n` : ''}[${i}] ${s.narration}`).join('\n');
  const hasHeadings = Object.keys(headings).length >= 2;
  return [
    { role: 'system', content: `Bạn là biên tập viên kiêm đạo diễn của kênh YouTube giải thích kiến thức tiếng Việt. Người dùng đã viết sẵn KỊCH BẢN — bạn KHÔNG viết lại lời thoại, chỉ phân tích và lập kế hoạch. Trả về DUY NHẤT JSON hợp lệ.` },
    { role: 'user', content: `KỊCH BẢN CỦA NGƯỜI DÙNG (đã cắt thành cảnh, [số] là chỉ số cảnh${hasHeadings ? ', ### là tiêu đề phần người dùng tự chia' : ''}):
${text}
${b.topic ? `\nCHỦ ĐỀ NGƯỜI DÙNG GHI: ${b.topic}` : ''}${b.notes ? `\nYÊU CẦU THÊM: ${b.notes}` : ''}

Nhiệm vụ:
1. Đặt tiêu đề video hấp dẫn (≤ 70 ký tự) và tóm tắt luận điểm trung tâm.
2. Chia CHƯƠNG: ${hasHeadings ? 'GIỮ ĐÚNG các phần ### người dùng đã chia (mỗi ### là đầu một chương; cảnh trước ### đầu tiên là chương mở đầu).' : '4–10 chương theo mạch nội dung, mỗi chương 3–12 cảnh liên tiếp; chương 1 là phần mở đầu.'} "start" = chỉ số cảnh đầu tiên của chương, tăng dần, chương đầu start = 0.
3. Xác định lĩnh vực: science | space | economics | politics | history | technology | other.

JSON:
{
  "title": "...",
  "angle": "...",
  "category": "history",
  "chapters": [ { "title": "tên chương ≤ 6 từ", "purpose": "chương này làm gì", "start": 0 } ]${castSpec()}
}` },
  ];
}

export function scriptVisualsPrompt(b, outline, idx, scenes, o = {}) {
  const ch = outline.chapters[idx];
  const list = outline.chapters.map((c, i) => `${i + 1}. ${c.title} — ${c.purpose}${i === idx ? '   ◀◀ CHƯƠNG NÀY' : ''}`).join('\n');
  return [
    { role: 'system', content: `Bạn là đạo diễn motion graphics của kênh giải thích kiến thức tiếng Việt. Lời thoại đã có sẵn (người dùng viết) — bạn hình dung mỗi cảnh thành một cảnh motion graphics minh họa CHÍNH XÁC, rõ ràng, mỗi cảnh một cách diễn đạt hợp nội dung.

${CATEGORY_RULES[outline.category || b.category] || CATEGORY_RULES.other}

Trả về DUY NHẤT JSON hợp lệ.` },
    { role: 'user', content: `VIDEO: "${outline.title}"
LUẬN ĐIỂM: ${outline.angle}
${b.sources ? `TÀI LIỆU THAM KHẢO (dùng để minh họa đúng):\n${b.sources.slice(0, 8000)}\n` : ''}
DÀN Ý:
${list}
${SHOT_BRIEF(outline.cast)}

CÁC CẢNH CỦA CHƯƠNG "${ch.title}" (KHÔNG sửa lời thoại):
${scenes.map(s => `[${s.i}] ${s.narration}${s.hint ? `\n     (gợi ý hình của người dùng: ${s.hint})` : ''}`).join('\n')}

Với MỖI cảnh ở trên, thiết kế một cảnh minh họa đúng nội dung lời thoại (ưu tiên gợi ý hình của người dùng nếu có).

JSON:
${SCENE_JSON(`"i": ${scenes[0]?.i ?? 0},`)}` },
  ];
}

export function editorPrompt(b, outline, scenes, withVisuals = false, userScript = false) {
  const script = scenes.map((s, i) => `[${i}] (${s.chapterTitle}) ${s.narration}${withVisuals ? `\n     CẢNH: (${s.form || '?'}) ${s.visual}${s.illustration ? ` | TRANH: ${s.illustration}` : ''}${s.items?.length ? ` | VẬT: ${s.items.join(', ')}` : ''} | chuyển: ${s.transition || '?'}` : ''}`).join('\n');
  const visualRules = withVisuals ? `7. HÌNH ẢNH (soát cả video — motion graphics giải thích, KHÔNG phải slide chữ):
   0) KỂ BẰNG TÌNH HUỐNG/ẨN DỤ: cảnh trình bày kiểu sơ đồ 'hình A → mũi tên → hình B' hoặc vật bay trên nền trơn mà lẽ ra kể được bằng một tình huống đời thật/ẩn dụ → viết lại thành tình huống (điền "illustration"); khoảng một nửa số cảnh nên có tranh.
   a) ĐÚNG Ý & ĐƠN GIẢN: mỗi "visual" minh họa đúng câu thoại của nó bằng 1 chủ thể rõ + vài thứ phụ cần thiết; rối, lạc đề, chung chung ("hình ảnh minh họa kinh tế") → viết lại cụ thể.
   b) ĐA DẠNG CÁCH DIỄN ĐẠT: "form" của các cảnh liền nhau phải khác nhau; không quá 2 cảnh cùng form trong một chương; mỗi chương nên có ít nhất 1 cảnh biến đổi/so sánh/phóng to/số liệu. Sửa bằng cách đổi "form" + "visual".
   c) "items" là vật cụ thể vẽ được (không phải khái niệm trừu tượng); khái niệm → chọn vật tượng trưng cụ thể.
   d) "transition" đa dạng và hợp ý (zoom vào chi tiết, slide ý kế tiếp, wipe/iris sang chương, cut khi dồn dập).
   e) CHÍNH XÁC: vật đúng thời đại/khoa học; bản đồ chỉ cấp thế giới/quốc gia từ dữ liệu thật; không cờ/đồ hiện đại cho sự kiện cổ.
   f) Chữ trên màn hình rất ít: con số then chốt hoặc ≤ 4 từ.
` : '';
  return [
    { role: 'system', content: `Bạn là tổng biên tập kịch bản YouTube kiến thức. Nhiệm vụ: soát lỗi và nâng chất lượng ${userScript ? 'phần HÌNH ẢNH (cảnh quay) của kịch bản' : 'kịch bản mà KHÔNG viết lại toàn bộ'}.

${FACT_RULES}

${TTS_RULES}

${NAME_RULES}

Trả về DUY NHẤT JSON hợp lệ.` },
    { role: 'user', content: `Video: "${outline.title}" — ${outline.angle}
Lĩnh vực: ${CATEGORIES[b.category] || b.category}

KỊCH BẢN (mỗi dòng một cảnh, [số] là chỉ số cảnh):
${script}

${userScript ? `LỜI THOẠI DO NGƯỜI DÙNG VIẾT — TUYỆT ĐỐI KHÔNG sửa "narration". Chỉ:
- Ghi vào "factWarnings" những chỗ sai sự thật / số liệu đáng ngờ để người dùng tự kiểm tra.
${visualRules}` : `Hãy tìm và sửa (chỉ những cảnh THẬT SỰ cần sửa, tối đa 25 cảnh):
1. Sai sự thật, số liệu đáng ngờ → sửa cho đúng hoặc chuyển sang cách nói xấp xỉ.
2. Lặp ý/lặp từ giữa các cảnh, câu sáo rỗng ("Thật thú vị phải không nào").
3. Chỗ chuyển chương bị gãy mạch.
4. Câu khó đọc với TTS (số, ký hiệu, ngoặc, câu quá dài).
5. Hook mở đầu chưa đủ mạnh → viết lại cảnh [0] cho sắc hơn.
5b. Tên người bịa ra không cần thiết (tên nhân vật hoạt hình, "anh Tuấn", "chị Lan" xuất hiện rồi bỏ lửng) → thay bằng vai ("một người thợ", "bạn") hoặc bỏ.
${b.category === 'politics' ? '6. Chỗ thiếu trung lập, khẳng định quan điểm như sự thật.\n' : ''}${visualRules}`}
JSON: { "edits": [ { "index": 0, ${userScript ? '' : '"narration": "lời thoại mới hoàn chỉnh (bỏ trống nếu chỉ sửa hình)", '}${withVisuals ? '"form": "cách kể (nếu đổi)", "visual": "mô tả mới (nếu sửa)", "illustration": "tranh tình huống (nếu đổi)", "items": ["vật cần vẽ (nếu đổi)"], "transition": "(nếu đổi)", ' : ''}"reason": "lý do ngắn" } ], "factWarnings": ["điểm người dùng nên tự kiểm chứng thêm"] }` },
  ];
}

const libLines = list => list.map(e => `- "${e.key}": ${e.name} — ${String(e.description || '').slice(0, 110)}`).join('\n');

export function artDirectionPrompt(p, preset, maxAssets, libraryNames = '', reusable = []) {
  const scenes = p.scenes.map((s, i) => `[${i}] ${s.env ? `${s.env}·${s.shot}` : s.visualType}: ${s.visual}`).join('\n').slice(0, 24000);
  return [
    { role: 'system', content: 'Bạn là giám đốc mỹ thuật (art director) cho các phim hoạt hình giải thích kiến thức đạt giải thưởng. Bạn quyết định ngôn ngữ hình ảnh nhất quán cho cả video và chọn ra số ít hình minh họa chủ lực đáng đầu tư (mỗi hình vẽ mới tốn chi phí). Trả về DUY NHẤT JSON hợp lệ.' },
    { role: 'user', content: `VIDEO: "${p.outline.title}" — ${p.outline.angle}
PHONG CÁCH NỀN: ${preset.name} — ${preset.guide}
BẢNG MÀU GỐC: ${JSON.stringify(preset.tokens)}

DANH SÁCH CẢNH (ý tưởng hình ảnh):
${scenes}

Nhiệm vụ:
1. Tinh chỉnh bảng màu cho hợp chủ đề (giữ tương phản tốt: chữ trên nền phải đọc rõ; giữ cùng "độ sáng" với bảng gốc — nền tối giữ tối, nền sáng giữ sáng). Chỉ trả về các màu muốn đổi.
2. Viết "visualLanguage": 6–10 quy tắc hình ảnh cụ thể để mọi cảnh nhất quán (kiểu hình khối, độ dày nét, cách dùng màu nhấn, cách chuyển động, motif lặp lại xuyên suốt video...).
3. TỰ QUYẾT số HÌNH MINH HỌA CHỦ LỰC (hero asset) cần vẽ mới theo nội dung: từ 0 (thư viện + bối cảnh đã đủ — thường gặp với chủ đề đời thường) đến tối đa ${maxAssets} (chủ đề có nhiều vật đặc thù). Chỉ vẽ vật thể cụ thể XUẤT HIỆN NHIỀU CẢNH hoặc ở cảnh then chốt, khó vẽ bằng hình khối đơn giản. KHÔNG vẽ: bối cảnh/phong cảnh/nền (hệ thống đã có sẵn ${ENV_NAMES.length} bối cảnh vẽ tay: ${ENV_NAMES.join(', ')}), người/nhân vật (đã có nhân vật hoạt hình chuyển động), hiệu ứng (mưa, khói, lửa, nổ đã có). Video đã có thư viện vật thể vẽ tay: ${libraryNames || 'người, đồ vật, tòa nhà, xe cộ, tiền, cờ...'}. CHỈ chọn thứ ĐẶC THÙ CỦA CHỦ ĐỀ mà thư viện KHÔNG có (vd: chiến thuyền Nam Hán, tàu vũ trụ New Horizons, máy hơi nước James Watt, tượng đài cụ thể, loài vật cụ thể), vẽ ĐÚNG lịch sử/khoa học. KHÔNG BAO GIỜ chọn bản đồ, hình lãnh thổ/quốc gia, đường biên giới, dòng sông, cờ, quốc huy (không vẽ tay chính xác được — hệ thống đã có bản đồ từ dữ liệu thật). KHÔNG chọn những thứ hệ thống ĐÃ CÓ sơ đồ động chính xác: ${BUILTIN_DIAGRAMS}. Mỗi hero asset là MỘT vật thể, MỘT góc nhìn, không nền/khung, không biến thể phụ hay ô chèn — cần biến thể khác thì tạo asset riêng. Nếu không có gì như vậy thì trả mảng rỗng. ${maxAssets === 0 ? 'Lần này KHÔNG chọn asset nào (mảng rỗng).' : ''}
${reusable.length ? `4. THƯ VIỆN HÌNH ĐÃ VẼ Ở CÁC VIDEO TRƯỚC — DÙNG LẠI MIỄN PHÍ (ưu tiên hơn vẽ mới), chỉ khi ĐÚNG vật / đúng thời đại với nội dung cảnh; ghi vào "reuse". KHÔNG vẽ mới thứ thư viện đã có.
${libLines(reusable)}
` : ''}
JSON:
{
  "palette": { "primary": "#...", "accent": "#..." },
  "visualLanguage": ["quy tắc 1", "..."],
  "motif": "motif hình ảnh xuyên suốt (1 câu)",
  "reuse": [ { "key": "khóa trong thư viện", "scenes": [3, 8] } ],
  "heroAssets": [
    { "id": "snake_case_ngan", "name": "tên", "description": "mô tả tạo hình chi tiết của MỘT vật thể trong MỘT góc nhìn (không bản vẽ nhiều hình chiếu): dáng, trang phục/cấu tạo, màu (dùng màu trong bảng), góc nhìn", "parts": ["các bộ phận cần tách nhóm để animate, vd: arm_left, head, wheel"], "scenes": [0, 5, 12] }
  ]
}` },
  ];
}

/** No-Astra videos: Flash picks drawings from earlier videos that genuinely fit this one. */
export function libraryPickPrompt(p, reusable) {
  const scenes = p.scenes.map((s, i) => `[${i}] ${s.visual}`).join('\n').slice(0, 16000);
  return [
    { role: 'system', content: 'Bạn là trợ lý mỹ thuật. Trả về DUY NHẤT JSON hợp lệ.' },
    { role: 'user', content: `VIDEO: "${p.outline.title}"
CÁC CẢNH (ý tưởng hình):
${scenes}

THƯ VIỆN HÌNH ĐÃ VẼ SẴN TỪ CÁC VIDEO TRƯỚC:
${libLines(reusable)}

Chọn những hình trong thư viện THẬT SỰ phù hợp (đúng vật, đúng thời đại/khoa học) để dùng trong video này và các cảnh dùng chúng. Không phù hợp thì mảng rỗng — đừng ép.
JSON: { "reuse": [ { "key": "khóa trong thư viện", "scenes": [0, 4] } ] }` },
  ];
}

// Subjects the runtime already draws as accurate, animated diagrams — Astra must never spend a drawing on them.
export const BUILTIN_DIAGRAMS = 'hố đen / lỗ đen, hệ Mặt Trời, các hành tinh, Mặt Trăng & pha Mặt Trăng, thiên hà, Trái Đất / địa cầu, cấu tạo Trái Đất, nguyên tử, phân tử, tế bào, ADN, cơ thể người & nội tạng, vòng tuần hoàn nước, mạch điện, mạng nơ-ron, mạng Internet, cung–cầu, biểu đồ nến, kim tự tháp tầng bậc, tảng băng chìm, bản đồ & cờ';

export function assetPrompt(asset, tokens, visualLanguage, feedback = '') {
  return [
    { role: 'system', content: 'Bạn là họa sĩ minh họa khoa học kiêm họa sĩ vector, vẽ bằng mã SVG thủ công cho video giải thích kiến thức. Hình của bạn CHÍNH XÁC như ảnh tham khảo thật (đúng cấu tạo, tỉ lệ, chi tiết đặc trưng mà người xem nhận ra ngay), được cách điệu phẳng có chiều sâu (gradient tinh tế, bóng đổ, highlight), nét gọn. Bạn chỉ vẽ ĐÚNG MỘT vật thể.' },
    { role: 'user', content: `Vẽ: "${asset.name}"
Mô tả: ${asset.description}
Bảng màu (dùng các màu này và sắc độ của chúng; được dùng màu tự nhiên của vật thật nếu bảng màu làm sai bản chất vật): ${JSON.stringify({ primary: tokens.primary, accent: tokens.accent, accent2: tokens.accent2, surface: tokens.surface, surface2: tokens.surface2, text: tokens.text, muted: tokens.muted, danger: tokens.danger })}
Ngôn ngữ hình ảnh: ${(visualLanguage || []).join('; ')}
${feedback ? `\nBẢN TRƯỚC BỊ LOẠI VÌ: ${feedback}\nVẽ lại, sửa đúng các lỗi đó.\n` : ''}
NỘI DUNG — BẮT BUỘC:
- CHỈ MỘT vật thể, MỘT góc nhìn. KHÔNG vẽ thêm biến thể, phiên bản phụ, ô chèn (inset), sơ đồ phụ, mặt cắt phụ, nhiều hình chiếu, hay "bộ minh họa" gồm nhiều hình.
- KHÔNG có nền: không khung tròn/vuông/cửa sổ/khung ảnh, không tấm nền, không bầu trời/không gian/nền sao, không mặt đất/cỏ/nước bao quanh, không bục đỡ (trừ khi bục là một phần của vật thật). Xung quanh vật là trong suốt.
- KHÔNG chữ, số, nhãn, mũi tên chú thích, đường gióng, thước đo, lưới, ký hiệu sơ đồ.
- Đúng thực tế: hình dạng, cấu tạo, tỉ lệ, màu sắc như vật thật (hoặc như mô phỏng/ảnh khoa học chính thống nếu là thứ khó quan sát). Không thêm chi tiết bịa.
- Vật lớn, chiếm ~90% khung, căn giữa ngang, ĐÁY vật chạm sát mép dưới viewBox (hình đứng trên mặt đất), không bị cắt.

KỸ THUẬT — BẮT BUỘC:
- Một thẻ <svg> duy nhất có viewBox (vd "0 0 800 800"), KHÔNG width/height.
- Không <text>, <image>, <script>, <foreignObject>, liên kết ngoài.
- Mọi id (kể cả gradient/filter trong <defs>) bắt đầu bằng "${asset.id}-".
- Tách bộ phận chuyển động được thành <g> có id để animate: ${(asset.parts || []).map(x => `"${asset.id}-${x}"`).join(', ') || '(tự chọn 2–5 bộ phận: thứ quay, thứ đung đưa, thứ phát sáng, cửa/cánh/tay...)'}; đặt style="transform-box: fill-box; transform-origin: ..." đúng điểm khớp (trục bánh xe, vai, bản lề, tâm quay).
- Nét viền đậm màu tối (~1.2% cạnh khung), mảng phẳng + 1 lớp bóng — hợp với nhân vật hoạt hình phẳng.
- Mã gọn (dưới ~14000 ký tự).

Chỉ trả về mã SVG trong một khối \`\`\`svg ... \`\`\`.` },
  ];
}

/** Vision check of a freshly drawn asset (one object, no background/insets/labels, recognisably accurate). */
export function assetReviewPrompt(asset, image) {
  return [
    { role: 'system', content: 'Bạn là giám đốc mỹ thuật khó tính, duyệt hình minh họa trước khi đưa vào video giải thích kiến thức. Trả về DUY NHẤT JSON hợp lệ.' },
    { role: 'user', content: [
      { type: 'text', text: `Hình cần là: "${asset.name}" — ${String(asset.description || '').slice(0, 400)}
Duyệt ảnh dưới (nền be nhạt là của trình xem, không tính). LOẠI nếu có bất kỳ lỗi nào:
1. Có nhiều hơn một vật thể/hình: biến thể phụ, ô chèn, sơ đồ phụ, nhiều hình chiếu, "bộ sưu tập".
2. Có nền/khung: khung tròn hay vuông bao quanh, cửa sổ, tấm nền, bầu trời/nền sao, mặt đất/nước bao quanh.
3. Có chữ, số, nhãn, mũi tên chú thích, thước đo, lưới.
4. Sai thực tế nghiêm trọng (người xem sẽ thấy ngay là sai vật / sai cấu tạo cơ bản), méo, vỡ hình, khó nhận ra là gì.
5. Vật quá nhỏ trong khung hoặc bị cắt.
KHÔNG loại vì: bóng đổ mềm ngay dưới chân vật, khác chi tiết nhỏ so với mô tả (đồ cầm tay, tư thế, góc nghiêng), sở thích thẩm mỹ. Chỉ nêu lỗi thuộc 5 mục trên.
JSON: { "ok": true|false, "issues": ["lỗi cụ thể và cách sửa"] }` },
      { type: 'image_url', image_url: { url: image } },
    ] },
  ];
}

// ---------------- scene coder (prompts live in cartoonPrompt.js) ----------------

export function repairPrompt(code, problems) {
  return `Cảnh bạn vừa dựng được chạy thử và phát hiện vấn đề:
${problems.map(x => `- ${x}`).join('\n')}

Hãy sửa triệt để và trả về lại ĐẦY ĐỦ 3 khối \`\`\`html, \`\`\`css, \`\`\`js (không giải thích). Giữ ý tưởng hình ảnh, chỉ sửa lỗi và bố cục.`;
}

export function publishPrompt(p, chaptersText) {
  return [
    { role: 'system', content: 'Bạn là chuyên gia tối ưu YouTube (SEO + tỷ lệ nhấp) cho kênh kiến thức tiếng Việt. Trả về DUY NHẤT JSON hợp lệ.' },
    { role: 'user', content: `Video: "${p.outline.title}"
Luận điểm: ${p.outline.angle}
Lời thoại mở đầu: ${p.scenes.slice(0, 3).map(s => s.narration).join(' ')}
Các chương:
${chaptersText}

Tạo:
- "titles": 5 tiêu đề hấp dẫn (≤ 70 ký tự), không giật tít sai sự thật.
- "description": mô tả 120–200 từ (đoạn mở cuốn hút + tóm tắt nội dung + 3–5 hashtag cuối). KHÔNG chèn mốc thời gian (hệ thống tự thêm).
- "tags": 15 thẻ tìm kiếm.
- "thumbnailText": 3 phương án chữ trên thumbnail (≤ 4 từ).
JSON: { "titles": [], "description": "", "tags": [], "thumbnailText": [] }` },
  ];
}

export function visionReviewPrompt(s, frames, captions) {
  return [
    { role: 'system', content: 'Bạn là đạo diễn hình ảnh khó tính của kênh YouTube giải thích kiến thức. Bạn duyệt khung hình motion-graphics trước khi phát sóng. Trả về DUY NHẤT JSON hợp lệ.' },
    { role: 'user', content: [
      { type: 'text', text: `Các ảnh dưới đây là khung hình ĐẦU (25%), GIỮA và CUỐI của một cảnh video motion graphics giải thích kiến thức (1920×1080, đã thu nhỏ). Cảnh phải minh họa đúng lời thoại bằng hình ảnh đẹp, rõ, có chuyển động — không phải slide chữ.
Lời thoại cảnh: "${s.narration}"
Ý tưởng cảnh: ${s.form ? `[${s.form}] ` : ''}${s.visual}
${captions ? 'Dải chữ có nền tối ở giữa đáy khung là PHỤ ĐỀ của hệ thống — bỏ qua nó. ' : ''}Chữ trên biển hiệu/bảng giá vẽ sẵn trong bối cảnh là một phần phong cảnh — không tính.
Chỉ báo lỗi NGHIÊM TRỌNG mà người xem sẽ thấy ngay:
- TRÔNG NHƯ SLIDE: biểu tượng/hình xếp hàng kèm nhãn chữ trên nền trơn, sơ đồ hộp–mũi tên, chủ thể là chữ thay vì hình (trừ cảnh sơ đồ/số liệu có chủ đích)
- MINH HỌA THEO TỪ KHÓA thay vì đúng hiện tượng: vẽ đúng chữ trong câu (mỏ neo cho "neo trọng lực", tia sét cho "thảm họa", ổ khóa, ngôi sao, trái tim, lửa/sét kiểu icon) thay vì cho thấy hiện tượng thật xảy ra thế nào → yêu cầu vẽ lại hiện tượng (m.draw tự vẽ: quỹ đạo, trục nghiêng, nước phồng, tia sáng…)
- RUNG/LẮC hình, nhiều vòng tròn đồng tâm lan ra → bỏ
- chủ thể chính mà lời thoại nói tới KHÔNG xuất hiện, quá nhỏ, hoặc bị che; hình ảnh không liên quan tới lời thoại
- RỐI: quá nhiều thứ cùng lúc, không rõ đâu là chủ thể; có người/đám đông/thẻ giá/con số/biểu tượng không ứng với ý nào trong lời thoại → yêu cầu BỎ BỚT (cảnh tốt = 1 chủ thể rõ + vài thứ phụ cần thiết)
- người đứng không làm gì liên quan (như người dẫn chương trình), nhân vật thừa không có vai trò
- sai thực tế/tỉ lệ vô lý: xe/người lơ lửng trên trời (trừ vũ trụ/dưới nước), người to hơn nhà, vật cắm vào nhau, vật hiện đại trong bối cảnh cổ
- chữ đè lên chữ, hình che chữ, chữ bị cắt/tràn khung; nhiều hơn ~6 từ chữ hoặc quá 2 nhãn trên màn hình
- khung hình trống/gần như trống; hình vỡ, méo, khó nhận ra là vật gì; nhân vật bị cắt ngoài khung, đứng đè lên nhau; vật/hình chồng lộn xộn
- bố cục lệch nặng (dồn một góc, khoảng trống lớn vô lý)
- bản đồ / hình quốc gia / đường biên giới / dòng sông / cờ bị VẼ TAY sai hình dạng thật (không phải bản đồ dữ liệu thật) → lỗi nghiêm trọng: yêu cầu XÓA hẳn, thay bằng hình khác
Không bắt bẻ chuyện sở thích nhỏ. Mỗi lỗi mô tả cụ thể VỊ TRÍ và CÁCH SỬA (dùng thuật ngữ: m.img / m.draw / m.layout / m.text / m.number / máy quay).

JSON: {"score": 1-10, "issues": ["..."]}` },
      ...frames.map(url => ({ type: 'image_url', image_url: { url } })),
    ] },
  ];
}
