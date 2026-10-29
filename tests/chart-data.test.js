// Kiểm thử lõi dữ liệu biểu đồ (M4): gộp theo tuần / danh mục / ngày / số dư luỹ kế, thang trục, nhãn trục.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS_PER_WEEK,
  MAX_SLICES,
  OTHER_CATEGORY_ID,
  allocatePercents,
  axisLabel,
  balanceSeries,
  categoryData,
  dailyData,
  daysInMonth,
  formatPercent,
  niceScale,
  niceStep,
  weekRanges,
  weeklyData,
} from '../src/core/chart-data.js';
import { DEFAULT_CATEGORIES } from '../src/core/defaults.js';
import { summarize } from '../src/core/summary.js';

const YM = '2026-10';
let seq = 0;
const tx = (type, amount, date, categoryId = type === 'income' ? 'cat-income-salary' : 'cat-expense-food') => ({
  id: `t${++seq}`,
  type,
  amount,
  date,
  categoryId,
  walletId: 'wallet-cash',
  note: '',
});
const expense = (amount, date, categoryId) => tx('expense', amount, date, categoryId);
const income = (amount, date) => tx('income', amount, date);

/** Bộ sinh số giả ngẫu nhiên cố định (mulberry32) để test lặp lại được. */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomMonth(seed, ym = YM, n = 200) {
  const r = rng(seed);
  const last = daysInMonth(ym);
  const cats = DEFAULT_CATEGORIES;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const type = r() < 0.25 ? 'income' : 'expense';
    const pool = cats.filter((c) => c.type === type);
    out.push(tx(type, 1 + Math.floor(r() * 2_000_000), `${ym}-${String(1 + Math.floor(r() * last)).padStart(2, '0')}`, pool[Math.floor(r() * pool.length)].id));
  }
  return out;
}

/* ================================================================== */
describe('daysInMonth', () => {
  test('số ngày đúng cho mọi tháng, kể cả năm nhuận và năm thế kỷ', () => {
    assert.equal(daysInMonth('2026-10'), 31);
    assert.equal(daysInMonth('2026-04'), 30);
    assert.equal(daysInMonth('2026-02'), 28);
    assert.equal(daysInMonth('2024-02'), 29);
    assert.equal(daysInMonth('2100-02'), 28); // năm thế kỷ không chia hết cho 400
    assert.equal(daysInMonth('2000-02'), 29);
    assert.equal(daysInMonth('2026-12'), 31);
    assert.equal(daysInMonth('2026-01'), 31);
  });

  test('tháng sai định dạng → 0', () => {
    for (const bad of ['', '2026-13', '2026-00', '2026-1', '26-10', null, undefined, 202610, '2026-10-01']) assert.equal(daysInMonth(bad), 0, String(bad));
  });
});

/* ================================================================== */
describe('① Theo tuần', () => {
  test('tháng 31 ngày có 5 tuần: 1–7, 8–14, 15–21, 22–28, 29–31', () => {
    const w = weekRanges('2026-10');
    assert.deepEqual(w.map((x) => [x.from, x.to]), [[1, 7], [8, 14], [15, 21], [22, 28], [29, 31]]);
    assert.deepEqual(w.map((x) => x.label), ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5']);
    assert.deepEqual(w.map((x) => x.range), ['1–7', '8–14', '15–21', '22–28', '29–31']);
  });

  test('tháng 30 ngày: tuần cuối 29–30; tháng 28 ngày chỉ có 4 tuần; năm nhuận tuần 5 chỉ có ngày 29', () => {
    assert.equal(weekRanges('2026-04').at(-1).range, '29–30');
    assert.equal(weekRanges('2026-02').length, 4);
    const leap = weekRanges('2024-02');
    assert.equal(leap.length, 5);
    assert.equal(leap[4].range, '29');
    assert.equal(leap[4].from, leap[4].to);
  });

  test('các tuần phủ kín tháng, không chồng, không hở', () => {
    for (const ym of ['2026-02', '2024-02', '2026-04', '2026-10']) {
      const w = weekRanges(ym);
      assert.equal(w[0].from, 1);
      assert.equal(w.at(-1).to, daysInMonth(ym));
      for (let i = 1; i < w.length; i += 1) assert.equal(w[i].from, w[i - 1].to + 1);
      assert.ok(w.every((x) => x.to - x.from + 1 <= DAYS_PER_WEEK));
    }
  });

  test('giao dịch rơi đúng tuần ở các ngày biên (1, 7, 8, 14, 15, 21, 22, 28, 29, 31)', () => {
    const days = [1, 7, 8, 14, 15, 21, 22, 28, 29, 31];
    const txs = days.map((d) => expense(1000 * d, `${YM}-${String(d).padStart(2, '0')}`));
    const { weeks } = weeklyData(txs, YM);
    assert.deepEqual(weeks.map((w) => w.expense), [1000 * (1 + 7), 1000 * (8 + 14), 1000 * (15 + 21), 1000 * (22 + 28), 1000 * (29 + 31)]);
  });

  test('tách Thu và Chi, cộng dồn nhiều khoản trong cùng tuần, có tổng', () => {
    const txs = [income(5_000_000, '2026-10-03'), expense(200_000, '2026-10-03'), expense(100_000, '2026-10-05'), income(1_000, '2026-10-20')];
    const { weeks, totals } = weeklyData(txs, YM);
    assert.equal(weeks[0].income, 5_000_000);
    assert.equal(weeks[0].expense, 300_000);
    assert.equal(weeks[2].income, 1_000);
    assert.deepEqual(totals, { income: 5_001_000, expense: 300_000 });
  });

  test('bỏ qua giao dịch của tháng khác, ngày sai và dữ liệu hỏng; không làm hỏng đầu vào', () => {
    const good = expense(10, '2026-10-10');
    const txs = [
      good,
      expense(999, '2026-09-30'),
      expense(999, '2026-11-01'),
      expense(999, '2026-10-32'),
      expense(999, '2026-10-00'),
      expense(999, '2026-10-1'),
      expense(999, 'abc'),
      expense(999, null),
      { ...good, amount: -5 },
      { ...good, amount: 1.5 },
      { ...good, amount: 0 },
      { ...good, amount: '100' },
      { ...good, type: 'transfer' },
      null,
      undefined,
    ];
    const before = JSON.stringify(txs);
    const { weeks, totals } = weeklyData(txs, YM);
    assert.deepEqual(totals, { income: 0, expense: 10 });
    assert.equal(weeks[1].expense, 10);
    assert.equal(JSON.stringify(txs), before);
  });

  test('không có giao dịch → các tuần đều 0; đầu vào null/undefined không ném lỗi', () => {
    for (const input of [[], null, undefined]) {
      const { weeks, totals } = weeklyData(input, YM);
      assert.equal(weeks.length, 5);
      assert.ok(weeks.every((w) => w.income === 0 && w.expense === 0));
      assert.deepEqual(totals, { income: 0, expense: 0 });
    }
  });
});

/* ================================================================== */
describe('② Theo danh mục', () => {
  const C = DEFAULT_CATEGORIES;
  const F = 'cat-expense-food';
  const T = 'cat-expense-transport';
  const H = 'cat-expense-home';
  const O = OTHER_CATEGORY_ID;

  test('chỉ tính khoản chi, xếp lớn nhất trước, phần trăm cộng đúng 100', () => {
    const txs = [expense(500_000, '2026-10-01', F), expense(300_000, '2026-10-02', T), expense(200_000, '2026-10-03', H), income(9_000_000, '2026-10-01')];
    const d = categoryData(txs, C);
    assert.equal(d.total, 1_000_000);
    assert.deepEqual(d.slices.map((s) => s.name), ['Ăn uống', 'Di chuyển', 'Nhà ở']);
    assert.deepEqual(d.slices.map((s) => s.percent), [50, 30, 20]);
    assert.deepEqual(d.slices.map((s) => s.amount), [500_000, 300_000, 200_000]);
    assert.equal(d.merged, 0);
  });

  test('mỗi miếng mang đủ id, tên, màu, biểu tượng của danh mục', () => {
    const [s] = categoryData([expense(1, '2026-10-01', T)], C).slices;
    assert.deepEqual({ id: s.id, name: s.name, color: s.color, icon: s.icon, share: s.share }, { id: T, name: 'Di chuyển', color: 'move', icon: 'bus', share: 1 });
  });

  test('"Khác" luôn đứng cuối dù lớn nhất', () => {
    const d = categoryData([expense(900, '2026-10-01', O), expense(100, '2026-10-01', F)], C);
    assert.deepEqual(d.slices.map((s) => s.name), ['Ăn uống', 'Khác']);
  });

  test('phần trăm dùng phương pháp phần dư lớn nhất: 3 miếng bằng nhau → 34 + 33 + 33', () => {
    const d = categoryData([expense(100, '2026-10-01', F), expense(100, '2026-10-01', T), expense(100, '2026-10-01', H)], C);
    assert.equal(d.slices.reduce((n, s) => n + s.percent, 0), 100);
    assert.deepEqual(d.slices.map((s) => s.percent).sort(), [33, 33, 34]);
  });

  test('cộng nhiều khoản cùng danh mục', () => {
    const d = categoryData([expense(10, '2026-10-01', F), expense(20, '2026-10-02', F), expense(30, '2026-10-03', F)], C);
    assert.equal(d.slices.length, 1);
    assert.equal(d.slices[0].amount, 60);
    assert.equal(d.slices[0].percent, 100);
  });

  test('đúng 8 danh mục (không có "Khác") → giữ nguyên 8 miếng, không gộp', () => {
    const cats = [...C.filter((c) => c.type === 'expense' && c.id !== O), { id: 'u1', name: 'Cà phê', type: 'expense', icon: 'utensils', color: 'eat' }];
    const txs = cats.slice(0, 8).map((c, i) => expense(1000 * (i + 1), '2026-10-01', c.id));
    const d = categoryData(txs, cats);
    assert.equal(d.slices.length, 8);
    assert.equal(d.merged, 0);
  });

  test(`quá ${MAX_SLICES} miếng: giữ 7 miếng lớn nhất, phần còn lại + "Khác" gộp thành một miếng "Khác"`, () => {
    const cats = [...C, ...Array.from({ length: 4 }, (_, i) => ({ id: `u${i}`, name: `Tự tạo ${i}`, type: 'expense', icon: 'gift', color: 'fun' }))];
    const expenseCats = cats.filter((c) => c.type === 'expense' && c.id !== O); // 7 mặc định + 4 tự tạo = 11
    const txs = expenseCats.map((c, i) => expense(10_000 * (i + 1), '2026-10-02', c.id));
    txs.push(expense(5_000, '2026-10-03', O));
    const d = categoryData(txs, cats);
    assert.equal(d.slices.length, MAX_SLICES);
    assert.equal(d.slices.at(-1).id, O);
    assert.equal(d.slices.at(-1).name, 'Khác');
    assert.equal(d.merged, expenseCats.length - (MAX_SLICES - 1));
    // tổng các miếng = tổng chi, không mất xu nào
    assert.equal(d.slices.reduce((n, s) => n + s.amount, 0), d.total);
    assert.equal(d.slices.reduce((n, s) => n + s.percent, 0), 100);
    // 7 miếng đầu là 7 danh mục lớn nhất theo thứ tự giảm dần
    const kept = d.slices.slice(0, 7).map((s) => s.amount);
    assert.deepEqual(kept, [...kept].sort((a, b) => b - a));
    // mọi danh mục bị gộp đều nhỏ hơn (hoặc bằng) miếng nhỏ nhất được giữ
    const mergedNames = new Set(expenseCats.map((c) => c.name));
    for (const s of d.slices.slice(0, 7)) mergedNames.delete(s.name);
    assert.equal(mergedNames.size, d.merged);
  });

  test('khoản chi trỏ tới danh mục đã bị xoá / sai loại được tính vào "Khác" (không mất tiền)', () => {
    const txs = [expense(100, '2026-10-01', F), expense(40, '2026-10-01', 'cat-da-xoa'), expense(10, '2026-10-01', 'cat-income-salary')];
    const d = categoryData(txs, C);
    assert.equal(d.total, 150);
    assert.deepEqual(d.slices.map((s) => [s.name, s.amount]), [['Ăn uống', 100], ['Khác', 50]]);
  });

  test('thiếu danh mục "Khác" trong dữ liệu vẫn tạo được miếng "Khác" mặc định', () => {
    const d = categoryData([expense(5, '2026-10-01', 'khong-ton-tai')], [C[0]]);
    assert.deepEqual(d.slices.map((s) => [s.id, s.name, s.color]), [[OTHER_CATEGORY_ID, 'Khác', 'other']]);
  });

  test('không có khoản chi → rỗng, tổng 0; chỉ có khoản thu cũng vậy', () => {
    for (const input of [[], null, undefined, [income(1000, '2026-10-01')]]) {
      assert.deepEqual(categoryData(input, C), { total: 0, slices: [], merged: 0 });
    }
  });

  test('hai danh mục bằng số tiền: sắp ổn định theo tên (kết quả không đổi giữa các lần chạy)', () => {
    const a = categoryData([expense(100, '2026-10-01', T), expense(100, '2026-10-01', F)], C).slices.map((s) => s.name);
    const b = categoryData([expense(100, '2026-10-01', F), expense(100, '2026-10-01', T)], C).slices.map((s) => s.name);
    assert.deepEqual(a, b);
  });

  test('tổng phần trăm luôn đúng 100 trên 300 bộ dữ liệu ngẫu nhiên', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const d = categoryData(randomMonth(seed, YM, 40), C);
      if (!d.total) continue;
      assert.equal(d.slices.reduce((n, s) => n + s.percent, 0), 100, `seed ${seed}`);
      assert.equal(d.slices.reduce((n, s) => n + s.amount, 0), d.total, `seed ${seed}`);
      assert.ok(d.slices.length <= MAX_SLICES);
    }
  });

  test('formatPercent: miếng dưới 1% hiện "<1%" thay vì "0%"', () => {
    assert.equal(formatPercent({ percent: 0, amount: 5 }), '<1%');
    assert.equal(formatPercent({ percent: 12, amount: 5 }), '12%');
    assert.equal(formatPercent({ percent: 0, amount: 0 }), '0%');
  });

  test('allocatePercents: tổng 100, tổng bằng 0 → toàn 0, không âm', () => {
    assert.deepEqual(allocatePercents([], 0), []);
    assert.deepEqual(allocatePercents([0, 0], 0), [0, 0]);
    assert.deepEqual(allocatePercents([1], 1), [100]);
    assert.deepEqual(allocatePercents([1, 1], 2), [50, 50]);
    for (let seed = 1; seed <= 200; seed += 1) {
      const r = rng(seed);
      const amounts = Array.from({ length: 1 + Math.floor(r() * 8) }, () => 1 + Math.floor(r() * 1e9));
      const total = amounts.reduce((a, b) => a + b, 0);
      const p = allocatePercents(amounts, total);
      assert.equal(p.reduce((a, b) => a + b, 0), 100, `seed ${seed}`);
      assert.ok(p.every((x) => Number.isInteger(x) && x >= 0));
    }
  });
});

/* ================================================================== */
describe('③ Theo ngày', () => {
  test('có đủ mọi ngày trong tháng, đúng ngày, kể cả ngày không có giao dịch', () => {
    const { days } = dailyData([], YM);
    assert.equal(days.length, 31);
    assert.deepEqual([days[0].date, days[8].date, days[30].date], ['2026-10-01', '2026-10-09', '2026-10-31']);
    assert.ok(days.every((d, i) => d.day === i + 1 && d.income === 0 && d.expense === 0));
    assert.equal(dailyData([], '2026-02').days.length, 28);
    assert.equal(dailyData([], '2024-02').days.length, 29);
  });

  test('cộng Thu và Chi vào đúng ngày; có tổng', () => {
    const txs = [income(100, '2026-10-05'), income(50, '2026-10-05'), expense(30, '2026-10-05'), expense(70, '2026-10-31')];
    const { days, totals } = dailyData(txs, YM);
    assert.deepEqual([days[4].income, days[4].expense], [150, 30]);
    assert.equal(days[30].expense, 70);
    assert.deepEqual(totals, { income: 150, expense: 100 });
  });
});

/* ================================================================== */
describe('④ Số dư luỹ kế', () => {
  test('cộng dồn từ 0; điểm cuối = thu − chi của cả tháng', () => {
    const txs = [income(1000, '2026-10-01'), expense(300, '2026-10-02'), expense(900, '2026-10-02'), income(50, '2026-10-04')];
    const s = balanceSeries(txs, YM);
    assert.deepEqual(s.points.slice(0, 5).map((p) => p.balance), [1000, -200, -200, -150, -150]);
    assert.equal(s.points.at(-1).balance, -150);
    assert.equal(s.points.length, 31); // tháng đã qua → đủ cả tháng
    assert.deepEqual(s.points[1], { day: 2, date: '2026-10-02', income: 0, expense: 1200, net: -1200, balance: -200 });
  });

  test('số dư có thể âm', () => {
    const s = balanceSeries([expense(500, '2026-10-01'), income(100, '2026-10-02')], YM);
    assert.deepEqual(s.points.slice(0, 2).map((p) => p.balance), [-500, -400]);
  });

  test('tháng hiện tại chỉ vẽ đến hôm nay', () => {
    const s = balanceSeries([income(10, '2026-10-03')], YM, { today: '2026-10-12' });
    assert.equal(s.lastDay, 12);
    assert.equal(s.points.length, 12);
    assert.equal(s.points.at(-1).day, 12);
    assert.equal(s.points.at(-1).balance, 10);
    assert.equal(s.daysInMonth, 31);
  });

  test('có giao dịch muộn hơn hôm nay (dữ liệu nhập/khôi phục) thì vẽ tới ngày đó, không mất điểm', () => {
    const s = balanceSeries([income(10, '2026-10-20')], YM, { today: '2026-10-12' });
    assert.equal(s.lastDay, 20);
    assert.equal(s.points.at(-1).balance, 10);
  });

  test('ngày 1 của tháng hiện tại → có đúng 1 điểm', () => {
    assert.equal(balanceSeries([], YM, { today: '2026-10-01' }).points.length, 1);
  });

  test('tháng khác với tháng của "hôm nay" → vẽ đủ cả tháng', () => {
    assert.equal(balanceSeries([], '2026-09', { today: '2026-10-12' }).points.length, 30);
    assert.equal(balanceSeries([], '2026-09').points.length, 30);
  });

  test('"hôm nay" sai định dạng không làm hỏng kết quả', () => {
    for (const today of ['', 'abc', null, undefined, '2026-10-xx']) assert.ok(balanceSeries([], YM, { today }).points.length >= 1);
  });
});

/* ================================================================== */
describe('Khớp số liệu giữa các biểu đồ và thẻ tổng quan (PRD §9: 100% khớp)', () => {
  test('300 tháng dữ liệu ngẫu nhiên: tuần = ngày = danh mục = số dư = summarize', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const ym = ['2026-10', '2026-02', '2024-02', '2026-04'][seed % 4];
      const txs = randomMonth(seed, ym, 1 + (seed % 120));
      const sum = summarize(txs);
      const week = weeklyData(txs, ym);
      const day = dailyData(txs, ym);
      const cat = categoryData(txs, DEFAULT_CATEGORIES);
      const bal = balanceSeries(txs, ym);
      const tag = `seed ${seed}`;

      assert.deepEqual(week.totals, { income: sum.income, expense: sum.expense }, tag);
      assert.deepEqual(day.totals, { income: sum.income, expense: sum.expense }, tag);
      assert.equal(week.weeks.reduce((n, w) => n + w.income, 0), sum.income, tag);
      assert.equal(week.weeks.reduce((n, w) => n + w.expense, 0), sum.expense, tag);
      assert.equal(day.days.reduce((n, d) => n + d.income, 0), sum.income, tag);
      assert.equal(day.days.reduce((n, d) => n + d.expense, 0), sum.expense, tag);
      assert.equal(cat.total, sum.expense, tag);
      assert.equal(cat.slices.reduce((n, s) => n + s.amount, 0), sum.expense, tag);
      assert.equal(bal.points.at(-1).balance, sum.balance, tag);
      // mỗi tuần = tổng các ngày của tuần
      for (const w of week.weeks) {
        const inWeek = day.days.filter((d) => d.day >= w.from && d.day <= w.to);
        assert.equal(inWeek.reduce((n, d) => n + d.income, 0), w.income, `${tag} tuần ${w.index}`);
        assert.equal(inWeek.reduce((n, d) => n + d.expense, 0), w.expense, `${tag} tuần ${w.index}`);
      }
    }
  });

  test('5.000 giao dịch gộp xong dưới 100 ms (PRD §8 hiệu năng)', () => {
    const txs = randomMonth(7, YM, 5000);
    const t0 = performance.now();
    weeklyData(txs, YM);
    categoryData(txs, DEFAULT_CATEGORIES);
    dailyData(txs, YM);
    balanceSeries(txs, YM, { today: '2026-10-29' });
    const ms = performance.now() - t0;
    assert.ok(ms < 100, `mất ${ms.toFixed(1)} ms`);
  });
});

/* ================================================================== */
describe('Thang trục', () => {
  test('niceStep: số nguyên "đẹp" (1, 2, 2,5, 5 × 10^n)', () => {
    assert.equal(niceStep(0), 1);
    assert.equal(niceStep(0.3), 1);
    assert.equal(niceStep(1), 1);
    assert.equal(niceStep(1.2), 2);
    assert.equal(niceStep(2.2), 5); // 2,5 không nguyên → bỏ qua
    assert.equal(niceStep(24), 25);
    assert.equal(niceStep(26), 50);
    assert.equal(niceStep(300_000), 500_000);
    assert.equal(niceStep(250_000), 250_000);
    assert.equal(niceStep(1_000_000), 1_000_000);
    assert.equal(niceStep(NaN), 1);
  });

  test('niceScale: không có dữ liệu → thang mặc định 0…100k (khung vẫn có trục)', () => {
    assert.deepEqual(niceScale(0, 0), { min: 0, max: 100_000, step: 25_000, ticks: [0, 25_000, 50_000, 75_000, 100_000] });
    assert.equal(niceScale(NaN, NaN).max, 100_000);
  });

  test('niceScale: luôn chứa số 0 và bao trọn dữ liệu, bước đều, tối đa 7 vạch (400 trường hợp)', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const r = rng(seed);
      const mag = 10 ** Math.floor(r() * 10);
      const hi = Math.floor(r() * mag * 9) + 1;
      const lo = r() < 0.4 ? -(Math.floor(r() * mag * 9) + 1) : 0;
      const s = niceScale(lo, hi);
      const tag = `seed ${seed} [${lo}, ${hi}]`;
      assert.ok(s.min <= Math.min(0, lo) && s.max >= hi, tag);
      assert.ok(s.ticks.includes(0), `${tag} thiếu vạch 0`);
      assert.equal(s.ticks[0], s.min, tag);
      assert.equal(s.ticks.at(-1), s.max, tag);
      assert.ok(s.ticks.every((t, i) => i === 0 || t - s.ticks[i - 1] === s.step), tag);
      assert.ok(s.ticks.every(Number.isInteger), tag);
      assert.ok(s.ticks.length >= 2 && s.ticks.length <= 8, `${tag}: ${s.ticks.length} vạch`);
    }
  });

  test('niceScale: ví dụ cụ thể', () => {
    assert.deepEqual(niceScale(0, 18_000_000).ticks, [0, 5_000_000, 10_000_000, 15_000_000, 20_000_000]);
    assert.deepEqual(niceScale(-2_500_000, 1_000_000).ticks, [-3_000_000, -2_000_000, -1_000_000, 0, 1_000_000]);
    assert.deepEqual(niceScale(0, 3), { min: 0, max: 3, step: 1, ticks: [0, 1, 2, 3] });
  });

  test('niceScale: số lớn nhất (999 tỷ) không tràn', () => {
    const s = niceScale(0, 999_999_999_999);
    assert.ok(s.max >= 999_999_999_999 && Number.isSafeInteger(s.max));
  });

  test('axisLabel: rút gọn đúng chuẩn DESIGN §3 ("1,2tr", "850k"), 0 không kèm ₫, âm dùng dấu trừ thật', () => {
    assert.equal(axisLabel(0), '0');
    assert.equal(axisLabel(500), '500');
    assert.equal(axisLabel(850_000), '850k');
    assert.equal(axisLabel(1_200_000), '1,2tr');
    assert.equal(axisLabel(20_000_000), '20tr');
    assert.equal(axisLabel(-1_000_000), '−1tr');
    assert.equal(axisLabel(-500), '−500');
    assert.equal(axisLabel(2_500_000_000), '2,5 tỷ');
    assert.equal(axisLabel(NaN), '0');
    assert.equal(axisLabel(1.5), '0');
  });
});
