// Gộp dữ liệu cho 4 biểu đồ của Trang chủ (PRD F8, DESIGN §6.3, §10.9): theo tuần, theo danh mục, theo ngày, số dư luỹ kế.
// Hàm thuần, không đụng DOM. Mọi biểu đồ đều tính từ cùng danh sách giao dịch của tháng nên tổng luôn khớp thẻ tổng quan.
import { formatCompactVND } from './money.js';
import { parseMonth } from './months.js';
import { parseISODate } from './dates.js';

const MINUS = '−';
export const DAYS_PER_WEEK = 7;
export const MAX_SLICES = 8; // DESIGN §2.3: không quá 8 miếng, phần còn lại gộp vào "Khác"
export const OTHER_CATEGORY_ID = 'cat-expense-other';

export function daysInMonth(ym) {
  const parts = parseMonth(ym);
  if (!parts) return 0;
  const date = new Date(2000, 0, 1);
  date.setFullYear(parts.year, parts.month, 0); // ngày 0 của tháng sau = ngày cuối của tháng này
  return date.getDate();
}

const pad2 = (n) => String(n).padStart(2, '0');
const isMoney = (n) => Number.isSafeInteger(n) && n > 0;
const isFlow = (tx) => !!tx && (tx.type === 'income' || tx.type === 'expense') && isMoney(tx.amount);

/** Ngày trong tháng (1..N) của một giao dịch, hoặc 0 nếu giao dịch không thuộc tháng/ngày sai. */
function dayInMonth(date, ym, last) {
  if (typeof date !== 'string' || date.length !== 10 || !date.startsWith(`${ym}-`) || !parseISODate(date)) return 0;
  const day = Number(date.slice(8, 10));
  return day >= 1 && day <= last ? day : 0;
}

/** [{ tx, day }] của các giao dịch hợp lệ thuộc tháng `ym`. */
function inMonth(transactions, ym) {
  const last = daysInMonth(ym);
  const out = [];
  for (const tx of transactions ?? []) {
    if (!isFlow(tx)) continue;
    const day = dayInMonth(tx.date, ym, last);
    if (day) out.push({ tx, day });
  }
  return out;
}

/* ---------- ① theo tuần ---------- */

/** Tuần 1 = ngày 1–7, tuần 2 = 8–14, …; tuần cuối kết thúc ở ngày cuối tháng. Tháng 28 ngày có 4 tuần, còn lại có 5. */
export function weekRanges(ym) {
  const last = daysInMonth(ym);
  const weeks = [];
  for (let from = 1, index = 1; from <= last; from += DAYS_PER_WEEK, index += 1) {
    const to = Math.min(from + DAYS_PER_WEEK - 1, last);
    weeks.push({ index, from, to, label: `Tuần ${index}`, range: from === to ? `${from}` : `${from}–${to}` });
  }
  return weeks;
}

/** @returns {{ weeks: {index,from,to,label,range,income,expense}[], totals: {income,expense} }} */
export function weeklyData(transactions, ym) {
  const weeks = weekRanges(ym).map((w) => ({ ...w, income: 0, expense: 0 }));
  const totals = { income: 0, expense: 0 };
  for (const { tx, day } of inMonth(transactions, ym)) {
    weeks[Math.floor((day - 1) / DAYS_PER_WEEK)][tx.type] += tx.amount;
    totals[tx.type] += tx.amount;
  }
  return { weeks, totals };
}

/* ---------- ② theo danh mục (chỉ khoản chi) ---------- */

/** Chia 100% cho các số tiền theo phương pháp phần dư lớn nhất để tổng luôn đúng 100. */
export function allocatePercents(amounts, total) {
  if (!(total > 0)) return amounts.map(() => 0);
  const raw = amounts.map((a) => (a * 100) / total);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((s, n) => s + n, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/**
 * Tổng chi theo danh mục, lớn nhất trước, "Khác" luôn đứng cuối. Quá 8 miếng thì 7 miếng lớn nhất được giữ,
 * phần còn lại (cùng danh mục "Khác" thật và danh mục đã bị xoá) gộp vào một miếng "Khác".
 * @returns {{ total: number, slices: {id,name,color,icon,amount,percent,share}[], merged: number }}
 */
export function categoryData(transactions, categories = []) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map();
  let total = 0;
  let orphan = 0; // khoản chi trỏ tới danh mục không còn tồn tại
  for (const tx of transactions ?? []) {
    if (!isFlow(tx) || tx.type !== 'expense') continue;
    total += tx.amount;
    const category = byId.get(tx.categoryId);
    if (!category || category.type === 'income') orphan += tx.amount;
    else totals.set(category.id, (totals.get(category.id) ?? 0) + tx.amount);
  }

  const other = byId.get(OTHER_CATEGORY_ID) ?? { id: OTHER_CATEGORY_ID, name: 'Khác', color: 'other', icon: 'circle-ellipsis' };
  const named = [...totals.entries()]
    .filter(([id]) => id !== OTHER_CATEGORY_ID)
    .map(([id, amount]) => {
      const c = byId.get(id);
      return { id, name: c.name, color: c.color, icon: c.icon, amount };
    })
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'vi') || (a.id < b.id ? -1 : 1));

  let otherAmount = (totals.get(OTHER_CATEGORY_ID) ?? 0) + orphan;
  let kept = named;
  let merged = 0;
  if (named.length + (otherAmount > 0 ? 1 : 0) > MAX_SLICES) {
    kept = named.slice(0, MAX_SLICES - 1);
    const rest = named.slice(MAX_SLICES - 1);
    merged = rest.length;
    otherAmount += rest.reduce((s, c) => s + c.amount, 0);
  }
  const slices = [...kept];
  if (otherAmount > 0) slices.push({ id: other.id, name: other.name, color: other.color, icon: other.icon, amount: otherAmount });
  const percents = allocatePercents(slices.map((s) => s.amount), total);
  return {
    total,
    slices: slices.map((s, i) => ({ ...s, percent: percents[i], share: total ? s.amount / total : 0 })),
    merged,
  };
}

/** "12%" — miếng nhỏ hơn 1% hiện "<1%" để không ghi 0% cho khoản có tiền. */
export function formatPercent(slice) {
  return slice.percent === 0 && slice.amount > 0 ? '<1%' : `${slice.percent}%`;
}

/* ---------- ③ theo ngày ---------- */

/** Mọi ngày trong tháng (kể cả ngày chưa có giao dịch). @returns {{ days: {day,date,income,expense}[], totals }} */
export function dailyData(transactions, ym) {
  const days = Array.from({ length: daysInMonth(ym) }, (_, i) => ({ day: i + 1, date: `${ym}-${pad2(i + 1)}`, income: 0, expense: 0 }));
  const totals = { income: 0, expense: 0 };
  for (const { tx, day } of inMonth(transactions, ym)) {
    days[day - 1][tx.type] += tx.amount;
    totals[tx.type] += tx.amount;
  }
  return { days, totals };
}

/* ---------- ④ số dư luỹ kế ---------- */

/**
 * Số dư cộng dồn từ đầu tháng (bắt đầu từ 0), mỗi điểm là số dư cuối ngày; điểm cuối cùng = số dư của thẻ tổng quan.
 * Tháng hiện tại chỉ vẽ đến hôm nay (hoặc ngày có giao dịch muộn nhất nếu muộn hơn), các tháng khác vẽ đủ cả tháng.
 * @param {{ today?: string }} [options] today dạng 'YYYY-MM-DD'
 */
export function balanceSeries(transactions, ym, { today } = {}) {
  const count = daysInMonth(ym);
  const { days, totals } = dailyData(transactions, ym);
  let lastDay = count;
  if (typeof today === 'string' && today.startsWith(`${ym}-`)) {
    const todayDay = Math.min(count, Math.max(1, Number(today.slice(8, 10)) || 1));
    const lastWithData = days.reduce((m, d) => (d.income || d.expense ? d.day : m), 0);
    lastDay = Math.max(todayDay, lastWithData);
  }
  let balance = 0;
  const points = days.slice(0, lastDay).map((d) => {
    balance += d.income - d.expense;
    return { day: d.day, date: d.date, income: d.income, expense: d.expense, net: d.income - d.expense, balance };
  });
  return { points, totals, lastDay, daysInMonth: count };
}

/* ---------- Trục biểu đồ ---------- */

const STEP_FACTORS = [1, 2, 2.5, 5, 10];

/** Bước chia "đẹp" (1, 2, 2,5, 5 × 10^n), luôn là số nguyên ≥ 1. */
export function niceStep(raw) {
  if (!(raw > 1)) return 1;
  const exp = 10 ** Math.floor(Math.log10(raw));
  for (const f of STEP_FACTORS) {
    const step = f * exp;
    if (step >= raw * (1 - 1e-12) && Number.isInteger(step)) return step;
  }
  return 10 * exp;
}

/**
 * Thang trục dọc luôn chứa số 0. Không có dữ liệu → thang mặc định 0…100k để khung biểu đồ vẫn có trục (DESIGN §9.2).
 * @returns {{ min: number, max: number, step: number, ticks: number[] }}
 */
export function niceScale(min, max, target = 4) {
  const lo = Math.min(0, Number.isFinite(min) ? min : 0);
  const hi = Math.max(0, Number.isFinite(max) ? max : 0);
  if (lo === 0 && hi === 0) return { min: 0, max: 100_000, step: 25_000, ticks: [0, 25_000, 50_000, 75_000, 100_000] };
  const step = niceStep((hi - lo) / target);
  const sMin = Math.floor(lo / step) * step;
  const sMax = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = sMin; v <= sMax; v += step) ticks.push(v);
  return { min: sMin, max: sMax, step, ticks };
}

/** Nhãn trục: 0 → "0", 850000 → "850k", 1200000 → "1,2tr", âm có dấu trừ thật. */
export function axisLabel(value) {
  if (!Number.isSafeInteger(value) || value === 0) return '0';
  const abs = Math.abs(value);
  const text = abs < 1000 ? String(abs) : formatCompactVND(abs);
  return value < 0 ? `${MINUS}${text}` : text;
}
