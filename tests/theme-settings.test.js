import { win } from './dom-env.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { DEFAULT_THEME, THEMES, THEME_BOOT_SCRIPT, THEME_LABELS, applyTheme, normalizeTheme, resolveTheme, systemPrefersDark } from '../src/core/theme.js';
import { createStore, STORAGE_KEY } from '../src/core/storage.js';
import { createRepo } from '../src/core/repo.js';
import { createDefaultData } from '../src/core/defaults.js';
import { MemoryBackend, makeClock, makeRepo, validInput } from './helpers.js';

const indexHtml = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

describe('Giao diện sáng/tối – lõi (theme.js)', () => {
  test('ba chế độ theo PRD F13, mặc định "Theo hệ thống"', () => {
    assert.deepEqual(THEMES, ['system', 'light', 'dark']);
    assert.equal(DEFAULT_THEME, 'system');
    assert.deepEqual(THEME_LABELS, { system: 'Theo hệ thống', light: 'Sáng', dark: 'Tối' });
  });

  test('normalizeTheme: giá trị lạ / sai kiểu rơi về mặc định', () => {
    for (const t of THEMES) assert.equal(normalizeTheme(t), t);
    for (const bad of ['', 'Dark', 'DARK', 'auto', ' light', null, undefined, 0, 1, true, {}, [], ['dark'], () => 'dark']) assert.equal(normalizeTheme(bad), 'system', String(bad));
  });

  test('resolveTheme: hệ thống theo hệ điều hành, sáng/tối cố định thì bỏ qua hệ điều hành', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
    assert.equal(resolveTheme('bậy', true), 'dark', 'giá trị lạ coi như hệ thống');
  });

  test('applyTheme: sáng/tối đặt data-theme, hệ thống gỡ data-theme', () => {
    const root = document.createElement('html');
    assert.equal(applyTheme(root, 'dark'), 'dark');
    assert.equal(root.getAttribute('data-theme'), 'dark');
    assert.equal(applyTheme(root, 'light'), 'light');
    assert.equal(root.getAttribute('data-theme'), 'light');
    assert.equal(applyTheme(root, 'system'), 'system');
    assert.equal(root.hasAttribute('data-theme'), false);
    assert.equal(applyTheme(root, 'rác'), 'system');
    assert.equal(root.hasAttribute('data-theme'), false);
  });

  test('applyTheme không đụng các thuộc tính / class khác của phần tử gốc', () => {
    const root = document.createElement('html');
    root.className = 'has-entry-open';
    root.setAttribute('lang', 'vi');
    applyTheme(root, 'dark');
    applyTheme(root, 'system');
    assert.equal(root.className, 'has-entry-open');
    assert.equal(root.getAttribute('lang'), 'vi');
  });

  test('systemPrefersDark: không có matchMedia → sáng; matchMedia ném lỗi → sáng; đọc đúng giá trị', () => {
    const saved = globalThis.matchMedia;
    try {
      delete globalThis.matchMedia;
      assert.equal(systemPrefersDark(), false);
      globalThis.matchMedia = () => {
        throw new Error('boom');
      };
      assert.equal(systemPrefersDark(), false);
      globalThis.matchMedia = (q) => ({ matches: q === '(prefers-color-scheme: dark)' });
      assert.equal(systemPrefersDark(), true);
      globalThis.matchMedia = () => ({ matches: false });
      assert.equal(systemPrefersDark(), false);
    } finally {
      if (saved) globalThis.matchMedia = saved;
      else delete globalThis.matchMedia;
    }
  });
});

describe('Mã chạy sớm chống nháy sáng → tối (index.html)', () => {
  const inline = /<script>([^<]*sotc:data[^<]*)<\/script>/.exec(indexHtml)?.[1];

  /** Chạy đoạn mã trong một trang jsdom riêng với localStorage cho trước (hoặc hỏng). */
  function boot(storage) {
    const d = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
    if (storage === 'throws') {
      Object.defineProperty(d.window, 'localStorage', {
        get() {
          throw new Error('SecurityError');
        },
      });
    } else if (storage !== undefined) {
      for (const [k, v] of Object.entries(storage)) d.window.localStorage.setItem(k, v);
    }
    d.window.eval(inline);
    return d.window.document.documentElement.getAttribute('data-theme');
  }
  const data = (settings) => JSON.stringify({ ...createDefaultData(), settings });

  test('index.html nhúng đúng đoạn mã trong theme.js và đặt nó TRƯỚC mọi thẻ <link> CSS', () => {
    assert.ok(inline, 'không thấy đoạn mã');
    assert.equal(inline, THEME_BOOT_SCRIPT);
    assert.ok(indexHtml.indexOf(inline) < indexHtml.indexOf('<link rel="stylesheet"'), 'phải chạy trước khi CSS được áp dụng');
  });

  test('đã lưu tối / sáng → đặt data-theme tương ứng', () => {
    assert.equal(boot({ [STORAGE_KEY]: data({ theme: 'dark' }) }), 'dark');
    assert.equal(boot({ [STORAGE_KEY]: data({ theme: 'light' }) }), 'light');
  });

  test('"Theo hệ thống", thiếu, hoặc giá trị lạ → không đặt (để CSS theo hệ điều hành)', () => {
    for (const theme of ['system', 'DARK', 'auto', '', null, 5, ['dark'], { a: 1 }]) assert.equal(boot({ [STORAGE_KEY]: data({ theme }) }), null, JSON.stringify(theme));
    assert.equal(boot({ [STORAGE_KEY]: data({}) }), null);
  });

  test('lần đầu (chưa có dữ liệu), dữ liệu hỏng, thiếu settings, localStorage bị chặn → không lỗi, không đặt', () => {
    assert.equal(boot({}), null);
    assert.equal(boot({ [STORAGE_KEY]: '{hỏng' }), null);
    assert.equal(boot({ [STORAGE_KEY]: 'null' }), null);
    assert.equal(boot({ [STORAGE_KEY]: '"dark"' }), null);
    assert.equal(boot({ [STORAGE_KEY]: JSON.stringify({ transactions: [] }) }), null);
    assert.equal(boot('throws'), null);
  });

  test('khoá lưu trữ trong đoạn mã trùng với STORAGE_KEY của ứng dụng', () => {
    assert.ok(inline.includes(`'${STORAGE_KEY}'`));
  });
});

/* ================================================================== */
describe('Kho dữ liệu – đọc / ghi cài đặt (chỉ thêm, M6)', () => {
  const lastWallet = (backend) => JSON.parse(backend.getItem(STORAGE_KEY)).settings.lastWalletId;

  test('mặc định: theo hệ thống, ngân sách tắt, chưa có hạn mức', () => {
    const { repo } = makeRepo();
    assert.deepEqual(repo.getSettings(), { theme: 'system', budgetEnabled: false, budgets: {} });
  });

  test('getSettings trả bản sao: sửa kết quả không ảnh hưởng kho', () => {
    const { repo } = makeRepo();
    const s = repo.getSettings();
    s.theme = 'dark';
    s.budgets.x = 1;
    assert.deepEqual(repo.getSettings(), { theme: 'system', budgetEnabled: false, budgets: {} });
  });

  test('đổi giao diện: lưu, đọc lại đúng, ghi vào localStorage', () => {
    const { repo, backend } = makeRepo();
    const res = repo.updateSettings({ theme: 'dark' });
    assert.deepEqual(res, { ok: true, changed: true, settings: { theme: 'dark', budgetEnabled: false, budgets: {} } });
    assert.equal(repo.getSettings().theme, 'dark');
    assert.equal(JSON.parse(backend.getItem(STORAGE_KEY)).settings.theme, 'dark');
  });

  test('NHỚ lựa chọn: mở lại ứng dụng (kho mới trên cùng localStorage) vẫn giữ giao diện và công tắc ngân sách', () => {
    const backend = new MemoryBackend();
    const a = makeRepo({ backend }).repo;
    a.updateSettings({ theme: 'light', budgetEnabled: true });
    const b = createRepo(createStore({ backend }));
    assert.deepEqual(b.getSettings(), { theme: 'light', budgetEnabled: true, budgets: {} });
  });

  test('đổi qua lại sáng → tối → hệ thống → sáng đều được ghi lại đúng', () => {
    const { repo } = makeRepo();
    for (const t of ['dark', 'system', 'light', 'dark', 'dark', 'light']) {
      assert.equal(repo.updateSettings({ theme: t }).ok, true);
      assert.equal(repo.getSettings().theme, t);
    }
  });

  test('không có gì đổi → ok, changed:false, KHÔNG ghi xuống localStorage, không báo người nghe', () => {
    const { repo, backend } = makeRepo();
    let calls = 0;
    repo.subscribeSettings(() => (calls += 1));
    const writes = backend.writes;
    assert.deepEqual(repo.updateSettings({ theme: 'system' }), { ok: true, changed: false, settings: { theme: 'system', budgetEnabled: false, budgets: {} } });
    assert.deepEqual(repo.updateSettings({}), { ok: true, changed: false, settings: repo.getSettings() });
    assert.equal(backend.writes, writes);
    assert.equal(calls, 0);
  });

  test('có thể đổi nhiều khoá cùng lúc, và chỉ khoá được nêu mới đổi', () => {
    const { repo } = makeRepo();
    repo.updateSettings({ theme: 'dark' });
    repo.updateSettings({ budgetEnabled: true });
    assert.deepEqual(repo.getSettings(), { theme: 'dark', budgetEnabled: true, budgets: {} });
    repo.updateSettings({ theme: 'light', budgetEnabled: false });
    assert.deepEqual(repo.getSettings(), { theme: 'light', budgetEnabled: false, budgets: {} });
  });

  test('kiểm tra giá trị: theme, budgetEnabled sai kiểu / sai giá trị bị từ chối, cài đặt cũ giữ nguyên', () => {
    const { repo, backend } = makeRepo();
    repo.updateSettings({ theme: 'dark' });
    const writes = backend.writes;
    for (const patch of [{ theme: 'purple' }, { theme: '' }, { theme: null }, { theme: 1 }, { theme: 'Dark' }, { budgetEnabled: 'true' }, { budgetEnabled: 1 }, { budgetEnabled: null }, { budgets: null }, { budgets: [] }, { budgets: 5 }]) {
      const res = repo.updateSettings(patch);
      assert.equal(res.ok, false, JSON.stringify(patch));
      assert.equal(res.error, 'validation');
      assert.ok(Object.keys(res.errors).length >= 1);
    }
    assert.equal(repo.getSettings().theme, 'dark');
    assert.equal(backend.writes, writes, 'bị từ chối thì không ghi');
  });

  test('khoá lạ (kể cả lastWalletId, __proto__) bị từ chối, một khoá sai thì cả bản vá bị từ chối', () => {
    const { repo } = makeRepo();
    const before = repo.getSettings();
    assert.deepEqual(repo.updateSettings({ lastWalletId: 'wallet-bank' }).errors, { lastWalletId: 'unknown' });
    assert.deepEqual(repo.updateSettings({ foo: 1 }).errors, { foo: 'unknown' });
    const hostile = JSON.parse('{"__proto__": {"theme": "dark"}, "theme": "dark"}');
    const rejected = repo.updateSettings(hostile);
    assert.equal(rejected.ok, false);
    assert.equal(Object.hasOwn(rejected.errors, '__proto__'), true, 'lỗi ghi nhận đúng khoá __proto__');
    const mixed = repo.updateSettings({ theme: 'dark', budgetEnabled: 'x' });
    assert.equal(mixed.ok, false);
    assert.deepEqual(repo.getSettings(), before, 'không áp dụng nửa vời');
    assert.equal(({}).theme, undefined, 'không ô nhiễm Object.prototype');
  });

  test('đầu vào không phải đối tượng → validation, không ném lỗi', () => {
    const { repo } = makeRepo();
    for (const v of [null, undefined, 5, 'dark', true, [], [{ theme: 'dark' }]]) {
      const res = repo.updateSettings(v);
      assert.equal(res.ok, false);
      assert.equal(res.error, 'validation');
    }
  });

  test('hạn mức ngân sách: số nguyên > 0 trong giới hạn; sai → từ chối; không bị sửa đổi từ bên ngoài', () => {
    const { repo } = makeRepo();
    const budgets = { 'cat-expense-food': 2_000_000 };
    assert.equal(repo.updateSettings({ budgets }).ok, true);
    budgets['cat-expense-food'] = 1;
    budgets.thêm = 5;
    assert.deepEqual(repo.getSettings().budgets, { 'cat-expense-food': 2_000_000 }, 'kho giữ bản sao');
    for (const bad of [{ a: 0 }, { a: -5 }, { a: 1.5 }, { a: '100' }, { a: null }, { a: Number.NaN }, { a: 1e15 }, JSON.parse('{"__proto__": 5}')]) assert.equal(repo.updateSettings({ budgets: bad }).ok, false, JSON.stringify(bad));
    assert.equal(repo.updateSettings({ budgets: {} }).ok, true, 'xoá hết hạn mức');
    assert.deepEqual(repo.getSettings().budgets, {});
  });

  test('getSettings làm sạch dữ liệu hỏng đã lưu sẵn (sửa tay / bản cũ)', () => {
    const data = createDefaultData();
    data.settings = { theme: 'neon', budgetEnabled: 'yes', budgets: { a: 5, b: -1, c: 'x', d: 1.5, e: null }, lastWalletId: null };
    const repo = createRepo(createStore({ backend: new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) }) }));
    assert.deepEqual(repo.getSettings(), { theme: 'system', budgetEnabled: false, budgets: { a: 5 } });
    const old = createDefaultData();
    delete old.settings.theme;
    delete old.settings.budgetEnabled;
    delete old.settings.budgets;
    const repo2 = createRepo(createStore({ backend: new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(old) }) }));
    assert.deepEqual(repo2.getSettings(), { theme: 'system', budgetEnabled: false, budgets: {} });
  });

  test('ĐỔI CÀI ĐẶT KHÔNG LÀM MẤT DỮ LIỆU: giao dịch, danh mục, ví, ví dùng gần nhất giữ nguyên', () => {
    const { repo, backend } = makeRepo();
    const a = repo.add(validInput({ walletId: 'wallet-bank', note: 'giữ lại' }));
    repo.add(validInput({ amount: 1000, note: 'thứ hai' }));
    const before = JSON.parse(backend.getItem(STORAGE_KEY));
    repo.updateSettings({ theme: 'dark', budgetEnabled: true });
    repo.updateSettings({ theme: 'light' });
    const after = JSON.parse(backend.getItem(STORAGE_KEY));
    assert.deepEqual(after.transactions, before.transactions);
    assert.deepEqual(after.categories, before.categories);
    assert.deepEqual(after.wallets, before.wallets);
    assert.equal(after.schemaVersion, before.schemaVersion);
    assert.equal(after.settings.lastWalletId, before.settings.lastWalletId);
    assert.equal(lastWallet(backend), repo.getLastWalletId());
    assert.equal(repo.getTransaction(a.transaction.id).note, 'giữ lại');
  });

  test('ngược lại: thêm/sửa/xoá giao dịch không làm mất cài đặt', () => {
    const { repo } = makeRepo();
    repo.updateSettings({ theme: 'dark', budgetEnabled: true, budgets: { 'cat-expense-food': 5000 } });
    const t = repo.add(validInput());
    repo.update(t.transaction.id, validInput({ amount: 2000 }));
    repo.remove(t.transaction.id);
    assert.deepEqual(repo.getSettings(), { theme: 'dark', budgetEnabled: true, budgets: { 'cat-expense-food': 5000 } });
  });

  test('người nghe cài đặt: chỉ được báo khi cài đặt đổi thật; người nghe giao dịch KHÔNG bị báo (khỏi vẽ lại danh sách/biểu đồ)', () => {
    const { repo } = makeRepo();
    let settingsCalls = 0;
    let dataCalls = 0;
    const off = repo.subscribeSettings(() => (settingsCalls += 1));
    repo.subscribe(() => (dataCalls += 1));
    repo.updateSettings({ theme: 'dark' });
    assert.equal(settingsCalls, 1);
    assert.equal(dataCalls, 0);
    repo.add(validInput());
    assert.equal(settingsCalls, 1, 'thêm giao dịch không báo người nghe cài đặt');
    assert.equal(dataCalls, 1);
    off();
    repo.updateSettings({ theme: 'light' });
    assert.equal(settingsCalls, 1, 'đã huỷ đăng ký');
  });

  test('người nghe thấy cài đặt MỚI ngay khi được gọi; một người nghe lỗi không làm hỏng việc lưu', () => {
    const { repo } = makeRepo();
    let seen = null;
    const original = console.error;
    console.error = () => {};
    repo.subscribeSettings(() => {
      throw new Error('boom');
    });
    repo.subscribeSettings(() => (seen = repo.getSettings().theme));
    const res = repo.updateSettings({ theme: 'dark' });
    console.error = original;
    assert.equal(res.ok, true);
    assert.equal(seen, 'dark');
  });

  test('lỗi lưu trữ (hết dung lượng): trả lỗi, cài đặt cũ giữ nguyên, không báo người nghe', () => {
    const { repo, backend } = makeRepo();
    repo.updateSettings({ theme: 'light' });
    let calls = 0;
    repo.subscribeSettings(() => (calls += 1));
    backend.failWrites = 'quota';
    const res = repo.updateSettings({ theme: 'dark' });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'storage');
    assert.equal(res.reason, 'quota');
    assert.equal(repo.getSettings().theme, 'light');
    assert.equal(calls, 0);
    backend.failWrites = null;
    assert.equal(repo.updateSettings({ theme: 'dark' }).ok, true, 'hết lỗi thì lưu được');
  });

  test('localStorage bị chặn (chế độ riêng tư) hoặc dữ liệu của bản mới hơn (chỉ đọc): không ghi được, báo lỗi rõ ràng', () => {
    const blocked = createRepo(createStore({ backend: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } }), { now: makeClock() });
    const res = blocked.updateSettings({ theme: 'dark' });
    assert.deepEqual([res.ok, res.error, res.reason], [false, 'storage', 'unavailable']);
    const future = createDefaultData();
    future.schemaVersion = 99;
    const ro = createRepo(createStore({ backend: new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(future) }) }));
    const r2 = ro.updateSettings({ theme: 'dark' });
    assert.deepEqual([r2.ok, r2.error, r2.reason], [false, 'storage', 'readonly']);
  });

  test('hợp đồng M1–M5 không đổi: subscribe / add / listByMonth hoạt động như trước', () => {
    const { repo } = makeRepo();
    let n = 0;
    repo.subscribe(() => (n += 1));
    const r = repo.add(validInput());
    assert.equal(r.ok, true);
    assert.equal(n, 1);
    assert.equal(repo.listByMonth('2026-10').length, 1);
    assert.equal(typeof win, 'object');
  });
});
