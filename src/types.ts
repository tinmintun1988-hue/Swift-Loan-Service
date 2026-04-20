export type Language = 'en' | 'my';

export interface Settings {
  interestRate: number;
  penaltyRate: number;
  discount: number;
  expireDays: number;
  method: 'flat' | 'compound' | 'penalty';
  bank: string;
  account: string;
  holder: string;
  pin: string;
  lang: Language;
  theme: 'light' | 'dark';
  qrImage?: string;
  logoImage?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
}

export interface LoanEntry {
  id: number;
  customerId: number;
  date: string;
  loanAmount: number;
  repayAmount: number;
  type: string;
  notes: string;
}

export interface CustomerStats {
  totalLoaned: number;
  totalRepaid: number;
  outstanding: number;
  rate: number;
  loans: LoanEntry[];
}
