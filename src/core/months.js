// Tháng dạng chuỗi "YYYY-MM" (giờ cục bộ). Dùng chung cho Trang chủ, danh sách, biểu đồ.
import { todayISO } from './dates.js';

export const MIN_MONTH = '2000-01';

const PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(value) {
  return typeof value === 'string' && PATTERN.test(value);
}

export function parseMonth(value) {
  const m = typeof value === 'string' ? PATTERN.exec(value) : null;
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function makeMonth(year, month) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function currentMonth(now = new Date()) {
  return todayISO(now).slice(0, 7);
}

/** Tháng chứa một ngày "YYYY-MM-DD". */
export function monthOf(isoDate) {
  return typeof isoDate === 'string' ? isoDate.slice(0, 7) : '';
}

export function addMonths(value, delta) {
  const parts = parseMonth(value);
  if (!parts) return null;
  const index = parts.year * 12 + (parts.month - 1) + delta;
  return makeMonth(Math.floor(index / 12), (index % 12 + 12) % 12 + 1);
}

/** -1, 0, 1 (so sánh chuỗi "YYYY-MM" đã đủ số 0 nên so sánh từ điển là đúng). */
export function compareMonths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "2026-10" -> "Tháng 10/2026" */
export function formatMonthLabel(value) {
  const parts = parseMonth(value);
  return parts ? `Tháng ${parts.month}/${parts.year}` : '';
}
