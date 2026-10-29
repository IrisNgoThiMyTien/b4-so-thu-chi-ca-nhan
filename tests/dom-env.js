// Dựng môi trường trình duyệt giả (jsdom) cho các bài kiểm thử giao diện. Import đầu tiên trong file test.
import { JSDOM } from 'jsdom';

export const dom = new JSDOM('<!doctype html><html lang="vi"><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
export const win = dom.window;

Object.assign(globalThis, { window: win, document: win.document, Node: win.Node });
