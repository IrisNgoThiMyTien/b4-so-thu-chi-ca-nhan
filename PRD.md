# PRD – Ứng dụng Sổ Thu Chi Cá Nhân

> Phiên bản: 1.0 · Ngày: 27/10/2026 · Giao diện chi tiết xem [DESIGN.md](DESIGN.md)

---

## 1. Tổng quan ứng dụng

**Sổ Thu Chi** là ứng dụng web chạy trên điện thoại và laptop, giúp một cá nhân ghi lại các khoản thu/chi hằng ngày và xem tổng quan tình hình tài chính theo tháng.

- **Hai màn hình chính:** *Trang chủ* (biểu đồ + danh sách giao dịch) và *Trang nhập liệu* (thêm/sửa khoản thu chi).
- **Dữ liệu lưu ngay trên thiết bị** (localStorage), không cần tài khoản, không cần server, dùng được khi không có mạng.
- **Ngôn ngữ:** tiếng Việt. **Tiền tệ:** VND (định dạng `1.250.000 ₫`).
- **Giao diện:** responsive, ưu tiên điện thoại (mobile-first), có chế độ sáng/tối.

## 2. Mục tiêu ứng dụng

| #  | Mục tiêu                                                                                             | Ghi chú                                                                          |
| -- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| G1 | Ghi một khoản thu/chi **nhanh, ít thao tác** (≤ 10 giây, ≤ 4 chạm trên điện thoại)   | Nhập liệu là hành động lặp lại hằng ngày nên phải nhẹ nhất có thể |
| G2 | Nhìn một lần biết **tháng này thu bao nhiêu, chi bao nhiêu, còn lại bao nhiêu**       | Thẻ tổng quan luôn hiển thị đầu Trang chủ                                 |
| G3 | Hiểu **tiền đi đâu** qua các biểu đồ trực quan (theo tuần, danh mục, ngày, số dư) | Vuốt qua lại giữa các biểu đồ                                              |
| G4 | Dữ liệu **riêng tư và luôn sẵn sàng**: không đăng nhập, chạy offline                | Lưu cục bộ trên thiết bị                                                    |
| G5 | Dễ dàng **sửa/xoá** khi nhập nhầm                                                          | Thao tác ngay từ danh sách                                                     |

## 3. Đối tượng người dùng và User Stories

### 3.1 Đối tượng

**Người dùng chính: cá nhân tự quản lý chi tiêu** (sinh viên, nhân viên văn phòng, người đi làm tự do…).

- Dùng chủ yếu trên **điện thoại** (ghi ngay sau khi mua), thỉnh thoảng mở **laptop** để xem tổng quan.
- Không cần kiến thức kế toán; muốn công cụ đơn giản, không quảng cáo, không phải tạo tài khoản.
- Một người dùng – một thiết bị/trình duyệt (không chia sẻ, không đa người dùng).

### 3.2 User Stories

| ID   | Là một người dùng, tôi muốn…                                                          | để…                                    | Ưu tiên |
| ---- | --------------------------------------------------------------------------------------------- | ----------------------------------------- | --------- |
| US1  | thêm một khoản **chi** với số tiền, danh mục, ví, ngày, ghi chú               | biết mình đã tiêu gì                | Must      |
| US2  | thêm một khoản **thu** (lương, thưởng…)                                         | tính được số dư                     | Must      |
| US3  | xem **danh sách** các khoản trong tháng, nhóm theo ngày                           | rà soát lại chi tiêu                  | Must      |
| US4  | **sửa** hoặc **xoá** một khoản đã nhập                                    | sửa sai sót                             | Must      |
| US5  | xem **tổng thu / tổng chi / số dư** của tháng                                     | nắm nhanh tình hình                    | Must      |
| US6  | chuyển sang **tháng trước/sau**                                                     | so sánh các tháng                      | Must      |
| US7  | **vuốt** để xem lần lượt các biểu đồ (tuần → danh mục → ngày → số dư) | hiểu xu hướng chi tiêu                | Must      |
| US8  | chọn **ví/tài khoản** (tiền mặt, ngân hàng, ví điện tử) cho mỗi khoản     | biết tiền đang nằm ở đâu           | Should    |
| US9  | **tìm kiếm và lọc** danh sách theo loại, danh mục, ví, từ khoá                | tìm lại khoản cũ                      | Should    |
| US10 | chuyển **chế độ sáng/tối**                                                        | dễ nhìn ở mọi điều kiện ánh sáng | Should    |
| US11 | (tuỳ chọn) đặt **ngân sách** tháng cho từng danh mục chi                       | không tiêu quá tay                     | Could     |
| US12 | thêm/đổi tên/xoá **ví** và **danh mục** của riêng mình                 | phù hợp thói quen cá nhân            | Should    |
| US13 | **xuất/nhập** dữ liệu ra file để sao lưu                                         | không mất dữ liệu khi đổi máy      | Could     |

## 4. Danh sách chức năng chính

### 4.1 Giao dịch (thu/chi)

| Mã | Chức năng               | Mô tả                                                                                                          | Ưu tiên      |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------- |
| F1  | Thêm giao dịch          | Chọn loại Thu/Chi, nhập số tiền, danh mục, ví, ngày (mặc định hôm nay), ghi chú (không bắt buộc) | **Must** |
| F2  | Danh sách giao dịch     | Hiển thị các khoản của tháng đang xem, nhóm theo ngày, kèm tổng thu/chi từng ngày                   | **Must** |
| F3  | Sửa giao dịch           | Chạm vào một dòng → mở Trang nhập liệu ở chế độ sửa                                                 | **Must** |
| F4  | Xoá giao dịch           | Xoá từ Trang nhập liệu hoặc vuốt dòng; có xác nhận và nút **Hoàn tác**                       | **Must** |
| F5  | Kiểm tra dữ liệu nhập | Số tiền > 0, bắt buộc có danh mục, ngày hợp lệ; báo lỗi ngay tại ô nhập                            | **Must** |

### 4.2 Tổng quan & biểu đồ (Trang chủ)

| Mã | Chức năng                                         | Mô tả                                                                                                                                                                                                         | Ưu tiên      |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| F6  | Chọn tháng                                        | Nút ◀ ▶ và bấm vào tên tháng để chọn nhanh; mặc định tháng hiện tại                                                                                                                            | **Must** |
| F7  | Thẻ tổng quan                                     | Tổng thu, tổng chi, số dư (thu − chi) của tháng                                                                                                                                                          | **Must** |
| F8  | Carousel biểu đồ (vuốt ngang / chấm chỉ báo) | 4 biểu đồ, thứ tự: ① **Cột thu vs chi theo tuần** (mặc định) ② **Tròn: chi theo danh mục** ③ **Cột thu vs chi theo ngày** ④ **Đường: số dư luỹ kế theo ngày** | **Must** |
| F9  | Tương tác biểu đồ                             | Chạm vào cột/miếng/điểm để xem số liệu chi tiết (tooltip)                                                                                                                                            | Should         |

### 4.3 Hỗ trợ

| Mã | Chức năng              | Mô tả                                                                                                                                                                  | Ưu tiên |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| F10 | Quản lý ví            | Ví mặc định: Tiền mặt, Ngân hàng, Ví điện tử; thêm/đổi tên/xoá (không xoá ví đã có giao dịch, trừ khi chuyển sang ví khác)                   | Should    |
| F11 | Quản lý danh mục      | Bộ danh mục mặc định cho Thu và Chi; thêm/đổi tên/xoá                                                                                                         | Should    |
| F12 | Tìm kiếm & lọc        | Ô tìm theo ghi chú; lọc theo loại, danh mục, ví                                                                                                                   | Should    |
| F13 | Chế độ sáng/tối     | Công tắc trong Cài đặt; mặc định theo hệ thống; nhớ lựa chọn                                                                                                | Should    |
| F14 | Ngân sách (tuỳ chọn) | **Tắt mặc định.** Bật trong Cài đặt → đặt hạn mức chi/tháng cho từng danh mục; hiển thị thanh tiến độ và cảnh báo khi ≥ 80% / vượt 100% | Could     |
| F15 | Xuất/nhập dữ liệu    | Xuất JSON (hoặc CSV) để sao lưu; nhập lại từ file                                                                                                                | Could     |
| F16 | Cài đặt               | Bảng trượt từ Trang chủ: Giao diện, Ví, Danh mục, Ngân sách, Dữ liệu (không tạo màn hình thứ ba)                                                        | Should    |

**Danh mục mặc định**

- Chi: Ăn uống · Di chuyển · Nhà ở · Mua sắm · Giải trí · Sức khoẻ · Học tập · Khác
- Thu: Lương · Thưởng · Làm thêm · Khác

### 4.4 Chia module phát triển

Ứng dụng được chia thành **10 module**, xây theo thứ tự M1 → M10. Mỗi module bám các mã chức năng (F) ở §4.1–4.3, có phạm vi riêng và chỉ phụ thuộc vào module đứng trước nó. Khi nhờ xây một module, dùng câu: *"Đây là module thứ N trong tổng số 10"*.

| Module | Tên | Chức năng (mã F) | Ưu tiên | Màn hình / phần giao diện | Tham chiếu DESIGN.md | Phụ thuộc | Trạng thái |
| ------ | --- | ---------------- | ------- | -------------------------- | -------------------- | --------- | ---------- |
| **M1** | **Nhập liệu thu chi** | F1 thêm, F3 form sửa, F4 xoá từ form + Hoàn tác, F5 kiểm tra dữ liệu | Must | Trang nhập liệu (toàn màn hình / hộp thoại), hộp xác nhận, toast | §6.5, §6.6, §6.9, §9 | – (nền tảng: lưu trữ, định dạng tiền/ngày, kiểm tra dữ liệu, design tokens) | ✅ **Đã xong** |
| **M2** | **Trang chủ – Thanh tháng & Tổng quan** | F6 chọn tháng, F7 thẻ Thu/Chi/Số dư | Must | Khung Trang chủ, thanh tháng ◀ ▶, bộ chọn tháng, 3 thẻ tổng quan, nút ＋ nổi (mở M1) | §6.1, §6.2, §10.3 | M1 | ✅ **Đã xong** |
| **M3** | **Danh sách giao dịch** | F2 danh sách nhóm theo ngày, F3 chạm dòng để sửa (mở M1), F4 vuốt/xoá nhanh | Must | Danh sách trên Trang chủ, tiêu đề nhóm ngày, trạng thái trống | §6.4, §9.2 | M1, M2 | ✅ **Đã xong** |
| **M4** | **Biểu đồ tổng quan** | F8 carousel 4 biểu đồ (tuần → danh mục → ngày → số dư luỹ kế), F9 tooltip, xem dạng bảng | Must (F8) / Should (F9) | Carousel biểu đồ + chấm chỉ báo, bảng số liệu thay thế | §2.3, §6.3, §10.9 | M1, M2 | ✅ **Đã xong** |
| **M5** | **Tìm kiếm & Lọc** | F12 | Should | Ô tìm, nút Lọc, bảng lọc, chip bộ lọc, thanh tóm tắt kết quả | §6.4, §10.4 | M3 | ✅ **Đã xong** |
| **M6** | **Cài đặt & Giao diện sáng/tối** | F13 chế độ sáng/tối, F16 khung Cài đặt (bảng trượt, điều hướng trang con) | Should | Bảng trượt Cài đặt, hàng điều hướng/công tắc, chọn Theo hệ thống / Sáng / Tối | §6.7, §10.2 | M2 | ✅ **Đã xong** |
| **M7** | **Quản lý ví & danh mục** | F10, F11 | Should | Trang con Ví, Danh mục (danh sách, form thêm/sửa, luồng xoá + chuyển giao dịch); bật ô "＋ Thêm" trong lưới danh mục của M1 | §6.6, §10.5, §10.6 | M1, M6 | ⬜ Chưa làm |
| **M8** | **Ngân sách (tuỳ chọn)** | F14 | Could | Công tắc bật/tắt, trang đặt hạn mức, thẻ "Ngân sách tháng", cảnh báo ≥ 80% / vượt 100% | §6.8, §10.7 | M2, M6, M7 | ⬜ Chưa làm |
| **M9** | **Sao lưu & Khôi phục** | F15 | Could | Trang xuất JSON/CSV, nhập từ tệp, hộp thoại xem trước | §10.8 | M6 | ⬜ Chưa làm |
| **M10** | **Hoàn thiện & Offline (PWA)** | Ràng buộc §8: manifest + service worker, biểu tượng ứng dụng, rà soát tiếp cận, hiệu năng, kiểm thử tổng thể | Nên có | Không có màn hình mới | §7, §8 | M1–M9 | ⬜ Chưa làm |

**Độ ưu tiên theo module:** Must = M1–M4 (ứng dụng dùng được: nhập, xem, biểu đồ) · Should = M5–M7 · Could = M8–M9 · Hoàn thiện = M10.

**Bản phát hành đề xuất**
- **Bản dùng được (MVP):** M1 + M2 + M3 + M4 – đủ ghi, xem danh sách, xem biểu đồ theo tháng.
- **Bản đầy đủ:** thêm M5, M6, M7 – tìm/lọc, sáng/tối, tự quản lý ví và danh mục.
- **Bản mở rộng:** thêm M8, M9, M10.

**Ranh giới giữa các module** (mỗi module chỉ gọi vào những gì module trước đã cung cấp)

| Module | Cung cấp cho module sau | Dùng từ module trước |
| ------ | ----------------------- | -------------------- |
| M1 | Kho dữ liệu (thêm/sửa/xoá/hoàn tác/liệt kê theo tháng, danh mục & ví), định dạng tiền VND và ngày, kiểm tra dữ liệu, lớp lưu localStorage có `schemaVersion`, design tokens, toast, hộp xác nhận, hàm mở Trang nhập liệu | – |
| M2 | Trạng thái "tháng đang xem" và sự kiện đổi tháng; nút ＋ mở M1; tổng thu/chi/số dư của tháng | Kho dữ liệu, định dạng tiền (M1) |
| M3 | Danh sách đang hiển thị (dùng chung cho tìm/lọc); mở M1 ở chế độ sửa | Tháng đang xem (M2), M1 |
| M4 | Dữ liệu gộp theo tuần / danh mục / ngày / số dư luỹ kế | Tháng đang xem (M2), kho dữ liệu (M1) |
| M5 | Bộ lọc áp lên danh sách (không đổi thẻ tổng quan và biểu đồ) | Danh sách (M3) |
| M6 | Khung Cài đặt để các module khác gắn trang con; đọc/ghi `settings` (theme…) | Khung Trang chủ (M2) |
| M7 | Thêm/sửa/xoá ví và danh mục; kích hoạt ô "＋ Thêm" của M1 qua tuỳ chọn `onAddCategory` | M1, khung Cài đặt (M6) |
| M8 | Hạn mức theo danh mục (`settings.budgets`), thẻ ngân sách | Tổng chi theo danh mục (M2/M4), danh mục (M7), Cài đặt (M6) |
| M9 | Xuất/nhập toàn bộ dữ liệu | Khung Cài đặt (M6), kho dữ liệu (M1) |
| M10 | Bản phát hành hoàn chỉnh | Tất cả |

**Quy tắc khi xây từng module**
1. Chỉ làm trong phạm vi module đó; không sửa hành vi của module đã xong. Nếu cần mở rộng kho dữ liệu của M1 (ví dụ thêm hàm đọc/ghi `settings`, quản lý ví/danh mục) thì chỉ **thêm** hàm mới, và toàn bộ test của các module trước vẫn phải đạt.
2. Giao diện theo đúng DESIGN.md (màu, chữ, khoảng cách, trạng thái); dùng lại design tokens của M1.
3. Mỗi module có test riêng và chạy lại toàn bộ test trước khi bàn giao.
4. Sau khi xong một module, cập nhật cột **Trạng thái** ở bảng trên.

**Ghi chú từ M6 (đã xong)**
- Mã nguồn: `src/ui/settings.js` (bảng Cài đặt, chồng trang con, kéo để đóng, chọn giao diện), `src/core/theme.js` (sáng/tối), `src/core/app-info.js` (tên + phiên bản), CSS `src/styles/settings.css`; test: `tests/theme-settings.test.js`, `tests/settings.dom.test.js` (+ phần M6 trong `tests/design.test.js`). Hiện có **831 test đạt** (cả M1–M6) và đã kiểm tra trên Edge thật qua DevTools Protocol (390 / 320 / 1100 px, chạm thật + chuột + phím, sáng / tối / theo hệ điều hành, tải lại trang, giảm chuyển động).
- Cách gắn: `let settings; const home = mountHome({ repo, onOpenSettings: () => settings.open() }); settings = mountSettings({ repo, home });`. `mountSettings` áp dụng ngay giao diện đã lưu khi khởi động và trả về `{ open({ page }), close, isOpen, push, back, getStack, getTheme, setTheme, registerPage, unregisterPage, hasPage, destroy, element }`. Tuỳ chọn: `host`, `root`, `animate`, `toast`, `isWide`, `onThemeChange`.
- **Khung cho module sau gắn trang con:** `settings.registerPage(id, { title, render(ctx) })`, `render` trả về `Node` hoặc `{ element, destroy }`; `ctx = { id, params, repo, home, toast, push(id, params), back(), close(), setTitle(text) }`. Các lối vào đã dành sẵn: **M7** → `wallets` (Ví), `categories` (Danh mục); **M8** → `budget-limits` (Hạn mức theo danh mục; hàng chỉ hiện khi công tắc Ngân sách bật); **M9** → `backup` (Sao lưu & khôi phục). Chưa đăng ký thì hiện **trang tạm "Đang phát triển"** (có nút Quay lại). Trang con lỗi khi dựng thì rơi về trang tạm, không làm hỏng Cài đặt. Trang con có thể mở tiếp trang cấp 2 (`ctx.push`).
- **Kho dữ liệu (chỉ thêm, test M1–M5 giữ nguyên):** `repo.getSettings()` → `{ theme, budgetEnabled, budgets }` (đã làm sạch giá trị hỏng); `repo.updateSettings(patch)` chỉ nhận `theme` (`system|light|dark`), `budgetEnabled` (boolean), `budgets` (`{ id: số nguyên > 0 }`) — khoá lạ / giá trị sai bị từ chối, không đổi gì thì không ghi, lỗi ghi trả `{ ok: false, error: 'storage' }` và giữ nguyên cài đặt cũ; `repo.subscribeSettings(fn)` chỉ báo khi **cài đặt** đổi (không làm vẽ lại danh sách / biểu đồ). **M8 nên đọc `settings.budgetEnabled` / `settings.budgets` qua các hàm này.**
- Giao diện sáng/tối: "Theo hệ thống" (mặc định, bỏ `data-theme` → CSS theo `prefers-color-scheme` và tự đổi khi hệ điều hành đổi), "Sáng" / "Tối" (đặt `data-theme` trên `<html>`, bỏ qua hệ điều hành). Lựa chọn được nhớ trong `settings.theme`. Đoạn mã nhỏ trong `<head>` của `index.html` (kiểm bằng test: trùng `THEME_BOOT_SCRIPT`) đặt giao diện trước khi vẽ nên không bị nháy sáng → tối. Đổi giao diện có hiệu ứng chuyển màu 200 ms (`html.theme-fade`), tắt khi giảm chuyển động. Lưu lỗi (hết dung lượng / bị chặn lưu trữ) thì vẫn áp dụng cho lần mở này và báo cho người dùng.
- Hành vi bảng: điện thoại là bảng trượt cao 90%, kéo tay nắm / thanh tiêu đề xuống để đóng (quá 100 px hoặc vuốt nhanh; huỷ cử chỉ thì bật về); laptop (≥ 640 px) là hộp thoại 480 px bên phải, bo góc trái. Mở thì khoá cuộn nền (`html.has-settings-open`) và khoá Trang chủ (`inert`); Esc lùi một cấp rồi đóng; Tab xoay vòng trong trang đang hiện; đóng thì trả focus về nút ⚙. Không mở được khi Trang nhập liệu (M1) đang mở. **Chuyển qua lại không mất dữ liệu / trạng thái:** Trang chủ không bị gỡ nên tháng đang xem, từ khoá và bộ lọc (M5), biểu đồ đang xem (M4), vị trí cuộn, các dòng đã vẽ (M3) đều giữ nguyên; đổi cài đặt không đụng tới giao dịch / danh mục / ví (có test so sánh từng phần).
- Công tắc **Bật ngân sách** lưu `settings.budgetEnabled` (mặc định tắt); thẻ ngân sách và cảnh báo vượt hạn mức là việc của **M8** — M6 chưa có logic ngân sách.
- Chỗ khác DESIGN.md: (1) nhãn nhóm viết thường câu ("Giao diện") thay vì in hoa như bản phác thảo (DESIGN §3 cấm in hoa toàn bộ câu tiếng Việt); (2) chân trang ghi "Sổ Thu Chi · v1.0" (bản phác thảo ghi "Ví Thu Chi MT"); (3) nút tròn của công tắc dùng `--text-muted` khi tắt và `--on-primary` khi bật (DESIGN ghi "trắng" nhưng không có token trắng dùng được cho cả hai chế độ; đã kiểm tra ≥ 3:1); (4) nút ‹ ở trang con chỉ có biểu tượng, nhãn đọc là "Quay lại"; (5) chưa nối với nút Back / lịch sử của trình duyệt (Back không đóng bảng).
- Thay đổi ngoài phạm vi M6 (chỉ thêm, giữ nguyên hành vi): `src/core/repo.js` thêm 3 hàm cài đặt (xem trên; `commit` nhận thêm tham số tuỳ chọn danh sách người nghe); `src/ui/icons.js` thêm `layout-grid`, `target`, `database`, `wrench`; `src/app.js` gắn `mountSettings` + `onOpenSettings` và để `window.__settings` (tham số `?theme=dark|light` vẫn dùng để thử nhanh, không lưu); `index.html` nạp thêm `settings.css` và đoạn mã đặt giao diện sớm.

**Ghi chú từ M5 (đã xong)**
- Mã nguồn: `src/ui/search.js` (ô tìm, nút Lọc, chip, tóm tắt, bảng lọc), `src/core/search-filter.js` (so khớp chữ, lọc, tóm tắt — thuần, không đụng DOM), CSS `src/styles/search.css`; test: `tests/search-filter.test.js`, `tests/search.dom.test.js` (+ phần M5 trong `tests/design.test.js`). Hiện có **709 test đạt** (cả M1–M5). Đã kiểm tra trên Edge thật qua DevTools Protocol: 390 px (chạm thật, gõ bằng bộ gõ), 320 px, 1100 px (chuột + phím), sáng và tối, 5.000 giao dịch (mỗi thao tác tìm/lọc < 100 ms).
- Cách gắn: `const search = mountSearch({ repo, home })` rồi `mountTransactionList({ repo, home, host: search.listHost, filter: search.filter })`. M5 tự đặt khối tìm/lọc vào ô `home.slots.list` và cho M3 một ô con `listHost`; trả về `{ element, listHost, filter, input, getCriteria, getResults, getSummary, setQuery, setType, toggleCategory, toggleWallet, setCriteria, clearFilters, clear, openPanel, closePanel, isPanelOpen, refresh, destroy }`. Tuỳ chọn: `host`, `month`, `panelHost`, `debounceMs` (mặc định 200), `isWide`, `onChange`.
- **Hợp đồng với M3 (chỉ thêm):** `mountTransactionList` nhận thêm `filter` tuỳ chọn `{ apply(list) → list, ranges?(ghi chú) → [[đầu, cuối)], subscribe?(fn) → huỷ }`. Không truyền thì M3 chạy y như cũ (toàn bộ test M3 cũ vẫn đạt). Có `filter` thì M3 chỉ vẽ phần `apply()` trả về, bọc `<mark class="tx__mark">` quanh đoạn khớp trong ghi chú, và quay về trang đầu ("Xem thêm") mỗi khi bộ lọc đổi. Tổng ròng từng ngày trong danh sách tính trên các dòng đang hiển thị.
- Quy tắc tìm: chỉ tìm trong **ghi chú** (không tìm tên danh mục/ví/số tiền). Không phân biệt hoa/thường; gõ **không dấu** thì khớp cả chữ có dấu ("com" khớp "Cơm"), đã gõ **có dấu** thì phải đúng dấu ("cơm" không khớp "com", "đi" không khớp "di"); nhiều từ = mọi từ phải có, thứ tự tuỳ ý. Lọc sau khi ngừng gõ 200 ms (Enter / rời ô tìm lọc ngay); đang gõ dở bằng bộ gõ tiếng Việt (composition) thì chờ gõ xong. Tối đa 100 ký tự; ký tự đặc biệt/HTML luôn được coi là chữ thường (không dùng biểu thức chính quy, không chèn HTML).
- Quy tắc lọc: Loại (Tất cả / Chi / Thu) · Danh mục · Ví. Chọn nhiều trong một nhóm = HOẶC, giữa các nhóm = VÀ. Danh mục đổi theo Loại (Tất cả → hai nhóm Chi / Thu; đổi Loại thì bỏ chọn danh mục không thuộc loại đó). Huy hiệu nút Lọc = số chip (Loại + từng danh mục + từng ví; từ khoá không tính). Danh mục/ví không còn tồn tại (M7 xoá) tự bị bỏ khỏi bộ lọc khi dữ liệu đổi.
- Bảng lọc: **điện thoại** là bảng trượt, chọn trong bảng chỉ đổi bản nháp, bấm "Xem N kết quả" (N cập nhật trực tiếp) mới áp dụng; ✕ / Esc / chạm lớp phủ thì bỏ bản nháp. **Laptop (≥ 640 px)** là popover 360 px neo dưới nút Lọc, áp dụng ngay khi chọn, nút chính thành "Đóng", bấm ra ngoài thì đóng. "Xoá bộ lọc" trong bảng chỉ xoá Loại/Danh mục/Ví (giữ từ khoá); "Xoá bộ lọc" ở trạng thái **không tìm thấy** xoá cả từ khoá lẫn bộ lọc.
- Trạng thái: tìm/lọc không đổi thẻ tổng quan và biểu đồ (có test đối chiếu). Từ khoá và bộ lọc **giữ nguyên khi đổi tháng** (không nhớ qua lần tải lại trang). Tháng chưa có giao dịch nào thì khối tìm/lọc được rút khỏi ô để M2 tự hiện trạng thái trống (M3, M4 cũng làm vậy).
- Chỗ khác DESIGN.md: (1) số tiền trên thanh tóm tắt dùng `--income-text` / `--expense-text` (đạt ≥ 4,5:1) thay vì `--income` / `--expense`; (2) chữ trong đoạn làm nổi dùng `--text` thay vì "giữ nguyên màu" vì chữ phụ `--text-muted` trên nền làm nổi + nền hover chỉ đạt 4,37:1 ở chế độ sáng; (3) số khoản ≥ 1.000 có dấu chấm ngăn cách ("1.250 kết quả"); (4) huy hiệu 16 px dùng chữ 11 px (thấp hơn mức 13 px tối thiểu vì phải vừa vòng tròn, số luôn kèm nhãn đọc "Bộ lọc, đang bật N"); (5) hai danh mục trùng tên "Khác" của Chi và Thu được phân biệt bằng hậu tố "· Chi / · Thu" khi Loại là Tất cả; (6) thanh tìm chỉ dính đầu cột danh sách ở laptop (cột đó cuộn riêng), điện thoại cuộn cùng trang.
- Thay đổi ngoài phạm vi M5 (chỉ thêm, giữ nguyên hành vi): `src/ui/tx-list.js` nhận thêm tuỳ chọn `filter` (xem trên); `src/ui/icons.js` thêm `search`, `sliders-horizontal`; `src/app.js` gắn `mountSearch` và để `window.__search`; `index.html` nạp thêm `search.css`.

**Ghi chú từ M4 (đã xong)**
- Mã nguồn: `src/ui/charts.js` (carousel, tooltip, chế độ bảng), `src/ui/chart-svg.js` (vẽ SVG: cột đôi, vành khuyên, đường), `src/ui/chart-table.js` (bảng số liệu), `src/core/chart-data.js` (gộp dữ liệu, thang trục), CSS `src/styles/charts.css`; test: `tests/chart-data.test.js`, `tests/charts.dom.test.js` (+ phần M4 trong `tests/design.test.js`). Hiện có **530 test đạt** (cả M1–M4) và đã kiểm tra trên Edge thật qua DevTools Protocol (320 / 390 / 1100 px, sáng và tối, vuốt cảm ứng thật, rê chuột, phím ← →, đổi cỡ cửa sổ, 5.000 giao dịch < 100 ms). Riêng thao tác chạm hàng bảng để xem số đầy đủ chỉ kiểm tra bằng jsdom, chưa chạy trên Edge thật.
- `mountCharts({ repo, home })` gắn vào ô `home.slots.charts` của M2 và tự theo dõi `home.month` cùng dữ liệu (`repo.subscribe`). Có thể truyền `host`, `month`, `storage`, `tableMode`, `onChartChange` riêng. Trả về `{ goTo, next, prev, getActive, setTableMode, isTableMode, getModel, refresh, clearSelection, destroy }`. Tự vẽ SVG, không dùng thư viện ngoài (chạy offline, không thêm phụ thuộc).
- Số liệu: **Tuần** 1–7, 8–14, 15–21, 22–28, 29–cuối tháng (tháng 28 ngày chỉ có 4 tuần). **Danh mục** chỉ tính khoản chi, không quá 8 miếng (7 miếng lớn nhất + "Khác" gộp phần còn lại và danh mục đã xoá), phần trăm chia theo phương pháp phần dư lớn nhất để luôn cộng đúng 100%. **Ngày** có đủ mọi ngày của tháng. **Số dư luỹ kế** bắt đầu từ 0 ở đầu tháng; tháng hiện tại chỉ vẽ đến hôm nay; điểm cuối = số dư trên thẻ tổng quan. Có test đối chiếu 300 tháng ngẫu nhiên: tuần = ngày = danh mục = số dư = tổng thẻ tổng quan.
- Tương tác: chạm / rê chuột vào một cột-nhóm, miếng, hoặc điểm để xem tooltip (chạm lần nữa, Esc, hoặc chạm ra ngoài để tắt). Nút ‹ › chỉ hiện từ 640px; phím ← → chuyển biểu đồ (riêng biểu đồ ngày còn chỗ cuộn ngang thì phím cuộn trước). Biểu đồ không hiển thị bị `inert`/`aria-hidden`. Hình SVG ẩn khỏi trình đọc màn hình; thay vào đó có nhãn tóm tắt và **bảng số liệu**.
- Xem dạng bảng (DESIGN §10.9): nút 44×44 ở góc phải tiêu đề, hiện cho mọi người dùng; trạng thái dùng chung cho cả 4 biểu đồ và nhớ trong phiên (`sessionStorage`, khoá `sotc:charts-table`). Bảng ngày/số dư trên điện thoại hiện số rút gọn, chạm hàng để xem đầy đủ (số đầy đủ luôn nằm trong DOM cho trình đọc màn hình).
- Trạng thái trống: lần đầu chưa có giao dịch nào thì M4 **không vẽ gì** (M2 hiện minh hoạ trống); tháng không có giao dịch nhưng tháng khác có thì vẫn có khung, trục mặc định 0–100k và số liệu 0.
- Chỗ khác DESIGN.md: (1) chiều cao khung theo biểu đồ đang xem (vành khuyên + chú giải cao hơn ~100 px so với các biểu đồ khác, nên không cố định "~240" cho cả khung); (2) chú giải vành khuyên trên điện thoại dùng số rút gọn (`1,2tr`), laptop dùng số đầy đủ; (3) tooltip của vành khuyên nằm ngay dưới vành để không che miếng đang chọn; (4) bề rộng tối thiểu mỗi ngày là 18px nên biểu đồ ngày cuộn ngang trên điện thoại và tự cuộn tới "hôm nay"; (5) các cột dùng màu `--income` / `--expense` làm đồ hoạ (≥ 3:1), còn chữ trong tooltip và bảng dùng `--income-text` / `--expense-text` (≥ 4,5:1) và luôn kèm dấu +/−.
- Thay đổi ngoài phạm vi M4 (chỉ thêm, giữ nguyên hành vi): thêm 2 biểu tượng `table` và `bar-chart-3` vào `src/ui/icons.js`; `src/app.js` gắn thêm `mountCharts` và để `window.__charts` cho việc kiểm tra tay; `index.html` nạp thêm `charts.css`. M5 (tìm/lọc) không ảnh hưởng tới biểu đồ vì biểu đồ luôn theo cả tháng.

**Ghi chú từ M3 (đã xong)**
- Mã nguồn: `src/ui/tx-list.js`, `src/core/day-groups.js`, CSS `src/styles/tx-list.css`; test: `tests/day-groups.test.js`, `tests/tx-list.dom.test.js` (+ phần M3 trong `tests/design.test.js`). Hiện có **344 test đạt** (cả M1–M3) và đã kiểm tra trên Edge thật (360 / 390 / 1100 px, sáng và tối, vuốt bằng cảm ứng thật, 5.000 giao dịch).
- `mountTransactionList({ repo, home })` gắn vào ô `home.slots.list` của M2 và tự theo dõi `home.month`; có thể truyền `host`, `month`, `onEdit` riêng. Trả về `{ refresh, closeSwipe, visibleCount, destroy }`.
- Danh sách nhóm theo ngày ("Hôm nay", "Hôm qua", "Thứ Sáu, 23/10"), mỗi nhóm có tổng ròng của cả ngày. Chạm dòng → `home.openEntry(id)` (sửa). Xoá nhanh: vuốt trái (cảm ứng) hoặc nút ✎ 🗑 khi rê chuột / phím Delete; luôn có hộp xác nhận và nút **Hoàn tác** 4 giây.
- Chỉ vẽ 150 dòng đầu, có nút "Xem thêm" (tổng ngày vẫn tính đủ) để giữ phản hồi < 100 ms với 5.000 giao dịch.
- Khi tháng không có giao dịch, M3 để ô `slots.list` rỗng; trạng thái trống do M2 hiện.
- **M5 (tìm/lọc)** gắn thanh tìm phía trên danh sách và cần lọc dữ liệu trước khi vẽ: hiện M3 gọi `repo.listByMonth(tháng)`; M5 nên bổ sung một "bộ lọc" tuỳ chọn cho M3 thay vì tự vẽ lại danh sách.
- Thay đổi ngoài phạm vi M3 (nhỏ, giữ nguyên hành vi): thêm hàm `categoryColorVar()` để màu danh mục từ dữ liệu không chèn được CSS (M1 cũng dùng); `createIcon` nhân bản biểu tượng mẫu cho nhanh; bổ sung hai token `--income-text` / `--expense-text` (chữ nhỏ thu/chi đạt ≥ 4,5:1 — DESIGN chưa có). Khung danh sách chạy thử tạm trong `app.js` đã được thay bằng M3.

**Ghi chú từ M2 (đã xong)**
- Mã nguồn: `src/ui/home.js` (Trang chủ), `src/ui/month-picker.js` (bộ chọn tháng), `src/core/months.js`, `month-state.js`, `summary.js`, CSS `src/styles/home.css`; test: `tests/months.test.js`, `summary.test.js`, `home.dom.test.js`, `month-picker.dom.test.js`. Hiện có **278 test đạt** (gồm cả M1) và đã kiểm tra trên Edge thật ở 320 / 360 / 390 / 1100 px, sáng và tối.
- `mountHome({ repo, ... })` trả về: `month` (tháng đang xem, có `subscribe`), `slots.charts` và `slots.list` (ô để M4 và M3 gắn vào), `openEntry(id?)` (M3 gọi khi chạm vào dòng), `refresh()`, `showBanner()`, `destroy()`. Nút ⚙ chỉ hiện khi truyền `onOpenSettings` (M6).
- M2 đã thêm vào kho dữ liệu của M1 hai hàm mới (không đổi hành vi cũ): `repo.subscribe(fn)` (báo khi dữ liệu đổi) và `repo.getMonthsWithData()`.
- Trạng thái trống ("Chưa có khoản nào…" + nút Thêm khoản đầu tiên) do **M2 đảm nhiệm**; M3 và M4 không cần vẽ lại.
- `index.html` / `src/app.js` hiện gắn M1 + M2 và một danh sách thô tạm trong ô `slots.list` (sẽ thay bằng M3).
- Chỗ khác DESIGN.md: (1) đệm thẻ tổng quan là 12px ở điện thoại (16px ở laptop) để 3 thẻ vừa một hàng; (2) số rút gọn tự co cỡ chữ theo bề rộng thẻ (tối đa 24px, thường 14–20px ở điện thoại, tối thiểu 11px cho số cực lớn); (3) chưa có khung xương tự động vì dữ liệu đọc đồng bộ, chỉ có tuỳ chọn `loading`. Ở chế độ sáng, chữ rút gọn cỡ nhỏ màu thu/chi (≈3,4:1 và ≈3,9:1) chưa đạt 4,5:1 — bù bằng dấu +/− và số đầy đủ khi chạm.

**Ghi chú từ M1 (đã xong)**
- Mã nguồn ở `src/` (lõi dữ liệu `src/core/`, giao diện `src/ui/`, CSS `src/styles/`), test ở `tests/`; chạy thử bằng `npm start`, chạy test bằng `npm test`.
- `index.html` hiện chỉ là **khung chạy thử** (danh sách thô + nút ＋); Trang chủ thật sẽ do M2–M4 thay thế.
- Quyết định đã áp dụng: không cho nhập ngày ở tương lai; chữ trên nút Chi/Thu đang chọn dùng màu tối `#0B1220` thay vì trắng để đủ tương phản; ô chọn ngày hiển thị theo ngôn ngữ trình duyệt (chưa ép dd/MM/yyyy).
- Giới hạn tương phản của DESIGN.md (§2.2): màu `--income` / `--expense` ở chế độ sáng chỉ đạt khoảng 3,4:1 và 3,9:1 trên nền trắng, chỉ dùng cho **chữ lớn** (số tiền cỡ 24 px trở lên); với chữ nhỏ (danh sách giao dịch, bảng số liệu) các module sau cần thêm dấu +/− và cân nhắc điều chỉnh màu.

## 5. Non-Goals – không làm ở phiên bản này

- ❌ Đăng nhập, tài khoản, đồng bộ đám mây giữa nhiều thiết bị.
- ❌ Dùng chung nhiều người (gia đình, nhóm), chia hoá đơn.
- ❌ Kết nối ngân hàng / tự động đọc SMS / quét hoá đơn (OCR).
- ❌ Chuyển tiền giữa các ví như một loại giao dịch riêng (chỉ ghi Thu/Chi theo từng ví).
- ❌ Nhiều loại tiền tệ, quy đổi tỷ giá; nhiều ngôn ngữ.
- ❌ Giao dịch lặp định kỳ, nhắc nhở / thông báo đẩy.
- ❌ Báo cáo theo năm, so sánh nhiều tháng, xuất PDF.
- ❌ Đính kèm ảnh, nhãn (tag) tuỳ ý, mục tiêu tiết kiệm.
- ❌ Ứng dụng native (iOS/Android); chỉ là web app.

## 6. Luồng sử dụng chính

### 6.1 Thêm khoản chi/thu

1. Người dùng mở app → vào **Trang chủ** (tháng hiện tại).
2. Bấm nút **＋** (nổi, góc dưới phải) → mở **Trang nhập liệu**.
3. Chọn **Chi** hoặc **Thu** (mặc định: Chi).
4. Nhập **số tiền** (bàn phím số, tự thêm dấu chấm ngăn cách hàng nghìn).
5. Chọn **danh mục** (lưới biểu tượng) và **ví**.
6. (Tuỳ chọn) đổi **ngày**, nhập **ghi chú**.
7. Bấm **Lưu** → quay về Trang chủ, thẻ tổng quan, biểu đồ và danh sách cập nhật ngay; hiện thông báo "Đã lưu".

### 6.2 Xem tổng quan theo tháng

1. Ở **Trang chủ**, xem thẻ **Thu / Chi / Số dư**.
2. **Vuốt ngang** vùng biểu đồ: Tuần → Danh mục → Ngày → Số dư luỹ kế.
3. Đổi tháng bằng ◀ ▶ → toàn bộ số liệu và biểu đồ đổi theo.

### 6.3 Xem, tìm, sửa, xoá

1. Cuộn xuống **danh sách giao dịch** của tháng; dùng ô tìm/bộ lọc nếu cần.
2. Chạm một dòng → **Trang nhập liệu (chế độ sửa)** với dữ liệu điền sẵn.
3. Chỉnh sửa → **Lưu**; hoặc bấm **Xoá** → xác nhận → quay về Trang chủ, hiện "Đã xoá · Hoàn tác".

### 6.4 Bật ngân sách (tuỳ chọn)

1. Trang chủ → biểu tượng ⚙ → **Cài đặt** → bật **Ngân sách**.
2. Đặt hạn mức cho từng danh mục chi.
3. Từ đó, Trang chủ hiện thêm thẻ "Ngân sách tháng" và cảnh báo khi gần/vượt hạn mức.

## 7. Giao diện dự kiến (liên kết với DESIGN.md)

| Màn hình                                                           | Nội dung chính                                                                                                                                                                                                                          | Tham chiếu DESIGN.md                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Trang chủ**                                                 | Thanh tháng ◀ Tháng 10/2026 ▶ · ⚙ Cài đặt → 3 thẻ Thu/Chi/Số dư → Carousel 4 biểu đồ (vuốt, có chấm chỉ báo) → (thẻ Ngân sách nếu bật) → Tìm/lọc → Danh sách giao dịch nhóm theo ngày → Nút ＋ nổi | §4 Bố cục, §6 Thành phần (thẻ, biểu đồ, danh sách, FAB)             |
| **Trang nhập liệu**                                          | Thanh tiêu đề (← Đóng / Tiêu đề / Xoá khi sửa) → Chọn Thu/Chi → Ô số tiền lớn → Lưới danh mục → Chọn ví → Ngày → Ghi chú → Nút Lưu                                                                        | §6 Thành phần (segmented control, form, lưới danh mục), §9 Trạng thái |
| **Cài đặt** (bảng trượt, không phải màn hình riêng) | Giao diện sáng/tối · Ví · Danh mục · Ngân sách · Xuất/nhập dữ liệu                                                                                                                                                         | §6, §8                                                                       |

Màu sắc, chữ, khoảng cách, thành phần và trạng thái được định nghĩa trong [DESIGN.md](DESIGN.md).

## 8. Ràng buộc kỹ thuật

- **Nền tảng:** web app responsive (mobile-first); chạy trên Chrome/Safari/Edge/Firefox bản mới (2 năm gần nhất). Điểm gãy bố cục: < 640px (điện thoại), ≥ 640px (máy tính bảng/laptop).
- **Không backend:** toàn bộ logic ở phía client; triển khai dạng trang tĩnh.
- **Lưu trữ:** `localStorage` (khoá có tiền tố `sotc:`), dữ liệu dạng JSON có trường `schemaVersion` để nâng cấp về sau. Ghi bọc `try/catch`; báo lỗi rõ ràng khi hết dung lượng hoặc bị chặn lưu trữ.
- **Mô hình dữ liệu:**
  - `Transaction { id, type: "income" | "expense", amount (số nguyên VND > 0), categoryId, walletId, date (YYYY-MM-DD), note, createdAt, updatedAt }`
  - `Category { id, name, type, icon, color }` · `Wallet { id, name, icon }`
  - `Settings { theme: "system" | "light" | "dark", budgetEnabled, budgets: { [categoryId]: amount } }`
- **Tiền tệ & định dạng:** lưu số nguyên (không dùng số thực); hiển thị bằng `Intl.NumberFormat("vi-VN")` + `₫`. Ngày hiển thị `dd/MM/yyyy`, theo múi giờ cục bộ.
- **Biểu đồ:** dùng thư viện nhẹ (ví dụ Chart.js) hoặc tự vẽ SVG; carousel dùng CSS scroll-snap để vuốt mượt, hỗ trợ bàn phím (←/→) trên laptop.
- **Hiệu năng:** tải lần đầu < 2 giây trên 4G; thao tác UI phản hồi < 100 ms với 5.000 giao dịch.
- **Offline / PWA (nên có):** manifest + service worker để "Thêm vào màn hình chính" và chạy không mạng.
- **Khả năng tiếp cận:** tương phản chữ ≥ 4.5:1 ở cả hai chế độ; vùng chạm ≥ 44×44 px; không chỉ dựa vào màu để phân biệt thu/chi (thêm dấu +/− và biểu tượng); biểu đồ có bảng số liệu thay thế cho trình đọc màn hình.
- **Bảo mật & riêng tư:** không gửi dữ liệu ra ngoài, không dùng analytics/cookie bên thứ ba; thư viện ngoài (nếu có) ghim phiên bản cụ thể.

## 9. Tiêu chí thành công (Success Metrics)

| Chỉ số                                                                                                             | Cách đo                                                                                   | Mục tiêu                                     |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Thời gian thêm một khoản                                                                                         | Thử nghiệm với 5 người dùng thử, bấm giờ từ Trang chủ đến "Đã lưu"          | Trung vị ≤ 10 giây; ≤ 4 chạm              |
| Tỉ lệ hoàn thành tác vụ cốt lõi (thêm, sửa, xoá, đổi tháng, vuốt biểu đồ) không cần hướng dẫn | Thử nghiệm với người dùng thử                                                        | ≥ 90%                                         |
| Tính đúng đắn của số liệu                                                                                    | Kiểm thử tự động: tổng thu/chi/số dư và dữ liệu biểu đồ khớp với danh sách | 100% khớp                                     |
| Độ bền dữ liệu                                                                                                  | Tải lại trang, đóng/mở trình duyệt, tắt mạng                                       | 0 giao dịch bị mất                          |
| Hiệu năng                                                                                                          | Lighthouse (mobile)                                                                         | Performance ≥ 90; tải < 2 s                  |
| Tiếp cận                                                                                                           | Lighthouse Accessibility + kiểm tra tay                                                    | ≥ 95; tương phản đạt ở cả sáng/tối   |
| Mức độ sử dụng (tự đánh giá của chủ dự án)                                                              | Nhật ký dùng 30 ngày                                                                    | Ghi ≥ 5 ngày/tuần trong 4 tuần liên tiếp |

---

### Phụ lục: Câu hỏi đã làm rõ

| Câu hỏi                       | Quyết định                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Lưu dữ liệu ở đâu?        | Trên máy (localStorage)                                                                                                   |
| Trường dữ liệu mỗi khoản? | Loại, số tiền, danh mục, ngày, ghi chú **+ ví/tài khoản**                                                    |
| Biểu đồ Trang chủ?          | Cả 4 loại, vuốt qua lại; **biểu đồ đầu tiên là theo tuần**                                                |
| Phạm vi?                       | Tiếng Việt + VND, tìm/lọc, dark mode, ngân sách (**tuỳ chọn, tắt mặc định**), chuyển sáng/tối qua lại |
