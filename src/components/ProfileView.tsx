import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Gem,
  Copy,
  Check,
  ShieldCheck,
  History,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  UserCheck,
  Edit3,
  Smartphone,
  CreditCard,
  Send,
  Lock,
  MessageSquare,
  Zap,
  Info,
  Crown,
  Store,
  LogIn,
  LogOut,
  HardDrive,
  Cloud,
  Download,
  Upload,
  RefreshCw,
  Flame,
  PhoneCall,
  Mail,
  AlertTriangle,
  UserX,
  Ban,
  Unlock,
  Moon,
  Sun,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ChatMessage,
  GoogleDriveAccount,
  PaymentMethod,
  PaymentRequest,
  PaymentSettings,
  RechargePackage,
  SiteConfig,
  UserAccount,
  UserSession,
} from '../types';
import { RECHARGE_PACKAGES } from '../data/initialData';
import { sounds } from '../utils/sound';
import { driveBackupService } from '../utils/driveBackup';
import { firebaseSync } from '../utils/firebaseSync';

interface SupportMsg {
  id: string;
  sender: 'user' | 'support';
  text: string;
  time: string;
}

interface ProfileViewProps {
  currentUser: UserAccount;
  allUsers: UserAccount[];
  onSwitchUser?: (userId: string) => void;
  onUpdateUserName?: (userId: string, name: string, phone: string) => void;
  onUpdateBio?: (userId: string, bio: string) => void;
  onRegisterUser?: (name: string, username: string, phone: string) => void;
  onUpdateUser?: (userId: string, updated: Partial<UserAccount>) => void;
  diamonds: number;
  paymentRequests: PaymentRequest[];
  paymentSettings: PaymentSettings;
  siteConfig?: SiteConfig;
  rechargePackages?: RechargePackage[];
  chatMessages?: ChatMessage[];
  onRestoreChatMessages?: (messages: ChatMessage[]) => void;
  onSubmitPayment: (data: {
    method: PaymentMethod;
    diamonds: number;
    bdtAmount: number;
    senderPhone: string;
    lastDigits?: string;
    trxId: string;
  }) => void;
  onOpenAdmin: () => void;
  onOpenSellerPortal?: () => void;
  onOpenLoginModal?: () => void;
  onCopyText: (text: string) => void;
  currentSession?: UserSession | null;
  onLoginSession?: (session: UserSession) => void;
  onLogoutSession?: () => void;
  isOwner?: boolean;
  isSeller?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  diamonds,
  paymentRequests,
  paymentSettings,
  siteConfig,
  rechargePackages = [],
  chatMessages = [],
  onRestoreChatMessages,
  onUpdateUser,
  onSubmitPayment,
  onOpenAdmin,
  onOpenSellerPortal,
  onOpenLoginModal,
  onCopyText,
  onUpdateUserName,
  currentSession,
  onLoginSession,
  onLogoutSession,
  isOwner: isOwnerProp,
  isSeller: isSellerProp,
  theme = 'dark',
  onToggleTheme,
}) => {
  const activePackages = rechargePackages && rechargePackages.length > 0 ? rechargePackages : RECHARGE_PACKAGES;

  // Payment states
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('bKash');
  const [selectedPackage, setSelectedPackage] = useState<RechargePackage>(activePackages[0] || RECHARGE_PACKAGES[0]);
  const [customAmount, setCustomAmount] = useState<string>(
    String((activePackages[0]?.diamonds || 100) + (activePackages[0]?.bonus || 0))
  );
  const [senderPhoneInput, setSenderPhoneInput] = useState<string>('');
  const [trxId, setTrxId] = useState<string>('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Google Drive & Local Storage State
  const [googleEmailInput, setGoogleEmailInput] = useState<string>(
    currentUser.linkedGoogleAccount?.email || 'plabonsir1@gmail.com'
  );
  const [isLinkingGoogle, setIsLinkingGoogle] = useState<boolean>(false);
  const [isBackingUpDrive, setIsBackingUpDrive] = useState<boolean>(false);
  const [driveSyncSuccessMsg, setDriveSyncSuccessMsg] = useState<string | null>(null);
  const fileInputDriveRef = useRef<HTMLInputElement>(null);

  // Firebase Access Request State
  const [firebaseReasonInput, setFirebaseReasonInput] = useState<string>('রিয়েল-টাইম কলিং ও চ্যাট ক্লাউড সিঙ্ক প্রয়োজন');
  const [isRequestingFirebase, setIsRequestingFirebase] = useState<boolean>(false);
  const [firebaseRequestSubmitted, setFirebaseRequestSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (activePackages.length > 0) {
      const match = activePackages.find((p) => p.id === selectedPackage?.id);
      if (!match) {
        setSelectedPackage(activePackages[0]);
        setCustomAmount(String(activePackages[0].diamonds + (activePackages[0].bonus || 0)));
      }
    }
  }, [activePackages]);

  // Edit profile inline state
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(currentUser.name);
  const [editPhone, setEditPhone] = useState<string>(currentUser.phone);
  const [editAvatar, setEditAvatar] = useState<string>(currentUser.avatar || '');
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // Support Chat state
  const [chatInput, setChatInput] = useState<string>('');
  const [supportMessages, setSupportMessages] = useState<SupportMsg[]>([
    {
      id: 'msg-1',
      sender: 'support',
      text: 'স্বাগতম! পেমেন্ট ভেরিফাই হলে অ্যাডমিন ইন-অ্যাপ মেসেজে সরাসরি ডায়মন্ড ও সার্ভিস কনফার্মেশন প্রদান করবেন।',
      time: 'সক্রিয়',
    },
  ]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const isOwner = isOwnerProp !== undefined ? isOwnerProp : (currentSession?.role === 'owner' || currentSession?.isOwner === true);
  const isSeller = isSellerProp !== undefined ? isSellerProp : (currentSession?.role === 'seller');

  useEffect(() => {
    setEditName(currentUser.name);
    setEditPhone(currentUser.phone);
  }, [currentUser]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [supportMessages]);

  const getMethodNumber = (method: PaymentMethod) => {
    switch (method) {
      case 'bKash':
        return paymentSettings.bkashNumber;
      case 'Nagad':
        return paymentSettings.nagadNumber;
      case 'Rocket':
        return paymentSettings.rocketNumber;
      case 'Upay':
        return paymentSettings.upayNumber;
    }
  };

  const handleCopy = (number: string) => {
    onCopyText(number);
    setCopiedNumber(number);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const handlePackageSelect = (pkg: RechargePackage) => {
    setSelectedPackage(pkg);
    setCustomAmount((pkg.diamonds + (pkg.bonus || 0)).toString());
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    if (onUpdateUserName) {
      onUpdateUserName(currentUser.id, editName.trim(), editPhone.trim());
    }
    if (onUpdateUser && editAvatar && editAvatar !== currentUser.avatar) {
      onUpdateUser(currentUser.id, { avatar: editAvatar });
    }
    setIsEditingProfile(false);
    sounds.playSuccess();
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setEditAvatar(dataUrl);
        sounds.playSuccess();
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderPhoneInput.trim()) {
      sounds.playError();
      alert('অনুগ্রহ করে যে নম্বর থেকে টাকা পাঠিয়েছেন সেই মোবাইল নম্বরটি লিখুন!');
      return;
    }

    const totalDiamondsForPkg = selectedPackage.diamonds + (selectedPackage.bonus || 0);
    const diamondAmt = parseInt(customAmount) || totalDiamondsForPkg;
    const bdtAmt = selectedPackage.bdtPrice || Math.round((diamondAmt / (paymentSettings.diamondRateDiamonds || 100)) * (paymentSettings.diamondRateBdt || 100));

    const finalTrx = trxId.trim() ? trxId.trim().toUpperCase() : `DIRECT-${Date.now().toString().slice(-6)}`;

    onSubmitPayment({
      method: selectedMethod,
      diamonds: diamondAmt,
      bdtAmount: bdtAmt,
      senderPhone: senderPhoneInput.trim(),
      lastDigits: senderPhoneInput.trim().slice(-4),
      trxId: finalTrx,
    });

    setTrxId('');
    setSenderPhoneInput('');
    sounds.playSuccess();
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const newMsg: SupportMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
    };

    setSupportMessages((prev) => [...prev, newMsg]);
    setChatInput('');
    sounds.playSend();
  };

  const myRequests = paymentRequests.filter(
    (req) => req.userId === currentUser.id || req.userName === currentUser.name
  );

  return (
    <div className="space-y-4 pb-24 animate-fadeIn">
      {/* ১. হেডার সেকশন & ডায়মন্ড ওয়ালেট ব্যালেন্স */}
      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex justify-between items-center shadow-xl">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Gem className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-100 block leading-tight">ডায়মন্ড ওয়ালেট</span>
            <span className="text-[10px] text-slate-400">
              ইউজার আইডি: <strong className="text-cyan-300 font-mono">{currentUser.id}</strong>
            </span>
          </div>
        </div>
        <div className="bg-slate-900 px-3.5 py-1.5 rounded-full border border-amber-500/60 text-xs font-black text-amber-300 shadow-md shadow-amber-500/10 flex items-center gap-1.5">
          <span>💎</span>
          <span id="user-diamonds" className="font-mono text-sm">
            {isOwner ? '∞ আনলিমিটেড' : diamonds.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            {isOwner ? '(সেন্ট্রাল)' : 'ডায়মন্ড'}
          </span>
        </div>
      </div>

      {/* ২. প্রোফাইল ম্যানেজমেন্ট */}
      <div id="profile-box" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`}
                alt={currentUser.name}
                className="w-12 h-12 rounded-xl border border-amber-500 bg-slate-950 object-cover shadow"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full" title="অনলাইন" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 id="display-name" className="font-extrabold text-sm text-amber-300">
                  {currentUser.name}
                </h3>
                {isOwner ? (
                  <span className="text-[9px] bg-lime-500/20 text-lime-300 font-black px-1.5 py-0.2 rounded border border-lime-500/40">
                    👑 ওনার
                  </span>
                ) : isSeller ? (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-black px-1.5 py-0.2 rounded border border-amber-500/40">
                    🛍️ সেলার
                  </span>
                ) : (
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.2 rounded border border-cyan-500/30">
                    {currentUser.role === 'vip' ? 'VIP' : 'PRO'}
                  </span>
                )}
              </div>
              <p id="display-username" className="text-xs text-slate-400 font-mono mt-0.5">
                আইডি: <span className="text-cyan-400 font-bold">{currentUser.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenLoginModal && (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-xs flex items-center gap-1"
                title="লগইন বা একাউন্ট পরিবর্তন"
              >
                <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold">লগইন</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-xs flex items-center gap-1"
              title="তথ্য এডিট করুন"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold">এডিট</span>
            </button>

            {onLogoutSession && (
              <button
                type="button"
                onClick={onLogoutSession}
                className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white transition cursor-pointer text-xs flex items-center gap-1"
                title="সেশন থেকে লগআউট করুন"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">লগআউট</span>
              </button>
            )}
          </div>
        </div>

        {/* Role based quick action button */}
        {isOwner && (
          <div className="p-3 bg-gradient-to-r from-rose-950/60 to-slate-950 border border-rose-500/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-rose-200">ওনার ডাটাবেজ কন্ট্রোল প্যানেল</span>
            </div>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              প্যানেল খুলুন
            </button>
          </div>
        )}

        {isSeller && onOpenSellerPortal && (
          <div className="p-3 bg-gradient-to-r from-amber-950/60 to-slate-950 border border-amber-500/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-200">আপনার সেলার শপ পোর্টাল</span>
            </div>
            <button
              type="button"
              onClick={onOpenSellerPortal}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition cursor-pointer"
            >
              শপ পরিচালনা করুন
            </button>
          </div>
        )}

        {isEditingProfile && (
          <form onSubmit={handleProfileSave} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5 animate-fadeIn">
            {/* Avatar picker */}
            <div className="flex items-center gap-3 p-2 bg-slate-900 border border-slate-800 rounded-lg">
              <img
                src={editAvatar || currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`}
                alt="Avatar Preview"
                className="w-10 h-10 rounded-lg object-cover border border-cyan-500/40 bg-slate-950"
              />
              <div className="flex-1">
                <span className="text-[11px] font-bold text-slate-200 block">প্রোফাইল ছবি পরিবর্তন</span>
                <input
                  type="file"
                  ref={avatarFileRef}
                  onChange={handleAvatarSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  className="mt-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold border border-slate-700 transition cursor-pointer"
                >
                  ডিভাইস থেকে ছবি আপলোড
                </button>
              </div>
            </div>

            {/* Preset avatar options */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 block">অথবা অবতার নির্বাচন করুন:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
                  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aria',
                  'https://api.dicebear.com/7.x/adventurer/svg?seed=Liam',
                  'https://api.dicebear.com/7.x/adventurer/svg?seed=Sara',
                  'https://api.dicebear.com/7.x/adventurer/svg?seed=Nova',
                  'https://api.dicebear.com/7.x/adventurer/svg?seed=Zack',
                ].map((presetUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setEditAvatar(presetUrl);
                      sounds.playClick();
                    }}
                    className={`w-7 h-7 rounded-lg overflow-hidden border transition ${
                      editAvatar === presetUrl ? 'border-amber-400 scale-110' : 'border-slate-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={presetUrl} alt={`Avatar ${idx}`} className="w-full h-full object-cover bg-slate-900" />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">নাম:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ফোন নম্বর:</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>ইউনিক ইউআইডি (UID): <strong className="text-cyan-300 font-mono">{currentUser.id}</strong></span>
              <span className="text-[9px] text-amber-400 font-medium">🔒 সিস্টেম নির্ধারিত (অপরিবর্তনশীল)</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-lg transition cursor-pointer shadow-md"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ২.১: অটোমেটিক ক্লাউড ও লোকাল স্টোরেজ স্ট্যাটাস (Auto Local & Firebase Sync) */}
      <div id="storage-status-box" className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
                <span>ডাটা স্টোরেজ ও নিরাপত্তা</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-semibold">
                  স্বয়ংক্রিয় সিঙ্ক
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">সকল চ্যাট ও একাউন্ট ডাটা সুরক্ষিতভাবে লোকাল ও ক্লাউড সিস্টেমে সেভ থাকে</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-start gap-2">
          <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300">
            <span className="font-bold text-emerald-300 block text-[11px] mb-0.5">লোকাল ও ফায়ারবেস ডাটাবেজ সক্রিয়</span>
            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed">
              আপনার একাউন্টের মেসেজ ও সেটিংস নিরাপদ ক্লাউড এবং ব্রাউজার মেমরিতে অটোমেটিক সংরক্ষিত হচ্ছে।
            </p>
          </div>
        </div>
      </div>

      {/* ২.২: ফায়ারবেস ক্লাউড স্টোরেজ ও ডাটাবেজ পারমিশন (Firebase Cloud Database Permission) */}
      <div id="firebase-permission-box" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                <span>🔥 ফায়ারবেস ক্লাউড ডাটাবেজ সংযোগ</span>
              </h3>
              <p className="text-[10px] text-slate-400">লোকাল ও ক্লাউড ডাটাবেজ সুরক্ষিত রাখতে ওনার অ্যাডমিন অনুমোদন প্রযোজ্য</p>
            </div>
          </div>
        </div>

        {/* Current Access Status Card */}
        {isOwner ? (
          <div className="bg-gradient-to-r from-rose-950/40 to-slate-950 border border-rose-500/40 rounded-xl p-3 flex items-start gap-2.5">
            <Crown className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-xs text-rose-300 block mb-0.5">👑 ওনার অ্যাক্টিভ (Full Unrestricted Access)</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                আপনি প্ল্যাটফর্মের মাস্টার ওনার। ফায়ারবেস ক্লাউড ডাটাবেজ, রিয়েল-টাইম WebRTC ভয়েস ও ভিডিও কলিং এবং ওনার কন্ট্রোল সর্বদা আনলক রয়েছে।
              </p>
            </div>
          </div>
        ) : currentUser.firebaseAccessGranted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-xs text-emerald-300 block mb-0.5">✅ অনুমোদিত (Cloud Storage Active)</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                ওনার আপনার ক্লাউড স্টোরেজ রিকোয়েস্ট অনুমোদন করেছেন! আপনার ডাটা ফায়ারবেস ক্লাউড ডাটাবেজে সরাসরি সিঙ্ক হচ্ছে।
              </p>
            </div>
          </div>
        ) : currentUser.firebaseRequestStatus === 'pending' || firebaseRequestSubmitted ? (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-spin" />
            <div>
              <span className="font-bold text-xs text-amber-300 block mb-0.5">⏳ অনুরোধ পর্যালোচনায় রয়েছে (Pending Approval)</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                আপনার ফায়ারবেস ক্লাউড স্টোরেজ রিকোয়েস্টটি ওনার অ্যাডমিন প্যানেলে পাঠানো হয়েছে। ওনার অনুমোদন দিলে সরাসরি ক্লাউড ডাটাবেজ সিঙ্ক চালু হবে।
              </p>
            </div>
          </div>
        ) : currentUser.firebaseRequestStatus === 'rejected' ? (
          <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-3 flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-xs text-rose-300 block mb-0.5">❌ অনুরোধ বাতিল হয়েছে (Rejected by Admin)</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                আপনার পূর্ববর্তী ফায়ারবেস ক্লাউড স্টোরেজ অনুরোধটি ওনার কর্তৃক বাতিল করা হয়েছিল। লোকাল স্টোরেজ মোড স্বাভাবিকভাবে সক্রিয় রয়েছে।
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-xs text-slate-200 block mb-0.5">💾 লোকাল স্টোরেজ মোড সক্রিয় (ডিফল্ট)</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                আপনার চ্যাট ফোনের লোকাল মেমোরিতে সম্পূর্ণ সুরক্ষিত আছে। সরাসরি ফায়ারবেস ক্লাউড ডাটাবেজ সংযোগের জন্য নিচে আবেদন করতে পারেন।
              </p>
            </div>
          </div>
        )}

        {/* Request Submission Form (Only if not owner and not approved and not pending) */}
        {!isOwner && !currentUser.firebaseAccessGranted && currentUser.firebaseRequestStatus !== 'pending' && !firebaseRequestSubmitted && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">অনুরোধের কারণ (ঐচ্ছিক):</label>
              <input
                type="text"
                value={firebaseReasonInput}
                onChange={(e) => setFirebaseReasonInput(e.target.value)}
                placeholder="ক্লাউড স্টোরেজে প্রজেক্ট ফাইল সিঙ্ক প্রয়োজন..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-400"
              />
            </div>

            <button
              type="button"
              disabled={isRequestingFirebase}
              onClick={async () => {
                setIsRequestingFirebase(true);
                sounds.playClick();
                try {
                  const reqId = `REQ-FB-${Date.now()}`;
                  const accessReq = {
                    id: reqId,
                    userId: currentUser.id,
                    userName: currentUser.name,
                    userPhone: currentUser.phone,
                    userRole: currentUser.role || 'user',
                    userAvatar: currentUser.avatar,
                    reason: firebaseReasonInput.trim() || 'রিয়েল-টাইম কলিং ও ক্লাউড সিঙ্ক প্রয়োজন',
                    requestedAt: new Date().toLocaleString('bn-BD'),
                    status: 'pending' as const,
                  };

                  await firebaseSync.saveAccessRequest(accessReq);
                  if (onUpdateUser) {
                    onUpdateUser(currentUser.id, { firebaseRequestStatus: 'pending' });
                  }
                  setFirebaseRequestSubmitted(true);
                  sounds.playSuccess();
                  confetti({ particleCount: 40, spread: 60 });
                  alert('🚀 আপনার ফায়ারবেস ক্লাউড ও রিয়েল-টাইম কলিং অ্যাক্সেস রিকোয়েস্টটি ওনার অ্যাডমিন প্যানেলে পাঠানো হয়েছে!');
                } catch (err) {
                  alert('রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে: ' + String(err));
                } finally {
                  setIsRequestingFirebase(false);
                }
              }}
              className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-600/20 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Flame className="w-4 h-4 text-orange-200" />
              <span>{isRequestingFirebase ? 'রিকোয়েস্ট পাঠানো হচ্ছে...' : '🚀 Request Firebase Access (অনুরোধ পাঠান)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* থিম ও ডিসপ্লে সেটিংস (ডে মোড ও নাইট মোড) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-blue-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-100">
                ডিসপ্লে ও থিম (Theme Settings)
              </h3>
              <p className="text-[11px] text-slate-400">
                {theme === 'dark' ? 'বর্তমানে নাইট মোড (Dark Theme) সক্রিয় আছে' : 'বর্তমানে ডে মোড (Light Theme) সক্রিয় আছে'}
              </p>
            </div>
          </div>

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                theme === 'dark'
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30'
                  : 'bg-amber-500/20 text-amber-700 border-amber-500/40 hover:bg-amber-500/30'
              }`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>ডে মোড করুন</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-500" />
                  <span>নাইট মোড করুন</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ৩. ব্লক লিস্ট ম্যানেজমেন্ট (ফেসবুকের মতো প্রাইভেসি ও ব্লকড ইউজার নিয়ন্ত্রণ) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Ban className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
                <span>ব্লক ও প্রাইভেসি সেটিংস (Block List)</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-semibold">
                  {(currentUser.blockedUsers || []).length} জন ব্লকড
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                ব্লক করা ইউজাররা আপনাকে মেসেজ বা কল দিতে পারবে না।
              </p>
            </div>
          </div>
        </div>

        {(!currentUser.blockedUsers || currentUser.blockedUsers.length === 0) ? (
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              আপনার ব্লক লিস্ট বর্তমানে সম্পূর্ণ খালি।
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentUser.blockedUsers.map((blockedId) => (
              <div
                key={blockedId}
                className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-mono text-slate-300 font-semibold">{blockedId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    if (onUpdateUser) {
                      const updatedList = (currentUser.blockedUsers || []).filter(
                        (id) => id !== blockedId
                      );
                      onUpdateUser(currentUser.id, { blockedUsers: updatedList });
                    }
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-lg text-[11px] font-bold border border-slate-700 flex items-center gap-1 transition cursor-pointer"
                >
                  <Unlock className="w-3 h-3" />
                  <span>আনব্লক করুন</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ৪. ডায়মন্ড রিচার্জ ও পেমেন্ট সেকশন (bKash / Nagad / Rocket / Upay) */}
      <div id="recharge-box" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                <span>ডায়মন্ড কিনুন (পেমেন্ট গেটওয়ে)</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">১-ক্লিক ভেরিফিকেশন</span>
              </h3>
              <p className="text-[10px] text-slate-400">টাকা পাঠিয়ে প্রেরক নম্বরটি দিন (TrxID বাধ্যতামূলক নয়, ওনার টিক দিলেই কনফার্ম)</p>
            </div>
          </div>
          <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
            {paymentSettings.diamondRateDiamonds || 100} 💎 = ৳{paymentSettings.diamondRateBdt || 100}
          </span>
        </div>

        {/* Dynamic Promotional Offer Banner */}
        {siteConfig?.freeDiamondsOfferEnabled !== false && siteConfig?.freeDiamondsOfferTitle && (
          <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-orange-500/15 border border-amber-500/40 rounded-xl p-2.5 flex items-center gap-2 animate-pulse">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-[11px] font-bold text-amber-200 leading-tight">
              {siteConfig.freeDiamondsOfferTitle}
            </p>
          </div>
        )}

        {/* Payment Method Selector */}
        <div className="grid grid-cols-4 gap-2">
          {(['bKash', 'Nagad', 'Rocket', 'Upay'] as PaymentMethod[]).map((method) => {
            const isSelected = selectedMethod === method;
            return (
              <button
                key={method}
                type="button"
                onClick={() => {
                  setSelectedMethod(method);
                  sounds.playClick();
                }}
                className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                  isSelected
                    ? method === 'bKash'
                      ? 'bg-pink-600/30 border-pink-500 text-pink-300 shadow-md shadow-pink-500/20'
                      : method === 'Nagad'
                      ? 'bg-orange-600/30 border-orange-500 text-orange-300 shadow-md shadow-orange-500/20'
                      : method === 'Rocket'
                      ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-md shadow-purple-500/20'
                      : 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{method}</span>
                <span className="text-[9px] font-normal text-slate-400">Send Money</span>
              </button>
            );
          })}
        </div>

        {/* Selected Number Box with Copy */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block">{selectedMethod} পার্সোনাল নম্বর:</span>
            <span className="text-sm font-mono font-black text-amber-300 tracking-wider">
              {getMethodNumber(selectedMethod)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(getMethodNumber(selectedMethod))}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedNumber === getMethodNumber(selectedMethod) ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">কপি হয়েছে</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>কপি নম্বর</span>
              </>
            )}
          </button>
        </div>

        {/* Packages */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-300 block">প্যাকেজ বাছাই করুন:</label>
          <div className="grid grid-cols-3 gap-2">
            {activePackages.map((pkg) => {
              const isSelected = selectedPackage.id === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => handlePackageSelect(pkg)}
                  className={`p-2 rounded-xl text-center border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="text-xs font-black block text-amber-300">
                    {pkg.diamonds} 💎
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    ৳{pkg.bdtPrice}
                  </span>
                  {pkg.bonus > 0 && !pkg.badge && (
                    <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-bold mt-0.5 inline-block">
                      +{pkg.bonus} বোনাস
                    </span>
                  )}
                  {pkg.badge && (
                    <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-bold mt-0.5 inline-block">
                      {pkg.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Submit Form */}
        <form onSubmit={handlePaymentSubmit} className="space-y-2.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">যে নম্বর থেকে টাকা পাঠিয়েছেন:</label>
              <input
                type="text"
                required
                value={senderPhoneInput}
                onChange={(e) => setSenderPhoneInput(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">
                TrxID / রেফারেন্স <span className="text-slate-500">(ঐচ্ছিক)</span>:
              </label>
              <input
                type="text"
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                placeholder="যেমন: 8N7A6D5E (বা খালি রাখুন)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white uppercase font-mono focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/25 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>কনফার্ম রিচার্জ রিকোয়েস্ট পাঠান</span>
          </button>
        </form>
      </div>

      {/* ৪. ইন-অ্যাপ লাইভ সাপোর্ট বক্স */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-200">প্রাইভেট ইন-অ্যাপ হেল্পডেস্ক</h3>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="অনলাইন" />
        </div>

        <div
          ref={chatScrollRef}
          className="h-32 bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 overflow-y-auto space-y-2 text-xs scrollbar-none"
        >
          {supportMessages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 rounded-xl max-w-[85%] ${
                msg.sender === 'user'
                  ? 'bg-cyan-600/30 border border-cyan-500/40 text-cyan-100 ml-auto'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 mr-auto'
              }`}
            >
              <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
                <span>{msg.sender === 'user' ? 'আপনি' : 'হেল্পডেস্ক'}</span>
                <span>{msg.time}</span>
              </div>
              <p>{msg.text}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSendChatMessage} className="flex items-center gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="যেকোনো সাহায্য বা সমস্যার জন্য মেসেজ লিখুন..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            <span>পাঠান</span>
          </button>
        </form>
      </div>

      {/* ৫. রিচার্জ ইতিহাস */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <History className="w-4 h-4 text-cyan-400" />
          <span>{currentUser.name}-এর রিচার্জ ইতিহাস ({myRequests.length})</span>
        </h3>

        {myRequests.length === 0 ? (
          <p className="text-xs text-slate-500 py-2 text-center">
            কোনো পেন্ডিং বা পূর্বের রিচার্জ রেকর্ড নেই।
          </p>
        ) : (
          <div className="space-y-2">
            {myRequests.map((req) => (
              <div
                key={req.id}
                className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-200">
                    <span className="px-1.5 py-0.2 bg-slate-800 rounded text-[10px] text-amber-300 font-bold">{req.method}</span>
                    <span className="font-mono text-cyan-400">TrxID: {req.trxId}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{req.date} • প্রেরক: {req.senderPhone}</span>
                </div>

                <div className="text-right">
                  <span className="font-bold text-amber-300 flex items-center justify-end gap-1">
                    <Gem className="w-3 h-3 text-amber-400" /> {req.amountDiamonds}
                  </span>
                  <div className="mt-0.5">
                    {req.status === 'pending' && (
                      <span className="text-[10px] text-amber-400 font-semibold flex items-center justify-end gap-0.5">
                        <Clock className="w-3 h-3" /> পেন্ডিং
                      </span>
                    )}
                    {req.status === 'approved' && (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-end gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> সফল
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center justify-end gap-0.5">
                        <XCircle className="w-3 h-3" /> বাতিল
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ONLY OWNER gets secret admin link */}
      {isOwner && (
        <div className="text-center pt-1">
          <button
            onClick={onOpenAdmin}
            className="text-xs text-rose-400/80 hover:text-rose-300 transition flex items-center justify-center gap-1 mx-auto py-2 px-4 rounded-xl hover:bg-slate-900 border border-slate-800 cursor-pointer font-bold"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>ওনার কন্ট্রোল প্যানেল (plabonsir1@gmail.com)</span>
          </button>
        </div>
      )}
    </div>
  );
};
