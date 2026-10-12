# Video Studio

Tạo video giải thích kiến thức (khoa học, kinh tế, chính trị, lịch sử, vũ trụ…) từ một câu chủ đề — hoặc từ kịch bản bạn tự viết.

- **AI viết từ chủ đề:** độ dài tự động theo lượng kiến thức cần giải thích (chủ đề hẹp 5–7 phút, vừa 8–11, rộng 12–16; qua API có thể đặt `minutes` để làm bản demo ngắn). Có thể dán tài liệu tham khảo để AI viết chính xác.
- **Dùng kịch bản của tôi:** dán kịch bản — lời thoại giữ nguyên từng chữ, độ dài theo kịch bản. Dòng tiêu đề (`## Phần 2…`, `Chương 3: …`) thành chương; dòng `[Hình: …]` là gợi ý minh họa cho đoạn sau; nhãn "Người dẫn:" tự bỏ. AI chỉ chia cảnh/chương, nghĩ hình minh họa và đánh dấu chỗ nên kiểm chứng.

**Chạy:** nhấp đúp `start.bat` → mở http://localhost:3001

Yêu cầu: Node.js 20+, FFmpeg, Chrome hoặc Edge.

**Khóa API & cấu hình:** đặt file `.env` ở thư mục gốc (copy từ `.env.example`, điền `LLM_API_KEY` và `AI33_API_KEY`). Lần đầu chạy `start.bat` mà chưa có `.env` thì nó tự tạo từ mẫu và mở Notepad để điền. Các giá trị trong `.env` là mặc định; chỉnh trong trang Cài đặt sẽ lưu vào `workspace/settings.json` và được ưu tiên hơn. `.env` và `workspace/` không đưa lên git.

## Quy trình (tự động hoàn toàn)

Mặc định chế độ **Tự động**: không cần vào duyệt — AI biên tập tự soát kịch bản, cảnh lỗi tự làm lại, API lỗi tự gọi lại, xong tự xuất video. (Vẫn có thể chọn "Duyệt kịch bản trước" khi tạo video.)

| Bước | Ai làm | Việc |
|---|---|---|
| 1. Kịch bản | Gemini 3.8 Flash | Dàn ý → viết song song từng chương: lời thoại + **cảnh quay** cho từng cảnh (bối cảnh, thời điểm, cỡ cảnh, diễn biến) → biên tập tự soát sự thật, lặp ý, cảnh giống slide, cỡ cảnh đơn điệu |
| 2. Giọng đọc | Edge TTS (miễn phí) / ai33.pro | Đọc từng cảnh, lấy mốc thời gian từng từ để đồng bộ hình và phụ đề |
| 3. Ảnh minh họa | Flash + model ảnh | Lập danh sách hình theo kịch bản, dùng lại thư viện trước; vẽ mới ≤ 5 lượt (tấm 4 hình), tự tách nền |
| 4. Dựng cảnh | GPT-6 Luna | Viết code cảnh quay hoạt hình → chạy thử trong Chrome, tự phát hiện lỗi → Luna xem khung hình thật để soát → tự sửa; cảnh vẫn hỏng thì **tự làm lại từ đầu** (tối đa 2 vòng, giữ bản tốt hơn) |
| 5. Xuất | Chrome + FFmpeg | Render từng khung hình chính xác (không quay màn hình), 1080p30, phụ đề .srt |

Tự phục hồi: mỗi lệnh gọi AI thử lại 5 lần (chờ 3→45 giây); mỗi bước lỗi tạm thời tự chạy lại sau 20/60/180 giây và tiếp tục từ chỗ dừng; lỗi vĩnh viễn (sai khóa API, hết credit) mới dừng hẳn.

## Phong cách: Motion graphics minh họa

Kiểu Kurzgesagt / TED-Ed / Vox: hình minh họa đẹp do AI vẽ + chữ, số, mũi tên, biểu đồ chuyển động mượt, máy quay trôi, chuyển cảnh mượt. Không người dẫn, không nhân vật cố định.

- **Kể bằng tình huống & ẩn dụ**: chỉ vài khoảnh khắc then chốt (≤ ~1/4 số cảnh) có TRANH TÌNH HUỐNG toàn khung do AI vẽ (cảnh đời thật: gia đình ở quán phở, chợ tranh mua… hoặc ẩn dụ: cỗ máy hút tiền từ ví…); máy quay lướt qua các vùng của tranh (`m.shot`), nhãn/vòng nhấn chỉ đúng chỗ trên tranh (`m.spot`), vật tách nền chuyển động chồng lên. Một tranh dùng chung cho các cảnh liền nhau cùng tình huống.
- **Chuỗi động tác (sprite animation)**: một lượt vẽ cùng một nhân vật/vật ở 4–6 tư thế liên tiếp (đi bộ, vẫy tay, đếm tiền, tim đập…); hệ thống cắt theo ô lưới với khung đồng nhất để các tư thế khớp nhau, runtime phát lặp (`m.img(id, { fps })`) và vẫn di chuyển được.
- **Thiết bị diễn giải bằng chuyển động vật lý** (thay cho kiểu hình–mũi tên–hình): cái cân (`m.balance`), tháp vật cao/thấp (`m.stack(s)`), đổ vào (`m.pour`), phình/xì hơi (`inflate/deflate`), tan thành bụi (`dissolve`), va chạm nhân quả (`hitTo`), bầy vây quanh (`m.swarm`), sóng lan (`m.ripple`), thanh trượt trước/sau (`m.reveal`), kính lúp (`m.magnify`), biến hình liên hoàn (`m.morph`).
- **Mỗi cảnh tự chọn cách diễn đạt** theo câu thoại (đếm, biến đổi, so sánh hai bên, tỉ lệ kích thước, quy trình, vòng lặp, quan hệ trung tâm, phóng to vào chi tiết, dòng thời gian, bản đồ, biểu đồ, con số lớn, chữ động, ẩn dụ hình ảnh…) — biên tập bắt các cảnh liền nhau phải khác nhau.
- **Ảnh AI** (model `gemini-3.1-flash-image`, ≈65 credit/lượt): Flash lập danh sách hình cần vẽ theo kịch bản; mỗi lượt vẽ một tấm tới 6 vật (lưới 3×2, đúng thứ tự) trên nền xanh (hoặc hồng sen nếu vật màu xanh) → tự tách nền, cắt thành hình PNG trong suốt; ảnh nền vẽ riêng, cắt 16:9, làm mờ nhẹ. Ngân sách mặc định "auto" ≈ số cảnh/4 + 2 lượt (3–8; video 14 cảnh ≈ 6 lượt ≈ 390 credit) — đặt số cụ thể ở `imageBudget` trong cài đặt. Mọi hình lưu vào thư viện (`workspace/library/images/`), video sau dùng lại miễn phí.
- **Bộ công cụ chuyển động** `runtime/mg.js`: bố cục tự động (`m.hero / m.pair / m.row / m.count / m.flow / m.cycle / m.orbit / m.scale`), hình xuất hiện kiểu motion (pop, rise, slide, flip, wipe, iris…), biến hình (`swap`), mũi tên vẽ dần, nhãn bám vật, vòng nhấn, gạch chéo, chữ hiện theo từng từ, số đếm lên, dòng vật chạy, hạt (pháo giấy, lấp lánh, mưa, khói…), máy quay zoom/pan. Biểu đồ, sơ đồ khoa học và bản đồ dữ liệu thật vẫn dùng `kit.gfx`.
- **Chuyển cảnh** do kịch bản chọn: cut, fade, slide, zoom, wipe, iris, whip.

Prompt dựng cảnh: `server/motionPrompt.js`; tạo ảnh & tách nền: `server/imagegen.js`; bước ảnh: `server/pipeline/images.js`. Bộ hoạt hình 2D cũ (`runtime/cartoon.js`, `world-kit.js`, `envs-*.js`) vẫn còn trong mã nhưng không dùng mặc định.

**Thư viện dùng lại (trang "Thư viện"):** mọi hình Astra đã vẽ (`workspace/library/`) và nhân vật đã tạo (`workspace/library/cast.json`) được giữ lại; video sau Astra xem thư viện và dùng lại khi đúng vật (miễn phí). Lời thoại không gọi tên nhân vật — chỉ gọi theo vai ("một người thợ", "bạn").

**Quy tắc lãnh thổ:** bản đồ, hình quốc gia, biên giới, sông, cờ chỉ vẽ từ dữ liệu thật (world-atlas / circle-flags). Không có dữ liệu chính xác thì không đưa vào — AI không tự vẽ, Astra không vẽ bản đồ/cờ.

Giọng mặc định: **Minh Quân** (Vbee qua ai33.pro, trả phí theo ký tự). Đổi trong Cài đặt → Mặc định hoặc khi tạo video.

## Chi phí

Một video ~2 phút: kịch bản (Flash) ~80–150, ảnh AI ≤ 5 lượt × 65 ≈ 325 (ít hơn nếu dùng lại thư viện), dựng cảnh (Luna) ~300–450, soát hình ~30–90 credit. Astra không còn được gọi mặc định.

## Thư mục

- `server/` — backend (Express): `pipeline/` các bước, `prompts.js` toàn bộ prompt, `styles.js` phong cách, `visualSpec.js` bối cảnh & cỡ cảnh
- `runtime/` — engine phát cảnh (dùng chung cho xem trước và xuất video) + bộ kit đồ họa cho AI
- `web/` — giao diện (React + Vite)
- `workspace/` — dữ liệu (không đưa lên git): dự án, thư viện hình, nhạc nền (`workspace/music/`), `settings.json`
- `.env` — khóa API & cấu hình máy (không đưa lên git; mẫu: `.env.example`)
