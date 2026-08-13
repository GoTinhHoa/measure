# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc với repo này. Ngôn ngữ trao đổi: **tiếng Việt**.

## Tổng quan

PWA "Đo Quy Cách Gỗ" — công nhân đo kích thước từng tấm gỗ trên điện thoại tại xưởng, sync lên Supabase (chung project `tscddgjkelnmlitzcxyg` với hệ GTH Pricing). Nghiệp vụ chi tiết: xem `gth-pricing/BUSINESS.md` mục 8.8 (app đo) + mục 18 (thiết bị).

## Không có build

App tĩnh thuần HTML/CSS/vanilla JS — không package.json, không bundler, không test runner. Chạy local: `python -m http.server` trong thư mục repo. Kiểm tra cú pháp: `node --check app.js`.

**Deploy**: push lên `main` → GitHub Pages (`gotinhhoa.github.io/measure`). Branch local tên `master` track `origin/main` → push bằng `git push origin HEAD:main`.

**Bắt buộc khi sửa code**: bump `APP_VERSION` trong `version.js` (service worker đổi cache name → thiết bị nhận bản mới; pill version hiện trên header app).

## Cấu trúc file

- `index.html` — markup 4 màn hình (access / setup / measure / matrix). ⚠️ Phải giữ `<meta charset="utf-8">` — app.js có tên biến tiếng Việt có dấu (`gốcBoards`, `đã`), thiếu charset là chết parse toàn bộ.
- `app.js` — toàn bộ logic (~1500 dòng)
- `style.css`, `version.js`, `service-worker.js` (network-first, cache theo version), `manifest.json`

## Luồng app

```
Access (mã thiết bị) → Setup (cấu hình kiện) → Measure (bấm đo từng tấm) → Matrix (heatmap/excel, share PNG Zalo)
```

### Access — mã thiết bị qua Supabase
Xác thực bằng bảng `measure_devices` (`code`, `user_name`, `default_type`, `active`) — bảng này do Edge Function `device-manage` (repo gth-pricing) sync ngầm từ `device_codes`, admin quản lý ở màn Quản lý thiết bị của GTH Pricing. Công tắc kiểm soát: `device_settings.restriction_wood_measure`. KHÔNG sửa tay `measure_devices`.

### Setup — 2 chế độ (`currentMeasurementType`, mặc định theo mã thiết bị)
- **`order_split` (Soạn lẻ)**: đo tấm lẻ cho đơn hàng từ kiện có sẵn. Lookup mã kiện → auto-fill loại gỗ/dày/chất lượng; đối chiếu tấm đo với list gốc `wood_bundles.raw_measurements.boards` (bag còn lại = gốc − đã bán).
- **`whole_bundle` (Kiện nguyên)**: xếp kiện MÃ MỚI nhập kho. **Chặn cứng theo cấu hình hệ thống**: loại gỗ chỉ gồm `product_form='processed'` + gỗ có attr `edging` trong `wood_config` (hàm `allowedWoodsForWhole()`); chất lượng phải thuộc `wood_config` attr `quality` của loại gỗ đó (`qualityMap`), giữ đúng case cấu hình ("Đẹp" không uppercase — lệch SKU).
- Cấu hình tải 1 lần lúc mở (`loadWoodTypes()`) + **tự phục hồi** khi fail (`cfgLoaded` / `ensureCfgLoaded()` — gọi lại khi mở suggest / bấm Bắt đầu). Đổi chế độ phải gõ từ khóa xác nhận ("nguyên"/"lẻ").

### Sync
`syncToSystem()` upsert `bundle_measurements` theo `session_id` (unique per kiện, reset khi "Kiện mới"): order_split → PgSales "DS kiện lẻ vừa soạn"; whole_bundle → PgKiln "mẻ xếp". Ghi lịch sử đăng nhập `device_login_history`.

**Guard chống ghi đè phiếu đã gán (26/07/2026)**: trước khi upsert, `syncToSystem` SELECT phiếu theo `session_id` — nếu phiếu đã `status='đã gán'` hoặc `deleted=true` thì TỪ CHỐI sync (toast báo lý do), không ghi đè. Bug cũ (ca kiện A2037 25/07): chia sẻ lại phiên cũ upsert ép status về "chờ gán" → phiếu đã bán quay lại pool chờ gán của PgSales, không hoàn kho, gây nguy cơ bán trùng. KHÔNG bỏ guard này khi sửa syncToSystem.

## Đọc số bằng giọng thu sẵn (v23, 13-08-2026)

Bấm nút chọn Dài/Rộng thì app đọc số lên cho thợ khỏi phải nhìn màn hình. Xưởng ồn nên giọng
của hệ điều hành nghe không rõ, mà **không khuếch đại được**: Web Speech không cho lấy luồng
tiếng ra xử lý, `utterance.volume` tối đa 1 và mặc định đã là 1.

→ App phát **bộ giọng thu sẵn** `voice/*.mp3` qua Web Audio rồi tự khuếch đại:
`gain → cắt mềm tanh (WaveShaper) → nén động → gain bù`. Đo được **+12,2 dB (≈ to gấp 2,3 lần)**
ở mức "To" mà đỉnh vẫn 0,95 (chưa vỡ tiếng). Ba mức Vừa / To / Rất to ở màn Setup, mặc định
**To**, nhớ trong `localStorage.woodMeasureVoiceLevel`, bấm là nghe thử ngay.

- **Chỉ 14 mẩu** (`khong…chin`, `muoi`, `muoi2`=mươi, `mot2`=mốt, `phay`) vì app đọc tắt kiểu
  thợ: 27 = "hai bảy", 21 = "hai mốt", 20 = "hai mươi". `numberToVoiceTokens()` giữ **nguyên**
  cách đọc này của bản cũ — đổi là thợ nghe lạ tai.
- File tạo bằng `edge-tts` giọng **vi-VN-NamMinhNeural** (nam miền Bắc), `--rate=+30%` để khớp
  nhịp nhanh `rate 1.3` của bản cũ (tốc độ này là **cố ý**, giọng mặc định đọc quá chậm).
  Sinh lại: `python -m edge_tts --voice vi-VN-NamMinhNeural --rate=+30% --text "hai" --write-media voice/hai.mp3`
  (thỉnh thoảng trả file 0 byte — phải kiểm tra kích thước và sinh lại).
- File gốc dài 1,78s mà tiếng nói chỉ ~0,2s → `trimSilence()` **cắt khoảng lặng lúc chạy**
  (không cắt thì đọc "hai bảy" mất mấy giây). Đọc "27" hết 0,43s, "27,5" hết 0,97s.
- `speakNumber` **lui về giọng hệ điều hành** (`speakSystem`) khi chưa tải xong bộ giọng — đã
  test: thiếu file thì vẫn đọc, không câm.
- `ensureAudioCtx()` phải gọi trong lúc người dùng chạm (iOS chặn tạo AudioContext chỗ khác) —
  đang gọi ở `startMeasure()` và khi bấm nút chọn mức tiếng.
- ⚠️ Thêm/bớt file trong `voice/` phải cập nhật `urlsToCache` của service-worker (kho hay mất sóng).
- ⚠️ iPhone gạt công tắc im lặng thì **không kêu** — luật iOS, không lách được bằng web.

## Tính thể tích

`calcVolumeFromBoards`: group theo dài, ROUNDDOWN từng nhóm, cộng, /10000 — khớp Excel "Lý lịch gỗ" cũ. Gỗ Mỹ (toggle `woodUS`): dải dài 22–25 dm, rộng 15–25 cm.
