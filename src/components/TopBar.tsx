import React from 'react';
import { Gem, ShieldCheck, Sparkles, User, Crown, Store, Moon, Sun } from 'lucide-react';
import { ViewType, UserAccount } from '../types';

interface TopBarProps {
  currentView: ViewType;
  title: string;
  diamonds: number;
  onDiamondClick: () => void;
  onAdminClick: () => void;
  onSellerPortalClick?: () => void;
  pendingCount?: number;
  siteName?: string;
  activeUser?: UserAccount;
  isOwner?: boolean;
  isSeller?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  title,
  diamonds,
  onDiamondClick,
  onAdminClick,
  onSellerPortalClick,
  pendingCount = 0,
  siteName = 'PTS',
  activeUser,
  isOwner = false,
  isSeller = false,
  theme = 'dark',
  onToggleTheme,
}) => {

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between shadow-lg">
      {/* Brand Logo & Title with King Crown in Light Green */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <div className="relative flex items-center justify-center shrink-0">
          {/* Light green glowing ring */}
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-500/30 via-lime-400/20 to-emerald-400/30 border border-emerald-400/50 flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-lime-400 drop-shadow-[0_0_8px_rgba(163,230,53,0.7)]" />
          </div>
          {/* Mini pulse dot */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-lime-400 border-2 border-slate-900 rounded-full animate-pulse"></span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h1 className="text-xs sm:text-base font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-lime-300 via-emerald-400 to-green-300 leading-tight">
              PTS
            </h1>
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1 sm:px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/40 text-lime-300 shadow-sm whitespace-nowrap">
              👑 KING
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-emerald-400/90 font-medium tracking-wide flex items-center gap-1 truncate max-w-[90px] sm:max-w-none">
            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-lime-400 animate-pulse shrink-0"></span>
            <span className="truncate">{title}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Active Profile Pill */}
        {activeUser && (
          <button
            onClick={onDiamondClick}
            title={`সক্রিয় প্রোফাইল: ${activeUser.name} (${activeUser.role || 'user'})`}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-xl bg-slate-800/90 border border-slate-700/70 hover:border-lime-500/50 text-slate-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
          >
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-lime-500/20 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src={activeUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeUser.name}`}
                alt={activeUser.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-300 max-w-[65px] sm:max-w-[100px] truncate">
              {isOwner ? '👑 ওনার' : activeUser.name}
            </span>
          </button>
        )}

        {/* OWNER ONLY: Admin Control Panel Switch Button */}
        {isOwner && (
          <button
            onClick={onAdminClick}
            title="মাস্টার ওনার ডাটাবেজ কন্ট্রোল প্যানেল"
            className="relative flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 border border-rose-500/60 text-rose-200 hover:border-rose-400 hover:text-white transition active:scale-95 cursor-pointer shadow-md text-xs font-bold"
          >
            <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">প্যানেল</span>
            {pendingCount > 0 && (
              <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-500 text-white rounded-full text-[8px] sm:text-[9px] font-black flex items-center justify-center shadow animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
        )}

        {/* SELLER ONLY: Seller Shop Portal Button */}
        {isSeller && onSellerPortalClick && (
          <button
            onClick={onSellerPortalClick}
            title="সেলার শপ পোর্টাল"
            className="relative flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-950 to-slate-900 border border-amber-500/50 text-amber-300 hover:border-amber-400 transition active:scale-95 cursor-pointer shadow text-xs font-bold"
          >
            <Store className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">সেলার</span>
          </button>
        )}

        {/* Day / Night Theme Switcher */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'ডে মোড (Day Mode) চালু করুন' : 'নাইট মোড (Night Mode) চালু করুন'}
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800/80 border border-slate-700/70 hover:border-blue-500/50 text-slate-300 hover:text-blue-400 transition active:scale-95 cursor-pointer shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
            )}
          </button>
        )}

        {/* Diamond balance badge */}
        <button
          onClick={onDiamondClick}
          title={isOwner ? 'মাস্টার ওনার: আনলিমিটেড ডায়মন্ড সেন্ট্রাল' : 'ডায়মন্ড রিচার্জ ও ব্যালেন্স'}
          className="group flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 text-emerald-300 hover:border-lime-400 hover:shadow-lg hover:shadow-lime-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Gem className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-lime-400 group-hover:scale-110 transition-transform animate-pulse shrink-0" />
          <span className="font-bold text-[11px] sm:text-xs tracking-wide text-lime-200 whitespace-nowrap">
            {isOwner ? '∞ আনলিমিটেড' : diamonds.toLocaleString()}
          </span>
          {!isOwner && (
            <span className="text-[9px] bg-lime-500/20 text-lime-300 px-1 py-0.1 rounded font-semibold hidden sm:inline">
              +
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

