// Tìm kiếm & lọc (M5, PRD F12): phần lõi thuần – không đụng DOM, không đụng kho dữ liệu.
//  • Từ khoá chỉ tìm trong GHI CHÚ. Không phân biệt hoa/thường; gõ không dấu thì khớp cả chữ có dấu
//    ("com" khớp "Cơm"); đã gõ dấu thì phải khớp đúng dấu ("cơm" không khớp "com").
//  • Nhiều từ = mọi từ phải có mặt trong ghi chú, thứ tự tuỳ ý.
//  • Loại / danh mục / ví: chọn nhiều trong cùng nhóm = HOẶC; giữa các nhóm = VÀ.
import { formatVND } from './money.js';

export const MAX_QUERY_LENGTH = 100;
export const FILTER_TYPES = ['all', 'expense', 'income'];
export const TYPE_LABELS = { all: 'Tất cả', expense: 'Chi', income: 'Thu' };

export function emptyCriteria() {
  return { query: '', type: 'all', categoryIds: [], walletIds: [] };
}

/** Bỏ ký tự điều khiển, gộp khoảng trắng, cắt tối đa MAX_QUERY_LENGTH ký tự. Không phải chuỗi → rỗng. */
export function cleanQuery(raw) {
  if (typeof raw !== 'string') return '';
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...text].slice(0, MAX_QUERY_LENGTH).join('').trim();
}

/* ---------- gấp chữ để so khớp ---------- */
const MARKS = /\p{M}/gu;
const CLUSTER = /\P{M}\p{M}*|\p{M}+/gu; // một ký tự gốc + các dấu đi kèm

/** Bỏ dấu, hạ chữ thường, đ → d. */
function foldLoose(text) {
  return text.normalize('NFD').replace(MARKS, '').toLowerCase().replace(/đ/g, 'd');
}
/** Giữ dấu (chuẩn NFC để "ơ" gõ kiểu tổ hợp vẫn khớp), hạ chữ thường. */
function foldExact(text) {
  return text.normalize('NFC').toLowerCase();
}

/**
 * @returns {{ raw: string, sensitive: boolean, tokens: string[] } | null}  null khi từ khoá rỗng
 */
export function parseQuery(raw) {
  const q = cleanQuery(raw);
  if (!q) return null;
  const exact = foldExact(q);
  const sensitive = foldLoose(q) !== exact; // có gõ dấu → so khớp đúng dấu
  const base = sensitive ? exact : foldLoose(q);
  const tokens = [...new Set(base.split(' '))].filter(Boolean);
  return tokens.length ? { raw: q, sensitive, tokens } : null;
}

/** Ghi chú có chứa mọi từ của từ khoá không. */
export function matchesNote(note, parsed) {
  if (!parsed) return true;
  if (typeof note !== 'string' || note === '') return false;
  const hay = parsed.sensitive ? foldExact(note) : foldLoose(note);
  return parsed.tokens.every((t) => hay.includes(t));
}

/**
 * Các đoạn [bắt đầu, kết thúc) trong `text` gốc cần làm nổi, đã gộp những đoạn chạm nhau.
 * Trả về [] khi không khớp (hoặc từ khoá rỗng). Chỉ số tính theo ký tự UTF-16 của `text`.
 */
export function findRanges(text, parsed) {
  if (!parsed || typeof text !== 'string' || text === '') return [];
  const clusters = [];
  const owner = []; // owner[k] = chỉ số cụm của ký tự thứ k trong chuỗi đã gấp
  let hay = '';
  for (const m of text.matchAll(CLUSTER)) {
    const folded = parsed.sensitive ? foldExact(m[0]) : foldLoose(m[0]);
    for (let k = 0; k < folded.length; k += 1) owner.push(clusters.length);
    hay += folded;
    clusters.push([m.index, m.index + m[0].length]);
  }
  const found = [];
  for (const token of parsed.tokens) {
    let from = 0;
    let hits = 0;
    for (;;) {
      const at = hay.indexOf(token, from);
      if (at < 0) break;
      found.push([clusters[owner[at]][0], clusters[owner[at + token.length - 1]][1]]);
      hits += 1;
      from = at + token.length;
    }
    if (hits === 0) return []; // thiếu một từ → ghi chú này không khớp
  }
  found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const r of found) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** Cắt `text` theo các đoạn: [{ text, match }]. Ghép lại luôn ra đúng `text`. */
export function splitByRanges(text, ranges) {
  const out = [];
  let pos = 0;
  for (const [s, e] of ranges) {
    if (s > pos) out.push({ text: text.slice(pos, s), match: false });
    out.push({ text: text.slice(s, e), match: true });
    pos = e;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false });
  return out;
}

/* ---------- tiêu chí ---------- */
const uniqueStrings = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x))] : []);

/** Chuẩn hoá dữ liệu từ bên ngoài thành tiêu chí hợp lệ. */
export function normalizeCriteria(input) {
  const c = input && typeof input === 'object' ? input : {};
  return {
    query: cleanQuery(c.query),
    type: FILTER_TYPES.includes(c.type) ? c.type : 'all',
    categoryIds: uniqueStrings(c.categoryIds),
    walletIds: uniqueStrings(c.walletIds),
  };
}

/** Số bộ lọc đang bật (loại + từng danh mục + từng ví); từ khoá không tính. */
export function countFilters(criteria) {
  return (criteria.type !== 'all' ? 1 : 0) + criteria.categoryIds.length + criteria.walletIds.length;
}

/** Có từ khoá hoặc bộ lọc nào đang bật không. */
export function hasCriteria(criteria) {
  return countFilters(criteria) > 0 || parseQuery(criteria.query) !== null;
}

export function sameCriteria(a, b) {
  const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  return a.query === b.query && a.type === b.type && eq(a.categoryIds, b.categoryIds) && eq(a.walletIds, b.walletIds);
}

export function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Đổi Loại: danh mục không thuộc loại mới bị bỏ chọn. */
export function withType(criteria, type, categories) {
  const next = FILTER_TYPES.includes(type) ? type : 'all';
  if (next === 'all') return { ...criteria, type: next };
  const keep = new Set(categories.filter((c) => c.type === next).map((c) => c.id));
  return { ...criteria, type: next, categoryIds: criteria.categoryIds.filter((id) => keep.has(id)) };
}

/**
 * Bỏ khỏi tiêu chí những danh mục / ví không còn tồn tại (hoặc danh mục lệch Loại).
 * Trả về chính `criteria` nếu không có gì đổi.
 */
export function pruneCriteria(criteria, { categories, wallets }) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const walletIds = new Set(wallets.map((w) => w.id));
  const categoryIds = criteria.categoryIds.filter((id) => {
    const c = catById.get(id);
    return c && (criteria.type === 'all' || c.type === criteria.type);
  });
  const kept = criteria.walletIds.filter((id) => walletIds.has(id));
  if (categoryIds.length === criteria.categoryIds.length && kept.length === criteria.walletIds.length) return criteria;
  return { ...criteria, categoryIds, walletIds: kept };
}

/**
 * Lọc danh sách giao dịch (giữ nguyên thứ tự). Không có tiêu chí nào → trả về chính `list`.
 * `parsed` có thể truyền sẵn (parseQuery) để khỏi phân tích lại cho từng lần gọi.
 */
export function applyCriteria(list, criteria, parsed = parseQuery(criteria.query)) {
  const type = criteria.type === 'income' || criteria.type === 'expense' ? criteria.type : null;
  const cats = criteria.categoryIds.length ? new Set(criteria.categoryIds) : null;
  const wallets = criteria.walletIds.length ? new Set(criteria.walletIds) : null;
  if (!type && !cats && !wallets && !parsed) return list;
  return list.filter(
    (tx) =>
      (!type || tx.type === type) &&
      (!cats || cats.has(tx.categoryId)) &&
      (!wallets || wallets.has(tx.walletId)) &&
      (!parsed || matchesNote(tx.note, parsed)),
  );
}

/** Tổng hợp kết quả: số khoản, tổng thu, tổng chi, chênh lệch (thu − chi). */
export function summarizeResults(list) {
  let income = 0;
  let expense = 0;
  for (const tx of list) {
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') expense += tx.amount;
  }
  return { count: list.length, income, expense, net: income - expense };
}

/** "+500.000 ₫", "−1.240.000 ₫", "0 ₫". */
export function formatNet(net) {
  if (!Number.isSafeInteger(net)) return '';
  return net > 0 ? `+${formatVND(net)}` : formatVND(net);
}

/** Dấu của số tiền: 'income' | 'expense' | 'zero' – để tô màu. */
export function netTone(net) {
  return net > 0 ? 'income' : net < 0 ? 'expense' : 'zero';
}

const KIND = { expense: 'chi', income: 'thu' };

/**
 * Các chip bộ lọc đang bật, theo thứ tự: Loại → danh mục → ví.
 * Hai danh mục trùng tên khác loại (ví dụ "Khác") được thêm hậu tố "· Chi" / "· Thu" để phân biệt.
 * @returns {{ key: string, kind: 'type'|'category'|'wallet', id: string, label: string, ariaLabel: string }[]}
 */
export function describeChips(criteria, { categories, wallets }) {
  const chips = [];
  if (criteria.type !== 'all') {
    const label = TYPE_LABELS[criteria.type];
    chips.push({ key: 'type', kind: 'type', id: criteria.type, label, ariaLabel: `Bỏ lọc loại ${label}` });
  }
  const selectedCats = new Set(criteria.categoryIds);
  const nameCount = new Map();
  for (const c of categories) nameCount.set(c.name, (nameCount.get(c.name) ?? 0) + 1);
  for (const c of categories) {
    if (!selectedCats.has(c.id)) continue;
    const dup = criteria.type === 'all' && nameCount.get(c.name) > 1;
    const label = dup ? `${c.name} · ${TYPE_LABELS[c.type] ?? ''}`.trim() : c.name;
    const suffix = dup ? ` (${KIND[c.type] ?? ''})` : '';
    chips.push({ key: `category:${c.id}`, kind: 'category', id: c.id, label, ariaLabel: `Bỏ lọc danh mục ${c.name}${suffix}` });
  }
  const selectedWallets = new Set(criteria.walletIds);
  for (const w of wallets) {
    if (!selectedWallets.has(w.id)) continue;
    chips.push({ key: `wallet:${w.id}`, kind: 'wallet', id: w.id, label: w.name, ariaLabel: `Bỏ lọc ví ${w.name}` });
  }
  return chips;
}
