import { 
  Borrower as BorrowerSchema, 
  Loan as LoanSchema, 
  Payment as PaymentSchema,
  InterestType,
  PaymentType,
  PaymentStatus
} from "@shared/schema";

// Enhanced Borrower type with loan information
export interface Borrower extends BorrowerSchema {
  loan?: {
    id: number;
    amount: number;
    formattedAmount: number;
    interestRate: number | null;
    interestType: string | null;
    formattedInterest: string;
    paymentType: string | null;
    startDate: string | Date;
    tenure: number | null;
    loanStrategy: string;
    customEmiAmount: number | null;
    flatMonthlyAmount: number | null;
  } | null;
  nextPayment?: string | null;
  status: string;
}

// Enhanced Loan type with borrower name and payment status
export interface Loan {
  id: number;
  borrowerId: number;
  amount: number;
  startDate: string;
  loanStrategy: string;
  tenure: number | null;
  interestType: string | null;
  interestRate: number | null;
  customEmiAmount: number | null;
  flatMonthlyAmount: number | null;
  paymentType: string | null;
  status: string; // 'active', 'completed', 'defaulted', 'cancelled'
  createdAt: Date | null;
  
  // Gold/Silver specific fields
  pmType: string | null;
  metalWeight: number | null;
  purity: number | null;
  netWeight: number | null;
  amountPaid: number | null;
  goldSilverNotes: string | null;
  
  // Extended properties
  borrowerName: string;
  nextPayment: string;
}

// Enhanced Payment type with borrower information
export interface Payment extends PaymentSchema {
  borrower: string;
  daysLeft?: number;
}

// Dashboard stats interface
export interface DashboardStats {
  totalLoans: number;
  activeLoans: number;
  overduePayments: number;
  totalAmount: number;
}

// Form interfaces
export interface BorrowerFormValues {
  name: string;
  phone: string;
  address: string;
  idType?: string;
  idNumber?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorAddress?: string;
}

export interface LoanFormValues {
  amount: number;
  interestType: string;
  interestRate: number;
  startDate: string;
  tenure: number;
  paymentType: string;
}

export interface PaymentFormValues {
  borrowerId: string;
  paymentId: string;
  paidDate: string;
  paidAmount: number;
  paymentMethod: string;
  notes?: string;
}

// Re-export enums from schema
export { InterestType, PaymentType, PaymentStatus };
