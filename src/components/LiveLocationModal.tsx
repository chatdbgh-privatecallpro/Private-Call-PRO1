import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Compass,
  Navigation,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  X,
  Copy,
  Check,
  Crosshair,
  Wifi,
  Activity,
} from 'lucide-react';
import { ClientLocationData, locationService } from '../utils/locationService';

interface LiveLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId?: string;
  targetUserName?: string;
  targetUserRole?: string;
  locationData?: ClientLocationData | null;
}

export const LiveLocationModal: React.FC<LiveLocationModalProps> = ({
  isOpen,
  onClose,
  targetUserId,
  targetUserName = 'কাস্টমার',
  targetUserRole = 'ক্রেতা',
  locationData,
}) => {
  const [currentLoc, setCurrentLoc] = useState<ClientLocationData>(
    locationData || locationService.getCurrentLocation()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (locationData) {
      setCurrentLoc(locationData);
    } else if (targetUserId) {
      // Stream live location from Firestore for cross-device remote tracking
      const unsubRemote = locationService.subscribeToRemoteUserLocation(targetUserId, (loc) => {
        if (loc) setCurrentLoc(loc);
      });
      // Also listen to local bus
      const unsubLocal = locationService.subscribe((loc) => {
        if (loc && (!loc.userId || loc.userId === targetUserId)) {
          setCurrentLoc(loc);
        }
      });
      return () => {
        unsubRemote();
        unsubLocal();
      };
    } else {
      const unsub = locationService.subscribe((loc) => {
        setCurrentLoc(loc);
      });
      return () => unsub();
    }
  }, [locationData, targetUserId]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await locationService.requestLiveLocation();
      setCurrentLoc(updated);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const handleCopyCoords = () => {
    const text = `${currentLoc.latitude.toFixed(6)}, ${currentLoc.longitude.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isGps = currentLoc.source === 'gps_high_accuracy';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-lime-400/10 border border-lime-400/20 text-lime-400">
              <Crosshair className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  {targetUserName}-এর লাইভ লোকেশন
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {targetUserRole}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                রিয়েল-টাইম জিপিএস ও এলাকা ট্র্যাকিং সিস্টেম
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Status & Accuracy Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isGps ? 'bg-lime-400 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span className="text-xs font-semibold text-slate-200">
                {isGps ? '🟢 রিয়েল-টাইম জিপিএস সিগন্যাল' : '🌐 আইপি নেটওয়ার্ক পজিশন'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-lime-400 font-mono bg-lime-400/10 px-2 py-0.5 rounded border border-lime-400/20">
                ±{currentLoc.accuracy}m একুরেসি
              </span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="রিফ্রেশ করুন"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-lime-400' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Interactive Map Embed */}
          <div className="relative w-full h-56 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
            <iframe
              title="User Live Map"
              src={currentLoc.embedMapUrl}
              className="w-full h-full border-0 filter contrast-125 opacity-90 hover:opacity-100 transition"
              loading="lazy"
            />
            {/* Live radar overlay marker */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 rounded-lg shadow-lg pointer-events-none">
              <Activity className="w-3.5 h-3.5 text-lime-400 animate-pulse" />
              <span className="text-[11px] font-mono font-bold text-lime-400">লাইভ ট্র্যাকিং</span>
            </div>
          </div>

          {/* Location Details Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Area / City */}
            <div className="p-3 bg-slate-800/60 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>শহর ও এলাকা</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{currentLoc.city}</p>
              <p className="text-[11px] text-slate-400 truncate">{currentLoc.country}</p>
            </div>

            {/* Coordinates */}
            <div className="p-3 bg-slate-800/60 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  <span>অক্ষাংশ ও দ্রাঘিমাংশ</span>
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="text-slate-400 hover:text-white transition"
                  title="কপি করুন"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-lime-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-xs font-mono font-bold text-slate-200 truncate">
                {currentLoc.latitude.toFixed(5)}, {currentLoc.longitude.toFixed(5)}
              </p>
              <p className="text-[10px] text-slate-400">
                আপডেট: {new Date(currentLoc.timestamp).toLocaleTimeString('bn-BD')}
              </p>
            </div>
          </div>

          {/* Full Formatted Address */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400 font-medium">বিস্তারিত ঠিকানা:</span>
            <p className="text-xs text-slate-200 mt-0.5 leading-relaxed font-sans">
              {currentLoc.formattedAddress}
            </p>
          </div>

          {/* Security & Verification Notice */}
          <div className="flex items-start gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-300 leading-snug">
              এই লোকেশন ডাটা শুধুমাত্র অনুমোদিত সেলার ও ওনার প্যানেলে এনক্রিপ্ট আকারে প্রদর্শিত হচ্ছে।
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            বন্ধ করুন
          </button>

          <a
            href={currentLoc.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-lime-500/20 transition cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>গুগল ম্যাপে খুলুন (Satellite)</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
};
