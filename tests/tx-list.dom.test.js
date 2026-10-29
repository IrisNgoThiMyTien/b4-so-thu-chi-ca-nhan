import { win } from './dom-env.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mountHome } from '../src/ui/home.js';
import { mountTransactionList } from '../src/ui/tx-list.js';
import { createToastHost } from '../src/ui/toast.js';
import { STORAGE_KEY } from '../src/core/storage.js';
import { createDefaultData } from '../src/core/defaults.js';
import { MemoryBackend, makeClock, makeRepo, plain, validInput } from './helpers.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const key = (target, k, init = {}) => {
  const e = new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};
function ptr(target, type, x, y, pointerType = 'touch') {
  const e = new win.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0 });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  target.dispatchEvent(e);
}
/** Vuốt ngang trên thân dòng: dx âm = sang trái. */
function swipe(li, dx, dy = 0, pointerType = 'touch') {
  const body = $('.tx__body', li);
  ptr(body, 'pointerdown', 200, 100, pointerType);
  ptr(body, 'pointermove', 200 + dx / 2, 100 + dy / 2, pointerType);
  ptr(body, 'pointermove', 200 + dx, 100 + dy, pointerType);
  ptr(body, 'pointerup', 200 + dx, 100 + dy, pointerType);
}

const row = (id) => $(`.tx[data-tx-id="${id}"]`);
const rows = () => $$('.tx');
const heads = () => $$('.tx-day__title').map((h) => h.textContent);
const sums = () => $$('.tx-day__sum').map((s) => plain(s.textContent));
const names = () => $$('.tx__name').map((n) => n.textContent);
const confirmBox = () => $('.confirm');
const clickConfirm = () => $('.confirm__actions .btn--danger').click();
const clickCancel = () => $('.confirm__actions .btn--secondary').click();

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
  document.body.replaceChildren();
  document.documentElement.className = '';
});

const F = 'cat-expense-food';
const T = 'cat-expense-transport';
const SAL = 'cat-income-salary';

/** seed: các phần ghi đè của validInput (type, categoryId, amount, date, note, walletId) */
function setup({ backend = new MemoryBackend(), now = makeClock(), seed = [], mount = {}, homeOpts = {} } = {}) {
  const { repo } = makeRepo({ backend, now });
  const added = [];
  for (const s of seed) {
    now.advance(1000);
    const r = repo.add(validInput(s));
    assert.equal(r.ok, true, JSON.stringify(r));
    added.push(r.transaction);
  }
  const home = mountHome({ repo, now, animate: false, ...homeOpts });
  const toast = createToastHost();
  const list = mountTransactionList({ repo, home, now, animate: false, toast, ...mount });
  cleanups.push(() => {
    list.destroy();
    home.destroy();
    toast.destroy();
  });
  return { repo, backend, now, home, list, toast, added };
}

const DATA = [
  { amount: 45_000, categoryId: F, date: '2026-10-27', note: 'Cà phê' },
  { amount: 40_000, categoryId: T, date: '2026-10-27', walletId: 'wallet-ewallet', note: '' },
  { type: 'income', categoryId: SAL, amount: 500_000, date: '2026-10-26', note: 'Lương thưởng' },
  { amount: 100, categoryId: F, date: '2026-10-23' },
  { type: 'income', categoryId: SAL, amount: 100, date: '2026-10-23' },
];

/* ================================================================== */
describe('Hiển thị danh sách (F2)', () => {
  test('nhóm theo ngày, tên ngày và tổng ròng từng ngày (DESIGN §6.4)', () => {
    setup({ seed: DATA });
    assert.deepEqual(heads(), ['Hôm nay', 'Hôm qua', 'Thứ Sáu, 23/10']);
    assert.deepEqual(sums(), ['−85.000 ₫', '+500.000 ₫', '0 ₫']);
    assert.deepEqual($$('.tx-day').map((d) => $$('.tx', d).length), [2, 1, 2]);
  });

  test('mỗi nhóm là một vùng có tiêu đề h3; cả danh sách là một vùng có tên', () => {
    setup({ seed: DATA });
    const region = $('.tx-list');
    assert.equal(region.getAttribute('role'), 'region');
    assert.equal(region.getAttribute('aria-label'), 'Giao dịch tháng 10/2026');
    for (const section of $$('.tx-day')) {
      const h = $('h3', section);
      assert.equal(section.getAttribute('aria-labelledby'), h.id);
      assert.equal($('ul', section).tagName, 'UL');
    }
    assert.match($('.tx-day__sum').getAttribute('aria-label'), /^Tổng ròng trong ngày âm 85\.000/);
    assert.equal($$('.tx-day__title')[2].title, 'Thứ Sáu, 23/10/2026');
  });

  test('nội dung một dòng: biểu tượng, tên danh mục, "Ví · ghi chú", số tiền có dấu', () => {
    setup({ seed: DATA });
    const [a, b] = $$('.tx', $$('.tx-day')[0]).reverse();
    // cùng ngày: khoản nhập sau hiện trước
    assert.equal($('.tx__name', a).textContent, 'Ăn uống');
    assert.equal($('.tx__sub', a).textContent, 'Tiền mặt · Cà phê');
    assert.equal(plain($('.tx__amount', a).textContent), '−45.000 ₫');
    assert.ok($('.tx__amount--expense', a));
    assert.equal($('.tx__name', b).textContent, 'Di chuyển');
    assert.equal($('.tx__sub', b).textContent, 'Ví điện tử', 'không có ghi chú thì chỉ hiện ví');
    const income = $('.tx__amount--income');
    assert.equal(plain(income.textContent), '+500.000 ₫');
    assert.ok($('.tx__icon svg', a));
    assert.equal($('.tx__icon', a).getAttribute('style'), '--cat-color: var(--cat-eat);');
  });

  test('thứ tự trong ngày: mới nhập nằm trên; ngày mới nằm trên ngày cũ', () => {
    setup({ seed: DATA });
    assert.deepEqual(names(), ['Di chuyển', 'Ăn uống', 'Lương', 'Lương', 'Ăn uống']);
  });

  test('tên truy cập của dòng nêu danh mục, ví/ghi chú, thu/chi và số tiền', () => {
    setup({ seed: DATA });
    const main = $('.tx__main', row($('.tx[data-tx-id]').dataset.txId));
    assert.equal(plain(main.getAttribute('aria-label')), 'Di chuyển. Ví điện tử. Chi 40.000 ₫');
    const income = $$('.tx__main').find((m) => m.getAttribute('aria-label').startsWith('Lương. Tiền mặt · Lương thưởng'));
    assert.equal(plain(income.getAttribute('aria-label')), 'Lương. Tiền mặt · Lương thưởng. Thu 500.000 ₫');
  });

  test('khác năm hiện tại: tên ngày kèm năm', () => {
    const { home } = setup({ seed: [{ amount: 5_000, date: '2025-12-31' }] });
    home.setMonth('2025-12');
    assert.deepEqual(heads(), ['Thứ Tư, 31/12/2025']);
  });

  test('chỉ hiện giao dịch của tháng đang xem; đổi tháng thì danh sách đổi theo', () => {
    const { home } = setup({ seed: [...DATA, { amount: 77_000, categoryId: T, date: '2026-09-15', note: 'tháng trước' }] });
    assert.equal(rows().length, 5);
    home.setMonth('2026-09');
    assert.deepEqual(names(), ['Di chuyển']);
    assert.deepEqual(heads(), ['Thứ Ba, 15/09']);
    assert.equal($('.tx-list').getAttribute('aria-label'), 'Giao dịch tháng 9/2026');
  });

  test('cập nhật ngay khi kho dữ liệu đổi: thêm, sửa, xoá', () => {
    const { repo, added } = setup({ seed: DATA });
    repo.add(validInput({ amount: 1_000, date: '2026-10-27', note: 'mới' }));
    assert.equal(rows().length, 6);
    assert.equal(sums()[0], '−86.000 ₫');
    const first = added[0];
    repo.update(first.id, validInput({ amount: 50_000, categoryId: F, date: '2026-10-27', note: 'Cà phê' }));
    assert.equal(sums()[0], '−91.000 ₫');
    repo.remove(first.id);
    assert.equal(rows().length, 5);
  });

  test('tháng trống: ô danh sách rỗng hẳn (:empty) để Trang chủ (M2) hiện trạng thái trống', () => {
    const { repo, home, added } = setup();
    assert.equal(home.slots.list.childNodes.length, 0);
    assert.equal($('.home-empty').hidden, false);
    const a = repo.add(validInput()).transaction;
    assert.equal($('.home-empty').hidden, true);
    assert.equal(rows().length, 1);
    repo.remove(a.id);
    assert.equal(home.slots.list.childNodes.length, 0);
    assert.equal($('.home-empty').hidden, false);
    assert.equal(added.length, 0);
  });

  test('danh mục / ví không còn tồn tại: dùng tên và biểu tượng dự phòng, không lỗi', () => {
    const backend = new MemoryBackend();
    const data = createDefaultData();
    data.transactions.push({ id: 'orphan', type: 'expense', amount: 9_000, categoryId: 'cat-ghost', walletId: 'wallet-ghost', date: '2026-10-20', note: 'mồ côi', createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' });
    backend.setItem(STORAGE_KEY, JSON.stringify(data));
    setup({ backend });
    assert.equal($('.tx__name').textContent, 'Không rõ danh mục');
    assert.equal($('.tx__sub').textContent, 'mồ côi');
    assert.equal($('.tx__icon').getAttribute('style'), '--cat-color: var(--cat-other);');
  });

  test('văn bản người dùng và màu lạ không bao giờ chèn được HTML/CSS', () => {
    const backend = new MemoryBackend();
    const data = createDefaultData();
    data.categories[0] = { ...data.categories[0], name: '<img src=x onerror="window.__xss=1">', color: 'x);position:fixed;inset:0;(' };
    data.transactions.push({ id: 'x1', type: 'expense', amount: 9_000, categoryId: data.categories[0].id, walletId: 'wallet-cash', date: '2026-10-20', note: '<script>window.__xss=1</script>', createdAt: 'a', updatedAt: 'a' });
    backend.setItem(STORAGE_KEY, JSON.stringify(data));
    setup({ backend });
    assert.equal($('.tx-list img'), null);
    assert.equal($('.tx-list script'), null);
    assert.equal($('.tx__name').textContent, '<img src=x onerror="window.__xss=1">');
    assert.equal($('.tx__sub').textContent, 'Tiền mặt · <script>window.__xss=1</script>');
    assert.equal($('.tx__icon').getAttribute('style'), '--cat-color: var(--cat-other);');
    assert.equal(win.__xss, undefined);
  });

  test('khai báo thiếu host/month thì báo lỗi rõ ràng', () => {
    const { repo } = makeRepo();
    assert.throws(() => mountTransactionList({ repo }), /host và month/);
  });
});

/* ================================================================== */
describe('Chạm để sửa (F3)', () => {
  test('chạm dòng → mở Trang nhập liệu ở chế độ sửa, điền sẵn dữ liệu', () => {
    const { added } = setup({ seed: DATA });
    $('.tx__main', row(added[0].id)).click();
    assert.equal($('.entry h1').textContent, 'Sửa khoản');
    assert.equal($('.amount__input').value, '45.000');
    assert.equal($('.field__label-row + input').value, 'Cà phê');
    $('[data-action="close"]').click();
  });

  test('sửa xong lưu → dòng và tổng ngày cập nhật, thẻ tổng quan cũng đổi', () => {
    const { added } = setup({ seed: DATA });
    $('.tx__main', row(added[0].id)).click();
    const input = $('.amount__input');
    input.value = '60000';
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    $('[data-action="save"]').click();
    assert.equal(plain($('.tx__amount', row(added[0].id)).textContent), '−60.000 ₫');
    assert.equal(sums()[0], '−100.000 ₫');
    assert.equal(plain($('.card--expense .card__value--full').textContent), '−100.100 ₫');
  });

  test('có thể truyền onEdit riêng', () => {
    const edits = [];
    const { added } = setup({ seed: DATA, mount: { onEdit: (id) => edits.push(id) } });
    $('.tx__main', row(added[1].id)).click();
    assert.deepEqual(edits, [added[1].id]);
    assert.equal($('.entry'), null);
  });

  test('nút ✎ (laptop) cũng mở chế độ sửa', () => {
    const edits = [];
    const { added } = setup({ seed: DATA, mount: { onEdit: (id) => edits.push(id) } });
    $('[data-action="tool-edit"]', row(added[2].id)).click();
    assert.deepEqual(edits, [added[2].id]);
  });
});

/* ================================================================== */
describe('Xoá nhanh và hoàn tác (F4)', () => {
  test('nút 🗑 → hộp xác nhận; Huỷ thì giữ nguyên', async () => {
    const { repo, added } = setup({ seed: DATA });
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    assert.ok(confirmBox());
    assert.equal($('.confirm__title').textContent, 'Xoá khoản này?');
    assert.equal(document.activeElement.textContent, 'Huỷ');
    clickCancel();
    await flush();
    assert.equal(confirmBox(), null);
    assert.ok(repo.getTransaction(added[0].id));
    assert.equal(rows().length, 5);
  });

  test('xác nhận Xoá → dòng biến mất, tổng ngày/thẻ tổng quan cập nhật, toast "Đã xoá · Hoàn tác"', async () => {
    const deleted = [];
    const { repo, added, toast } = setup({ seed: DATA, mount: { onDeleted: (t) => deleted.push(t) } });
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    clickConfirm();
    await flush();
    assert.equal(repo.getTransaction(added[0].id), null);
    assert.equal(row(added[0].id), null);
    assert.equal(sums()[0], '−40.000 ₫');
    assert.equal(plain($('.card--expense .card__value--full').textContent), '−40.100 ₫');
    assert.equal($('.toast__text', toast.element).textContent, 'Đã xoá');
    assert.equal($('.toast__action', toast.element).textContent, 'Hoàn tác');
    assert.deepEqual(deleted.map((t) => t.id), [added[0].id]);
  });

  test('Hoàn tác đưa đúng dòng trở lại, đúng vị trí và dữ liệu', async () => {
    const restored = [];
    const { repo, added, toast } = setup({ seed: DATA, mount: { onRestored: (t) => restored.push(t) } });
    const before = names();
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    clickConfirm();
    await flush();
    $('.toast__action', toast.element).click();
    assert.deepEqual(names(), before);
    assert.deepEqual(repo.getTransaction(added[0].id), added[0]);
    assert.equal(sums()[0], '−85.000 ₫');
    assert.equal(restored.length, 1);
    assert.equal($('.toast__text', toast.element).textContent, 'Đã khôi phục khoản này');
  });

  test('xoá khoản cuối của tháng → ô danh sách rỗng, Trang chủ hiện trạng thái trống; hoàn tác đưa lại', async () => {
    const { home, added, toast } = setup({ seed: [{ amount: 1_000 }] });
    $('[data-action="tool-delete"]').click();
    clickConfirm();
    await flush();
    assert.equal(home.slots.list.childNodes.length, 0);
    assert.equal($('.home-empty').hidden, false);
    $('.toast__action', toast.element).click();
    assert.equal(rows().length, 1);
    assert.equal(added.length, 1);
  });

  test('phím Delete / Backspace trên dòng đang focus → hỏi xoá; phím khác không', async () => {
    const { added } = setup({ seed: DATA });
    const main = $('.tx__main', row(added[0].id));
    main.focus();
    assert.equal(key(main, 'a').defaultPrevented, false);
    assert.equal(confirmBox(), null);
    assert.equal(key(main, 'Delete').defaultPrevented, true);
    assert.ok(confirmBox());
    clickCancel();
    await flush();
    key(main, 'Backspace');
    assert.ok(confirmBox());
    clickCancel();
    await flush();
  });

  test('đang hiện hộp xác nhận thì không mở thêm hộp thứ hai', () => {
    const { added } = setup({ seed: DATA });
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    $('[data-action="tool-delete"]', row(added[1].id)).click();
    assert.equal($$('.confirm').length, 1);
    clickCancel();
  });

  test('xoá lỗi do hết dung lượng: thông báo lỗi, dòng vẫn còn, không gọi onDeleted', async () => {
    const deleted = [];
    const { repo, backend, added, toast } = setup({ seed: DATA, mount: { onDeleted: (t) => deleted.push(t) } });
    backend.failWrites = 'quota';
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    clickConfirm();
    await flush();
    assert.ok(row(added[0].id));
    assert.ok(repo.getTransaction(added[0].id));
    assert.match($('.toast__text', toast.element).textContent, /Không thể xoá/);
    assert.ok($('.toast--error', toast.element));
    assert.equal(deleted.length, 0);
  });

  test('khoản đã bị xoá ở nơi khác khi đang hỏi: báo "không còn tồn tại"', async () => {
    const { repo, added, toast } = setup({ seed: DATA });
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    repo.remove(added[0].id);
    clickConfirm();
    await flush();
    assert.equal($('.toast__text', toast.element).textContent, 'Khoản này không còn tồn tại.');
  });

  test('Hoàn tác khi ghi lỗi → "Không thể hoàn tác", dữ liệu không đổi', async () => {
    const { repo, backend, added, toast } = setup({ seed: DATA });
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    clickConfirm();
    await flush();
    backend.failWrites = 'quota';
    $('.toast__action', toast.element).click();
    assert.equal($('.toast__text', toast.element).textContent, 'Không thể hoàn tác');
    assert.equal(repo.getTransaction(added[0].id), null);
  });

  test('có hiệu ứng: dòng thu gọn rồi mới gỡ; thay đổi đến trong lúc chạy hiệu ứng được vẽ sau đó', async () => {
    const { repo, added } = setup({ seed: DATA, mount: { animate: true } });
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    clickConfirm();
    await flush();
    assert.ok(row(added[0].id).classList.contains('is-removing'));
    repo.add(validInput({ amount: 3_000, date: '2026-10-27', note: 'giữa chừng' }));
    assert.equal(rows().length, 5, 'chưa vẽ lại khi còn hiệu ứng');
    await sleep(320);
    assert.equal(row(added[0].id), null);
    assert.equal(rows().length, 5);
    assert.ok(names().length === 5 && $$('.tx__sub').some((s) => s.textContent.includes('giữa chừng')));
  });

  test('xoá thất bại khi đang có hiệu ứng: dòng trở lại bình thường', async () => {
    const { backend, added } = setup({ seed: DATA, mount: { animate: true } });
    backend.failWrites = 'quota';
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    clickConfirm();
    await flush();
    assert.equal(row(added[0].id).classList.contains('is-removing'), false);
    assert.equal(row(added[0].id).style.height, '');
  });
});

/* ================================================================== */
describe('Vuốt trái để xoá (điện thoại)', () => {
  test('mặc định nút Xoá ẩn khỏi cây truy cập và không focus được', () => {
    setup({ seed: DATA });
    for (const b of $$('[data-action="swipe-delete"]')) {
      assert.equal(b.getAttribute('aria-hidden'), 'true');
      assert.equal(b.tabIndex, -1);
    }
  });

  test('vuốt qua nửa bề rộng nút → mở (dịch 88px), nút Xoá dùng được', () => {
    const { added } = setup({ seed: DATA });
    const li = row(added[0].id);
    swipe(li, -100);
    assert.equal(li.classList.contains('is-open'), true);
    assert.equal($('.tx__body', li).style.transform, 'translateX(-88px)');
    const del = $('[data-action="swipe-delete"]', li);
    assert.equal(del.getAttribute('aria-hidden'), 'false');
    assert.equal(del.tabIndex, 0);
    assert.equal(li.classList.contains('is-dragging'), false);
  });

  test('vuốt ít (< nửa) → tự đóng lại', () => {
    const { added } = setup({ seed: DATA });
    const li = row(added[0].id);
    swipe(li, -30);
    assert.equal(li.classList.contains('is-open'), false);
    assert.equal($('.tx__body', li).style.transform, '');
  });

  test('vuốt sang phải khi đang đóng: không mở; kéo quá giới hạn thì bị chặn ở 88px', () => {
    const { added } = setup({ seed: DATA });
    const li = row(added[0].id);
    swipe(li, 80);
    assert.equal(li.classList.contains('is-open'), false);
    const body = $('.tx__body', li);
    ptr(body, 'pointerdown', 300, 100);
    ptr(body, 'pointermove', 100, 100);
    assert.equal(body.style.transform, 'translateX(-88px)');
    ptr(body, 'pointerup', 100, 100);
    assert.equal(li.classList.contains('is-open'), true);
  });

  test('cuộn dọc (dy lớn hơn dx) không bị coi là vuốt ngang', () => {
    const { added } = setup({ seed: DATA });
    const li = row(added[0].id);
    swipe(li, -40, 60);
    assert.equal(li.classList.contains('is-open'), false);
    assert.equal(li.classList.contains('is-dragging'), false);
    assert.equal($('.tx__body', li).style.transform, '');
  });

  test('chuột (pointerType = mouse) không kích hoạt vuốt; dùng nút ✎ 🗑', () => {
    const { added } = setup({ seed: DATA });
    const li = row(added[0].id);
    swipe(li, -120, 0, 'mouse');
    assert.equal(li.classList.contains('is-open'), false);
  });

  test('nhả tay sau khi vuốt không bị tính là "chạm" để mở Trang nhập liệu', async () => {
    const { added } = setup({ seed: DATA });
    const li = row(added[0].id);
    swipe(li, -100);
    $('.tx__main', li).click(); // click sinh ra ngay sau pointerup
    assert.equal($('.entry'), null);
    await sleep(5);
    assert.equal(li.classList.contains('is-open'), true);
  });

  test('chạm vào dòng đang mở → đóng lại (không mở Trang nhập liệu)', async () => {
    const { added } = setup({ seed: DATA });
    const li = row(added[0].id);
    swipe(li, -100);
    await sleep(5);
    $('.tx__main', li).click();
    assert.equal(li.classList.contains('is-open'), false);
    assert.equal($('.entry'), null);
    $('.tx__main', li).click();
    assert.ok($('.entry'));
    $('[data-action="close"]').click();
  });

  test('chỉ một dòng mở tại một thời điểm', () => {
    const { added } = setup({ seed: DATA });
    swipe(row(added[0].id), -100);
    swipe(row(added[1].id), -100);
    assert.equal(rows().filter((r) => r.classList.contains('is-open')).length, 1);
    assert.equal(row(added[1].id).classList.contains('is-open'), true);
  });

  test('chạm ra ngoài dòng đang mở → đóng', () => {
    const { added } = setup({ seed: DATA });
    swipe(row(added[0].id), -100);
    ptr($('.tx-day__title'), 'pointerdown', 10, 10);
    assert.equal(row(added[0].id).classList.contains('is-open'), false);
  });

  test('bấm nút Xoá lộ ra → hộp xác nhận → xoá được', async () => {
    const { repo, added } = setup({ seed: DATA });
    swipe(row(added[0].id), -100);
    $('[data-action="swipe-delete"]', row(added[0].id)).click();
    assert.ok(confirmBox());
    assert.equal(row(added[0].id).classList.contains('is-open'), false, 'dòng đóng lại khi hỏi');
    clickConfirm();
    await flush();
    assert.equal(repo.getTransaction(added[0].id), null);
  });

  test('có thay đổi dữ liệu từ nơi khác khi đang mở dòng: danh sách vẽ lại và không còn dòng mở', () => {
    const { repo, added } = setup({ seed: DATA });
    swipe(row(added[0].id), -100);
    repo.add(validInput({ amount: 1, date: '2026-10-27' }));
    assert.equal(rows().filter((r) => r.classList.contains('is-open')).length, 0);
  });

  test('pointercancel (hệ thống ngắt cử chỉ) cũng chốt trạng thái, không kẹt lớp is-dragging', () => {
    const { added } = setup({ seed: DATA });
    const li = row(added[0].id);
    const body = $('.tx__body', li);
    ptr(body, 'pointerdown', 200, 100);
    ptr(body, 'pointermove', 80, 100);
    ptr(body, 'pointercancel', 80, 100);
    assert.equal(li.classList.contains('is-dragging'), false);
    assert.equal(li.classList.contains('is-open'), true);
  });
});

/* ================================================================== */
describe('Nhiều giao dịch (phân trang)', () => {
  function bulk(count, { sameDay = false } = {}) {
    const data = createDefaultData();
    for (let i = 0; i < count; i += 1) {
      const day = sameDay ? '20' : String((i % 27) + 1).padStart(2, '0');
      data.transactions.push({ id: `b${i}`, type: i % 5 === 0 ? 'income' : 'expense', amount: 1000 + i, categoryId: i % 5 === 0 ? SAL : F, walletId: 'wallet-cash', date: `2026-10-${day}`, note: '', createdAt: `2026-10-${day}T00:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`, updatedAt: 'x' });
    }
    return new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) });
  }

  test('chỉ vẽ 150 dòng đầu, có nút "Xem thêm"; bấm nhiều lần cho tới hết', () => {
    setup({ backend: bulk(400) });
    assert.equal(rows().length, 150);
    const more = () => $('[data-action="show-more"]');
    assert.equal(more().textContent, 'Xem thêm 150 khoản');
    assert.match(more().getAttribute('aria-label'), /còn 250 khoản chưa hiển thị/);
    more().click();
    assert.equal(rows().length, 300);
    assert.equal(more().textContent, 'Xem thêm 100 khoản');
    more().click();
    assert.equal(rows().length, 400);
    assert.equal(more(), null);
  });

  test('sau khi bấm "Xem thêm", focus nhảy tới dòng mới đầu tiên', () => {
    setup({ backend: bulk(400) });
    $('[data-action="show-more"]').click();
    assert.equal(document.activeElement, $$('.tx__main')[150]);
  });

  test('tổng ròng của ngày tính trên cả ngày dù chỉ hiện một phần dòng', () => {
    setup({ backend: bulk(400, { sameDay: true }) });
    assert.equal(rows().length, 150);
    assert.equal($$('.tx-day').length, 1);
    let net = 0;
    for (let i = 0; i < 400; i += 1) net += (i % 5 === 0 ? 1 : -1) * (1000 + i);
    assert.equal(sums()[0], `${net < 0 ? '−' : '+'}${Math.abs(net).toLocaleString('vi-VN')} ₫`);
  });

  test('đổi tháng thì quay về trang đầu', () => {
    const { home } = setup({ backend: bulk(400) });
    $('[data-action="show-more"]').click();
    assert.equal(rows().length, 300);
    home.setMonth('2026-09');
    home.setMonth('2026-10');
    assert.equal(rows().length, 150);
  });

  test('pageSize tuỳ chỉnh', () => {
    setup({ backend: bulk(25), mount: { pageSize: 10 } });
    assert.equal(rows().length, 10);
    assert.equal($('[data-action="show-more"]').textContent, 'Xem thêm 10 khoản');
  });

  test('hiệu năng: chỉ vẽ một trang nên thời gian vẽ không tăng theo tổng số giao dịch (500 → 5.000)', () => {
    const measure = (count) => {
      const backend = bulk(count);
      const { repo } = makeRepo({ backend });
      const home = mountHome({ repo, now: makeClock(), animate: false });
      const toast = createToastHost();
      const t0 = performance.now();
      const list = mountTransactionList({ repo, home, now: makeClock(), animate: false, toast });
      const ms = performance.now() - t0;
      assert.equal(rows().length, 150);
      list.destroy();
      home.destroy();
      toast.destroy();
      return ms;
    };
    measure(500); // làm nóng
    const small = measure(500);
    const large = measure(5000);
    // jsdom chậm hơn trình duyệt thật nhiều lần; ở đây chỉ kiểm tra không có độ phức tạp theo tổng số giao dịch.
    assert.ok(large < Math.max(small * 3, 600), `500 giao dịch: ${small.toFixed(0)}ms, 5.000: ${large.toFixed(0)}ms`);
  });

  test('phần xử lý dữ liệu (lọc tháng + gom ngày + cắt trang) với 5.000 giao dịch < 100 ms', async () => {
    const { repo } = makeRepo({ backend: bulk(5000) });
    const { groupByDay, limitRows } = await import('../src/core/day-groups.js');
    const t0 = performance.now();
    const result = limitRows(groupByDay(repo.listByMonth('2026-10')), 150);
    const ms = performance.now() - t0;
    assert.equal(result.total, 5000);
    assert.equal(result.shown, 150);
    assert.ok(ms < 100, `${ms.toFixed(1)}ms`);
  });
});

/* ================================================================== */
describe('Vòng đời', () => {
  test('destroy: gỡ danh sách, huỷ đăng ký kho dữ liệu/tháng/con trỏ; gọi nhiều lần không lỗi', () => {
    const { repo, home, list } = setup({ seed: DATA });
    list.destroy();
    list.destroy();
    assert.equal($('.tx-list'), null);
    assert.doesNotThrow(() => repo.add(validInput({ date: '2026-10-27' })));
    assert.doesNotThrow(() => home.setMonth('2026-09'));
    assert.doesNotThrow(() => ptr(document.body, 'pointerdown', 1, 1));
    assert.equal($('.tx-list'), null);
  });

  test('destroy khi đang hiện hộp xác nhận xoá: hộp bị đóng, không xoá gì', async () => {
    const { repo, list, added } = setup({ seed: DATA });
    $('[data-action="tool-delete"]', row(added[0].id)).click();
    assert.ok(confirmBox());
    list.destroy();
    await flush();
    assert.equal(confirmBox(), null);
    assert.ok(repo.getTransaction(added[0].id));
  });

  test('có thể gắn với host / month / onEdit tự chọn (không cần Trang chủ)', () => {
    const { repo } = makeRepo({ now: makeClock() });
    repo.add(validInput({ date: '2026-10-27' }));
    const host = document.createElement('div');
    document.body.append(host);
    const calls = [];
    const fakeMonth = { get: () => '2026-10', subscribe: () => () => {} };
    const list = mountTransactionList({ repo, host, month: fakeMonth, onEdit: (id) => calls.push(id), now: makeClock(), animate: false, toast: createToastHost() });
    cleanups.push(() => list.destroy());
    assert.equal($$('.tx', host).length, 1);
    $('.tx__main', host).click();
    assert.equal(calls.length, 1);
    assert.equal(list.visibleCount(), 1);
  });
});
