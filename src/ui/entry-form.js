// Trang nhập liệu thu chi (PRD F1–F5, DESIGN §4/§6.6/§9): thêm, sửa, xoá một giao dịch.
// Mobile: toàn màn hình. >= 640px: hộp thoại giữa màn hình (CSS lo phần này).
import { el, focusableIn, prefersReducedMotion, trapTab, uid } from './dom.js';
import { createIcon } from './icons.js';
import { openConfirm } from './confirm.js';
import { getToastHost } from './toast.js';
import { formatAmountInput, formatVND, parseAmountInput } from '../core/money.js';
import { categoryColorVar } from '../core/defaults.js';
import { MIN_DATE, addDays, todayISO } from '../core/dates.js';
import { NOTE_MAX, normalizeNote, validateTransaction } from '../core/validate.js';

const STORAGE_BANNER = 'Không thể lưu dữ liệu. Hãy xuất bản sao lưu hoặc giải phóng bộ nhớ.';
const BANNER_BY_REASON = {
  readonly: 'Dữ liệu được tạo bởi phiên bản mới hơn nên không thể ghi. Hãy cập nhật ứng dụng.',
  unavailable: 'Trình duyệt đang chặn lưu trữ nên không thể lưu dữ liệu. Hãy tắt chế độ riêng tư hoặc cho phép lưu trữ.',
};
const FIELD_ORDER = ['amount', 'categoryId', 'walletId', 'date', 'note'];
const LEAVE_MS = 320; // = --dur-slow

/**
 * @param {object} options
 * @param {object} options.repo               kho dữ liệu (core/repo.js)
 * @param {string} [options.transactionId]    có id → chế độ sửa
 * @param {'expense'|'income'} [options.initialType]
 * @param {HTMLElement} [options.host]        nơi gắn giao diện (mặc định document.body)
 * @param {() => Date} [options.now]
 * @param {object} [options.toast]            { show() } — mặc định dùng toast dùng chung
 * @param {boolean} [options.animate]         false để tắt hiệu ứng đóng (dùng khi kiểm thử)
 * @param {(tx, mode: 'add'|'edit') => void} [options.onSaved]
 * @param {(tx) => void} [options.onDeleted]
 * @param {(tx) => void} [options.onRestored] sau khi bấm "Hoàn tác"
 * @param {() => void} [options.onClose]      đóng mà không lưu/xoá
 * @param {() => void} [options.onAddCategory] có hàm này thì lưới danh mục có ô "＋ Thêm"
 */
export function mountEntryPage(options) {
  const {
    repo,
    transactionId = null,
    host = document.body,
    now = () => new Date(),
    animate = true,
    onSaved,
    onDeleted,
    onRestored,
    onClose,
    onAddCategory,
  } = options;
  const toast = options.toast ?? getToastHost();
  const opener = document.activeElement;
  const editing = transactionId !== null;
  const original = editing ? repo.getTransaction(transactionId) : null;
  const today = () => todayISO(now());

  const initial = original
    ? {
        type: original.type,
        amountDigits: String(original.amount),
        categoryId: original.categoryId,
        walletId: original.walletId,
        date: original.date,
        note: original.note,
      }
    : {
        type: options.initialType === 'income' ? 'income' : 'expense',
        amountDigits: '',
        categoryId: null,
        walletId: repo.getLastWalletId(),
        date: today(),
        note: '',
      };

  const state = {
    ...initial,
    selectedByType: {}, // nhớ danh mục đã chọn cho từng loại khi người dùng bật qua bật lại Chi/Thu
    submitted: false,
    dialogOpen: false,
    finished: false,
  };
  let activeConfirm = null;
  let removed = false;
  let focusTarget = null; // ô được focus khi mở

  /* ---------- khung ---------- */
  const titleId = uid('entry-title');
  const ids = { amount: uid('amount'), date: uid('date'), note: uid('note'), form: uid('entry-form') };

  const overlay = el('div', { class: 'entry-overlay', 'data-entry-overlay': '' });
  const shell = el('section', {
    class: 'entry',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
    'data-mode': editing ? 'edit' : 'add',
  });
  overlay.append(shell);

  const closeBtn = el('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': 'Đóng',
    'data-action': 'close',
    onClick: () => requestClose(),
  }, createIcon('x', 24));
  const deleteBtn = editing
    ? el('button', { type: 'button', class: 'btn btn--text btn--danger-text', 'data-action': 'delete', onClick: () => requestDelete() }, createIcon('trash', 20), el('span', { text: 'Xoá' }))
    : el('span', { class: 'entry__bar-spacer', 'aria-hidden': 'true' });
  shell.append(
    el('header', { class: 'entry__bar' }, closeBtn, el('h1', { class: 'entry__title', id: titleId, text: editing ? 'Sửa khoản' : 'Thêm khoản' }), deleteBtn),
  );

  if (editing && !original) {
    shell.append(
      el('div', { class: 'entry__body' },
        el('div', { class: 'empty-note', role: 'alert' },
          el('p', { text: 'Không tìm thấy khoản này. Có thể nó đã bị xoá.' }),
          el('button', { type: 'button', class: 'btn btn--secondary', text: 'Đóng', 'data-action': 'close-missing', onClick: () => finishClose() }),
        ),
      ),
    );
    return finalize();
  }

  /* ---------- thành phần ---------- */
  const banner = el('div', { class: 'banner', role: 'alert', hidden: true, 'data-banner': '' });

  const segButtons = [
    { value: 'expense', label: 'Chi' },
    { value: 'income', label: 'Thu' },
  ].map(({ value, label }) =>
    el('button', { type: 'button', role: 'radio', class: 'segmented__btn', 'data-value': value, 'aria-checked': 'false', onClick: () => setType(value) }, label),
  );
  const segmented = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Loại giao dịch' }, ...segButtons);

  const amountInput = el('input', {
    id: ids.amount,
    class: 'amount__input',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'done',
    placeholder: '0',
    'aria-describedby': `${ids.amount}-error`,
    'aria-invalid': 'false',
  });
  const amountError = el('p', { class: 'field-error', id: `${ids.amount}-error`, hidden: true });
  focusTarget = amountInput;

  const categoryGrid = el('div', { class: 'cat-grid', role: 'radiogroup', 'aria-labelledby': `${ids.form}-cat-label`, 'aria-describedby': `${ids.form}-cat-error` });
  const categoryError = el('p', { class: 'field-error', id: `${ids.form}-cat-error`, hidden: true });

  const walletGroup = el('div', { class: 'chips', role: 'radiogroup', 'aria-labelledby': `${ids.form}-wallet-label`, 'aria-describedby': `${ids.form}-wallet-error` });
  const walletError = el('p', { class: 'field-error', id: `${ids.form}-wallet-error`, hidden: true });

  const dateInput = el('input', {
    id: ids.date,
    class: 'field__input',
    type: 'date',
    min: MIN_DATE,
    max: today(),
    'aria-describedby': `${ids.date}-error`,
    'aria-invalid': 'false',
  });
  const todayBtn = el('button', { type: 'button', class: 'chip', 'data-quick-date': 'today', text: 'Hôm nay', onClick: () => setDate(today()) });
  const yesterdayBtn = el('button', { type: 'button', class: 'chip', 'data-quick-date': 'yesterday', text: 'Hôm qua', onClick: () => setDate(addDays(today(), -1)) });
  const dateError = el('p', { class: 'field-error', id: `${ids.date}-error`, hidden: true });

  const noteInput = el('input', {
    id: ids.note,
    class: 'field__input',
    type: 'text',
    maxlength: NOTE_MAX,
    autocomplete: 'off',
    placeholder: 'Ví dụ: Cà phê với bạn',
    'aria-describedby': `${ids.note}-error`,
    'aria-invalid': 'false',
  });
  const noteCounter = el('span', { class: 'field__counter', hidden: true, 'aria-live': 'polite' });
  const noteError = el('p', { class: 'field-error', id: `${ids.note}-error`, hidden: true });

  const saveBtn = el('button', { type: 'submit', form: ids.form, class: 'btn btn--primary btn--block', 'data-action': 'save', 'aria-disabled': 'true' }, 'Lưu');

  const form = el(
    'form',
    { class: 'entry__body', id: ids.form, novalidate: true, autocomplete: 'off' },
    banner,
    segmented,
    el('div', { class: 'field field--amount' },
      el('label', { class: 'field__label', for: ids.amount, text: 'Số tiền' }),
      el('div', { class: 'amount' }, amountInput, el('span', { class: 'amount__currency', 'aria-hidden': 'true', text: '₫' })),
      amountError,
    ),
    el('div', { class: 'field' },
      el('span', { class: 'field__label', id: `${ids.form}-cat-label`, text: 'Danh mục' }),
      categoryGrid,
      categoryError,
    ),
    el('div', { class: 'field' },
      el('span', { class: 'field__label', id: `${ids.form}-wallet-label`, text: 'Ví' }),
      walletGroup,
      walletError,
    ),
    el('div', { class: 'field' },
      el('label', { class: 'field__label', for: ids.date, text: 'Ngày' }),
      el('div', { class: 'date-row' }, dateInput, todayBtn, yesterdayBtn),
      dateError,
    ),
    el('div', { class: 'field' },
      el('div', { class: 'field__label-row' },
        el('label', { class: 'field__label', for: ids.note, text: 'Ghi chú (không bắt buộc)' }),
        noteCounter,
      ),
      noteInput,
      noteError,
    ),
  );
  shell.append(form, el('footer', { class: 'entry__footer' }, saveBtn));

  /* ---------- trạng thái → giao diện ---------- */
  const fields = {
    amount: { input: amountInput, error: amountError, focus: () => amountInput },
    categoryId: { error: categoryError, group: categoryGrid },
    walletId: { error: walletError, group: walletGroup },
    date: { input: dateInput, error: dateError },
    note: { input: noteInput, error: noteError },
  };

  const currentInput = () => ({
    type: state.type,
    amount: state.amountDigits,
    categoryId: state.categoryId,
    walletId: state.walletId,
    date: state.date,
    note: state.note,
  });
  const validateNow = () =>
    validateTransaction(currentInput(), { categories: repo.getCategories(), wallets: repo.getWallets(), today: today() });

  function isDirty() {
    return (
      state.type !== initial.type ||
      state.amountDigits !== initial.amountDigits ||
      state.categoryId !== initial.categoryId ||
      state.walletId !== initial.walletId ||
      state.date !== initial.date ||
      normalizeNote(state.note) !== normalizeNote(initial.note)
    );
  }

  function syncTabStops(group) {
    const radios = [...group.querySelectorAll('[role="radio"]')];
    const hasChecked = radios.some((r) => r.getAttribute('aria-checked') === 'true');
    radios.forEach((r, i) => {
      const stop = hasChecked ? r.getAttribute('aria-checked') === 'true' : i === 0;
      r.tabIndex = stop ? 0 : -1;
    });
  }

  function renderType() {
    shell.dataset.type = state.type;
    for (const btn of segButtons) {
      const on = btn.dataset.value === state.type;
      btn.setAttribute('aria-checked', String(on));
      btn.tabIndex = on ? 0 : -1;
    }
  }

  function renderAmount() {
    const text = formatAmountInput(state.amountDigits);
    amountInput.value = text;
    amountInput.style.width = `${Math.max(text.length, 1) + 0.4}ch`;
    shell.toggleAttribute('data-has-amount', text.length > 0);
    try {
      amountInput.setSelectionRange(text.length, text.length);
    } catch {
      /* một số trình duyệt không cho đặt con trỏ khi ô chưa focus */
    }
  }

  function renderCategories() {
    categoryGrid.replaceChildren();
    for (const category of repo.getCategories(state.type)) {
      const on = category.id === state.categoryId;
      categoryGrid.append(
        el('button', {
          type: 'button',
          role: 'radio',
          class: 'cat',
          'data-category-id': category.id,
          'aria-checked': String(on),
          style: `--cat-color: ${categoryColorVar(category.color)};`,
          onClick: () => selectCategory(category.id),
        }, createIcon(category.icon, 28), el('span', { class: 'cat__name', text: category.name })),
      );
    }
    if (onAddCategory) {
      categoryGrid.append(
        el('button', { type: 'button', class: 'cat cat--add', 'data-action': 'add-category', onClick: () => onAddCategory() },
          createIcon('plus', 28), el('span', { class: 'cat__name', text: 'Thêm' })),
      );
    }
    syncTabStops(categoryGrid);
  }

  function renderWallets() {
    walletGroup.replaceChildren();
    for (const wallet of repo.getWallets()) {
      walletGroup.append(
        el('button', {
          type: 'button',
          role: 'radio',
          class: 'chip chip--wallet',
          'data-wallet-id': wallet.id,
          'aria-checked': String(wallet.id === state.walletId),
          onClick: () => selectWallet(wallet.id),
        }, createIcon(wallet.icon, 20), el('span', { text: wallet.name })),
      );
    }
    syncTabStops(walletGroup);
  }

  function renderDate() {
    dateInput.max = today(); // giữ giới hạn đúng khi trang mở qua nửa đêm
    if (dateInput.value !== state.date) dateInput.value = state.date;
    todayBtn.setAttribute('aria-pressed', String(state.date === today()));
    yesterdayBtn.setAttribute('aria-pressed', String(state.date === addDays(today(), -1)));
  }

  function renderNote() {
    const length = [...state.note].length;
    const nearLimit = NOTE_MAX - length < 20;
    noteCounter.hidden = !nearLimit;
    noteCounter.textContent = nearLimit ? `${length}/${NOTE_MAX}` : '';
  }

  function renderErrors(result = validateNow()) {
    for (const key of FIELD_ORDER) {
      const message = state.submitted ? result.errors[key] : undefined;
      const f = fields[key];
      f.error.textContent = message ?? '';
      f.error.hidden = !message;
      if (f.input) f.input.setAttribute('aria-invalid', String(!!message));
      if (f.group) f.group.setAttribute('aria-invalid', String(!!message));
    }
    shell.toggleAttribute('data-amount-invalid', state.submitted && !!result.errors.amount);
  }

  function renderSave(result = validateNow()) {
    const disabled = !result.valid || (editing && !isDirty());
    saveBtn.setAttribute('aria-disabled', String(disabled));
    saveBtn.classList.toggle('is-disabled', disabled);
  }

  function refresh() {
    const result = validateNow();
    renderErrors(result);
    renderSave(result);
  }

  function showBanner(message) {
    banner.textContent = '';
    banner.append(createIcon('alert', 20), el('span', { text: message }));
    banner.hidden = false;
  }

  /* ---------- hành vi ---------- */
  function setType(next) {
    if (next === state.type) return;
    state.selectedByType[state.type] = state.categoryId;
    state.type = next;
    const remembered = state.selectedByType[next];
    state.categoryId = remembered && repo.getCategories(next).some((c) => c.id === remembered) ? remembered : null;
    renderType();
    renderCategories();
    refresh();
  }

  function selectCategory(id) {
    state.categoryId = id;
    for (const btn of categoryGrid.querySelectorAll('[role="radio"]')) {
      btn.setAttribute('aria-checked', String(btn.dataset.categoryId === id));
    }
    syncTabStops(categoryGrid);
    refresh();
  }

  function selectWallet(id) {
    state.walletId = id;
    for (const btn of walletGroup.querySelectorAll('[role="radio"]')) {
      btn.setAttribute('aria-checked', String(btn.dataset.walletId === id));
    }
    syncTabStops(walletGroup);
    refresh();
  }

  function setDate(value) {
    state.date = value;
    renderDate();
    refresh();
  }

  function focusFirstInvalid(errors) {
    const key = FIELD_ORDER.find((k) => errors[k]);
    if (!key) return;
    const f = fields[key];
    const target = f.input ?? f.group.querySelector('[role="radio"][tabindex="0"]') ?? f.group.querySelector('[role="radio"]');
    target?.focus();
    target?.scrollIntoView?.({ block: 'center' });
  }

  function attemptSave() {
    if (state.finished) return;
    state.submitted = true;
    const result = validateNow();
    renderErrors(result);
    renderSave(result);
    if (!result.valid) {
      focusFirstInvalid(result.errors);
      return;
    }
    if (editing && !isDirty()) return; // chưa đổi gì: không ghi
    const res = editing ? repo.update(original.id, result.value) : repo.add(result.value);
    if (!res.ok) {
      if (res.error === 'storage') showBanner(BANNER_BY_REASON[res.reason] ?? STORAGE_BANNER);
      else if (res.error === 'not-found') showBanner('Khoản này không còn tồn tại nên không thể lưu.');
      else {
        // repo từ chối dù form đã hợp lệ (dữ liệu tham chiếu đổi) → hiện lỗi lên form
        state.submitted = true;
        renderErrors({ errors: res.errors ?? {} });
      }
      return;
    }
    state.finished = true;
    const kind = res.transaction.type === 'expense' ? 'chi' : 'thu';
    toast.show({ message: `Đã lưu khoản ${kind} ${formatVND(res.transaction.amount)}` });
    onSaved?.(res.transaction, editing ? 'edit' : 'add');
    leave();
  }

  async function ask(config) {
    state.dialogOpen = true;
    activeConfirm = openConfirm({ ...config, parent: document.body });
    const ok = await activeConfirm.result;
    activeConfirm = null;
    state.dialogOpen = false;
    return ok;
  }

  async function requestClose() {
    if (state.finished || state.dialogOpen) return;
    if (!isDirty()) return finishClose();
    const discard = await ask({
      title: 'Bỏ thay đổi?',
      message: 'Các thay đổi chưa lưu sẽ bị mất.',
      confirmLabel: 'Bỏ',
      cancelLabel: 'Tiếp tục sửa',
      danger: true,
    });
    if (discard && !removed && !state.finished) finishClose();
  }

  function finishClose() {
    if (state.finished) return;
    state.finished = true;
    onClose?.();
    leave();
  }

  async function requestDelete() {
    if (!editing || state.finished || state.dialogOpen) return;
    const confirmed = await ask({
      title: 'Xoá khoản này?',
      message: 'Hành động này có thể hoàn tác trong 4 giây.',
      confirmLabel: 'Xoá',
      cancelLabel: 'Huỷ',
      danger: true,
    });
    if (!confirmed || removed || state.finished) return;
    const res = repo.remove(original.id);
    if (!res.ok) {
      showBanner(res.error === 'storage' ? (BANNER_BY_REASON[res.reason] ?? STORAGE_BANNER) : 'Khoản này không còn tồn tại.');
      return;
    }
    state.finished = true;
    const gone = res.transaction;
    toast.show({
      message: 'Đã xoá',
      actionLabel: 'Hoàn tác',
      onAction: () => {
        const back = repo.restore(gone);
        if (back.ok) {
          onRestored?.(back.transaction);
          toast.show({ message: 'Đã khôi phục khoản này' });
        } else {
          toast.show({ message: 'Không thể hoàn tác', kind: 'error' });
        }
      },
    });
    onDeleted?.(gone);
    leave();
  }

  /* ---------- sự kiện ---------- */
  amountInput.addEventListener('input', () => {
    state.amountDigits = parseAmountInput(amountInput.value).digits;
    renderAmount();
    refresh();
  });
  dateInput.addEventListener('input', () => {
    state.date = dateInput.value;
    renderDate();
    refresh();
  });
  dateInput.addEventListener('change', () => {
    state.date = dateInput.value;
    renderDate();
    refresh();
  });
  noteInput.addEventListener('input', () => {
    state.note = noteInput.value;
    renderNote();
    refresh();
  });
  saveBtn.addEventListener('click', (e) => {
    e.preventDefault(); // tự xử lý để nút "vô hiệu" vẫn bấm được và hiện lỗi
    attemptSave();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    attemptSave();
  });

  // Phím mũi tên trong nhóm radio (Chi/Thu, danh mục, ví): di chuyển + chọn.
  function arrowNavigation(group) {
    group.addEventListener('keydown', (e) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
      if (!keys.includes(e.key) || e.target.getAttribute('role') !== 'radio') return;
      const radios = [...group.querySelectorAll('[role="radio"]')];
      const index = radios.indexOf(e.target);
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const next = radios[(index + step + radios.length) % radios.length];
      e.preventDefault();
      next.focus();
      next.click();
    });
  }
  [segmented, categoryGrid, walletGroup].forEach(arrowNavigation);

  shell.addEventListener('keydown', (e) => trapTab(e, shell));
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) requestClose(); // bấm ra ngoài hộp thoại (laptop)
  });

  /* ---------- khởi tạo ---------- */
  renderType();
  renderAmount();
  renderCategories();
  renderWallets();
  renderDate();
  noteInput.value = state.note;
  renderNote();
  refresh();
  if (repo.status === 'future-version') showBanner(BANNER_BY_REASON.readonly);
  else if (repo.persistent === false) showBanner(BANNER_BY_REASON.unavailable);

  return finalize();

  /* ---------- gắn / gỡ ---------- */
  function onDocKeydown(e) {
    if (e.key === 'Escape' && !state.dialogOpen && !state.finished) {
      e.preventDefault();
      requestClose();
    }
  }

  function finalize() {
    document.addEventListener('keydown', onDocKeydown);
    host.append(overlay);
    document.documentElement.classList.add('has-entry-open');
    (focusTarget ?? focusableIn(shell)[0])?.focus({ preventScroll: true });
    return { element: overlay, destroy, requestClose, isDirty };
  }

  function leave() {
    document.removeEventListener('keydown', onDocKeydown);
    if (!animate || prefersReducedMotion()) return destroy();
    overlay.classList.add('is-leaving');
    setTimeout(destroy, LEAVE_MS);
  }

  function destroy() {
    if (removed) return;
    removed = true;
    state.finished = true;
    document.removeEventListener('keydown', onDocKeydown);
    activeConfirm?.close(false);
    overlay.remove();
    document.documentElement.classList.remove('has-entry-open');
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
  }
}
