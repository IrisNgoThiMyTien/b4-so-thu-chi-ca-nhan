import { win } from './dom-env.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mountEntryPage } from '../src/ui/entry-form.js';
import { createToastHost } from '../src/ui/toast.js';
import { STORAGE_KEY } from '../src/core/storage.js';
import { createDefaultData } from '../src/core/defaults.js';
import { MemoryBackend, makeClock, makeRepo, plain, validInput } from './helpers.js';

/* ---------- tiện ích ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function typeInto(input, value) {
  input.value = value;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
}
const key = (target, k, init = {}) => {
  const e = new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};
const amountInput = () => $('.amount__input');
const saveBtn = () => $('[data-action="save"]');
const catButton = (name) => $$('.cat[role="radio"]').find((b) => $('.cat__name', b).textContent === name);
const walletButton = (name) => $$('.chip--wallet').find((b) => b.textContent === name);
const segment = (value) => $(`.segmented__btn[data-value="${value}"]`);
const visibleErrors = () => $$('.field-error').filter((e) => !e.hidden).map((e) => e.textContent);
const isChecked = (b) => b.getAttribute('aria-checked') === 'true';
const saveDisabled = () => saveBtn().getAttribute('aria-disabled') === 'true';
const confirmBox = () => $('.confirm');

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
  document.body.replaceChildren();
  document.documentElement.className = '';
});

function setup({ backend = new MemoryBackend(), now = makeClock(), seed, mount = {}, transactionId } = {}) {
  const { repo } = makeRepo({ backend, now });
  const seeded = seed ? repo.add(seed).transaction : null;
  const calls = { saved: [], deleted: [], restored: [], closed: 0 };
  const toast = createToastHost();
  const opener = document.createElement('button');
  opener.textContent = 'Mở';
  document.body.append(opener);
  opener.focus();
  const page = mountEntryPage({
    repo,
    now,
    toast,
    animate: false,
    transactionId: transactionId ?? (seeded ? seeded.id : null),
    onSaved: (tx, mode) => calls.saved.push([tx, mode]),
    onDeleted: (tx) => calls.deleted.push(tx),
    onRestored: (tx) => calls.restored.push(tx),
    onClose: () => {
      calls.closed += 1;
    },
    ...mount,
  });
  cleanups.push(() => page.destroy(), () => toast.destroy());
  return { repo, backend, now, calls, page, toast, seeded, opener };
}

function fillValid(overrides = {}) {
  typeInto(amountInput(), overrides.amount ?? '45000');
  catButton(overrides.category ?? 'Ăn uống').click();
}

/* ================================================================== */
describe('Thêm giao dịch – hiển thị ban đầu', () => {
  test('bố cục và giá trị mặc định đúng DESIGN/PRD', () => {
    const { page } = setup();
    const shell = $('.entry');
    assert.equal(shell.getAttribute('role'), 'dialog');
    assert.equal(shell.getAttribute('aria-modal'), 'true');
    assert.equal($('h1', shell).textContent, 'Thêm khoản');
    assert.equal(shell.dataset.type, 'expense');
    assert.equal(isChecked(segment('expense')), true);
    assert.equal(isChecked(segment('income')), false);
    assert.deepEqual($$('.cat[role="radio"]').map((b) => $('.cat__name', b).textContent), ['Ăn uống', 'Di chuyển', 'Nhà ở', 'Mua sắm', 'Giải trí', 'Sức khoẻ', 'Học tập', 'Khác']);
    assert.equal($$('.cat[role="radio"]').filter(isChecked).length, 0);
    assert.deepEqual($$('.chip--wallet').map((b) => b.textContent), ['Tiền mặt', 'Ngân hàng', 'Ví điện tử']);
    assert.equal(isChecked(walletButton('Tiền mặt')), true);
    const date = $('input[type="date"]');
    assert.equal(date.value, '2026-10-27');
    assert.equal(date.max, '2026-10-27');
    assert.equal(date.min, '2000-01-01');
    assert.equal(amountInput().value, '');
    assert.equal(amountInput().getAttribute('inputmode'), 'numeric');
    assert.equal($('[data-action="delete"]'), null, 'chế độ thêm không có nút Xoá');
    assert.equal(saveDisabled(), true);
    assert.deepEqual(visibleErrors(), []);
    assert.ok(document.documentElement.classList.contains('has-entry-open'));
    assert.equal(page.isDirty(), false);
  });

  test('số tiền được focus ngay khi mở (bàn phím số bật lên)', () => {
    setup();
    assert.equal(document.activeElement, amountInput());
  });

  test('có thể mở sẵn ở loại "Thu"', () => {
    setup({ mount: { initialType: 'income' } });
    assert.equal($('.entry').dataset.type, 'income');
    assert.deepEqual($$('.cat[role="radio"]').map((b) => $('.cat__name', b).textContent), ['Lương', 'Thưởng', 'Làm thêm', 'Khác']);
  });

  test('loại khởi tạo lạ rơi về "Chi"', () => {
    setup({ mount: { initialType: 'transfer' } });
    assert.equal($('.entry').dataset.type, 'expense');
  });
});

/* ================================================================== */
describe('Ô số tiền', () => {
  test('tự thêm dấu chấm ngăn cách hàng nghìn khi gõ', () => {
    setup();
    const input = amountInput();
    for (const [typed, shown] of [['1', '1'], ['12', '12'], ['123', '123'], ['1234', '1.234'], ['1250000', '1.250.000']]) {
      typeInto(input, typed);
      assert.equal(input.value, shown);
    }
  });

  test('gõ tiếp vào chuỗi đã có dấu chấm vẫn đúng (mô phỏng gõ từng phím)', () => {
    setup();
    const input = amountInput();
    let text = '';
    for (const ch of '1250000') {
      typeInto(input, input.value + ch);
      text = input.value;
    }
    assert.equal(text, '1.250.000');
  });

  test('chặn ký tự không phải số, số 0 đầu; dán "45.000đ" ra "45.000"', () => {
    setup();
    const input = amountInput();
    typeInto(input, 'abc');
    assert.equal(input.value, '');
    typeInto(input, '000');
    assert.equal(input.value, '');
    typeInto(input, '007');
    assert.equal(input.value, '7');
    typeInto(input, '45.000đ');
    assert.equal(input.value, '45.000');
    typeInto(input, '-12,5');
    assert.equal(input.value, '125');
  });

  test('không cho vượt 12 chữ số (999.999.999.999 ₫)', () => {
    setup();
    typeInto(amountInput(), '9'.repeat(30));
    assert.equal(amountInput().value, '999.999.999.999');
  });

  test('xoá hết thì quay về rỗng và Lưu bị vô hiệu lại', () => {
    setup();
    fillValid();
    assert.equal(saveDisabled(), false);
    typeInto(amountInput(), '');
    assert.equal(amountInput().value, '');
    assert.equal(saveDisabled(), true);
  });

  test('thuộc tính data-has-amount bật/tắt theo nội dung (để CSS tô màu thu/chi)', () => {
    setup();
    const shell = $('.entry');
    assert.equal(shell.hasAttribute('data-has-amount'), false);
    typeInto(amountInput(), '5');
    assert.equal(shell.hasAttribute('data-has-amount'), true);
    typeInto(amountInput(), '');
    assert.equal(shell.hasAttribute('data-has-amount'), false);
  });
});

/* ================================================================== */
describe('Chi | Thu và danh mục', () => {
  test('đổi loại → đổi danh sách danh mục và bỏ chọn danh mục cũ', () => {
    setup();
    catButton('Ăn uống').click();
    segment('income').click();
    assert.equal($('.entry').dataset.type, 'income');
    assert.deepEqual($$('.cat[role="radio"]').map((b) => $('.cat__name', b).textContent), ['Lương', 'Thưởng', 'Làm thêm', 'Khác']);
    assert.equal($$('.cat[role="radio"]').filter(isChecked).length, 0);
    assert.equal(isChecked(segment('income')), true);
    assert.equal(isChecked(segment('expense')), false);
  });

  test('bật qua bật lại Chi/Thu thì nhớ danh mục đã chọn cho từng loại', () => {
    setup();
    catButton('Mua sắm').click();
    segment('income').click();
    catButton('Lương').click();
    segment('expense').click();
    assert.equal(isChecked(catButton('Mua sắm')), true);
    segment('income').click();
    assert.equal(isChecked(catButton('Lương')), true);
  });

  test('chọn danh mục: chỉ một ô được chọn tại một thời điểm', () => {
    setup();
    catButton('Ăn uống').click();
    catButton('Nhà ở').click();
    assert.deepEqual($$('.cat[role="radio"]').filter(isChecked).map((b) => $('.cat__name', b).textContent), ['Nhà ở']);
  });

  test('roving tabindex: nhóm danh mục chỉ có 1 điểm dừng Tab', () => {
    setup();
    assert.equal($$('.cat[role="radio"]').filter((b) => b.tabIndex === 0).length, 1);
    catButton('Học tập').click();
    assert.deepEqual($$('.cat[role="radio"]').filter((b) => b.tabIndex === 0).map((b) => $('.cat__name', b).textContent), ['Học tập']);
  });

  test('phím mũi tên đổi Chi/Thu và di chuyển + chọn danh mục', () => {
    setup();
    key(segment('expense'), 'ArrowRight');
    assert.equal(isChecked(segment('income')), true);
    key(segment('income'), 'ArrowLeft');
    assert.equal(isChecked(segment('expense')), true);

    const first = $$('.cat[role="radio"]')[0];
    first.focus();
    key(first, 'ArrowRight');
    assert.equal(isChecked(catButton('Di chuyển')), true);
    key(catButton('Di chuyển'), 'ArrowLeft');
    assert.equal(isChecked(catButton('Ăn uống')), true);
    key(catButton('Ăn uống'), 'ArrowLeft'); // vòng về cuối danh sách
    assert.equal(isChecked(catButton('Khác')), true);
  });

  test('ô "＋ Thêm" chỉ xuất hiện khi host cung cấp onAddCategory, và gọi đúng hàm', () => {
    setup();
    assert.equal($('[data-action="add-category"]'), null);
    document.body.replaceChildren();
    let called = 0;
    setup({ mount: { onAddCategory: () => (called += 1) } });
    const add = $('[data-action="add-category"]');
    assert.ok(add);
    assert.equal(add.getAttribute('role'), null, 'không nằm trong nhóm radio');
    add.click();
    assert.equal(called, 1);
    assert.equal($$('.cat[role="radio"]').length, 8);
  });
});

/* ================================================================== */
describe('Ví và ngày', () => {
  test('chọn ví chỉ một lựa chọn', () => {
    setup();
    walletButton('Ngân hàng').click();
    assert.deepEqual($$('.chip--wallet').filter(isChecked).map((b) => b.textContent), ['Ngân hàng']);
  });

  test('ví mặc định là ví dùng lần trước', () => {
    const backend = new MemoryBackend();
    setup({ backend });
    fillValid();
    walletButton('Ví điện tử').click();
    saveBtn().click();
    document.body.replaceChildren();
    setup({ backend });
    assert.equal(isChecked(walletButton('Ví điện tử')), true);
  });

  test('nút nhanh "Hôm nay" / "Hôm qua" và trạng thái nhấn', () => {
    setup();
    const date = $('input[type="date"]');
    const today = $('[data-quick-date="today"]');
    const yesterday = $('[data-quick-date="yesterday"]');
    assert.equal(today.getAttribute('aria-pressed'), 'true');
    assert.equal(yesterday.getAttribute('aria-pressed'), 'false');
    yesterday.click();
    assert.equal(date.value, '2026-10-26');
    assert.equal(today.getAttribute('aria-pressed'), 'false');
    assert.equal(yesterday.getAttribute('aria-pressed'), 'true');
    today.click();
    assert.equal(date.value, '2026-10-27');
    typeInto(date, '2026-10-01');
    assert.equal(today.getAttribute('aria-pressed'), 'false');
    assert.equal(yesterday.getAttribute('aria-pressed'), 'false');
  });

  test('"Hôm qua" qua ranh giới tháng/năm', () => {
    setup({ now: makeClock(2026, 0, 1) });
    $('[data-quick-date="yesterday"]').click();
    assert.equal($('input[type="date"]').value, '2025-12-31');
  });
});

/* ================================================================== */
describe('Ghi chú', () => {
  test('bộ đếm chỉ hiện khi còn < 20 ký tự; ô có maxlength 120', () => {
    setup();
    const note = $('#' + $('label[for]', $('.field__label-row')).getAttribute('for'));
    assert.equal(note.getAttribute('maxlength'), '120');
    const counter = $('.field__counter');
    typeInto(note, 'a'.repeat(100));
    assert.equal(counter.hidden, true);
    typeInto(note, 'a'.repeat(101));
    assert.equal(counter.hidden, false);
    assert.equal(counter.textContent, '101/120');
    typeInto(note, 'a'.repeat(120));
    assert.equal(counter.textContent, '120/120');
    typeInto(note, '');
    assert.equal(counter.hidden, true);
  });

  test('ghi chú dài hơn 120 (bỏ qua maxlength) vẫn bị chặn khi lưu', () => {
    const { repo } = setup();
    fillValid();
    typeInto($('.field__label-row + input'), 'x'.repeat(130));
    saveBtn().click();
    assert.deepEqual(visibleErrors(), ['Ghi chú tối đa 120 ký tự']);
    assert.equal(repo.count(), 0);
  });

  test('ghi chú chứa HTML được lưu nguyên văn và không bao giờ chèn thành phần tử', () => {
    const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
    const backend = new MemoryBackend();
    const { repo } = setup({ backend });
    fillValid();
    typeInto($('.field__label-row + input'), payload);
    saveBtn().click();
    const saved = repo.listByMonth('2026-10')[0];
    assert.equal(saved.note, payload);
    document.body.replaceChildren();
    setup({ backend, transactionId: saved.id }); // mở lại ở chế độ sửa: ghi chú được điền vào ô nhập
    assert.equal($('.field__label-row + input').value, payload);
    assert.equal($('img'), null);
    assert.equal($('script'), null);
    assert.equal(win.__xss, undefined);
  });

  test('ghi chú có xuống dòng/dấu cách thừa được chuẩn hoá khi lưu', () => {
    const { repo } = setup();
    fillValid();
    typeInto($('.field__label-row + input'), '  ăn trưa\n  ');
    saveBtn().click();
    assert.equal(repo.listByMonth('2026-10')[0].note, 'ăn trưa');
  });
});

/* ================================================================== */
describe('Lưu giao dịch mới', () => {
  test('luồng nhanh nhất: nhập số tiền + chọn danh mục + Lưu (không cần đụng ví/ngày)', () => {
    const { repo, calls, toast } = setup();
    typeInto(amountInput(), '45000');
    catButton('Ăn uống').click();
    assert.equal(saveDisabled(), false);
    saveBtn().click();
    assert.equal(repo.count(), 1);
    const tx = repo.listByMonth('2026-10')[0];
    assert.deepEqual(
      { type: tx.type, amount: tx.amount, categoryId: tx.categoryId, walletId: tx.walletId, date: tx.date, note: tx.note },
      { type: 'expense', amount: 45000, categoryId: 'cat-expense-food', walletId: 'wallet-cash', date: '2026-10-27', note: '' },
    );
    assert.equal(calls.saved.length, 1);
    assert.equal(calls.saved[0][1], 'add');
    assert.deepEqual(calls.saved[0][0], tx);
    assert.equal(plain($('.toast__text', toast.element).textContent), 'Đã lưu khoản chi 45.000 ₫');
    assert.equal($('.entry-overlay'), null, 'trang đóng sau khi lưu');
    assert.equal(document.documentElement.classList.contains('has-entry-open'), false);
    assert.equal(calls.closed, 0, 'lưu xong không gọi onClose');
  });

  test('khoản thu: loại, ví, ngày "hôm qua", ghi chú và thông báo "khoản thu"', () => {
    const { repo, toast } = setup();
    segment('income').click();
    typeInto(amountInput(), '15000000');
    catButton('Lương').click();
    walletButton('Ngân hàng').click();
    $('[data-quick-date="yesterday"]').click();
    typeInto($('.field__label-row + input'), 'Lương tháng 10');
    saveBtn().click();
    const tx = repo.listByMonth('2026-10')[0];
    assert.deepEqual(
      { type: tx.type, amount: tx.amount, categoryId: tx.categoryId, walletId: tx.walletId, date: tx.date, note: tx.note },
      { type: 'income', amount: 15000000, categoryId: 'cat-income-salary', walletId: 'wallet-bank', date: '2026-10-26', note: 'Lương tháng 10' },
    );
    assert.equal(plain($('.toast__text', toast.element).textContent), 'Đã lưu khoản thu 15.000.000 ₫');
  });

  test('số tiền lớn nhất 999.999.999.999 lưu được', () => {
    const { repo } = setup();
    fillValid({ amount: '9'.repeat(12) });
    saveBtn().click();
    assert.equal(repo.listByMonth('2026-10')[0].amount, 999_999_999_999);
  });

  test('bấm Lưu hai lần liên tiếp chỉ tạo một giao dịch', () => {
    const { repo, calls } = setup();
    fillValid();
    saveBtn().click();
    saveBtn()?.click();
    assert.equal(repo.count(), 1);
    assert.equal(calls.saved.length, 1);
  });

  test('Enter trong form (sự kiện submit) cũng lưu, đúng một lần', () => {
    const { repo } = setup();
    fillValid();
    $('form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(repo.count(), 1);
  });

  test('qua nửa đêm khi đang mở: ngày đã chọn (hôm qua) vẫn hợp lệ, "Hôm nay" nhảy sang ngày mới', () => {
    const now = makeClock(2026, 9, 27, 23, 59);
    const { repo } = setup({ now });
    fillValid();
    now.set(2026, 9, 28, 0, 1);
    $('[data-quick-date="today"]').click();
    assert.equal($('input[type="date"]').value, '2026-10-28');
    saveBtn().click();
    assert.equal(repo.listByMonth('2026-10')[0].date, '2026-10-28');
  });

  test('qua nửa đêm: ngày mặc định cũ vẫn lưu được', () => {
    const now = makeClock(2026, 9, 27, 23, 59);
    const { repo } = setup({ now });
    fillValid();
    now.set(2026, 9, 28, 0, 1);
    saveBtn().click();
    assert.equal(repo.listByMonth('2026-10')[0].date, '2026-10-27');
  });
});

/* ================================================================== */
describe('Kiểm tra dữ liệu nhập (F5)', () => {
  test('Lưu khi còn trống: không lưu, hiện lỗi tại từng ô, focus vào ô số tiền', () => {
    const { repo, calls } = setup();
    saveBtn().click();
    assert.equal(repo.count(), 0);
    assert.equal(calls.saved.length, 0);
    assert.deepEqual(visibleErrors(), ['Nhập số tiền lớn hơn 0', 'Chọn danh mục']);
    assert.equal(amountInput().getAttribute('aria-invalid'), 'true');
    assert.equal($('.cat-grid').getAttribute('aria-invalid'), 'true');
    assert.equal(document.activeElement, amountInput());
    assert.ok($('.entry').hasAttribute('data-amount-invalid'));
  });

  test('trước lần bấm Lưu đầu tiên chưa hiện lỗi dù dữ liệu đang sai', () => {
    setup();
    typeInto(amountInput(), '5');
    typeInto(amountInput(), '');
    assert.deepEqual(visibleErrors(), []);
    assert.equal(amountInput().getAttribute('aria-invalid'), 'false');
  });

  test('sau khi sửa đúng, lỗi biến mất ngay từng ô', () => {
    setup();
    saveBtn().click();
    typeInto(amountInput(), '1000');
    assert.deepEqual(visibleErrors(), ['Chọn danh mục']);
    assert.equal(amountInput().getAttribute('aria-invalid'), 'false');
    catButton('Khác').click();
    assert.deepEqual(visibleErrors(), []);
    assert.equal(saveDisabled(), false);
    assert.equal($('.entry').hasAttribute('data-amount-invalid'), false);
  });

  test('thiếu danh mục (đã có số tiền): focus nhảy vào danh mục', () => {
    setup();
    typeInto(amountInput(), '1000');
    saveBtn().click();
    assert.deepEqual(visibleErrors(), ['Chọn danh mục']);
    assert.equal(document.activeElement.getAttribute('role'), 'radio');
    assert.ok(document.activeElement.closest('.cat-grid'));
  });

  test('đổi sang Thu làm mất danh mục → lại báo "Chọn danh mục"', () => {
    setup();
    fillValid();
    segment('income').click();
    assert.equal(saveDisabled(), true);
    saveBtn().click();
    assert.deepEqual(visibleErrors(), ['Chọn danh mục']);
  });

  test('ngày ở tương lai bị chặn, focus vào ô ngày', () => {
    const { repo } = setup();
    fillValid();
    typeInto($('input[type="date"]'), '2026-10-28');
    saveBtn().click();
    assert.deepEqual(visibleErrors(), ['Ngày không được ở tương lai']);
    assert.equal(document.activeElement, $('input[type="date"]'));
    assert.equal(repo.count(), 0);
  });

  test('ngày để trống hoặc quá cũ bị chặn', () => {
    const { repo } = setup();
    fillValid();
    typeInto($('input[type="date"]'), '');
    saveBtn().click();
    assert.deepEqual(visibleErrors(), ['Chọn ngày hợp lệ']);
    typeInto($('input[type="date"]'), '1999-12-31');
    assert.deepEqual(visibleErrors(), ['Ngày quá xa (từ năm 2000 trở đi)']);
    assert.equal(repo.count(), 0);
  });

  test('thông báo lỗi được liên kết với ô nhập qua aria-describedby', () => {
    setup();
    saveBtn().click();
    const describedBy = amountInput().getAttribute('aria-describedby');
    assert.equal($('#' + describedBy).textContent, 'Nhập số tiền lớn hơn 0');
  });
});

/* ================================================================== */
describe('Sửa giao dịch', () => {
  const seed = validInput({ amount: 45000, note: 'Cà phê', date: '2026-10-25', walletId: 'wallet-bank' });

  test('điền sẵn dữ liệu, có nút Xoá, tiêu đề "Sửa khoản", Lưu vô hiệu khi chưa đổi', () => {
    setup({ seed });
    assert.equal($('h1').textContent, 'Sửa khoản');
    assert.equal(amountInput().value, '45.000');
    assert.equal(isChecked(catButton('Ăn uống')), true);
    assert.equal(isChecked(walletButton('Ngân hàng')), true);
    assert.equal($('input[type="date"]').value, '2026-10-25');
    assert.equal($('.field__label-row + input').value, 'Cà phê');
    assert.ok($('[data-action="delete"]'));
    assert.equal(saveDisabled(), true);
    assert.equal($('.entry').dataset.mode, 'edit');
  });

  test('bấm Lưu khi chưa đổi gì: không ghi, không đóng', () => {
    const { repo, calls, seeded } = setup({ seed });
    saveBtn().click();
    assert.equal(calls.saved.length, 0);
    assert.ok($('.entry'));
    assert.equal(repo.getTransaction(seeded.id).updatedAt, seeded.updatedAt);
  });

  test('đổi số tiền → Lưu bật; lưu giữ nguyên id & createdAt; gọi onSaved(…, "edit")', () => {
    const now = makeClock();
    const { repo, calls, seeded } = setup({ seed, now });
    now.advance(120_000);
    typeInto(amountInput(), '50000');
    assert.equal(saveDisabled(), false);
    saveBtn().click();
    const after = repo.getTransaction(seeded.id);
    assert.equal(after.amount, 50000);
    assert.equal(after.createdAt, seeded.createdAt);
    assert.notEqual(after.updatedAt, seeded.updatedAt);
    assert.equal(repo.count(), 1);
    assert.equal(calls.saved[0][1], 'edit');
    assert.equal(calls.saved[0][0].id, seeded.id);
  });

  test('sửa rồi trả về giá trị cũ thì Lưu lại bị vô hiệu (không còn thay đổi)', () => {
    setup({ seed });
    typeInto(amountInput(), '50000');
    assert.equal(saveDisabled(), false);
    typeInto(amountInput(), '45000');
    assert.equal(saveDisabled(), true);
  });

  test('đổi chỉ ghi chú, ví, ngày cũng tính là thay đổi', () => {
    setup({ seed });
    walletButton('Tiền mặt').click();
    assert.equal(saveDisabled(), false);
    walletButton('Ngân hàng').click();
    assert.equal(saveDisabled(), true);
    typeInto($('.field__label-row + input'), 'Cà phê sữa');
    assert.equal(saveDisabled(), false);
    typeInto($('.field__label-row + input'), 'Cà phê');
    assert.equal(saveDisabled(), true);
    $('[data-quick-date="today"]').click();
    assert.equal(saveDisabled(), false);
  });

  test('ghi chú chỉ khác khoảng trắng hai đầu không tính là thay đổi', () => {
    setup({ seed });
    typeInto($('.field__label-row + input'), '  Cà phê  ');
    assert.equal(saveDisabled(), true);
  });

  test('đổi Chi → Thu phải chọn lại danh mục rồi mới lưu được', () => {
    const { repo, seeded } = setup({ seed });
    segment('income').click();
    assert.equal(saveDisabled(), true);
    catButton('Thưởng').click();
    assert.equal(saveDisabled(), false);
    saveBtn().click();
    const after = repo.getTransaction(seeded.id);
    assert.equal(after.type, 'income');
    assert.equal(after.categoryId, 'cat-income-bonus');
  });

  test('đổi Chi → Thu → Chi lại thì danh mục cũ được khôi phục và không còn "thay đổi"', () => {
    const { page } = setup({ seed });
    segment('income').click();
    segment('expense').click();
    assert.equal(isChecked(catButton('Ăn uống')), true);
    assert.equal(page.isDirty(), false);
    assert.equal(saveDisabled(), true);
  });

  test('khoản đã bị xoá ở nơi khác khi đang sửa → báo lỗi, không lưu, không đóng', () => {
    const { repo, calls, seeded } = setup({ seed });
    repo.remove(seeded.id);
    typeInto(amountInput(), '99000');
    saveBtn().click();
    assert.equal($('.banner').hidden, false);
    assert.match($('.banner').textContent, /không còn tồn tại/);
    assert.equal(calls.saved.length, 0);
    assert.ok($('.entry'));
    assert.equal(repo.count(), 0);
  });

  test('mở khoản không tồn tại → thông báo và nút Đóng gọi onClose', () => {
    const { calls } = setup({ transactionId: 'khong-co' });
    assert.match($('.empty-note').textContent, /Không tìm thấy khoản này/);
    assert.equal($('form'), null);
    $('[data-action="close-missing"]').click();
    assert.equal(calls.closed, 1);
    assert.equal($('.entry-overlay'), null);
  });
});

/* ================================================================== */
describe('Xoá giao dịch và hoàn tác', () => {
  const seed = validInput();

  test('bấm Xoá → hộp xác nhận (focus ở nút Huỷ); Huỷ thì không xoá', async () => {
    const { repo, calls, seeded } = setup({ seed });
    $('[data-action="delete"]').focus();
    $('[data-action="delete"]').click();
    const box = confirmBox();
    assert.ok(box);
    assert.equal(box.getAttribute('role'), 'alertdialog');
    assert.equal($('.confirm__title').textContent, 'Xoá khoản này?');
    assert.equal(document.activeElement.textContent, 'Huỷ');
    $('.confirm__actions .btn--secondary').click();
    await flush();
    assert.equal(confirmBox(), null);
    assert.ok(repo.getTransaction(seeded.id));
    assert.ok($('.entry'), 'trang vẫn mở');
    assert.equal(calls.deleted.length, 0);
    assert.equal(document.activeElement, $('[data-action="delete"]'), 'focus trả về nút Xoá');
  });

  test('Esc trên hộp xác nhận chỉ đóng hộp xác nhận, không đóng trang', async () => {
    const { repo, calls, seeded } = setup({ seed });
    $('[data-action="delete"]').click();
    key(document.activeElement, 'Escape');
    await flush();
    assert.equal(confirmBox(), null);
    assert.ok($('.entry'));
    assert.equal(calls.closed, 0);
    assert.ok(repo.getTransaction(seeded.id));
  });

  test('xác nhận Xoá → mất khỏi kho, onDeleted, toast "Đã xoá · Hoàn tác", trang đóng', async () => {
    const { repo, calls, toast, seeded } = setup({ seed });
    $('[data-action="delete"]').click();
    $('.confirm__actions .btn--danger').click();
    await flush();
    assert.equal(repo.getTransaction(seeded.id), null);
    assert.equal(repo.count(), 0);
    assert.deepEqual(calls.deleted, [seeded]);
    assert.equal($('.toast__text', toast.element).textContent, 'Đã xoá');
    assert.equal($('.toast__action', toast.element).textContent, 'Hoàn tác');
    assert.equal($('.entry-overlay'), null);
    assert.equal(calls.closed, 0);
  });

  test('Hoàn tác khôi phục đúng bản ghi (cùng id, cùng dữ liệu) và gọi onRestored', async () => {
    const { repo, calls, toast, seeded } = setup({ seed });
    $('[data-action="delete"]').click();
    $('.confirm__actions .btn--danger').click();
    await flush();
    $('.toast__action', toast.element).click();
    assert.deepEqual(repo.getTransaction(seeded.id), seeded);
    assert.equal(calls.restored.length, 1);
    assert.equal($('.toast__text', toast.element).textContent, 'Đã khôi phục khoản này');
    assert.equal($('.toast__action', toast.element), null);
  });

  test('Hoàn tác khi ghi lỗi → báo "Không thể hoàn tác", dữ liệu không đổi', async () => {
    const { repo, backend, toast } = setup({ seed });
    $('[data-action="delete"]').click();
    $('.confirm__actions .btn--danger').click();
    await flush();
    backend.failWrites = 'quota';
    $('.toast__action', toast.element).click();
    assert.equal($('.toast__text', toast.element).textContent, 'Không thể hoàn tác');
    assert.equal(repo.count(), 0);
  });

  test('toast tự biến mất sau thời gian quy định', async () => {
    const { toast } = setup({ seed });
    toast.show({ message: 'x', duration: 20 });
    assert.ok($('.toast', toast.element));
    await sleep(60);
    assert.equal($('.toast', toast.element), null);
  });

  test('xoá thất bại do hết dung lượng: giữ nguyên trang, hiện biểu ngữ lỗi, không mất khoản', async () => {
    const { repo, backend, calls, seeded } = setup({ seed });
    backend.failWrites = 'quota';
    $('[data-action="delete"]').click();
    $('.confirm__actions .btn--danger').click();
    await flush();
    assert.ok(repo.getTransaction(seeded.id));
    assert.equal($('.banner').hidden, false);
    assert.equal(calls.deleted.length, 0);
    assert.ok($('.entry'));
  });

  test('không thể mở hai hộp xác nhận cùng lúc', () => {
    setup({ seed });
    $('[data-action="delete"]').click();
    $('[data-action="delete"]').click();
    assert.equal($$('.confirm').length, 1);
  });
});

/* ================================================================== */
describe('Đóng trang và thay đổi chưa lưu', () => {
  test('đóng khi chưa đổi gì: đóng ngay, onClose, không hỏi', () => {
    const { calls, repo } = setup();
    $('[data-action="close"]').click();
    assert.equal(confirmBox(), null);
    assert.equal(calls.closed, 1);
    assert.equal($('.entry-overlay'), null);
    assert.equal(repo.count(), 0);
  });

  test('đóng khi đã nhập dở: hỏi "Bỏ thay đổi?"; "Tiếp tục sửa" giữ nguyên dữ liệu', async () => {
    const { calls } = setup();
    typeInto(amountInput(), '12000');
    catButton('Giải trí').click();
    $('[data-action="close"]').click();
    assert.equal($('.confirm__title').textContent, 'Bỏ thay đổi?');
    assert.deepEqual($$('.confirm__actions .btn').map((b) => b.textContent), ['Tiếp tục sửa', 'Bỏ']);
    $('.confirm__actions .btn--secondary').click();
    await flush();
    assert.equal(calls.closed, 0);
    assert.equal(amountInput().value, '12.000');
    assert.equal(isChecked(catButton('Giải trí')), true);
  });

  test('"Bỏ" → đóng, onClose, không lưu gì', async () => {
    const { calls, repo } = setup();
    typeInto(amountInput(), '12000');
    $('[data-action="close"]').click();
    $('.confirm__actions .btn--danger').click();
    await flush();
    assert.equal(calls.closed, 1);
    assert.equal($('.entry-overlay'), null);
    assert.equal(repo.count(), 0);
    assert.equal(calls.saved.length, 0);
  });

  test('chỉ đổi loại Chi→Thu cũng tính là thay đổi chưa lưu', () => {
    setup();
    segment('income').click();
    $('[data-action="close"]').click();
    assert.ok(confirmBox());
  });

  test('phím Esc: đóng ngay khi sạch', () => {
    const { calls } = setup();
    key(document, 'Escape');
    assert.equal(calls.closed, 1);
  });

  test('phím Esc: khi đã nhập dở thì hỏi trước; Esc lần hai (trên hộp xác nhận) chỉ đóng hộp', async () => {
    const { calls } = setup();
    typeInto(amountInput(), '5');
    key(document, 'Escape');
    assert.ok(confirmBox());
    key(document.activeElement, 'Escape');
    await flush();
    assert.equal(confirmBox(), null);
    assert.equal(calls.closed, 0);
    assert.ok($('.entry'));
  });

  test('bấm ra ngoài hộp thoại (laptop) = yêu cầu đóng; bấm bên trong thì không', () => {
    const { calls } = setup();
    $('.entry').dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
    assert.equal(calls.closed, 0);
    $('.entry-overlay').dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
    assert.equal(calls.closed, 1);
  });

  test('sau khi đóng, Esc không còn tác dụng (đã gỡ trình nghe sự kiện)', () => {
    const { calls } = setup();
    $('[data-action="close"]').click();
    key(document, 'Escape');
    key(document, 'Escape');
    assert.equal(calls.closed, 1);
  });

  test('destroy() từ bên ngoài đóng luôn cả hộp xác nhận đang mở; gọi nhiều lần không lỗi', () => {
    const { page, calls } = setup();
    typeInto(amountInput(), '5');
    $('[data-action="close"]').click();
    assert.ok(confirmBox());
    page.destroy();
    page.destroy();
    assert.equal(confirmBox(), null);
    assert.equal($('.entry-overlay'), null);
    assert.equal(calls.closed, 0);
    assert.equal(document.documentElement.classList.contains('has-entry-open'), false);
  });

  test('có hiệu ứng đóng: giữ lớp is-leaving rồi mới gỡ khỏi DOM', async () => {
    const { calls } = setup({ mount: { animate: true } });
    $('[data-action="close"]').click();
    assert.equal(calls.closed, 1, 'onClose gọi ngay để host cập nhật');
    assert.ok($('.entry-overlay.is-leaving'));
    await sleep(400);
    assert.equal($('.entry-overlay'), null);
    assert.equal(document.documentElement.classList.contains('has-entry-open'), false);
  });
});

/* ================================================================== */
describe('Lỗi lưu trữ (DESIGN §9.2)', () => {
  const BANNER = 'Không thể lưu dữ liệu. Hãy xuất bản sao lưu hoặc giải phóng bộ nhớ.';

  test('hết dung lượng: hiện biểu ngữ, giữ nguyên dữ liệu đang nhập, không đóng; thử lại được', () => {
    const { repo, backend, calls } = setup();
    fillValid();
    typeInto($('.field__label-row + input'), 'giữ lại nhé');
    backend.failWrites = 'quota';
    saveBtn().click();
    const banner = $('.banner');
    assert.equal(banner.hidden, false);
    assert.equal(banner.textContent, BANNER);
    assert.equal(banner.getAttribute('role'), 'alert');
    assert.equal(calls.saved.length, 0);
    assert.equal(repo.count(), 0);
    assert.ok($('.entry'));
    assert.equal(amountInput().value, '45.000');
    assert.equal(isChecked(catButton('Ăn uống')), true);
    assert.equal($('.field__label-row + input').value, 'giữ lại nhé');
    backend.failWrites = null;
    saveBtn().click();
    assert.equal(repo.count(), 1);
    assert.equal(calls.saved.length, 1);
  });

  test('trình duyệt chặn localStorage: biểu ngữ hiện ngay khi mở và lưu bị từ chối', () => {
    const backend = new MemoryBackend();
    backend.failReads = true;
    const { repo, calls } = setup({ backend });
    assert.equal($('.banner').hidden, false);
    assert.match($('.banner').textContent, /chặn lưu trữ/);
    fillValid();
    saveBtn().click();
    assert.equal(repo.count(), 0);
    assert.equal(calls.saved.length, 0);
  });

  test('dữ liệu do phiên bản mới hơn tạo: cảnh báo ngay và không ghi', () => {
    const future = { ...createDefaultData(), schemaVersion: 99 };
    const backend = new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(future) });
    const { calls } = setup({ backend });
    assert.match($('.banner').textContent, /phiên bản mới hơn/);
    fillValid();
    saveBtn().click();
    assert.equal(calls.saved.length, 0);
    assert.match($('.banner').textContent, /phiên bản mới hơn/);
    assert.equal(backend.writes, 0);
  });

  test('không có lỗi thì biểu ngữ ẩn', () => {
    setup();
    assert.equal($('.banner').hidden, true);
  });
});

/* ================================================================== */
describe('Khả năng tiếp cận và bàn phím', () => {
  test('nhóm radio có tên; mọi ô nhập có nhãn; biểu tượng ẩn với trình đọc màn hình', () => {
    setup();
    for (const group of $$('[role="radiogroup"]')) {
      const named = group.getAttribute('aria-label') || $('#' + group.getAttribute('aria-labelledby'))?.textContent;
      assert.ok(named, 'radiogroup thiếu tên');
    }
    for (const input of $$('input')) {
      assert.ok($(`label[for="${input.id}"]`), `ô ${input.className} thiếu <label>`);
    }
    assert.equal($('[data-action="close"]').getAttribute('aria-label'), 'Đóng');
    for (const svg of $$('svg')) assert.equal(svg.getAttribute('aria-hidden'), 'true');
    assert.equal($('.entry').getAttribute('aria-labelledby'), $('h1').id);
  });

  test('nút Lưu dùng aria-disabled (vẫn focus/bấm được để hiện lỗi), không dùng thuộc tính disabled', () => {
    setup();
    assert.equal(saveBtn().hasAttribute('disabled'), false);
    assert.equal(saveBtn().getAttribute('aria-disabled'), 'true');
    assert.equal(saveBtn().type, 'submit');
  });

  test('Tab xoay vòng trong hộp thoại (bẫy focus)', () => {
    setup();
    const focusables = $$('button:not([tabindex="-1"]), input', $('.entry')).filter((n) => !n.disabled && n.tabIndex !== -1);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    assert.equal(first, $('[data-action="close"]'));
    assert.equal(last, saveBtn());
    last.focus();
    assert.equal(key(last, 'Tab').defaultPrevented, true);
    assert.equal(document.activeElement, first);
    first.focus();
    assert.equal(key(first, 'Tab', { shiftKey: true }).defaultPrevented, true);
    assert.equal(document.activeElement, last);
  });

  test('Tab ở giữa không bị chặn', () => {
    setup();
    const mid = amountInput();
    mid.focus();
    assert.equal(key(mid, 'Tab').defaultPrevented, false);
  });

  test('đóng trang → trả focus về phần tử đã mở nó (nút ＋)', () => {
    const { opener } = setup();
    assert.notEqual(document.activeElement, opener);
    $('[data-action="close"]').click();
    assert.equal(document.activeElement, opener);
  });
});

/* ================================================================== */
describe('Độ bền khi dùng nhiều lần', () => {
  test('mở – lưu liên tục nhiều lần không để lại phần tử/trình nghe thừa', () => {
    const backend = new MemoryBackend();
    const now = makeClock();
    let last;
    for (let i = 0; i < 5; i += 1) {
      last = setup({ backend, now });
      fillValid({ amount: String(1000 * (i + 1)) });
      saveBtn().click();
      assert.equal($$('.entry-overlay').length, 0);
      assert.equal($$('.confirm-overlay').length, 0);
      assert.equal(last.repo.count(), i + 1);
    }
    assert.equal(document.documentElement.classList.contains('has-entry-open'), false);
    assert.deepEqual(makeRepo({ backend }).repo.listByMonth('2026-10').map((t) => t.amount).sort((x, y) => x - y), [1000, 2000, 3000, 4000, 5000]);
  });

  test('dữ liệu lưu bền: nạp lại bằng repo mới vẫn thấy khoản vừa nhập', () => {
    const backend = new MemoryBackend();
    setup({ backend });
    fillValid();
    saveBtn().click();
    const { repo } = makeRepo({ backend });
    assert.equal(repo.count(), 1);
    assert.equal(repo.listByMonth('2026-10')[0].amount, 45000);
  });
});
