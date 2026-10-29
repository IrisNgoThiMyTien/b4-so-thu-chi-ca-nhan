// Tiền tệ VND: luôn lưu số nguyên; chỉ định dạng khi hiển thị.
export const MAX_AMOUNT = 999_999_999_999;
export const MAX_AMOUNT_DIGITS = String(MAX_AMOUNT).length;

const NBSP = ' ';
const MINUS = '−';

export function groupDigits(digits) {
  return String(digits).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 1250000 -> "1.250.000 ₫" (dấu cách không ngắt dòng trước ₫). */
export function formatVND(amount) {
  if (!Number.isSafeInteger(amount)) return '';
  const sign = amount < 0 ? MINUS : '';
  return `${sign}${groupDigits(Math.abs(amount))}${NBSP}₫`;
}

/** Thu có tiền tố "+", chi có tiền tố "−" (dấu trừ thật). */
export function formatSignedVND(type, amount) {
  const text = formatVND(Math.abs(amount));
  if (!text) return '';
  return `${type === 'income' ? '+' : MINUS}${text}`;
}

/**
 * Chuẩn hoá chuỗi người dùng gõ/dán thành các chữ số hợp lệ.
 * Bỏ mọi ký tự không phải chữ số ASCII, bỏ số 0 đứng đầu, cắt tối đa 12 chữ số.
 */
export function parseAmountInput(raw) {
  const digits = String(raw ?? '')
    .replace(/[^0-9]/g, '')
    .replace(/^0+/, '')
    .slice(0, MAX_AMOUNT_DIGITS);
  return { digits, value: digits ? Number(digits) : 0 };
}

/** Chuỗi chữ số -> "1.250.000" (dùng cho ô nhập). */
export function formatAmountInput(digits) {
  return groupDigits(digits);
}

const COMPACT_UNITS = [
  { value: 1e3, suffix: 'k' },
  { value: 1e6, suffix: 'tr' },
  { value: 1e9, suffix: ' tỷ' },
];
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Dạng rút gọn cho chỗ hẹp (DESIGN §3, §6.2): 850000 -> "850k", 18500000 -> "18,5tr", 1200000000 -> "1,2 tỷ".
 * Dưới 1.000 giữ nguyên: "850 ₫". Chỉ nhận số nguyên không âm; giá trị khác trả chuỗi rỗng.
 */
export function formatCompactVND(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) return '';
  let index = -1;
  COMPACT_UNITS.forEach((u, i) => {
    if (amount >= u.value) index = i;
  });
  if (index < 0) return `${amount}${NBSP}\u20ab`;
  let rounded = round1(amount / COMPACT_UNITS[index].value);
  if (rounded >= 1000 && index < COMPACT_UNITS.length - 1) {
    index += 1; // 999.999 -> "1tr" chứ không phải "1000k"
    rounded = round1(amount / COMPACT_UNITS[index].value);
  }
  const [whole, fraction] = String(rounded).split('.');
  return `${groupDigits(whole)}${fraction ? `,${fraction}` : ''}${COMPACT_UNITS[index].suffix}`;
}
