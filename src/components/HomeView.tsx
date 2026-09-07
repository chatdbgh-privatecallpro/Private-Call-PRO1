import React, { useState } from 'react';
import {
  Search,
  Gem,
  Star,
  MessageSquare,
  Mic,
  PhoneCall,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Radio,
  Crown,
  ShieldCheck,
  Plus,
  Check,
  Sliders,
  Settings,
  Tag,
  Zap,
  Heart,
  FileText,
  CheckSquare,
  Square,
  Send
} from 'lucide-react';
import { Developer, SiteConfig, PaymentSettings, UserAccount } from '../types';
import { sounds } from '../utils/sound';
import { SellerProfileModal } from './SellerProfileModal';

interface HomeViewProps {
  developers: Developer[];
  allUsers?: UserAccount[];
  onStartChatWithDev: (developer: Developer) => void;
  onHireDeveloper: (developer: Developer) => void;
  onOpenRecharge: () => void;
  siteConfig?: SiteConfig;
  paymentSettings?: PaymentSettings;
  userDiamonds?: number;
  onBookSlot?: (
    developerId: number,
    slotNumber: number,
    customSlotId?: string,
    customTimeRange?: string,
    customDiamonds?: number
  ) => void;
  onUpdateHostSettings?: (developerId: number, isTimeSaleActive: boolean, maxAvailableHours: number) => void;
  onSendMessageToPanel?: (text: string) => void;
  isOwner?: boolean;
  isSeller?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  developers,
  allUsers = [],
  onStartChatWithDev,
  onHireDeveloper,
  onOpenRecharge,
  siteConfig,
  paymentSettings,
  userDiamonds = 1500,
  onBookSlot,
  onUpdateHostSettings,
  onSendMessageToPanel,
  isOwner = false,
  isSeller = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [expandedDevId, setExpandedDevId] = useState<number | null>(null);
  const [openSettingsDevId, setOpenSettingsDevId] = useState<number | null>(null);
  const [lastBookedDevId, setLastBookedDevId] = useState<number | null>(null);
  const [showSupportCallModal, setShowSupportCallModal] = useState(false);
  const [showBoyfriendRentModal, setShowBoyfriendRentModal] = useState(false);
  const [hasAgreedToPrivacyPolicy, setHasAgreedToPrivacyPolicy] = useState(false);
  const [boyfriendRentMessage, setBoyfriendRentMessage] = useState('');
  const [boyfriendRentSentSuccess, setBoyfriendRentSentSuccess] = useState(false);
  const [selectedProfileSeller, setSelectedProfileSeller] = useState<Developer | null>(null);
  const [bookingModalData, setBookingModalData] = useState<{
    host: Developer;
    slotNumber: number;
    timeRange: string;
    price: number;
    slotId?: string;
  } | null>(null);

  const supportPhoneNumber = paymentSettings?.supportPhone || paymentSettings?.bkashNumber || '01700000000';
  const supportWhatsappNumber = paymentSettings?.supportWhatsapp || paymentSettings?.nagadNumber || supportPhoneNumber;

  const filters = [
    { id: 'all', label: '👑 সকল হোস্ট (Alex & David)' },
    { id: 'voice', label: '🎙️ লাইভ ভয়েস কল' },
    { id: 'chat', label: '💬 প্রাইভেট চ্যাট' },
    { id: 'instant', label: '⚡ ইনস্ট্যান্ট কানেক্ট' },
  ];

  // Slot time range calculation helper
  const getSlotTimeRange = (slotIndex: number): string => {
    const startHour = 9 + slotIndex; // e.g. slot 1 -> 10:00
    const endHour = startHour + 1;
    const formatHour = (h: number) => {
      const period = h >= 12 && h < 24 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return `${displayH.toString().padStart(2, '0')}:00 ${period}`;
    };
    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
  };

  const filteredHosts = developers.filter((host) => {
    const q = searchQuery.toLowerCase().trim().replace(/^@/, '');
    const hostUserClean = (host.username || '').toLowerCase().replace(/^@/, '');
    const matchesSearch =
      !q ||
      host.name.toLowerCase().includes(q) ||
      hostUserClean.includes(q) ||
      host.service.toLowerCase().includes(q) ||
      host.id.toLowerCase().includes(q) ||
      host.skills.some((skill) => skill.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (selectedFilter === 'voice') return host.skills.some((s) => s.includes('ভয়েস') || s.includes('কল'));
    if (selectedFilter === 'chat') return host.skills.some((s) => s.includes('চ্যাট'));
    if (selectedFilter === 'instant') return host.deliveryTime.includes('ইনস্ট্যান্ট');
    return true;
  });

  const handleSlotClick = (
    host: Developer,
    slotIndex: number,
    customSlot?: { id: string; timeRange: string; diamonds?: number; isBooked: boolean; slotNumber: number }
  ) => {
    if (customSlot) {
      if (customSlot.isBooked) return;
      sounds.playReceive();
      setBookingModalData({
        host,
        slotNumber: customSlot.slotNumber,
        timeRange: customSlot.timeRange,
        price: customSlot.diamonds || host.diamondPerHour || 100,
        slotId: customSlot.id,
      });
      return;
    }

    const booked = host.bookedHours || 0;
    if (slotIndex <= booked) {
      // Already booked
      return;
    }

    sounds.playReceive();
    setBookingModalData({
      host,
      slotNumber: slotIndex,
      timeRange: getSlotTimeRange(slotIndex),
      price: host.diamondPerHour || 100,
    });
  };

  const handleConfirmBooking = () => {
    if (!bookingModalData) return;
    const { host, slotNumber, timeRange, price, slotId } = bookingModalData;

    if (userDiamonds < price) {
      sounds.playError();
      alert('আপনার পর্যাপ্ত ডায়মন্ড নেই! অনুগ্রহ করে রিচার্জ করুন।');
      setBookingModalData(null);
      onOpenRecharge();
      return;
    }

    if (onBookSlot) {
      onBookSlot(host.id, slotNumber, slotId, timeRange, price);
      setLastBookedDevId(host.id);
    }
    setBookingModalData(null);
  };

  return (
    <div className="space-y-4 pb-24 animate-fadeIn">
      {/* Maintenance Alert Mode if active */}
      {siteConfig?.maintenanceMode && (
        <div className="bg-rose-950/80 border border-rose-500/50 rounded-2xl p-3.5 flex items-center gap-3 text-rose-200 shadow-lg animate-pulse">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block text-rose-300">সিস্টেম রক্ষণাবেক্ষণ চলছে</span>
            অ্যাডমিন প্যানেল সক্রিয় রয়েছে।
          </div>
        </div>
      )}

      {/* 📣 ৪. নোটিফিকেশন ও ডিসকাউন্ট অফার ব্যানার (ওয়েলকাম ও রিচার্জ বোনাস) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border border-amber-500/40 p-3 sm:p-3.5 shadow-lg flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300 shadow-inner">
            <Tag className="w-4 h-4 animate-bounce" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                স্পেশাল বোনাস
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-amber-300 truncate">
                {siteConfig?.welcomeBonusDiamonds ? `নতুন একাউন্টে +${siteConfig.welcomeBonusDiamonds} 💎 ফ্রি!` : 'সীমিত সময়ের ধামাকা অফার!'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-bold text-white mt-0.5 leading-snug break-words">
              {siteConfig?.freeDiamondsOfferTitle || `প্রতিটি রিচার্জে +${siteConfig?.rechargeBonusPercentage || 20}% অতিরিক্ত ফ্রি ডায়মন্ড বোনাস!`}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            sounds.playClick();
            onOpenRecharge();
          }}
          className="shrink-0 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer flex items-center gap-1"
        >
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-slate-950" />
          <span>রিচার্জ</span>
        </button>
      </div>

      {/* 💬 হোমপেজ ডায়নামিক সাপোর্ট ও ওনার নোটিশ বক্স (Editable Message from Admin Panel) */}
      <div className="bg-gradient-to-r from-cyan-950/70 via-slate-900 to-indigo-950/70 border border-cyan-500/40 rounded-2xl p-3 sm:p-3.5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 shadow-inner mt-0.5 sm:mt-0">
            <MessageSquare className="w-4 h-4 animate-pulse text-cyan-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
              <span className="text-[10px] sm:text-xs font-black text-cyan-300 uppercase tracking-wider">
                {siteConfig?.siteTagline ? 'সার্বক্ষণিক সহায়তা ও নোটিশ' : '২৪/৭ লাইভ সাপোর্ট'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-200 mt-0.5 font-medium leading-relaxed">
              {siteConfig?.homeSupportNotice ||
                'যেকোনো প্রয়োজনে বা তথ্যের জন্য আমাদের সার্বক্ষণিক লাইভ চ্যাট অথবা সাপোর্ট সেন্টারে যোগাযোগ করুন। তাৎক্ষণিক সেবা নিশ্চিত করা হয়।'}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setShowSupportCallModal(true);
            }}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>লাইভ চ্যাট হেল্প</span>
          </button>
        </div>
      </div>

      {/* 💖 কাস্টমাইজেবল বুকিং ও পলিসি কার্ড (Boyfriend Rental Policy & Direct Panel Booking) */}
      {siteConfig?.showBoyfriendRentNotice !== false && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/80 via-purple-950/60 to-slate-900 border border-rose-500/40 p-3.5 sm:p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-500/30 to-pink-600/30 border border-rose-400/50 flex items-center justify-center shrink-0 text-rose-300 shadow-md shadow-rose-500/20">
                <Heart className="w-5 h-5 text-rose-400 fill-rose-400/40 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-sm">
                    {siteConfig?.boyfriendRentTag || 'প্রাইভেট বুকিং'}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-rose-300">
                    ১০০% গোপনীয় ও বিশ্বস্ত
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-black text-white mt-1 leading-snug">
                  {siteConfig?.boyfriendRentTitle || 'বয়ফ্রেন্ড ভাড়া নেওয়ার জন্য বুকিং করুন এবং বিস্তারিত দেখুন'}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  {siteConfig?.boyfriendRentSubtitle || 'লাইভ ভয়েস কল ও প্রাইভেট চ্যাট সেশনের জন্য নীতিমালা পড়ে সরাসরি ওনার/অ্যাডমিন প্যানেলে বুকিং মেসেজ পাঠান।'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setShowBoyfriendRentModal(true);
              }}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 hover:from-rose-400 hover:to-pink-400 text-slate-950 text-xs font-black shadow-md shadow-rose-500/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <FileText className="w-3.5 h-3.5 text-slate-950" />
              <span>{siteConfig?.boyfriendRentButtonText || 'বিস্তারিত ও বুকিং মেসেজ'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="হোস্ট খুঁজুন (যেমন: Alex, David, ভয়েস, চ্যাট)..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-lime-500 shadow-inner transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
          >
            ক্লিয়ার
          </button>
        )}
      </div>

      {/* Host Cards (Alex and David) */}
      <div className="space-y-4">
        {filteredHosts.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
            <Mic className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">কোনো হোস্ট পাওয়া যায়নি!</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFilter('all');
              }}
              className="mt-3 text-xs text-lime-400 hover:underline"
            >
              সকল হোস্ট দেখুন
            </button>
          </div>
        ) : (
          filteredHosts.map((host) => {
            const isExpanded = expandedDevId === host.id;
            const maxHours = host.maxAvailableHours || 10;
            const bookedHours = host.bookedHours || 0;
            const isTimeSaleActive = host.isTimeSaleActive !== false;
            const pricePerHour = host.diamondPerHour || 100;
            const uniqueUsername = host.username ? host.username.replace(/^@/, '') : host.name.toLowerCase().replace(/\s+/g, '_');

            return (
              <div
                key={host.id}
                className="group bg-slate-900/95 border border-slate-800 hover:border-lime-500/40 rounded-2xl p-3.5 sm:p-4 transition-all duration-200 shadow-xl space-y-3"
              >
                {/* Header Row with Seller ID & Verified Badges */}
                <div className="flex items-start gap-3">
                  <div
                    onClick={() => {
                      sounds.playClick();
                      setSelectedProfileSeller(host);
                    }}
                    className="relative shrink-0 cursor-pointer group/avatar hover:scale-105 transition transform"
                    title="সেলার পার্সোনাল প্রোফাইল ও অডিও ভয়েস শুনুন"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-lime-500 to-emerald-600 p-0.5 shadow-md">
                      <img
                        src={host.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${host.avatarSeed}`}
                        alt={host.name}
                        className="w-full h-full rounded-[14px] bg-slate-900 object-cover"
                      />
                    </div>
                    {host.online ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-lime-400 border-2 border-slate-900 rounded-full" title="অনলাইন" />
                    ) : (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-slate-500 border-2 border-slate-900 rounded-full" title="অফলাইন" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setSelectedProfileSeller(host);
                            }}
                            className="font-extrabold text-slate-100 text-xs sm:text-sm leading-snug hover:text-lime-300 transition text-left cursor-pointer flex items-center gap-1"
                            title="সেলার পার্সোনাল প্রোফাইল ও অডিও শুনুন"
                          >
                            <span>{host.name}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 shrink-0 inline" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setSelectedProfileSeller(host);
                            }}
                            className="text-[10px] sm:text-[11px] font-mono font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-950/70 hover:bg-cyan-900/70 px-2 py-0.5 rounded-lg border border-cyan-500/40 shadow-sm cursor-pointer transition active:scale-95 flex items-center gap-0.5"
                            title="সেলার ইউনিক ইউজারনেম"
                          >
                            <span className="text-cyan-400 font-bold">@</span>
                            <span>{uniqueUsername}</span>
                          </button>
                        </div>

                        <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-0.5 leading-normal truncate">
                          {host.service}
                        </p>
                      </div>

                      {/* Diamond Price */}
                      <div className="flex items-center gap-1 text-lime-300 font-extrabold text-xs shrink-0 bg-lime-950/80 border border-lime-500/40 px-2 py-0.5 rounded-xl shadow-md">
                        <Gem className="w-3 h-3 text-lime-400" />
                        <span>{pricePerHour}</span>
                        <span className="text-[9px] text-lime-400/80 font-normal">💎/ঘণ্টা</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 text-[10px] sm:text-[11px] text-slate-400">
                      <span className="inline-block text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-800/60">
                        {isTimeSaleActive ? '🟢 সেশন চালু' : '⚪ বন্ধ'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-amber-400 font-bold text-[9px] sm:text-[10px]">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {host.rating || '5.0'} ({host.completedOrders || '400'}+)
                      </span>
                      <span>•</span>
                      <span className="text-lime-300 font-mono font-semibold text-[9px] sm:text-[10px]">
                        {maxHours - bookedHours > 0 ? `${maxHours - bookedHours} ঘণ্টা খালি` : 'বুকিং পূর্ণ'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hourly / Custom Interactive Booking Slots */}
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1 text-[11px] sm:text-xs">
                      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-lime-400" />
                      <span>
                        {host.customSlots && host.customSlots.length > 0
                          ? `নির্ধারিত স্লট (${host.customSlots.length}টি সময়)`
                          : `ঘণ্টা ভিত্তিক স্লট বুকিং (${pricePerHour} 💎/ঘণ্টা)`}
                      </span>
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                      বুকড: <strong className="text-lime-400">{bookedHours}</strong> /{' '}
                      {host.customSlots && host.customSlots.length > 0 ? host.customSlots.length : maxHours}
                    </span>
                  </div>

                  {!isTimeSaleActive ? (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                      🔒 হোস্ট বর্তমানে নতুন বুকিং নিচ্ছেন না।
                    </div>
                  ) : host.customSlots && host.customSlots.length > 0 ? (
                    /* Custom Slots Configured by Seller in Daily Slot Manager - Progressive Dynamic Generation */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2">
                      {(() => {
                        const firstUnbookedIndex = host.customSlots.findIndex((s) => !s.isBooked);
                        const customSlotsToShow = host.customSlots.filter(
                          (cSlot, idx) => cSlot.isBooked || idx === firstUnbookedIndex
                        );

                        return customSlotsToShow.map((cSlot) => {
                          const isBooked = cSlot.isBooked;
                          const slotCost = cSlot.diamonds || pricePerHour;
                          const matchedUser = allUsers.find((u) => u.id === cSlot.bookedByUserId);
                          const displayUserName = cSlot.bookedByUserName || matchedUser?.name || 'গ্রাহক বুকড';
                          const displayUserAvatar =
                            cSlot.bookedByUserAvatar ||
                            matchedUser?.avatar ||
                            `https://api.dicebear.com/7.x/adventurer/svg?seed=Booked${cSlot.slotNumber}`;

                          return (
                            <button
                              key={cSlot.id}
                              type="button"
                              disabled={isBooked}
                              onClick={() => {
                                sounds.playClick();
                                handleSlotClick(host, cSlot.slotNumber, cSlot);
                              }}
                              className={`p-2 rounded-xl border text-center flex flex-col items-center justify-between transition-all min-h-[76px] sm:min-h-[82px] relative overflow-hidden ${
                                isBooked
                                  ? 'bg-slate-950/95 border-emerald-500/50 text-slate-200 shadow-inner opacity-95'
                                  : 'bg-gradient-to-b from-lime-500/20 to-emerald-950/60 border-lime-400 text-lime-300 hover:scale-102 shadow-md shadow-lime-500/20 font-bold cursor-pointer'
                              }`}
                            >
                              {isBooked ? (
                                <div className="w-full flex flex-col items-center justify-center gap-0.5">
                                  <div className="flex items-center gap-1 w-full justify-center">
                                    <img
                                      src={displayUserAvatar}
                                      alt={displayUserName}
                                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-emerald-400 object-cover bg-slate-900 shrink-0 shadow-sm"
                                    />
                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-100 truncate max-w-[85px] sm:max-w-[110px]">
                                      {displayUserName}
                                    </span>
                                  </div>
                                  <span className="text-[8px] font-mono text-emerald-300 bg-emerald-950/90 px-1 py-0.2 rounded border border-emerald-500/40 whitespace-nowrap">
                                    {cSlot.timeRange}
                                  </span>
                                  <div className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-400">
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>🔒 বুকড</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full flex flex-col items-center justify-center gap-0.5">
                                  <div className="flex items-center gap-0.5 text-lime-300">
                                    <Plus className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                                    <span className="text-[9px] sm:text-[10px] font-black">+ ১ ঘণ্টা বুক</span>
                                  </div>
                                  <span className="text-[8px] sm:text-[9px] font-mono text-lime-300 bg-lime-950/80 px-1 py-0.2 rounded border border-lime-500/40 whitespace-nowrap">
                                    {cSlot.timeRange}
                                  </span>
                                  <span className="text-[8px] sm:text-[9px] text-lime-400 font-bold">
                                    {slotCost} 💎
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    /* Default standard hour slots - Progressive Dynamic Generation (Only Booked Slots + 1 Next Available Slot) */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2">
                      {Array.from({ length: Math.min(bookedHours + 1, maxHours) }).map((_, index) => {
                        const slotNum = index + 1;
                        const isBooked = slotNum <= bookedHours;
                        const slotTimeRange = getSlotTimeRange(slotNum);
                        const bookedInfo = host.bookedSlots?.find((s) => s.slotNumber === slotNum);
                        const matchedUser = bookedInfo?.userId ? allUsers.find((u) => u.id === bookedInfo.userId) : null;
                        const displayUserName = bookedInfo?.userName || matchedUser?.name || 'গ্রাহক বুকড';
                        const displayUserAvatar =
                          bookedInfo?.userAvatar ||
                          matchedUser?.avatar ||
                          `https://api.dicebear.com/7.x/adventurer/svg?seed=Slot${slotNum}`;
                        const displayTimeRange = bookedInfo?.timeRange || slotTimeRange;

                        return (
                          <button
                            key={index}
                            type="button"
                            disabled={isBooked}
                            onClick={() => {
                              sounds.playClick();
                              handleSlotClick(host, slotNum);
                            }}
                            className={`p-2 rounded-xl border text-center flex flex-col items-center justify-between transition-all min-h-[76px] sm:min-h-[82px] relative overflow-hidden ${
                              isBooked
                                ? 'bg-slate-950/95 border-emerald-500/50 text-slate-200 shadow-inner opacity-95'
                                : 'bg-gradient-to-b from-lime-500/20 to-emerald-950/60 border-lime-400 text-lime-300 hover:scale-102 shadow-md shadow-lime-500/20 font-bold cursor-pointer'
                            }`}
                          >
                            {isBooked ? (
                              <div className="w-full flex flex-col items-center justify-center gap-0.5">
                                <div className="flex items-center gap-1 w-full justify-center">
                                  <img
                                    src={displayUserAvatar}
                                    alt={displayUserName}
                                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-emerald-400 object-cover bg-slate-900 shrink-0 shadow-sm"
                                  />
                                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-100 truncate max-w-[85px] sm:max-w-[110px]">
                                    {displayUserName}
                                  </span>
                                </div>
                                <span className="text-[8px] font-mono text-emerald-300 bg-emerald-950/90 px-1 py-0.2 rounded border border-emerald-500/40 whitespace-nowrap">
                                  {displayTimeRange}
                                </span>
                                <div className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-400">
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>🔒 বুকড</span>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full flex flex-col items-center justify-center gap-0.5">
                                <div className="flex items-center gap-0.5 text-lime-300">
                                  <Plus className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                                  <span className="text-[9px] sm:text-[10px] font-black">+ ১ ঘণ্টা বুক</span>
                                </div>
                                <span className="text-[8px] sm:text-[9px] font-mono text-lime-300 bg-lime-950/80 px-1 py-0.2 rounded border border-lime-500/40 whitespace-nowrap">
                                  {slotTimeRange}
                                </span>
                                <span className="text-[8px] sm:text-[9px] text-lime-400/90 font-bold">
                                  {pricePerHour} 💎
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Booking complete warning if full */}
                  {bookedHours >= (host.customSlots && host.customSlots.length > 0 ? host.customSlots.length : maxHours) && isTimeSaleActive && (
                    <div className="text-[10px] sm:text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl p-2 text-center font-medium">
                      ⚠️ সকল নির্ধারিত সময় স্লট বুকিং সম্পন্ন হয়েছে!
                    </div>
                  )}
                </div>

                {/* Action Buttons Footer: Pink Book Button & Compact Message Button */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      if (host.customSlots && host.customSlots.length > 0) {
                        const nextSlot = host.customSlots.find((s) => !s.isBooked);
                        if (nextSlot) {
                          handleSlotClick(host, nextSlot.slotNumber, nextSlot);
                          return;
                        }
                      } else if (bookedHours < maxHours) {
                        handleSlotClick(host, bookedHours + 1);
                        return;
                      }
                      onHireDeveloper(host);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-400 hover:to-rose-400 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-pink-500/25 transition active:scale-98 cursor-pointer"
                  >
                    <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 fill-white/20" />
                    <span>বুক করুন</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onStartChatWithDev(host);
                    }}
                    className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-pink-400 hover:text-pink-300 border border-slate-700 hover:border-pink-500/50 shadow-md transition active:scale-95 flex items-center justify-center cursor-pointer shrink-0"
                    title="মেসেজ পাঠান"
                  >
                    <MessageSquare className="w-4 h-4 text-pink-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 🛎️ SLOT BOOKING CONFIRMATION & DIAMOND DEDUCTION POPUP MODAL */}
      {bookingModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-lime-500/50 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-lime-500/20 relative animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lime-500/20 border border-lime-500/40 flex items-center justify-center text-lime-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">স্লট বুকিং কনফার্মেশন</h4>
                  <p className="text-[10px] text-slate-400">হোস্ট টাইম স্লট রিজার্ভেশন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setBookingModalData(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Host Details */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3">
              <img
                src={bookingModalData.host.avatar}
                alt={bookingModalData.host.name}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-lime-400/50 shadow-md shrink-0 bg-slate-800"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h5 className="text-xs font-black text-lime-300 truncate">{bookingModalData.host.name}</h5>
                  <span className="text-[9px] bg-emerald-950 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                    অনলাইন
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate">{bookingModalData.host.service}</p>
                <p className="text-[10px] font-mono text-lime-400 font-bold mt-0.5">
                  প্রতি ঘণ্টা {bookingModalData.host.diamondPerHour || 100} 💎
                </p>
              </div>
            </div>

            {/* Booking Details Specs */}
            <div className="space-y-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>নির্বাচিত স্লট:</span>
                <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                  স্লট #{bookingModalData.slotNumber} (১ ঘণ্টা)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>⏰ নির্ধারিত সময়সীমা:</span>
                <span className="font-mono font-bold text-lime-300 bg-lime-950/80 px-2 py-0.5 rounded-lg border border-lime-500/30">
                  {bookingModalData.timeRange}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
                <span>প্রয়োজনীয় ডায়মন্ড:</span>
                <span className="font-mono font-black text-amber-400 flex items-center gap-1">
                  <Gem className="w-3.5 h-3.5 fill-amber-400" />
                  {bookingModalData.price} 💎
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>আপনার ওয়ালেট ব্যালেন্স:</span>
                <span className="font-mono font-bold text-slate-200">
                  {userDiamonds} 💎
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>বুকিং পরবর্তী ব্যালেন্স:</span>
                <span className={`font-mono font-bold ${userDiamonds >= bookingModalData.price ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {userDiamonds - bookingModalData.price} 💎
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {userDiamonds < bookingModalData.price ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-center text-xs text-rose-300 font-medium">
                  ⚠️ আপনার একাউন্টে পর্যাপ্ত ডায়মন্ড নেই! রিচার্জ করুন।
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setBookingModalData(null);
                    onOpenRecharge();
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Gem className="w-4 h-4 fill-slate-950" />
                  <span>এখনই ডায়মন্ড রিচার্জ করুন</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setBookingModalData(null);
                  }}
                  className="w-1/3 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playSuccess();
                    handleConfirmBooking();
                  }}
                  className="w-2/3 py-2.5 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-green-500 hover:from-lime-300 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>✅ বুকিং নিশ্চিত করুন</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 👑 SELLER PERSONAL PROFILE & VOICE INTRO MODAL */}
      <SellerProfileModal
        seller={selectedProfileSeller}
        isOpen={!!selectedProfileSeller}
        onClose={() => setSelectedProfileSeller(null)}
        onHire={(dev) => {
          setSelectedProfileSeller(null);
          onHireDeveloper(dev);
        }}
        onStartChat={(dev) => {
          setSelectedProfileSeller(null);
          onStartChatWithDev(dev);
        }}
      />

      {/* 💖 BOYFRIEND RENT BOOKING & MANDATORY PRIVACY POLICY MODAL */}
      {showBoyfriendRentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl shadow-rose-500/20 relative animate-scaleUp max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Heart className="w-5 h-5 fill-rose-500/40" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">বয়ফ্রেন্ড ভাড়া বুকিং ও নীতিমালা</h4>
                  <p className="text-[10px] text-rose-300">প্রাইভেসি পলিসি ও প্যানেল ডিরেক্ট মেসেজ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setShowBoyfriendRentModal(false);
                }}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Policy Content Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5 text-rose-300">
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                  <span>প্রাইভেসি পলিসি ও আবশ্যকীয় শর্তাবলী:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">পড়ুন ও টিক দিন</span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2 max-h-52 overflow-y-auto leading-relaxed shadow-inner scrollbar-thin">
                {siteConfig?.boyfriendRentPolicy ? (
                  <div className="whitespace-pre-line text-[11px] leading-relaxed">
                    {siteConfig.boyfriendRentPolicy}
                  </div>
                ) : (
                  <>
                    <p className="font-bold text-white text-xs">
                      📌 বয়ফ্রেন্ড ভাড়া ও প্রাইভেট সেশন নীতিমালা:
                    </p>
                    <p className="text-[11px]">
                      <strong>১. শতভাগ পরিচয়ের গোপনীয়তা:</strong> সকল ব্যবহারকারী ও ক্লায়েন্টের পরিচয়, কলিং এবং তথ্য সম্পূর্ণ সুরক্ষিত ও গোপন রাখা হয়।
                    </p>
                    <p className="text-[11px]">
                      <strong>২. শালীন ও মার্জিত যোগাযোগ:</strong> লাইভ ভয়েস ও চ্যাট সেশনে সৌজন্যমূলক আচরণ বজায় রাখা বাধ্যতামূলক।
                    </p>
                    <p className="text-[11px]">
                      <strong>৩. স্লট ও সেশন বুকিং:</strong> ডায়মন্ডের মাধ্যমে বুকিং সম্পন্ন করে সরাসরি সুরক্ষিত ইন-অ্যাপ পোর্টালে যুক্ত হয়ে কথা বলুন।
                    </p>
                    <p className="text-[11px]">
                      <strong>৪. সার্বক্ষণিক ওনার সাপোর্ট:</strong> যেকোনো জিজ্ঞাসা বা বিশেষ রিকোয়ারমেন্টের জন্য সরাসরি অ্যাডমিন ও ওনার প্যানেলে যোগাযোগ করা যাবে।
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Mandatory Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 transition cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAgreedToPrivacyPolicy}
                onChange={(e) => {
                  setHasAgreedToPrivacyPolicy(e.target.checked);
                  sounds.playClick();
                }}
                className="mt-0.5 w-4 h-4 rounded text-rose-500 bg-slate-900 border-slate-700 focus:ring-rose-500 shrink-0 cursor-pointer accent-rose-500"
              />
              <span className="text-xs text-slate-200 font-medium leading-tight">
                আমি প্রাইভেসি পলিসি ও সকল শর্তাবলী মনোযোগ সহকারে পড়েছি এবং এতে সম্মতি দিচ্ছি।
              </span>
            </label>

            {/* Direct Message Input & Submit Button (Only Shown / Active When Checkbox is Checked) */}
            {hasAgreedToPrivacyPolicy ? (
              <div className="space-y-3 pt-1 animate-fadeIn">
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">
                    💌 ওনার/অ্যাডমিন প্যানেলে সরাসরি বার্তা লিখুন:
                  </label>
                  <textarea
                    value={boyfriendRentMessage}
                    onChange={(e) => setBoyfriendRentMessage(e.target.value)}
                    placeholder="যেমন: আমি Alex/David-এর সাথে ২ ঘণ্টার জন্য বুকিং করতে চাই..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500 shadow-inner resize-none transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const messageToSend = boyfriendRentMessage.trim() || 'আমি বয়ফ্রেন্ড ভাড়া নেওয়ার জন্য বিস্তারিত জানতে ও বুকিং করতে আগ্রহী।';
                    if (onSendMessageToPanel) {
                      onSendMessageToPanel(messageToSend);
                    }
                    sounds.playSuccess();
                    setShowBoyfriendRentModal(false);
                    setBoyfriendRentMessage('');
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 hover:from-rose-400 hover:to-pink-400 text-slate-950 font-black text-xs shadow-lg shadow-rose-500/25 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 fill-slate-950" />
                  <span>প্যানেলে সরাসরি চ্যাট ও মেসেজ পাঠান</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                🔒 বার্তা পাঠাতে উপরে প্রাইভেসি পলিসিতে টিক দিন।
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
