import { Debt, DebtStatus, DebtDirection, Currency } from '../types';

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Currency config ──────────────────────────────────────────────────────────

export const CURRENCY_ORDER: Currency[] = ['ARS', 'USD', 'UYU', 'BRL'];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ARS: '$',
  USD: 'US$',
  UYU: '$U',
  BRL: 'R$',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  ARS: 'Pesos',
  USD: 'Dólares',
  UYU: 'Pesos UY',
  BRL: 'Reales',
};

// ── Formatting ───────────────────────────────────────────────────────────────

function separateThousands(n: number): string {
  return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatAmount(amount: number): string {
  return '$' + separateThousands(amount);
}

export function formatAmountCurrency(amount: number, currency: Currency = 'ARS'): string {
  return CURRENCY_SYMBOLS[currency] + separateThousands(amount);
}

export function formatAmountShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    const k = abs / 1000;
    return `$${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return formatAmount(abs);
}

export function formatAmountShortCurrency(amount: number, currency: Currency = 'ARS'): string {
  const abs = Math.abs(amount);
  const sym = CURRENCY_SYMBOLS[currency];
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sym}${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return formatAmountCurrency(abs, currency);
}

// ── Debt calculations ─────────────────────────────────────────────────────────

export function getPersonMeDebe(debts: Debt[]): number {
  return debts
    .filter(d => d.status === 'pendiente' && d.direction === 'me_debe')
    .reduce((sum, d) => sum + d.amount, 0);
}

export function getPersonLeDebo(debts: Debt[]): number {
  return debts
    .filter(d => d.status === 'pendiente' && d.direction === 'le_debo')
    .reduce((sum, d) => sum + d.amount, 0);
}

export function getPersonNet(debts: Debt[]): number {
  return getPersonMeDebe(debts) - getPersonLeDebo(debts);
}

export function getPersonTotal(debts: Debt[]): number {
  return getPersonNet(debts);
}

export function getPersonStatus(debts: Debt[]): DebtStatus {
  return debts.some(d => d.status === 'pendiente') ? 'pendiente' : 'pagado';
}

// Returns non-zero per-currency nets for active debts, ordered by CURRENCY_ORDER
export function getPersonNetByCurrency(debts: Debt[]): { currency: Currency; net: number }[] {
  const totals: Record<Currency, number> = { ARS: 0, USD: 0, UYU: 0, BRL: 0 };
  debts
    .filter(d => d.status === 'pendiente')
    .forEach(d => {
      const c = (d.currency ?? 'ARS') as Currency;
      totals[c] += d.direction === 'me_debe' ? d.amount : -d.amount;
    });
  return CURRENCY_ORDER
    .filter(c => totals[c] !== 0)
    .map(c => ({ currency: c, net: totals[c] }));
}

// ── Color maps ────────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<DebtStatus, string> = {
  pendiente: '#F05B53',
  pagado: '#2ED573',
};

export const DIRECTION_COLORS: Record<DebtDirection, string> = {
  me_debe: '#F05B53',
  le_debo: '#5E60CE',
};

// ── Avatar options ────────────────────────────────────────────────────────────

export const AVATAR_OPTIONS = [
  { emoji: '🌸', color: '#FFE0B2' },
  { emoji: '👤', color: '#BBDEFB' },
  { emoji: '💜', color: '#E1BEE7' },
  { emoji: '⭐', color: '#FFF9C4' },
  { emoji: '🔥', color: '#FFCCBC' },
  { emoji: '🎯', color: '#C8E6C9' },
  { emoji: '🎸', color: '#B3E5FC' },
  { emoji: '🍕', color: '#F8BBD0' },
  { emoji: '🐶', color: '#D7CCC8' },
  { emoji: '🦋', color: '#F0F4C3' },
  { emoji: '🎮', color: '#CFD8DC' },
  { emoji: '🏋️', color: '#DCEDC8' },
];
