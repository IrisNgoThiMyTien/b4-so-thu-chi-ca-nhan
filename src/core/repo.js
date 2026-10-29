// Kho dữ liệu giao dịch: thêm / sửa / xoá / hoàn tác. Mỗi thay đổi được ghi vào localStorage
// *trước khi* cập nhật bộ nhớ, nên khi ghi lỗi dữ liệu cũ vẫn nguyên vẹn (PRD: 0 giao dịch bị mất).
import { validateTransaction } from './validate.js';
import { todayISO } from './dates.js';
import { THEMES, normalizeTheme } from './theme.js';
import { MAX_AMOUNT } from './money.js';

const SETTING_KEYS = ['theme', 'budgetEnabled', 'budgets']; // lastWalletId do kho tự quản, không cho ghi từ ngoài
const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

/** Ghi lỗi theo khoá, kể cả khoá '__proto__' (gán thẳng errors[key] sẽ bị bỏ qua âm thầm). */
function addError(errors, key, code) {
  Object.defineProperty(errors, key, { value: code, enumerable: true, writable: true, configurable: true });
}

/** Hạn mức hợp lệ: { [categoryId]: số nguyên VND > 0 }; mục sai bị bỏ. */
function cleanBudgets(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, amount] of Object.entries(raw)) {
    if (UNSAFE_KEYS.includes(id)) continue;
    if (Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_AMOUNT) out[id] = amount;
  }
  return out;
}

function readSettings(s) {
  return { theme: normalizeTheme(s?.theme), budgetEnabled: s?.budgetEnabled === true, budgets: cleanBudgets(s?.budgets) };
}

function defaultIdGen() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `tx_${c.randomUUID()}`;
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `tx_${Date.now().toString(36)}_${rand()}${rand()}`;
}

function byNewest(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

const copy = (t) => (t ? { ...t } : null); // trả bản sao để bên ngoài không sửa lén vào dữ liệu trong bộ nhớ

export function createRepo(store, { now = () => new Date(), idGen = defaultIdGen } = {}) {
  const { data, status } = store.load();
  let state = data;
  const listeners = new Set();
  const settingsListeners = new Set(); // chỉ báo khi `settings` đổi (giao diện, ngân sách) — không làm vẽ lại danh sách / biểu đồ

  const ctx = (today) => ({ categories: state.categories, wallets: state.wallets, today: today ?? todayISO(now()) });

  /** Áp thay đổi lên bản sao, ghi xuống kho, chỉ khi ghi được mới đổi state. */
  function commit(mutate, targets = listeners) {
    const next = {
      ...state,
      transactions: [...state.transactions],
      settings: { ...state.settings },
    };
    mutate(next);
    const saved = store.save(next);
    if (!saved.ok) return { ok: false, error: 'storage', reason: saved.error };
    state = next;
    for (const fn of [...targets]) {
      try {
        fn();
      } catch (e) {
        console.error(e); // một người nghe lỗi không được làm hỏng thao tác đã lưu
      }
    }
    return { ok: true };
  }

  return {
    status,
    get persistent() {
      return store.persistent;
    },

    getCategories(type) {
      return state.categories.filter((c) => !type || c.type === type);
    },
    getCategory: (id) => state.categories.find((c) => c.id === id) ?? null,
    getWallets: () => [...state.wallets],
    getWallet: (id) => state.wallets.find((w) => w.id === id) ?? null,
    getTransaction: (id) => copy(state.transactions.find((t) => t.id === id)),
    getLastWalletId() {
      const id = state.settings.lastWalletId;
      return state.wallets.some((w) => w.id === id) ? id : (state.wallets[0]?.id ?? null);
    },

    /** Giao dịch của một tháng ('YYYY-MM'), mới nhất trước. */
    listByMonth(yearMonth) {
      return state.transactions.filter((t) => t.date.startsWith(`${yearMonth}-`)).sort(byNewest).map(copy);
    },
    count: () => state.transactions.length,

    /** Các tháng ('YYYY-MM') đã có giao dịch, tăng dần. */
    getMonthsWithData() {
      return [...new Set(state.transactions.map((t) => t.date.slice(0, 7)))].sort();
    },

    /** Gọi fn() sau mỗi lần dữ liệu giao dịch thay đổi thành công. Trả về hàm huỷ đăng ký. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Cài đặt hiện tại (bản sao đã làm sạch): { theme, budgetEnabled, budgets }. Giá trị hỏng rơi về mặc định. */
    getSettings: () => readSettings(state.settings),

    /**
     * Ghi cài đặt (M6). Chỉ nhận theme ('system'|'light'|'dark'), budgetEnabled (boolean), budgets ({ id: số nguyên > 0 }).
     * Khoá lạ / giá trị sai → { ok: false, error: 'validation', errors }. Không có gì đổi → { ok: true, changed: false } và không ghi.
     * Lỗi ghi → { ok: false, error: 'storage' } và cài đặt cũ vẫn nguyên.
     */
    updateSettings(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, error: 'validation', errors: { _: 'invalid' } };
      const errors = {};
      const clean = {};
      for (const key of Object.keys(patch)) {
        const v = patch[key];
        if (!SETTING_KEYS.includes(key)) {
          addError(errors, key, 'unknown');
        } else if (key === 'theme') {
          if (THEMES.includes(v)) clean.theme = v;
          else errors.theme = 'invalid';
        } else if (key === 'budgetEnabled') {
          if (typeof v === 'boolean') clean.budgetEnabled = v;
          else errors.budgetEnabled = 'invalid';
        } else if (!v || typeof v !== 'object' || Array.isArray(v)) {
          errors.budgets = 'invalid';
        } else {
          const entries = Object.entries(v);
          const bad = entries.some(([id, a]) => UNSAFE_KEYS.includes(id) || !Number.isSafeInteger(a) || a <= 0 || a > MAX_AMOUNT);
          if (bad) errors.budgets = 'invalid';
          else clean.budgets = Object.fromEntries(entries);
        }
      }
      if (Object.keys(errors).length) return { ok: false, error: 'validation', errors };
      const before = readSettings(state.settings);
      const after = { ...before, ...clean };
      if (JSON.stringify(before) === JSON.stringify(after)) return { ok: true, changed: false, settings: before };
      const res = commit((next) => {
        next.settings = { ...next.settings, ...clean };
      }, settingsListeners);
      return res.ok ? { ok: true, changed: true, settings: readSettings(state.settings) } : res;
    },

    /** Gọi fn() khi cài đặt đổi thành công (không gọi khi giao dịch đổi). Trả về hàm huỷ đăng ký. */
    subscribeSettings(fn) {
      settingsListeners.add(fn);
      return () => settingsListeners.delete(fn);
    },

    add(input) {
      const check = validateTransaction(input, ctx());
      if (!check.valid) return { ok: false, error: 'validation', errors: check.errors };
      const stamp = now().toISOString();
      const transaction = { id: idGen(), ...check.value, createdAt: stamp, updatedAt: stamp };
      const res = commit((next) => {
        next.transactions.push(transaction);
        next.settings.lastWalletId = transaction.walletId;
      });
      return res.ok ? { ok: true, transaction: copy(transaction) } : res;
    },

    update(id, input) {
      const existing = state.transactions.find((t) => t.id === id);
      if (!existing) return { ok: false, error: 'not-found' };
      const check = validateTransaction(input, ctx());
      if (!check.valid) return { ok: false, error: 'validation', errors: check.errors };
      const transaction = { ...existing, ...check.value, id, createdAt: existing.createdAt, updatedAt: now().toISOString() };
      const res = commit((next) => {
        next.transactions[next.transactions.findIndex((t) => t.id === id)] = transaction;
        next.settings.lastWalletId = transaction.walletId;
      });
      return res.ok ? { ok: true, transaction: copy(transaction) } : res;
    },

    remove(id) {
      const existing = state.transactions.find((t) => t.id === id);
      if (!existing) return { ok: false, error: 'not-found' };
      const res = commit((next) => {
        next.transactions = next.transactions.filter((t) => t.id !== id);
      });
      return res.ok ? { ok: true, transaction: copy(existing) } : res;
    },

    /** Hoàn tác xoá: đưa lại đúng bản ghi cũ (giữ id và mốc thời gian). */
    restore(transaction) {
      if (!transaction || typeof transaction.id !== 'string') return { ok: false, error: 'validation', errors: {} };
      if (state.transactions.some((t) => t.id === transaction.id)) return { ok: false, error: 'exists' };
      const today = todayISO(now());
      const check = validateTransaction(transaction, ctx(transaction.date > today ? transaction.date : today));
      if (!check.valid) return { ok: false, error: 'validation', errors: check.errors };
      const restored = { id: transaction.id, ...check.value, createdAt: transaction.createdAt, updatedAt: transaction.updatedAt };
      const res = commit((next) => {
        next.transactions.push(restored);
      });
      return res.ok ? { ok: true, transaction: copy(restored) } : res;
    },
  };
}
