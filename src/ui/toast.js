// Thông báo (toast) DESIGN §6.9: một thông báo mỗi lần, tự đóng sau 4 giây, có thể kèm nút "Hoàn tác".
import { el } from './dom.js';

export const TOAST_DURATION = 4000;

export function createToastHost(parent = document.body) {
  const region = el('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
  parent.append(region);
  let timer = null;

  function dismiss() {
    if (timer) clearTimeout(timer);
    timer = null;
    region.replaceChildren();
  }

  function show({ message, actionLabel, onAction, duration = TOAST_DURATION, kind = 'info' }) {
    dismiss();
    const toast = el('div', { class: `toast toast--${kind}` }, el('span', { class: 'toast__text', text: message }));
    if (actionLabel) {
      toast.append(
        el('button', {
          type: 'button',
          class: 'toast__action',
          text: actionLabel,
          onClick: () => {
            dismiss();
            onAction?.();
          },
        }),
      );
    }
    region.append(toast);
    timer = setTimeout(dismiss, duration);
    return toast;
  }

  return {
    show,
    dismiss,
    element: region,
    destroy() {
      dismiss();
      region.remove();
    },
  };
}

let shared = null;
/** Toast dùng chung của ứng dụng (tạo khi cần). */
export function getToastHost() {
  if (!shared || !shared.element.isConnected) shared = createToastHost();
  return shared;
}
