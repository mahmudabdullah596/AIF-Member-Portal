
import React, { useState, useEffect, useRef } from 'react';
import { Member, AppView, Transaction, Notice, BusinessUpdate } from './types';
import { members as initialMembers, transactions as initialTransactions, notices as initialNotices, businesses as initialBusinesses } from './mockData';
import { getForumSupport } from './geminiService';
import { db as firestore } from './firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Bell, 
  Info, 
  History, 
  LogOut, 
  MessageSquare, 
  TrendingUp, 
  Wallet, 
  AlertCircle,
  Menu,
  X,
  Send,
  UserCog,
  Plus,
  Trash2,
  Edit,
  Camera,
  ShieldCheck,
  Briefcase,
  UserPlus,
  Moon,
  Sun,
  CheckCircle,
  Coins,
  Users,
  Calendar,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

const App: React.FC = () => {
  // Global States
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<BusinessUpdate[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isNoticePanelOpen, setIsNoticePanelOpen] = useState(false);
  
  // Auth states
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // AI states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Google Sheets states
  const [googleTokens, setGoogleTokens] = useState<any>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Admin Modals/Edit states
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<BusinessUpdate | null>(null);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddNoticeModal, setShowAddNoticeModal] = useState(false);
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState<{ member: Member } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const businessImageRef = useRef<HTMLInputElement>(null);
  const editBusinessImageRef = useRef<HTMLInputElement>(null);

  // Sync with system preference
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Fetch Initial Data
  useEffect(() => {
    // Real-time listeners for Firebase
    const unsubMembers = onSnapshot(collection(firestore, 'members'), (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Member));
      setAllMembers(membersData);
      setIsLoading(false);
    }, (error) => {
      console.error("Members listener error:", error);
      setIsLoading(false);
    });

    const unsubNotices = onSnapshot(query(collection(firestore, 'notices'), orderBy('date', 'desc')), (snapshot) => {
      const noticesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notice));
      setAllNotices(noticesData);
    }, (error) => {
      console.error("Notices listener error:", error);
    });

    const unsubBusinesses = onSnapshot(collection(firestore, 'businesses'), (snapshot) => {
      const businessesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BusinessUpdate));
      setAllBusinesses(businessesData);
    }, (error) => {
      console.error("Businesses listener error:", error);
    });

    const unsubTransactions = onSnapshot(query(collection(firestore, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      setAllTransactions(transactionsData);
    }, (error) => {
      console.error("Transactions listener error:", error);
    });

    return () => {
      unsubMembers();
      unsubNotices();
      unsubBusinesses();
      unsubTransactions();
    };
  }, []);

  // Google Auth Listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setGoogleTokens(event.data.tokens);
        alert('গুগল অ্যাকাউন্ট সফলভাবে কানেক্ট হয়েছে!');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Derive active member data
  const activeMember = currentUser ? allMembers.find(m => m.id === currentUser.id) : null;
  const userTransactions = activeMember ? allTransactions.filter(t => t.memberId === activeMember.id) : [];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginId === 'AM2003' && loginPass === 'Am1653@#') {
      const adminUser: Member = {
        id: 'AM2003',
        name: 'সুপার এডমিন',
        email: 'admin@al-ittehad.com',
        phone: '00000',
        joiningDate: '২০২৪-০১-০১',
        monthlySavings: 0,
        totalSaved: 0,
        totalDue: 0,
        profitShare: 0,
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=059669&color=fff',
        role: 'admin'
      };
      setCurrentUser(adminUser);
      setIsLoggedIn(true);
      setView('dashboard');
      return;
    }
    const user = allMembers.find(m => m.id === loginId);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      setView('dashboard');
    } else {
      alert('ভুল সদস্য আইডি বা পাসওয়ার্ড!');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setView('dashboard');
    setSidebarOpen(false);
    setIsNoticePanelOpen(false);
    setLoginId('');
    setLoginPass('');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAllMembers(prev => prev.map(m => m.id === currentUser.id ? { ...m, avatar: base64String } : m));
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Functional Logic ---

  const deleteMember = async (id: string) => {
    if (window.confirm('আপনি কি এই সদস্যকে ডিলিট করতে চান?')) {
      try {
        await deleteDoc(doc(firestore, 'members', id));
        // Transactions deletion for this member would ideally be a cloud function or batch
        // For simplicity in client-side:
        const memberTxs = allTransactions.filter(t => t.memberId === id);
        for (const tx of memberTxs) {
          await deleteDoc(doc(firestore, 'transactions', tx.id));
        }
      } catch (error) {
        alert('ডিলিট করতে সমস্যা হয়েছে।');
      }
    }
  };

  const deleteNotice = async (id: string) => {
    if (window.confirm('আপনি কি এই নোটিশটি ডিলিট করতে চান?')) {
      try {
        await deleteDoc(doc(firestore, 'notices', id));
      } catch (error) {
        alert('ডিলিট করতে সমস্যা হয়েছে।');
      }
    }
  };

  const deleteBusiness = async (id: string) => {
    if (window.confirm('আপনি কি এই প্রজেক্টটি ডিলিট করতে চান?')) {
      try {
        await deleteDoc(doc(firestore, 'businesses', id));
      } catch (error) {
        alert('ডিলিট করতে সমস্যা হয়েছে।');
      }
    }
  };

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newId = formData.get('id') as string;
    if (allMembers.some(m => m.id === newId)) {
      alert('এই আইডিটি ইতিমধ্যে ব্যবহৃত হচ্ছে!');
      return;
    }
    const newMember: Member = {
      id: newId,
      name: formData.get('name') as string,
      email: `${newId}@al-ittehad.com`,
      phone: formData.get('phone') as string || '01xxx-xxxxxx',
      joiningDate: new Date().toLocaleDateString('bn-BD'),
      monthlySavings: Number(formData.get('monthly')) || 2000,
      totalSaved: 0,
      totalDue: 0,
      profitShare: 0,
      avatar: `https://ui-avatars.com/api/?name=${formData.get('name')}&background=059669&color=fff`,
      role: 'member'
    };

    try {
      await setDoc(doc(firestore, 'members', newId), newMember);
      setShowAddMemberModal(false);
    } catch (error) {
      alert('সদস্য যোগ করতে সমস্যা হয়েছে।');
    }
  };

  const handleAddBusiness = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const businessId = `b-${Date.now()}`;
    
    let imageUrl = `https://picsum.photos/seed/${Date.now()}/800/600`;
    const imageFile = businessImageRef.current?.files?.[0];
    
    if (imageFile) {
      imageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageFile);
      });
    }

    const newBusiness: BusinessUpdate = {
      id: businessId,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      investmentAmount: Number(formData.get('investment')),
      status: 'running',
      imageUrl
    };

    try {
      await setDoc(doc(firestore, 'businesses', businessId), newBusiness);
      setShowAddBusinessModal(false);
    } catch (error) {
      console.error(error);
      alert('প্রজেক্ট যোগ করতে সমস্যা হয়েছে। ফায়ারবেজ পারমিশন চেক করুন।');
    }
  };

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showAddPaymentModal) return;
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const description = formData.get('description') as string;
    const date = (formData.get('date') as string) || new Date().toLocaleDateString('bn-BD');

    const txId = `tx-${Date.now()}`;
    const newTx: Transaction = {
      id: txId,
      memberId: showAddPaymentModal.member.id,
      amount,
      date,
      type: 'deposit',
      description
    };

    try {
      await setDoc(doc(firestore, 'transactions', txId), newTx);
      const memberRef = doc(firestore, 'members', showAddPaymentModal.member.id);
      await updateDoc(memberRef, {
        totalSaved: showAddPaymentModal.member.totalSaved + amount
      });
      setShowAddPaymentModal(null);
      alert('পেমেন্ট সফলভাবে যোগ করা হয়েছে।');
    } catch (error) {
      alert('পেমেন্ট যোগ করতে সমস্যা হয়েছে।');
    }
  };

  const saveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMember) {
      try {
        const memberRef = doc(firestore, 'members', editingMember.id);
        const { id, ...updateData } = editingMember;
        await updateDoc(memberRef, updateData);
        setEditingMember(null);
      } catch (error) {
        alert('আপডেট করতে সমস্যা হয়েছে।');
      }
    }
  };

  const saveBusinessEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBusiness) {
      try {
        let imageUrl = editingBusiness.imageUrl;
        const imageFile = editBusinessImageRef.current?.files?.[0];
        
        if (imageFile) {
          imageUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(imageFile);
          });
        }

        const businessRef = doc(firestore, 'businesses', editingBusiness.id);
        const { id, ...updateData } = { ...editingBusiness, imageUrl };
        await updateDoc(businessRef, updateData);
        setEditingBusiness(null);
      } catch (error) {
        console.error(error);
        alert('আপডেট করতে সমস্যা হয়েছে। ফায়ারবেজ পারমিশন চেক করুন।');
      }
    }
  };

  const handleAddNotice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const noticeId = `n-${Date.now()}`;
    const newNotice: Notice = {
      id: noticeId,
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      date: new Date().toLocaleDateString('bn-BD'),
      author: formData.get('author') as string || 'সভাপতি',
      priority: formData.get('priority') as any || 'medium'
    };

    try {
      await setDoc(doc(firestore, 'notices', noticeId), newNotice);
      setShowAddNoticeModal(false);
    } catch (error) {
      alert('নোটিশ যোগ করতে সমস্যা হয়েছে।');
    }
  };

  const saveNoticeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingNotice) {
      try {
        const noticeRef = doc(firestore, 'notices', editingNotice.id);
        const { id, ...updateData } = editingNotice;
        await updateDoc(noticeRef, updateData);
        setEditingNotice(null);
      } catch (error) {
        alert('আপডেট করতে সমস্যা হয়েছে।');
      }
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (error) {
      console.error('Error connecting to Google:', error);
      alert('গুগল কানেক্ট করতে সমস্যা হয়েছে।');
    }
  };

  const handleSyncGoogleSheets = async () => {
    if (!googleTokens || !spreadsheetId) {
      alert('অনুগ্রহ করে গুগল কানেক্ট করুন এবং স্প্রেডশিট আইডি দিন।');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/gsheets/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: googleTokens,
          spreadsheetId,
          range: 'Sheet1!A2:E100' // Assuming header is in row 1
        })
      });

      const data = await response.json();
      if (data.values) {
        const updatedMembers = data.values.map((row: any[]) => ({
          id: row[0],
          name: row[1],
          email: `${row[0]}@al-ittehad.com`,
          phone: '01xxx-xxxxxx',
          joiningDate: '২০২৪-০১-০১',
          monthlySavings: 2000,
          totalSaved: Number(row[2]) || 0,
          totalDue: Number(row[3]) || 0,
          profitShare: Number(row[4]) || 0,
          avatar: `https://ui-avatars.com/api/?name=${row[1]}&background=059669&color=fff`,
          role: 'member'
        }));

        setAllMembers(updatedMembers);
        alert('গুগল শিট থেকে ডাটা সফলভাবে সিঙ্ক হয়েছে!');
      }
    } catch (error) {
      console.error('Error syncing Google Sheets:', error);
      alert('ডাটা সিঙ্ক করতে সমস্যা হয়েছে।');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
    setIsAiLoading(true);
    const aiResponse = await getForumSupport(msg, activeMember || currentUser);
    setChatHistory(prev => [...prev, { role: 'ai', text: aiResponse }]);
    setIsAiLoading(false);
  };

  // --- Styling Constants ---
  const cardClass = `rounded-[32px] shadow-xl border p-6 transition-all duration-300 bg-white dark:bg-slate-800/90 border-gray-100 dark:border-slate-700 backdrop-blur-sm`;
  const textPrimary = `text-slate-900 dark:text-slate-50`;
  const textSecondary = `text-slate-500 dark:text-slate-400`;

  // --- Views ---

  const renderWelcome = () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 p-6 md:p-12 rounded-[32px] md:rounded-[48px] shadow-2xl border border-gray-100 dark:border-slate-800 max-w-md w-full text-center relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl"></div>
        <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-600 rounded-2xl md:rounded-3xl mx-auto flex items-center justify-center mb-6 md:mb-8 shadow-xl">
          <TrendingUp className="text-white w-8 h-8 md:w-10 md:h-10" />
        </div>
        <h1 className={`text-3xl md:text-4xl font-black mb-2 tracking-tight ${textPrimary}`}>আল ইত্তেহাদ ফোরাম</h1>
        <p className={`${textSecondary} mb-8 md:mb-10 font-medium text-sm md:text-base`}>সদস্য পোর্টাল ও ম্যানেজমেন্ট সিস্টেম</p>
        <form onSubmit={handleLogin} className="space-y-4 text-left relative z-10">
          <input 
            type="text" 
            placeholder="সদস্য আইডি"
            className={`w-full px-5 py-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-emerald-500 outline-none ${textPrimary}`}
            value={loginId} onChange={(e) => setLoginId(e.target.value)} required
          />
          <input 
            type="password" 
            placeholder="পাসওয়ার্ড"
            className={`w-full px-5 py-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-emerald-500 outline-none ${textPrimary}`}
            value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required
          />
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl md:rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
            প্রবেশ করুন <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 shadow-xl transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full">
        <div className="p-8 bg-emerald-600 text-white flex items-center justify-between rounded-br-[40px] shadow-lg">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight">আল ইত্তেহাদ</span>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}><X /></button>
        </div>
        <nav className="flex-1 p-6 space-y-2 mt-4 overflow-y-auto">
          <button onClick={() => { setView('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
            <LayoutDashboard size={20} /> <span className="font-bold">ড্যাশবোর্ড</span>
          </button>
          <button onClick={() => { setView('notices'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'notices' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
            <Bell size={20} /> <span className="font-bold">নোটিশ বোর্ড</span>
          </button>
          {currentUser?.role === 'admin' && (
            <>
              <div className="pt-8 pb-2 px-5 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">এডমিন প্যানেল</div>
              <button onClick={() => { setView('admin-members'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'admin-members' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
                <UserCog size={20} /> <span className="font-bold">সদস্য ব্যবস্থাপনা</span>
              </button>
              <button onClick={() => { setView('admin-businesses'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'admin-businesses' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
                <Briefcase size={20} /> <span className="font-bold">প্রজেক্ট কন্ট্রোল</span>
              </button>
              <button onClick={() => { setView('admin-notices'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'admin-notices' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
                <Bell size={20} /> <span className="font-bold">নোটিশ নিয়ন্ত্রণ</span>
              </button>
            </>
          )}
          <button onClick={() => { setView('about'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'about' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
            <Info size={20} /> <span className="font-bold">আমাদের সম্পর্কে</span>
          </button>
        </nav>
        <div className="p-6 space-y-3">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center justify-between px-5 py-3 rounded-2xl border border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
            <span className="text-sm font-bold">{isDarkMode ? 'লাইট মোড' : 'ডার্ক মোড'}</span>
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-4 text-rose-500 font-bold hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-2xl transition-all">
            <LogOut size={20} /> লগআউট
          </button>
        </div>
      </div>
    </div>
  );

  const renderMemberDashboard = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700">
      <div className={`${cardClass} border-none bg-gradient-to-br from-emerald-600 to-green-700 text-white p-6 md:p-8 relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 relative z-10">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img src={activeMember?.avatar} className="w-24 h-24 md:w-36 md:h-36 rounded-2xl md:rounded-3xl object-cover border-4 border-white/20 shadow-2xl" />
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black inline-block mb-2 md:mb-3 uppercase tracking-widest">ID: {activeMember?.id}</div>
            <h2 className="text-2xl md:text-4xl font-black mb-1">{activeMember?.name}</h2>
            <p className="opacity-90 flex items-center justify-center md:justify-start gap-2 text-sm"><Calendar size={14} /> জয়েনিং: {activeMember?.joiningDate}</p>
          </div>
          <div className="flex gap-3 md:gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-none bg-white/10 p-4 md:p-6 rounded-2xl md:rounded-[32px] text-center border border-white/10">
              <div className="text-[10px] opacity-60 uppercase font-black mb-1">মোট সঞ্চয়</div>
              <div className="text-xl md:text-2xl font-black">৳{activeMember?.totalSaved.toLocaleString()}</div>
            </div>
            <div className="flex-1 md:flex-none bg-white/10 p-4 md:p-6 rounded-2xl md:rounded-[32px] text-center border border-white/10">
              <div className="text-[10px] opacity-60 uppercase font-black mb-1">লভ্যাংশ</div>
              <div className="text-xl md:text-2xl font-black">৳{activeMember?.profitShare.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
        <div className={`lg:col-span-3 ${cardClass} p-6 md:p-8`}>
          <h3 className={`font-black text-lg md:text-xl mb-6 flex items-center gap-2 ${textPrimary}`}><Wallet size={20} className="text-emerald-600" /> আর্থিক স্থিতি</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            <div className="p-5 md:p-6 bg-slate-50 dark:bg-slate-700/50 rounded-2xl md:rounded-3xl">
              <div className="text-[10px] opacity-50 uppercase font-black mb-1">মাসিক সঞ্চয় হার</div>
              <div className={`text-2xl md:text-3xl font-black ${textPrimary}`}>৳{activeMember?.monthlySavings.toLocaleString()}</div>
            </div>
            <div className="p-5 md:p-6 bg-rose-50 dark:bg-rose-900/10 rounded-2xl md:rounded-3xl">
              <div className="text-[10px] text-rose-400 uppercase font-black mb-1">মোট বকেয়া</div>
              <div className="text-2xl md:text-3xl font-black text-rose-600">৳{activeMember?.totalDue.toLocaleString()}</div>
            </div>
            <div className="p-5 md:p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl md:rounded-3xl">
              <div className="text-[10px] text-emerald-500 uppercase font-black mb-1">স্ট্যাটাস</div>
              <div className="text-xl md:text-2xl font-black text-emerald-600 uppercase">সক্রিয়</div>
            </div>
          </div>
        </div>
        <div className={`${cardClass} lg:col-span-1 flex flex-col items-center justify-center text-center p-6 md:p-8`}>
          <MessageSquare className="text-emerald-600 w-8 h-8 md:w-10 md:h-10 mb-4" />
          <h4 className={`font-black mb-3 ${textPrimary}`}>ডিজিটাল সহায়তা</h4>
          <button onClick={() => setIsChatOpen(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 md:py-4 rounded-xl md:rounded-2xl shadow-lg transition-all active:scale-95">এআই চ্যাট শুরু</button>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex justify-between items-center mb-8">
          <h3 className={`font-black text-xl flex items-center gap-2 ${textPrimary}`}><History size={20} className="text-emerald-600" /> লেনদেন ইতিহাস</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-4 text-[10px] uppercase font-black text-slate-400">তারিখ</th>
                <th className="pb-4 text-[10px] uppercase font-black text-slate-400">বিবরণ</th>
                <th className="pb-4 text-[10px] uppercase font-black text-slate-400 text-right">পরিমাণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {userTransactions.map(t => (
                <tr key={t.id}>
                  <td className={`py-4 text-sm font-medium ${textSecondary}`}>{t.date}</td>
                  <td className={`py-4 text-sm font-bold ${textPrimary}`}>{t.description}</td>
                  <td className={`py-4 text-sm font-black text-right ${t.type === 'deposit' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    ৳{t.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {userTransactions.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-400 font-bold uppercase">কোনো লেনদেন রেকর্ড নেই</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700">
      <div className={`${cardClass} border-none bg-gradient-to-br from-emerald-600 to-green-700 text-white p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10`}>
        <ShieldCheck size={48} className="md:w-16 md:h-16" />
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl md:text-4xl font-black mb-2 uppercase tracking-tight">এডমিন ড্যাশবোর্ড</h2>
          <p className="opacity-90 max-w-xl text-sm md:text-base">ফোরামের সদস্য ব্যবস্থাপনা, আর্থিক লেনদেন এবং প্রজেক্ট নিয়ন্ত্রণ কেন্দ্র।</p>
        </div>
        <div className="bg-white/10 p-4 md:p-6 rounded-2xl md:rounded-[32px] text-center border border-white/10 min-w-[120px] md:min-w-[140px]">
          <div className="text-3xl md:text-4xl font-black">{allMembers.length}</div>
          <div className="text-[10px] uppercase font-black opacity-60">মোট সদস্য</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className={`${cardClass} flex flex-col md:flex-row items-center gap-3 md:gap-5 p-4 md:p-6`}><Users size={24} className="text-emerald-600 md:w-8 md:h-8" /><div><div className={`text-xl md:text-2xl font-black ${textPrimary}`}>{allMembers.length}</div><div className="text-[10px] uppercase font-black text-slate-400">সদস্য</div></div></div>
        <div className={`${cardClass} flex flex-col md:flex-row items-center gap-3 md:gap-5 p-4 md:p-6`}><Briefcase size={24} className="text-blue-600 md:w-8 md:h-8" /><div><div className={`text-xl md:text-2xl font-black ${textPrimary}`}>{allBusinesses.length}</div><div className="text-[10px] uppercase font-black text-slate-400">প্রজেক্ট</div></div></div>
        <div className={`${cardClass} flex flex-col md:flex-row items-center gap-3 md:gap-5 p-4 md:p-6`}><Bell size={24} className="text-rose-600 md:w-8 md:h-8" /><div><div className={`text-xl md:text-2xl font-black ${textPrimary}`}>{allNotices.length}</div><div className="text-[10px] uppercase font-black text-slate-400">নোটিশ</div></div></div>
        <div className={`${cardClass} flex flex-col md:flex-row items-center gap-3 md:gap-5 p-4 md:p-6`}><Coins size={24} className="text-amber-600 md:w-8 md:h-8" /><div><div className={`text-lg md:text-2xl font-black ${textPrimary}`}>৳{(allMembers.reduce((a,m)=>a+m.totalSaved,0)).toLocaleString()}</div><div className="text-[10px] uppercase font-black text-slate-400">মোট সঞ্চয়</div></div></div>
      </div>

      <div className={cardClass}>
        <h3 className={`font-black text-xl mb-6 flex items-center gap-2 ${textPrimary}`}><TrendingUp size={20} className="text-emerald-600" /> গুগল শিট ইন্টিগ্রেশন</h3>
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 space-y-2">
            <label className={`block text-[10px] font-black uppercase ${textSecondary}`}>গুগল স্প্রেডশিট আইডি</label>
            <input 
              type="text" 
              placeholder="Spreadsheet ID (e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)"
              className={`w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-emerald-500 outline-none ${textPrimary}`}
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            {!googleTokens ? (
              <button 
                onClick={handleConnectGoogle}
                className="bg-white dark:bg-slate-800 border-2 border-emerald-600 text-emerald-600 px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95"
              >
                গুগল কানেক্ট করুন
              </button>
            ) : (
              <button 
                onClick={handleSyncGoogleSheets}
                disabled={isSyncing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {isSyncing ? 'সিঙ্ক হচ্ছে...' : 'শিট থেকে ডাটা আনুন'}
              </button>
            )}
          </div>
        </div>
        <p className={`mt-4 text-xs ${textSecondary}`}>
          * শিটের ফরম্যাট হতে হবে: কলাম A (ID), কলাম B (নাম), কলাম C (মোট সঞ্চয়), কলাম D (বকেয়া), কলাম E (লভ্যাংশ)। ডাটা ২য় সারি থেকে শুরু হতে হবে।
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <button onClick={()=>setShowAddMemberModal(true)} className="bg-emerald-600 text-white p-6 md:p-8 rounded-2xl md:rounded-[40px] font-black flex flex-row md:flex-col items-center md:items-start gap-4 text-left shadow-lg active:scale-95 transition-all">
          <UserPlus size={24} className="md:w-8 md:h-8" />
          <span className="text-lg md:text-xl">নতুন সদস্য যোগ</span>
        </button>
        <button onClick={()=>setShowAddNoticeModal(true)} className="bg-slate-900 dark:bg-slate-700 text-white p-6 md:p-8 rounded-2xl md:rounded-[40px] font-black flex flex-row md:flex-col items-center md:items-start gap-4 text-left shadow-lg active:scale-95 transition-all">
          <Bell size={24} className="md:w-8 md:h-8" />
          <span className="text-lg md:text-xl">নতুন নোটিশ লিখুন</span>
        </button>
        <button onClick={()=>setView('admin-businesses')} className="bg-white dark:bg-slate-800 border-2 border-emerald-600 text-emerald-600 p-6 md:p-8 rounded-2xl md:rounded-[40px] font-black flex flex-row md:flex-col items-center md:items-start gap-4 text-left active:scale-95 transition-all">
          <Briefcase size={24} className="md:w-8 md:h-8" />
          <span className="text-lg md:text-xl">প্রজেক্ট ম্যানেজমেন্ট</span>
        </button>
      </div>
    </div>
  );

  const renderAdminMembers = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className={cardClass}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <h2 className={`text-3xl font-black tracking-tight ${textPrimary}`}>সদস্য ব্যবস্থাপনা</h2>
          <button onClick={()=>setShowAddMemberModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95"><UserPlus size={20}/> নতুন সদস্য</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400">সদস্য</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">সঞ্চয় (৳)</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">বাকি (৳)</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {allMembers.filter(m=>m.role!=='admin').map(m=>(
                <tr key={m.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                  <td className="py-6 flex items-center gap-4">
                    <img src={m.avatar} className="w-12 h-12 rounded-xl object-cover border-2 border-slate-100 dark:border-slate-700"/>
                    <div>
                      <div className={`font-black text-sm ${textPrimary}`}>{m.name}</div>
                      <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">{m.id}</div>
                    </div>
                  </td>
                  <td className={`py-6 text-sm font-black text-right ${textPrimary}`}>৳{m.totalSaved.toLocaleString()}</td>
                  <td className="py-6 text-sm font-black text-right text-rose-500">৳{m.totalDue.toLocaleString()}</td>
                  <td className="py-6 text-right flex justify-end gap-3">
                    <button onClick={()=>setShowAddPaymentModal({member:m})} title="পেমেন্ট যোগ" className="p-2 text-emerald-600 hover:scale-110 transition-transform"><Coins size={20}/></button>
                    <button onClick={()=>setEditingMember(m)} title="এডিট" className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><Edit size={20}/></button>
                    <button onClick={()=>deleteMember(m.id)} title="ডিলিট" className="p-2 text-rose-500 hover:scale-110 transition-transform"><Trash2 size={20}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Payment Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setShowAddPaymentModal(null)}></div>
          <form onSubmit={handleAddPayment} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200`}>
             <h3 className="text-3xl font-black text-emerald-600 mb-2 uppercase tracking-tight">পেমেন্ট রেকর্ড যোগ</h3>
             <p className={`mb-10 font-bold ${textSecondary}`}>সদস্য: {showAddPaymentModal.member.name}</p>
             <div className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-1">
                   <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>তারিখ</label>
                   <input name="date" type="date" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} defaultValue={new Date().toISOString().split('T')[0]} />
                 </div>
                 <div className="col-span-1">
                   <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>টাকার পরিমাণ (৳)</label>
                   <input name="amount" type="number" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="০০০" />
                 </div>
               </div>
               <div>
                 <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>বিবরণ</label>
                 <input name="description" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="যেমন: মে মাসের সঞ্চয়" />
               </div>
               <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl shadow-xl transition-all">জমা করুন</button>
             </div>
          </form>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setEditingMember(null)}></div>
          <form onSubmit={saveMemberEdit} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-2xl relative animate-in zoom-in-95 duration-200`}>
            <h3 className="text-3xl font-black text-emerald-600 mb-8 uppercase tracking-tight">সদস্য তথ্য আপডেট</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>নাম</label>
                <input value={editingMember.name} onChange={e=>setEditingMember({...editingMember, name:e.target.value})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="সদস্যের নাম" />
              </div>
              <div>
                <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>মোট সঞ্চয় (৳)</label>
                <input type="number" value={editingMember.totalSaved} onChange={e=>setEditingMember({...editingMember, totalSaved:Number(e.target.value)})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="মোট সঞ্চয়" />
              </div>
              <div>
                <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>সঞ্চয়ের হার (৳)</label>
                <input type="number" value={editingMember.monthlySavings} onChange={e=>setEditingMember({...editingMember, monthlySavings:Number(e.target.value)})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="মাসিক হার" />
              </div>
              <div>
                <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>বকেয়া (৳)</label>
                <input type="number" value={editingMember.totalDue} onChange={e=>setEditingMember({...editingMember, totalDue:Number(e.target.value)})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="বকেয়া" />
              </div>
              <div>
                <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>লভ্যাংশ (৳)</label>
                <input type="number" value={editingMember.profitShare} onChange={e=>setEditingMember({...editingMember, profitShare:Number(e.target.value)})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="লাভ" />
              </div>
              <button type="submit" className="md:col-span-2 bg-emerald-600 text-white font-black py-5 rounded-3xl transition-all shadow-lg hover:bg-emerald-700 active:scale-95">সেভ করুন</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setShowAddMemberModal(false)}></div>
          <form onSubmit={handleAddMember} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200`}>
            <h3 className="text-3xl font-black text-emerald-600 mb-8 uppercase tracking-tight">নতুন সদস্য যোগ</h3>
            <div className="grid grid-cols-2 gap-4">
              <input name="id" required className={`col-span-1 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="ID (M-001)" />
              <input name="name" required className={`col-span-1 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="নাম" />
              <input name="monthly" type="number" className={`col-span-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="মাসিক সঞ্চয় (২০০০)" />
              <button type="submit" className="col-span-2 bg-emerald-600 text-white font-black py-5 rounded-3xl mt-4 transition-all">সংরক্ষণ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  const renderAdminBusinesses = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className={cardClass}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <h2 className={`text-3xl font-black tracking-tight ${textPrimary}`}>প্রজেক্ট কন্ট্রোল</h2>
          <button onClick={()=>setShowAddBusinessModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95"><Plus size={22}/> নতুন প্রজেক্ট</button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allBusinesses.map(b=>(
            <div key={b.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-[40px] overflow-hidden group border border-slate-100 dark:border-slate-700 p-4 transition-all hover:shadow-md">
              <div className="relative h-48 rounded-[32px] overflow-hidden mb-6">
                <img src={b.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"/>
                <div className="absolute inset-0 bg-black/20"></div>
              </div>
              <h4 className={`text-xl font-black mb-2 ${textPrimary}`}>{b.title}</h4>
              <p className={`text-xs ${textSecondary} mb-6 line-clamp-2`}>{b.description}</p>
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-600">
                <span className="font-black text-emerald-600">৳{b.investmentAmount.toLocaleString()}</span>
                <div className="flex gap-2">
                  <button onClick={()=>setEditingBusiness(b)} className="p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"><Edit size={16}/></button>
                  <button onClick={()=>deleteBusiness(b.id)} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button>
                </div>
              </div>
            </div>
          ))}
          {allBusinesses.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 font-black uppercase">কোনো প্রজেক্ট নেই</div>
          )}
        </div>
      </div>
      
      {/* Add/Edit Business Modals */}
      {showAddBusinessModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setShowAddBusinessModal(false)}></div>
          <form onSubmit={handleAddBusiness} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200`}>
            <h3 className="text-3xl font-black text-emerald-600 mb-8 uppercase tracking-tight">নতুন প্রজেক্ট যোগ</h3>
            <div className="space-y-6">
              <input name="title" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="প্রজেক্ট শিরোনাম" />
              <textarea name="description" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none h-32 ${textPrimary}`} placeholder="প্রজেক্ট বর্ণনা" />
              <input name="investment" type="number" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="মূলধন (৳)" />
              <div className="space-y-2">
                <label className={`block text-[10px] font-black uppercase ${textSecondary}`}>প্রজেক্ট ছবি</label>
                <input type="file" ref={businessImageRef} accept="image/*" className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl mt-4 transition-all">সংরক্ষণ</button>
            </div>
          </form>
        </div>
      )}

      {editingBusiness && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setEditingBusiness(null)}></div>
          <form onSubmit={saveBusinessEdit} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200`}>
            <h3 className="text-3xl font-black text-emerald-600 mb-8 uppercase tracking-tight">প্রজেক্ট এডিট</h3>
            <div className="space-y-6">
              <input value={editingBusiness.title} onChange={e=>setEditingBusiness({...editingBusiness, title:e.target.value})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="শিরোনাম" />
              <textarea value={editingBusiness.description} onChange={e=>setEditingBusiness({...editingBusiness, description:e.target.value})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none h-32 ${textPrimary}`} placeholder="বর্ণনা" />
              <input type="number" value={editingBusiness.investmentAmount} onChange={e=>setEditingBusiness({...editingBusiness, investmentAmount:Number(e.target.value)})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="মূলধন" />
              <div className="space-y-2">
                <label className={`block text-[10px] font-black uppercase ${textSecondary}`}>প্রজেক্ট ছবি পরিবর্তন</label>
                <input type="file" ref={editBusinessImageRef} accept="image/*" className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} />
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl mt-4 transition-all">আপডেট করুন</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  const renderAdminNotices = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className={cardClass}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          <h2 className={`text-3xl font-black tracking-tight ${textPrimary}`}>নোটিশ বোর্ড নিয়ন্ত্রণ</h2>
          <button onClick={()=>setShowAddNoticeModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95"><Plus size={22}/> নতুন নোটিশ</button>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
           {allNotices.map(n=>(
             <div key={n.id} className="p-8 rounded-[48px] bg-slate-50 dark:bg-slate-800 relative border border-slate-100 dark:border-slate-700">
                <div className="absolute top-8 right-8 flex gap-2">
                  <button onClick={()=>setEditingNotice(n)} title="এডিট" className="text-emerald-600 p-2 hover:scale-110 transition-transform"><Edit size={20}/></button>
                  <button onClick={()=>deleteNotice(n.id)} title="ডিলিট" className="text-rose-500 p-2 hover:scale-110 transition-transform"><Trash2 size={20}/></button>
                </div>
                <span className="text-[10px] font-black uppercase text-emerald-600 mb-4 inline-block">{n.date}</span>
                <h3 className={`text-2xl font-black mb-4 ${textPrimary}`}>{n.title}</h3>
                <p className={`text-sm ${textSecondary} mb-6`}>{n.content}</p>
                <div className="pt-6 border-t border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-emerald-600">লিখেছেন: {n.author}</div>
             </div>
           ))}
        </div>
      </div>
      
      {showAddNoticeModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setShowAddNoticeModal(false)}></div>
          <form onSubmit={handleAddNotice} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200`}>
            <h3 className="text-3xl font-black text-emerald-600 mb-8 uppercase tracking-tight">নতুন নোটিশ লিখুন</h3>
            <div className="space-y-6">
              <input name="title" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="শিরোনাম" />
              <textarea name="content" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none h-32 ${textPrimary}`} placeholder="বিস্তারিত..." />
              <input name="author" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="প্রেরকের পদবী" />
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl mt-4 transition-all">প্রকাশ করুন</button>
            </div>
          </form>
        </div>
      )}

      {editingNotice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setEditingNotice(null)}></div>
          <form onSubmit={saveNoticeEdit} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200`}>
            <h3 className="text-3xl font-black text-emerald-600 mb-8 uppercase tracking-tight">নোটিশ এডিট</h3>
            <div className="space-y-6">
              <input value={editingNotice.title} onChange={e=>setEditingNotice({...editingNotice, title:e.target.value})} required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="শিরোনাম" />
              <textarea value={editingNotice.content} onChange={e=>setEditingNotice({...editingNotice, content:e.target.value})} required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none h-32 ${textPrimary}`} placeholder="বিস্তারিত..." />
              <input value={editingNotice.author} onChange={e=>setEditingNotice({...editingNotice, author:e.target.value})} required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="প্রেরকের পদবী" />
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl mt-4 transition-all">আপডেট করুন</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  const renderNotices = () => (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className={cardClass}>
        <h2 className={`text-3xl font-black mb-12 ${textPrimary}`}>নোটিশ বোর্ড</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {allNotices.map(n=>(
            <div key={n.id} className="p-10 rounded-[48px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 shadow-sm">
              <span className="text-[10px] font-black uppercase text-emerald-600 mb-4 inline-block">{n.date}</span>
              <h3 className={`text-2xl font-black mb-4 ${textPrimary}`}>{n.title}</h3>
              <p className={`${textSecondary} mb-8`}>{n.content}</p>
              <div className="pt-6 border-t border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-emerald-600">লিখেছেন: {n.author}</div>
            </div>
          ))}
          {allNotices.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase tracking-widest">বর্তমানে কোনো নোটিশ নেই</div>}
        </div>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="space-y-12 animate-in fade-in duration-700">
      <section className={`${cardClass} bg-gradient-to-br from-emerald-600 to-green-700 text-white border-none p-12 overflow-hidden relative shadow-lg`}>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <h2 className="text-5xl font-black mb-6 uppercase tracking-tight">আল ইত্তেহাদ ফোরাম</h2>
            <p className="text-xl opacity-90 mb-10 max-w-xl">ঐক্যবদ্ধ সঞ্চয় ও লাভজনক বিনিয়োগের মাধ্যমে সদস্যদের অর্থনৈতিক স্বয়ংসম্পূর্ণতা এবং ভ্রাতৃত্বের বন্ধন সুদৃঢ় করাই আমাদের মূল লক্ষ্য।</p>
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-white/10 p-8 rounded-[40px] text-center border border-white/10">
                <div className="text-5xl font-black mb-1">{allMembers.length}</div>
                <div className="text-[10px] uppercase font-black opacity-60">সক্রিয় সদস্য</div>
              </div>
              <div className="bg-white/10 p-8 rounded-[40px] text-center border border-white/10">
                <div className="text-5xl font-black mb-1">{allBusinesses.length}</div>
                <div className="text-[10px] uppercase font-black opacity-60">সফল প্রজেক্ট</div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <img src="https://picsum.photos/seed/ittihad/800/600" className="w-full rounded-[56px] shadow-2xl border-8 border-white/10" />
          </div>
        </div>
      </section>

      <section>
        <h2 className={`text-3xl font-black mb-10 flex items-center gap-4 ${textPrimary}`}>
          <span className="w-12 h-1.5 bg-emerald-600 rounded-full"></span>
          আমাদের বিনিয়োগ প্রজেক্টসমূহ
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {allBusinesses.map(b=>(
            <div key={b.id} className={`${cardClass} group`}>
              <div className="relative h-56 rounded-[32px] overflow-hidden -m-6 mb-8">
                <img src={b.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
              </div>
              <h3 className={`text-2xl font-black mb-2 ${textPrimary}`}>{b.title}</h3>
              <p className={`${textSecondary} text-sm mb-8 line-clamp-3`}>{b.description}</p>
              <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px] font-black uppercase">
                <span className="text-slate-400">বিনিয়োগ</span>
                <span className="text-emerald-600">৳{b.investmentAmount.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderNoticePanel = () => (
    <div className={`fixed inset-y-0 right-0 z-[60] w-full md:w-96 ${isDarkMode ? 'bg-slate-900' : 'bg-white'} shadow-2xl transform transition-transform duration-500 ${isNoticePanelOpen ? 'translate-x-0' : 'translate-x-full'} border-l border-slate-100 dark:border-slate-800 flex flex-col`}>
      <div className="p-8 border-b flex justify-between items-center bg-emerald-600 text-white">
        <div className="flex items-center gap-3">
          <Bell size={24} />
          <h3 className="font-black uppercase tracking-widest text-sm">নোটিফিকেশন</h3>
        </div>
        <button onClick={() => setIsNoticePanelOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {allNotices.length > 0 ? allNotices.map(n => (
          <div key={n.id} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-black text-emerald-600 uppercase">{n.date}</span>
              {n.priority === 'high' && <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}
            </div>
            <h4 className={`font-black mb-2 ${textPrimary} group-hover:text-emerald-600 transition-colors`}>{n.title}</h4>
            <p className={`text-xs ${textSecondary} line-clamp-2`}>{n.content}</p>
          </div>
        )) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-4">
            <Bell size={48} />
            <p className="font-black uppercase text-xs">কোনো নোটিশ নেই</p>
          </div>
        )}
      </div>
      <div className="p-6 border-t">
        <button onClick={() => { setView('notices'); setIsNoticePanelOpen(false); }} className="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition-all">সবগুলো দেখুন</button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (view) {
      case 'dashboard': return currentUser?.role === 'admin' ? renderAdminDashboard() : renderMemberDashboard();
      case 'notices': return renderNotices();
      case 'about': return renderAbout();
      case 'admin-members': return renderAdminMembers();
      case 'admin-businesses': return renderAdminBusinesses();
      case 'admin-notices': return renderAdminNotices();
      default: return currentUser?.role === 'admin' ? renderAdminDashboard() : renderMemberDashboard();
    }
  };

  if (!isLoggedIn) return renderWelcome();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-emerald-600">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'} flex transition-colors duration-500`}>
      {renderSidebar()}
      <main className="flex-1 lg:ml-72 min-h-screen pb-24 lg:pb-12">
        <header className={`sticky top-0 z-40 ${isDarkMode ? 'bg-slate-950/80' : 'bg-white/80'} backdrop-blur-xl border-b px-4 md:px-8 py-4 md:py-6 flex items-center justify-between`}>
          <div className="flex items-center gap-3 md:gap-5">
            <button className="lg:hidden p-2 md:p-3 bg-emerald-50 text-emerald-600 rounded-xl md:rounded-2xl active:scale-95 transition-all" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <div>
              <h1 className="text-lg md:text-2xl font-black uppercase tracking-tight">
                {view === 'dashboard' ? 'ড্যাশবোর্ড' : view === 'notices' ? 'নোটিশ বোর্ড' : view.includes('admin') ? 'এডমিন কন্ট্রোল' : 'আল ইত্তেহাদ'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <button onClick={() => setIsNoticePanelOpen(!isNoticePanelOpen)} className="p-2 md:p-3 bg-slate-50 dark:bg-slate-900 rounded-xl md:rounded-2xl text-slate-500 relative transition-all hover:text-emerald-600">
              <Bell size={20} />
              {allNotices.length > 0 && <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-rose-500 rounded-full border-2 border-white dark:border-slate-950 shadow-md"></span>}
            </button>
            <div className="flex items-center gap-2 md:gap-3">
              <img src={activeMember?.avatar || currentUser?.avatar} className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl object-cover ring-2 ring-emerald-500/10" />
              <div className="hidden sm:block">
                <div className={`text-[10px] md:text-xs font-black ${textPrimary}`}>{activeMember?.name || currentUser?.name}</div>
                <div className="text-[8px] md:text-[10px] font-black text-emerald-600 uppercase mt-0.5 tracking-widest">{currentUser?.id}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-12">{renderContent()}</div>

        {renderNoticePanel()}

        {isChatOpen && (
          <div className={`fixed bottom-6 right-6 z-[100] w-[calc(100%-3rem)] md:w-[420px] h-[650px] ${isDarkMode ? 'bg-slate-900' : 'bg-white'} border rounded-[48px] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-12 duration-500`}>
            <div className="p-8 bg-emerald-600 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-4">
                <MessageSquare size={24} />
                <div className="font-black text-sm uppercase tracking-widest">ফোরাম এআই অ্যাসিস্ট্যান্ট</div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30 dark:bg-slate-900">
              {chatHistory.map((c,i)=>(
                <div key={i} className={`flex ${c.role==='user'?'justify-end':'justify-start'}`}>
                  <div className={`p-6 rounded-[32px] text-sm max-w-[85%] shadow-sm ${c.role==='user'?'bg-emerald-600 text-white rounded-tr-none':'bg-white dark:bg-slate-800 rounded-tl-none border border-slate-100 dark:border-slate-700'}`}>
                    {c.text}
                  </div>
                </div>
              ))}
              {isAiLoading && <div className="flex justify-start"><div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-3xl animate-pulse text-xs font-black uppercase tracking-widest text-slate-400">অপেক্ষা করুন...</div></div>}
            </div>
            <div className="p-8 border-t flex gap-4 bg-white dark:bg-slate-900">
              <input className={`flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl px-6 py-4 text-sm ${textPrimary}`} placeholder="আপনার প্রশ্নটি লিখুন..." value={chatMessage} onChange={e=>setChatMessage(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleSendMessage()} />
              <button onClick={handleSendMessage} className="bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl shadow-lg transition-all active:scale-90"><Send size={24}/></button>
            </div>
          </div>
        )}
      </main>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
    </div>
  );
};

export default App;
