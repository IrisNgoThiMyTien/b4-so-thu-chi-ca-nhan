// Trang chủ – module M2: thanh tháng, bộ chọn tháng, 3 thẻ tổng quan (Thu / Chi / Số dư), nút ＋ nổi,
// và các "ô trống" (slots) để M3 (danh sách) và M4 (biểu đồ) gắn vào. DESIGN §4, §6.1, §6.2, §10.3.
import { el, prefersReducedMotion, uid } from './dom.js';
import { createIcon } from './icons.js';
import { createMonthPicker } from './month-picker.js';
import { mountEntryPage } from './entry-form.js';
import { createMonthState } from '../core/month-state.js';
import { formatMonthLabel } from '../core/months.js';
import { describeSummary, summarize } from '../core/summary.js';

const ANIMATION_MS = 280;
const PEEK_MS = 3000;
const BANNERS = {
  unavailable: 'Trình duyệt đang chặn lưu trữ nên không thể lưu dữ liệu. Hãy tắt chế độ riêng tư hoặc cho phép lưu trữ.',
  futureVersion: 'Dữ liệu được tạo bởi phiên bản mới hơn nên không thể ghi. Hãy cập nhật ứng dụng.',
  recovered: 'Dữ liệu cũ bị lỗi nên đã được giữ riêng làm bản sao và ứng dụng bắt đầu lại với dữ liệu trống.',
};

const raf = (fn) => (globalThis.requestAnimationFrame ?? ((f) => setTimeout(() => f(performance.now()), 16)))(fn);
const cancelRaf = (id) => (globalThis.cancelAnimationFrame ?? clearTimeout)(id);

function illustration() {
  const wrap = el('span', { class: 'home-empty__art', 'aria-hidden': 'true' });
  wrap.innerHTML =
    '<svg viewBox="0 0 120 96" width="120" height="96" fill="none">' +
    '<rect x="22" y="10" width="64" height="76" rx="8" style="fill:var(--surface-2);stroke:var(--text-muted)" stroke-width="2"/>' +
    '<path d="M36 30h36M36 42h36M36 54h22" style="stroke:var(--text-muted)" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="88" cy="66" r="18" style="fill:var(--primary-soft);stroke:var(--primary)" stroke-width="2"/>' +
    '<path d="M88 57v18M82 62h12M82 70h12" style="stroke:var(--primary)" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>'; // chuỗi tĩnh trong mã nguồn
  return wrap;
}

/**
 * @param {object} options
 * @param {object} options.repo                 kho dữ liệu (core/repo.js)
 * @param {HTMLElement} [options.host]          mặc định document.body
 * @param {() => Date} [options.now]
 * @param {string} [options.initialMonth]       'YYYY-MM', mặc định tháng hiện tại
 * @param {boolean} [options.animate]           false để tắt hiệu ứng (kiểm thử)
 * @param {boolean} [options.loading]           true → hiện khung xương cho tới khi gọi setLoading(false)
 * @param {(ym: string) => void} [options.onMonthChange]
 * @param {() => void} [options.onOpenSettings] có hàm này thì thanh tháng có nút ⚙ (module M6 cung cấp)
 * @param {(transactionId: string|null) => void} [options.openEntry] ghi đè cách mở Trang nhập liệu
 */
export function mountHome(options) {
  const { repo, host = document.body, now = () => new Date(), animate = true, onMonthChange, onOpenSettings } = options;
  const month = createMonthState({ initial: options.initialMonth, now });
  const motion = () => animate && !prefersReducedMotion();

  let destroyed = false;
  let shown = { income: 0, expense: 0, balance: 0 };
  let rafId = 0;
  let peekTimer = null;
  let peekCard = null;

  /* ---------- thanh tháng ---------- */
  const prevBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Tháng trước', 'data-action': 'prev-month', onClick: () => month.prev() }, createIcon('chevron-left', 24));
  const nextBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Tháng sau', 'data-action': 'next-month', onClick: () => month.next() }, createIcon('chevron-right', 24));
  const labelText = el('span', { class: 'month-bar__text', 'aria-live': 'polite' });
  const labelBtn = el(
    'button',
    { type: 'button', class: 'month-bar__label', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-action': 'open-month-picker', onClick: () => picker.toggle() },
    labelText,
    createIcon('chevron-down', 20),
  );
  const settingsBtn = onOpenSettings
    ? el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cài đặt', 'data-action': 'open-settings', onClick: () => onOpenSettings() }, createIcon('settings', 24))
    : null;
  const bar = el(
    'header',
    { class: 'month-bar' },
    el('div', { class: 'month-bar__inner' }, prevBtn, labelBtn, nextBtn, el('span', { class: 'month-bar__spacer' }), settingsBtn),
  );

  /* ---------- thẻ tổng quan ---------- */
  function buildCard(kind, label) {
    const labelEl = el('span', { class: 'card__label', 'aria-hidden': 'true', text: label });
    const full = el('span', { class: 'card__value card__value--full', 'aria-hidden': 'true' });
    const compact = el('span', { class: 'card__value card__value--compact', 'aria-hidden': 'true' });
    const tip = el('span', { class: 'card__tip', 'aria-hidden': 'true' });
    const root = el('div', { class: `card card--${kind}`, role: 'group', tabindex: '0', 'data-kind': kind }, labelEl, full, compact, tip);
    root.addEventListener('click', () => peek(root));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        peek(root);
      }
    });
    return { root, full, compact, tip };
  }
  const cards = { income: buildCard('income', 'Thu'), expense: buildCard('expense', 'Chi'), balance: buildCard('balance', 'Số dư') };
  const summaryEl = el('section', { class: 'summary', 'data-state': 'ready' }, cards.income.root, cards.expense.root, cards.balance.root);

  function paintCards(values) {
    const d = describeSummary(values);
    for (const kind of ['income', 'expense', 'balance']) {
      const c = cards[kind];
      const info = d[kind];
      c.full.textContent = info.full;
      c.compact.textContent = info.compact;
      c.tip.textContent = info.full;
      c.root.setAttribute('aria-label', info.aria);
      c.root.toggleAttribute('data-long', info.long);
      c.root.toggleAttribute('data-negative', kind === 'balance' && info.negative);
      c.root.style.setProperty('--chars', String(Math.max(info.compact.length, 4)));
    }
    // Điện thoại: chia cột theo độ dài chữ để số dài không bị tràn (thẻ Số dư luôn rộng hơn một chút)
    const w = (kind) => Math.max(d[kind].compact.length, 5) + (kind === 'balance' ? 1.5 : 0);
    summaryEl.style.setProperty('--cols', `${w('income')}fr ${w('expense')}fr ${w('balance')}fr`);
    shown = { income: values.income, expense: values.expense, balance: values.balance };
  }

  function clearPeek() {
    clearTimeout(peekTimer);
    peekCard?.classList.remove('is-peek');
    peekCard = null;
  }

  function peek(card) {
    const wasOpen = card.classList.contains('is-peek');
    clearPeek();
    if (wasOpen) return;
    card.classList.add('is-peek');
    peekCard = card;
    peekTimer = setTimeout(() => {
      card.classList.remove('is-peek');
      if (peekCard === card) peekCard = null;
    }, PEEK_MS);
  }

  function animateCards(target) {
    cancelRaf(rafId);
    const from = { ...shown };
    if (!motion() || (from.income === target.income && from.expense === target.expense)) {
      paintCards(target);
      return;
    }
    const start = performance.now();
    const step = (t) => {
      if (destroyed) return;
      const p = Math.min(1, (t - start) / ANIMATION_MS);
      if (p >= 1) {
        paintCards(target);
        return;
      }
      const e = 1 - (1 - p) ** 3;
      const income = Math.round(from.income + (target.income - from.income) * e);
      const expense = Math.round(from.expense + (target.expense - from.expense) * e);
      paintCards({ income, expense, balance: income - expense });
      rafId = raf(step);
    };
    rafId = raf(step);
  }

  /* ---------- trạng thái trống, banner, ô gắn module ---------- */
  const emptyTitle = el('p', { class: 'home-empty__title' });
  const emptyBtn = el('button', { type: 'button', class: 'btn btn--primary', 'data-action': 'add-first', text: 'Thêm khoản đầu tiên', onClick: () => doOpenEntry(null) });
  const emptyEl = el('section', { class: 'home-empty', hidden: true, 'data-empty': '' }, illustration(), emptyTitle, emptyBtn);
  const bannerBox = el('div', { class: 'home__banners' });
  const slots = { charts: el('section', { class: 'home__slot home__charts', 'data-slot': 'charts' }), list: el('section', { class: 'home__slot home__list', 'data-slot': 'list' }) };
  const grid = el('div', { class: 'home__grid' }, slots.charts, slots.list);
  const monthLive = uid('summary-title');
  const main = el('main', { class: 'home__main' }, bannerBox, summaryEl, emptyEl, grid);
  summaryEl.setAttribute('aria-labelledby', monthLive);
  const summaryTitle = el('h2', { class: 'sr-only', id: monthLive });
  summaryEl.prepend(summaryTitle);

  function showBanner(message) {
    const existing = [...bannerBox.children].find((b) => b.textContent === message);
    if (existing) return existing;
    const banner = el('div', { class: 'banner', role: 'alert' }, createIcon('alert', 20), el('span', { text: message }));
    bannerBox.append(banner);
    return banner;
  }
  function clearBanners() {
    bannerBox.replaceChildren();
  }

  /* ---------- gốc trang ---------- */
  const fab = el('button', { type: 'button', class: 'fab', 'aria-label': 'Thêm khoản', 'data-action': 'add', onClick: () => doOpenEntry(null) }, createIcon('plus', 24));
  const root = el('div', { class: 'home', 'data-home': '' }, bar, main, fab);
  host.append(root);

  const picker = createMonthPicker({ host: root, anchor: labelBtn, monthState: month, repo });

  /* ---------- hiển thị theo dữ liệu / tháng ---------- */
  function renderMonthBar() {
    const ym = month.get();
    labelText.textContent = formatMonthLabel(ym);
    summaryTitle.textContent = `Tổng quan ${formatMonthLabel(ym).toLowerCase()}`;
    root.dataset.month = ym;
    prevBtn.disabled = !month.canPrev();
    nextBtn.disabled = !month.canNext();
  }

  function renderData({ withMotion }) {
    const list = repo.listByMonth(month.get());
    const summary = summarize(list);
    if (withMotion && motion()) {
      for (const c of Object.values(cards)) {
        c.root.classList.remove('is-updating');
        void c.root.offsetWidth; // chạy lại hiệu ứng mờ dần
        c.root.classList.add('is-updating');
      }
    }
    if (withMotion) animateCards(summary);
    else {
      cancelRaf(rafId);
      paintCards(summary); // chỉ đổi tháng mới có hiệu ứng đếm số; mở trang / lưu xong thì hiện ngay
    }
    const empty = summary.count === 0;
    emptyEl.hidden = !empty;
    root.toggleAttribute('data-empty-month', empty);
    emptyTitle.textContent = repo.count() === 0 ? 'Chưa có khoản nào trong tháng này' : 'Tháng này chưa có khoản nào';
  }

  function doOpenEntry(transactionId = null) {
    if (document.querySelector('.entry-overlay')) return; // đang mở rồi
    if (options.openEntry) return options.openEntry(transactionId);
    return mountEntryPage({ repo, now, transactionId, animate });
  }

  /* ---------- sự kiện ---------- */
  const unsubMonth = month.subscribe((ym) => {
    clearPeek(); // số đầy đủ đang hiện thuộc tháng cũ
    renderMonthBar();
    renderData({ withMotion: true });
    onMonthChange?.(ym);
  });
  const unsubRepo = repo.subscribe(() => renderData({ withMotion: false }));

  function onScroll() {
    bar.classList.toggle('is-scrolled', (window.scrollY || document.documentElement.scrollTop || 0) > 0);
  }
  function onVisible() {
    if (!document.hidden) api.refresh();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisible);

  /* ---------- khởi tạo ---------- */
  renderMonthBar();
  renderData({ withMotion: false });
  onScroll();
  if (repo.status === 'future-version') showBanner(BANNERS.futureVersion);
  else if (repo.persistent === false) showBanner(BANNERS.unavailable);
  if (repo.status === 'recovered') showBanner(BANNERS.recovered);
  if (options.loading) {
    summaryEl.dataset.state = 'loading';
    summaryEl.setAttribute('aria-busy', 'true');
  }

  const api = {
    element: root,
    month,
    slots,
    /** Vẽ lại theo dữ liệu hiện tại (và theo ngày hôm nay, ví dụ khi qua tháng mới). */
    refresh() {
      if (destroyed) return;
      renderMonthBar();
      renderData({ withMotion: false });
    },
    setMonth: (ym) => month.set(ym),
    /** Mở Trang nhập liệu: không truyền id = thêm mới, có id = sửa (M3 gọi khi chạm vào một dòng). */
    openEntry: doOpenEntry,
    setLoading(flag) {
      summaryEl.dataset.state = flag ? 'loading' : 'ready';
      if (flag) summaryEl.setAttribute('aria-busy', 'true');
      else summaryEl.removeAttribute('aria-busy');
    },
    showBanner,
    clearBanners,
    openMonthPicker: () => picker.open(),
    closeMonthPicker: () => picker.close(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelRaf(rafId);
      clearTimeout(peekTimer);
      unsubMonth();
      unsubRepo();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisible);
      picker.destroy();
      root.remove();
    },
  };
  return api;
}
