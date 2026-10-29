// Bộ chọn tháng (DESIGN §10.3): bảng trượt ở điện thoại, popover ở laptop (CSS quyết định). Chọn xong đóng ngay.
import { el, focusableIn, trapTab, uid } from './dom.js';
import { createIcon } from './icons.js';
import { compareMonths, makeMonth, parseMonth } from '../core/months.js';

/**
 * @param {object} options
 * @param {HTMLElement} options.host         phần tử chứa (thường là gốc Trang chủ)
 * @param {HTMLElement} options.anchor       nút tên tháng: neo popover và nhận lại focus khi đóng
 * @param {object} options.monthState        core/month-state.js
 * @param {object} options.repo              dùng getMonthsWithData() để vẽ chấm "có dữ liệu"
 * @param {() => void} [options.onClose]
 */
export function createMonthPicker({ host, anchor, monthState, repo, onClose }) {
  const titleId = uid('month-picker');
  const root = el('div', { class: 'month-picker', hidden: true, 'data-month-picker': '' });
  const scrim = el('div', { class: 'month-picker__scrim' });
  const yearLabel = el('span', { class: 'mp__year-label', id: titleId, 'aria-live': 'polite' });
  const prevYear = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Năm trước', 'data-action': 'prev-year', onClick: () => shiftYear(-1) }, createIcon('chevron-left', 20));
  const nextYear = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Năm sau', 'data-action': 'next-year', onClick: () => shiftYear(1) }, createIcon('chevron-right', 20));
  const grid = el('div', { class: 'mp__grid', role: 'group', 'aria-labelledby': titleId });
  const todayBtn = el('button', { type: 'button', class: 'btn btn--text mp__today', 'data-action': 'this-month', text: 'Về tháng này', onClick: () => pick(monthState.latest()) });
  const panel = el(
    'div',
    { class: 'month-picker__panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Chọn tháng' },
    el('div', { class: 'mp__handle', 'aria-hidden': 'true' }),
    el('div', { class: 'mp__year' }, prevYear, yearLabel, nextYear),
    grid,
    todayBtn,
  );
  root.append(scrim, panel);
  host.append(root);

  let open = false;
  let viewYear = 0;
  let minYear = 0;
  let withData = new Set();

  const latestYear = () => parseMonth(monthState.latest()).year;

  function cellState(year, month) {
    const ym = makeMonth(year, month);
    return {
      ym,
      disabled: compareMonths(ym, monthState.latest()) > 0 || compareMonths(ym, monthState.min) < 0,
      selected: ym === monthState.get(),
      current: ym === monthState.latest(),
      hasData: withData.has(ym),
    };
  }

  function renderGrid() {
    yearLabel.textContent = String(viewYear);
    prevYear.disabled = viewYear <= minYear;
    nextYear.disabled = viewYear >= latestYear();
    grid.replaceChildren();
    for (let month = 1; month <= 12; month += 1) {
      const s = cellState(viewYear, month);
      const cell = el('button', {
        type: 'button',
        class: 'mp__cell',
        'data-month': s.ym,
        'aria-label': `Tháng ${month} năm ${viewYear}${s.hasData ? ', có giao dịch' : ''}`,
        'aria-pressed': String(s.selected),
        'aria-current': s.current ? 'date' : null,
        'data-has-data': s.hasData ? '' : null,
        disabled: s.disabled,
        tabindex: '-1',
        onClick: () => pick(s.ym),
      }, `T${month}`);
      grid.append(cell);
    }
    todayBtn.hidden = monthState.isCurrent();
    syncTabStop();
  }

  function enabledCells() {
    return [...grid.querySelectorAll('.mp__cell:not(:disabled)')];
  }

  function syncTabStop(preferred) {
    const cells = enabledCells();
    for (const c of grid.querySelectorAll('.mp__cell')) c.tabIndex = -1;
    const stop = preferred ?? cells.find((c) => c.getAttribute('aria-pressed') === 'true') ?? cells[0];
    if (stop) stop.tabIndex = 0;
  }

  function shiftYear(delta) {
    const next = viewYear + delta;
    if (next < minYear || next > latestYear()) return;
    viewYear = next;
    renderGrid();
  }

  function position() {
    if (!open) return;
    const r = anchor.getBoundingClientRect();
    root.style.setProperty('--mp-left', `${Math.max(8, Math.round(r.left))}px`);
    root.style.setProperty('--mp-top', `${Math.round(r.bottom + 4)}px`);
  }

  function pick(ym) {
    if (monthState.set(ym)) close();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      trapTab(e, panel);
      return;
    }
    const cell = e.target.closest?.('.mp__cell');
    if (!cell) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const cells = [...grid.querySelectorAll('.mp__cell')];
    const index = cells.indexOf(cell);
    let target = null;
    if (Math.abs(step) === 1) {
      // trái/phải: ô kế tiếp còn dùng được theo hướng đó
      for (let n = index + step; n >= 0 && n < cells.length; n += step) {
        if (!cells[n].disabled) {
          target = cells[n];
          break;
        }
      }
    } else if (cells[index + step] && !cells[index + step].disabled) {
      target = cells[index + step]; // lên/xuống: nhảy một hàng (3 ô)
    }
    if (target) {
      syncTabStop(target);
      target.focus();
    }
  }

  function onOutsidePointer(e) {
    if (!open) return;
    if (panel.contains(e.target) || anchor.contains(e.target)) return;
    close({ restoreFocus: false });
  }

  panel.addEventListener('keydown', onKeydown);
  scrim.addEventListener('pointerdown', () => close());

  function openPicker() {
    if (open) return;
    const months = repo.getMonthsWithData();
    withData = new Set(months);
    const selectedYear = parseMonth(monthState.get()).year;
    const earliest = months.length ? parseMonth(months[0]).year : latestYear();
    minYear = Math.max(parseMonth(monthState.min).year, Math.min(latestYear(), earliest, selectedYear));
    viewYear = selectedYear;
    open = true;
    root.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    renderGrid();
    position();
    document.addEventListener('pointerdown', onOutsidePointer, true);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true });
    (grid.querySelector('.mp__cell[tabindex="0"]') ?? focusableIn(panel)[0])?.focus({ preventScroll: true });
  }

  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false;
    root.hidden = true;
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position);
    if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
    onClose?.();
  }

  return {
    element: root,
    open: openPicker,
    close,
    toggle: () => (open ? close() : openPicker()),
    isOpen: () => open,
    destroy() {
      close({ restoreFocus: false });
      root.remove();
    },
  };
}
