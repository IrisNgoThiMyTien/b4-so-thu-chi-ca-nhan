import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayLabel, fullDayLabel, groupByDay, limitRows } from '../src/core/day-groups.js';
import { CATEGORY_COLOR_KEYS, DEFAULT_CATEGORIES, categoryColorVar } from '../src/core/defaults.js';

const TODAY = '2026-10-27'; // thứ Ba

test('dayLabel: Hôm nay / Hôm qua', () => {
  assert.equal(dayLabel('2026-10-27', TODAY), 'Hôm nay');
  assert.equal(dayLabel('2026-10-26', TODAY), 'Hôm qua');
});

test('dayLabel: các ngày khác dạng "Thứ Sáu, 23/10" (ví dụ trong DESIGN)', () => {
  assert.equal(dayLabel('2026-10-23', TODAY), 'Thứ Sáu, 23/10');
  assert.equal(dayLabel('2026-10-25', TODAY), 'Chủ nhật, 25/10');
  assert.equal(dayLabel('2026-10-24', TODAY), 'Thứ Bảy, 24/10');
  assert.equal(dayLabel('2026-10-01', TODAY), 'Thứ Năm, 01/10');
  assert.equal(dayLabel('2026-10-05', TODAY), 'Thứ Hai, 05/10');
  assert.equal(dayLabel('2026-10-07', TODAY), 'Thứ Tư, 07/10');
});

test('dayLabel: đủ 7 thứ không trùng nhau', () => {
  const names = new Set();
  for (let d = 4; d <= 10; d += 1) names.add(dayLabel(`2026-10-${String(d).padStart(2, '0')}`, TODAY).split(',')[0]);
  assert.equal(names.size, 7);
});

test('dayLabel: khác năm hiện tại thì thêm năm', () => {
  assert.equal(dayLabel('2025-12-31', TODAY), 'Thứ Tư, 31/12/2025');
  assert.equal(dayLabel('2024-02-29', TODAY), 'Thứ Năm, 29/02/2024');
});

test('dayLabel: "Hôm qua" đúng qua ranh giới tháng/năm', () => {
  assert.equal(dayLabel('2025-12-31', '2026-01-01'), 'Hôm qua');
  assert.equal(dayLabel('2026-02-28', '2026-03-01'), 'Hôm qua');
});

test('dayLabel: ngày không hợp lệ → rỗng', () => {
  for (const bad of ['', null, undefined, '2026-02-30', 'abc', '27/10/2026']) assert.equal(dayLabel(bad, TODAY), '', String(bad));
});

test('fullDayLabel', () => {
  assert.equal(fullDayLabel('2026-10-23'), 'Thứ Sáu, 23/10/2026');
  assert.equal(fullDayLabel('xx'), '');
});

const tx = (date, type, amount, id = `${date}-${type}-${amount}`) => ({ id, date, type, amount });

test('groupByDay: giữ thứ tự xuất hiện, tính thu/chi/ròng từng ngày', () => {
  const groups = groupByDay([tx('2026-10-27', 'expense', 45_000), tx('2026-10-27', 'expense', 40_000), tx('2026-10-26', 'income', 500_000), tx('2026-10-23', 'expense', 100), tx('2026-10-23', 'income', 100)]);
  assert.deepEqual(groups.map((g) => [g.date, g.income, g.expense, g.net, g.items.length]), [
    ['2026-10-27', 0, 85_000, -85_000, 2],
    ['2026-10-26', 500_000, 0, 500_000, 1],
    ['2026-10-23', 100, 100, 0, 2],
  ]);
});

test('groupByDay: danh sách rỗng và loại lạ', () => {
  assert.deepEqual(groupByDay([]), []);
  const [g] = groupByDay([tx('2026-10-27', 'transfer', 999), tx('2026-10-27', 'income', 1)]);
  assert.equal(g.net, 1);
  assert.equal(g.items.length, 2);
});

test('limitRows: cắt theo số dòng, tổng của ngày vẫn tính cả ngày', () => {
  const groups = groupByDay([tx('2026-10-27', 'expense', 10, 'a'), tx('2026-10-27', 'expense', 20, 'b'), tx('2026-10-27', 'expense', 30, 'c'), tx('2026-10-26', 'income', 5, 'd')]);
  const { groups: cut, shown, total } = limitRows(groups, 2);
  assert.equal(total, 4);
  assert.equal(shown, 2);
  assert.equal(cut.length, 1);
  assert.deepEqual(cut[0].items.map((i) => i.id), ['a', 'b']);
  assert.equal(cut[0].expense, 60, 'tổng ngày gồm cả dòng chưa hiển thị');
  assert.equal(limitRows(groups, 3).groups.length, 1);
  assert.equal(limitRows(groups, 4).groups.length, 2);
  assert.equal(limitRows(groups, 99).shown, 4);
  assert.deepEqual(limitRows(groups, 0), { groups: [], shown: 0, total: 4 });
  assert.deepEqual(limitRows(groups, -5), { groups: [], shown: 0, total: 4 });
});

test('categoryColorVar: chỉ nhận 8 khoá màu trong bảng; giá trị lạ rơi về "other"', () => {
  for (const k of CATEGORY_COLOR_KEYS) assert.equal(categoryColorVar(k), `var(--cat-${k})`);
  for (const bad of ['x);position:fixed', 'EAT', '', null, undefined, 42, {}, '__proto__', 'constructor']) {
    assert.equal(categoryColorVar(bad), 'var(--cat-other)', String(bad));
  }
  for (const c of DEFAULT_CATEGORIES) assert.ok(CATEGORY_COLOR_KEYS.includes(c.color), c.name);
});
