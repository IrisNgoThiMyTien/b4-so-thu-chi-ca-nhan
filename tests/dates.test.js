import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, formatDisplayDate, isValidISODate, parseISODate, toISODate, todayISO } from '../src/core/dates.js';

test('toISODate / todayISO dùng giờ cục bộ, không lệch theo UTC', () => {
  assert.equal(toISODate(new Date(2026, 9, 27, 0, 0, 0)), '2026-10-27');
  assert.equal(toISODate(new Date(2026, 9, 27, 23, 59, 59)), '2026-10-27');
  assert.equal(todayISO(new Date(2026, 0, 1, 0, 0, 1)), '2026-01-01');
  assert.equal(todayISO(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31');
});

test('toISODate: đệm số 0 cho tháng/ngày', () => {
  assert.equal(toISODate(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(toISODate(new Date(2026, 8, 9)), '2026-09-09');
});

test('isValidISODate: chấp nhận ngày lịch có thật (kể cả 29/02 năm nhuận)', () => {
  for (const ok of ['2026-10-27', '2024-02-29', '2000-02-29', '2026-12-31', '2026-01-01']) {
    assert.equal(isValidISODate(ok), true, ok);
  }
});

test('isValidISODate: từ chối ngày không tồn tại hoặc sai định dạng', () => {
  const bad = [
    '2023-02-29', '1900-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-10-00', '2026-10-32',
    '2026-1-1', '26-10-27', '2026/10/27', '27/10/2026', '2026-10-27T00:00:00', ' 2026-10-27', '2026-10-27 ',
    '', 'abc', null, undefined, 20261027, {}, [],
  ];
  for (const b of bad) assert.equal(isValidISODate(b), false, String(JSON.stringify(b)));
});

test('parseISODate trả về Date lúc 00:00 giờ cục bộ', () => {
  const d = parseISODate('2026-10-27');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 9);
  assert.equal(d.getDate(), 27);
  assert.equal(d.getHours(), 0);
  assert.equal(parseISODate('2026-02-30'), null);
});

test('addDays: qua tháng, qua năm, năm nhuận', () => {
  assert.equal(addDays('2026-10-27', 0), '2026-10-27');
  assert.equal(addDays('2026-10-27', -1), '2026-10-26');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addDays('2023-03-01', -1), '2023-02-28');
  assert.equal(addDays('2026-10-27', 400), '2027-12-01'); // 365 ngày → 27/10/2027, thêm 35 ngày
  assert.equal(addDays('không phải ngày', 1), null);
});

test('formatDisplayDate: dd/MM/yyyy; đầu vào sai trả chuỗi rỗng', () => {
  assert.equal(formatDisplayDate('2026-10-27'), '27/10/2026');
  assert.equal(formatDisplayDate('2026-01-05'), '05/01/2026');
  assert.equal(formatDisplayDate('2026-02-30'), '');
  assert.equal(formatDisplayDate(''), '');
  assert.equal(formatDisplayDate(undefined), '');
});
