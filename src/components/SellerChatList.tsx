import React, { useState } from 'react';
import {
  MessageCircle,
  Search,
  CheckCircle,
  Clock,
  Lock,
  Filter,
  ShoppingBag,
  Bot,
  Sparkles,
} from 'lucide-react';
import { Developer, ServiceOrder, ChatMessage } from '../types';
import { sounds } from '../utils/sound';

interface SellerChatListProps {
  sellers: Developer[];
  orders: ServiceOrder[];
  messages?: ChatMessage[];
  onSelectSeller: (seller: Developer) => void;
  onOpenSupportBot: () => void;
  isAdmin?: boolean;
  activeSellerId?: number | null;
}

export const SellerChatList: React.FC<SellerChatListProps> = ({
  sellers,
  orders,
  messages = [],
  onSelectSeller,
  onOpenSupportBot,
  activeSellerId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'purchased' | 'all'>('purchased');

  // Track read timestamps for each seller to determine unread messages
  const [lastReadMap, setLastReadMap] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('chat_last_read_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const getUnreadCountForSeller = (sellerId: number) => {
    const sellerMessages = messages.filter(
      (m) => m.developerId === sellerId && m.sender === 'developer'
    );
    const lastRead = lastReadMap[sellerId] || 0;
    return sellerMessages.filter((m) => {
      const msgTime = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      return msgTime > lastRead;
    }).length;
  };

  const handleSellerClick = (seller: Developer) => {
    sounds.playClick();
    // Mark messages as read for this seller
    const updated = { ...lastReadMap, [seller.id]: Date.now() };
    setLastReadMap(updated);
    try {
      localStorage.setItem('chat_last_read_map', JSON.stringify(updated));
    } catch {}
    onSelectSeller(seller);
  };

  // Identify sellers from whom user purchased time/services
  const purchasedSellerIds = new Set(orders.map((o) => o.developerId));

  // Determine purchased time for each seller based on orders or default time
  const getPurchasedTimeDisplay = (seller: Developer) => {
    const userOrdersForSeller = orders.filter((o) => o.developerId === seller.id);
    if (userOrdersForSeller.length > 0) {
      return `${userOrdersForSeller.length * 30} মিনিট (${userOrdersForSeller.length}টি সেশন)`;
    }
    return `${seller.purchasedTime || 30} মিনিট`;
  };

  // Filter sellers list
  const filteredSellers = sellers.filter((seller) => {
    const matchesSearch =
      seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (seller.username && seller.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      seller.service.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === 'purchased') {
      return purchasedSellerIds.has(seller.id) || (seller.purchasedTime && seller.purchasedTime > 0);
    }
    return true;
  });

  return (
    <div id="seller_chat_list_container" className="bg-slate-950 text-slate-100 min-h-[480px] rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100 leading-tight">
                আপনার চ্যাটসমূহ (Inbox)
              </h3>
              <p className="text-[10px] text-slate-400">
                {filterMode === 'purchased' ? 'শুধুমাত্র সময় কেনা হোস্ট/সেলার তালিকা' : 'সকল ভেরিফায়েড হোস্ট/সেলার'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-300">
            <span className="text-cyan-300 flex items-center gap-1">
              <Lock className="w-3 h-3 text-cyan-400" /> প্রাইভেসি প্রটেক্টেড
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-2.5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="seller_search_input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="সেলার বা সার্ভিস খুঁজুন..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition font-sans"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
          <button
            id="btn_filter_purchased"
            type="button"
            onClick={() => {
              setFilterMode('purchased');
              sounds.playClick();
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              filterMode === 'purchased'
                ? 'bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>সময় বরাদ্দকৃত হোস্ট ({filteredSellers.length})</span>
          </button>
          <button
            id="btn_filter_all"
            type="button"
            onClick={() => {
              setFilterMode('all');
              sounds.playClick();
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              filterMode === 'all'
                ? 'bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>সকল হোস্ট ({sellers.length})</span>
          </button>
        </div>
      </div>

      {/* AI Bot Quick Chat Row */}
      <div
        id="btn_ai_support_bot_chat"
        className="p-3 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between hover:bg-slate-900/80 transition cursor-pointer"
        onClick={onOpenSupportBot}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 flex items-center justify-center shadow">
              <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-cyan-400">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse"></span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-xs sm:text-sm text-white">AI লাইভ অ্যাসিস্ট্যান্ট</h4>
              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.2 rounded">অফিশিয়াল</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">২৪/৭ ইনস্ট্যান্ট রিপ্লাই ও ডায়মন্ড হেল্পডেস্ক</p>
          </div>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 font-bold text-xs transition active:scale-95 cursor-pointer"
        >
          চ্যাট
        </button>
      </div>

      {/* Sellers List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {filteredSellers.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 text-slate-500 mx-auto flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-400">
              {filterMode === 'purchased'
                ? 'আপনার এখনও কোনো সেলারের কাছ থেকে সময় বা সার্ভিস কেনা হয়নি।'
                : 'কোনো সেলার পাওয়া যায়নি।'}
            </p>
            {filterMode === 'purchased' && (
              <button
                id="btn_view_all_sellers_link"
                type="button"
                onClick={() => setFilterMode('all')}
                className="text-xs font-bold text-cyan-400 hover:underline inline-block cursor-pointer"
              >
                সকল ভেরিফায়েড সেলার দেখুন →
              </button>
            )}
          </div>
        ) : (
          filteredSellers.map((seller) => {
            const isSelected = activeSellerId === seller.id;
            const unreadCount = getUnreadCountForSeller(seller.id);
            const avatarUrl =
              seller.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${seller.avatarSeed || seller.name}`;
            const usernameDisplay = seller.username ? (seller.username.startsWith('@') ? seller.username : `@${seller.username}`) : `@seller_${seller.id}`;

            return (
              <div
                key={seller.id}
                id={`chat_item_seller_${seller.id}`}
                onClick={() => handleSellerClick(seller)}
                className={`p-3.5 sm:p-4 flex items-center justify-between transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-950/50 to-blue-950/40 border-l-4 border-l-cyan-400'
                    : 'hover:bg-slate-900/60 active:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Avatar with online status */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-500 to-pink-500 p-0.5 shadow-md">
                      <img
                        src={avatarUrl}
                        alt={seller.name}
                        className="w-full h-full rounded-full bg-slate-950 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    {seller.online ? (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-950 rounded-full" title="অনলাইন"></span>
                    ) : (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-600 border-2 border-slate-950 rounded-full" title="অফলাইন"></span>
                    )}
                  </div>

                  {/* Profile info: Name, Username & Service (Strictly no phone numbers) */}
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                        {seller.name}
                      </h4>
                      <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-[11px] font-mono text-cyan-400/90 truncate">
                        {usernameDisplay}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 truncate">
                      <span className="text-cyan-300 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>সময় কেনা: {getPurchasedTimeDisplay(seller)}</span>
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {seller.service}
                    </p>
                  </div>
                </div>

                {/* Right side unread badge & action button */}
                <div className="shrink-0 flex items-center gap-2.5">
                  {unreadCount > 0 && (
                    <span
                      id={`badge_unread_seller_${seller.id}`}
                      className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px] shadow-md shadow-rose-500/30 animate-bounce"
                    >
                      {unreadCount} নতুন
                    </span>
                  )}
                  <button
                    id={`btn_open_chat_seller_${seller.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSellerClick(seller);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-500 hover:from-lime-300 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
                  >
                    চ্যাট
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
