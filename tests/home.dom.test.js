import { win } from './dom-env.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mountHome } from '../src/ui/home.js';
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
const typeInto = (input, value) => {
  input.value = value;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
};

const label = () => $('.month-bar__text').textContent;
const card = (kind) => $(`.card[data-kind="${kind}"]`);
const full = (kind) => plain($('.card__value--full', card(kind)).textContent);
const compact = (kind) => plain($('.card__value--compact', card(kind)).textContent);
const aria = (kind) => plain(card(kind).getAttribute('aria-label'));
const prevBtn = () => $('[data-action="prev-month"]');
const nextBtn = () => $('[data-action="next-month"]');
const emptyShown = () => !$('.home-empty').hidden;

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
  document.body.replaceChildren();
  document.documentElement.className = '';
});

/** plan: [type, categoryId, amount, date] */
const INCOME = 'cat-income-salary';
const FOOD = 'cat-expense-food';
const HOME_CAT = 'cat-expense-home';

function setup({ backend = new MemoryBackend(), now = makeClock(), seed = [], mount = {} } = {}) {
  const { repo } = makeRepo({ backend, now });
  for (const [type, categoryId, amount, date] of seed) {
    const r = repo.add(validInput({ type, categoryId, amount, date }));
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  const calls = { month: [], settings: 0, entry: [] };
  const home = mountHome({
    repo,
    now,
    animate: false,
    onMonthChange: (ym) => calls.month.push(ym),
    ...mount,
  });
  cleanups.push(() => home.destroy());
  return { repo, backend, now, home, calls };
}

const OCT = [
  ['income', INCOME, 18_500_000, '2026-10-01'],
  ['expense', FOOD, 45_000, '2026-10-27'],
  ['expense', HOME_CAT, 12_255_000, '2026-10-05'],
];

/* ================================================================== */
describe('Hiển thị ban đầu', () => {
  test('tháng hiện tại, ◀ dùng được, ▶ bị vô hiệu, 3 thẻ đều "0 ₫", có trạng thái trống', () => {
    const { home } = setup();
    assert.equal(label(), 'Tháng 10/2026');
    assert.equal($('.home').dataset.month, '2026-10');
    assert.equal(prevBtn().disabled, false);
    assert.equal(nextBtn().disabled, true);
    assert.deepEqual($$('.card').map((c) => c.dataset.kind), ['income', 'expense', 'balance']);
    assert.deepEqual($$('.card__label').map((l) => l.textContent), ['Thu', 'Chi', 'Số dư']);
    for (const k of ['income', 'expense', 'balance']) assert.equal(full(k), '0 ₫', k);
    assert.equal(emptyShown(), true);
    assert.equal($('.home-empty__title').textContent, 'Chưa có khoản nào trong tháng này');
    assert.equal($('[data-action="add-first"]').textContent, 'Thêm khoản đầu tiên');
    assert.equal(home.month.get(), '2026-10');
  });

  test('bố cục theo DESIGN: thanh tháng → tổng quan → ô biểu đồ/danh sách → nút ＋', () => {
    setup();
    const root = $('.home');
    assert.deepEqual([...root.children].map((c) => c.className.split(' ')[0]), ['month-bar', 'home__main', 'fab', 'month-picker']);
    assert.deepEqual([...$('.home__main').children].map((c) => c.className.split(' ')[0]), ['home__banners', 'summary', 'home-empty', 'home__grid']);
    assert.deepEqual($$('.home__slot').map((s) => s.dataset.slot), ['charts', 'list']);
    assert.equal($('.fab').getAttribute('aria-label'), 'Thêm khoản');
    assert.equal($('.month-bar').tagName, 'HEADER');
  });

  test('tháng khởi tạo tuỳ chọn; giá trị sai/tương lai rơi về tháng hiện tại', () => {
    setup({ mount: { initialMonth: '2026-03' } });
    assert.equal(label(), 'Tháng 3/2026');
    document.body.replaceChildren();
    setup({ mount: { initialMonth: '2027-01' } });
    assert.equal(label(), 'Tháng 10/2026');
  });

  test('tiêu đề vùng tổng quan cho trình đọc màn hình', () => {
    setup();
    const region = $('.summary');
    const title = document.getElementById(region.getAttribute('aria-labelledby'));
    assert.equal(title.textContent, 'Tổng quan tháng 10/2026');
    assert.ok(title.classList.contains('sr-only'));
    $('[data-action="prev-month"]').click();
    assert.equal(title.textContent, 'Tổng quan tháng 9/2026');
  });
});

/* ================================================================== */
describe('Thẻ tổng quan', () => {
  test('Thu / Chi / Số dư đúng, có dấu +/−, đủ và rút gọn', () => {
    setup({ seed: OCT });
    assert.equal(full('income'), '+18.500.000 ₫');
    assert.equal(full('expense'), '−12.300.000 ₫');
    assert.equal(full('balance'), '+6.200.000 ₫');
    assert.equal(compact('income'), '+18,5tr');
    assert.equal(compact('expense'), '−12,3tr');
    assert.equal(compact('balance'), '+6,2tr');
    assert.equal(emptyShown(), false);
    assert.equal(card('balance').hasAttribute('data-negative'), false);
  });

  test('mỗi thẻ có nhãn đọc đầy đủ cho trình đọc màn hình; nội dung trực quan ẩn khỏi cây truy cập', () => {
    setup({ seed: OCT });
    assert.equal(aria('income'), 'Thu: 18.500.000 ₫');
    assert.equal(aria('expense'), 'Chi: 12.300.000 ₫');
    assert.equal(aria('balance'), 'Số dư: 6.200.000 ₫');
    for (const c of $$('.card')) {
      assert.equal(c.getAttribute('role'), 'group');
      assert.equal(c.tabIndex, 0);
      for (const child of c.children) assert.equal(child.getAttribute('aria-hidden'), 'true');
    }
  });

  test('số dư âm: dấu −, thuộc tính data-negative chỉ trên thẻ Số dư, nhãn đọc "âm"', () => {
    setup({ seed: [['income', INCOME, 100_000, '2026-10-01'], ['expense', FOOD, 3_200_000, '2026-10-02']] });
    assert.equal(full('balance'), '−3.100.000 ₫');
    assert.equal(compact('balance'), '−3,1tr');
    assert.equal(card('balance').hasAttribute('data-negative'), true);
    assert.equal(card('income').hasAttribute('data-negative'), false);
    assert.equal(card('expense').hasAttribute('data-negative'), false);
    assert.equal(aria('balance'), 'Số dư: âm 3.100.000 ₫');
  });

  test('chỉ có thu: Chi = 0 ₫ không dấu; thu = chi: số dư 0 ₫', () => {
    setup({ seed: [['income', INCOME, 500_000, '2026-10-01']] });
    assert.equal(full('expense'), '0 ₫');
    assert.equal(full('balance'), '+500.000 ₫');
    document.body.replaceChildren();
    setup({ seed: [['income', INCOME, 500_000, '2026-10-01'], ['expense', FOOD, 500_000, '2026-10-02']] });
    assert.equal(full('balance'), '0 ₫');
    assert.equal(card('balance').hasAttribute('data-negative'), false);
  });

  test('số rất lớn được đánh dấu data-long (luôn rút gọn)', () => {
    setup({ seed: [['income', INCOME, 999_999_999_999, '2026-10-01'], ['expense', FOOD, 45_000, '2026-10-02']] });
    assert.equal(card('income').hasAttribute('data-long'), true);
    assert.equal(card('expense').hasAttribute('data-long'), false);
    assert.equal(compact('income'), '+1.000 tỷ');
  });

  test('--chars phản ánh độ dài chuỗi rút gọn để CSS co cỡ chữ cho vừa thẻ', () => {
    setup({ seed: OCT });
    assert.equal(card('income').style.getPropertyValue('--chars'), String('+18,5tr'.length));
    assert.equal(card('balance').style.getPropertyValue('--chars'), String('+6,2tr'.length));
  });

  test('--cols chia cột theo độ dài chữ, Số dư luôn rộng hơn; số rất dài được nhiều chỗ hơn', () => {
    setup({ seed: OCT });
    const cols = () => $('.summary').style.getPropertyValue('--cols').split(' ').map((c) => parseFloat(c));
    const [a, b, c] = cols();
    assert.equal(a, b);
    assert.ok(c > a - 1, `Số dư ${c} phải ≥ Thu ${a}`);
    document.body.replaceChildren();
    setup({ seed: [['income', INCOME, 999_999_999_999, '2026-10-01'], ['expense', FOOD, 45_000, '2026-10-02']] });
    const [wide, narrow] = cols();
    assert.ok(wide > narrow, `${wide} > ${narrow}`);
    document.body.replaceChildren();
    setup();
    assert.ok(cols().every((n) => n >= 5), 'tháng trống không co thẻ quá nhỏ');
  });

  test('chạm vào thẻ hiện số đầy đủ (peek); chạm lại hoặc chạm thẻ khác thì chuyển/ẩn; Enter/Space cũng được', () => {
    setup({ seed: OCT });
    const tipText = (k) => plain($('.card__tip', card(k)).textContent);
    assert.equal(tipText('income'), '+18.500.000 ₫');
    card('income').click();
    assert.equal(card('income').classList.contains('is-peek'), true);
    card('expense').click();
    assert.equal(card('income').classList.contains('is-peek'), false);
    assert.equal(card('expense').classList.contains('is-peek'), true);
    card('expense').click();
    assert.equal(card('expense').classList.contains('is-peek'), false);
    assert.equal(key(card('balance'), 'Enter').defaultPrevented, true);
    assert.equal(card('balance').classList.contains('is-peek'), true);
    key(card('balance'), ' ');
    assert.equal(card('balance').classList.contains('is-peek'), false);
    key(card('balance'), 'a');
    assert.equal(card('balance').classList.contains('is-peek'), false);
  });

  test('đổi tháng thì tắt số đầy đủ đang hiện của tháng cũ', () => {
    setup({ seed: OCT });
    card('income').click();
    assert.equal(card('income').classList.contains('is-peek'), true);
    prevBtn().click();
    assert.equal(card('income').classList.contains('is-peek'), false);
  });

  test('chỉ tính giao dịch của tháng đang xem (ranh giới đầu/cuối tháng)', () => {
    setup({
      seed: [
        ['expense', FOOD, 1, '2026-09-30'],
        ['expense', FOOD, 10, '2026-10-01'],
        ['expense', FOOD, 100, '2026-10-27'],
        ['income', INCOME, 7, '2026-08-31'],
      ],
    });
    assert.equal(full('expense'), '−110 ₫');
    assert.equal(full('income'), '0 ₫');
  });
});

/* ================================================================== */
describe('Chuyển tháng', () => {
  const data = [
    ...OCT,
    ['expense', FOOD, 200_000, '2026-09-15'],
    ['income', INCOME, 1_000_000, '2026-09-01'],
    ['expense', FOOD, 5_000, '2025-12-31'],
  ];

  test('◀ đi lùi từng tháng, số liệu đổi theo; ▶ quay lại và bị vô hiệu ở tháng hiện tại', () => {
    const { calls } = setup({ seed: data });
    prevBtn().click();
    assert.equal(label(), 'Tháng 9/2026');
    assert.equal(full('income'), '+1.000.000 ₫');
    assert.equal(full('expense'), '−200.000 ₫');
    assert.equal(full('balance'), '+800.000 ₫');
    assert.equal(nextBtn().disabled, false);
    nextBtn().click();
    assert.equal(label(), 'Tháng 10/2026');
    assert.equal(nextBtn().disabled, true);
    nextBtn().click(); // đã vô hiệu: không đi tiếp
    assert.equal(label(), 'Tháng 10/2026');
    assert.deepEqual(calls.month, ['2026-09', '2026-10']);
  });

  test('qua ranh giới năm: 1/2026 ◀ → 12/2025', () => {
    setup({ seed: data, mount: { initialMonth: '2026-01' } });
    prevBtn().click();
    assert.equal(label(), 'Tháng 12/2025');
    assert.equal(full('expense'), '−5.000 ₫');
    nextBtn().click();
    assert.equal(label(), 'Tháng 1/2026');
  });

  test('tháng không có dữ liệu: thẻ về 0 và hiện thông báo "Tháng này chưa có khoản nào" (khi nơi khác có dữ liệu)', () => {
    setup({ seed: data });
    assert.equal(emptyShown(), false);
    prevBtn().click();
    prevBtn().click(); // 2026-08
    assert.equal(label(), 'Tháng 8/2026');
    assert.equal(full('income'), '0 ₫');
    assert.equal(emptyShown(), true);
    assert.equal($('.home-empty__title').textContent, 'Tháng này chưa có khoản nào');
  });

  test('◀ bị vô hiệu ở tháng nhỏ nhất (1/2000)', () => {
    setup({ mount: { initialMonth: '2000-02' } });
    prevBtn().click();
    assert.equal(label(), 'Tháng 1/2000');
    assert.equal(prevBtn().disabled, true);
    prevBtn().click();
    assert.equal(label(), 'Tháng 1/2000');
  });

  test('API setMonth: nhận tháng hợp lệ, từ chối tương lai/sai và gọi onMonthChange đúng lần', () => {
    const { home, calls } = setup({ seed: data });
    assert.equal(home.setMonth('2026-02'), true);
    assert.equal(label(), 'Tháng 2/2026');
    assert.equal(home.setMonth('2026-11'), false);
    assert.equal(home.setMonth('hello'), false);
    assert.equal(home.setMonth('2026-02'), true); // trùng tháng đang xem: không phát sự kiện
    assert.deepEqual(calls.month, ['2026-02']);
  });

  test('module khác đăng ký theo dõi tháng qua home.month.subscribe', () => {
    const { home } = setup();
    const seen = [];
    home.month.subscribe((n, o) => seen.push([n, o]));
    prevBtn().click();
    assert.deepEqual(seen, [['2026-09', '2026-10']]);
  });

  test('nhãn tháng có aria-live để đọc khi đổi tháng', () => {
    setup();
    assert.equal($('.month-bar__text').getAttribute('aria-live'), 'polite');
    assert.equal($('[data-action="prev-month"]').getAttribute('aria-label'), 'Tháng trước');
    assert.equal($('[data-action="next-month"]').getAttribute('aria-label'), 'Tháng sau');
  });

  test('có hiệu ứng: số đếm tới đúng giá trị cuối và thẻ có lớp is-updating', async () => {
    const { home } = setup({ seed: data, mount: { animate: true } });
    prevBtn().click();
    assert.ok(card('income').classList.contains('is-updating'));
    await sleep(500);
    assert.equal(full('income'), '+1.000.000 ₫');
    assert.equal(full('expense'), '−200.000 ₫');
    assert.equal(full('balance'), '+800.000 ₫');
    assert.equal(home.month.get(), '2026-09');
  });

  test('đổi tháng liên tiếp rất nhanh khi đang chạy hiệu ứng: kết quả cuối luôn đúng', async () => {
    setup({ seed: data, mount: { animate: true } });
    prevBtn().click();
    prevBtn().click();
    nextBtn().click();
    await sleep(500);
    assert.equal(label(), 'Tháng 9/2026');
    assert.equal(full('income'), '+1.000.000 ₫');
    assert.equal(full('expense'), '−200.000 ₫');
  });
});

/* ================================================================== */
describe('Cập nhật khi dữ liệu thay đổi', () => {
  test('thêm / sửa / xoá / hoàn tác qua kho dữ liệu → thẻ và trạng thái trống đổi ngay', () => {
    const { repo } = setup();
    assert.equal(emptyShown(), true);
    const a = repo.add(validInput({ type: 'income', categoryId: INCOME, amount: 1_000_000 })).transaction;
    assert.equal(full('income'), '+1.000.000 ₫');
    assert.equal(emptyShown(), false);
    repo.update(a.id, validInput({ type: 'income', categoryId: INCOME, amount: 2_000_000 }));
    assert.equal(full('income'), '+2.000.000 ₫');
    const removed = repo.remove(a.id).transaction;
    assert.equal(full('income'), '0 ₫');
    assert.equal(emptyShown(), true);
    repo.restore(removed);
    assert.equal(full('income'), '+2.000.000 ₫');
  });

  test('khoản thêm vào tháng khác không làm đổi số liệu tháng đang xem', () => {
    const { repo } = setup({ seed: OCT });
    repo.add(validInput({ amount: 777, date: '2026-03-03' }));
    assert.equal(full('expense'), '−12.300.000 ₫');
  });

  test('thông báo trống đổi theo việc kho có dữ liệu hay chưa', () => {
    const { repo } = setup();
    assert.equal($('.home-empty__title').textContent, 'Chưa có khoản nào trong tháng này');
    repo.add(validInput({ date: '2026-03-03' }));
    assert.equal($('.home-empty__title').textContent, 'Tháng này chưa có khoản nào');
  });
});

/* ================================================================== */
describe('Nút ＋ và Trang nhập liệu (tích hợp M1)', () => {
  test('bấm ＋ mở Trang nhập liệu; nhập và lưu → thẻ tổng quan cập nhật, có thông báo', () => {
    setup();
    $('.fab').click();
    assert.ok($('.entry'));
    assert.equal($('.entry h1').textContent, 'Thêm khoản');
    typeInto($('.amount__input'), '45000');
    $$('.cat').find((b) => b.textContent === 'Ăn uống').click();
    $('[data-action="save"]').click();
    assert.equal($('.entry'), null);
    assert.equal(full('expense'), '−45.000 ₫');
    assert.equal(full('balance'), '−45.000 ₫');
    assert.equal(emptyShown(), false);
    assert.ok($('.toast'));
  });

  test('nút "Thêm khoản đầu tiên" cũng mở Trang nhập liệu', () => {
    setup();
    $('[data-action="add-first"]').click();
    assert.ok($('.entry'));
    $('[data-action="close"]').click();
    assert.equal($('.entry'), null);
  });

  test('đang mở Trang nhập liệu thì bấm ＋ lần nữa không mở thêm', () => {
    setup();
    $('.fab').click();
    $('.fab').click();
    assert.equal($$('.entry-overlay').length, 1);
    $('[data-action="close"]').click();
  });

  test('lưu khoản ở tháng khác: tháng đang xem vẫn giữ nguyên', () => {
    setup({ seed: OCT });
    $('.fab').click();
    typeInto($('.amount__input'), '1000');
    $$('.cat').find((b) => b.textContent === 'Khác').click();
    $('[data-quick-date="yesterday"]').click();
    typeInto($('input[type="date"]'), '2026-05-05');
    $('[data-action="save"]').click();
    assert.equal(label(), 'Tháng 10/2026');
    assert.equal(full('expense'), '−12.300.000 ₫');
  });

  test('openEntry(id) mở ở chế độ sửa (dành cho M3 khi chạm vào dòng)', () => {
    const { home, repo } = setup({ seed: OCT });
    const tx = repo.listByMonth('2026-10')[0];
    home.openEntry(tx.id);
    assert.equal($('.entry h1').textContent, 'Sửa khoản');
    $('[data-action="close"]').click();
  });

  test('có thể ghi đè cách mở Trang nhập liệu qua tuỳ chọn openEntry', () => {
    const opened = [];
    const { home } = setup({ mount: { openEntry: (id) => opened.push(id) } });
    $('.fab').click();
    $('[data-action="add-first"]').click();
    home.openEntry('abc');
    assert.deepEqual(opened, [null, null, 'abc']);
    assert.equal($('.entry'), null);
  });
});

/* ================================================================== */
describe('Nút Cài đặt, thanh dính, banner, tải', () => {
  test('nút ⚙ chỉ có khi host cung cấp onOpenSettings (M6), và gọi đúng hàm', () => {
    setup();
    assert.equal($('[data-action="open-settings"]'), null);
    document.body.replaceChildren();
    let n = 0;
    setup({ mount: { onOpenSettings: () => (n += 1) } });
    const btn = $('[data-action="open-settings"]');
    assert.equal(btn.getAttribute('aria-label'), 'Cài đặt');
    btn.click();
    assert.equal(n, 1);
  });

  test('thanh tháng đổi nền mờ khi cuộn (lớp is-scrolled)', () => {
    setup();
    const bar = $('.month-bar');
    assert.equal(bar.classList.contains('is-scrolled'), false);
    Object.defineProperty(win, 'scrollY', { value: 120, configurable: true });
    win.dispatchEvent(new win.Event('scroll'));
    assert.equal(bar.classList.contains('is-scrolled'), true);
    Object.defineProperty(win, 'scrollY', { value: 0, configurable: true });
    win.dispatchEvent(new win.Event('scroll'));
    assert.equal(bar.classList.contains('is-scrolled'), false);
  });

  test('trình duyệt chặn localStorage → banner cảnh báo ở đầu trang', () => {
    const backend = new MemoryBackend();
    backend.failReads = true;
    setup({ backend });
    const banner = $('.home__banners .banner');
    assert.equal(banner.getAttribute('role'), 'alert');
    assert.match(banner.textContent, /chặn lưu trữ/);
  });

  test('dữ liệu từ phiên bản mới hơn → banner', () => {
    const backend = new MemoryBackend({ [STORAGE_KEY]: JSON.stringify({ ...createDefaultData(), schemaVersion: 99 }) });
    setup({ backend });
    assert.match($('.home__banners').textContent, /phiên bản mới hơn/);
  });

  test('dữ liệu cũ bị hỏng → banner báo đã giữ bản sao và bắt đầu lại', () => {
    const backend = new MemoryBackend({ [STORAGE_KEY]: '{hỏng' });
    setup({ backend });
    assert.match($('.home__banners').textContent, /bị lỗi nên đã được giữ riêng/);
  });

  test('bình thường không có banner; showBanner không trùng lặp; clearBanners xoá hết', () => {
    const { home } = setup();
    assert.equal($$('.home__banners .banner').length, 0);
    home.showBanner('Lỗi thử');
    home.showBanner('Lỗi thử');
    assert.equal($$('.home__banners .banner').length, 1);
    home.showBanner('Lỗi khác');
    assert.equal($$('.home__banners .banner').length, 2);
    home.clearBanners();
    assert.equal($$('.home__banners .banner').length, 0);
  });

  test('banner chèn văn bản bằng textContent (không diễn giải HTML)', () => {
    const { home } = setup();
    home.showBanner('<img src=x onerror="window.__xss=1">');
    assert.equal($('.home__banners img'), null);
    assert.equal(win.__xss, undefined);
  });

  test('khung xương khi đang tải: loading → data-state, setLoading(false) trả về bình thường', () => {
    const { home } = setup({ mount: { loading: true } });
    assert.equal($('.summary').dataset.state, 'loading');
    assert.equal($('.summary').getAttribute('aria-busy'), 'true');
    home.setLoading(false);
    assert.equal($('.summary').dataset.state, 'ready');
    assert.equal($('.summary').hasAttribute('aria-busy'), false);
    home.setLoading(true);
    assert.equal($('.summary').dataset.state, 'loading');
  });
});

/* ================================================================== */
describe('Ô gắn module khác và vòng đời', () => {
  test('slots.charts / slots.list là phần tử rỗng, module khác gắn nội dung vào được', () => {
    const { home } = setup();
    assert.equal(home.slots.charts.childElementCount, 0);
    assert.equal(home.slots.list.childElementCount, 0);
    const child = document.createElement('div');
    home.slots.list.append(child);
    assert.equal($('[data-slot="list"]').firstElementChild, child);
    assert.equal(home.slots.charts.parentElement, home.slots.list.parentElement);
  });

  test('qua tháng mới khi đang mở: refresh() mở khoá ▶, tháng đang xem không tự nhảy', () => {
    const now = makeClock(2026, 9, 31, 23, 59);
    const { home } = setup({ now });
    assert.equal(nextBtn().disabled, true);
    now.set(2026, 10, 1, 0, 1);
    home.refresh();
    assert.equal(label(), 'Tháng 10/2026');
    assert.equal(nextBtn().disabled, false);
    nextBtn().click();
    assert.equal(label(), 'Tháng 11/2026');
    assert.equal(nextBtn().disabled, true);
  });

  test('quay lại ứng dụng (visibilitychange) cũng tự làm mới', () => {
    const now = makeClock(2026, 9, 31, 23, 59);
    setup({ now });
    now.set(2026, 10, 1, 0, 1);
    document.dispatchEvent(new win.Event('visibilitychange'));
    assert.equal(nextBtn().disabled, false);
  });

  test('destroy: gỡ giao diện, huỷ đăng ký kho dữ liệu và tháng; gọi nhiều lần không lỗi', () => {
    const { home, repo, calls } = setup();
    home.destroy();
    home.destroy();
    assert.equal($('.home'), null);
    assert.doesNotThrow(() => repo.add(validInput()));
    home.month.set('2026-03');
    assert.deepEqual(calls.month, []);
    assert.doesNotThrow(() => home.refresh());
    win.dispatchEvent(new win.Event('scroll'));
  });

  test('có thể gắn Trang chủ vào phần tử tuỳ ý (host)', () => {
    const host = document.createElement('div');
    host.id = 'app';
    document.body.append(host);
    setup({ mount: { host } });
    assert.ok($('#app > .home'));
  });
});

/* ================================================================== */
describe('Hiệu năng', () => {
  test('5.000 giao dịch: mở Trang chủ và đổi tháng đều < 100 ms (PRD §8)', () => {
    const data = createDefaultData();
    for (let i = 0; i < 5000; i += 1) {
      const month = String((i % 9) + 1).padStart(2, '0');
      const day = String((i % 27) + 1).padStart(2, '0');
      data.transactions.push({ id: `s${i}`, type: i % 4 ? 'expense' : 'income', amount: 1000 + i, categoryId: i % 4 ? FOOD : INCOME, walletId: 'wallet-cash', date: `2026-${month}-${day}`, note: '', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' });
    }
    const backend = new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) });
    const { repo } = makeRepo({ backend });
    const t0 = performance.now();
    const home = mountHome({ repo, now: makeClock(), animate: false });
    cleanups.push(() => home.destroy());
    const mountMs = performance.now() - t0;
    const t1 = performance.now();
    home.setMonth('2026-05');
    const switchMs = performance.now() - t1;
    assert.ok(mountMs < 100, `mở ${mountMs.toFixed(1)}ms`);
    assert.ok(switchMs < 100, `đổi tháng ${switchMs.toFixed(1)}ms`);
    assert.notEqual(full('income'), '0 ₫');
  });
});
