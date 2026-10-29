// Tổng thu / chi / số dư của một tháng và cách hiển thị trên thẻ tổng quan (PRD F7, DESIGN §6.2).
import { formatCompactVND, formatVND } from './money.js';

const MINUS = '−';
export const LONG_TEXT_LENGTH = 13; // dài hơn mức này thì luôn dùng dạng rút gọn

export function summarize(transactions) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense, balance: income - expense, count: transactions.length };
}

function signFor(kind, value) {
  if (kind === 'income') return value > 0 ? '+' : '';
  if (kind === 'expense') return value > 0 ? MINUS : '';
  return value > 0 ? '+' : value < 0 ? MINUS : '';
}

function describeOne(kind, label, value) {
  const abs = Math.abs(value);
  const fullBody = formatVND(abs);
  if (!fullBody || !Number.isSafeInteger(value)) {
    return { kind, value, sign: '', full: '—', compact: '—', long: false, negative: false, aria: `${label}: không xác định` };
  }
  const sign = signFor(kind, value);
  return {
    kind,
    value,
    sign,
    full: `${sign}${fullBody}`,
    compact: `${sign}${formatCompactVND(abs)}`,
    long: `${sign}${fullBody}`.length > LONG_TEXT_LENGTH,
    negative: value < 0,
    aria: `${label}: ${value < 0 ? 'âm ' : ''}${fullBody}`,
  };
}

/** Chuỗi hiển thị cho 3 thẻ: đầy đủ ("+18.500.000 ₫"), rút gọn ("+18,5tr"), và nhãn đọc cho trình đọc màn hình. */
export function describeSummary({ income, expense, balance }) {
  return {
    income: describeOne('income', 'Thu', income),
    expense: describeOne('expense', 'Chi', expense),
    balance: describeOne('balance', 'Số dư', balance),
  };
}
