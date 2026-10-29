// Kiểm thử giao diện M4 (jsdom): carousel, 4 biểu đồ, tooltip, xem dạng bảng, đổi tháng, dọn dẹp.
import { win } from './dom-env.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mountHome } from '../src/ui/home.js';
import { mountTransactionList } from '../src/ui/tx-list.js';
import { mountCharts, TABLE_MODE_KEY } from '../src/ui/charts.js';
import { createToastHost } from '../src/ui/toast.js';
import { createStore, STORAGE_KEY } from '../src/core/storage.js';
import { createRepo } from '../src/core/repo.js';
import { createDefaultData } from '../src/core/defaults.js';
import { summarize } from '../src/core/summary.js';
import { MemoryBackend, makeClock, makeIdGen, makeRepo, plain, validInput } from './helpers.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const slide = (k) => $(`.chart[data-chart="${k}"]`);
const hit = (k, i) => $(`.chart[data-chart="${k}"] [data-hit="${i}"]`);
const hits = (k) => $$(`.chart[data-chart="${k}"] [data-hit]`);
const tipEl = (k) => $('.chart-tip', slide(k));
const tipText = (k) => plain(tipEl(k).textContent);
const tipVisible = (k) => !!tipEl(k) && !tipEl(k).hidden;
const dots = () => $$('.charts__dot');
const toggles = () => $$('.chart__toggle');
const titles = () => $$('.chart__title').map((h) => h.textContent);
const cells = (tr) => $$('th,td', tr).map((c) => plain(c.querySelector('.num__full')?.textContent ?? c.textContent).trim());
const tableRows = (k) => $$('tbody tr', slide(k)).map(cells);
const footRow = (k) => cells($('tfoot tr', slide(k)));
const headRow = (k) => $$('thead th', slide(k)).map((c) => c.textContent);

function click(target) {
  target.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function pointer(target, type, pointerType = 'mouse', bubbles = true) {
  const e = new win.MouseEvent(type, { bubbles, cancelable: true });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  target.dispatchEvent(e);
}
function key(target, k, init = {}) {
  const e = new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
  document.body.replaceChildren();
  document.documentElement.className = '';
});

const F = 'cat-expense-food';
const T = 'cat-expense-transport';
const H = 'cat-expense-home';
const S = 'cat-expense-shopping';
const SAL = 'cat-income-salary';
const BON = 'cat-income-bonus';

/**
 * Hôm nay = 27/10/2026 (thứ Ba). Tuần 1: thu 5.000.000 · tuần 2: chi 1.200.000 · tuần 3: thu 200.000, chi 300.000 · tuần 4: chi 85.000.
 * Tổng thu 5.200.000, tổng chi 1.585.000, số dư 3.615.000.
 */
const DATA = [
  { type: 'income', categoryId: SAL, amount: 5_000_000, date: '2026-10-03', note: '' },
  { amount: 1_200_000, categoryId: H, date: '2026-10-09', note: '' },
  { type: 'income', categoryId: BON, amount: 200_000, date: '2026-10-15', note: '' },
  { amount: 300_000, categoryId: S, date: '2026-10-15', note: '' },
  { amount: 45_000, categoryId: F, date: '2026-10-27', note: '' },
  { amount: 40_000, categoryId: T, date: '2026-10-27', note: '' },
];

function setup({ seed = DATA, now = makeClock(), backend = new MemoryBackend(), mount = {}, homeOpts = {}, noCharts = false } = {}) {
  const { repo } = makeRepo({ backend, now });
  for (const s of seed) {
    now.advance(1000);
    const r = repo.add(validInput(s));
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  const home = mountHome({ repo, now, animate: false, ...homeOpts });
  const storage = 'storage' in mount ? mount.storage : memoryStorage();
  const charts = noCharts ? null : mountCharts({ repo, home, now, animate: false, ...mount, storage });
  cleanups.push(() => {
    charts?.destroy();
    home.destroy();
  });
  return { repo, backend, now, home, charts, storage };
}

/** Bề rộng giả cho jsdom (không có layout): chỉ các phần tử cần đo. */
function fakeWidths(widths) {
  const proto = win.HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
  Object.defineProperty(proto, 'clientWidth', {
    configurable: true,
    get() {
      for (const cls of Object.keys(widths.map)) if (this.classList?.contains(cls)) return widths.map[cls];
      return 0;
    },
  });
  cleanups.push(() => {
    if (original) Object.defineProperty(proto, 'clientWidth', original);
    else delete proto.clientWidth;
  });
  return widths;
}

/** Tạo bộ nhớ trong để thay đổi bề rộng giữa chừng. */
function widths(track, body) {
  return fakeWidths({ map: { charts__track: track, chart__body: body } });
}

const barValues = (k) => $$(`.chart[data-chart="${k}"] .chart-bar`).map((b) => [b.getAttribute('data-kind'), Number(b.getAttribute('data-value'))]);
const barTop = (bar) => Number(/V([\d.]+)Q/.exec(bar.getAttribute('d'))[1]); // y của đỉnh cột (+ bán kính bo góc)
const axisLabels = (k) => $$(`.chart[data-chart="${k}"] .chart-axis text`).map((t) => t.textContent);
const xLabels = (k) => $$(`.chart[data-chart="${k}"] .chart-label--x`).map((t) => t.textContent);

/* ================================================================== */
describe('Carousel 4 biểu đồ (F8, DESIGN §6.3)', () => {
  test('gắn vào ô charts của Trang chủ với đúng 4 biểu đồ theo thứ tự cố định', () => {
    const { home } = setup();
    assert.equal(home.slots.charts.firstElementChild, $('.charts'));
    assert.deepEqual(titles(), ['Thu & chi theo tuần', 'Chi theo danh mục', 'Thu & chi theo ngày', 'Số dư luỹ kế']);
    assert.deepEqual($$('.chart').map((c) => c.dataset.chart), ['week', 'category', 'day', 'balance']);
    $$('.chart__title').forEach((h) => assert.equal(h.tagName, 'H2'));
    $$('.chart__desc').forEach((p) => assert.ok(p.textContent.length > 5, 'mỗi biểu đồ có mô tả ngắn'));
  });

  test('mặc định hiển thị biểu đồ đầu tiên (Thu & chi theo tuần)', () => {
    const { charts } = setup();
    assert.equal(charts.getActive(), 0);
    assert.equal(charts.count, 4);
    assert.equal(dots()[0].getAttribute('aria-selected'), 'true');
  });

  test('vùng carousel có vai trò và tên đọc được', () => {
    setup();
    const root = $('.charts');
    assert.equal(root.getAttribute('role'), 'region');
    assert.equal(root.getAttribute('aria-roledescription'), 'carousel');
    assert.equal(root.getAttribute('aria-label'), 'Biểu đồ tháng 10/2026');
    for (const s of $$('.chart')) {
      assert.equal(s.getAttribute('role'), 'tabpanel');
      assert.equal(s.getAttribute('aria-roledescription'), 'slide');
      assert.equal(document.getElementById(s.getAttribute('aria-labelledby')).tagName, 'H2');
    }
  });

  test('có 4 chấm chỉ báo dạng tab: chỉ chấm đang chọn nằm trong thứ tự Tab, mỗi chấm trỏ tới biểu đồ của nó', () => {
    setup();
    assert.equal(dots().length, 4);
    assert.equal($('.charts__dots').getAttribute('role'), 'tablist');
    assert.deepEqual(dots().map((d) => d.tabIndex), [0, -1, -1, -1]);
    dots().forEach((d, i) => {
      assert.equal(d.getAttribute('role'), 'tab');
      assert.equal(d.getAttribute('aria-controls'), $$('.chart')[i].id);
      assert.match(d.getAttribute('aria-label'), new RegExp(`^Biểu đồ ${i + 1} trên 4: `));
      assert.equal(d.querySelectorAll('.charts__pip').length, 1);
    });
    assert.ok(dots()[0].classList.contains('is-active'));
  });

  test('biểu đồ không hiển thị bị inert + ẩn khỏi trình đọc màn hình (không Tab vào được)', () => {
    const { charts } = setup();
    const state = () => $$('.chart').map((c) => [c.hasAttribute('inert'), c.getAttribute('aria-hidden')]);
    assert.deepEqual(state(), [[false, 'false'], [true, 'true'], [true, 'true'], [true, 'true']]);
    charts.goTo(2);
    assert.deepEqual(state(), [[true, 'true'], [true, 'true'], [false, 'false'], [true, 'true']]);
  });

  test('goTo / next / prev đổi biểu đồ và chấm chỉ báo; vượt biên thì dừng ở biên', () => {
    const { charts } = setup();
    charts.goTo(2);
    assert.equal(charts.getActive(), 2);
    assert.deepEqual(dots().map((d) => d.getAttribute('aria-selected')), ['false', 'false', 'true', 'false']);
    assert.deepEqual(dots().map((d) => d.tabIndex), [-1, -1, 0, -1]);
    charts.next();
    assert.equal(charts.getActive(), 3);
    charts.next();
    charts.next();
    assert.equal(charts.getActive(), 3);
    charts.prev();
    assert.equal(charts.getActive(), 2);
    charts.goTo(-5);
    assert.equal(charts.getActive(), 0);
    charts.prev();
    assert.equal(charts.getActive(), 0);
    charts.goTo(99);
    assert.equal(charts.getActive(), 3);
    charts.goTo(1.4);
    assert.equal(charts.getActive(), 1);
  });

  test('bấm chấm chỉ báo → chuyển biểu đồ', () => {
    const { charts } = setup();
    click(dots()[3]);
    assert.equal(charts.getActive(), 3);
    click(dots()[1]);
    assert.equal(charts.getActive(), 1);
  });

  test('nút ‹ › (laptop) chuyển biểu đồ và bị vô hiệu ở hai đầu', () => {
    const { charts } = setup();
    const prev = $('[data-action="prev-chart"]');
    const next = $('[data-action="next-chart"]');
    assert.equal(prev.disabled, true);
    assert.equal(next.disabled, false);
    assert.equal(prev.getAttribute('aria-label'), 'Biểu đồ trước');
    assert.equal(next.getAttribute('aria-label'), 'Biểu đồ sau');
    click(next);
    assert.equal(charts.getActive(), 1);
    assert.equal(prev.disabled, false);
    charts.goTo(3);
    assert.equal(next.disabled, true);
    click(prev);
    assert.equal(charts.getActive(), 2);
  });

  test('phím ← → chuyển biểu đồ khi tiêu điểm nằm trong carousel (laptop)', () => {
    const { charts } = setup();
    const toggle = toggles()[0];
    toggle.focus();
    const e = key(toggle, 'ArrowRight');
    assert.equal(charts.getActive(), 1);
    assert.equal(e.defaultPrevented, true);
    key($('.charts'), 'ArrowRight');
    assert.equal(charts.getActive(), 2);
    key($('.charts'), 'ArrowLeft');
    key($('.charts'), 'ArrowLeft');
    assert.equal(charts.getActive(), 0);
    key($('.charts'), 'ArrowLeft'); // đã ở đầu
    assert.equal(charts.getActive(), 0);
  });

  test('tiêu điểm không bị rơi khi biểu đồ cũ bị inert: ← → liên tục được nhiều lần', () => {
    const { charts } = setup();
    toggles()[0].focus();
    key(document.activeElement, 'ArrowRight');
    assert.equal(document.activeElement, toggles()[1], 'tiêu điểm chuyển sang nút của biểu đồ mới');
    key(document.activeElement, 'ArrowRight');
    assert.equal(charts.getActive(), 2);
    key(document.activeElement, 'ArrowLeft');
    key(document.activeElement, 'ArrowLeft');
    assert.equal(charts.getActive(), 0);
    assert.equal(document.activeElement, toggles()[0]);
  });

  test('tiêu điểm ngoài carousel (ví dụ ở danh sách) không bị kéo vào khi biểu đồ đổi', () => {
    const { charts } = setup();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    charts.goTo(2);
    assert.equal(document.activeElement, outside);
  });

  test('phím mũi tên trên chấm chỉ báo: tiêu điểm đi theo chấm mới; Home / End nhảy về hai đầu', () => {
    const { charts } = setup();
    dots()[0].focus();
    key(dots()[0], 'ArrowRight');
    assert.equal(document.activeElement, dots()[1]);
    key(dots()[1], 'End');
    assert.equal(charts.getActive(), 3);
    assert.equal(document.activeElement, dots()[3]);
    key(dots()[3], 'Home');
    assert.equal(charts.getActive(), 0);
    assert.equal(document.activeElement, dots()[0]);
  });

  test('Home / End ngoài chấm chỉ báo không làm gì; phím có Ctrl/Alt/Meta hoặc đã bị chặn thì bỏ qua', () => {
    const { charts } = setup();
    key(toggles()[0], 'End');
    assert.equal(charts.getActive(), 0);
    for (const mod of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      key(toggles()[0], 'ArrowRight', mod);
      assert.equal(charts.getActive(), 0);
    }
    toggles()[0].addEventListener('keydown', (e) => e.preventDefault(), { once: true });
    key(toggles()[0], 'ArrowRight');
    assert.equal(charts.getActive(), 0, 'sự kiện đã bị chặn thì không xử lý thêm');
    key(toggles()[0], 'a');
    assert.equal(charts.getActive(), 0);
  });

  test('biểu đồ ngày còn chỗ cuộn ngang: ← → để trình duyệt cuộn, chỉ chuyển biểu đồ khi hết chỗ cuộn', () => {
    const { charts } = setup();
    charts.goTo(2);
    const scroller = $('.chart__scroll', slide('day'));
    assert.equal(scroller.getAttribute('tabindex'), '0');
    const dims = { scrollLeft: 0, clientWidth: 265, scrollWidth: 558 };
    for (const [k, v] of Object.entries(dims)) Object.defineProperty(scroller, k, { configurable: true, writable: true, value: v });
    let e = key(scroller, 'ArrowRight');
    assert.equal(e.defaultPrevented, false, 'để trình duyệt cuộn');
    assert.equal(charts.getActive(), 2);
    e = key(scroller, 'ArrowLeft');
    assert.equal(e.defaultPrevented, true);
    assert.equal(charts.getActive(), 1, 'đang ở đầu vùng cuộn: ← chuyển sang biểu đồ trước');
  });

  test('cuộn tới cuối biểu đồ ngày rồi → mới chuyển biểu đồ sau', () => {
    const { charts } = setup();
    charts.goTo(2);
    const scroller = $('.chart__scroll', slide('day'));
    for (const [k, v] of Object.entries({ scrollLeft: 293, clientWidth: 265, scrollWidth: 558 })) Object.defineProperty(scroller, k, { configurable: true, writable: true, value: v });
    key(scroller, 'ArrowRight');
    assert.equal(charts.getActive(), 3);
  });

  test('vuốt (sự kiện scroll): chờ cuộn dừng rồi mới đổi chấm chỉ báo, không nhấp nháy giữa chừng', async () => {
    const { charts } = setup();
    const track = $('.charts__track');
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(track, 'scrollLeft', { configurable: true, writable: true, value: 0 });
    const seen = [];
    const mo = new win.MutationObserver(() => seen.push(charts.getActive()));
    mo.observe($('.charts__dots'), { attributes: true, subtree: true });
    for (const left of [40, 120, 220, 330, 450, 540, 600]) {
      track.scrollLeft = left;
      track.dispatchEvent(new win.Event('scroll'));
      await sleep(10);
    }
    assert.equal(charts.getActive(), 0, 'đang cuộn thì chưa đổi');
    await sleep(150);
    assert.equal(charts.getActive(), 2);
    assert.equal(dots()[2].getAttribute('aria-selected'), 'true');
    assert.ok(!seen.includes(1), 'không đi qua biểu đồ 2 giữa chừng');
    mo.disconnect();
  });

  test('sự kiện scroll khi chưa đo được bề rộng (0) thì bỏ qua, không ném lỗi', async () => {
    const { charts } = setup();
    const track = $('.charts__track');
    track.dispatchEvent(new win.Event('scroll'));
    await sleep(120);
    assert.equal(charts.getActive(), 0);
  });

  test('vuốt về lại đầu sau khi đã sang biểu đồ khác', async () => {
    const { charts } = setup();
    const track = $('.charts__track');
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(track, 'scrollLeft', { configurable: true, writable: true, value: 900 });
    track.dispatchEvent(new win.Event('scroll'));
    await sleep(130);
    assert.equal(charts.getActive(), 3);
    track.scrollLeft = 10;
    track.dispatchEvent(new win.Event('scroll'));
    await sleep(130);
    assert.equal(charts.getActive(), 0);
  });

  test('đổi biểu đồ được thông báo cho trình đọc màn hình và gọi onChartChange', () => {
    const calls = [];
    const { charts } = setup({ mount: { onChartChange: (i, k) => calls.push([i, k]) } });
    const status = $('.charts [role="status"]');
    charts.goTo(1);
    assert.equal(status.textContent, 'Chi theo danh mục, biểu đồ 2 trên 4');
    charts.goTo(1); // không đổi → không gọi lại
    charts.goTo(3);
    assert.deepEqual(calls, [[1, 'category'], [3, 'balance']]);
  });
});

/* ================================================================== */
describe('Trạng thái trống', () => {
  test('lần đầu chưa có giao dịch nào: không vẽ biểu đồ (Trang chủ hiện trạng thái trống); thêm khoản đầu tiên thì biểu đồ xuất hiện', () => {
    const { repo, home, charts } = setup({ seed: [] });
    assert.equal(home.slots.charts.childElementCount, 0);
    assert.equal($('.charts'), null);
    assert.equal(charts.getModel(), null);
    repo.add(validInput({ amount: 10_000 }));
    assert.ok($('.charts'));
    assert.equal(home.slots.charts.childElementCount, 1);
  });

  test('xoá khoản cuối cùng → biểu đồ biến mất; hoàn tác → quay lại', () => {
    const { repo, home } = setup({ seed: [{ amount: 10_000, date: '2026-10-05' }] });
    assert.ok($('.charts'));
    const id = repo.listByMonth('2026-10')[0].id;
    const gone = repo.remove(id).transaction;
    assert.equal(home.slots.charts.childElementCount, 0);
    repo.restore(gone);
    assert.ok($('.charts'));
    assert.ok(slide('week'));
  });

  test('tháng không có giao dịch nhưng tháng khác có: vẫn có khung, trục trống và số liệu 0', () => {
    const { home, charts } = setup({ seed: [{ amount: 50_000, date: '2026-09-10' }] });
    assert.equal(home.month.get(), '2026-10');
    assert.ok($('.charts'));
    assert.deepEqual(axisLabels('week'), ['0', '25k', '50k', '75k', '100k']);
    assert.equal($$('.chart[data-chart="week"] .chart-bar').length, 0);
    assert.equal($$('.chart[data-chart="day"] .chart-bar').length, 0);
    assert.equal(hits('week').length, 5);
    assert.equal(hits('day').length, 31);
    // số dư: tới hôm nay (27 ngày), toàn 0
    assert.equal(charts.getModel().balance.points.length, 27);
    assert.ok(charts.getModel().balance.points.every((p) => p.balance === 0));
    // vành khuyên: vành trống + thông báo
    assert.equal($$('.chart-slice').length, 0);
    assert.ok($('.chart-donut__track'));
    assert.equal($('.donut__empty').textContent, 'Chưa có khoản chi trong tháng này');
    assert.equal(plain($('.donut__total').textContent), '0 ₫');
  });
});

/* ================================================================== */
describe('① Thu & chi theo tuần', () => {
  test('5 nhóm cột (Tuần 1–5, kèm khoảng ngày), mỗi cột-nhóm có một vùng chạm', () => {
    setup();
    assert.deepEqual(xLabels('week'), ['Tuần 1', '1–7', 'Tuần 2', '8–14', 'Tuần 3', '15–21', 'Tuần 4', '22–28', 'Tuần 5', '29–31']);
    assert.equal(hits('week').length, 5);
  });

  test('chỉ vẽ cột cho giá trị > 0, đặt cạnh nhau: Thu rồi Chi trong cùng nhóm; số cột đúng', () => {
    setup();
    assert.deepEqual(barValues('week'), [
      ['income', 5_000_000],
      ['expense', 1_200_000],
      ['income', 200_000],
      ['expense', 300_000],
      ['expense', 85_000],
    ]);
  });

  test('chiều cao cột tỉ lệ thuận với số tiền (đỉnh cột càng cao khi số tiền càng lớn)', () => {
    setup();
    const bars = $$('.chart[data-chart="week"] .chart-bar');
    const byValue = bars.map((b) => [Number(b.getAttribute('data-value')), barTop(b)]).sort((a, b) => b[0] - a[0]);
    for (let i = 1; i < byValue.length; i += 1) assert.ok(byValue[i][1] >= byValue[i - 1][1], 'giá trị nhỏ hơn thì đỉnh thấp hơn (y lớn hơn)');
  });

  test('cột Thu không chồng lên cột Chi trong cùng nhóm và nằm trong cột của nhóm', () => {
    setup();
    const box = (bar) => ({ left: Number(/^M([\d.]+) /.exec(bar.getAttribute('d'))[1]), right: Number(/H[\d.]+Q([\d.]+) /.exec(bar.getAttribute('d'))[1]) });
    const bars = $$('.chart[data-chart="week"] .chart-bar');
    const income = box(bars.find((b) => b.getAttribute('data-value') === '200000'));
    const expense = box(bars.find((b) => b.getAttribute('data-value') === '300000'));
    assert.ok(income.right < expense.left, `Thu (${income.left}–${income.right}) phải nằm hẳn bên trái Chi (${expense.left}–${expense.right})`);
    const col = (328 - 44) / 5; // tuần 3 là cột thứ 3
    assert.ok(income.left >= 2 * col && expense.right <= 3 * col, 'cả hai cột nằm trong ô của tuần 3');
  });

  test('trục dọc: bắt đầu từ 0, vạch "đẹp" rút gọn (0, 2tr, 4tr, 6tr)', () => {
    setup();
    assert.deepEqual(axisLabels('week'), ['0', '2tr', '4tr', '6tr']);
  });

  test('có chú giải Thu / Chi', () => {
    setup();
    assert.deepEqual($$('.chart-legend li', slide('week')).map((l) => l.textContent), ['Thu', 'Chi']);
    assert.equal(slide('category').querySelector('.chart-legend'), null);
    assert.ok(slide('day').querySelector('.chart-legend'));
    assert.equal(slide('balance').querySelector('.chart-legend'), null);
  });

  test('vẽ vừa khung (không cuộn ngang) và vùng cuộn không nhận Tab', () => {
    setup();
    const scroller = $('.chart__scroll', slide('week'));
    assert.equal(scroller.hasAttribute('tabindex'), false);
    assert.equal($('.chart-plot', slide('week')).getAttribute('width'), String(328 - 44));
  });
});

/* ================================================================== */
describe('② Chi theo danh mục (vành khuyên)', () => {
  test('một miếng cho mỗi danh mục có chi, theo thứ tự giảm dần', () => {
    setup();
    assert.equal($$('.chart-slice').length, 4);
    assert.deepEqual($$('.donut__name').map((n) => n.textContent), ['Nhà ở', 'Mua sắm', 'Ăn uống', 'Di chuyển']);
  });

  test('chú giải đủ màu + tên + % + số tiền; tổng % = 100', () => {
    setup();
    const items = $$('.donut__item');
    assert.deepEqual(items.map((i) => $('.donut__pct', i).textContent), ['76%', '19%', '3%', '2%']);
    assert.deepEqual(items.map((i) => plain($('.donut__amount .num__full', i).textContent)), ['1.200.000 ₫', '300.000 ₫', '45.000 ₫', '40.000 ₫']);
    assert.deepEqual(items.map((i) => $('.donut__amount .num__compact', i).textContent), ['1,2tr', '300k', '45k', '40k']);
    for (const i of items) assert.ok($('.dot', i).getAttribute('style').includes('--cat-color: var(--cat-'), 'màu lấy từ bảng màu danh mục');
    assert.equal($$('.donut__pct').reduce((n, p) => n + parseInt(p.textContent, 10), 0), 100);
  });

  test('màu từng miếng = màu danh mục trong bảng §2.3 (qua biến CSS, không hard-code)', () => {
    setup();
    const colors = $$('.chart-slice').map((c) => /stroke: (var\(--cat-[a-z]+\))/.exec(c.getAttribute('style'))[1]);
    assert.deepEqual(colors, ['var(--cat-home)', 'var(--cat-shop)', 'var(--cat-eat)', 'var(--cat-move)']);
  });

  test('giữa vành là tổng chi', () => {
    setup();
    assert.equal($('.donut__label').textContent, 'Tổng chi');
    assert.equal(plain($('.donut__total').textContent), '1.585.000 ₫');
  });

  test('tổng chi dài thì giữa vành dùng dạng rút gọn (không tràn vành)', () => {
    setup({ seed: [{ amount: 123_456_789, date: '2026-10-05' }] });
    assert.equal(plain($('.donut__total').textContent), '123,5tr');
  });

  test('miếng cung cấp độ dài theo tỉ lệ (pathLength = 100, dasharray cộng đúng tỉ lệ)', () => {
    setup();
    const arcs = $$('.chart-slice');
    for (const arc of arcs) assert.equal(arc.getAttribute('pathLength'), '100');
    const lens = arcs.map((a) => Number(a.getAttribute('stroke-dasharray').split(' ')[0]));
    assert.ok(lens[0] > lens[1] && lens[1] > lens[2] && lens[2] > lens[3] - 0.5, 'miếng lớn hơn → cung dài hơn');
    const total = lens.reduce((a, b) => a + b, 0);
    assert.ok(total > 95 && total <= 100, `tổng cung ${total}`); // trừ các khe giữa các miếng
  });

  test('đủ 8 danh mục chi → 8 miếng, "Khác" đứng cuối', () => {
    const cats = ['cat-expense-food', 'cat-expense-transport', 'cat-expense-home', 'cat-expense-shopping', 'cat-expense-fun', 'cat-expense-health', 'cat-expense-study', 'cat-expense-other'];
    setup({ seed: cats.map((c, i) => ({ categoryId: c, amount: 10_000 * (8 - i), date: '2026-10-05' })) });
    assert.equal($$('.chart-slice').length, 8);
    const names = $$('.donut__name').map((n) => n.textContent);
    assert.equal(names.length, 8);
    assert.equal(names.at(-1), 'Khác');
    assert.equal($$('.donut__pct').reduce((n, p) => n + parseInt(p.textContent, 10), 0), 100);
  });

  test('chỉ có khoản thu → vành trống, không có miếng nào', () => {
    setup({ seed: [{ type: 'income', categoryId: SAL, amount: 1_000_000, date: '2026-10-02' }] });
    assert.equal($$('.chart-slice').length, 0);
    assert.equal($('.donut__empty').textContent, 'Chưa có khoản chi trong tháng này');
  });

  test('một danh mục duy nhất → một miếng 100% liền vành (không có khe)', () => {
    setup({ seed: [{ amount: 5_000, date: '2026-10-02' }] });
    const [arc] = $$('.chart-slice');
    assert.equal(arc.getAttribute('stroke-dasharray'), '100 0');
    assert.equal($('.donut__pct').textContent, '100%');
  });
});

/* ================================================================== */
describe('③ Thu & chi theo ngày', () => {
  test('có đủ 31 cột-nhóm của tháng 10; nhãn trục ngang: 1, 5, 10, …, 30', () => {
    setup();
    assert.equal(hits('day').length, 31);
    assert.deepEqual(xLabels('day'), ['1', '5', '10', '15', '20', '25', '30']);
  });

  test('tháng 28 ngày (2/2026) có 28 cột; tháng nhuận có 29', () => {
    const { home } = setup({ seed: [{ amount: 1000, date: '2026-02-03' }, { amount: 1000, date: '2024-02-03' }] });
    home.setMonth('2026-02');
    assert.equal(hits('day').length, 28);
    home.setMonth('2024-02');
    assert.equal(hits('day').length, 29);
  });

  test('chỉ vẽ cột cho ngày có giao dịch', () => {
    setup();
    assert.deepEqual(barValues('day'), [
      ['income', 5_000_000],
      ['expense', 1_200_000],
      ['income', 200_000],
      ['expense', 300_000],
      ['expense', 85_000],
    ]);
  });

  test('hẹp hơn 31 × 18 px → vùng vẽ rộng ra và cuộn ngang, vùng cuộn nhận Tab và có tên', () => {
    setup();
    const plot = $('.chart-plot', slide('day'));
    assert.equal(Number(plot.getAttribute('width')), 31 * 18);
    const scroller = $('.chart__scroll', slide('day'));
    assert.equal(scroller.getAttribute('tabindex'), '0');
    assert.equal(scroller.getAttribute('role'), 'group');
    assert.equal(scroller.getAttribute('aria-label'), 'Biểu đồ có thể cuộn ngang');
  });

  test('đủ rộng thì vừa khung, không cuộn ngang', () => {
    const { charts } = setup();
    widths(900, 900);
    charts.refresh();
    const scroller = $('.chart__scroll', slide('day'));
    assert.equal(scroller.hasAttribute('tabindex'), false);
    assert.equal(Number($('.chart-plot', slide('day')).getAttribute('width')), 900 - 44);
  });

  test('trục dọc cố định tách riêng khỏi vùng cuộn', () => {
    setup();
    const cartesian = $('.chart__cartesian', slide('day'));
    assert.equal(cartesian.firstElementChild.classList.contains('chart-axis'), true);
    assert.equal($('.chart__scroll', cartesian).querySelector('.chart-axis'), null);
  });
});

/* ================================================================== */
describe('④ Số dư luỹ kế', () => {
  test('mỗi ngày tới hôm nay có một điểm; điểm cuối = số dư tháng; vẽ đường + vùng tô + điểm cuối', () => {
    const { charts } = setup();
    assert.equal(hits('balance').length, 27);
    const m = charts.getModel();
    assert.equal(m.balance.points.at(-1).balance, m.summary.balance);
    const line = $('.chart-line', slide('balance'));
    assert.equal((line.getAttribute('d').match(/L/g) ?? []).length, 26);
    assert.ok(line.getAttribute('d').startsWith('M'));
    assert.ok($('.chart-area', slide('balance')).getAttribute('d').endsWith('Z'));
    assert.equal($$('.chart-marker--last', slide('balance')).length, 1);
  });

  test('số dư âm: trục có số âm với dấu trừ thật và vạch 0 nổi bật', () => {
    setup({ seed: [{ amount: 2_500_000, date: '2026-10-05' }, { type: 'income', categoryId: SAL, amount: 1_000_000, date: '2026-10-02' }] });
    const labels = axisLabels('balance');
    assert.ok(labels.includes('0'));
    assert.ok(labels.some((l) => l.startsWith('−')), labels.join(','));
    assert.equal($$('.chart-grid__zero', slide('balance')).length, 1);
  });

  test('tháng có đúng một điểm (ngày 1): không vẽ đường, chỉ có điểm', () => {
    setup({ seed: [{ amount: 10_000, date: '2026-10-01' }], now: makeClock(2026, 9, 1) });
    assert.equal(hits('balance').length, 1);
    assert.equal($('.chart-line', slide('balance')), null);
    assert.equal($$('.chart-marker--last', slide('balance')).length, 1);
  });

  test('tháng đã qua vẽ đủ cả tháng', () => {
    const { home } = setup({ seed: [...DATA, { amount: 1_000, date: '2026-09-30' }] });
    home.setMonth('2026-09');
    assert.equal(hits('balance').length, 30);
  });

  test('nhãn trục ngang ghi theo cả tháng (1, 5, 10, …, 30) dù đường chỉ vẽ tới hôm nay', () => {
    setup();
    assert.deepEqual(xLabels('balance'), ['1', '5', '10', '15', '20', '25', '30']);
  });
});

/* ================================================================== */
describe('Tooltip khi chạm / rê chuột (F9)', () => {
  test('lúc đầu tooltip ẩn', () => {
    setup();
    for (const k of ['week', 'category', 'day', 'balance']) assert.equal(tipVisible(k), false, k);
  });

  test('chạm cột tuần → nhãn + số tiền Thu và Chi của tuần đó', () => {
    setup();
    click(hit('week', 2));
    assert.equal(tipVisible('week'), true);
    assert.equal($('.chart-tip__title', slide('week')).textContent, 'Tuần 3 (15–21)');
    assert.equal(tipText('week'), 'Tuần 3 (15–21)Thu+200.000 ₫Chi−300.000 ₫');
  });

  test('giá trị bằng 0 hiện "0 ₫" không kèm dấu', () => {
    setup();
    click(hit('week', 1));
    assert.equal(tipText('week'), 'Tuần 2 (8–14)Thu0 ₫Chi−1.200.000 ₫');
  });

  test('màu giá trị: Thu dùng lớp income, Chi dùng lớp expense (kèm dấu +/−, không chỉ dựa vào màu)', () => {
    setup();
    click(hit('week', 2));
    assert.ok($('.chart-tip__value--income', tipEl('week')));
    assert.ok($('.chart-tip__value--expense', tipEl('week')));
  });

  test('chạm miếng vành khuyên → tên danh mục, số tiền, tỷ lệ', () => {
    setup();
    click(hit('category', 0));
    assert.equal(tipText('category'), 'Nhà ởChi−1.200.000 ₫Tỷ lệ76%');
    assert.ok($('.chart-slice.is-selected'));
    assert.ok($('.chart-donut').classList.contains('has-selection'));
  });

  test('chạm cột ngày → ngày đầy đủ + Thu / Chi', () => {
    setup();
    click(hit('day', 26));
    assert.equal(tipText('day'), 'Thứ Ba, 27/10/2026Thu0 ₫Chi−85.000 ₫');
  });

  test('chạm điểm số dư → ngày + số dư luỹ kế đến hết ngày đó', () => {
    setup();
    click(hit('balance', 2));
    assert.equal(tipText('balance'), 'Thứ Bảy, 03/10/2026Số dư luỹ kế+5.000.000 ₫');
    click(hit('balance', 8));
    assert.equal(tipText('balance'), 'Thứ Sáu, 09/10/2026Số dư luỹ kế+3.800.000 ₫');
    assert.ok($('.chart-marker--sel.is-selected', slide('balance')));
  });

  test('số dư âm hiện dấu trừ thật và dùng lớp màu chi', () => {
    setup({ seed: [{ amount: 400_000, date: '2026-10-05' }] });
    click(hit('balance', 6));
    assert.equal(tipText('balance'), 'Thứ Tư, 07/10/2026Số dư luỹ kế−400.000 ₫');
    assert.ok($('.chart-tip__value--expense', tipEl('balance')));
  });

  test('chạm lại đúng phần tử đó → tắt tooltip; chạm phần tử khác → chuyển tooltip', () => {
    setup();
    click(hit('week', 0));
    assert.equal(tipVisible('week'), true);
    click(hit('week', 0));
    assert.equal(tipVisible('week'), false);
    click(hit('week', 0));
    click(hit('week', 3));
    assert.equal($('.chart-tip__title', slide('week')).textContent, 'Tuần 4 (22–28)');
    assert.equal($$('.chart-band.is-selected', slide('week')).length, 1, 'chỉ một nhóm được tô sáng');
  });

  test('nhóm cột được chọn có nền tô sáng, các nhóm khác không', () => {
    setup();
    click(hit('week', 1));
    const bands = $$('.chart-band', slide('week'));
    assert.deepEqual(bands.map((b) => b.classList.contains('is-selected')), [false, true, false, false, false]);
  });

  test('rê chuột (mouse) hiện tooltip, rời vùng vẽ thì ẩn', () => {
    setup();
    pointer(hit('week', 1), 'pointerover');
    assert.equal(tipVisible('week'), true);
    assert.match(tipText('week'), /^Tuần 2/);
    pointer($('.chart__plot', slide('week')), 'pointerleave', 'mouse', false);
    assert.equal(tipVisible('week'), false);
  });

  test('rê chuột sang cột khác → tooltip đi theo', () => {
    setup();
    pointer(hit('week', 1), 'pointerover');
    pointer(hit('week', 3), 'pointerover');
    assert.match(tipText('week'), /^Tuần 4/);
  });

  test('cảm ứng (touch/pen) không kích hoạt "rê"; chỉ "chạm" mới hiện', () => {
    setup();
    pointer(hit('week', 1), 'pointerover', 'touch');
    assert.equal(tipVisible('week'), false);
    pointer(hit('week', 1), 'pointerover', 'pen');
    assert.equal(tipVisible('week'), false);
    click(hit('week', 1));
    pointer($('.chart__plot', slide('week')), 'pointerleave', 'touch', false);
    assert.equal(tipVisible('week'), true, 'nhấc tay không làm mất tooltip đã chạm');
  });

  test('rê chuột ưu tiên hơn phần tử đang giữ; rời đi thì quay về phần tử đã chạm', () => {
    setup();
    click(hit('week', 0));
    pointer(hit('week', 2), 'pointerover');
    assert.match(tipText('week'), /^Tuần 3/);
    pointer($('.chart__plot', slide('week')), 'pointerleave', 'mouse', false);
    assert.match(tipText('week'), /^Tuần 1/);
  });

  test('Esc tắt tooltip', () => {
    setup();
    click(hit('day', 4));
    assert.equal(tipVisible('day'), true);
    key($('.charts'), 'Escape');
    assert.equal(tipVisible('day'), false);
    assert.equal($$('.chart-band.is-selected').length, 0);
  });

  test('chạm ra ngoài biểu đồ (pointerdown) tắt tooltip; chạm vào vùng chạm thì không', () => {
    setup();
    click(hit('week', 1));
    pointer(hit('week', 1), 'pointerdown', 'touch');
    assert.equal(tipVisible('week'), true);
    pointer(document.body, 'pointerdown', 'touch');
    assert.equal(tipVisible('week'), false);
  });

  test('sang biểu đồ khác thì tooltip cũ được tắt', () => {
    const { charts } = setup();
    click(hit('week', 1));
    charts.goTo(1);
    assert.equal(tipVisible('week'), false);
    charts.goTo(0);
    assert.equal(tipVisible('week'), false);
  });

  test('đổi tháng thì tooltip được tắt', () => {
    const { home } = setup({ seed: [...DATA, { amount: 1, date: '2026-09-02' }] });
    click(hit('week', 1));
    home.setMonth('2026-09');
    assert.equal(tipVisible('week'), false);
  });

  test('tooltip không chặn chuột (pointer-events: none ở CSS) và bị loại khỏi cây trợ năng', () => {
    setup();
    click(hit('week', 1));
    assert.equal(tipEl('week').getAttribute('aria-hidden'), 'true');
  });

  test('tooltip được kẹp trong vùng vẽ: cột đầu / cuối không tràn mép', () => {
    setup();
    click(hit('week', 0));
    const width = 328 - 44;
    assert.equal(tipEl('week').style.left, `${Math.min(120, width / 2)}px`);
    click(hit('week', 4));
    assert.equal(tipEl('week').style.left, `${width - 120}px`);
    click(hit('week', 2));
    assert.equal(tipEl('week').dataset.placement, 'top');
  });

  test('tooltip vành khuyên nằm dưới vành, căn giữa', () => {
    setup();
    click(hit('category', 1));
    assert.equal(tipEl('category').dataset.placement, 'below');
    assert.equal(tipEl('category').style.left, '68px');
  });

  test('dữ liệu đổi khi đang giữ tooltip → nội dung cập nhật theo', () => {
    const { repo } = setup();
    click(hit('week', 3));
    assert.match(tipText('week'), /Chi−85\.000 ₫/);
    repo.add(validInput({ amount: 15_000, date: '2026-10-24' }));
    assert.match(tipText('week'), /Chi−100\.000 ₫/);
  });

  test('xoá hết dữ liệu của tuần/cột đang chọn không để lại tooltip hỏng', () => {
    const { repo } = setup({ seed: [{ amount: 10_000, date: '2026-10-25' }, { amount: 7_000, date: '2026-10-05' }] });
    click(hit('day', 24));
    assert.equal(tipVisible('day'), true);
    repo.remove(repo.listByMonth('2026-10').find((t) => t.date === '2026-10-25').id);
    assert.match(tipText('day'), /Chủ nhật, 25\/10\/2026Thu0 ₫Chi0 ₫/);
  });
});

/* ================================================================== */
describe('Xem dạng bảng (§10.9, PRD §8)', () => {
  test('mỗi biểu đồ có nút 44×44 chuyển bảng, hiện cho mọi người dùng (không ẩn), aria-pressed = false lúc đầu', () => {
    setup();
    assert.equal(toggles().length, 4);
    for (const t of toggles()) {
      assert.equal(t.getAttribute('aria-pressed'), 'false');
      assert.equal(t.getAttribute('aria-label'), 'Xem dạng bảng');
      assert.equal(t.title, 'Xem dạng bảng');
      assert.equal(t.hidden, false);
      assert.ok(t.querySelector('svg.icon'));
      assert.ok(t.classList.contains('icon-btn'), 'dùng lại nút biểu tượng 44×44 của M1');
    }
  });

  test('bấm nút → mọi biểu đồ chuyển sang bảng; bấm lại → quay về biểu đồ', () => {
    const { charts } = setup();
    click(toggles()[0]);
    assert.equal(charts.isTableMode(), true);
    for (const s of $$('.chart')) {
      assert.equal($('.chart__view', s).hidden, true);
      assert.equal($('.chart__table-wrap', s).hidden, false);
    }
    assert.deepEqual(toggles().map((t) => t.getAttribute('aria-pressed')), ['true', 'true', 'true', 'true']);
    assert.equal(toggles()[0].title, 'Xem biểu đồ');
    assert.equal(toggles()[0].getAttribute('aria-label'), 'Xem dạng bảng', 'tên nút giữ nguyên, trạng thái nằm ở aria-pressed');
    assert.equal($('.chart__table-wrap', slide('week')).querySelector('table') !== null, true);
    click(toggles()[3]);
    assert.equal(charts.isTableMode(), false);
    for (const s of $$('.chart')) {
      assert.equal($('.chart__view', s).hidden, false);
      assert.equal($('.chart__table-wrap', s).hidden, true);
    }
    assert.equal(toggles()[0].title, 'Xem dạng bảng');
  });

  test('biểu tượng nút đổi giữa "table" và "bar-chart"', () => {
    const { charts } = setup();
    const before = toggles()[0].innerHTML;
    charts.setTableMode(true);
    assert.notEqual(toggles()[0].innerHTML, before);
    charts.setTableMode(false);
    assert.equal(toggles()[0].innerHTML, before);
  });

  test('vuốt sang biểu đồ khác vẫn ở chế độ bảng (DESIGN §10.9)', () => {
    const { charts } = setup();
    charts.setTableMode(true);
    charts.goTo(2);
    assert.equal($('.chart__table-wrap', slide('day')).hidden, false);
    assert.equal($('.chart__view', slide('day')).hidden, true);
    assert.equal(toggles()[2].getAttribute('aria-pressed'), 'true');
  });

  test('chế độ bảng được nhớ cho phiên hiện tại (storage) và đọc lại khi mở lần sau', () => {
    const storage = memoryStorage();
    const first = setup({ mount: { storage } });
    first.charts.setTableMode(true);
    assert.equal(storage.map.get(TABLE_MODE_KEY), '1');
    first.charts.destroy();
    first.home.destroy();
    document.body.replaceChildren();
    const second = setup({ mount: { storage } });
    assert.equal(second.charts.isTableMode(), true);
    assert.equal($('.chart__view', slide('week')).hidden, true);
    second.charts.setTableMode(false);
    assert.equal(storage.map.get(TABLE_MODE_KEY), '0');
  });

  test('tuỳ chọn tableMode ghi đè giá trị đã nhớ', () => {
    const { charts } = setup({ mount: { storage: memoryStorage({ [TABLE_MODE_KEY]: '1' }), tableMode: false } });
    assert.equal(charts.isTableMode(), false);
  });

  test('storage hỏng / bị chặn không làm sập, chỉ không nhớ được', () => {
    const broken = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    const { charts } = setup({ mount: { storage: broken } });
    assert.equal(charts.isTableMode(), false);
    charts.setTableMode(true);
    assert.equal(charts.isTableMode(), true);
  });

  test('không có storage (null) vẫn chạy', () => {
    const { charts } = setup({ mount: { storage: null } });
    charts.setTableMode(true);
    assert.equal(charts.isTableMode(), true);
  });

  test('setTableMode với giá trị không đổi thì không làm gì', () => {
    const { charts, storage } = setup();
    charts.setTableMode(false);
    assert.equal(storage.map.size, 0);
  });

  test('bảng Tuần: tiêu đề Tuần · Thu · Chi; 5 hàng; hàng Tổng; Thu có +, Chi có −', () => {
    setup();
    assert.deepEqual(headRow('week'), ['Tuần', 'Thu', 'Chi']);
    assert.deepEqual(tableRows('week'), [
      ['1 (1–7)', '+5.000.000 ₫', '0 ₫'],
      ['2 (8–14)', '0 ₫', '−1.200.000 ₫'],
      ['3 (15–21)', '+200.000 ₫', '−300.000 ₫'],
      ['4 (22–28)', '0 ₫', '−85.000 ₫'],
      ['5 (29–31)', '0 ₫', '0 ₫'],
    ]);
    assert.deepEqual(footRow('week'), ['Tổng', '+5.200.000 ₫', '−1.585.000 ₫']);
  });

  test('bảng Danh mục: Danh mục (chấm màu + tên) · % · Số tiền; tổng 100%', () => {
    setup();
    assert.deepEqual(headRow('category'), ['Danh mục', '%', 'Số tiền']);
    assert.deepEqual(tableRows('category'), [
      ['Nhà ở', '76%', '1.200.000 ₫'],
      ['Mua sắm', '19%', '300.000 ₫'],
      ['Ăn uống', '3%', '45.000 ₫'],
      ['Di chuyển', '2%', '40.000 ₫'],
    ]);
    assert.deepEqual(footRow('category'), ['Tổng', '100%', '1.585.000 ₫']);
    assert.equal($$('tbody .dot', slide('category')).length, 4);
  });

  test('bảng Danh mục khi không có khoản chi: một dòng thông báo, không có hàng Tổng', () => {
    setup({ seed: [{ type: 'income', categoryId: SAL, amount: 1_000, date: '2026-10-02' }] });
    assert.deepEqual(tableRows('category'), [['Chưa có khoản chi trong tháng này']]);
    assert.equal($('tfoot', slide('category')), null);
  });

  test('bảng Ngày: 31 hàng đủ cả ngày không có giao dịch; tổng khớp', () => {
    setup();
    assert.deepEqual(headRow('day'), ['Ngày', 'Thu', 'Chi']);
    const rows = tableRows('day');
    assert.equal(rows.length, 31);
    assert.deepEqual(rows[0], ['01/10', '0 ₫', '0 ₫']);
    assert.deepEqual(rows[2], ['03/10', '+5.000.000 ₫', '0 ₫']);
    assert.deepEqual(rows[26], ['27/10', '0 ₫', '−85.000 ₫']);
    assert.deepEqual(rows[30], ['31/10', '0 ₫', '0 ₫']);
    assert.deepEqual(footRow('day'), ['Tổng', '+5.200.000 ₫', '−1.585.000 ₫']);
  });

  test('bảng Số dư luỹ kế: Ngày · Số dư; tới hôm nay; hàng cuối = số dư của thẻ tổng quan', () => {
    const { charts } = setup();
    assert.deepEqual(headRow('balance'), ['Ngày', 'Số dư luỹ kế']);
    const rows = tableRows('balance');
    assert.equal(rows.length, 27);
    assert.deepEqual(rows[0], ['01/10', '0 ₫']);
    assert.deepEqual(rows[2], ['03/10', '+5.000.000 ₫']);
    assert.deepEqual(rows.at(-1), ['27/10', '+3.615.000 ₫']);
    assert.equal(charts.getModel().summary.balance, 3_615_000);
    assert.equal($('tfoot', slide('balance')), null);
  });

  test('số dư âm trong bảng: dấu trừ thật và lớp màu chi', () => {
    setup({ seed: [{ amount: 400_000, date: '2026-10-05' }] });
    const row = $$('tbody tr', slide('balance'))[4];
    assert.equal(plain(row.querySelector('.num__full').textContent), '−400.000 ₫');
    assert.ok(row.querySelector('.num--expense'));
  });

  test('cột Thu dùng lớp màu thu, cột Chi dùng lớp màu chi (kèm dấu nên không chỉ dựa vào màu)', () => {
    setup();
    const row = $$('tbody tr', slide('week'))[0];
    assert.ok(row.children[1].classList.contains('num--income'));
    assert.ok(row.children[2].classList.contains('num--expense'));
    assert.ok(row.children[1].classList.contains('num'));
  });

  test('mỗi ô tiền có cả dạng đầy đủ và dạng rút gọn (điện thoại chọn bằng CSS); rút gọn ẩn khỏi trình đọc màn hình', () => {
    setup();
    const cell = $$('tbody tr', slide('day'))[26].children[2];
    assert.equal(plain($('.num__full', cell).textContent), '−85.000 ₫');
    assert.equal($('.num__compact', cell).textContent, '−85k');
    assert.equal($('.num__compact', cell).getAttribute('aria-hidden'), 'true');
  });

  test('chạm vào hàng của bảng ngày để xem số đầy đủ (bật/tắt is-expanded)', () => {
    setup();
    const tr = $$('tbody tr', slide('day'))[26];
    click(tr.children[2]);
    assert.ok(tr.classList.contains('is-expanded'));
    click(tr.children[0]);
    assert.equal(tr.classList.contains('is-expanded'), false);
  });

  test('số quá dài được đánh dấu is-long để điện thoại rút gọn', () => {
    setup({ seed: [{ amount: 999_999_999_999, date: '2026-10-05' }] });
    const long = $$('.num', slide('week')).filter((c) => c.classList.contains('is-long'));
    assert.ok(long.length >= 1);
    const cell = $('tfoot .num--expense', slide('week'));
    assert.ok(cell.classList.contains('is-long'));
    assert.equal($('.num__compact', cell).textContent, '−1.000 tỷ');
  });

  test('bảng có tên (aria-labelledby → tiêu đề biểu đồ), vùng cuộn có tên và nhận Tab, th có scope', () => {
    setup();
    for (const s of $$('.chart')) {
      const wrap = $('.chart__table-wrap', s);
      const table = $('table', wrap);
      assert.equal(wrap.getAttribute('role'), 'region');
      assert.equal(wrap.getAttribute('tabindex'), '0');
      assert.equal(wrap.getAttribute('aria-label'), `Bảng số liệu: ${$('.chart__title', s).textContent}`);
      assert.equal(document.getElementById(table.getAttribute('aria-labelledby')).textContent, $('.chart__title', s).textContent);
      assert.ok($$('thead th', table).every((th) => th.getAttribute('scope') === 'col'));
      assert.ok($$('tbody th, tfoot th', table).every((th) => th.getAttribute('scope') === 'row'));
    }
  });

  test('bảng cập nhật khi dữ liệu đổi và khi đổi tháng', () => {
    const { repo, home } = setup({ seed: [...DATA, { amount: 9_000, date: '2026-09-05' }] });
    repo.add(validInput({ amount: 15_000, date: '2026-10-24' }));
    assert.deepEqual(footRow('week'), ['Tổng', '+5.200.000 ₫', '−1.600.000 ₫']);
    home.setMonth('2026-09');
    assert.deepEqual(footRow('week'), ['Tổng', '0 ₫', '−9.000 ₫']);
    assert.equal(tableRows('day').length, 30);
  });

  test('tổng trong bảng khớp thẻ tổng quan của Trang chủ', () => {
    const { charts } = setup();
    const m = charts.getModel();
    assert.equal(m.summary.income, 5_200_000);
    assert.equal(m.summary.expense, 1_585_000);
    assert.equal(m.week.totals.income, m.summary.income);
    assert.equal(m.day.totals.expense, m.summary.expense);
    assert.equal(m.category.total, m.summary.expense);
  });
});

/* ================================================================== */
describe('Đổi tháng và dữ liệu thay đổi', () => {
  test('đổi tháng → toàn bộ biểu đồ đổi theo, vẫn ở biểu đồ đang xem', () => {
    const { home, charts } = setup({ seed: [...DATA, { amount: 70_000, date: '2026-09-12', categoryId: F }] });
    charts.goTo(1);
    home.setMonth('2026-09');
    assert.equal(charts.getActive(), 1, 'giữ nguyên biểu đồ đang xem để so sánh giữa các tháng');
    assert.equal($('.charts').getAttribute('aria-label'), 'Biểu đồ tháng 9/2026');
    assert.deepEqual($$('.donut__name').map((n) => n.textContent), ['Ăn uống']);
    assert.equal(hits('day').length, 30);
    assert.equal(charts.getModel().ym, '2026-09');
    home.setMonth('2026-10');
    assert.equal($$('.donut__name').length, 4);
    assert.equal(hits('day').length, 31);
  });

  test('tháng khác không rò dữ liệu sang nhau', () => {
    const { home } = setup({ seed: [...DATA, { amount: 70_000, date: '2026-09-12' }] });
    home.setMonth('2026-09');
    assert.deepEqual(barValues('week'), [['expense', 70_000]]);
    home.setMonth('2026-10');
    assert.equal(barValues('week').length, 5);
  });

  test('thêm / sửa / xoá / hoàn tác giao dịch → biểu đồ cập nhật ngay', () => {
    const { repo } = setup();
    const added = repo.add(validInput({ amount: 500_000, date: '2026-10-02', categoryId: F })).transaction;
    assert.equal(barValues('week')[1][1], 500_000);
    repo.update(added.id, { ...added, amount: 800_000 });
    assert.equal(barValues('week')[1][1], 800_000);
    const gone = repo.remove(added.id).transaction;
    assert.equal(barValues('week').some(([, v]) => v === 800_000), false);
    repo.restore(gone);
    assert.equal(barValues('week').some(([, v]) => v === 800_000), true);
  });

  test('sửa ngày giao dịch sang tuần khác → cột chuyển tuần', () => {
    const { repo } = setup({ seed: [{ amount: 100_000, date: '2026-10-02' }], now: makeClock(2026, 9, 31) });
    const tx = repo.listByMonth('2026-10').find((t) => t.amount === 100_000);
    repo.update(tx.id, { ...tx, date: '2026-10-30' });
    const week5 = $$('.chart[data-chart="week"] .chart-bar').find((b) => b.getAttribute('data-value') === '100000');
    assert.ok(week5);
    click(hit('week', 4));
    assert.match(tipText('week'), /Tuần 5 \(29–31\)Thu0 ₫Chi−100\.000 ₫/);
  });

  test('refresh() vẽ lại theo ngày hôm nay (qua ngày mới thì thêm điểm số dư)', () => {
    const { charts, now } = setup();
    assert.equal(hits('balance').length, 27);
    now.set(2026, 9, 28);
    charts.refresh();
    assert.equal(hits('balance').length, 28);
  });

  test('dữ liệu đổi khi đang cuộn biểu đồ ngày / bảng: giữ nguyên vị trí cuộn; đổi tháng thì về đầu', () => {
    const { repo, home, charts } = setup({ seed: [...DATA, { amount: 1, date: '2026-09-05' }] });
    charts.goTo(2);
    $('.chart__scroll', slide('day')).scrollLeft = 140;
    repo.add(validInput({ amount: 1_000, date: '2026-10-05' }));
    assert.equal($('.chart__scroll', slide('day')).scrollLeft, 140, 'biểu đồ ngày giữ chỗ cuộn');
    charts.setTableMode(true);
    $('.chart__table-wrap', slide('day')).scrollTop = 200;
    repo.add(validInput({ amount: 2_000, date: '2026-10-06' }));
    assert.equal($('.chart__table-wrap', slide('day')).scrollTop, 200, 'bảng giữ chỗ cuộn');
    home.setMonth('2026-09');
    assert.equal($('.chart__table-wrap', slide('day')).scrollTop, 0, 'đổi tháng thì bảng về đầu');
    assert.equal($('.chart__scroll', slide('day')).scrollLeft, 0, 'đổi tháng thì biểu đồ về đầu (không có gì để cuộn tới)');
  });

  test('khi chưa chọn gì, thay đổi dữ liệu không làm hiện tooltip', () => {
    const { repo } = setup();
    repo.add(validInput({ amount: 1_000, date: '2026-10-05' }));
    for (const k of ['week', 'category', 'day', 'balance']) assert.equal(tipVisible(k), false);
  });

  test('ghi dữ liệu lỗi (hết bộ nhớ) không làm sập biểu đồ và biểu đồ giữ nguyên số liệu cũ', () => {
    const { repo, backend } = setup();
    const before = JSON.stringify(barValues('week'));
    backend.failWrites = 'quota';
    const r = repo.add(validInput({ amount: 1_000, date: '2026-10-05' }));
    assert.equal(r.ok, false);
    assert.equal(JSON.stringify(barValues('week')), before);
  });
});

/* ================================================================== */
describe('Hiệu ứng (§8)', () => {
  test('lần đầu hiện: chỉ biểu đồ đang xem có hiệu ứng "mọc"; biểu đồ khác chờ tới lúc được vuốt tới', () => {
    setup({ mount: { animate: true } });
    assert.ok($('.chart-plot', slide('week')).classList.contains('is-entering'));
    assert.equal($('.chart-donut', slide('category')).classList.contains('is-entering'), false);
    assert.equal($('.chart-plot', slide('day')).classList.contains('is-entering'), false);
  });

  test('vuốt tới biểu đồ lần đầu thì có hiệu ứng, lần sau thì không; lớp hiệu ứng được gỡ khi xong (bật/tắt bảng không chạy lại)', async () => {
    const { charts } = setup({ mount: { animate: true } });
    charts.goTo(1);
    assert.ok($('.chart-donut', slide('category')).classList.contains('is-entering'));
    await sleep(750);
    assert.equal($('.chart-donut', slide('category')).classList.contains('is-entering'), false, 'đã gỡ lớp sau khi hiệu ứng kết thúc');
    assert.equal($('.chart-plot', slide('week')).classList.contains('is-entering'), false);
    charts.goTo(0);
    charts.goTo(1);
    assert.equal($('.chart-donut', slide('category')).classList.contains('is-entering'), false, 'chỉ lần đầu hiện / đổi tháng');
  });

  test('đổi tháng: biểu đồ đang xem lại có hiệu ứng và cả khung mờ dần; thêm giao dịch thì không', () => {
    const { home, repo } = setup({ seed: [...DATA, { amount: 1, date: '2026-09-02' }], mount: { animate: true } });
    repo.add(validInput({ amount: 1_000, date: '2026-10-05' }));
    assert.equal($('.chart-plot', slide('week')).classList.contains('is-entering'), false);
    assert.equal($('.charts').classList.contains('is-updating'), false);
    home.setMonth('2026-09');
    assert.ok($('.chart-plot', slide('week')).classList.contains('is-entering'));
    assert.ok($('.charts').classList.contains('is-updating'));
  });

  test('animate: false thì không bao giờ có hiệu ứng', () => {
    const { charts, home } = setup({ seed: [...DATA, { amount: 1, date: '2026-09-02' }] });
    charts.goTo(1);
    home.setMonth('2026-09');
    assert.equal($$('.is-entering').length, 0);
    assert.equal($('.charts').classList.contains('is-updating'), false);
  });

  test('prefers-reduced-motion: reduce → không có hiệu ứng mọc/mờ', () => {
    const original = globalThis.matchMedia;
    globalThis.matchMedia = () => ({ matches: true });
    cleanups.push(() => {
      if (original) globalThis.matchMedia = original;
      else delete globalThis.matchMedia;
    });
    const { home, charts } = setup({ seed: [...DATA, { amount: 1, date: '2026-09-02' }], mount: { animate: true } });
    charts.goTo(1);
    home.setMonth('2026-09');
    assert.equal($$('.is-entering').length, 0);
    assert.equal($('.charts').classList.contains('is-updating'), false);
  });
});

/* ================================================================== */
describe('Bề rộng và co giãn', () => {
  test('vẽ theo bề rộng thật của khung: vùng vẽ = bề rộng − 44 (cột trục)', () => {
    widths(360, 300);
    setup();
    assert.equal($('.chart-plot', slide('week')).getAttribute('width'), '256');
    assert.equal($('.chart-axis', slide('week')).getAttribute('width'), '44');
    assert.equal($('.chart-plot', slide('balance')).getAttribute('width'), '256');
  });

  test('khung đổi kích thước (resize) → vẽ lại theo bề rộng mới', async () => {
    const w = widths(360, 360);
    const { charts } = setup();
    assert.equal($('.chart-plot', slide('week')).getAttribute('width'), String(360 - 44));
    w.map.charts__track = 700;
    w.map.chart__body = 700;
    win.dispatchEvent(new win.Event('resize'));
    await sleep(60);
    assert.equal($('.chart-plot', slide('week')).getAttribute('width'), String(700 - 44));
    assert.equal(charts.getActive(), 0);
    win.dispatchEvent(new win.Event('resize')); // cùng bề rộng: không vẽ lại
    await sleep(40);
    assert.equal($('.chart-plot', slide('week')).getAttribute('width'), String(700 - 44));
  });

  test('resize khi chưa đo được (0) thì bỏ qua', async () => {
    setup();
    win.dispatchEvent(new win.Event('resize'));
    await sleep(40);
    assert.ok($('.chart-plot', slide('week')));
  });

  test('chiều cao khung theo biểu đồ đang xem (vành khuyên + chú giải cao hơn các biểu đồ khác)', () => {
    const { charts } = setup();
    for (const s of $$('.chart')) Object.defineProperty(s, 'offsetHeight', { configurable: true, value: { week: 290, category: 380, day: 290, balance: 290 }[s.dataset.chart] });
    charts.goTo(1);
    assert.equal($('.charts__track').style.height, '380px');
    charts.goTo(0);
    assert.equal($('.charts__track').style.height, '290px');
  });
});

/* ================================================================== */
describe('An toàn và trợ năng', () => {
  function seedWithHostileCategory() {
    const data = createDefaultData();
    data.categories.push({ id: 'cat-bad', name: '<img src=x onerror=alert(1)>', type: 'expense', icon: 'utensils', color: 'red;background:url(//evil)' });
    data.transactions.push({ id: 't1', type: 'expense', amount: 1000, categoryId: 'cat-bad', walletId: 'wallet-cash', date: '2026-10-05', note: '', createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z' });
    const backend = new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) });
    const now = makeClock();
    const repo = createRepo(createStore({ backend }), { now, idGen: makeIdGen() });
    const home = mountHome({ repo, now, animate: false });
    const charts = mountCharts({ repo, home, now, animate: false, storage: null });
    cleanups.push(() => {
      charts.destroy();
      home.destroy();
    });
    return { repo, charts };
  }

  test('tên danh mục độc hại chỉ hiện như chữ, không tạo thẻ HTML', () => {
    const { repo } = seedWithHostileCategory();
    assert.ok(repo.getCategory('cat-bad'), 'dữ liệu độc hại đã được nạp thật');
    assert.equal($('.charts img'), null);
    assert.ok($$('.donut__name').some((n) => n.textContent === '<img src=x onerror=alert(1)>'));
    click(hit('category', 0));
    assert.equal($('.charts img'), null);
    assert.equal($('.chart-tip__title', slide('category')).textContent, '<img src=x onerror=alert(1)>');
  });

  test('màu danh mục lạ rơi về màu "khác", không chèn được CSS', () => {
    const { repo } = seedWithHostileCategory();
    assert.ok(repo.getCategory('cat-bad'));
    for (const node of $$('.charts [style]')) assert.ok(!/evil|url\(/.test(node.getAttribute('style')), node.getAttribute('style'));
    const arc = $('.chart-slice');
    assert.match(arc.getAttribute('style'), /var\(--cat-other\)/);
  });

  test('vùng biểu đồ có nhãn tóm tắt cho trình đọc màn hình; hình vẽ SVG ẩn khỏi cây trợ năng', () => {
    setup();
    const label = plain($('.chart__view', slide('week')).getAttribute('aria-label'));
    assert.match(label, /^Thu & chi theo tuần\. Tổng thu 5\.200\.000 ₫, tổng chi 1\.585\.000 ₫\. Dùng nút Xem dạng bảng/);
    assert.match(plain($('.chart__view', slide('category')).getAttribute('aria-label')), /Tổng chi 1\.585\.000 ₫, nhiều nhất là Nhà ở 76%/);
    assert.match(plain($('.chart__view', slide('balance')).getAttribute('aria-label')), /Số dư cuối kỳ \+3\.615\.000 ₫/);
    for (const svg of $$('.charts svg.chart-svg')) assert.equal(svg.getAttribute('aria-hidden'), 'true');
    assert.equal($$('.chart-hit').filter((h) => h.hasAttribute('tabindex')).length, 0, 'vùng chạm không chen vào thứ tự Tab (đã có bảng thay thế)');
  });

  test('tóm tắt tiếng Việt cho biểu đồ chưa có số liệu', () => {
    setup({ seed: [{ amount: 1_000, date: '2026-09-05' }] });
    assert.match($('.chart__view', slide('category')).getAttribute('aria-label'), /Chưa có khoản chi/);
  });

  test('không dùng innerHTML với dữ liệu người dùng: nội dung văn bản qua textContent', () => {
    setup();
    for (const t of $$('.donut__name')) assert.equal(t.children.length, 0);
  });

  test('thứ tự Tab hợp lý: nút bảng của biểu đồ đang xem → nút ‹ › → chấm đang chọn', () => {
    setup();
    const focusable = $$('.charts button:not([disabled]), .charts [tabindex="0"]').filter((n) => !n.closest('[inert]'));
    const labels = focusable.map((n) => n.getAttribute('aria-label') ?? n.className);
    assert.equal(labels[0], 'Xem dạng bảng');
    assert.ok(labels.includes('Biểu đồ sau'));
    assert.ok(focusable.filter((n) => n.classList.contains('charts__dot') && n.tabIndex === 0).length === 1);
  });
});

/* ================================================================== */
describe('Tích hợp với Trang chủ (M2) và Danh sách (M3)', () => {
  test('mountCharts cần host và month (hoặc home)', () => {
    const { repo } = makeRepo();
    assert.throws(() => mountCharts({ repo }), /host và month/);
    assert.throws(() => mountCharts({ repo, host: document.body }), /host và month/);
  });

  test('có thể truyền host và month riêng thay vì home', () => {
    const { repo } = makeRepo();
    repo.add(validInput());
    const host = document.createElement('div');
    document.body.append(host);
    const home = mountHome({ repo, animate: false });
    const charts = mountCharts({ repo, host, month: home.month, animate: false, storage: null });
    cleanups.push(() => {
      charts.destroy();
      home.destroy();
    });
    assert.equal(host.firstElementChild, charts.element);
  });

  test('cùng tồn tại với danh sách giao dịch: biểu đồ và danh sách ở hai ô khác nhau, mỗi ô đúng nội dung', () => {
    const { repo, now } = makeRepo();
    for (const s of DATA) {
      now.advance(1000);
      repo.add(validInput(s));
    }
    const home = mountHome({ repo, now, animate: false });
    const toast = createToastHost();
    const charts = mountCharts({ repo, home, now, animate: false, storage: null });
    const list = mountTransactionList({ repo, home, now, animate: false, toast });
    cleanups.push(() => {
      list.destroy();
      charts.destroy();
      home.destroy();
      toast.destroy();
    });
    assert.ok(home.slots.charts.querySelector('.charts'));
    assert.ok(home.slots.list.querySelector('.tx-list'));
    assert.equal(home.slots.charts.querySelector('.tx'), null);
    assert.equal(list.visibleCount(), 6);
    // xoá một khoản ở danh sách → biểu đồ cập nhật
    const id = repo.listByMonth('2026-10').find((t) => t.amount === 1_200_000).id;
    repo.remove(id);
    assert.equal(barValues('week').some(([, v]) => v === 1_200_000), false);
  });

  test('bấm vào biểu đồ không mở Trang nhập liệu và không làm đổi tháng', () => {
    const { home } = setup();
    click(hit('week', 1));
    click(toggles()[0]);
    assert.equal(document.querySelector('.entry-overlay'), null);
    assert.equal(home.month.get(), '2026-10');
  });

  test('dùng được khi tháng đang xem là tháng cũ ngay từ đầu', () => {
    setup({ seed: [{ amount: 70_000, date: '2026-07-04' }], homeOpts: { initialMonth: '2026-07' } });
    assert.equal(hits('day').length, 31);
    assert.deepEqual(barValues('week'), [['expense', 70_000]]);
    assert.equal(hits('balance').length, 31);
  });
});

/* ================================================================== */
describe('Hiệu năng và dọn dẹp', () => {
  test('5.000 giao dịch: vẽ đủ 4 biểu đồ + 4 bảng dưới 1 giây (jsdom, chậm hơn trình duyệt thật nhiều lần)', () => {
    const { repo, now } = makeRepo();
    const cats = ['cat-expense-food', 'cat-expense-transport', 'cat-expense-home', 'cat-expense-shopping', 'cat-expense-fun'];
    for (let i = 0; i < 5000; i += 1) {
      const r = repo.add(validInput({ amount: 1000 + (i % 97) * 1000, categoryId: cats[i % cats.length], date: `2026-10-${String(1 + (i % 27)).padStart(2, '0')}`, note: '' }));
      assert.equal(r.ok, true);
    }
    const home = mountHome({ repo, now, animate: false });
    const t0 = performance.now();
    const charts = mountCharts({ repo, home, now, animate: false, storage: null });
    const first = performance.now() - t0;
    const t1 = performance.now();
    repo.add(validInput({ amount: 5000, date: '2026-10-02' }));
    const refresh = performance.now() - t1;
    cleanups.push(() => {
      charts.destroy();
      home.destroy();
    });
    assert.ok(first < 1000, `lần đầu ${first.toFixed(0)} ms`);
    assert.ok(refresh < 1000, `cập nhật ${refresh.toFixed(0)} ms`);
    assert.equal(charts.getModel().summary.count, 5001);
    assert.equal(charts.getModel().week.totals.expense, charts.getModel().summary.expense);
  });

  test('destroy: gỡ biểu đồ khỏi trang, ô charts trống lại, gọi nhiều lần không lỗi', () => {
    const { home, charts } = setup();
    charts.destroy();
    assert.equal($('.charts'), null);
    assert.equal(home.slots.charts.childElementCount, 0);
    charts.destroy();
  });

  test('sau destroy: đổi tháng, đổi dữ liệu, cuộn, chạm ngoài đều không ném lỗi và không vẽ lại', async () => {
    const { home, charts, repo } = setup({ seed: [...DATA, { amount: 1, date: '2026-09-05' }] });
    const track = $('.charts__track');
    charts.destroy();
    home.setMonth('2026-09');
    repo.add(validInput({ amount: 1_000, date: '2026-09-06' }));
    track.dispatchEvent(new win.Event('scroll'));
    pointer(document.body, 'pointerdown', 'touch');
    win.dispatchEvent(new win.Event('resize'));
    await sleep(60);
    assert.equal($('.charts'), null);
  });

  test('mount rồi destroy nhiều lần không để lại listener hay phần tử thừa', () => {
    const { repo, now } = makeRepo();
    repo.add(validInput());
    const home = mountHome({ repo, now, animate: false });
    cleanups.push(() => home.destroy());
    for (let i = 0; i < 5; i += 1) {
      const c = mountCharts({ repo, home, now, animate: false, storage: null });
      assert.equal($$('.charts').length, 1);
      c.destroy();
      assert.equal($$('.charts').length, 0);
    }
    const c = mountCharts({ repo, home, now, animate: false, storage: null });
    cleanups.push(() => c.destroy());
    repo.add(validInput({ amount: 3_000 }));
    assert.equal($$('.charts').length, 1);
  });
});
