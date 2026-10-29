// Gom giao dịch theo ngày và đặt tên ngày cho danh sách (PRD F2, DESIGN §6.4).
import { addDays, parseISODate, todayISO } from './dates.js';

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/**
 * "Hôm nay", "Hôm qua", sau đó "Thứ Sáu, 23/10"; khác năm hiện tại thì thêm năm: "Thứ Ba, 31/12/2025".
 * Ngày sai định dạng trả về chuỗi rỗng.
 */
export function dayLabel(isoDate, today = todayISO()) {
  const date = parseISODate(isoDate);
  if (!date) return '';
  if (isoDate === today) return 'Hôm nay';
  if (isoDate === addDays(today, -1)) return 'Hôm qua';
  const [y, m, d] = isoDate.split('-');
  const sameYear = today.slice(0, 4) === y;
  return `${WEEKDAYS[date.getDay()]}, ${d}/${m}${sameYear ? '' : `/${y}`}`;
}

/** Ngày đầy đủ cho trình đọc màn hình: "Thứ Sáu, 23/10/2026". */
export function fullDayLabel(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) return '';
  const [y, m, d] = isoDate.split('-');
  return `${WEEKDAYS[date.getDay()]}, ${d}/${m}/${y}`;
}

/**
 * @param transactions danh sách đã sắp xếp mới nhất trước (repo.listByMonth)
 * @returns [{ date, income, expense, net, items }] — theo thứ tự xuất hiện; tổng tính trên TOÀN BỘ giao dịch của ngày
 */
export function groupByDay(transactions) {
  const groups = [];
  const byDate = new Map();
  for (const tx of transactions) {
    let g = byDate.get(tx.date);
    if (!g) {
      g = { date: tx.date, income: 0, expense: 0, net: 0, items: [] };
      byDate.set(tx.date, g);
      groups.push(g);
    }
    if (tx.type === 'income') g.income += tx.amount;
    else if (tx.type === 'expense') g.expense += tx.amount;
    g.net = g.income - g.expense;
    g.items.push(tx);
  }
  return groups;
}

/** Chỉ giữ `limit` dòng đầu (cắt ngang một ngày được); tổng của ngày vẫn là của cả ngày. Trả về { groups, shown, total }. */
export function limitRows(groups, limit) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const out = [];
  let left = Math.max(0, limit);
  for (const g of groups) {
    if (left <= 0) break;
    out.push(left >= g.items.length ? g : { ...g, items: g.items.slice(0, left) });
    left -= g.items.length;
  }
  return { groups: out, shown: Math.min(total, Math.max(0, limit)), total };
}
