import React, { useState } from 'react';
import { 
  Vote, 
  CheckCircle2, 
  Clock, 
  Users, 
  Calendar, 
  AlertCircle, 
  Plus, 
  Edit3, 
  Trash2, 
  Play, 
  Square, 
  RotateCcw, 
  Share2, 
  Copy, 
  Check, 
  MessageSquare, 
  Sparkles, 
  Award, 
  FileText, 
  Send, 
  Info,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck,
  Search,
  Filter
} from 'lucide-react';
import { Poll, PollOption, PollVoteRecord, Member } from './types';
import { db as firestore } from './firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

interface DecisionVotingProps {
  polls: Poll[];
  currentUser: Member | null;
  activeMember: Member | null;
  allMembers: Member[];
  isDarkMode: boolean;
  onSendNotification?: (payload: { title: string; body: string }) => void;
}

export const DecisionVoting: React.FC<DecisionVotingProps> = ({
  polls,
  currentUser,
  activeMember,
  allMembers,
  isDarkMode,
  onSendNotification
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const memberId = activeMember?.id || currentUser?.id || '';
  const memberName = activeMember?.name || currentUser?.name || 'সম্মানিত সদস্য';

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<'active' | 'all' | 'my_votes' | 'closed'>('active');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Voting interaction state
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({}); // pollId -> optionId
  const [voteComments, setVoteComments] = useState<Record<string, string>>({}); // pollId -> comment
  const [submittingPollId, setSubmittingPollId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [copiedPollId, setCopiedPollId] = useState<string | null>(null);

  // Admin Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [auditPoll, setAuditPoll] = useState<Poll | null>(null);

  // Form State for Create/Edit
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<Poll['category']>('project');
  const [formDeadline, setFormDeadline] = useState('');
  const [formStatus, setFormStatus] = useState<Poll['status']>('published');
  const [formPinned, setFormPinned] = useState(false);
  const [formAllowComments, setFormAllowComments] = useState(true);
  const [formOptions, setFormOptions] = useState<string[]>([
    'হ্যাঁ, সম্পূর্ণ একমত (অনুমোদন দেওয়া হোক)',
    'শর্তসাপেক্ষে অনুমোদন (পুনর্বিবেচনা সাপেক্ষে)',
    'না, ভিন্নমত (অন্য প্রস্তাব বিবেচনায় নেওয়া হোক)'
  ]);
  const [isSavingPoll, setIsSavingPoll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Category labels and badges
  const categoryConfig: Record<string, { label: string; badge: string }> = {
    project: { label: 'নতুন প্রজেক্ট বিনিয়োগ', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200' },
    policy: { label: 'নীতিগত সিদ্ধান্ত', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200' },
    savings: { label: 'সঞ্চয় ও ফান্ড বৃদ্ধি', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200' },
    welfare: { label: 'সমাজসেবা ও মানবকল্যাণ', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200' },
    rules: { label: 'ফোরামের গঠনতন্ত্র ও নিয়মাবলী', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200' },
    general: { label: 'সাধারণ পরামর্শ', badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200' }
  };

  // Convert numbers to Bengali
  const toBanglaNum = (num: number | string): string => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/\d/g, (d) => bnDigits[Number(d)]);
  };

  // Filter polls
  const filteredPolls = polls.filter((p) => {
    // Admin can see drafts; regular members only see published and closed
    if (!isAdmin && p.status === 'draft') return false;

    // Tab filter
    if (activeTab === 'active' && p.status !== 'published') return false;
    if (activeTab === 'closed' && p.status !== 'closed') return false;
    if (activeTab === 'my_votes') {
      const hasVoted = p.votes && p.votes[memberId];
      if (!hasVoted) return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    return true;
  });

  // Sort: pinned first, then newest
  const sortedPolls = [...filteredPolls].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  // Handle Voting Submission
  const handleVote = async (poll: Poll) => {
    const selectedOptionId = selectedOptions[poll.id];
    if (!selectedOptionId) {
      showToast('দয়া করে আপনার পছন্দের যেকোনো একটি বিকল্প নির্বাচন করুন।', 'error');
      return;
    }

    if (!memberId) {
      showToast('ভোট প্রদান করতে অনুগ্রহ করে লগইন করুন।', 'error');
      return;
    }

    const selectedOption = poll.options.find(o => o.id === selectedOptionId);
    if (!selectedOption) return;

    setSubmittingPollId(poll.id);

    try {
      const existingVote = poll.votes?.[memberId];
      const previousOptionId = existingVote?.optionId;

      // Recalculate options counts
      const updatedOptions = poll.options.map((opt) => {
        let count = opt.votesCount || 0;
        if (previousOptionId && opt.id === previousOptionId) {
          count = Math.max(0, count - 1);
        }
        if (opt.id === selectedOptionId) {
          count = count + 1;
        }
        return { ...opt, votesCount: count };
      });

      const updatedVotes: Record<string, PollVoteRecord> = {
        ...(poll.votes || {}),
        [memberId]: {
          memberId,
          memberName,
          memberAvatar: activeMember?.avatar || currentUser?.avatar || '',
          optionId: selectedOptionId,
          optionText: selectedOption.text,
          votedAt: new Date().toLocaleDateString('bn-BD'),
          comment: (voteComments[poll.id] || existingVote?.comment || '').trim()
        }
      };

      const newTotalVotes = Object.keys(updatedVotes).length;

      const pollRef = doc(firestore, 'polls', poll.id);
      await updateDoc(pollRef, {
        options: updatedOptions,
        votes: updatedVotes,
        totalVotes: newTotalVotes
      });

      // Clear input comment
      setVoteComments(prev => ({ ...prev, [poll.id]: '' }));
      showToast('আপনার ভোট সফলভাবে নিবন্ধিত হয়েছে!', 'success');
    } catch (err) {
      console.error('Error submitting vote:', err);
      showToast('ভোট জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'error');
    } finally {
      setSubmittingPollId(null);
    }
  };

  // Admin: Change Status (Publish / Close / Reopen)
  const handleStatusChange = async (poll: Poll, newStatus: 'published' | 'closed' | 'draft') => {
    try {
      const pollRef = doc(firestore, 'polls', poll.id);
      await updateDoc(pollRef, { status: newStatus });

      if (newStatus === 'published') {
        showToast(`"${poll.title}" পোলটি সকল সদস্যের জন্য উন্মুক্ত করা হয়েছে!`, 'success');
        if (onSendNotification) {
          onSendNotification({
            title: `🗳️ নতুন সিদ্ধান্ত ভোট: ${poll.title}`,
            body: `আল ইত্তেহাদ ফোরামে নতুন প্রস্তাবনায় আপনার মতামত ও ভোট প্রদান করুন।`
          });
        }
      } else if (newStatus === 'closed') {
        showToast('ভোট গ্রহণ সমাপ্ত করা হয়েছে এবং ফলাফল লক করা হয়েছে।', 'info');
      } else {
        showToast('পোলটি খসড়া হিসেবে সংরক্ষণ করা হয়েছে।', 'info');
      }
    } catch (err) {
      console.error('Error updating poll status:', err);
      showToast('স্ট্যাটাস পরিবর্তনে সমস্যা হয়েছে।', 'error');
    }
  };

  // Admin: Toggle Pin
  const handleTogglePin = async (poll: Poll) => {
    try {
      const pollRef = doc(firestore, 'polls', poll.id);
      await updateDoc(pollRef, { pinned: !poll.pinned });
      showToast(poll.pinned ? 'পিন বাতিল করা হয়েছে।' : 'পোলটি শীর্ষে পিন করা হয়েছে!', 'info');
    } catch (err) {
      console.error('Error pinning poll:', err);
    }
  };

  // Admin: Delete Poll
  const handleDeletePoll = async (poll: Poll) => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে "${poll.title}" পোলটি মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।`)) return;

    try {
      await deleteDoc(doc(firestore, 'polls', poll.id));
      showToast('পোলটি সফলভাবে মুছে ফেলা হয়েছে।', 'info');
    } catch (err) {
      console.error('Error deleting poll:', err);
      showToast('পোল ডিলিট করতে সমস্যা হয়েছে।', 'error');
    }
  };

  // Reset Create Form
  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('project');
    setFormDeadline('');
    setFormStatus('published');
    setFormPinned(false);
    setFormAllowComments(true);
    setFormOptions([
      'হ্যাঁ, সম্পূর্ণ একমত (অনুমোদন দেওয়া হোক)',
      'শর্তসাপেক্ষে অনুমোদন (পুনর্বিবেচনা সাপেক্ষে)',
      'না, ভিন্নমত (অন্য প্রস্তাব বিবেচনায় নেওয়া হোক)'
    ]);
    setEditingPoll(null);
  };

  // Open Edit Modal
  const openEditModal = (poll: Poll) => {
    setEditingPoll(poll);
    setFormTitle(poll.title);
    setFormDescription(poll.description || '');
    setFormCategory(poll.category || 'project');
    setFormDeadline(poll.deadline || '');
    setFormStatus(poll.status);
    setFormPinned(!!poll.pinned);
    setFormAllowComments(poll.allowComments !== false);
    setFormOptions(poll.options.map(o => o.text));
    setShowCreateModal(true);
  };

  // Save New or Edited Poll
  const handleSavePoll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      showToast('দয়া করে প্রস্তাবনার শিরোনাম লিখুন।', 'error');
      return;
    }

    const validOptions = formOptions.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      showToast('কমপক্ষে ২টি বিকল্প (Options) থাকতে হবে।', 'error');
      return;
    }

    setIsSavingPoll(true);

    try {
      if (editingPoll) {
        // Edit existing
        const pollRef = doc(firestore, 'polls', editingPoll.id);

        // Map options preserving existing votes if matching
        const updatedOptions: PollOption[] = validOptions.map((text, idx) => {
          const existing = editingPoll.options[idx];
          return {
            id: existing?.id || `opt-${Date.now()}-${idx}`,
            text,
            votesCount: existing?.votesCount || 0
          };
        });

        await updateDoc(pollRef, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          deadline: formDeadline,
          status: formStatus,
          pinned: formPinned,
          allowComments: formAllowComments,
          options: updatedOptions
        });
        showToast('পোল সফলভাবে আপডেট করা হয়েছে!', 'success');
      } else {
        // Create new
        const newPollId = `poll-${Date.now()}`;
        const newOptions: PollOption[] = validOptions.map((text, idx) => ({
          id: `opt-${Date.now()}-${idx}`,
          text,
          votesCount: 0
        }));

        const newPoll: Poll = {
          id: newPollId,
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          createdAt: new Date().toLocaleDateString('bn-BD'),
          createdBy: currentUser?.id || 'admin',
          createdByName: currentUser?.name || 'এডমিন',
          deadline: formDeadline || '',
          status: formStatus,
          pinned: formPinned,
          allowComments: formAllowComments,
          options: newOptions,
          totalVotes: 0,
          votes: {}
        };

        await setDoc(doc(firestore, 'polls', newPollId), newPoll);

        if (formStatus === 'published' && onSendNotification) {
          onSendNotification({
            title: `🗳️ নতুন সিদ্ধান্ত প্রস্তাবনা: ${newPoll.title}`,
            body: `আল ইত্তেহাদ ফোরামে নতুন সিদ্ধান্তে আপনার মূল্যবান ভোট ও পরামর্শ দিন।`
          });
        }

        showToast('নতুন ভোটিং পোল সফলভাবে তৈরি ও সংরক্ষণ করা হয়েছে!', 'success');
      }

      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error('Error saving poll:', err);
      showToast('পোল সেভ করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setIsSavingPoll(false);
    }
  };

  // Generate WhatsApp Share Message
  const getWhatsAppShareUrl = (poll: Poll) => {
    let text = `*আল ইত্তেহাদ ফোরাম - সিদ্ধান্ত ভোটিং ও শুরা পরামর্শ*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📌 *বিষয়:* ${poll.title}\n`;
    text += `🏷️ *ধরণ:* ${categoryConfig[poll.category]?.label || 'সিদ্ধান্ত'}\n`;
    text += `📊 *বর্তমান অবস্থা:* ${poll.status === 'published' ? 'চলমান ভোট গ্রহণ' : 'সমাপ্ত ভোট'}\n`;
    text += `👥 *মোট অংশগ্রহণকারী:* ${toBanglaNum(poll.totalVotes || 0)} জন\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `*ফলাফল ও বিকল্পসমূহ:*\n`;

    const total = poll.totalVotes || 0;
    poll.options.forEach((opt, i) => {
      const count = opt.votesCount || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      text += `${i + 1}. ${opt.text}\n   ↳ ${toBanglaNum(count)} ভোট (${toBanglaNum(pct)}%)\n`;
    });

    if (poll.status === 'published' && poll.deadline) {
      text += `\n⏰ *ভোটের শেষ সময়:* ${poll.deadline}\n`;
    }

    text += `\n_আল ইত্তেহাদ ফোরাম সদস্য পোর্টালে লগইন করে আপনার মূল্যবান ভোট ও পরামর্শ প্রদান করুন।_\n`;
    text += `https://aif-member-portal.web.app`;

    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Copy Poll Results
  const copyPollResults = (poll: Poll) => {
    let text = `আল ইত্তেহাদ ফোরাম - সিদ্ধান্ত ভোটিং ফলাফল\n`;
    text += `বিষয়: ${poll.title}\n`;
    text += `মোট ভোট: ${poll.totalVotes || 0} জন\n\n`;
    const total = poll.totalVotes || 0;
    poll.options.forEach((opt, i) => {
      const count = opt.votesCount || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      text += `${i + 1}. ${opt.text} - ${count} ভোট (${pct}%)\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedPollId(poll.id);
    setTimeout(() => setCopiedPollId(null), 2500);
  };

  // Card classes
  const cardClass = `${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-3.5 sm:p-6 md:p-8 rounded-[22px] sm:rounded-[36px] border shadow-sm transition-all w-full max-w-full overflow-hidden`;
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-5 sm:space-y-8 animate-in fade-in duration-500 font-kalpurush w-full max-w-full">
      {/* Islamic Consultation Header / Shura Banner */}
      <div className="relative overflow-hidden rounded-[22px] sm:rounded-[36px] md:rounded-[40px] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white p-4 sm:p-7 md:p-12 shadow-2xl border border-emerald-600/30 w-full max-w-full">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-emerald-200 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4 max-w-full">
            <Sparkles size={14} className="text-amber-300 shrink-0" />
            <span className="truncate">ইসলামিক শুরা ও পরামর্শ পরিষদ</span>
          </div>

          <h2 className="text-xl sm:text-3xl md:text-5xl font-black mb-3 tracking-tight leading-tight">
            অনলাইন ভোটিং ও সিদ্ধান্ত পোল
          </h2>

          <div className="p-3 sm:p-5 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 mb-4 sm:mb-6">
            <p className="text-lg sm:text-xl md:text-2xl font-serif text-emerald-100 italic tracking-wide mb-1 text-center sm:text-left">
              "وَأَمْرُهُمْ شُورَىٰ بَيْنَهُمْ"
            </p>
            <p className="text-[11px] sm:text-xs md:text-sm text-emerald-100/90 leading-relaxed text-center sm:text-left">
              — "এবং তাদের কাজ পারস্পরিক পরামর্শের ভিত্তিতে সম্পন্ন হয়।" <span className="opacity-75">[সূরা আশ-শুরা: ৩৮]</span>
            </p>
          </div>

          <p className="text-xs sm:text-sm md:text-base text-emerald-50/90 leading-relaxed font-normal">
            আল ইত্তেহাদ ফোরামের নতুন ব্যবসায়িক প্রজেক্ট গ্রহণ, নীতিগত পরিবর্তন, ফান্ড ব্যবস্থাপনা এবং গুরুত্বপূর্ণ যেকোনো সিদ্ধান্তে সম্মানিত সকল সদস্যের মতামত ও গণতান্ত্রিক ভোটাধিকার নিশ্চিত করা আমাদের মূল ভিত্তি।
          </p>

          {/* Quick stats & Admin action */}
          <div className="mt-5 sm:mt-8 pt-4 sm:pt-6 border-t border-white/15 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center justify-around sm:justify-start gap-3 sm:gap-6 text-xs sm:text-sm font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>চলমান ভোট: {toBanglaNum(polls.filter(p => p.status === 'published').length)}টি</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-emerald-300" />
                <span>অংশগ্রহণকারী: {toBanglaNum(allMembers.length)} জন</span>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs sm:text-sm w-full sm:w-auto"
              >
                <Plus size={18} /> নতুন পোল তৈরি করুন
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-3 sm:p-5 md:p-6 rounded-[22px] sm:rounded-[36px] border shadow-sm space-y-3 sm:space-y-4 w-full max-w-full overflow-hidden`}>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 sm:pb-0 w-full scrollbar-none">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              চলমান ({toBanglaNum(polls.filter(p => p.status === 'published').length)})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all ${
                activeTab === 'all'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              সকল পোল ({toBanglaNum(isAdmin ? polls.length : polls.filter(p => p.status !== 'draft').length)})
            </button>
            <button
              onClick={() => setActiveTab('my_votes')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all ${
                activeTab === 'my_votes'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              আমার ভোট ({toBanglaNum(polls.filter(p => p.votes && p.votes[memberId]).length)})
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all ${
                activeTab === 'closed'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              ফলাফল ({toBanglaNum(polls.filter(p => p.status === 'closed').length)})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full lg:max-w-xs shrink-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="পোল খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 ${textPrimary}`}
            />
          </div>
        </div>

        {/* Categories scrollable pill list */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pt-1 pb-1 text-xs w-full scrollbar-none">
          <span className="text-slate-400 font-bold shrink-0 flex items-center gap-1 text-[11px] sm:text-xs">
            <Filter size={12} /> ক্যাটাগরি:
          </span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold shrink-0 transition-all text-[11px] sm:text-xs ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            সবগুলো
          </button>
          {Object.entries(categoryConfig).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all ${
                selectedCategory === key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Polls List */}
      <div className="space-y-6">
        {sortedPolls.length === 0 ? (
          <div className={`${cardClass} text-center py-16`}>
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Vote size={32} />
            </div>
            <h3 className={`text-xl font-black mb-2 ${textPrimary}`}>কোনো ভোটিং পোল পাওয়া যায়নি</h3>
            <p className={`text-sm ${textSecondary} max-w-md mx-auto mb-6`}>
              বর্তমানে এই ক্যাটাগরিতে কোনো ভোটিং পোল নেই। এডমিন নতুন প্রস্তাবনা প্রকাশ করলে তা এখানে প্রদর্শিত হবে।
            </p>
            {isAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-sm inline-flex items-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <Plus size={16} /> নতুন পোল তৈরি করুন
              </button>
            )}
          </div>
        ) : (
          sortedPolls.map((poll) => {
            const userVote = poll.votes?.[memberId];
            const hasVoted = !!userVote;
            const isClosed = poll.status === 'closed';
            const isDraft = poll.status === 'draft';
            const total = poll.totalVotes || 0;

            // Find winner option if closed
            const maxVotesCount = Math.max(...poll.options.map(o => o.votesCount || 0), 0);
            const winnerOption = isClosed && total > 0 ? poll.options.find(o => o.votesCount === maxVotesCount) : null;

            return (
              <div
                key={poll.id}
                className={`${cardClass} relative overflow-hidden ${
                  poll.pinned ? 'ring-2 ring-amber-400/50 shadow-md' : ''
                }`}
              >
                {/* Top metadata & Pinned row */}
                <div className="space-y-2.5 mb-3 sm:mb-4">
                  {poll.pinned && (
                    <div>
                      <span className="inline-flex items-center gap-1 bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg shadow-xs">
                        <Sparkles size={11} /> পিন করা প্রস্তাবনা
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {/* Status Badge */}
                      <span
                        className={`text-[10px] sm:text-[11px] font-black px-2.5 sm:px-3 py-1 rounded-full flex items-center gap-1.5 ${
                          isDraft
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                            : isClosed
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isDraft ? 'bg-amber-500' : isClosed ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'
                          }`}
                        ></span>
                        {isDraft ? 'খসড়া' : isClosed ? 'ভোট সমাপ্ত' : 'চলমান ভোট'}
                      </span>

                      {/* Category badge */}
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1 rounded-full border ${
                          categoryConfig[poll.category]?.badge || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {categoryConfig[poll.category]?.label || 'সিদ্ধান্ত'}
                      </span>

                      {/* Voter status badge for current user */}
                      {hasVoted && (
                        <span className="text-[10px] sm:text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2.5 sm:px-3 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-600" /> ভোট গৃহীত
                        </span>
                      )}
                    </div>

                    {/* Deadline or creation date */}
                    <div className="flex items-center gap-2.5 text-[11px] sm:text-xs text-slate-400 font-medium">
                      {poll.deadline && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                          <Clock size={12} /> শেষ: {poll.deadline}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {poll.createdAt}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Poll Title */}
                <h3 className={`text-base sm:text-xl md:text-2xl font-black mb-2 sm:mb-3 leading-snug break-words ${textPrimary}`}>
                  {poll.title}
                </h3>

                {/* Poll Description */}
                {poll.description && (
                  <p className={`text-xs sm:text-sm md:text-base leading-relaxed ${textSecondary} mb-4 sm:mb-6 whitespace-pre-line break-words`}>
                    {poll.description}
                  </p>
                )}

                {/* If Closed: Winner Highlight Banner */}
                {isClosed && winnerOption && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border border-amber-300 dark:border-amber-600/40 mb-4 sm:mb-6 flex items-start gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                      <Award size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] sm:text-xs font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider">
                        চূড়ান্ত গৃহীত সিদ্ধান্ত (সর্বাধিক ভোটপ্রাপ্ত)
                      </div>
                      <div className={`text-sm sm:text-base md:text-lg font-black ${textPrimary} mt-0.5 break-words`}>
                        "{winnerOption.text}"
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-500 mt-1">
                        মোট {toBanglaNum(winnerOption.votesCount || 0)}টি ভোট ({toBanglaNum(total > 0 ? Math.round(((winnerOption.votesCount || 0) / total) * 100) : 0)}%) পেয়ে ফোরাম কর্তৃক আনুষ্ঠানিকভাবে গৃহীত।
                      </div>
                    </div>
                  </div>
                )}

                {/* Options Section */}
                <div className="space-y-2.5 mb-5 sm:mb-6">
                  {poll.options.map((option) => {
                    const count = option.votesCount || 0;
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isUserChoice = userVote?.optionId === option.id;
                    const isSelected = selectedOptions[poll.id] === option.id;
                    const isWinner = isClosed && winnerOption?.id === option.id;

                    return (
                      <div
                        key={option.id}
                        onClick={() => {
                          if (!isClosed && !isDraft) {
                            setSelectedOptions(prev => ({ ...prev, [poll.id]: option.id }));
                          }
                        }}
                        className={`relative p-3 sm:p-4 rounded-2xl border transition-all ${
                          !isClosed && !isDraft ? 'cursor-pointer hover:border-emerald-500 active:scale-[0.99]' : ''
                        } ${
                          isUserChoice
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                            : isSelected
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-400'
                            : isWinner
                            ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-400'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              {/* Radio indicator */}
                              {!isClosed && !isDraft && (
                                <div
                                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                    isSelected || isUserChoice
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {(isSelected || isUserChoice) && <Check size={11} strokeWidth={3} />}
                                </div>
                              )}

                              {isWinner && (
                                <Award size={16} className="text-amber-500 shrink-0 mt-0.5" />
                              )}

                              <span className={`text-xs sm:text-sm md:text-base font-bold break-words leading-relaxed ${
                                isUserChoice ? 'text-emerald-800 dark:text-emerald-300 font-black' : textPrimary
                              }`}>
                                {option.text}
                              </span>
                            </div>

                            {/* User Choice badge */}
                            {isUserChoice && (
                              <span className="text-[9px] sm:text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shrink-0">
                                আপনার ভোট
                              </span>
                            )}
                          </div>

                          {/* Progress bar line & stats for mobile and desktop */}
                          {(hasVoted || isClosed || isAdmin) && (
                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50 gap-2">
                              <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isWinner ? 'bg-amber-500' : isUserChoice ? 'bg-emerald-600' : 'bg-slate-400'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 text-right font-bold text-[11px] sm:text-xs">
                                <span className="text-slate-400">{toBanglaNum(count)} ভোট</span>
                                <span className={`font-black ${
                                  isWinner ? 'text-amber-600 dark:text-amber-400' : isUserChoice ? 'text-emerald-600 dark:text-emerald-400' : textPrimary
                                }`}>
                                  ({toBanglaNum(percentage)}%)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Voting Action Area (When open and user can vote) */}
                {!isClosed && !isDraft && (
                  <div className="p-3 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 mb-5 sm:mb-6 space-y-3 sm:space-y-4">
                    {poll.allowComments !== false && (
                      <div>
                        <label className={`block text-xs font-bold mb-1.5 ${textSecondary}`}>
                          <MessageSquare size={14} className="inline mr-1 text-emerald-600" />
                          আপনার মতামত বা পরামর্শ (ঐচ্ছিক):
                        </label>
                        <textarea
                          rows={2}
                          placeholder="এই প্রস্তাবনার পক্ষে বা বিপক্ষে আপনার যৌক্তিক পরামর্শ লিখুন..."
                          value={voteComments[poll.id] ?? (userVote?.comment || '')}
                          onChange={(e) => setVoteComments(prev => ({ ...prev, [poll.id]: e.target.value }))}
                          className={`w-full p-2.5 sm:p-3 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 ${textPrimary}`}
                        />
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-[11px] sm:text-xs text-slate-400 flex items-start sm:items-center gap-1.5 leading-tight">
                        <Info size={14} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                        <span>১ সদস্য ১টি ভোট দিতে পারবেন। প্রয়োজনে শেষ সময়ের পূর্বে পরিবর্তন সম্ভব।</span>
                      </div>

                      <button
                        onClick={() => handleVote(poll)}
                        disabled={submittingPollId === poll.id || !selectedOptions[poll.id]}
                        className="w-full sm:w-auto justify-center bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-2 active:scale-95 transition-all"
                      >
                        {submittingPollId === poll.id ? (
                          <>অপেক্ষা করুন...</>
                        ) : hasVoted ? (
                          <>
                            <CheckCircle2 size={16} /> ভোট আপডেট করুন
                          </>
                        ) : (
                          <>
                            <Vote size={16} /> ভোট প্রদান করুন
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Total Stats and Discussion Accordion */}
                <div className="pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center justify-between sm:justify-start gap-3 text-slate-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Users size={15} className="text-emerald-600" />
                      মোট ভোট: <strong className={textPrimary}>{toBanglaNum(total)} জন</strong>
                    </span>
                    {poll.allowComments !== false && (Object.values(poll.votes || {}) as PollVoteRecord[]).filter(v => !!v.comment).length > 0 && (
                      <button
                        onClick={() => setExpandedComments(prev => ({ ...prev, [poll.id]: !prev[poll.id] }))}
                        className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <MessageSquare size={13} />
                        পরামর্শ ({toBanglaNum((Object.values(poll.votes || {}) as PollVoteRecord[]).filter(v => !!v.comment).length)})
                        {expandedComments[poll.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>

                  {/* Share & Copy Buttons */}
                  <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => copyPollResults(poll)}
                      className="flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold flex items-center gap-1 transition-all"
                      title="ফলাফল কপি করুন"
                    >
                      {copiedPollId === poll.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copiedPollId === poll.id ? 'কপি হয়েছে' : 'কপি'}</span>
                    </button>

                    <a
                      href={getWhatsAppShareUrl(poll)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="হোয়াটসঅ্যাপে শেয়ার করুন"
                    >
                      <Share2 size={14} />
                      <span>হোয়াটসঅ্যাপ</span>
                    </a>
                  </div>
                </div>

                {/* Expanded Member Comments Section */}
                {expandedComments[poll.id] && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      সদস্যদের মতামত ও পরামর্শ:
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {(Object.values(poll.votes || {}) as PollVoteRecord[])
                        .filter(v => !!v.comment)
                        .map((v, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-black ${textPrimary}`}>
                                {v.memberName || v.memberId}
                              </span>
                              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                                {v.optionText}
                              </span>
                            </div>
                            <p className={`${textSecondary} leading-relaxed italic break-words`}>
                              "{v.comment}"
                            </p>
                            <div className="text-[10px] text-slate-400 mt-1">{v.votedAt}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* ADMIN CONTROL PANEL BAR (No negative margins, perfectly contained) */}
                {isAdmin && (
                  <div className="mt-5 pt-4 border-t-2 border-dashed border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-2xl p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <span className="text-[11px] sm:text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                          এডমিন প্যানেল
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Pin button */}
                        <button
                          onClick={() => handleTogglePin(poll)}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                            poll.pinned
                              ? 'bg-amber-100 text-amber-700 border-amber-300'
                              : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                          }`}
                          title={poll.pinned ? 'পিন বাতিল করুন' : 'উপরে পিন করুন'}
                        >
                          <Sparkles size={14} />
                        </button>

                        {/* Edit button */}
                        <button
                          onClick={() => openEditModal(poll)}
                          className="p-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
                          title="এডিট করুন"
                        >
                          <Edit3 size={14} />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeletePoll(poll)}
                          className="p-2 bg-white dark:bg-slate-800 text-rose-500 hover:bg-rose-50 border border-slate-200 dark:border-slate-700 rounded-xl transition-all"
                          title="ডিলিট করুন"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Publish / Close / Reopen button */}
                      {isDraft && (
                        <button
                          onClick={() => handleStatusChange(poll, 'published')}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <Play size={13} /> প্রকাশ করুন (Publish)
                        </button>
                      )}

                      {!isClosed && !isDraft && (
                        <button
                          onClick={() => handleStatusChange(poll, 'closed')}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          title="ভোট সমাপ্ত করুন ও ফলাফল চূড়ান্ত করুন"
                        >
                          <Square size={13} /> ভোট সমাপ্ত করুন (Close)
                        </button>
                      )}

                      {isClosed && (
                        <button
                          onClick={() => handleStatusChange(poll, 'published')}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          title="পোল পুনরায় উন্মুক্ত করুন"
                        >
                          <RotateCcw size={13} /> পুনরায় চালু করুন (Reopen)
                        </button>
                      )}

                      {/* Voter List Audit Button */}
                      <button
                        onClick={() => setAuditPoll(poll)}
                        className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Users size={13} /> ভোটার তালিকা ও নিরীক্ষা
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT POLL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
          <div className="absolute inset-0" onClick={() => setShowCreateModal(false)}></div>
          <form
            onSubmit={handleSavePoll}
            className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-4 sm:p-6 md:p-8 rounded-[28px] sm:rounded-[40px] shadow-2xl w-full max-w-2xl relative border max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 font-kalpurush`}
          >
            <div className="flex items-center justify-between mb-5 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Vote size={22} />
                </div>
                <div>
                  <h3 className={`text-xl md:text-2xl font-black ${textPrimary}`}>
                    {editingPoll ? 'ভোটিং পোল এডিট করুন' : 'নতুন সিদ্ধান্ত ভোটিং পোল তৈরি'}
                  </h3>
                  <p className="text-xs text-slate-400">প্রস্তাবনা ও বিকল্পসমূহ নির্ধারণ করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Poll Title */}
              <div>
                <label className={`block text-xs font-black uppercase mb-1.5 ${textSecondary}`}>
                  প্রস্তাবনা বা সিদ্ধান্তের শিরোনাম *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: নতুন প্রজেক্ট: আল ইত্তেহাদ এগ্রো ফার্ম বাস্তবায়ন"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={`w-full p-3.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 ${textPrimary}`}
                />
              </div>

              {/* Category & Deadline in 2 cols */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-black uppercase mb-1.5 ${textSecondary}`}>
                    ক্যাটাগরি
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className={`w-full p-3.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 ${textPrimary}`}
                  >
                    {Object.entries(categoryConfig).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-black uppercase mb-1.5 ${textSecondary}`}>
                    ভোটের শেষ তারিখ (ঐচ্ছিক)
                  </label>
                  <input
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 ${textPrimary}`}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-xs font-black uppercase mb-1.5 ${textSecondary}`}>
                  বিস্তারিত প্রেক্ষাপট ও আলোচনা (Description)
                </label>
                <textarea
                  rows={4}
                  placeholder="প্রস্তাবনার বিস্তারিত পটভূমি, বাজেট, লাভ-ক্ষতির বিশ্লেষণ এবং সদস্যদের বিবেচ্য বিষয়সমূহ..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={`w-full p-3.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 ${textPrimary}`}
                />
              </div>

              {/* Options Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-black uppercase ${textSecondary}`}>
                    ভোটের বিকল্পসমূহ (Options) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormOptions(prev => [...prev, ''])}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus size={14} /> বিকল্প যোগ করুন
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formOptions.map((optText, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-6 text-xs font-black text-slate-400 text-center">
                        {toBanglaNum(index + 1)}.
                      </span>
                      <input
                        type="text"
                        required
                        placeholder={`বিকল্প ${index + 1}`}
                        value={optText}
                        onChange={(e) => {
                          const updated = [...formOptions];
                          updated[index] = e.target.value;
                          setFormOptions(updated);
                        }}
                        className={`flex-1 p-3 rounded-xl text-xs md:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-emerald-500 ${textPrimary}`}
                      />
                      {formOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setFormOptions(formOptions.filter((_, i) => i !== index))}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Publishing Controls */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                      প্রকাশনা স্ট্যাটাস (Publish Control)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      সরাসরি সদস্যদের জন্য উন্মুক্ত করবেন নাকি খসড়া রাখবেন
                    </div>
                  </div>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className={`p-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-emerald-300 ${textPrimary}`}
                  >
                    <option value="published">🚀 সরাসরি উন্মুক্ত করুন (Published)</option>
                    <option value="draft">📝 খসড়া হিসেবে রাখুন (Draft)</option>
                    <option value="closed">🛑 সমাপ্ত (Closed)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-emerald-100 dark:border-emerald-800/40">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    পিন করে শীর্ষে রাখুন
                  </span>
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    সদস্যদের পরামর্শ ও মন্তব্য জমা নেওয়ার সুযোগ
                  </span>
                  <input
                    type="checkbox"
                    checked={formAllowComments}
                    onChange={(e) => setFormAllowComments(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl text-sm"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingPoll}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl text-sm shadow-xl flex items-center justify-center gap-2"
                >
                  {isSavingPoll ? 'সংরক্ষণ হচ্ছে...' : editingPoll ? 'আপডেট করুন' : 'পোল প্রকাশ / সংরক্ষণ করুন'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DETAILED AUDIT & VOTER LIST MODAL FOR ADMIN */}
      {auditPoll && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
          <div className="absolute inset-0" onClick={() => setAuditPoll(null)}></div>
          <div className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-4 sm:p-6 md:p-8 rounded-[28px] sm:rounded-[40px] shadow-2xl w-full max-w-3xl relative border max-h-[88vh] flex flex-col font-kalpurush`}>
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className={`text-lg sm:text-xl font-black ${textPrimary}`}>ভোটার তালিকা ও মতামত নিরীক্ষা</h3>
                <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">{auditPoll.title}</p>
              </div>
              <button onClick={() => setAuditPoll(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <div className="py-4 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 text-center">
                <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100">
                  <div className="text-lg sm:text-xl font-black text-emerald-600">{toBanglaNum(auditPoll.totalVotes || 0)}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">মোট ভোটার</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100">
                  <div className="text-lg sm:text-xl font-black text-blue-600">{toBanglaNum(allMembers.length)}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">মোট সদস্য</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100">
                  <div className="text-lg sm:text-xl font-black text-purple-600">
                    {toBanglaNum(allMembers.length > 0 ? Math.round(((auditPoll.totalVotes || 0) / allMembers.length) * 100) : 0)}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">টার্নআউট হার</div>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100">
                  <div className="text-lg sm:text-xl font-black text-amber-600">
                    {toBanglaNum(((Object.values(auditPoll.votes || {})) as PollVoteRecord[]).filter(v => !!v.comment).length)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">মতামত জমা</div>
                </div>
              </div>

              {/* Voters Table */}
              <div className="border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-black">
                    <tr>
                      <th className="p-3.5">সদস্য</th>
                      <th className="p-3.5">নির্বাচিত বিকল্প</th>
                      <th className="p-3.5">তারিখ</th>
                      <th className="p-3.5">পরামর্শ / মন্তব্য</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {((Object.values(auditPoll.votes || {})) as PollVoteRecord[]).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">
                          এখনও কোনো সদস্য ভোট প্রদান করেননি।
                        </td>
                      </tr>
                    ) : (
                      ((Object.values(auditPoll.votes || {})) as PollVoteRecord[]).map((vote, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200">
                              {vote.memberName || vote.memberId}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-mono">
                              {vote.memberId}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                              {vote.optionText}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-400 whitespace-nowrap">
                            {vote.votedAt}
                          </td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {vote.comment ? `"${vote.comment}"` : <span className="text-slate-400 italic">কোনো মন্তব্য নেই</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setAuditPoll(null)}
                className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] max-w-md w-[90%] animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`p-4 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 text-sm font-bold ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30'
                : toast.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-900/30'
                : 'bg-slate-900 text-white border-slate-700 shadow-black/40'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg shrink-0 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
