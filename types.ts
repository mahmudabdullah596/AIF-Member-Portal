
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
  receiptNo?: string;
  trxId?: string;
  paymentMethod?: string;
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
  receiptNo?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface MoneyReceiptData {
  receiptNo: string;
  memberId: string;
  memberName: string;
  memberPhone?: string;
  amount: number;
  paymentMethod: string;
  fromNumber?: string;
  trxId: string;
  date: string;
  approvedAt?: string;
  approvedBy?: string;
  totalSavedSoFar?: number;
  purpose?: string;
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

export interface PollOption {
  id: string;
  text: string;
  votesCount: number;
}

export interface PollVoteRecord {
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  optionId: string;
  optionText: string;
  votedAt: string;
  comment?: string;
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  category: 'project' | 'policy' | 'savings' | 'welfare' | 'rules' | 'general';
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  deadline?: string;
  status: 'draft' | 'published' | 'closed';
  options: PollOption[];
  totalVotes: number;
  votes: Record<string, PollVoteRecord>;
  allowComments?: boolean;
  pinned?: boolean;
}

export type AppView = 'welcome' | 'dashboard' | 'notices' | 'about' | 'history' | 'contact' | 'profile-settings' | 'deposit' | 'voting' | 'admin-voting' | 'admin-members' | 'admin-businesses' | 'admin-notices' | 'admin-contact' | 'admin-ads' | 'admin-deposits';
