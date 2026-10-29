import { win } from './dom-env.js';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mountHome } from '../src/ui/home.js';
import { mountTransactionList } from '../src/ui/tx-list.js';
import { mountCharts } from '../src/ui/charts.js';
import { mountSearch } from '../src/ui/search.js';
import { mountSettings, DEFAULT_PAGE_TITLES, PLACEHOLDER_TITLE } from '../src/ui/settings.js';
import { createToastHost } from '../src/ui/toast.js';
import { STORAGE_KEY } from '../src/core/storage.js';
import { createDefaultData } from '../src/core/defaults.js';
import { APP_VERSION } from '../src/core/app-info.js';
import { MemoryBackend, makeClock, makeRepo, plain, validInput } from './helpers.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const key = (target, k, init = {}) => {
  const e = new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};
function pointer(target, type, y, { pointerType = 'touch', pointerId = 1 } = {}) {
  const e = new win.MouseEvent(type, { clientX: 100, clientY: y, bubbles: true, cancelable: true, button: 0 });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  Object.defineProperty(e, 'pointerId', { value: pointerId });
  target.dispatchEvent(e);
}

const html = document.documentElement;
const overlay = () => $('.settings');
const panel = () => $('.settings__panel');
const gear = () => $('[data-action="open-settings"]');
const openGear = () => gear().click();
const titleText = () => document.getElementById(panel().getAttribute('aria-labelledby')).textContent;
const topPage = () => $$('.st-page').filter((p) => !p.hasAttribute('inert')).pop();
const radios = () => $$('[data-theme-option]');
const checked = () => radios().find((r) => r.getAttribute('aria-checked') === 'true')?.dataset.themeOption;
const chooseTheme = (t) => $(`[data-theme-option="${t}"]`).click();
const budgetSwitch = () => $('[data-action="toggle-budget"]');
const limitsRow = () => $('[data-page="budget-limits"]');
const rowsText = () => $$('.st-row', $('.st-page')).map((r) => plain(r.textContent));
const savedSettings = (backend) => JSON.parse(backend.getItem(STORAGE_KEY)).settings;

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
  document.body.replaceChildren();
  html.className = '';
  html.removeAttribute('data-theme');
});

function setup({ backend = new MemoryBackend(), now = makeClock(), seed = [], wide = false, settingsOpts = {}, full = false } = {}) {
  const { repo } = makeRepo({ backend, now });
  for (const s of seed) {
    now.advance(1000);
    assert.equal(repo.add(validInput(s)).ok, true);
  }
  const state = { wide };
  let settings = null;
  const home = mountHome({ repo, now, animate: false, onOpenSettings: () => settings.open() });
  const toast = createToastHost();
  const extras = [];
  let search = null;
  let list = null;
  let charts = null;
  if (full) {
    charts = mountCharts({ repo, home, now, animate: false });
    search = mountSearch({ repo, home, debounceMs: 0 });
    list = mountTransactionList({ repo, home, now, animate: false, toast, host: search.listHost, filter: search.filter });
    extras.push(() => list.destroy(), () => search.destroy(), () => charts.destroy());
  }
  settings = mountSettings({ repo, home, animate: false, toast, isWide: () => state.wide, ...settingsOpts });
  cleanups.push(() => {
    settings.destroy();
    for (const fn of extras) fn();
    home.destroy();
    toast.destroy();
  });
  return { repo, backend, now, home, toast, settings, state, search, list, charts };
}

const DATA = [
  { amount: 45_000, categoryId: 'cat-expense-food', date: '2026-10-27', note: 'Cà phê sáng' },
  { amount: 40_000, categoryId: 'cat-expense-transport', date: '2026-10-27', walletId: 'wallet-ewallet', note: 'Xe bus' },
  { type: 'income', categoryId: 'cat-income-salary', amount: 500_000, date: '2026-10-26', walletId: 'wallet-bank', note: 'Lương' },
];

/* ================================================================== */
describe('Mở, đóng bảng Cài đặt (F16)', () => {
  test('nút ⚙ trên Thanh tháng mở bảng; bảng là hộp thoại có tên "Cài đặt"', () => {
    setup();
    assert.equal(overlay(), null);
    openGear();
    assert.ok(overlay());
    assert.equal(panel().getAttribute('role'), 'dialog');
    assert.equal(panel().getAttribute('aria-modal'), 'true');
    assert.equal(titleText(), 'Cài đặt');
    assert.equal($('h1', panel()).textContent, 'Cài đặt');
  });

  test('khi mở: khoá cuộn nền, phần Trang chủ bị khoá (inert), ⚙ báo aria-expanded, focus vào mục giao diện đang chọn', () => {
    const { home } = setup();
    openGear();
    assert.ok(html.classList.contains('has-settings-open'));
    assert.equal(home.element.hasAttribute('inert'), true);
    assert.equal(home.element.getAttribute('aria-hidden'), 'true');
    assert.equal(gear().getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, $('[data-theme-option="system"]'));
  });

  test('nút ✕ đóng: gỡ bảng, mở khoá cuộn và Trang chủ, trả focus về nút ⚙', () => {
    const { home } = setup();
    gear().focus();
    openGear();
    $('[data-action="close-settings"]').click();
    assert.equal(overlay(), null);
    assert.equal(html.classList.contains('has-settings-open'), false);
    assert.equal(home.element.hasAttribute('inert'), false);
    assert.equal(home.element.hasAttribute('aria-hidden'), false);
    assert.equal(gear().getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement, gear());
  });

  test('Esc đóng bảng (ở trang gốc) và chặn Esc lan ra ngoài', () => {
    setup();
    openGear();
    const e = key(document.activeElement, 'Escape');
    assert.equal(e.defaultPrevented, true);
    assert.equal(overlay(), null);
  });

  test('chạm lớp phủ mờ đóng; chạm bên trong bảng không đóng', () => {
    setup();
    openGear();
    pointer($('.st-title'), 'pointerdown', 10);
    assert.ok(overlay());
    pointer($('.settings__scrim'), 'pointerdown', 10);
    assert.equal(overlay(), null);
  });

  test('mở nhiều lần chỉ có một bảng; open() trả true khi đã mở', () => {
    const { settings } = setup();
    openGear();
    assert.equal(settings.open(), true);
    assert.equal($$('.settings').length, 1);
    assert.equal(settings.isOpen(), true);
  });

  test('Trang nhập liệu (M1) đang mở thì không mở Cài đặt', () => {
    const { settings, home } = setup();
    home.openEntry();
    assert.ok($('.entry-overlay'));
    assert.equal(settings.open(), false);
    assert.equal(overlay(), null);
  });

  test('đóng rồi mở lại: luôn bắt đầu từ trang gốc', () => {
    const { settings } = setup();
    openGear();
    $('[data-page="wallets"]').click();
    assert.deepEqual(settings.getStack(), ['root', 'wallets']);
    settings.close();
    openGear();
    assert.deepEqual(settings.getStack(), ['root']);
    assert.equal($$('.st-page').length, 1);
  });

  test('open({ page }) mở thẳng trang con', () => {
    const { settings } = setup();
    assert.equal(settings.open({ page: 'categories' }), true);
    assert.deepEqual(settings.getStack(), ['root', 'categories']);
    assert.equal(titleText(), 'Danh mục');
  });

  test('có hiệu ứng: đóng thì chạy "is-leaving" rồi gỡ; mở lại giữa chừng không để lại hai bảng', async () => {
    const { settings } = setup({ settingsOpts: { animate: true } });
    openGear();
    settings.close();
    assert.equal(settings.isOpen(), false);
    assert.ok($('.settings.is-leaving'), 'đang chạy hiệu ứng đóng');
    assert.ok(html.classList.contains('has-settings-open'));
    openGear();
    assert.equal($$('.settings').length, 1);
    assert.equal($('.settings.is-leaving'), null);
    settings.close();
    await sleep(380);
    assert.equal(overlay(), null);
    assert.equal(html.classList.contains('has-settings-open'), false);
  });

  test('giảm chuyển động (prefers-reduced-motion): đóng ngay, không chờ hiệu ứng', () => {
    const saved = globalThis.matchMedia;
    globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q) });
    try {
      const { settings } = setup({ settingsOpts: { animate: true } });
      openGear();
      settings.close();
      assert.equal(overlay(), null);
    } finally {
      if (saved) globalThis.matchMedia = saved;
      else delete globalThis.matchMedia;
    }
  });

  test('destroy: gỡ mọi thứ, trả trạng thái trang, open() sau đó trả false', () => {
    const { settings, home } = setup();
    openGear();
    settings.destroy();
    assert.equal(overlay(), null);
    assert.equal(html.classList.contains('has-settings-open'), false);
    assert.equal(home.element.hasAttribute('inert'), false);
    assert.equal(settings.open(), false);
    assert.doesNotThrow(() => settings.destroy());
  });

  test('thiếu repo hoặc repo cũ (không có getSettings) thì báo lỗi rõ ràng', () => {
    assert.throws(() => mountSettings({}), /getSettings/);
    assert.throws(() => mountSettings({ repo: {} }), /getSettings/);
  });
});

/* ================================================================== */
describe('Nội dung trang gốc (DESIGN §10.2)', () => {
  test('các nhóm theo đúng thứ tự: Giao diện · Quản lý · Ngân sách · Dữ liệu', () => {
    setup();
    openGear();
    assert.deepEqual($$('.st-group__label').map((p) => p.textContent), ['Giao diện', 'Quản lý', 'Ngân sách', 'Dữ liệu']);
    for (const g of $$('.st-group')) assert.equal(document.getElementById(g.getAttribute('aria-labelledby')).tagName, 'P');
  });

  test('hàng điều hướng: Ví (3) · Danh mục (12) · Sao lưu & khôi phục; có biểu tượng, nhãn, số lượng, mũi tên', () => {
    setup();
    openGear();
    const wallets = $('[data-page="wallets"]');
    assert.equal($('.st-row__label', wallets).textContent, 'Ví');
    assert.equal($('.st-row__value', wallets).textContent, '3');
    assert.equal($('.st-row__value', $('[data-page="categories"]')).textContent, '12');
    assert.equal($('.st-row__value', $('[data-page="backup"]')), null);
    for (const row of $$('.st-row')) {
      assert.equal(row.tagName, 'BUTTON');
      assert.equal(row.type, 'button');
      assert.ok($('.st-row__icon svg', row), 'có biểu tượng');
    }
    for (const id of ['wallets', 'categories', 'backup']) assert.ok($('.st-row__chevron svg', $(`[data-page="${id}"]`)), `${id} có mũi tên`);
    assert.equal(wallets.getAttribute('aria-label'), 'Ví, 3 ví');
    assert.equal($('[data-page="categories"]').getAttribute('aria-label'), 'Danh mục, 12 danh mục');
  });

  test('số lượng ví / danh mục cập nhật khi dữ liệu đổi', () => {
    const { repo } = setup();
    openGear();
    const realWallets = repo.getWallets;
    repo.getWallets = () => [...realWallets(), { id: 'w-x', name: 'Ví mới', icon: 'wallet' }];
    repo.add(validInput({ date: '2026-10-27' }));
    assert.equal($('.st-row__value', $('[data-page="wallets"]')).textContent, '4');
  });

  test('chân trang: tên ứng dụng + phiên bản + dòng riêng tư', () => {
    setup();
    openGear();
    const lines = $$('.st-footer p').map((p) => p.textContent);
    assert.deepEqual(lines, [`Sổ Thu Chi · v${APP_VERSION}`, 'Dữ liệu lưu trên thiết bị này']);
  });

  test('phiên bản hiển thị khớp package.json', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
    assert.equal(`${APP_VERSION}.0`, pkg.version);
  });

  test('Giao diện: segmented 3 mục "Theo hệ thống / Sáng / Tối" dạng radiogroup', () => {
    setup();
    openGear();
    const group = $('.st-seg');
    assert.equal(group.getAttribute('role'), 'radiogroup');
    assert.equal(group.getAttribute('aria-label'), 'Giao diện');
    assert.deepEqual(radios().map((r) => r.textContent), ['Theo hệ thống', 'Sáng', 'Tối']);
    assert.deepEqual(radios().map((r) => r.getAttribute('role')), ['radio', 'radio', 'radio']);
    assert.ok(group.classList.contains('segmented'));
  });

  test('Ngân sách: công tắc "Bật ngân sách" (tắt mặc định) và hàng "Hạn mức theo danh mục" chỉ hiện khi bật', () => {
    setup();
    openGear();
    assert.equal(budgetSwitch().getAttribute('role'), 'switch');
    assert.equal(budgetSwitch().getAttribute('aria-checked'), 'false');
    assert.equal($('.st-row__label', budgetSwitch()).textContent, 'Bật ngân sách');
    assert.ok($('.st-switch', budgetSwitch()));
    assert.equal(limitsRow().closest('.st-item').hidden, true);
  });
});

/* ================================================================== */
describe('Giao diện sáng / tối (F13)', () => {
  test('mặc định "Theo hệ thống": mục đó được chọn và không có data-theme (CSS theo hệ điều hành)', () => {
    setup();
    openGear();
    assert.equal(checked(), 'system');
    assert.equal(html.hasAttribute('data-theme'), false);
    assert.deepEqual(radios().map((r) => r.tabIndex), [0, -1, -1]);
  });

  test('chọn Tối → áp dụng NGAY lên <html>, lưu vào kho, cập nhật mục chọn', () => {
    const { backend, settings } = setup();
    openGear();
    chooseTheme('dark');
    assert.equal(html.getAttribute('data-theme'), 'dark');
    assert.equal(checked(), 'dark');
    assert.equal(savedSettings(backend).theme, 'dark');
    assert.equal(settings.getTheme(), 'dark');
    assert.deepEqual(radios().map((r) => r.tabIndex), [-1, -1, 0]);
  });

  test('chuyển qua lại Sáng → Tối → Hệ thống → Sáng nhiều lần đều đúng', () => {
    const { backend } = setup();
    openGear();
    for (const [t, attr] of [['light', 'light'], ['dark', 'dark'], ['system', null], ['light', 'light'], ['dark', 'dark'], ['system', null], ['system', null]]) {
      chooseTheme(t);
      assert.equal(html.getAttribute('data-theme'), attr, t);
      assert.equal(checked(), t);
      assert.equal(savedSettings(backend).theme, t);
    }
  });

  test('NHỚ lựa chọn: mở lại ứng dụng (cùng localStorage) áp dụng giao diện đã lưu ngay khi khởi động, chưa cần mở Cài đặt', () => {
    const backend = new MemoryBackend();
    const first = setup({ backend });
    openGear();
    chooseTheme('dark');
    cleanups.pop()();
    document.body.replaceChildren();
    html.removeAttribute('data-theme');
    const second = setup({ backend });
    assert.equal(html.getAttribute('data-theme'), 'dark');
    assert.equal(second.settings.getTheme(), 'dark');
    openGear();
    assert.equal(checked(), 'dark');
    assert.ok(first);
  });

  test('dữ liệu lưu sẵn có giao diện lạ / hỏng → rơi về "Theo hệ thống", không ném lỗi', () => {
    const data = createDefaultData();
    data.settings.theme = 'neon';
    setup({ backend: new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) }) });
    assert.equal(html.hasAttribute('data-theme'), false);
  });

  test('bàn phím: mũi tên chọn mục kế và áp dụng ngay (xoay vòng); Home / End', () => {
    const { settings } = setup();
    openGear();
    key(document.activeElement, 'ArrowRight');
    assert.equal(settings.getTheme(), 'light');
    assert.equal(document.activeElement.dataset.themeOption, 'light');
    key(document.activeElement, 'ArrowDown');
    assert.equal(settings.getTheme(), 'dark');
    key(document.activeElement, 'ArrowRight');
    assert.equal(settings.getTheme(), 'system', 'xoay vòng');
    key(document.activeElement, 'ArrowLeft');
    assert.equal(settings.getTheme(), 'dark');
    key(document.activeElement, 'Home');
    assert.equal(settings.getTheme(), 'system');
    key(document.activeElement, 'End');
    assert.equal(settings.getTheme(), 'dark');
    assert.equal(html.getAttribute('data-theme'), 'dark');
  });

  test('đổi giao diện KHÔNG làm vẽ lại danh sách / biểu đồ (người nghe giao dịch không bị gọi)', () => {
    const { repo } = setup();
    let dataCalls = 0;
    repo.subscribe(() => (dataCalls += 1));
    openGear();
    chooseTheme('dark');
    chooseTheme('light');
    assert.equal(dataCalls, 0);
  });

  test('lưu lỗi (hết dung lượng): vẫn áp dụng trong lần mở này, báo cho người dùng, kho giữ giá trị cũ; hết lỗi thì lưu được', () => {
    const { backend, repo, toast } = setup();
    openGear();
    backend.failWrites = 'quota';
    chooseTheme('dark');
    assert.equal(html.getAttribute('data-theme'), 'dark', 'người dùng vẫn thấy giao diện họ chọn');
    assert.equal(checked(), 'dark');
    assert.equal(repo.getSettings().theme, 'system');
    assert.match($('.toast--error', toast.element).textContent, /Không lưu được lựa chọn giao diện/);
    backend.failWrites = null;
    chooseTheme('light');
    assert.equal(repo.getSettings().theme, 'light');
    chooseTheme('light');
  });

  test('đổi giao diện từ nơi khác qua kho (module khác) → <html> và mục chọn theo ngay', () => {
    const { repo, settings } = setup();
    openGear();
    repo.updateSettings({ theme: 'dark' });
    assert.equal(html.getAttribute('data-theme'), 'dark');
    assert.equal(checked(), 'dark');
    assert.equal(settings.getTheme(), 'dark');
  });

  test('setTheme (API): giá trị lạ bị từ chối và không đổi gì; onThemeChange được gọi khi đổi', () => {
    const seen = [];
    const { settings } = setup({ settingsOpts: { onThemeChange: (t) => seen.push(t) } });
    assert.equal(settings.setTheme('purple'), false);
    assert.equal(settings.setTheme(undefined), false);
    assert.equal(html.hasAttribute('data-theme'), false);
    assert.equal(settings.setTheme('dark'), true);
    assert.equal(settings.setTheme('dark'), true);
    assert.deepEqual(seen, ['dark'], 'chỉ báo khi thật sự đổi');
  });

  test('hiệu ứng đổi màu 200ms: thêm class "theme-fade" rồi gỡ; tắt hiệu ứng thì không thêm', async () => {
    const animated = setup({ settingsOpts: { animate: true } });
    animated.settings.setTheme('dark');
    assert.ok(html.classList.contains('theme-fade'));
    await sleep(300);
    assert.equal(html.classList.contains('theme-fade'), false);
    cleanups.pop()();
    document.body.replaceChildren();
    const plainOne = setup({ settingsOpts: { animate: false } });
    plainOne.settings.setTheme('light');
    assert.equal(html.classList.contains('theme-fade'), false);
  });

  test('giữ nguyên các class khác trên <html> khi đổi giao diện (ví dụ has-settings-open)', () => {
    setup();
    openGear();
    chooseTheme('dark');
    assert.ok(html.classList.contains('has-settings-open'));
    chooseTheme('system');
    assert.ok(html.classList.contains('has-settings-open'));
  });
});

/* ================================================================== */
describe('Công tắc Ngân sách', () => {
  test('bật → lưu, hiện hàng "Hạn mức theo danh mục"; tắt → ẩn', () => {
    const { backend, repo } = setup();
    openGear();
    budgetSwitch().click();
    assert.equal(budgetSwitch().getAttribute('aria-checked'), 'true');
    assert.equal(limitsRow().closest('.st-item').hidden, false);
    assert.equal(repo.getSettings().budgetEnabled, true);
    assert.equal(savedSettings(backend).budgetEnabled, true);
    budgetSwitch().click();
    assert.equal(budgetSwitch().getAttribute('aria-checked'), 'false');
    assert.equal(limitsRow().closest('.st-item').hidden, true);
    assert.equal(repo.getSettings().budgetEnabled, false);
  });

  test('nhớ trạng thái công tắc khi mở lại ứng dụng', () => {
    const backend = new MemoryBackend();
    setup({ backend });
    openGear();
    budgetSwitch().click();
    cleanups.pop()();
    document.body.replaceChildren();
    setup({ backend });
    openGear();
    assert.equal(budgetSwitch().getAttribute('aria-checked'), 'true');
    assert.equal(limitsRow().closest('.st-item').hidden, false);
  });

  test('lưu lỗi: công tắc quay về giá trị cũ và báo lỗi lưu trữ', () => {
    const { backend, toast } = setup();
    openGear();
    backend.failWrites = 'quota';
    budgetSwitch().click();
    assert.equal(budgetSwitch().getAttribute('aria-checked'), 'false');
    assert.equal(limitsRow().closest('.st-item').hidden, true);
    assert.match($('.toast--error', toast.element).textContent, /Không thể lưu cài đặt/);
  });

  test('đổi qua kho từ nơi khác thì công tắc theo ngay', () => {
    const { repo } = setup();
    openGear();
    repo.updateSettings({ budgetEnabled: true });
    assert.equal(budgetSwitch().getAttribute('aria-checked'), 'true');
  });

  test('"Hạn mức theo danh mục" mở trang tạm (M8 chưa xây)', () => {
    const { settings } = setup();
    openGear();
    budgetSwitch().click();
    limitsRow().click();
    assert.deepEqual(settings.getStack(), ['root', 'budget-limits']);
    assert.equal(titleText(), 'Hạn mức theo danh mục');
    assert.ok($('[data-placeholder]'));
  });
});

/* ================================================================== */
describe('Trang con và trang tạm "Đang phát triển"', () => {
  test('mỗi lối vào chưa có module mở ra trang tạm với tiêu đề đúng', () => {
    const { settings } = setup();
    openGear();
    budgetSwitch().click();
    for (const [page, title] of Object.entries(DEFAULT_PAGE_TITLES)) {
      $(`[data-page="${page}"]`, $('.st-page')).click();
      assert.equal(titleText(), title, page);
      assert.equal($('[data-placeholder] .st-placeholder__title', topPage()).textContent, PLACEHOLDER_TITLE);
      assert.match($('[data-placeholder] .st-placeholder__text', topPage()).textContent, new RegExp(`Mục “${title.replace(/[&]/g, '\\$&')}” sẽ có trong bản cập nhật sau`));
      settings.back();
      assert.deepEqual(settings.getStack(), ['root']);
    }
  });

  test('trang con: nút ‹ "Quay lại" bên trái, tiêu đề ở giữa; thay cho nút ✕', () => {
    setup();
    openGear();
    $('[data-page="wallets"]').click();
    const page = topPage();
    assert.equal($('[data-action="back"]', page).getAttribute('aria-label'), 'Quay lại');
    assert.equal($('[data-action="close-settings"]', page), null);
    assert.ok($('.st-title--center', page));
    assert.equal($('h1', page).textContent, 'Ví');
    assert.equal(page.getAttribute('aria-labelledby'), $('h1', page).id);
  });

  test('vào trang con: trang gốc bị khoá (inert) và trượt ra sau; nhãn hộp thoại đổi theo; focus vào nút Quay lại', () => {
    setup();
    openGear();
    const rootPage = $('.st-page');
    $('[data-page="wallets"]').click();
    assert.equal(rootPage.hasAttribute('inert'), true);
    assert.ok(rootPage.classList.contains('is-behind'));
    assert.equal(titleText(), 'Ví');
    assert.equal(document.activeElement, $('[data-action="back"]'));
    assert.equal($$('.st-page').length, 2);
  });

  test('Quay lại: trang con được gỡ, trang gốc dùng lại như cũ, focus về đúng hàng đã bấm', () => {
    const { settings } = setup();
    openGear();
    const rootPage = $('.st-page');
    const row = $('[data-page="categories"]');
    row.focus();
    row.click();
    $('[data-action="back"]').click();
    assert.deepEqual(settings.getStack(), ['root']);
    assert.equal($$('.st-page').length, 1);
    assert.equal(rootPage.hasAttribute('inert'), false);
    assert.equal(rootPage.classList.contains('is-behind'), false);
    assert.equal(document.activeElement, row);
    assert.equal(titleText(), 'Cài đặt');
  });

  test('Esc lùi một cấp ở trang con (không đóng bảng); ở trang gốc thì đóng', () => {
    const { settings } = setup();
    openGear();
    $('[data-page="wallets"]').click();
    key(document.activeElement, 'Escape');
    assert.equal(settings.isOpen(), true);
    assert.deepEqual(settings.getStack(), ['root']);
    key(document.activeElement, 'Escape');
    assert.equal(settings.isOpen(), false);
  });

  test('nút "Quay lại" trong trang tạm cũng lùi một cấp', () => {
    const { settings } = setup();
    openGear();
    $('[data-page="backup"]').click();
    $('[data-action="placeholder-back"]').click();
    assert.deepEqual(settings.getStack(), ['root']);
  });

  test('đóng bảng khi đang ở trang con → lần mở sau về trang gốc; không rò trang con', () => {
    const { settings } = setup();
    openGear();
    $('[data-page="wallets"]').click();
    settings.close();
    assert.equal(overlay(), null);
    assert.equal($('.st-page'), null);
  });

  test('có hiệu ứng trượt: trang con vào bằng "is-enter" rồi chạy; lùi thì "is-leaving" rồi gỡ sau 320ms', async () => {
    const { settings } = setup({ settingsOpts: { animate: true } });
    openGear();
    $('[data-page="wallets"]').click();
    const sub = topPage();
    assert.equal(sub.classList.contains('is-enter'), false, 'đã chốt vị trí đầu và bắt đầu trượt vào');
    settings.back();
    assert.ok(sub.classList.contains('is-leaving'));
    assert.equal(sub.hasAttribute('inert'), true);
    assert.ok(sub.isConnected);
    await sleep(380);
    assert.equal(sub.isConnected, false);
    assert.equal($$('.st-page').length, 1);
  });

  test('bấm Vào/Lùi liên tiếp rất nhanh khi đang trượt không để rác trong DOM', async () => {
    const { settings } = setup({ settingsOpts: { animate: true } });
    openGear();
    for (let i = 0; i < 5; i += 1) {
      settings.push('wallets');
      settings.back();
    }
    await sleep(380);
    assert.deepEqual(settings.getStack(), ['root']);
    assert.equal($$('.st-page').length, 1);
    assert.equal(topPage().classList.contains('is-behind'), false);
  });

  test('tiêu đề trang tạm lấy từ văn bản thuần — không chèn được HTML', () => {
    const { settings } = setup();
    openGear();
    settings.push('khac', { title: '<img src=x onerror="window.__xss=1">' });
    assert.equal($('.settings img'), null);
    assert.equal($('h1', topPage()).textContent, '<img src=x onerror="window.__xss=1">');
    assert.equal(win.__xss, undefined);
  });

  test('id lạ không có tiêu đề → "Đang phát triển"; id sai kiểu bị từ chối', () => {
    const { settings } = setup();
    openGear();
    assert.equal(settings.push('khong-co'), true);
    assert.equal(titleText(), PLACEHOLDER_TITLE);
    settings.back();
    for (const bad of ['', null, undefined, 5, {}]) assert.equal(settings.push(bad), false);
    assert.deepEqual(settings.getStack(), ['root']);
  });

  test('push / back khi bảng chưa mở: không làm gì, không ném lỗi', () => {
    const { settings } = setup();
    assert.equal(settings.push('wallets'), false);
    assert.equal(settings.back(), false);
    assert.equal(settings.close(), false);
  });

  test('Tab xoay vòng trong trang đang hiện (không thoát ra Trang chủ, không vào trang bị khoá)', () => {
    setup();
    openGear();
    $('[data-page="wallets"]').click();
    const items = $$('button', topPage()).filter((b) => b.tabIndex >= 0);
    const first = items[0];
    const last = items[items.length - 1];
    last.focus();
    assert.equal(key(last, 'Tab').defaultPrevented, true);
    assert.equal(document.activeElement, first);
    assert.equal(key(first, 'Tab', { shiftKey: true }).defaultPrevented, true);
    assert.equal(document.activeElement, last);
  });
});

/* ================================================================== */
describe('Khung để module khác gắn trang con (registerPage)', () => {
  test('trang đăng ký thay trang tạm: nhận ctx, tiêu đề riêng, nội dung nằm trong thân trang', () => {
    const { settings, repo } = setup();
    let got = null;
    settings.registerPage('wallets', {
      title: 'Danh sách ví',
      render(ctx) {
        got = ctx;
        const d = document.createElement('div');
        d.className = 'my-wallets';
        d.textContent = `Có ${ctx.repo.getWallets().length} ví`;
        return d;
      },
    });
    openGear();
    $('[data-page="wallets"]').click();
    assert.equal(titleText(), 'Danh sách ví');
    assert.equal($('.my-wallets', topPage()).textContent, 'Có 3 ví');
    assert.equal($('[data-placeholder]'), null);
    assert.equal(got.repo, repo);
    assert.equal(got.id, 'wallets');
    assert.equal(typeof got.push, 'function');
    assert.equal(settings.hasPage('wallets'), true);
  });

  test('ctx.push mở trang con cấp 2, ctx.back lùi, ctx.setTitle đổi tiêu đề, ctx.close đóng cả bảng', () => {
    const { settings } = setup();
    settings.registerPage('wallets', { title: 'Ví', render: (ctx) => Object.assign(document.createElement('button'), { className: 'go', onclick: () => ctx.push('wallet-edit', { id: 'w1' }) }) });
    settings.registerPage('wallet-edit', {
      title: 'Sửa ví',
      render(ctx) {
        const d = document.createElement('div');
        d.innerHTML = '<button class="retitle"></button><button class="goback"></button><button class="shut"></button>';
        d.querySelector('.retitle').onclick = () => ctx.setTitle('Ví Tiền mặt');
        d.querySelector('.goback').onclick = () => ctx.back();
        d.querySelector('.shut').onclick = () => ctx.close();
        d.dataset.params = JSON.stringify(ctx.params);
        return d;
      },
    });
    openGear();
    $('[data-page="wallets"]').click();
    $('.go', topPage()).click();
    assert.deepEqual(settings.getStack(), ['root', 'wallets', 'wallet-edit']);
    assert.equal(JSON.parse($('[data-params]').dataset.params).id, 'w1');
    $('.retitle', topPage()).click();
    assert.equal(titleText(), 'Ví Tiền mặt');
    $('.goback', topPage()).click();
    assert.deepEqual(settings.getStack(), ['root', 'wallets']);
    assert.equal(titleText(), 'Ví');
    $('.go', topPage()).click();
    $('.shut', topPage()).click();
    assert.equal(settings.isOpen(), false);
  });

  test('trả về { element, destroy }: destroy được gọi khi lùi và khi đóng bảng', () => {
    const { settings } = setup();
    const log = [];
    settings.registerPage('wallets', { render: () => ({ element: Object.assign(document.createElement('div'), { className: 'w' }), destroy: () => log.push('w') }) });
    settings.registerPage('categories', { render: () => ({ element: document.createElement('div'), destroy: () => log.push('c') }) });
    openGear();
    $('[data-page="wallets"]').click();
    settings.back();
    assert.deepEqual(log, ['w']);
    $('[data-page="categories"]').click();
    settings.close();
    assert.deepEqual(log, ['w', 'c']);
  });

  test('trang con lỗi khi dựng → ghi lỗi ra console và rơi về trang tạm, Cài đặt vẫn dùng được', () => {
    const { settings } = setup();
    settings.registerPage('wallets', {
      render() {
        throw new Error('hỏng');
      },
    });
    const original = console.error;
    const errors = [];
    console.error = (e) => errors.push(e);
    openGear();
    $('[data-page="wallets"]').click();
    console.error = original;
    assert.equal(errors.length, 1);
    assert.ok($('[data-placeholder]'));
    settings.back();
    assert.deepEqual(settings.getStack(), ['root']);
  });

  test('registerPage kiểm tra đầu vào; unregisterPage trả lại trang tạm', () => {
    const { settings } = setup();
    assert.throws(() => settings.registerPage('', { render() {} }), /registerPage/);
    assert.throws(() => settings.registerPage('root', { render() {} }), /registerPage/);
    assert.throws(() => settings.registerPage('x', {}), /registerPage/);
    assert.throws(() => settings.registerPage('x'), /registerPage/);
    settings.registerPage('wallets', { render: () => document.createElement('div') });
    assert.equal(settings.unregisterPage('wallets'), true);
    openGear();
    $('[data-page="wallets"]').click();
    assert.ok($('[data-placeholder]'));
  });
});

/* ================================================================== */
describe('Chuyển qua lại giữa các màn hình mà dữ liệu và trạng thái không mất', () => {
  test('mở / đóng Cài đặt và đổi giao diện giữ nguyên tháng, từ khoá tìm, bộ lọc, biểu đồ đang xem và các dòng đã vẽ', () => {
    const { home, search, charts, repo } = setup({ seed: DATA, full: true });
    home.month.prev();
    home.month.next();
    search.setQuery('xe');
    search.setType('expense');
    charts.goTo(2);
    const rowEl = $('.tx');
    const cardsBefore = $$('.card').map((c) => c.getAttribute('aria-label')).join('|');
    openGear();
    chooseTheme('dark');
    $('[data-page="wallets"]').click();
    $('[data-action="back"]').click();
    chooseTheme('light');
    $('[data-action="close-settings"]').click();
    assert.equal(home.month.get(), '2026-10');
    assert.equal($('.search__input').value, 'xe');
    assert.deepEqual(search.getCriteria(), { query: 'xe', type: 'expense', categoryIds: [], walletIds: [] });
    assert.equal(charts.getActive(), 2);
    assert.equal($('.tx'), rowEl, 'dòng giao dịch không bị vẽ lại');
    assert.equal($$('.card').map((c) => c.getAttribute('aria-label')).join('|'), cardsBefore);
    assert.equal(repo.count(), 3);
  });

  test('vòng đi: Trang chủ → Cài đặt → Trang chủ → Nhập liệu (lưu thật) → Trang chủ → Cài đặt: dữ liệu mới còn, cài đặt vẫn đúng', () => {
    const { repo, settings, backend } = setup({ seed: DATA, full: true });
    openGear();
    chooseTheme('dark');
    budgetSwitch().click();
    settings.close();
    assert.equal($$('.tx').length, 3);
    $('.fab').click();
    assert.ok($('.entry-overlay'));
    assert.equal(settings.open(), false, 'đang nhập liệu thì không mở được Cài đặt');
    const amount = $('.amount__input');
    amount.value = '12000';
    amount.dispatchEvent(new win.Event('input', { bubbles: true }));
    $$('.cat[role="radio"]').find((b) => $('.cat__name', b).textContent === 'Ăn uống').click();
    $('[data-action="save"]').click();
    assert.equal($('.entry-overlay'), null, 'đã lưu và quay về Trang chủ');
    assert.equal(repo.count(), 4);
    assert.equal($$('.tx').length, 4);
    openGear();
    assert.equal(checked(), 'dark');
    assert.equal(budgetSwitch().getAttribute('aria-checked'), 'true');
    assert.equal(html.getAttribute('data-theme'), 'dark');
    assert.equal(savedSettings(backend).theme, 'dark');
    assert.equal(savedSettings(backend).budgetEnabled, true);
    settings.close();
    assert.equal($$('.tx').length, 4);
  });

  test('đổi cài đặt không đụng tới giao dịch, danh mục, ví đã lưu (so sánh từng byte)', () => {
    const { backend } = setup({ seed: DATA });
    const before = JSON.parse(backend.getItem(STORAGE_KEY));
    openGear();
    chooseTheme('dark');
    budgetSwitch().click();
    $('[data-page="categories"]').click();
    $('[data-action="back"]').click();
    chooseTheme('system');
    budgetSwitch().click();
    const after = JSON.parse(backend.getItem(STORAGE_KEY));
    assert.deepEqual(after.transactions, before.transactions);
    assert.deepEqual(after.categories, before.categories);
    assert.deepEqual(after.wallets, before.wallets);
    assert.equal(after.settings.lastWalletId, before.settings.lastWalletId);
  });

  test('thêm giao dịch khi Cài đặt đang mở (kho đổi) vẫn cập nhật đúng phần Trang chủ phía sau', () => {
    const { repo, home } = setup({ seed: DATA, full: true });
    openGear();
    repo.add(validInput({ amount: 1_000, note: 'đang mở cài đặt', date: '2026-10-27' }));
    assert.equal($$('.tx').length, 4);
    assert.match($('.card--expense', home.element).getAttribute('aria-label'), /86\.000|86 000/);
  });

});

/* ================================================================== */
describe('Kéo xuống để đóng (điện thoại)', () => {
  const handle = () => $('.settings__handle');

  test('kéo tay nắm xuống quá ngưỡng rồi thả → đóng', () => {
    const { settings } = setup();
    openGear();
    pointer(handle(), 'pointerdown', 10);
    pointer(handle(), 'pointermove', 80);
    assert.match(panel().style.transform, /translateY\(70px\)/);
    assert.ok(panel().classList.contains('is-dragging'));
    pointer(handle(), 'pointermove', 200);
    pointer(handle(), 'pointerup', 200);
    assert.equal(settings.isOpen(), false);
    assert.equal(overlay(), null);
  });

  test('kéo ngắn rồi thả → bật về chỗ cũ, vẫn mở', async () => {
    const { settings } = setup();
    openGear();
    pointer(handle(), 'pointerdown', 10);
    await sleep(60);
    pointer(handle(), 'pointermove', 30);
    await sleep(60);
    pointer(handle(), 'pointerup', 30);
    assert.equal(settings.isOpen(), true);
    assert.equal(panel().style.transform, '');
    assert.equal(panel().classList.contains('is-dragging'), false);
  });

  test('vuốt nhanh (dù ngắn) cũng đóng', () => {
    const { settings } = setup();
    openGear();
    pointer(handle(), 'pointerdown', 10);
    pointer(handle(), 'pointermove', 40);
    pointer(handle(), 'pointerup', 60);
    assert.equal(settings.isOpen(), false);
  });

  test('kéo lên không làm gì (không kéo bảng lên quá chỗ)', () => {
    const { settings } = setup();
    openGear();
    pointer(handle(), 'pointerdown', 300);
    pointer(handle(), 'pointermove', 100);
    assert.match(panel().style.transform, /translateY\(0px\)/);
    pointer(handle(), 'pointerup', 100);
    assert.equal(settings.isOpen(), true);
  });

  test('kéo cả bằng thanh tiêu đề; nhưng bấm trúng nút trong thanh tiêu đề thì không bắt đầu kéo', () => {
    const { settings } = setup();
    openGear();
    pointer($('.st-head .icon-btn'), 'pointerdown', 10);
    pointer($('.st-head .icon-btn'), 'pointermove', 300);
    pointer($('.st-head .icon-btn'), 'pointerup', 300);
    assert.equal(settings.isOpen(), true);
    pointer($('.st-title'), 'pointerdown', 10);
    pointer($('.st-title'), 'pointermove', 300);
    pointer($('.st-title'), 'pointerup', 300);
    assert.equal(settings.isOpen(), false);
  });

  test('chuột không kéo được; bố cục laptop (hộp thoại bên phải) cũng không có kéo', () => {
    const { settings, state } = setup();
    openGear();
    pointer(handle(), 'pointerdown', 10, { pointerType: 'mouse' });
    pointer(handle(), 'pointermove', 300, { pointerType: 'mouse' });
    pointer(handle(), 'pointerup', 300, { pointerType: 'mouse' });
    assert.equal(settings.isOpen(), true);
    state.wide = true;
    pointer(handle(), 'pointerdown', 10);
    pointer(handle(), 'pointermove', 300);
    pointer(handle(), 'pointerup', 300);
    assert.equal(settings.isOpen(), true);
  });

  test('huỷ cử chỉ (pointercancel) → bật về chỗ cũ', () => {
    const { settings } = setup();
    openGear();
    pointer(handle(), 'pointerdown', 10);
    pointer(handle(), 'pointermove', 60);
    pointer(handle(), 'pointercancel', 60);
    assert.equal(settings.isOpen(), true);
    assert.equal(panel().style.transform, '');
  });
});

describe('Dọn dẹp và vòng đời', () => {
  test('mở rồi đóng: mọi lắng nghe đã thêm vào document đều được gỡ (không rò)', () => {
    const { settings } = setup();
    const added = [];
    const removed = [];
    const add = document.addEventListener;
    const remove = document.removeEventListener;
    document.addEventListener = function (type, fn, opts) {
      added.push([type, fn, !!(opts === true || opts?.capture)]);
      return add.call(this, type, fn, opts);
    };
    document.removeEventListener = function (type, fn, opts) {
      removed.push([type, fn, !!(opts === true || opts?.capture)]);
      return remove.call(this, type, fn, opts);
    };
    try {
      settings.open();
      settings.close();
    } finally {
      document.addEventListener = add;
      document.removeEventListener = remove;
    }
    assert.ok(added.length >= 1, 'có đăng ký phím Esc');
    for (const [type, fn, capture] of added) assert.ok(removed.some(([t, f, c]) => t === type && f === fn && c === capture), `chưa gỡ ${type}`);
  });

  test('destroy: thôi nghe cài đặt — đổi giao diện qua kho sau đó không còn tác động tới <html>', () => {
    const { settings, repo } = setup();
    settings.destroy();
    repo.updateSettings({ theme: 'dark' });
    assert.equal(html.hasAttribute('data-theme'), false);
  });

  test('lùi rồi vào trang khác ngay khi trang trước còn đang trượt ra: không rác trong DOM sau hiệu ứng', async () => {
    const { settings } = setup({ settingsOpts: { animate: true } });
    openGear();
    settings.push('wallets');
    settings.back();
    settings.push('categories');
    assert.deepEqual(settings.getStack(), ['root', 'categories']);
    assert.equal(titleText(), 'Danh mục');
    await sleep(380);
    assert.equal($$('.st-page').length, 2, 'chỉ còn trang gốc và trang đang mở');
    assert.equal(topPage().querySelector('h1').textContent, 'Danh mục');
    settings.back();
    await sleep(380);
    assert.equal($$('.st-page').length, 1);
  });

  test('nhấn Esc khi bảng đang chạy hiệu ứng đóng không gây lỗi và không mở lại', async () => {
    const { settings } = setup({ settingsOpts: { animate: true } });
    openGear();
    settings.close();
    assert.doesNotThrow(() => key(document.body, 'Escape'));
    await sleep(380);
    assert.equal(overlay(), null);
    assert.equal(settings.isOpen(), false);
  });
});
