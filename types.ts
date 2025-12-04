
export interface PixKey {
  id: string;
  name: string;
  percent: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  defaultValue: number;
}

export interface AppSettings {
  pixKeys: PixKey[];
  categories: CategoryItem[];
  discountPercent: number;
}

export type TransactionStatus = 'paid' | 'pending' | 'scheduled';

export interface Transaction {
  id: string;
  clientName: string;
  category: string;
  totalValue: number;
  paidValue: number;
  eventDate: string; // ISO string YYYY-MM-DD
  paymentDate: string; // ISO string YYYY-MM-DD
  status: TransactionStatus;
  notes?: string;
}

export type PayablePeriodicity = 'mensal' | 'semanal' | 'anual' | 'unico';

export interface Payable {
  id: string;
  description: string;
  isFixed: boolean;
  amount: number;
  dueDate: string; // ISO YYYY-MM-DD
  periodicity: PayablePeriodicity;
  recurrenceIndex?: number; // 1 of 12
  recurrenceTotal?: number; // 12
  status: 'paid' | 'pending';
  paidDate?: string;
}

export interface SummaryStats {
  received: number;
  receivable: number;
}