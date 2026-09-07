import React from 'react';
import { Home, MessageSquare, ShoppingBag, User, Store, Crown } from 'lucide-react';
import { ViewType } from '../types';

interface BottomNavProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  activeOrdersCount?: number;
  unreadChatCount?: number;
  pendingRequestsCount?: number;
  userRole?: string;
  isOwner?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onSelectView,
  activeOrdersCount = 0,
  unreadChatCount = 0,
  pendingRequestsCount = 0,
  userRole = 'user',
  isOwner = false,
}) => {
  const isSeller = userRole === 'seller';

  // Build items array dynamically based on role
  const items: {
    id: ViewType;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[] = [
    { id: 'home', label: 'হোম', icon: Home },
    { id: 'chat', label: 'চ্যাট', icon: MessageSquare, badge: unreadChatCount },
    { id: 'orders', label: 'অর্ডার', icon: ShoppingBag, badge: activeOrdersCount },
    { id: 'profile', label: 'প্রোফাইল', icon: User },
  ];

  // ONLY Owner gets the Owner Panel tab
  if (isOwner || userRole === 'owner') {
    items.push({
      id: 'admin',
      label: 'প্যানেল',
      icon: Crown,
      badge: pendingRequestsCount,
      badgeColor: 'bg-rose-500 text-white',
    });
  } else if (isSeller) {
    // Seller gets the Seller Shop tab
    items.push({
      id: 'seller_portal',
      label: 'আমার শপ',
      icon: Store,
    });
  }

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-30 ${currentView === 'admin' ? 'max-w-5xl' : 'max-w-lg'} mx-auto bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-2 flex items-center justify-around shadow-2xl transition-all duration-300`}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        const isAdmin = item.id === 'admin';
        const isSellerTab = item.id === 'seller_portal';

        return (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
              isActive
                ? isAdmin
                  ? 'text-rose-400 font-bold'
                  : isSellerTab
                  ? 'text-amber-400 font-bold'
                  : 'text-lime-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isActive && (
              <span
                className={`absolute -top-2 w-8 h-1 rounded-full shadow-sm ${
                  isAdmin
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-rose-500'
                    : isSellerTab
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 shadow-amber-400'
                    : 'bg-gradient-to-r from-lime-400 to-emerald-500 shadow-lime-400'
                }`}
              />
            )}
            <div className="relative">
              <Icon
                className={`w-5 h-5 mb-1 transition-transform ${
                  isActive
                    ? isAdmin
                      ? 'scale-110 text-rose-400'
                      : isSellerTab
                      ? 'scale-110 text-amber-400'
                      : 'scale-110 text-lime-400'
                    : ''
                }`}
              />
              {item.badge && item.badge > 0 ? (
                <span
                  className={`absolute -top-1.5 -right-2 px-1.5 py-0.2 font-bold text-[9px] rounded-full border border-slate-900 ${
                    item.badgeColor || 'bg-lime-400 text-slate-950 font-black'
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] sm:text-[11px] leading-none tracking-tight font-medium">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
