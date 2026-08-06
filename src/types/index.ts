export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
}

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
  avatarUrl?: string;
}

export interface Debt {
  id: string;
  personId: string;
  description: string;
  amount: number;
  paidAmount?: number;          // monto pagado parcialmente (acumulado)
  partialPaymentDate?: string;  // fecha del último pago parcial
  status: DebtStatus;
  direction: DebtDirection;
  date: string;
  paidDate?: string;
  dueDate?: string;
  currency?: Currency;
  notes?: string;
  photoUrl?: string;
}
