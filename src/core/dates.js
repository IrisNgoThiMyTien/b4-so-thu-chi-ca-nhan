// Ngày dạng chuỗi "YYYY-MM-DD" theo múi giờ cục bộ (không dùng toISOString để tránh lệch múi giờ).
export const MIN_DATE = '2000-01-01';

const pad = (n, width = 2) => String(n).padStart(width, '0');

export function toISODate(date) {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

/** Trả về Date (giờ cục bộ, 00:00) hoặc null nếu chuỗi không phải ngày lịch hợp lệ. */
export function parseISODate(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(2000, 0, 1);
  date.setFullYear(y, mo - 1, d);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function isValidISODate(value) {
  return parseISODate(value) !== null;
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** "2026-10-27" -> "27/10/2026" */
export function formatDisplayDate(iso) {
  return isValidISODate(iso) ? iso.split('-').reverse().join('/') : '';
}
