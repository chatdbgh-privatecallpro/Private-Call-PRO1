import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Crown,
  CheckCircle2,
  Star,
  Gem,
  Clock,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  Award,
  Zap,
  Radio,
  PhoneCall
} from 'lucide-react';
import { Developer } from '../types';
import { sounds } from '../utils/sound';

interface SellerProfileModalProps {
  seller: Developer | null;
  isOpen: boolean;
  onClose: () => void;
  onHire: (seller: Developer) => void;
  onStartChat: (seller: Developer) => void;
}

export const SellerProfileModal: React.FC<SellerProfileModalProps> = ({
  seller,
  isOpen,
  onClose,
  onHire,
  onStartChat,
}) => {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopVoice = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    setIsPlayingVoice(false);
    setVoiceProgress(0);
  };

  const handleCopyId = () => {
    if (!seller) return;
    sounds.playClick();
    navigator.clipboard.writeText(`${seller.id}`);
    setIsCopiedId(true);
    setTimeout(() => setIsCopiedId(false), 2000);
  };

  const fallbackSpeech = () => {
    if (!seller) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const textToSpeak =
        seller.voiceIntroText ||
        `হ্যালো! আমি ${seller.name}। আপনার সাথে লাইভ চ্যাট ও অডিও সেশনে যুক্ত হতে প্রস্তুত। সময় বুক করে সরাসরি কথা বলুন।`;
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'bn-BD';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;

      utterance.onstart = () => {
        setIsPlayingVoice(true);
        setVoiceProgress(10);
      };

      utterance.onend = () => {
        setIsPlayingVoice(false);
        setVoiceProgress(0);
      };

      utterance.onerror = () => {
        setIsPlayingVoice(false);
        setVoiceProgress(0);
      };

      synthRef.current = utterance;
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsPlayingVoice(false);
      }

      // Simulate progress bar while speaking
      let cur = 10;
      const interval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(interval);
          return;
        }
        cur = Math.min(cur + 8, 95);
        setVoiceProgress(cur);
      }, 500);
    } else {
      alert('আপনার ডিভাইসে অডিও প্লেয়ার সাপোর্ট করে না।');
    }
  };

  const playVoice = () => {
    if (!seller) return;
    
    // Stop any existing playback first
    stopVoice();

    // If real audio URL or Base64 voice note exists
    if (seller.voiceIntroUrl) {
      try {
        const audio = new Audio();
        audio.src = seller.voiceIntroUrl;
        audio.preload = 'auto';
        audioRef.current = audio;

        audio.onplay = () => {
          setIsPlayingVoice(true);
        };

        audio.ontimeupdate = () => {
          if (audio.duration && !isNaN(audio.duration)) {
            setVoiceProgress((audio.currentTime / audio.duration) * 100);
          }
        };

        audio.onended = () => {
          setIsPlayingVoice(false);
          setVoiceProgress(0);
        };

        audio.onerror = (e) => {
          console.warn('Audio playback error, switching to speech synth fallback:', e);
          fallbackSpeech();
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlayingVoice(true);
            })
            .catch((err) => {
              console.warn('Audio play promise rejected, using fallback speech:', err);
              fallbackSpeech();
            });
        }
        return;
      } catch (err) {
        console.warn('Audio initialization failed, using fallback speech:', err);
        fallbackSpeech();
        return;
      }
    }

    fallbackSpeech();
  };

  const handleToggleVoice = () => {
    sounds.playClick();
    if (isPlayingVoice) {
      stopVoice();
    } else {
      playVoice();
    }
  };

  // Stop voice on modal close or seller switch
  useEffect(() => {
    if (!isOpen) {
      stopVoice();
    }
    return () => {
      stopVoice();
    };
  }, [isOpen, seller]);

  if (!isOpen || !seller) return null;

  const pricePerHour = seller.diamondPerHour || seller.price || 100;
  const rating = seller.rating || 5.0;
  const completedOrders = seller.completedOrders || 400;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        >
          {/* Header Bar */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-lime-500/10 text-lime-400 border border-lime-500/20">
                <Crown className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-slate-100 text-sm sm:text-base flex items-center gap-1.5">
                  <span>সেলার ভেরিফায়েড পার্সোনাল প্রোফাইল</span>
                </h3>
                <p className="text-[10px] text-slate-400">অফিসিয়াল হোস্ট ও লাইভ সেশন পোর্টাল</p>
              </div>
            </div>
            <button
              onClick={() => {
                sounds.playClick();
                stopVoice();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-none">
            {/* Top Seller Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950/90 to-slate-900 border border-slate-800 relative overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-lime-500 to-emerald-600 p-0.5 shadow-xl">
                    <img
                      src={seller.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seller.avatarSeed}`}
                      alt={seller.name}
                      className="w-full h-full rounded-[14px] bg-slate-900 object-cover"
                    />
                  </div>
                  {seller.online ? (
                    <span className="absolute -bottom-1 -right-1 flex items-center gap-1 bg-lime-950 text-lime-300 border border-lime-400 text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                      লাইভ
                    </span>
                  ) : (
                    <span className="absolute -bottom-1 -right-1 bg-slate-800 text-slate-400 border border-slate-600 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                      অফলাইন
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-lg font-black text-slate-100 truncate">{seller.name}</h2>
                    <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
                  </div>

                  <p className="text-xs text-slate-300 font-medium mt-0.5 line-clamp-2 leading-relaxed">
                    {seller.service}
                  </p>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Copyable Seller ID */}
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-cyan-950/90 hover:bg-cyan-900/90 text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-800/80 transition cursor-pointer"
                      title="আইডি কপি করুন"
                    >
                      <span>🆔 সেলার আইডি: #{seller.id}</span>
                      {isCopiedId ? (
                        <span className="text-[9px] text-emerald-300">কপি হয়েছে!</span>
                      ) : null}
                    </button>

                    {seller.username && (
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/60">
                        {seller.username}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 🎙️ Voice Intro Audio Player Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-950 to-teal-950/60 border border-lime-500/30 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-lime-300 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-lime-400" />
                  <span>সেলার ভয়েস অডিও মেসেজ ও কণ্ঠস্বর</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {seller.voiceIntroDuration || '0:20'}
                </span>
              </div>

              {/* Player control & Waveform */}
              <div className="flex items-center gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold transition shadow-md cursor-pointer shrink-0 ${
                    isPlayingVoice
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : 'bg-lime-400 hover:bg-lime-300 text-slate-950'
                  }`}
                  title={isPlayingVoice ? 'ভয়েস থামান' : 'সেলার ভয়েস শুনুন'}
                >
                  {isPlayingVoice ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-200 truncate">
                      {isPlayingVoice ? '🎙️ ভয়েস প্লে হচ্ছে...' : '▶️ ক্লিক করে কণ্ঠস্বর শুনুন'}
                    </span>
                    <span className="text-[10px] text-lime-400 font-mono">
                      {isPlayingVoice ? 'লাইভ অডিও' : 'অডিও রেডি'}
                    </span>
                  </div>

                  {/* Waveform / Progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-lime-400 to-emerald-400 h-full transition-all duration-300"
                      style={{ width: `${isPlayingVoice ? Math.max(voiceProgress, 15) : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {seller.voiceIntroText && (
                <p className="text-[11px] text-slate-300 italic bg-slate-900/50 p-2 rounded-lg border border-slate-800/80 leading-relaxed">
                  "{seller.voiceIntroText}"
                </p>
              )}
            </div>

            {/* Seller Bio */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-lime-400" />
                <span>সেলার বায়ো ও পরিচিতি</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                {seller.bio || 'কোনো বায়ো যুক্ত করা হয়নি।'}
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">প্রতি ঘণ্টা ফি</span>
                <span className="text-sm font-extrabold text-lime-300 font-mono flex items-center justify-center gap-1 mt-0.5">
                  <Gem className="w-3.5 h-3.5 text-lime-400" /> {pricePerHour} 💎
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">রেটিং ও স্কোর</span>
                <span className="text-sm font-extrabold text-amber-400 flex items-center justify-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400" /> {rating} / 5.0
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block">সম্পন্ন সেশন</span>
                <span className="text-sm font-extrabold text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
                  <Award className="w-3.5 h-3.5" /> {completedOrders}+ সফল
                </span>
              </div>
            </div>

            {/* Privacy Guarantee */}
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>১০০% সুরক্ষিত ও গোপনীয় সংযোগ। কাস্টমার ও সেলারের ব্যক্তিগত তথ্য সম্পূর্ণ সংরক্ষিত।</span>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/90 shrink-0 flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                stopVoice();
                onStartChat(seller);
              }}
              className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3 px-4 rounded-xl border border-slate-700 transition cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span>চ্যাট মেসেজ পাঠান</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                stopVoice();
                onHire(seller);
              }}
              className="flex-1 min-w-[150px] flex items-center justify-center gap-1.5 bg-gradient-to-r from-lime-400 to-emerald-500 hover:from-lime-300 hover:to-emerald-400 text-slate-950 font-black text-xs py-3 px-4 rounded-xl shadow-lg shadow-lime-500/20 transition cursor-pointer active:scale-95"
            >
              <PhoneCall className="w-4 h-4" />
              <span>১ ঘণ্টা সেশন বুক করুন</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
