import React, { useState, useEffect } from 'react';
import {
  Phone,
  Lock,
  Sparkles,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Shield,
  UserPlus,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { UserSession, Developer, UserAccount } from '../types';
import { sounds } from '../utils/sound';
import { authenticateAdminFirebase, createSignedSession, syncUserFirebaseToken } from '../utils/auth';
import { securityFirewall, sanitizeInput, hashPassword, verifyPassword } from '../utils/security';

interface LoginVerificationProps {
  currentSession: UserSession | null;
  allDevelopers?: Developer[];
  allUsers?: UserAccount[];
  welcomeBonusDiamonds?: number;
  freeDiamondsOfferEnabled?: boolean;
  loginNoticeMessage?: string;
  onLoginSuccess: (userData: UserSession) => void;
  onRegisterSeller?: (sellerData: Partial<Developer>, password?: string) => void;
  onRegisterCustomer?: (name: string, phone: string, password?: string, avatar?: string, customId?: string) => void;
  onLogout: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const LoginVerification: React.FC<LoginVerificationProps> = ({
  currentSession,
  allDevelopers = [],
  allUsers = [],
  welcomeBonusDiamonds = 50,
  freeDiamondsOfferEnabled = true,
  loginNoticeMessage,
  onLoginSuccess,
  onRegisterCustomer,
  onLogout,
  onClose,
  isModal = false,
}) => {
  // Main Authentication Tabs: 'signup' and 'login'
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');

  // Sign Up Form States (ONLY 2 Fields: Phone & Password)
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPass, setShowSignupPass] = useState(false);

  // Login Form States (ONLY 2 Fields: Phone & Password)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  useEffect(() => {
    if (currentSession) {
      setLoginIdentifier(currentSession.phone || currentSession.userId || currentSession.name);
    }
  }, [currentSession]);

  // 1. SIGN UP HANDLER (Only Phone and Password required with STRICT 11 DIGITS check)
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = sanitizeInput(signupPhone).replace(/\s+/g, '');
    const phoneDigitsOnly = phone.replace(/\D/g, '');
    const password = signupPassword.trim();

    if (!phone || !password) {
      sounds.playError();
      setStatusMessage({ text: 'অনুগ্রহ করে মোবাইল নম্বর এবং পাসওয়ার্ড পূরণ করুন।', type: 'error' });
      return;
    }

    // STRICT 11 DIGITS VALIDATION
    if (phoneDigitsOnly.length !== 11) {
      sounds.playError();
      setStatusMessage({
        text: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)। ১১ ডিজিট ছাড়া রেজিস্ট্রেশন হবে না।',
        type: 'error',
      });
      return;
    }

    if (password.length < 3) {
      sounds.playError();
      setStatusMessage({ text: 'পাসওয়ার্ড কমপক্ষে ৩ অক্ষরের হতে হবে।', type: 'error' });
      return;
    }

    // Check if phone is already registered
    const existingUser = allUsers.find((u) => u.phone && u.phone.replace(/\s+/g, '') === phone);

    if (existingUser) {
      sounds.playError();
      setStatusMessage({
        text: `এই মোবাইল নম্বর (${phone}) দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে! অনুগ্রহ করে 'লগইন' করুন।`,
        type: 'error',
      });
      return;
    }

    // Generate user ID and default name (Can be changed in Profile anytime)
    const suffix = phoneDigitsOnly.slice(-4) || String(Math.floor(1000 + Math.random() * 9000));
    const uniqueBuyerId = `BUYER-${suffix}`;
    const defaultName = `ইউজার ${suffix}`;
    const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(phone)}`;

    const customerSession: UserSession = {
      name: defaultName,
      phone,
      sessionId: `CUST-${uniqueBuyerId}`,
      userId: uniqueBuyerId,
      role: 'customer',
      avatar: defaultAvatar,
      loginAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
    };

    const secureHashedPassword = await hashPassword(password);

    if (onRegisterCustomer) {
      onRegisterCustomer(defaultName, phone, secureHashedPassword, defaultAvatar, uniqueBuyerId);
    }

    // Sync Firebase Authentication with Custom Token for true security isolation
    syncUserFirebaseToken(uniqueBuyerId, 'customer', phone).catch(() => {});

    localStorage.setItem('user_session', JSON.stringify(customerSession));
    sounds.playDiamond();
    setStatusMessage({
      text:
        freeDiamondsOfferEnabled && welcomeBonusDiamonds > 0
          ? `🎉 একাউন্ট তৈরি সফল! আপনার আইডি: ${uniqueBuyerId} এবং ফ্রি ${welcomeBonusDiamonds} 💎 ওয়েলকাম ডায়মন্ড যুক্ত হয়েছে!`
          : `🎉 একাউন্ট তৈরি সফল! আপনার আইডি: ${uniqueBuyerId}।`,
      type: 'success',
    });

    setTimeout(() => {
      onLoginSuccess(customerSession);
      if (onClose) onClose();
    }, 700);
  };

  // 2. UNIFIED LOGIN HANDLER (Strictly Phone and Password / Admin Firebase Auth)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = sanitizeInput(loginIdentifier).trim();
    const inputPass = loginPassword.trim();

    if (!input || !inputPass) {
      sounds.playError();
      setStatusMessage({ text: 'অনুগ্রহ করে মোবাইল নম্বর এবং পাসওয়ার্ড দিন।', type: 'error' });
      return;
    }

    // Rate Limiter & Brute Force Lock Check
    const authCheck = securityFirewall.recordFailedLogin(input);
    if (authCheck.locked) {
      sounds.playError();
      setStatusMessage({
        text: '🚫 অতিরিক্ত ভুল চেষ্টার কারণে একাউন্টটি সাময়িকভাবে লক করা হয়েছে। ৫ মিনিট পর আবার চেষ্টা করুন।',
        type: 'error',
      });
      return;
    }

    // Check 1: Admin / Owner Authentication (Native Server Auth with Zero 3rd-Party Blockage)
    const adminAuthRes = await authenticateAdminFirebase(input, inputPass);
    if (adminAuthRes.success) {
      securityFirewall.resetFailedLogin(input);
      if (adminAuthRes.token) {
        localStorage.setItem('admin_server_token', adminAuthRes.token);
      }
      const ownerSession: UserSession = createSignedSession({
        name: adminAuthRes.user?.displayName || 'মাস্টার অ্যাডমিন ওনার',
        phone: adminAuthRes.user?.email || input,
        sessionId: `OWNER-${adminAuthRes.user?.uid?.slice(0, 8) || 'USP686'}`,
        role: 'owner',
        isOwner: true,
        userId: adminAuthRes.user?.uid || 'USR-OWNER',
        avatar: adminAuthRes.user?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminOwner',
        token: adminAuthRes.token || '',
        loginAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      });

      localStorage.setItem('user_session', JSON.stringify(ownerSession));
      sounds.playSuccess();
      setStatusMessage({ text: '👑 ওনার ডাটাবেজ ও ফুল কন্ট্রোল আনলক হয়েছে!', type: 'success' });

      setTimeout(() => {
        onLoginSuccess(ownerSession);
        if (onClose) onClose();
      }, 600);
      return;
    }

    // Check 2: Seller / Host Credentials (from allDevelopers DB)
    const matchingDev = allDevelopers.find(
      (d) =>
        d.name.toLowerCase() === input.toLowerCase() ||
        (d.username && d.username.toLowerCase() === input.toLowerCase()) ||
        (d.phone && d.phone.replace(/\s+/g, '') === input.replace(/\s+/g, ''))
    );

    if (matchingDev) {
      const isSellerPassValid = matchingDev.password
        ? await verifyPassword(inputPass, matchingDev.password)
        : false;

      if (!isSellerPassValid) {
        sounds.playError();
        setStatusMessage({
          text: `ভুল পাসওয়ার্ড! আর ${authCheck.attemptsLeft} বার ভুল দিলে সাময়িকভাবে লক হবে।`,
          type: 'error',
        });
        return;
      }

      securityFirewall.resetFailedLogin(input);
      const sellerSession: UserSession = {
        name: matchingDev.name,
        phone: matchingDev.phone || input,
        sessionId: `SELLER-${matchingDev.id}`,
        userId: matchingDev.username || `SELLER-${matchingDev.id}`,
        role: 'seller',
        isSeller: true,
        sellerId: matchingDev.id,
        avatar: matchingDev.avatar,
        loginAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      };

      // Sync Firebase Authentication with Custom Token for true security isolation
      const targetSellerUid = `dev_${matchingDev.id}`;
      syncUserFirebaseToken(targetSellerUid, 'seller', matchingDev.phone || matchingDev.name).catch(() => {});

      localStorage.setItem('user_session', JSON.stringify(sellerSession));
      sounds.playSuccess();
      setStatusMessage({ text: `🛍️ সেলার পোর্টালে স্বাগতম: ${matchingDev.name}`, type: 'success' });

      setTimeout(() => {
        onLoginSuccess(sellerSession);
        if (onClose) onClose();
      }, 600);
      return;
    }

    // Check 3: Registered Customer / Buyer by ID, Phone, Username or Name from allUsers DB
    const matchingUser = allUsers.find(
      (u) =>
        u.id.toLowerCase() === input.toLowerCase() ||
        (u.phone && u.phone.replace(/\s+/g, '') === input.replace(/\s+/g, '')) ||
        u.name.toLowerCase() === input.toLowerCase() ||
        (u.username && u.username.toLowerCase() === input.toLowerCase())
    );

    if (matchingUser) {
      if (matchingUser.isBanned) {
        sounds.playError();
        setStatusMessage({ text: '🚫 এই অ্যাকাউন্টটি ওনার প্যানেল থেকে ব্যান করা হয়েছে!', type: 'error' });
        return;
      }

      const isPassValid = matchingUser.password
        ? await verifyPassword(inputPass, matchingUser.password)
        : false;

      if (!isPassValid) {
        sounds.playError();
        setStatusMessage({
          text: `ভুল পাসওয়ার্ড! আর ${authCheck.attemptsLeft} বার ভুল দিলে সাময়িকভাবে লক হবে।`,
          type: 'error',
        });
        return;
      }

      securityFirewall.resetFailedLogin(input);
      const customerSession: UserSession = {
        name: matchingUser.name,
        phone: matchingUser.phone,
        sessionId: `CUST-${matchingUser.id}`,
        userId: matchingUser.id,
        role: matchingUser.role === 'owner' ? 'owner' : matchingUser.role === 'seller' ? 'seller' : 'customer',
        avatar: matchingUser.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(matchingUser.name)}`,
        loginAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      };

      // Sync Firebase Authentication with Custom Token for true security isolation
      syncUserFirebaseToken(matchingUser.id, matchingUser.role || 'customer', matchingUser.phone).catch(() => {});

      localStorage.setItem('user_session', JSON.stringify(customerSession));
      sounds.playSuccess();
      setStatusMessage({ text: `স্বাগতম ${matchingUser.name} (${matchingUser.id})!`, type: 'success' });

      setTimeout(() => {
        onLoginSuccess(customerSession);
        if (onClose) onClose();
      }, 600);
      return;
    }

    // No matching user found
    sounds.playError();
    setStatusMessage({
      text: 'কোনো একাউন্ট পাওয়া যায়নি! মোবাইল নম্বর ও পাসওয়ার্ড সঠিক দিন অথবা নতুন রেজিস্ট্রেশন করুন।',
      type: 'error',
    });
  };

  return (
    <div className={`w-full max-w-md mx-auto p-5 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden backdrop-blur-xl animate-fadeIn ${isModal ? 'border-cyan-500/30' : ''}`}>
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Mode Tabs: [লগইন] & [রেজিস্ট্রেশন] */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl mb-5 shadow-inner">
        <button
          type="button"
          onClick={() => {
            setAuthMode('login');
            setStatusMessage(null);
            sounds.playClick();
          }}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            authMode === 'login'
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>লগইন</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setAuthMode('signup');
            setStatusMessage(null);
            sounds.playClick();
          }}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            authMode === 'signup'
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>রেজিস্ট্রেশন</span>
        </button>
      </div>

      {/* Mode Header */}
      <div className="text-center mb-5">
        <h2 className="text-base font-bold text-white">
          {authMode === 'signup' ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'অ্যাকাউন্টে প্রবেশ করুন'}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {authMode === 'signup'
            ? 'মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে রেজিস্ট্রেশন করুন'
            : 'আপনার মোবাইল নম্বর এবং পাসওয়ার্ড দিন'}
        </p>
      </div>

      {/* Status Message Alert */}
      {statusMessage && (
        <div
          className={`mb-4 p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
            statusMessage.type === 'error'
              ? 'bg-rose-950/70 border-rose-500/60 text-rose-300'
              : statusMessage.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
              : 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300'
          }`}
        >
          {statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          )}
          <span className="leading-snug">{statusMessage.text}</span>
        </div>
      )}

      {/* Active Session Info (if logged in) */}
      {currentSession && (
        <div className="mb-4 p-2.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={currentSession.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentSession.name}`}
              alt="Avatar"
              className="w-8 h-8 rounded-full border border-cyan-500/40 object-cover bg-slate-900"
            />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1">
                <span>{currentSession.name}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                  {currentSession.role === 'owner' ? '👑 ওনার' : currentSession.role === 'seller' ? '🛍️ সেলার' : '👤 ইউজার'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">আইডি: {currentSession.userId || currentSession.sessionId}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-2.5 py-1 text-[11px] font-bold bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl transition flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>লগআউট</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM 1: SIGN UP (STRICTLY 2 FIELDS: PHONE & PASSWORD) */}
      {/* ========================================================================= */}
      {authMode === 'signup' && (
        <form onSubmit={handleSignUpSubmit} className="space-y-4">
          {/* 1. Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              <span>মোবাইল নম্বর</span>
            </label>
            <input
              type="tel"
              required
              value={signupPhone}
              onChange={(e) => setSignupPhone(e.target.value)}
              placeholder="মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX)"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition shadow-inner font-mono"
            />
          </div>

          {/* 2. Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <span>পাসওয়ার্ড</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSignupPass(!showSignupPass)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                {showSignupPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showSignupPass ? 'লুকান' : 'দেখুন'}</span>
              </button>
            </label>
            <input
              type={showSignupPass ? 'text' : 'password'}
              required
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              placeholder="পাসওয়ার্ড লিখুন"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition shadow-inner font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-3"
          >
            <UserPlus className="w-4 h-4" />
            <span>রেজিস্ট্রেশন করুন</span>
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* FORM 2: LOGIN (STRICTLY 2 FIELDS: MOBILE NUMBER & PASSWORD) */}
      {/* ========================================================================= */}
      {authMode === 'login' && (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {/* 1. Mobile Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              <span>মোবাইল নম্বর</span>
            </label>
            <input
              type="text"
              required
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              placeholder="মোবাইল নম্বর লিখুন"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition shadow-inner font-mono"
            />
          </div>

          {/* 2. Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <span>পাসওয়ার্ড</span>
              </span>
              <button
                type="button"
                onClick={() => setShowLoginPass(!showLoginPass)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                {showLoginPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showLoginPass ? 'লুকান' : 'দেখুন'}</span>
              </button>
            </label>
            <input
              type={showLoginPass ? 'text' : 'password'}
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="পাসওয়ার্ড লিখুন"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition shadow-inner font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-3"
          >
            <LogIn className="w-4 h-4" />
            <span>লগইন করুন</span>
          </button>
        </form>
      )}

      {/* Dynamic Admin-Configured Notice at Bottom */}
      {loginNoticeMessage && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            {loginNoticeMessage}
          </p>
        </div>
      )}

      {/* Security & Privacy Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl max-w-sm w-full space-y-3 text-slate-300 animate-fadeIn">
            <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> সিকিউরিটি ও ডাটা সুরক্ষা নীতি
            </h3>
            <p className="text-[11px] leading-relaxed text-slate-400">
              আপনার পাসওয়ার্ড এবং তথ্য ক্লাউড ফায়ারস্টোরে নিরাপদভাবে সংরক্ষিত থাকে। কোনো অপ্রয়োজনীয় থার্ড-পার্টি শেয়ারিং নেই।
            </p>
            <button
              type="button"
              onClick={() => setShowPolicyModal(false)}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
