// Lớp lưu trữ localStorage an toàn (PRD §8): khoá "sotc:", schemaVersion, mọi thao tác bọc try/catch.
import { SCHEMA_VERSION, createDefaultData } from './defaults.js';

export const STORAGE_KEY = 'sotc:data';
export const BACKUP_KEY = 'sotc:data:backup';

function isQuotaError(e) {
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
}

function hasValidShape(data) {
  return (
    !!data &&
    typeof data === 'object' &&
    Number.isInteger(data.schemaVersion) &&
    Array.isArray(data.transactions) &&
    Array.isArray(data.categories) &&
    Array.isArray(data.wallets) &&
    !!data.settings &&
    typeof data.settings === 'object'
  );
}

function resolveBackend(backend) {
  try {
    const b = backend ?? globalThis.localStorage;
    if (!b) return null;
    b.getItem(STORAGE_KEY); // Safari chế độ riêng tư / chặn lưu trữ có thể ném lỗi ngay tại đây
    return b;
  } catch {
    return null;
  }
}

export function createStore({ backend } = {}) {
  const storage = resolveBackend(backend);
  let readOnly = false;

  return {
    get persistent() {
      return storage !== null;
    },
    get readOnly() {
      return readOnly;
    },

    /** @returns {{ data, status: 'new'|'loaded'|'recovered'|'future-version' }} */
    load() {
      if (!storage) return { data: createDefaultData(), status: 'new' };
      let raw = null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        return { data: createDefaultData(), status: 'new' };
      }
      if (raw === null) return { data: createDefaultData(), status: 'new' };

      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      if (!hasValidShape(parsed)) {
        try {
          storage.setItem(BACKUP_KEY, raw); // giữ lại bản hỏng để cứu dữ liệu, không ghi đè mất
        } catch {
          /* hết chỗ: vẫn tiếp tục với dữ liệu mới */
        }
        return { data: createDefaultData(), status: 'recovered' };
      }
      if (parsed.schemaVersion > SCHEMA_VERSION) {
        readOnly = true; // dữ liệu do bản mới hơn tạo: không ghi để khỏi làm hỏng
        return { data: parsed, status: 'future-version' };
      }
      return { data: parsed, status: 'loaded' };
    },

    /** @returns {{ ok: true } | { ok: false, error: 'readonly'|'unavailable'|'quota'|'unknown' }} */
    save(data) {
      if (readOnly) return { ok: false, error: 'readonly' };
      if (!storage) return { ok: false, error: 'unavailable' };
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: isQuotaError(e) ? 'quota' : 'unknown' };
      }
    },
  };
}
