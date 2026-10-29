import { win } from './dom-env.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mountHome } from '../src/ui/home.js';
import { makeClock, makeRepo, validInput } from './helpers.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const key = (target, k, init = {}) => {
  const e = new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};
const pointerdown = (target) => target.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));

const labelBtn = () => $('[data-action="open-month-picker"]');
const picker = () => $('[data-month-picker]');
const isOpen = () => !picker().hidden;
const cell = (ym) => $(`.mp__cell[data-month="${ym}"]`);
const year = () => $('.mp__year-label').textContent;
const monthLabel = () => $('.month-bar__text').textContent;

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
  document.body.replaceChildren();
});

function setup({ seed = [], now = makeClock(), initialMonth } = {}) {
  const { repo } = makeRepo({ now });
  for (const date of seed) repo.add(validInput({ date }));
  const home = mountHome({ repo, now, animate: false, initialMonth });
  cleanups.push(() => home.destroy());
  return { repo, home, now };
}

describe('Mở / đóng', () => {
  test('bấm tên tháng mở bộ chọn: hộp thoại có tên, nút có aria-expanded, focus vào tháng đang chọn', () => {
    setup();
    assert.equal(isOpen(), false);
    assert.equal(labelBtn().getAttribute('aria-expanded'), 'false');
    labelBtn().click();
    assert.equal(isOpen(), true);
    assert.equal(labelBtn().getAttribute('aria-expanded'), 'true');
    const dialog = $('.month-picker__panel');
    assert.equal(dialog.getAttribute('role'), 'dialog');
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.getAttribute('aria-label'), 'Chọn tháng');
    assert.equal(document.activeElement, cell('2026-10'));
  });

  test('bấm tên tháng lần nữa thì đóng (bật/tắt)', () => {
    setup();
    labelBtn().click();
    labelBtn().click();
    assert.equal(isOpen(), false);
    assert.equal(labelBtn().getAttribute('aria-expanded'), 'false');
  });

  test('Esc đóng và trả focus về tên tháng', () => {
    setup();
    labelBtn().click();
    key(document.activeElement, 'Escape');
    assert.equal(isOpen(), false);
    assert.equal(document.activeElement, labelBtn());
  });

  test('bấm ra ngoài hoặc vào nền mờ thì đóng; bấm bên trong thì không', () => {
    setup();
    labelBtn().click();
    pointerdown($('.mp__year-label'));
    pointerdown($('.mp__grid'));
    assert.equal(isOpen(), true);
    pointerdown($('.summary'));
    assert.equal(isOpen(), false);
    labelBtn().click();
    pointerdown($('.month-picker__scrim'));
    assert.equal(isOpen(), false);
  });

  test('mở – đóng – mở nhiều lần không nhân đôi trình nghe sự kiện hoặc phần tử', () => {
    setup();
    for (let i = 0; i < 4; i += 1) {
      labelBtn().click();
      assert.equal($$('[data-month-picker]').length, 1);
      assert.equal($$('.mp__cell').length, 12);
      key(document.activeElement, 'Escape');
    }
    assert.equal(isOpen(), false);
  });

  test('destroy của Trang chủ gỡ luôn bộ chọn (kể cả khi đang mở) và các trình nghe', () => {
    const { home } = setup();
    labelBtn().click();
    home.destroy();
    assert.equal($('[data-month-picker]'), null);
    assert.doesNotThrow(() => pointerdown(document.body));
  });
});

describe('Lưới tháng', () => {
  test('12 ô T1–T12 trong năm hiện tại, nhãn đọc đầy đủ', () => {
    setup();
    labelBtn().click();
    assert.equal(year(), '2026');
    assert.deepEqual($$('.mp__cell').map((c) => c.textContent), Array.from({ length: 12 }, (_, i) => `T${i + 1}`));
    assert.equal(cell('2026-03').getAttribute('aria-label'), 'Tháng 3 năm 2026');
  });

  test('trạng thái ô: đang chọn, tháng hiện tại, tương lai bị vô hiệu', () => {
    setup({ initialMonth: '2026-03' });
    labelBtn().click();
    assert.equal(cell('2026-03').getAttribute('aria-pressed'), 'true');
    assert.equal(cell('2026-10').getAttribute('aria-pressed'), 'false');
    assert.equal(cell('2026-10').getAttribute('aria-current'), 'date');
    assert.equal(cell('2026-03').hasAttribute('aria-current'), false);
    for (const m of ['11', '12']) assert.equal(cell(`2026-${m}`).disabled, true, m);
    for (const m of ['01', '09', '10']) assert.equal(cell(`2026-${m}`).disabled, false, m);
  });

  test('chấm "có dữ liệu" chỉ ở tháng có giao dịch, và có trong nhãn đọc', () => {
    setup({ seed: ['2026-02-10', '2026-10-01', '2025-12-31'] });
    labelBtn().click();
    assert.deepEqual($$('.mp__cell[data-has-data]').map((c) => c.dataset.month), ['2026-02', '2026-10']);
    assert.match(cell('2026-02').getAttribute('aria-label'), /có giao dịch/);
    assert.doesNotMatch(cell('2026-03').getAttribute('aria-label'), /có giao dịch/);
  });

  test('chọn một tháng: đổi tháng đang xem, đóng ngay, focus về tên tháng', () => {
    const { home } = setup();
    labelBtn().click();
    cell('2026-03').click();
    assert.equal(home.month.get(), '2026-03');
    assert.equal(monthLabel(), 'Tháng 3/2026');
    assert.equal(isOpen(), false);
    assert.equal(document.activeElement, labelBtn());
  });

  test('bấm tháng tương lai (bị vô hiệu) không làm gì', () => {
    const { home } = setup();
    labelBtn().click();
    cell('2026-12').click();
    assert.equal(home.month.get(), '2026-10');
    assert.equal(isOpen(), true);
  });

  test('chọn lại đúng tháng đang xem thì chỉ đóng', () => {
    const { home } = setup();
    let changes = 0;
    home.month.subscribe(() => (changes += 1));
    labelBtn().click();
    cell('2026-10').click();
    assert.equal(changes, 0);
    assert.equal(isOpen(), false);
  });
});

describe('Chọn năm', () => {
  test('không có dữ liệu cũ: ◀ năm bị vô hiệu (tối thiểu năm hiện tại), ▶ năm cũng vô hiệu', () => {
    setup();
    labelBtn().click();
    assert.equal($('[data-action="prev-year"]').disabled, true);
    assert.equal($('[data-action="next-year"]').disabled, true);
  });

  test('có giao dịch năm cũ: lùi được tới năm của giao dịch cũ nhất, không xa hơn', () => {
    setup({ seed: ['2024-06-01', '2026-10-01'] });
    labelBtn().click();
    const prev = $('[data-action="prev-year"]');
    assert.equal(prev.disabled, false);
    prev.click();
    assert.equal(year(), '2025');
    prev.click();
    assert.equal(year(), '2024');
    assert.equal(prev.disabled, true);
    prev.click();
    assert.equal(year(), '2024');
    assert.equal(cell('2024-06').hasAttribute('data-has-data'), true);
    assert.equal(cell('2024-12').disabled, false, 'năm cũ: không có tháng nào bị vô hiệu');
    $('[data-action="next-year"]').click();
    $('[data-action="next-year"]').click();
    assert.equal(year(), '2026');
    assert.equal($('[data-action="next-year"]').disabled, true);
  });

  test('chọn tháng ở năm khác', () => {
    const { home } = setup({ seed: ['2025-12-31'] });
    labelBtn().click();
    $('[data-action="prev-year"]').click();
    cell('2025-12').click();
    assert.equal(home.month.get(), '2025-12');
    assert.equal(monthLabel(), 'Tháng 12/2025');
  });

  test('đang xem tháng của năm xa hơn dữ liệu (đi bằng ◀): bộ chọn mở đúng năm đó và cho đi tiếp', () => {
    setup({ initialMonth: '2019-05' });
    labelBtn().click();
    assert.equal(year(), '2019');
    assert.equal($('[data-action="prev-year"]').disabled, true);
    assert.equal($('[data-action="next-year"]').disabled, false);
    assert.equal(cell('2019-05').getAttribute('aria-pressed'), 'true');
  });

  test('tháng nhỏ nhất 2000: không lùi tới năm 1999', () => {
    setup({ initialMonth: '2000-03' });
    labelBtn().click();
    assert.equal(year(), '2000');
    assert.equal($('[data-action="prev-year"]').disabled, true);
    assert.equal(cell('2000-01').disabled, false);
  });
});

describe('"Về tháng này"', () => {
  test('ẩn khi đang xem tháng hiện tại; hiện khi xem tháng khác và đưa về tháng hiện tại', () => {
    const { home } = setup({ initialMonth: '2026-04' });
    labelBtn().click();
    const btn = $('[data-action="this-month"]');
    assert.equal(btn.hidden, false);
    btn.click();
    assert.equal(home.month.get(), '2026-10');
    assert.equal(isOpen(), false);
    labelBtn().click();
    assert.equal($('[data-action="this-month"]').hidden, true);
  });

  test('từ năm cũ bấm "Về tháng này" quay lại năm hiện tại', () => {
    const { home } = setup({ initialMonth: '2024-03' });
    labelBtn().click();
    assert.equal(year(), '2024');
    $('[data-action="this-month"]').click();
    assert.equal(home.month.get(), '2026-10');
  });
});

describe('Bàn phím', () => {
  test('mũi tên trái/phải đổi ô, bỏ qua ô bị vô hiệu và dừng ở biên', () => {
    setup();
    labelBtn().click();
    const t10 = cell('2026-10');
    key(t10, 'ArrowRight'); // T11, T12 bị vô hiệu → ở yên
    assert.equal(document.activeElement, t10);
    key(t10, 'ArrowLeft');
    assert.equal(document.activeElement, cell('2026-09'));
    assert.equal(cell('2026-09').tabIndex, 0);
    assert.equal(cell('2026-10').tabIndex, -1);
    key(cell('2026-09'), 'ArrowRight');
    assert.equal(document.activeElement, cell('2026-10'));
  });

  test('mũi tên lên/xuống nhảy 3 ô; không nhảy vào ô bị vô hiệu hoặc ra ngoài lưới', () => {
    setup();
    labelBtn().click();
    key(cell('2026-10'), 'ArrowUp');
    assert.equal(document.activeElement, cell('2026-07'));
    key(cell('2026-07'), 'ArrowUp');
    key(document.activeElement, 'ArrowUp');
    assert.equal(document.activeElement, cell('2026-01'));
    key(cell('2026-01'), 'ArrowUp'); // đã ở hàng đầu
    assert.equal(document.activeElement, cell('2026-01'));
    key(cell('2026-07'), 'ArrowDown');
    key(cell('2026-01'), 'ArrowDown');
    assert.equal(document.activeElement, cell('2026-04'));
    key(cell('2026-07'), 'ArrowDown'); // T10 dùng được
    assert.equal(document.activeElement, cell('2026-10'));
    key(cell('2026-10'), 'ArrowDown'); // T13 không có
    assert.equal(document.activeElement, cell('2026-10'));
  });

  test('Tab bị giữ trong hộp thoại (xoay vòng)', () => {
    setup();
    labelBtn().click();
    const panel = $('.month-picker__panel');
    const items = $$('button:not(:disabled):not([hidden])', panel);
    const first = items[0];
    const last = items[items.length - 1];
    last.focus();
    assert.equal(key(last, 'Tab').defaultPrevented, true);
    assert.equal(document.activeElement, first);
    first.focus();
    assert.equal(key(first, 'Tab', { shiftKey: true }).defaultPrevented, true);
    assert.equal(document.activeElement, last);
  });

  test('chỉ một ô trong lưới là điểm dừng Tab (roving tabindex)', () => {
    setup();
    labelBtn().click();
    assert.equal($$('.mp__cell').filter((c) => c.tabIndex === 0).length, 1);
  });

  test('Esc trong bộ chọn không làm đóng thứ gì khác (không lan lên document)', () => {
    setup();
    let reached = 0;
    const spy = () => (reached += 1);
    document.addEventListener('keydown', spy);
    labelBtn().click();
    key(document.activeElement, 'Escape');
    document.removeEventListener('keydown', spy);
    assert.equal(reached, 0);
  });
});

describe('Đồng bộ với thanh tháng', () => {
  test('đổi tháng bằng ◀ rồi mở bộ chọn: phản ánh tháng mới và "Về tháng này" xuất hiện', () => {
    setup();
    $('[data-action="prev-month"]').click();
    labelBtn().click();
    assert.equal(cell('2026-09').getAttribute('aria-pressed'), 'true');
    assert.equal(document.activeElement, cell('2026-09'));
    assert.equal($('[data-action="this-month"]').hidden, false);
  });

  test('thêm giao dịch rồi mở lại: chấm dữ liệu cập nhật theo kho', () => {
    const { repo } = setup();
    labelBtn().click();
    assert.equal($$('.mp__cell[data-has-data]').length, 0);
    key(document.activeElement, 'Escape');
    repo.add(validInput({ date: '2026-05-05' }));
    labelBtn().click();
    assert.deepEqual($$('.mp__cell[data-has-data]').map((c) => c.dataset.month), ['2026-05']);
  });

  test('đặt vị trí popover (laptop) theo nút tên tháng bằng biến CSS', () => {
    setup();
    labelBtn().click();
    const root = $('[data-month-picker]');
    assert.ok(root.style.getPropertyValue('--mp-left').endsWith('px'));
    assert.ok(root.style.getPropertyValue('--mp-top').endsWith('px'));
  });
});
