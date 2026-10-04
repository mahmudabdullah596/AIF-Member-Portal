
export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  joiningDate: string;
  monthlySavings: number;
  totalSaved: number;
  totalDue: number;
  profitShare: number;
  avatar: string;
  role: 'member' | 'admin';
  password?: string;
}

export interface Transaction {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  type: 'deposit' | 'due' | 'profit';
  description: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  priority: 'low' | 'medium' | 'high';
}

export interface BusinessUpdate {
  id: string;
  title: string;
  description: string;
  investmentAmount: number;
  status: 'running' | 'profitable' | 'expanding';
  imageUrl: string;
}

export interface ContactMessage {
  id: string;
  memberId: string;
  memberName: string;
  subject: string;
  message: string;
  date: string;
  status: 'new' | 'read' | 'replied';
}

export interface Ad {
  id: string;
  type: 'image' | 'video' | 'code';
  content: string;
  link?: string;
  active: boolean;
  createdAt: string;
}

export interface DepositRequest {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  fromNumber: string;
  trxId: string;
  paymentMethod: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MemberMessage {
  id: string;
  memberId: string;
  memberName: string;
  senderId: string;
  senderName: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  totalSavedAtTime?: number;
  totalDueAtTime?: number;
  channel?: 'inbox' | 'email' | 'whatsapp';
}

export type AppView = 'welcome' | 'dashboard' | 'notices' | 'about' | 'history' | 'contact' | 'profile-settings' | 'deposit' | 'admin-members' | 'admin-businesses' | 'admin-notices' | 'admin-contact' | 'admin-ads' | 'admin-deposits';
