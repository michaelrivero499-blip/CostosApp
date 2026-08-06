export interface Category {
  id: string;
  label: string;
  emoji: string;
  color: string;      // acento (texto, borde punteado)
  barColor: string;   // relleno pastel de la barra (Monai style)
}

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary',       label: 'Sueldo',        emoji: '💼', color: '#34C759', barColor: '#B3FFCC' },
  { id: 'freelance',    label: 'Freelance',      emoji: '💻', color: '#32ADE6', barColor: '#B3DCFF' },
  { id: 'investment',   label: 'Inversión',      emoji: '📈', color: '#5E5CE6', barColor: '#C9C5FF' },
  { id: 'gift',         label: 'Regalo',         emoji: '🎁', color: '#FF9F0A', barColor: '#FFE4B3' },
  { id: 'refund',       label: 'Reembolso',      emoji: '💳', color: '#FF6B6B', barColor: '#FFB3B3' },
  { id: 'other_income', label: 'Otros',          emoji: '✨', color: '#8E8E93', barColor: '#D4D4D4' },
];

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'food',          label: 'Comida',        emoji: '🍔', color: '#FF6B35', barColor: '#FFD4B2' },
  { id: 'transport',     label: 'Transporte',    emoji: '🚗', color: '#FF4B4B', barColor: '#FFB3B3' },
  { id: 'entertainment', label: 'Ocio',          emoji: '🎮', color: '#4B8BFF', barColor: '#B3D4FF' },
  { id: 'health',        label: 'Salud',         emoji: '💊', color: '#34C759', barColor: '#B3FFCC' },
  { id: 'home',          label: 'Hogar',         emoji: '🏠', color: '#5AC8FA', barColor: '#B3EEFF' },
  { id: 'shopping',      label: 'Compras',       emoji: '🛍️', color: '#FF4B91', barColor: '#FFB3D9' },
  { id: 'education',     label: 'Educación',     emoji: '📚', color: '#6B4BFF', barColor: '#C4B3FF' },
  { id: 'subscriptions', label: 'Suscripciones', emoji: '📱', color: '#FF9F0A', barColor: '#FFE4B3' },
  { id: 'other_expense', label: 'Otros',         emoji: '📦', color: '#8E8E93', barColor: '#D4D4D4' },
];

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export function getCategoryById(id: string): Category | undefined {
  return ALL_CATEGORIES.find(c => c.id === id);
}
