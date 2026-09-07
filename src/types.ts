export type ViewType = 'home' | 'chat' | 'orders' | 'profile' | 'admin' | 'seller_portal';

export type PaymentMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Upay';

export interface UserSession {
  name: string;
  phone: string;
  sessionId: string;
  userId?: string;
  loginAt?: string;
  role?: 'owner' | 'seller' | 'customer' | 'user' | 'vip' | 'admin';
  isOwner?: boolean;
  isSeller?: boolean;
  sellerId?: number;
  avatar?: string;
  token?: string;
  signature?: string;
}

export interface BookedSlotInfo {
  slotNumber: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  timeRange: string;
  bookedAt: string;
  diamonds: number;
  dateKey?: string;
}

export interface DailyTimeSlot {
  id: string;
  slotNumber: number;
  timeRange: string; // e.g. "10:00 AM - 11:00 AM"
  startTime?: string;
  endTime?: string;
  isBooked: boolean;
  bookedByUserId?: string;
  bookedByUserName?: string;
  bookedByUserAvatar?: string;
  bookedAt?: string;
  diamonds: number;
  orderId?: string;
  dateKey?: string; // "today", "tomorrow", or "YYYY-MM-DD"
}

export interface DayAvailabilitySchedule {
  dateKey: string; // "today", "tomorrow", or "YYYY-MM-DD"
  dayLabel: string; // "আজকের দিন (Today)", "আগামীকাল (Tomorrow)", etc.
  totalWorkingHours: number; // e.g. 10 hours today, 6 hours tomorrow
  isActive: boolean; // whether accepting bookings on this day
  customSlots?: DailyTimeSlot[];
  lastResetAt?: string;
}

export interface Developer {
  id: number;
  name: string;
  username?: string;
  password?: string;
  service: string;
  category: 'app' | 'web' | 'graphics' | 'bot' | 'security' | 'marketing' | string;
  price: number; // in Diamonds
  rating: number;
  completedOrders: number;
  avatarSeed?: string;
  avatar?: string;
  bio: string;
  skills: string[];
  online: boolean;
  deliveryTime: string;
  purchasedTime?: number; // minutes or purchased units
  phone?: string; // sensitive - only visible to admin
  telegram?: string;
  externalChatUrl?: string;
  voiceIntroUrl?: string;
  voiceIntroText?: string;
  voiceIntroDuration?: string;
  isTimeSaleActive?: boolean;
  maxAvailableHours?: number;
  bookedHours?: number;
  diamondPerHour?: number;
  totalEarningsDiamonds?: number;
  bookedSlots?: BookedSlotInfo[];
  customSlots?: DailyTimeSlot[];
  dailySchedules?: DayAvailabilitySchedule[];
  activeDateKey?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'developer' | 'admin';
  senderName?: string;
  senderUserId?: string;
  receiverUserId?: string;
  senderUsername?: string;
  receiverUsername?: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  createdAt?: number;
  developerId?: number;
  isOrderCard?: boolean;
  orderInfo?: {
    orderId: string;
    serviceName: string;
    diamonds: number;
  };
  attachment?: {
    type: 'image' | 'voice' | 'file';
    url: string;
    name?: string;
    duration?: number; // duration in seconds for voice note
  };
  participants?: string[];
  isPublic?: boolean;
  isRead?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface RechargePackage {
  id: string;
  diamonds: number;
  bonus: number;
  bdtPrice: number;
  popular?: boolean;
  badge?: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userName: string;
  method: PaymentMethod;
  amountDiamonds: number;
  bdtAmount: number;
  senderPhone: string;
  lastDigits?: string;
  trxId: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
}

export interface ServiceOrder {
  id: string;
  userId?: string;
  userName?: string;
  userPhone?: string;
  userAvatar?: string;
  developerId: number;
  developerName: string;
  serviceName: string;
  developerService?: string;
  priceDiamonds: number;
  durationMinutes?: number;
  durationText?: string;
  date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  requirements?: string;
  completionDate?: string;
  adminNote?: string;
}

export interface PaymentSettings {
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  upayNumber: string;
  telegramSupportUrl: string;
  ratePerDiamondBdt: number;
  diamondRateBdt?: number;
  diamondRateDiamonds?: number;
  supportPhone?: string;
  supportWhatsapp?: string;
}

export interface MarketingBanner {
  id: string;
  image: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  link?: string;
  active: boolean;
}

export interface SiteConfig {
  siteName: string;
  siteTagline: string;
  bannerNotice: string;
  showBannerNotice: boolean;
  marqueeAlert: string;
  showMarquee: boolean;
  maintenanceMode: boolean;
  adminPin: string;
  telegramChannel: string;
  minRechargeAmount: number;
  supportStatus: 'active' | 'offline' | 'busy';
  // Homepage Dynamic Support & Notice Box
  homeSupportNotice?: string;
  showHomeSupportNotice?: boolean;
  // Login / Entrance Screen Custom Notice Box (Replaces hardcoded helpline)
  loginNoticeMessage?: string;
  showLoginNoticeMessage?: boolean;
  // Welcome / Entrance Popup Promo Banners (Supports Unlimited Multiple Banners & Videos)
  popupBanners?: MarketingBanner[];
  popupBannerImage?: string;
  popupBannerVideo?: string;
  popupBannerMediaType?: 'image' | 'video';
  showPopupBanner?: boolean;
  popupBannerTitle?: string;
  popupBannerSubtitle?: string;
  popupBannerLink?: string;
  popupBannerButtonText?: string;
  // Free Diamonds & Bonus Offers Config
  welcomeBonusDiamonds?: number;
  rechargeBonusPercentage?: number;
  rechargeFlatBonusDiamonds?: number;
  freeDiamondsOfferEnabled?: boolean;
  freeDiamondsOfferTitle?: string;
  // Boyfriend Rental Policy and Direct Booking Notice
  boyfriendRentPolicy?: string;
  showBoyfriendRentNotice?: boolean;
  boyfriendRentTitle?: string;
  boyfriendRentSubtitle?: string;
  boyfriendRentTag?: string;
  boyfriendRentButtonText?: string;
  // Metered Video Meeting Cloud Config (Synchronized for all buyers and sellers)
  meteredAppName?: string;
  meteredApiKey?: string;
}

export interface GoogleDriveAccount {
  email: string;
  name?: string;
  avatar?: string;
  linkedAt: string;
  autoSyncDrive?: boolean;
  lastDriveBackup?: string;
}

export interface FirebaseAccessRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  userRole?: 'user' | 'seller' | 'vip' | 'admin' | 'owner';
  userAvatar?: string;
  reason?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  adminNote?: string;
  serviceType?: 'calling' | 'storage' | 'all';
}

export interface UserAccount {
  id: string;
  name: string;
  username?: string;
  bio?: string;
  phone: string;
  password?: string;
  diamonds: number;
  isBanned: boolean;
  joinedDate: string;
  role: 'user' | 'vip' | 'admin' | 'owner' | 'seller';
  sellerId?: number;
  avatar?: string;
  firebaseAccessGranted?: boolean;
  firebaseRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  linkedGoogleAccount?: GoogleDriveAccount;
}

export interface SellerWithdrawRequest {
  id: string;
  sellerId: number;
  sellerName: string;
  sellerAvatar?: string;
  sellerPhone?: string;
  amountDiamonds: number;
  bdtAmount: number;
  paymentMethod: 'bKash' | 'Nagad' | 'Rocket' | 'Upay' | 'Bank';
  accountNumber: string;
  accountType?: 'Personal' | 'Agent';
  note?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  adminTrxId?: string;
  adminNote?: string;
  processedAt?: string;
}
