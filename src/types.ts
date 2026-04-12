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

export interface Receipt {
  id?: string;
  transactionId: string;
  amount: number;
  date: string;
  payerName: string;
  receiverName: string;
  bank: string;
  status: ReceiptStatus;
  uploadedBy: string;
  createdAt: string;
  imageUrl?: string;
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
