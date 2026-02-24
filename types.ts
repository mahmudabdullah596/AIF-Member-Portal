
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

export type AppView = 'welcome' | 'dashboard' | 'notices' | 'about' | 'history' | 'admin-members' | 'admin-notices' | 'admin-businesses';
