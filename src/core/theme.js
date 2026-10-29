// Giao diện sáng/tối (M6, PRD F13): "Theo hệ thống" (mặc định) / "Sáng" / "Tối".
//  • Hệ thống: không đặt data-theme → tokens.css theo @media (prefers-color-scheme) và tự đổi khi hệ điều hành đổi.
//  • Sáng / Tối: đặt data-theme="light" | "dark" trên <html> → ghi đè hệ thống.
export const THEMES = ['system', 'light', 'dark'];
export const DEFAULT_THEME = 'system';
export const THEME_LABELS = { system: 'Theo hệ thống', light: 'Sáng', dark: 'Tối' };
export const THEME_FADE_MS = 200; // DESIGN §8: "Đổi sáng/tối — chuyển màu nền & chữ mượt 200 ms"

/** Giá trị lạ (dữ liệu hỏng/sửa tay) rơi về "Theo hệ thống". */
export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : DEFAULT_THEME;
}

/** Chế độ thực tế đang hiển thị: 'light' | 'dark'. */
export function resolveTheme(theme, prefersDark) {
  const t = normalizeTheme(theme);
  return t === 'system' ? (prefersDark ? 'dark' : 'light') : t;
}

/** Đặt / gỡ data-theme trên phần tử gốc (thường là document.documentElement). */
export function applyTheme(root, theme) {
  const t = normalizeTheme(theme);
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  return t;
}

/** Hệ điều hành đang ở chế độ tối? (không có matchMedia → sáng) */
export function systemPrefersDark() {
  try {
    return !!globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/**
 * Mã chạy sớm trong <head> (trước khi vẽ lần đầu) để trang không nháy sáng → tối.
 * Chỉ ĐỌC localStorage, bọc try/catch; bất kỳ lỗi nào → bỏ qua (để CSS theo hệ thống).
 * index.html nhúng đúng đoạn này; tests/theme.test.js kiểm tra hai bản giống nhau.
 */
export const THEME_BOOT_SCRIPT =
  "try{var d=JSON.parse(localStorage.getItem('sotc:data'));var t=d&&d.settings&&d.settings.theme;if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}";
