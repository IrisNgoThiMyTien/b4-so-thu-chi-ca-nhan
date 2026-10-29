// Đối chiếu CSS với DESIGN.md: token phải khớp từng giá trị, tương phản màu phải đạt, CSS không dùng màu "cứng".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CATEGORIES, DEFAULT_WALLETS } from '../src/core/defaults.js';
import { hasIcon } from '../src/ui/icons.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const design = read('../DESIGN.md');
const tokensCss = read('../src/styles/tokens.css');
const entryCss = read('../src/styles/entry.css');

function declarations(block) {
  const map = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map[m[1]] = m[2].trim();
  return map;
}
const light = declarations(/:root\s*\{([\s\S]*?)\n\}/.exec(tokensCss)[1]);
const darkMedia = declarations(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\n  \}/.exec(tokensCss)[1]);
const darkAttr = declarations(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(tokensCss)[1]);
const dark = { ...light, ...darkAttr };
const allRootTokens = { ...light };
for (const m of tokensCss.matchAll(/:root\s*\{([\s\S]*?)\n\}/g)) Object.assign(allRootTokens, declarations(m[1]));

const norm = (v) => v.replace(/\s+/g, '').toLowerCase();

/* ---------- DESIGN §2.1–2.2: bảng màu ---------- */
const designColors = [...design.matchAll(/^\|\s*`(--[\w-]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|/gm)].map((m) => ({ name: m[1], light: m[2], dark: m[3] }));

test('đọc được đủ token màu từ DESIGN.md (13 token ở §2.1–2.2)', () => {
  assert.equal(designColors.length, 13, designColors.map((c) => c.name).join(', '));
});

test('tokens.css khớp DESIGN.md: màu chế độ sáng', () => {
  for (const c of designColors) assert.equal(norm(light[c.name] ?? ''), norm(c.light), `${c.name} (sáng)`);
});

test('tokens.css khớp DESIGN.md: màu chế độ tối (cả khi theo hệ thống lẫn data-theme="dark")', () => {
  for (const c of designColors) {
    assert.equal(norm(darkMedia[c.name] ?? ''), norm(c.dark), `${c.name} (tối, hệ thống)`);
    assert.equal(norm(darkAttr[c.name] ?? ''), norm(c.dark), `${c.name} (tối, data-theme)`);
  }
});

test('hai khối chế độ tối (media query và data-theme) có cùng nội dung', () => {
  assert.deepEqual(darkMedia, darkAttr);
});

/* ---------- DESIGN §2.3: màu danh mục ---------- */
const catKeys = { 'Ăn uống': 'eat', 'Di chuyển': 'move', 'Nhà ở': 'home', 'Mua sắm': 'shop', 'Giải trí': 'fun', 'Sức khoẻ': 'health', 'Học tập': 'study', Khác: 'other' };
const designCats = [...design.matchAll(/^\|\s*([^|`]+?)\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|\s*`(#[0-9A-Fa-f]{6})`\s*\|\s*$/gm)].filter((m) => catKeys[m[1]]);

test('màu 8 danh mục khớp bảng §2.3 ở cả sáng và tối', () => {
  assert.equal(designCats.length, 8);
  for (const [, name, l, d] of designCats) {
    const key = `--cat-${catKeys[name]}`;
    assert.equal(norm(light[key]), norm(l), `${name} sáng`);
    assert.equal(norm(darkAttr[key]), norm(d), `${name} tối`);
  }
});

test('mọi danh mục mặc định trỏ tới một màu và một biểu tượng có thật', () => {
  for (const c of DEFAULT_CATEGORIES) {
    assert.ok(`--cat-${c.color}` in light, `${c.name}: màu ${c.color}`);
    assert.ok(hasIcon(c.icon), `${c.name}: biểu tượng ${c.icon}`);
  }
  for (const w of DEFAULT_WALLETS) assert.ok(hasIcon(w.icon), `${w.name}: biểu tượng ${w.icon}`);
});

/* ---------- Khoảng cách, bo góc, lớp, chuyển động ---------- */
test('thang khoảng cách 4·8·12·16·20·24·32·48', () => {
  const spaces = [4, 8, 12, 16, 20, 24, 32, 48];
  assert.match(design, /4 · 8 · 12 · 16 · 20 · 24 · 32 · 48/);
  spaces.forEach((px, i) => assert.equal(allRootTokens[`--space-${i + 1}`], `${px}px`));
});

test('bo góc, thời lượng, easing, z-index khớp DESIGN.md', () => {
  for (const m of design.matchAll(/\|\s*`(--radius-[a-z]+)`\s*\|\s*(\d+) px/g)) assert.equal(allRootTokens[m[1]], `${m[2]}px`, m[1]);
  for (const m of design.matchAll(/\|\s*`(--dur-[a-z]+)`\s*\|\s*(\d+) ms/g)) assert.equal(allRootTokens[m[1]], `${m[2]}ms`, m[1]);
  assert.equal(norm(allRootTokens['--ease-out']), norm('cubic-bezier(0.2, 0.8, 0.2, 1)'));
  assert.equal(norm(allRootTokens['--ease-in']), norm('cubic-bezier(0.4, 0, 1, 1)'));
  const z = /nội dung (\d+) · thanh trên (\d+) · FAB (\d+) · lớp phủ mờ (\d+) · bảng trượt\/hộp thoại (\d+) · thông báo \(toast\) (\d+)/.exec(design);
  assert.ok(z, 'không đọc được dòng z-index');
  ['content', 'bar', 'fab', 'scrim', 'dialog', 'toast'].forEach((k, i) => assert.equal(allRootTokens[`--z-${k}`], z[i + 1], k));
});

test('bóng đổ khớp DESIGN.md (sáng & tối)', () => {
  const rows = [...design.matchAll(/\|\s*`(--shadow-\d)`\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/g)];
  assert.equal(rows.length, 3);
  for (const [, name, lightValue, darkCell] of rows) {
    assert.equal(norm(light[name]), norm(lightValue), `${name} sáng`);
    const darkValue = /^không bóng/.test(darkCell) ? null : /`([^`]+)`/.exec(darkCell)?.[1];
    if (darkValue) assert.equal(norm(darkAttr[name]), norm(darkValue), `${name} tối`);
    else assert.equal(darkAttr[name], 'none', `${name} tối`);
  }
});

test('kiểu chữ: cỡ chữ theo bảng §3', () => {
  const expected = { '--fs-display': '32px', '--lh-display': '40px', '--fs-h1': '20px', '--lh-h1': '28px', '--fs-h2': '16px', '--lh-h2': '24px', '--fs-body': '15px', '--lh-body': '22px', '--fs-small': '13px', '--lh-small': '18px', '--fs-button': '16px', '--lh-button': '24px' };
  for (const [k, v] of Object.entries(expected)) assert.equal(allRootTokens[k], v, k);
  assert.match(allRootTokens['--font'], /^"Be Vietnam Pro"/);
});

/* ---------- Tương phản (WCAG 2.x) ---------- */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const [mode, t] of [['sáng', light], ['tối', dark]]) {
  test(`tương phản chữ thường ≥ 4.5:1 (${mode})`, () => {
    const pairs = [
      ['--text', '--surface'], ['--text', '--surface-2'], ['--text-muted', '--surface'], ['--text-muted', '--surface-2'],
      ['--on-primary', '--primary'], ['--primary', '--surface'], ['--danger', '--surface'], ['--on-danger', '--danger'],
      ['--on-expense', '--expense'], ['--on-income', '--income'], ['--bg', '--text'],
    ];
    for (const [fg, bg] of pairs) {
      const ratio = contrast(t[fg], t[bg]);
      assert.ok(ratio >= 4.5, `${fg} trên ${bg}: ${ratio.toFixed(2)}:1`);
    }
  });

  test(`số tiền cỡ lớn (32px đậm) dùng màu thu/chi đạt ≥ 3:1 (${mode})`, () => {
    for (const fg of ['--income', '--expense']) {
      const ratio = contrast(t[fg], t['--surface']);
      assert.ok(ratio >= 3, `${fg} trên --surface: ${ratio.toFixed(2)}:1`);
    }
  });
}

/* ---------- entry.css chỉ dùng token ---------- */
test('entry.css không dùng mã màu cứng (hex / rgb) — mọi màu đi qua token', () => {
  const stripped = entryCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(stripped.match(/\brgba?\(/g) ?? [], []);
});

test('entry.css chỉ tham chiếu token có khai báo trong tokens.css', () => {
  const used = new Set([...entryCss.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  const local = new Set(['--cat-color']); // đặt theo từng ô bằng thuộc tính style
  const missing = [...used].filter((name) => !(name in allRootTokens) && !local.has(name));
  assert.deepEqual(missing, []);
});

test('điểm gãy bố cục là 640px (PRD §8, DESIGN §4)', () => {
  assert.match(entryCss, /@media \(min-width: 640px\)/);
  assert.match(entryCss, /width: 480px/);
});

test('có xử lý prefers-reduced-motion và safe-area (DESIGN §4, §8)', () => {
  assert.match(entryCss, /prefers-reduced-motion: reduce/);
  assert.match(entryCss, /safe-area-inset-bottom/);
});

/* ---------- M2: home.css ---------- */
const homeCss = read('../src/styles/home.css');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('home.css không dùng mã màu cứng — mọi màu đi qua token', () => {
  const css = stripComments(homeCss);
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(css.match(/\brgba?\(/g) ?? [], []);
});

test('home.css chỉ tham chiếu token đã khai báo (hoặc biến cục bộ do JS đặt)', () => {
  const used = new Set([...homeCss.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  const local = new Set(['--chars', '--cols', '--mp-left', '--mp-top']); // do home.js / month-picker.js đặt bằng JS
  assert.deepEqual([...used].filter((n) => !(n in allRootTokens) && !local.has(n)), []);
});

test('home.css: điểm gãy 640px, thanh tháng cao 56 và dính đầu trang, nút ＋ 56px', () => {
  assert.match(homeCss, /@media \(min-width: 640px\)/);
  assert.match(homeCss, /\.month-bar__inner \{[^}]*height: 56px/);
  assert.match(homeCss, /\.month-bar \{[^}]*position: sticky/);
  assert.match(homeCss, /\.fab \{[^}]*width: 56px;[^}]*height: 56px/);
  assert.match(homeCss, /max-width: 960px/);
  assert.match(homeCss, /prefers-reduced-motion: reduce/);
  assert.match(homeCss, /safe-area-inset-bottom/);
});

test('home.css: số trên thẻ 24px đậm (DESIGN §3 "Số liệu lớn"), chữ nhãn 13px', () => {
  assert.match(homeCss, /\.card__value--full \{[^}]*font-size: 24px/);
  assert.match(homeCss, /\.card__value \{[^}]*font-weight: 700/);
  assert.match(homeCss, /\.card__label \{[^}]*font-size: var\(--fs-small\)/);
});

for (const [mode, t] of [['sáng', light], ['tối', dark]]) {
  test(`M2: tương phản các cặp màu mới ≥ 4.5:1 (${mode})`, () => {
    const pairs = [['--bg', '--text'], ['--on-primary', '--primary'], ['--text', '--surface'], ['--text-muted', '--surface'], ['--text-muted', '--bg']];
    for (const [fg, bg] of pairs) assert.ok(contrast(t[fg], t[bg]) >= 4.5, `${fg}/${bg}`);
  });
  test(`M2: số tiền 24px đậm trên thẻ dùng màu thu/chi đạt ≥ 3:1 (${mode})`, () => {
    for (const fg of ['--income', '--expense']) assert.ok(contrast(t[fg], t['--surface']) >= 3, fg);
  });
}

/* ---------- M3: tx-list.css ---------- */
const txCss = read('../src/styles/tx-list.css');

test('tx-list.css không dùng mã màu cứng; chỉ tham chiếu token đã khai báo', () => {
  const css = stripComments(txCss);
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(css.match(/\brgba?\(/g) ?? [], []);
  const used = new Set([...txCss.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((n) => !(n in allRootTokens) && n !== '--cat-color'), []);
});

test('tx-list.css: dòng cao ≥ 56, biểu tượng 40px tròn, tên 15/600, ghi chú 13px, tổng ngày 13px muted', () => {
  assert.match(txCss, /\.tx__main \{[^}]*min-height: 56px/);
  assert.match(txCss, /\.tx__icon \{[^}]*width: 40px;[^}]*height: 40px;[^}]*border-radius: var\(--radius-full\)/);
  assert.match(txCss, /\.tx__icon \{[^}]*color-mix\(in srgb, var\(--cat-color, var\(--cat-other\)\) 15%/);
  assert.match(txCss, /\.tx__name \{[^}]*font-weight: 600/);
  assert.match(txCss, /\.tx__sub \{[^}]*color: var\(--text-muted\)[^}]*font-size: var\(--fs-small\)/);
  assert.match(txCss, /\.tx-day__sum \{[^}]*color: var\(--text-muted\)[^}]*font-size: var\(--fs-small\)/);
  assert.match(txCss, /\.tx-day__title \{[^}]*font-size: var\(--fs-h2\)/);
});

test('tx-list.css: nút Xoá dùng --danger, rộng 88px; ✎ 🗑 chỉ ở thiết bị có chuột (hover: hover)', () => {
  assert.match(txCss, /\.tx__delete \{[^}]*width: 88px[^}]*background: var\(--danger\)/);
  assert.match(txCss, /@media \(hover: hover\)/);
  assert.match(txCss, /touch-action: pan-y/);
  assert.match(txCss, /prefers-reduced-motion: reduce/);
});

for (const [mode, t] of [['sáng', light], ['tối', dark]]) {
  test(`M3: số tiền cỡ 15px dùng màu chữ thu/chi đạt ≥ 4.5:1 trên nền thẻ và nền khi rê chuột (${mode})`, () => {
    const ti = allRootTokens; // giá trị của chế độ sáng; chế độ tối lấy từ khối dark
    const income = mode === 'sáng' ? ti['--income-text'] : darkAttr['--income-text'];
    const expense = mode === 'sáng' ? ti['--expense-text'] : darkAttr['--expense-text'];
    for (const bg of ['--surface', '--surface-2']) {
      assert.ok(contrast(income, t[bg]) >= 4.5, `income-text/${bg}: ${contrast(income, t[bg]).toFixed(2)}`);
      assert.ok(contrast(expense, t[bg]) >= 4.5, `expense-text/${bg}: ${contrast(expense, t[bg]).toFixed(2)}`);
    }
    assert.ok(contrast(t['--on-danger'], t['--danger']) >= 4.5, 'chữ trên nút Xoá');
  });
}

/* ---------- M4: charts.css ---------- */
const chartsCss = read('../src/styles/charts.css');
const chartsJs = read('../src/ui/charts.js');
const indexHtml = read('../index.html');
const appJs = read('../src/app.js');
const rule = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...stripComments(css).matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]).join(';');
};

test('charts.css không dùng mã màu cứng; chỉ tham chiếu token đã khai báo', () => {
  const css = stripComments(chartsCss);
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(css.match(/\brgba?\(/g) ?? [], []);
  const used = new Set([...chartsCss.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((n) => !(n in allRootTokens) && n !== '--cat-color'), []);
});

test('M4: thứ tự và tên 4 biểu đồ trong mã nguồn khớp DESIGN §6.3', () => {
  const section = /### 6\.3 Carousel biểu đồ([\s\S]*?)### 6\.4/.exec(design)[1];
  const expected = [...section.matchAll(/^\s+\d\. \*\*(.+?)\*\*/gm)].map((m) => m[1]);
  assert.equal(expected.length, 4);
  const actual = [...chartsJs.matchAll(/^\s+title: '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(actual, expected);
});

test('M4: khung carousel dùng --surface, --radius-lg, viền --border, --shadow-1 (DESIGN §5, §6.3)', () => {
  const r = rule(chartsCss, '.charts');
  assert.match(r, /background: var\(--surface\)/);
  assert.match(r, /border: 1px solid var\(--border\)/);
  assert.match(r, /border-radius: var\(--radius-lg\)/);
  assert.match(r, /box-shadow: var\(--shadow-1\)/);
  assert.match(r, /font-family: var\(--font\)/);
});

test('M4: vuốt ngang bằng CSS scroll-snap; không hiện thanh cuộn dọc; cuộn không tràn sang trang', () => {
  const track = rule(chartsCss, '.charts__track');
  assert.match(track, /scroll-snap-type: x mandatory/);
  assert.match(track, /overflow-x: auto/);
  assert.match(track, /overflow-y: hidden/);
  assert.match(track, /overscroll-behavior-x: contain/);
  assert.match(rule(chartsCss, '.chart'), /scroll-snap-align: start/);
  assert.match(rule(chartsCss, '.chart'), /flex: 0 0 100%/);
});

test('M4: vùng cuộn ngang của biểu đồ ngày không chặn chuyển tiếp cuộn — cuộn hết rồi vuốt tiếp thì sang biểu đồ khác', () => {
  assert.doesNotMatch(rule(chartsCss, '.chart__scroll'), /overscroll-behavior/);
  assert.match(rule(chartsCss, '.chart__scroll'), /overflow-x: auto/);
});

test('M4: tiêu đề biểu đồ H2 16/600, mô tả 13px --text-muted (DESIGN §3)', () => {
  const title = rule(chartsCss, '.chart__title');
  assert.match(title, /font-size: var\(--fs-h2\)/);
  assert.match(title, /line-height: var\(--lh-h2\)/);
  assert.match(title, /font-weight: 600/);
  const desc = rule(chartsCss, '.chart__desc');
  assert.match(desc, /font-size: var\(--fs-small\)/);
  assert.match(desc, /color: var\(--text-muted\)/);
});

test('M4: chấm chỉ báo — vùng chạm 44×44, chấm 6px, đang chọn kéo dài 16×6 màu --primary, đổi bề rộng trong --dur-base', () => {
  const dot = rule(chartsCss, '.charts__dot');
  assert.match(dot, /width: 44px/);
  assert.match(dot, /height: 44px/);
  const pip = rule(chartsCss, '.charts__pip');
  assert.match(pip, /width: 6px/);
  assert.match(pip, /height: 6px/);
  assert.match(pip, /border-radius: var\(--radius-full\)/);
  assert.match(pip, /transition: width var\(--dur-base\)/);
  const active = rule(chartsCss, '.charts__dot.is-active .charts__pip');
  assert.match(active, /width: 16px/);
  assert.match(active, /background: var\(--primary\)/);
  assert.match(rule(chartsCss, '.charts__dots'), /gap: var\(--space-2\)/); // khoảng cách giữa hai vùng chạm ≥ 8px
});

test('M4: nút ‹ › chỉ hiện từ 640px (laptop); điện thoại ẩn', () => {
  assert.match(rule(chartsCss, '.charts__nav'), /display: none/);
  const laptop = /@media \(min-width: 640px\) \{([\s\S]*?)\n\}/.exec(chartsCss)[1];
  assert.match(laptop, /\.charts__nav \{ display: inline-flex; \}/);
});

test('M4: màu biểu đồ theo DESIGN §2.3 — Thu --income, Chi --expense; đường --primary 2px; vùng tô 12%; lưới --border; vạch 0 đậm hơn', () => {
  assert.match(rule(chartsCss, '.chart-bar--income'), /fill: var\(--income\)/);
  assert.match(rule(chartsCss, '.chart-bar--expense'), /fill: var\(--expense\)/);
  assert.match(rule(chartsCss, '.chart-legend__swatch--income'), /background: var\(--income\)/);
  assert.match(rule(chartsCss, '.chart-legend__swatch--expense'), /background: var\(--expense\)/);
  const line = rule(chartsCss, '.chart-line');
  assert.match(line, /stroke: var\(--primary\)/);
  assert.match(line, /stroke-width: 2\b/);
  assert.match(rule(chartsCss, '.chart-area'), /color-mix\(in srgb, var\(--primary\) 12%, transparent\)/);
  assert.match(rule(chartsCss, '.chart-grid__line'), /stroke: var\(--border\)/);
  assert.match(rule(chartsCss, '.chart-grid__zero'), /stroke-width: 2/);
  assert.match(rule(chartsCss, '.chart-label'), /fill: var\(--text-muted\)/);
  assert.match(rule(chartsCss, '.chart-label'), /font-size: var\(--fs-small\)/); // nhãn trục 13px
});

test('M4: màu miếng vành khuyên đi qua biến danh mục, không có màu cứng trong JS', () => {
  const svgJs = read('../src/ui/chart-svg.js');
  assert.match(svgJs, /categoryColorVar\(s\.color\)/);
  assert.deepEqual(stripComments(svgJs).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(stripComments(chartsJs).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
});

test('M4: tooltip — nền --surface, --shadow-2, bo --radius-sm, không chặn chuột (DESIGN §5, §6.3)', () => {
  const tip = rule(chartsCss, '.chart-tip');
  assert.match(tip, /background: var\(--surface\)/);
  assert.match(tip, /box-shadow: var\(--shadow-2\)/);
  assert.match(tip, /border-radius: var\(--radius-sm\)/);
  assert.match(tip, /pointer-events: none/);
  assert.match(tip, /font-size: var\(--fs-small\)/);
  assert.match(rule(chartsCss, '.chart-tip__value--income'), /color: var\(--income-text\)/);
  assert.match(rule(chartsCss, '.chart-tip__value--expense'), /color: var\(--expense-text\)/);
});

test('M4: bảng số liệu — hàng 40 (laptop 36), tiêu đề cột 13/600 dính đầu, vùng cuộn cao tối đa 240, tabular-nums, hàng Tổng đường kẻ trên 2px (DESIGN §10.9)', () => {
  assert.match(rule(chartsCss, '.chart__table-wrap'), /max-height: 240px/);
  assert.match(rule(chartsCss, '.chart__table-wrap'), /overflow: auto/);
  const cell = rule(chartsCss, '.chart-table th,\n.chart-table td');
  assert.match(cell, /height: 40px/);
  assert.match(cell, /border-bottom: 1px solid var\(--border\)/);
  const head = rule(chartsCss, '.chart-table .col-head');
  assert.match(head, /position: sticky/);
  assert.match(head, /top: 0/);
  assert.match(head, /font-size: var\(--fs-small\)/);
  assert.match(head, /font-weight: 600/);
  assert.match(head, /color: var\(--text-muted\)/);
  assert.match(rule(chartsCss, '.chart-table .col-head--num,\n.chart-table .num'), /font-variant-numeric: tabular-nums/);
  assert.match(rule(chartsCss, '.chart-table .col-head--num,\n.chart-table .num'), /text-align: right/);
  const total = rule(chartsCss, '.chart-table tfoot th,\n.chart-table tfoot td');
  assert.match(total, /border-top: 2px solid var\(--border\)/);
  assert.match(total, /font-weight: 600/);
  assert.match(rule(chartsCss, '.num--income'), /color: var\(--income-text\)/);
  assert.match(rule(chartsCss, '.num--expense'), /color: var\(--expense-text\)/);
  assert.match(chartsCss, /@media \(min-width: 640px\) \{[\s\S]*?\.chart-table td \{ height: 36px; \}/);
  assert.match(chartsCss, /@media \(min-width: 640px\) and \(hover: hover\) \{\s*\.chart-table tbody tr:hover > \* \{ background: var\(--surface-2\); \}/);
});

test('M4: điện thoại — số trong bảng ngày rút gọn, bấm hàng để xem đầy đủ; số đầy đủ vẫn nằm trong DOM cho trình đọc màn hình', () => {
  const phone = /@media \(max-width: 639\.98px\) \{([\s\S]*?)\n\}/.exec(chartsCss)[1];
  assert.match(phone, /\.chart-table--dense \.num__full/);
  assert.match(phone, /clip: rect\(0 0 0 0\)/); // ẩn bằng kỹ thuật sr-only, không dùng display: none
  assert.match(phone, /tr\.is-expanded \.num__full/);
});

test('M4: chuyển động theo DESIGN §8 — cột/vành/đường 400–600ms, đổi tháng --dur-base; tôn trọng prefers-reduced-motion', () => {
  assert.match(chartsCss, /chart-bar-grow 500ms var\(--ease-out\)/);
  assert.match(chartsCss, /chart-line-reveal 600ms var\(--ease-out\)/);
  assert.match(chartsCss, /chart-arc-open 600ms var\(--ease-out\)/);
  assert.match(chartsCss, /\.charts\.is-updating \.charts__track \{ animation: chart-fade var\(--dur-base\)/);
  const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\n\}/.exec(chartsCss)[1];
  assert.match(reduced, /animation: none/);
  assert.match(reduced, /chart-fade 100ms/);
});

test('M4: có vòng focus 2px --focus cho nút, vùng cuộn và bảng', () => {
  assert.match(chartsCss, /\.charts button:focus-visible,[\s\S]*?outline: 2px solid var\(--focus\)/);
});

for (const [mode, t] of [['sáng', light], ['tối', dark]]) {
  test(`M4: cột / đường biểu đồ đạt tương phản đồ hoạ ≥ 3:1 với nền khung (${mode})`, () => {
    for (const fg of ['--income', '--expense', '--primary']) assert.ok(contrast(t[fg], t['--surface']) >= 3, `${fg}/--surface: ${contrast(t[fg], t['--surface']).toFixed(2)}`);
  });
  test(`M4: chữ nhãn trục, tooltip và bảng đạt ≥ 4.5:1 (${mode})`, () => {
    const income = mode === 'sáng' ? allRootTokens['--income-text'] : darkAttr['--income-text'];
    const expense = mode === 'sáng' ? allRootTokens['--expense-text'] : darkAttr['--expense-text'];
    for (const bg of ['--surface', '--surface-2']) {
      assert.ok(contrast(t['--text-muted'], t[bg]) >= 4.5, `text-muted/${bg}`);
      assert.ok(contrast(t['--text'], t[bg]) >= 4.5, `text/${bg}`);
      assert.ok(contrast(income, t[bg]) >= 4.5, `income-text/${bg}`);
      assert.ok(contrast(expense, t[bg]) >= 4.5, `expense-text/${bg}`);
    }
  });
}

test('M4: các biểu tượng mới có trong bộ biểu tượng; trang khởi động nạp charts.css sau entry/home và gắn M4', () => {
  assert.ok(hasIcon('table'));
  assert.ok(hasIcon('bar-chart-3'));
  assert.ok(hasIcon('chevron-left') && hasIcon('chevron-right'));
  const order = ['tokens.css', 'entry.css', 'home.css', 'tx-list.css', 'charts.css'].map((f) => indexHtml.indexOf(`src/styles/${f}`));
  assert.ok(order.every((n) => n >= 0), 'thiếu thẻ link');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'charts.css phải nạp sau entry.css (ghi đè display của nút) và home.css (.sr-only)');
  assert.match(appJs, /mountCharts\(\{ repo, home \}\)/);
});

/* ---------- M5: search.css (DESIGN §10.4) ---------- */
const searchCss = read('../src/styles/search.css');
const searchJs = read('../src/ui/search.js');
const section104 = /## 10\.4 Tìm kiếm & Bộ lọc \(F12\)([\s\S]*?)## 10\.5/.exec(design)[1];

test('search.css không dùng mã màu cứng; chỉ tham chiếu token đã khai báo (hoặc biến cục bộ do JS đặt)', () => {
  const css = stripComments(searchCss);
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(css.match(/\brgba?\(/g) ?? [], []);
  const used = new Set([...searchCss.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((n) => !(n in allRootTokens) && !['--cat-color', '--fp-left', '--fp-top'].includes(n)), []);
  assert.deepEqual(stripComments(searchJs).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], 'JS cũng không có màu cứng');
});

test('M5: ô tìm — nền --surface-2, bo --radius-full, cao 44, chữ nhập 15/400, placeholder và biểu tượng --text-muted (DESIGN §10.4 mục 3)', () => {
  const field = rule(searchCss, '.search__field');
  assert.match(field, /background: var\(--surface-2\)/);
  assert.match(field, /border-radius: var\(--radius-full\)/);
  assert.match(field, /height: 44px/);
  assert.match(field, /border: 1px solid var\(--border\)/);
  assert.match(rule(searchCss, '.search__field:hover'), /border-color: var\(--text-muted\)/);
  assert.match(rule(searchCss, '.search__field:focus-within'), /border-color: var\(--focus\)/);
  const inputRule = rule(searchCss, '.search__input');
  assert.match(inputRule, /font-size: var\(--fs-body\)/);
  assert.match(inputRule, /font-weight: 400/);
  assert.match(inputRule, /color: var\(--text\)/);
  assert.match(rule(searchCss, '.search__input::placeholder'), /color: var\(--text-muted\)/);
  assert.match(rule(searchCss, '.search__icon'), /color: var\(--text-muted\)/);
  assert.match(searchCss, /::-webkit-search-cancel-button[\s\S]*?display: none/, 'ẩn nút xoá mặc định của trình duyệt, dùng nút ✕ riêng');
  const clear = rule(searchCss, '.search__clear');
  assert.match(clear, /width: 44px/);
  assert.match(clear, /height: 44px/);
});

test('M5: nút Lọc — nút phụ cao 44, viền --border; có bộ lọc → viền --primary; huy hiệu tròn 16px nền --primary chữ --on-primary', () => {
  const btn = rule(searchCss, '.search__filter');
  assert.match(btn, /min-width: 44px/);
  assert.match(btn, /height: 44px/);
  assert.match(btn, /border: 1px solid var\(--border\)/);
  assert.match(btn, /background: transparent/);
  assert.match(btn, /color: var\(--text\)/);
  assert.match(rule(searchCss, '.search__filter.is-active'), /border-color: var\(--primary\)/);
  const b = rule(searchCss, '.search__badge');
  assert.match(b, /height: 16px/);
  assert.match(b, /min-width: 16px/);
  assert.match(b, /border-radius: var\(--radius-full\)/);
  assert.match(b, /background: var\(--primary\)/);
  assert.match(b, /color: var\(--on-primary\)/);
});

test('M5: điện thoại nút Lọc chỉ biểu tượng + huy hiệu; laptop (≥ 640px) hiện thêm chữ "Lọc" (DESIGN §10.4 mục 4)', () => {
  assert.match(rule(searchCss, '.search__filter-text'), /display: none/);
  const wide = /@media \(min-width: 640px\) \{([\s\S]*?)\n\}/.exec(searchCss)[1];
  assert.match(wide, /\.search__filter-text \{ display: inline; \}/);
  assert.match(wide, /\.search__badge \{ position: static; \}/);
});

test('M5: chip bộ lọc đang bật — cao 32, nền --surface-2, bo --radius-full, chữ 13/500, hàng cuộn ngang, vùng chạm ✕ mở rộng 44', () => {
  const chip = rule(searchCss, '.fchip');
  assert.match(chip, /height: 32px/);
  assert.match(chip, /background: var\(--surface-2\)/);
  assert.match(chip, /border-radius: var\(--radius-full\)/);
  assert.match(chip, /font-size: var\(--fs-small\)/);
  assert.match(chip, /font-weight: 500/);
  assert.match(chip, /white-space: nowrap/);
  const row = rule(searchCss, '.search__chips');
  assert.match(row, /overflow-x: auto/);
  assert.match(row, /gap: var\(--space-2\)/); // khoảng cách giữa hai chip ≥ 8px
  assert.match(row, /padding: 6px/); // 32 + 6 + 6 = 44
  const x = rule(searchCss, '.fchip__x');
  assert.match(x, /width: 24px/);
  assert.match(x, /height: 24px/);
  assert.match(rule(searchCss, '.fchip__x::after'), /inset: -10px/); // 24 + 10 + 10 = 44
});

test('M5: thanh tóm tắt 13/500 --text-muted; số tiền tô màu chữ thu/chi theo dấu', () => {
  const s = rule(searchCss, '.search__summary');
  assert.match(s, /font-size: var\(--fs-small\)/);
  assert.match(s, /font-weight: 500/);
  assert.match(s, /color: var\(--text-muted\)/);
  assert.match(s, /font-variant-numeric: tabular-nums/);
  assert.match(rule(searchCss, '.search__net--income'), /color: var\(--income-text\)/);
  assert.match(rule(searchCss, '.search__net--expense'), /color: var\(--expense-text\)/);
});

test('M5: làm nổi từ khoá — nền --primary 15%, bo 2px; chữ dùng --text để luôn đạt 4.5:1 (chỗ khác DESIGN §10.4 "giữ nguyên màu")', () => {
  const mark = rule(searchCss, '.tx__mark');
  assert.match(mark, /background: color-mix\(in srgb, var\(--primary\) 15%, transparent\)/);
  assert.match(mark, /border-radius: 2px/);
  assert.match(mark, /color: var\(--text\)/);
});

test('M5: bảng lọc điện thoại — bảng trượt bo --radius-xl phía trên, cao tối đa 80%, chân bảng dính đáy có safe-area, nút "Xem N kết quả" rộng đầy', () => {
  const panel = rule(searchCss, '.filter-panel__panel');
  assert.match(panel, /position: fixed/);
  assert.match(panel, /bottom: 0/);
  assert.match(panel, /max-height: 80dvh/);
  assert.match(panel, /border-radius: var\(--radius-xl\) var\(--radius-xl\) 0 0/);
  assert.match(panel, /background: var\(--surface\)/);
  assert.match(panel, /box-shadow: var\(--shadow-3\)/);
  assert.match(panel, /z-index: var\(--z-dialog\)/);
  assert.match(rule(searchCss, '.filter-panel__scrim'), /z-index: var\(--z-scrim\)/);
  assert.match(rule(searchCss, '.filter-panel__scrim'), /background: var\(--scrim\)/);
  assert.match(rule(searchCss, '.fp__handle'), /width: 36px/);
  assert.match(rule(searchCss, '.fp__handle'), /height: 4px/);
  const foot = rule(searchCss, '.fp__foot');
  assert.match(foot, /flex: none/);
  assert.match(foot, /env\(safe-area-inset-bottom/);
  assert.match(foot, /border-top: 1px solid var\(--border\)/);
  assert.match(rule(searchCss, '.fp__apply'), /flex: 1/);
  assert.match(rule(searchCss, '.fp__body'), /overflow-y: auto/);
});

test('M5: bảng lọc laptop — popover rộng đúng số trong DESIGN, bo --radius-lg, --shadow-2, không lớp phủ, không tay nắm', () => {
  const px = /popover (\d+) px/.exec(section104)[1];
  const wide = /@media \(min-width: 640px\) \{([\s\S]*?)\n\}/.exec(searchCss)[1];
  assert.match(wide, new RegExp(`width: ${px}px`));
  assert.match(wide, /\.filter-panel__scrim \{ display: none; \}/);
  assert.match(wide, /border-radius: var\(--radius-lg\)/);
  assert.match(wide, /box-shadow: var\(--shadow-2\)/);
  assert.match(wide, /\.fp__handle \{ display: none; \}/);
  assert.match(wide, /left: var\(--fp-left/);
  assert.match(wide, /top: var\(--fp-top/);
  assert.match(searchJs, new RegExp(`POPOVER_WIDTH = ${px};`), 'JS tính vị trí theo cùng bề rộng');
  assert.match(section104, /tối đa 80%/);
  assert.match(section104, /sau khi ngừng gõ (\d+) ms/);
});

test('M5: độ trễ lọc trong mã khớp DESIGN §10.4', async () => {
  const ms = Number(/sau khi ngừng gõ (\d+) ms/.exec(section104)[1]);
  const { DEBOUNCE_MS } = await import('../src/ui/search.js');
  assert.equal(DEBOUNCE_MS, ms);
});

test('M5: nhóm trong bảng — nhãn H2 16/600; Loại là segmented 3 mục, mục chọn nền --primary chữ --on-primary; chip chọn dùng viền 2px --primary + nền --primary 10%', () => {
  const label = rule(searchCss, '.fp__label');
  assert.match(label, /font-size: var\(--fs-h2\)/);
  assert.match(label, /line-height: var\(--lh-h2\)/);
  assert.match(label, /font-weight: 600/);
  assert.match(rule(searchCss, '.fp__seg'), /repeat\(3,/);
  const sel = rule(searchCss, '.fp__seg .segmented__btn[aria-checked="true"]');
  assert.match(sel, /background: var\(--primary\)/);
  assert.match(sel, /color: var\(--on-primary\)/);
  assert.match(entryCss, /\.chip\[aria-pressed="true"\] \{ border-color: var\(--primary\); background: var\(--primary-soft\); \}/);
  assert.match(entryCss, /\.chip \{[^}]*border: 2px solid transparent/);
  assert.match(tokensCss, /--primary-soft: color-mix\(in srgb, var\(--primary\) 10%, var\(--surface\)\)/);
  assert.doesNotMatch(searchJs, /data-value/, 'không dùng data-value=expense/income của segmented M1 (sẽ ăn màu chi/thu)');
});

test('M5: bảng lọc có vòng focus 2px --focus; giảm chuyển động → chỉ mờ dần ≤ 100ms', () => {
  assert.match(searchCss, /\.filter-panel :focus-visible \{ outline: 2px solid var\(--focus\)/);
  const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\n\}/.exec(searchCss)[1];
  assert.match(reduced, /fade-in 100ms linear/);
  assert.match(reduced, /transition: none/);
});

test('M5: chuyển động dùng đúng token — bảng trượt --dur-slow, popover/lớp phủ --dur-base, chip --dur-fast (DESIGN §8)', () => {
  assert.match(rule(searchCss, '.filter-panel__panel'), /sheet-in var\(--dur-slow\) var\(--ease-out\)/);
  assert.match(rule(searchCss, '.filter-panel__scrim'), /fade-in var\(--dur-base\)/);
  assert.match(rule(searchCss, '.fchip__x'), /var\(--dur-fast\)/);
});

for (const [mode, t] of [['sáng', light], ['tối', dark]]) {
  const blend = (fg, bg, a) => `#${[1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
  const income = mode === 'sáng' ? allRootTokens['--income-text'] : darkAttr['--income-text'];
  const expense = mode === 'sáng' ? allRootTokens['--expense-text'] : darkAttr['--expense-text'];

  test(`M5: tương phản chữ ≥ 4.5:1 – ô tìm, chip, nút, huy hiệu, tóm tắt (${mode})`, () => {
    const pairs = [
      ['--text', '--surface-2'], ['--text-muted', '--surface-2'], // chữ nhập, placeholder, biểu tượng, ✕ trong chip
      ['--on-primary', '--primary'], // huy hiệu, mục chọn của segmented
      ['--text-muted', '--bg'], // thanh tóm tắt nằm trên nền trang
      ['--text', '--surface'], ['--text-muted', '--surface'],
    ];
    for (const [fg, bg] of pairs) assert.ok(contrast(t[fg], t[bg]) >= 4.5, `${fg}/${bg}: ${contrast(t[fg], t[bg]).toFixed(2)}`);
    for (const bg of ['--bg', '--surface']) {
      assert.ok(contrast(income, t[bg]) >= 4.5, `income-text/${bg}`);
      assert.ok(contrast(expense, t[bg]) >= 4.5, `expense-text/${bg}`);
    }
  });

  test(`M5: chữ trong đoạn làm nổi (--text) đọc được trên nền --primary 15%, kể cả khi hover; còn chữ --text-muted ngoài đoạn làm nổi vẫn ≥ 4.5 trên --surface (${mode})`, () => {
    for (const base of ['--surface', '--surface-2']) {
      const bg = blend(t['--primary'], t[base], 0.15);
      assert.ok(contrast(t['--text'], bg) >= 4.5, `text trên ${base}+15%: ${contrast(t['--text'], bg).toFixed(2)}`);
    }
  });

  test(`M5: viền ô nhập và nút Lọc đủ nhìn thấy khi focus / đang bật – --focus và --primary ≥ 3:1 với nền (${mode})`, () => {
    for (const fg of ['--focus', '--primary']) {
      assert.ok(contrast(t[fg], t['--surface']) >= 3, `${fg}/--surface`);
      assert.ok(contrast(t[fg], t['--bg']) >= 3, `${fg}/--bg`);
    }
  });
}

test('M5: các biểu tượng mới có trong bộ biểu tượng; trang khởi động nạp search.css sau tx-list.css/charts.css và gắn M5 vào M3', () => {
  assert.ok(hasIcon('search'));
  assert.ok(hasIcon('sliders-horizontal'));
  assert.ok(hasIcon('x'));
  const order = ['tokens.css', 'entry.css', 'home.css', 'tx-list.css', 'charts.css', 'search.css'].map((f) => indexHtml.indexOf(`src/styles/${f}`));
  assert.ok(order.every((n) => n >= 0), 'thiếu thẻ link');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'search.css nạp cuối: dùng keyframes của home.css, nút/chip của entry.css');
  assert.match(appJs, /mountSearch\(\{ repo, home \}\)/);
  assert.match(appJs, /mountTransactionList\(\{ repo, home, host: search\.listHost, filter: search\.filter \}\)/);
});

test('M5: bộ lọc chỉ áp lên danh sách — mã M5 không gọi vào thẻ tổng quan hay biểu đồ (DESIGN §9.2, PRD §4.4)', () => {
  const code = stripComments(searchJs);
  assert.doesNotMatch(code, /summarize\(|mountCharts|slots\.charts|__charts|chart-data/);
  assert.match(code, /repo\.listByMonth\(/, 'lọc trên dữ liệu của tháng đang xem');
});

/* ---------- M6: settings.css (DESIGN §10.2, §10.10, §8) ---------- */
const settingsCss = read('../src/styles/settings.css');
const settingsJs = read('../src/ui/settings.js');
const section102 = /## 10\.2 Cài đặt – màn hình menu chính \(F16\)([\s\S]*?)## 10\.3/.exec(design)[1];

test('settings.css và settings.js không dùng mã màu cứng; settings.css chỉ tham chiếu token đã khai báo', () => {
  const css = stripComments(settingsCss);
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(css.match(/\brgba?\(/g) ?? [], []);
  const used = new Set([...settingsCss.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((n) => !(n in allRootTokens)), []);
  assert.deepEqual(stripComments(settingsJs).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
});

test('M6: điện thoại — bảng trượt cao 90%, bo --radius-xl phía trên, nền --surface, --shadow-3, lớp phủ mờ và z-index theo §5', () => {
  assert.match(section102, /Bottom sheet cao 90%/);
  const p = rule(settingsCss, '.settings__panel');
  assert.match(p, /height: 90dvh/);
  assert.match(p, /border-radius: var\(--radius-xl\) var\(--radius-xl\) 0 0/);
  assert.match(p, /background: var\(--surface\)/);
  assert.match(p, /box-shadow: var\(--shadow-3\)/);
  assert.match(p, /z-index: var\(--z-dialog\)/);
  assert.match(p, /bottom: 0/);
  const root = rule(settingsCss, '.settings');
  assert.match(root, /z-index: var\(--z-scrim\)/, 'trên nút ＋ nổi (20), dưới toast (50)');
  assert.ok(Number(allRootTokens['--z-scrim']) > Number(allRootTokens['--z-fab']) && Number(allRootTokens['--z-scrim']) < Number(allRootTokens['--z-toast']));
  assert.match(rule(settingsCss, '.settings__scrim'), /background: var\(--scrim\)/);
  const grip = rule(settingsCss, '.settings__grip');
  assert.match(grip, /width: 36px/);
  assert.match(grip, /height: 4px/);
  assert.match(rule(settingsCss, '.settings__handle'), /touch-action: none/);
  assert.match(settingsCss, /html\.has-settings-open \{ overflow: hidden; \}/, 'khoá cuộn nền (§10.10)');
});

test('M6: laptop (≥ 640px) — hộp thoại bên phải rộng đúng số trong DESIGN, cao 100%, bo --radius-xl ở góc trái, không tay nắm', () => {
  const px = /Hộp thoại (\d+) px bên phải, cao 100% màn hình, bo `--radius-xl` ở góc trái/.exec(section102)[1];
  const wide = /@media \(min-width: 640px\) \{([\s\S]*?)\n\}/.exec(settingsCss)[1];
  assert.match(wide, new RegExp(`width: ${px}px`));
  assert.match(wide, /height: 100dvh/);
  assert.match(wide, /border-radius: var\(--radius-xl\) 0 0 var\(--radius-xl\)/);
  assert.match(wide, /right: 0/);
  assert.match(wide, /\.settings__handle \{ display: none; \}/);
  assert.match(wide, /\.st-body \{ padding: var\(--space-6\); \}/, 'lề trong 24px ở laptop');
  assert.match(rule(settingsCss, '.st-body'), /padding: var\(--space-4\)/, 'lề trong 16px ở điện thoại');
});

test('M6: tiêu đề bảng H1 20/28/600; thanh tiêu đề cao ≥ 56 nền --surface; nút ✕ / ‹ là nút 44×44', () => {
  const t = rule(settingsCss, '.st-title');
  assert.match(t, /font-size: var\(--fs-h1\)/);
  assert.match(t, /line-height: var\(--lh-h1\)/);
  assert.match(t, /font-weight: 600/);
  const head = rule(settingsCss, '.st-head');
  assert.match(head, /min-height: 56px/);
  assert.match(head, /background: var\(--surface\)/);
  assert.match(rule(settingsCss, '.st-head--sub'), /grid-template-columns: 44px 1fr 44px/);
  assert.match(entryCss, /\.icon-btn \{[^}]*width: 44px;[^}]*height: 44px/);
  assert.match(rule(settingsCss, '.st-page'), /background: var\(--bg\)/, 'nền trang trong bảng là --bg');
});

test('M6: nhãn nhóm 13/600 --text-muted, đệm ngang 4, cách nhóm trước 24, cách khối dưới 8 (DESIGN §10.2 (2))', () => {
  const l = rule(settingsCss, '.st-group__label');
  assert.match(l, /font-size: var\(--fs-small\)/);
  assert.match(l, /line-height: var\(--lh-small\)/);
  assert.match(l, /font-weight: 600/);
  assert.match(l, /color: var\(--text-muted\)/);
  assert.match(l, /padding: 0 var\(--space-1\)/);
  assert.match(l, /margin: 0 0 var\(--space-2\)/);
  assert.match(rule(settingsCss, '.st-group + .st-group'), /margin-top: var\(--space-6\)/);
  assert.doesNotMatch(settingsCss, /text-transform:\s*uppercase/, 'không in hoa toàn bộ câu tiếng Việt (§3)');
});

test('M6: khối nhóm — nền --surface, bo --radius-lg, viền 1px --border; hàng cách nhau bằng đường kẻ thụt trái 52px', () => {
  const c = rule(settingsCss, '.st-card');
  assert.match(c, /background: var\(--surface\)/);
  assert.match(c, /border: 1px solid var\(--border\)/);
  assert.match(c, /border-radius: var\(--radius-lg\)/);
  const inset = /thụt trái (\d+) px/.exec(section102)[1];
  const div = rule(settingsCss, '.st-item + .st-item::before');
  assert.match(div, new RegExp(`left: ${inset}px`));
  assert.match(div, /height: 1px/);
  assert.match(div, /background: var\(--border\)/);
  // 52 = đệm trái 16 + biểu tượng 20 + khoảng cách 16 → thẳng hàng với chữ
  const row = rule(settingsCss, '.st-row');
  assert.match(row, /padding: 0 var\(--space-4\)/);
  assert.match(row, /gap: var\(--space-4\)/);
  assert.match(rule(settingsCss, '.st-row__icon'), /width: 20px/);
  assert.equal(16 + 20 + 16, Number(inset));
});

test('M6: hàng điều hướng — cao 56, nhãn 15/400, biểu tượng 20 --text-muted, giá trị 15 --text-muted, mũi tên 20', () => {
  const row = rule(settingsCss, '.st-row');
  assert.match(row, /min-height: 56px/);
  assert.match(row, /font-size: var\(--fs-body\)/);
  assert.match(row, /font-weight: 400/);
  assert.match(row, /color: var\(--text\)/);
  assert.match(rule(settingsCss, '.st-row__icon'), /color: var\(--text-muted\)/);
  assert.match(rule(settingsCss, '.st-row__value'), /color: var\(--text-muted\)/);
  assert.match(rule(settingsCss, '.st-row__value'), /font-variant-numeric: tabular-nums/);
  assert.match(rule(settingsCss, '.st-row__chevron'), /width: 20px/);
  assert.match(rule(settingsCss, '.st-row:hover'), /background: var\(--surface-2\)/);
  assert.match(settingsJs, /createIcon\('chevron-right', 20\)/);
  assert.match(settingsJs, /createIcon\(icon, 20\)/);
});

test('M6: công tắc 48×28 — bật nền --primary nút tròn nền chữ-trên-primary; tắt nền --surface-2 + viền --border', () => {
  const sw = rule(settingsCss, '.st-switch');
  assert.match(sw, /width: 48px/);
  assert.match(sw, /height: 28px/);
  assert.match(sw, /background: var\(--surface-2\)/);
  assert.match(sw, /border: 1px solid var\(--border\)/);
  assert.match(sw, /border-radius: var\(--radius-full\)/);
  const on = rule(settingsCss, '.st-row--switch[aria-checked="true"] .st-switch');
  assert.match(on, /background: var\(--primary\)/);
  const knob = rule(settingsCss, '.st-row--switch[aria-checked="true"] .st-switch::after');
  assert.match(knob, /background: var\(--on-primary\)/);
  assert.match(knob, /translateX\(20px\)/, 'nút trượt hết đường: 46 (lòng) − 22 (nút) − 2 − 2 = 20');
  const off = rule(settingsCss, '.st-switch::after');
  assert.match(off, /width: 22px/);
  assert.match(off, /height: 22px/);
});

test('M6: segmented Giao diện — 3 mục, mục chọn nền --primary chữ --on-primary (không dùng màu thu/chi)', () => {
  assert.match(rule(settingsCss, '.st-seg'), /repeat\(3,/);
  const sel = rule(settingsCss, '.st-seg .segmented__btn[aria-checked="true"]');
  assert.match(sel, /background: var\(--primary\)/);
  assert.match(sel, /color: var\(--on-primary\)/);
  assert.doesNotMatch(settingsJs, /data-value/, 'tránh luật màu chi/thu của segmented ở M1');
  assert.match(settingsJs, /THEME_LABELS\[t\]/);
});

test('M6: chân trang 13/400 --text-muted căn giữa', () => {
  const f = rule(settingsCss, '.st-footer');
  assert.match(f, /font-size: var\(--fs-small\)/);
  assert.match(f, /font-weight: 400/);
  assert.match(f, /color: var\(--text-muted\)/);
  assert.match(f, /text-align: center/);
});

test('M6: trang con trượt ngang trong --dur-slow; tôn trọng prefers-reduced-motion (chỉ mờ dần ≤ 100ms)', () => {
  assert.match(rule(settingsCss, '.st-page'), /transition: transform var\(--dur-slow\) var\(--ease-out\)/);
  assert.match(rule(settingsCss, '.st-page.is-enter,\n.st-page.is-leaving'), /translateX\(100%\)/);
  assert.match(rule(settingsCss, '.st-page.is-behind'), /translateX\(-30%\)/);
  assert.match(rule(settingsCss, '.settings__panel'), /sheet-in var\(--dur-slow\) var\(--ease-out\)/);
  assert.match(settingsCss, /@keyframes st-dialog-in \{ from \{ transform: translateX\(100%\); \}/);
  const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\n\}/.exec(settingsCss)[1];
  assert.match(reduced, /fade-in 100ms linear/);
  assert.match(reduced, /transition: none/);
  assert.match(settingsJs, /const SLIDE_MS = 320;/, 'mốc gỡ trang trong JS khớp --dur-slow');
  assert.equal(allRootTokens['--dur-slow'], '320ms');
});

test('M6: đổi sáng/tối mượt 200ms (--dur-base) trên màu nền, chữ, viền (DESIGN §8); tắt khi giảm chuyển động', () => {
  assert.equal(allRootTokens['--dur-base'], '200ms');
  const fade = /html\.theme-fade,[\s\S]*?\{([\s\S]*?)\}/.exec(settingsCss)[1];
  for (const prop of ['background-color', 'border-color', 'color', 'fill', 'stroke']) assert.match(fade, new RegExp(`${prop} var\\(--dur-base\\)`));
  assert.match(fade, /!important/);
  const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\n\}/.exec(settingsCss)[1];
  assert.match(reduced, /html\.theme-fade[\s\S]*?transition: none !important/);
});

test('M6: có vòng focus 2px --focus; hàng trong khối bo góc dùng viền trong để không bị cắt', () => {
  assert.match(rule(settingsCss, '.settings :focus-visible'), /outline: 2px solid var\(--focus\)/);
  assert.match(rule(settingsCss, '.st-row:focus-visible'), /outline-offset: -2px/);
});

test('M6: cuộn trong thân trang, không kéo trang nền; chừa safe-area ở đáy', () => {
  const b = rule(settingsCss, '.st-body');
  assert.match(b, /overflow-y: auto/);
  assert.match(b, /overscroll-behavior: contain/);
  assert.match(b, /env\(safe-area-inset-bottom/);
});

for (const [mode, t] of [['sáng', light], ['tối', dark]]) {
  test(`M6: tương phản ≥ 4.5:1 – nhãn, giá trị, chân trang, nút chọn (${mode})`, () => {
    const pairs = [
      ['--text', '--surface'], ['--text', '--bg'], ['--text', '--surface-2'], // tiêu đề, nhãn hàng (kể cả khi rê chuột)
      ['--text-muted', '--surface'], ['--text-muted', '--bg'], ['--text-muted', '--surface-2'], // nhãn nhóm, giá trị, chân trang, biểu tượng
      ['--on-primary', '--primary'], // mục chọn của segmented
    ];
    for (const [fg, bg] of pairs) assert.ok(contrast(t[fg], t[bg]) >= 4.5, `${fg}/${bg}: ${contrast(t[fg], t[bg]).toFixed(2)}`);
  });

  test(`M6: công tắc đủ nhìn thấy (đồ hoạ ≥ 3:1) ở cả hai trạng thái (${mode})`, () => {
    assert.ok(contrast(t['--on-primary'], t['--primary']) >= 3, 'nút trên nền bật');
    assert.ok(contrast(t['--primary'], t['--surface']) >= 3, 'nền bật trên khối nhóm');
    assert.ok(contrast(t['--text-muted'], t['--surface-2']) >= 3, 'nút khi tắt trên nền tắt');
    assert.ok(contrast(t['--focus'], t['--surface']) >= 3, 'vòng focus');
  });
}

test('M6: chế độ sáng và tối dùng đúng cặp token §2 — data-theme="light"/"dark" và @media đều có, và tối KHÔNG phụ thuộc hệ thống khi chọn tay', () => {
  assert.match(tokensCss, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/, 'Theo hệ thống: tối chỉ khi chưa chọn Sáng');
  assert.match(tokensCss, /:root\[data-theme="dark"\]/);
  assert.deepEqual(darkMedia, darkAttr, 'chọn Tối tay = Tối theo hệ thống');
  for (const k of Object.keys(darkAttr)) assert.ok(k in light || k.startsWith('--'), k);
  assert.match(tokensCss, /color-scheme: light/);
  assert.match(tokensCss, /color-scheme: dark/);
});

test('M6: các biểu tượng cần có trong bộ biểu tượng; trang khởi động nạp settings.css cuối và gắn M6 vào nút ⚙', () => {
  for (const name of ['wallet', 'layout-grid', 'target', 'sliders-horizontal', 'database', 'wrench', 'chevron-right', 'chevron-left', 'x', 'settings']) assert.ok(hasIcon(name), name);
  const order = ['tokens.css', 'entry.css', 'home.css', 'tx-list.css', 'charts.css', 'search.css', 'settings.css'].map((f) => indexHtml.indexOf(`src/styles/${f}`));
  assert.ok(order.every((n) => n >= 0), 'thiếu thẻ link');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'settings.css nạp cuối: dùng keyframes của home.css, nút và segmented của entry.css');
  assert.match(appJs, /onOpenSettings: \(\) => settings\.open\(\)/);
  assert.match(appJs, /mountSettings\(\{ repo, home \}\)/);
});

test('M6: Cài đặt chỉ gọi vào những gì module trước đã cung cấp — không mount / không sửa M3, M4, M5; chỉ thêm vào kho dữ liệu (PRD §4.4)', () => {
  const code = stripComments(settingsJs);
  assert.doesNotMatch(code, /mountCharts|mountSearch|mountTransactionList|tx-list|chart-data|search-filter/);
  assert.match(code, /repo\.getSettings|repo\.updateSettings|repo\.subscribeSettings/);
});

test('M6: nội dung DESIGN §10.2 còn khớp mã — thứ tự nhóm, nhãn, chân trang', () => {
  const labels = ['Giao diện', 'Quản lý', 'Ngân sách', 'Dữ liệu'];
  const found = labels.map((l) => settingsJs.indexOf(`group('${l}'`));
  assert.ok(found.every((n) => n >= 0), 'thiếu nhóm');
  assert.deepEqual(found, [...found].sort((a, b) => a - b), 'sai thứ tự nhóm');
  for (const text of ['Ví', 'Danh mục', 'Bật ngân sách', 'Hạn mức theo danh mục', 'Sao lưu & khôi phục', 'Dữ liệu lưu trên thiết bị này']) assert.ok(section102.includes(text) || read('../src/core/app-info.js').includes(text), text);
  assert.match(section102, /Theo hệ thống \/ Sáng \/ Tối/);
  assert.match(section102, /công tắc 48×28/);
  assert.match(section102, /Cao 56/);
});
