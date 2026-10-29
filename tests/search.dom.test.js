import { win } from './dom-env.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mountHome } from '../src/ui/home.js';
import { mountTransactionList } from '../src/ui/tx-list.js';
import { mountCharts } from '../src/ui/charts.js';
import { mountSearch, DEBOUNCE_MS } from '../src/ui/search.js';
import { createToastHost } from '../src/ui/toast.js';
import { STORAGE_KEY } from '../src/core/storage.js';
import { createDefaultData } from '../src/core/defaults.js';
import { MemoryBackend, makeClock, makeRepo, plain, validInput } from './helpers.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const key = (target, k, init = {}) => {
  const e = new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};
const fire = (target, type, init = {}) => target.dispatchEvent(new win.Event(type, { bubbles: true, cancelable: true, ...init }));
const pointerDown = (target) => target.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, cancelable: true }));

const input = () => $('.search__input');
const typeIn = (text) => {
  input().value = text;
  fire(input(), 'input');
};
const filterBtn = () => $('.search__filter');
const badge = () => $('.search__badge');
const chipsList = () => $$('.search__chips .fchip').map((c) => $('.fchip__label', c).textContent);
const rows = () => $$('.tx');
const names = () => $$('.tx__name').map((n) => n.textContent);
const subs = () => $$('.tx__sub').map((n) => plain(n.textContent));
const heads = () => $$('.tx-day__title').map((h) => h.textContent);
const summaryText = () => plain($('.search__summary').textContent);
const summaryHidden = () => $('.search__summary').hidden;
const emptyBox = () => $('.search__empty');
const panelRoot = () => $('.filter-panel');
const panelOpen = () => !panelRoot().hidden;
const radios = () => $$('[data-filter-type]');
const checkedRadio = () => radios().find((r) => r.getAttribute('aria-checked') === 'true');
const catChips = () => $$('.chip--cat', panelRoot());
const catNames = () => catChips().map((c) => $('span', c).textContent);
const walletChipEls = () => $$('.chip--wallet', panelRoot());
const pressed = (chip) => chip.getAttribute('aria-pressed') === 'true';
const catChip = (id) => $(`[data-category-id="${id}"]`, panelRoot());
const walletChip = (id) => $(`[data-wallet-id="${id}"]`, panelRoot());
const applyBtn = () => $('.fp__apply');
const clearBtn = () => $('.fp__clear');
const clickType = (t) => $(`[data-filter-type="${t}"]`).click();
const cardTexts = () => $$('.card').map((c) => plain($('.card__value--full', c).textContent));

const F = 'cat-expense-food';
const T = 'cat-expense-transport';
const OTHER_E = 'cat-expense-other';
const OTHER_I = 'cat-income-other';
const SAL = 'cat-income-salary';
const BONUS = 'cat-income-bonus';

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
  document.body.replaceChildren();
  document.documentElement.className = '';
});

/** wide=true → bố cục laptop (áp dụng ngay); mặc định điện thoại (bảng nháp, bấm "Xem N kết quả" mới áp dụng) */
function setup({ backend = new MemoryBackend(), now = makeClock(), seed = [], wide = false, searchOpts = {}, listOpts = {}, withCharts = false } = {}) {
  const { repo } = makeRepo({ backend, now });
  const added = [];
  for (const s of seed) {
    now.advance(1000);
    const r = repo.add(validInput(s));
    assert.equal(r.ok, true, JSON.stringify(r));
    added.push(r.transaction);
  }
  const state = { wide };
  const home = mountHome({ repo, now, animate: false });
  const charts = withCharts ? mountCharts({ repo, home, now, animate: false }) : null;
  const search = mountSearch({ repo, home, debounceMs: 0, isWide: () => state.wide, ...searchOpts });
  const toast = createToastHost();
  const list = mountTransactionList({ repo, home, now, animate: false, toast, host: search.listHost, filter: search.filter, ...listOpts });
  cleanups.push(() => {
    list.destroy();
    search.destroy();
    charts?.destroy();
    home.destroy();
    toast.destroy();
  });
  return { repo, backend, now, home, search, list, charts, toast, added, state };
}

const DATA = [
  { amount: 45_000, categoryId: F, date: '2026-10-27', note: 'Cà phê sáng' },
  { amount: 40_000, categoryId: T, date: '2026-10-27', walletId: 'wallet-ewallet', note: 'Xe bus' },
  { type: 'income', categoryId: SAL, amount: 500_000, date: '2026-10-26', walletId: 'wallet-bank', note: 'Lương thưởng' },
  { amount: 120_000, categoryId: F, date: '2026-10-23', note: 'Cơm trưa với đồng nghiệp' },
  { type: 'income', categoryId: BONUS, amount: 100_000, date: '2026-10-23', note: '' },
];

/* ================================================================== */
describe('Bố cục và thành phần (DESIGN §10.4)', () => {
  test('khối tìm/lọc nằm trong ô danh sách của Trang chủ, phía trên danh sách giao dịch', () => {
    const { home } = setup({ seed: DATA });
    const slot = home.slots.list;
    assert.equal(slot.children.length, 1);
    const root = slot.firstElementChild;
    assert.ok(root.classList.contains('search'));
    assert.deepEqual([...root.children].map((c) => c.className.split(' ')[0]), ['search__head', 'search__empty', 'search__list']);
    assert.ok($('.search__list .tx-list'), 'M3 vẽ vào ô search__list');
    assert.ok(root.compareDocumentPosition($('.tx-list')) & win.Node.DOCUMENT_POSITION_CONTAINED_BY);
    assert.equal($('.search__head').compareDocumentPosition($('.search__list')) & win.Node.DOCUMENT_POSITION_FOLLOWING, win.Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('ô tìm: input type=search, inputmode=search, placeholder "Tìm ghi chú…", có nhãn, giới hạn 100 ký tự', () => {
    setup({ seed: DATA });
    const i = input();
    assert.equal(i.tagName, 'INPUT');
    assert.equal(i.type, 'search');
    assert.equal(i.getAttribute('inputmode'), 'search');
    assert.equal(i.getAttribute('enterkeyhint'), 'search');
    assert.equal(i.placeholder, 'Tìm ghi chú…');
    assert.equal(i.getAttribute('aria-label'), 'Tìm theo ghi chú');
    assert.equal(i.maxLength, 100);
    assert.equal(i.getAttribute('autocomplete'), 'off');
    assert.equal($('.search__bar').getAttribute('role'), 'search');
    assert.ok($('.search__icon svg'), 'biểu tượng kính lúp');
  });

  test('nút xoá nhanh ✕ chỉ hiện khi có chữ', () => {
    setup({ seed: DATA });
    const x = $('.search__clear');
    assert.equal(x.hidden, true);
    assert.equal(x.getAttribute('aria-label'), 'Xoá từ khoá');
    typeIn('c');
    assert.equal(x.hidden, false);
    typeIn('');
    assert.equal(x.hidden, true);
  });

  test('nút Lọc: biểu tượng sliders + chữ "Lọc", khai báo hộp thoại, chưa có huy hiệu khi chưa lọc', () => {
    setup({ seed: DATA });
    const b = filterBtn();
    assert.equal(b.getAttribute('aria-label'), 'Bộ lọc');
    assert.equal(b.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(b.getAttribute('aria-expanded'), 'false');
    assert.equal(b.getAttribute('aria-controls'), $('.filter-panel__panel').id);
    assert.ok($('svg', b));
    assert.equal($('.search__filter-text', b).textContent, 'Lọc');
    assert.equal(badge().hidden, true);
    assert.equal(b.classList.contains('is-active'), false);
    assert.equal(b.type, 'button');
  });

  test('chưa tìm / lọc: không chip, không thanh tóm tắt, không khối "không tìm thấy"; danh sách đủ như cũ', () => {
    setup({ seed: DATA });
    assert.equal($('.search__chips').hidden, true);
    assert.equal(summaryHidden(), true);
    assert.equal(emptyBox().hidden, true);
    assert.equal(rows().length, 5);
    assert.deepEqual(heads(), ['Hôm nay', 'Hôm qua', 'Thứ Sáu, 23/10']);
  });

  test('bảng lọc: có tiêu đề "Bộ lọc", nhóm Loại / Danh mục / Ví, chân bảng có "Xoá bộ lọc" và nút chính', () => {
    setup({ seed: DATA });
    filterBtn().click();
    const dlg = $('.filter-panel__panel');
    assert.equal(dlg.getAttribute('role'), 'dialog');
    assert.equal(dlg.getAttribute('aria-modal'), 'true');
    assert.equal(document.getElementById(dlg.getAttribute('aria-labelledby')).textContent, 'Bộ lọc');
    assert.deepEqual($$('.fp__label', dlg).map((h) => h.textContent), ['Loại', 'Danh mục', 'Ví']);
    assert.ok($$('.fp__label', dlg).every((h) => h.tagName === 'H3'));
    assert.equal(clearBtn().textContent, 'Xoá bộ lọc');
    assert.ok(clearBtn().classList.contains('btn--text'));
    assert.ok(applyBtn().classList.contains('btn--primary'));
    assert.equal($('[aria-label="Đóng bộ lọc"]', dlg).tagName, 'BUTTON');
  });

  test('Loại là segmented control 3 mục "Tất cả / Chi / Thu", mặc định "Tất cả"', () => {
    setup({ seed: DATA });
    filterBtn().click();
    assert.deepEqual(radios().map((r) => r.textContent), ['Tất cả', 'Chi', 'Thu']);
    assert.equal($('.fp__seg').getAttribute('role'), 'radiogroup');
    assert.deepEqual(radios().map((r) => r.getAttribute('aria-checked')), ['true', 'false', 'false']);
    assert.deepEqual(radios().map((r) => r.tabIndex), [0, -1, -1]);
    assert.ok($('.fp__seg').classList.contains('segmented'));
  });

  test('khai báo thiếu host/month thì báo lỗi rõ ràng', () => {
    const { repo } = makeRepo();
    assert.throws(() => mountSearch({ repo }), /host và month/);
  });
});

/* ================================================================== */
describe('Tìm theo ghi chú (F12)', () => {
  test('gõ từ khoá → chỉ còn các khoản có ghi chú khớp', () => {
    setup({ seed: DATA });
    typeIn('phê');
    assert.deepEqual(names(), ['Ăn uống']);
    assert.deepEqual(subs(), ['Tiền mặt · Cà phê sáng']);
  });

  test('không phân biệt hoa thường; gõ không dấu khớp chữ có dấu; gõ có dấu thì đúng dấu', () => {
    setup({ seed: DATA });
    typeIn('CA PHE');
    assert.equal(rows().length, 1);
    typeIn('com');
    assert.deepEqual(subs(), ['Tiền mặt · Cơm trưa với đồng nghiệp']);
    typeIn('cơm');
    assert.equal(rows().length, 1);
    typeIn('cớm');
    assert.equal(rows().length, 0);
  });

  test('chỉ tìm trong GHI CHÚ: tên danh mục, tên ví, số tiền không được tính', () => {
    setup({ seed: DATA });
    typeIn('uống'); // tên danh mục Ăn uống
    assert.equal(rows().length, 0);
    typeIn('tien mat'); // tên ví
    assert.equal(rows().length, 0);
    typeIn('45000');
    assert.equal(rows().length, 0);
    typeIn('bank');
    assert.equal(rows().length, 0);
  });

  test('nhiều từ: mọi từ phải có, thứ tự tuỳ ý', () => {
    setup({ seed: DATA });
    typeIn('trua nghiep');
    assert.equal(rows().length, 1);
    typeIn('nghiep trua');
    assert.equal(rows().length, 1);
    typeIn('trua xe');
    assert.equal(rows().length, 0);
  });

  test('tổng ròng từng ngày tính trên các dòng đang hiển thị (đã lọc)', () => {
    setup({ seed: DATA });
    typeIn('com');
    assert.deepEqual(heads(), ['Thứ Sáu, 23/10']);
    assert.deepEqual($$('.tx-day__sum').map((s) => plain(s.textContent)), ['−120.000 ₫'], 'không cộng khoản thưởng 100.000 cùng ngày');
  });

  test('xoá từ khoá → trở lại đủ danh sách', () => {
    setup({ seed: DATA });
    typeIn('phê');
    assert.equal(rows().length, 1);
    typeIn('');
    assert.equal(rows().length, 5);
    typeIn('   ');
    assert.equal(rows().length, 5, 'chỉ có khoảng trắng = không lọc');
  });

  test('từ khoá có ký tự đặc biệt / HTML không gây lỗi và không chèn được mã', () => {
    const backend = new MemoryBackend();
    const data = createDefaultData();
    data.transactions.push({ id: 'x1', type: 'expense', amount: 9_000, categoryId: F, walletId: 'wallet-cash', date: '2026-10-20', note: '<img src=x onerror="window.__xss=1"> (50%) [a]', createdAt: 'a', updatedAt: 'a' });
    data.transactions.push({ id: 'x2', type: 'expense', amount: 9_000, categoryId: F, walletId: 'wallet-cash', date: '2026-10-21', note: 'bình thường', createdAt: 'b', updatedAt: 'b' });
    backend.setItem(STORAGE_KEY, JSON.stringify(data));
    setup({ backend });
    for (const q of ['<img', '(50%)', '[a]', '.*', '\\', '"', "'", '&amp;', '<script>']) {
      assert.doesNotThrow(() => typeIn(q), q);
    }
    typeIn('<img src=x');
    assert.equal(rows().length, 1);
    assert.equal($('.tx-list img'), null);
    assert.equal(win.__xss, undefined);
    assert.equal(plain($('.tx__sub').textContent), 'Tiền mặt · <img src=x onerror="window.__xss=1"> (50%) [a]');
    assert.equal($$('.tx__mark')[0].textContent, '<img');
  });

  test('từ khoá dài quá 100 ký tự bị cắt, không lỗi', () => {
    const { search } = setup({ seed: DATA });
    typeIn('x'.repeat(5000));
    assert.equal(search.getCriteria().query.length, 100);
    search.setQuery('y'.repeat(5000));
    assert.equal(input().value.length, 100);
  });

  test('ghi chú của khoản mồ côi (danh mục / ví đã xoá) vẫn tìm được', () => {
    const backend = new MemoryBackend();
    const data = createDefaultData();
    data.transactions.push({ id: 'orphan', type: 'expense', amount: 9_000, categoryId: 'cat-ghost', walletId: 'wallet-ghost', date: '2026-10-20', note: 'mồ côi', createdAt: 'a', updatedAt: 'a' });
    backend.setItem(STORAGE_KEY, JSON.stringify(data));
    setup({ backend });
    typeIn('mo coi');
    assert.equal(rows().length, 1);
    assert.equal($('.tx__name').textContent, 'Không rõ danh mục');
  });
});

/* ================================================================== */
describe('Làm nổi từ khoá (DESIGN §10.4)', () => {
  test('đoạn khớp trong ghi chú được bọc <mark class="tx__mark">; văn bản dòng phụ không đổi', () => {
    setup({ seed: DATA });
    typeIn('phê');
    const sub = $('.tx__sub');
    assert.equal(plain(sub.textContent), 'Tiền mặt · Cà phê sáng');
    assert.deepEqual($$('mark.tx__mark', sub).map((m) => m.textContent), ['phê']);
  });

  test('gõ không dấu vẫn làm nổi đúng chữ có dấu, kể cả hoa/thường', () => {
    setup({ seed: DATA });
    typeIn('com');
    assert.deepEqual($$('.tx__mark').map((m) => m.textContent), ['Cơm']);
    typeIn('CA phe');
    assert.deepEqual($$('.tx__mark').map((m) => m.textContent), ['Cà', 'phê']);
  });

  test('tên ví không bao giờ bị làm nổi (chỉ làm nổi ghi chú)', () => {
    setup({ seed: [{ amount: 1000, categoryId: F, date: '2026-10-27', note: 'mặt tiền' }] });
    typeIn('mat');
    const marks = $$('.tx__mark').map((m) => m.textContent);
    assert.deepEqual(marks, ['mặt']);
    assert.equal(plain($('.tx__sub').textContent), 'Tiền mặt · mặt tiền');
  });

  test('không từ khoá (chỉ lọc loại/danh mục) → không có <mark>', () => {
    const { search } = setup({ seed: DATA });
    search.setType('expense');
    assert.equal($$('.tx__mark').length, 0);
    typeIn('xe');
    assert.equal($$('.tx__mark').length, 1);
    typeIn('');
    assert.equal($$('.tx__mark').length, 0);
  });

  test('nhãn đọc của dòng (aria-label) không bị ảnh hưởng bởi <mark>', () => {
    setup({ seed: DATA });
    typeIn('phe');
    assert.match(plain($('.tx__main').getAttribute('aria-label')), /^Ăn uống\. Tiền mặt · Cà phê sáng\. Chi 45\.000 ₫$/);
  });
});

/* ================================================================== */
describe('Lọc sau khi ngừng gõ 200 ms (DESIGN §10.4)', () => {
  test('hằng số độ trễ là 200 ms', () => {
    assert.equal(DEBOUNCE_MS, 200);
  });

  test('gõ xong 200ms mới lọc, và chỉ lọc một lần cho cả chuỗi gõ liên tiếp', async () => {
    const { search } = setup({ seed: DATA, searchOpts: { debounceMs: undefined } });
    let calls = 0;
    search.filter.subscribe(() => (calls += 1));
    typeIn('p');
    await sleep(60);
    typeIn('ph');
    await sleep(60);
    typeIn('phê');
    await sleep(100);
    assert.equal(rows().length, 5, 'chưa đủ 200ms kể từ lần gõ cuối');
    assert.equal(calls, 0);
    await sleep(160);
    assert.equal(rows().length, 1);
    assert.equal(calls, 1);
  });

  test('nhấn Enter lọc ngay, không chờ', () => {
    setup({ seed: DATA, searchOpts: { debounceMs: undefined } });
    typeIn('xe');
    assert.equal(rows().length, 5);
    key(input(), 'Enter');
    assert.equal(rows().length, 1);
  });

  test('rời ô tìm (blur) cũng lọc ngay; sau đó hết hạn giờ không lọc lại', async () => {
    const { search } = setup({ seed: DATA, searchOpts: { debounceMs: undefined } });
    let calls = 0;
    search.filter.subscribe(() => (calls += 1));
    typeIn('xe');
    fire(input(), 'blur');
    assert.equal(rows().length, 1);
    await sleep(260);
    assert.equal(calls, 1);
  });

  test('mở bảng lọc khi còn từ khoá chờ → từ khoá được áp dụng trước khi tính "Xem N kết quả"', () => {
    setup({ seed: DATA, searchOpts: { debounceMs: undefined } });
    typeIn('xe');
    filterBtn().click();
    assert.equal(applyBtn().textContent, 'Xem 1 kết quả');
  });

  test('đang gõ dở bằng bộ gõ tiếng Việt (composition) thì chưa lọc; gõ xong mới lọc', () => {
    setup({ seed: DATA });
    fire(input(), 'compositionstart');
    typeIn('c');
    typeIn('cơ');
    assert.equal(rows().length, 5);
    typeIn('cơm');
    fire(input(), 'compositionend');
    assert.equal(rows().length, 1);
  });

  test('xoá bằng ✕: lọc ngay, trả focus về ô tìm', () => {
    setup({ seed: DATA });
    typeIn('xe');
    assert.equal(rows().length, 1);
    $('.search__clear').click();
    assert.equal(input().value, '');
    assert.equal(rows().length, 5);
    assert.equal(document.activeElement, input());
    assert.equal($('.search__clear').hidden, true);
  });

  test('nhấn Esc trong ô tìm khi có chữ → xoá từ khoá (và không lan ra ngoài)', () => {
    setup({ seed: DATA });
    typeIn('xe');
    input().focus();
    const e = key(input(), 'Escape');
    assert.equal(e.defaultPrevented, true);
    assert.equal(input().value, '');
    assert.equal(rows().length, 5);
    const again = key(input(), 'Escape');
    assert.equal(again.defaultPrevented, false, 'ô trống: Esc để yên cho nơi khác xử lý');
  });
});

/* ================================================================== */
describe('Thanh tóm tắt kết quả', () => {
  test('"8 kết quả · −1.240.000 ₫": số khoản và chênh lệch thu − chi của kết quả', () => {
    setup({ seed: DATA });
    typeIn('xe');
    assert.equal(summaryHidden(), false);
    assert.equal(summaryText(), '1 kết quả · −40.000 ₫');
  });

  test('tô màu theo dấu: chi → expense, thu → income, 0 → trung tính', () => {
    const { search } = setup({ seed: [...DATA, { amount: 100, categoryId: F, date: '2026-10-20', note: 'cân' }, { type: 'income', amount: 100, categoryId: SAL, date: '2026-10-20', note: 'cân' }] });
    search.setType('expense');
    assert.ok($('.search__net').classList.contains('search__net--expense'));
    search.setType('income');
    assert.ok($('.search__net').classList.contains('search__net--income'));
    assert.match(summaryText(), /^3 kết quả · \+600\.100 ₫$/);
    search.setType('all');
    search.setQuery('cân');
    assert.equal(summaryText(), '2 kết quả · 0 ₫');
    assert.ok($('.search__net').classList.contains('search__net--zero'));
  });

  test('tính trên toàn bộ kết quả (không bị cắt bởi "Xem thêm") ', () => {
    const { search } = setup({ seed: DATA, listOpts: { pageSize: 2 } });
    search.setType('expense');
    assert.equal(rows().length, 2);
    assert.equal(summaryText(), '3 kết quả · −205.000 ₫');
  });

  test('chỉ hiện khi đang tìm / lọc; chỉ có bộ lọc (không từ khoá) cũng hiện', () => {
    const { search } = setup({ seed: DATA });
    assert.equal(summaryHidden(), true);
    search.toggleWallet('wallet-bank');
    assert.equal(summaryHidden(), false);
    assert.equal(summaryText(), '1 kết quả · +500.000 ₫');
    search.clear();
    assert.equal(summaryHidden(), true);
  });

  test('có vùng thông báo (aria-live) đọc kết quả cho trình đọc màn hình', () => {
    const { search } = setup({ seed: DATA });
    const live = $('.search__head [role="status"]');
    assert.equal(live.getAttribute('aria-live'), 'polite');
    assert.equal(live.textContent, '');
    search.setQuery('xe');
    assert.equal(plain(live.textContent), '1 kết quả, tổng −40.000 ₫');
    search.setQuery('zzz');
    assert.equal(live.textContent, 'Không tìm thấy khoản nào');
    search.clear();
    assert.equal(live.textContent, '');
  });

  test('thẻ tổng quan và biểu đồ vẫn theo cả tháng (DESIGN §9.2)', () => {
    const { search, charts } = setup({ seed: DATA, withCharts: true });
    const before = cardTexts();
    const modelBefore = JSON.stringify(charts.getModel());
    assert.deepEqual(before, ['+600.000 ₫', '−205.000 ₫', '+395.000 ₫']);
    search.setQuery('xe');
    search.setType('expense');
    search.toggleWallet('wallet-ewallet');
    assert.deepEqual(cardTexts(), before);
    assert.equal(JSON.stringify(charts.getModel()), modelBefore);
    search.setQuery('zzz');
    assert.deepEqual(cardTexts(), before);
    assert.equal($('.home-empty').hidden, true, 'trạng thái trống của M2 không bật vì tháng vẫn có dữ liệu');
  });
});

/* ================================================================== */
describe('Chip bộ lọc đang bật và huy hiệu nút Lọc', () => {
  test('ví dụ DESIGN: (Chi ✕) (Ăn uống ✕) → nút Lọc có huy hiệu 2, viền primary', () => {
    const { search } = setup({ seed: DATA });
    search.setType('expense');
    search.toggleCategory(F);
    assert.deepEqual(chipsList(), ['Chi', 'Ăn uống']);
    assert.equal(badge().hidden, false);
    assert.equal(badge().textContent, '2');
    assert.ok(filterBtn().classList.contains('is-active'));
    assert.equal(filterBtn().getAttribute('aria-label'), 'Bộ lọc, đang bật 2');
    assert.equal($('.search__chips').hidden, false);
    assert.equal($('.search__chips').getAttribute('aria-label'), 'Bộ lọc đang bật');
  });

  test('thứ tự chip: Loại → danh mục → ví; mỗi chip có nút ✕ với nhãn đọc rõ', () => {
    const { search } = setup({ seed: DATA });
    search.toggleWallet('wallet-bank');
    search.toggleCategory(SAL);
    search.setType('income');
    assert.deepEqual(chipsList(), ['Thu', 'Lương', 'Ngân hàng']);
    assert.deepEqual($$('.fchip__x').map((b) => b.getAttribute('aria-label')), ['Bỏ lọc loại Thu', 'Bỏ lọc danh mục Lương', 'Bỏ lọc ví Ngân hàng']);
    assert.ok($$('.fchip__x').every((b) => b.type === 'button' && $('svg', b)));
  });

  test('từ khoá không thành chip và không tính vào huy hiệu', () => {
    setup({ seed: DATA });
    typeIn('xe');
    assert.deepEqual(chipsList(), []);
    assert.equal(badge().hidden, true);
  });

  test('bấm ✕ trên chip → bỏ đúng bộ lọc đó, danh sách và huy hiệu cập nhật', () => {
    const { search } = setup({ seed: DATA });
    search.setType('expense');
    search.toggleCategory(F);
    assert.equal(rows().length, 2);
    $('[data-chip="type"] .fchip__x').click();
    assert.deepEqual(chipsList(), ['Ăn uống']);
    assert.equal(badge().textContent, '1');
    assert.equal(rows().length, 2);
    $(`[data-chip="category:${F}"] .fchip__x`).click();
    assert.deepEqual(chipsList(), []);
    assert.equal(badge().hidden, true);
    assert.equal(rows().length, 5);
    assert.equal(filterBtn().classList.contains('is-active'), false);
  });

  test('bỏ chip loại không xoá danh mục đã chọn (chỉ mở rộng phạm vi)', () => {
    const { search } = setup({ seed: DATA });
    search.setType('expense');
    search.toggleCategory(F);
    $('[data-chip="type"] .fchip__x').click();
    assert.deepEqual(search.getCriteria().categoryIds, [F]);
    assert.equal(search.getCriteria().type, 'all');
  });

  test('focus sau khi bỏ chip: sang ✕ của chip kế tiếp; chip cuối → chip trước; hết chip → nút Lọc', () => {
    const { search } = setup({ seed: DATA });
    search.setType('expense');
    search.toggleCategory(F);
    search.toggleWallet('wallet-cash');
    $('[data-chip="category:' + F + '"] .fchip__x').click();
    assert.equal(document.activeElement, $('[data-chip="wallet:wallet-cash"] .fchip__x'));
    $('[data-chip="wallet:wallet-cash"] .fchip__x').click();
    assert.equal(document.activeElement, $('[data-chip="type"] .fchip__x'));
    $('[data-chip="type"] .fchip__x').click();
    assert.equal(document.activeElement, filterBtn());
  });

  test('"Khác" của Chi và Thu được phân biệt khi Loại là Tất cả', () => {
    const { search } = setup({ seed: DATA });
    search.toggleCategory(OTHER_E);
    search.toggleCategory(OTHER_I);
    assert.deepEqual(chipsList(), ['Khác · Chi', 'Khác · Thu']);
    search.setType('income');
    assert.deepEqual(chipsList(), ['Thu', 'Khác'], 'đã chọn Loại: danh mục Chi bị bỏ, "Khác" không còn mơ hồ');
  });

  test('huy hiệu đếm đúng nhiều danh mục và ví', () => {
    const { search } = setup({ seed: DATA });
    search.toggleCategory(F);
    search.toggleCategory(T);
    search.toggleWallet('wallet-cash');
    search.toggleWallet('wallet-bank');
    search.toggleWallet('wallet-ewallet');
    assert.equal(badge().textContent, '5');
    assert.equal(filterBtn().getAttribute('aria-label'), 'Bộ lọc, đang bật 5');
  });
});

/* ================================================================== */
describe('Bảng lọc – mở, đóng, bàn phím, tiếp cận', () => {
  test('bấm nút Lọc mở bảng: hiện, aria-expanded=true, focus vào mục Loại đang chọn', () => {
    setup({ seed: DATA });
    assert.equal(panelOpen(), false);
    filterBtn().click();
    assert.equal(panelOpen(), true);
    assert.equal(filterBtn().getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, checkedRadio());
  });

  test('bấm nút Lọc lần nữa → đóng', () => {
    setup({ seed: DATA });
    filterBtn().click();
    filterBtn().click();
    assert.equal(panelOpen(), false);
    assert.equal(filterBtn().getAttribute('aria-expanded'), 'false');
  });

  test('✕ / Esc / lớp phủ mờ đều đóng và trả focus về nút Lọc', () => {
    setup({ seed: DATA });
    filterBtn().click();
    $('[aria-label="Đóng bộ lọc"]').click();
    assert.equal(panelOpen(), false);
    assert.equal(document.activeElement, filterBtn());

    filterBtn().click();
    const e = key(document.activeElement, 'Escape');
    assert.equal(e.defaultPrevented, true);
    assert.equal(panelOpen(), false);
    assert.equal(document.activeElement, filterBtn());

    filterBtn().click();
    pointerDown($('.filter-panel__scrim'));
    assert.equal(panelOpen(), false);
    assert.equal(document.activeElement, filterBtn());
  });

  test('Esc đóng bảng kể cả khi focus đang ở ngoài bảng (bấm vào chỗ trống trong bảng)', () => {
    setup({ seed: DATA });
    filterBtn().click();
    document.body.focus();
    key(document.body, 'Escape');
    assert.equal(panelOpen(), false);
  });

  test('Tab xoay vòng trong bảng (không thoát ra Trang chủ)', () => {
    setup({ seed: DATA });
    filterBtn().click();
    const items = [...$('.filter-panel__panel').querySelectorAll('button')].filter((b) => !b.disabled && b.tabIndex >= 0 && !b.closest('[hidden]'));
    const first = items[0];
    const last = items[items.length - 1];
    last.focus();
    const forward = key(last, 'Tab');
    assert.equal(forward.defaultPrevented, true);
    assert.equal(document.activeElement, first);
    const back = key(first, 'Tab', { shiftKey: true });
    assert.equal(back.defaultPrevented, true);
    assert.equal(document.activeElement, last);
  });

  test('phím mũi tên trong nhóm Loại chọn mục kế (xoay vòng); Home / End', () => {
    setup({ seed: DATA });
    filterBtn().click();
    key(checkedRadio(), 'ArrowRight');
    assert.equal(checkedRadio().dataset.filterType, 'expense');
    assert.equal(document.activeElement, checkedRadio());
    key(checkedRadio(), 'ArrowDown');
    assert.equal(checkedRadio().dataset.filterType, 'income');
    key(checkedRadio(), 'ArrowRight');
    assert.equal(checkedRadio().dataset.filterType, 'all', 'xoay vòng');
    key(checkedRadio(), 'ArrowLeft');
    assert.equal(checkedRadio().dataset.filterType, 'income');
    key(checkedRadio(), 'Home');
    assert.equal(checkedRadio().dataset.filterType, 'all');
    key(checkedRadio(), 'End');
    assert.equal(checkedRadio().dataset.filterType, 'income');
    assert.deepEqual(radios().map((r) => r.tabIndex), [-1, -1, 0], 'chỉ mục đang chọn nằm trong thứ tự Tab');
  });

  test('mọi nút chip trong bảng có aria-pressed, là <button type=button>', () => {
    setup({ seed: DATA });
    filterBtn().click();
    const chips = [...catChips(), ...walletChipEls()];
    assert.equal(chips.length, 12 + 3);
    for (const c of chips) {
      assert.equal(c.tagName, 'BUTTON');
      assert.equal(c.type, 'button');
      assert.equal(c.getAttribute('aria-pressed'), 'false');
    }
  });

  test('nhóm danh mục / ví được gắn nhãn cho trình đọc màn hình', () => {
    setup({ seed: DATA });
    filterBtn().click();
    const groups = $$('.fp__group');
    assert.deepEqual(groups.map((g) => g.getAttribute('aria-label')), ['Danh mục chi', 'Danh mục thu']);
    const wallets = $('.fp__section[data-section="wallets"] [role="group"]');
    assert.equal(document.getElementById(wallets.getAttribute('aria-labelledby')).textContent, 'Ví');
    clickType('expense');
    const single = $('.fp__group');
    assert.equal(single.getAttribute('aria-label'), null);
    assert.equal(document.getElementById(single.getAttribute('aria-labelledby')).textContent, 'Danh mục');
  });

  test('có vùng thông báo (aria-live) cho số kết quả trong bảng', () => {
    setup({ seed: DATA });
    filterBtn().click();
    const status = $('.filter-panel__panel [role="status"]');
    assert.equal(status.textContent, '5 kết quả');
    clickType('income');
    assert.equal(status.textContent, '2 kết quả');
  });
});

/* ================================================================== */
describe('Bảng lọc – danh mục đổi theo Loại', () => {
  test('Tất cả → hai nhóm Chi (8) và Thu (4), có nhãn nhóm; Chi → 8; Thu → 4', () => {
    setup({ seed: DATA });
    filterBtn().click();
    assert.equal(catChips().length, 12);
    assert.deepEqual($$('.fp__sub').map((p) => p.textContent), ['Chi', 'Thu']);
    assert.deepEqual($$('.fp__group').map((g) => $$('.chip--cat', g).length), [8, 4]);
    clickType('expense');
    assert.deepEqual(catNames(), ['Ăn uống', 'Di chuyển', 'Nhà ở', 'Mua sắm', 'Giải trí', 'Sức khoẻ', 'Học tập', 'Khác']);
    assert.equal($$('.fp__sub').length, 0, 'đã chọn Loại: không cần nhãn nhóm');
    clickType('income');
    assert.deepEqual(catNames(), ['Lương', 'Thưởng', 'Làm thêm', 'Khác']);
    clickType('all');
    assert.equal(catChips().length, 12);
  });

  test('chip danh mục có biểu tượng, tô màu theo danh mục qua biến CSS (không chèn được CSS lạ)', () => {
    setup({ seed: DATA });
    filterBtn().click();
    const c = catChip(F);
    assert.ok($('svg', c));
    assert.equal(c.getAttribute('style'), '--cat-color: var(--cat-eat);');
  });

  test('chọn nhiều danh mục (bật / tắt) → aria-pressed đổi theo', () => {
    setup({ seed: DATA });
    filterBtn().click();
    catChip(F).click();
    catChip(T).click();
    assert.ok(pressed(catChip(F)) && pressed(catChip(T)));
    catChip(F).click();
    assert.ok(!pressed(catChip(F)) && pressed(catChip(T)));
  });

  test('đổi sang Loại khác thì bỏ chọn các danh mục không thuộc loại đó', () => {
    setup({ seed: DATA });
    filterBtn().click();
    catChip(F).click();
    catChip(SAL).click();
    clickType('expense');
    assert.ok(pressed(catChip(F)));
    assert.equal(catChip(SAL), null);
    clickType('income');
    assert.equal(catChip(F), null);
    assert.ok(!pressed(catChip(SAL)), 'Lương đã bị bỏ chọn khi chuyển qua Chi và không quay lại');
    clickType('all');
    assert.ok(!pressed(catChip(F)), 'Ăn uống cũng đã bị bỏ khi chuyển qua Thu');
  });

  test('chọn danh mục "Khác" của Chi không làm sáng "Khác" của Thu', () => {
    setup({ seed: DATA });
    filterBtn().click();
    catChip(OTHER_E).click();
    assert.ok(pressed(catChip(OTHER_E)));
    assert.ok(!pressed(catChip(OTHER_I)));
  });

  test('chip ví: chọn nhiều, aria-pressed; có biểu tượng và tên ví', () => {
    setup({ seed: DATA });
    filterBtn().click();
    assert.deepEqual(walletChipEls().map((c) => $('span', c).textContent), ['Tiền mặt', 'Ngân hàng', 'Ví điện tử']);
    walletChip('wallet-cash').click();
    walletChip('wallet-bank').click();
    assert.ok(pressed(walletChip('wallet-cash')) && pressed(walletChip('wallet-bank')) && !pressed(walletChip('wallet-ewallet')));
    assert.ok(walletChip('wallet-cash').querySelector('svg'));
  });

  test('mở lại bảng: phản ánh đúng bộ lọc đang áp dụng', () => {
    const { search } = setup({ seed: DATA });
    search.setType('expense');
    search.toggleCategory(T);
    search.toggleWallet('wallet-ewallet');
    filterBtn().click();
    assert.equal(checkedRadio().dataset.filterType, 'expense');
    assert.ok(pressed(catChip(T)));
    assert.ok(!pressed(catChip(F)));
    assert.ok(pressed(walletChip('wallet-ewallet')));
    assert.equal(clearBtn().getAttribute('aria-disabled'), 'false');
  });
});

/* ================================================================== */
describe('Bảng lọc – điện thoại (bảng nháp, bấm "Xem N kết quả" mới áp dụng)', () => {
  test('chọn trong bảng chưa đổi danh sách phía sau; nút chính cập nhật "Xem N kết quả" trực tiếp', () => {
    setup({ seed: DATA });
    filterBtn().click();
    assert.equal(applyBtn().textContent, 'Xem 5 kết quả');
    clickType('expense');
    assert.equal(applyBtn().textContent, 'Xem 3 kết quả');
    catChip(F).click();
    assert.equal(applyBtn().textContent, 'Xem 2 kết quả');
    walletChip('wallet-ewallet').click();
    assert.equal(applyBtn().textContent, 'Xem 0 kết quả');
    walletChip('wallet-ewallet').click();
    walletChip('wallet-cash').click();
    assert.equal(applyBtn().textContent, 'Xem 2 kết quả');
    assert.equal(rows().length, 5, 'danh sách chưa đổi');
    assert.equal(badge().hidden, true);
    assert.equal(chipsList().length, 0);
  });

  test('"Xem 1 kết quả" khi chỉ có một khoản', () => {
    setup({ seed: DATA });
    filterBtn().click();
    clickType('income');
    catChip(SAL).click();
    assert.equal(applyBtn().textContent, 'Xem 1 kết quả');
  });

  test('bấm "Xem N kết quả" → áp dụng, đóng bảng, trả focus về nút Lọc', () => {
    const { search } = setup({ seed: DATA });
    filterBtn().click();
    clickType('expense');
    catChip(F).click();
    applyBtn().click();
    assert.equal(panelOpen(), false);
    assert.equal(document.activeElement, filterBtn());
    assert.deepEqual(search.getCriteria(), { query: '', type: 'expense', categoryIds: [F], walletIds: [] });
    assert.equal(rows().length, 2);
    assert.deepEqual(chipsList(), ['Chi', 'Ăn uống']);
    assert.equal(badge().textContent, '2');
    assert.equal(summaryText(), '2 kết quả · −165.000 ₫');
  });

  test('đóng bằng ✕ / Esc / lớp phủ mờ thì bỏ phần chưa áp dụng', () => {
    const { search } = setup({ seed: DATA });
    for (const close of [() => $('[aria-label="Đóng bộ lọc"]').click(), () => key(document.activeElement, 'Escape'), () => pointerDown($('.filter-panel__scrim'))]) {
      filterBtn().click();
      clickType('income');
      close();
      assert.equal(panelOpen(), false);
      assert.deepEqual(search.getCriteria().type, 'all');
      assert.equal(rows().length, 5);
      filterBtn().click();
      assert.equal(checkedRadio().dataset.filterType, 'all', 'mở lại: bản nháp đã bị bỏ');
      $('[aria-label="Đóng bộ lọc"]').click();
    }
  });

  test('"Xoá bộ lọc" trong bảng: vô hiệu khi chưa chọn gì; bấm thì xoá bản nháp (giữ từ khoá), cập nhật số kết quả', () => {
    const { search } = setup({ seed: DATA });
    search.setQuery('com');
    filterBtn().click();
    assert.equal(clearBtn().getAttribute('aria-disabled'), 'true');
    assert.ok(clearBtn().classList.contains('is-disabled'));
    clearBtn().click();
    assert.equal(panelOpen(), true);
    clickType('expense');
    walletChip('wallet-bank').click();
    assert.equal(clearBtn().getAttribute('aria-disabled'), 'false');
    assert.equal(applyBtn().textContent, 'Xem 0 kết quả');
    clearBtn().click();
    assert.equal(checkedRadio().dataset.filterType, 'all');
    assert.ok(!pressed(walletChip('wallet-bank')));
    assert.equal(clearBtn().getAttribute('aria-disabled'), 'true');
    assert.equal(applyBtn().textContent, 'Xem 1 kết quả', 'từ khoá "com" vẫn còn');
    assert.equal(search.getCriteria().query, 'com');
  });

  test('"Xoá bộ lọc" rồi "Xem N kết quả" → bỏ hẳn các bộ lọc đang áp dụng', () => {
    const { search } = setup({ seed: DATA });
    search.setType('expense');
    search.toggleCategory(F);
    filterBtn().click();
    clearBtn().click();
    assert.equal(rows().length, 2, 'chưa áp dụng');
    applyBtn().click();
    assert.equal(rows().length, 5);
    assert.deepEqual(search.getCriteria(), { query: '', type: 'all', categoryIds: [], walletIds: [] });
  });

  test('từ khoá thay đổi khi bảng đang mở (qua API) → số kết quả trong bảng cập nhật', () => {
    const { search } = setup({ seed: DATA });
    filterBtn().click();
    search.setQuery('com');
    assert.equal(applyBtn().textContent, 'Xem 1 kết quả');
  });

  test('bản nháp tính cả từ khoá đang có: "Xem N" = khoản khớp từ khoá VÀ bộ lọc', () => {
    const { search } = setup({ seed: DATA });
    search.setQuery('o'); // "Lương thưởng", "Xe bus"(không có o?) -> kiểm bằng tính trực tiếp
    const expectTotal = search.getResults().length;
    filterBtn().click();
    assert.equal(applyBtn().textContent, `Xem ${expectTotal} kết quả`);
    clickType('income');
    const incomeWithO = search.getResults().filter((t) => t.type === 'income').length;
    assert.equal(applyBtn().textContent, `Xem ${incomeWithO} kết quả`);
  });
});

/* ================================================================== */
describe('Bảng lọc – laptop (popover, áp dụng ngay)', () => {
  test('chọn là áp dụng ngay; nút chính đổi thành "Đóng"', () => {
    const { search } = setup({ seed: DATA, wide: true });
    filterBtn().click();
    assert.equal(applyBtn().textContent, 'Đóng');
    clickType('expense');
    assert.equal(rows().length, 3);
    assert.equal(badge().textContent, '1');
    catChip(F).click();
    assert.equal(rows().length, 2);
    assert.deepEqual(chipsList(), ['Chi', 'Ăn uống']);
    assert.equal(applyBtn().textContent, 'Đóng');
    walletChip('wallet-cash').click();
    assert.equal(rows().length, 2);
    assert.deepEqual(search.getCriteria().walletIds, ['wallet-cash']);
  });

  test('"Đóng" chỉ đóng bảng, giữ nguyên bộ lọc', () => {
    const { search } = setup({ seed: DATA, wide: true });
    filterBtn().click();
    clickType('income');
    applyBtn().click();
    assert.equal(panelOpen(), false);
    assert.equal(search.getCriteria().type, 'income');
    assert.equal(rows().length, 2);
  });

  test('đóng bằng Esc / ✕ vẫn giữ bộ lọc đã chọn', () => {
    const { search } = setup({ seed: DATA, wide: true });
    filterBtn().click();
    clickType('income');
    key(document.activeElement, 'Escape');
    assert.equal(panelOpen(), false);
    assert.equal(search.getCriteria().type, 'income');
  });

  test('bấm ra ngoài bảng thì đóng (không đòi lại focus); bấm trong bảng hoặc nút Lọc không đóng', () => {
    setup({ seed: DATA, wide: true });
    filterBtn().click();
    pointerDown($('.filter-panel__panel'));
    assert.equal(panelOpen(), true);
    pointerDown($('svg', filterBtn()));
    assert.equal(panelOpen(), true, 'nút Lọc tự lo việc bật/tắt');
    input().focus();
    pointerDown($('.home__main'));
    assert.equal(panelOpen(), false);
    assert.equal(document.activeElement, input(), 'focus ở lại nơi người dùng vừa chọn');
  });

  test('bỏ chip khi popover đang mở → bảng đồng bộ theo', () => {
    const { search } = setup({ seed: DATA, wide: true });
    search.setType('expense');
    search.toggleCategory(F);
    filterBtn().click();
    $(`[data-chip="category:${F}"] .fchip__x`).click();
    assert.ok(!pressed(catChip(F)));
    assert.equal(checkedRadio().dataset.filterType, 'expense');
  });

  test('popover neo dưới nút Lọc, rộng tối đa trong khung nhìn', () => {
    setup({ seed: DATA, wide: true });
    const btn = filterBtn();
    btn.getBoundingClientRect = () => ({ left: 800, right: 900, top: 60, bottom: 104, width: 100, height: 44 });
    filterBtn().click();
    const style = panelRoot().style;
    assert.equal(style.getPropertyValue('--fp-left'), '540px', 'căn phải với nút Lọc');
    assert.equal(style.getPropertyValue('--fp-top'), '108px');
    btn.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 44, width: 100, height: 44 });
    fire(window, 'resize');
    assert.equal(style.getPropertyValue('--fp-left'), '8px', 'không tràn ra mép trái');
    btn.getBoundingClientRect = () => ({ left: 1000, right: 1100, top: 0, bottom: 44, width: 100, height: 44 });
    fire(window, 'resize');
    assert.equal(style.getPropertyValue('--fp-left'), '656px', 'không tràn ra mép phải (khung nhìn 1024 − 360 − 8)');
  });

  test('đổi cỡ màn hình giữa lúc mở: nhãn nút chính đổi theo bố cục', () => {
    const { state } = setup({ seed: DATA });
    filterBtn().click();
    assert.equal(applyBtn().textContent, 'Xem 5 kết quả');
    state.wide = true;
    fire(window, 'resize');
    assert.equal(applyBtn().textContent, 'Đóng');
  });
});

/* ================================================================== */
describe('Không có kết quả (DESIGN §9.2)', () => {
  test('hiện "Không tìm thấy khoản nào" + nút Xoá bộ lọc; danh sách và tóm tắt ẩn', () => {
    setup({ seed: DATA });
    typeIn('zzz');
    assert.equal(emptyBox().hidden, false);
    assert.equal($('.search__empty-title').textContent, 'Không tìm thấy khoản nào');
    assert.equal($('.btn', emptyBox()).textContent, 'Xoá bộ lọc');
    assert.equal(rows().length, 0);
    assert.equal(summaryHidden(), true);
    assert.equal($('.tx-list'), null);
  });

  test('chỉ có bộ lọc cũng ra trạng thái này; thẻ tổng quan không đổi', () => {
    const { search } = setup({ seed: DATA });
    const cards = cardTexts();
    search.setType('income');
    search.toggleCategory(SAL);
    search.toggleWallet('wallet-cash'); // lương không nằm ở ví tiền mặt
    assert.equal(emptyBox().hidden, false);
    assert.deepEqual(cardTexts(), cards);
  });

  test('bấm "Xoá bộ lọc" → xoá cả từ khoá lẫn mọi bộ lọc, danh sách trở lại, focus về nút Lọc', () => {
    const { search } = setup({ seed: DATA });
    search.setType('income');
    typeIn('zzz');
    assert.equal(emptyBox().hidden, false);
    $('.btn', emptyBox()).click();
    assert.equal(input().value, '');
    assert.deepEqual(search.getCriteria(), { query: '', type: 'all', categoryIds: [], walletIds: [] });
    assert.equal(emptyBox().hidden, true);
    assert.equal(rows().length, 5);
    assert.equal(document.activeElement, filterBtn());
    assert.deepEqual(chipsList(), []);
    assert.equal($('.search__clear').hidden, true);
  });

  test('thêm khoản khớp bộ lọc khi đang "không tìm thấy" → danh sách hiện lại', () => {
    const { repo } = setup({ seed: DATA });
    typeIn('lẩu');
    assert.equal(emptyBox().hidden, false);
    repo.add(validInput({ note: 'Đi ăn lẩu', date: '2026-10-27' }));
    assert.equal(emptyBox().hidden, true);
    assert.equal(rows().length, 1);
  });

  test('tháng không có giao dịch nào: rút khối tìm/lọc khỏi ô, Trang chủ (M2) tự hiện trạng thái trống', () => {
    const { home, search } = setup({ seed: DATA });
    search.setQuery('com');
    home.month.prev(); // 09/2026: chưa có gì
    assert.equal(home.slots.list.childElementCount, 0);
    assert.equal($('.search'), null);
    assert.equal($('.home-empty').hidden, false);
    assert.equal($('.home-empty__title').textContent, 'Tháng này chưa có khoản nào');
    home.month.next();
    assert.equal(home.slots.list.childElementCount, 1);
    assert.equal(input().value, 'com', 'từ khoá vẫn còn khi quay lại');
    assert.equal(rows().length, 1);
  });

  test('ô trống hoàn toàn (chưa có giao dịch nào): không có khối tìm/lọc', () => {
    const { home } = setup();
    assert.equal(home.slots.list.childElementCount, 0);
    assert.equal($('.search'), null);
  });
});

/* ================================================================== */
describe('Đổi tháng và dữ liệu thay đổi', () => {
  test('bộ lọc và từ khoá được giữ khi đổi tháng, áp lên dữ liệu tháng mới', () => {
    const { home, search } = setup({ seed: [...DATA, { amount: 70_000, categoryId: F, date: '2026-09-15', note: 'cơm tối tháng trước' }, { amount: 9_000, categoryId: T, date: '2026-09-16', note: 'xe' }] });
    search.setQuery('com');
    search.setType('expense');
    assert.equal(rows().length, 1);
    home.month.prev();
    assert.equal(input().value, 'com');
    assert.deepEqual(subs(), ['Tiền mặt · cơm tối tháng trước']);
    assert.equal(summaryText(), '1 kết quả · −70.000 ₫');
    assert.deepEqual(chipsList(), ['Chi']);
    home.month.next();
    assert.deepEqual(subs(), ['Tiền mặt · Cơm trưa với đồng nghiệp']);
  });

  test('thêm khoản mới khớp → xuất hiện ngay; không khớp → không; tóm tắt cập nhật', () => {
    const { repo } = setup({ seed: DATA });
    typeIn('com');
    assert.equal(summaryText(), '1 kết quả · −120.000 ₫');
    repo.add(validInput({ note: 'Cơm tấm', amount: 35_000, date: '2026-10-27' }));
    assert.equal(rows().length, 2);
    assert.equal(summaryText(), '2 kết quả · −155.000 ₫');
    repo.add(validInput({ note: 'Trà sữa', amount: 35_000, date: '2026-10-27' }));
    assert.equal(rows().length, 2);
  });

  test('sửa ghi chú: khoản vào / ra khỏi kết quả đúng lúc', () => {
    const { repo, added } = setup({ seed: DATA });
    typeIn('com');
    assert.equal(rows().length, 1);
    repo.update(added[1].id, validInput({ type: 'expense', categoryId: T, walletId: 'wallet-ewallet', amount: 40_000, date: '2026-10-27', note: 'Xe bus đi cơm' }));
    assert.equal(rows().length, 2);
    repo.update(added[3].id, validInput({ date: '2026-10-23', amount: 120_000, note: 'Đã đổi' }));
    assert.equal(rows().length, 1);
  });

  test('xoá khoản đang hiển thị → biến mất, tóm tắt đổi; Hoàn tác → trở lại', () => {
    const { repo, added, toast } = setup({ seed: DATA });
    typeIn('com');
    const target = added[3];
    $('.tx__main', $(`.tx[data-tx-id="${target.id}"]`)).focus();
    const res = repo.remove(target.id);
    assert.equal(res.ok, true);
    assert.equal(rows().length, 0);
    assert.equal(emptyBox().hidden, false);
    repo.restore(res.transaction);
    assert.equal(rows().length, 1);
    assert.equal(emptyBox().hidden, true);
    assert.ok(toast);
  });

  test('xoá khoản cuối của cả tháng khi đang lọc → khối tìm/lọc biến mất, trạng thái trống của M2 hiện', () => {
    const { repo, added, home } = setup({ seed: [DATA[0]] });
    typeIn('phe');
    repo.remove(added[0].id);
    assert.equal(home.slots.list.childElementCount, 0);
    assert.equal($('.home-empty').hidden, false);
  });

  test('danh mục / ví không còn tồn tại thì bị bỏ khỏi bộ lọc khi dữ liệu đổi', () => {
    const { repo, search } = setup({ seed: DATA });
    search.toggleCategory(F);
    search.toggleWallet('wallet-bank');
    assert.equal(rows().length, 0);
    const realCats = repo.getCategories;
    const realWallets = repo.getWallets;
    repo.getCategories = (t) => realCats(t).filter((c) => c.id !== F);
    repo.getWallets = () => realWallets().filter((w) => w.id !== 'wallet-bank');
    repo.add(validInput({ note: 'kích hoạt', date: '2026-10-27' }));
    assert.deepEqual(search.getCriteria(), { query: '', type: 'all', categoryIds: [], walletIds: [] });
    assert.deepEqual(chipsList(), []);
    assert.equal(rows().length, 6);
  });
});

/* ================================================================== */
describe('Tương tác với danh sách giao dịch (M3)', () => {
  test('chạm dòng trong kết quả → mở sửa đúng khoản', () => {
    const calls = [];
    const { added } = setup({ seed: DATA, listOpts: { onEdit: (id) => calls.push(id) } });
    typeIn('xe');
    $('.tx__main').click();
    assert.deepEqual(calls, [added[1].id]);
  });

  test('xoá nhanh một khoản trong kết quả (có xác nhận), tóm tắt cập nhật', async () => {
    const { repo, added } = setup({ seed: DATA });
    typeIn('o'); // khớp nhiều khoản
    const before = rows().length;
    assert.ok(before >= 2);
    const id = $('.tx').dataset.txId;
    $('[data-action="tool-delete"]', $(`.tx[data-tx-id="${id}"]`)).click();
    $('.confirm__actions .btn--danger').click();
    await sleep(10);
    assert.equal(repo.getTransaction(id), null);
    assert.equal(rows().length, before - 1);
    assert.ok(added.length);
  });

  test('"Xem thêm": đổi bộ lọc thì quay lại trang đầu', () => {
    const backend = new MemoryBackend();
    const data = createDefaultData();
    for (let i = 0; i < 7; i += 1) data.transactions.push({ id: `p${i}`, type: 'expense', amount: 1000 + i, categoryId: F, walletId: 'wallet-cash', date: '2026-10-20', note: `món ${i}`, createdAt: `2026-10-20T00:00:0${i}.000Z`, updatedAt: 'x' });
    backend.setItem(STORAGE_KEY, JSON.stringify(data));
    const { search } = setup({ backend, listOpts: { pageSize: 3 } });
    assert.equal(rows().length, 3);
    $('[data-action="show-more"]').click();
    assert.equal(rows().length, 6);
    search.setQuery('mon');
    assert.equal(rows().length, 3, 'đổi từ khoá → trang đầu');
    $('[data-action="show-more"]').click();
    assert.equal(rows().length, 6);
    search.toggleCategory(F);
    assert.equal(rows().length, 3, 'đổi bộ lọc → trang đầu');
  });

  test('mountTransactionList không có bộ lọc vẫn chạy như cũ (hợp đồng M3 không đổi)', () => {
    const { repo } = makeRepo();
    repo.add(validInput({ date: '2026-10-27' }));
    const home = mountHome({ repo, animate: false, now: makeClock() });
    const list = mountTransactionList({ repo, home, animate: false, now: makeClock(), toast: createToastHost() });
    cleanups.push(() => (list.destroy(), home.destroy()));
    assert.equal(list.visibleCount(), 1);
    assert.equal($('.tx__mark'), null);
  });

  test('bộ lọc tối giản chỉ có apply() cũng dùng được (ranges / subscribe là tuỳ chọn)', () => {
    const { repo } = makeRepo({ now: makeClock() });
    repo.add(validInput({ note: 'a', date: '2026-10-27' }));
    repo.add(validInput({ note: 'b', date: '2026-10-27' }));
    const home = mountHome({ repo, animate: false, now: makeClock() });
    const list = mountTransactionList({ repo, home, animate: false, now: makeClock(), toast: createToastHost(), filter: { apply: (l) => l.filter((t) => t.note === 'b') } });
    cleanups.push(() => (list.destroy(), home.destroy()));
    assert.equal(list.visibleCount(), 1);
    assert.equal(plain($('.tx__sub').textContent), 'Tiền mặt · b');
  });

  test('huỷ M3 thì thôi nghe bộ lọc', () => {
    const { search, list } = setup({ seed: DATA });
    list.destroy();
    assert.doesNotThrow(() => search.setQuery('xe'));
  });
});

/* ================================================================== */
describe('Giao diện lập trình (API)', () => {
  test('getCriteria trả bản sao; sửa bản sao không ảnh hưởng', () => {
    const { search } = setup({ seed: DATA });
    search.toggleCategory(F);
    const c = search.getCriteria();
    c.categoryIds.push('x');
    c.type = 'income';
    assert.deepEqual(search.getCriteria().categoryIds, [F]);
    assert.equal(search.getCriteria().type, 'all');
  });

  test('getResults / getSummary phản ánh danh sách đã lọc', () => {
    const { search } = setup({ seed: DATA });
    search.setType('expense');
    assert.equal(search.getResults().length, 3);
    assert.deepEqual(search.getSummary(), { count: 3, income: 0, expense: 205_000, net: -205_000 });
  });

  test('setCriteria chuẩn hoá dữ liệu bậy và cập nhật ô tìm', () => {
    const { search } = setup({ seed: DATA });
    search.setCriteria({ query: '  xe  ', type: 'expense', categoryIds: [T, T, 'ma', 5], walletIds: ['wallet-ewallet', null] });
    assert.deepEqual(search.getCriteria(), { query: 'xe', type: 'expense', categoryIds: [T], walletIds: ['wallet-ewallet'] });
    assert.equal(input().value, 'xe');
    assert.equal(rows().length, 1);
    search.setCriteria(null);
    assert.equal(rows().length, 5);
    assert.equal(input().value, '');
  });

  test('setType / toggleCategory lệch loại: danh mục sai loại bị loại ngay', () => {
    const { search } = setup({ seed: DATA });
    search.setType('income');
    assert.equal(search.toggleCategory(F), false, 'Ăn uống là khoản chi, không thể chọn khi lọc Thu');
    assert.deepEqual(search.getCriteria().categoryIds, []);
    search.setType('all');
    search.toggleCategory(F);
    search.setType('income');
    assert.deepEqual(search.getCriteria().categoryIds, []);
    assert.equal(search.toggleCategory('cat-ma'), false);
    assert.equal(search.toggleWallet('ví-ma'), false);
  });

  test('onChange được gọi khi (và chỉ khi) tiêu chí thật sự đổi', () => {
    const seen = [];
    const { search } = setup({ seed: DATA, searchOpts: { onChange: (c) => seen.push(c) } });
    search.setQuery('xe');
    search.setQuery('xe');
    search.setType('all');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].query, 'xe');
    search.clearFilters();
    assert.equal(seen.length, 1);
    search.setType('expense');
    search.clearFilters();
    assert.equal(seen.length, 3);
    assert.equal(seen[2].type, 'all');
    assert.equal(seen[2].query, 'xe', 'clearFilters giữ từ khoá');
  });

  test('filter.isActive / apply / ranges (hợp đồng với M3)', () => {
    const { search, repo } = setup({ seed: DATA });
    assert.equal(search.filter.isActive(), false);
    const list = repo.listByMonth('2026-10');
    assert.equal(search.filter.apply(list), list);
    search.setQuery('xe');
    assert.equal(search.filter.isActive(), true);
    assert.equal(search.filter.apply(list).length, 1);
    assert.deepEqual(search.filter.ranges('Xe bus'), [[0, 2]]);
  });

  test('một người nghe bị lỗi không làm hỏng việc lọc', () => {
    const { search } = setup({ seed: DATA });
    const original = console.error;
    console.error = () => {};
    search.filter.subscribe(() => {
      throw new Error('boom');
    });
    assert.doesNotThrow(() => search.setQuery('xe'));
    console.error = original;
    assert.equal(rows().length, 1);
  });

  test('huỷ đăng ký người nghe', () => {
    const { search } = setup({ seed: DATA });
    let n = 0;
    const off = search.filter.subscribe(() => (n += 1));
    search.setQuery('xe');
    off();
    search.setQuery('com');
    assert.equal(n, 1);
  });

  test('destroy: gỡ khối tìm/lọc và bảng lọc, dừng mọi lắng nghe và hẹn giờ', async () => {
    const { search, repo } = setup({ seed: DATA, searchOpts: { debounceMs: undefined } });
    let calls = 0;
    search.filter.subscribe(() => (calls += 1));
    filterBtn().click();
    typeIn('xe'); // chưa đủ 200ms: còn hẹn giờ lọc
    search.destroy();
    assert.equal($('.search'), null);
    assert.equal(panelRoot(), null);
    await sleep(260);
    assert.equal(calls, 0, 'hẹn giờ đã bị huỷ');
    assert.doesNotThrow(() => repo.add(validInput({ date: '2026-10-27' })));
    assert.doesNotThrow(() => search.destroy());
    assert.doesNotThrow(() => key(document.body, 'Escape'));
  });

  test('mount hai lần liên tiếp (sau destroy) hoạt động bình thường', () => {
    const first = setup({ seed: DATA });
    first.search.setQuery('xe');
    cleanups.pop()();
    document.body.replaceChildren();
    setup({ seed: DATA });
    assert.equal(rows().length, 5);
  });
});

/* ================================================================== */
describe('Hiệu năng với nhiều giao dịch', () => {
  function bulk(count) {
    const data = createDefaultData();
    for (let i = 0; i < count; i += 1) {
      const day = String((i % 27) + 1).padStart(2, '0');
      data.transactions.push({ id: `b${i}`, type: i % 5 === 0 ? 'income' : 'expense', amount: 1000 + i, categoryId: i % 5 === 0 ? SAL : i % 2 ? F : T, walletId: i % 3 ? 'wallet-cash' : 'wallet-bank', date: `2026-10-${day}`, note: i % 4 === 0 ? `cà phê số ${i}` : i % 4 === 1 ? 'ăn trưa văn phòng' : '', createdAt: `2026-10-${day}T00:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`, updatedAt: 'x' });
    }
    return new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) });
  }

  test('5.000 giao dịch: gõ từ khoá, chọn bộ lọc, xoá bộ lọc đều nhanh và chỉ vẽ trang đầu', () => {
    const { search } = setup({ backend: bulk(5000) });
    let t = performance.now();
    search.setQuery('ca phe');
    const keyword = performance.now() - t;
    assert.equal(rows().length, 150);
    assert.match(summaryText(), /^1\.250 kết quả/, 'số ≥ 1.000 có dấu chấm ngăn cách');
    filterBtn().click();
    assert.equal(applyBtn().textContent, 'Xem 1.250 kết quả');
    $('[aria-label="Đóng bộ lọc"]').click();
    t = performance.now();
    search.setType('expense');
    search.toggleWallet('wallet-bank');
    const filters = performance.now() - t;
    t = performance.now();
    search.clear();
    const cleared = performance.now() - t;
    assert.equal(rows().length, 150);
    for (const [name, ms] of Object.entries({ keyword, filters, cleared })) assert.ok(ms < 1500, `${name}: ${ms.toFixed(0)} ms`);
  });
});
