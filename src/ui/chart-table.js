// Bảng số liệu thay thế cho từng biểu đồ (PRD §8 tiếp cận, DESIGN §10.9). Thu/Chi luôn có dấu +/− và tiêu đề cột,
// không chỉ dựa vào màu. Mỗi ô tiền có cả dạng đầy đủ và dạng rút gọn; CSS chọn dạng nào hiện theo bề rộng màn hình
// (dạng đầy đủ luôn còn trong DOM cho trình đọc màn hình).
import { el } from './dom.js';
import { formatCompactVND, formatVND } from '../core/money.js';
import { categoryColorVar } from '../core/defaults.js';
import { formatPercent } from '../core/chart-data.js';

const MINUS = '−';
const LONG_TEXT = 14; // chữ đầy đủ dài hơn mức này thì điện thoại hiện dạng rút gọn

/** "2026-10-07" -> "07/10" */
export const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function signFor(kind, value) {
  if (kind === 'income') return value > 0 ? '+' : '';
  if (kind === 'expense') return value > 0 ? MINUS : '';
  if (kind === 'balance') return value > 0 ? '+' : value < 0 ? MINUS : '';
  return '';
}

/** @param {'income'|'expense'|'balance'|'plain'} kind */
export function moneyCell(kind, value) {
  const abs = Math.abs(value);
  const sign = signFor(kind, value);
  const full = `${sign}${formatVND(abs)}`;
  const compact = `${sign}${formatCompactVND(abs)}`;
  const tone = kind === 'balance' ? (value < 0 ? 'expense' : 'plain') : kind;
  return el(
    'td',
    { class: `num num--${tone}${full.length > LONG_TEXT ? ' is-long' : ''}` },
    el('span', { class: 'num__full', text: full }),
    el('span', { class: 'num__compact', 'aria-hidden': 'true', text: compact }),
  );
}

const textCell = (text, className = 'num') => el('td', { class: className, text });
const rowHead = (...children) => el('th', { scope: 'row', class: 'row-head' }, ...children);

function buildTable({ labelledBy, heads, rows, foot, dense = false, emptyText = null }) {
  const headRow = el('tr', {}, heads.map((h, i) => el('th', { scope: 'col', class: i === 0 ? 'col-head' : 'col-head col-head--num', text: h })));
  const body = el('tbody', {}, rows);
  if (emptyText) body.append(el('tr', { class: 'chart-table__empty' }, el('td', { colspan: heads.length, text: emptyText })));
  const table = el('table', { class: `chart-table${dense ? ' chart-table--dense' : ''}`, 'aria-labelledby': labelledBy }, el('thead', {}, headRow), body);
  if (foot) table.append(el('tfoot', {}, el('tr', { class: 'chart-table__total' }, foot)));
  if (dense) {
    // Điện thoại: số rút gọn, chạm vào hàng để xem đầy đủ (DESIGN §10.9)
    body.addEventListener('click', (e) => {
      const tr = e.target.closest?.('tr');
      if (tr && !tr.classList.contains('chart-table__empty')) tr.classList.toggle('is-expanded');
    });
  }
  return table;
}

const TABLES = {
  week({ week }, labelledBy) {
    return buildTable({
      labelledBy,
      heads: ['Tuần', 'Thu', 'Chi'],
      rows: week.weeks.map((w) => el('tr', { 'data-row': w.index }, rowHead(`${w.index} (${w.range})`), moneyCell('income', w.income), moneyCell('expense', w.expense))),
      foot: [rowHead('Tổng'), moneyCell('income', week.totals.income), moneyCell('expense', week.totals.expense)],
    });
  },

  category({ category }, labelledBy) {
    const { slices, total } = category;
    return buildTable({
      labelledBy,
      heads: ['Danh mục', '%', 'Số tiền'],
      rows: slices.map((s) =>
        el('tr', { 'data-row': s.id },
          rowHead(el('span', { class: 'dot', style: `--cat-color: ${categoryColorVar(s.color)};`, 'aria-hidden': 'true' }), el('span', { class: 'row-name', text: s.name })),
          textCell(formatPercent(s)),
          moneyCell('plain', s.amount),
        ),
      ),
      foot: slices.length ? [rowHead('Tổng'), textCell('100%'), moneyCell('plain', total)] : null,
      emptyText: slices.length ? null : 'Chưa có khoản chi trong tháng này',
    });
  },

  day({ day }, labelledBy) {
    return buildTable({
      labelledBy,
      dense: true,
      heads: ['Ngày', 'Thu', 'Chi'],
      rows: day.days.map((d) => el('tr', { 'data-row': d.day }, rowHead(shortDate(d.date)), moneyCell('income', d.income), moneyCell('expense', d.expense))),
      foot: [rowHead('Tổng'), moneyCell('income', day.totals.income), moneyCell('expense', day.totals.expense)],
    });
  },

  balance({ balance }, labelledBy) {
    return buildTable({
      labelledBy,
      dense: true,
      heads: ['Ngày', 'Số dư luỹ kế'],
      rows: balance.points.map((p) => el('tr', { 'data-row': p.day }, rowHead(shortDate(p.date)), moneyCell('balance', p.balance))),
    });
  },
};

/** Vùng cuộn dọc bên trong khung biểu đồ, hàng tiêu đề dính đầu. kind: 'week' | 'category' | 'day' | 'balance'. */
export function buildChartTable(kind, model, { labelledBy, label }) {
  return el('div', { class: 'chart__table-wrap', role: 'region', tabindex: '0', 'aria-label': `Bảng số liệu: ${label}` }, TABLES[kind](model, labelledBy));
}
