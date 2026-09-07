import React, { useState, useEffect, useRef } from 'react';
import {
  Store,
  User,
  ShoppingBag,
  MessageSquare,
  Gem,
  CheckCircle,
  Clock,
  Send,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Edit3,
  Phone,
  ExternalLink,
  ShieldCheck,
  Star,
  DollarSign,
  TrendingUp,
  Sliders,
  Check,
  X,
  Radio,
  ArrowLeft,
  Zap,
  ArrowUpRight,
  Wallet,
  Building2,
  Smartphone,
  AlertCircle,
  Copy,
  History,
  MapPin,
  Compass,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Mic,
  Calendar,
  CalendarDays,
  RotateCcw,
  Unlock,
  Lock,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  RefreshCw,
  Sun,
  Moon,
  Flame,
  Layers,
  Settings2,
} from 'lucide-react';
import { Developer, ServiceOrder, ChatMessage, UserAccount, SellerWithdrawRequest, DailyTimeSlot, DayAvailabilitySchedule, SiteConfig } from '../types';
import { sounds } from '../utils/sound';
import { compressImage } from '../utils/imageCompressor';
import { LiveLocationModal } from './LiveLocationModal';
import { MeteredVideoModal } from './MeteredVideoModal';
import { locationService } from '../utils/locationService';
import { webrtcVoice } from '../utils/webrtc';
import { voiceRecorder } from '../utils/voiceRecorder';
import { realtimeBus } from '../utils/realtime';
import { Video } from 'lucide-react';

interface SellerPortalProps {
  seller: Developer;
  sellerAccount?: UserAccount;
  orders: ServiceOrder[];
  chatMessages: ChatMessage[];
  withdrawRequests?: SellerWithdrawRequest[];
  onUpdateSellerProfile: (updated: Partial<Developer>) => void;
  onUpdateOrderStatus: (orderId: string, status: ServiceOrder['status'], note?: string) => void;
  onSendMessage: (text: string, developerId?: number, attachment?: any) => void;
  onRequestWithdraw?: (req: {
    amountDiamonds: number;
    bdtAmount: number;
    paymentMethod: 'bKash' | 'Nagad' | 'Rocket' | 'Upay' | 'Bank';
    accountNumber: string;
    accountType: 'Personal' | 'Agent';
    note?: string;
  }) => void;
  onBackToMarketplace?: () => void;
  siteConfig?: SiteConfig;
}

export const SellerPortal: React.FC<SellerPortalProps> = ({
  seller,
  sellerAccount,
  orders,
  chatMessages,
  withdrawRequests = [],
  onUpdateSellerProfile,
  onUpdateOrderStatus,
  onSendMessage,
  onRequestWithdraw,
  onBackToMarketplace,
  siteConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'slots' | 'orders' | 'chat' | 'earnings'>('profile');

  // Profile Editor state
  const [name, setName] = useState(seller.name);
  const [username, setUsername] = useState(seller.username || sellerAccount?.username || '');
  const [service, setService] = useState(seller.service);
  const [category, setCategory] = useState<Developer['category']>(seller.category || 'app');
  const [price, setPrice] = useState(seller.price.toString());
  const [bio, setBio] = useState(seller.bio || '');
  const [skills, setSkills] = useState(seller.skills ? seller.skills.join(', ') : '');
  const [phone, setPhone] = useState(seller.phone || sellerAccount?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(seller.avatar || sellerAccount?.avatar || '');
  const [isOnline, setIsOnline] = useState(seller.online);
  const [diamondPerHour, setDiamondPerHour] = useState(seller.diamondPerHour?.toString() || '100');
  const [voiceIntroText, setVoiceIntroText] = useState(seller.voiceIntroText || '');
  const [voiceIntroDuration, setVoiceIntroDuration] = useState(seller.voiceIntroDuration || '0:20');
  const [voiceIntroUrl, setVoiceIntroUrl] = useState<string>(seller.voiceIntroUrl || '');
  const [isRecordingIntroVoice, setIsRecordingIntroVoice] = useState(false);
  const [introVoiceSeconds, setIntroVoiceSeconds] = useState(0);
  const [isPlayingIntroAudio, setIsPlayingIntroAudio] = useState(false);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const introVoiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const introRecordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // === Daily Slot & Availability Manager State ===
  const [activeScheduleDateKey, setActiveScheduleDateKey] = useState<string>('today');
  const [isTimeSaleActive, setIsTimeSaleActive] = useState<boolean>(seller.isTimeSaleActive ?? true);
  const [slotFeedback, setSlotFeedback] = useState<string | null>(null);

  // Metered HD Video Meeting modal
  const [isMeteredVideoOpen, setIsMeteredVideoOpen] = useState(false);

  // Helper to generate slots for a day
  const generateSlotsForDay = (
    hoursCount: number,
    startHour24: number = 10,
    priceDiamonds: number = 100,
    dateKey: string = 'today'
  ): DailyTimeSlot[] => {
    const formatSlotHour = (h: number) => {
      const period = h >= 12 && h < 24 ? 'PM' : 'AM';
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      return `${hour12.toString().padStart(2, '0')}:00 ${period}`;
    };

    const slots: DailyTimeSlot[] = [];
    for (let i = 0; i < hoursCount; i++) {
      const slotStartH = (startHour24 + i) % 24;
      const slotEndH = (startHour24 + i + 1) % 24;
      const range = `${formatSlotHour(slotStartH)} - ${formatSlotHour(slotEndH)}`;
      slots.push({
        id: `slot_${dateKey}_${i + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        slotNumber: i + 1,
        timeRange: range,
        startTime: formatSlotHour(slotStartH),
        endTime: formatSlotHour(slotEndH),
        isBooked: false,
        diamonds: priceDiamonds,
        dateKey,
      });
    }
    return slots;
  };

  // Build initial schedules
  const [schedules, setSchedules] = useState<DayAvailabilitySchedule[]>(() => {
    if (seller.dailySchedules && seller.dailySchedules.length > 0) {
      return seller.dailySchedules;
    }
    const todayHrs = seller.maxAvailableHours || 10;
    const rate = seller.diamondPerHour || 100;
    const initialTodaySlots: DailyTimeSlot[] =
      seller.customSlots && seller.customSlots.length > 0
        ? seller.customSlots
        : generateSlotsForDay(todayHrs, 10, rate, 'today');

    // Attach existing booked slots if any
    const booked = seller.bookedHours || 0;
    if (booked > 0 && seller.bookedSlots) {
      initialTodaySlots.forEach((slot) => {
        const matchingBooked = seller.bookedSlots?.find((b) => b.slotNumber === slot.slotNumber);
        if (matchingBooked) {
          slot.isBooked = true;
          slot.bookedByUserId = matchingBooked.userId;
          slot.bookedByUserName = matchingBooked.userName;
          slot.bookedByUserAvatar = matchingBooked.userAvatar;
          slot.bookedAt = matchingBooked.bookedAt;
        } else if (slot.slotNumber <= booked) {
          slot.isBooked = true;
          slot.bookedByUserName = 'গ্রাহক বুকড';
        }
      });
    }

    return [
      {
        dateKey: 'today',
        dayLabel: 'আজকের দিন (Today)',
        totalWorkingHours: todayHrs,
        isActive: true,
        customSlots: initialTodaySlots,
      },
      {
        dateKey: 'tomorrow',
        dayLabel: 'আগামীকাল (Tomorrow)',
        totalWorkingHours: 6,
        isActive: true,
        customSlots: generateSlotsForDay(6, 11, rate, 'tomorrow'),
      },
      {
        dateKey: 'day_after',
        dayLabel: 'পরবর্তী দিন (Day After)',
        totalWorkingHours: 8,
        isActive: true,
        customSlots: generateSlotsForDay(8, 10, rate, 'day_after'),
      },
    ];
  });

  // Modal State for Custom Slot Creation & Editing
  const [isAddSlotModalOpen, setIsAddSlotModalOpen] = useState(false);
  const [newSlotStartTime, setNewSlotStartTime] = useState('08:00 PM');
  const [newSlotEndTime, setNewSlotEndTime] = useState('09:00 PM');
  const [newSlotPrice, setNewSlotPrice] = useState('100');

  const [editingSlot, setEditingSlot] = useState<DailyTimeSlot | null>(null);
  const [editSlotTimeRange, setEditSlotTimeRange] = useState('');
  const [editSlotPrice, setEditSlotPrice] = useState('100');

  // Sync state whenever seller or sellerAccount changes & register real-time routing aliases
  useEffect(() => {
    if (seller) {
      // Register seller aliases for strict targeted calls and messages
      const aliases = [`dev_${seller.id}`];
      if (seller.username) aliases.push(`user_${seller.username}`);
      if (sellerAccount?.id) aliases.push(sellerAccount.id);
      realtimeBus.addUserAlias(`dev_${seller.id}`);
      if (seller.username) realtimeBus.addUserAlias(seller.username);

      setName(seller.name || '');
      setUsername(seller.username || sellerAccount?.username || '');
      setService(seller.service || '');
      setCategory(seller.category || 'app');
      setPrice((seller.price || 100).toString());
      setBio(seller.bio || '');
      setSkills(seller.skills ? seller.skills.join(', ') : '');
      setPhone(seller.phone || sellerAccount?.phone || '');
      setAvatarUrl(seller.avatar || sellerAccount?.avatar || '');
      setIsOnline(seller.online ?? true);
      setDiamondPerHour((seller.diamondPerHour || 100).toString());
      setVoiceIntroText(seller.voiceIntroText || '');
      setVoiceIntroDuration(seller.voiceIntroDuration || '0:20');
      setVoiceIntroUrl(seller.voiceIntroUrl || '');
      setIsTimeSaleActive(seller.isTimeSaleActive ?? true);

      if (seller.dailySchedules && seller.dailySchedules.length > 0) {
        setSchedules(seller.dailySchedules);
      }

      if (!withdrawAccountNum) {
        setWithdrawAccountNum(seller.phone || sellerAccount?.phone || '');
      }
    }
  }, [seller, sellerAccount]);

  // Chat state
  const [chatText, setChatText] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Seller Voice Note & Audio State
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveRecordLevels, setLiveRecordLevels] = useState<number[]>([30, 60, 45, 80, 50, 75, 40, 65]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordWaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to audio playback updates
  useEffect(() => {
    const unsub = voiceRecorder.onPlaybackChange((activeId, prog) => {
      setPlayingVoiceId(activeId);
      setPlaybackProgress(prog);
    });
    return () => {
      unsub();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordWaveTimerRef.current) clearInterval(recordWaveTimerRef.current);
    };
  }, []);

  // Live Location Modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [trackedCustomerId, setTrackedCustomerId] = useState<string | undefined>(undefined);
  const [trackedCustomerName, setTrackedCustomerName] = useState('কাস্টমার');

  // Diamond Withdraw State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('100');
  const [withdrawMethod, setWithdrawMethod] = useState<'bKash' | 'Nagad' | 'Rocket' | 'Upay' | 'Bank'>('bKash');
  const [withdrawAccountNum, setWithdrawAccountNum] = useState(seller.phone || sellerAccount?.phone || '');
  const [withdrawAccountType, setWithdrawAccountType] = useState<'Personal' | 'Agent'>('Personal');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available seller balance
  const currentSellerDiamonds = sellerAccount?.diamonds ?? seller.totalEarningsDiamonds ?? 500;
  const thisSellerWithdrawRequests = withdrawRequests.filter((r) => r.sellerId === seller.id);

  // Filter orders for this seller
  const sellerOrders = orders.filter((o) => o.developerId === seller.id);
  const pendingOrders = sellerOrders.filter((o) => o.status === 'pending');
  const inProgressOrders = sellerOrders.filter((o) => o.status === 'in_progress');
  const completedOrders = sellerOrders.filter((o) => o.status === 'completed');

  // Filter chat messages for this seller
  const sellerMessages = chatMessages.filter(
    (m) => m.developerId === seller.id || m.senderName === seller.name
  );

  // Extract distinct active customer conversations with this seller
  const customerContacts = React.useMemo(() => {
    const map = new Map<string, { userId: string; userName: string; lastMessage: string; lastTimestamp: string; count: number }>();
    
    // Check messages
    sellerMessages.forEach((msg) => {
      if (msg.sender !== 'developer' && msg.senderUserId && msg.senderUserId !== `USR-SELLER-${seller.id}`) {
        const existing = map.get(msg.senderUserId);
        if (!existing) {
          map.set(msg.senderUserId, {
            userId: msg.senderUserId,
            userName: msg.senderName || 'কাস্টমার',
            lastMessage: msg.text || 'ফাইল/ভয়েস পাঠিয়েছেন',
            lastTimestamp: msg.timestamp || '',
            count: 1,
          });
        } else {
          existing.count++;
          existing.lastMessage = msg.text || existing.lastMessage;
          existing.lastTimestamp = msg.timestamp || existing.lastTimestamp;
        }
      }
    });

    // Check orders
    sellerOrders.forEach((o) => {
      if (o.userId && !map.has(o.userId)) {
        map.set(o.userId, {
          userId: o.userId,
          userName: o.userName || 'কাস্টমার',
          lastMessage: `অর্ডার #${o.id} (${o.serviceName})`,
          lastTimestamp: o.date || '',
          count: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [sellerMessages, sellerOrders, seller.id]);

  // Handle Photo Upload with Client-Side Compression (< 300KB)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.8,
          targetMaxBytes: 300 * 1024,
        });
        if (compressed?.dataUrl) {
          setAvatarUrl(compressed.dataUrl);
          sounds.playSuccess();
        }
      } catch (err) {
        console.warn('Failed to compress avatar:', err);
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setAvatarUrl(reader.result);
            sounds.playSuccess();
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const skillsArray = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onUpdateSellerProfile({
      name: name.trim(),
      username: username.trim(),
      service: service.trim(),
      category: category.trim(),
      price: parseInt(price) || 100,
      bio: bio.trim(),
      skills: skillsArray,
      phone: phone.trim(),
      avatar: avatarUrl || undefined,
      online: isOnline,
      diamondPerHour: parseInt(diamondPerHour) || 100,
      voiceIntroUrl: voiceIntroUrl || undefined,
      voiceIntroText: voiceIntroText.trim(),
      voiceIntroDuration: voiceIntroDuration.trim() || '0:20',
    });

    setIsSaved(true);
    sounds.playSuccess();
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleStartIntroRecording = async () => {
    sounds.playVoiceRecord();
    setIsRecordingIntroVoice(true);
    setIntroVoiceSeconds(0);
    await voiceRecorder.startRecording();
    if (introRecordTimerRef.current) clearInterval(introRecordTimerRef.current);
    introRecordTimerRef.current = setInterval(() => {
      setIntroVoiceSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleStopIntroRecording = async () => {
    if (introRecordTimerRef.current) {
      clearInterval(introRecordTimerRef.current);
      introRecordTimerRef.current = null;
    }
    setIsRecordingIntroVoice(false);
    const voiceNote = await voiceRecorder.stopRecording();
    if (voiceNote?.dataUrl) {
      setVoiceIntroUrl(voiceNote.dataUrl);
      const mins = Math.floor(voiceNote.duration / 60);
      const remSecs = voiceNote.duration % 60;
      setVoiceIntroDuration(`${mins}:${remSecs.toString().padStart(2, '0')}`);
      sounds.playSuccess();
    }
  };

  const handleCancelIntroRecording = () => {
    if (introRecordTimerRef.current) {
      clearInterval(introRecordTimerRef.current);
      introRecordTimerRef.current = null;
    }
    voiceRecorder.cancelRecording();
    setIsRecordingIntroVoice(false);
    setIntroVoiceSeconds(0);
    sounds.playCancel();
  };

  const handleIntroAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setVoiceIntroUrl(dataUrl);
        const tempAudio = new Audio();
        tempAudio.src = dataUrl;
        tempAudio.onloadedmetadata = () => {
          const secs = Math.round(tempAudio.duration || 15);
          const mins = Math.floor(secs / 60);
          const remSecs = secs % 60;
          setVoiceIntroDuration(`${mins}:${remSecs.toString().padStart(2, '0')}`);
        };
        sounds.playSuccess();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTogglePlayIntroAudio = () => {
    sounds.playClick();
    if (isPlayingIntroAudio) {
      if (introAudioRef.current) {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
      }
      setIsPlayingIntroAudio(false);
      return;
    }

    if (voiceIntroUrl) {
      if (!introAudioRef.current) {
        introAudioRef.current = new Audio();
      }
      introAudioRef.current.src = voiceIntroUrl;
      introAudioRef.current.onended = () => setIsPlayingIntroAudio(false);
      introAudioRef.current.onerror = () => {
        setIsPlayingIntroAudio(false);
        handleTestVoice();
      };
      introAudioRef.current
        .play()
        .then(() => {
          setIsPlayingIntroAudio(true);
        })
        .catch(() => {
          handleTestVoice();
        });
      return;
    }

    handleTestVoice();
  };

  const handleTestVoice = () => {
    sounds.playClick();
    if (isPlayingTestVoice) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsPlayingTestVoice(false);
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToSpeak =
        voiceIntroText.trim() ||
        `হ্যালো! আমি ${name.trim() || 'হোস্ট'}। আমার সাথে লাইভ চ্যাট ও ভয়েস কলে যুক্ত হতে স্লট বুক করুন।`;
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'bn-BD';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;

      utterance.onstart = () => setIsPlayingTestVoice(true);
      utterance.onend = () => setIsPlayingTestVoice(false);
      utterance.onerror = () => setIsPlayingTestVoice(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleTogglePlayVoice = (msgId: string, audioUrl?: string) => {
    sounds.playClick();
    if (audioUrl) {
      voiceRecorder.playVoiceNote(msgId, audioUrl);
    } else {
      if (playingVoiceId === msgId) {
        voiceRecorder.stopPlayback();
      } else {
        voiceRecorder.playVoiceNote(msgId, '');
      }
    }
  };

  const handleStartVoiceRecording = async () => {
    sounds.playVoiceRecord();
    setIsRecordingVoice(true);
    setRecordSeconds(0);

    await voiceRecorder.startRecording();

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);

    if (recordWaveTimerRef.current) clearInterval(recordWaveTimerRef.current);
    recordWaveTimerRef.current = setInterval(() => {
      setLiveRecordLevels(voiceRecorder.getRecordingLiveLevels());
    }, 120);
  };

  const handleCancelVoiceRecording = () => {
    sounds.playCancel();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (recordWaveTimerRef.current) clearInterval(recordWaveTimerRef.current);
    voiceRecorder.cancelRecording();
    setIsRecordingVoice(false);
    setRecordSeconds(0);
  };

  const handleSendVoiceRecording = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (recordWaveTimerRef.current) clearInterval(recordWaveTimerRef.current);
    sounds.playSend();

    const recorded = await voiceRecorder.stopRecording();
    const duration = recorded.duration || recordSeconds || 1;
    setIsRecordingVoice(false);
    setRecordSeconds(0);

    onSendMessage(
      `🎙️ [${seller.name} - সেলার]: ভয়েস নোট`,
      seller.id,
      {
        type: 'voice',
        url: recorded.dataUrl,
        duration,
        name: `ভয়েস নোট (${duration}s)`,
      }
    );
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendMessage(`[${seller.name} - সেলার]: ${chatText.trim()}`, seller.id);
    setChatText('');
    sounds.playSuccess();
  };

  // === Daily Slot & Availability Manager Handlers ===
  const activeSchedule = schedules.find((s) => s.dateKey === activeScheduleDateKey) || schedules[0];
  const activeSlots = activeSchedule?.customSlots || [];
  const bookedSlotsCount = activeSlots.filter((s) => s.isBooked).length;
  const availableSlotsCount = activeSlots.length - bookedSlotsCount;

  // Change working hours for a specific day schedule
  const handleUpdateWorkingHours = (dayKey: string, newHours: number) => {
    const rate = parseInt(diamondPerHour) || 100;
    const clampedHours = Math.max(1, Math.min(24, newHours));
    sounds.playClick();

    setSchedules((prev) => {
      const next = prev.map((s) => {
        if (s.dateKey !== dayKey) return s;
        const currentSlots = s.customSlots || [];
        let updatedSlots: DailyTimeSlot[];
        if (clampedHours > currentSlots.length) {
          const additional = generateSlotsForDay(
            clampedHours - currentSlots.length,
            10 + currentSlots.length,
            rate,
            dayKey
          );
          const combined = [...currentSlots, ...additional].map((slot, idx) => ({
            ...slot,
            slotNumber: idx + 1,
          }));
          updatedSlots = combined;
        } else {
          updatedSlots = currentSlots.slice(0, clampedHours);
        }

        return {
          ...s,
          totalWorkingHours: clampedHours,
          customSlots: updatedSlots,
        };
      });

      // If updating today, auto sync to seller profile immediately
      if (dayKey === 'today') {
        const todaySched = next.find((s) => s.dateKey === 'today');
        if (todaySched) {
          const updatedSlots = todaySched.customSlots || [];
          const bookedCount = updatedSlots.filter((slot) => slot.isBooked).length;
          onUpdateSellerProfile({
            dailySchedules: next,
            customSlots: updatedSlots,
            maxAvailableHours: clampedHours,
            bookedHours: bookedCount,
            diamondPerHour: rate,
            isTimeSaleActive: isTimeSaleActive,
          });
          realtimeBus.broadcast('SLOT_AVAILABILITY_UPDATED', {
            id: seller.id,
            ...seller,
            dailySchedules: next,
            customSlots: updatedSlots,
            maxAvailableHours: clampedHours,
            bookedHours: bookedCount,
          });
        }
      }

      return next;
    });

    setSlotFeedback(`সফলভাবে ${dayKey === 'today' ? 'আজকের' : 'আগামীকালের'} কাজের সময় ${clampedHours} ঘণ্টায় সেট ও সেভ করা হয়েছে।`);
    setTimeout(() => setSlotFeedback(null), 3000);
  };

  // Release a specific booked slot
  const handleReleaseSlot = (slotId: string) => {
    sounds.playSuccess();
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.dateKey !== activeScheduleDateKey) return s;
        const updated = (s.customSlots || []).map((slot) => {
          if (slot.id === slotId) {
            return {
              ...slot,
              isBooked: false,
              bookedByUserId: undefined,
              bookedByUserName: undefined,
              bookedByUserAvatar: undefined,
              bookedAt: undefined,
              orderId: undefined,
            };
          }
          return slot;
        });
        return { ...s, customSlots: updated };
      })
    );
    setSlotFeedback('স্লটটি সফলভাবে রিলিজ করা হয়েছে এবং কাস্টমারদের জন্য ওপেন করা হয়েছে!');
    setTimeout(() => setSlotFeedback(null), 3000);
  };

  // Reset & Release All Booked Slots for active day
  const handleResetAllSlots = (dayKey: string) => {
    sounds.playReceive();
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.dateKey !== dayKey) return s;
        const updated = (s.customSlots || []).map((slot) => ({
          ...slot,
          isBooked: false,
          bookedByUserId: undefined,
          bookedByUserName: undefined,
          bookedByUserAvatar: undefined,
          bookedAt: undefined,
          orderId: undefined,
        }));
        return {
          ...s,
          customSlots: updated,
          lastResetAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        };
      })
    );
    setSlotFeedback('সব স্লট সফলভাবে রিসেট ও রিলিজ করা হয়েছে! সকল স্লট এখন খালি ও বুকিংয়ের জন্য উন্মুক্ত।');
    setTimeout(() => setSlotFeedback(null), 3000);
  };

  // Add new custom slot
  const handleAddNewSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotStartTime.trim() || !newSlotEndTime.trim()) return;

    sounds.playSuccess();
    const priceVal = parseInt(newSlotPrice) || parseInt(diamondPerHour) || 100;
    const rangeStr = `${newSlotStartTime.trim()} - ${newSlotEndTime.trim()}`;

    setSchedules((prev) =>
      prev.map((s) => {
        if (s.dateKey !== activeScheduleDateKey) return s;
        const current = s.customSlots || [];
        const nextNum = current.length + 1;
        const newSlot: DailyTimeSlot = {
          id: `slot_${activeScheduleDateKey}_custom_${Date.now()}`,
          slotNumber: nextNum,
          timeRange: rangeStr,
          startTime: newSlotStartTime.trim(),
          endTime: newSlotEndTime.trim(),
          isBooked: false,
          diamonds: priceVal,
          dateKey: activeScheduleDateKey,
        };
        return {
          ...s,
          totalWorkingHours: current.length + 1,
          customSlots: [...current, newSlot],
        };
      })
    );

    setIsAddSlotModalOpen(false);
    setSlotFeedback(`নতুন কাস্টম স্লট (${rangeStr}) সফলভাবে যোগ করা হয়েছে!`);
    setTimeout(() => setSlotFeedback(null), 3000);
  };

  // Edit slot time or price
  const handleSaveEditSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !editSlotTimeRange.trim()) return;

    sounds.playSuccess();
    const priceVal = parseInt(editSlotPrice) || editingSlot.diamonds || 100;

    setSchedules((prev) =>
      prev.map((s) => {
        if (s.dateKey !== activeScheduleDateKey) return s;
        const updated = (s.customSlots || []).map((slot) => {
          if (slot.id === editingSlot.id) {
            return {
              ...slot,
              timeRange: editSlotTimeRange.trim(),
              diamonds: priceVal,
            };
          }
          return slot;
        });
        return { ...s, customSlots: updated };
      })
    );

    setEditingSlot(null);
    setSlotFeedback('স্লট সফলভাবে এডিট ও আপডেট করা হয়েছে!');
    setTimeout(() => setSlotFeedback(null), 3000);
  };

  // Delete a slot
  const handleDeleteSlot = (slotId: string) => {
    sounds.playCancel();
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.dateKey !== activeScheduleDateKey) return s;
        const filtered = (s.customSlots || [])
          .filter((slot) => slot.id !== slotId)
          .map((slot, idx) => ({ ...slot, slotNumber: idx + 1 }));
        return {
          ...s,
          totalWorkingHours: filtered.length,
          customSlots: filtered,
        };
      })
    );
    setSlotFeedback('স্লটটি মুছে ফেলা হয়েছে।');
    setTimeout(() => setSlotFeedback(null), 3000);
  };

  // Generate tomorrow fresh slots
  const handleGenerateTomorrowFreshSlots = (hours: number = 6) => {
    sounds.playSuccess();
    const rate = parseInt(diamondPerHour) || 100;
    const freshTomorrowSlots = generateSlotsForDay(hours, 11, rate, 'tomorrow');

    setSchedules((prev) => {
      const exists = prev.some((s) => s.dateKey === 'tomorrow');
      if (exists) {
        return prev.map((s) =>
          s.dateKey === 'tomorrow'
            ? {
                ...s,
                totalWorkingHours: hours,
                isActive: true,
                customSlots: freshTomorrowSlots,
                lastResetAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
              }
            : s
        );
      }
      return [
        ...prev,
        {
          dateKey: 'tomorrow',
          dayLabel: 'আগামীকাল (Tomorrow)',
          totalWorkingHours: hours,
          isActive: true,
          customSlots: freshTomorrowSlots,
        },
      ];
    });

    setActiveScheduleDateKey('tomorrow');
    setSlotFeedback(`আগামীকালের জন্য ফ্রেশ ${hours} ঘণ্টার স্লট তৈরি করা হয়েছে!`);
    setTimeout(() => setSlotFeedback(null), 3000);
  };

  // Save All Schedules & Broadcast Live
  const handleSaveAvailabilityAndSync = () => {
    sounds.playSuccess();
    const todaySched = schedules.find((s) => s.dateKey === 'today') || schedules[0];
    const todaySlots = todaySched?.customSlots || [];
    const bookedCount = todaySlots.filter((s) => s.isBooked).length;
    const totalHrs = todaySched?.totalWorkingHours || todaySlots.length || 10;

    const updatedData: Partial<Developer> = {
      dailySchedules: schedules,
      customSlots: todaySlots,
      maxAvailableHours: totalHrs,
      bookedHours: bookedCount,
      isTimeSaleActive: isTimeSaleActive,
      diamondPerHour: parseInt(diamondPerHour) || 100,
    };

    onUpdateSellerProfile(updatedData);

    // Broadcast in real-time
    realtimeBus.broadcast('SLOT_AVAILABILITY_UPDATED', {
      id: seller.id,
      ...seller,
      ...updatedData,
    });

    setSlotFeedback('✅ দৈনিক স্লট ও অ্যাভেলেবিলিটি সফলভাবে সেভ হয়েছে এবং কাস্টমারদের জন্য লাইভ করা হয়েছে!');
    setTimeout(() => setSlotFeedback(null), 3500);
  };

  return (
    <div className="space-y-4 pb-20 animate-fadeIn text-slate-100">
      {/* Top Seller Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            {/* Avatar with live photo */}
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 overflow-hidden">
                <img
                  src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seller.name}`}
                  alt={seller.name}
                  className="w-full h-full object-cover rounded-2xl bg-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="ছবি পরিবর্তন করুন"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-md transition cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">{seller.name}</h2>
                <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-black uppercase rounded-full">
                  🛍️ সেলার শপ
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {username || `@seller_${seller.id}`}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-300">
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {seller.rating || 5.0} ({seller.completedOrders || 0} সার্ভিস সম্পন্ন)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newStatus = !isOnline;
                    setIsOnline(newStatus);
                    onUpdateSellerProfile({ online: newStatus });
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                  {isOnline ? 'অনলাইন' : 'অফলাইন'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats & Action */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="bg-slate-950/80 border border-amber-500/40 rounded-2xl px-3 py-2 text-right shadow-md">
              <span className="text-[10px] text-amber-300 font-semibold block">উইথড্র ব্যালেন্স</span>
              <span className="text-sm sm:text-base font-black text-amber-300 flex items-center justify-end gap-1">
                <Gem className="w-4 h-4 text-amber-400 animate-pulse" />
                {currentSellerDiamonds.toLocaleString()} 💎
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('earnings');
                setIsWithdrawModalOpen(true);
              }}
              className="px-3 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-black rounded-2xl transition flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
              title="ওনারের কাছে ডায়মন্ড ক্যাশআউট রিকোয়েস্ট পাঠান"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>উইথড্র</span>
            </button>

            {onBackToMarketplace && (
              <button
                type="button"
                onClick={onBackToMarketplace}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-2xl transition flex items-center gap-1.5 cursor-pointer shadow"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>মার্কেটপ্লেস</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation for Seller Portal */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>শপ প্রোফাইল ও সেটিংস</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('slots')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'slots'
                ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 shadow-md shadow-lime-500/20'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-lime-400" />
            <span>🕒 দৈনিক স্লট ও সময়</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-900 text-lime-300 font-mono font-bold border border-lime-500/30">
              {availableSlotsCount} খালি
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>কাস্টমার অর্ডার</span>
            {pendingOrders.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                {pendingOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>লাইভ চ্যাট ইনবক্স</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('earnings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'earnings'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ইনকাম ও উইথড্র</span>
            {thisSellerWithdrawRequests.some((r) => r.status === 'pending') && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>
        </div>
      </div>

      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* TAB 1: Shop Profile Builder */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <Store className="w-4 h-4 text-cyan-400" />
                <span>সেলার শপ ও প্রোফাইল তৈরি / এডিট</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                আপনার নাম, ছবি, সার্ভিস বিবরণ ও ডায়মন্ড রেট কাস্টমাইজ করুন।
              </p>
            </div>
            {isSaved && (
              <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1 animate-bounce">
                <Check className="w-3.5 h-3.5" /> সংরক্ষিত হয়েছে
              </span>
            )}
          </div>

          {/* Image Upload Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>প্রোফাইল পিকচার / লোগো:</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-slate-600" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ডিভাইস থেকে ছবি আপলোড করুন</span>
                </button>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="অথবা ইমেজ URL দিন (https://...)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Name & Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                আপনার নাম / শপের নাম:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: Alex বা David"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ইউজারনেম (Handle):
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="যেমন: @alex_host"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Service Title & Category (Top Red Box) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                সার্ভিস টাইটেল / উপাধি (প্রোফাইলের শীর্ষে দেখাবে):
              </label>
              <input
                type="text"
                required
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="যেমন: প্রিমিয়াম ভিআইপি ভয়েস ও প্রাইভেট চ্যাট কানেকশন"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                সার্ভিস ক্যাটাগরি (হাতে লিখুন বা বেছে নিন):
              </label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="যেমন: Voice Host, Private Chat, Bot..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-cyan-300 font-bold focus:outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: '🎙️ Voice Host', val: 'Voice Host' },
                    { label: '💬 Private Chat', val: 'Private Chat' },
                    { label: '🤖 Consultant Bot', val: 'bot' },
                    { label: '🌐 Web/App', val: 'web' },
                    { label: '🎨 Design', val: 'graphics' },
                  ].map((catItem) => (
                    <button
                      key={catItem.val}
                      type="button"
                      onClick={() => setCategory(catItem.val)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md transition cursor-pointer"
                    >
                      {catItem.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Price & Diamond Per Hour */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                সার্ভিস মূল্য (ডায়মন্ড 💎):
              </label>
              <input
                type="number"
                min="10"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-amber-300 font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ঘণ্টা প্রতি রেট (💎/ঘণ্টা):
              </label>
              <input
                type="number"
                min="10"
                value={diamondPerHour}
                onChange={(e) => setDiamondPerHour(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-amber-300 font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Bio / Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              শপ বায়ো / সার্ভিস বিবরণ:
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="আপনার সার্ভিস সম্পর্কে বিস্তারিত লিখুন..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          {/* 🎙️ Voice Intro / Voice Greeting Studio (Second Red Box) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/60 via-slate-950 to-indigo-950/60 border border-cyan-500/40 space-y-3 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span>সেলার নিজস্ব ভয়েস অডিও ও পরিচিতি (Voice Intro):</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
                {voiceIntroUrl ? `🎙️ অডিও সংযুক্ত (${voiceIntroDuration || '0:20'})` : '⚪ অডিও খালি'}
              </span>
            </div>

            {/* Voice Recording & Audio File Upload Actions */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Live Mic Recorder Button */}
                {!isRecordingIntroVoice ? (
                  <button
                    type="button"
                    onClick={handleStartIntroRecording}
                    className="py-2 px-3.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20 active:scale-95 transition cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>মাইক্রোফোনে নিজের কণ্ঠে রেকর্ড করুন</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2 bg-rose-950/90 border border-rose-500/50 px-3 py-1.5 rounded-xl text-rose-300 text-xs font-bold animate-pulse">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>রেকর্ড হচ্ছে... {introVoiceSeconds}s</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopIntroRecording}
                      className="py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold flex items-center gap-1 shadow transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>রেকর্ড শেষ করুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelIntroRecording}
                      className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                  </div>
                )}

                {/* 2. Audio File Upload Button */}
                <label className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 active:scale-95 transition cursor-pointer">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>অডিও ফাইল আপলোড (.mp3 / .wav / .m4a)</span>
                  <input
                    ref={introVoiceFileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus"
                    onChange={handleIntroAudioUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Audio Preview Strip if Audio exists */}
              {voiceIntroUrl && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePlayIntroAudio}
                      className="w-8 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center transition cursor-pointer shrink-0 shadow-md shadow-cyan-500/20"
                      title="অডিও শুনুন"
                    >
                      {isPlayingIntroAudio ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                    </button>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        {isPlayingIntroAudio ? '▶️ অডিও বাজছে...' : '🎵 ভয়েস অডিও প্রস্তুত'}
                      </span>
                      <span className="text-[10px] text-cyan-400 font-mono">
                        সময়: {voiceIntroDuration || '0:20'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isPlayingIntroAudio && introAudioRef.current) {
                        introAudioRef.current.pause();
                        setIsPlayingIntroAudio(false);
                      }
                      setVoiceIntroUrl('');
                      sounds.playCancel();
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    🗑️ অডিও মুছুন
                  </button>
                </div>
              )}
            </div>

            {/* Voice Script Text */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300">
                  ভয়েস মেসেজের বিবরণ / বার্তা (Script):
                </label>
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>{isPlayingTestVoice ? 'থামান' : 'টেক্সট-টু-স্পিচ টেস্ট'}</span>
                </button>
              </div>
              <textarea
                rows={2}
                value={voiceIntroText}
                onChange={(e) => setVoiceIntroText(e.target.value)}
                placeholder="হ্যালো! আমি হোস্ট। লাইভ চ্যাট ও অডিও কলে কথা বলতে সময় বুক করুন..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400">
                💡 গ্রাহকরা হোমপেজে বা প্রোফাইলে ঢুকলে আপনার আসল রেকর্ড করা কণ্ঠ শুনতে পারবে।
              </p>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              মোবাইল নম্বর / পাসওয়ার্ড নম্বর:
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="017XXXXXXXX"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/25 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <Check className="w-4 h-4" />
            <span>শপ প্রোফাইল আপডেট সংরক্ষণ করুন</span>
          </button>
        </form>
      )}

      {/* TAB: Daily Slot & Availability Manager */}
      {activeTab === 'slots' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5">
          {/* Header & Master Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lime-500/20 text-lime-400 border border-lime-500/40 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                    <span>🕒 দৈনিক স্লট ও অ্যাভেলেবিলিটি ম্যানেজার</span>
                    <span className="text-[10px] bg-lime-500/20 border border-lime-500/40 text-lime-300 px-2 py-0.5 rounded-full font-mono font-bold">
                      LIVE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    প্রতিদিনের কাজের সময়সূচি নির্ধারণ করুন, বুকড স্লট রিলিজ ও রিসেট করুন এবং কাস্টম টাইম স্লট ম্যানেজ করুন।
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setIsTimeSaleActive(!isTimeSaleActive);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  isTimeSaleActive
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20'
                    : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                }`}
                title={isTimeSaleActive ? 'বুকিং চালু আছে' : 'বুকিং বন্ধ আছে'}
              >
                <span className={`w-2 h-2 rounded-full ${isTimeSaleActive ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
                <span>{isTimeSaleActive ? '🟢 বুকিং চালু' : '🔴 বুকিং বন্ধ'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAvailabilityAndSync}
                className="px-4 py-2 bg-gradient-to-r from-lime-400 via-emerald-400 to-green-500 hover:from-lime-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>সংরক্ষণ ও লাইভ আপডেট</span>
              </button>
            </div>
          </div>

          {/* Real-time Feedback Toast */}
          {slotFeedback && (
            <div className="p-3 bg-gradient-to-r from-lime-950/90 via-emerald-950/80 to-slate-950 border border-lime-500/50 rounded-2xl text-lime-300 text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-md">
              <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
              <span>{slotFeedback}</span>
            </div>
          )}

          {/* Day Navigation Selector (আজকের দিন / আগামীকাল / কাস্টম দিন) */}
          <div className="bg-slate-950/80 p-2 rounded-2xl border border-slate-800 flex items-center gap-2 overflow-x-auto">
            {schedules.map((schedule) => {
              const isSelected = schedule.dateKey === activeScheduleDateKey;
              const schedSlots = schedule.customSlots || [];
              const bCount = schedSlots.filter((s) => s.isBooked).length;
              const fCount = schedSlots.length - bCount;

              return (
                <button
                  key={schedule.dateKey}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setActiveScheduleDateKey(schedule.dateKey);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 shadow-md shadow-lime-500/20 font-black'
                      : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{schedule.dayLabel}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      isSelected
                        ? 'bg-slate-950/80 text-lime-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {schedule.totalWorkingHours} ঘণ্টা ({fCount} ফ্রি)
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleGenerateTomorrowFreshSlots(6)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 transition flex items-center gap-1.5 shrink-0 cursor-pointer ml-auto"
              title="আগামীকালের জন্য ফ্রেশ ৬ ঘণ্টার স্লট তৈরি করুন"
            >
              <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
              <span>+ আগামীকালের স্লট তৈরি</span>
            </button>
          </div>

          {/* Working Hours & Capacity Controller for the Selected Day */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-5 rounded-2xl border border-lime-500/30 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-lime-400 uppercase tracking-wider block">
                  ⚙️ {activeSchedule.dayLabel} - কাজের সময় নির্ধারণ
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  আজ আপনি কত ঘণ্টা কাজ করবেন? ক্লিক করে মোট কাজের ঘণ্টা নির্ধারণ করুন:
                </p>
              </div>

              {/* Working Hours Counter */}
              <div className="flex items-center gap-2 bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">নির্ধারিত সময়:</span>
                <span className="text-base sm:text-lg font-black text-lime-300 font-mono">
                  {activeSchedule.totalWorkingHours} ঘণ্টা
                </span>
              </div>
            </div>

            {/* Quick Preset Buttons for Daily Working Hours */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">দ্রুত নির্বাচন:</span>
                {[4, 6, 8, 10, 12, 14, 16, 20, 24].map((hrs) => {
                  const isActive = activeSchedule.totalWorkingHours === hrs;
                  return (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => handleUpdateWorkingHours(activeScheduleDateKey, hrs)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? 'bg-lime-400 text-slate-950 shadow-md shadow-lime-400/30 font-black scale-105'
                          : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
                      }`}
                    >
                      {hrs} ঘণ্টা
                    </button>
                  );
                })}
              </div>

              {/* Range Slider */}
              <div className="pt-2 flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">১ ঘণ্টা</span>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={activeSchedule.totalWorkingHours}
                  onChange={(e) =>
                    handleUpdateWorkingHours(activeScheduleDateKey, parseInt(e.target.value) || 1)
                  }
                  className="flex-1 accent-lime-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-xs text-slate-400 font-mono">২৪ ঘণ্টা</span>
              </div>
            </div>

            {/* Metric Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block font-semibold">মোট সময়</span>
                <span className="text-sm sm:text-base font-black text-white font-mono mt-0.5 block">
                  {activeSchedule.totalWorkingHours} ঘণ্টা
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-emerald-500/40 text-center">
                <span className="text-[10px] text-emerald-400 block font-semibold">🔒 বুকড স্লট</span>
                <span className="text-sm sm:text-base font-black text-emerald-300 font-mono mt-0.5 block">
                  {bookedSlotsCount} টি
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-lime-500/40 text-center">
                <span className="text-[10px] text-lime-400 block font-semibold">🟢 খালি স্লট</span>
                <span className="text-sm sm:text-base font-black text-lime-300 font-mono mt-0.5 block">
                  {availableSlotsCount} টি
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-amber-500/40 text-center">
                <span className="text-[10px] text-amber-400 block font-semibold">💎 ঘণ্টা রেট</span>
                <span className="text-sm sm:text-base font-black text-amber-300 font-mono mt-0.5 block">
                  {diamondPerHour} 💎
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar (Reset All Booked Slots, Add Custom Slot, Generate Next Day) */}
          <div className="flex items-center gap-2 flex-wrap justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Release & Reset All Booked Slots Button */}
              <button
                type="button"
                onClick={() => handleResetAllSlots(activeScheduleDateKey)}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="বুকিং সম্পন্ন হলে এই দিনের সব স্লট নতুন করে উন্মুক্ত করুন"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>🔄 সকল বুকড স্লট রিলিজ ও রিসেট করুন</span>
              </button>

              {/* Add Custom Slot Button */}
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setIsAddSlotModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>+ নতুন কাস্টম স্লট যোগ</span>
              </button>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-mono">
                {activeSchedule.lastResetAt ? `সর্বশেষ রিসেট: ${activeSchedule.lastResetAt}` : 'রিয়েল-টাইম সিঙ্ক একটিভ'}
              </span>
            </div>
          </div>

          {/* Interactive Slot Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-lime-400" />
                <span>স্লট তালিকা ও বিস্তারিত নিয়ন্ত্রণ ({activeSlots.length} টি স্লট)</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                যেকোনো বুকড স্লট রিলিজ করতে <strong>"রিলিজ করুন"</strong> চাপুন।
              </span>
            </div>

            {activeSlots.length === 0 ? (
              <div className="text-center py-10 bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                কোনো স্লট পাওয়া যায়নি। উপরের বাটনে ক্লিক করে কাজের সময় বা নতুন স্লট যোগ করুন।
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeSlots.map((slot) => {
                  return (
                    <div
                      key={slot.id}
                      className={`p-3.5 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between gap-3 ${
                        slot.isBooked
                          ? 'bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-950 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                          : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Slot Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                            #{slot.slotNumber}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {slot.timeRange}
                            </span>
                            <span className="text-[10px] text-amber-300 font-mono">
                              {slot.diamonds || diamondPerHour} 💎 / ঘণ্টা
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            slot.isBooked
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                              : 'bg-lime-500/20 text-lime-300 border-lime-500/40'
                          }`}
                        >
                          {slot.isBooked ? '🔒 বুকড' : '🟢 খালি'}
                        </span>
                      </div>

                      {/* Booked User Info if booked */}
                      {slot.isBooked && (
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={
                                slot.bookedByUserAvatar ||
                                `https://api.dicebear.com/7.x/adventurer/svg?seed=Slot${slot.slotNumber}`
                              }
                              alt="Booked user"
                              className="w-7 h-7 rounded-full bg-slate-800 border border-emerald-400/40 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-200 truncate block">
                                {slot.bookedByUserName || 'গ্রাহক বুকড'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {slot.bookedAt ? `বুকড সময়: ${slot.bookedAt}` : 'অ্যাক্টিভ সেশন'}
                              </span>
                            </div>
                          </div>

                          {/* Quick Release Button */}
                          <button
                            type="button"
                            onClick={() => handleReleaseSlot(slot.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black transition cursor-pointer shadow-sm shrink-0 flex items-center gap-1 active:scale-95"
                            title="এই স্লটটি রিলিজ করে নতুন কাস্টমারদের জন্য খালি করে দিন"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>রিলিজ</span>
                          </button>
                        </div>
                      )}

                      {/* Bottom Slot Action Buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              setEditingSlot(slot);
                              setEditSlotTimeRange(slot.timeRange);
                              setEditSlotPrice((slot.diamonds || diamondPerHour).toString());
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>এডিট</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            title="স্লট ডিলিট করুন"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {!slot.isBooked && (
                          <span className="text-[10px] text-lime-400/90 font-mono font-bold">
                            বুকিংয়ের জন্য রেডি ✓
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Publish CTA Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-950 to-teal-950/70 border border-lime-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-lime-400 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-md shadow-lime-400/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h5 className="text-xs sm:text-sm font-black text-white">
                  স্লট পরিবর্তন সম্পন্ন হয়েছে?
                </h5>
                <p className="text-xs text-slate-300 mt-0.5">
                  নিচের বাটনে ক্লিক করে সাথে সাথে কাস্টমারদের জন্য এই পরিবর্তন লাইভ করে দিন।
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveAvailabilityAndSync}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-lime-400 via-emerald-400 to-green-500 hover:from-lime-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>লাইভ পাবলিশ ও সেভ করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Add Custom Slot */}
      {isAddSlotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-lime-400" />
                <span>নতুন কাস্টম টাইম স্লট তৈরি</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddSlotModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewSlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">শুরুর সময়:</label>
                  <input
                    type="text"
                    value={newSlotStartTime}
                    onChange={(e) => setNewSlotStartTime(e.target.value)}
                    placeholder="e.g. 08:00 PM"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-400 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">শেষের সময়:</label>
                  <input
                    type="text"
                    value={newSlotEndTime}
                    onChange={(e) => setNewSlotEndTime(e.target.value)}
                    placeholder="e.g. 09:00 PM"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-400 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Quick Time Preset Pills */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">দ্রুত সময় নির্বাচন:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    ['08:00 PM', '09:00 PM'],
                    ['09:00 PM', '10:00 PM'],
                    ['10:00 PM', '11:00 PM'],
                    ['11:00 PM', '12:00 AM'],
                  ].map(([start, end], idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNewSlotStartTime(start);
                        setNewSlotEndTime(end);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-300 hover:border-lime-400 hover:text-lime-300 font-mono"
                    >
                      {start} - {end}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">ডায়মন্ড রেট (💎):</label>
                <input
                  type="number"
                  min="10"
                  value={newSlotPrice}
                  onChange={(e) => setNewSlotPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-lime-400"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSlotModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-500 text-slate-950 text-xs font-black shadow-md shadow-lime-500/20 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>স্লট তৈরি করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>স্লট #{editingSlot.slotNumber} এডিট ও পরিবর্তন</span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSlot} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">সময়সীমা (Time Range):</label>
                <input
                  type="text"
                  value={editSlotTimeRange}
                  onChange={(e) => setEditSlotTimeRange(e.target.value)}
                  placeholder="10:00 AM - 11:00 AM"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">ডায়মন্ড রেট (💎):</label>
                <input
                  type="number"
                  min="10"
                  value={editSlotPrice}
                  onChange={(e) => setEditSlotPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-cyan-400"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 text-xs font-black shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Customer Orders */}
      {activeTab === 'orders' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-cyan-400" />
                <span>আপনার শপের কাস্টমার অর্ডার সমূহ ({sellerOrders.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                কাস্টমাররা আপনার সার্ভিস বুক করলে এখানে দেখা যাবে।
              </p>
            </div>
          </div>

          {sellerOrders.length === 0 ? (
            <div className="text-center py-10 bg-slate-950/60 rounded-2xl border border-slate-800/80">
              <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">এখনও কোনো অর্ডার নেই</p>
              <p className="text-xs text-slate-500 mt-1">
                কাস্টমাররা আপনার সার্ভিস বুক করলে সঙ্গে সঙ্গে এখানে নোটিফিকেশন পাবেন।
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sellerOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-slate-950 border border-slate-800/90 rounded-2xl p-3.5 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          অর্ডার #{order.id}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          {order.date}
                        </span>
                      </div>
                      <p className="text-xs text-cyan-300 font-semibold mt-1">
                        সার্ভিস: {order.developerService || order.serviceName}
                        {order.durationText && (
                          <span className="ml-2 text-[10px] text-lime-300 bg-lime-950/70 border border-lime-500/30 px-1.5 py-0.5 rounded font-normal">
                            ⏱️ {order.durationText}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        👤 যিনি অর্ডার করেছেন (কাস্টমার): <span className="text-amber-300 font-bold">{order.userName || 'কাস্টমার'}</span>
                        {order.userPhone && (
                          <span className="text-slate-400 font-mono text-[11px] ml-1.5 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            📞 {order.userPhone}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-amber-300 flex items-center justify-end gap-1">
                        <Gem className="w-3.5 h-3.5 text-amber-400" />
                        {order.priceDiamonds} 💎
                      </span>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          order.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : order.status === 'in_progress'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : order.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {order.status === 'completed'
                          ? '✅ সম্পন্ন'
                          : order.status === 'in_progress'
                          ? '⏳ চলমান'
                          : order.status === 'pending'
                          ? '🔔 নতুন অর্ডার'
                          : 'বাতিল'}
                      </span>
                    </div>
                  </div>

                  {/* Requirements Note if provided */}
                  {order.requirements && (
                    <div className="text-xs text-slate-300 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">
                        📝 কাস্টমারের নোট / মেসেজ:
                      </span>
                      <p className="text-slate-200">{order.requirements}</p>
                    </div>
                  )}

                  {/* Order Status Action Controls */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    {order.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateOrderStatus(order.id, 'in_progress', 'কাজ শুরু হয়েছে');
                          sounds.playSuccess();
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        <span>অর্ডার গ্রহণ করুন ও কাজ শুরু করুন</span>
                      </button>
                    )}

                    {order.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateOrderStatus(order.id, 'completed', 'কাজ সফলভাবে ডেলিভারি করা হয়েছে');
                          sounds.playSuccess();
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>কাজ ডেলিভারি ও সম্পন্ন করুন</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('chat');
                        setChatText(`[অর্ডার #${order.id} সম্পর্কে]: `);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>কাস্টমারের সাথে কথা বলুন</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Live Customer Chat Inbox */}
      {activeTab === 'chat' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>লাইভ কাস্টমার ইনবক্স</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                কাস্টমারদের সাথে সরাসরি কথা বলুন এবং সার্ভিস সংক্রান্ত উত্তর দিন।
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const currentContact = selectedCustomerId
                    ? customerContacts.find((c) => c.userId === selectedCustomerId)
                    : customerContacts[0];
                  const targetCustomer = currentContact || (sellerOrders[0] ? { userId: sellerOrders[0].userId, userName: sellerOrders[0].userName } : null);

                  if (!targetCustomer?.userId) {
                    alert('কল করার জন্য প্রথমে ইনবক্স থেকে একজন কাস্টমার বা কথোপকথন নির্বাচন করুন।');
                    return;
                  }

                  sounds.playCallRing();
                  try {
                    await webrtcVoice.initiateCall({
                      targetUserId: targetCustomer.userId,
                      callerId: seller.username ? `seller_${seller.username}` : `dev_${seller.id}`,
                      callerName: `${seller.name} (@${seller.username || 'seller'})`,
                    });
                  } catch (e) {
                    console.warn('Seller call start:', e);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm shadow-emerald-500/10"
                title="কাস্টমারকে সরাসরি WebRTC ভয়েস কল করুন"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>📞 ভয়েস কল</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setIsMeteredVideoOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm shadow-cyan-500/10"
                title="Metered HD ভিডিও মিটিং চালু করুন"
              >
                <Video className="w-3.5 h-3.5 text-cyan-400" />
                <span>📹 HD ভিডিও মিটিং</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  // Target the currently selected customer or the active conversation
                  const currentContact = selectedCustomerId
                    ? customerContacts.find((c) => c.userId === selectedCustomerId)
                    : customerContacts[0];

                  const targetId = currentContact?.userId || sellerOrders[0]?.userId;
                  const targetName = currentContact?.userName || sellerOrders[0]?.userName || 'কাস্টমার';

                  setTrackedCustomerId(targetId);
                  setTrackedCustomerName(targetName);
                  setIsLocationModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-lime-500/20 hover:bg-lime-500/30 text-lime-300 border border-lime-500/40 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm shadow-lime-500/10"
                title="সিলেক্টেড কাস্টমারের জিপিএস ও লাইভ অবস্থান ট্র্যাক করুন"
              >
                <MapPin className="w-3.5 h-3.5 text-lime-400" />
                <span>📍 কাস্টমার লোকেশন</span>
              </button>
            </div>
          </div>

          {/* Active Customer Conversation Selector */}
          {customerContacts.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 border-b border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-bold shrink-0">কথোপকথন:</span>
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition ${
                  selectedCustomerId === null
                    ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/30'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                }`}
              >
                সকল ({sellerMessages.length})
              </button>
              {customerContacts.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => setSelectedCustomerId(c.userId)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 flex items-center gap-1 transition ${
                    selectedCustomerId === c.userId
                      ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/30'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>{c.userName}</span>
                  <span className="text-[9px] px-1 rounded-full bg-slate-900/60 ml-0.5">
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Messages Container */}
          <div className="h-64 bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 overflow-y-auto space-y-2.5">
            {sellerMessages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                কোনো মেসেজ হিস্ট্রি নেই। কাস্টমার মেসেজ পাঠালে এখানে দেখতে পাবেন।
              </div>
            ) : (
              sellerMessages
                .filter((msg) => {
                  if (!selectedCustomerId) return true;
                  return (
                    msg.senderUserId === selectedCustomerId ||
                    msg.sender === 'developer' ||
                    msg.senderName === seller.name
                  );
                })
                .map((msg) => {
                const isSeller = msg.sender === 'developer' || msg.senderName === seller.name;
                const hasVoice = msg.attachment?.type === 'voice';

                return (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-2xl text-xs max-w-[85%] space-y-1.5 ${
                      isSeller
                        ? 'bg-cyan-600/30 border border-cyan-500/40 text-cyan-100 ml-auto'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 mr-auto'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="font-bold">
                        {isSeller ? 'আপনি (সেলার)' : 'কাস্টমার'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {msg.text && <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>}

                    {/* Voice Attachment Bubble */}
                    {hasVoice && (
                      <div className="bg-slate-950/90 p-2 rounded-xl border border-cyan-500/30 flex items-center gap-2.5 min-w-[190px] mt-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayVoice(msg.id, msg.attachment?.url)}
                          className={`w-8 h-8 rounded-full ${
                            playingVoiceId === msg.id
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                              : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-md shadow-cyan-400/20'
                          } flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0`}
                          title={playingVoiceId === msg.id ? 'পজ করুন' : 'ভয়েস শুনুন'}
                        >
                          {playingVoiceId === msg.id ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5 ml-0.5" />
                          )}
                        </button>

                        <div className="flex-1 flex flex-col justify-center gap-1">
                          <div className="flex items-center gap-1 h-5">
                            {[12, 22, 16, 26, 14, 20, 10, 24].map((h, idx) => (
                              <span
                                key={idx}
                                style={{
                                  height: `${
                                    playingVoiceId === msg.id
                                      ? Math.min(24, Math.max(6, (h * (playbackProgress + 15)) % 26))
                                      : Math.max(6, h)
                                  }px`,
                                }}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  playingVoiceId === msg.id ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
                                }`}
                              />
                            ))}
                          </div>
                          {playingVoiceId === msg.id && (
                            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-cyan-400 h-full transition-all duration-100"
                                style={{ width: `${Math.min(100, playbackProgress)}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-cyan-300 font-bold shrink-0">
                          {msg.attachment?.duration || 3}s
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Voice Recording Bar or Input */}
          {isRecordingVoice ? (
            <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span>রেকর্ড হচ্ছে: {recordSeconds}s</span>
                </div>
                <div className="flex items-center gap-1 h-4 px-2 bg-slate-900 rounded-lg">
                  {liveRecordLevels.map((lvl, i) => (
                    <span
                      key={i}
                      style={{ height: `${Math.max(20, lvl)}%` }}
                      className="w-1 rounded-full bg-rose-500 transition-all duration-100"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelVoiceRecording}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSendVoiceRecording}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 text-xs font-bold transition flex items-center gap-1 shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>পাঠান</span>
                </button>
              </div>
            </div>
          ) : (
            /* Message Input */
            <form onSubmit={handleSendReply} className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartVoiceRecording}
                className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 transition cursor-pointer shrink-0"
                title="ভয়েস নোট রেকর্ড করে কাস্টমারকে পাঠান"
              >
                <Mic className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="কাস্টমারকে উত্তর লিখুন..."
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={!chatText.trim()}
                className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>পাঠান</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 4: Earnings & Diamond Withdrawal */}
      {activeTab === 'earnings' && (
        <div className="space-y-4">
          {/* Main Earnings & Cashout Overview Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                  Seller Wallet & Cashout
                </span>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  <span>শপ ইনকাম ও ডায়মন্ড উইথড্র সেন্টার</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  আপনার আয় করা ডায়মন্ড ওনারের কাছে উইথড্র রিকোয়েস্ট পাঠিয়ে বিকাশ, নগদ বা রকেটে সরাসরি ক্যাশআউট করুন।
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setWithdrawAmount(currentSellerDiamonds > 0 ? Math.min(currentSellerDiamonds, 100).toString() : '50');
                  setWithdrawFeedback(null);
                  setIsWithdrawModalOpen(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs rounded-2xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>উইথড্র রিকোয়েস্ট পাঠান</span>
              </button>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-full blur-lg"></div>
                <Gem className="w-5 h-5 text-amber-400 mx-auto mb-1 animate-pulse" />
                <span className="text-[11px] text-amber-300 font-bold block">উইথড্রযোগ্য ব্যালেন্স</span>
                <span className="text-base sm:text-lg font-black text-amber-300">
                  {currentSellerDiamonds.toLocaleString()} 💎
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  (৳ {currentSellerDiamonds.toLocaleString()} টাকা)
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-center">
                <DollarSign className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                <span className="text-[11px] text-slate-400 block font-medium">কনভার্সন রেট</span>
                <span className="text-base font-black text-white">১ 💎 = ১ ৳</span>
                <span className="text-[10px] text-slate-500 block">১০০% ভ্যালু এক্সচেঞ্জ</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-center">
                <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <span className="text-[11px] text-slate-400 block font-medium">সম্পন্ন সার্ভিস</span>
                <span className="text-base font-black text-emerald-300">
                  {seller.completedOrders || 0} টি
                </span>
                <span className="text-[10px] text-slate-500 block">রেটিং: {seller.rating || 5.0} ★</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 text-center">
                <Clock className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                <span className="text-[11px] text-slate-400 block font-medium">পেন্ডিং উইথড্র</span>
                <span className="text-base font-black text-indigo-300">
                  {thisSellerWithdrawRequests.filter((r) => r.status === 'pending').length} টি
                </span>
                <span className="text-[10px] text-slate-500 block">ওনার ভেরিফিকেশন</span>
              </div>
            </div>

            {/* Quick Notice Banner */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 leading-relaxed">
                <strong className="text-amber-300">উইথড্র সিস্টেম গাইডলাইন:</strong> উইথড্র বাটনে ক্লিক করে আপনার বিকাশ/নগদ/রকেট নম্বর সাবমিট করলে রিকোয়েস্টটি সরাসরি ওনারের উইথড্র ইনবক্সে চলে যাবে। ওনার যাচাই করে আপনার নাম্বারে টাকা পাঠিয়ে দিলে আপনার ব্যালেন্স আপডেট হয়ে যাবে।
              </p>
            </div>
          </div>

          {/* WITHDRAW REQUEST HISTORY SECTION */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm sm:text-base font-bold text-white">আমার উইথড্র হিস্ট্রি</h4>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                  {thisSellerWithdrawRequests.length} টি
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setWithdrawAmount(currentSellerDiamonds > 0 ? Math.min(currentSellerDiamonds, 100).toString() : '50');
                  setWithdrawFeedback(null);
                  setIsWithdrawModalOpen(true);
                }}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                + নতুন উইথড্র
              </button>
            </div>

            {thisSellerWithdrawRequests.length === 0 ? (
              <div className="text-center py-8 bg-slate-950/50 rounded-2xl border border-slate-800/80 p-4">
                <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  এখনো কোনো উইথড্র রিকোয়েস্ট করেননি। ডায়মন্ড ক্যাশআউট করতে উপরের বাটনে ক্লিক করুন।
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {thisSellerWithdrawRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-300">
                          #{req.id}
                        </span>
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                            req.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                              : req.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          }`}
                        >
                          {req.status === 'approved'
                            ? '✅ টাকা পাঠানো হয়েছে (ভেরিফাইড)'
                            : req.status === 'rejected'
                            ? '❌ বাতিল ও রিফান্ডেড'
                            : '⏳ ওনার রিভিউতে আছে (টাকা পাঠানো হচ্ছে)'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {req.requestedAt}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <span className="font-bold text-amber-300 flex items-center gap-1">
                          <Gem className="w-3.5 h-3.5 text-amber-400" />
                          {req.amountDiamonds} 💎 (৳ {req.bdtAmount} টাকা)
                        </span>
                        <span>•</span>
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold text-cyan-300">
                          {req.paymentMethod} ({req.accountType || 'Personal'})
                        </span>
                        <span className="font-mono text-slate-200">
                          নম্বর: {req.accountNumber}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-sm font-black text-emerald-400 block font-mono">
                        ৳ {req.bdtAmount} BDT
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {req.status === 'approved' ? '✅ টাকা প্রাপ্ত হয়েছে' : '⏳ পেন্ডিং'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WITHDRAW POPUP MODAL */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">ডায়মন্ড উইথড্র রিকোয়েস্ট</h3>
                  <p className="text-[11px] text-slate-400">ওনারের কাছে ডায়মন্ড ক্যাশআউট রিকোয়েস্ট পাঠান</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amount = parseInt(withdrawAmount, 10);
                if (isNaN(amount) || amount <= 0) {
                  setWithdrawFeedback({ type: 'error', message: 'সঠিক ডায়মন্ড পরিমাণ লিখুন!' });
                  return;
                }
                if (amount > currentSellerDiamonds) {
                  setWithdrawFeedback({
                    type: 'error',
                    message: `আপনার একাউন্টে পর্যাপ্ত ডায়মন্ড নেই! বর্তমান ব্যালেন্স: ${currentSellerDiamonds} 💎`,
                  });
                  return;
                }
                if (amount < 50) {
                  setWithdrawFeedback({ type: 'error', message: 'সর্বনিম্ন ৫০ ডায়মন্ড উইথড্র করা যাবে!' });
                  return;
                }
                if (!withdrawAccountNum.trim() || withdrawAccountNum.trim().length < 9) {
                  setWithdrawFeedback({ type: 'error', message: 'সঠিক পেমেন্ট / বিকাশ নম্বর লিখুন!' });
                  return;
                }

                if (onRequestWithdraw) {
                  onRequestWithdraw({
                    amountDiamonds: amount,
                    bdtAmount: amount, // 1 Diamond = 1 BDT
                    paymentMethod: withdrawMethod,
                    accountNumber: withdrawAccountNum.trim(),
                    accountType: withdrawAccountType,
                    note: withdrawNote.trim() || undefined,
                  });
                  sounds.playSuccess();
                  setWithdrawFeedback({
                    type: 'success',
                    message: `আপনার ${amount} 💎 (${amount} টাকা) উইথড্র রিকোয়েস্ট সফলভাবে ওনারের কাছে পাঠানো হয়েছে! ওনার ভেরিফাই করে টাকা পাঠিয়ে দেবেন।`,
                  });
                  setTimeout(() => {
                    setIsWithdrawModalOpen(false);
                    setWithdrawFeedback(null);
                  }, 2200);
                }
              }}
              className="p-4 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              {/* Balance preview */}
              <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">বর্তমান উইথড্রযোগ্য ব্যালেন্স:</span>
                  <span className="text-sm font-black text-amber-300 flex items-center gap-1">
                    <Gem className="w-4 h-4 text-amber-400" />
                    {currentSellerDiamonds.toLocaleString()} 💎
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">টাকায় সমপরিমাণ:</span>
                  <span className="text-sm font-bold text-white">৳ {currentSellerDiamonds.toLocaleString()} BDT</span>
                </div>
              </div>

              {/* Feedback messages */}
              {withdrawFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    withdrawFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/60 border border-rose-500/50 text-rose-200'
                  }`}
                >
                  {withdrawFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{withdrawFeedback.message}</span>
                </div>
              )}

              {/* Amount Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>উইথড্র ডায়মন্ড পরিমাণ</span>
                  <span className="text-amber-400 font-mono">
                    পাবেন: ৳ {parseInt(withdrawAmount, 10) || 0} টাকা
                  </span>
                </label>

                {/* Preset Pills */}
                <div className="grid grid-cols-4 gap-1.5 pb-1">
                  {[50, 100, 250, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      disabled={amt > currentSellerDiamonds}
                      onClick={() => setWithdrawAmount(amt.toString())}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs transition border cursor-pointer ${
                        withdrawAmount === amt.toString()
                          ? 'bg-amber-400 text-slate-950 border-amber-400 shadow'
                          : amt > currentSellerDiamonds
                          ? 'opacity-40 bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {amt} 💎
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="50"
                    max={currentSellerDiamonds}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="৫০ বা তার বেশি ডায়মন্ড..."
                    required
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-white font-bold focus:outline-none pr-14"
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(currentSellerDiamonds.toString())}
                    className="absolute right-1.5 top-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold rounded-lg transition cursor-pointer"
                  >
                    সব (MAX)
                  </button>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300">
                  টাকা রিসিভ করার মেথড নির্বাচন করুন
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['bKash', 'Nagad', 'Rocket', 'Bank'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setWithdrawMethod(m)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition border flex flex-col items-center gap-1 cursor-pointer ${
                        withdrawMethod === m
                          ? m === 'bKash'
                            ? 'bg-pink-600/30 border-pink-500 text-pink-300 shadow'
                            : m === 'Nagad'
                            ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow'
                            : m === 'Rocket'
                            ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow'
                            : 'bg-blue-600/30 border-blue-500 text-blue-300 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>
                        {m === 'bKash' ? 'বিকাশ' : m === 'Nagad' ? 'নগদ' : m === 'Rocket' ? 'রকেট' : 'ব্যাংক'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Number Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>{withdrawMethod} নম্বর / একাউন্ট নম্বর</span>
                  <span className="text-[10px] text-slate-400">যে নম্বরে টাকা পাঠানো হবে</span>
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={withdrawAccountNum}
                    onChange={(e) => setWithdrawAccountNum(e.target.value)}
                    placeholder="017xxxxxxxx"
                    required
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-9 pr-3.5 py-2 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Account Type */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-400">একাউন্ট টাইপ:</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="accType"
                    checked={withdrawAccountType === 'Personal'}
                    onChange={() => setWithdrawAccountType('Personal')}
                    className="text-amber-400 focus:ring-amber-400"
                  />
                  <span>পার্সোনাল (Personal)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="accType"
                    checked={withdrawAccountType === 'Agent'}
                    onChange={() => setWithdrawAccountType('Agent')}
                    className="text-amber-400 focus:ring-amber-400"
                  />
                  <span>এজেন্ট (Agent)</span>
                </label>
              </div>

              {/* Optional Note */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">
                  ওনারের জন্য কোনো মেসেজ / নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                  placeholder="উদা: বিকাশ পার্সোনাল ক্যাশ আউট ফি সহ পাঠাবেন..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none text-xs"
                />
              </div>

              {/* Summary & Submit */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={
                    currentSellerDiamonds < 50 ||
                    parseInt(withdrawAmount, 10) > currentSellerDiamonds ||
                    !withdrawAccountNum.trim()
                  }
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 text-slate-950 font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>উইথড্র কনফার্ম করুন (৳ {parseInt(withdrawAmount, 10) || 0} ৳)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Live Location Tracking Modal */}
      <LiveLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        targetUserId={trackedCustomerId}
        targetUserName={trackedCustomerName}
        targetUserRole="কাস্টমার"
      />

      {/* Metered HD Video Meeting Modal */}
      <MeteredVideoModal
        isOpen={isMeteredVideoOpen}
        onClose={() => setIsMeteredVideoOpen(false)}
        roomName={`pts-room-${seller.id}`}
        meteredAppName={siteConfig?.meteredAppName}
        meteredApiKey={siteConfig?.meteredApiKey}
        callerName={`${seller.name} (হোস্ট সেলার)`}
        targetName="কাস্টমার"
        isHost={true}
      />
    </div>
  );
};
