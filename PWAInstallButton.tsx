import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X, Check, Share, PlusSquare, ArrowDownToLine, Sparkles } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'welcome' | 'sidebar' | 'floating';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running inside standalone PWA mode, don't show install buttons
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else {
      // If direct beforeinstallprompt is not available (e.g. iOS Safari, or non-triggered Chromium), show helpful guide
      setShowGuideModal(true);
    }
  };

  const renderGuideModal = () => {
    if (!showGuideModal) return null;

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="absolute inset-0" onClick={() => setShowGuideModal(false)} />
        <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-6 md:p-8 shadow-2xl border border-emerald-100 dark:border-slate-800 text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center">
                <Smartphone size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">অ্যাপ ইনস্টল নির্দেশিকা</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">আল ইত্তেহাদ ফোরাম পোর্টাল</p>
              </div>
            </div>
            <button
              onClick={() => setShowGuideModal(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {isIOS ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                আইফোন বা আইপ্যাডে (Safari ব্রাউজার) খুব সহজেই অ্যাপটি যুক্ত করতে নিচের ধাপগুলো অনুসরণ করুন:
              </p>
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                    ১
                  </div>
                  <div>
                    Safari ব্রাউজারের নিচে বা উপরে থাকা <strong className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 inline-flex"><Share size={14} /> শেয়ার (Share)</strong> বাটনে ট্যাপ করুন।
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                    ২
                  </div>
                  <div>
                    মেনু স্ক্রল করে <strong className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 inline-flex"><PlusSquare size={14} /> Add to Home Screen</strong> বা <strong className="text-emerald-600 dark:text-emerald-400">"হোম স্ক্রিনে যোগ করুন"</strong> সিলেক্ট করুন।
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                    ৩
                  </div>
                  <div>
                    উপরে ডানপাশে <strong className="text-emerald-600 dark:text-emerald-400">Add</strong> বাটনে ক্লিক করলেই আপনার ফোনে ইনস্টল হয়ে যাবে!
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                আপনার ব্রাউজার থেকে সরাসরি আল ইত্তেহাদ ফোরাম অ্যাপটি ইনস্টল করতে:
              </p>
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                    ১
                  </div>
                  <div>
                    ব্রাউজারের উপরের ডান কোণায় <strong className="text-emerald-600 dark:text-emerald-400">৩-ডট (⋮) মেনু</strong> আইকনে ক্লিক করুন।
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                    ২
                  </div>
                  <div>
                    তালিকা থেকে <strong className="text-emerald-600 dark:text-emerald-400">"Install app"</strong> অথবা <strong className="text-emerald-600 dark:text-emerald-400">"Add to Home screen"</strong> এ ক্লিক করুন।
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                    ৩
                  </div>
                  <div>
                    কনফার্মেশন পপ-আপে <strong>ইনস্টল (Install)</strong> বাটনে চাপুন।
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black rounded-2xl shadow-lg transition-all"
            >
              বুঝেছি (ঠিক আছে)
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 1. Header Variant (Compact, sleek, highly responsive)
  if (variant === 'header') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          title="অ্যাপ ইনস্টল / ডাউনলোড করুন"
          className={`group relative flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl md:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs md:text-sm shadow-md hover:shadow-emerald-500/20 active:scale-95 transition-all duration-300 ${className}`}
        >
          <span className="relative flex items-center justify-center">
            <ArrowDownToLine size={16} className="group-hover:translate-y-0.5 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
          </span>
          <span className="hidden sm:inline">অ্যাপ ইনস্টল</span>
          <span className="sm:hidden font-black text-[11px]">ইনস্টল</span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // 2. Welcome / Login Screen Variant (Banner & prominent CTA)
  if (variant === 'welcome') {
    return (
      <>
        <div className={`mt-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-left relative overflow-hidden group ${className}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Smartphone size={20} />
              </div>
              <div>
                <div className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <span>মোবাইল অ্যাপ সংস্করণ</span>
                  <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">PWA</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-tight">
                  সহজে ব্যবহার করতে ফোনে ডাউনলোড ও ইনস্টল করুন
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3.5 py-2.5 rounded-xl shadow-md active:scale-95 transition-all"
            >
              <Download size={14} />
              <span>{isInstallable ? 'ইনস্টল' : 'ডাউনলোড'}</span>
            </button>
          </div>
        </div>
        {renderGuideModal()}
      </>
    );
  }

  // 3. Sidebar Variant
  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/10 to-teal-600/10 hover:from-emerald-600 hover:to-teal-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/20 group transition-all duration-300 ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white group-hover:bg-white group-hover:text-emerald-600 transition-colors">
              <Download size={16} />
            </div>
            <span className="font-bold text-sm">অ্যাপ ইনস্টল করুন</span>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white group-hover:bg-white group-hover:text-emerald-600 uppercase transition-colors">
            PWA
          </span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // 4. Floating / General Variant
  return (
    <>
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 active:scale-95 transition-all ${className}`}
      >
        <Download size={18} />
        <span>অ্যাপ ডাউনলোড করুন</span>
      </button>
      {renderGuideModal()}
    </>
  );
};
