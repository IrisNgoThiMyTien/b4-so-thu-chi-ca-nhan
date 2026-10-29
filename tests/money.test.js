import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_AMOUNT, formatAmountInput, formatSignedVND, formatVND, groupDigits, parseAmountInput } from '../src/core/money.js';
import { plain } from './helpers.js';

test('formatVND: nhóm hàng nghìn bằng dấu chấm và đuôi " ₫"', () => {
  assert.equal(plain(formatVND(0)), '0 ₫');
  assert.equal(plain(formatVND(7)), '7 ₫');
  assert.equal(plain(formatVND(999)), '999 ₫');
  assert.equal(plain(formatVND(1000)), '1.000 ₫');
  assert.equal(plain(formatVND(45000)), '45.000 ₫');
  assert.equal(plain(formatVND(1250000)), '1.250.000 ₫');
  assert.equal(plain(formatVND(100000000)), '100.000.000 ₫');
  assert.equal(plain(formatVND(MAX_AMOUNT)), '999.999.999.999 ₫');
});

test('formatVND: dùng dấu cách không ngắt dòng trước ₫ (không bị rớt xuống dòng riêng)', () => {
  assert.equal(formatVND(1000), '1.000 ₫');
});

test('formatVND: số âm dùng dấu trừ thật (−), giá trị không hợp lệ trả chuỗi rỗng', () => {
  assert.equal(plain(formatVND(-5000)), '−5.000 ₫');
  for (const bad of [NaN, Infinity, 1.5, '1000', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(formatVND(bad), '', `formatVND(${String(bad)})`);
  }
});

test('formatSignedVND: thu có "+", chi có "−"', () => {
  assert.equal(plain(formatSignedVND('income', 500000)), '+500.000 ₫');
  assert.equal(plain(formatSignedVND('expense', 45000)), '−45.000 ₫');
  assert.equal(plain(formatSignedVND('expense', -45000)), '−45.000 ₫', 'luôn lấy trị tuyệt đối');
  assert.equal(formatSignedVND('expense', NaN), '');
});

test('groupDigits', () => {
  assert.equal(groupDigits('1'), '1');
  assert.equal(groupDigits('12'), '12');
  assert.equal(groupDigits('123'), '123');
  assert.equal(groupDigits('1234'), '1.234');
  assert.equal(groupDigits('123456'), '123.456');
  assert.equal(groupDigits('1234567'), '1.234.567');
  assert.equal(groupDigits(''), '');
});

test('parseAmountInput: bỏ ký tự lạ, số 0 đầu, và cắt tối đa 12 chữ số', () => {
  const cases = [
    ['', '', 0],
    [null, '', 0],
    [undefined, '', 0],
    ['abc', '', 0],
    ['0', '', 0],
    ['000', '', 0],
    ['007', '7', 7],
    ['45', '45', 45],
    ['45.000', '45000', 45000],
    ['45.000đ', '45000', 45000],
    ['1,250,000 ₫', '1250000', 1250000],
    ['  12 345 ', '12345', 12345],
    ['-500', '500', 500],
    ['1e5', '15', 15],
    ['１２３', '', 0], // chữ số full-width không được chấp nhận
    ['١٢٣', '', 0], // chữ số Ả Rập cũng không
    ['9'.repeat(12), '9'.repeat(12), MAX_AMOUNT],
    ['9'.repeat(20), '9'.repeat(12), MAX_AMOUNT],
    ['1234567890123456', '123456789012', 123456789012],
  ];
  for (const [raw, digits, value] of cases) {
    assert.deepEqual(parseAmountInput(raw), { digits, value }, `parseAmountInput(${JSON.stringify(raw)})`);
  }
});

test('parseAmountInput: không bao giờ vượt MAX_AMOUNT dù dán chuỗi rất dài', () => {
  for (const raw of ['9'.repeat(50), '1'.repeat(13), '0'.repeat(5) + '9'.repeat(13)]) {
    assert.ok(parseAmountInput(raw).value <= MAX_AMOUNT);
  }
});

test('formatAmountInput', () => {
  assert.equal(formatAmountInput(''), '');
  assert.equal(formatAmountInput('7'), '7');
  assert.equal(formatAmountInput('1234'), '1.234');
  assert.equal(formatAmountInput('1250000'), '1.250.000');
});
