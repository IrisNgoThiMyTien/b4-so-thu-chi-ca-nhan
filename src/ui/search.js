// Tìm kiếm & lọc – module M5: ô tìm (theo ghi chú), nút Lọc + huy hiệu, bảng lọc (bảng trượt ở điện thoại,
// popover ở laptop), hàng chip bộ lọc đang bật, thanh tóm tắt kết quả, trạng thái "không tìm thấy".
// DESIGN §6.4, §9.2, §10.4. Bộ lọc chỉ tác động lên DANH SÁCH (qua `filter` đưa cho M3), không đổi thẻ tổng quan và biểu đồ.
import { el, focusableIn, trapTab, uid } from './dom.js';
import { createIcon } from './icons.js';
import { categoryColorVar } from '../core/defaults.js';
import { groupDigits } from '../core/money.js';
import {
  FILTER_TYPES,
  MAX_QUERY_LENGTH,
  TYPE_LABELS,
  applyCriteria,
  cleanQuery,
  countFilters,
  describeChips,
  emptyCriteria,
  findRanges,
  formatNet,
  hasCriteria,
  netTone,
  normalizeCriteria,
  parseQuery,
  pruneCriteria,
  sameCriteria,
  summarizeResults,
  toggleId,
  withType,
} from '../core/search-filter.js';

export const DEBOUNCE_MS = 200; // DESIGN §10.4: lọc sau khi ngừng gõ 200 ms
const POPOVER_WIDTH = 360; // DESIGN §10.4: popover 360 px ở laptop
const WIDE_QUERY = '(min-width: 640px)';
const NO_RESULT = 'Không tìm thấy khoản nào';
const count = (n) => groupDigits(n); // 1250 → "1.250"

function defaultIsWide() {
  try {
    return !!globalThis.matchMedia && globalThis.matchMedia(WIDE_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * @param {object} options
 * @param {object} options.repo
 * @param {object} [options.home]              kết quả của mountHome (M2): lấy host/month/element từ đây
 * @param {HTMLElement} [options.host]         nơi gắn khối tìm/lọc (mặc định home.slots.list)
 * @param {object} [options.month]             trạng thái tháng (mặc định home.month)
 * @param {HTMLElement} [options.panelHost]    nơi gắn bảng lọc (mặc định home.element)
 * @param {number} [options.debounceMs]        độ trễ lọc khi gõ (mặc định 200)
 * @param {() => boolean} [options.isWide]     đang ở bố cục laptop (≥ 640px)? mặc định đọc matchMedia
 * @param {(criteria) => void} [options.onChange]
 * @returns {{ element, listHost, filter, ... }}  `listHost` là ô để M3 vẽ danh sách; `filter` đưa cho mountTransactionList
 */
export function mountSearch(options) {
  const { repo, home, debounceMs = DEBOUNCE_MS, isWide = defaultIsWide, onChange } = options;
  const host = options.host ?? home?.slots.list;
  const month = options.month ?? home?.month;
  const panelHost = options.panelHost ?? home?.element ?? document.body;
  if (!host || !month) throw new Error('mountSearch cần host và month (hoặc home).');

  let applied = emptyCriteria();
  let parsed = null;
  let draft = emptyCriteria(); // điều đang hiện trong bảng lọc (điện thoại: chưa áp dụng cho tới khi bấm "Xem N kết quả")
  let monthList = [];
  let monthDirty = true;
  let results = [];
  let panelOpen = false;
  let destroyed = false;
  let composing = false;
  let debounceTimer = null;
  let builtCategories = '';
  let builtWallets = '';
  const listeners = new Set();

  const ids = { field: uid('search-input'), panel: uid('filter-panel'), title: uid('filter-title'), type: uid('filter-type'), cats: uid('filter-cats'), wallets: uid('filter-wallets') };

  /* ================================================================== */
  /* Thanh công cụ: ô tìm + nút Lọc                                      */
  /* ================================================================== */
  const input = el('input', {
    type: 'search',
    class: 'search__input',
    id: ids.field,
    placeholder: 'Tìm ghi chú…',
    'aria-label': 'Tìm theo ghi chú',
    inputmode: 'search',
    enterkeyhint: 'search',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    maxlength: String(MAX_QUERY_LENGTH),
    'data-search-input': '',
  });
  const clearQueryBtn = el('button', { type: 'button', class: 'search__clear', hidden: true, 'aria-label': 'Xoá từ khoá', 'data-action': 'clear-query' }, createIcon('x', 20));
  const field = el('div', { class: 'search__field' }, el('span', { class: 'search__icon', 'aria-hidden': 'true' }, createIcon('search', 20)), input, clearQueryBtn);

  const badge = el('span', { class: 'search__badge', hidden: true, 'aria-hidden': 'true', 'data-badge': '' });
  const filterBtn = el(
    'button',
    { type: 'button', class: 'search__filter', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': ids.panel, 'aria-label': 'Bộ lọc', 'data-action': 'open-filter' },
    createIcon('sliders-horizontal', 20),
    el('span', { class: 'search__filter-text', text: 'Lọc', 'aria-hidden': 'true' }),
    badge,
  );
  const bar = el('div', { class: 'search__bar', role: 'search', 'aria-label': 'Tìm và lọc giao dịch' }, field, filterBtn);

  const chipList = el('ul', { class: 'search__chips', hidden: true, 'aria-label': 'Bộ lọc đang bật', 'data-chips': '' });
  const summaryCount = el('span', { class: 'search__count' });
  const summaryNet = el('span', { class: 'search__net' });
  const summary = el('p', { class: 'search__summary', hidden: true, 'data-summary': '' }, summaryCount, ' · ', summaryNet);
  const live = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const head = el('div', { class: 'search__head' }, bar, chipList, summary, live);

  const emptyClear = el('button', { type: 'button', class: 'btn btn--secondary', 'data-action': 'clear-all', text: 'Xoá bộ lọc' });
  const empty = el(
    'div',
    { class: 'search__empty', hidden: true, 'data-search-empty': '' },
    el('span', { class: 'search__empty-art', 'aria-hidden': 'true' }, createIcon('search', 28)),
    el('p', { class: 'search__empty-title', text: NO_RESULT }),
    emptyClear,
  );
  const listHost = el('div', { class: 'search__list', 'data-list-host': '' });
  const root = el('div', { class: 'search', 'data-search': '' }, head, empty, listHost);

  /* ================================================================== */
  /* Bảng lọc                                                            */
  /* ================================================================== */
  const closeBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Đóng bộ lọc', 'data-action': 'close-filter' }, createIcon('x', 24));
  const typeBtns = FILTER_TYPES.map((t) =>
    el('button', { type: 'button', role: 'radio', class: 'segmented__btn', 'data-filter-type': t, 'aria-checked': 'false', tabindex: '-1', text: TYPE_LABELS[t] }),
  );
  const typeGroup = el('div', { class: 'segmented fp__seg', role: 'radiogroup', 'aria-labelledby': ids.type }, ...typeBtns);
  const catBox = el('div', { class: 'fp__cats' });
  const walletChips = el('div', { class: 'chips fp__chips', role: 'group', 'aria-labelledby': ids.wallets });
  const catSection = el('section', { class: 'fp__section', 'data-section': 'categories' }, el('h3', { class: 'fp__label', id: ids.cats, text: 'Danh mục' }), catBox);
  const walletSection = el('section', { class: 'fp__section', 'data-section': 'wallets' }, el('h3', { class: 'fp__label', id: ids.wallets, text: 'Ví' }), walletChips);
  const panelBody = el(
    'div',
    { class: 'fp__body' },
    el('section', { class: 'fp__section', 'data-section': 'type' }, el('h3', { class: 'fp__label', id: ids.type, text: 'Loại' }), typeGroup),
    catSection,
    walletSection,
  );
  const clearFiltersBtn = el('button', { type: 'button', class: 'btn btn--text fp__clear', 'data-action': 'clear-filters', text: 'Xoá bộ lọc' });
  const applyBtn = el('button', { type: 'button', class: 'btn btn--primary fp__apply', 'data-action': 'apply-filter' });
  const panelStatus = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const panel = el(
    'div',
    { class: 'filter-panel__panel', id: ids.panel, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': ids.title },
    el('div', { class: 'fp__handle', 'aria-hidden': 'true' }),
    el('div', { class: 'fp__head' }, el('h2', { class: 'fp__title', id: ids.title, text: 'Bộ lọc' }), closeBtn),
    panelBody,
    el('div', { class: 'fp__foot' }, clearFiltersBtn, applyBtn),
    panelStatus,
  );
  const scrim = el('div', { class: 'filter-panel__scrim' });
  const panelRoot = el('div', { class: 'filter-panel', hidden: true, 'data-filter-panel': '' }, scrim, panel);
  panelHost.append(panelRoot);

  /* ================================================================== */
  /* Dữ liệu                                                             */
  /* ================================================================== */
  function getMonthList() {
    if (monthDirty) {
      monthList = repo.listByMonth(month.get());
      monthDirty = false;
    }
    return monthList;
  }
  function recompute() {
    results = applyCriteria(getMonthList(), applied, parsed);
  }
  const lookups = () => ({ categories: repo.getCategories(), wallets: repo.getWallets() });
  const snapshot = (c) => ({ ...c, categoryIds: [...c.categoryIds], walletIds: [...c.walletIds] });

  function notify() {
    onChange?.(snapshot(applied));
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch (e) {
        console.error(e); // một người nghe lỗi không được làm hỏng bộ lọc
      }
    }
  }

  /** Đổi tiêu chí đang áp dụng. Trả về true nếu có thay đổi. */
  function setApplied(next) {
    if (destroyed || sameCriteria(applied, next)) return false;
    applied = next;
    parsed = parseQuery(next.query);
    if (panelOpen) draft = next;
    recompute();
    render();
    if (panelOpen) syncPanel();
    notify();
    return true;
  }

  /* ================================================================== */
  /* Hiển thị                                                            */
  /* ================================================================== */
  let lastLive = '';
  function setLive(text) {
    if (text === lastLive) return;
    lastLive = text;
    live.textContent = text;
  }

  function renderChips() {
    const chips = describeChips(applied, lookups());
    chipList.hidden = chips.length === 0;
    chipList.replaceChildren(
      ...chips.map((c) =>
        el(
          'li',
          { class: 'fchip', 'data-chip': c.key },
          el('span', { class: 'fchip__label', text: c.label }),
          el('button', { type: 'button', class: 'fchip__x', 'aria-label': c.ariaLabel, 'data-action': 'remove-chip', onClick: () => removeChip(c) }, createIcon('x', 14)),
        ),
      ),
    );
  }

  function render() {
    if (destroyed) return;
    const total = getMonthList().length;
    const n = countFilters(applied);
    const active = hasCriteria(applied);

    filterBtn.classList.toggle('is-active', n > 0);
    badge.hidden = n === 0;
    badge.textContent = String(n);
    filterBtn.setAttribute('aria-label', n > 0 ? `Bộ lọc, đang bật ${n}` : 'Bộ lọc');
    renderChips();

    const sum = summarizeResults(results);
    const showSummary = active && sum.count > 0;
    summary.hidden = !showSummary;
    if (showSummary) {
      summaryCount.textContent = `${count(sum.count)} kết quả`;
      summaryNet.textContent = formatNet(sum.net);
      summaryNet.className = `search__net search__net--${netTone(sum.net)}`;
    }
    empty.hidden = !(active && sum.count === 0 && total > 0);
    setLive(!active ? '' : sum.count === 0 ? NO_RESULT : `${count(sum.count)} kết quả, tổng ${formatNet(sum.net)}`);

    // Tháng chưa có giao dịch nào: không có gì để tìm → rút khối ra khỏi ô để Trang chủ (M2) tự hiện trạng thái trống
    if (total === 0) {
      if (root.parentNode) root.remove();
    } else if (root.parentNode !== host) {
      host.append(root);
    }
  }

  /* ---------- bảng lọc: đồng bộ với `draft` ---------- */
  const liveMode = () => isWide();

  function categoryGroups() {
    const all = repo.getCategories();
    if (draft.type === 'all') {
      return [
        { type: 'expense', title: 'Chi', items: all.filter((c) => c.type === 'expense') },
        { type: 'income', title: 'Thu', items: all.filter((c) => c.type === 'income') },
      ].filter((g) => g.items.length);
    }
    return [{ type: draft.type, title: null, items: all.filter((c) => c.type === draft.type) }].filter((g) => g.items.length);
  }

  function buildCategoryChip(c) {
    return el(
      'button',
      {
        type: 'button',
        class: 'chip chip--cat',
        'aria-pressed': String(draft.categoryIds.includes(c.id)),
        'data-category-id': c.id,
        style: `--cat-color: ${categoryColorVar(c.color)};`,
        onClick: () => panelChange({ ...draft, categoryIds: toggleId(draft.categoryIds, c.id) }),
      },
      createIcon(c.icon, 20),
      el('span', { text: c.name }),
    );
  }

  function rebuildCategories() {
    const groups = categoryGroups();
    catSection.hidden = groups.length === 0;
    catBox.replaceChildren(
      ...groups.map((g) =>
        el(
          'div',
          { class: 'fp__group', role: 'group', 'aria-label': g.title ? `Danh mục ${g.title.toLowerCase()}` : null, 'aria-labelledby': g.title ? null : ids.cats, 'data-group': g.type },
          g.title ? el('p', { class: 'fp__sub', 'aria-hidden': 'true', text: g.title }) : null,
          el('div', { class: 'chips fp__chips' }, g.items.map(buildCategoryChip)),
        ),
      ),
    );
  }

  function rebuildWallets() {
    const wallets = repo.getWallets();
    walletSection.hidden = wallets.length === 0;
    walletChips.replaceChildren(
      ...wallets.map((w) =>
        el(
          'button',
          {
            type: 'button',
            class: 'chip chip--wallet',
            'aria-pressed': String(draft.walletIds.includes(w.id)),
            'data-wallet-id': w.id,
            onClick: () => panelChange({ ...draft, walletIds: toggleId(draft.walletIds, w.id) }),
          },
          createIcon(w.icon, 20),
          el('span', { text: w.name }),
        ),
      ),
    );
  }

  function previewCount() {
    return applyCriteria(getMonthList(), draft, parseQuery(draft.query)).length;
  }

  function syncPanel() {
    if (!panelOpen) return;
    for (const b of typeBtns) {
      const on = b.dataset.filterType === draft.type;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    const catSig = `${draft.type}|${repo
      .getCategories()
      .map((c) => `${c.id}:${c.name}:${c.icon}:${c.color}`)
      .join(',')}`;
    if (catSig !== builtCategories) {
      builtCategories = catSig;
      rebuildCategories();
    }
    const walletSig = repo
      .getWallets()
      .map((w) => `${w.id}:${w.name}:${w.icon}`)
      .join(',');
    if (walletSig !== builtWallets) {
      builtWallets = walletSig;
      rebuildWallets();
    }
    for (const b of catBox.querySelectorAll('[data-category-id]')) b.setAttribute('aria-pressed', String(draft.categoryIds.includes(b.dataset.categoryId)));
    for (const b of walletChips.querySelectorAll('[data-wallet-id]')) b.setAttribute('aria-pressed', String(draft.walletIds.includes(b.dataset.walletId)));

    const none = countFilters(draft) === 0;
    clearFiltersBtn.classList.toggle('is-disabled', none);
    clearFiltersBtn.setAttribute('aria-disabled', String(none));
    const n = previewCount();
    applyBtn.textContent = liveMode() ? 'Đóng' : `Xem ${count(n)} kết quả`;
    panelStatus.textContent = `${count(n)} kết quả`;
  }

  /** Người dùng đổi một lựa chọn trong bảng: laptop áp dụng ngay, điện thoại chỉ đổi bản nháp. */
  function panelChange(next) {
    draft = next;
    if (liveMode()) setApplied(next);
    syncPanel();
  }

  /* ---------- mở / đóng ---------- */
  function position() {
    if (!panelOpen) return;
    const r = filterBtn.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || globalThis.innerWidth || 1024;
    const left = Math.max(8, Math.min(Math.round(r.right - POPOVER_WIDTH), vw - POPOVER_WIDTH - 8));
    panelRoot.style.setProperty('--fp-left', `${left}px`);
    panelRoot.style.setProperty('--fp-top', `${Math.round(r.bottom + 4)}px`);
  }

  function onResize() {
    position();
    syncPanel();
  }
  function onOutsidePointer(e) {
    if (!panelOpen || !liveMode()) return; // điện thoại: lớp phủ mờ lo việc đóng
    if (panel.contains(e.target) || filterBtn.contains(e.target)) return;
    closePanel({ restoreFocus: false });
  }
  function onDocKeydown(e) {
    if (e.key === 'Escape' && panelOpen) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    }
  }

  function openPanel() {
    if (panelOpen || destroyed) return;
    flushQuery();
    draft = applied;
    builtCategories = '';
    builtWallets = '';
    panelOpen = true;
    panelRoot.hidden = false;
    filterBtn.setAttribute('aria-expanded', 'true');
    syncPanel();
    position();
    document.addEventListener('pointerdown', onOutsidePointer, true);
    document.addEventListener('keydown', onDocKeydown, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('scroll', position, true);
    (typeBtns.find((b) => b.tabIndex === 0) ?? focusableIn(panel)[0])?.focus({ preventScroll: true });
  }

  function closePanel({ restoreFocus = true } = {}) {
    if (!panelOpen) return;
    panelOpen = false;
    panelRoot.hidden = true; // điện thoại: phần nháp chưa áp dụng bị bỏ (lần mở sau đặt lại draft = applied)
    filterBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    document.removeEventListener('keydown', onDocKeydown, true);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('scroll', position, true);
    if (restoreFocus && filterBtn.isConnected) filterBtn.focus({ preventScroll: true });
  }

  function applyAndClose() {
    if (!liveMode()) setApplied(draft);
    closePanel();
  }

  /* ---------- phím trong bảng ---------- */
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') trapTab(e, panel);
  });
  typeGroup.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const from = typeBtns.indexOf(e.target.closest?.('[data-filter-type]'));
    if (from < 0) return;
    let to;
    if (step) to = (from + step + typeBtns.length) % typeBtns.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = typeBtns.length - 1;
    else return;
    e.preventDefault();
    typeBtns[to].focus();
    panelChange(withType(draft, typeBtns[to].dataset.filterType, repo.getCategories()));
  });
  for (const b of typeBtns) b.addEventListener('click', () => panelChange(withType(draft, b.dataset.filterType, repo.getCategories())));

  clearFiltersBtn.addEventListener('click', () => {
    if (clearFiltersBtn.getAttribute('aria-disabled') === 'true') return;
    panelChange({ ...draft, type: 'all', categoryIds: [], walletIds: [] });
  });
  applyBtn.addEventListener('click', applyAndClose);
  closeBtn.addEventListener('click', () => closePanel());
  scrim.addEventListener('pointerdown', () => closePanel());
  filterBtn.addEventListener('click', () => (panelOpen ? closePanel() : openPanel()));

  /* ================================================================== */
  /* Ô tìm                                                               */
  /* ================================================================== */
  function commitQuery(raw) {
    const query = cleanQuery(raw);
    if (query !== applied.query) setApplied({ ...applied, query });
  }
  function flushQuery() {
    if (debounceTimer === null) return;
    clearTimeout(debounceTimer);
    debounceTimer = null;
    commitQuery(input.value);
  }
  function scheduleQuery() {
    clearTimeout(debounceTimer);
    if (debounceMs <= 0) {
      debounceTimer = null;
      commitQuery(input.value);
      return;
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      commitQuery(input.value);
    }, debounceMs);
  }
  function setInputValue(text) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    input.value = text;
    clearQueryBtn.hidden = text === '';
  }
  function clearQuery({ focus = true } = {}) {
    setInputValue('');
    commitQuery('');
    if (focus) input.focus();
  }

  input.addEventListener('input', () => {
    clearQueryBtn.hidden = input.value === '';
    if (!composing) scheduleQuery(); // đang gõ dở bộ gõ tiếng Việt (Telex/VNI): đợi gõ xong
  });
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
    scheduleQuery();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      debounceTimer = null;
      commitQuery(input.value);
    } else if (e.key === 'Escape' && input.value !== '') {
      e.preventDefault();
      e.stopPropagation();
      clearQuery();
    }
  });
  input.addEventListener('blur', flushQuery);
  clearQueryBtn.addEventListener('click', () => clearQuery());

  /* ---------- chip & nút xoá ---------- */
  function removeChip(chip) {
    const index = [...chipList.children].findIndex((li) => li.dataset.chip === chip.key);
    let next = applied;
    if (chip.kind === 'type') next = { ...applied, type: 'all' };
    else if (chip.kind === 'category') next = { ...applied, categoryIds: applied.categoryIds.filter((id) => id !== chip.id) };
    else next = { ...applied, walletIds: applied.walletIds.filter((id) => id !== chip.id) };
    setApplied(next);
    const buttons = chipList.querySelectorAll('.fchip__x');
    (buttons[index] ?? buttons[index - 1] ?? filterBtn).focus({ preventScroll: true });
  }

  emptyClear.addEventListener('click', () => {
    reset();
    filterBtn.focus({ preventScroll: true });
  });

  /** Xoá cả từ khoá lẫn bộ lọc. */
  function reset() {
    setInputValue('');
    setApplied(emptyCriteria());
  }

  /* ================================================================== */
  /* Theo dõi dữ liệu / tháng                                            */
  /* ================================================================== */
  const unsubRepo = repo.subscribe(() => {
    monthDirty = true;
    const pruned = pruneCriteria(applied, lookups()); // danh mục / ví đã bị xoá thì bỏ khỏi bộ lọc
    if (pruned !== applied && setApplied(pruned)) return;
    recompute();
    render();
    syncPanel();
  });
  const unsubMonth = month.subscribe(() => {
    monthDirty = true;
    recompute();
    render();
    syncPanel();
  });

  /** Đối tượng đưa cho mountTransactionList({ filter }). */
  const filter = {
    apply: (list) => applyCriteria(list, applied, parsed),
    ranges: (note) => findRanges(note, parsed),
    isActive: () => hasCriteria(applied),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  recompute();
  render();

  return {
    element: root,
    listHost,
    filter,
    input,
    /** Bản sao tiêu chí đang áp dụng. */
    getCriteria: () => snapshot(applied),
    /** Giao dịch của tháng đang xem sau khi lọc (mới nhất trước). */
    getResults: () => [...results],
    getSummary: () => summarizeResults(results),
    setQuery(text) {
      const query = cleanQuery(text);
      setInputValue(query);
      return setApplied({ ...applied, query });
    },
    setType: (type) => setApplied(withType(applied, type, repo.getCategories())),
    toggleCategory: (id) => setApplied(pruneCriteria({ ...applied, categoryIds: toggleId(applied.categoryIds, id) }, lookups())),
    toggleWallet: (id) => setApplied(pruneCriteria({ ...applied, walletIds: toggleId(applied.walletIds, id) }, lookups())),
    setCriteria(next) {
      const c = pruneCriteria(normalizeCriteria(next), lookups());
      setInputValue(c.query);
      return setApplied(c);
    },
    clearFilters: () => setApplied({ ...applied, type: 'all', categoryIds: [], walletIds: [] }),
    clear: reset,
    openPanel,
    closePanel,
    isPanelOpen: () => panelOpen,
    refresh() {
      monthDirty = true;
      recompute();
      render();
      syncPanel();
    },
    destroy() {
      if (destroyed) return;
      closePanel({ restoreFocus: false });
      destroyed = true;
      clearTimeout(debounceTimer);
      unsubRepo();
      unsubMonth();
      listeners.clear();
      panelRoot.remove();
      root.remove();
    },
  };
}
