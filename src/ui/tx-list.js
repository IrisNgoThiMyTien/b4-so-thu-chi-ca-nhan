// Danh sách giao dịch – module M3: giao dịch của tháng đang xem, nhóm theo ngày, chạm để sửa,
// vuốt trái (điện thoại) hoặc nút ✎ 🗑 (laptop) để sửa/xoá nhanh. DESIGN §6.4, §6.9, §8, §9.
import { el, prefersReducedMotion, uid } from './dom.js';
import { createIcon } from './icons.js';
import { openConfirm } from './confirm.js';
import { getToastHost } from './toast.js';
import { formatSignedVND, formatVND } from '../core/money.js';
import { categoryColorVar } from '../core/defaults.js';
import { todayISO } from '../core/dates.js';
import { formatMonthLabel } from '../core/months.js';
import { dayLabel, fullDayLabel, groupByDay, limitRows } from '../core/day-groups.js';

export const DEFAULT_PAGE_SIZE = 150;
const SWIPE_WIDTH = 88; // bề rộng nút Xoá lộ ra khi vuốt
const SWIPE_START = 8; // px di chuyển ngang tối thiểu để tính là vuốt
const REMOVE_MS = 200; // = --dur-base
const STORAGE_ERROR = 'Không thể xoá. Hãy xuất bản sao lưu hoặc giải phóng bộ nhớ.';

/**
 * @param {object} options
 * @param {object} options.repo
 * @param {object} [options.home]            kết quả của mountHome (M2): lấy host/month/onEdit từ đây
 * @param {HTMLElement} [options.host]       nơi gắn danh sách (mặc định home.slots.list)
 * @param {object} [options.month]           trạng thái tháng (mặc định home.month)
 * @param {(id: string) => void} [options.onEdit]  mở Trang nhập liệu ở chế độ sửa (mặc định home.openEntry)
 * @param {() => Date} [options.now]
 * @param {object} [options.toast]
 * @param {boolean} [options.animate]
 * @param {number} [options.pageSize]
 * @param {(tx) => void} [options.onDeleted]
 * @param {(tx) => void} [options.onRestored]
 * @param {object} [options.filter]          bộ lọc của M5 (tuỳ chọn): { apply(list) → list, ranges?(note) → [[bắt đầu, kết thúc)], subscribe?(fn) → huỷ }
 *                                           có thì danh sách chỉ vẽ phần apply() trả về và làm nổi đoạn ranges() của ghi chú
 */
export function mountTransactionList(options) {
  const { repo, home, now = () => new Date(), animate = true, pageSize = DEFAULT_PAGE_SIZE, onDeleted, onRestored, filter } = options;
  const host = options.host ?? home?.slots.list;
  const month = options.month ?? home?.month;
  const onEdit = options.onEdit ?? ((id) => home?.openEntry(id));
  const toast = options.toast ?? getToastHost();
  if (!host || !month) throw new Error('mountTransactionList cần host và month (hoặc home).');

  const motion = () => animate && !prefersReducedMotion();
  let limit = pageSize;
  let destroyed = false;
  let openRow = null; // { li, body, deleteBtn }
  let busy = false; // đang hiện hộp xác nhận xoá
  let pausedRender = false; // đang chạy hiệu ứng thu gọn dòng → hoãn vẽ lại
  let pendingRender = false;
  let removeTimer = null;
  let activeConfirm = null;

  const root = el('div', { class: 'tx-list', 'data-tx-list': '' });

  /* ---------- dòng phụ "Ví · ghi chú"; có bộ lọc (M5) thì đoạn ghi chú khớp từ khoá được bọc <mark> ---------- */
  function buildSub(walletName, note, text) {
    const ranges = note && filter?.ranges ? filter.ranges(note) : [];
    if (!ranges.length) return el('span', { class: 'tx__sub', text });
    const parts = walletName ? [`${walletName} · `] : [];
    let pos = 0;
    for (const [start, end] of ranges) {
      if (start > pos) parts.push(note.slice(pos, start));
      parts.push(el('mark', { class: 'tx__mark', text: note.slice(start, end) }));
      pos = end;
    }
    if (pos < note.length) parts.push(note.slice(pos));
    return el('span', { class: 'tx__sub' }, ...parts);
  }

  /* ---------- dựng một dòng ---------- */
  function buildRow(tx) {
    const category = repo.getCategory(tx.categoryId);
    const wallet = repo.getWallet(tx.walletId);
    const name = category?.name ?? 'Không rõ danh mục';
    const sub = [wallet?.name, tx.note].filter(Boolean).join(' · ');
    const kind = tx.type === 'income' ? 'Thu' : 'Chi';
    const label = `${name}${sub ? `. ${sub}` : ''}. ${kind} ${formatVND(tx.amount)}`;

    const deleteBtn = el('button', { type: 'button', class: 'tx__delete', tabindex: '-1', 'aria-hidden': 'true', 'aria-label': `Xoá khoản ${name} ${formatVND(tx.amount)}`, 'data-action': 'swipe-delete' }, createIcon('trash', 20), el('span', { text: 'Xoá' }));
    const main = el(
      'button',
      { type: 'button', class: 'tx__main', 'aria-label': label, 'data-action': 'edit' },
      el('span', { class: 'tx__icon', style: `--cat-color: ${categoryColorVar(category?.color)};` }, createIcon(category?.icon ?? 'circle-ellipsis', 20)),
      el('span', { class: 'tx__text' },
        el('span', { class: 'tx__name', text: name }),
        sub ? buildSub(wallet?.name, tx.note, sub) : null,
      ),
      el('span', { class: `tx__amount tx__amount--${tx.type}`, text: formatSignedVND(tx.type, tx.amount) }),
    );
    const tools = el('span', { class: 'tx__tools' },
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Sửa khoản ${name} ${formatVND(tx.amount)}`, 'data-action': 'tool-edit' }, createIcon('pencil', 20)),
      el('button', { type: 'button', class: 'icon-btn tx__tool-delete', 'aria-label': `Xoá khoản ${name} ${formatVND(tx.amount)}`, 'data-action': 'tool-delete' }, createIcon('trash', 20)),
    );
    const body = el('div', { class: 'tx__body' }, main, tools);
    const li = el('li', { class: 'tx', 'data-tx-id': tx.id }, deleteBtn, body);
    const row = { li, body, deleteBtn, tx };

    main.addEventListener('click', () => {
      if (row.justDragged) return;
      if (openRow === row) closeOpenRow();
      else {
        closeOpenRow();
        onEdit(tx.id);
      }
    });
    main.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        requestDelete(row);
      }
    });
    tools.querySelector('[data-action="tool-edit"]').addEventListener('click', () => onEdit(tx.id));
    tools.querySelector('[data-action="tool-delete"]').addEventListener('click', () => requestDelete(row));
    deleteBtn.addEventListener('click', () => requestDelete(row));
    attachSwipe(row);
    return row;
  }

  /* ---------- vuốt trái để lộ nút Xoá (cảm ứng / bút) ---------- */
  function setOpen(row, open) {
    row.li.classList.toggle('is-open', open);
    row.body.style.transform = open ? `translateX(${-SWIPE_WIDTH}px)` : '';
    row.deleteBtn.tabIndex = open ? 0 : -1;
    row.deleteBtn.setAttribute('aria-hidden', String(!open));
    openRow = open ? row : openRow === row ? null : openRow;
  }
  function closeOpenRow() {
    if (openRow) setOpen(openRow, false);
  }

  function attachSwipe(row) {
    let start = null;
    let dragging = false;
    let baseOffset = 0;
    let offset = 0;
    const { body } = row;

    body.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || (e.button !== undefined && e.button !== 0)) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dragging = false;
      baseOffset = openRow === row ? -SWIPE_WIDTH : 0;
      offset = baseOffset;
    });
    body.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dy) > SWIPE_START && Math.abs(dy) > Math.abs(dx)) {
          start = null; // người dùng đang cuộn dọc
          return;
        }
        if (Math.abs(dx) < SWIPE_START) return;
        dragging = true;
        if (openRow && openRow !== row) closeOpenRow();
        row.li.classList.add('is-dragging');
        body.setPointerCapture?.(start.id);
      }
      offset = Math.min(0, Math.max(-SWIPE_WIDTH, baseOffset + dx));
      body.style.transform = `translateX(${offset}px)`;
    });
    const finish = () => {
      if (!start) return;
      const wasDragging = dragging;
      start = null;
      dragging = false;
      if (!wasDragging) return;
      row.li.classList.remove('is-dragging');
      row.justDragged = true; // chặn "click" sinh ra ngay sau khi nhả tay
      setTimeout(() => (row.justDragged = false), 0);
      setOpen(row, offset <= -SWIPE_WIDTH / 2);
    };
    body.addEventListener('pointerup', finish);
    body.addEventListener('pointercancel', finish);
  }

  const onOutsidePointer = (e) => {
    if (openRow && !openRow.li.contains(e.target)) closeOpenRow();
  };
  document.addEventListener('pointerdown', onOutsidePointer, true);

  /* ---------- xoá + hoàn tác ---------- */
  async function requestDelete(row) {
    if (busy || destroyed) return;
    busy = true;
    closeOpenRow();
    activeConfirm = openConfirm({
      title: 'Xoá khoản này?',
      message: 'Hành động này có thể hoàn tác trong 4 giây.',
      confirmLabel: 'Xoá',
      cancelLabel: 'Huỷ',
      danger: true,
    });
    const confirmed = await activeConfirm.result;
    activeConfirm = null;
    busy = false;
    if (!confirmed || destroyed) return;

    const collapse = motion() && row.li.isConnected;
    if (collapse) {
      pausedRender = true;
      row.li.style.height = `${row.li.offsetHeight}px`;
      void row.li.offsetHeight;
      row.li.classList.add('is-removing');
      row.li.style.height = '0px';
    }
    const res = repo.remove(row.tx.id);
    if (!res.ok) {
      pausedRender = false;
      row.li.classList.remove('is-removing');
      row.li.style.height = '';
      toast.show({ message: res.error === 'not-found' ? 'Khoản này không còn tồn tại.' : STORAGE_ERROR, kind: 'error' });
      return;
    }
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
    if (collapse) {
      removeTimer = setTimeout(() => {
        pausedRender = false;
        if (!destroyed) render();
      }, REMOVE_MS);
    }
  }

  /* ---------- vẽ danh sách ---------- */
  function render() {
    if (destroyed) return;
    if (pausedRender) {
      pendingRender = true;
      return;
    }
    pendingRender = false;
    openRow = null;
    const ym = month.get();
    const all = filter ? filter.apply(repo.listByMonth(ym)) : repo.listByMonth(ym);
    if (all.length === 0) {
      root.replaceChildren();
      host.replaceChildren(); // để ô trống (:empty) – Trang chủ tự hiện trạng thái trống
      return;
    }
    const today = todayISO(now());
    const { groups, shown, total } = limitRows(groupByDay(all), limit);
    const sections = groups.map((g) => {
      const headId = uid('day');
      const net = g.net;
      const sign = net > 0 ? '+' : net < 0 ? '−' : '';
      const sum = `${sign}${formatVND(Math.abs(net))}`;
      return el('section', { class: 'tx-day', 'aria-labelledby': headId },
        el('div', { class: 'tx-day__head' },
          el('h3', { class: 'tx-day__title', id: headId, text: dayLabel(g.date, today), title: fullDayLabel(g.date) }),
          el('span', { class: 'tx-day__sum', 'aria-label': `Tổng ròng trong ngày ${net < 0 ? 'âm ' : ''}${formatVND(Math.abs(net))}`, text: sum }),
        ),
        el('ul', { class: 'tx-day__list' }, g.items.map((tx) => buildRow(tx).li)),
      );
    });
    root.replaceChildren(...sections);
    if (shown < total) {
      const more = Math.min(pageSize, total - shown);
      root.append(
        el('button', {
          type: 'button',
          class: 'btn btn--secondary tx-list__more',
          'data-action': 'show-more',
          text: `Xem thêm ${more} khoản`,
          'aria-label': `Xem thêm ${more} khoản, còn ${total - shown} khoản chưa hiển thị`,
          onClick: () => {
            limit += pageSize;
            const firstNew = shown;
            render();
            root.querySelectorAll('.tx__main')[firstNew]?.focus({ preventScroll: false });
          },
        }),
      );
    }
    root.setAttribute('aria-label', `Giao dịch ${formatMonthLabel(ym).toLowerCase()}`);
    root.setAttribute('role', 'region');
    if (host.firstChild !== root || host.childNodes.length !== 1) host.replaceChildren(root);
  }

  const unsubRepo = repo.subscribe(render);
  const unsubMonth = month.subscribe(() => {
    limit = pageSize;
    render();
  });
  const unsubFilter = filter?.subscribe?.(() => {
    limit = pageSize; // đổi bộ lọc thì quay lại trang đầu
    render();
  });
  render();

  return {
    element: root,
    refresh: render,
    /** Số dòng đang hiển thị trên màn hình. */
    visibleCount: () => root.querySelectorAll('.tx').length,
    closeSwipe: closeOpenRow,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(removeTimer);
      activeConfirm?.close(false);
      unsubRepo();
      unsubMonth();
      unsubFilter?.();
      document.removeEventListener('pointerdown', onOutsidePointer, true);
      root.remove();
    },
  };
}
