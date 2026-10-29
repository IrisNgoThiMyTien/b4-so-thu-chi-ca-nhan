// Tiện ích dùng chung cho các bài kiểm thử.
import { createStore } from '../src/core/storage.js';
import { createRepo } from '../src/core/repo.js';

/** localStorage giả; có thể bật lỗi ghi để thử hết dung lượng. */
export class MemoryBackend {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial));
    this.failWrites = null; // null | 'quota' | 'other'
    this.failReads = false;
    this.writes = 0;
  }
  getItem(key) {
    if (this.failReads) throw new Error('SecurityError');
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    if (this.failWrites === 'quota') {
      const e = new Error('The quota has been exceeded.');
      e.name = 'QuotaExceededError';
      throw e;
    }
    if (this.failWrites) throw new Error('boom');
    this.writes += 1;
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

/** Đồng hồ giả (giờ cục bộ). */
export function makeClock(year = 2026, monthIndex = 9, day = 27, hour = 10, minute = 0) {
  let current = new Date(year, monthIndex, day, hour, minute, 0, 0);
  const clock = () => new Date(current.getTime());
  clock.set = (y, m, d, h = 10, min = 0) => {
    current = new Date(y, m, d, h, min, 0, 0);
  };
  clock.advance = (ms) => {
    current = new Date(current.getTime() + ms);
  };
  return clock;
}

export function makeIdGen(prefix = 'id') {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export function makeRepo({ backend = new MemoryBackend(), now = makeClock(), idGen = makeIdGen() } = {}) {
  const store = createStore({ backend });
  return { repo: createRepo(store, { now, idGen }), backend, now, store };
}

export const validInput = (overrides = {}) => ({
  type: 'expense',
  amount: 45000,
  categoryId: 'cat-expense-food',
  walletId: 'wallet-cash',
  date: '2026-10-27',
  note: 'Cà phê',
  ...overrides,
});

export const plain = (text) => String(text).replace(/ /g, ' ');
