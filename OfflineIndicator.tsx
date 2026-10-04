import React from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 rounded-2xl bg-amber-600/95 text-white px-4 py-2.5 text-xs font-bold shadow-2xl backdrop-blur-md animate-bounce">
      <WifiOff size={16} className="animate-pulse" />
      <span>অফলাইন মোড — ক্যাশড তথ্য প্রদর্শিত হচ্ছে</span>
    </div>
  );
};
