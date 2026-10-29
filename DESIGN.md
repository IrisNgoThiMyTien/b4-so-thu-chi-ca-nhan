# DESIGN – Ứng dụng Sổ Thu Chi Cá Nhân

> Tài liệu thiết kế giao diện đi kèm [PRD.md](PRD.md). Mọi giá trị dưới đây là **design token** – khai báo một lần (CSS variables) và dùng lại ở mọi nơi.

---

## 1. Tổng quan

**Cảm giác chủ đạo:** gọn, sáng, đáng tin – như một cuốn sổ tay tài chính hiện đại. Số liệu là nhân vật chính; giao diện lùi lại phía sau.

**Nguyên tắc thiết kế**
1. **Nhập nhanh trước tiên** – nút ＋ luôn trong tầm ngón cái; Trang nhập liệu ưu tiên ô số tiền và danh mục.
2. **Số liệu dễ đọc trong 3 giây** – số lớn, dùng chữ số đều nhau (tabular), thu/chi phân biệt bằng màu **và** dấu +/−.
3. **Mobile-first** – thiết kế cho 360–430 px, rồi nở rộng cho laptop.
4. **Sáng/tối ngang hàng** – hai bộ màu được thiết kế riêng, không chỉ đảo màu.
5. **Ít trang trí** – chỉ dùng màu để mang ý nghĩa (thu, chi, cảnh báo, hành động chính).

**Bố cục màn hình:** 2 màn hình – *Trang chủ* và *Trang nhập liệu*; *Cài đặt* là bảng trượt (bottom sheet / hộp thoại bên phải trên laptop).

## 2. Màu sắc

Khai báo trên `:root`; chế độ tối ghi đè dưới `@media (prefers-color-scheme: dark)` (khi chọn "Theo hệ thống") và `[data-theme="dark"]` / `[data-theme="light"]` (khi người dùng chọn tay).

### 2.1 Màu nền & chữ

| Token | Sáng | Tối | Dùng cho |
|-------|------|-----|----------|
| `--bg` | `#F6F7F9` | `#0F1216` | Nền trang |
| `--surface` | `#FFFFFF` | `#181C22` | Thẻ, danh sách, bảng |
| `--surface-2` | `#EEF0F3` | `#222831` | Ô nhập, chip, nền phụ |
| `--border` | `#E1E4E9` | `#2C333D` | Đường kẻ, viền |
| `--text` | `#14181F` | `#ECEFF3` | Chữ chính (tương phản ≥ 12:1) |
| `--text-muted` | `#5B6472` | `#9AA4B2` | Chữ phụ, nhãn (≥ 4.5:1) |

### 2.2 Màu ngữ nghĩa

| Token | Sáng | Tối | Dùng cho |
|-------|------|-----|----------|
| `--primary` | `#2F6FED` | `#6B9BFF` | Nút chính, liên kết, mục đang chọn |
| `--on-primary` | `#FFFFFF` | `#0B1220` | Chữ trên nền primary |
| `--income` | `#0E9F6E` | `#34D399` | Khoản **thu**, số dương |
| `--expense` | `#E5484D` | `#FF7B80` | Khoản **chi**, số âm |
| `--warning` | `#D98A00` | `#F5B544` | Ngân sách ≥ 80% |
| `--danger` | `#C93036` | `#FF6369` | Lỗi, hành động xoá, ngân sách vượt |
| `--focus` | `#2F6FED` | `#8DB1FF` | Vòng focus bàn phím |

> Chữ màu `--income`/`--expense` trên `--surface` đạt ≥ 4.5:1 ở cả hai chế độ (kiểm lại bằng công cụ khi đổi giá trị).

### 2.3 Màu biểu đồ

- **Biểu đồ cột (tuần/ngày):** Thu = `--income`, Chi = `--expense`; cột đặt cạnh nhau, không chồng.
- **Biểu đồ đường (số dư luỹ kế):** đường `--primary` 2 px, vùng tô mờ 12% dưới đường; vạch 0 màu `--border`.
- **Biểu đồ tròn (danh mục chi):** bảng màu phân loại 8 màu, phân biệt được cả khi mất cảm nhận màu (kèm nhãn % và chú giải):

| Danh mục | Sáng | Tối |
|----------|------|-----|
| Ăn uống | `#E5484D` | `#FF7B80` |
| Di chuyển | `#F08A24` | `#FFA94D` |
| Nhà ở | `#2F6FED` | `#6B9BFF` |
| Mua sắm | `#9B51E0` | `#C08BFF` |
| Giải trí | `#E255A1` | `#FF8CC6` |
| Sức khoẻ | `#0E9F6E` | `#34D399` |
| Học tập | `#0EA5C6` | `#4FD1EC` |
| Khác | `#7C8594` | `#A3ACB9` |

Danh mục người dùng tự thêm lấy màu tiếp theo trong bảng (quay vòng). Không dùng quá 8 miếng; phần còn lại gộp vào "Khác".

## 3. Chữ viết

**Font:** `Be Vietnam Pro` (Google Fonts, hỗ trợ đầy đủ dấu tiếng Việt), dự phòng `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Số tiền dùng `font-variant-numeric: tabular-nums`.

| Vai trò | Cỡ / Dòng | Đậm | Dùng cho |
|---------|-----------|-----|----------|
| Display | 32 / 40 px | 700 | Ô số tiền ở Trang nhập liệu |
| Số liệu lớn | 24 / 32 px | 700 | Thu / Chi / Số dư trong thẻ tổng quan |
| Tiêu đề trang (H1) | 20 / 28 px | 600 | Tên tháng, tiêu đề Trang nhập liệu |
| Tiêu đề mục (H2) | 16 / 24 px | 600 | Tiêu đề biểu đồ, tiêu đề nhóm ngày |
| Nội dung | 15 / 22 px | 400 | Tên giao dịch, ghi chú |
| Số tiền trong danh sách | 15 / 22 px | 600 | Số tiền mỗi dòng |
| Phụ | 13 / 18 px | 400–500 | Ví, ngày, nhãn trục biểu đồ |
| Nút | 16 / 24 px | 600 | Nút Lưu, nút chính |

**Quy tắc**
- Số tiền: `1.250.000 ₫`; thu có tiền tố `+`, chi có tiền tố `−` (dấu trừ thật `−`, không dùng gạch ngang). Số rút gọn trên trục biểu đồ: `1,2tr`, `850k`.
- Ngày: `dd/MM/yyyy`; nhóm ngày hiển thị "Hôm nay", "Hôm qua", sau đó "Thứ Sáu, 23/10".
- Cỡ chữ tối thiểu 13 px; không dùng chữ in hoa toàn bộ cho câu tiếng Việt.
- Không dùng quá 2 độ đậm trong cùng một thành phần.

## 4. Khoảng cách & Bố cục

**Thang khoảng cách (cơ sở 4 px):** `4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`
Token: `--space-1` … `--space-8`.

**Lưới & lề**
| Màn hình | Lề ngang | Chiều rộng nội dung | Cách sắp xếp |
|----------|----------|---------------------|--------------|
| Điện thoại < 640 px | 16 px | 100% | 1 cột, các khối xếp dọc, khoảng cách giữa khối 16 px |
| Laptop ≥ 640 px | 24 px | Tối đa 960 px, căn giữa | Trang chủ: hàng trên 3 thẻ ngang; dưới là 2 cột – biểu đồ (trái, ~60%) và danh sách (phải, ~40%, cuộn riêng) |

**Trang chủ (điện thoại), từ trên xuống**
```
┌──────────────────────────────┐
│ ◀  Tháng 10/2026  ▶       ⚙ │  Thanh trên (dính đầu trang) – cao 56
├──────────────────────────────┤
│ Thu        Chi       Số dư   │  3 thẻ tổng quan (Số dư rộng hơn)
│ +18,5tr    −12,3tr   +6,2tr  │
├──────────────────────────────┤
│ Thu & chi theo tuần          │  Carousel biểu đồ (cao ~240)
│  ▇▅  ▇▃  ▆▄  ▅▂              │  vuốt ngang ↔
│         ● ○ ○ ○              │  chấm chỉ báo
├──────────────────────────────┤
│ [Ngân sách tháng – nếu bật]  │
├──────────────────────────────┤
│ 🔍 Tìm…            [Lọc ▾]   │
│ Hôm nay            −85.000   │  Nhóm theo ngày
│  🍜 Ăn uống · Tiền mặt  −45k │
│  🚌 Di chuyển · Ví MoMo −40k │
│ Hôm qua            +500.000  │
│  …                           │
│                          ＋  │  FAB (nút nổi) góc dưới phải
└──────────────────────────────┘
```

**Trang nhập liệu (điện thoại), từ trên xuống**
```
┌──────────────────────────────┐
│ ✕      Thêm khoản      (Xoá)│  Thanh tiêu đề; "Xoá" chỉ khi sửa
├──────────────────────────────┤
│     [  Chi  |  Thu  ]        │  Segmented control
│                              │
│          0 ₫                 │  Ô số tiền (Display)
│                              │
│ Danh mục                     │
│ [🍜][🚌][🏠][🛍]             │  Lưới 4 cột
│ [🎮][💊][📚][…]              │
│ Ví   [Tiền mặt ▾]            │
│ Ngày [27/10/2026 📅]         │
│ Ghi chú [__________________] │
├──────────────────────────────┤
│        [   Lưu   ]           │  Nút chính, dính đáy
└──────────────────────────────┘
```
Trên laptop, Trang nhập liệu hiển thị dạng hộp thoại giữa màn hình (rộng 480 px) phủ lên Trang chủ; trên điện thoại là toàn màn hình.

**Vùng chạm:** tối thiểu 44×44 px; khoảng cách giữa hai vùng chạm ≥ 8 px. Nút ＋ và nút Lưu nằm trong tầm ngón cái; chừa `env(safe-area-inset-bottom)` cho iPhone.

## 5. Hình khối & Chiều sâu

**Bo góc**
| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--radius-sm` | 8 px | Chip, ô nhập, tooltip |
| `--radius-md` | 12 px | Nút, ô danh mục |
| `--radius-lg` | 16 px | Thẻ, khối biểu đồ |
| `--radius-xl` | 24 px | Bảng trượt (góc trên) |
| `--radius-full` | 999 px | FAB, chấm chỉ báo, segmented control |

**Bóng đổ (rất nhẹ – chiều sâu chủ yếu nhờ màu nền và viền)**
| Token | Sáng | Tối | Dùng cho |
|-------|------|-----|----------|
| `--shadow-1` | `0 1px 2px rgba(16,24,40,.06)` | không bóng; dùng viền `--border` | Thẻ |
| `--shadow-2` | `0 6px 16px rgba(16,24,40,.12)` | `0 6px 16px rgba(0,0,0,.5)` | FAB, tooltip, menu |
| `--shadow-3` | `0 16px 40px rgba(16,24,40,.18)` | `0 16px 40px rgba(0,0,0,.6)` | Bảng trượt, hộp thoại |

**Lớp (z-index):** nội dung 0 · thanh trên 10 · FAB 20 · lớp phủ mờ 30 · bảng trượt/hộp thoại 40 · thông báo (toast) 50.
**Lớp phủ mờ:** `rgba(0,0,0,.4)` (sáng) / `rgba(0,0,0,.6)` (tối).
**Viền:** 1 px `--border`; mục đang chọn dùng viền 2 px `--primary`.

## 6. Thành phần giao diện

### 6.1 Thanh tháng (Month bar)
- Bố cục: nút ◀ — **Tháng 10/2026** (bấm mở bộ chọn tháng) — nút ▶, bên phải là nút ⚙.
- Nút ▶ bị vô hiệu ở tháng hiện tại (không xem tương lai). Dính đầu trang, nền `--bg` mờ nhẹ khi cuộn.

### 6.2 Thẻ tổng quan (Summary card)
- 3 thẻ: **Thu** (số `--income`), **Chi** (số `--expense`), **Số dư** (`--text`, âm thì `--expense`).
- Nền `--surface`, bo `--radius-lg`, đệm 16 px. Nhãn 13 px `--text-muted`, số 24 px đậm. Số quá dài tự rút gọn (`18,5tr`) và hiện đầy đủ khi chạm/di chuột.

### 6.3 Carousel biểu đồ
- Khung `--surface`, bo `--radius-lg`, tiêu đề H2 + mô tả ngắn; vuốt ngang bằng CSS scroll-snap; **chấm chỉ báo** 4 chấm bên dưới (đang chọn: `--primary`, kéo dài thành viên thuốc 16×6 px). Laptop: thêm nút ‹ › hai bên và hỗ trợ phím ← →.
- Thứ tự cố định:
  1. **Thu & chi theo tuần** – cột đôi (Tuần 1–5 của tháng). *Mặc định hiển thị.*
  2. **Chi theo danh mục** – biểu đồ tròn dạng vành khuyên; giữa vành là tổng chi; chú giải bên dưới (màu + tên + % + số tiền).
  3. **Thu & chi theo ngày** – cột đôi theo từng ngày trong tháng; cuộn ngang nếu hẹp.
  4. **Số dư luỹ kế** – biểu đồ đường theo ngày.
- Chạm vào một phần tử → tooltip (nền `--surface`, `--shadow-2`) hiện nhãn + số tiền. Trục: lưới ngang mờ (`--border`), nhãn 13 px `--text-muted`.
- Mỗi biểu đồ có nút "Xem dạng bảng" (cho trình đọc màn hình) – ẩn trực quan, hiện khi focus.

### 6.4 Danh sách giao dịch
- **Tiêu đề nhóm ngày:** "Hôm nay" bên trái, tổng ròng của ngày bên phải (13 px `--text-muted`).
- **Dòng giao dịch** (cao ≥ 56 px): biểu tượng danh mục trong vòng tròn 40 px (nền = màu danh mục 15%) · tên danh mục + dòng phụ "Ví · ghi chú" (cắt 1 dòng) · số tiền bên phải (`+`/`−`, màu thu/chi).
- Chạm → sửa. Vuốt trái → hiện nút **Xoá** (`--danger`). Laptop: di chuột hiện biểu tượng ✎ và 🗑.
- **Tìm & lọc:** ô tìm (bo `--radius-full`, nền `--surface-2`) + nút Lọc mở bảng chọn (Loại, Danh mục, Ví); các bộ lọc đang bật hiển thị thành chip có ✕.

### 6.5 Nút
| Loại | Kiểu | Dùng cho |
|------|------|----------|
| Chính | Nền `--primary`, chữ `--on-primary`, cao 48, bo `--radius-md`, rộng 100% trên mobile | Lưu |
| Phụ | Viền 1 px `--border`, nền trong suốt, chữ `--text` | Huỷ, Đóng |
| Nguy hiểm | Chữ/viền `--danger` (xác nhận xoá: nền `--danger`) | Xoá |
| Văn bản | Chữ `--primary`, không nền | Hoàn tác, Xem tất cả |
| FAB | Tròn 56 px, nền `--primary`, biểu tượng ＋ 24 px, `--shadow-2` | Thêm giao dịch |

### 6.6 Biểu mẫu (Trang nhập liệu)
- **Segmented control Chi | Thu:** nền `--surface-2`, mục chọn có nền `--expense` (Chi) hoặc `--income` (Thu), chữ trắng; đổi loại thì lưới danh mục đổi theo.
- **Ô số tiền:** cỡ Display, căn giữa, hậu tố ₫; bàn phím số (`inputmode="numeric"`); tự chèn dấu chấm ngăn cách; màu chữ theo loại (chi/thu).
- **Lưới danh mục:** 4 cột; mỗi ô gồm biểu tượng 28 px + tên 13 px; ô chọn: viền 2 px `--primary` + nền `--primary` 10%. Ô cuối "＋ Thêm" mở nhập tên danh mục mới.
- **Chọn ví:** danh sách chip ngang hoặc ô chọn (select) với biểu tượng ví; nhớ ví dùng gần nhất.
- **Ngày:** ô chọn ngày hệ thống, mặc định hôm nay, có nút nhanh "Hôm nay / Hôm qua".
- **Ghi chú:** ô văn bản 1 dòng, tối đa 120 ký tự, có bộ đếm khi còn < 20.
- Nhãn luôn nằm trên ô (không dùng placeholder thay nhãn). Lỗi hiện dưới ô, chữ `--danger` 13 px kèm biểu tượng.

### 6.7 Bảng trượt Cài đặt (Bottom sheet)
- Từ đáy lên, bo `--radius-xl`, tay nắm kéo 36×4 px, cao tối đa 90% màn hình; laptop: hộp thoại 480 px bên phải.
- Mục: **Giao diện** (Theo hệ thống / Sáng / Tối – segmented control) · **Ví** · **Danh mục** · **Ngân sách** (công tắc bật/tắt – mặc định tắt) · **Dữ liệu** (Xuất / Nhập).

### 6.8 Thẻ ngân sách (chỉ hiện khi bật)
- Hiển thị dưới carousel: tiêu đề "Ngân sách tháng", mỗi danh mục một dòng: tên · `đã chi / hạn mức` · thanh tiến độ cao 8 px.
- Màu thanh: < 80% `--primary`; 80–99% `--warning`; ≥ 100% `--danger` (kèm nhãn "Vượt 120.000 ₫", không chỉ dựa vào màu).

### 6.9 Thông báo (Toast) & hộp xác nhận
- Toast: nền `--text` đảo màu (tối trên sáng, sáng trên tối), bo `--radius-md`, nằm trên FAB, tự đóng sau 4 giây; có nút **Hoàn tác** sau khi xoá.
- Xác nhận xoá: hộp thoại nhỏ "Xoá khoản này?" – nút Huỷ (phụ) và Xoá (nguy hiểm).

## 7. Biểu tượng & Hình ảnh

- **Bộ biểu tượng:** một bộ nét (outline) duy nhất, nét 1.75 px, bo tròn đầu nét, lưới 24 px – ví dụ Lucide hoặc Phosphor (nhúng dạng SVG nội tuyến để chạy offline). Màu mặc định `currentColor`.
- **Kích cỡ:** 20 px (trong dòng/nút), 24 px (thanh trên, FAB), 28 px (lưới danh mục), 40 px vòng tròn nền (danh sách).
- **Biểu tượng danh mục mặc định:**

| Danh mục | Biểu tượng | Danh mục | Biểu tượng |
|----------|-----------|----------|-----------|
| Ăn uống | utensils | Lương | wallet |
| Di chuyển | bus | Thưởng | gift |
| Nhà ở | home | Làm thêm | briefcase |
| Mua sắm | shopping-bag | Khác (thu/chi) | circle-ellipsis |
| Giải trí | gamepad | **Ví:** Tiền mặt | banknote |
| Sức khoẻ | heart-pulse | Ngân hàng | landmark |
| Học tập | book-open | Ví điện tử | smartphone |

- **Không dùng emoji** làm biểu tượng chính thức (hiển thị khác nhau giữa hệ điều hành); emoji chỉ dùng trong bản phác thảo ở tài liệu này.
- **Hình ảnh:** không có ảnh chụp/minh hoạ nặng. Trạng thái trống dùng một minh hoạ SVG đơn sắc đơn giản (cuốn sổ + đồng xu) tô bằng `--text-muted` và `--primary`, ≤ 4 KB.
- **Biểu tượng ứng dụng (PWA):** 192×192 và 512×512, nền `--primary`, ký hiệu ₫ trắng ở giữa; có phiên bản maskable.
- **Thu/chi không chỉ nhờ màu:** thêm mũi tên ↓ (thu) / ↑ (chi) nhỏ hoặc dấu +/− cạnh số tiền.

## 8. Chuyển động

**Nguyên tắc:** chuyển động ngắn, có mục đích (giải thích thay đổi), không gây phân tâm. Tôn trọng `prefers-reduced-motion: reduce` → tắt hiệu ứng trượt/phóng, chỉ giữ chuyển mờ dần tức thời (≤ 100 ms).

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Phần tử xuất hiện |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Phần tử biến mất |
| `--dur-fast` | 120 ms | Hover, nhấn nút, đổi chip |
| `--dur-base` | 200 ms | Đổi màu, thanh tiến độ, toast |
| `--dur-slow` | 320 ms | Chuyển màn hình, bảng trượt, biểu đồ vẽ |

| Tương tác | Hiệu ứng |
|-----------|----------|
| Nhấn nút / thẻ | Thu nhỏ còn 0.97 trong `--dur-fast`; thả ra trở lại |
| Mở Trang nhập liệu | Mobile: trượt từ đáy lên (`--dur-slow`); Laptop: hộp thoại mờ dần + phóng 0.96 → 1 |
| Đóng / Lưu | Ngược lại với khi mở; sau Lưu, dòng mới vừa thêm nháy nền `--primary` 12% trong 600 ms |
| Vuốt carousel | Cuộn có điểm dừng (snap); chấm chỉ báo đổi bề rộng trong `--dur-base` |
| Vẽ biểu đồ | Cột mọc từ đáy, vành khuyên quay mở, đường vẽ dần – 400–600 ms, chỉ lần đầu hiện/đổi tháng |
| Đổi tháng | Biểu đồ và số liệu mờ dần đổi sang dữ liệu mới (`--dur-base`); số trong thẻ đếm nhẹ lên giá trị mới (≤ 300 ms) |
| Xoá dòng | Dòng thu gọn chiều cao về 0 + mờ dần (`--dur-base`), toast "Hoàn tác" xuất hiện |
| Đổi sáng/tối | Chuyển màu nền & chữ mượt 200 ms |
| Toast | Trượt lên + mờ dần vào; tự biến mất sau 4 s |

## 9. Trạng thái giao diện

### 9.1 Trạng thái thành phần tương tác
| Trạng thái | Nút chính | Ô nhập | Dòng danh sách / ô danh mục |
|------------|-----------|--------|------------------------------|
| Mặc định | Nền `--primary` | Nền `--surface-2`, viền `--border` | Nền `--surface` |
| Hover (laptop) | Nền sáng/tối hơn 8% | Viền `--text-muted` | Nền `--surface-2` |
| Focus bàn phím | Vòng 2 px `--focus`, cách 2 px | Viền 2 px `--focus` | Vòng 2 px `--focus` |
| Nhấn (active) | Thu nhỏ 0.97 | – | Nền `--surface-2` đậm hơn |
| Đã chọn | – | – | Viền 2 px `--primary` + nền `--primary` 10% |
| Vô hiệu | Nền `--surface-2`, chữ `--text-muted`, không phản hồi | Nền mờ 60% | – |
| Lỗi | – | Viền 2 px `--danger` + thông báo lỗi bên dưới | – |

### 9.2 Trạng thái màn hình
| Tình huống | Trang chủ | Trang nhập liệu |
|------------|-----------|-----------------|
| **Lần đầu / chưa có dữ liệu** | Thẻ tổng quan hiện `0 ₫`; vùng biểu đồ và danh sách hiện minh hoạ trống + dòng "Chưa có khoản nào trong tháng này" + nút **Thêm khoản đầu tiên** | Form trống, loại mặc định = Chi |
| **Tháng không có giao dịch** (tháng khác có) | Như trên nhưng câu chữ: "Tháng này chưa có khoản nào"; biểu đồ vẫn có khung, trục trống | – |
| **Đang tải** (đọc localStorage, thường < 50 ms) | Khung xương (skeleton) cho thẻ, biểu đồ, 5 dòng danh sách | – |
| **Có dữ liệu** | Hiển thị đầy đủ | – |
| **Kết quả tìm/lọc rỗng** | "Không tìm thấy khoản nào" + nút **Xoá bộ lọc**; thẻ tổng quan & biểu đồ không đổi | – |
| **Chế độ sửa** | – | Tiêu đề "Sửa khoản", dữ liệu điền sẵn, hiện nút Xoá; nút Lưu chỉ bật khi có thay đổi |
| **Dữ liệu chưa hợp lệ** | – | Nút Lưu vô hiệu; sau lần bấm đầu tiên, hiện lỗi cạnh từng ô: "Nhập số tiền lớn hơn 0", "Chọn danh mục" |
| **Có thay đổi chưa lưu & bấm Đóng** | – | Hỏi "Bỏ thay đổi?" (Tiếp tục sửa / Bỏ) |
| **Lưu thành công** | Toast "Đã lưu" | – |
| **Đã xoá** | Toast "Đã xoá · Hoàn tác" (4 s) | – |
| **Lỗi lưu trữ** (đầy bộ nhớ / bị chặn) | Biểu ngữ `--danger` ở đầu trang: "Không thể lưu dữ liệu. Hãy xuất bản sao lưu hoặc giải phóng bộ nhớ." | Giữ nguyên dữ liệu đang nhập, không đóng form |
| **Ngân sách** | Tắt: không hiện gì. Bật nhưng chưa đặt hạn mức: thẻ nhắc "Đặt hạn mức cho danh mục" | – |
| **Ngoại tuyến** | Hoạt động bình thường (không cần hiện gì) | – |

### 9.3 Nội dung thông báo mẫu
- Thành công: "Đã lưu khoản chi 45.000 ₫" · "Đã xoá · Hoàn tác" · "Đã xuất dữ liệu"
- Cảnh báo: "Ăn uống đã dùng 85% ngân sách" · "Vượt ngân sách Mua sắm 120.000 ₫"
- Lỗi: "Nhập số tiền lớn hơn 0" · "Chọn danh mục" · "Tệp không đúng định dạng sao lưu"
- Xác nhận: "Xoá khoản này? Hành động này có thể hoàn tác trong 4 giây."

---

# 10. Bổ sung – Màn hình & thành phần PRD đã yêu cầu nhưng chưa có thiết kế

> Phần này **chỉ bổ sung**; các mục 1–9 ở trên giữ nguyên. Mọi màu, cỡ chữ, khoảng cách, bo góc, bóng, chuyển động dưới đây dùng lại **đúng token đã khai báo ở mục 2–5, 8** (không thêm token mới).
> Nơi nào mục này làm rõ thêm một thành phần đã nhắc ngắn ở trên, mục này là bản chi tiết.

## 10.1 Đối chiếu PRD ↔ DESIGN: phần còn thiếu

| # | Chức năng / màn hình trong PRD | Trong DESIGN.md hiện có | Còn thiếu | Bổ sung ở |
|---|--------------------------------|-------------------------|-----------|-----------|
| 1 | F16 – Cài đặt (PRD §4.3, §6.4) | §6.7 chỉ liệt kê tên các mục | Bố cục màn hình menu, cách chuyển vào màn hình con, các loại hàng (công tắc, segmented, điều hướng) | **10.2** |
| 2 | F6 – Chọn tháng nhanh (PRD §4.2) | §6.1 chỉ nói "bấm mở bộ chọn tháng" | Giao diện bộ chọn tháng | **10.3** |
| 3 | F12 – Tìm kiếm & lọc (PRD §4.3, US9) | §6.4 nhắc "bảng chọn Loại, Danh mục, Ví" | Bố cục bảng lọc, nút, chip, hiển thị kết quả | **10.4** |
| 4 | F10 – Quản lý ví (PRD §4.3, US12) | Chỉ có tên mục "Ví" trong Cài đặt | Danh sách ví, form thêm/sửa, luồng xoá ví đã có giao dịch | **10.5** |
| 5 | F11 – Quản lý danh mục (PRD §4.3, US12) | Chỉ có tên mục "Danh mục"; ô "＋ Thêm" trong lưới danh mục | Danh sách, form thêm/sửa (tên, biểu tượng, màu), luồng xoá | **10.6** |
| 6 | F14 – Ngân sách, phần **thiết lập hạn mức** (PRD §6.4) | §6.8 chỉ có thẻ hiển thị trên Trang chủ | Màn hình đặt hạn mức cho từng danh mục | **10.7** |
| 7 | F15 – Xuất/nhập dữ liệu (PRD §4.3, US13) | Chỉ có tên mục "Dữ liệu (Xuất / Nhập)" | Màn hình sao lưu, hộp thoại xem trước khi nhập, thông báo lỗi tệp | **10.8** |
| 8 | PRD §8 Khả năng tiếp cận – bảng số liệu thay thế cho biểu đồ | §6.3 chỉ nói có nút "Xem dạng bảng" (ẩn trực quan) | Giao diện bảng cho từng biểu đồ, nút chuyển | **10.9** |

**Đã có đủ, không cần bổ sung:** thêm/sửa/xoá giao dịch (§6.6, §9.2), danh sách nhóm theo ngày (§6.4), thẻ tổng quan (§6.2), carousel 4 biểu đồ (§6.3), thẻ ngân sách (§6.8), toast & xác nhận xoá (§6.9), chế độ sáng/tối (§2, §6.7), trạng thái trống / lỗi lưu trữ (§9.2).

## 10.2 Cài đặt – màn hình menu chính (F16)

### (1) Bố cục tổng thể
Mở từ nút ⚙ trên Thanh tháng. Là **bảng trượt** (đã quy định ở §6.7); bên trong là một **chồng trang con** (Cài đặt → Ví → Sửa ví…). Chuyển trang con bằng hiệu ứng trượt ngang; trang con có nút `‹ Quay lại` thay cho nút ✕.

```
┌──────────────────────────────┐
│ ──  (tay nắm)                │
│ Cài đặt                    ✕ │  Tiêu đề H1 (20/600)
├──────────────────────────────┤
│ GIAO DIỆN                    │  Nhãn nhóm 13/600 --text-muted
│ ┌──────────────────────────┐ │
│ │ [Hệ thống | Sáng | Tối ] │ │
│ └──────────────────────────┘ │
│ QUẢN LÝ                      │
│ ┌──────────────────────────┐ │
│ │ 👛 Ví                3  ›│ │
│ │ ▦ Danh mục          12  ›│ │
│ └──────────────────────────┘ │
│ NGÂN SÁCH                    │
│ ┌──────────────────────────┐ │
│ │ Bật ngân sách        (○) │ │
│ │ Hạn mức theo danh mục  › │ │  chỉ hiện khi công tắc bật
│ └──────────────────────────┘ │
│ DỮ LIỆU                      │
│ ┌──────────────────────────┐ │
│ │ Sao lưu & khôi phục    › │ │
│ └──────────────────────────┘ │
│ Ví Thu Chi MT · v1.0         │  Chữ phụ 13, căn giữa
│ Dữ liệu lưu trên thiết bị này│
└──────────────────────────────┘
```

### (2) Thành phần giao diện
| Thành phần | Mô tả |
|------------|-------|
| Tiêu đề bảng | "Cài đặt" (H1) + nút ✕ 44×44 ở phải; trang con: nút `‹` ở trái + tiêu đề giữa |
| Nhãn nhóm | Chữ 13/600, `--text-muted`, đệm ngang 4, cách nhóm trước 24, cách khối dưới 8 |
| Khối nhóm (grouped list) | Nền `--surface`, bo `--radius-lg`, viền 1 px `--border`; các hàng cách nhau bằng đường kẻ `--border` (thụt trái 52 px, thẳng hàng với chữ) |
| Hàng điều hướng | Cao 56: biểu tượng 20 (`--text-muted`) · nhãn 15/400 · giá trị phụ (số lượng) 15 `--text-muted` · chevron-right 20 |
| Hàng công tắc | Nhãn + công tắc 48×28 (bật: nền `--primary`, nút tròn trắng; tắt: nền `--surface-2` + viền `--border`) |
| Segmented Giao diện | 3 lựa chọn "Theo hệ thống / Sáng / Tối", dùng lại kiểu §6.6 nhưng mục chọn nền `--primary` chữ `--on-primary` (không dùng màu thu/chi) |
| Chân trang | Tên ứng dụng + phiên bản + dòng riêng tư, 13/400 `--text-muted` |

### (3) Màu sắc & font
Nền bảng `--surface`, nền trang trong bảng `--bg` (các khối nhóm nổi lên bằng `--surface`). Chữ nhãn `--text`, chữ giá trị `--text-muted`, liên kết/công tắc bật `--primary`. Font Be Vietnam Pro theo bảng §3 (Tiêu đề trang 20/600; Nội dung 15/400; Phụ 13/400).

### (4) Hiển thị trên điện thoại / laptop
| | Điện thoại (< 640 px) | Laptop (≥ 640 px) |
|---|----------------------|-------------------|
| Dạng | Bottom sheet cao 90%, kéo xuống để đóng; trang con thay nội dung ngay trong bảng | Hộp thoại 480 px bên phải, cao 100% màn hình, bo `--radius-xl` ở góc trái |
| Lề trong | 16 px | 24 px |
| Phím tắt | – | `Esc` đóng / lùi một cấp; `Tab` đi lần lượt các hàng |
| Chuyển trang con | Trượt ngang `--dur-slow` | Giống điện thoại |

## 10.3 Bộ chọn tháng (F6)

### (1) Bố cục tổng thể
Mở khi bấm vào chữ **Tháng 10/2026** trên Thanh tháng (◀ ▶ vẫn dùng để đi từng tháng).
```
┌────────────────────────────┐
│ ◀       2026          ▶   │  Hàng chọn năm
├────────────────────────────┤
│ [ T1 ] [ T2 ] [ T3 ]       │  Lưới 3 cột × 4 hàng
│ [ T4 ] [ T5 ] [ T6 ]       │
│ [ T7 ] [ T8 ] [ T9 ]       │
│ [T10●] [ T11 ] [ T12 ]     │  T10: đang chọn; T11–12: chưa tới (mờ)
├────────────────────────────┤
│        Về tháng này        │  Nút văn bản
└────────────────────────────┘
```

### (2) Thành phần giao diện
| Thành phần | Mô tả |
|------------|-------|
| Hàng chọn năm | Nút ◀ ▶ 44×44 + năm (H2 16/600). ▶ bị vô hiệu ở năm hiện tại; ◀ dừng ở năm của giao dịch cũ nhất (tối thiểu: năm hiện tại) |
| Ô tháng | Cao 48, bo `--radius-md`, nhãn "T1"…"T12" 15/600 |
| Chấm "có dữ liệu" | Chấm 4 px `--primary` dưới nhãn, cho tháng đã có giao dịch |
| Nút "Về tháng này" | Nút văn bản (§6.5); ẩn khi đang xem tháng hiện tại |

Trạng thái ô tháng: mặc định nền `--surface-2`; hover `--border`; **đang chọn** nền `--primary` + chữ `--on-primary`; **tháng hiện tại (chưa chọn)** viền 1 px `--primary`; **tương lai** chữ `--text-muted` mờ 40%, không bấm được; focus vòng 2 px `--focus`. Chọn tháng → đóng ngay (không cần nút xác nhận), dữ liệu đổi theo hiệu ứng "Đổi tháng" ở §8.

### (3) Màu sắc & font
Nền bảng `--surface`, đổ bóng `--shadow-3` (bảng) hoặc `--shadow-2` (popover). Chữ năm H2; chữ tháng 15/600 `--text`; không dùng màu thu/chi.

### (4) Hiển thị trên điện thoại / laptop
- **Điện thoại:** bottom sheet cao tự động (~ 340 px), bo `--radius-xl`, có tay nắm; ô tháng rộng đều (lưới 3 cột, khoảng cách 8).
- **Laptop:** popover rộng 320 px neo dưới chữ tháng, bo `--radius-lg`, `--shadow-2`; đóng khi bấm ra ngoài hoặc `Esc`; phím mũi tên di chuyển giữa các ô, `Enter` chọn.

## 10.4 Tìm kiếm & Bộ lọc (F12)

### (1) Bố cục tổng thể
Ô tìm và nút **Lọc** nằm trên danh sách giao dịch (đã có ở §4). Bổ sung: **bảng lọc**, **hàng chip bộ lọc đang bật** và **thanh tóm tắt kết quả**.
```
Trang chủ (phần danh sách)             Bảng lọc
┌──────────────────────────┐       ┌──────────────────────────┐
│ 🔍 Tìm ghi chú…  [⚙ Lọc 2]│       │ ──                        │
│ (Chi ✕) (Ăn uống ✕)      │       │ Bộ lọc                  ✕ │
│ 8 kết quả · −1.240.000 ₫ │       │ Loại                      │
│ Hôm nay                  │       │ [Tất cả | Chi | Thu]      │
│  …                       │       │ Danh mục                  │
└──────────────────────────┘       │ (Ăn uống)(Di chuyển)(…)   │
                                   │ Ví                        │
                                   │ (Tiền mặt)(Ngân hàng)(…)  │
                                   ├──────────────────────────┤
                                   │ Xoá bộ lọc   [ Xem 8 kết quả ]│
                                   └──────────────────────────┘
```

### (2) Thành phần giao diện
| Thành phần | Mô tả |
|------------|-------|
| Ô tìm | Đã có ở §6.4; bổ sung nút ✕ xoá nhanh khi có chữ, `inputmode="search"`; lọc sau khi ngừng gõ 200 ms |
| Nút Lọc | Nút phụ cao 44 + biểu tượng sliders-horizontal; khi có bộ lọc: viền `--primary` và huy hiệu tròn 16 px nền `--primary` chữ `--on-primary` ghi số bộ lọc |
| Chip bộ lọc đang bật | Chip cao 32, nền `--surface-2`, bo `--radius-full`, chữ 13/500, có ✕ (vùng chạm mở rộng 44); cuộn ngang nếu dài |
| Bảng lọc – Loại | Segmented control 3 mục "Tất cả / Chi / Thu" (mục chọn nền `--primary`) |
| Bảng lọc – Danh mục, Ví | Nhóm chip chọn nhiều; chip chọn: viền 2 px `--primary` + nền `--primary` 10% (giống ô danh mục §6.6); danh mục tự đổi theo Loại đã chọn |
| Chân bảng | Nút văn bản "Xoá bộ lọc" (trái) + nút chính "Xem N kết quả" (phải), số N cập nhật trực tiếp |
| Thanh tóm tắt | "8 kết quả · −1.240.000 ₫" (13/500 `--text-muted`; số tiền tô `--income`/`--expense` theo dấu) |
| Làm nổi từ khoá | Đoạn khớp ghi chú có nền `--primary` 15%, bo 2 px, chữ giữ nguyên màu |

Lưu ý: bộ lọc và từ khoá chỉ tác động lên **danh sách**; thẻ tổng quan và biểu đồ vẫn theo cả tháng (đúng §9.2). Không có kết quả → trạng thái "Không tìm thấy khoản nào" + nút **Xoá bộ lọc** (đã quy định ở §9.2).

### (3) Màu sắc & font
Ô tìm nền `--surface-2`, bo `--radius-full`, biểu tượng `--text-muted`; chữ nhập 15/400 `--text`; placeholder `--text-muted`. Nhãn nhóm trong bảng lọc H2 16/600; chip 13–15. Màu nhấn duy nhất là `--primary`.

### (4) Hiển thị trên điện thoại / laptop
- **Điện thoại:** bảng lọc là bottom sheet (cao tự động, tối đa 80%); ô tìm rộng 100%, nút Lọc 44×44 chỉ hiện biểu tượng + huy hiệu; chân bảng dính đáy, nút "Xem N kết quả" rộng đầy.
- **Laptop:** bảng lọc là popover 360 px neo dưới nút Lọc trong cột danh sách; nút Lọc hiện kèm chữ "Lọc"; áp dụng ngay khi chọn (nút "Xem N kết quả" thành "Đóng").

## 10.5 Quản lý ví (F10)

### (1) Bố cục tổng thể
Hai trang con trong bảng Cài đặt: **Danh sách ví** (Cài đặt → Ví) và **Thêm/Sửa ví**.
```
Danh sách ví                         Thêm/Sửa ví
┌──────────────────────────┐     ┌──────────────────────────┐
│ ‹        Ví              │     │ ‹      Sửa ví      (Xoá)│
├──────────────────────────┤     ├──────────────────────────┤
│ ┌──────────────────────┐ │     │ Tên ví                   │
│ │ 💵 Tiền mặt          │ │     │ [ Tiền mặt          ]    │
│ │    24 giao dịch    ✎ │ │     │                0/20      │
│ │ 🏛 Ngân hàng         │ │     │ Biểu tượng               │
│ │    9 giao dịch     ✎ │ │     │ [💵][🏛][📱][💳][🐷][👛]  │
│ │ 📱 Ví điện tử        │ │     ├──────────────────────────┤
│ │    0 giao dịch     ✎ │ │     │       [   Lưu   ]        │
│ └──────────────────────┘ │     └──────────────────────────┘
│ [ ＋ Thêm ví ]           │
└──────────────────────────┘
```

### (2) Thành phần giao diện
| Thành phần | Mô tả |
|------------|-------|
| Hàng ví | Cao 64: vòng tròn 40 chứa biểu tượng ví (nền `--surface-2`, biểu tượng `--primary`) · tên 15/600 · dòng phụ "N giao dịch" 13 `--text-muted` · nút ✎ 44×44; chạm cả hàng để sửa |
| Nút "＋ Thêm ví" | Nút phụ rộng đầy dưới danh sách (viền `--border`, biểu tượng ＋); tối đa 10 ví – đủ thì vô hiệu kèm chú thích "Tối đa 10 ví" |
| Ô "Tên ví" | Ô văn bản §6.6, tối đa 20 ký tự, bộ đếm khi còn < 8; lỗi: "Nhập tên ví", "Tên ví đã tồn tại" |
| Lưới biểu tượng | 6 ô (banknote, landmark, smartphone, credit-card, piggy-bank, wallet), mỗi ô 48×48, ô chọn viền 2 px `--primary` + nền `--primary` 10% |
| Nút Lưu | Nút chính §6.5 dính đáy; chỉ bật khi hợp lệ và có thay đổi |
| Nút Xoá (chỉ khi sửa) | Nút văn bản màu `--danger` ở góc phải tiêu đề; vô hiệu khi chỉ còn 1 ví (chú thích: "Cần giữ ít nhất 1 ví") |

**Hộp thoại xoá ví**
- Ví **chưa có giao dịch:** "Xoá ví '…'?" · Huỷ / Xoá (nguy hiểm).
- Ví **đã có giao dịch:** "Ví này có 24 giao dịch. Chuyển sang ví nào?" + ô chọn ví đích (bắt buộc, không gồm ví đang xoá) · Huỷ / **Chuyển & xoá** (nguy hiểm). Thành công → toast "Đã xoá ví · chuyển 24 giao dịch sang Ngân hàng".

### (3) Màu sắc & font
Nền `--surface` cho khối, `--bg` cho nền trang; viền `--border`; biểu tượng ví `--primary`; hành động xoá `--danger`. Tên ví 15/600, dòng phụ 13/400 `--text-muted`, tiêu đề trang 20/600 (thu gọn 16/600 ở thanh tiêu đề trang con).

### (4) Hiển thị trên điện thoại / laptop
- **Điện thoại:** trang con chiếm cả chiều cao bảng, hàng ví rộng đầy, nút Lưu dính đáy (chừa `env(safe-area-inset-bottom)`).
- **Laptop:** trong hộp thoại 480 px; hover hàng hiện nền `--surface-2`; nút Lưu nằm cuối form (không dính đáy), `Enter` để lưu.

## 10.6 Quản lý danh mục (F11)

### (1) Bố cục tổng thể
Ba cấp: **Danh sách danh mục** (có chuyển Chi | Thu) → **Thêm/Sửa danh mục**. Ô "＋ Thêm" ở lưới danh mục của Trang nhập liệu (§6.6) mở thẳng form này dưới dạng bảng nhỏ và, sau khi lưu, tự chọn danh mục vừa tạo.
```
Danh sách                             Thêm/Sửa danh mục
┌──────────────────────────┐      ┌──────────────────────────┐
│ ‹      Danh mục          │      │ ‹  Thêm danh mục   (Xoá)│
│    [  Chi  |  Thu  ]     │      ├──────────────────────────┤
├──────────────────────────┤      │ Tên danh mục             │
│ ┌──────────────────────┐ │      │ [ Cà phê           ]     │
│ │ 🍜 Ăn uống   128 ›   │ │      │ Biểu tượng               │
│ │ 🚌 Di chuyển  41 ›   │ │      │ [🍜][🚌][🏠][🛍][🎮][💊]  │
│ │ …                    │ │      │ [📚][☕][🐶][✈][🎁][…]    │
│ │ ⋯ Khác     (mặc định)│ │      │ Màu                      │
│ └──────────────────────┘ │      │ (●)(●)(●)(●)(●)(●)(●)(●) │
│ [ ＋ Thêm danh mục ]     │      ├──────────────────────────┤
└──────────────────────────┘      │       [   Lưu   ]        │
                                  └──────────────────────────┘
```

### (2) Thành phần giao diện
| Thành phần | Mô tả |
|------------|-------|
| Chuyển Chi | Thu | Segmented control §6.6 (mục chọn màu `--expense` / `--income`); danh sách đổi theo loại |
| Hàng danh mục | Cao 56: vòng tròn 40 biểu tượng (nền = màu danh mục 15%, biểu tượng = màu danh mục) · tên 15/600 · số giao dịch 13 `--text-muted` · chevron. Danh mục "Khác" ghi nhãn nhỏ "Mặc định" và không xoá được (vẫn đổi được biểu tượng/màu, không đổi tên) |
| Nút "＋ Thêm danh mục" | Nút phụ rộng đầy; tối đa 20 danh mục mỗi loại |
| Ô "Tên danh mục" | Ô văn bản §6.6, tối đa 20 ký tự; lỗi: "Nhập tên danh mục", "Tên đã tồn tại" |
| Loại | Khi thêm mới: lấy theo tab đang xem; khi sửa: hiển thị chữ "Loại: Chi" (không đổi được để không làm lệch báo cáo) |
| Lưới biểu tượng | 6 cột × 4 hàng (24 biểu tượng nét outline, §7), ô 44×44, ô chọn viền 2 px `--primary` + nền `--primary` 10% |
| Chọn màu | 8 ô tròn 32 px lấy từ bảng màu biểu đồ tròn (§2.3, đúng chế độ sáng/tối hiện hành); ô chọn có vòng 2 px `--primary` cách 2 px **và dấu ✓** (không chỉ dựa vào màu); mỗi ô có `aria-label` là tên màu |
| Xem trước | Vòng tròn 40 hiển thị biểu tượng + màu đang chọn ngay cạnh ô tên |
| Nút Xoá / Lưu | Như 10.5 |

**Hộp thoại xoá danh mục**
- Chưa có giao dịch → xác nhận xoá đơn giản.
- Đã có giao dịch → "Danh mục này có 41 giao dịch. Chuyển sang danh mục nào?" + ô chọn danh mục cùng loại (mặc định gợi ý "Khác"); nút **Chuyển & xoá**. Nếu đang bật ngân sách, hạn mức của danh mục bị xoá cũng được xoá (ghi chú nhỏ trong hộp thoại).

### (3) Màu sắc & font
Dùng bảng màu danh mục ở §2.3; danh mục tự tạo lấy màu tiếp theo trong bảng nhưng người dùng đổi được. Nhãn nhóm H2 16/600; tên 15/600; số lượng 13/400 `--text-muted`. Vòng tròn biểu tượng và ô chọn dùng `--radius-full` / `--radius-md` như §5.

### (4) Hiển thị trên điện thoại / laptop
- **Điện thoại:** lưới biểu tượng 6 cột (ô ~ 48); chọn màu 8 ô trên **một hàng** (khoảng cách 8) – nếu màn < 360 px chuyển thành 2 hàng × 4; nút Lưu dính đáy.
- **Laptop:** lưới biểu tượng 8 cột, tất cả màu trên một hàng; sắp xếp danh sách bằng kéo-thả không có trong phiên bản này (thứ tự cố định: mặc định trước, tự tạo sau, theo thứ tự tạo).

## 10.7 Thiết lập ngân sách (F14 – phần cài đặt, tuỳ chọn)

### (1) Bố cục tổng thể
Trang con **Hạn mức theo danh mục** (Cài đặt → Ngân sách → Hạn mức theo danh mục), chỉ truy cập được khi công tắc **Bật ngân sách** đang bật.
```
┌──────────────────────────────┐
│ ‹   Hạn mức theo danh mục    │
├──────────────────────────────┤
│ Hạn mức chi tối đa mỗi tháng │  Mô tả 13 --text-muted
│ Tổng hạn mức  8.000.000 ₫    │  Hàng tổng kết
│ ┌──────────────────────────┐ │
│ │ 🍜 Ăn uống               │ │
│ │              [3.000.000 ₫]│ │  Ô số tiền căn phải
│ │ 🚌 Di chuyển             │ │
│ │              [ Chưa đặt  ]│ │
│ │ …                        │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│        [   Lưu   ]           │
└──────────────────────────────┘
```

### (2) Thành phần giao diện
| Thành phần | Mô tả |
|------------|-------|
| Công tắc "Bật ngân sách" | Hàng công tắc §10.2; **tắt mặc định**. Tắt lại → ẩn thẻ ngân sách khỏi Trang chủ nhưng **giữ nguyên** các hạn mức đã đặt (ghi chú dưới công tắc) |
| Hàng tổng kết | "Tổng hạn mức" + số (tổng các hạn mức đã đặt) 16/600 |
| Hàng danh mục | Cao 64: vòng tròn biểu tượng + tên (như 10.6) · ô nhập số tiền bên phải (rộng 140, cao 44, căn phải, `tabular-nums`, hậu tố ₫, `inputmode="numeric"`, tự chèn dấu chấm) |
| Trạng thái ô | Rỗng = placeholder "Chưa đặt" (không giới hạn); nhập 0 hoặc xoá hết = bỏ hạn mức; lỗi khi âm hoặc > 999.999.999 |
| Chỉ liệt kê | Chỉ các danh mục **Chi**; danh mục Thu không có hạn mức |
| Nút Lưu | Nút chính dính đáy; bật khi có thay đổi. Rời trang khi chưa lưu → hỏi "Bỏ thay đổi?" (như §9.2) |

**Hiển thị cảnh báo (liên kết §6.8, §9.3):** sau khi Lưu một khoản chi làm danh mục chạm ≥ 80% hoặc vượt 100%, hiện toast cảnh báo (thêm biểu tượng ⚠ `--warning` / `--danger`) ngay trên Trang chủ.

### (3) Màu sắc & font
Ô nhập nền `--surface-2`, viền `--border`, focus viền 2 px `--focus`; số tiền 15/600 `--text`; "Chưa đặt" `--text-muted`; tổng hạn mức `--text`. Cảnh báo dùng `--warning` / `--danger` như §6.8.

### (4) Hiển thị trên điện thoại / laptop
- **Điện thoại:** mỗi hàng 1 cột: biểu tượng + tên bên trái, ô số tiền bên phải (nếu tên dài, cắt 1 dòng); khi bàn phím số mở, danh sách cuộn để ô đang nhập không bị che và nút Lưu nằm trên bàn phím.
- **Laptop:** hàng rộng đầy hộp thoại 480 px; `Tab` đi lần lượt các ô, `Enter` ở ô cuối = Lưu.

## 10.8 Sao lưu & khôi phục dữ liệu (F15)

### (1) Bố cục tổng thể
Trang con **Sao lưu & khôi phục** (Cài đặt → Dữ liệu) và một **hộp thoại xem trước** khi nhập tệp.
```
Trang Sao lưu & khôi phục            Hộp thoại nhập tệp
┌──────────────────────────┐     ┌──────────────────────────┐
│ ‹  Sao lưu & khôi phục   │     │ Nhập dữ liệu             │
├──────────────────────────┤     │ sao-luu-2026-10.json     │
│ ┌──────────────────────┐ │     │ 320 giao dịch · 3 ví ·   │
│ │ ⬇ Xuất dữ liệu       │ │     │ 12 danh mục              │
│ │ Lưu bản sao để khôi  │ │     │ (01/2026 – 10/2026)      │
│ │ phục khi đổi máy.    │ │     │ ( ) Gộp vào dữ liệu hiện │
│ │ [Xuất JSON] [CSV]    │ │     │     có, bỏ qua mục trùng │
│ └──────────────────────┘ │     │ ( ) Thay thế toàn bộ  ⚠  │
│ ┌──────────────────────┐ │     │ [ Huỷ ]   [ Nhập dữ liệu ]│
│ │ ⬆ Nhập dữ liệu       │ │     └──────────────────────────┘
│ │ Chọn tệp .json đã    │ │
│ │ xuất trước đó.       │ │
│ │ [ Chọn tệp… ]        │ │
│ └──────────────────────┘ │
│ ⓘ Dữ liệu chỉ nằm trên   │
│ thiết bị này. Hãy xuất   │
│ bản sao lưu định kỳ.     │
└──────────────────────────┘
```

### (2) Thành phần giao diện
| Thành phần | Mô tả |
|------------|-------|
| Thẻ "Xuất dữ liệu" | Khối `--surface`, bo `--radius-lg`, đệm 16: biểu tượng download 24 · tiêu đề H2 · mô tả 13 `--text-muted` · hai nút: **Xuất JSON** (nút phụ, khuyên dùng – nhập lại được) và **Xuất CSV** (nút văn bản – chỉ để mở bằng bảng tính) |
| Thẻ "Nhập dữ liệu" | Cùng kiểu: biểu tượng upload · mô tả · nút phụ **Chọn tệp…** (chỉ nhận `.json`) |
| Ghi chú riêng tư | Khối thông tin nền `--primary` 10%, biểu tượng ⓘ, chữ 13 `--text` |
| Hộp thoại nhập | Tiêu đề, tên tệp, tóm tắt nội dung (số giao dịch, ví, danh mục, khoảng thời gian), hai lựa chọn radio, nút Huỷ (phụ) + nút xác nhận |
| Radio "Gộp" / "Thay thế toàn bộ" | Mặc định chọn **Gộp**. Chọn "Thay thế": hiện dòng cảnh báo `--danger` "Toàn bộ dữ liệu hiện tại sẽ bị xoá"; nút xác nhận đổi thành nút nguy hiểm "Thay thế" (nền `--danger`) |
| Tiến trình | Trong lúc đọc/ghi hiện thanh tiến độ 4 px `--primary`, vô hiệu nút; thành công: toast "Đã nhập 320 giao dịch" |

**Thông báo lỗi (dùng lại mẫu §9.3):** "Tệp không đúng định dạng sao lưu" · "Tệp được tạo bởi phiên bản mới hơn" · "Không đủ bộ nhớ để nhập" – hiển thị trong hộp thoại bằng khối lỗi nền `--danger` 10%, viền `--danger`, biểu tượng ⚠; dữ liệu hiện tại **không bị thay đổi** khi nhập lỗi.

### (3) Màu sắc & font
Khối và hộp thoại `--surface` (hộp thoại `--shadow-3`, lớp phủ mờ §5); tiêu đề thẻ H2 16/600, mô tả 13/400 `--text-muted`, tên tệp 15/600; nút chính/phụ/nguy hiểm theo §6.5; thông tin `--primary`, lỗi `--danger`.

### (4) Hiển thị trên điện thoại / laptop
- **Điện thoại:** hai thẻ xếp dọc, nút rộng đầy (xếp chồng, cao 48); hộp thoại nhập là bottom sheet, nút xác nhận rộng đầy dính đáy. Việc chọn tệp dùng bộ chọn tệp của hệ điều hành.
- **Laptop:** hai nút Xuất cạnh nhau; hộp thoại nhập căn giữa, rộng 440 px; hỗ trợ **kéo-thả** tệp vào thẻ "Nhập dữ liệu" (viền nét đứt 2 px `--primary` khi đang kéo qua).

## 10.9 Xem biểu đồ dạng bảng (bổ sung cho §6.3)

### (1) Bố cục tổng thể
Làm rõ nút "Xem dạng bảng" đã nhắc ở §6.3: nút hiển thị cho **mọi người dùng** (không chỉ trình đọc màn hình), nằm góc phải tiêu đề của từng biểu đồ. Bấm để đổi giữa biểu đồ và bảng số liệu ngay trong cùng khung; trạng thái "dạng bảng" được nhớ cho phiên hiện tại.
```
┌──────────────────────────────┐
│ Thu & chi theo tuần      ▦  │  ▦ = nút chuyển (biểu tượng table)
├──────────────────────────────┤
│ Tuần        Thu       Chi    │  Hàng tiêu đề (dính khi cuộn)
│ 1 (1–7)   5.000.000  1.200.000│
│ 2 (8–14)  0          2.300.000│
│ …                            │
│ Tổng     18.500.000 12.300.000│
│         ● ○ ○ ○              │
└──────────────────────────────┘
```

### (2) Thành phần giao diện
| Thành phần | Mô tả |
|------------|-------|
| Nút chuyển | 44×44, biểu tượng table ⇄ bar-chart-3; `aria-pressed`; tooltip "Xem dạng bảng / Xem biểu đồ" |
| Bảng số liệu | Nền `--surface`, hàng cao 40, đường kẻ ngang 1 px `--border`, cột số căn phải, `tabular-nums`; vùng bảng cao tối đa ≈ 240 (bằng khung biểu đồ) và cuộn dọc bên trong, hàng tiêu đề dính đầu |
| Hàng "Tổng" | In đậm 600, đường kẻ trên 2 px `--border` |
| Cột theo biểu đồ | ① Tuần: *Tuần · Thu · Chi* ② Danh mục: *Danh mục (chấm màu + tên) · % · Số tiền* ③ Ngày: *Ngày · Thu · Chi* ④ Số dư: *Ngày · Số dư luỹ kế* |
| Chấm chỉ báo carousel | Giữ nguyên; vuốt sang biểu đồ khác vẫn ở chế độ bảng nếu đã bật |

### (3) Màu sắc & font
Tiêu đề cột 13/600 `--text-muted`; ô dữ liệu 15/400 `--text`; cột Thu chữ `--income`, cột Chi chữ `--expense` (kèm tiêu đề cột và dấu +/− nên không chỉ dựa vào màu); chấm màu danh mục lấy từ §2.3; số dư âm dùng `--expense`.

### (4) Hiển thị trên điện thoại / laptop
- **Điện thoại:** bảng rộng đúng khung (không cuộn ngang); số tiền dài rút gọn dạng `1,2tr` trong bảng ngày (30 hàng) và hiển thị đầy đủ khi chạm vào hàng.
- **Laptop:** hàng cao 36 khi hover đổi nền `--surface-2`; luôn hiển thị số đầy đủ.

## 10.10 Tổng hợp hiển thị đáp ứng (responsive) cho phần bổ sung

| Thành phần mới | Điện thoại (< 640 px) | Laptop (≥ 640 px) |
|----------------|-----------------------|-------------------|
| Cài đặt (10.2) | Bottom sheet 90% | Hộp thoại phải 480 px |
| Bộ chọn tháng (10.3) | Bottom sheet tự động cao | Popover 320 px |
| Bảng lọc (10.4) | Bottom sheet ≤ 80% | Popover 360 px |
| Ví / Danh mục / Ngân sách (10.5–10.7) | Trang con chiếm cả bảng; nút Lưu dính đáy | Trang con trong hộp thoại 480 px; nút Lưu cuối form |
| Sao lưu & khôi phục (10.8) | Hai thẻ dọc; hộp thoại nhập = bottom sheet | Hai nút cạnh nhau; kéo-thả tệp; hộp thoại giữa 440 px |
| Bảng số liệu (10.9) | Trong khung biểu đồ, cuộn dọc | Như điện thoại, hàng 36 + hover |

**Quy tắc chung cho mọi thành phần mới**
- Vùng chạm ≥ 44×44 px, khoảng cách giữa hai vùng chạm ≥ 8 px (§4); chừa `env(safe-area-inset-bottom)`.
- Mọi bảng trượt/hộp thoại: nền `--surface`, `--radius-xl` (bảng trượt) hoặc `--radius-lg` (popover/hộp thoại nhỏ), `--shadow-3`/`--shadow-2`, lớp phủ mờ và z-index theo §5; mở/đóng theo §8 (`--dur-slow`); khoá cuộn nền khi đang mở; `Esc` đóng.
- Hỗ trợ `prefers-reduced-motion` như §8; sáng/tối dùng đúng cặp token §2.
- Mọi hành động xoá có xác nhận hoặc **Hoàn tác**; mọi biểu mẫu có trạng thái lỗi/vô hiệu theo §9.1.
