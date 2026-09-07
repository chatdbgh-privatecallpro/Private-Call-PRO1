import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Gem, Clock, Star, ShieldCheck, CheckCircle, ArrowRight, Mic, Plus, Minus, Calculator } from 'lucide-react';
import { Developer } from '../types';
import { sounds } from '../utils/sound';

interface HireModalProps {
  developer: Developer | null;
  userDiamonds: number;
  onClose: () => void;
  onConfirmHire: (
    developer: Developer,
    requirements: string,
    durationMinutes: number,
    totalDiamonds: number,
    durationText: string
  ) => void;
  onGoToRecharge: () => void;
}

export const HireModal: React.FC<HireModalProps> = ({
  developer,
  userDiamonds,
  onClose,
  onConfirmHire,
  onGoToRecharge,
}) => {
  const [requirements, setRequirements] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60); // Minimum 1 hour (60 min)
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!developer) return null;

  // Seller's hourly diamond rate (60 minutes)
  const ratePerHour = developer.diamondPerHour || developer.price || 100;
  
  // Strict Calculation: (ratePerHour / 60) * durationMinutes, rounded up to whole diamonds
  const totalCost = Math.ceil((ratePerHour / 60) * durationMinutes);
  const isAffordable = userDiamonds >= totalCost;
  const missingDiamonds = totalCost - userDiamonds;

  // Bengali duration text helper
  const getDurationTextBn = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    const hoursBn = hours.toLocaleString('bn-BD');
    const minsBn = remainingMins.toLocaleString('bn-BD');
    const totalMinsBn = mins.toLocaleString('bn-BD');

    if (remainingMins === 0) {
      return `${hoursBn} ঘণ্টা (${totalMinsBn} মিনিট)`;
    }
    return `${hoursBn} ঘণ্টা ${minsBn} মিনিট (${totalMinsBn} মিনিট)`;
  };

  const currentDurationText = getDurationTextBn(durationMinutes);

  // Stepper handlers: step of strictly 10 minutes, minimum 60 minutes
  const handleIncrease = () => {
    sounds.playClick();
    setDurationMinutes((prev) => prev + 10);
  };

  const handleDecrease = () => {
    sounds.playClick();
    setDurationMinutes((prev) => Math.max(60, prev - 10)); // Cannot go below 60 minutes (1 hour)
  };

  const handlePresetSelect = (mins: number) => {
    sounds.playClick();
    setDurationMinutes(mins);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAffordable) return;
    setIsSubmitting(true);
    sounds.playDiamond();
    setTimeout(() => {
      onConfirmHire(
        developer,
        requirements || 'লাইভ প্রাইভেট চ্যাট ও ভয়েস কল সংযোগ',
        durationMinutes,
        totalCost,
        currentDurationText
      );
      setIsSubmitting(false);
    }, 400);
  };

  const quickPresets = [
    { mins: 60, label: '১ ঘণ্টা' },
    { mins: 70, label: '১ঘ ১০মি' },
    { mins: 80, label: '১ঘ ২০মি' },
    { mins: 90, label: '১ঘ ৩০মি' },
    { mins: 120, label: '২ ঘণ্টা' },
    { mins: 180, label: '৩ ঘণ্টা' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-lime-500/10 text-lime-400">
                <Mic className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-100 text-base">প্রাইভেট চ্যাট ও ভয়েস সেশন বুকিং</h3>
            </div>
            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-none">
            {/* Host Summary Card */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-lime-500 to-emerald-600 p-0.5 shrink-0">
                <img
                  src={developer.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${developer.avatarSeed}`}
                  alt={developer.name}
                  className="w-full h-full rounded-[10px] bg-slate-900 object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-slate-100 text-sm truncate">{developer.name}</h4>
                  <span className="text-[9px] font-mono bg-cyan-950/90 text-cyan-300 font-bold px-1.5 py-0.2 rounded border border-cyan-800/60">
                    🆔 আইডি: #{developer.id}
                  </span>
                  {developer.username && (
                    <span className="text-[9px] font-mono text-slate-400">
                      {developer.username}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">{developer.service}</p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {developer.rating || '5.0'}
                  </span>
                  <span className="flex items-center gap-1 text-lime-300 font-semibold bg-lime-950/60 px-1.5 py-0.5 rounded border border-lime-500/30">
                    <Gem className="w-3 h-3 text-lime-400" /> {ratePerHour} 💎/ঘণ্টা
                  </span>
                </div>
              </div>
            </div>

            {/* DURATION SELECTOR (MIN 1 HOUR, STEP +10 MINS, NO ODD FRACTIONS) */}
            <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-lime-400" />
                  <span>সেশনের সময় নির্ধারণ (কমপক্ষে ১ ঘণ্টা):</span>
                </label>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/60">
                  +১০ মিনিট স্টেপ
                </span>
              </div>

              {/* Stepper Display */}
              <div className="flex items-center justify-between bg-slate-900 border border-slate-700/80 p-2 rounded-xl">
                <button
                  type="button"
                  disabled={durationMinutes <= 60}
                  onClick={handleDecrease}
                  className={`p-2.5 rounded-lg font-bold flex items-center gap-1 text-xs transition cursor-pointer ${
                    durationMinutes <= 60
                      ? 'bg-slate-950 text-slate-600 border border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 active:scale-95'
                  }`}
                  title="১০ মিনিট কমান (সর্বনিম্ন ৬০ মিনিট)"
                >
                  <Minus className="w-4 h-4" />
                  <span>-১০ মি.</span>
                </button>

                <div className="text-center px-2">
                  <span className="text-sm sm:text-base font-black text-lime-300 block">
                    {currentDurationText}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {durationMinutes === 60 ? 'সর্বনিম্ন ১ ঘণ্টার বেস রেট' : `মোট ${durationMinutes} মিনিটের সেশন`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleIncrease}
                  className="p-2.5 rounded-lg bg-lime-500/20 hover:bg-lime-500/30 text-lime-300 border border-lime-500/40 active:scale-95 font-bold flex items-center gap-1 text-xs transition cursor-pointer"
                  title="১০ মিনিট বাড়ান"
                >
                  <Plus className="w-4 h-4" />
                  <span>+১০ মি.</span>
                </button>
              </div>

              {/* Quick Preset Pills */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-semibold text-slate-400 block">দ্রুত সময় সিলেক্ট করুন:</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset.mins}
                      type="button"
                      onClick={() => handlePresetSelect(preset.mins)}
                      className={`py-1.5 px-1 rounded-lg text-center text-[11px] font-bold border transition cursor-pointer ${
                        durationMinutes === preset.mins
                          ? 'bg-lime-500 text-slate-950 border-lime-400 shadow-sm shadow-lime-500/30'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Accurate Diamond Math & Calculation Display */}
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calculator className="w-3 h-3 text-cyan-400" />
                  <span>হোস্টের রেট:</span>
                </span>
                <span className="font-semibold text-slate-200">
                  {ratePerHour} 💎 প্রতি ৬০ মিনিট ({((ratePerHour / 60)).toFixed(2)} 💎/মি)
                </span>
              </div>

              <div className="flex justify-between text-xs text-slate-400">
                <span>নির্বাচিত সময় ({durationMinutes} মিনিট):</span>
                <span className="font-bold text-lime-400 flex items-center gap-1">
                  <Gem className="w-3.5 h-3.5" /> {totalCost} ডায়মন্ড
                </span>
              </div>

              <div className="flex justify-between text-xs text-slate-400">
                <span>আপনার বর্তমান ব্যালেন্স:</span>
                <span className="font-semibold text-slate-200 flex items-center gap-1">
                  <Gem className="w-3.5 h-3.5 text-lime-400" /> {userDiamonds} ডায়মন্ড
                </span>
              </div>

              <div className="border-t border-slate-800 pt-2 flex justify-between text-xs font-medium">
                <span>বুকিং পরবর্তী ব্যালেন্স:</span>
                <span className={isAffordable ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {isAffordable ? `${userDiamonds - totalCost} ডায়মন্ড` : `ঘাটতি: ${missingDiamonds} ডায়মন্ড`}
                </span>
              </div>
            </div>

            {/* Session Notes Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                বিশেষ নোট বা পছন্দের বিষয় (ঐচ্ছিক):
              </label>
              <textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="যেমন: সরাসরি ভয়েস কলে কথা বলতে চাই / বিশেষ পরামর্শ..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-lime-500 transition"
              />
            </div>

            {/* Trust & Auto-message Notice */}
            <div className="flex items-start gap-2.5 text-xs text-slate-300 bg-cyan-950/30 p-3 rounded-xl border border-cyan-500/30">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-cyan-300 block">স্বয়ংক্রিয় কানেকশন প্রটোকল:</span>
                <span>কনফার্ম বাটনে ক্লিক করলেই স্বয়ংক্রিয়ভাবে হোস্টের ইনবক্সে <strong className="text-amber-300 font-bold">"পার্সোনাল লিংক টা দিন"</strong> মেসেজ চলে যাবে এবং চ্যাটবক্স ওপেন হবে।</span>
              </div>
            </div>

            {/* Action Buttons */}
            {isAffordable ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-lime-400 via-emerald-400 to-green-500 hover:from-lime-300 hover:to-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <span>কনফার্ম হচ্ছে ও ইনবক্সে কানেক্ট হচ্ছে...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>কনফার্ম করুন ({totalCost} ডায়মন্ড - {currentDurationText})</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <span className="font-semibold">আপনার একাউন্টে পর্যাপ্ত ডায়মন্ড নেই ({missingDiamonds} ডায়মন্ড কম)!</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onClose();
                    onGoToRecharge();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] cursor-pointer"
                >
                  <Gem className="w-4 h-4" />
                  <span>এখনই ডায়মন্ড রিচার্জ করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

