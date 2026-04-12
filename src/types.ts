export type UserRole = 'admin' | 'employee';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  createdAt: string;
}

export type ReceiptStatus = 'Valid' | 'Fraud' | 'Incomplete' | 'Divergent';
export type ReceiptType = 'pix' | 'lottery' | 'credit_card';

export interface Receipt {
  id?: string;
  type: ReceiptType;
  transactionId: string; // For lottery/card, this might be a control number or auth code
  amount: number;
  date: string;
  payerName: string;
  receiverName: string;
  bank: string;
  location?: string; // Specific for lottery deposits
  cnpj?: string; // Specific for credit card receipts
  status: ReceiptStatus;
  uploadedBy: string;
  uploaderName?: string;
  employeeId: string;
  employeeName: string;
  createdAt: string;
  imageUrl?: string;
}

export interface Employee {
  id?: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

export interface Receiver {
  id?: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

export interface ActivityLog {
  id?: string;
  userId: string;
  action: string;
  details: string;
  timestamp: string;
}
