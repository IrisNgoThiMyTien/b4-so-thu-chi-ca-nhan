// Trạng thái "tháng đang xem" dùng chung cho các module (Trang chủ, danh sách, biểu đồ…).
// Không cho xem tháng ở tương lai (PRD F6) và không lùi quá MIN_MONTH.
import { MIN_MONTH, addMonths, compareMonths, currentMonth, isValidMonth } from './months.js';

export function createMonthState({ initial, now = () => new Date(), min = MIN_MONTH } = {}) {
  const latest = () => currentMonth(now());
  const allowed = (ym) => isValidMonth(ym) && compareMonths(ym, min) >= 0 && compareMonths(ym, latest()) <= 0;

  let value = allowed(initial) ? initial : latest();
  const listeners = new Set();

  function set(next) {
    if (!allowed(next)) return false;
    if (next === value) return true;
    const previous = value;
    value = next;
    for (const fn of [...listeners]) fn(value, previous);
    return true;
  }

  return {
    get: () => value,
    set,
    canPrev: () => compareMonths(value, min) > 0,
    canNext: () => compareMonths(value, latest()) < 0,
    prev: () => set(addMonths(value, -1)),
    next: () => set(addMonths(value, 1)),
    isCurrent: () => value === latest(),
    latest,
    min,
    /** Gọi fn(tháng mới, tháng cũ) mỗi khi đổi tháng. Trả về hàm huỷ đăng ký. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
