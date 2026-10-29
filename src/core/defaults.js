// Dữ liệu mặc định theo PRD §4.3: danh mục Thu/Chi, ví, màu danh mục theo DESIGN §2.3.
export const SCHEMA_VERSION = 1;

export const CATEGORY_COLOR_KEYS = ['eat', 'move', 'home', 'shop', 'fun', 'health', 'study', 'other'];

/** "var(--cat-eat)" cho khoá màu hợp lệ; giá trị lạ (dữ liệu hỏng/độc hại) rơi về màu "khác" để không chèn được CSS. */
export function categoryColorVar(color) {
  return `var(--cat-${CATEGORY_COLOR_KEYS.includes(color) ? color : 'other'})`;
}

export const DEFAULT_CATEGORIES = [
  { id: 'cat-expense-food', name: 'Ăn uống', type: 'expense', icon: 'utensils', color: 'eat' },
  { id: 'cat-expense-transport', name: 'Di chuyển', type: 'expense', icon: 'bus', color: 'move' },
  { id: 'cat-expense-home', name: 'Nhà ở', type: 'expense', icon: 'home', color: 'home' },
  { id: 'cat-expense-shopping', name: 'Mua sắm', type: 'expense', icon: 'shopping-bag', color: 'shop' },
  { id: 'cat-expense-fun', name: 'Giải trí', type: 'expense', icon: 'gamepad', color: 'fun' },
  { id: 'cat-expense-health', name: 'Sức khoẻ', type: 'expense', icon: 'heart-pulse', color: 'health' },
  { id: 'cat-expense-study', name: 'Học tập', type: 'expense', icon: 'book-open', color: 'study' },
  { id: 'cat-expense-other', name: 'Khác', type: 'expense', icon: 'circle-ellipsis', color: 'other' },
  { id: 'cat-income-salary', name: 'Lương', type: 'income', icon: 'wallet', color: 'health' },
  { id: 'cat-income-bonus', name: 'Thưởng', type: 'income', icon: 'gift', color: 'shop' },
  { id: 'cat-income-side', name: 'Làm thêm', type: 'income', icon: 'briefcase', color: 'study' },
  { id: 'cat-income-other', name: 'Khác', type: 'income', icon: 'circle-ellipsis', color: 'other' },
];

export const DEFAULT_WALLETS = [
  { id: 'wallet-cash', name: 'Tiền mặt', icon: 'banknote' },
  { id: 'wallet-bank', name: 'Ngân hàng', icon: 'landmark' },
  { id: 'wallet-ewallet', name: 'Ví điện tử', icon: 'smartphone' },
];

export function createDefaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    wallets: DEFAULT_WALLETS.map((w) => ({ ...w })),
    settings: {
      theme: 'system',
      budgetEnabled: false,
      budgets: {},
      lastWalletId: null,
    },
  };
}
