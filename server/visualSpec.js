// Shared visual vocabulary for the illustrated 2D style: the environments the runtime can draw (runtime/envs-*.js)
// and the shot sizes. Script writer, editor and scene coder all speak this vocabulary.

// [name, what it shows, options, places (spots) and lanes]
export const ENVS = [
  ['city', 'phố thị hiện đại: nhà cao tầng, cửa hàng, vỉa hè, đường có ô tô xe máy chạy', "time: 'day'|'sunset'|'night'", "spots: left, center, right, sky · lanes: road (xe chạy), sidewalk (người đi), sky (vật bay)"],
  ['street', 'dãy cửa hàng nhìn ngang tầm mắt: tạp hóa, tiệm bánh, cà phê, ngân hàng, nhà thuốc, điện máy, tiệm vàng', 'time', 'spots: grocery, bakery, cafe, bank, pharmacy, electronics, goldshop · lanes: sidewalk, road'],
  ['market', 'chợ truyền thống Việt Nam: sạp rau quả, cá, gạo, hoa, dây đèn lồng', 'time', 'spots: stall1, stall2, stall3, stall4, stall5, center'],
  ['village', 'làng quê Việt Nam: núi đá vôi trong sương, ruộng lúa nước, nhà mái ngói, tre, chuối', "time; variant: 'ancient' (nhà tranh thời xưa)", 'spots: house, field, path · lanes: path, field, sky'],
  ['farm', 'nông trại: đồng lúa mì, kho thóc đỏ, silo, cối xay gió quay', 'time', 'spots: barn, field, mill · lanes: road, field, sky'],
  ['factory', 'xưởng sản xuất: máy dập, bánh răng quay, tay robot, băng chuyền chở hàng', '', 'spots: press, gears, robot, belt · lanes: belt (sản phẩm chạy trên băng chuyền), floor'],
  ['lab', 'phòng thí nghiệm: kệ hóa chất, kính hiển vi, cốc sủi bọt, màn hình biểu đồ', '', 'spots: bench, microscope, screen · lanes: bench (đồ đặt trên bàn)'],
  ['office', 'văn phòng có cửa kính nhìn ra phố, bàn máy tính, bảng trắng', "time; variant: 'trading' (sàn giao dịch: tường màn hình nến tăng giảm, băng giá chạy)", 'spots: desk, screen, window'],
  ['home', 'phòng khách gia đình: sofa, TV, cửa sổ, đèn', "time; variant: 'kitchen' (nhà bếp)", 'spots: sofa, table, window, tv'],
  ['ancient', 'lịch sử cổ – trung đại', "variant: 'citadel' (tường thành, cổng, cờ, đuốc) | 'camp' (doanh trại, lều, lửa trại) | 'palace' (cung điện, cột son, bệ rồng); time", 'spots: gate, wall, fire, tent, throne, left, right'],
  ['ocean', 'biển khơi tới chân trời, sóng, mặt trời phản chiếu', "time; variant: 'open' | 'beach' (bãi cát, dừa, dù) | 'port' (cảng container, cần cẩu, tàu hàng)", 'spots: sea, horizon, dock, crane, containers · lanes: sea (tàu thuyền), near, horizon, dock, sky'],
  ['river', 'dòng sông giữa núi đá vôi, lau sậy hai bờ', 'time', 'spots: river, bank · lanes: river (thuyền), far, bank, sky'],
  ['underwater', 'dưới biển: tia nắng xuyên nước, đàn cá, san hô, rong, bọt khí', "variant: 'deep' (biển sâu tối, sinh vật phát sáng)", 'spots: center, seabed · lanes: water (vật bơi lơ lửng), seabed'],
  ['mountains', 'dãy núi tuyết, sương, rừng thông, đồng cỏ hoa', "time; variant: 'volcano' (núi lửa phun khói, dung nham chảy)", 'spots: peak / volcano, center · lanes: sky, path'],
  ['forest', 'rừng cây, tia nắng xuyên tán lá, dương xỉ', 'time (đêm có đom đóm)', 'spots: center, clearing'],
  ['desert', 'sa mạc cồn cát, xương rồng, nắng gắt', 'time', 'spots: center, dunes · lanes: sand, far, sky'],
  ['arctic', 'Bắc Cực: núi băng trôi, thềm băng, tuyết rơi', 'time (đêm có cực quang)', 'spots: center, sea · lanes: sea, ice'],
  ['space', 'không gian sâu: tinh vân, sao lấp lánh, sao băng, hành tinh ở góc', "variant: 'nebula' | 'deep' | 'warm' | 'galaxy' (dải thiên hà xoắn ốc); planet: false để bỏ hành tinh góc", 'spots: center, left, right · KHÔNG có mặt đất: vật/nhân vật phải đặt y (nhân vật thêm float: true)'],
  ['orbit', 'trên quỹ đạo: Trái Đất thật (lục địa thật) cong phía dưới, Mặt Trời chói', 'lon, lat (vùng Trái Đất nhìn thấy, mặc định Đông Nam Á)', 'spots: center, earth · lanes: orbit'],
  ['earth', 'Trái Đất (lục địa thật) xoay giữa không gian', 'lon, lat, size', 'spots: earth, left, right'],
  ['moon', 'bề mặt Mặt Trăng, Trái Đất treo trên trời đen', "variant: 'mars' (Sao Hỏa đỏ, bụi bay)", 'spots: center, earth, horizon · lanes: surface, sky'],
  ['bloodstream', 'bên trong mạch máu: hồng cầu, bạch cầu bay về phía máy quay', '', 'spots: center'],
  ['cell', 'bên trong tế bào: ty thể, lưới nội chất, nhân tế bào ở cạnh', '', 'spots: center, nucleus'],
  ['molecules', 'thế giới phân tử: phân tử nước, CO2 trôi và xoay', "molecules: ['h2o','co2']", 'spots: center'],
  ['digital', 'không gian số: sàn lưới phát sáng, mạch dữ liệu chạy, nút mạng', '', 'spots: center · lanes: floor, air'],
  ['abstract', 'nền trừu tượng dịu — dành cho cảnh sơ đồ / số liệu', "color: 'warm'|'cool'|'mint'|'night'|'sunset'|'paper'", 'spots: center'],
];
export const ENV_NAMES = ENVS.map(e => e[0]);
/** Prompt text: one line per environment (full = with spots/lanes for the coder). */
export const envCatalog = (full = false) => ENVS.map(([n, d, o, s]) => `- ${n}: ${d}${o ? ` [${o}]` : ''}${full && s ? `\n      ${s}` : ''}`).join('\n');

export const SHOTS = {
  wide: 'toàn cảnh thiết lập: thấy cả bối cảnh và nhiều thứ đang diễn ra',
  medium: 'trung cảnh: một chủ thể (người/vật) đang hành động rõ ràng',
  close: 'cận cảnh: một vật/chi tiết lớn giữa khung, máy quay đẩy vào',
  macro: 'thế giới vi mô / bên trong vật (tế bào, mạch máu, phân tử, linh kiện)',
  diagram: 'cảnh cắt sơ đồ cơ chế chính xác (hệ Mặt Trời, nguyên tử, cung–cầu, hố đen...)',
  data: 'cảnh số liệu: biểu đồ, con số lớn đếm lên, so sánh',
};
export const SHOT_NAMES = Object.keys(SHOTS);
export const shotList = () => Object.entries(SHOTS).map(([k, v]) => `"${k}" — ${v}`).join('\n  ');
export const shotToType = s => ({ diagram: 'diagram', data: 'chart' }[s] || 'illustration');
