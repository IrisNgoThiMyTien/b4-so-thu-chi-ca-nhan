// Hộp thoại xác nhận nhỏ (DESIGN §6.9): "Xoá khoản này?" và "Bỏ thay đổi?".
import { el, trapTab, uid } from './dom.js';

/**
 * @returns {{ result: Promise<boolean>, close: (value?: boolean) => void }}
 *   result = true khi bấm nút xác nhận; false khi Huỷ / Esc / bấm nền / close().
 */
export function openConfirm({ title, message, confirmLabel, cancelLabel = 'Huỷ', danger = false, parent = document.body }) {
  const opener = document.activeElement;
  const titleId = uid('confirm-title');
  const textId = uid('confirm-text');
  let settle;
  const result = new Promise((resolve) => {
    settle = resolve;
  });
  let closed = false;

  const cancelBtn = el('button', { type: 'button', class: 'btn btn--secondary', text: cancelLabel });
  const okBtn = el('button', { type: 'button', class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, text: confirmLabel });
  const box = el(
    'div',
    { class: 'confirm', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': textId },
    el('h2', { class: 'confirm__title', id: titleId, text: title }),
    el('p', { class: 'confirm__text', id: textId, text: message }),
    el('div', { class: 'confirm__actions' }, cancelBtn, okBtn),
  );
  const overlay = el('div', { class: 'confirm-overlay' }, box);

  function close(value = false) {
    if (closed) return;
    closed = true;
    overlay.remove();
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    settle(value);
  }

  cancelBtn.addEventListener('click', () => close(false));
  okBtn.addEventListener('click', () => close(true));
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close(false);
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(false);
    } else {
      trapTab(e, box);
    }
  });

  parent.append(overlay);
  cancelBtn.focus({ preventScroll: true }); // mặc định rơi vào nút an toàn
  return { result, close };
}
