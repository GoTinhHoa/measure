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

## Đọc số khi chọn Dài/Rộng — đã thử giọng thu sẵn rồi BỎ (13-08-2026)

`speakNumber()` dùng giọng của hệ điều hành (Web Speech), `rate 1.3`. **Tốc độ 1.3 là cố ý** —
giọng mặc định đọc quá chậm, thợ chờ lâu. Đừng "sửa" cho chậm lại.

Thợ báo tiếng nhỏ so với xưởng ồn. Đã thử nâng ở v23/v24 rồi **quay lại v22 theo yêu cầu**:

- Giọng hệ điều hành **không khuếch đại được**: Web Speech không cho lấy luồng tiếng ra xử lý,
  `utterance.volume` tối đa 1 và mặc định đã là 1 → bản hiện tại đang chạy hết cỡ rồi.
- v23 thay bằng **bộ giọng thu sẵn** (14 mẩu MP3 do `edge-tts` giọng vi-VN-NamMinhNeural tạo,
  ghép theo cách đọc tắt "27 = hai bảy") rồi khuếch đại bằng WaveShaper tanh. Đo +12,2 dB nhưng
  thợ báo **rè, vỡ tiếng**: tanh bóp giọng thành gần sóng vuông, tỷ lệ đỉnh/trung bình rơi từ
  5,2 xuống 1,79. ⚠️ **Cắt mềm (tanh) hợp tiếng bíp, KHÔNG hợp giọng người.**
- v24 sửa sạch tiếng (cân mức từng mẩu → cắt bass → nhấn 2,6kHz → nén nhẹ → chặn đỉnh) nhưng
  trần chỉ còn **~+6 dB**, và user chọn quay về v22.

**Kết luận cho lần sau**: muốn to hơn nữa thì giới hạn nằm ở loa điện thoại, không phải phần mềm
— dùng loa Bluetooth mini đeo người. Nếu vẫn muốn làm lại đường giọng thu sẵn, xem commit
`886f681` (v23) và `21ba0fa` (v24) để lấy code + tham số đã đo, và bắt buộc kiểm chứng bằng
OfflineAudioContext: **đỉnh ≤ 0,93 và tỷ lệ đỉnh/trung bình ≥ 3** thì mới không rè.

## Tính thể tích

`calcVolumeFromBoards`: group theo dài, ROUNDDOWN từng nhóm, cộng, /10000 — khớp Excel "Lý lịch gỗ" cũ. Gỗ Mỹ (toggle `woodUS`): dải dài 22–25 dm, rộng 15–25 cm.
