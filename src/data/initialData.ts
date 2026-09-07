import { Developer, RechargePackage, PaymentSettings, SiteConfig, UserAccount, SellerWithdrawRequest } from '../types';

export const INITIAL_DATA_VERSION = '2026.09.03.v2';

export const INITIAL_DEVELOPERS: Developer[] = [
  {
    id: 1,
    name: 'অ্যালেক্স (Alex)',
    username: '@alex_host',
    service: 'প্রাইভেট লাইভ চ্যাট ও ভয়েস কল সেশন',
    category: 'app',
    price: 100,
    rating: 5.0,
    completedOrders: 420,
    avatarSeed: 'Alex_Host',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex_Voice',
    bio: '২৪/৭ অ্যাক্টিভ প্রাইভেট চ্যাট ও ভয়েস কল হোস্ট। ডায়মন্ড দিয়ে সময় বুক করে সরাসরি প্রাইভেট ইন-অ্যাপ চ্যাট ও লাইভ ভয়েস কলে কানেক্ট হয়ে কথা বলুন।',
    skills: ['🎙️ ভয়েস কল', '💬 প্রাইভেট চ্যাট', '🚀 ইনস্ট্যান্ট কানেক্ট', '🔒 ফুল প্রাইভেসি', '⚡ এইচডি অডিও'],
    online: true,
    deliveryTime: 'ইনস্ট্যান্ট কানেক্ট',
    purchasedTime: 45,
    phone: '01711-889900',
    telegram: 'https://t.me/alex_voice_chat',
    externalChatUrl: 'https://t.me/alex_voice_chat',
    voiceIntroText: 'হ্যালো! আমি অ্যালেক্স। আপনার সাথে লাইভ চ্যাট ও ভয়েস কলে কথা বলতে আমি সার্বক্ষণিক প্রস্তুত। ডায়মন্ডে সময় বুক করে সরাসরি আমার সাথে যুক্ত হতে পারেন। ধন্যবাদ!',
    voiceIntroDuration: '0:18',
    isTimeSaleActive: true,
    maxAvailableHours: 10,
    bookedHours: 2,
    diamondPerHour: 100,
    bookedSlots: [
      {
        slotNumber: 1,
        userId: 'USR-CUSTOMER',
        userName: 'রাকিবুল হাসান (কাস্টমার)',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CustomerRakib',
        timeRange: '10:00 AM - 11:00 AM',
        bookedAt: '১০:৩০ AM',
        diamonds: 100,
      },
      {
        slotNumber: 2,
        userId: 'USR-VIP-102',
        userName: 'তানভীর আহমেদ',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TanvirAhmed',
        timeRange: '11:00 AM - 12:00 PM',
        bookedAt: '১১:০০ AM',
        diamonds: 100,
      },
    ],
  },
  {
    id: 2,
    name: 'ডেভিড (David)',
    username: '@david_host',
    service: 'প্রিমিয়াম ভিআইপি ভয়েস ও প্রাইভেট চ্যাট কানেকশন',
    category: 'bot',
    price: 150,
    rating: 4.9,
    completedOrders: 380,
    avatarSeed: 'David_Host',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David_Voice',
    bio: 'ডেভিড এর সাথে সরাসরি ভিআইপি অডিও কল ও চ্যাট সেশন। ডায়মন্ডে বুকিং করে সরাসরি লিঙ্ক ও পোর্টালে জয়েন করে লাইভ কথা বলুন।',
    skills: ['👑 ভিআইপি কল', '🎙️ এইচডি অডিও', '💬 সিক্রেট চ্যাট', '⚡ রিয়েলটাইম ভয়েস', '🛡️ ১০০% সিকিউর'],
    online: true,
    deliveryTime: 'ইনস্ট্যান্ট কানেক্ট',
    purchasedTime: 30,
    phone: '01822-446688',
    telegram: 'https://t.me/david_voice_chat',
    externalChatUrl: 'https://t.me/david_voice_chat',
    voiceIntroText: 'স্বাগতম! আমি ডেভিড। আপনি যদি প্রিমিয়াম ও ১০০% সিকিউর প্রাইভেট অডিও বা চ্যাট সেশন চান, তাহলে এখনই স্লট বুক করে ফেলুন। আপনার সাথে কথা বলার অপেক্ষায় রইলাম!',
    voiceIntroDuration: '0:22',
    isTimeSaleActive: true,
    maxAvailableHours: 12,
    bookedHours: 1,
    diamondPerHour: 100,
    bookedSlots: [
      {
        slotNumber: 1,
        userId: 'USR-VIP-103',
        userName: 'শফিকুর রহমান',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ShafiqurRahman',
        timeRange: '10:00 AM - 11:00 AM',
        bookedAt: '১০:০০ AM',
        diamonds: 100,
      },
    ],
  }
];

export const RECHARGE_PACKAGES: RechargePackage[] = [
  { id: 'pkg-1', diamonds: 100, bonus: 0, bdtPrice: 100, badge: 'স্টার্টার' },
  { id: 'pkg-2', diamonds: 300, bonus: 30, bdtPrice: 300, popular: true, badge: '+৩০ বোনাস' },
  { id: 'pkg-3', diamonds: 500, bonus: 75, bdtPrice: 500, badge: '+৭৫ বোনাস' },
  { id: 'pkg-4', diamonds: 1000, bonus: 200, bdtPrice: 1000, badge: '🔥 ভিআইপি অফার (+২০০)' },
  { id: 'pkg-5', diamonds: 2500, bonus: 600, bdtPrice: 2500, badge: '👑 মেগা সেভার (+৬০০)' }
];

export const INITIAL_SETTINGS: PaymentSettings = {
  bkashNumber: '01798-234567',
  nagadNumber: '01812-345678',
  rocketNumber: '01934-567890',
  upayNumber: '01655-432109',
  telegramSupportUrl: 'https://t.me/PrivateChatSupport_Official',
  ratePerDiamondBdt: 1
};

export const INITIAL_SITE_CONFIG: SiteConfig = {
  siteName: 'PTS',
  siteTagline: 'প্রাইভেট লাইভ চ্যাট ও ভয়েস কলিং প্ল্যাটফর্ম',
  bannerNotice: '🎙️ অ্যালেক্স ও ডেভিডের সাথে সরাসরি চ্যাট ও ভয়েস কলে কথা বলতে ডায়মন্ডে সেশন বুক করুন!',
  showBannerNotice: true,
  marqueeAlert: '⚡️ PTS লাইভ: অ্যালেক্স ও ডেভিড অনলাইন আছেন | রিয়েলটাইম প্রাইভেট চ্যাট ও ভয়েস কল লিঙ্ক প্রস্তুত | ২৪/৭ সাপোর্ট!',
  showMarquee: true,
  maintenanceMode: false,
  adminPin: '',
  telegramChannel: 'https://t.me/PrivateChatServices',
  minRechargeAmount: 50,
  supportStatus: 'active',
  // Dynamic Homepage Support Notice Box
  homeSupportNotice: 'যেকোনো প্রয়োজনে বা তথ্যের জন্য আমাদের সার্বক্ষণিক লাইভ চ্যাট অথবা সাপোর্ট সেন্টারে যোগাযোগ করুন। তাৎক্ষণিক সেবা নিশ্চিত করা হয়।',
  showHomeSupportNotice: true,
  // Dynamic Login / Entrance Screen Custom Message Field
  loginNoticeMessage: 'যেকোনো জিজ্ঞাসা বা সহযোগিতার জন্য আমাদের অফিশিয়াল চ্যাট বা সাপোর্ট সেন্টারে মেসেজ করুন।',
  showLoginNoticeMessage: true,
  // Multi-Banner Slider System
  showPopupBanner: true,
  popupBannerImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80',
  popupBannerTitle: '🎉 বিশেষ অফার ও ঘোষণা!',
  popupBannerSubtitle: 'আজকের স্পেশাল ডায়মন্ড রিচার্জ বোনাস ও লাইভ ভয়েস কল সেশনে আকর্ষণীয় ডিসকাউন্ট উপভোগ করুন।',
  popupBannerLink: '',
  popupBannerButtonText: 'এখনই শুরু করুন',
  popupBanners: [
    {
      id: 'banner-1',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80',
      title: '🎉 বিশেষ অফার ও ঘোষণা!',
      subtitle: 'আজকের স্পেশাল ডায়মন্ড রিচার্জ বোনাস ও লাইভ ভয়েস কল সেশনে আকর্ষণীয় ডিসকাউন্ট উপভোগ করুন।',
      buttonText: 'এখনই রিচার্জ করুন',
      link: '',
      active: true,
    },
    {
      id: 'banner-2',
      image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1000&q=80',
      title: '🎙️ ভয়েস কল ও লাইভ চ্যাট সেশন',
      subtitle: 'আমাদের দক্ষ ও জনপ্রিয় হোস্টদের সাথে কথা বলতে বুকিং সম্পন্ন করুন সম্পূর্ণ গোপনীয়তায়।',
      buttonText: 'হোস্টদের সাথে কথা বলুন',
      link: '',
      active: true,
    },
    {
      id: 'banner-3',
      image: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1000&q=80',
      title: '💎 নতুন একাউন্টে ৫০ 💎 ফ্রি বোনাস!',
      subtitle: 'প্রতিটি রিচার্জে পাচ্ছেন ২০% অতিরিক্ত বোনাস ডায়মন্ড অফার। সীমিত সময়ের সুযোগ!',
      buttonText: 'অফারটি নিন',
      link: '',
      active: true,
    }
  ],
  welcomeBonusDiamonds: 50,
  rechargeBonusPercentage: 20,
  rechargeFlatBonusDiamonds: 10,
  freeDiamondsOfferEnabled: true,
  freeDiamondsOfferTitle: '🎁 নতুন একাউন্ট খুললেই ৫০ 💎 ফ্রি ওয়েলকাম বোনাস + প্রতিটি রিচার্জে ২০% অতিরিক্ত ডায়মন্ড অফার!',
  boyfriendRentPolicy: '📌 বয়ফ্রেন্ড ভাড়া ও প্রাইভেট সেশন নীতিমালা এবং প্রাইভেসি পলিসি:\n\n১. শতভাগ পরিচয়ের গোপনীয়তা: সকল ক্লায়েন্টের ব্যক্তিগত তথ্য, কথোপকথন ও পরিচয় সম্পূর্ণ নিরাপদ ও সুরক্ষিত থাকবে।\n২. মার্জিত ও শালীন যোগাযোগ: লাইভ ভয়েস কল ও প্রাইভেট চ্যাট সেশনে পরস্পরের প্রতি সম্মানজনক ও শালীন ভাষা ব্যবহার করা বাধ্যতামূলক।\n৩. ডায়মন্ড ও সেশন বুকিং: নির্ধারিত ডায়মন্ডের বিনিময়ে নির্দিষ্ট সময় স্লট বুকিং করার পর অবিলম্বে ইন-অ্যাপ পার্সোনাল লিঙ্ক প্রদান করা হয়।\n৪. কোনো অসদুপায় বা অবাঞ্ছিত আচরণ কঠোরভাবে নিষিদ্ধ এবং তাৎক্ষণিক একাউন্ট ব্লক করার যোগ্য।\n৫. সার্বক্ষণিক ওনার সাপোর্ট: কোনো জিজ্ঞাসা বা বিশেষ রিকোয়ারমেন্টের জন্য সরাসরি অ্যাডমিন/ওনার প্যানেলে মেসেজ দিন।',
  showBoyfriendRentNotice: true,
  meteredAppName: 'yourappname',
  meteredApiKey: '',
};

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'USR-OWNER',
    name: 'মাস্টার অ্যাডমিন (ওনার)',
    username: 'admin',
    bio: '👑 সিস্টেম ওনার ও ডাটাবেজ কন্ট্রোলার',
    phone: '',
    diamonds: 999999,
    isBanned: false,
    joinedDate: '2026-08-14',
    role: 'owner',
    password: 'admin',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminOwner'
  },
  {
    id: 'USR-CUSTOMER',
    name: 'রাকিবুল হাসান (কাস্টমার)',
    username: '@rakibul_customer',
    bio: '💎 সাধারণ কাস্টমার ও ভেরিফায়েড ক্লায়েন্ট',
    phone: '01712-345678',
    password: '1234',
    diamonds: 350,
    isBanned: false,
    joinedDate: '2026-08-15',
    role: 'user',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CustomerRakib'
  },
  {
    id: 'USR-ALEX',
    name: 'Alex',
    username: '@alex_host',
    bio: 'অফিসিয়াল প্রাইভেট চ্যাট ও ভয়েস হোস্ট | ১০ ঘণ্টা সেশন এভেলেবল',
    phone: '01711-889900',
    password: '1234',
    diamonds: 750,
    isBanned: false,
    joinedDate: '2026-08-10',
    role: 'seller',
    sellerId: 1,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex_Voice'
  },
  {
    id: 'USR-DAVID',
    name: 'David',
    username: '@david_host',
    bio: 'এক্সক্লুসিভ লাইভ পরামর্শক ও ভয়েস পার্টনার',
    phone: '01822-445566',
    password: '1234',
    diamonds: 500,
    isBanned: false,
    joinedDate: '2026-08-12',
    role: 'seller',
    sellerId: 2,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David_Voice'
  }
];

export const INITIAL_WITHDRAW_REQUESTS: SellerWithdrawRequest[] = [
  {
    id: 'WDR-9021',
    sellerId: 1,
    sellerName: 'অ্যালেক্স (Alex)',
    sellerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex_Voice',
    sellerPhone: '01711-889900',
    amountDiamonds: 250,
    bdtAmount: 250,
    paymentMethod: 'bKash',
    accountNumber: '01711-889900',
    accountType: 'Personal',
    requestedAt: '2026-08-18 10:15 AM',
    status: 'pending',
    adminNote: 'সেলার ইনকাম উইথড্র রিকোয়েস্ট'
  }
];
