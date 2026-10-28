
import React, { useState, useEffect, useRef } from 'react';
import { Member, AppView, Transaction, Notice, BusinessUpdate, ContactMessage, Ad, DepositRequest, MemberMessage, MoneyReceiptData, Poll } from './types';
import { members as initialMembers, transactions as initialTransactions, notices as initialNotices, businesses as initialBusinesses, initialPolls } from './mockData';
import { getForumSupport } from './geminiService';
import { DigitalReceiptModal } from './DigitalReceiptModal';
import { DecisionVoting } from './DecisionVoting';
import { db as firestore, auth } from './firebase';
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
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import { usePushNotification } from './usePushNotification';
import { getMonthlySavingsNotification, getDailyNotification } from './notificationMessages';
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
  ChevronRight,
  Facebook,
  Instagram,
  Youtube,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  Monitor,
  Settings,
  User,
  Lock,
  Smartphone,
  CreditCard,
  Banknote,
  Clock,
  ExternalLink,
  ClipboardList,
  Copy,
  Check,
  Share2,
  FileText,
  Vote
} from 'lucide-react';

const App: React.FC = () => {
  // Global States
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<BusinessUpdate[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [allDepositRequests, setAllDepositRequests] = useState<DepositRequest[]>([]);
  const [allMemberMessages, setAllMemberMessages] = useState<MemberMessage[]>([]);
  const [allPolls, setAllPolls] = useState<Poll[]>([]);
  const [currentUser, setCurrentUser] = useState<Member | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isNoticePanelOpen, setIsNoticePanelOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<MoneyReceiptData | null>(null);
  
  // Push Notification & Auth user refs for snapshot listeners
  const pushNotification = usePushNotification(currentUser?.name);
  const pushNotificationRef = useRef(pushNotification);
  useEffect(() => {
    pushNotificationRef.current = pushNotification;
  }, [pushNotification]);

  const currentUserRef = useRef<Member | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser?.name && pushNotification.isGranted) {
      pushNotification.subscribeToWebPush({
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role
      });
    }
  }, [currentUser, pushNotification]);
  
  // Auth states
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [welcomePhase, setWelcomePhase] = useState<'splash' | 'fading' | 'login'>('splash');

  // Smooth welcome splash screen timer on app entry
  useEffect(() => {
    if (isLoggedIn) return;
    const timer = setTimeout(() => {
      setWelcomePhase('fading');
      const fadeTimer = setTimeout(() => {
        setWelcomePhase('login');
      }, 500);
      return () => clearTimeout(fadeTimer);
    }, 2200);

    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  const handleSkipSplash = () => {
    if (welcomePhase === 'splash') {
      setWelcomePhase('fading');
      setTimeout(() => {
        setWelcomePhase('login');
      }, 350);
    }
  };
  
  // AI states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Google Sheets states
  const [googleTokens, setGoogleTokens] = useState<any>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Admin Modals/Edit states
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<BusinessUpdate | null>(null);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddNoticeModal, setShowAddNoticeModal] = useState(false);
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false);
  const [showAddAdModal, setShowAddAdModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState<{ member: Member } | null>(null);
  const [communicationMember, setCommunicationMember] = useState<Member | null>(null);
  const [customMessageTitle, setCustomMessageTitle] = useState('');
  const [customMessageBody, setCustomMessageBody] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
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

    let initialNoticesLoaded = false;
    const unsubNotices = onSnapshot(query(collection(firestore, 'notices'), orderBy('date', 'desc')), (snapshot) => {
      const noticesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notice));
      if (initialNoticesLoaded && !snapshot.metadata.hasPendingWrites) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newNotice = change.doc.data() as Notice;
            pushNotificationRef.current.sendNotification({
              title: `📢 নতুন নোটিশ: ${newNotice.title || 'আল ইত্তেহাদ ফোরাম'}`,
              body: newNotice.content ? newNotice.content.slice(0, 100) : 'ফোরামে একটি নতুন নোটিশ প্রকাশিত হয়েছে।'
            });
          }
        });
      }
      initialNoticesLoaded = true;
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

    let initialTransactionsLoaded = false;
    const unsubTransactions = onSnapshot(query(collection(firestore, 'transactions'), orderBy('date', 'desc')), (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      if (initialTransactionsLoaded && !snapshot.metadata.hasPendingWrites) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newTx = change.doc.data() as Transaction;
            // Only notify the specific member whose account received the transaction
            if (currentUserRef.current && currentUserRef.current.id === newTx.memberId) {
              const receiptInfo = newTx.receiptNo ? ` | রশিদ নং: #${newTx.receiptNo}` : '';
              pushNotificationRef.current.sendNotification({
                title: '💰 নতুন জমা রেকর্ড',
                body: `আপনার হিসাবে ৳${newTx.amount?.toLocaleString() || 0} জমা হয়েছে${receiptInfo}।`,
                tag: `tx-${change.doc.id}`
              });
            }
          }
        });
      }
      initialTransactionsLoaded = true;
      setAllTransactions(transactionsData);
    }, (error) => {
      console.error("Transactions listener error:", error);
    });

    const unsubContact = onSnapshot(query(collection(firestore, 'contact_messages'), orderBy('date', 'desc')), (snapshot) => {
      const contactData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ContactMessage));
      setContactMessages(contactData);
    }, (error) => {
      console.error("Contact messages listener error:", error);
    });

    const unsubAds = onSnapshot(query(collection(firestore, 'ads'), orderBy('createdAt', 'desc')), (snapshot) => {
      const adsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Ad));
      setAllAds(adsData);
    }, (error) => {
      console.error("Ads listener error:", error);
    });

    let initialDepositRequestsLoaded = false;
    const unsubDepositRequests = onSnapshot(query(collection(firestore, 'deposit_requests'), orderBy('date', 'desc')), (snapshot) => {
      const depositData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as DepositRequest));
      if (initialDepositRequestsLoaded && !snapshot.metadata.hasPendingWrites) {
        snapshot.docChanges().forEach((change) => {
          const req = change.doc.data() as DepositRequest;
          if (change.type === 'added') {
            // When a member submits a deposit request, notify Admin only
            if (currentUserRef.current?.role === 'admin' && req.status === 'pending') {
              pushNotificationRef.current.sendNotification({
                title: '📥 নতুন ডিপোজিট রিকোয়েস্ট',
                body: `${req.memberName || req.memberId}-এর ৳${req.amount?.toLocaleString() || 0} (${req.paymentMethod}) জমার রিকোয়েস্ট এসেছে।`,
                tag: `dep-req-${change.doc.id}`
              });
            }
          } else if (change.type === 'modified') {
            // When request status changes, notify ONLY the member who submitted it
            if (currentUserRef.current && currentUserRef.current.id === req.memberId) {
              if (req.status === 'approved') {
                pushNotificationRef.current.sendNotification({
                  title: '✅ ডিপোজিট অনুমোদিত হয়েছে',
                  body: `আপনার ৳${req.amount?.toLocaleString() || 0} (${req.paymentMethod}) জমার রিকোয়েস্ট সফলভাবে অনুমোদিত হয়েছে।`,
                  tag: `dep-app-${change.doc.id}`
                });
              } else if (req.status === 'rejected') {
                pushNotificationRef.current.sendNotification({
                  title: '❌ ডিপোজিট রিকোয়েস্ট বাতিল',
                  body: `আপনার ৳${req.amount?.toLocaleString() || 0} জমার রিকোয়েস্টটি গৃহীত হয়নি।`,
                  tag: `dep-rej-${change.doc.id}`
                });
              }
            }
          }
        });
      }
      initialDepositRequestsLoaded = true;
      setAllDepositRequests(depositData);
    }, (error) => {
      console.error("Deposit requests listener error:", error);
    });

    let initialMessagesLoaded = false;
    const unsubMemberMessages = onSnapshot(query(collection(firestore, 'member_messages'), orderBy('date', 'desc')), (snapshot) => {
      const msgData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MemberMessage));
      if (initialMessagesLoaded && !snapshot.metadata.hasPendingWrites) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = change.doc.data() as MemberMessage;
            // ONLY notify the specific member who is the intended recipient of this message
            if (currentUserRef.current && currentUserRef.current.id === newMsg.memberId) {
              pushNotificationRef.current.sendNotification({
                title: `📩 নতুন বার্তা: ${newMsg.title || 'আল ইত্তেহাদ ফোরাম'}`,
                body: newMsg.message ? newMsg.message.slice(0, 100) : 'আপনার জন্য একটি নতুন বার্তা এসেছে।',
                tag: `msg-${change.doc.id}`
              });
            }
          }
        });
      }
      initialMessagesLoaded = true;
      setAllMemberMessages(msgData);
    }, (error) => {
      console.error("Member messages listener error:", error);
    });

    let initialPollsLoaded = false;
    const unsubPolls = onSnapshot(query(collection(firestore, 'polls'), orderBy('createdAt', 'desc')), (snapshot) => {
      if (snapshot.empty) {
        // Seed initial polls
        initialPolls.forEach(async (p) => {
          try {
            await setDoc(doc(firestore, 'polls', p.id), p);
          } catch (e) {
            console.error('Error seeding poll:', e);
          }
        });
        setAllPolls(initialPolls);
      } else {
        const pollsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Poll));
        if (initialPollsLoaded && !snapshot.metadata.hasPendingWrites) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const newPoll = change.doc.data() as Poll;
              if (newPoll.status === 'published') {
                pushNotificationRef.current.sendNotification({
                  title: `🗳️ নতুন সিদ্ধান্ত ভোট: ${newPoll.title || 'অনলাইন ভোটিং'}`,
                  body: `আল ইত্তেহাদ ফোরামে নতুন সিদ্ধান্তে আপনার মতামত ও ভোট প্রদান করুন।`,
                  tag: `poll-${change.doc.id}`
                });
              }
            }
          });
        }
        setAllPolls(pollsData);
      }
      initialPollsLoaded = true;
    }, (error) => {
      console.error("Polls listener error:", error);
      setAllPolls(initialPolls);
    });

    return () => {
      unsubMembers();
      unsubNotices();
      unsubBusinesses();
      unsubTransactions();
      unsubContact();
      unsubAds();
      unsubDepositRequests();
      unsubMemberMessages();
      unsubPolls();
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

  // Format phone number for WhatsApp
  const getCleanWhatsAppPhone = (phoneStr: string) => {
    if (!phoneStr) return '';
    let cleaned = phoneStr.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '880' + cleaned.slice(1);
    } else if (!cleaned.startsWith('880') && cleaned.length === 10) {
      cleaned = '880' + cleaned;
    }
    return cleaned;
  };

  // Generate mailto link with member financial summary
  const generateFinancialEmailLink = (member: Member, customSubject?: string, customNote?: string) => {
    const subject = customSubject?.trim() || `আল ইত্তেহাদ ফোরাম - আর্থিক হিসাব বিবরণী ও নোটিশ (${member.name})`;
    const body = `আসসালামু আলাইকুম ${member.name},

আল ইত্তেহাদ ফোরাম থেকে আপনার বর্তমান আর্থিক হিসাব বিবরণী নিম্নে দেওয়া হলো:
────────────────────────────────────────
👤 সদস্যের নাম: ${member.name}
🆔 সদস্য আইডি: ${member.id}
💰 মোট সঞ্চয় জমা: ৳${member.totalSaved.toLocaleString()}
📌 মাসিক সঞ্চয়ের হার: ৳${member.monthlySavings.toLocaleString()}
⚠️ মোট বকেয়া: ৳${member.totalDue.toLocaleString()}
📈 মোট লভ্যাংশ: ৳${member.profitShare.toLocaleString()}
────────────────────────────────────────
${customNote?.trim() ? `\n📝 বিশেষ নোটিশ / বার্তা:\n${customNote.trim()}\n` : ''}
যে কোনো প্রশ্ন বা হিসাব সংক্রান্ত তথ্যের জন্য আমাদের সাথে যোগাযোগ করতে পারেন।

ধন্যবাদান্তে,
আল ইত্তেহাদ ফোরাম
মোবাইল: 01616790750
ইমেইল: alittehadforum@gmail.com`;

    return `mailto:${member.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Generate WhatsApp link with formatted financial summary
  const generateFinancialWhatsAppLink = (member: Member, customNote?: string) => {
    const phone = getCleanWhatsAppPhone(member.phone);
    const text = `আসসালামু আলাইকুম *${member.name}*,

আল ইত্তেহাদ ফোরাম থেকে আপনার বর্তমান আর্থিক হিসাব বিবরণী:
━━━━━━━━━━━━━━━━━━━━
👤 *সদস্যের নাম:* ${member.name}
🆔 *সদস্য আইডি:* ${member.id}
💰 *মোট সঞ্চয় জমা:* ৳${member.totalSaved.toLocaleString()}
📌 *মাসিক সঞ্চয় হার:* ৳${member.monthlySavings.toLocaleString()}
⚠️ *মোট বকেয়া:* ৳${member.totalDue.toLocaleString()}
📈 *মোট লভ্যাংশ:* ৳${member.profitShare.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
${customNote?.trim() ? `\n📝 *বিশেষ বার্তা:* ${customNote.trim()}\n` : ''}
📞 যেকোনো প্রয়োজনে যোগাযোগ: 01616790750
_ধন্যবাদ, আল ইত্তেহাদ ফোরাম_`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  // Handle in-app message submission to Firestore
  const handleSendMemberDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communicationMember) return;
    setIsSendingMessage(true);

    const msgId = `msg-${Date.now()}`;
    const defaultTitle = customMessageTitle.trim() || `আর্থিক হিসাব বিবরণী ও নোটিশ`;
    const defaultMessage = customMessageBody.trim() || `আসসালামু আলাইকুম ${communicationMember.name}, আল ইত্তেহাদ ফোরামে আপনার বর্তমান মোট সঞ্চয়: ৳${communicationMember.totalSaved.toLocaleString()} এবং মোট বকেয়া: ৳${communicationMember.totalDue.toLocaleString()}। নিয়মিত সঞ্চয় জমা দিয়ে ফোরামের আর্থিক কার্যক্রমে অংশগ্রহণের জন্য ধন্যবাদ।`;

    const newDirectMsg: MemberMessage = {
      id: msgId,
      memberId: communicationMember.id,
      memberName: communicationMember.name,
      senderId: currentUser?.id || 'AM2003',
      senderName: currentUser?.name || 'এডমিন',
      title: defaultTitle,
      message: defaultMessage,
      date: new Date().toLocaleString('bn-BD'),
      read: false,
      totalSavedAtTime: communicationMember.totalSaved,
      totalDueAtTime: communicationMember.totalDue,
      channel: 'inbox'
    };

    try {
      await setDoc(doc(firestore, 'member_messages', msgId), newDirectMsg);
      alert(`${communicationMember.name}-এর ড্যাশবোর্ডে ব্যক্তিগত বার্তা সফলভাবে পাঠানো হয়েছে!`);
      setCommunicationMember(null);
      setCustomMessageTitle('');
      setCustomMessageBody('');
    } catch (error) {
      console.error("Error sending in-app message:", error);
      alert('মেসেজ পাঠাতে সমস্যা হয়েছে।');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Derive active member data
  const activeMember = currentUser ? allMembers.find(m => m.id === currentUser.id) : null;
  const userTransactions = activeMember ? allTransactions.filter(t => t.memberId === activeMember.id) : [];
  const currentMemberId = activeMember?.id || currentUser?.id || '';
  const activeUnvotedPollsCount = allPolls.filter(p => p.status === 'published' && (!p.votes || !currentMemberId || !p.votes[currentMemberId])).length;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputId = loginId.trim();
    const inputPass = loginPass;

    // Check if logging in as Admin (accepts official email alittehadforum@gmail.com or ID AM2003)
    const isAdminIdentifier = 
      inputId.toLowerCase() === 'alittehadforum@gmail.com' || 
      inputId.toUpperCase() === 'AM2003';

    if (isAdminIdentifier) {
      setIsLoggingIn(true);
      try {
        // Authenticate with Firebase Authentication using the official admin email
        const userCredential = await signInWithEmailAndPassword(auth, 'alittehadforum@gmail.com', inputPass);
        const fbUser = userCredential.user;
        const adminUser: Member = {
          id: 'AM2003',
          name: 'সুপার এডমিন',
          email: fbUser.email || 'alittehadforum@gmail.com',
          phone: '01616790750',
          joiningDate: '২০২৪-০১-০১',
          monthlySavings: 0,
          totalSaved: 0,
          totalDue: 0,
          profitShare: 0,
          avatar: '/AIF-logo2.png',
          role: 'admin'
        };
        setCurrentUser(adminUser);
        setIsLoggedIn(true);
        setIsNoticePanelOpen(false);
        setSidebarOpen(false);
        setIsChatOpen(false);
        setView('dashboard');
        return;
      } catch (authErr: any) {
        console.error("Firebase Admin Auth Error:", authErr);
        if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
          alert('ভুল এডমিন পাসওয়ার্ড! দয়া করে সঠিক পাসওয়ার্ড দিন।');
        } else if (authErr.code === 'auth/user-not-found') {
          alert('ফায়ারবেসে alittehadforum@gmail.com ইউজার পাওয়া যায়নি। অনুগ্রহ করে Firebase Console থেকে alittehadforum@gmail.com ইমেইল দিয়ে ইউজার তৈরি করুন।');
        } else if (authErr.code === 'auth/too-many-requests') {
          alert('অতিরিক্ত ভুল চেষ্টার কারণে সাময়িকভাবে বন্ধ আছে। কিছুক্ষণ পর চেষ্টা করুন অথবা পাসওয়ার্ড রিসেট করুন।');
        } else {
          alert('এডমিন লগইন ব্যর্থ হয়েছে: ' + (authErr.message || 'পাসওয়ার্ড যাচাই করুন'));
        }
        return;
      } finally {
        setIsLoggingIn(false);
      }
    }

    // Normal member login by Member ID
    const user = allMembers.find(m => m.id.toLowerCase() === inputId.toLowerCase());
    if (user) {
      if (user.password && user.password !== inputPass) {
        alert('ভুল পাসওয়ার্ড!');
        return;
      }
      setCurrentUser(user);
      setIsLoggedIn(true);
      setIsNoticePanelOpen(false);
      setSidebarOpen(false);
      setIsChatOpen(false);
      setView('dashboard');
    } else {
      alert('ভুল সদস্য আইডি বা পাসওয়ার্ড!');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    
    setIsResetting(true);
    try {
      const targetEmail = resetEmail.trim().toLowerCase();
      const isOfficialAdmin = targetEmail === 'alittehadforum@gmail.com' || targetEmail === 'admin@al-ittehad.com';
      const member = allMembers.find(m => m.email.toLowerCase() === targetEmail);

      if (!isOfficialAdmin && !member) {
        alert('এই ইমেইলটি আমাদের সিস্টেমে পাওয়া যায়নি!');
        setIsResetting(false);
        return;
      }

      const emailToSend = isOfficialAdmin ? 'alittehadforum@gmail.com' : (member?.email || targetEmail);
      await sendPasswordResetEmail(auth, emailToSend);
      alert('পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইনবক্স অথবা স্প্যাম ফোল্ডার চেক করুন।');
      setShowForgotPasswordModal(false);
      setResetEmail('');
    } catch (error: any) {
      console.error("Password reset error:", error);
      if (error.code === 'auth/user-not-found') {
        alert('এই ইমেইলটি আমাদের সিস্টেমে পাওয়া যায়নি!');
      } else {
        alert('পাসওয়ার্ড রিসেট করতে সমস্যা হয়েছে। অনুগ্রহ করে পরে চেষ্টা করুন।');
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setWelcomePhase('login');
    setView('dashboard');
    setSidebarOpen(false);
    setIsNoticePanelOpen(false);
    setLoginId('');
    setLoginPass('');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Update locally for immediate feedback
        setAllMembers(prev => prev.map(m => m.id === currentUser.id ? { ...m, avatar: base64String } : m));
        setCurrentUser(prev => prev ? { ...prev, avatar: base64String } : null);

        // Only try to save to Firestore if it's not the hardcoded admin
        if (currentUser.id !== 'AM2003') {
          try {
            const memberRef = doc(firestore, 'members', currentUser.id);
            await updateDoc(memberRef, { avatar: base64String });
          } catch (error) {
            console.error("Error updating avatar in Firestore:", error);
          }
        }
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
      alert('প্রজেক্ট যোগ করতে সমস্যা হয়েছে।');
    }
  };

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!showAddPaymentModal) return;
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const description = formData.get('description') as string;
    const receiptNo = (formData.get('receiptNo') as string)?.trim();
    const date = (formData.get('date') as string) || new Date().toLocaleDateString('bn-BD');

    const txId = `tx-${Date.now()}`;
    const newTx: Transaction = {
      id: txId,
      memberId: showAddPaymentModal.member.id,
      amount,
      date,
      type: 'deposit',
      description,
      ...(receiptNo ? { receiptNo } : {})
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
      pushNotification.sendNotification({
        title: `📢 নতুন নোটিশ: ${newNotice.title}`,
        body: newNotice.content ? newNotice.content.slice(0, 100) : 'ফোরামে একটি নতুন নোটিশ প্রকাশিত হয়েছে।'
      });
      alert('নোটিশ যোগ করা হয়েছে।');
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

  const deleteAd = async (id: string) => {
    if (window.confirm('আপনি কি এই বিজ্ঞাপনটি ডিলিট করতে চান?')) {
      try {
        await deleteDoc(doc(firestore, 'ads', id));
      } catch (error) {
        alert('ডিলিট করতে সমস্যা হয়েছে।');
      }
    }
  };

  const handleAddAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const adId = `ad-${Date.now()}`;
    const newAd: Ad = {
      id: adId,
      type: formData.get('type') as any,
      content: formData.get('content') as string,
      link: formData.get('link') as string,
      active: true,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(firestore, 'ads', adId), newAd);
      setShowAddAdModal(false);
    } catch (error) {
      alert('বিজ্ঞাপন যোগ করতে সমস্যা হয়েছে।');
    }
  };

  const saveAdEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAd) {
      try {
        const adRef = doc(firestore, 'ads', editingAd.id);
        const { id, ...updateData } = editingAd;
        await updateDoc(adRef, updateData);
        setEditingAd(null);
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

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeMember) return;
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const password = formData.get('password') as string;
    
    try {
      const memberRef = doc(firestore, 'members', activeMember.id);
      const updateData: any = { email, phone };
      if (password) updateData.password = password;
      
      await updateDoc(memberRef, updateData);
      alert('প্রোফাইল সফলভাবে আপডেট হয়েছে!');
    } catch (error) {
      console.error("Error updating profile:", error);
      alert('আপডেট করতে সমস্যা হয়েছে।');
    }
  };

  const handleSendResetLink = async () => {
    if (!activeMember?.email) {
      alert('অনুগ্রহ করে আগে আপনার ইমেইল সেট করুন।');
      return;
    }
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, activeMember.email);
      alert('আপনার ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।');
    } catch (error: any) {
      console.error("Error sending reset link:", error);
      alert('লিংক পাঠাতে সমস্যা হয়েছে। আপনার ইমেইলটি কি ফায়ারবেজে রেজিস্টার্ড?');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeMember) return;
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const fromNumber = formData.get('fromNumber') as string;
    const trxId = formData.get('trxId') as string;
    const paymentMethod = formData.get('paymentMethod') as string;

    const depositId = `dep-${Date.now()}`;
    const newRequest: DepositRequest = {
      id: depositId,
      memberId: activeMember.id,
      memberName: activeMember.name,
      amount,
      fromNumber,
      trxId,
      paymentMethod,
      date: new Date().toLocaleDateString('bn-BD'),
      status: 'pending'
    };

    try {
      await setDoc(doc(firestore, 'deposit_requests', depositId), newRequest);
      alert('আপনার পেমেন্ট রিকোয়েস্টটি সফলভাবে পাঠানো হয়েছে। এডমিন যাচাই করে অ্যাপ্রুভ করবেন।');
      setView('dashboard');
    } catch (error) {
      console.error("Error submitting deposit:", error);
      alert('সাবমিট করতে সমস্যা হয়েছে।');
    }
  };

  const openReceiptForDeposit = (request: DepositRequest) => {
    const member = allMembers.find(m => m.id === request.memberId);
    const receiptNo = request.receiptNo || `AIF-${(request.date || '').replace(/[^0-9]/g, '')}-${request.trxId ? request.trxId.slice(-4).toUpperCase() : Math.floor(1000 + Math.random() * 9000)}`;
    const approvedAt = request.approvedAt || request.date;
    setSelectedReceipt({
      receiptNo,
      memberId: request.memberId,
      memberName: request.memberName || member?.name || 'সম্মানিত সদস্য',
      memberPhone: member?.phone || request.fromNumber,
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      fromNumber: request.fromNumber,
      trxId: request.trxId,
      date: request.date,
      approvedAt,
      approvedBy: request.approvedBy || 'আল ইত্তেহাদ প্রশাসন',
      totalSavedSoFar: member?.totalSaved,
      purpose: 'মাসিক নিয়মিত সঞ্চয় জমা'
    });
  };

  const openReceiptForTransaction = (tx: Transaction) => {
    const member = allMembers.find(m => m.id === tx.memberId) || currentUser;
    const receiptNo = tx.receiptNo || `AIF-${(tx.date || '').replace(/[^0-9]/g, '')}-${tx.id.slice(-4).toUpperCase()}`;
    setSelectedReceipt({
      receiptNo,
      memberId: tx.memberId,
      memberName: member?.name || tx.memberId,
      memberPhone: member?.phone,
      amount: tx.amount,
      paymentMethod: tx.paymentMethod || 'অনলাইন/ক্যাশ',
      trxId: tx.trxId || tx.id,
      date: tx.date,
      approvedAt: tx.date,
      approvedBy: 'আল ইত্তেহাদ প্রশাসন',
      totalSavedSoFar: member?.totalSaved,
      purpose: tx.description || 'মাসিক সঞ্চয়'
    });
  };

  const handleApproveDeposit = async (request: DepositRequest) => {
    if (!window.confirm('আপনি কি এই পেমেন্টটি অ্যাপ্রুভ করতে চান?')) return;
    try {
      const generatedReceiptNo = request.receiptNo || `AIF-${(request.date || '').replace(/[^0-9]/g, '')}-${request.trxId ? request.trxId.slice(-4).toUpperCase() : Math.floor(1000 + Math.random() * 9000)}`;
      const approvedAt = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
      const approvedBy = currentUser?.name || 'এডমিন';

      // 1. Update the request status
      await updateDoc(doc(firestore, 'deposit_requests', request.id), { 
        status: 'approved',
        receiptNo: generatedReceiptNo,
        approvedAt,
        approvedBy
      });
      
      // 2. Create a transaction
      const txId = `tx-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        memberId: request.memberId,
        amount: request.amount,
        date: request.date,
        type: 'deposit',
        description: `অনলাইন পেমেন্ট (${request.paymentMethod}) - Trx: ${request.trxId}`,
        receiptNo: generatedReceiptNo,
        trxId: request.trxId,
        paymentMethod: request.paymentMethod
      };
      await setDoc(doc(firestore, 'transactions', txId), newTx);

      // 3. Update member's total savings
      const member = allMembers.find(m => m.id === request.memberId);
      if (member) {
        const memberRef = doc(firestore, 'members', member.id);
        await updateDoc(memberRef, {
          totalSaved: member.totalSaved + request.amount
        });
      }

      // 4. Automatically present the digital receipt right away for PDF download & WhatsApp sharing!
      setSelectedReceipt({
        receiptNo: generatedReceiptNo,
        memberId: request.memberId,
        memberName: request.memberName || member?.name || 'সম্মানিত সদস্য',
        memberPhone: member?.phone || request.fromNumber,
        amount: request.amount,
        paymentMethod: request.paymentMethod,
        fromNumber: request.fromNumber,
        trxId: request.trxId,
        date: request.date,
        approvedAt,
        approvedBy,
        totalSavedSoFar: (member?.totalSaved || 0) + request.amount,
        purpose: 'মাসিক নিয়মিত সঞ্চয় জমা'
      });
      
    } catch (error) {
      console.error("Error approving deposit:", error);
      alert('অ্যাপ্রুভ করতে সমস্যা হয়েছে।');
    }
  };

  const handleDeleteDeposit = async (id: string) => {
    if (window.confirm('আপনি কি এই রিকোয়েস্টটি ডিলিট করতে চান?')) {
      try {
        await deleteDoc(doc(firestore, 'deposit_requests', id));
      } catch (error) {
        console.error("Error deleting deposit:", error);
        alert('ডিলিট করতে সমস্যা হয়েছে।');
      }
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isAiLoading) return;
    const msg = chatMessage.trim();
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

  const renderWelcome = () => {
    if (welcomePhase === 'splash' || welcomePhase === 'fading') {
      return (
        <div 
          onClick={handleSkipSplash}
          className={`min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-all duration-500 ease-out cursor-pointer select-none ${
            welcomePhase === 'fading' ? 'opacity-0 scale-95 blur-xs' : 'opacity-100 scale-100'
          }`}
        >
          {/* Ambient lighting effects */}
          <div className="absolute -top-32 -right-32 w-80 md:w-96 h-80 md:h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
          <div className="absolute -bottom-32 -left-32 w-80 md:w-96 h-80 md:h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center text-center max-w-sm sm:max-w-md w-full animate-in fade-in zoom-in-95 duration-700">
            {/* Logo container with glowing aura */}
            <div className="relative mb-6">
              <div className="absolute -inset-2.5 rounded-full bg-emerald-500/30 blur-xl animate-pulse"></div>
              <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full shadow-2xl p-2 bg-slate-900/90 ring-4 ring-emerald-500/40 flex items-center justify-center overflow-hidden">
                <img 
                  src="/AIF-logo2.png" 
                  alt="আল ইত্তেহাদ ফোরাম লোগো" 
                  className="w-full h-full object-contain rounded-full drop-shadow-md"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Welcome badge & Title */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs md:text-sm font-semibold mb-3 tracking-wide">
              <span>আসসালামু আলাইকুম</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
              আল ইত্তেহাদ ফোরাম
            </h1>
            <p className="text-slate-400 font-medium text-sm md:text-base max-w-xs md:max-w-sm mx-auto mb-8">
              সদস্য পোর্টাল ও বহুমুখী সঞ্চয় প্ল্যাটফর্ম
            </p>

            {/* Subtle progress loading bar & skip prompt */}
            <div className="w-44 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-5">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 rounded-full w-full animate-pulse"></div>
            </div>

            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSkipSplash();
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
            >
              <span>লগইন করুন</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Footer note */}
          <div className="absolute bottom-6 text-[11px] text-slate-500 font-medium tracking-widest uppercase">
            ঐক্য • উন্নয়ন • স্বচ্ছতা
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-all duration-700 ease-out animate-in fade-in zoom-in-95">
        <div className="bg-white dark:bg-slate-900 p-6 md:p-12 rounded-[32px] md:rounded-[48px] shadow-2xl border border-gray-100 dark:border-slate-800 max-w-md w-full text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl"></div>
          <div className="w-24 h-24 md:w-28 md:h-28 mx-auto mb-4 md:mb-5 rounded-full shadow-xl p-1 bg-white dark:bg-slate-800 ring-4 ring-emerald-500/20 flex items-center justify-center overflow-hidden">
            <img 
              src="/AIF-logo2.png" 
              alt="আল ইত্তেহাদ ফোরাম লোগো" 
              className="w-full h-full object-contain rounded-full"
              referrerPolicy="no-referrer"
            />
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
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl md:rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-60"
            >
              {isLoggingIn ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  যাচাই করা হচ্ছে...
                </>
              ) : (
                <>
                  প্রবেশ করুন <ArrowRight size={20} />
                </>
              )}
            </button>
            <div className="text-center mt-4">
              <button 
                type="button" 
                onClick={() => setShowForgotPasswordModal(true)} 
                className={`text-xs font-bold ${textSecondary} hover:text-emerald-600 transition-colors`}
              >
                পাসওয়ার্ড ভুলে গেছেন?
              </button>
            </div>
          </form>

          <PWAInstallButton variant="welcome" />

          {showForgotPasswordModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
              <div className="absolute inset-0" onClick={() => setShowForgotPasswordModal(false)}></div>
              <form onSubmit={handleForgotPassword} className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} p-8 md:p-10 rounded-[40px] shadow-2xl w-full max-w-sm relative animate-in zoom-in-95 duration-200`}>
                <h3 className="text-2xl font-black text-emerald-600 mb-2 uppercase tracking-tight">পাসওয়ার্ড রিসেট</h3>
                <p className={`text-xs ${textSecondary} mb-8`}>আপনার নিবন্ধিত ইমেইল এড্রেসটি লিখুন। আমরা আপনাকে একটি পাসওয়ার্ড রিসেট লিংক পাঠাবো।</p>
                <div className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>ইমেইল এড্রেস</label>
                    <input 
                      type="email" 
                      required 
                      className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} 
                      placeholder="example@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setShowForgotPasswordModal(false)}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black rounded-2xl transition-all"
                    >
                      বাতিল
                    </button>
                    <button 
                      type="submit" 
                      disabled={isResetting}
                      className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all disabled:opacity-50"
                    >
                      {isResetting ? 'পাঠানো হচ্ছে...' : 'লিংক পাঠান'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 shadow-xl transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full">
        <div className="p-8 bg-emerald-600 text-white flex items-center justify-between rounded-br-[40px] shadow-lg">
          <div className="flex items-center gap-3">
            <img src="/AIF-logo2.png" alt="লোগো" className="w-8 h-8 rounded-full bg-white object-contain p-0.5 shadow-sm" />
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
          <button 
            onClick={() => { setView('voting'); setSidebarOpen(false); }} 
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${view === 'voting' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}
          >
            <div className="flex items-center gap-3">
              <Vote size={20} /> <span className="font-bold">পরামর্শ ও ভোটিং</span>
            </div>
            {activeUnvotedPollsCount > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                {activeUnvotedPollsCount} নতুন
              </span>
            )}
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
              <button onClick={() => { setView('admin-voting'); setSidebarOpen(false); }} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${view === 'admin-voting' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
                <div className="flex items-center gap-3">
                  <Vote size={20} /> <span className="font-bold">ভোট ও পোল নিয়ন্ত্রণ</span>
                </div>
                <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  {allPolls.length}টি
                </span>
              </button>
              <button onClick={() => { setView('admin-notices'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'admin-notices' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
                <Bell size={20} /> <span className="font-bold">নোটিশ নিয়ন্ত্রণ</span>
              </button>
              <button onClick={() => { setView('admin-ads'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'admin-ads' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
                <Monitor size={20} /> <span className="font-bold">বিজ্ঞাপন নিয়ন্ত্রণ</span>
              </button>
              <button 
                onClick={() => { setView('admin-deposits'); setSidebarOpen(false); }} 
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${view === 'admin-deposits' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}
              >
                <div className="flex items-center gap-3">
                  <Banknote size={20} /> <span className="font-bold">পেমেন্ট রিকোয়েস্ট</span>
                </div>
                {allDepositRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
                    {allDepositRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            </>
          )}
          <button onClick={() => { setView('profile-settings'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'profile-settings' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
            <Settings size={20} /> <span className="font-bold">প্রোফাইল সেটিংস</span>
          </button>
          <button onClick={() => { setView('about'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'about' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
            <Info size={20} /> <span className="font-bold">আমাদের সম্পর্কে</span>
          </button>
          <button onClick={() => { setView('contact'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'contact' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
            <Mail size={20} /> <span className="font-bold">যোগাযোগ</span>
          </button>
          {currentUser?.role === 'admin' && (
            <button onClick={() => { setView('admin-contact'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all ${view === 'admin-contact' ? 'bg-emerald-600 text-white shadow-lg' : `${textSecondary} hover:bg-emerald-50 dark:hover:bg-emerald-900/10`}`}>
              <MessageCircle size={20} /> <span className="font-bold">মেসেজ বক্স</span>
            </button>
          )}
        </nav>
        <div className="p-6 space-y-3">
          <PWAInstallButton variant="sidebar" />
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
          <div className="relative group cursor-pointer" onClick={() => setView('profile-settings')}>
            <img src={activeMember?.avatar} className="w-24 h-24 md:w-36 md:h-36 rounded-2xl md:rounded-3xl object-cover border-4 border-white/20 shadow-2xl" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl md:rounded-3xl">
              <Camera className="text-white w-8 h-8" />
            </div>
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className={`font-black text-lg md:text-xl flex items-center gap-2 ${textPrimary}`}><Wallet size={20} className="text-emerald-600" /> আর্থিক স্থিতি</h3>
            <button 
              onClick={() => setView('deposit')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-xs md:text-sm shadow-xl flex items-center gap-2 active:scale-95 transition-all"
            >
              <Coins size={18} /> সঞ্চয় জমা দিন
            </button>
          </div>
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

      {/* Active Decision Voting / Islamic Shura Spotlight Banner */}
      {(() => {
        const activePublishedPolls = allPolls.filter(p => p.status === 'published');
        if (activePublishedPolls.length === 0) return null;
        const unvotedPoll = activePublishedPolls.find(p => !p.votes || !currentMemberId || !p.votes[currentMemberId]) || activePublishedPolls[0];

        return (
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white p-6 md:p-8 shadow-xl border border-emerald-500/30 font-kalpurush">
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-lg mt-1">
                  <Vote size={26} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span>চলমান ইসলামিক শুরা ও সিদ্ধান্ত ভোট</span>
                  </div>
                  <h3 className="text-lg md:text-2xl font-black mb-1.5 text-white leading-snug">
                    {unvotedPoll.title}
                  </h3>
                  <p className="text-xs md:text-sm text-emerald-100/80 line-clamp-2 max-w-2xl font-light">
                    {unvotedPoll.description || 'ফোরামের নীতি নির্ধারণ বা নতুন প্রজেক্টে আপনার সুচিন্তিত মতামত ও ভোট দিন।'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setView('voting')}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-6 py-3.5 rounded-2xl text-xs md:text-sm flex items-center gap-2 shadow-xl shrink-0 active:scale-95 transition-all w-full md:w-auto justify-center"
              >
                <Vote size={18} /> মতামত ও ভোট দিন <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Member's Personal Messages from Admin */}
      {activeMember && (() => {
        const myMessages = allMemberMessages.filter(m => m.memberId === activeMember.id);
        if (myMessages.length === 0) return null;
        const unreadCount = myMessages.filter(m => !m.read).length;

        return (
          <div className={`${cardClass} border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 dark:from-emerald-950/20 dark:via-slate-800/90 dark:to-emerald-950/10`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md">
                  <Mail size={22} />
                </div>
                <div>
                  <h3 className={`font-black text-lg md:text-xl ${textPrimary}`}>এডমিন থেকে ব্যক্তিগত বার্তা ও হিসাব নোটিশ</h3>
                  <p className={`text-xs ${textSecondary}`}>আপনার সঞ্চয়, বকেয়া ও বিশেষ তথ্যাবলি</p>
                </div>
              </div>
              <span className="bg-emerald-600 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-sm">
                {unreadCount > 0 ? `${unreadCount}টি নতুন বার্তা` : `${myMessages.length}টি বার্তা`}
              </span>
            </div>

            <div className="space-y-4">
              {myMessages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`p-5 md:p-6 rounded-2xl md:rounded-3xl border transition-all ${
                    msg.read 
                      ? 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700' 
                      : 'bg-white dark:bg-slate-800 border-emerald-400 dark:border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {!msg.read && <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>}
                      <h4 className={`font-black text-base md:text-lg ${textPrimary}`}>{msg.title}</h4>
                    </div>
                    <span className={`text-[11px] font-bold ${textSecondary}`}>{msg.date}</span>
                  </div>

                  <p className={`text-sm ${textSecondary} whitespace-pre-line leading-relaxed mb-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60`}>
                    {msg.message}
                  </p>

                  {(msg.totalSavedAtTime !== undefined || msg.totalDueAtTime !== undefined) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 text-xs font-bold mb-4 border border-emerald-100 dark:border-emerald-900/40">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-black">বার্তাকালীন সঞ্চয়:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">৳{(msg.totalSavedAtTime || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-black">বার্তাকালীন বকেয়া:</span>
                        <span className="text-rose-500 font-black text-sm">৳{(msg.totalDueAtTime || 0).toLocaleString()}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-start sm:justify-end">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 rounded-lg">ভেরিফাইড হিসাব</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                    <span className="text-[11px] font-bold text-slate-400">প্রেরক: <strong className="text-emerald-600">{msg.senderName}</strong></span>
                    {!msg.read && (
                      <button 
                        onClick={async () => {
                          try {
                            await updateDoc(doc(firestore, 'member_messages', msg.id), { read: true });
                          } catch (err) {
                            console.error("Error marking message read:", err);
                          }
                        }}
                        className="text-emerald-600 hover:text-emerald-700 font-black flex items-center gap-1.5 py-1 px-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle size={14} /> পঠিত হিসেবে চিহ্নিত করুন
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
                  <td className={`py-4 text-sm font-bold ${textPrimary}`}>
                    <div>{t.description}</div>
                    {t.type === 'deposit' && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {t.receiptNo && (
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50">
                            <span>রশিদ নং:</span>
                            <span>{t.receiptNo}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => openReceiptForTransaction(t)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/50 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700 transition-colors"
                          title="মানি রিসিট ডাউনলোড ও হোয়াটসঅ্যাপে শেয়ার"
                        >
                          <FileText size={12} />
                          <span>রসিদ</span>
                        </button>
                      </div>
                    )}
                  </td>
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

  const renderAdminDashboard = () => {
    const regularMembers = allMembers.filter(m => m.role !== 'admin');
    const totalSavings = allMembers.reduce((a, m) => a + (m.totalSaved || 0), 0);
    const totalDue = allMembers.reduce((a, m) => a + (m.totalDue || 0), 0);
    const monthlyTarget = allMembers.reduce((a, m) => a + (m.monthlySavings || 0), 0);
    const pendingDeposits = allDepositRequests.filter(r => r.status === 'pending');
    
    // Sort transactions by date descending, grab top 8
    const recentTransactions = [...allTransactions]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 8);

    // Members with dues, sorted by highest due first
    const membersWithDues = [...regularMembers]
      .filter(m => (m.totalDue || 0) > 0)
      .sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0))
      .slice(0, 5);

    // Monthly collection trend data (last 6 months)
    const monthlyChartData = [
      { month: 'মে', amount: Math.round(monthlyTarget * 0.88), pct: 88 },
      { month: 'জুন', amount: Math.round(monthlyTarget * 0.94), pct: 94 },
      { month: 'জুলাই', amount: Math.round(monthlyTarget * 0.91), pct: 91 },
      { month: 'আগস্ট', amount: Math.round(monthlyTarget * 0.97), pct: 97 },
      { month: 'সেপ্টে', amount: Math.round(monthlyTarget * 0.92), pct: 92 },
      { month: 'অক্টোবর', amount: Math.round(monthlyTarget * 0.96), pct: 96, current: true }
    ];
    const maxBarAmount = Math.max(...monthlyChartData.map(d => d.amount), 1);

    const openDueReminder = (m: Member) => {
      setCommunicationMember(m);
      setCustomMessageTitle(`জরুরি বকেয়া কিস্তি পরিশোধের তাগাদা - ${m.name}`);
      setCustomMessageBody(`আসসালামু আলাইকুম ${m.name},\n\nআল ইত্তেহাদ ফোরাম থেকে জানানো যাচ্ছে যে, আপনার সর্বমোট বকেয়া কিস্তির পরিমাণ ৳${(m.totalDue || 0).toLocaleString()}।\n\nফোরামের নিয়মিত কার্যক্রম ও সার্বিক কল্যাণমূলক প্রকল্প গতিশীল রাখতে অনুগ্রহ করে বকেয়া কিস্তি দ্রুত পরিশোধ করার জন্য বিনীত অনুরোধ করা হচ্ছে।\n\nধন্যবাদ,\nআল ইত্তেহাদ ফোরাম প্রশাসন`);
      setCopiedText(false);
    };

    return (
      <div className="space-y-5 sm:space-y-6 md:space-y-8 animate-in fade-in duration-700">
        {/* Admin Header Banner - Responsive for all mobile screens */}
        <div className={`${cardClass} border-none bg-gradient-to-br from-emerald-600 via-emerald-700 to-green-800 text-white p-5 sm:p-6 md:p-10 shadow-xl relative overflow-hidden`}>
          <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 md:gap-10 relative z-10">
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl sm:rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-[10px] sm:text-xs font-black tracking-wider uppercase mb-1.5 sm:mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                অফিসিয়াল এডমিন প্যানেল
              </div>
              <h2 className="text-xl sm:text-2xl md:text-4xl font-black mb-1 uppercase tracking-tight">এডমিন ড্যাশবোর্ড</h2>
              <p className="opacity-90 max-w-xl text-xs sm:text-sm">ফোরামের সার্বিক আর্থিক স্থিতি, সদস্য আমানত ও কার্যকরী প্রজেক্ট নিয়ন্ত্রণ কেন্দ্র।</p>
            </div>

            {/* Counters - Responsive grid on mobile, flex on desktop */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full md:w-auto md:flex md:items-center">
              <div className="bg-white/10 p-3 sm:p-4 md:p-6 rounded-2xl md:rounded-[28px] text-center border border-white/10">
                <div className="text-xl sm:text-2xl md:text-3xl font-black">{regularMembers.length}</div>
                <div className="text-[9px] sm:text-[10px] uppercase font-black opacity-75 mt-0.5">মোট সদস্য</div>
              </div>
              <div className="bg-white/10 p-3 sm:p-4 md:p-6 rounded-2xl md:rounded-[28px] text-center border border-white/10">
                <div className="text-xl sm:text-2xl md:text-3xl font-black">{allBusinesses.length}</div>
                <div className="text-[9px] sm:text-[10px] uppercase font-black opacity-75 mt-0.5">প্রজেক্ট ও ব্যবসা</div>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Deposit Notification Banner if any */}
        {pendingDeposits.length > 0 && (
          <div 
            onClick={() => setView('admin-deposits')}
            className="p-3.5 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 hover:bg-amber-500/15 transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500 animate-ping shrink-0"></span>
              <div className="text-amber-800 dark:text-amber-300 font-bold text-xs sm:text-sm md:text-base">
                <strong>{pendingDeposits.length}টি নতুন পেমেন্ট রিকোয়েস্ট</strong> অনুমোদনের অপেক্ষায় রয়েছে!
              </div>
            </div>
            <button 
              type="button" 
              className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>যাচাই ও অ্যাপ্রুভ করুন</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* ১. আর্থিক পরিসংখ্যান (Financial Statistics - 2 col on mobile, 4 on desktop) */}
        <div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-base sm:text-lg md:text-xl font-black flex items-center gap-2 ${textPrimary}`}>
              <Coins className="text-amber-500 w-5 h-5 sm:w-6 sm:h-6" />
              <span>আর্থিক পরিসংখ্যান ও স্থিতি</span>
            </h3>
            <span className={`text-[10px] sm:text-xs font-bold ${textSecondary}`}>রিয়েল-টাইম ডাটা</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
            {/* মোট সঞ্চয় জমা */}
            <div className={`${cardClass} p-3.5 sm:p-5 md:p-6 border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 via-white to-white dark:from-emerald-950/20 dark:via-slate-800 dark:to-slate-800 relative overflow-hidden group hover:border-emerald-500/40 transition-all`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shadow-sm">
                  <Coins className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                  মোট আমানত
                </span>
              </div>
              <div className={`text-lg sm:text-2xl md:text-3xl font-black ${textPrimary} tracking-tight truncate`}>
                ৳{totalSavings.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1 truncate">
                সকল সদস্যের সঞ্চয় ফান্ড
              </div>
            </div>

            {/* মোট সদস্য বকেয়া */}
            <div className={`${cardClass} p-3.5 sm:p-5 md:p-6 border-rose-500/20 bg-gradient-to-br from-rose-50/50 via-white to-white dark:from-rose-950/20 dark:via-slate-800 dark:to-slate-800 relative overflow-hidden group hover:border-rose-500/40 transition-all`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center shadow-sm">
                  <AlertCircle className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                  অপরিশোধিত
                </span>
              </div>
              <div className="text-lg sm:text-2xl md:text-3xl font-black text-rose-600 tracking-tight truncate">
                ৳{totalDue.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1 truncate">
                মোট বকেয়া কিস্তি সমূহ
              </div>
            </div>

            {/* মাসিক সঞ্চয় লক্ষ্যমাত্রা */}
            <div className={`${cardClass} p-3.5 sm:p-5 md:p-6 border-blue-500/20 bg-gradient-to-br from-blue-50/50 via-white to-white dark:from-blue-950/20 dark:via-slate-800 dark:to-slate-800 relative overflow-hidden group hover:border-blue-500/40 transition-all`}>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center shadow-sm">
                  <Calendar className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                  মাসিক হার
                </span>
              </div>
              <div className={`text-lg sm:text-2xl md:text-3xl font-black ${textPrimary} tracking-tight truncate`}>
                ৳{monthlyTarget.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1 truncate">
                নিয়মিত মাসিক লক্ষ্যমাত্রা
              </div>
            </div>

            {/* পেমেন্ট রিকোয়েস্ট স্ট্যাটাস */}
            <div 
              onClick={() => setView('admin-deposits')}
              className={`${cardClass} p-3.5 sm:p-5 md:p-6 border-amber-500/20 bg-gradient-to-br from-amber-50/50 via-white to-white dark:from-amber-950/20 dark:via-slate-800 dark:to-slate-800 relative overflow-hidden group hover:border-amber-500/40 transition-all cursor-pointer`}
            >
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shadow-sm">
                  <Banknote className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full ${
                  pendingDeposits.length > 0 ? 'bg-amber-500 text-slate-950 animate-pulse' : 'text-slate-500 bg-slate-100 dark:bg-slate-700'
                }`}>
                  {pendingDeposits.length > 0 ? `${pendingDeposits.length} পেন্ডিং` : 'ক্লিয়ার'}
                </span>
              </div>
              <div className={`text-lg sm:text-2xl md:text-3xl font-black ${pendingDeposits.length > 0 ? 'text-amber-600' : textPrimary} tracking-tight truncate`}>
                {allDepositRequests.length}টি
              </div>
              <div className="text-[10px] sm:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1 flex items-center justify-between">
                <span>পেমেন্ট রিকোয়েস্ট</span>
                <span className="text-emerald-600 font-bold text-[10px] sm:text-[11px] group-hover:underline">দেখুন →</span>
              </div>
            </div>
          </div>
        </div>

        {/* ২. কুইক অ্যাকশন হাব (Quick Action Hub - 3 cols on mobile, 6 on desktop) */}
        <div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className={`text-base sm:text-lg md:text-xl font-black flex items-center gap-2 ${textPrimary}`}>
              <ShieldCheck className="text-emerald-600 w-5 h-5 sm:w-6 sm:h-6" />
              <span>কুইক অ্যাকশন হাব</span>
            </h3>
            <span className={`text-[10px] sm:text-xs font-bold ${textSecondary}`}>এক ক্লিকে পরিচালনা</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3.5 md:gap-4">
            {/* নতুন সদস্য */}
            <button 
              onClick={() => setShowAddMemberModal(true)} 
              className={`${cardClass} p-2.5 sm:p-4 md:p-5 flex flex-col items-center text-center gap-1.5 sm:gap-2.5 hover:border-emerald-500 hover:shadow-lg active:scale-95 transition-all group`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={`font-black text-[11px] sm:text-xs md:text-sm ${textPrimary} truncate w-full`}>নতুন সদস্য</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 -mt-1 hidden xs:block">রেজিস্ট্রেশন</span>
            </button>

            {/* পেমেন্ট রিকোয়েস্ট */}
            <button 
              onClick={() => setView('admin-deposits')} 
              className={`${cardClass} p-2.5 sm:p-4 md:p-5 flex flex-col items-center text-center gap-1.5 sm:gap-2.5 hover:border-amber-500 hover:shadow-lg active:scale-95 transition-all group relative`}
            >
              {pendingDeposits.length > 0 && (
                <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-rose-500 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full animate-bounce">
                  {pendingDeposits.length}
                </span>
              )}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Banknote className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={`font-black text-[11px] sm:text-xs md:text-sm ${textPrimary} truncate w-full`}>পেমেন্ট যাচাই</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 -mt-1 hidden xs:block">রিকোয়েস্ট</span>
            </button>

            {/* সদস্য ব্যবস্থাপনা */}
            <button 
              onClick={() => setView('admin-members')} 
              className={`${cardClass} p-2.5 sm:p-4 md:p-5 flex flex-col items-center text-center gap-1.5 sm:gap-2.5 hover:border-blue-500 hover:shadow-lg active:scale-95 transition-all group`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <UserCog className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={`font-black text-[11px] sm:text-xs md:text-sm ${textPrimary} truncate w-full`}>সদস্য তালিকা</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 -mt-1 hidden xs:block">হিসাব ও মেসেজ</span>
            </button>

            {/* নতুন নোটিশ */}
            <button 
              onClick={() => setShowAddNoticeModal(true)} 
              className={`${cardClass} p-2.5 sm:p-4 md:p-5 flex flex-col items-center text-center gap-1.5 sm:gap-2.5 hover:border-rose-500 hover:shadow-lg active:scale-95 transition-all group`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={`font-black text-[11px] sm:text-xs md:text-sm ${textPrimary} truncate w-full`}>নতুন নোটিশ</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 -mt-1 hidden xs:block">প্রকাশ করুন</span>
            </button>

            {/* প্রজেক্ট কন্ট্রোল */}
            <button 
              onClick={() => setView('admin-businesses')} 
              className={`${cardClass} p-2.5 sm:p-4 md:p-5 flex flex-col items-center text-center gap-1.5 sm:gap-2.5 hover:border-teal-500 hover:shadow-lg active:scale-95 transition-all group`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={`font-black text-[11px] sm:text-xs md:text-sm ${textPrimary} truncate w-full`}>প্রজেক্ট কন্ট্রোল</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 -mt-1 hidden xs:block">ব্যবসা ও অগ্রগতি</span>
            </button>

            {/* শুরা ও ভোটিং */}
            <button 
              onClick={() => setView('admin-voting')} 
              className={`${cardClass} p-2.5 sm:p-4 md:p-5 flex flex-col items-center text-center gap-1.5 sm:gap-2.5 hover:border-purple-500 hover:shadow-lg active:scale-95 transition-all group`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Vote className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className={`font-black text-[11px] sm:text-xs md:text-sm ${textPrimary} truncate w-full`}>শুরা ও ভোট</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 -mt-1 hidden xs:block">পরামর্শ পোল</span>
            </button>
          </div>
        </div>

        {/* ৩. গ্রাফ ও বকেয়া রিমাইন্ডার শর্টকাট (Visual Graph & Due Reminders) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
          {/* মাসিক সঞ্চয় আদায়ের গ্রাফ (7 cols) */}
          <div className={`${cardClass} lg:col-span-7 flex flex-col justify-between p-4 sm:p-6`}>
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className={`font-black text-base sm:text-lg flex items-center gap-2 ${textPrimary}`}>
                    <TrendingUp size={20} className="text-emerald-600" />
                    <span>মাসিক সঞ্চয় আদায়ের গ্রাফ</span>
                  </h3>
                  <p className={`text-[11px] sm:text-xs ${textSecondary} mt-0.5`}>বিগত ৬ মাসের নিয়মিত কিস্তি আদায় ট্রেন্ড</p>
                </div>
                <span className="text-[10px] sm:text-xs font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  গড় হার: ৯৩%
                </span>
              </div>

              {/* Responsive Bar Chart */}
              <div className="pt-6 pb-2">
                <div className="h-40 sm:h-48 flex items-end justify-between gap-2 sm:gap-4 px-1 sm:px-2">
                  {monthlyChartData.map((item, idx) => {
                    const barHeightPct = Math.max(20, Math.round((item.amount / maxBarAmount) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                        {/* Amount tooltip above bar */}
                        <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 opacity-90 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          ৳{(item.amount / 1000).toFixed(0)}k
                        </div>

                        {/* Bar */}
                        <div className="w-full max-w-[44px] bg-slate-100 dark:bg-slate-800/80 rounded-t-xl sm:rounded-t-2xl relative overflow-hidden flex flex-col justify-end h-full">
                          <div 
                            style={{ height: `${barHeightPct}%` }}
                            className={`w-full rounded-t-xl sm:rounded-t-2xl transition-all duration-700 ease-out group-hover:brightness-110 ${
                              item.current 
                                ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md ring-2 ring-emerald-500/30' 
                                : 'bg-gradient-to-t from-emerald-700/80 to-emerald-500/80'
                            }`}
                          ></div>
                        </div>

                        {/* Month Label */}
                        <div className={`mt-2 text-[10px] sm:text-xs font-bold ${item.current ? 'text-emerald-600 dark:text-emerald-400 font-black' : textSecondary} text-center truncate w-full`}>
                          {item.month}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom summary strip */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500">
              <span>লক্ষ্যমাত্রা: ৳{monthlyTarget.toLocaleString()}/মাস</span>
              <span className="text-emerald-600 font-black">আদায় নিয়মিত</span>
            </div>
          </div>

          {/* বকেয়া রিমাইন্ডার শর্টকাট (5 cols) */}
          <div className={`${cardClass} lg:col-span-5 flex flex-col justify-between p-4 sm:p-6 border-rose-500/15`}>
            <div>
              <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className={`font-black text-base sm:text-lg flex items-center gap-2 ${textPrimary}`}>
                    <AlertCircle size={20} className="text-rose-600" />
                    <span>বকেয়া তাগাদা শর্টকাট</span>
                  </h3>
                  <p className={`text-[11px] sm:text-xs ${textSecondary} mt-0.5`}>শীর্ষ বকেয়া থাকা সদস্যদের দ্রুত তাগাদা পাঠান</p>
                </div>
                <span className="text-[10px] sm:text-xs font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 px-2.5 py-1 rounded-full border border-rose-500/20">
                  {membersWithDues.length} জন
                </span>
              </div>

              {/* Due Members List */}
              <div className="space-y-2.5">
                {membersWithDues.map(m => (
                  <div 
                    key={m.id}
                    className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2.5 hover:border-rose-400/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img 
                        src={m.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'} 
                        alt={m.name} 
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0" 
                      />
                      <div className="min-w-0">
                        <div className={`font-black text-xs sm:text-sm ${textPrimary} truncate`}>{m.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-tight">{m.id}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                        ৳{m.totalDue.toLocaleString()}
                      </span>

                      {/* WhatsApp Reminder Button */}
                      <a 
                        href={generateFinancialWhatsAppLink(m, "অনুগ্রহ করে আল ইত্তেহাদ ফোরামের বকেয়া কিস্তি পরিশোধের জন্য বিনীত অনুরোধ করা হচ্ছে।")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 sm:p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-600 dark:hover:text-white rounded-xl transition-all shadow-sm"
                        title="হোয়াটসঅ্যাপে তাগাদা পাঠান"
                      >
                        <MessageCircle size={15} />
                      </a>

                      {/* In-App Direct Message Reminder */}
                      <button 
                        type="button"
                        onClick={() => openDueReminder(m)}
                        className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white rounded-xl transition-all shadow-sm"
                        title="বার্তা ও নোটিশ পাঠান"
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {membersWithDues.length === 0 && (
                  <div className="py-8 text-center text-slate-400 font-bold text-xs">
                    আলহামদুলিল্লাহ! কোনো সদস্যের বকেয়া নেই।
                  </div>
                )}
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setView('admin-members')}
              className="mt-3 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>সকল সদস্যের হিসাব ও বকেয়া তালিকা</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* ৪. সাম্প্রতিক লেনদেন (Recent Transactions - Dual presentation for mobile & desktop) */}
        <div className={cardClass}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className={`font-black text-base sm:text-lg md:text-xl flex items-center gap-2 sm:gap-2.5 ${textPrimary}`}>
                <History size={20} className="text-emerald-600" />
                <span>সাম্প্রতিক লেনদেন ইতিহাস</span>
              </h3>
              <p className={`text-[11px] sm:text-xs ${textSecondary} mt-0.5`}>
                সদস্যদের সর্বশেষ কিস্তি জমা ও ডিজিটাল ক্যাশ মেমো
              </p>
            </div>
            <button 
              onClick={() => setView('admin-members')}
              className="text-[11px] sm:text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <span>সকল সদস্যের হিসাব</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Desktop & Tablet Table (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black text-slate-400">
                  <th className="pb-3 px-2">সদস্য</th>
                  <th className="pb-3 px-2">বিবরণ ও মাধ্যম</th>
                  <th className="pb-3 px-2">তারিখ</th>
                  <th className="pb-3 px-2 text-right">পরিমাণ</th>
                  <th className="pb-3 px-2 text-center">ডিজিটাল রসিদ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {recentTransactions.map(t => {
                  const member = allMembers.find(m => m.id === t.memberId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-3">
                          <img 
                            src={member?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'} 
                            alt={member?.name || t.memberId}
                            className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                          />
                          <div>
                            <div className={`font-bold text-xs md:text-sm ${textPrimary}`}>
                              {member?.name || 'অজ্ঞাত সদস্য'}
                            </div>
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">
                              ID: {t.memberId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <div className={`text-xs font-semibold ${textPrimary}`}>
                          {t.description || 'নিয়মিত সঞ্চয় কিস্তি'}
                        </div>
                        {t.receiptNo && (
                          <span className="inline-block text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mt-0.5">
                            #{t.receiptNo}
                          </span>
                        )}
                      </td>
                      <td className={`py-3.5 px-2 text-xs font-medium ${textSecondary} whitespace-nowrap`}>
                        {t.date}
                      </td>
                      <td className="py-3.5 px-2 text-right whitespace-nowrap">
                        <span className="text-sm md:text-base font-black text-emerald-600 dark:text-emerald-400">
                          ৳{(t.amount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openReceiptForTransaction(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-300/40 transition-all active:scale-95 shadow-sm cursor-pointer"
                          title="মানি রিসিট ডাউনলোড ও হোয়াটসঅ্যাপে শেয়ার"
                        >
                          <FileText size={13} />
                          <span>রসিদ</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {recentTransactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold text-sm">
                      কোনো সাম্প্রতিক লেনদেন রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile-Friendly Transaction Cards List (under md) */}
          <div className="md:hidden space-y-2.5">
            {recentTransactions.map(t => {
              const member = allMembers.find(m => m.id === t.memberId);
              return (
                <div 
                  key={t.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img 
                        src={member?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'} 
                        alt={member?.name || t.memberId}
                        className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className={`font-bold text-xs ${textPrimary} truncate`}>
                          {member?.name || 'অজ্ঞাত সদস্য'}
                        </div>
                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">
                          ID: {t.memberId}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        ৳{(t.amount || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 text-[11px]">
                    <div className="text-slate-400 truncate flex-1">
                      <span>{t.date}</span>
                      {t.receiptNo && <span className="ml-1.5 font-mono">#{t.receiptNo}</span>}
                    </div>

                    <button
                      type="button"
                      onClick={() => openReceiptForTransaction(t)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs shrink-0 active:scale-95 transition-all shadow-xs"
                    >
                      <FileText size={12} />
                      <span>রসিদ</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {recentTransactions.length === 0 && (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">
                কোনো সাম্প্রতিক লেনদেন রেকর্ড পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAdminMembers = () => (
    <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className={cardClass}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${textPrimary}`}>সদস্য ব্যবস্থাপনা</h2>
            <p className={`text-xs md:text-sm ${textSecondary} mt-1`}>সদস্যদের হিসাব বিবরণী, নোটিশ, ইমেইল, হোয়াটসঅ্যাপ ও পার্সোনাল মেসেজ পাঠান</p>
          </div>
          <button 
            onClick={()=>setShowAddMemberModal(true)} 
            className="w-full sm:w-auto justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 text-xs sm:text-sm md:text-base"
          >
            <UserPlus size={18}/> <span>নতুন সদস্য</span>
          </button>
        </div>

        {/* DESKTOP & TABLET VIEW: FULL DATA TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400">সদস্য</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">সঞ্চয় (৳)</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">বকেয়া (৳)</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">মেসেজ ও অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {allMembers.filter(m=>m.role!=='admin').map(m=>(
                <tr key={m.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                  <td className="py-6 flex items-center gap-4">
                    <img src={m.avatar} className="w-12 h-12 rounded-xl object-cover border-2 border-slate-100 dark:border-slate-700"/>
                    <div>
                      <div className={`font-black text-sm ${textPrimary}`}>{m.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">{m.id}</span>
                        {m.phone && <span className="text-[10px] text-slate-400">({m.phone})</span>}
                      </div>
                    </div>
                  </td>
                  <td className={`py-6 text-sm font-black text-right ${textPrimary}`}>৳{m.totalSaved.toLocaleString()}</td>
                  <td className="py-6 text-sm font-black text-right text-rose-500">৳{m.totalDue.toLocaleString()}</td>
                  <td className="py-6 text-right">
                    <div className="flex items-center justify-end gap-1.5 md:gap-2">
                      {/* Communication Hub Button */}
                      <button 
                        onClick={() => {
                          setCommunicationMember(m);
                          setCustomMessageTitle(`আর্থিক হিসাব বিবরণী ও নোটিশ - ${m.name}`);
                          setCustomMessageBody(`আসসালামু আলাইকুম ${m.name},\n\nআল ইত্তেহাদ ফোরাম থেকে আপনার বর্তমান আর্থিক হিসাব:\n• মোট সঞ্চয় জমা: ৳${m.totalSaved.toLocaleString()}\n• মাসিক সঞ্চয় হার: ৳${m.monthlySavings.toLocaleString()}\n• মোট বকেয়া: ৳${m.totalDue.toLocaleString()}\n• লভ্যাংশ: ৳${m.profitShare.toLocaleString()}\n\nঅনুগ্রহ করে বকেয়া থাকলে দ্রুত পরিশোধ করে ফোরামের কাজে সহায়তা করার জন্য অনুরোধ করা হলো।\n\nধন্যবাদ,\nআল ইত্তেহাদ ফোরাম`);
                          setCopiedText(false);
                        }}
                        title="পার্সোনাল মেসেজ, ইমেইল বা হোয়াটসঅ্যাপ পাঠান" 
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                      >
                        <Send size={14} />
                        <span className="hidden sm:inline">মেসেজ পাঠান</span>
                      </button>

                      {/* Add Payment */}
                      <button onClick={()=>setShowAddPaymentModal({member:m})} title="পেমেন্ট যোগ" className="p-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-xl hover:bg-amber-600 hover:text-white transition-all shadow-sm">
                        <Coins size={16}/>
                      </button>

                      {/* Edit */}
                      <button onClick={()=>setEditingMember(m)} title="এডিট" className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors">
                        <Edit size={16}/>
                      </button>

                      {/* Delete */}
                      <button onClick={()=>deleteMember(m.id)} title="ডিলিট" className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-900/30 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW: CLEAN TOUCH-FRIENDLY MEMBER CARDS */}
        <div className="md:hidden space-y-3.5">
          {allMembers.filter(m=>m.role!=='admin').map(m => (
            <div
              key={m.id}
              className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-3 transition-all"
            >
              {/* Member Top Info */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                  />
                  <div className="min-w-0">
                    <div className={`font-black text-sm truncate ${textPrimary}`}>{m.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tight bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                        {m.id}
                      </span>
                      {m.phone && (
                        <span className="text-[11px] text-slate-400 font-mono truncate">
                          {m.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Balance Summary Strip */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">মোট সঞ্চয়</span>
                  <span className="text-xs font-black text-emerald-600">
                    ৳{m.totalSaved.toLocaleString()}
                  </span>
                </div>
                <div className="border-x border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block">মোট বকেয়া</span>
                  <span className={`text-xs font-black ${m.totalDue > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                    ৳{m.totalDue.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">মাসিক কিস্তি</span>
                  <span className={`text-xs font-black ${textPrimary}`}>
                    ৳{m.monthlySavings.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCommunicationMember(m);
                    setCustomMessageTitle(`আর্থিক হিসাব বিবরণী ও নোটিশ - ${m.name}`);
                    setCustomMessageBody(`আসসালামু আলাইকুম ${m.name},\n\nআল ইত্তেহাদ ফোরাম থেকে আপনার বর্তমান আর্থিক হিসাব:\n• মোট সঞ্চয় জমা: ৳${m.totalSaved.toLocaleString()}\n• মাসিক সঞ্চয় হার: ৳${m.monthlySavings.toLocaleString()}\n• মোট বকেয়া: ৳${m.totalDue.toLocaleString()}\n• লভ্যাংশ: ৳${m.profitShare.toLocaleString()}\n\nঅনুগ্রহ করে বকেয়া থাকলে দ্রুত পরিশোধ করে ফোরামের কাজে সহায়তা করার জন্য অনুরোধ করা হলো।\n\nধন্যবাদ,\nআল ইত্তেহাদ ফোরাম`);
                    setCopiedText(false);
                  }}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Send size={13} />
                  <span>মেসেজ পাঠান</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal({ member: m })}
                  title="পেমেন্ট যোগ"
                  className="p-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-xl hover:bg-amber-600 hover:text-white transition-all shadow-xs"
                >
                  <Coins size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setEditingMember(m)}
                  title="এডিট"
                  className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-xs"
                >
                  <Edit size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => deleteMember(m.id)}
                  title="ডিলিট"
                  className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-900/30 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-xs"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Member Communication Modal */}
      {communicationMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
          <div className="absolute inset-0" onClick={()=>setCommunicationMember(null)}></div>
          <div className={`${isDarkMode?'bg-slate-900':'bg-white'} p-4 sm:p-6 md:p-8 rounded-[28px] sm:rounded-[40px] shadow-2xl w-full max-w-3xl relative max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <img src={communicationMember.avatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-md" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl md:text-2xl font-black text-emerald-600 tracking-tight">{communicationMember.name}</h3>
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      ID: {communicationMember.id}
                    </span>
                  </div>
                  <p className={`text-xs ${textSecondary} mt-0.5`}>ফোন: {communicationMember.phone || 'দেওয়া নেই'} | ইমেইল: {communicationMember.email || 'দেওয়া নেই'}</p>
                </div>
              </div>
              <button onClick={()=>setCommunicationMember(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Financial Balance Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">মোট সঞ্চয়</span>
                <span className="text-base font-black text-emerald-600">৳{communicationMember.totalSaved.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">মোট বকেয়া</span>
                <span className="text-base font-black text-rose-500">৳{communicationMember.totalDue.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">মাসিক কিস্তি</span>
                <span className={`text-base font-black ${textPrimary}`}>৳{communicationMember.monthlySavings.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-black text-slate-400 block mb-0.5">লভ্যাংশ</span>
                <span className="text-base font-black text-blue-600">৳{communicationMember.profitShare.toLocaleString()}</span>
              </div>
            </div>

            {/* Instant Communication Action Buttons */}
            <div className="mb-6">
              <label className={`block text-[11px] font-black uppercase mb-3 ${textSecondary}`}>তাত্ক্ষণিক যোগাযোগ ও সেন্ড বাটন</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Email Draft Button */}
                <a 
                  href={generateFinancialEmailLink(communicationMember, customMessageTitle, customMessageBody)}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 text-center"
                >
                  <Mail size={16} />
                  <span>ইমেইল পাঠান (Mailto)</span>
                </a>

                {/* WhatsApp Button */}
                <a 
                  href={generateFinancialWhatsAppLink(communicationMember, customMessageBody)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 text-center"
                >
                  <MessageCircle size={16} />
                  <span>হোয়াটসঅ্যাপে পাঠান</span>
                </a>

                {/* Copy Text Button */}
                <button 
                  onClick={() => {
                    const text = `আসসালামু আলাইকুম ${communicationMember.name},\nআল ইত্তেহাদ ফোরাম থেকে আপনার আর্থিক হিসাব বিবরণী:\n• মোট সঞ্চয় জমা: ৳${communicationMember.totalSaved.toLocaleString()}\n• মাসিক সঞ্চয় হার: ৳${communicationMember.monthlySavings.toLocaleString()}\n• মোট বকেয়া: ৳${communicationMember.totalDue.toLocaleString()}\n• লভ্যাংশ: ৳${communicationMember.profitShare.toLocaleString()}\n\n${customMessageBody}`;
                    navigator.clipboard.writeText(text);
                    setCopiedText(true);
                    setTimeout(() => setCopiedText(false), 3000);
                  }}
                  className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-sm transition-all active:scale-95 text-center"
                >
                  {copiedText ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  <span>{copiedText ? 'টেক্সট কপি হয়েছে!' : 'হিসাব টেক্সট কপি'}</span>
                </button>
              </div>
            </div>

            {/* In-App Direct Message Form */}
            <form onSubmit={handleSendMemberDirectMessage} className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className={`block text-[11px] font-black uppercase mb-1.5 ${textSecondary}`}>বার্তার শিরোনাম / বিষয়</label>
                <input 
                  value={customMessageTitle} 
                  onChange={e => setCustomMessageTitle(e.target.value)} 
                  required 
                  className={`w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none text-sm font-bold ${textPrimary}`} 
                  placeholder="যেমন: মে মাসের সঞ্চয় ও বকেয়া নোটিশ"
                />
              </div>

              <div>
                <label className={`block text-[11px] font-black uppercase mb-1.5 ${textSecondary}`}>বার্তা / বিবরণ (সদস্যের ড্যাশবোর্ডে যাবে)</label>
                <textarea 
                  value={customMessageBody} 
                  onChange={e => setCustomMessageBody(e.target.value)} 
                  rows={4} 
                  required 
                  className={`w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none text-sm leading-relaxed ${textPrimary}`} 
                  placeholder="সদস্যের উদ্দেশ্যে কোনো বার্তা লিখুন..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  type="submit" 
                  disabled={isSendingMessage} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSendingMessage ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>সদস্যের ড্যাশবোর্ডে মেসেজ পাঠান</span>
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  onClick={()=>setCommunicationMember(null)}
                  className="px-6 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-sm hover:bg-slate-200 transition-colors"
                >
                  বন্ধ করুন
                </button>
              </div>
            </form>

            {/* Sent Messages History for this Member */}
            {(() => {
              const previousMessages = allMemberMessages.filter(m => m.memberId === communicationMember.id);
              if (previousMessages.length === 0) return null;
              return (
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h4 className={`text-sm font-black uppercase tracking-wider mb-3 ${textSecondary}`}>
                    পূর্বে পাঠানো বার্তা ({previousMessages.length}টি)
                  </h4>
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {previousMessages.map(prev => (
                      <div key={prev.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-black ${textPrimary}`}>{prev.title}</span>
                            <span className="text-[10px] text-slate-400">({prev.date})</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${prev.read ? 'bg-slate-200 dark:bg-slate-700 text-slate-500' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'}`}>
                              {prev.read ? 'পঠিত' : 'অপঠিত'}
                            </span>
                          </div>
                          <p className={`text-xs ${textSecondary} line-clamp-1`}>{prev.message}</p>
                        </div>
                        <button 
                          onClick={async () => {
                            if (window.confirm('আপনি কি এই মেসেজটি ডিলিট করতে চান?')) {
                              try {
                                await deleteDoc(doc(firestore, 'member_messages', prev.id));
                              } catch (err) {
                                console.error("Error deleting member message:", err);
                              }
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                          title="ডিলিট"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      
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
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>রশিদ নং (Receipt No - ঐচ্ছিক)</label>
                   <input name="receiptNo" className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="যেমন: R-1025" />
                 </div>
                 <div>
                   <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>বিবরণ</label>
                   <input name="description" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="যেমন: মে মাসের সঞ্চয়" />
                 </div>
               </div>
               <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl shadow-xl transition-all hover:bg-emerald-700 active:scale-95">জমা করুন</button>
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

  const AdBanner = () => {
    const activeAd = allAds.find(ad => ad.active);
    const adRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
      if (activeAd?.type === 'code' && adRef.current) {
        // Clear previous content
        adRef.current.innerHTML = '';
        
        // Create a temporary container to parse the HTML
        const div = document.createElement('div');
        div.innerHTML = activeAd.content;
        
        // Find all scripts
        const scripts = div.querySelectorAll('script');
        
        // Append non-script content first
        const nonScripts = Array.from(div.childNodes).filter(node => node.nodeName !== 'SCRIPT');
        nonScripts.forEach(node => adRef.current?.appendChild(node.cloneNode(true)));

        // Execute scripts
        scripts.forEach(oldScript => {
          const newScript = document.createElement('script');
          Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
          if (oldScript.innerHTML) {
            newScript.innerHTML = oldScript.innerHTML;
          }
          adRef.current?.appendChild(newScript);
        });
      }
    }, [activeAd, isMobile]);

    if (!activeAd) return null;

    // Mobile: 320x50, Desktop: 728x90
    const targetWidth = isMobile ? 320 : 728;
    const targetHeight = isMobile ? 50 : 90;
    // Scale the 728x90 content to fit the target width
    const scale = isMobile ? (320 / 728) : 1;

    return (
      <div className="w-full flex justify-center py-6 px-4">
        <div 
          className="bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center shadow-xl border border-gray-200 dark:border-slate-700 transition-all duration-500"
          style={{ 
            width: `${targetWidth}px`, 
            height: `${targetHeight}px`,
            position: 'relative'
          }}
        >
          <div 
            className="flex items-center justify-center shrink-0"
            style={{ 
              width: '728px', 
              height: '90px', 
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              position: 'absolute'
            }}
          >
            {activeAd.type === 'image' && (
              <a href={activeAd.link} target="_blank" rel="noopener noreferrer" className="w-full h-full">
                <img src={activeAd.content} alt="Advertisement" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </a>
            )}
            {activeAd.type === 'video' && (
              <video src={activeAd.content} autoPlay loop muted playsInline className="w-full h-full object-cover" />
            )}
            {activeAd.type === 'code' && (
              <div ref={adRef} className="w-full h-full overflow-hidden flex items-center justify-center" />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderProfileSettings = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className={`${cardClass} border-none bg-gradient-to-br from-emerald-600 to-green-700 text-white p-8 md:p-12 relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img src={activeMember?.avatar} className="w-32 h-32 md:w-40 md:h-40 rounded-3xl object-cover border-4 border-white/20 shadow-2xl" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
              <Camera className="text-white w-10 h-10" />
            </div>
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-black mb-2 uppercase tracking-tight">প্রোফাইল সেটিংস</h2>
            <p className="opacity-90 font-medium">আপনার ব্যক্তিগত তথ্য ও নিরাপত্তা নিয়ন্ত্রণ করুন</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className={cardClass}>
            <h3 className={`font-black text-xl mb-8 flex items-center gap-2 ${textPrimary}`}><User size={20} className="text-emerald-600" /> ব্যক্তিগত তথ্য</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>সদস্য আইডি (অপরিবর্তনীয়)</label>
                  <input disabled value={activeMember?.id} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none opacity-50 ${textPrimary}`} />
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>নাম (অপরিবর্তনীয়)</label>
                  <input disabled value={activeMember?.name} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none opacity-50 ${textPrimary}`} />
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>ইমেইল এড্রেস</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input name="email" type="email" defaultValue={activeMember?.email} className={`w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="example@email.com" />
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>মোবাইল নম্বর</label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input name="phone" type="text" defaultValue={activeMember?.phone} className={`w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="01XXX-XXXXXX" />
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <h4 className={`font-black text-sm mb-4 flex items-center gap-2 ${textPrimary}`}><Lock size={16} className="text-emerald-600" /> নিরাপত্তা</h4>
                <div className="max-w-md">
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>নতুন পাসওয়ার্ড (পরিবর্তন করতে চাইলে)</label>
                  <input name="password" type="password" className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} placeholder="••••••••" />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-10 py-4 rounded-2xl shadow-xl transition-all active:scale-95">
                  তথ্য সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
          {/* Notification Schedule & Settings Card */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-black text-lg flex items-center gap-2 ${textPrimary}`}>
                <Bell size={18} className="text-emerald-600" /> নোটিফিকেশন সেন্টার
              </h3>
              {pushNotification.isGranted ? (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  সক্রিয়
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-full">
                  বন্ধ
                </span>
              )}
            </div>

            {pushNotification.isGranted ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle size={16} />
                  </div>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">পুশ নোটিফিকেশন সক্রিয়</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await pushNotification.requestPermission();
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Bell size={14} /> পুশ নোটিফিকেশন চালু করুন
              </button>
            )}
          </div>

          <div className={cardClass}>
            <h3 className={`font-black text-xl mb-6 flex items-center gap-2 ${textPrimary}`}><Bell size={20} className="text-emerald-600" /> পাসওয়ার্ড রিসেট</h3>
            <p className={`text-xs ${textSecondary} mb-6 leading-relaxed`}>
              আপনি যদি আপনার পাসওয়ার্ড ভুলে যান বা রিসেট করতে চান, তবে নিচের বাটনে ক্লিক করুন। আপনার নিবন্ধিত ইমেইলে একটি রিসেট লিংক পাঠানো হবে।
            </p>
            <button 
              onClick={handleSendResetLink}
              disabled={isResetting}
              className="w-full bg-slate-900 dark:bg-slate-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isResetting ? 'পাঠানো হচ্ছে...' : 'রিসেট লিংক পাঠান'}
            </button>
          </div>

          <div className={`${cardClass} bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30`}>
            <div className="flex items-start gap-4">
              <div className="bg-emerald-600 p-2 rounded-lg text-white">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className={`font-black text-sm mb-1 ${textPrimary}`}>নিরাপত্তা টিপস</h4>
                <p className={`text-[10px] ${textSecondary} leading-relaxed`}>
                  আপনার পাসওয়ার্ড কারো সাথে শেয়ার করবেন না। নিয়মিত পাসওয়ার্ড পরিবর্তন করা আপনার অ্যাকাউন্টের নিরাপত্তা নিশ্চিত করে।
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDepositPage = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className={`${cardClass} border-none bg-gradient-to-br from-emerald-600 to-green-700 text-white p-8 md:p-12 relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="bg-white/20 p-6 rounded-3xl backdrop-blur-md">
            <Coins size={48} className="text-white" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-black mb-2 uppercase tracking-tight">সঞ্চয় জমা দিন</h2>
            <p className="opacity-90 font-medium">নিচের একাউন্টগুলোতে টাকা পাঠিয়ে তথ্যাদি সাবমিট করুন</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className={cardClass}>
            <h3 className={`font-black text-lg mb-6 flex items-center gap-2 ${textPrimary}`}><Banknote size={20} className="text-emerald-600" /> পেমেন্ট মেথড</h3>
            <div className="space-y-4 text-sm font-bold">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                <div className="text-emerald-600 mb-1">বিকাশ (পার্সোনাল)</div>
                <div className={textPrimary}>০১৭২৩৩৬২৩৭৬</div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800">
                <div className="text-blue-600 mb-1">ব্যাংক একাউন্ট</div>
                <div className={textPrimary}>২০৫০১০৯০২০৩২৮৮০০০</div>
                <div className={`text-[10px] ${textSecondary}`}>ইসলামী ব্যাংক বাংলাদেশ</div>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800">
                <div className="text-amber-600 mb-1">নগদ (পার্সোনাল)</div>
                <div className={textPrimary}>০১৭২৩৩৬২৩৭৬</div>
              </div>
            </div>
          </div>
          
          <div className={`${cardClass} bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30`}>
             <div className="flex gap-4">
                <AlertCircle className="text-amber-600 shrink-0" />
                <div>
                   <h4 className="font-black text-sm text-amber-900 dark:text-amber-400 mb-1">সতর্কতা</h4>
                   <p className="text-[10px] leading-relaxed text-amber-800 dark:text-amber-500">টাকা পাঠানোর পর ট্রানজেকশন আইডি (Trx ID) অবশ্যই সংগ্রহ করে রাখুন। এটি ছাড়া আপনার সঞ্চয় গ্রহণ করা হবে না।</p>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className={cardClass}>
            <h3 className={`font-black text-xl mb-8 flex items-center gap-2 ${textPrimary}`}><ClipboardList size={22} className="text-emerald-600" /> পেমেন্ট সাবমিট ফরম</h3>
            <form onSubmit={handleDepositSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>পেমেন্ট মাধ্যম</label>
                  <select name="paymentMethod" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`}>
                    <option value="Bkash">বিকাশ</option>
                    <option value="Nagad">নগদ</option>
                    <option value="Bank">ব্যাংক</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>টাকার পরিমাণ (৳)</label>
                  <input name="amount" type="number" required placeholder="5000" className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} />
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>কোন নাম্বার থেকে পাঠিয়েছেন</label>
                  <input name="fromNumber" type="text" required placeholder="017XXXXXXXX" className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} />
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase mb-2 ${textSecondary}`}>ট্রানজেকশন আইডি (Trx ID)</label>
                  <input name="trxId" type="text" required placeholder="AXB55CD8" className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none outline-none ${textPrimary}`} />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3">
                  <Send size={20} /> সঞ্চয় জমা দিন
                </button>
              </div>
            </form>
          </div>
          
          <div className="mt-8">
            <h3 className={`font-black text-lg mb-6 flex items-center gap-2 ${textPrimary}`}><Clock size={20} className="text-emerald-600" /> বর্তমান রিকোয়েস্ট স্ট্যাটাস</h3>
            <div className="space-y-4">
               {allDepositRequests.filter(r => r.memberId === activeMember?.id).slice(0, 5).map(req => (
                 <div key={req.id} className={`${cardClass} flex items-center justify-between py-4`}>
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {req.status === 'approved' ? <CheckCircle size={20} /> : <Clock size={20} />}
                       </div>
                       <div>
                          <div className={`text-sm font-black ${textPrimary}`}>৳{req.amount.toLocaleString()}</div>
                          <div className={`text-[10px] font-bold ${textSecondary}`}>{req.date} • {req.paymentMethod}</div>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${req.status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                        {req.status === 'approved' ? 'সফল হয়েছে' : 'পেন্ডিং'}
                      </div>
                      {req.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => openReceiptForDeposit(req)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-xl text-[11px] font-black border border-emerald-300 dark:border-emerald-700 transition-all shadow-sm active:scale-95"
                          title="ডিজিটাল মানি রিসিট ডাউনলোড ও হোয়াটসঅ্যাপে শেয়ার"
                        >
                          <FileText size={13} />
                          <span>রসিদ</span>
                        </button>
                      )}
                    </div>
                 </div>
               ))}
               {allDepositRequests.filter(r => r.memberId === activeMember?.id).length === 0 && (
                 <p className={`text-center py-8 font-bold ${textSecondary}`}>আপনার কোনো রিকোয়েস্ট নেই</p>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdminDeposits = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className={cardClass}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <h2 className={`text-3xl font-black tracking-tight ${textPrimary}`}>পেমেন্ট রিকোয়েস্ট ম্যানেজমেন্ট</h2>
          <div className="flex gap-4">
             <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                অ্যাপ্রুভড: {allDepositRequests.filter(r => r.status === 'approved').length}
             </div>
             <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                পেন্ডিং: {allDepositRequests.filter(r => r.status === 'pending').length}
             </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400">সদস্য</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400">মাধ্যম ও নম্বর</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400">Trx ID</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">পরিমাণ</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {allDepositRequests.filter(r => r.status === 'pending').map(req => (
                <tr key={req.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/5 transition-colors">
                  <td className="py-6">
                    <div className={`font-black text-sm ${textPrimary}`}>{req.memberName}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{req.date}</div>
                  </td>
                  <td className="py-6">
                    <div className={`text-sm font-bold ${textPrimary}`}>{req.paymentMethod}</div>
                    <div className={`text-[10px] font-black text-emerald-600`}>{req.fromNumber}</div>
                  </td>
                  <td className="py-6">
                     <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg inline-block text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                        {req.trxId}
                     </div>
                  </td>
                  <td className={`py-6 text-sm font-black text-right text-emerald-600`}>৳{req.amount.toLocaleString()}</td>
                  <td className="py-6 text-right flex justify-end gap-3">
                    <button onClick={() => handleApproveDeposit(req)} title="অ্যাপ্রুভ করুন" className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg hover:scale-110 transition-transform"><CheckCircle size={20}/></button>
                    <button onClick={() => handleDeleteDeposit(req.id)} title="রিজেক্ট/ডিলিট" className="p-2 text-rose-500 hover:scale-110 transition-transform"><Trash2 size={20}/></button>
                  </td>
                </tr>
              ))}
              {allDepositRequests.filter(r => r.status === 'pending').length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                     <div className="flex flex-col items-center gap-4 text-slate-400">
                        <CheckCircle size={48} className="opacity-20" />
                        <p className="font-black uppercase text-xs">কোনো পেন্ডিং রিকোয়েস্ট নেই</p>
                     </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approved Deposits & Receipts Section */}
      <div className={cardClass}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className={`text-xl font-black ${textPrimary} flex items-center gap-2`}>
              <FileText size={20} className="text-emerald-600" />
              <span>অনুমোদিত জমা ও ডিজিটাল মানি রিসিট</span>
            </h3>
            <p className={`text-xs ${textSecondary}`}>
              অনুমোদিত জমার অফিশিয়াল সিলযুক্ত ডিজিটাল রসিদ দেখুন, PDF ডাউনলোড করুন বা হোয়াটসঅ্যাপে পাঠান
            </p>
          </div>
          <span className="text-xs font-black bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-full">
            মোট অনুমোদিত: {allDepositRequests.filter(r => r.status === 'approved').length}টি
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-4 text-[10px] uppercase font-black text-slate-400">সদস্য ও তারিখ</th>
                <th className="pb-4 text-[10px] uppercase font-black text-slate-400">মাধ্যম ও TrxID</th>
                <th className="pb-4 text-[10px] uppercase font-black text-slate-400 text-right">পরিমাণ</th>
                <th className="pb-4 text-[10px] uppercase font-black text-slate-400 text-right">ডিজিটাল রসিদ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {allDepositRequests.filter(r => r.status === 'approved').slice(0, 15).map(req => (
                <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-4">
                    <div className={`font-black text-sm ${textPrimary}`}>{req.memberName}</div>
                    <div className="text-[10px] font-bold text-slate-400">{req.date}</div>
                  </td>
                  <td className="py-4">
                    <div className={`text-xs font-bold ${textPrimary}`}>{req.paymentMethod}</div>
                    <div className="text-[10px] font-mono font-bold text-emerald-600">{req.trxId}</div>
                  </td>
                  <td className="py-4 text-sm font-black text-right text-emerald-600">
                    ৳{req.amount.toLocaleString()}
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => openReceiptForDeposit(req)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <FileText size={13} />
                      <span>রসিদ ও শেয়ার</span>
                    </button>
                  </td>
                </tr>
              ))}
              {allDepositRequests.filter(r => r.status === 'approved').length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-xs font-bold">
                    কোনো অনুমোদিত ডিপোজিট রেকর্ড নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAdminAds = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className={cardClass}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
          <h2 className={`text-3xl font-black tracking-tight ${textPrimary}`}>বিজ্ঞাপন ব্যবস্থাপনা</h2>
          <button onClick={()=>setShowAddAdModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg transition-all active:scale-95"><Plus size={20}/> নতুন বিজ্ঞাপন</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400">বিজ্ঞাপন</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400">টাইপ</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400">স্ট্যাটাস</th>
                <th className="pb-6 text-[10px] uppercase font-black text-slate-400 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {allAds.map(ad=>(
                <tr key={ad.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                  <td className="py-6">
                    <div className="w-32 h-10 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      {ad.type === 'image' && <img src={ad.content} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                      {ad.type === 'video' && <video src={ad.content} className="w-full h-full object-cover" />}
                      {ad.type === 'code' && <div className="text-[8px] truncate p-1">{ad.content}</div>}
                    </div>
                  </td>
                  <td className={`py-6 text-sm font-black uppercase ${textPrimary}`}>{ad.type}</td>
                  <td className="py-6">
                    <button 
                      onClick={async () => {
                        const adRef = doc(firestore, 'ads', ad.id);
                        await updateDoc(adRef, { active: !ad.active });
                      }}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${ad.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {ad.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </button>
                  </td>
                  <td className="py-6 text-right flex justify-end gap-3">
                    <button onClick={()=>setEditingAd(ad)} title="এডিট" className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><Edit size={20}/></button>
                    <button onClick={()=>deleteAd(ad.id)} title="ডিলিট" className="p-2 text-rose-500 hover:scale-110 transition-transform"><Trash2 size={20}/></button>
                  </td>
                </tr>
              ))}
              {allAds.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-bold uppercase">কোনো বিজ্ঞাপন নেই</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddAdModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setShowAddAdModal(false)}></div>
          <form onSubmit={handleAddAd} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200`}>
            <h3 className="text-3xl font-black text-emerald-600 mb-8 uppercase tracking-tight">নতুন বিজ্ঞাপন যোগ</h3>
            <div className="space-y-6">
              <select name="type" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`}>
                <option value="image">ছবি (Image)</option>
                <option value="video">ভিডিও (Video)</option>
                <option value="code">কোড (JS/HTML Code)</option>
              </select>
              <textarea name="content" required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none h-32 ${textPrimary}`} placeholder="URL অথবা কোড লিখুন..." />
              <input name="link" className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="লিঙ্ক (ঐচ্ছিক)" />
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl mt-4 transition-all">সেভ করুন</button>
            </div>
          </form>
        </div>
      )}

      {editingAd && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-black/30">
          <div className="absolute inset-0" onClick={()=>setEditingAd(null)}></div>
          <form onSubmit={saveAdEdit} className={`${isDarkMode?'bg-slate-900':'bg-white'} p-10 rounded-[48px] shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200`}>
            <h3 className="text-3xl font-black text-emerald-600 mb-8 uppercase tracking-tight">বিজ্ঞাপন এডিট</h3>
            <div className="space-y-6">
              <select value={editingAd.type} onChange={e=>setEditingAd({...editingAd, type:e.target.value as any})} required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`}>
                <option value="image">ছবি (Image)</option>
                <option value="video">ভিডিও (Video)</option>
                <option value="code">কোড (JS/HTML Code)</option>
              </select>
              <textarea value={editingAd.content} onChange={e=>setEditingAd({...editingAd, content:e.target.value})} required className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none h-32 ${textPrimary}`} placeholder="URL অথবা কোড লিখুন..." />
              <input value={editingAd.link || ''} onChange={e=>setEditingAd({...editingAd, link:e.target.value})} className={`w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none ${textPrimary}`} placeholder="লিঙ্ক (ঐচ্ছিক)" />
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl mt-4 transition-all">আপডেট করুন</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const msgId = `msg-${Date.now()}`;
    const newMsg: ContactMessage = {
      id: msgId,
      memberId: currentUser?.id || 'guest',
      memberName: currentUser?.name || 'অজ্ঞাত',
      subject: formData.get('subject') as string,
      message: formData.get('message') as string,
      date: new Date().toLocaleString('bn-BD'),
      status: 'new'
    };

    try {
      await setDoc(doc(firestore, 'contact_messages', msgId), newMsg);
      alert('আপনার মেসেজটি সফলভাবে পাঠানো হয়েছে। এডমিন শীঘ্রই আপনার সাথে যোগাযোগ করবেন।');
      (e.target as HTMLFormElement).reset();
    } catch (error) {
      alert('মেসেজ পাঠাতে সমস্যা হয়েছে।');
    }
  };

  const markMessageAsRead = async (msgId: string) => {
    try {
      await updateDoc(doc(firestore, 'contact_messages', msgId), { status: 'read' });
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিতভাবে এই মেসেজটি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(firestore, 'contact_messages', msgId));
    } catch (error) {
      alert('ডিলিট করতে সমস্যা হয়েছে।');
    }
  };

  const renderContact = () => (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className={cardClass}>
            <h2 className={`text-3xl font-black mb-8 ${textPrimary}`}>যোগাযোগ করুন</h2>
            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={`text-xs font-black uppercase tracking-widest ${textSecondary}`}>আপনার নাম</label>
                  <input type="text" value={currentUser?.name} readOnly className={`w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none ${textPrimary} opacity-70`} />
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-black uppercase tracking-widest ${textSecondary}`}>সদস্য আইডি</label>
                  <input type="text" value={currentUser?.id} readOnly className={`w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none ${textPrimary} opacity-70`} />
                </div>
              </div>
              <div className="space-y-2">
                <label className={`text-xs font-black uppercase tracking-widest ${textSecondary}`}>বিষয়</label>
                <input name="subject" required type="text" placeholder="মেসেজের বিষয় লিখুন" className={`w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none focus:border-emerald-500 transition-colors ${textPrimary}`} />
              </div>
              <div className="space-y-2">
                <label className={`text-xs font-black uppercase tracking-widest ${textSecondary}`}>মেসেজ</label>
                <textarea name="message" required rows={5} placeholder="আপনার মেসেজটি এখানে লিখুন..." className={`w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none focus:border-emerald-500 transition-colors ${textPrimary}`}></textarea>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-3xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all">
                মেসেজ পাঠান <Send size={20} />
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-8">
          <div className={cardClass}>
            <h3 className={`text-xl font-black mb-8 ${textPrimary}`}>যোগাযোগের তথ্য</h3>
            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <Phone size={22} />
                </div>
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${textSecondary} mb-1`}>মোবাইল</div>
                  <div className={`font-black ${textPrimary}`}>01616790750</div>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <Mail size={22} />
                </div>
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${textSecondary} mb-1`}>ইমেইল</div>
                  <div className={`font-black ${textPrimary}`}>alittehadforum@gmail.com</div>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <MapPin size={22} />
                </div>
                <div>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${textSecondary} mb-1`}>ঠিকানা</div>
                  <div className={`font-black leading-relaxed ${textPrimary}`}>গ্রীণ মডেল টাউন, মান্ডা, মুগদা, ঢাকা।</div>
                </div>
              </div>
            </div>
          </div>

          <div className={`${cardClass} bg-emerald-600 text-white border-none`}>
            <h3 className="text-xl font-black mb-4">অফিস সময়</h3>
            <p className="opacity-90 text-sm leading-relaxed mb-6">আমাদের অফিস শুক্রবার ও শনিবার সকাল ১০টা থেকে রাত ৮টা পর্যন্ত খোলা থাকে। অন্যান্য দিনগুলোতে অ্যাপের মাধ্যমে যোগাযোগ করুন।</p>
            <div className="pt-6 border-t border-white/10 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">আমরা আপনার পাশে আছি</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdminContact = () => (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className={cardClass}>
        <div className="flex justify-between items-center mb-10">
          <h2 className={`text-3xl font-black ${textPrimary}`}>মেসেজ বক্স</h2>
          <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
            মোট মেসেজ: {contactMessages.length}
          </div>
        </div>

        <div className="space-y-6">
          {contactMessages.map(msg => (
            <div key={msg.id} className={`p-8 rounded-[40px] border transition-all ${msg.status === 'new' ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'}`}>
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${msg.status === 'new' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      {msg.status === 'new' ? 'নতুন' : 'পঠিত'}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${textSecondary}`}>{msg.date}</span>
                  </div>
                  <h3 className={`text-xl font-black mb-2 ${textPrimary}`}>{msg.subject}</h3>
                  <p className={`text-sm ${textSecondary} mb-6 leading-relaxed`}>{msg.message}</p>
                  <div className="flex items-center gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-black">
                      {msg.memberName[0]}
                    </div>
                    <div>
                      <div className={`text-xs font-black ${textPrimary}`}>{msg.memberName}</div>
                      <div className={`text-[10px] font-bold ${textSecondary}`}>ID: {msg.memberId}</div>
                    </div>
                  </div>
                </div>
                <div className="flex md:flex-col gap-3 shrink-0">
                  {msg.status === 'new' && (
                    <button onClick={() => markMessageAsRead(msg.id)} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl transition-all" title="পঠিত হিসেবে চিহ্নিত করুন">
                      <CheckCircle size={20} />
                    </button>
                  )}
                  <button onClick={() => deleteMessage(msg.id)} className="flex-1 md:flex-none bg-rose-100 dark:bg-rose-900/30 text-rose-600 p-4 rounded-2xl hover:bg-rose-600 hover:text-white transition-all" title="ডিলিট">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {contactMessages.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-slate-400">
                <Mail size={32} />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest">কোনো মেসেজ নেই</p>
            </div>
          )}
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
            <p className="text-lg opacity-90 mb-8 leading-relaxed">
              আল ইত্তেহাদ ফোরাম একটি সম্পূর্ণ অরাজনৈতিক ও অসাম্প্রদায়িক সামাজিক এবং ব্যবসায়িক প্রতিষ্ঠান। এই সংগঠন তরুণ সমাজকে সঙ্গে নিয়ে দলবদ্ধভাবে কাজ করার মাধ্যমে—
            </p>
            <ul className="space-y-2 mb-8 opacity-90">
              <li className="flex items-start gap-2">• দেশের অর্থনৈতিক অগ্রগতি সাধন</li>
              <li className="flex items-start gap-2">• সামাজিক উন্নয়ন নিশ্চিতকরণ</li>
              <li className="flex items-start gap-2">• মানবিক কল্যাণ ও বিকাশ ঘটানো</li>
              <li className="flex items-start gap-2">• এবং সর্বোপরি ইসলামী মূল্যবোধের ভিত্তিতে আগামীর সোনার বাংলাদেশ গড়ে তোলা</li>
            </ul>
            <p className="text-lg opacity-90 mb-10 leading-relaxed">
              —এই মহৎ লক্ষ্য অর্জনে অবিচল প্রতিজ্ঞাবদ্ধ। <br/>
              ✨ ২৮ জুন ২০২৪ ইং তারিখে, একদল নব উদ্যমী ও দূরদর্শী তরুণদের উদ্যোগে এ প্রতিষ্ঠানটি প্রতিষ্ঠিত হয়। শুরু থেকেই আল ইত্তেহাদ ফোরাম দৃঢ়ভাবে বিশ্বাস করে যে, তরুণ সমাজের শক্তি ও ঐক্যই ভবিষ্যৎ বাংলাদেশের উন্নয়ন ও সমৃদ্ধির প্রধান চালিকাশক্তি।
            </p>
            
            <div className="flex gap-4 mb-10">
              <a href="https://www.facebook.com/alittehadforum2024/" target="_blank" rel="noopener noreferrer" className="bg-white/20 p-3 rounded-full hover:bg-white/30 transition-colors">
                <Facebook size={24} />
              </a>
              <a href="https://www.instagram.com/al_ittehad_forum/" target="_blank" rel="noopener noreferrer" className="bg-white/20 p-3 rounded-full hover:bg-white/30 transition-colors">
                <Instagram size={24} />
              </a>
              <a href="https://www.youtube.com/@AlIttehadForum" target="_blank" rel="noopener noreferrer" className="bg-white/20 p-3 rounded-full hover:bg-white/30 transition-colors">
                <Youtube size={24} />
              </a>
            </div>

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
            <img src="https://picsum.photos/seed/alittehad/800/800" className="w-full rounded-[56px] shadow-2xl border-8 border-white/10" />
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className={`text-3xl font-black mb-8 ${textPrimary}`}>আমাদের লক্ষ্য ও উদ্দেশ্য</h2>
        <p className={`${textSecondary} text-lg mb-8 leading-relaxed`}>
          অর্থনৈতিক স্বচ্ছলতা অবলম্বনের মাধ্যমে উন্নয়নশীল জাতি গঠন, মানবিক কল্যান সাধন ও বৈষম্য দূরীকরন। <br/>
          - আল ইত্তেহাদ ফোরামের মূল লক্ষ্য হলো—
        </p>
        <ul className="space-y-4 mb-12">
          {[
            'ভ্রাতৃত্বের বন্ধনকে সুদৃঢ় করা এবং পারস্পরিক সহযোগিতার মাধ্যমে বিশ্বস্ত ও সুষ্ঠু বিনিয়োগ কার্যক্রম পরিচালনা।',
            'ইসলামী শরীয়াহভিত্তিক নীতিমালা অনুসরণ করে অর্থনৈতিক সমৃদ্ধি অর্জন ও আত্মসামাজিক কার্যক্রম গ্রহণ।',
            'সংস্থার সদস্য ও দরিদ্র জনগোষ্ঠীর ভৌত ও নৈতিক মানোন্নয়ন সাধন।',
            'সমাজ উন্নয়ন ও মানবসেবামূলক কাজে সক্রিয় অংশগ্রহণ।'
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-4">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0"></div>
              <p className={textSecondary}>{item}</p>
            </li>
          ))}
        </ul>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-8 rounded-[32px] border border-emerald-100 dark:border-emerald-800/50">
          <h3 className="text-xl font-black text-emerald-600 mb-2">আমাদের স্লোগন</h3>
          <p className={`text-2xl font-black italic ${textPrimary}`}>"একতায় বল, হালাল উপার্জনে এগিয়ে চল।"</p>
        </div>

        <p className={`${textSecondary} mt-10 italic`}>
          ইনশাআল্লাহ আল ইত্তেহাদ ফোরাম তার স্লোগান, লক্ষ্য ও উদ্দেশ্যকে সামনে রেখে নতুন নতুন কার্যক্রম পরিচালনার মধ্য দিয়ে এগিয়ে যাবে দুর্বার গতিতে।
        </p>
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

  const renderNoticePanel = () => {
    if (!isNoticePanelOpen) return null;

    return (
      <div className="fixed inset-0 z-[60] flex justify-end">
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setIsNoticePanelOpen(false)} 
        />
        <div className={`relative w-full md:w-96 h-full ${isDarkMode ? 'bg-slate-900' : 'bg-white'} shadow-2xl border-l border-slate-100 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300 z-10`}>
          <div className="p-8 border-b flex justify-between items-center bg-emerald-600 text-white">
            <div className="flex items-center gap-3">
              <Bell size={24} />
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm">নোটিফিকেশন সেন্টার</h3>
                <p className="text-[10px] opacity-80 font-medium">রিয়েল-টাইম পুশ অ্যালার্ট</p>
              </div>
            </div>
            <button onClick={() => setIsNoticePanelOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Push Notification Toggle Card */}
            <div className={`p-5 rounded-3xl border transition-all ${
              pushNotification.isGranted 
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60' 
                : pushNotification.permission === 'denied'
                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
                : 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-transparent shadow-lg'
            }`}>
              {pushNotification.isGranted ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 font-black text-xs md:text-sm">
                    <CheckCircle size={18} className="text-emerald-600" />
                    <span>পুশ নোটিফিকেশন সক্রিয়</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100/80 dark:bg-emerald-900/50 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    লাইভ
                  </span>
                </div>
              ) : pushNotification.permission === 'denied' ? (
                <div>
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-xs mb-1">
                    <AlertCircle size={16} />
                    <span>নোটিফিকেশন পারমিশন বন্ধ আছে</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                    ব্রাউজারের সাইট সেটিংসে গিয়ে নোটিফিকেশন পারমিশন Allow করে পেজ রিফ্রেশ করুন।
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 font-black text-sm mb-1">
                    <Bell size={18} className="animate-bounce" />
                    <span>পুশ নোটিফিকেশন চালু করুন</span>
                  </div>
                  <p className="text-[11px] opacity-90 mb-3 leading-tight">
                    জরুরি নোটিশ, পেমেন্ট রেকর্ড ও ব্যক্তিগত বার্তার তাৎক্ষণিক নোটিফিকেশন সরাসরি পেতে চালু করুন।
                  </p>
                  <button 
                    onClick={async () => {
                      const granted = await pushNotification.requestPermission();
                      if (granted) {
                        alert('পুশ নোটিফিকেশন সফলভাবে চালু হয়েছে!');
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-white text-emerald-700 hover:bg-emerald-50 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Bell size={14} /> নোটিফিকেশন চালু করুন
                  </button>
                </div>
              )}
            </div>

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
      </div>
    );
  };

  const renderContent = () => {
    switch (view) {
      case 'dashboard': return currentUser?.role === 'admin' ? renderAdminDashboard() : renderMemberDashboard();
      case 'notices': return renderNotices();
      case 'voting':
      case 'admin-voting':
        return (
          <DecisionVoting
            polls={allPolls}
            currentUser={currentUser}
            activeMember={activeMember}
            allMembers={allMembers}
            isDarkMode={isDarkMode}
            onSendNotification={(payload) => pushNotification.sendNotification(payload)}
          />
        );
      case 'about': return renderAbout();
      case 'contact': return renderContact();
      case 'deposit': return renderDepositPage();
      case 'profile-settings': return renderProfileSettings();
      case 'admin-members': return renderAdminMembers();
      case 'admin-businesses': return renderAdminBusinesses();
      case 'admin-notices': return renderAdminNotices();
      case 'admin-ads': return renderAdminAds();
      case 'admin-contact': return renderAdminContact();
      case 'admin-deposits': return renderAdminDeposits();
      default: return currentUser?.role === 'admin' ? renderAdminDashboard() : renderMemberDashboard();
    }
  };

  if (!isLoggedIn) return (
    <>
      {renderWelcome()}
      {selectedReceipt && (
        <DigitalReceiptModal
          isOpen={!!selectedReceipt}
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </>
  );

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
      <main className="flex-1 lg:ml-72 min-h-screen pb-24 lg:pb-12 w-full max-w-full overflow-x-hidden">
        <header className={`sticky top-0 z-40 ${isDarkMode ? 'bg-slate-900/90' : 'bg-white/90'} backdrop-blur-xl border-b px-3.5 sm:px-6 md:px-8 py-3.5 sm:py-5 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <button className="lg:hidden p-2 bg-emerald-50 text-emerald-600 rounded-xl active:scale-95 transition-all shrink-0" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-tight truncate">
                {view === 'dashboard' ? 'ড্যাশবোর্ড' : 
                 view === 'notices' ? 'নোটিশ বোর্ড' : 
                 view === 'voting' || view === 'admin-voting' ? 'ইসলামিক শুরা ও ভোটিং' :
                 view === 'contact' ? 'যোগাযোগ' :
                 view === 'profile-settings' ? 'প্রোফাইল সেটিংস' :
                 view === 'admin-contact' ? 'মেসেজ বক্স' :
                 view.includes('admin') ? 'এডমিন কন্ট্রোল' : 'আল ইত্তেহাদ'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <PWAInstallButton variant="header" />
            <button 
              onClick={() => setIsNoticePanelOpen(!isNoticePanelOpen)} 
              className={`p-2 sm:p-2.5 rounded-xl relative transition-all ${
                pushNotification.isGranted
                  ? 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-emerald-600'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 ring-2 ring-emerald-500/30'
              }`}
              title={pushNotification.isGranted ? 'নোটিফিকেশন (পুশ নোটিফিকেশন সক্রিয়)' : 'নোটিফিকেশন দেখুন / পুশ নোটিফিকেশন চালু করুন'}
            >
              <Bell size={18} className={!pushNotification.isGranted ? 'animate-pulse' : ''} />
              {allNotices.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-950 shadow-md"></span>}
              {pushNotification.isGranted && <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>}
            </button>
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('profile-settings')}>
              <div className="relative">
                <img src={activeMember?.avatar || currentUser?.avatar} className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover ring-2 ring-emerald-500/10 group-hover:ring-emerald-500 transition-all shrink-0" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition-opacity">
                  <Settings size={13} className="text-white" />
                </div>
              </div>
              <div className="hidden sm:block">
                <div className={`text-[10px] md:text-xs font-black ${textPrimary} group-hover:text-emerald-600 transition-colors`}>{activeMember?.name || currentUser?.name}</div>
                <div className="text-[8px] md:text-[10px] font-black text-emerald-600 uppercase mt-0.5 tracking-widest">{currentUser?.id}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-3 sm:p-6 md:p-12 w-full max-w-7xl mx-auto">{renderContent()}</div>
        <AdBanner />

        {renderNoticePanel()}
        <OfflineIndicator />

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
              {chatHistory.length === 0 && (
                <div className="flex justify-start">
                  <div className="p-6 rounded-[32px] text-sm max-w-[85%] shadow-sm bg-white dark:bg-slate-800 rounded-tl-none border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 leading-relaxed">
                    আসসালামু আলাইকুম! আল ইত্তেহাদ ফোরাম ডিজিটাল সহায়তায় আপনাকে স্বাগতম। আপনার সঞ্চয় হিসাব, মাসিক কিস্তি, জমা স্ট্যাটাস বা ফোরাম সম্পর্কিত যেকোনো তথ্য জানতে প্রশ্ন করুন।
                  </div>
                </div>
              )}
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

      {selectedReceipt && (
        <DigitalReceiptModal
          isOpen={!!selectedReceipt}
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
};

export default App;
