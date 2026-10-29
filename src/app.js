// Gắn các module đã xây: M1 (nhập liệu), M2 (Trang chủ), M3 (danh sách giao dịch), M4 (biểu đồ), M5 (tìm/lọc), M6 (Cài đặt, sáng/tối).
import { createStore } from './core/storage.js';
import { createRepo } from './core/repo.js';
import { mountHome } from './ui/home.js';
import { mountTransactionList } from './ui/tx-list.js';
import { mountCharts } from './ui/charts.js';
import { mountSearch } from './ui/search.js';
import { mountSettings } from './ui/settings.js';

const params = new URLSearchParams(location.search);
const repo = createRepo(createStore());
let settings = null; // mountSettings cần `home` (để khoá Trang chủ khi bảng mở) nên tạo sau; nút ⚙ gọi qua biến này
const home = mountHome({ repo, onOpenSettings: () => settings.open() });
settings = mountSettings({ repo, home }); // áp dụng giao diện đã lưu (sáng / tối / theo hệ thống)
const charts = mountCharts({ repo, home });
const search = mountSearch({ repo, home }); // ô tìm + nút Lọc nằm trên danh sách; bộ lọc chỉ áp lên danh sách
mountTransactionList({ repo, home, host: search.listHost, filter: search.filter });

const theme = params.get('theme'); // chỉ để thử nhanh (?theme=dark): ghi đè giao diện cho lần mở này, không lưu
if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;

if (params.has('open')) home.openEntry();
window.__repo = repo; // tiện kiểm tra bằng tay trong DevTools
window.__home = home;
window.__charts = charts;
window.__search = search;
window.__settings = settings;
