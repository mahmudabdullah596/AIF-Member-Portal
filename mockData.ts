
import { Member, Transaction, Notice, BusinessUpdate } from './types';

// Generate 50 mock members
// Added missing 'role' property to resolve TypeScript assignability error
export const members: Member[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `M-${(i + 1).toString().padStart(3, '0')}`,
  name: `সদস্য ${i + 1}`,
  email: `member${i + 1}@forum.com`,
  phone: `01712-0000${(i + 1).toString().padStart(2, '0')}`,
  joiningDate: '২০২৩-০১-০১',
  monthlySavings: 2000,
  totalSaved: 40000 + (Math.random() * 5000),
  totalDue: i % 5 === 0 ? 2000 : 0,
  profitShare: 1500 + (Math.random() * 200),
  avatar: `https://picsum.photos/seed/member${i}/200`,
  role: 'member',
}));

export const transactions: Transaction[] = [
  { id: 'tx-1', memberId: 'M-001', amount: 2000, date: '২০২৪-০৫-০৫', type: 'deposit', description: 'মে মাসের সঞ্চয়' },
  { id: 'tx-2', memberId: 'M-001', amount: 2000, date: '২০২৪-০৪-০৫', type: 'deposit', description: 'এপ্রিল মাসের সঞ্চয়' },
  { id: 'tx-3', memberId: 'M-001', amount: 2000, date: '২০২৪-০৩-০৫', type: 'deposit', description: 'মার্চ মাসের সঞ্চয়' },
  { id: 'tx-4', memberId: 'M-001', amount: 150, date: '২০২৪-০৪-৩০', type: 'profit', description: 'বিনিয়োগ লভ্যাংশ' },
];

export const notices: Notice[] = [
  {
    id: 'n-1',
    title: 'বার্ষিক সাধারণ সভা ২০২৪',
    content: 'আগামী মাসের ১৫ তারিখে আমাদের বার্ষিক সাধারণ সভা অনুষ্ঠিত হবে। সকলের উপস্থিতি কাম্য।',
    date: '২০২৪-০৫-১০',
    author: 'সাধারণ সম্পাদক',
    priority: 'high'
  },
  {
    id: 'n-2',
    title: 'নতুন ব্যবসায়িক বিনিয়োগ',
    content: 'আমরা নতুন একটি সুপারশপ ব্যবসায় বিনিয়োগ করতে যাচ্ছি। বিস্তারিত জানতে মিটিংয়ে যোগ দিন।',
    date: '২০২৪-০৫-০৮',
    author: 'সভাপতি',
    priority: 'medium'
  },
  {
    id: 'n-3',
    title: 'সঞ্চয় জমা দেওয়ার শেষ তারিখ',
    content: 'চলতি মাসের ১০ তারিখের মধ্যে সঞ্চয় জমা দেওয়ার অনুরোধ রইল।',
    date: '২০২৪-০৫-০১',
    author: 'কোষাধ্যক্ষ',
    priority: 'low'
  }
];

export const businesses: BusinessUpdate[] = [
  {
    id: 'b-1',
    title: 'মর্ডান সুপার শপ',
    description: 'আমাদের প্রধান বিনিয়োগ ক্ষেত্র। বর্তমানে এটি বেশ লাভজনক অবস্থায় আছে।',
    investmentAmount: 500000,
    status: 'profitable',
    imageUrl: 'https://picsum.photos/seed/shop/400/200'
  },
  {
    id: 'b-2',
    title: 'ই-কমার্স প্ল্যাটফর্ম',
    description: 'অনলাইনে পণ্য সরবরাহের জন্য আমাদের নতুন উদ্যোগ।',
    investmentAmount: 200000,
    status: 'running',
    imageUrl: 'https://picsum.photos/seed/ecommerce/400/200'
  },
  {
    id: 'b-3',
    title: 'কৃষি প্রজেক্ট',
    description: 'অর্গানিক সবজি চাষ ও সরবরাহের লক্ষ্য নিয়ে এটি সম্প্রসারিত হচ্ছে।',
    investmentAmount: 300000,
    status: 'expanding',
    imageUrl: 'https://picsum.photos/seed/agri/400/200'
  }
];
