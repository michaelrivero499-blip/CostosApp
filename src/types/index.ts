export type DebtStatus = 'pendiente' | 'pagado';
export type DebtDirection = 'me_debe' | 'le_debo';
export type Currency = 'ARS' | 'USD' | 'UYU' | 'BRL';

export type PeriodFilter =
  | { mode: 'total' }
  | { mode: 'month'; year: number; month: number };

export interface Person {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface Debt {
  id: string;
  personId: string;
  description: string;
  amount: number;
  status: DebtStatus;
  direction: DebtDirection;
  date: string;
  paidDate?: string;
  currency?: Currency;
}
