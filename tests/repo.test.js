import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../src/core/storage.js';
import { createRepo } from '../src/core/repo.js';
import { createDefaultData } from '../src/core/defaults.js';
import { MESSAGES } from '../src/core/validate.js';
import { MemoryBackend, makeClock, makeIdGen, makeRepo, validInput } from './helpers.js';

const stored = (backend) => JSON.parse(backend.getItem(STORAGE_KEY));

test('khởi tạo: danh mục/ví mặc định và ví gần nhất = ví đầu tiên', () => {
  const { repo } = makeRepo();
  assert.equal(repo.getCategories('expense').length, 8);
  assert.equal(repo.getCategories('income').length, 4);
  assert.equal(repo.getCategories().length, 12);
  assert.deepEqual(repo.getWallets().map((w) => w.name), ['Tiền mặt', 'Ngân hàng', 'Ví điện tử']);
  assert.equal(repo.getLastWalletId(), 'wallet-cash');
  assert.equal(repo.count(), 0);
  assert.equal(repo.status, 'new');
});

test('danh mục mặc định đúng theo PRD', () => {
  const { repo } = makeRepo();
  assert.deepEqual(repo.getCategories('expense').map((c) => c.name), ['Ăn uống', 'Di chuyển', 'Nhà ở', 'Mua sắm', 'Giải trí', 'Sức khoẻ', 'Học tập', 'Khác']);
  assert.deepEqual(repo.getCategories('income').map((c) => c.name), ['Lương', 'Thưởng', 'Làm thêm', 'Khác']);
});

test('add: ghi đúng các trường, dấu thời gian, và lưu xuống localStorage', () => {
  const { repo, backend, now } = makeRepo();
  const res = repo.add(validInput());
  assert.equal(res.ok, true);
  const tx = res.transaction;
  assert.deepEqual(
    { ...tx, id: undefined },
    { id: undefined, type: 'expense', amount: 45000, categoryId: 'cat-expense-food', walletId: 'wallet-cash', date: '2026-10-27', note: 'Cà phê', createdAt: now().toISOString(), updatedAt: now().toISOString() },
  );
  assert.ok(tx.id);
  assert.equal(repo.count(), 1);
  assert.deepEqual(stored(backend).transactions, [tx]);
  assert.equal(stored(backend).schemaVersion, 1);
});

test('add: chuẩn hoá số tiền dạng chuỗi và ghi chú', () => {
  const { repo } = makeRepo();
  const { transaction } = repo.add(validInput({ amount: '1250000', note: '  ăn trưa\n' }));
  assert.equal(transaction.amount, 1250000);
  assert.equal(transaction.note, 'ăn trưa');
});

test('add: dữ liệu sai bị từ chối, không ghi gì', () => {
  const { repo, backend } = makeRepo();
  const before = backend.writes;
  const res = repo.add(validInput({ amount: 0, categoryId: null }));
  assert.equal(res.ok, false);
  assert.equal(res.error, 'validation');
  assert.equal(res.errors.amount, MESSAGES.amountEmpty);
  assert.equal(res.errors.categoryId, MESSAGES.category);
  assert.equal(repo.count(), 0);
  assert.equal(backend.writes, before);
});

test('add: ngày tương lai bị từ chối theo đồng hồ của repo', () => {
  const { repo } = makeRepo();
  assert.equal(repo.add(validInput({ date: '2026-10-28' })).errors.date, MESSAGES.dateFuture);
});

test('add: danh mục thuộc loại khác bị từ chối', () => {
  const { repo } = makeRepo();
  assert.equal(repo.add(validInput({ type: 'income' })).errors.categoryId, MESSAGES.categoryMismatch);
});

test('add: ghi nhớ ví vừa dùng, và bản repo mới đọc lại được cả giao dịch lẫn ví', () => {
  const { repo, backend, now } = makeRepo();
  repo.add(validInput({ walletId: 'wallet-bank' }));
  assert.equal(repo.getLastWalletId(), 'wallet-bank');
  const again = createRepo(createStore({ backend }), { now });
  assert.equal(again.count(), 1);
  assert.equal(again.getLastWalletId(), 'wallet-bank');
});

test('getLastWalletId: ví đã bị xoá khỏi dữ liệu → quay về ví đầu tiên', () => {
  const data = createDefaultData();
  data.settings.lastWalletId = 'wallet-ghost';
  const backend = new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) });
  const { repo } = makeRepo({ backend });
  assert.equal(repo.getLastWalletId(), 'wallet-cash');
});

test('mỗi giao dịch có id duy nhất (300 lần thêm)', () => {
  const store = createStore({ backend: new MemoryBackend() });
  const repo = createRepo(store); // dùng bộ sinh id mặc định
  const ids = new Set();
  for (let i = 0; i < 300; i += 1) ids.add(repo.add(validInput({ amount: i + 1, date: '2026-01-01' })).transaction.id);
  assert.equal(ids.size, 300);
});

test('update: giữ id và createdAt, đổi updatedAt và các trường', () => {
  const { repo, backend, now } = makeRepo();
  const { transaction: created } = repo.add(validInput());
  now.advance(60_000);
  const res = repo.update(created.id, validInput({ amount: 50000, note: 'Cà phê + bánh', walletId: 'wallet-bank', date: '2026-10-26' }));
  assert.equal(res.ok, true);
  assert.equal(res.transaction.id, created.id);
  assert.equal(res.transaction.createdAt, created.createdAt);
  assert.equal(res.transaction.updatedAt, now().toISOString());
  assert.notEqual(res.transaction.updatedAt, created.updatedAt);
  assert.equal(res.transaction.amount, 50000);
  assert.equal(res.transaction.walletId, 'wallet-bank');
  assert.equal(repo.count(), 1, 'sửa không tạo thêm bản ghi');
  assert.deepEqual(stored(backend).transactions[0], res.transaction);
  assert.equal(repo.getLastWalletId(), 'wallet-bank');
});

test('update: đổi từ Chi sang Thu phải kèm danh mục Thu', () => {
  const { repo } = makeRepo();
  const { transaction } = repo.add(validInput());
  const bad = repo.update(transaction.id, validInput({ type: 'income' }));
  assert.equal(bad.errors.categoryId, MESSAGES.categoryMismatch);
  assert.equal(repo.getTransaction(transaction.id).type, 'expense', 'bản cũ còn nguyên');
  const good = repo.update(transaction.id, validInput({ type: 'income', categoryId: 'cat-income-salary' }));
  assert.equal(good.ok, true);
  assert.equal(good.transaction.type, 'income');
});

test('update: dữ liệu sai hoặc id lạ không làm đổi gì', () => {
  const { repo, backend } = makeRepo();
  const { transaction } = repo.add(validInput());
  const writes = backend.writes;
  assert.equal(repo.update(transaction.id, validInput({ amount: -5 })).error, 'validation');
  assert.equal(repo.update('khong-co', validInput()).error, 'not-found');
  assert.deepEqual(repo.getTransaction(transaction.id), transaction);
  assert.equal(backend.writes, writes);
});

test('remove rồi restore: trả lại đúng bản ghi cũ (id, createdAt, updatedAt)', () => {
  const { repo, now } = makeRepo();
  const { transaction } = repo.add(validInput());
  now.advance(10_000);
  const removed = repo.remove(transaction.id);
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.transaction, transaction);
  assert.equal(repo.count(), 0);
  assert.equal(repo.getTransaction(transaction.id), null);
  const back = repo.restore(removed.transaction);
  assert.equal(back.ok, true);
  assert.deepEqual(back.transaction, transaction);
  assert.deepEqual(repo.getTransaction(transaction.id), transaction);
});

test('remove: id lạ → not-found; xoá lần hai cũng not-found', () => {
  const { repo } = makeRepo();
  const { transaction } = repo.add(validInput());
  assert.equal(repo.remove('khong-co').error, 'not-found');
  assert.equal(repo.remove(transaction.id).ok, true);
  assert.equal(repo.remove(transaction.id).error, 'not-found');
});

test('restore: id đã tồn tại → "exists", dữ liệu hỏng → "validation"', () => {
  const { repo } = makeRepo();
  const { transaction } = repo.add(validInput());
  assert.equal(repo.restore(transaction).error, 'exists');
  assert.equal(repo.restore(null).error, 'validation');
  assert.equal(repo.restore({}).error, 'validation');
  assert.equal(repo.restore({ ...transaction, id: 'another', amount: -1 }).error, 'validation');
  assert.equal(repo.count(), 1);
});

test('getTransaction / listByMonth / add trả bản sao: sửa bên ngoài không ảnh hưởng dữ liệu', () => {
  const { repo, backend } = makeRepo();
  const { transaction } = repo.add(validInput());
  transaction.amount = 1;
  repo.getTransaction(transaction.id).amount = 2;
  repo.listByMonth('2026-10')[0].amount = 3;
  assert.equal(repo.getTransaction(transaction.id).amount, 45000);
  assert.equal(stored(backend).transactions[0].amount, 45000);
});

test('ghi lỗi (hết dung lượng): trả lỗi "storage" và dữ liệu trong bộ nhớ không đổi (add)', () => {
  const { repo, backend } = makeRepo();
  repo.add(validInput({ walletId: 'wallet-bank' }));
  backend.failWrites = 'quota';
  const res = repo.add(validInput({ amount: 99, walletId: 'wallet-ewallet' }));
  assert.deepEqual({ ok: res.ok, error: res.error, reason: res.reason }, { ok: false, error: 'storage', reason: 'quota' });
  assert.equal(repo.count(), 1);
  assert.equal(repo.getLastWalletId(), 'wallet-bank');
  backend.failWrites = null;
  assert.equal(repo.add(validInput({ amount: 99 })).ok, true, 'khi ghi được lại thì hoạt động bình thường');
  assert.equal(repo.count(), 2);
});

test('ghi lỗi: update, remove, restore cũng không làm đổi dữ liệu', () => {
  const { repo, backend } = makeRepo();
  const { transaction } = repo.add(validInput());
  backend.failWrites = 'quota';
  assert.equal(repo.update(transaction.id, validInput({ amount: 1 })).error, 'storage');
  assert.deepEqual(repo.getTransaction(transaction.id), transaction);
  assert.equal(repo.remove(transaction.id).error, 'storage');
  assert.equal(repo.count(), 1);
  backend.failWrites = null;
  repo.remove(transaction.id);
  backend.failWrites = 'quota';
  assert.equal(repo.restore(transaction).error, 'storage');
  assert.equal(repo.count(), 0);
});

test('dữ liệu từ phiên bản mới hơn: mọi thao tác ghi bị từ chối, dữ liệu gốc không bị đụng', () => {
  const data = { ...createDefaultData(), schemaVersion: 99 };
  const backend = new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) });
  const { repo } = makeRepo({ backend });
  assert.equal(repo.status, 'future-version');
  const res = repo.add(validInput());
  assert.deepEqual({ error: res.error, reason: res.reason }, { error: 'storage', reason: 'readonly' });
  assert.equal(backend.writes, 0);
});

test('localStorage bị chặn: thêm giao dịch báo lỗi "storage/unavailable", không giả vờ đã lưu', () => {
  const backend = new MemoryBackend();
  backend.failReads = true;
  const { repo } = makeRepo({ backend });
  assert.equal(repo.persistent, false);
  const res = repo.add(validInput());
  assert.deepEqual({ error: res.error, reason: res.reason }, { error: 'storage', reason: 'unavailable' });
  assert.equal(repo.count(), 0);
});

test('listByMonth: đúng ranh giới tháng/năm, mới nhất trước, cùng ngày thì theo thời điểm tạo', () => {
  const { repo, now } = makeRepo();
  const add = (date, note) => {
    now.advance(1000);
    return repo.add(validInput({ date, note })).transaction;
  };
  add('2025-12-31', 'năm trước');
  add('2026-02-01', 'feb-1');
  add('2026-02-28', 'feb-28 a');
  add('2026-03-01', 'mar-1');
  add('2026-02-28', 'feb-28 b');
  add('2026-01-01', 'jan-1');
  assert.deepEqual(repo.listByMonth('2026-02').map((t) => t.note), ['feb-28 b', 'feb-28 a', 'feb-1']);
  assert.deepEqual(repo.listByMonth('2026-03').map((t) => t.note), ['mar-1']);
  assert.deepEqual(repo.listByMonth('2025-12').map((t) => t.note), ['năm trước']);
  assert.deepEqual(repo.listByMonth('2026-01').map((t) => t.note), ['jan-1']);
  assert.deepEqual(repo.listByMonth('2026-04'), []);
  assert.deepEqual(repo.listByMonth('2026-1'), [], 'định dạng thiếu số 0 không khớp nhầm');
});

test('hiệu năng (PRD §8): với 5.000 giao dịch, thêm và liệt kê vẫn < 100 ms', () => {
  const data = createDefaultData();
  for (let i = 0; i < 5000; i += 1) {
    const day = String((i % 27) + 1).padStart(2, '0');
    data.transactions.push({ id: `seed-${i}`, type: 'expense', amount: 1000 + i, categoryId: 'cat-expense-food', walletId: 'wallet-cash', date: `2026-10-${day}`, note: `giao dịch ${i}`, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' });
  }
  const backend = new MemoryBackend({ [STORAGE_KEY]: JSON.stringify(data) });
  const t0 = performance.now();
  const repo = createRepo(createStore({ backend }), { now: makeClock(), idGen: makeIdGen('p') });
  const loadMs = performance.now() - t0;
  const t1 = performance.now();
  const res = repo.add(validInput());
  const addMs = performance.now() - t1;
  const t2 = performance.now();
  const list = repo.listByMonth('2026-10');
  const listMs = performance.now() - t2;
  assert.equal(res.ok, true);
  assert.equal(list.length, 5001);
  assert.ok(loadMs < 100, `nạp ${loadMs.toFixed(1)}ms`);
  assert.ok(addMs < 100, `thêm ${addMs.toFixed(1)}ms`);
  assert.ok(listMs < 100, `liệt kê ${listMs.toFixed(1)}ms`);
});
