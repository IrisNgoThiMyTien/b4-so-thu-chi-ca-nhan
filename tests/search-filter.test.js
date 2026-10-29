import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_QUERY_LENGTH,
  applyCriteria,
  cleanQuery,
  countFilters,
  describeChips,
  emptyCriteria,
  findRanges,
  formatNet,
  hasCriteria,
  matchesNote,
  netTone,
  normalizeCriteria,
  parseQuery,
  pruneCriteria,
  sameCriteria,
  splitByRanges,
  summarizeResults,
  toggleId,
  withType,
} from '../src/core/search-filter.js';
import { DEFAULT_CATEGORIES, DEFAULT_WALLETS } from '../src/core/defaults.js';
import { plain } from './helpers.js';

const match = (note, query) => matchesNote(note, parseQuery(query));
const ranges = (text, query) => findRanges(text, parseQuery(query));
const food = 'cat-expense-food';
const transport = 'cat-expense-transport';
const salary = 'cat-income-salary';
const lookups = { categories: DEFAULT_CATEGORIES, wallets: DEFAULT_WALLETS };

let seq = 0;
const tx = (o = {}) => ({ id: `t${++seq}`, type: 'expense', amount: 1000, categoryId: food, walletId: 'wallet-cash', date: '2026-10-20', note: '', ...o });

describe('cleanQuery', () => {
  test('bỏ khoảng trắng hai đầu và gộp khoảng trắng giữa các từ', () => {
    assert.equal(cleanQuery('  cà   phê  '), 'cà phê');
    assert.equal(cleanQuery('\t cơm \n trưa '), 'cơm trưa');
  });
  test('ký tự điều khiển thành dấu cách; chuỗi chỉ có khoảng trắng → rỗng', () => {
    assert.equal(cleanQuery('a\u0000b\u001fc\u007fd'), 'a b c d');
    assert.equal(cleanQuery('   \n\t '), '');
    assert.equal(cleanQuery(''), '');
  });
  test('không phải chuỗi → rỗng, không ném lỗi', () => {
    for (const v of [null, undefined, 0, 12, {}, [], true, Symbol.iterator, () => 1]) assert.equal(cleanQuery(v), '');
  });
  test(`cắt tối đa ${MAX_QUERY_LENGTH} ký tự và không cắt đôi cặp thay thế (emoji)`, () => {
    assert.equal(cleanQuery('a'.repeat(500)).length, MAX_QUERY_LENGTH);
    const out = cleanQuery('😀'.repeat(300));
    assert.equal([...out].length, MAX_QUERY_LENGTH);
    assert.ok(!/[\uD800-\uDBFF]$/.test(out), 'không kết thúc bằng nửa cặp thay thế');
    assert.equal(cleanQuery(`${'a'.repeat(99)} b`), `${'a'.repeat(99)}`, 'sau khi cắt lại bỏ khoảng trắng cuối');
  });
});

describe('parseQuery', () => {
  test('rỗng / chỉ khoảng trắng → null', () => {
    assert.equal(parseQuery(''), null);
    assert.equal(parseQuery('   '), null);
    assert.equal(parseQuery(undefined), null);
  });
  test('gõ không dấu → so khớp bỏ dấu; có dấu → so khớp đúng dấu', () => {
    assert.equal(parseQuery('com').sensitive, false);
    assert.equal(parseQuery('cơm').sensitive, true);
    assert.equal(parseQuery('đi').sensitive, true, 'đ cũng tính là có dấu');
    assert.equal(parseQuery('Xe bus').sensitive, false);
  });
  test('tách thành từ, hạ chữ thường, bỏ từ trùng', () => {
    assert.deepEqual(parseQuery('Cà  PHÊ cà').tokens, ['cà', 'phê']);
    assert.deepEqual(parseQuery('Com TRUA').tokens, ['com', 'trua']);
    assert.equal(parseQuery('  Cà  Phê ').raw, 'Cà Phê');
  });
  test('bộ dấu gõ kiểu tổ hợp (NFD) được coi như dạng dựng sẵn (NFC)', () => {
    const nfd = 'cơm'.normalize('NFD'); // "cơm" với ơ = o + dấu móc
    assert.equal(parseQuery(nfd).sensitive, true);
    assert.deepEqual(parseQuery(nfd).tokens, ['cơm']);
  });
});

describe('matchesNote – tìm trong ghi chú', () => {
  test('khớp một phần, không phân biệt hoa thường', () => {
    assert.ok(match('Cà phê sáng', 'phê'));
    assert.ok(match('Cà phê sáng', 'PHÊ'));
    assert.ok(match('CÀ PHÊ SÁNG', 'cà phê'));
    assert.ok(match('Cà phê sáng', 'sáng'));
    assert.ok(!match('Cà phê sáng', 'trà'));
  });
  test('gõ không dấu khớp cả chữ có dấu và không dấu', () => {
    assert.ok(match('Cơm trưa', 'com'));
    assert.ok(match('Com trua', 'com'));
    assert.ok(match('Phở bò', 'pho bo'));
    assert.ok(match('Đường đi', 'duong'));
    assert.ok(match('ĐƯỜNG', 'duong'));
    assert.ok(match('Ăn tối', 'an toi'));
  });
  test('đã gõ dấu thì phải đúng dấu: "cơm" không khớp "com", "ơ" không khớp "o"', () => {
    assert.ok(match('Cơm trưa', 'cơm'));
    assert.ok(match('CƠM TRƯA', 'cơm'));
    assert.ok(!match('Com trua', 'cơm'));
    assert.ok(!match('Cớm', 'cơm'), 'khác dấu thanh');
    assert.ok(!match('Cam', 'cơm'));
    assert.ok(match('đi chợ', 'đi'));
    assert.ok(!match('di chuyển', 'đi'), 'd ≠ đ khi người dùng gõ đ');
    assert.ok(match('đi chợ', 'di'), 'gõ d (không dấu) thì khớp đ');
  });
  test('nhiều từ: phải có đủ mọi từ, thứ tự tuỳ ý, không cần liền nhau', () => {
    assert.ok(match('Cơm gà trưa nay', 'com trua'));
    assert.ok(match('Cơm gà trưa nay', 'trua com'));
    assert.ok(!match('Cơm gà nay', 'com trua'));
    assert.ok(match('Cơm trưa', 'cơm   trưa'), 'khoảng trắng thừa trong từ khoá');
  });
  test('ghi chú rỗng / thiếu không khớp với từ khoá, không ném lỗi', () => {
    for (const note of ['', undefined, null, 5, {}]) assert.equal(match(note, 'a'), false);
  });
  test('từ khoá rỗng khớp mọi thứ (không lọc)', () => {
    assert.equal(matchesNote('abc', null), true);
    assert.equal(matchesNote('', null), true);
  });
  test('ký tự đặc biệt của biểu thức chính quy được coi là chữ thường', () => {
    for (const q of ['.', '.*', '(', ')', '[', ']', '\\', '^', '$', '+', '?', '|', '{', '}', '%', '_', '\\d']) {
      assert.equal(match('abc 123', q), false, q);
    }
    assert.ok(match('mua (2) cái $5.5 + phí?', '(2)'));
    assert.ok(match('mua (2) cái $5.5 + phí?', '$5.5'));
    assert.ok(match('mua (2) cái $5.5 + phí?', 'phí?'));
    assert.ok(match('a\\b', 'a\\b'));
    assert.ok(match('100%', '100%'));
  });
  test('emoji, chữ ngoài tiếng Việt, mã HTML đều tìm được như văn bản thường', () => {
    assert.ok(match('Sinh nhật 🎂 bạn', '🎂'));
    assert.ok(match('こんにちは', 'にち'));
    assert.ok(match('<b>x</b>', '<b>'));
    assert.ok(match('Tom &amp; Jerry', '&amp;'));
    assert.ok(match('Straße', 'STRASSE') === false, 'không tự bung ß → ss (chỉ hạ chữ thường)');
  });
  test('ghi chú dạng tổ hợp (NFD) và từ khoá dạng dựng sẵn (NFC) vẫn khớp, và ngược lại', () => {
    const nfdNote = 'Cơm trưa'.normalize('NFD');
    const nfcNote = 'Cơm trưa'.normalize('NFC');
    assert.notEqual(nfdNote, nfcNote);
    assert.ok(match(nfdNote, 'cơm'));
    assert.ok(match(nfcNote, 'cơm'.normalize('NFD')));
    assert.ok(match(nfdNote, 'com'));
  });
  test('"i" có chấm hoa (İ) và các chữ Latinh có dấu khác cũng bỏ dấu được', () => {
    assert.ok(match('İstanbul', 'istanbul'));
    assert.ok(match('Café Zürich', 'cafe zurich'));
  });
});

describe('findRanges – đoạn làm nổi', () => {
  test('một đoạn khớp: chỉ số theo văn bản gốc', () => {
    assert.deepEqual(ranges('Cà phê sáng', 'phê'), [[3, 6]]);
    assert.deepEqual(ranges('Cà phê sáng', 'CÀ'), [[0, 2]]);
  });
  test('gõ không dấu vẫn làm nổi đúng cả chữ có dấu', () => {
    assert.deepEqual(ranges('Cơm trưa', 'com'), [[0, 3]]);
    assert.deepEqual(ranges('Cơm trưa', 'trua'), [[4, 8]]);
    assert.deepEqual(ranges('Phở Bò', 'pho bo'), [[0, 3], [4, 6]]);
  });
  test('gõ có dấu: không khớp lệch dấu', () => {
    assert.deepEqual(ranges('Com cơm', 'cơm'), [[4, 7]]);
    assert.deepEqual(ranges('com', 'cơm'), []);
  });
  test('nhiều lần xuất hiện: làm nổi tất cả', () => {
    assert.deepEqual(ranges('an an an', 'an'), [[0, 2], [3, 5], [6, 8]]);
    assert.deepEqual(ranges('Ăn ăn', 'an'), [[0, 2], [3, 5]]);
  });
  test('các từ khoá chồng / chạm nhau được gộp thành một đoạn', () => {
    assert.deepEqual(ranges('abcdef', 'abc cde'), [[0, 5]]);
    assert.deepEqual(ranges('abcdef', 'abc def'), [[0, 6]], 'chạm nhau cũng gộp');
    assert.deepEqual(ranges('abc xyz', 'abc xyz'), [[0, 3], [4, 7]], 'cách nhau bởi dấu cách thì tách');
  });
  test('thiếu một trong các từ → không làm nổi gì', () => {
    assert.deepEqual(ranges('cơm gà', 'com ca'), []);
    assert.deepEqual(ranges('cơm gà', 'com ga'), [[0, 3], [4, 6]]);
  });
  test('ghi chú dạng tổ hợp (NFD): đoạn làm nổi ôm trọn ký tự cùng dấu của nó', () => {
    const note = 'Cơm trưa'.normalize('NFD'); // dài hơn bản NFC
    const r = ranges(note, 'com');
    assert.equal(r.length, 1);
    assert.equal(note.slice(r[0][0], r[0][1]), 'Cơm'.normalize('NFD'));
  });
  test('emoji (cặp thay thế) không bị cắt đôi', () => {
    const note = 'a😀b😀c';
    const r = ranges(note, '😀');
    assert.deepEqual(r, [[1, 3], [4, 6]]);
    for (const [s, e] of r) assert.equal(note.slice(s, e), '😀');
  });
  test('rỗng / sai kiểu → []', () => {
    assert.deepEqual(findRanges('abc', null), []);
    assert.deepEqual(findRanges('', parseQuery('a')), []);
    assert.deepEqual(findRanges(null, parseQuery('a')), []);
    assert.deepEqual(findRanges(42, parseQuery('a')), []);
  });
  test('splitByRanges ghép lại luôn ra đúng văn bản gốc', () => {
    const text = 'Cơm gà trưa nay';
    const parts = splitByRanges(text, ranges(text, 'ga nay'));
    assert.equal(parts.map((p) => p.text).join(''), text);
    assert.deepEqual(parts.filter((p) => p.match).map((p) => p.text), ['gà', 'nay']);
    assert.deepEqual(splitByRanges('abc', []), [{ text: 'abc', match: false }]);
    assert.deepEqual(splitByRanges('', []), []);
    assert.deepEqual(splitByRanges('abc', [[0, 3]]), [{ text: 'abc', match: true }]);
  });
});

/* ---------- kiểm thử ngẫu nhiên có hạt giống: khớp ⇔ có đoạn làm nổi ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ALPHABET = [...'aăâbcdđeêghiklmnoôơpqrstuưvxyAĂÂĐÊÔƠƯ  ÁÀẢÃẠếềểễệốồổỗộớờởỡợứừửữựíìỉĩịýỳỷỹỵ0123456789.,-'];

describe('Kiểm thử ngẫu nhiên (hạt giống cố định)', () => {
  test('matchesNote ⇔ findRanges khác rỗng; đoạn hợp lệ, có thứ tự, không chồng; khớp cả bản NFD', () => {
    const rand = rng(20261029);
    const pick = (n) => Math.floor(rand() * n);
    for (let i = 0; i < 1500; i += 1) {
      const len = 1 + pick(30);
      const note = Array.from({ length: len }, () => ALPHABET[pick(ALPHABET.length)]).join('');
      const from = pick(note.length);
      const query = note.slice(from, from + 1 + pick(6));
      const parsed = parseQuery(query);
      const m = matchesNote(note, parsed);
      const r = findRanges(note, parsed);
      if (parsed) assert.equal(m, r.length > 0, JSON.stringify({ note, query }));
      let prevEnd = -1;
      for (const [s, e] of r) {
        assert.ok(s >= 0 && e <= note.length && s < e, JSON.stringify({ note, query, r }));
        assert.ok(s > prevEnd, 'không chồng / không chạm nhau');
        prevEnd = e;
      }
      assert.equal(splitByRanges(note, r).map((p) => p.text).join(''), note);
      // đổi ghi chú sang NFD không làm đổi kết quả khớp
      if (parsed) assert.equal(matchesNote(note.normalize('NFD'), parsed), m, JSON.stringify({ note, query }));
    }
  });

  test('một đoạn con của ghi chú (không chứa khoảng trắng đầu/cuối) luôn tìm thấy chính ghi chú đó, kể cả khi bỏ dấu', () => {
    const rand = rng(7);
    const pick = (n) => Math.floor(rand() * n);
    const strip = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    for (let i = 0; i < 800; i += 1) {
      const note = Array.from({ length: 4 + pick(20) }, () => ALPHABET[pick(ALPHABET.length)]).join('');
      const from = pick(note.length);
      const piece = cleanQuery(note.slice(from, from + 1 + pick(8)));
      if (!piece) continue;
      assert.ok(match(note, piece), JSON.stringify({ note, piece }));
      assert.ok(match(note, strip(piece)), JSON.stringify({ note, piece: strip(piece) }));
    }
  });
});

describe('applyCriteria', () => {
  const list = [
    tx({ id: 'a', note: 'Cà phê sáng', categoryId: food, walletId: 'wallet-cash', type: 'expense', amount: 45_000 }),
    tx({ id: 'b', note: 'Xăng xe', categoryId: transport, walletId: 'wallet-bank', type: 'expense', amount: 80_000 }),
    tx({ id: 'c', note: 'Lương tháng', categoryId: salary, walletId: 'wallet-bank', type: 'income', amount: 15_000_000 }),
    tx({ id: 'd', note: '', categoryId: food, walletId: 'wallet-ewallet', type: 'expense', amount: 30_000 }),
    tx({ id: 'e', note: 'cơm trưa', categoryId: food, walletId: 'wallet-cash', type: 'expense', amount: 50_000 }),
  ];
  const ids = (out) => out.map((t) => t.id);
  const c = (o) => ({ ...emptyCriteria(), ...o });

  test('không tiêu chí → trả về chính danh sách (không sao chép)', () => {
    assert.equal(applyCriteria(list, emptyCriteria()), list);
    assert.equal(applyCriteria(list, c({ query: '   ' })), list);
  });
  test('theo loại', () => {
    assert.deepEqual(ids(applyCriteria(list, c({ type: 'income' }))), ['c']);
    assert.deepEqual(ids(applyCriteria(list, c({ type: 'expense' }))), ['a', 'b', 'd', 'e']);
    assert.deepEqual(ids(applyCriteria(list, c({ type: 'all' }))), ['a', 'b', 'c', 'd', 'e']);
  });
  test('theo danh mục: chọn nhiều = HOẶC', () => {
    assert.deepEqual(ids(applyCriteria(list, c({ categoryIds: [food] }))), ['a', 'd', 'e']);
    assert.deepEqual(ids(applyCriteria(list, c({ categoryIds: [food, salary] }))), ['a', 'c', 'd', 'e']);
    assert.deepEqual(ids(applyCriteria(list, c({ categoryIds: ['cat-không-có'] }))), []);
  });
  test('theo ví: chọn nhiều = HOẶC', () => {
    assert.deepEqual(ids(applyCriteria(list, c({ walletIds: ['wallet-bank'] }))), ['b', 'c']);
    assert.deepEqual(ids(applyCriteria(list, c({ walletIds: ['wallet-bank', 'wallet-ewallet'] }))), ['b', 'c', 'd']);
  });
  test('giữa các nhóm = VÀ', () => {
    assert.deepEqual(ids(applyCriteria(list, c({ type: 'expense', categoryIds: [food], walletIds: ['wallet-cash'] }))), ['a', 'e']);
    assert.deepEqual(ids(applyCriteria(list, c({ type: 'income', categoryIds: [food] }))), []);
    assert.deepEqual(ids(applyCriteria(list, c({ categoryIds: [food], walletIds: ['wallet-bank'] }))), []);
  });
  test('từ khoá kết hợp với bộ lọc', () => {
    assert.deepEqual(ids(applyCriteria(list, c({ query: 'com' }))), ['e']);
    assert.deepEqual(ids(applyCriteria(list, c({ query: 'ca phe', walletIds: ['wallet-bank'] }))), []);
    assert.deepEqual(ids(applyCriteria(list, c({ query: 'luong', type: 'income' }))), ['c']);
    assert.deepEqual(ids(applyCriteria(list, c({ query: 'luong', type: 'expense' }))), []);
  });
  test('khoản không có ghi chú không bao giờ khớp từ khoá', () => {
    assert.deepEqual(ids(applyCriteria(list, c({ query: 'a' }))).includes('d'), false);
    assert.equal(ids(applyCriteria([tx({ note: undefined })], c({ query: 'x' }))).length, 0);
  });
  test('giữ nguyên thứ tự, không đổi danh sách gốc và từng giao dịch', () => {
    const before = JSON.stringify(list);
    const out = applyCriteria(list, c({ categoryIds: [food] }));
    assert.deepEqual(ids(out), ['a', 'd', 'e']);
    assert.notEqual(out, list);
    assert.equal(JSON.stringify(list), before);
    assert.equal(out[0], list[0], 'trả về chính đối tượng, không sao chép từng khoản');
  });
  test('truyền sẵn parsed cho kết quả như tự phân tích', () => {
    const crit = c({ query: 'phe' });
    assert.deepEqual(ids(applyCriteria(list, crit, parseQuery('phe'))), ids(applyCriteria(list, crit)));
  });
  test('5.000 giao dịch lọc dưới 100 ms', () => {
    const big = Array.from({ length: 5000 }, (_, i) => tx({ id: `x${i}`, note: i % 3 === 0 ? `Cà phê số ${i} cùng bạn` : i % 3 === 1 ? 'ăn trưa văn phòng' : '', categoryId: i % 2 ? food : transport, walletId: i % 4 ? 'wallet-cash' : 'wallet-bank' }));
    const crit = c({ query: 'ca phe ban', categoryIds: [food, transport], walletIds: ['wallet-cash', 'wallet-bank'], type: 'expense' });
    const parsed = parseQuery(crit.query);
    applyCriteria(big, crit, parsed); // làm nóng
    const t0 = performance.now();
    const out = applyCriteria(big, crit, parsed);
    const ms = performance.now() - t0;
    assert.ok(out.length > 1000);
    assert.ok(ms < 100, `mất ${ms.toFixed(1)} ms`);
  });
});

describe('Tiêu chí: đếm, so sánh, chuẩn hoá', () => {
  test('countFilters: loại + từng danh mục + từng ví; từ khoá không tính', () => {
    assert.equal(countFilters(emptyCriteria()), 0);
    assert.equal(countFilters({ ...emptyCriteria(), query: 'abc' }), 0);
    assert.equal(countFilters({ ...emptyCriteria(), type: 'expense' }), 1);
    assert.equal(countFilters({ query: '', type: 'expense', categoryIds: [food], walletIds: [] }), 2, 'ví dụ DESIGN §10.4: (Chi) (Ăn uống) → "Lọc 2"');
    assert.equal(countFilters({ query: '', type: 'income', categoryIds: [salary, 'x'], walletIds: ['w1', 'w2', 'w3'] }), 6);
  });
  test('hasCriteria: từ khoá hoặc bất kỳ bộ lọc nào', () => {
    assert.equal(hasCriteria(emptyCriteria()), false);
    assert.equal(hasCriteria({ ...emptyCriteria(), query: '  ' }), false);
    assert.equal(hasCriteria({ ...emptyCriteria(), query: 'a' }), true);
    assert.equal(hasCriteria({ ...emptyCriteria(), type: 'income' }), true);
    assert.equal(hasCriteria({ ...emptyCriteria(), walletIds: ['w'] }), true);
  });
  test('sameCriteria so sánh theo giá trị', () => {
    assert.ok(sameCriteria(emptyCriteria(), emptyCriteria()));
    assert.ok(!sameCriteria(emptyCriteria(), { ...emptyCriteria(), query: 'a' }));
    assert.ok(!sameCriteria({ ...emptyCriteria(), categoryIds: ['a'] }, { ...emptyCriteria(), categoryIds: ['b'] }));
    assert.ok(!sameCriteria({ ...emptyCriteria(), walletIds: ['a'] }, emptyCriteria()));
  });
  test('toggleId bật / tắt và không đổi mảng gốc', () => {
    const base = ['a'];
    assert.deepEqual(toggleId(base, 'b'), ['a', 'b']);
    assert.deepEqual(toggleId(base, 'a'), []);
    assert.deepEqual(base, ['a']);
  });
  test('withType: đổi sang Chi / Thu thì bỏ danh mục thuộc loại kia; "Tất cả" giữ nguyên', () => {
    const crit = { ...emptyCriteria(), categoryIds: [food, salary, 'cat-expense-other', 'cat-income-other'] };
    assert.deepEqual(withType(crit, 'expense', DEFAULT_CATEGORIES).categoryIds, [food, 'cat-expense-other']);
    assert.deepEqual(withType(crit, 'income', DEFAULT_CATEGORIES).categoryIds, [salary, 'cat-income-other']);
    assert.deepEqual(withType(crit, 'all', DEFAULT_CATEGORIES).categoryIds, crit.categoryIds);
    assert.equal(withType(crit, 'bậy bạ', DEFAULT_CATEGORIES).type, 'all');
    assert.deepEqual(crit.categoryIds, [food, salary, 'cat-expense-other', 'cat-income-other'], 'không sửa đối tượng gốc');
  });
  test('pruneCriteria: bỏ danh mục / ví không còn, danh mục lệch loại; không đổi gì thì trả về chính nó', () => {
    const same = { ...emptyCriteria(), categoryIds: [food], walletIds: ['wallet-cash'] };
    assert.equal(pruneCriteria(same, lookups), same);
    const dirty = { query: 'a', type: 'expense', categoryIds: [food, 'ma', salary], walletIds: ['wallet-cash', 'ma-vi'] };
    const out = pruneCriteria(dirty, lookups);
    assert.deepEqual(out, { query: 'a', type: 'expense', categoryIds: [food], walletIds: ['wallet-cash'] });
    assert.deepEqual(dirty.categoryIds, [food, 'ma', salary]);
  });
  test('normalizeCriteria chịu được dữ liệu bậy', () => {
    assert.deepEqual(normalizeCriteria(null), emptyCriteria());
    assert.deepEqual(normalizeCriteria('x'), emptyCriteria());
    assert.deepEqual(normalizeCriteria({ type: 'transfer', query: 5, categoryIds: 'abc', walletIds: { 0: 'x' } }), emptyCriteria());
    const out = normalizeCriteria({ query: '  a  b ', type: 'income', categoryIds: ['x', 'x', '', 3, null, 'y'], walletIds: [undefined, 'w'], extra: 1, __proto__: { hack: 1 } });
    assert.deepEqual(out, { query: 'a b', type: 'income', categoryIds: ['x', 'y'], walletIds: ['w'] });
    assert.equal(Object.hasOwn(out, 'extra'), false);
    assert.equal(normalizeCriteria({ query: 'a'.repeat(1000) }).query.length, MAX_QUERY_LENGTH);
  });
});

describe('Tóm tắt kết quả', () => {
  test('summarizeResults: số khoản, tổng thu, tổng chi, chênh lệch', () => {
    assert.deepEqual(summarizeResults([]), { count: 0, income: 0, expense: 0, net: 0 });
    const s = summarizeResults([tx({ type: 'expense', amount: 1_240_000 }), tx({ type: 'income', amount: 500_000 }), tx({ type: 'expense', amount: 100 })]);
    assert.deepEqual(s, { count: 3, income: 500_000, expense: 1_240_100, net: -740_100 });
  });
  test('formatNet: dấu + / − thật (U+2212) / 0 không dấu', () => {
    assert.equal(plain(formatNet(-1_240_000)), '−1.240.000 ₫');
    assert.equal(plain(formatNet(500_000)), '+500.000 ₫');
    assert.equal(plain(formatNet(0)), '0 ₫');
    assert.ok(formatNet(-1).startsWith('−'));
    assert.equal(formatNet(Number.NaN), '');
    assert.equal(formatNet(1.5), '');
  });
  test('netTone theo dấu', () => {
    assert.equal(netTone(5), 'income');
    assert.equal(netTone(-5), 'expense');
    assert.equal(netTone(0), 'zero');
  });
});

describe('describeChips', () => {
  test('thứ tự Loại → danh mục → ví (theo thứ tự danh sách); nhãn đúng ví dụ DESIGN', () => {
    const chips = describeChips({ query: '', type: 'expense', categoryIds: [transport, food], walletIds: ['wallet-bank', 'wallet-cash'] }, lookups);
    assert.deepEqual(chips.map((c) => c.label), ['Chi', 'Ăn uống', 'Di chuyển', 'Tiền mặt', 'Ngân hàng']);
    assert.deepEqual(chips.map((c) => c.kind), ['type', 'category', 'category', 'wallet', 'wallet']);
    assert.deepEqual(chips.map((c) => c.key), ['type', `category:${food}`, `category:${transport}`, 'wallet:wallet-cash', 'wallet:wallet-bank']);
  });
  test('mỗi chip có nhãn đọc cho trình đọc màn hình', () => {
    const [t, c, w] = describeChips({ query: '', type: 'income', categoryIds: [salary], walletIds: ['wallet-cash'] }, lookups);
    assert.equal(t.ariaLabel, 'Bỏ lọc loại Thu');
    assert.equal(c.ariaLabel, 'Bỏ lọc danh mục Lương');
    assert.equal(w.ariaLabel, 'Bỏ lọc ví Tiền mặt');
  });
  test('danh mục "Khác" trùng tên giữa Chi và Thu: thêm hậu tố khi Loại là "Tất cả"', () => {
    const chips = describeChips({ ...emptyCriteria(), categoryIds: ['cat-expense-other', 'cat-income-other'] }, lookups);
    assert.deepEqual(chips.map((c) => c.label), ['Khác · Chi', 'Khác · Thu']);
    assert.deepEqual(chips.map((c) => c.ariaLabel), ['Bỏ lọc danh mục Khác (chi)', 'Bỏ lọc danh mục Khác (thu)']);
    const onlyExpense = describeChips({ ...emptyCriteria(), type: 'expense', categoryIds: ['cat-expense-other'] }, lookups);
    assert.equal(onlyExpense[1].label, 'Khác', 'đã chọn Loại thì không còn mơ hồ');
  });
  test('id không còn tồn tại bị bỏ qua; không có bộ lọc → []', () => {
    assert.deepEqual(describeChips(emptyCriteria(), lookups), []);
    assert.deepEqual(describeChips({ ...emptyCriteria(), categoryIds: ['ma'], walletIds: ['ma'] }, lookups), []);
    assert.deepEqual(describeChips({ ...emptyCriteria(), query: 'chỉ có từ khoá' }, lookups), [], 'từ khoá không thành chip');
  });
});
