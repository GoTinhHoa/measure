# Prototype: Đối chiếu tấm soạn lẻ với list gốc

**Nguyên tắc**: Cảnh báo, không chặn. Mỗi tấm sai so với list gốc → badge cam, vẫn cho thêm vào danh sách đo. Kiện không có list gốc → im lặng.

---

## 1. Màn cấu hình kiện — sau khi blur khỏi mã kiện

Khi nhân viên nhập mã `MV0159176` rồi blur, app fetch list gốc + tổng tấm đã bán → hiện thông tin phía dưới mã kiện.

### Trường hợp A: Kiện có list gốc

```
┌─────────────────────────────────────────┐
│  MÃ KIỆN                                │
│  ┌───────────────────────────────────┐  │
│  │ MV0159176                         │  │
│  └───────────────────────────────────┘  │
│  ✓ Óc chó NK · 2F · 1COM                │
│  📦 Kiện gốc 40 tấm · 27 tấm còn lại    │
│     (đã bán 13 tấm qua 2 đơn trước)     │
└─────────────────────────────────────────┘
```

### Trường hợp B: Kiện không có list gốc (im lặng)

```
┌─────────────────────────────────────────┐
│  MÃ KIỆN                                │
│  ┌───────────────────────────────────┐  │
│  │ A2073D                            │  │
│  └───────────────────────────────────┘  │
│  ✓ Sồi đỏ Mỹ NK · 4F · FAS              │
│  (không hiện gì thêm — không có gốc)    │
└─────────────────────────────────────────┘
```

### Trường hợp C: Kiện đã bán hết

```
┌─────────────────────────────────────────┐
│  MÃ KIỆN                                │
│  ┌───────────────────────────────────┐  │
│  │ MV0108513                         │  │
│  └───────────────────────────────────┘  │
│  ✓ Óc chó NK · 2F · 2COM                │
│  ⚠ Kiện gốc đã bán hết 40/40 tấm        │
│    Mọi tấm đo thêm sẽ báo "không khớp"  │
└─────────────────────────────────────────┘
```

---

## 2. Lúc đo từng tấm

Mỗi lần bấm rộng (sau khi đã chọn dài) → thêm tấm vào list. So với "túi còn lại" của kiện gốc.

### 2a. Tấm KHỚP với list gốc (bình thường)

```
Toast (xanh, 2s):
┌───────────────────────────┐
│  ✓ Thêm 25 × 18           │
│  Còn 26 tấm trong kiện    │
└───────────────────────────┘
```

### 2b. Tấm KHÔNG có trong gốc → cảnh báo cam

```
Toast (cam, 4s, vibrate nhẹ):
┌─────────────────────────────────────┐
│  ⚠ 25 × 17 không có trong kiện gốc  │
│  Đã thêm nhưng vui lòng kiểm tra    │
└─────────────────────────────────────┘
```

### 2c. Tấm CÓ trong gốc nhưng đã bán hết

```
Toast (cam, 4s):
┌──────────────────────────────────────┐
│  ⚠ 25 × 18 đã hết (gốc có 3 tấm,    │
│  đã bán 3). Đã thêm vẫn cho phép.    │
└──────────────────────────────────────┘
```

---

## 3. List tấm đã đo — đánh dấu trực quan

Tấm "không khớp" hiển thị viền cam + icon ⚠. Tấm khớp bình thường.

```
LƯỢT 1 · 5 tấm
┌─────────────────────────────────┐
│  25 × 18                    [×] │  ← bình thường
├─────────────────────────────────┤
│  ⚠ 25 × 17                  [×] │  ← cam, viền cam
├─────────────────────────────────┤
│  26 × 19                    [×] │
├─────────────────────────────────┤
│  ⚠ 24 × 20                  [×] │  ← cam
├─────────────────────────────────┤
│  25 × 18                    [×] │
└─────────────────────────────────┘
```

---

## 4. Header màn Matrix — tổng kết trước khi share

Nếu có tấm không khớp → badge cam phía bên phải, đếm rõ.

### 4a. Mọi tấm khớp

```
┌──────────────────────────────────────────────────────┐
│  MV0159176 · ÓC CHÓ NK    08/06/2026 14:30          │
│  · 2F · 1COM                            Kiện lẻ      │
│  27 tấm      0.5234 m³                               │
└──────────────────────────────────────────────────────┘
```

### 4b. Có tấm không khớp → cảnh báo

```
┌──────────────────────────────────────────────────────┐
│  MV0159176 · ÓC CHÓ NK    08/06/2026 14:30          │
│  · 2F · 1COM                            Kiện lẻ      │
│  27 tấm      0.5234 m³                               │
│  ⚠ 3 tấm không khớp kiện gốc — kiểm tra trước share  │
└──────────────────────────────────────────────────────┘
```

---

## 5. Ảnh share Zalo — chèn cảnh báo

Khi share, nếu có tấm không khớp → chèn dòng cam vào ảnh (giống dòng đỏ "chưa đồng bộ"), bán hàng và admin nhìn thấy ngay.

```
[ma trận đo bình thường]
─────────────────────────────────────────
⚠ 3 tấm không khớp kiện gốc — kiểm tra
```

---

## 6. DB — bổ sung cờ trong sync

Khi sync lên `bundle_measurements`, thêm field cho từng tấm:

```json
{
  "boards": [
    { "l": 25, "w": 18, "turn": 1 },
    { "l": 25, "w": 17, "turn": 1, "mismatch": "not_in_original" },
    { "l": 26, "w": 19, "turn": 1 },
    { "l": 24, "w": 20, "turn": 1, "mismatch": "sold_out" }
  ],
  "mismatch_count": 2
}
```

`mismatch_count` ở root để query nhanh ("liệt kê các kiện có sai khớp").

---

## 7. Phía GTH-Pricing — view dành cho admin

Trong PgSales "DS kiện lẻ vừa soạn", kiện có `mismatch_count > 0` hiện badge:

```
🔸 MV0159176 · Tần bì · 2F · FAS
  27 tấm · 0.52m³ · Hùng · 08/06 14:30
  ⚠ 3 tấm không khớp kiện gốc          [+ Gán]  [Xóa]
```

Khi mở chi tiết kiện (matrix) → các tấm không khớp tô nền cam, hover/tap hiện lý do.

---

## 8. Logic chốt

```python
# Pseudo
def get_remaining_bag(bundle_code):
    original = fetch_whole_bundle(bundle_code).boards  # [{l,w}]
    if not original:
        return None  # silent — no comparison

    sold_boards = []
    for ord_split in fetch_order_splits(bundle_code, status='đã gán', order_id_not_null):
        sold_boards.extend(ord_split.boards)

    bag = Counter([(b.l, b.w) for b in original])
    for s in sold_boards:
        bag[(s.l, s.w)] -= 1
    return bag  # có thể có giá trị âm nếu bán quá → không sao

def check_board(l, w, bag, session_boards_so_far):
    if bag is None:
        return 'ok'  # không có gốc → im lặng

    # Trừ các tấm vừa đo trong session này
    used_in_session = Counter([(b.l, b.w) for b in session_boards_so_far])
    current = bag[(l, w)] - used_in_session.get((l, w), 0)

    original_had = bag[(l, w)]
    if original_had <= 0:
        return 'not_in_original'  # gốc không có size này
    if current <= 0:
        return 'sold_out'  # gốc có nhưng hết
    return 'ok'
```

---

## 9. Quy ước màu cảnh báo

| Mức | Nền | Chữ | Khi nào |
|-----|-----|-----|---------|
| OK | trắng | đen | Tấm khớp |
| Cảnh báo | `#FEF3C7` | `#92400E` | Tấm không khớp (cả 2 lý do) |
| Lỗi đỏ | `#FEE2E2` | `#B91C1C` | (đã có) Sync fail |

Không phân biệt "not_in_original" và "sold_out" về màu — cùng là cam. Lý do cụ thể chỉ hiện trong toast.

---

## 10. Phase triển khai

| Phase | Việc | Phụ thuộc |
|-------|------|-----------|
| 1 | Fetch + tính bag khi blur mã kiện. Hiện preview ở màn cấu hình | API có |
| 2 | Check mỗi tap, đánh dấu `mismatch` trong board object, toast cảnh báo | Phase 1 |
| 3 | Badge tổng ở header matrix, chèn vào ảnh share | Phase 2 |
| 4 | Sync `mismatch_count` lên DB, hiện badge trong PgSales/PgKiln | Phase 2 + GTH-Pricing |
