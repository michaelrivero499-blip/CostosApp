import { Debt, DebtStatus, DebtDirection } from '../types';

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return '$' + formatted;
}

export function formatAmountShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    const k = abs / 1000;
    return `$${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return formatAmount(abs);
}

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

export const STATUS_COLORS: Record<DebtStatus, string> = {
  pendiente: '#F05B53',
  pagado: '#2ED573',
};

export const DIRECTION_COLORS: Record<DebtDirection, string> = {
  me_debe: '#F05B53',
  le_debo: '#5E60CE',
};

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
