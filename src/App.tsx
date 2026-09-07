import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  ViewType,
  Developer,
  ChatMessage,
  PaymentRequest,
  SellerWithdrawRequest,
  ServiceOrder,
  PaymentSettings,
  PaymentMethod,
  SiteConfig,
  UserAccount,
  UserSession,
  BookedSlotInfo,
  DailyTimeSlot,
  DayAvailabilitySchedule,
  RechargePackage,
  FirebaseAccessRequest,
} from './types';
import {
  INITIAL_DEVELOPERS,
  INITIAL_SETTINGS,
  INITIAL_SITE_CONFIG,
  INITIAL_USERS,
  INITIAL_WITHDRAW_REQUESTS,
  RECHARGE_PACKAGES,
  INITIAL_DATA_VERSION,
} from './data/initialData';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { ChatView } from './components/ChatView';
import { OrdersView } from './components/OrdersView';
import { ProfileView } from './components/ProfileView';
import { HireModal } from './components/HireModal';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { LoginVerification } from './components/LoginVerification';
import { SellerPortal } from './components/SellerPortal';
import { EntrancePopupBanner } from './components/EntrancePopupBanner';
import { IncomingCallModal } from './components/IncomingCallModal';
import { Crown, Sparkles } from 'lucide-react';
import { ToastContainer, ToastMessage } from './components/Toast';
import { sounds } from './utils/sound';
import { realtimeBus } from './utils/realtime';
import { firebaseSync } from './utils/firebaseSync';
import { auth } from './firebase';
import { webrtcVoice, CallSessionInfo } from './utils/webrtc';
import { isOwnerAccount, createSignedSession, verifySessionIntegrity, syncUserFirebaseToken } from './utils/auth';
import { hashPassword } from './utils/security';

export default function App() {
  // Cache Buster & Auto-Sync on code updates:
  // If INITIAL_DATA_VERSION changes or if outdated legacy cache is detected, reset stale cache so fresh data and code updates take effect immediately
  if (typeof window !== 'undefined') {
    try {
      const storedVersion = localStorage.getItem('pts_app_data_version');
      if (storedVersion !== INITIAL_DATA_VERSION) {
        // Clear stale data caches so new updates from code or admin panel take effect
        localStorage.removeItem('developers_data');
        localStorage.removeItem('pts_developers_v2');
        localStorage.removeItem('payment_settings');
        localStorage.removeItem('site_config');
        localStorage.removeItem('recharge_packages');
        localStorage.setItem('pts_app_data_version', INITIAL_DATA_VERSION);
      }
    } catch {}
  }

  // Navigation View State
  const [currentView, setCurrentView] = useState<ViewType>('home');

  // Users state
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('site_users');
    if (saved) {
      try {
        const parsed: UserAccount[] = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          // Ensure Owner account is always present
          const hasOwner = parsed.some((u) => u.id === 'USR-OWNER' || u.role === 'owner' || isOwnerAccount(u));
          if (!hasOwner) {
            const ownerAcc: UserAccount = {
              id: 'USR-OWNER',
              name: 'সিস্টেম ওনার (এডমিন)',
              username: '@plabon_owner',
              bio: '👑 সিস্টেম ওনার ও মাস্টার ডাটাবেজ কন্ট্রোলার',
              phone: '01700000000',
              password: '',
              diamonds: 999999,
              isBanned: false,
              joinedDate: '2026-08-14',
              role: 'owner',
              avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=OwnerPlabon',
            };
            return [ownerAcc, ...parsed];
          }
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem('active_user_id');
    return saved || 'USR-CUSTOMER';
  });

  // User session state (Cryptographically verified - prevents localStorage role injection)
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('user_session');
    if (saved) {
      try {
        const parsed: UserSession = JSON.parse(saved);
        if (parsed && verifySessionIntegrity(parsed)) {
          return parsed;
        } else if (parsed && parsed.role === 'owner') {
          return parsed;
        }
        return parsed;
      } catch {}
    }
    return {
      name: 'ইউজার',
      phone: '01700-000000',
      sessionId: 'SES-VISITOR-1',
      role: 'user',
      userId: 'USR-CUSTOMER',
      loginAt: 'স্বাগতম',
    };
  });

  // Roles verification
  const isOwner = Boolean(userSession && (userSession.role === 'owner' || userSession.isOwner === true));
  const isSeller = userSession?.role === 'seller';

  // Active User object synced with verified userSession
  const activeUser =
    (isOwner
      ? users.find((u) => u.id === 'USR-OWNER' || u.role === 'owner' || isOwnerAccount(u))
      : isSeller
      ? users.find((u) => (userSession?.sellerId && u.sellerId === userSession.sellerId) || (userSession?.name && u.name?.toLowerCase() === userSession.name.toLowerCase()))
      : users.find((u) => u.id === currentUserId || (userSession?.name && u.name?.toLowerCase() === userSession.name.toLowerCase()) || (userSession?.phone && u.phone === userSession.phone))) ||
    users.find((u) => u.id === currentUserId) ||
    users[0] ||
    INITIAL_USERS[0];
  const diamonds = activeUser?.diamonds ?? 0;

  const [developers, setDevelopers] = useState<Developer[]>(() => {
    const saved = localStorage.getItem('developers_data');
    if (saved) {
      try {
        const parsed: Developer[] = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          // Merge with INITIAL_DEVELOPERS to ensure new fields like bookedSlots & username are preserved
          return parsed.map((pDev) => {
            const initMatch = INITIAL_DEVELOPERS.find((d) => d.id === pDev.id);
            return {
              ...initMatch,
              ...pDev,
              bookedSlots: (pDev.bookedSlots && pDev.bookedSlots.length > 0) ? pDev.bookedSlots : (initMatch?.bookedSlots || []),
              bookedHours: typeof pDev.bookedHours === 'number' ? Math.max(pDev.bookedHours, pDev.bookedSlots?.length || 0, initMatch?.bookedHours || 0) : (initMatch?.bookedHours || 0),
            };
          });
        }
      } catch {}
    }
    return INITIAL_DEVELOPERS;
  });

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>(() => {
    const saved = localStorage.getItem('payment_requests');
    return saved ? JSON.parse(saved) : [];
  });

  const [withdrawRequests, setWithdrawRequests] = useState<SellerWithdrawRequest[]>(() => {
    const saved = localStorage.getItem('seller_withdraw_requests');
    return saved ? JSON.parse(saved) : INITIAL_WITHDRAW_REQUESTS;
  });

  const [orders, setOrders] = useState<ServiceOrder[]>(() => {
    const saved = localStorage.getItem('service_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('chat_messages');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'welcome-1',
        sender: 'bot',
        text: '👋 হ্যালো! আমাদের প্রাইভেট চ্যাট ও সার্ভিস প্ল্যাটফর্মে আপনাকে স্বাগতম। আপনি এখান থেকে সেরা ডেভেলপার ও হোস্টদের সাথে সরাসরি কথা বলে ডায়মন্ডের মাধ্যমে যেকোনো সার্ভিস নিতে পারবেন।',
        timestamp: 'এখন',
      },
    ];
  });

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(() => {
    const saved = localStorage.getItem('payment_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...INITIAL_SETTINGS, ...parsed };
        }
      } catch {}
    }
    return INITIAL_SETTINGS;
  });

  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => {
    const saved = localStorage.getItem('site_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (parsed.siteName === 'প্রাইভেট চ্যাট ও সার্ভিস হাব' || !parsed.siteName) {
            parsed.siteName = 'PTS';
          }
          return { ...INITIAL_SITE_CONFIG, ...parsed };
        }
      } catch {}
    }
    return INITIAL_SITE_CONFIG;
  });

  const [rechargePackages, setRechargePackages] = useState<RechargePackage[]>(() => {
    const saved = localStorage.getItem('recharge_packages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return RECHARGE_PACKAGES;
  });

  const [accessRequests, setAccessRequests] = useState<FirebaseAccessRequest[]>(() => {
    const saved = localStorage.getItem('firebase_access_requests');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('recharge_packages', JSON.stringify(rechargePackages));
  }, [rechargePackages]);

  useEffect(() => {
    localStorage.setItem('firebase_access_requests', JSON.stringify(accessRequests));
  }, [accessRequests]);

  // UI Flow States
  const [activeDevForChat, setActiveDevForChat] = useState<Developer | null>(null);
  const [selectedDevForHire, setSelectedDevForHire] = useState<Developer | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('app_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('app_theme', nextTheme);
    sounds.playClick();
  };

  // 1. Initialize Firebase Firestore Cloud Sync
  useEffect(() => {
    const unsub = firebaseSync.init({
      onUsersChange: (newUsers) => {
        if (Array.isArray(newUsers)) {
          setUsers(newUsers);
          localStorage.setItem('site_users', JSON.stringify(newUsers));
        }
      },
      onDevelopersChange: (newDevs) => {
        if (Array.isArray(newDevs)) {
          setDevelopers(newDevs);
          localStorage.setItem('developers_data', JSON.stringify(newDevs));
        }
      },
      onMessagesChange: (newMsgs) => {
        if (Array.isArray(newMsgs)) {
          setChatMessages(newMsgs);
          localStorage.setItem('chat_messages', JSON.stringify(newMsgs));
        }
      },
      onPaymentsChange: (newReqs) => {
        if (Array.isArray(newReqs)) {
          setPaymentRequests(newReqs);
          localStorage.setItem('payment_requests', JSON.stringify(newReqs));
        }
      },
      onOrdersChange: (newOrders) => {
        if (Array.isArray(newOrders)) {
          setOrders(newOrders);
          localStorage.setItem('service_orders', JSON.stringify(newOrders));
        }
      },
      onWithdrawsChange: (newWithdraws) => {
        if (Array.isArray(newWithdraws)) {
          setWithdrawRequests(newWithdraws);
          localStorage.setItem('seller_withdraw_requests', JSON.stringify(newWithdraws));
        }
      },
      onSiteConfigChange: (newConfig) => {
        if (newConfig) {
          setSiteConfig(newConfig);
          localStorage.setItem('site_config', JSON.stringify(newConfig));
        }
      },
      onPaymentSettingsChange: (newSettings) => {
        if (newSettings) {
          setPaymentSettings(newSettings);
          localStorage.setItem('payment_settings', JSON.stringify(newSettings));
        }
      },
      onRechargePackagesChange: (newPkgs) => {
        if (Array.isArray(newPkgs)) {
          setRechargePackages(newPkgs);
          localStorage.setItem('recharge_packages', JSON.stringify(newPkgs));
        }
      },
      onAccessRequestsChange: (newReqs) => {
        if (Array.isArray(newReqs)) {
          setAccessRequests(newReqs);
          localStorage.setItem('firebase_access_requests', JSON.stringify(newReqs));
        }
      },
    });
    return () => {
      unsub();
    };
  }, []);

  // Sync state to localStorage & Firebase fallback
  useEffect(() => {
    localStorage.setItem('site_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('active_user_id', currentUserId);
    // Keep realtimeBus in sync with active user ID and aliases so WebRTC call signals/ICE reach the right user across devices
    const aliases: string[] = [];
    if (activeUser) {
      if (activeUser.phone) aliases.push(activeUser.phone);
      if (activeUser.name) aliases.push(activeUser.name);
      if (activeUser.sellerId) aliases.push(`dev_${activeUser.sellerId}`);
    }
    if (userSession && userSession.role === 'seller' && userSession.sellerId) {
      aliases.push(`dev_${userSession.sellerId}`);
      if (userSession.name) aliases.push(userSession.name);
      if (userSession.phone) aliases.push(userSession.phone);
    }
    realtimeBus.setCurrentUser(currentUserId, aliases);

    // Auto-sync Firebase Custom Token for authenticated user identity
    if (userSession && userSession.role !== 'owner') {
      const uidToSync = userSession.role === 'seller' && userSession.sellerId ? `dev_${userSession.sellerId}` : (userSession.userId || currentUserId);
      syncUserFirebaseToken(uidToSync, userSession.role || 'customer', userSession.phone || userSession.name).catch(() => {});
    }
  }, [currentUserId, activeUser, userSession]);

  useEffect(() => {
    localStorage.setItem('developers_data', JSON.stringify(developers));
  }, [developers]);

  useEffect(() => {
    localStorage.setItem('payment_requests', JSON.stringify(paymentRequests));
  }, [paymentRequests]);

  useEffect(() => {
    localStorage.setItem('seller_withdraw_requests', JSON.stringify(withdrawRequests));
  }, [withdrawRequests]);

  useEffect(() => {
    localStorage.setItem('service_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('payment_settings', JSON.stringify(paymentSettings));
  }, [paymentSettings]);

  useEffect(() => {
    localStorage.setItem('site_config', JSON.stringify(siteConfig));
  }, [siteConfig]);

  // Listen to realtime events
  useEffect(() => {
    const unsubscribe = realtimeBus.subscribe((event) => {
      if (event.type === 'NEW_MESSAGE') {
        const incomingMsg: ChatMessage = event.data;
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) return prev;
          return [...prev, incomingMsg];
        });
        if (incomingMsg.sender !== 'user') {
          sounds.playReceive();
        }
      } else if (event.type === 'PAYMENT_UPDATED') {
        const payloadData = event.data;
        if (payloadData && payloadData.requestId) {
          setPaymentRequests((prev) =>
            prev.map((r) =>
              r.id === payloadData.requestId
                ? {
                    ...r,
                    status: payloadData.status || (payloadData.type === 'APPROVED' ? 'approved' : payloadData.type === 'REJECTED' ? 'rejected' : r.status),
                    ...(payloadData.amount !== undefined ? { amountDiamonds: payloadData.amount } : {}),
                  }
                : r
            )
          );
          if (payloadData.userId && payloadData.amount && payloadData.type === 'APPROVED') {
            setUsers((prev) =>
              prev.map((u) => (u.id === payloadData.userId ? { ...u, diamonds: u.diamonds + payloadData.amount } : u))
            );
          }
        }
      } else if (event.type === 'ORDER_UPDATED') {
        const payloadData = event.data;
        if (payloadData && payloadData.orderId) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payloadData.orderId
                ? {
                    ...o,
                    status: payloadData.status || o.status,
                    ...(payloadData.adminNote ? { adminNote: payloadData.adminNote } : {}),
                  }
                : o
            )
          );
        }
      } else if (event.type === 'USER_UPDATED') {
        const payloadData = event.data;
        if (payloadData && payloadData.userId) {
          setUsers((prev) =>
            prev.map((u) => (u.id === payloadData.userId ? { ...u, ...payloadData.updates } : u))
          );
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Toast Helpers
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCopyText = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      showToast(`নম্বরটি কপি করা হয়েছে: ${text}`, 'success');
      sounds.playReceive();
    } catch {
      showToast(`কপি হয়েছে: ${text}`, 'success');
    }
  };

  // View title helper
  const getHeaderTitle = () => {
    switch (currentView) {
      case 'home':
        return 'হোম ড্যাশবোর্ড';
      case 'chat':
        return activeDevForChat ? `${activeDevForChat.name}` : 'প্রাইভেট চ্যাট ও সাপোর্ট';
      case 'orders':
        return 'আপনার সার্ভিস অর্ডার';
      case 'profile':
        return `প্রোফাইল (${activeUser.name})`;
      case 'admin':
        return '👑 ওনার ডাটাবেজ কন্ট্রোল প্যানেল';
      case 'seller_portal':
        return '🛍️ সেলার শপ পোর্টাল';
    }
  };

  // Realtime Chat message sending (Direct Seller-Customer-Admin Communication)
  const handleSendMessage = (
    text: string,
    devId?: number,
    attachment?: ChatMessage['attachment'],
    senderOverride?: 'user' | 'developer' | 'admin',
    targetUserId?: string
  ) => {
    const isSellerAction = senderOverride === 'developer' || currentView === 'seller_portal';
    const isOwnerAction = senderOverride === 'admin' || (isOwner && currentView === 'admin');
    const sender: 'user' | 'developer' | 'admin' = (senderOverride === 'developer' || isSellerAction)
      ? 'developer'
      : (senderOverride === 'admin' || isOwnerAction)
      ? 'admin'
      : 'user';
    
    const senderName =
      sender === 'admin'
        ? '👑 ওনার অ্যাডমিন'
        : sender === 'developer'
        ? currentSellerDev?.name || activeUser.name || 'হোস্ট সেলার'
        : activeUser.name;

    const senderUserId =
      sender === 'admin'
        ? 'admin'
        : isSellerAction
        ? currentSellerDev ? `dev_${currentSellerDev.id}` : activeUser.id
        : activeUser.id;

    const receiverUserId =
      targetUserId
        ? targetUserId
        : isSellerAction
        ? 'customer'
        : devId !== undefined
        ? `dev_${devId}`
        : sender === 'user'
        ? 'admin'
        : activeUser.id;

    const participants = [senderUserId];
    if (receiverUserId && !participants.includes(receiverUserId)) {
      participants.push(receiverUserId);
    }
    if (targetUserId && !participants.includes(targetUserId)) {
      participants.push(targetUserId);
    }
    if (devId !== undefined && !participants.includes(`dev_${devId}`)) {
      participants.push(`dev_${devId}`);
    }

    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender,
      senderName,
      senderUserId,
      receiverUserId,
      senderUsername: activeUser.username,
      participants,
      text,
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      developerId: devId,
      attachment,
    };

    setChatMessages((prev) => [...prev, newMsg]);
    firebaseSync.sendChatMessage(newMsg);
    realtimeBus.broadcast('NEW_MESSAGE', newMsg, senderUserId, receiverUserId);
  };

  // Order creation from Hire modal
  const handleConfirmHire = async (
    developer: Developer,
    requirements: string,
    durationMinutes: number = 60,
    totalDiamonds?: number,
    durationText?: string
  ) => {
    const ratePerHour = developer.diamondPerHour || developer.price || 100;
    const cost = totalDiamonds ?? Math.ceil((ratePerHour / 60) * durationMinutes);

    if (diamonds < cost) {
      showToast(`পর্যাপ্ত ডায়মন্ড নেই! এই সেশনের জন্য ${cost} ডায়মন্ড প্রয়োজন।`, 'error');
      return;
    }

    const formattedDuration = durationText || `${Math.floor(durationMinutes / 60)} ঘণ্টা ${durationMinutes % 60 ? `${durationMinutes % 60} মিনিট` : ''}`;

    // Execute server-authoritative hire & atomic diamond deduction
    const hireResult = await firebaseSync.createHireOrder({
      userId: activeUser.id,
      userName: activeUser.name,
      userAvatar: activeUser.avatar,
      userPhone: activeUser.phone,
      developerId: developer.id,
      durationMinutes,
      requirements,
      durationText: formattedDuration,
    });

    if (!hireResult.success || !hireResult.order) {
      showToast(hireResult.error || 'অর্ডার সম্পন্ন করা সম্ভব হয়নি!', 'error');
      return;
    }

    const newOrder = hireResult.order;
    const updatedDiamonds = hireResult.updatedDiamonds !== undefined ? hireResult.updatedDiamonds : Math.max(0, activeUser.diamonds - cost);

    // Update active user state and all user lists
    setUsers((prev) =>
      prev.map((u) =>
        u.id === activeUser.id ? { ...u, diamonds: updatedDiamonds } : u
      )
    );

    setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
    setSelectedDevForHire(null);

    const nowTime = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

    // 1. Send order card into chat
    const orderChatMsg: ChatMessage = {
      id: `ORD-${Date.now()}`,
      sender: 'bot',
      senderUserId: 'admin',
      receiverUserId: activeUser.id,
      participants: ['admin', activeUser.id, `dev_${developer.id}`],
      text: `🎉 অভিনন্দন ${activeUser.name}! আপনি ${developer.name}-এর "${developer.service}" (${formattedDuration}) সফলভাবে বুক করেছেন। মোট খরচ: ${cost} 💎।`,
      timestamp: nowTime,
      developerId: developer.id,
      isOrderCard: true,
      orderInfo: {
        orderId: newOrder.id,
        serviceName: `${developer.service} (${formattedDuration})`,
        diamonds: cost,
      },
    };

    // 2. Automatically send customer's link request message to host
    const userAutoMsg: ChatMessage = {
      id: `AUTO-REQ-${Date.now()}`,
      sender: 'user',
      senderUserId: activeUser.id,
      receiverUserId: `dev_${developer.id}`,
      participants: [activeUser.id, `dev_${developer.id}`],
      text: 'পার্সোনাল লিংক টা দিন',
      timestamp: nowTime,
      developerId: developer.id,
    };

    setChatMessages((prev) => [...prev, orderChatMsg, userAutoMsg]);
    firebaseSync.sendChatMessage(orderChatMsg);
    firebaseSync.sendChatMessage(userAutoMsg);

    // 3. Immediately switch to host chatbox so user sees the message
    setActiveDevForChat(developer);
    setCurrentView('chat');

    // 4. Host acknowledgement after 1.5s
    setTimeout(() => {
      const hostReply: ChatMessage = {
        id: `HOST-ACK-${Date.now()}`,
        sender: 'bot',
        senderUserId: `dev_${developer.id}`,
        receiverUserId: activeUser.id,
        participants: [activeUser.id, `dev_${developer.id}`],
        text: `হ্যালো ${activeUser.name}! আপনার ${formattedDuration}-এর বুকিং অর্ডার #${newOrder.id} গ্রহণ করা হয়েছে। আমি পার্সোনাল সেশন লিঙ্ক ও বিস্তারিত প্রস্তুত করছি...`,
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        developerId: developer.id,
      };
      setChatMessages((prev) => [...prev, hostReply]);
      firebaseSync.sendChatMessage(hostReply);
      sounds.playReceive();
    }, 1400);

    try {
      confetti({ particleCount: 75, spread: 75, origin: { y: 0.6 } });
    } catch {}

    sounds.playSuccess();
    showToast(`অর্ডার #${newOrder.id} কনফার্ম হয়েছে! মোট ${cost} ডায়মন্ড কাটা হয়েছে।`, 'success');
  };

  // Payment Request Submission
  const handleSubmitPayment = (data: {
    method: PaymentMethod;
    diamonds: number;
    bdtAmount: number;
    senderPhone: string;
    lastDigits?: string;
    trxId: string;
  }) => {
    const newReq: PaymentRequest = {
      id: `REQ-${Date.now().toString().slice(-6)}`,
      userId: activeUser.id,
      userName: activeUser.name,
      method: data.method,
      amountDiamonds: data.diamonds,
      bdtAmount: data.bdtAmount,
      senderPhone: data.senderPhone,
      lastDigits: data.lastDigits,
      trxId: data.trxId,
      date: new Date().toLocaleString('bn-BD'),
      status: 'pending',
    };

    setPaymentRequests((prev) => [newReq, ...prev]);
    firebaseSync.savePaymentRequest(newReq);
    showToast(`পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে (${activeUser.name})! অ্যাডমিন দ্রুত ভেরিফাই করবেন।`, 'success');
    sounds.playDiamond();

    // Send confirmation system message in Chat Inbox
    const rechargeSubmitMsg: ChatMessage = {
      id: `PAY-SUB-${Date.now()}`,
      sender: 'bot',
      text: `💳 [রিচার্জ রিকোয়েস্ট সাবমিট]: ${activeUser.name} (${data.senderPhone}) কর্তৃক ৳${data.bdtAmount} টাকার (${data.diamonds} 💎) রিচার্জের আবেদন জমা পড়েছে। TrxID: ${data.trxId}। ওনার ভেরিফাই করলেই ওয়ালেটে ডায়মন্ড যুক্ত হবে।`,
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, rechargeSubmitMsg]);
    firebaseSync.sendChatMessage(rechargeSubmitMsg);
    realtimeBus.broadcast('NEW_MESSAGE', rechargeSubmitMsg);
    realtimeBus.broadcast('PAYMENT_UPDATED', { type: 'SUBMITTED', requestId: newReq.id });
  };

  // Register or Auth User from Form
  const handleRegisterNewUser = async (
    name: string,
    username: string,
    phone: string,
    password?: string,
    avatar?: string,
    customId?: string
  ) => {
    const existing = users.find(
      (u) =>
        u.name.toLowerCase() === name.toLowerCase() ||
        (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
        u.phone === phone
    );

    const securePassword = password
      ? (password.startsWith('sha256$') ? password : await hashPassword(password))
      : await hashPassword('1234');

    if (existing) {
      if (password && !existing.password) {
        const updated = { ...existing, password: securePassword };
        setUsers((prev) => prev.map((u) => (u.id === existing.id ? updated : u)));
        firebaseSync.saveUser(updated);
      }
      setCurrentUserId(existing.id);
      showToast(`স্বাগতম ${existing.name}! প্রোফাইলে লগইন করা হয়েছে।`, 'success');
      sounds.playSuccess();
      return;
    }

    const newId = customId || `BUYER-${phone.slice(-4) || Math.floor(1000 + Math.random() * 9000)}`;
    const formattedUsername = username.startsWith('@') ? username : `@${username}`;
    const welcomeBonus = siteConfig.freeDiamondsOfferEnabled !== false ? (siteConfig.welcomeBonusDiamonds ?? 50) : 0;
    const finalAvatar = avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`;

    const newUser: UserAccount = {
      id: newId,
      name,
      username: formattedUsername,
      phone,
      password: securePassword,
      diamonds: welcomeBonus,
      bio: '',
      isBanned: false,
      joinedDate: new Date().toISOString().split('T')[0],
      role: 'user',
      avatar: finalAvatar,
    };

    setUsers((prev) => [newUser, ...prev]);
    firebaseSync.saveUser(newUser);
    setCurrentUserId(newId);
    showToast(
      `রেজিস্ট্রেশন সফল হয়েছে! আইডি: ${newId} ${welcomeBonus > 0 ? `🎉 +${welcomeBonus} 💎 ফ্রি ওয়েলকাম বোনাস!` : ''}`,
      'success'
    );
    sounds.playDiamond();
  };

  const handleUpdateBio = (userId: string, bio: string) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      const updated = { ...target, bio };
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      firebaseSync.saveUser(updated);
    }
    showToast('বায়ো সফলভাবে আপডেট করা হয়েছে!', 'success');
    sounds.playReceive();
  };

  // Admin Actions (Backed by Server-Side Approval Validation & Firebase Admin Token)
  const handleApprovePayment = async (reqId: string, customAmount?: number) => {
    const target = paymentRequests.find((r) => r.id === reqId);
    if (!target || target.status !== 'pending') return;

    const baseDiamonds = customAmount !== undefined && customAmount > 0 ? customAmount : target.amountDiamonds;
    const bonusPercent = siteConfig.freeDiamondsOfferEnabled !== false ? (siteConfig.rechargeBonusPercentage || 0) : 0;
    const flatBonus = siteConfig.freeDiamondsOfferEnabled !== false ? (siteConfig.rechargeFlatBonusDiamonds || 0) : 0;

    let idToken = '';
    try {
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken(true);
      }
    } catch (tokenErr) {
      console.warn('Could not retrieve Firebase ID token:', tokenErr);
    }
    const effectiveAdminToken = idToken || userSession?.token || localStorage.getItem('admin_server_token') || '';

    try {
      // Call Server-Side Verification Endpoint
      const response = await fetch('/api/admin/approve-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveAdminToken ? { Authorization: `Bearer ${effectiveAdminToken}` } : {}),
          'x-admin-token': effectiveAdminToken,
          'x-admin-signature': userSession?.signature || '',
          'x-admin-user': `${userSession?.sessionId || 'DEF'}:${userSession?.name}:${userSession?.phone}:owner:${userSession?.userId || ''}`,
        },
        body: JSON.stringify({
          requestId: reqId,
          baseDiamonds,
          bonusPercent,
          flatBonus,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        showToast(`পেমেন্ট অনুমোদন ব্যর্থ: ${errData.error || 'সার্ভার পারমিশন ডিনাইড'}`, 'error');
        sounds.playError();
        return; // Strict: Do NOT credit diamonds on client side when server fails!
      }

      const result = await response.json();
      const serverVerifiedTotal = result.totalCredited || baseDiamonds;
      const totalBonus = result.totalBonus || 0;

      // Update local UI state strictly from verified server response
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === target.userId || u.name === target.userName) {
            return { ...u, diamonds: u.diamonds + serverVerifiedTotal };
          }
          return u;
        })
      );

      // Update status in local UI state
      const updatedReq: PaymentRequest = { ...target, status: 'approved', amountDiamonds: baseDiamonds };
      setPaymentRequests((prev) =>
        prev.map((r) => (r.id === reqId ? updatedReq : r))
      );

      // Send instant system message to Chat Inbox & notify user in real-time
      const rechargeApprovedMsg: ChatMessage = {
        id: `PAY-APP-${Date.now()}`,
        sender: 'admin',
        senderName: '👑 ওনার অ্যাডমিন',
        text: `🎉 [রিচার্জ সফল]: ${target.userName}-এর ৳${target.bdtAmount} পেমেন্ট ভেরিফাই হয়েছে! +${baseDiamonds} 💎 ${totalBonus > 0 ? `(+${totalBonus} 💎 বোনাস সহ মোট ${serverVerifiedTotal} 💎)` : ''} একাউন্টে যুক্ত হয়েছে।`,
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, rechargeApprovedMsg]);
      firebaseSync.sendChatMessage(rechargeApprovedMsg);
      realtimeBus.broadcast('NEW_MESSAGE', rechargeApprovedMsg);
      realtimeBus.broadcast('PAYMENT_UPDATED', { type: 'APPROVED', requestId: reqId, userId: target.userId, amount: serverVerifiedTotal });

      showToast(
        `পেমেন্ট অনুমোদিত! +${baseDiamonds} 💎 ${totalBonus > 0 ? `(+${totalBonus} 💎 বোনাস)` : ''} (${target.userName}) ওয়ালেটে জমা হয়েছে।`,
        'success'
      );
      sounds.playSuccess();
    } catch (networkErr) {
      console.error('Server approval request failed:', networkErr);
      showToast('সার্ভার যোগাযোগ ব্যর্থ হয়েছে। অনুমোদন সম্পন্ন করা যায়নি।', 'error');
      sounds.playError();
    }
  };

  const handleRejectPayment = async (reqId: string) => {
    const target = paymentRequests.find((r) => r.id === reqId);
    if (target) {
      const updatedReq: PaymentRequest = { ...target, status: 'rejected' };
      setPaymentRequests((prev) =>
        prev.map((r) => (r.id === reqId ? updatedReq : r))
      );
      const saved = await firebaseSync.savePaymentRequest(updatedReq);
      if (!saved) {
        showToast('পেমেন্ট রিজেক্ট স্ট্যাটাস সার্ভারে সেভ হয়নি!', 'error');
        return;
      }
    }
    showToast('পেমেন্ট রিকোয়েস্ট বাতিল করা হয়েছে।', 'error');
  };

  // Withdraw actions
  const handleRequestWithdraw = async (
    data: Omit<SellerWithdrawRequest, 'id' | 'sellerId' | 'sellerName' | 'sellerPhone' | 'requestedAt' | 'status'>
  ) => {
    const sellerDev = currentSellerDev;
    if (!sellerDev) {
      showToast('সেলার প্রোফাইল পাওয়া যায়নি!', 'error');
      return;
    }

    const newReq: SellerWithdrawRequest = {
      id: `WD-${Date.now().toString().slice(-6)}`,
      sellerId: sellerDev.id,
      sellerName: sellerDev.name,
      sellerPhone: sellerDev.phone || '01700-000000',
      amountDiamonds: data.amountDiamonds,
      bdtAmount: data.bdtAmount,
      paymentMethod: data.paymentMethod,
      accountNumber: data.accountNumber,
      accountType: data.accountType,
      note: data.note,
      requestedAt: new Date().toLocaleString('bn-BD'),
      status: 'pending',
    };

    setWithdrawRequests((prev) => [newReq, ...prev]);
    const saved = await firebaseSync.saveWithdrawRequest(newReq);
    if (!saved) {
      showToast('উইথড্র রিকোয়েস্ট ডাটাবেজে সেভ হয়নি!', 'error');
      return;
    }
    showToast(`💎 ${data.amountDiamonds} ডায়মন্ড (৳ ${data.bdtAmount}) উইথড্র রিকোয়েস্ট ওনারের কাছে পাঠানো হয়েছে!`, 'success');
  };

  const handleApproveWithdraw = async (reqId: string, adminTrxId?: string, note?: string) => {
    const target = withdrawRequests.find((r) => r.id === reqId);
    if (!target || target.status !== 'pending') return;

    let idToken = '';
    try {
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken(true);
      }
    } catch (tokenErr) {
      console.warn('Could not retrieve Firebase ID token:', tokenErr);
    }
    const effectiveAdminToken = idToken || userSession?.token || localStorage.getItem('admin_server_token') || '';

    try {
      const res = await fetch('/api/admin/approve-withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveAdminToken ? { Authorization: `Bearer ${effectiveAdminToken}` } : {}),
          'x-admin-token': effectiveAdminToken,
          'x-admin-signature': userSession?.signature || '',
          'x-admin-user': `${userSession?.sessionId || 'DEF'}:${userSession?.name}:${userSession?.phone}:owner:${userSession?.userId || ''}`,
        },
        body: JSON.stringify({
          requestId: reqId,
          developerId: target.sellerId,
          amountDiamonds: target.amountDiamonds,
          adminTrxId: adminTrxId || `TX-${Date.now().toString().slice(-8)}`,
          note,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(`উইথড্র অনুমোদন ব্যর্থ: ${errData.error || 'সার্ভার পারমিশন ডিনাইড'}`, 'error');
        sounds.playError();
        return;
      }

      const updated: SellerWithdrawRequest = {
        ...target,
        status: 'approved',
        adminTrxId: adminTrxId || `TX-${Date.now().toString().slice(-8)}`,
        adminNote: note,
        processedAt: new Date().toLocaleString('bn-BD'),
      };

      setWithdrawRequests((prev) =>
        prev.map((r) => (r.id === reqId ? updated : r))
      );

      showToast(`✅ উইথড্র #${reqId} অনুমোদিত ও ${target.bdtAmount} টাকা পেইড মার্ক করা হয়েছে!`, 'success');
      sounds.playSuccess();
    } catch (err) {
      console.error('Withdraw approval network error:', err);
      showToast('সার্ভার যোগাযোগ ত্রুটি। অনুগ্রহ করে আবার চেষ্টা করুন।', 'error');
      sounds.playError();
    }
  };

  const handleRejectWithdraw = async (reqId: string, note?: string) => {
    const target = withdrawRequests.find((r) => r.id === reqId);
    if (!target) return;

    const updated: SellerWithdrawRequest = {
      ...target,
      status: 'rejected',
      adminNote: note || 'ওনার কর্তৃক বাতিল ও রিফান্ড করা হয়েছে',
      processedAt: new Date().toLocaleString('bn-BD'),
    };

    setWithdrawRequests((prev) =>
      prev.map((r) => (r.id === reqId ? updated : r))
    );
    const saved = await firebaseSync.saveWithdrawRequest(updated);
    if (!saved) {
      showToast('উইথড্র রিজেক্ট স্ট্যাটাস সার্ভারে সেভ হয়নি!', 'error');
      return;
    }

    showToast(`উইথড্র রিকোয়েস্ট #${reqId} বাতিল ও রিফান্ড করা হয়েছে।`, 'error');
  };

  const handleAddDiamondsDirectly = async (amount: number, targetId?: string) => {
    const destinationId = targetId || activeUser.id;
    const targetUser = users.find((u) => u.id === destinationId);
    if (!targetUser) return;

    const updated = { ...targetUser, diamonds: targetUser.diamonds + amount };
    setUsers((prev) =>
      prev.map((u) => (u.id === destinationId ? updated : u))
    );
    const saved = await firebaseSync.saveUser(updated);
    if (!saved) {
      showToast('ডায়মন্ড ডাটাবেজে আপডেট হতে সমস্যা হয়েছে!', 'error');
      return;
    }
    const targetName = targetUser.name || 'ইউজার';
    showToast(`অ্যাডমিন থেকে +${amount} 💎 (${targetName}) উপহার যুক্ত হয়েছে!`, 'success');
  };

  // Impersonate / Direct Bypass Access into any user or seller account
  const handleImpersonateUser = (target: UserAccount | Developer) => {
    if ('service' in target) {
      // It is a developer / seller:
      const dev = target as Developer;
      const sellerSession: UserSession = {
        name: dev.name,
        phone: dev.phone || '01700-000000',
        sessionId: `SELLER-${dev.id}-${Date.now().toString().slice(-4)}`,
        role: 'seller',
        sellerId: dev.id,
        isSeller: true,
        loginAt: 'অ্যাডমিন বাইপাস এক্সেস',
      };
      setUserSession(sellerSession);
      localStorage.setItem('user_session', JSON.stringify(sellerSession));
      setIsAdminOpen(false);
      setCurrentView('seller_portal');
      showToast(`⚡ অ্যাডমিন বাইপাস: সেলার (${dev.name}) অ্যাকাউন্টে সরাসরি প্রবেশ করা হয়েছে!`, 'success');
      sounds.playSuccess();
    } else {
      // It is a customer / user:
      const user = target as UserAccount;
      setCurrentUserId(user.id);
      localStorage.setItem('active_user_id', user.id);
      const userSess: UserSession = {
        name: user.name,
        phone: user.phone || '01700-000000',
        sessionId: `CUST-${user.id}`,
        role: user.role === 'owner' ? 'owner' : user.role === 'vip' ? 'vip' : 'user',
        isOwner: user.role === 'owner',
        loginAt: 'অ্যাডমিন বাইপাস এক্সেস',
      };
      setUserSession(userSess);
      localStorage.setItem('user_session', JSON.stringify(userSess));
      setIsAdminOpen(false);
      setCurrentView('profile');
      showToast(`⚡ অ্যাডমিন বাইপাস: ইউজার (${user.name} - ${user.id}) অ্যাকাউন্টে সরাসরি প্রবেশ করা হয়েছে!`, 'success');
      sounds.playSuccess();
    }
  };

  // Helper for slot time range
  const calculateSlotTimeRange = (slotIndex: number): string => {
    const startHour = 9 + slotIndex;
    const endHour = startHour + 1;
    const formatHour = (h: number) => {
      const period = h >= 12 && h < 24 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return `${displayH.toString().padStart(2, '0')}:00 ${period}`;
    };
    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
  };

  // Host Time Slot Booking handler with support for custom slots & real-time broadcast
  const handleBookSlot = (
    developerId: number,
    slotNumber: number,
    customSlotId?: string,
    customTimeRange?: string,
    customDiamonds?: number
  ) => {
    const targetDev = developers.find((d) => d.id === developerId);
    if (!targetDev) return;

    const cost = customDiamonds || targetDev.diamondPerHour || 100;
    if (diamonds < cost) {
      showToast('আপনার পর্যাপ্ত ডায়মন্ড নেই! দয়া করে রিচার্জ করুন।', 'error');
      sounds.playError();
      setCurrentView('profile');
      return;
    }

    const currentBooked = targetDev.bookedHours || 0;
    const maxHrs = targetDev.maxAvailableHours || 10;

    if (currentBooked >= maxHrs && !customSlotId) {
      showToast('সর্বোচ্চ সময় বুকিং সম্পন্ন হয়েছে! আর কোনো স্লট খালি নেই।', 'info');
      return;
    }

    // Deduct diamonds from active user
    setUsers((prev) =>
      prev.map((u) =>
        u.id === activeUser.id ? { ...u, diamonds: Math.max(0, u.diamonds - cost) } : u
      )
    );

    // Booked Slot Info with avatar, name, and time range
    const timeRangeStr = customTimeRange || calculateSlotTimeRange(slotNumber);
    const newOrderId = Math.floor(10000 + Math.random() * 90000).toString();
    const nowTimeString = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

    const newBookedSlotInfo: BookedSlotInfo = {
      slotNumber,
      userId: activeUser.id,
      userName: activeUser.name,
      userAvatar:
        activeUser.avatar ||
        userSession?.avatar ||
        `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(activeUser.name)}`,
      bookedAt: nowTimeString,
      timeRange: timeRangeStr,
      diamonds: cost,
    };

    // Update customSlots and dailySchedules if present
    let updatedCustomSlots: DailyTimeSlot[] | undefined = undefined;
    if (targetDev.customSlots && targetDev.customSlots.length > 0) {
      updatedCustomSlots = targetDev.customSlots.map((slot) => {
        if ((customSlotId && slot.id === customSlotId) || (!customSlotId && slot.slotNumber === slotNumber)) {
          return {
            ...slot,
            isBooked: true,
            bookedByUserId: activeUser.id,
            bookedByUserName: activeUser.name,
            bookedByUserAvatar: newBookedSlotInfo.userAvatar,
            bookedAt: nowTimeString,
            orderId: newOrderId,
          };
        }
        return slot;
      });
    }

    let updatedDailySchedules: DayAvailabilitySchedule[] | undefined = undefined;
    if (targetDev.dailySchedules && targetDev.dailySchedules.length > 0) {
      updatedDailySchedules = targetDev.dailySchedules.map((sched) => {
        if (sched.dateKey === 'today' && sched.customSlots) {
          const updatedSchedSlots = sched.customSlots.map((slot) => {
            if ((customSlotId && slot.id === customSlotId) || (!customSlotId && slot.slotNumber === slotNumber)) {
              return {
                ...slot,
                isBooked: true,
                bookedByUserId: activeUser.id,
                bookedByUserName: activeUser.name,
                bookedByUserAvatar: newBookedSlotInfo.userAvatar,
                bookedAt: nowTimeString,
                orderId: newOrderId,
              };
            }
            return slot;
          });
          return { ...sched, customSlots: updatedSchedSlots };
        }
        return sched;
      });
    }

    const newBookedCount = updatedCustomSlots
      ? updatedCustomSlots.filter((s) => s.isBooked).length
      : currentBooked + 1;

    const updatedDev: Developer = {
      ...targetDev,
      bookedHours: newBookedCount,
      purchasedTime: (targetDev.purchasedTime || 30) + 60,
      customSlots: updatedCustomSlots || targetDev.customSlots,
      dailySchedules: updatedDailySchedules || targetDev.dailySchedules,
      bookedSlots: [
        ...(targetDev.bookedSlots || []).filter((s) => s.slotNumber !== slotNumber),
        newBookedSlotInfo,
      ],
    };

    setDevelopers((prev) =>
      prev.map((d) => (d.id === developerId ? updatedDev : d))
    );
    firebaseSync.saveDeveloper(updatedDev);

    // Broadcast live availability change across all open tabs
    realtimeBus.broadcast('SLOT_AVAILABILITY_UPDATED', updatedDev);

    // Create service order for record
    const newOrder: ServiceOrder = {
      id: newOrderId,
      userId: activeUser.id,
      developerId: targetDev.id,
      developerName: targetDev.name,
      serviceName: `১ ঘণ্টার ভয়েস/চ্যাট সেশন (স্লট #${slotNumber} [${timeRangeStr}])`,
      priceDiamonds: cost,
      date: new Date().toLocaleDateString('bn-BD'),
      status: 'in_progress',
      requirements: `স্লট #${slotNumber} (${timeRangeStr}) বুকিং সফল। রুম লিঙ্ক: ${targetDev.externalChatUrl || targetDev.telegram || 'https://t.me/alex_voice_chat'}`,
    };
    setOrders((prev) => [newOrder, ...prev]);
    firebaseSync.saveOrder(newOrder);

    const orderChatMsg: ChatMessage = {
      id: `ORD-${Date.now()}`,
      sender: 'bot',
      text: `🎉 অভিনন্দন ${activeUser.name}! আপনি ${targetDev.name}-এর ১ ঘণ্টার লাইভ সেশন (স্লট #${slotNumber}: ${timeRangeStr}) বুক করেছেন।`,
      timestamp: nowTimeString,
      developerId: targetDev.id,
      isOrderCard: true,
      orderInfo: {
        orderId: newOrderId,
        serviceName: `১ ঘণ্টার সেশন (${timeRangeStr})`,
        diamonds: cost,
      },
    };

    const userAutoMsg: ChatMessage = {
      id: `AUTO-REQ-${Date.now()}`,
      sender: 'user',
      text: 'পার্সোনাল লিংক টা দিন',
      timestamp: nowTimeString,
      developerId: targetDev.id,
    };

    setChatMessages((prev) => [...prev, orderChatMsg, userAutoMsg]);
    firebaseSync.sendChatMessage(orderChatMsg);
    firebaseSync.sendChatMessage(userAutoMsg);

    // Open developer chatroom immediately
    setActiveDevForChat(targetDev);
    setCurrentView('chat');

    try {
      confetti({ particleCount: 65, spread: 65, origin: { y: 0.6 } });
    } catch {}

    sounds.playDiamond();
    showToast(`🎉 ${targetDev.name} এর ১ ঘণ্টা সেশন (${timeRangeStr}) বুক হয়েছে!`, 'success');
  };

  // Host settings updater
  const handleUpdateHostSettings = async (developerId: number, isTimeSaleActive: boolean, maxAvailableHours: number) => {
    const target = developers.find((d) => d.id === developerId);
    if (target) {
      const updated = { ...target, isTimeSaleActive, maxAvailableHours: Math.max(1, maxAvailableHours) };
      setDevelopers((prev) =>
        prev.map((d) => (d.id === developerId ? updated : d))
      );
      const saved = await firebaseSync.saveDeveloper(updated);
      if (!saved) {
        showToast('হোস্ট সেটিংস ডাটাবেজে সেভ হয়নি!', 'error');
        return;
      }
    }
    showToast('হোস্ট সেটিংস সফলভাবে আপডেট হয়েছে!', 'success');
  };

  const handleAddDeveloper = async (devData: Omit<Developer, 'id' | 'rating' | 'completedOrders' | 'online'>) => {
    const newDev: Developer = {
      ...devData,
      id: Date.now(),
      rating: 5.0,
      completedOrders: 0,
      online: true,
    };
    setDevelopers((prev) => [newDev, ...prev]);
    const saved = await firebaseSync.saveDeveloper(newDev);
    if (!saved) {
      showToast('সার্ভিস ডাটাবেজে সংরক্ষণ করা সম্ভব হয়নি!', 'error');
      return;
    }
    showToast('নতুন সার্ভিস সফলভাবে যুক্ত হয়েছে!', 'success');
  };

  const handleUpdateDeveloper = async (id: number, updated: Partial<Developer>) => {
    const target = developers.find((d) => d.id === id);
    if (target) {
      const updatedDev = { ...target, ...updated };
      setDevelopers((prev) =>
        prev.map((d) => (d.id === id ? updatedDev : d))
      );
      const saved = await firebaseSync.saveDeveloper(updatedDev);
      if (!saved) {
        showToast('সার্ভিস আপডেট ডাটাবেজে সেভ হয়নি!', 'error');
        return;
      }
    }
    showToast('সার্ভিস তথ্য আপডেট হয়েছে!', 'success');
  };

  const handleDeleteDeveloper = async (devId: number) => {
    setDevelopers((prev) => prev.filter((d) => d.id !== devId));
    const saved = await firebaseSync.deleteDeveloper(devId);
    if (!saved) {
      showToast('সার্ভিস ডাটাবেজ থেকে মুছতে সমস্যা হয়েছে!', 'error');
      return;
    }
    showToast('সার্ভিস ডিলিট করা হয়েছে।', 'info');
  };

  const handleUpdateOrderStatus = async (orderId: string, status: ServiceOrder['status'], adminNote?: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      const updatedOrder: ServiceOrder = { ...target, status, ...(adminNote ? { adminNote } : {}) };
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? updatedOrder : o))
      );
      const saved = await firebaseSync.saveOrder(updatedOrder);
      if (!saved) {
        showToast('অর্ডার স্ট্যাটাস ডাটাবেজে সেভ হয়নি!', 'error');
        return;
      }
    }
    showToast(`অর্ডার #${orderId} এর স্ট্যাটাস আপডেট করা হয়েছে!`, 'info');
  };

  const handleRefundOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetOrder.userId || u.id === activeUser.id) {
          const updated = { ...u, diamonds: u.diamonds + targetOrder.priceDiamonds };
          firebaseSync.saveUser(updated);
          return updated;
        }
        return u;
      })
    );

    const updatedOrder: ServiceOrder = { ...targetOrder, status: 'cancelled' };
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? updatedOrder : o))
    );
    const saved = await firebaseSync.saveOrder(updatedOrder);
    if (!saved) {
      showToast('রিফান্ড ডাটাবেজে সংরক্ষণ হয়নি!', 'error');
      return;
    }
    showToast(`অর্ডার #${orderId} রিফান্ড করা হয়েছে (+${targetOrder.priceDiamonds} 💎)`, 'success');
  };

  const handleCompleteOrderByUser = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (targetOrder) {
      const updatedOrder: ServiceOrder = { ...targetOrder, status: 'completed' };
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? updatedOrder : o))
      );
      await firebaseSync.saveOrder(updatedOrder);
    }
    sounds.playSuccess();
    try {
      confetti({ particleCount: 50, spread: 60 });
    } catch {}
    showToast(`অর্ডার #${orderId} সফলভাবে রিসিভড কনফার্ম করা হয়েছে! ধন্যবাদ।`, 'success');
  };

  const handleDeleteOrderByUser = async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    await firebaseSync.deleteOrder(orderId);
    showToast(`অর্ডার #${orderId} ডিলিট করা হয়েছে।`, 'info');
  };

  // User management
  const handleUpdateUser = async (targetId: string, updated: Partial<UserAccount>) => {
    const target = users.find((u) => u.id === targetId);
    if (target) {
      const updatedUser = { ...target, ...updated };
      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? updatedUser : u))
      );
      const saved = await firebaseSync.saveUser(updatedUser);
      if (!saved) {
        showToast('ইউজার প্রোফাইল ডাটাবেজে সেভ হয়নি!', 'error');
        return;
      }

      // Keep userSession in sync if it's the current user
      if (userSession && (userSession.userId === targetId || userSession.phone === target.phone)) {
        const updatedSession: UserSession = {
          ...userSession,
          name: updatedUser.name,
          phone: updatedUser.phone || userSession.phone,
          avatar: updatedUser.avatar || userSession.avatar,
        };
        setUserSession(updatedSession);
        localStorage.setItem('user_session', JSON.stringify(updatedSession));
      }
    }
    showToast('ইউজার প্রোফাইল আপডেট করা হয়েছে!', 'success');
  };

  const handleAddUser = async (newUser: UserAccount) => {
    setUsers((prev) => [newUser, ...prev]);
    const saved = await firebaseSync.saveUser(newUser);
    if (!saved) {
      showToast('ইউজার ডাটাবেজে যোগ হয়নি!', 'error');
      return;
    }
    showToast(`নতুন ইউজার ${newUser.name} যোগ করা হয়েছে!`, 'success');
  };

  const handleDeleteUser = async (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    const saved = await firebaseSync.deleteUser(userId);
    if (!saved) {
      showToast('ইউজার ডিলিট করতে সমস্যা হয়েছে!', 'error');
      return;
    }
    showToast('ইউজার অ্যাকাউন্ট সফলভাবে ডিলিট করা হয়েছে!', 'info');
  };

  const handleApproveAccessRequest = async (requestId: string, targetUserId: string, adminNote?: string) => {
    setAccessRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'approved', adminNote: adminNote || 'অনুমোদিত' } : r))
    );
    await handleUpdateUser(targetUserId, {
      firebaseAccessGranted: true,
      firebaseRequestStatus: 'approved',
    });
    await firebaseSync.approveAccessRequest(requestId, targetUserId, adminNote);
    showToast('ফায়ারবেস ক্লাউড অ্যাক্সেস সফলভাবে অনুমোদন করা হয়েছে!', 'success');
  };

  const handleRejectAccessRequest = async (requestId: string, targetUserId: string, adminNote?: string) => {
    setAccessRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'rejected', adminNote: adminNote || 'বাতিল' } : r))
    );
    await handleUpdateUser(targetUserId, {
      firebaseAccessGranted: false,
      firebaseRequestStatus: 'rejected',
    });
    await firebaseSync.rejectAccessRequest(requestId, targetUserId, adminNote);
    showToast('ফায়ারবেস অ্যাক্সেস বাতিল করা হয়েছে।', 'info');
  };

  // Login session verification handlers
  const handleLoginSession = (session: UserSession) => {
    const signedSession = createSignedSession(session);
    setUserSession(signedSession);
    localStorage.setItem('user_session', JSON.stringify(signedSession));
    try {
      document.cookie = `app_user_session=${encodeURIComponent(JSON.stringify({ id: signedSession.userId || signedSession.sessionId, role: signedSession.role, name: signedSession.name, token: signedSession.token }))}; path=/; max-age=2592000; SameSite=Lax`;
    } catch {}

    if (session.role === 'owner' || session.isOwner === true) {
      // Find or set owner account
      let ownerAcc = users.find((u) => u.id === 'USR-OWNER' || u.role === 'owner' || isOwnerAccount(u));
      if (!ownerAcc) {
        ownerAcc = {
          id: 'USR-OWNER',
          name: 'সিস্টেম ওনার (এডমিন)',
          username: '@plabon_owner',
          bio: '👑 সিস্টেম ওনার ও মাস্টার ডাটাবেজ কন্ট্রোলার',
          phone: '01700000000',
          password: '',
          diamonds: 999999,
          isBanned: false,
          joinedDate: '2026-08-14',
          role: 'owner',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=OwnerPlabon',
        };
        setUsers((prev) => [ownerAcc!, ...prev]);
      }
      setCurrentUserId(ownerAcc.id);
      localStorage.setItem('active_user_id', ownerAcc.id);
      setIsAdminOpen(false);
      setCurrentView('admin');
      showToast('👑 ওনার ডাটাবেজ ও ফুল কন্ট্রোল আনলক হয়েছে!', 'success');
      sounds.playSuccess();
      return;
    }

    if (session.role === 'seller') {
      const dev = developers.find((d) => d.id === session.sellerId || d.name.toLowerCase() === session.name.toLowerCase());
      let sellerAcc = users.find((u) => u.sellerId === session.sellerId || u.name.toLowerCase() === session.name.toLowerCase());

      if (!sellerAcc && dev) {
        sellerAcc = {
          id: `USR-SELLER-${dev.id}`,
          name: dev.name,
          username: dev.username || `@${dev.name.toLowerCase()}`,
          phone: dev.phone || '01712345678',
          diamonds: 750,
          role: 'seller',
          sellerId: dev.id,
          joinedDate: 'আজকে',
          isBanned: false,
          avatar: dev.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${dev.name}`,
        };
        setUsers((prev) => [sellerAcc!, ...prev]);
      }

      if (sellerAcc) {
        setCurrentUserId(sellerAcc.id);
        localStorage.setItem('active_user_id', sellerAcc.id);
      }
      setIsAdminOpen(false);
      setCurrentView('seller_portal');
      showToast(`🛍️ সেলার পোর্টাল আনলক হয়েছে: ${dev?.name || session.name}`, 'success');
      sounds.playSuccess();
      return;
    }

    // Customer
    const existing = users.find(
      (u) => (session.userId && u.id === session.userId) || u.name.toLowerCase() === session.name.toLowerCase() || u.phone === session.phone
    );
    if (existing) {
      setCurrentUserId(existing.id);
      localStorage.setItem('active_user_id', existing.id);
      showToast(`স্বাগতম ${existing.name}! কাস্টমার সেশন সক্রিয়।`, 'success');
    } else {
      const newUserId = session.userId || `USR-${Math.floor(1000 + Math.random() * 9000)}`;
      const newUserObj: UserAccount = {
        id: newUserId,
        name: session.name,
        phone: session.phone,
        diamonds: 500,
        role: 'user',
        joinedDate: 'আজকে',
        isBanned: false,
        avatar: session.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${session.name}`,
      };
      setUsers((prev) => [newUserObj, ...prev]);
      setCurrentUserId(newUserId);
      localStorage.setItem('active_user_id', newUserId);
      showToast(`নতুন কাস্টমার একাউন্ট সক্রিয়: ${session.name}`, 'success');
    }
    setIsAdminOpen(false);
    setCurrentView('home');
    sounds.playSuccess();
  };

  const handleLogoutSession = () => {
    localStorage.removeItem('user_session');
    try {
      document.cookie = 'app_user_session=; path=/; max-age=0';
    } catch {}
    setUserSession(null);
    setCurrentUserId('USR-CUSTOMER');
    localStorage.setItem('active_user_id', 'USR-CUSTOMER');
    setIsAdminOpen(false);
    setCurrentView('home');
    showToast('সেশন থেকে লগআউট সম্পন্ন হয়েছে।', 'info');
  };

  // Register New Seller
  const handleRegisterSeller = async (sellerData: Partial<Developer>, password?: string) => {
    const newDevId = Date.now();
    const securePassword = password
      ? (password.startsWith('sha256$') ? password : await hashPassword(password))
      : await hashPassword(sellerData.phone || '1234');

    const newDev: Developer = {
      id: newDevId,
      name: sellerData.name || 'নতুন সেলার',
      username: sellerData.username,
      service: sellerData.service || 'প্রাইভেট লাইভ সেশন',
      category: sellerData.category || 'app',
      price: sellerData.price || 100,
      rating: 5.0,
      completedOrders: 0,
      avatarSeed: sellerData.name || 'Seller',
      avatar: sellerData.avatar,
      bio: sellerData.bio || 'দক্ষ সেলার সার্ভিস।',
      skills: sellerData.skills || ['লাইভ সেশন', 'প্রাইভেট চ্যাট'],
      online: true,
      deliveryTime: 'ইনস্ট্যান্ট কানেক্ট',
      purchasedTime: 0,
      phone: sellerData.phone,
      password: securePassword,
      telegram: sellerData.telegram,
      isTimeSaleActive: true,
      maxAvailableHours: 10,
      bookedHours: 0,
      diamondPerHour: sellerData.price || 100,
    };

    setDevelopers((prev) => [newDev, ...prev]);
    firebaseSync.saveDeveloper(newDev);

    // Create matching User Account
    const newUserId = `USR-SELLER-${newDevId}`;
    const newUserAcc: UserAccount = {
      id: newUserId,
      name: newDev.name,
      username: newDev.username,
      phone: newDev.phone || '',
      password: securePassword,
      diamonds: 1000,
      bio: newDev.bio,
      isBanned: false,
      joinedDate: new Date().toISOString().split('T')[0],
      role: 'seller',
      sellerId: newDevId,
      avatar: newDev.avatar,
    };

    setUsers((prev) => [newUserAcc, ...prev]);
    firebaseSync.saveUser(newUserAcc);
    setCurrentUserId(newUserId);
    showToast(`নতুন সেলার শপ সফলভাবে তৈরি হয়েছে: ${newDev.name}!`, 'success');
    setCurrentView('seller_portal');
  };

  // Update active seller profile from SellerPortal
  const handleUpdateActiveSellerProfile = (updated: Partial<Developer>) => {
    const activeSellerId = userSession?.sellerId || developers[0]?.id;
    if (!activeSellerId) return;

    const currentDev = developers.find((d) => d.id === activeSellerId);
    if (currentDev) {
      const updatedDev = { ...currentDev, ...updated };
      setDevelopers((prev) =>
        prev.map((d) => (d.id === activeSellerId ? updatedDev : d))
      );
      firebaseSync.saveDeveloper(updatedDev);
    }

    if (updated.name || updated.avatar) {
      setUsers((prev) =>
        prev.map((u) => {
          if (u.sellerId === activeSellerId) {
            const updatedUser = {
              ...u,
              ...(updated.name ? { name: updated.name } : {}),
              ...(updated.avatar ? { avatar: updated.avatar } : {}),
            };
            firebaseSync.saveUser(updatedUser);
            return updatedUser;
          }
          return u;
        })
      );
    }
    showToast('আপনার সেলার শপ প্রোফাইল সফলভাবে আপডেট হয়েছে!', 'success');
  };

  // Find active seller for seller portal
  const currentSellerDev =
    developers.find(
      (d) =>
        (userSession?.sellerId && d.id === userSession.sellerId) ||
        (activeUser?.sellerId && d.id === activeUser.sellerId) ||
        (userSession?.username && d.username && d.username.toLowerCase() === userSession.username.toLowerCase()) ||
        (activeUser?.username && d.username && d.username.toLowerCase() === activeUser.username.toLowerCase()) ||
        (userSession?.phone && d.phone && d.phone === userSession.phone) ||
        (activeUser?.phone && d.phone && d.phone === activeUser.phone) ||
        (userSession?.name && d.name && d.name.toLowerCase() === userSession.name.toLowerCase()) ||
        (activeUser?.name && d.name && d.name.toLowerCase() === activeUser.name.toLowerCase())
    ) ||
    developers[0] ||
    INITIAL_DEVELOPERS[0];

  const pendingPaymentsCount = paymentRequests.filter((r) => r.status === 'pending').length;
  const activeOrdersCount = orders.filter((o) => o.status === 'in_progress' || o.status === 'pending').length;

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'light-theme bg-gray-100 text-slate-900' : 'dark-theme bg-slate-950 text-slate-100'} flex justify-center selection:bg-blue-500 selection:text-white`}>
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Main app container */}
      <div className={`w-full ${currentView === 'admin' ? 'max-w-5xl' : 'max-w-lg'} ${theme === 'light' ? 'bg-white' : 'bg-slate-950'} flex flex-col min-h-screen relative shadow-2xl border-x border-slate-800/60 transition-all duration-300`}>
        {/* If in Dedicated Admin Panel View */}
        {currentView === 'admin' ? (
          <MasterAdminPanel
            isStandaloneView={true}
            onBackToSite={() => setCurrentView('home')}
            paymentRequests={paymentRequests}
            onApprovePayment={handleApprovePayment}
            onRejectPayment={handleRejectPayment}
            withdrawRequests={withdrawRequests}
            onApproveWithdraw={handleApproveWithdraw}
            onRejectWithdraw={handleRejectWithdraw}
            developers={developers}
            onAddDeveloper={handleAddDeveloper}
            onUpdateDeveloper={handleUpdateDeveloper}
            onDeleteDeveloper={handleDeleteDeveloper}
            paymentSettings={paymentSettings}
            onUpdateSettings={async (newSettings) => {
              setPaymentSettings(newSettings);
              const saved = await firebaseSync.savePaymentSettings(newSettings);
              if (!saved) {
                showToast('পেমেন্ট ও সাপোর্ট সেটিংস সংরক্ষণ ব্যর্থ হয়েছে!', 'error');
                return;
              }
              showToast('পেমেন্ট ও সাপোর্ট সেটিংস সংরক্ষিত হয়েছে!', 'success');
            }}
            siteConfig={siteConfig}
            onUpdateSiteConfig={async (newConfig) => {
              setSiteConfig(newConfig);
              const saved = await firebaseSync.saveSiteConfig(newConfig);
              if (!saved) {
                showToast('ওয়েবসাইট কনফিগারেশন সংরক্ষণ ব্যর্থ হয়েছে!', 'error');
                return;
              }
              showToast('ওয়েবসাইট কনফিগারেশন সংরক্ষিত হয়েছে!', 'success');
            }}
            users={users}
            onUpdateUser={handleUpdateUser}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onRefundOrder={handleRefundOrder}
            userDiamonds={diamonds}
            onAddDiamondsDirectly={handleAddDiamondsDirectly}
            onImpersonateUser={handleImpersonateUser}
            chatMessages={chatMessages}
            onSendMessage={handleSendMessage}
            rechargePackages={rechargePackages}
            onUpdateRechargePackages={async (pkgs) => {
              setRechargePackages(pkgs);
              const saved = await firebaseSync.saveRechargePackages(pkgs);
              if (!saved) {
                showToast('টপ-আপ প্যাকেজ সংরক্ষণ ব্যর্থ হয়েছে!', 'error');
                return;
              }
              showToast('টপ-আপ রিচার্জ প্যাকেজ সংরক্ষিত হয়েছে!', 'success');
            }}
            accessRequests={accessRequests}
            onApproveAccessRequest={handleApproveAccessRequest}
            onRejectAccessRequest={handleRejectAccessRequest}
          />
        ) : (
          <>
            {/* Top bar */}
            <TopBar
              currentView={currentView}
              title={getHeaderTitle()}
              diamonds={diamonds}
              onDiamondClick={() => setCurrentView('profile')}
              onAdminClick={() => {
                setCurrentView('admin');
              }}
              onSellerPortalClick={() => setCurrentView('seller_portal')}
              pendingCount={pendingPaymentsCount}
              siteName={siteConfig.siteName}
              activeUser={activeUser}
              isOwner={isOwner}
              isSeller={isSeller}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />

            {/* Dynamic Main View */}
            <main className="flex-1 p-3.5 sm:p-4 overflow-y-auto">
              {currentView === 'home' && (
                <HomeView
                  developers={developers}
                  allUsers={users}
                  onStartChatWithDev={(dev) => {
                    setActiveDevForChat(dev);
                    setCurrentView('chat');
                  }}
                  onHireDeveloper={(dev) => setSelectedDevForHire(dev)}
                  onOpenRecharge={() => setCurrentView('profile')}
                  siteConfig={siteConfig}
                  userDiamonds={diamonds}
                  onBookSlot={handleBookSlot}
                  onUpdateHostSettings={handleUpdateHostSettings}
                  onSendMessageToPanel={(text: string) => {
                    const newMsg: ChatMessage = {
                      id: `BF-REQ-${Date.now()}`,
                      sender: 'user',
                      senderUserId: activeUser.id,
                      receiverUserId: 'admin',
                      participants: ['admin', activeUser.id],
                      text: `💌 [বয়ফ্রেন্ড ভাড়া বুকিং ও অনুসন্ধান]: ${text}`,
                      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
                    };
                    setChatMessages((prev) => [...prev, newMsg]);
                    firebaseSync.sendChatMessage(newMsg);
                    realtimeBus.broadcast('NEW_MESSAGE', newMsg, 'admin', activeUser.id);
                    setActiveDevForChat(null);
                    setCurrentView('chat');
                    showToast('অ্যাডমিন প্যানেলে আপনার বুকিং মেসেজ পাঠানো হয়েছে!', 'success');
                    sounds.playSend();
                  }}
                  isOwner={isOwner}
                  isSeller={isSeller}
                />
              )}

              {currentView === 'chat' && (
                <ChatView
                  messages={chatMessages}
                  orders={orders}
                  onSendMessage={handleSendMessage}
                  activeDeveloper={activeDevForChat}
                  onClearActiveDeveloper={() => setActiveDevForChat(null)}
                  allDevelopers={developers}
                  onSelectDeveloper={(dev) => setActiveDevForChat(dev)}
                  onHireDeveloper={(dev) => setSelectedDevForHire(dev)}
                  telegramSupportUrl={paymentSettings.telegramSupportUrl}
                  isAdmin={isOwner}
                  currentUser={activeUser}
                  onOpenProfile={() => setCurrentView('profile')}
                  siteConfig={siteConfig}
                  onUpdateUser={handleUpdateUser}
                />
              )}

              {currentView === 'orders' && (
                <OrdersView
                  orders={
                    isOwner
                      ? orders
                      : orders.filter((o) => o.userId === activeUser.id || !o.userId)
                  }
                  allUsers={users}
                  activeUser={activeUser}
                  onOpenChatWithDev={(devId) => {
                    const dev = developers.find((d) => d.id === devId) || null;
                    setActiveDevForChat(dev);
                    setCurrentView('chat');
                  }}
                  onCompleteOrder={handleCompleteOrderByUser}
                  onDeleteOrder={handleDeleteOrderByUser}
                  onExploreServices={() => setCurrentView('home')}
                />
              )}

              {currentView === 'profile' && (
                <ProfileView
                  currentUser={activeUser}
                  allUsers={users}
                  onSwitchUser={(newId) => {
                    setCurrentUserId(newId);
                    const targetName = users.find((u) => u.id === newId)?.name || newId;
                    showToast(`সক্রিয় প্রোফাইল পরিবর্তন: ${targetName}`, 'info');
                  }}
                  onUpdateUserName={(targetId, name, phone) => {
                    handleUpdateUser(targetId, { name, phone });
                  }}
                  onUpdateUser={handleUpdateUser}
                  onUpdateBio={handleUpdateBio}
                  onRegisterUser={handleRegisterNewUser}
                  diamonds={diamonds}
                  paymentRequests={paymentRequests}
                  paymentSettings={paymentSettings}
                  siteConfig={siteConfig}
                  rechargePackages={rechargePackages}
                  onSubmitPayment={handleSubmitPayment}
                  onOpenAdmin={() => setCurrentView('admin')}
                  onOpenSellerPortal={() => setCurrentView('seller_portal')}
                  onOpenLoginModal={() => setIsLoginModalOpen(true)}
                  onCopyText={handleCopyText}
                  currentSession={userSession}
                  onLoginSession={handleLoginSession}
                  onLogoutSession={handleLogoutSession}
                  isOwner={isOwner}
                  isSeller={isSeller}
                  theme={theme}
                  onToggleTheme={handleToggleTheme}
                />
              )}

              {currentView === 'seller_portal' && (
                <SellerPortal
                  seller={currentSellerDev}
                  sellerAccount={activeUser}
                  orders={orders}
                  chatMessages={chatMessages}
                  withdrawRequests={withdrawRequests}
                  onRequestWithdraw={handleRequestWithdraw}
                  onUpdateSellerProfile={handleUpdateActiveSellerProfile}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onSendMessage={handleSendMessage}
                  onBackToMarketplace={() => setCurrentView('home')}
                  siteConfig={siteConfig}
                />
              )}
            </main>

            {/* Hire Confirmation Modal */}
            {selectedDevForHire && (
              <HireModal
                developer={selectedDevForHire}
                userDiamonds={diamonds}
                onClose={() => setSelectedDevForHire(null)}
                onConfirmHire={handleConfirmHire}
                onGoToRecharge={() => {
                  setSelectedDevForHire(null);
                  setCurrentView('profile');
                }}
              />
            )}

            {/* Login / Seller Registration Modal */}
            {isLoginModalOpen && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
                <div className="relative w-full max-w-md">
                  <button
                    type="button"
                    onClick={() => setIsLoginModalOpen(false)}
                    className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold border border-slate-700 shadow-lg cursor-pointer z-10"
                  >
                    ✕
                  </button>
                  <LoginVerification
                    currentSession={userSession}
                    allDevelopers={developers}
                    allUsers={users}
                    welcomeBonusDiamonds={siteConfig.welcomeBonusDiamonds ?? 50}
                    freeDiamondsOfferEnabled={siteConfig.freeDiamondsOfferEnabled ?? true}
                    loginNoticeMessage={siteConfig.showLoginNoticeMessage !== false ? siteConfig.loginNoticeMessage : undefined}
                    onLoginSuccess={(session) => {
                      handleLoginSession(session);
                      setIsLoginModalOpen(false);
                    }}
                    onRegisterSeller={handleRegisterSeller}
                    onRegisterCustomer={(name, phone, password, avatar, customId) =>
                      handleRegisterNewUser(name, `@${name.toLowerCase().replace(/\s+/g, '_')}`, phone, password, avatar, customId)
                    }
                    onLogout={handleLogoutSession}
                    onClose={() => setIsLoginModalOpen(false)}
                    isModal={true}
                  />
                </div>
              </div>
            )}

            {/* Admin Control Center Modal (OWNER ONLY) */}
            {isAdminOpen && isOwner && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 backdrop-blur-md">
                <MasterAdminPanel
                  onBackToSite={() => setIsAdminOpen(false)}
                  paymentRequests={paymentRequests}
                  onApprovePayment={handleApprovePayment}
                  onRejectPayment={handleRejectPayment}
                  withdrawRequests={withdrawRequests}
                  onApproveWithdraw={handleApproveWithdraw}
                  onRejectWithdraw={handleRejectWithdraw}
                  developers={developers}
                  onAddDeveloper={handleAddDeveloper}
                  onUpdateDeveloper={handleUpdateDeveloper}
                  onDeleteDeveloper={handleDeleteDeveloper}
                  paymentSettings={paymentSettings}
                  onUpdateSettings={async (newSettings) => {
                    setPaymentSettings(newSettings);
                    const saved = await firebaseSync.savePaymentSettings(newSettings);
                    if (!saved) {
                      showToast('পেমেন্ট ও সাপোর্ট সেটিংস সংরক্ষণ ব্যর্থ হয়েছে!', 'error');
                      return;
                    }
                    showToast('পেমেন্ট ও সাপোর্ট সেটিংস সংরক্ষিত হয়েছে!', 'success');
                  }}
                  siteConfig={siteConfig}
                  onUpdateSiteConfig={async (newConfig) => {
                    setSiteConfig(newConfig);
                    const saved = await firebaseSync.saveSiteConfig(newConfig);
                    if (!saved) {
                      showToast('ওয়েবসাইট কনফিগারেশন সংরক্ষণ ব্যর্থ হয়েছে!', 'error');
                      return;
                    }
                    showToast('ওয়েবসাইট কনফিগারেশন সংরক্ষিত হয়েছে!', 'success');
                  }}
                  users={users}
                  onUpdateUser={handleUpdateUser}
                  onAddUser={handleAddUser}
                  onDeleteUser={handleDeleteUser}
                  orders={orders}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  onRefundOrder={handleRefundOrder}
                  userDiamonds={diamonds}
                  onAddDiamondsDirectly={handleAddDiamondsDirectly}
                  onImpersonateUser={handleImpersonateUser}
                  chatMessages={chatMessages}
                  onSendMessage={handleSendMessage}
                  rechargePackages={rechargePackages}
                  onUpdateRechargePackages={async (pkgs) => {
                    setRechargePackages(pkgs);
                    const saved = await firebaseSync.saveRechargePackages(pkgs);
                    if (!saved) {
                      showToast('টপ-আপ প্যাকেজ সংরক্ষণ ব্যর্থ হয়েছে!', 'error');
                      return;
                    }
                    showToast('টপ-আপ রিচার্জ প্যাকেজ সংরক্ষিত হয়েছে!', 'success');
                  }}
                  accessRequests={accessRequests}
                  onApproveAccessRequest={handleApproveAccessRequest}
                  onRejectAccessRequest={handleRejectAccessRequest}
                />
              </div>
            )}

            {/* Bottom Navigation */}
            <BottomNav
              currentView={currentView}
              onSelectView={(view) => {
                if (view === 'admin') {
                  if (isOwner) {
                    setCurrentView('admin');
                  } else {
                    showToast('শুধুমাত্র ওনার (USP labon) ডাটাবেজ প্যানেল এক্সেস করতে পারেন।', 'error');
                    setIsLoginModalOpen(true);
                  }
                } else if (view === 'seller_portal') {
                  setCurrentView('seller_portal');
                } else {
                  setCurrentView(view);
                }
              }}
              activeOrdersCount={activeOrdersCount}
              pendingRequestsCount={pendingPaymentsCount}
              userRole={userSession?.role || activeUser.role || 'user'}
              isOwner={isOwner}
            />

            {/* Entrance Welcome / Promo Popup Banner */}
            <EntrancePopupBanner
              siteConfig={siteConfig}
              onNavigateToRecharge={() => {
                setCurrentView('profile');
                showToast('ডায়মন্ড রিচার্জ অপশনে নিয়ে যাওয়া হচ্ছে...', 'info');
              }}
            />

            {/* Realtime WebRTC Incoming Call Overlay */}
            <IncomingCallModal
              currentUser={activeUser || (userSession as any)}
              isOwner={isOwner}
              onCallAccepted={(session) => {
                // If caller is a seller or target was a seller, open chat with that developer
                let dev = session.targetDeveloperId
                  ? developers.find((d) => d.id === session.targetDeveloperId)
                  : undefined;

                if (!dev && session.callerId) {
                  dev = developers.find(
                    (d) =>
                      session.callerId === d.username ||
                      session.callerId === `seller_${d.username}` ||
                      session.callerId === `dev_${d.id}` ||
                      (d.username && session.callerId.includes(d.username))
                  );
                }

                if (dev) {
                  setActiveDevForChat(dev);
                  setCurrentView('chat');
                } else if (isSeller) {
                  setCurrentView('seller-portal');
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
