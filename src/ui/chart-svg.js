// Vẽ SVG cho 3 kiểu biểu đồ của M4: cột đôi (Thu | Chi), vành khuyên, đường. DESIGN §2.3, §6.3.
// Mọi màu đi qua class (xem charts.css) hoặc biến CSS của danh mục; văn bản luôn qua textContent.
// Mỗi hàm trả về { setSelected(i), anchor(i), … } để lớp trên gắn tooltip mà không phải biết chi tiết hình vẽ.
import { axisLabel } from '../core/chart-data.js';
import { categoryColorVar } from '../core/defaults.js';

const NS = 'http://www.w3.org/2000/svg';

export const AXIS_WIDTH = 44; // cột nhãn trục dọc (cố định bên trái, không cuộn theo biểu đồ ngày)
export const CHART_HEIGHT = 172;
export const PLOT_TOP = 8; // chừa chỗ cho nhãn của vạch trên cùng
export const MIN_GROUP_WIDTH = 18; // bề rộng tối thiểu của một cột-nhóm; hẹp hơn thì biểu đồ ngày cuộn ngang
export const DONUT_SIZE = 136;
const DONUT_STROKE = 18;

const fx = (n) => Math.round(n * 100) / 100;

function node(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    n.setAttribute(k, v === true ? '' : String(v));
  }
  if (text !== undefined) n.textContent = text;
  return n;
}

/** Ngày nào được ghi nhãn trên trục ngang của biểu đồ ngày / số dư: 1, 5, 10, 15, … */
export const showDayLabel = (day) => day === 1 || day % 5 === 0;

function frame(scale, bottom) {
  const plotH = CHART_HEIGHT - PLOT_TOP - bottom;
  const span = scale.max - scale.min || 1;
  const y = (value) => PLOT_TOP + ((scale.max - value) / span) * plotH;
  return { plotH, y };
}

function axisSvg(scale, y) {
  const svg = node('svg', { class: 'chart-svg chart-axis', width: AXIS_WIDTH, height: CHART_HEIGHT, viewBox: `0 0 ${AXIS_WIDTH} ${CHART_HEIGHT}`, 'aria-hidden': 'true', focusable: 'false' });
  for (const tick of scale.ticks) svg.append(node('text', { class: 'chart-label chart-label--y', x: AXIS_WIDTH - 6, y: fx(y(tick) + 4.5), 'text-anchor': 'end' }, axisLabel(tick)));
  return svg;
}

function gridGroup(scale, y, width) {
  const g = node('g', { class: 'chart-grid' });
  for (const tick of scale.ticks) {
    g.append(node('line', { class: tick === 0 ? 'chart-grid__line chart-grid__zero' : 'chart-grid__line', x1: 0, x2: fx(width), y1: fx(y(tick)), y2: fx(y(tick)) }));
  }
  return g;
}

function plotSvg(width) {
  return node('svg', { class: 'chart-svg chart-plot', width: fx(width), height: CHART_HEIGHT, viewBox: `0 0 ${fx(width)} ${CHART_HEIGHT}`, 'aria-hidden': 'true', focusable: 'false' });
}

function barPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${fx(x)} ${fx(y + h)}V${fx(y + r)}Q${fx(x)} ${fx(y)} ${fx(x + r)} ${fx(y)}H${fx(x + w - r)}Q${fx(x + w)} ${fx(y)} ${fx(x + w)} ${fx(y + r)}V${fx(y + h)}Z`;
}

function selector(items) {
  let current = null;
  return (index) => {
    if (current !== null) items[current]?.classList.remove('is-selected');
    current = Number.isInteger(index) && index >= 0 && index < items.length ? index : null;
    if (current !== null) items[current].classList.add('is-selected');
  };
}

/**
 * Cột đôi: mỗi cột-nhóm có thanh Thu (trái) và thanh Chi (phải), đặt cạnh nhau, không chồng (DESIGN §2.3).
 * @param {{ income: number, expense: number, label?: string, sub?: string }[]} options.columns
 * @param {{ min: number, max: number, ticks: number[] }} options.scale  min phải là 0
 */
export function drawBars({ columns, scale, width, bottom = 32, animate = false }) {
  const { plotH, y } = frame(scale, bottom);
  const n = columns.length;
  const colW = n ? width / n : width;
  const pad = Math.max(2, colW * 0.16);
  const gap = 2;
  const barW = Math.max(2, Math.min(24, (colW - pad * 2 - gap) / 2));
  const x0 = (colW - (barW * 2 + gap)) / 2;
  const span = scale.max - scale.min || 1;
  const baseY = PLOT_TOP + plotH;

  const plot = plotSvg(width);
  if (animate) plot.classList.add('is-entering');
  const bands = columns.map((_, i) => node('rect', { class: 'chart-band', x: fx(i * colW), y: PLOT_TOP, width: fx(colW), height: plotH }));
  const bandLayer = node('g', { class: 'chart-bands' });
  bandLayer.append(...bands);
  plot.append(bandLayer, gridGroup(scale, y, width));

  const barsLayer = node('g', { class: 'chart-bars' });
  const labelsLayer = node('g', { class: 'chart-labels' });
  const hitsLayer = node('g', { class: 'chart-hits' });
  columns.forEach((col, i) => {
    const left = i * colW + x0;
    for (const [kind, offset] of [['income', 0], ['expense', barW + gap]]) {
      const value = col[kind];
      if (!(value > 0)) continue;
      const h = Math.max(2, ((value - scale.min) / span) * plotH);
      barsLayer.append(node('path', { class: `chart-bar chart-bar--${kind}`, d: barPath(left + offset, baseY - h, barW, h), 'data-kind': kind, 'data-value': value }));
    }
    const cx = i * colW + colW / 2;
    if (col.label) labelsLayer.append(node('text', { class: 'chart-label chart-label--x', x: fx(cx), y: baseY + 17, 'text-anchor': 'middle' }, col.label));
    if (col.sub) labelsLayer.append(node('text', { class: 'chart-label chart-label--x chart-label--sub', x: fx(cx), y: baseY + 31, 'text-anchor': 'middle' }, col.sub));
    hitsLayer.append(node('rect', { class: 'chart-hit', x: fx(i * colW), y: 0, width: fx(colW), height: CHART_HEIGHT, 'data-hit': i }));
  });
  plot.append(barsLayer, labelsLayer, hitsLayer);

  return {
    axis: axisSvg(scale, y),
    plot,
    count: n,
    width,
    colWidth: colW,
    setSelected: selector(bands),
    anchor: (i) => ({ x: i * colW + colW / 2, y: PLOT_TOP, placement: 'top' }),
  };
}

/**
 * Đường số dư luỹ kế: đường `--primary` 2 px, vùng tô mờ 12% giữa đường và vạch 0, vạch 0 màu `--border` (DESIGN §2.3).
 * @param {{ day: number, balance: number }[]} options.points  các ngày có dữ liệu (ngày 1…k)
 * @param {number} options.count  số ngày của cả tháng (quyết định bề rộng mỗi cột)
 */
export function drawLine({ points, count, scale, width, bottom = 22, animate = false }) {
  const { plotH, y } = frame(scale, bottom);
  const colW = width / Math.max(1, count);
  const px = (day) => (day - 0.5) * colW;
  const baseY = PLOT_TOP + plotH;

  const plot = plotSvg(width);
  if (animate) plot.classList.add('is-entering');
  const bands = Array.from({ length: count }, (_, i) => node('rect', { class: 'chart-band', x: fx(i * colW), y: PLOT_TOP, width: fx(colW), height: plotH }));
  const bandLayer = node('g', { class: 'chart-bands' });
  bandLayer.append(...bands);
  plot.append(bandLayer, gridGroup(scale, y, width));

  const coords = points.map((p) => [px(p.day), y(p.balance)]);
  if (coords.length >= 2) {
    const line = coords.map(([cx, cy], i) => `${i ? 'L' : 'M'}${fx(cx)} ${fx(cy)}`).join('');
    const zeroY = y(0);
    plot.append(
      node('path', { class: 'chart-area', d: `${line}L${fx(coords.at(-1)[0])} ${fx(zeroY)}L${fx(coords[0][0])} ${fx(zeroY)}Z` }),
      node('path', { class: 'chart-line', d: line, fill: 'none' }),
    );
  }

  const markers = Array.from({ length: count }, (_, i) => {
    const p = points[i];
    return p ? node('circle', { class: 'chart-marker chart-marker--sel', cx: fx(px(p.day)), cy: fx(y(p.balance)), r: 5 }) : node('g', { class: 'chart-marker-none' });
  });
  const markerLayer = node('g', { class: 'chart-markers' });
  markerLayer.append(...markers);
  if (coords.length) {
    const [lx, ly] = coords.at(-1);
    markerLayer.append(node('circle', { class: 'chart-marker chart-marker--last', cx: fx(lx), cy: fx(ly), r: 4 }));
  }
  const labelsLayer = node('g', { class: 'chart-labels' });
  for (let day = 1; day <= count; day += 1) {
    if (showDayLabel(day)) labelsLayer.append(node('text', { class: 'chart-label chart-label--x', x: fx(px(day)), y: baseY + 17, 'text-anchor': 'middle' }, String(day)));
  }
  const hitsLayer = node('g', { class: 'chart-hits' });
  points.forEach((p, i) => hitsLayer.append(node('rect', { class: 'chart-hit', x: fx(i * colW), y: 0, width: fx(colW), height: CHART_HEIGHT, 'data-hit': i })));
  plot.append(markerLayer, labelsLayer, hitsLayer);

  const select = selector(bands);
  return {
    axis: axisSvg(scale, y),
    plot,
    count,
    width,
    colWidth: colW,
    setSelected(i) {
      select(i);
      markers.forEach((m, k) => m.classList.toggle('is-selected', k === i));
    },
    anchor: (i) => ({ x: px(i + 1), y: PLOT_TOP, placement: 'top' }),
  };
}

/**
 * Vành khuyên chi theo danh mục. Mỗi miếng là một vòng tròn nét đứt (pathLength = 100) bắt đầu từ 12 giờ, chạy theo chiều kim đồng hồ.
 * @param {{ amount: number, color: string }[]} options.slices  đã sắp xếp; rỗng → chỉ vẽ vành trống
 */
export function drawDonut({ slices, size = DONUT_SIZE, animate = false }) {
  const stroke = DONUT_STROKE;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const total = slices.reduce((s, x) => s + x.amount, 0);
  const svg = node('svg', { class: 'chart-svg chart-donut', width: size, height: size, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true', focusable: 'false' });
  if (animate) svg.classList.add('is-entering');
  svg.append(node('circle', { class: 'chart-donut__track', cx: c, cy: c, r: fx(r), fill: 'none', 'stroke-width': stroke }));

  const arcs = [];
  let acc = 0;
  slices.forEach((s, i) => {
    const share = total ? (s.amount / total) * 100 : 0;
    const gap = slices.length > 1 ? Math.min(0.8, share * 0.3) : 0;
    const len = Math.max(0.2, share - gap);
    const arc = node('circle', {
      class: 'chart-slice',
      cx: c,
      cy: c,
      r: fx(r),
      fill: 'none',
      'stroke-width': stroke,
      pathLength: 100,
      'stroke-dasharray': `${fx(len)} ${fx(100 - len)}`,
      'stroke-dashoffset': fx(-acc),
      transform: `rotate(-90 ${c} ${c})`,
      style: `stroke: ${categoryColorVar(s.color)};`,
      'data-hit': i,
    });
    arcs.push(arc);
    svg.append(arc);
    acc += share;
  });

  const select = selector(arcs);
  return {
    plot: svg,
    count: slices.length,
    width: size,
    setSelected(i) {
      select(i);
      svg.classList.toggle('has-selection', Number.isInteger(i) && i >= 0 && i < arcs.length);
    },
    // Tooltip nằm ngay dưới vành (không che miếng đang chọn); x luôn là tâm vành
    anchor: () => ({ x: c, y: size - 12, placement: 'below' }),
  };
}
