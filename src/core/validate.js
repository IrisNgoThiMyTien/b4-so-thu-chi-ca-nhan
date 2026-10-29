// Kiểm tra dữ liệu một giao dịch (PRD F5). Thuần hàm, không đụng DOM/localStorage.
import { MAX_AMOUNT, formatVND } from './money.js';
import { MIN_DATE, isValidISODate } from './dates.js';

export const NOTE_MAX = 120;

export const MESSAGES = {
  type: 'Chọn loại thu hoặc chi',
  amountEmpty: 'Nhập số tiền lớn hơn 0',
  amountInteger: 'Số tiền phải là số nguyên đồng',
  amountTooLarge: `Số tiền tối đa ${formatVND(MAX_AMOUNT)}`,
  category: 'Chọn danh mục',
  categoryMismatch: 'Danh mục không phù hợp với loại đã chọn',
  wallet: 'Chọn ví',
  date: 'Chọn ngày hợp lệ',
  dateFuture: 'Ngày không được ở tương lai',
  dateTooOld: 'Ngày quá xa (từ năm 2000 trở đi)',
  note: `Ghi chú tối đa ${NOTE_MAX} ký tự`,
};

function normalizeAmount(raw) {
  if (typeof raw === 'string') return /^[0-9]+$/.test(raw) ? Number(raw) : NaN;
  return raw;
}

/** Xuống dòng/tab -> khoảng trắng, bỏ khoảng trắng hai đầu. */
export function normalizeNote(note) {
  return String(note ?? '').replace(/[\r\n\t]+/g, ' ').trim();
}

/**
 * @param input  { type, amount, categoryId, walletId, date, note }
 * @param ctx    { categories, wallets, today: 'YYYY-MM-DD' }
 * @returns { valid, errors, value }  value là bản đã chuẩn hoá (chỉ tin khi valid = true)
 */
export function validateTransaction(input, { categories, wallets, today }) {
  const src = input ?? {};
  const errors = {};

  const type = src.type;
  if (type !== 'income' && type !== 'expense') errors.type = MESSAGES.type;

  const amount = normalizeAmount(src.amount);
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = MESSAGES.amountEmpty;
  } else if (!Number.isInteger(amount)) {
    errors.amount = MESSAGES.amountInteger;
  } else if (amount > MAX_AMOUNT) {
    errors.amount = MESSAGES.amountTooLarge;
  }

  const category = categories.find((c) => c.id === src.categoryId);
  if (!category) errors.categoryId = MESSAGES.category;
  else if (!errors.type && category.type !== type) errors.categoryId = MESSAGES.categoryMismatch;

  if (!wallets.some((w) => w.id === src.walletId)) errors.walletId = MESSAGES.wallet;

  if (!isValidISODate(src.date)) errors.date = MESSAGES.date;
  else if (src.date > today) errors.date = MESSAGES.dateFuture;
  else if (src.date < MIN_DATE) errors.date = MESSAGES.dateTooOld;

  const note = normalizeNote(src.note);
  if ([...note].length > NOTE_MAX) errors.note = MESSAGES.note;

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    value: valid
      ? { type, amount, categoryId: src.categoryId, walletId: src.walletId, date: src.date, note }
      : null,
  };
}
