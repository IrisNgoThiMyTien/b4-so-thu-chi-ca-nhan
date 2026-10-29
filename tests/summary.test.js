import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactVND } from '../src/core/money.js';
import { describeSummary, summarize } from '../src/core/summary.js';
import { MemoryBackend, makeRepo, plain, validInput } from './helpers.js';

const compact = (n) => plain(formatCompactVND(n));

test('formatCompactVND: các ví dụ trong DESIGN (850k, 1,2tr, 18,5tr)', () => {
  assert.equal(compact(850_000), '850k');
  assert.equal(compact(1_200_000), '1,2tr');
  assert.equal(compact(18_500_000), '18,5tr');
  assert.equal(compact(12_300_000), '12,3tr');
});

test('formatCompactVND: dưới 1.000 giữ nguyên số', () => {
  assert.equal(compact(0), '0 ₫');
  assert.equal(compact(7), '7 ₫');
  assert.equal(compact(999), '999 ₫');
});

test('formatCompactVND: bỏ ",0", làm tròn 1 chữ số thập phân', () => {
  assert.equal(compact(1_000), '1k');
  assert.equal(compact(1_500), '1,5k');
  assert.equal(compact(1_549), '1,5k');
  assert.equal(compact(1_550), '1,6k');
  assert.equal(compact(2_000_000), '2tr');
  assert.equal(compact(1_250_000), '1,3tr');
  assert.equal(compact(100_000_000), '100tr');
});

test('formatCompactVND: không bao giờ ra "1000k"/"1000tr" – nhảy lên đơn vị kế tiếp', () => {
  assert.equal(compact(999_949), '999,9k');
  assert.equal(compact(999_950), '1tr');
  assert.equal(compact(999_999), '1tr');
  assert.equal(compact(999_949_999), '999,9tr');
  assert.equal(compact(999_999_999), '1 tỷ');
});

test('formatCompactVND: hàng tỷ', () => {
  assert.equal(compact(1_000_000_000), '1 tỷ');
  assert.equal(compact(1_200_000_000), '1,2 tỷ');
  assert.equal(compact(999_999_999_999), '1.000 tỷ');
  assert.equal(compact(12_345_000_000_000), '12.345 tỷ');
});

test('formatCompactVND: giá trị không hợp lệ trả chuỗi rỗng', () => {
  for (const bad of [-1, NaN, Infinity, 1.5, '1000', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(formatCompactVND(bad), '', String(bad));
  }
});

/* ---------- summarize ---------- */
const tx = (type, amount) => ({ type, amount });

test('summarize: tổng thu, tổng chi, số dư và số khoản', () => {
  const s = summarize([tx('income', 18_500_000), tx('expense', 45_000), tx('expense', 12_255_000), tx('income', 500)]);
  assert.deepEqual(s, { income: 18_500_500, expense: 12_300_000, balance: 6_200_500, count: 4 });
});

test('summarize: rỗng → 0 hết; chỉ chi → số dư âm; bỏ qua loại lạ', () => {
  assert.deepEqual(summarize([]), { income: 0, expense: 0, balance: 0, count: 0 });
  assert.deepEqual(summarize([tx('expense', 100), tx('expense', 50)]), { income: 0, expense: 150, balance: -150, count: 2 });
  assert.deepEqual(summarize([tx('income', 10), tx('transfer', 999)]), { income: 10, expense: 0, balance: 10, count: 2 });
});

test('summarize khớp danh sách của kho dữ liệu (PRD §9: số liệu 100% khớp)', () => {
  const { repo } = makeRepo();
  const plan = [
    ['income', 'cat-income-salary', 15_000_000, '2026-10-01'],
    ['expense', 'cat-expense-food', 45_000, '2026-10-27'],
    ['expense', 'cat-expense-home', 3_500_000, '2026-10-05'],
    ['expense', 'cat-expense-food', 99_000, '2026-09-30'],
    ['income', 'cat-income-bonus', 2_000_000, '2026-11-01'.replace('11', '09')],
  ];
  for (const [type, categoryId, amount, date] of plan) repo.add(validInput({ type, categoryId, amount, date }));
  assert.deepEqual(summarize(repo.listByMonth('2026-10')), { income: 15_000_000, expense: 3_545_000, balance: 11_455_000, count: 3 });
  assert.deepEqual(summarize(repo.listByMonth('2026-09')), { income: 2_000_000, expense: 99_000, balance: 1_901_000, count: 2 });
});

/* ---------- describeSummary ---------- */
test('describeSummary: dấu +/−, số đầy đủ và rút gọn (DESIGN §3, §6.2)', () => {
  const d = describeSummary({ income: 18_500_000, expense: 12_300_000, balance: 6_200_000 });
  assert.equal(plain(d.income.full), '+18.500.000 ₫');
  assert.equal(d.income.compact, '+18,5tr');
  assert.equal(plain(d.expense.full), '−12.300.000 ₫');
  assert.equal(d.expense.compact, '−12,3tr');
  assert.equal(plain(d.balance.full), '+6.200.000 ₫');
  assert.equal(d.balance.compact, '+6,2tr');
  assert.equal(d.balance.negative, false);
});

test('describeSummary: số dư âm có dấu − và cờ negative; số dư 0 không dấu', () => {
  const neg = describeSummary({ income: 100_000, expense: 3_200_000, balance: -3_100_000 });
  assert.equal(plain(neg.balance.full), '−3.100.000 ₫');
  assert.equal(neg.balance.compact, '−3,1tr');
  assert.equal(neg.balance.negative, true);
  assert.match(neg.balance.aria, /^Số dư: âm 3\.100\.000/);
  const zero = describeSummary({ income: 5, expense: 5, balance: 0 });
  assert.equal(plain(zero.balance.full), '0 ₫');
  assert.equal(zero.balance.negative, false);
});

test('describeSummary: tháng trống không có dấu thừa trên Thu/Chi', () => {
  const d = describeSummary({ income: 0, expense: 0, balance: 0 });
  for (const k of ['income', 'expense', 'balance']) {
    assert.equal(plain(d[k].full), '0 ₫', k);
    assert.equal(d[k].sign, '', k);
    assert.equal(d[k].long, false, k);
  }
});

test('describeSummary: nhãn đọc cho trình đọc màn hình không chứa ký hiệu +/−', () => {
  const d = describeSummary({ income: 18_500_000, expense: 12_300_000, balance: 6_200_000 });
  assert.equal(plain(d.income.aria), 'Thu: 18.500.000 ₫');
  assert.equal(plain(d.expense.aria), 'Chi: 12.300.000 ₫');
  assert.equal(plain(d.balance.aria), 'Số dư: 6.200.000 ₫');
});

test('describeSummary: số dài (> 13 ký tự) được đánh dấu long để luôn dùng dạng rút gọn', () => {
  const d = describeSummary({ income: 123_456_789_012, expense: 9_999_999, balance: 123_446_789_013 });
  assert.equal(d.income.long, true);
  assert.equal(d.expense.long, false); // "−9.999.999 ₫" = 12 ký tự
  const edge = describeSummary({ income: 99_999_999, expense: 0, balance: 99_999_999 });
  assert.equal(edge.income.full.length, 13); // "+99.999.999 ₫"
  assert.equal(edge.income.long, false);
  assert.equal(describeSummary({ income: 100_000_000, expense: 0, balance: 0 }).income.long, true);
});

test('describeSummary: tổng vượt giới hạn số nguyên an toàn → "—", không hiện số sai', () => {
  const d = describeSummary({ income: Number.MAX_SAFE_INTEGER + 2, expense: 0, balance: Number.MAX_SAFE_INTEGER + 2 });
  assert.equal(d.income.full, '—');
  assert.equal(d.income.compact, '—');
  assert.match(d.income.aria, /không xác định/);
});

test('hiệu năng: tổng hợp 5.000 giao dịch < 50 ms', () => {
  const list = Array.from({ length: 5000 }, (_, i) => ({ type: i % 3 ? 'expense' : 'income', amount: 1000 + i }));
  const t0 = performance.now();
  const s = summarize(list);
  const ms = performance.now() - t0;
  assert.equal(s.count, 5000);
  assert.ok(ms < 50, `${ms.toFixed(1)}ms`);
});

test('kho dữ liệu: getMonthsWithData và subscribe', () => {
  const { repo, backend } = makeRepo({ backend: new MemoryBackend() });
  assert.deepEqual(repo.getMonthsWithData(), []);
  let calls = 0;
  const off = repo.subscribe(() => (calls += 1));
  const a = repo.add(validInput({ date: '2026-10-01' })).transaction;
  repo.add(validInput({ date: '2026-02-10' }));
  repo.add(validInput({ date: '2026-10-20' }));
  repo.add(validInput({ date: '2025-12-31' }));
  assert.deepEqual(repo.getMonthsWithData(), ['2025-12', '2026-02', '2026-10']);
  assert.equal(calls, 4);
  repo.update(a.id, validInput({ date: '2026-10-02' }));
  repo.remove(a.id);
  repo.restore(a);
  assert.equal(calls, 7);
  repo.add(validInput({ amount: 0 })); // sai → không thông báo
  repo.remove('khong-co');
  assert.equal(calls, 7);
  backend.failWrites = 'quota';
  repo.add(validInput()); // ghi lỗi → không thông báo
  assert.equal(calls, 7);
  backend.failWrites = null;
  off();
  repo.add(validInput());
  assert.equal(calls, 7);
});

test('kho dữ liệu: người nghe ném lỗi không làm hỏng thao tác đã lưu và không chặn người nghe khác', () => {
  const { repo } = makeRepo();
  const original = console.error;
  console.error = () => {};
  try {
    let second = 0;
    repo.subscribe(() => {
      throw new Error('boom');
    });
    repo.subscribe(() => (second += 1));
    const res = repo.add(validInput());
    assert.equal(res.ok, true);
    assert.equal(repo.count(), 1);
    assert.equal(second, 1);
  } finally {
    console.error = original;
  }
});
