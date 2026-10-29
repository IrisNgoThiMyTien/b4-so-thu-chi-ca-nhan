// Cài đặt – module M6: bảng trượt mở từ nút ⚙ ở Thanh tháng, bên trong là một chồng trang con
// (Cài đặt → Ví → …) chuyển bằng hiệu ứng trượt ngang; chọn giao diện Theo hệ thống / Sáng / Tối.
// DESIGN §6.7, §10.2, §10.10, §8. Các module sau (M7 ví/danh mục, M8 ngân sách, M9 sao lưu) gắn trang con bằng
// `registerPage(id, { title, render(ctx) })`; chưa gắn thì hiện trang tạm "Đang phát triển".
import { el, focusableIn, prefersReducedMotion, trapTab, uid } from './dom.js';
import { createIcon } from './icons.js';
import { getToastHost } from './toast.js';
import { THEMES, THEME_FADE_MS, THEME_LABELS, applyTheme } from '../core/theme.js';
import { APP_NAME, APP_PRIVACY_NOTE, APP_VERSION } from '../core/app-info.js';

export const ROOT_PAGE = 'root';
export const PLACEHOLDER_TITLE = 'Đang phát triển';
/** Các trang con mà khung Cài đặt đã dành sẵn lối vào (module sau sẽ đăng ký nội dung thật). */
export const DEFAULT_PAGE_TITLES = { wallets: 'Ví', categories: 'Danh mục', 'budget-limits': 'Hạn mức theo danh mục', backup: 'Sao lưu & khôi phục' };

const SLIDE_MS = 320; // = --dur-slow: trượt trang con, mở / đóng bảng
const DRAG_CLOSE_PX = 100; // kéo xuống quá ngưỡng này thì đóng
const DRAG_FLING = 0.6; // px/ms: vuốt nhanh cũng đóng
const STORAGE_ERROR = 'Không thể lưu cài đặt. Hãy xuất bản sao lưu hoặc giải phóng bộ nhớ.';
const THEME_SESSION_ONLY = 'Không lưu được lựa chọn giao diện nên chỉ áp dụng trong lần mở này.';
const WIDE_QUERY = '(min-width: 640px)';

function defaultIsWide() {
  try {
    return !!globalThis.matchMedia && globalThis.matchMedia(WIDE_QUERY).matches;
  } catch {
    return false;
  }
}

const setInert = (node, on) => {
  if (on) {
    node.setAttribute('inert', '');
    node.setAttribute('aria-hidden', 'true');
  } else {
    node.removeAttribute('inert');
    node.removeAttribute('aria-hidden');
  }
};

/**
 * @param {object} options
 * @param {object} options.repo                kho dữ liệu: dùng getSettings / updateSettings / subscribeSettings (M6), getWallets, getCategories
 * @param {object} [options.home]              kết quả mountHome (M2): làm mờ / khoá phần Trang chủ khi bảng đang mở
 * @param {HTMLElement} [options.host]         nơi gắn bảng (mặc định document.body)
 * @param {HTMLElement} [options.root]         phần tử nhận data-theme (mặc định <html>)
 * @param {boolean} [options.animate]          false để tắt hiệu ứng (kiểm thử)
 * @param {object} [options.toast]
 * @param {() => boolean} [options.isWide]     đang ở bố cục laptop (≥ 640px)? mặc định đọc matchMedia
 * @param {(theme: string) => void} [options.onThemeChange]
 */
export function mountSettings(options) {
  const { repo, home, host = document.body, root = document.documentElement, animate = true, isWide = defaultIsWide, onThemeChange } = options;
  if (!repo || typeof repo.getSettings !== 'function') throw new Error('mountSettings cần repo có getSettings / updateSettings (M6).');
  const motion = () => animate && !prefersReducedMotion();
  const getToast = () => options.toast ?? getToastHost();

  const pages = new Map(); // id → { title, render }
  let stack = []; // [{ id, params, root, titleEl, opener, destroy }]
  let overlay = null;
  let panel = null;
  let viewport = null;
  let opener = null;
  let opened = false;
  let closing = false;
  let destroyed = false;
  let leaveTimer = null;
  let closeTimer = null;
  let leaving = []; // trang con đang trượt ra, chờ gỡ
  let menu = null; // tham chiếu tới các điều khiển của trang gốc

  /* ================================================================== */
  /* Giao diện sáng/tối                                                  */
  /* ================================================================== */
  let theme = repo.getSettings().theme; // đang hiển thị
  let savedTheme = theme; // đang nằm trong kho
  let fadeTimer = null;
  applyTheme(root, theme);

  function paintTheme(next, { fade = true } = {}) {
    theme = next;
    if (fade && motion()) {
      root.classList.add('theme-fade'); // DESIGN §8: chuyển màu nền & chữ mượt 200 ms
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => root.classList.remove('theme-fade'), THEME_FADE_MS + 50);
    }
    applyTheme(root, next);
    syncMenu();
    onThemeChange?.(next);
  }

  /** Đổi giao diện: áp dụng ngay, rồi lưu. Lưu lỗi thì vẫn giữ lựa chọn trong lần mở này và báo cho người dùng. */
  function setTheme(next) {
    if (!THEMES.includes(next)) return false;
    if (next !== theme) paintTheme(next);
    const res = repo.updateSettings({ theme: next });
    if (!res.ok) {
      getToast().show({ message: THEME_SESSION_ONLY, kind: 'error' });
      return false;
    }
    savedTheme = next;
    return true;
  }

  function setBudgetEnabled(on) {
    const res = repo.updateSettings({ budgetEnabled: on });
    if (!res.ok) {
      getToast().show({ message: STORAGE_ERROR, kind: 'error' });
      syncMenu(); // công tắc quay về giá trị đang lưu
      return false;
    }
    syncMenu();
    return true;
  }

  const unsubSettings = repo.subscribeSettings(() => {
    const s = repo.getSettings();
    if (s.theme !== savedTheme) {
      savedTheme = s.theme;
      if (s.theme !== theme) paintTheme(s.theme); // đổi từ nơi khác (module khác / tab khác qua repo)
    }
    syncMenu();
  });
  const unsubRepo = repo.subscribe(() => syncMenu()); // số ví / danh mục

  /* ================================================================== */
  /* Trang gốc: Giao diện · Quản lý · Ngân sách · Dữ liệu                */
  /* ================================================================== */
  function navRow({ page, icon, label, value }) {
    const valueEl = value ? el('span', { class: 'st-row__value', text: '' }) : null;
    const btn = el(
      'button',
      { type: 'button', class: 'st-row', 'data-page': page, onClick: () => push(page, {}, btn) },
      el('span', { class: 'st-row__icon', 'aria-hidden': 'true' }, createIcon(icon, 20)),
      el('span', { class: 'st-row__label', text: label }),
      valueEl,
      el('span', { class: 'st-row__chevron', 'aria-hidden': 'true' }, createIcon('chevron-right', 20)),
    );
    return { li: el('li', { class: 'st-item' }, btn), btn, valueEl, label };
  }

  function group(labelText, ...children) {
    const id = uid('st-group');
    return el('section', { class: 'st-group', 'aria-labelledby': id }, el('p', { class: 'st-group__label', id, text: labelText }), ...children);
  }

  function buildMenu() {
    const segButtons = THEMES.map((t) =>
      el('button', { type: 'button', role: 'radio', class: 'segmented__btn', 'data-theme-option': t, 'aria-checked': 'false', tabindex: '-1', text: THEME_LABELS[t], onClick: () => setTheme(t) }),
    );
    const seg = el('div', { class: 'segmented st-seg', role: 'radiogroup', 'aria-label': 'Giao diện' }, ...segButtons);
    seg.addEventListener('keydown', (e) => {
      const from = segButtons.indexOf(e.target.closest?.('[data-theme-option]'));
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      let to;
      if (from < 0) return;
      if (step) to = (from + step + segButtons.length) % segButtons.length;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = segButtons.length - 1;
      else return;
      e.preventDefault();
      segButtons[to].focus();
      setTheme(THEMES[to]);
    });

    const wallets = navRow({ page: 'wallets', icon: 'wallet', label: 'Ví', value: true });
    const categories = navRow({ page: 'categories', icon: 'layout-grid', label: 'Danh mục', value: true });
    const limits = navRow({ page: 'budget-limits', icon: 'sliders-horizontal', label: 'Hạn mức theo danh mục' });
    const backup = navRow({ page: 'backup', icon: 'database', label: 'Sao lưu & khôi phục' });

    const switchBtn = el(
      'button',
      { type: 'button', role: 'switch', class: 'st-row st-row--switch', 'aria-checked': 'false', 'data-action': 'toggle-budget', onClick: () => setBudgetEnabled(switchBtn.getAttribute('aria-checked') !== 'true') },
      el('span', { class: 'st-row__icon', 'aria-hidden': 'true' }, createIcon('target', 20)),
      el('span', { class: 'st-row__label', text: 'Bật ngân sách' }),
      el('span', { class: 'st-switch', 'aria-hidden': 'true' }),
    );
    const limitsItem = limits.li;
    limitsItem.hidden = true;

    const body = el(
      'div',
      { class: 'st-content' },
      group('Giao diện', el('div', { class: 'st-card st-card--pad' }, seg)),
      group('Quản lý', el('ul', { class: 'st-card st-list' }, wallets.li, categories.li)),
      group('Ngân sách', el('ul', { class: 'st-card st-list' }, el('li', { class: 'st-item' }, switchBtn), limitsItem)),
      group('Dữ liệu', el('ul', { class: 'st-card st-list' }, backup.li)),
      el('footer', { class: 'st-footer' }, el('p', { text: `${APP_NAME} · v${APP_VERSION}` }), el('p', { text: APP_PRIVACY_NOTE })),
    );
    return { body, seg, segButtons, wallets, categories, limitsItem, switchBtn };
  }

  /** Đưa các điều khiển ở trang gốc về đúng trạng thái hiện tại. */
  function syncMenu() {
    if (!menu) return;
    for (const b of menu.segButtons) {
      const on = b.dataset.themeOption === theme;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    const s = repo.getSettings();
    menu.switchBtn.setAttribute('aria-checked', String(s.budgetEnabled));
    menu.limitsItem.hidden = !s.budgetEnabled;
    const nW = repo.getWallets().length;
    const nC = repo.getCategories().length;
    menu.wallets.valueEl.textContent = String(nW);
    menu.wallets.btn.setAttribute('aria-label', `Ví, ${nW} ví`);
    menu.categories.valueEl.textContent = String(nC);
    menu.categories.btn.setAttribute('aria-label', `Danh mục, ${nC} danh mục`);
  }

  /* ================================================================== */
  /* Khung trang + chồng trang con                                       */
  /* ================================================================== */
  function createShell({ title, top }) {
    const titleEl = el('h1', { class: top ? 'st-title' : 'st-title st-title--center', id: uid('st-title'), text: title });
    const head = top
      ? el('header', { class: 'st-head' }, titleEl, el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Đóng cài đặt', 'data-action': 'close-settings', onClick: () => close() }, createIcon('x', 24)))
      : el(
          'header',
          { class: 'st-head st-head--sub' },
          el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Quay lại', 'data-action': 'back', onClick: () => back() }, createIcon('chevron-left', 24)),
          titleEl,
          el('span', { class: 'st-head__spacer', 'aria-hidden': 'true' }),
        );
    const body = el('div', { class: 'st-body' });
    const page = el('section', { class: 'st-page', 'aria-labelledby': titleEl.id }, head, body);
    return { page, titleEl, body };
  }

  function placeholder(title, ctx) {
    return el(
      'div',
      { class: 'st-placeholder', 'data-placeholder': '' },
      el('span', { class: 'st-placeholder__art', 'aria-hidden': 'true' }, createIcon('wrench', 28)),
      el('h2', { class: 'st-placeholder__title', text: PLACEHOLDER_TITLE }),
      el('p', { class: 'st-placeholder__text', text: `Mục “${title}” sẽ có trong bản cập nhật sau. Dữ liệu của bạn vẫn an toàn.` }),
      el('button', { type: 'button', class: 'btn btn--secondary', 'data-action': 'placeholder-back', text: 'Quay lại', onClick: () => ctx.back() }),
    );
  }

  const topEntry = () => stack[stack.length - 1];
  const dialogTitleId = () => topEntry()?.titleEl.id ?? null;
  function syncDialogLabel() {
    if (panel) panel.setAttribute('aria-labelledby', dialogTitleId());
  }

  function flushLeaving() {
    clearTimeout(leaveTimer);
    for (const entry of leaving) {
      entry.destroy?.();
      entry.root.remove();
    }
    leaving = [];
  }

  /**
   * Mở một trang con. `from` là nút đã bấm (nhận lại focus khi quay lại).
   * @returns {boolean}
   */
  function push(id, params = {}, from = null) {
    if (!opened || closing || destroyed || typeof id !== 'string' || !id) return false;
    const def = pages.get(id); // trang vừa lùi có thể còn đang trượt ra: để nó trượt nốt, hẹn giờ sẽ gỡ
    const title = def?.title ?? DEFAULT_PAGE_TITLES[id] ?? params.title ?? PLACEHOLDER_TITLE;
    const shell = createShell({ title, top: false });
    const entry = { id, params, root: shell.page, titleEl: shell.titleEl, opener: from ?? document.activeElement, destroy: null };
    const ctx = {
      id,
      params,
      repo,
      home,
      get toast() {
        return getToast();
      },
      push: (nextId, nextParams) => push(nextId, nextParams),
      back: () => back(),
      close: () => close(),
      setTitle: (text) => {
        shell.titleEl.textContent = text;
      },
    };
    let content = null;
    if (def?.render) {
      try {
        content = def.render(ctx);
      } catch (e) {
        console.error(e); // một trang con lỗi không được làm hỏng cả Cài đặt
      }
    }
    if (content instanceof Node) shell.body.append(content);
    else if (content?.element instanceof Node) {
      shell.body.append(content.element);
      entry.destroy = content.destroy ?? null;
    } else shell.body.append(placeholder(title, ctx));

    const prev = topEntry();
    stack.push(entry);
    viewport.append(shell.page);
    if (motion()) {
      shell.page.classList.add('is-enter');
      void shell.page.offsetWidth; // chốt vị trí ban đầu rồi mới trượt vào
      shell.page.classList.remove('is-enter');
    }
    prev.root.classList.add('is-behind');
    setInert(prev.root, true);
    syncDialogLabel();
    shell.page.querySelector('[data-action="back"]')?.focus({ preventScroll: true });
    return true;
  }

  /** Lùi một cấp; đang ở trang gốc thì đóng bảng. */
  function back() {
    if (!opened || closing) return false;
    if (stack.length <= 1) return close();
    flushLeaving();
    const gone = stack.pop();
    const prev = topEntry();
    prev.root.classList.remove('is-behind');
    setInert(prev.root, false);
    setInert(gone.root, true);
    if (motion()) {
      gone.root.classList.add('is-leaving');
      leaving.push(gone);
      leaveTimer = setTimeout(flushLeaving, SLIDE_MS);
    } else {
      gone.destroy?.();
      gone.root.remove();
    }
    syncDialogLabel();
    const target = gone.opener && prev.root.contains(gone.opener) ? gone.opener : focusableIn(prev.root).filter((n) => !n.closest('[inert]'))[0];
    target?.focus({ preventScroll: true });
    return true;
  }

  /* ================================================================== */
  /* Mở / đóng bảng                                                      */
  /* ================================================================== */
  const gear = () => home?.element?.querySelector('[data-action="open-settings"]') ?? null;

  function onDocKeydown(e) {
    if (e.key !== 'Escape' || !opened) return;
    e.preventDefault();
    e.stopPropagation();
    back(); // Esc: lùi một cấp (DESIGN §10.2); ở trang gốc thì đóng
  }

  function onPanelKeydown(e) {
    if (e.key === 'Tab') trapTab(e, topEntry().root);
  }

  /* kéo xuống để đóng (điện thoại; chạm / bút) */
  let drag = null;
  function onDragStart(e) {
    if (isWide() || closing || e.pointerType === 'mouse') return;
    if (e.button !== undefined && e.button !== 0) return;
    if (!e.target.closest('.settings__handle, .st-head') || e.target.closest('button')) return;
    drag = { y: e.clientY, at: performance.now(), dy: 0, id: e.pointerId, last: e.clientY, lastAt: performance.now(), v: 0 };
    panel.setPointerCapture?.(e.pointerId);
  }
  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const now = performance.now();
    drag.dy = Math.max(0, e.clientY - drag.y);
    if (now > drag.lastAt) drag.v = (e.clientY - drag.last) / (now - drag.lastAt);
    drag.last = e.clientY;
    drag.lastAt = now;
    panel.classList.add('is-dragging');
    panel.style.transform = `translateY(${drag.dy}px)`;
  }
  /** Hệ thống huỷ cử chỉ (cuộc gọi đến, trình duyệt giành cử chỉ…): luôn bật về chỗ cũ, không đóng. */
  function onDragCancel() {
    if (!drag) return;
    drag = null;
    panel.classList.remove('is-dragging');
    panel.style.transform = '';
  }
  function onDragEnd(e) {
    if (!drag || (e && e.pointerId !== undefined && e.pointerId !== drag.id)) return;
    const { dy, v } = drag;
    drag = null;
    panel.classList.remove('is-dragging');
    if (dy > DRAG_CLOSE_PX || (dy > 24 && v > DRAG_FLING)) {
      panel.style.transform = '';
      close();
    } else panel.style.transform = '';
  }

  function build() {
    const shell = createShell({ title: 'Cài đặt', top: true });
    menu = buildMenu();
    shell.body.append(menu.body);
    const rootEntry = { id: ROOT_PAGE, params: {}, root: shell.page, titleEl: shell.titleEl, opener: null, destroy: null };
    stack = [rootEntry];
    viewport = el('div', { class: 'settings__viewport' }, shell.page);
    panel = el(
      'div',
      { class: 'settings__panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': shell.titleEl.id, 'data-settings-panel': '' },
      el('div', { class: 'settings__handle', 'aria-hidden': 'true' }, el('span', { class: 'settings__grip' })),
      viewport,
    );
    const scrim = el('div', { class: 'settings__scrim' });
    scrim.addEventListener('pointerdown', () => close());
    panel.addEventListener('keydown', onPanelKeydown);
    panel.addEventListener('pointerdown', onDragStart);
    panel.addEventListener('pointermove', onDragMove);
    panel.addEventListener('pointerup', onDragEnd);
    panel.addEventListener('pointercancel', onDragCancel);
    overlay = el('div', { class: 'settings', 'data-settings': '' }, scrim, panel);
  }

  /** Mở bảng Cài đặt. Trả về false nếu không mở được (đang mở / Trang nhập liệu đang mở / đã huỷ). */
  function open({ page } = {}) {
    if (destroyed) return false;
    if (closing) teardown();
    if (opened) {
      if (page) push(page);
      return true;
    }
    if (document.querySelector('.entry-overlay')) return false; // Trang nhập liệu (M1) đang phủ trên Trang chủ
    opener = document.activeElement && typeof document.activeElement.focus === 'function' ? document.activeElement : null;
    build();
    syncMenu();
    host.append(overlay);
    root.classList.add('has-settings-open'); // khoá cuộn nền (§10.10)
    if (home?.element) setInert(home.element, true);
    gear()?.setAttribute('aria-expanded', 'true');
    opened = true;
    document.addEventListener('keydown', onDocKeydown, true);
    (menu.segButtons.find((b) => b.tabIndex === 0) ?? focusableIn(stack[0].root)[0])?.focus({ preventScroll: true });
    if (page) push(page);
    return true;
  }

  function teardown() {
    clearTimeout(closeTimer);
    clearTimeout(leaveTimer);
    leaving = [];
    for (const entry of stack) entry.destroy?.();
    stack = [];
    overlay?.remove();
    overlay = panel = viewport = menu = null;
    closing = false;
    opened = false;
    drag = null;
    document.removeEventListener('keydown', onDocKeydown, true);
    root.classList.remove('has-settings-open');
    if (home?.element) setInert(home.element, false);
    gear()?.setAttribute('aria-expanded', 'false');
    const restore = opener;
    opener = null;
    if (restore && restore.isConnected) restore.focus({ preventScroll: true });
  }

  /** Đóng bảng (mọi trang con cũng đóng; lần mở sau bắt đầu lại từ trang gốc). */
  function close() {
    if (!opened || closing) return false;
    if (!motion()) {
      teardown();
      return true;
    }
    closing = true;
    opened = false; // coi như đã đóng ngay; phần tử còn lại chỉ để chạy hiệu ứng
    overlay.classList.add('is-leaving');
    setInert(panel, true);
    closeTimer = setTimeout(teardown, SLIDE_MS);
    return true;
  }

  /* ================================================================== */
  const api = {
    get element() {
      return overlay;
    },
    open,
    close,
    isOpen: () => opened,
    push: (id, params) => push(id, params),
    back,
    /** Mã các trang đang xếp chồng, từ gốc: ['root', 'wallets']. */
    getStack: () => stack.map((s) => s.id),
    getTheme: () => theme,
    setTheme,
    /** Gắn nội dung thật cho một trang con: { title, render(ctx) → Node | { element, destroy? } }. */
    registerPage(id, def) {
      if (typeof id !== 'string' || !id || ROOT_PAGE === id || typeof def?.render !== 'function') throw new Error('registerPage cần id (khác "root") và def.render().');
      pages.set(id, { title: def.title, render: def.render });
    },
    unregisterPage: (id) => pages.delete(id),
    hasPage: (id) => pages.has(id),
    destroy() {
      if (destroyed) return;
      if (opened || closing) teardown();
      destroyed = true;
      clearTimeout(fadeTimer);
      root.classList.remove('theme-fade');
      unsubSettings();
      unsubRepo();
      pages.clear();
    },
  };
  return api;
}
