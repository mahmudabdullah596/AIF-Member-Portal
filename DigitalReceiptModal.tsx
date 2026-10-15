import React, { useRef, useState } from 'react';
import { 
  X, 
  Download, 
  Share2, 
  Printer, 
  CheckCircle2, 
  ShieldCheck, 
  FileText, 
  QrCode, 
  Calendar, 
  CreditCard, 
  User, 
  Phone, 
  Hash, 
  Sparkles, 
  ExternalLink,
  Copy, 
  Check,
  Award,
  Building2,
  Lock,
  BadgeCheck
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { MoneyReceiptData } from './types';

interface DigitalReceiptModalProps {
  receipt: MoneyReceiptData;
  onClose: () => void;
  isOpen: boolean;
}

// Convert English numerals to Bengali digits
function toBanglaNum(num: number | string): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => bnDigits[Number(d)]);
}

// Format currency with commas and Bengali digits
function formatBanglaCurrency(num: number): string {
  if (!num && num !== 0) return '০.০০';
  const formatted = num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return toBanglaNum(formatted);
}

// Helper to convert numbers to Bengali words (টাকা কথায়)
function numberToBanglaWords(num: number): string {
  if (!num || isNaN(num)) return 'শূন্য টাকা মাত্র';
  
  const single = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ'];
  const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];

  function convertLessThousand(n: number): string {
    if (n === 0) return '';
    if (n < 20) return single[n];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const rem = n % 10;
      return tens[ten] + (rem > 0 ? ' ' + single[rem] : '');
    }
    const hundred = Math.floor(n / 100);
    const rem = n % 100;
    return single[hundred] + ' শত' + (rem > 0 ? ' ' + convertLessThousand(rem) : '');
  }

  let words = '';
  const integerPart = Math.floor(num);
  const crore = Math.floor(integerPart / 10000000);
  let rem = integerPart % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (crore > 0) words += convertLessThousand(crore) + ' কোটি ';
  if (lakh > 0) words += convertLessThousand(lakh) + ' লক্ষ ';
  if (thousand > 0) words += convertLessThousand(thousand) + ' হাজার ';
  if (rem > 0) words += convertLessThousand(rem);

  return (words.trim() || 'শূন্য') + ' টাকা মাত্র';
}

export const DigitalReceiptModal: React.FC<DigitalReceiptModalProps> = ({ receipt, onClose, isOpen }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Format WhatsApp Share text with elegant layout
  const shareText = `*🧾 আল ইত্তেহাদ ফোরাম - অফিসিয়াল ডিজিটাল মানি রিসিট*
━━━━━━━━━━━━━━━━━━━━
📄 *রসিদ নং (Receipt No):* ${receipt.receiptNo}
👤 *সদস্যের নাম (Member Name):* ${receipt.memberName}
🆔 *সদস্য আইডি (Member ID):* ${receipt.memberId}
💰 *জমার পরিমাণ (Amount):* ৳${toBanglaNum(receipt.amount.toLocaleString())}/- (${numberToBanglaWords(receipt.amount)})
📌 *জমার খাত (Purpose):* ${receipt.purpose || 'মাসিক নিয়মিত সঞ্চয় জমা'}
💳 *পেমেন্ট মাধ্যম (Method):* ${receipt.paymentMethod}
🔢 *ট্রানজেকশন TrxID:* ${receipt.trxId || 'N/A'}
📅 *জমার তারিখ (Date):* ${receipt.date}
⏰ *অনুমোদন সময়:* ${receipt.approvedAt || receipt.date}
🏛️ *অনুমোদনকারী:* ${receipt.approvedBy || 'আল ইত্তেহাদ ফোরাম কেন্দ্রীয় প্রশাসন'}
✅ *স্ট্যাটাস:* অনুমোদিত ও রসিদকৃত (Official Verified)
${receipt.totalSavedSoFar ? `📈 *বর্তমান সর্বমোট সঞ্চয়:* ৳${toBanglaNum(receipt.totalSavedSoFar.toLocaleString())}/-\n` : ''}━━━━━━━━━━━━━━━━━━━━
_আল ইত্তেহাদ ফোরাম - ঐক্য, সঞ্চয় ও পারস্পরিক সমৃদ্ধি_
_ওয়েবসাইট: https://aif-member-portal.web.app_`;

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    try {
      setIsExporting(true);
      showToast('পিডিএফ তৈরি হচ্ছে...');

      const canvas = await html2canvas(receiptRef.current, {
        scale: 3, // Ultra-high resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 12; // 12mm margin
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, 15, contentWidth, contentHeight, undefined, 'FAST');
      pdf.save(`Al_Ittihad_Receipt_${receipt.receiptNo}.pdf`);

      showToast('পিডিএফ রসিদ সফলভাবে ডাউনলোড হয়েছে!');
    } catch (error) {
      console.error('PDF export error:', error);
      showToast('পিডিএফ তৈরিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsExporting(false);
    }
  };

  // Download JPG Image
  const handleDownloadJPG = async () => {
    if (!receiptRef.current) return;
    try {
      setIsExporting(true);
      showToast('রসিদের হাই-কোয়ালিটি ছবি তৈরি হচ্ছে...');

      const canvas = await html2canvas(receiptRef.current, {
        scale: 3, // Ultra-high resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 800
      });

      const link = document.createElement('a');
      link.download = `Al_Ittihad_Receipt_${receipt.receiptNo}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.98);
      link.click();

      showToast('রসিদটি ছবি হিসেবে ডাউনলোড হয়েছে!');
    } catch (error) {
      console.error('JPG export error:', error);
      showToast('ছবি তৈরিতে সমস্যা হয়েছে।');
    } finally {
      setIsExporting(false);
    }
  };

  // Share to WhatsApp
  const handleWhatsAppShare = async () => {
    try {
      if (navigator.share && receiptRef.current) {
        try {
          const canvas = await html2canvas(receiptRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
          });

          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
          if (blob) {
            const file = new File([blob], `Receipt_${receipt.receiptNo}.jpg`, { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: 'আল ইত্তেহাদ মানি রিসিট',
                text: shareText,
                files: [file]
              });
              return;
            }
          }
        } catch {
          // Fall back to link
        }
      }

      // Universal WhatsApp link
      const cleanPhone = (receipt.memberPhone || receipt.fromNumber || '').replace(/[^0-9]/g, '');
      const encodedMsg = encodeURIComponent(shareText);
      const waUrl = cleanPhone && cleanPhone.length >= 10
        ? `https://wa.me/880${cleanPhone.replace(/^0+/, '')}?text=${encodedMsg}`
        : `https://wa.me/?text=${encodedMsg}`;

      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('WhatsApp share error:', error);
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    }
  };

  // Copy text details
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setIsCopied(true);
      showToast('রসিদের পূর্ণ বিবরণী কপি করা হয়েছে!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Print Receipt
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:fixed-none font-kalpurush">
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[36px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto print:shadow-none print:border-none print:w-full print:max-w-none">
        
        {/* Top Action Bar (Hidden in print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white print:hidden border-b border-emerald-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-700/40 border border-emerald-300/30">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-emerald-300 tracking-tight">অফিশিয়াল ডিজিটাল মানি রিসিট</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ভেরিফাইড
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">ভাউচার নং: {receipt.receiptNo}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="বন্ধ করুন"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Buttons Toolbar (Hidden in print) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              <Download size={15} />
              <span>PDF ডাউনলোড</span>
            </button>

            <button
              onClick={handleDownloadJPG}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 rounded-xl text-xs font-black transition-all disabled:opacity-50"
            >
              <Download size={15} />
              <span>ছবি (JPG)</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-green-600/25 transition-all"
            >
              <Share2 size={15} />
              <span>WhatsApp শেয়ার</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="বিবরণ কপি করুন"
            >
              {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{isCopied ? 'কপি হয়েছে' : 'কপি'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-xl text-xs transition-all shadow-sm"
              title="প্রিন্ট করুন"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>

        {/* Status notification toast */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Sparkles size={14} className="text-amber-300" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Receipt Preview Area */}
        <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto bg-slate-100/80 dark:bg-slate-950/50">
          
          {/* THE RECEIPT CANVAS (Captures to PDF & JPG) */}
          <div 
            ref={receiptRef}
            className="relative bg-white text-slate-800 p-6 sm:p-9 rounded-2xl shadow-xl overflow-hidden font-kalpurush"
            style={{ width: '100%', maxWidth: '640px', margin: '0 auto', minHeight: '660px', border: '3px double #047857' }}
          >
            {/* Elegant Double Security Inner Border */}
            <div className="absolute inset-2 border border-emerald-600/30 rounded-xl pointer-events-none"></div>
            <div className="absolute inset-3 border border-emerald-500/15 rounded-lg pointer-events-none"></div>

            {/* Corner Security Ornaments */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-700 pointer-events-none"></div>
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-700 pointer-events-none"></div>
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-700 pointer-events-none"></div>
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-700 pointer-events-none"></div>

            {/* Microprint security line at top */}
            <div className="relative text-center text-[7px] uppercase tracking-widest text-emerald-800/40 select-none font-mono mb-1">
              ★ AL-ITTEHAD FORUM ★ OFFICIAL DIGITAL MONEY RECEIPT ★ AUTHENTIC FINANCIAL VOUCHER ★
            </div>

            {/* Sacred Bismillah Calligraphy */}
            <div className="text-center font-arabic text-sm text-emerald-800/80 font-bold tracking-wider mb-2">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>

            {/* Background Watermark (Authentic institutional seal) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none rotate-[-28deg]">
              <div className="text-center">
                <div className="text-7xl font-black tracking-widest text-emerald-950 uppercase font-serif">AL-ITTIHAD</div>
                <div className="text-3xl font-black text-emerald-950 mt-1 uppercase tracking-widest">OFFICIAL SEAL</div>
                <div className="text-xl font-bold text-emerald-950 mt-1">ঐক্য • সঞ্চয় • সমৃদ্ধি</div>
              </div>
            </div>

            {/* Institutional Header */}
            <div className="relative pb-4 border-b-2 border-dashed border-emerald-300">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* Organization Brand & Identity */}
                <div className="flex items-center gap-3.5 text-center sm:text-left">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-md border-2 border-emerald-300/40 shrink-0">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-emerald-900 tracking-tight leading-tight">
                      আল ইত্তেহাদ ফোরাম
                    </h1>
                    <p className="text-[11px] font-bold text-amber-800 tracking-wide uppercase">
                      সদস্য পোর্টাল ও বহুমুখী সমবায় সঞ্চয় তহবিল
                    </p>
                    <p className="text-[9.5px] text-slate-500 font-medium">
                      প্রতিষ্ঠিত: ২৮ জুন ২০২৪ • ঢাকা, বাংলাদেশ • হেল্পলাইন: ০১৬১৬-৭৯০৭৫০
                    </p>
                  </div>
                </div>

                {/* Voucher Title and Number Badge */}
                <div className="text-center sm:text-right shrink-0">
                  <div className="inline-block px-3 py-1 bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-lg shadow-sm text-xs font-black tracking-wider uppercase mb-1">
                    অর্থ জমা রসিদ (MONEY RECEIPT)
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono">
                    রসিদ নং: <strong className="text-emerald-950 text-xs font-black">{receipt.receiptNo}</strong>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    তারিখ: <strong className="text-slate-800">{receipt.date}</strong>
                  </div>
                  <div className="text-[8.5px] text-emerald-700 font-bold uppercase mt-0.5">
                    মূল কপি (MEMBER'S ORIGINAL)
                  </div>
                </div>

              </div>
            </div>

            {/* Verified Status Ribbon with Golden Seal Highlight */}
            <div className="my-4 p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <BadgeCheck size={18} />
                </div>
                <div>
                  <div className="text-xs font-black text-emerald-950">
                    অর্থ জমা সফল ও চূড়ান্ত অনুমোদিত
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium">
                    সেন্ট্রাল ডেটাবেজে সংরক্ষিত ও এনক্রিপ্টেড রসিদ
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-amber-900 bg-gradient-to-r from-amber-100 to-amber-200 border border-amber-300 px-3 py-1 rounded-md shadow-sm">
                  <Sparkles size={11} className="text-amber-600" />
                  <span>OFFICIALLY VERIFIED</span>
                </span>
              </div>
            </div>

            {/* Member & Transaction Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-5">
              
              {/* Member Box */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 shadow-sm">
                <div className="text-[10.5px] font-black uppercase text-emerald-800 mb-2 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <User size={13} className="text-emerald-600" />
                  <span>সদস্য পরিচিতি ও হিসাব বিবরণী</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">সদস্যের নাম:</span>
                    <strong className="text-slate-900 font-black text-xs text-right">{receipt.memberName}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">সদস্য আইডি:</span>
                    <span className="font-mono text-emerald-900 bg-emerald-100/80 font-black px-2 py-0.5 rounded text-[11px] border border-emerald-300/50">
                      {receipt.memberId}
                    </span>
                  </div>
                  {(receipt.memberPhone || receipt.fromNumber) && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[11px]">মোবাইল নম্বর:</span>
                      <strong className="text-slate-700 font-mono text-[11px]">
                        {receipt.memberPhone || receipt.fromNumber}
                      </strong>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">জমার খাত:</span>
                    <strong className="text-emerald-900 font-bold text-[11px]">
                      {receipt.purpose || 'মাসিক নিয়মিত সঞ্চয় জমা'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Payment Details Box */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 shadow-sm">
                <div className="text-[10.5px] font-black uppercase text-emerald-800 mb-2 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <CreditCard size={13} className="text-emerald-600" />
                  <span>পেমেন্ট মাধ্যম ও ট্রানজেকশন</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">পেমেন্ট মাধ্যম:</span>
                    <strong className="text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      {receipt.paymentMethod}
                    </strong>
                  </div>
                  {receipt.fromNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[11px]">প্রেরক নম্বর:</span>
                      <strong className="text-slate-700 font-mono text-[11px]">{receipt.fromNumber}</strong>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">ট্রানজেকশন TrxID:</span>
                    <strong className="font-mono text-amber-950 bg-amber-100 font-black px-2 py-0.5 rounded text-[11px] border border-amber-300">
                      {receipt.trxId || 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11px]">অনুমোদনের তারিখ:</span>
                    <strong className="text-slate-700 text-[11px]">{receipt.approvedAt || receipt.date}</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* Financial Ledger Particulars Table */}
            <div className="mb-4 rounded-xl border border-emerald-300 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white text-[11px] font-black uppercase">
                    <th className="py-2.5 px-3 w-12 text-center border-r border-emerald-700/60">নং</th>
                    <th className="py-2.5 px-4 border-r border-emerald-700/60">জমার বিবরণ (Particulars)</th>
                    <th className="py-2.5 px-3 border-r border-emerald-700/60 text-center">খাত (Head)</th>
                    <th className="py-2.5 px-4 text-right">পরিমাণ (BDT)</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  <tr className="bg-white">
                    <td className="py-3 px-3 text-center font-bold text-slate-500 border-r border-slate-100">
                      ০১.
                    </td>
                    <td className="py-3 px-4 border-r border-slate-100">
                      <div className="font-black text-slate-900 text-sm">
                        {receipt.purpose || 'মাসিক নিয়মিত সঞ্চয় জমা'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        সদস্য সঞ্চয় ফান্ড একাউন্ট ক্রেডিট • ট্রানজেকশন অনুমোদিত
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center border-r border-slate-100 font-bold text-slate-700 text-[11px]">
                      সাধারণ সঞ্চয়
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 text-sm font-mono">
                      ৳ {receipt.amount.toLocaleString()}.০০
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50/90 border-t-2 border-emerald-300 text-xs">
                    <td colSpan={3} className="py-2.5 px-4 font-black text-emerald-950 uppercase text-right">
                      সর্বমোট পরিশোধিত অর্থ (Total Paid):
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-emerald-900 text-base font-mono">
                      ৳ {receipt.amount.toLocaleString()}/-
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* In Words Calligraphy Box */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300/80 text-xs mb-5 flex items-start gap-2 shadow-sm">
              <span className="text-amber-900 font-black whitespace-nowrap text-xs">কথায় (In Words):</span>
              <span className="text-slate-800 font-black italic text-xs leading-relaxed">
                "{numberToBanglaWords(receipt.amount)}"
              </span>
            </div>

            {/* Member Cumulative Balance Highlight (if available) */}
            {receipt.totalSavedSoFar && receipt.totalSavedSoFar > 0 && (
              <div className="mb-5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">
                  এই জমার পর সদস্যের অ্যাকাউন্টে সর্বমোট সঞ্চয় ব্যালেন্স:
                </span>
                <span className="font-black text-emerald-800 font-mono text-xs">
                  ৳ {receipt.totalSavedSoFar.toLocaleString()}/- ({toBanglaNum(receipt.totalSavedSoFar)} টাকা)
                </span>
              </div>
            )}

            {/* Security Section: Official Stamp, QR Verification & Signatures */}
            <div className="pt-4 border-t-2 border-dashed border-emerald-300 flex flex-col sm:flex-row items-center justify-between gap-6">
              
              {/* Left: Official Gold & Emerald Seal Stamp */}
              <div className="flex items-center gap-4 shrink-0">
                
                {/* 3D Gold & Emerald Official Rosette Seal */}
                <div className="relative w-24 h-24 rounded-full border-4 border-double border-amber-600/80 flex items-center justify-center p-1 text-center bg-gradient-to-br from-emerald-50 via-amber-50/40 to-emerald-100/60 shadow-lg transform -rotate-6 select-none">
                  {/* Concentric gold beaded rings */}
                  <div className="absolute inset-1 rounded-full border-2 border-dashed border-emerald-700/60 pointer-events-none"></div>
                  <div className="absolute inset-2 rounded-full border border-amber-500/40 pointer-events-none"></div>

                  <div className="flex flex-col items-center justify-center leading-none text-emerald-950 z-10">
                    <span className="text-[7.5px] font-black uppercase tracking-tight text-emerald-900">
                      আল ইত্তেহাদ ফোরাম
                    </span>
                    <div className="my-0.5 text-amber-600">
                      <Award size={18} />
                    </div>
                    <span className="text-[8.5px] font-black uppercase tracking-widest text-emerald-900">
                      APPROVED
                    </span>
                    <span className="text-[6.5px] font-bold text-amber-800 uppercase font-mono mt-0.5 tracking-wider">
                      ★ OFFICIAL SEAL ★
                    </span>
                  </div>
                </div>

                {/* QR Code Verification badge */}
                <div className="text-center">
                  <div className="w-16 h-16 p-1 bg-white rounded-xl border border-slate-300 flex items-center justify-center shadow-md">
                    <QrCode size={52} className="text-slate-800" />
                  </div>
                  <span className="text-[8px] text-slate-500 font-mono uppercase block mt-1">
                    স্ক্যান ভেরিফাই: #{receipt.receiptNo.slice(-6)}
                  </span>
                </div>

              </div>

              {/* Right: Authorized Signatures */}
              <div className="flex items-end justify-between sm:justify-end gap-8 w-full sm:w-auto text-center">
                
                {/* Prepared By Signature */}
                <div>
                  <div className="h-10 flex items-center justify-center">
                    <span className="font-signature text-xl text-slate-700 italic opacity-85">
                      Accountant
                    </span>
                  </div>
                  <div className="w-28 border-t border-slate-400 pt-1 text-[10px] font-black text-slate-800">
                    আদায়কারী / হিসাবরক্ষক
                  </div>
                  <div className="text-[8.5px] text-slate-400">
                    আল ইত্তেহাদ প্রশাসন
                  </div>
                </div>

                {/* Authorized Signatory */}
                <div>
                  <div className="h-10 flex items-center justify-center">
                    <span className="font-signature text-2xl text-emerald-900 font-bold underline decoration-amber-500/60">
                      Al-Ittihad Authority
                    </span>
                  </div>
                  <div className="w-32 border-t-2 border-emerald-800 pt-1 text-[10.5px] font-black text-emerald-950">
                    অনুমোদনকারী কর্মকর্তা
                  </div>
                  <div className="text-[8.5px] text-emerald-700 font-bold">
                    {receipt.approvedBy || 'আল ইত্তেহাদ কেন্দ্রীয় ফোরাম'}
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Security Micro-Footnote */}
            <div className="mt-5 pt-3 border-t border-slate-200/80 text-center text-[8.5px] text-slate-400 leading-relaxed font-light">
              * এটি একটি সিস্টেম জেনারেটেড ডিজিটাল রসিদ (Computer Generated Official Money Receipt)। কেন্দ্রীয় ডেটাবেজে ইউনিক TrxID সহ সংরক্ষিত। যেকোনো প্রয়োজনে রসিদ নং উল্লেখ করুন।
            </div>

          </div>

        </div>

        {/* Modal Bottom Footer (Hidden in print) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between print:hidden">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            রসিদটি এক ক্লিকে পিডিএফ অথবা ছবি হিসেবে সংরক্ষণ বা হোয়াটসঅ্যাপে শেয়ার করুন।
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black transition-colors"
          >
            বন্ধ করুন
          </button>
        </div>

      </div>
    </div>
  );
};
