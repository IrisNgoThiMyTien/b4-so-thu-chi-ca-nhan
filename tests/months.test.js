import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_MONTH, addMonths, compareMonths, currentMonth, formatMonthLabel, isValidMonth, makeMonth, monthOf, parseMonth } from '../src/core/months.js';
import { createMonthState } from '../src/core/month-state.js';
import { makeClock } from './helpers.js';

test('isValidMonth / parseMonth: chỉ nhận YYYY-MM với tháng 01–12', () => {
  for (const ok of ['2026-10', '2000-01', '1999-12', '2026-01', '2026-12']) assert.equal(isValidMonth(ok), true, ok);
  for (const bad of ['2026-13', '2026-00', '2026-1', '26-10', '2026/10', '2026-10-01', ' 2026-10', '', null, undefined, 202610, {}]) {
    assert.equal(isValidMonth(bad), false, String(JSON.stringify(bad)));
    assert.equal(parseMonth(bad), null);
  }
  assert.deepEqual(parseMonth('2026-10'), { year: 2026, month: 10 });
});

test('makeMonth đệm số 0', () => {
  assert.equal(makeMonth(2026, 3), '2026-03');
  assert.equal(makeMonth(2026, 12), '2026-12');
  assert.equal(makeMonth(999, 1), '0999-01');
});

test('currentMonth theo giờ cục bộ, kể cả sát nửa đêm giao tháng', () => {
  assert.equal(currentMonth(new Date(2026, 9, 31, 23, 59, 59)), '2026-10');
  assert.equal(currentMonth(new Date(2026, 10, 1, 0, 0, 0)), '2026-11');
  assert.equal(currentMonth(new Date(2026, 0, 1, 0, 0, 1)), '2026-01');
});

test('monthOf', () => {
  assert.equal(monthOf('2026-10-27'), '2026-10');
  assert.equal(monthOf(undefined), '');
});

test('addMonths: qua năm, nhiều tháng, số âm', () => {
  assert.equal(addMonths('2026-10', 1), '2026-11');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-10', 0), '2026-10');
  assert.equal(addMonths('2026-10', 14), '2027-12');
  assert.equal(addMonths('2026-10', -10), '2025-12');
  assert.equal(addMonths('2026-10', -22), '2024-12');
  assert.equal(addMonths('2000-01', -1), '1999-12');
  assert.equal(addMonths('khong', 1), null);
});

test('compareMonths', () => {
  assert.equal(compareMonths('2026-09', '2026-10'), -1);
  assert.equal(compareMonths('2026-10', '2026-10'), 0);
  assert.equal(compareMonths('2027-01', '2026-12'), 1);
});

test('formatMonthLabel: "Tháng 10/2026", không đệm số 0', () => {
  assert.equal(formatMonthLabel('2026-10'), 'Tháng 10/2026');
  assert.equal(formatMonthLabel('2026-03'), 'Tháng 3/2026');
  assert.equal(formatMonthLabel('xx'), '');
});

/* ---------- trạng thái tháng đang xem ---------- */
test('mặc định là tháng hiện tại; canNext = false ở tháng hiện tại', () => {
  const s = createMonthState({ now: makeClock() });
  assert.equal(s.get(), '2026-10');
  assert.equal(s.canNext(), false);
  assert.equal(s.canPrev(), true);
  assert.equal(s.isCurrent(), true);
});

test('initial hợp lệ được dùng; không hợp lệ hoặc ở tương lai thì rơi về tháng hiện tại', () => {
  const now = makeClock();
  assert.equal(createMonthState({ initial: '2026-03', now }).get(), '2026-03');
  for (const bad of ['2026-11', '2027-01', 'abc', '', null, '1999-12', '2026-13']) {
    assert.equal(createMonthState({ initial: bad, now }).get(), '2026-10', String(bad));
  }
});

test('prev/next đi từng tháng, qua ranh giới năm; không vượt tháng hiện tại', () => {
  const s = createMonthState({ initial: '2026-01', now: makeClock() });
  assert.equal(s.prev(), true);
  assert.equal(s.get(), '2025-12');
  assert.equal(s.next(), true);
  assert.equal(s.get(), '2026-01');
  s.set('2026-10');
  assert.equal(s.next(), false);
  assert.equal(s.get(), '2026-10');
});

test('không lùi quá tháng nhỏ nhất (2000-01)', () => {
  const s = createMonthState({ initial: MIN_MONTH, now: makeClock() });
  assert.equal(s.canPrev(), false);
  assert.equal(s.prev(), false);
  assert.equal(s.get(), MIN_MONTH);
  assert.equal(s.set('1999-12'), false);
});

test('set: từ chối giá trị sai và tương lai, không phát sự kiện', () => {
  const s = createMonthState({ now: makeClock() });
  const seen = [];
  s.subscribe((n, o) => seen.push([n, o]));
  for (const bad of ['2026-11', 'x', null, undefined, '2026-1', 202610]) assert.equal(s.set(bad), false, String(bad));
  assert.equal(s.get(), '2026-10');
  assert.deepEqual(seen, []);
});

test('subscribe: gọi khi đổi tháng với (mới, cũ); đặt lại đúng tháng đang xem thì không gọi; huỷ đăng ký được', () => {
  const s = createMonthState({ now: makeClock() });
  const seen = [];
  const off = s.subscribe((n, o) => seen.push([n, o]));
  s.set('2026-10');
  assert.deepEqual(seen, []);
  s.prev();
  s.set('2026-02');
  assert.deepEqual(seen, [['2026-09', '2026-10'], ['2026-02', '2026-09']]);
  off();
  s.next();
  assert.equal(seen.length, 2);
});

test('một người nghe huỷ đăng ký ngay trong lúc được gọi không làm hỏng người còn lại', () => {
  const s = createMonthState({ now: makeClock() });
  const calls = [];
  const off = s.subscribe(() => {
    calls.push('a');
    off();
  });
  s.subscribe(() => calls.push('b'));
  s.prev();
  s.prev();
  assert.deepEqual(calls, ['a', 'b', 'b']);
});

test('qua tháng mới khi đang mở: latest() theo đồng hồ, tháng cũ vẫn giữ và giờ có thể ▶', () => {
  const now = makeClock(2026, 9, 31, 23, 59);
  const s = createMonthState({ now });
  assert.equal(s.canNext(), false);
  now.set(2026, 10, 1, 0, 1);
  assert.equal(s.get(), '2026-10');
  assert.equal(s.latest(), '2026-11');
  assert.equal(s.canNext(), true);
  assert.equal(s.isCurrent(), false);
  assert.equal(s.next(), true);
  assert.equal(s.get(), '2026-11');
});
