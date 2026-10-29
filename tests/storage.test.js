import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_KEY, STORAGE_KEY, createStore } from '../src/core/storage.js';
import { SCHEMA_VERSION, createDefaultData } from '../src/core/defaults.js';
import { MemoryBackend } from './helpers.js';

test('khoá lưu trữ có tiền tố "sotc:" (PRD §8)', () => {
  assert.ok(STORAGE_KEY.startsWith('sotc:'));
  assert.ok(BACKUP_KEY.startsWith('sotc:'));
});

test('chưa có dữ liệu → dữ liệu mặc định, không ghi gì xuống kho', () => {
  const backend = new MemoryBackend();
  const store = createStore({ backend });
  const { data, status } = store.load();
  assert.equal(status, 'new');
  assert.equal(data.schemaVersion, SCHEMA_VERSION);
  assert.equal(data.transactions.length, 0);
  assert.equal(data.categories.filter((c) => c.type === 'expense').length, 8);
  assert.equal(data.categories.filter((c) => c.type === 'income').length, 4);
  assert.equal(data.wallets.length, 3);
  assert.equal(data.settings.budgetEnabled, false);
  assert.equal(data.settings.theme, 'system');
  assert.equal(backend.writes, 0);
  assert.equal(store.persistent, true);
});

test('dữ liệu mặc định là bản mới mỗi lần (sửa bản này không ảnh hưởng bản khác)', () => {
  const a = createDefaultData();
  const b = createDefaultData();
  a.categories[0].name = 'Đã sửa';
  a.wallets.pop();
  assert.notEqual(b.categories[0].name, 'Đã sửa');
  assert.equal(b.wallets.length, 3);
});

test('lưu rồi đọc lại đúng nguyên dữ liệu', () => {
  const backend = new MemoryBackend();
  const store = createStore({ backend });
  const data = createDefaultData();
  data.transactions.push({ id: 't1', type: 'expense', amount: 1000, categoryId: 'cat-expense-food', walletId: 'wallet-cash', date: '2026-10-27', note: 'x', createdAt: 'a', updatedAt: 'a' });
  assert.deepEqual(store.save(data), { ok: true });
  const again = createStore({ backend }).load();
  assert.equal(again.status, 'loaded');
  assert.deepEqual(again.data, data);
});

test('JSON hỏng → dữ liệu mới, bản hỏng được giữ ở khoá backup', () => {
  const backend = new MemoryBackend({ [STORAGE_KEY]: '{"schemaVersion":1,"transactions":[' });
  const { data, status } = createStore({ backend }).load();
  assert.equal(status, 'recovered');
  assert.equal(data.transactions.length, 0);
  assert.equal(backend.getItem(BACKUP_KEY), '{"schemaVersion":1,"transactions":[');
  assert.equal(backend.getItem(STORAGE_KEY), '{"schemaVersion":1,"transactions":[', 'chưa ghi đè bản gốc khi chưa có thay đổi');
});

test('JSON hợp lệ nhưng sai cấu trúc cũng được coi là hỏng', () => {
  for (const raw of ['[]', 'null', '"x"', '42', '{}', '{"schemaVersion":1}', '{"schemaVersion":1,"transactions":{},"categories":[],"wallets":[],"settings":{}}', '{"schemaVersion":"1","transactions":[],"categories":[],"wallets":[],"settings":{}}']) {
    const backend = new MemoryBackend({ [STORAGE_KEY]: raw });
    const { status } = createStore({ backend }).load();
    assert.equal(status, 'recovered', raw);
    assert.equal(backend.getItem(BACKUP_KEY), raw);
  }
});

test('khôi phục từ dữ liệu hỏng không ném lỗi dù không ghi được backup', () => {
  const backend = new MemoryBackend({ [STORAGE_KEY]: 'not json' });
  backend.failWrites = 'quota';
  assert.doesNotThrow(() => createStore({ backend }).load());
});

test('dữ liệu do phiên bản mới hơn tạo → chỉ đọc, không bao giờ ghi', () => {
  const future = { ...createDefaultData(), schemaVersion: SCHEMA_VERSION + 1 };
  const backend = new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(future) });
  const store = createStore({ backend });
  const { status, data } = store.load();
  assert.equal(status, 'future-version');
  assert.equal(data.schemaVersion, SCHEMA_VERSION + 1);
  assert.equal(store.readOnly, true);
  assert.deepEqual(store.save(createDefaultData()), { ok: false, error: 'readonly' });
  assert.equal(backend.writes, 0);
});

test('hết dung lượng → {ok:false, error:"quota"} (nhiều kiểu lỗi của các trình duyệt)', () => {
  const makers = [
    () => Object.assign(new Error('x'), { name: 'QuotaExceededError' }),
    () => Object.assign(new Error('x'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' }),
    () => Object.assign(new Error('x'), { code: 22 }),
    () => Object.assign(new Error('x'), { code: 1014 }),
  ];
  for (const make of makers) {
    const backend = { getItem: () => null, setItem: () => { throw make(); } };
    assert.deepEqual(createStore({ backend }).save(createDefaultData()), { ok: false, error: 'quota' });
  }
});

test('lỗi ghi khác → "unknown"', () => {
  const backend = new MemoryBackend();
  backend.failWrites = 'other';
  assert.deepEqual(createStore({ backend }).save(createDefaultData()), { ok: false, error: 'unknown' });
});

test('localStorage bị chặn (getItem ném lỗi) → không lưu bền, dùng được nhưng save báo "unavailable"', () => {
  const backend = new MemoryBackend();
  backend.failReads = true;
  const store = createStore({ backend });
  assert.equal(store.persistent, false);
  const { data, status } = store.load();
  assert.equal(status, 'new');
  assert.equal(data.wallets.length, 3);
  assert.deepEqual(store.save(data), { ok: false, error: 'unavailable' });
});

test('getItem ném lỗi sau khi khởi tạo → vẫn trả dữ liệu mặc định, không crash', () => {
  const backend = new MemoryBackend();
  const store = createStore({ backend });
  backend.failReads = true;
  assert.doesNotThrow(() => store.load());
  assert.equal(store.load().status, 'new');
});

test('createStore() không truyền backend không ném lỗi dù môi trường có hay không có localStorage', () => {
  assert.doesNotThrow(() => createStore());
});

test('kết quả save không phụ thuộc vào việc người gọi sửa đối tượng sau đó', () => {
  const backend = new MemoryBackend();
  const store = createStore({ backend });
  const data = createDefaultData();
  store.save(data);
  data.wallets.length = 0; // sửa sau khi lưu
  assert.equal(createStore({ backend }).load().data.wallets.length, 3);
});
