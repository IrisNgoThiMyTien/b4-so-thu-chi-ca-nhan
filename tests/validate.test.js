import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_AMOUNT } from '../src/core/money.js';
import { DEFAULT_CATEGORIES, DEFAULT_WALLETS } from '../src/core/defaults.js';
import { MESSAGES, NOTE_MAX, normalizeNote, validateTransaction } from '../src/core/validate.js';
import { validInput } from './helpers.js';

const ctx = { categories: DEFAULT_CATEGORIES, wallets: DEFAULT_WALLETS, today: '2026-10-27' };
const check = (overrides) => validateTransaction(validInput(overrides), ctx);

test('đầu vào hợp lệ → valid, value đã chuẩn hoá và chỉ chứa 6 trường', () => {
  const r = check({});
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, {});
  assert.deepEqual(Object.keys(r.value).sort(), ['amount', 'categoryId', 'date', 'note', 'type', 'walletId']);
});

test('trường thừa (id, createdAt, __proto__) bị bỏ qua, không lọt vào value', () => {
  const r = validateTransaction({ ...validInput(), id: 'x', createdAt: 'y', isAdmin: true }, ctx);
  assert.equal(r.valid, true);
  assert.equal('id' in r.value, false);
  assert.equal('isAdmin' in r.value, false);
});

test('số tiền: bắt buộc > 0', () => {
  for (const amount of [0, -1, -45000, NaN, Infinity, -Infinity, null, undefined, '', '0', '-5', '12a', '1e5', ' ', '１２', true, {}, []]) {
    const r = check({ amount });
    assert.equal(r.valid, false, `amount=${JSON.stringify(amount)}`);
    assert.equal(r.errors.amount, MESSAGES.amountEmpty, `amount=${JSON.stringify(amount)}`);
  }
});

test('số tiền: chữ số dạng chuỗi được đổi thành số nguyên', () => {
  const r = check({ amount: '45000' });
  assert.equal(r.valid, true);
  assert.equal(r.value.amount, 45000);
  assert.equal(typeof r.value.amount, 'number');
});

test('số tiền: phải là số nguyên đồng', () => {
  assert.equal(check({ amount: 10.5 }).errors.amount, MESSAGES.amountInteger);
  assert.equal(check({ amount: 0.5 }).errors.amount, MESSAGES.amountInteger);
});

test('số tiền: biên 1 và MAX_AMOUNT hợp lệ, MAX_AMOUNT + 1 bị từ chối', () => {
  assert.equal(check({ amount: 1 }).valid, true);
  assert.equal(check({ amount: MAX_AMOUNT }).valid, true);
  assert.equal(check({ amount: String(MAX_AMOUNT) }).valid, true);
  assert.equal(check({ amount: MAX_AMOUNT + 1 }).errors.amount, MESSAGES.amountTooLarge);
  assert.equal(check({ amount: '1000000000000' }).errors.amount, MESSAGES.amountTooLarge);
});

test('loại giao dịch: chỉ income/expense', () => {
  for (const type of ['transfer', '', null, undefined, 'EXPENSE', 1]) {
    const r = check({ type });
    assert.equal(r.valid, false, String(type));
    assert.equal(r.errors.type, MESSAGES.type);
    assert.equal(r.errors.categoryId, undefined, 'không báo thêm lỗi lệch loại khi chính loại đã sai');
  }
  assert.equal(check({ type: 'income', categoryId: 'cat-income-salary' }).valid, true);
});

test('danh mục: bắt buộc, phải tồn tại và cùng loại', () => {
  assert.equal(check({ categoryId: null }).errors.categoryId, MESSAGES.category);
  assert.equal(check({ categoryId: '' }).errors.categoryId, MESSAGES.category);
  assert.equal(check({ categoryId: 'khong-ton-tai' }).errors.categoryId, MESSAGES.category);
  assert.equal(check({ type: 'expense', categoryId: 'cat-income-salary' }).errors.categoryId, MESSAGES.categoryMismatch);
  assert.equal(check({ type: 'income', categoryId: 'cat-expense-food' }).errors.categoryId, MESSAGES.categoryMismatch);
});

test('ví: bắt buộc và phải tồn tại', () => {
  for (const walletId of [null, undefined, '', 'wallet-ghost']) {
    assert.equal(check({ walletId }).errors.walletId, MESSAGES.wallet);
  }
});

test('ngày: định dạng, ngày lịch có thật, không ở tương lai, không quá cũ', () => {
  for (const date of ['', null, undefined, '2026-02-30', '27/10/2026', '2026-1-1', 20261027]) {
    assert.equal(check({ date }).errors.date, MESSAGES.date, JSON.stringify(date));
  }
  assert.equal(check({ date: '2026-10-28' }).errors.date, MESSAGES.dateFuture);
  assert.equal(check({ date: '2027-01-01' }).errors.date, MESSAGES.dateFuture);
  assert.equal(check({ date: '2026-10-27' }).valid, true, 'hôm nay hợp lệ');
  assert.equal(check({ date: '2026-10-26' }).valid, true);
  assert.equal(check({ date: '2000-01-01' }).valid, true);
  assert.equal(check({ date: '1999-12-31' }).errors.date, MESSAGES.dateTooOld);
  assert.equal(check({ date: '2024-02-29' }).valid, true);
});

test('ngày: "hôm nay" lấy từ ctx.today (đổi sang ngày mới thì ngày mai trở thành hôm nay)', () => {
  const input = validInput({ date: '2026-10-28' });
  assert.equal(validateTransaction(input, { ...ctx, today: '2026-10-27' }).valid, false);
  assert.equal(validateTransaction(input, { ...ctx, today: '2026-10-28' }).valid, true);
});

test('ghi chú: không bắt buộc; tối đa 120 ký tự (đếm theo ký tự, không theo byte)', () => {
  assert.equal(check({ note: '' }).valid, true);
  assert.equal(check({ note: undefined }).valid, true);
  assert.equal(check({ note: null }).valid, true);
  assert.equal(check({ note: 'a'.repeat(NOTE_MAX) }).valid, true);
  assert.equal(check({ note: 'a'.repeat(NOTE_MAX + 1) }).errors.note, MESSAGES.note);
  assert.equal(check({ note: '😀'.repeat(NOTE_MAX) }).valid, true, '120 emoji vẫn là 120 ký tự');
  assert.equal(check({ note: '😀'.repeat(NOTE_MAX + 1) }).errors.note, MESSAGES.note);
  assert.equal(check({ note: '  ' + 'a'.repeat(NOTE_MAX) + '  ' }).valid, true, 'khoảng trắng hai đầu không tính');
});

test('normalizeNote: bỏ khoảng trắng hai đầu, xuống dòng/tab thành dấu cách', () => {
  assert.equal(normalizeNote('  hi  '), 'hi');
  assert.equal(normalizeNote('x\ny'), 'x y');
  assert.equal(normalizeNote('x\r\n\ty'), 'x y');
  assert.equal(normalizeNote('   '), '');
  assert.equal(normalizeNote(null), '');
  assert.equal(normalizeNote(undefined), '');
  assert.equal(normalizeNote(123), '123');
  assert.equal(normalizeNote('<b>x</b>'), '<b>x</b>', 'không đụng tới ký tự đặc biệt (chống XSS làm ở lúc hiển thị)');
});

test('nhiều lỗi cùng lúc được báo đủ', () => {
  const r = validateTransaction({ type: 'expense', amount: '', categoryId: null, walletId: null, date: '', note: 'a'.repeat(200) }, ctx);
  assert.equal(r.valid, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['amount', 'categoryId', 'date', 'note', 'walletId']);
  assert.equal(r.value, null);
});

test('đầu vào null/undefined/rỗng không ném lỗi', () => {
  for (const input of [null, undefined, {}]) {
    const r = validateTransaction(input, ctx);
    assert.equal(r.valid, false);
    assert.ok(r.errors.type && r.errors.amount && r.errors.categoryId && r.errors.walletId && r.errors.date);
  }
});

test('không làm thay đổi đối tượng đầu vào', () => {
  const input = validInput({ note: '  khoảng trắng  ' });
  const snapshot = JSON.stringify(input);
  validateTransaction(input, ctx);
  assert.equal(JSON.stringify(input), snapshot);
});
