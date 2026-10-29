// Biểu đồ tổng quan – module M4: carousel 4 biểu đồ (tuần → danh mục → ngày → số dư luỹ kế), chấm chỉ báo,
// tooltip khi chạm / rê chuột, và chế độ xem dạng bảng. PRD F8, F9; DESIGN §2.3, §6.3, §8, §10.9.
import { el, prefersReducedMotion, uid } from './dom.js';
import { createIcon } from './icons.js';
import { AXIS_WIDTH, DONUT_SIZE, MIN_GROUP_WIDTH, PLOT_TOP, drawBars, drawDonut, drawLine } from './chart-svg.js';
import { buildChartTable } from './chart-table.js';
import { balanceSeries, categoryData, dailyData, formatPercent, niceScale, weeklyData } from '../core/chart-data.js';
import { summarize } from '../core/summary.js';
import { fullDayLabel } from '../core/day-groups.js';
import { categoryColorVar } from '../core/defaults.js';
import { todayISO } from '../core/dates.js';
import { formatCompactVND, formatSignedVND, formatVND } from '../core/money.js';
import { formatMonthLabel } from '../core/months.js';

export const TABLE_MODE_KEY = 'sotc:charts-table';
const DEFAULT_WIDTH = 328; // bề rộng giả định khi chưa đo được (ví dụ chưa gắn vào trang)
const ENTER_CLEAR_MS = 700; // dài hơn hiệu ứng vẽ lâu nhất (600 ms): gỡ lớp is-entering để bật/tắt chế độ bảng không chạy lại hiệu ứng
const SCROLL_SETTLE_MS = 90; // chờ cuộn dừng hẳn rồi mới đổi chấm chỉ báo
const TIP_HALF = 120; // một nửa bề rộng tối đa của tooltip, dùng để không cho tràn mép
const DONUT_CENTER_MAX = 11; // tổng chi dài hơn mức này thì giữa vành dùng dạng rút gọn

const maxOf = (values) => values.reduce((m, v) => Math.max(m, v), 0);
const signedOrZero = (type, value) => (value > 0 ? formatSignedVND(type, value) : formatVND(0));
const balanceText = (value) => (value > 0 ? `+${formatVND(value)}` : formatVND(value));
const row = (label, value, tone = 'plain') => ({ label, value, tone });

/* ---------- 4 biểu đồ: cách vẽ, tooltip, nhãn đọc ---------- */
const SPECS = [
  {
    key: 'week',
    title: 'Thu & chi theo tuần',
    desc: 'Cột Thu và Chi của từng tuần trong tháng',
    legend: true,
    draw({ model, avail, animate }) {
      const { weeks } = model.week;
      const scale = niceScale(0, maxOf(weeks.flatMap((w) => [w.income, w.expense])));
      return drawBars({
        columns: weeks.map((w) => ({ income: w.income, expense: w.expense, label: w.label, sub: w.range })),
        scale,
        width: Math.max(avail - AXIS_WIDTH, 120),
        bottom: 36,
        animate,
      });
    },
    tip(model, i) {
      const w = model.week.weeks[i];
      return w && { title: `${w.label} (${w.range})`, rows: [row('Thu', signedOrZero('income', w.income), 'income'), row('Chi', signedOrZero('expense', w.expense), 'expense')] };
    },
    summary: (m) => `Tổng thu ${formatVND(m.week.totals.income)}, tổng chi ${formatVND(m.week.totals.expense)}`,
  },
  {
    key: 'category',
    title: 'Chi theo danh mục',
    desc: 'Tỷ lệ các khoản chi trong tháng',
    draw: ({ model, animate }) => drawDonut({ slices: model.category.slices, animate }),
    tip(model, i) {
      const s = model.category.slices[i];
      return s && { title: s.name, rows: [row('Chi', formatSignedVND('expense', s.amount), 'expense'), row('Tỷ lệ', formatPercent(s))] };
    },
    summary(m) {
      const { total, slices } = m.category;
      return slices.length ? `Tổng chi ${formatVND(total)}, nhiều nhất là ${slices[0].name} ${formatPercent(slices[0])}` : 'Chưa có khoản chi';
    },
  },
  {
    key: 'day',
    title: 'Thu & chi theo ngày',
    desc: 'Cột Thu và Chi của từng ngày trong tháng',
    legend: true,
    scrolls: true,
    draw({ model, avail, animate }) {
      const { days } = model.day;
      const scale = niceScale(0, maxOf(days.flatMap((d) => [d.income, d.expense])));
      return drawBars({
        columns: days.map((d) => ({ income: d.income, expense: d.expense, label: d.day === 1 || d.day % 5 === 0 ? String(d.day) : '' })),
        scale,
        width: Math.max(avail - AXIS_WIDTH, days.length * MIN_GROUP_WIDTH),
        bottom: 22,
        animate,
      });
    },
    tip(model, i) {
      const d = model.day.days[i];
      return d && { title: fullDayLabel(d.date), rows: [row('Thu', signedOrZero('income', d.income), 'income'), row('Chi', signedOrZero('expense', d.expense), 'expense')] };
    },
    /** Ngày cần hiện sẵn khi biểu đồ phải cuộn: hôm nay nếu đang xem tháng hiện tại. */
    focus: (model) => (model.isCurrent ? model.todayDay - 1 : 0),
    summary: (m) => `Tổng thu ${formatVND(m.day.totals.income)}, tổng chi ${formatVND(m.day.totals.expense)}`,
  },
  {
    key: 'balance',
    title: 'Số dư luỹ kế',
    desc: 'Thu trừ chi, cộng dồn theo ngày',
    draw({ model, avail, animate }) {
      const { points, daysInMonth } = model.balance;
      const values = points.map((p) => p.balance);
      const scale = niceScale(Math.min(0, ...values), maxOf(values));
      return drawLine({ points, count: daysInMonth, scale, width: Math.max(avail - AXIS_WIDTH, 120), animate });
    },
    tip(model, i) {
      const p = model.balance.points[i];
      return p && { title: fullDayLabel(p.date), rows: [row('Số dư luỹ kế', balanceText(p.balance), p.balance < 0 ? 'expense' : 'plain')] };
    },
    summary(m) {
      const last = m.balance.points.at(-1);
      return last ? `Số dư cuối kỳ ${balanceText(last.balance)}` : 'Chưa có số liệu';
    },
  },
];

function safeSessionStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {object} options
 * @param {object} options.repo
 * @param {object} [options.home]        kết quả của mountHome (M2): lấy host = home.slots.charts và month = home.month
 * @param {HTMLElement} [options.host]
 * @param {object} [options.month]       trạng thái tháng (core/month-state.js)
 * @param {() => Date} [options.now]
 * @param {boolean} [options.animate]    false để tắt hiệu ứng (kiểm thử)
 * @param {boolean} [options.tableMode]  chế độ ban đầu; mặc định đọc từ sessionStorage ("nhớ cho phiên hiện tại")
 * @param {Storage} [options.storage]    nơi nhớ chế độ bảng (mặc định sessionStorage nếu dùng được)
 * @param {(index: number, key: string) => void} [options.onChartChange]
 */
export function mountCharts(options) {
  const { repo, home, now = () => new Date(), animate = true, onChartChange } = options;
  const host = options.host ?? home?.slots.charts;
  const month = options.month ?? home?.month;
  if (!host || !month) throw new Error('mountCharts cần host và month (hoặc home).');
  const storage = options.storage === undefined ? safeSessionStorage() : options.storage;
  const motion = () => animate && !prefersReducedMotion();

  let destroyed = false;
  let active = 0;
  let model = null;
  let tableMode = false;
  let settleTimer = null;
  let resizeFrame = 0;
  let lastWidth = 0;

  try {
    tableMode = options.tableMode ?? storage?.getItem(TABLE_MODE_KEY) === '1';
  } catch {
    tableMode = !!options.tableMode;
  }

  /* ---------- dữ liệu ---------- */
  function computeModel() {
    const ym = month.get();
    const today = todayISO(now());
    const txs = repo.listByMonth(ym);
    return {
      ym,
      today,
      isCurrent: today.startsWith(`${ym}-`),
      todayDay: Number(today.slice(8, 10)),
      summary: summarize(txs),
      week: weeklyData(txs, ym),
      category: categoryData(txs, repo.getCategories()),
      day: dailyData(txs, ym),
      balance: balanceSeries(txs, ym, { today }),
    };
  }

  /* ---------- dựng khung ---------- */
  function buildSlide(spec, index) {
    const titleId = uid('chart-title');
    const toggle = el('button', {
      type: 'button',
      class: 'icon-btn chart__toggle',
      'aria-label': 'Xem dạng bảng',
      'aria-pressed': 'false',
      'data-action': 'toggle-table',
      onClick: () => setTableMode(!tableMode),
    });
    const legend = spec.legend
      ? el('ul', { class: 'chart-legend' },
          el('li', {}, el('span', { class: 'chart-legend__swatch chart-legend__swatch--income', 'aria-hidden': 'true' }), 'Thu'),
          el('li', {}, el('span', { class: 'chart-legend__swatch chart-legend__swatch--expense', 'aria-hidden': 'true' }), 'Chi'),
        )
      : null;
    const plot = el('div', { class: 'chart__plot' });
    const view = el('div', { class: 'chart__view', role: 'group' }, legend, plot);
    const body = el('div', { class: 'chart__body' }, view);
    const root = el('article',
      { class: 'chart', id: uid('chart'), role: 'tabpanel', 'aria-roledescription': 'slide', 'aria-labelledby': titleId, 'data-chart': spec.key },
      el('header', { class: 'chart__head' },
        el('div', { class: 'chart__titles' }, el('h2', { class: 'chart__title', id: titleId, text: spec.title }), el('p', { class: 'chart__desc', text: spec.desc })),
        toggle,
      ),
      body,
    );
    const slide = { spec, index, root, body, view, plot, toggle, titleId, tableWrap: null, tip: null, result: null, hover: null, pinned: null, pendingEnter: true, scroller: null };

    plot.addEventListener('click', (e) => {
      const i = hitIndex(e);
      if (i === null) return;
      slide.hover = null;
      slide.pinned = slide.pinned === i ? null : i;
      applySelection(slide);
    });
    plot.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return; // cảm ứng chỉ dùng "chạm" (click), không có rê
      const i = hitIndex(e);
      if (i === null || i === slide.hover) return;
      slide.hover = i;
      applySelection(slide);
    });
    plot.addEventListener('pointerleave', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (slide.hover === null) return;
      slide.hover = null;
      applySelection(slide);
    });
    return slide;
  }

  function hitIndex(event) {
    const target = event.target?.closest?.('[data-hit]');
    if (!target) return null;
    const i = Number(target.getAttribute('data-hit'));
    return Number.isInteger(i) ? i : null;
  }

  const slides = SPECS.map(buildSlide);
  const track = el('div', { class: 'charts__track' }, slides.map((s) => s.root));
  const prevBtn = el('button', { type: 'button', class: 'icon-btn charts__nav charts__nav--prev', 'aria-label': 'Biểu đồ trước', 'data-action': 'prev-chart', onClick: () => goTo(active - 1) }, createIcon('chevron-left', 24));
  const nextBtn = el('button', { type: 'button', class: 'icon-btn charts__nav charts__nav--next', 'aria-label': 'Biểu đồ sau', 'data-action': 'next-chart', onClick: () => goTo(active + 1) }, createIcon('chevron-right', 24));
  const dots = slides.map((s, i) =>
    el('button',
      {
        type: 'button',
        class: 'charts__dot',
        role: 'tab',
        'aria-controls': s.root.id,
        'aria-label': `Biểu đồ ${i + 1} trên ${SPECS.length}: ${s.spec.title}`,
        'data-dot': i,
        onClick: () => goTo(i),
      },
      el('span', { class: 'charts__pip', 'aria-hidden': 'true' }),
    ),
  );
  const dotBar = el('div', { class: 'charts__dots', role: 'tablist', 'aria-label': 'Chọn biểu đồ' }, dots);
  const status = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const root = el('section',
    { class: 'charts', 'aria-roledescription': 'carousel', role: 'region', 'data-charts': '' },
    el('div', { class: 'charts__stage' }, prevBtn, track, nextBtn),
    dotBar,
    status,
  );

  /* ---------- vẽ ---------- */
  function fillTip(tip, data) {
    tip.replaceChildren(
      el('div', { class: 'chart-tip__title', text: data.title }),
      ...data.rows.map((r) => el('div', { class: 'chart-tip__row' }, el('span', { class: 'chart-tip__label', text: r.label }), el('span', { class: `chart-tip__value chart-tip__value--${r.tone}`, text: r.value }))),
    );
  }

  function placeTip(slide, anchor) {
    const tip = slide.tip;
    const width = slide.result.width;
    const half = Math.min(TIP_HALF, width / 2);
    const left = Math.min(Math.max(anchor.x, half), Math.max(width - half, half));
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(anchor.placement === 'top' ? PLOT_TOP + 4 : anchor.placement === 'below' ? anchor.y + 14 : anchor.y - 8)}px`;
    tip.dataset.placement = anchor.placement;
    tip.hidden = false;
  }

  /** Hiện tooltip và tô sáng phần tử đang rê (ưu tiên) hoặc đang chạm giữ. */
  function applySelection(slide) {
    const { result, tip } = slide;
    if (!result || !tip) return;
    const index = slide.hover ?? slide.pinned;
    const data = index === null || !model ? null : slide.spec.tip(model, index);
    if (!data) {
      result.setSelected(null);
      tip.hidden = true;
      return;
    }
    result.setSelected(index);
    fillTip(tip, data);
    placeTip(slide, result.anchor(index));
  }

  function clearSelections() {
    for (const s of slides) {
      if (s.hover === null && s.pinned === null) continue;
      s.hover = null;
      s.pinned = null;
      applySelection(s);
    }
  }

  function buildDonutLayout(slide, result) {
    const { total, slices } = model.category;
    const centerText = formatVND(total).length > DONUT_CENTER_MAX ? formatCompactVND(total) : formatVND(total);
    const tip = el('div', { class: 'chart-tip', hidden: true, 'aria-hidden': 'true' });
    const ring = el('div', { class: 'donut__ring', style: `width:${DONUT_SIZE}px;height:${DONUT_SIZE}px;` },
      result.plot,
      el('div', { class: 'donut__center', 'aria-hidden': 'true' }, el('span', { class: 'donut__label', text: 'Tổng chi' }), el('span', { class: 'donut__total', text: centerText })),
      tip,
    );
    const legend = slices.length
      ? el('ul', { class: 'donut__legend' }, slices.map((s) =>
          el('li', { class: 'donut__item', 'data-slice': s.id },
            el('span', { class: 'dot', style: `--cat-color: ${categoryColorVar(s.color)};`, 'aria-hidden': 'true' }),
            el('span', { class: 'donut__name', text: s.name }),
            el('span', { class: 'donut__pct', text: formatPercent(s) }),
            el('span', { class: 'donut__amount' },
              el('span', { class: 'num__full', text: formatVND(s.amount) }),
              el('span', { class: 'num__compact', 'aria-hidden': 'true', text: formatCompactVND(s.amount) }),
            ),
          )))
      : el('p', { class: 'donut__empty', text: 'Chưa có khoản chi trong tháng này' });
    slide.tip = tip;
    slide.scroller = null;
    return el('div', { class: 'donut' }, ring, legend);
  }

  function buildCartesianLayout(slide, result, avail) {
    const tip = el('div', { class: 'chart-tip', hidden: true, 'aria-hidden': 'true' });
    const wrap = el('div', { class: 'chart__wrap', style: `width:${Math.round(result.width)}px;` }, result.plot, tip);
    const scroller = el('div', { class: 'chart__scroll' }, wrap);
    if (result.width > avail - AXIS_WIDTH + 1) {
      scroller.setAttribute('tabindex', '0');
      scroller.setAttribute('role', 'group');
      scroller.setAttribute('aria-label', 'Biểu đồ có thể cuộn ngang');
    }
    slide.tip = tip;
    slide.scroller = scroller;
    return el('div', { class: 'chart__cartesian' }, result.axis, scroller);
  }

  function renderSlide(slide, { enter = false, recenter = false } = {}) {
    const { spec } = slide;
    const avail = slide.body.clientWidth || DEFAULT_WIDTH;
    // vẽ lại vì dữ liệu / bề rộng đổi (không phải đổi tháng) thì giữ nguyên chỗ người dùng đang cuộn
    const keepLeft = recenter ? 0 : (slide.scroller?.scrollLeft ?? 0);
    const keepTop = recenter ? 0 : (slide.tableWrap?.scrollTop ?? 0);
    const result = spec.draw({ model, avail, animate: enter && motion() });
    slide.result = result;
    if (enter && motion()) setTimeout(() => result.plot.classList.remove('is-entering'), ENTER_CLEAR_MS);
    slide.plot.replaceChildren(result.axis ? buildCartesianLayout(slide, result, avail) : buildDonutLayout(slide, result));
    slide.view.setAttribute('aria-label', `${spec.title}. ${spec.summary(model)}. Dùng nút Xem dạng bảng để đọc từng số liệu.`);

    const table = buildChartTable(spec.key, model, { labelledBy: slide.titleId, label: spec.title });
    table.hidden = !tableMode;
    if (slide.tableWrap) slide.tableWrap.replaceWith(table);
    else slide.body.append(table);
    slide.tableWrap = table;
    if (keepTop) table.scrollTop = keepTop;
    if (keepLeft && slide.scroller) slide.scroller.scrollLeft = keepLeft;

    if (recenter && slide.scroller && spec.focus && slide.scroller.scrollWidth > slide.scroller.clientWidth) {
      const colW = result.colWidth;
      slide.scroller.scrollLeft = Math.max(0, (spec.focus(model) + 0.5) * colW - slide.scroller.clientWidth / 2);
    }
    if (slide.hover !== null && slide.hover >= result.count) slide.hover = null;
    if (slide.pinned !== null && slide.pinned >= result.count) slide.pinned = null;
    applySelection(slide);
  }

  function attach() {
    if (root.parentNode !== host) host.replaceChildren(root);
  }

  /** Khung cao đúng bằng biểu đồ đang xem (vành khuyên + chú giải cao hơn các biểu đồ khác). */
  function syncHeight() {
    const h = slides[active].root.offsetHeight;
    if (h > 0) track.style.height = `${h}px`;
  }

  /**
   * @param {'init'|'month'|'data'|'resize'} reason
   * init/month: vẽ lại có hiệu ứng "mọc" cho biểu đồ đang xem (các biểu đồ khác vẽ hiệu ứng khi vuốt tới);
   * data/resize: vẽ lại ngay, không hiệu ứng.
   */
  function update(reason) {
    if (destroyed) return;
    if (repo.count() === 0) {
      model = null;
      root.remove(); // lần đầu chưa có gì: Trang chủ (M2) hiện trạng thái trống thay cho biểu đồ
      return;
    }
    attach();
    model = computeModel();
    root.setAttribute('aria-label', `Biểu đồ ${formatMonthLabel(model.ym).toLowerCase()}`);
    const fresh = reason === 'init' || reason === 'month';
    if (reason === 'month') {
      for (const s of slides) {
        s.hover = null;
        s.pinned = null;
      }
      if (motion()) {
        root.classList.remove('is-updating');
        void root.offsetWidth; // chạy lại hiệu ứng mờ dần
        root.classList.add('is-updating');
      }
    }
    for (const s of slides) {
      if (fresh) s.pendingEnter = true;
      const enter = fresh && s.index === active;
      if (enter) s.pendingEnter = false;
      renderSlide(s, { enter, recenter: fresh });
    }
    lastWidth = track.clientWidth;
    syncHeight();
  }

  /* ---------- carousel ---------- */
  function applyActive() {
    slides.forEach((s, i) => {
      const on = i === active;
      s.root.toggleAttribute('inert', !on);
      s.root.setAttribute('aria-hidden', String(!on));
      dots[i].setAttribute('aria-selected', String(on));
      dots[i].tabIndex = on ? 0 : -1;
      dots[i].classList.toggle('is-active', on);
    });
    prevBtn.disabled = active === 0;
    nextBtn.disabled = active === slides.length - 1;
  }

  function setActive(index) {
    const next = Math.min(slides.length - 1, Math.max(0, Math.round(Number(index) || 0)));
    if (next === active) return;
    const hadFocus = slides[active].root.contains(document.activeElement);
    active = next;
    clearSelections();
    applyActive();
    if (hadFocus) slides[active].toggle.focus({ preventScroll: true }); // biểu đồ cũ vừa bị inert: giữ tiêu điểm trong carousel để ← → còn dùng được
    const slide = slides[active];
    if (slide.pendingEnter) {
      slide.pendingEnter = false;
      if (motion() && model) renderSlide(slide, { enter: true, recenter: true });
    }
    syncHeight();
    status.textContent = `${slide.spec.title}, biểu đồ ${active + 1} trên ${slides.length}`;
    onChartChange?.(active, slide.spec.key);
  }

  function scrollToActive() {
    const left = active * track.clientWidth;
    if (typeof track.scrollTo === 'function') track.scrollTo({ left, behavior: motion() ? 'smooth' : 'auto' });
    else track.scrollLeft = left;
  }

  function goTo(index) {
    setActive(index);
    scrollToActive();
  }

  /** Cuộn dừng → biểu đồ nằm trọn trong khung là biểu đồ đang xem. */
  function onScroll() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const w = track.clientWidth;
      if (destroyed || !w) return;
      setActive(Math.round(track.scrollLeft / w));
    }, SCROLL_SETTLE_MS);
  }
  track.addEventListener('scroll', onScroll, { passive: true });

  const canScroll = (scroller, dir) => (dir < 0 ? scroller.scrollLeft > 0 : scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);

  root.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      clearSelections();
      return;
    }
    const inDots = dotBar.contains(e.target);
    if (inDots && (e.key === 'Home' || e.key === 'End')) {
      e.preventDefault();
      goTo(e.key === 'Home' ? 0 : slides.length - 1);
      dots[active].focus();
      return;
    }
    const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!dir) return;
    const scroller = e.target.closest?.('.chart__scroll');
    if (scroller && canScroll(scroller, dir)) return; // biểu đồ ngày còn chỗ cuộn: để trình duyệt cuộn trước
    e.preventDefault();
    goTo(active + dir);
    if (inDots) dots[active].focus();
  });

  // Chạm ra ngoài phần tử biểu đồ thì bỏ tooltip đang giữ
  const onOutsidePointer = (e) => {
    if (!e.target?.closest?.('[data-hit]')) clearSelections();
  };
  document.addEventListener('pointerdown', onOutsidePointer, true);

  /* ---------- xem dạng bảng (nhớ cho phiên hiện tại) ---------- */
  function applyMode() {
    for (const s of slides) {
      s.view.hidden = tableMode;
      if (s.tableWrap) s.tableWrap.hidden = !tableMode;
      s.toggle.setAttribute('aria-pressed', String(tableMode));
      s.toggle.title = tableMode ? 'Xem biểu đồ' : 'Xem dạng bảng';
      s.toggle.replaceChildren(createIcon(tableMode ? 'bar-chart-3' : 'table', 24));
    }
    root.dataset.view = tableMode ? 'table' : 'chart';
  }

  function setTableMode(flag) {
    const next = !!flag;
    if (next === tableMode) return;
    tableMode = next;
    try {
      storage?.setItem(TABLE_MODE_KEY, next ? '1' : '0');
    } catch {
      /* không lưu được thì chỉ nhớ trong lần mở này */
    }
    clearSelections();
    applyMode();
    syncHeight();
  }

  /* ---------- sự kiện ngoài ---------- */
  const unsubRepo = repo.subscribe(() => update('data'));
  const unsubMonth = month.subscribe(() => update('month'));

  const onResize = () => {
    globalThis.cancelAnimationFrame?.(resizeFrame);
    resizeFrame = (globalThis.requestAnimationFrame ?? ((f) => setTimeout(f, 16)))(() => {
      const w = track.clientWidth;
      if (destroyed || !w || w === lastWidth) return;
      lastWidth = w;
      scrollToActiveInstant();
      update('resize');
    });
  };
  function scrollToActiveInstant() {
    track.scrollLeft = active * track.clientWidth;
  }
  let observer = null;
  if (typeof globalThis.ResizeObserver === 'function') {
    observer = new globalThis.ResizeObserver(() => {
      syncHeight();
      onResize();
    });
    observer.observe(track);
    for (const s of slides) observer.observe(s.root); // chiều cao đổi (đổi phông, đổi chế độ bảng…) thì khung theo kịp
  } else {
    window.addEventListener('resize', onResize);
  }

  /* ---------- khởi tạo ---------- */
  applyActive();
  applyMode();
  update('init');

  return {
    element: root,
    /** Vẽ lại theo dữ liệu hiện tại (và theo ngày hôm nay). */
    refresh: () => update('data'),
    goTo,
    next: () => goTo(active + 1),
    prev: () => goTo(active - 1),
    getActive: () => active,
    count: slides.length,
    isTableMode: () => tableMode,
    setTableMode,
    clearSelection: clearSelections,
    /** Dữ liệu đã gộp của tháng đang xem (null khi chưa có giao dịch nào). */
    getModel: () => model,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(settleTimer);
      globalThis.cancelAnimationFrame?.(resizeFrame);
      unsubRepo();
      unsubMonth();
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerdown', onOutsidePointer, true);
      root.remove();
    },
  };
}
