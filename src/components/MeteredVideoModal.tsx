import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  Settings,
  ExternalLink,
  Users,
  RefreshCw,
  X,
  Camera,
  SwitchCamera,
  MonitorUp,
  Sliders,
  Sun,
  Eye,
  EyeOff,
  Flame,
  Radio,
  Download
} from 'lucide-react';
import { sounds } from '../utils/sound';
import { realtimeBus } from '../utils/realtime';

declare global {
  interface Window {
    MeteredFrame?: any;
  }
}

interface MeteredVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName?: string;
  callerName?: string;
  targetName?: string;
  isHost?: boolean;
  meteredAppName?: string;
  meteredApiKey?: string;
  onSaveMeteredConfig?: (appName: string, apiKey?: string) => void;
}

export const MeteredVideoModal: React.FC<MeteredVideoModalProps> = ({
  isOpen,
  onClose,
  roomName = 'tutorial',
  callerName = 'কাস্টমার',
  targetName = 'হোস্ট / সেলার',
  isHost = false,
  meteredAppName,
  meteredApiKey,
  onSaveMeteredConfig,
}) => {
  const [appName, setAppName] = useState(() => {
    return meteredAppName || localStorage.getItem('pts_metered_app_name') || 'yourappname';
  });
  const [customRoom, setCustomRoom] = useState(() => {
    return roomName || localStorage.getItem('pts_metered_room_name') || 'tutorial';
  });

  useEffect(() => {
    if (meteredAppName && meteredAppName.trim()) {
      setAppName(meteredAppName.trim());
    }
  }, [meteredAppName]);

  useEffect(() => {
    if (roomName && roomName.trim()) {
      setCustomRoom(roomName.trim());
    }
  }, [roomName]);

  // Call Control States
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isBeautyMode, setIsBeautyMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSelfVideoMinimized, setIsSelfVideoMinimized] = useState(false);
  const [isSelfVideoHidden, setIsSelfVideoHidden] = useState(false);

  // Modal / UI States
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // References
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameInstanceRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derived full Room URL
  const cleanApp = appName.trim().replace(/\.metered\.live.*$/, '').replace(/https?:\/\//, '');
  const cleanRoom = customRoom.trim().replace(/^\//, '');
  const computedRoomUrl = `${cleanApp || 'yourappname'}.metered.live/${cleanRoom || 'tutorial'}`;
  const fullHttpsUrl = `https://${computedRoomUrl}`;

  // Reset auto-hide timer for on-screen controls
  const resetAutoHideControls = useCallback(() => {
    setShowControls(true);
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
    }
    autoHideTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4500);
  }, []);

  // Format Call Timer (MM:SS)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Initialize Local WebRTC Camera Stream
  const initLocalCamera = async (facing: 'user' | 'environment' = 'user') => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
      setIsLoading(false);
    } catch (err: any) {
      console.warn('Local Camera Access Notice:', err);
      // Even if webcam is not permitted or in virtual env, continue gracefully
      setIsLoading(false);
    }
  };

  // 2. Initialize Metered SDK or Fallback
  const initMeteredFrame = () => {
    setIsLoading(true);
    setSdkError(null);

    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    try {
      const initFrame = () => {
        if (typeof window !== 'undefined' && window.MeteredFrame) {
          const frame = new window.MeteredFrame();
          frameInstanceRef.current = frame;

          frame.init(
            {
              roomURL: computedRoomUrl,
              width: '100%',
              height: '100%',
            },
            container
          );

          setIsLoading(false);
        } else {
          // Direct embedded iframe fallback with full WebRTC permissions
          const iframe = document.createElement('iframe');
          iframe.src = fullHttpsUrl;
          iframe.allow = 'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen';
          iframe.className = 'w-full h-full border-0 bg-slate-950';
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.onload = () => setIsLoading(false);
          iframe.onerror = () => {
            setIsLoading(false);
          };
          container.appendChild(iframe);
        }
      };

      if (typeof window !== 'undefined' && !window.MeteredFrame && !document.querySelector('script[src*="sdk-frame"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdn.metered.ca/sdk/frame/1.4.3/sdk-frame.min.js';
        script.async = true;
        script.onload = () => {
          initFrame();
        };
        script.onerror = () => {
          initFrame();
        };
        document.body.appendChild(script);
      } else {
        initFrame();
      }
    } catch (err: any) {
      console.error('Metered Frame Init Error:', err);
      setIsLoading(false);
    }
  };

  // Start Call and Timers on Open
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    if (isOpen) {
      sounds.playCallRing();
      setCallDuration(0);
      initLocalCamera(facingMode);
      initMeteredFrame();
      resetAutoHideControls();

      timerInterval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Broadcast video call invite event
      realtimeBus.broadcast('NEW_MESSAGE', {
        id: `METERED-CALL-${Date.now()}`,
        sender: 'bot',
        text: `📹 [HD ভিডিও মিটিং শুরু]: ${callerName} একটি লাইভ ভিডিও সেশন চালু করেছেন। লিঙ্ক: ${fullHttpsUrl}`,
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
      if (autoHideTimeoutRef.current) clearTimeout(autoHideTimeoutRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (frameInstanceRef.current && typeof frameInstanceRef.current.dispose === 'function') {
        try {
          frameInstanceRef.current.dispose();
        } catch (e) {
          console.warn('Metered dispose warning:', e);
        }
      }
    };
  }, [isOpen, appName, customRoom]);

  // Toggle Microphone (Mute / Unmute)
  const handleToggleMic = () => {
    sounds.playClick();
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = !track.enabled;
        });
        setIsMicMuted(!audioTracks[0].enabled);
      } else {
        setIsMicMuted((prev) => !prev);
      }
    } else {
      setIsMicMuted((prev) => !prev);
    }
    resetAutoHideControls();
  };

  // Toggle Video (Camera Off / On)
  const handleToggleVideo = () => {
    sounds.playClick();
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = !track.enabled;
        });
        setIsVideoOff(!videoTracks[0].enabled);
      } else {
        setIsVideoOff((prev) => !prev);
      }
    } else {
      setIsVideoOff((prev) => !prev);
    }
    resetAutoHideControls();
  };

  // Flip Camera (Front / Back Facing Mode)
  const handleFlipCamera = async () => {
    sounds.playClick();
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    await initLocalCamera(newFacing);
    resetAutoHideControls();
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    sounds.playClick();
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      setIsScreenSharing(false);
      await initLocalCamera(facingMode);
    } else {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          screenStreamRef.current = screenStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
          }
          setIsScreenSharing(true);

          screenStream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
            initLocalCamera(facingMode);
          };
        } else {
          alert('আপনার ব্রাউজার বা ডিভাইসে স্ক্রিন শেয়ারিং সাপোর্ট করছে না।');
        }
      } catch (e) {
        console.warn('Screen share cancelled:', e);
      }
    }
    resetAutoHideControls();
  };

  // Capture High-Res Screenshot
  const handleCaptureScreenshot = () => {
    sounds.playSuccess();
    try {
      const videoEl = localVideoRef.current;
      const canvas = document.createElement('canvas');
      if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (facingMode === 'user' && !isScreenSharing) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          setScreenshotPreview(dataUrl);

          // Download immediately
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `Call_Screenshot_${Date.now()}.png`;
          a.click();
        }
      } else {
        // Mock capture placeholder
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = '#38bdf8';
          ctx.font = '36px sans-serif';
          ctx.fillText(`Video Call Screenshot - ${callerName} & ${targetName}`, 80, 360);
          const dataUrl = canvas.toDataURL('image/png');
          setScreenshotPreview(dataUrl);
        }
      }
    } catch (err) {
      console.warn('Screenshot capture error:', err);
    }
    resetAutoHideControls();
  };

  // Beauty / Filter Mode Toggle
  const handleToggleBeautyMode = () => {
    sounds.playSuccess();
    setIsBeautyMode((prev) => !prev);
    resetAutoHideControls();
  };

  // Copy Room Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullHttpsUrl);
    setIsCopied(true);
    sounds.playClick();
    setTimeout(() => setIsCopied(false), 2000);
    resetAutoHideControls();
  };

  // End Call
  const handleEndCall = () => {
    sounds.playCancel();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-4'
      }`}
      onClick={() => resetAutoHideControls()}
    >
      <div
        className={`relative bg-slate-950 flex flex-col overflow-hidden transition-all duration-300 w-full h-full ${
          isFullscreen ? 'rounded-none border-none' : 'max-w-6xl max-h-[92vh] rounded-3xl border border-slate-800'
        }`}
      >
        {/* ========================================================================= */}
        {/* MAIN FULL-SCREEN VIDEO CANVAS (BORDERLESS / IMO & WHATSAPP STYLE) */}
        {/* ========================================================================= */}
        <div
          className="relative w-full h-full flex-1 bg-slate-950 overflow-hidden flex items-center justify-center cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowControls((prev) => !prev);
          }}
        >
          {/* Main Remote / Metered Video Frame Container */}
          <div
            id="metered-frame"
            ref={containerRef}
            className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
              isBeautyMode ? 'filter contrast-[1.08] saturate-[1.12] brightness-[1.05]' : ''
            }`}
          />

          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute inset-0 z-10 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="w-6 h-6 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-white tracking-wide">
                  এইচডি ভিডিও কল কানেক্ট হচ্ছে...
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  {callerName} ↔ {targetName}
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FLOATING PICTURE-IN-PICTURE (PIP) SELF CAMERA PREVIEW */}
          {/* ========================================================================= */}
          {!isSelfVideoHidden && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute z-30 transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-white/20 bg-slate-900/90 backdrop-blur-md ${
                isSelfVideoMinimized
                  ? 'bottom-20 right-4 w-24 h-32'
                  : 'top-16 right-4 sm:top-20 sm:right-6 w-32 h-44 sm:w-44 sm:h-60'
              }`}
            >
              {/* Local Video Element */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-all ${
                  facingMode === 'user' && !isScreenSharing ? 'scale-x-[-1]' : ''
                } ${isVideoOff ? 'hidden' : 'block'} ${
                  isBeautyMode ? 'filter brightness-110 contrast-105 saturate-110' : ''
                }`}
              />

              {/* Video Off Placeholder */}
              {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-2 text-center">
                  <VideoOff className="w-6 h-6 mb-1 text-rose-400" />
                  <span className="text-[10px] font-semibold">ক্যামেরা অফ</span>
                </div>
              )}

              {/* Floating Self Video Overlay Tag & Controls */}
              <div className="absolute top-2 inset-x-2 flex items-center justify-between pointer-events-auto">
                <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  আপনি
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsSelfVideoMinimized((v) => !v)}
                    className="p-1 rounded-md bg-black/60 hover:bg-black/80 text-white transition cursor-pointer"
                    title={isSelfVideoMinimized ? 'বড় করুন' : 'ছোট করুন'}
                  >
                    {isSelfVideoMinimized ? <Maximize2 className="w-2.5 h-2.5" /> : <Minimize2 className="w-2.5 h-2.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSelfVideoHidden(true)}
                    className="p-1 rounded-md bg-black/60 hover:bg-black/80 text-white transition cursor-pointer"
                    title="হাইড করুন"
                  >
                    <EyeOff className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

              {/* Beauty Mode Active Mini Badge */}
              {isBeautyMode && (
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-amber-500/80 text-slate-950 font-black text-[8px] flex items-center gap-0.5 shadow">
                  <Sparkles className="w-2 h-2" /> বিউটি মোড
                </div>
              )}
            </div>
          )}

          {/* If self video is hidden, show a restore button */}
          {isSelfVideoHidden && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSelfVideoHidden(false);
              }}
              className="absolute top-20 right-4 z-30 px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>সেলফ প্রিভিউ</span>
            </button>
          )}

          {/* ========================================================================= */}
          {/* TOP FLOATING OVERLAY BAR (AUTO-HIDE / TAP-TO-SHOW) */}
          {/* ========================================================================= */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-0 inset-x-0 z-40 p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-all duration-300 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}
          >
            {/* Caller Info & Duration */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>{targetName}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
                  <span>{formatDuration(callDuration)}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300 font-sans text-[11px]">এইচডি কল</span>
                </div>
              </div>
            </div>

            {/* Top Action Controls: Beauty Filter, Fullscreen, Link & Settings */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* BEAUTY / FILTER ONE-CLICK TOGGLE BUTTON (TOP RIGHT) */}
              <button
                type="button"
                onClick={handleToggleBeautyMode}
                className={`p-2.5 rounded-2xl border text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-lg active:scale-90 cursor-pointer ${
                  isBeautyMode
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-amber-300 shadow-amber-500/30 scale-105'
                    : 'bg-black/50 hover:bg-black/70 text-slate-200 border-white/20'
                }`}
                title="এক ক্লিকে বিউটি ও ফেস গ্লো ফিল্টার অন/অফ করুন"
              >
                <Sparkles className={`w-4 h-4 ${isBeautyMode ? 'animate-spin text-slate-950' : 'text-amber-400'}`} />
                <span className="hidden sm:inline">{isBeautyMode ? 'বিউটি অন' : 'বিউটি মোড'}</span>
              </button>

              {/* Copy Meeting Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-2.5 rounded-2xl bg-black/50 hover:bg-black/70 text-white border border-white/20 transition active:scale-90 cursor-pointer"
                title="মিটিং লিঙ্ক কপি করুন"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                className="p-2.5 rounded-2xl bg-black/50 hover:bg-black/70 text-white border border-white/20 transition active:scale-90 cursor-pointer"
                title={isFullscreen ? 'মিনিমাইজ' : 'ফুল স্ক্রিন'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Room Config Drawer */}
              <button
                type="button"
                onClick={() => setIsConfigOpen((v) => !v)}
                className={`p-2.5 rounded-2xl border transition active:scale-90 cursor-pointer ${
                  isConfigOpen
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-black/50 hover:bg-black/70 text-white border-white/20'
                }`}
                title="রুম সেটিংস"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BOTTOM ON-SCREEN FLOATING CALL CONTROLS (IMO / WHATSAPP STYLE) */}
          {/* ========================================================================= */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute bottom-6 inset-x-0 z-40 flex flex-col items-center justify-center gap-3 px-4 transition-all duration-300 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
            }`}
          >
            {/* Control Bar Island */}
            <div className="bg-slate-950/80 border border-white/15 backdrop-blur-xl px-4 py-3 rounded-3xl shadow-2xl flex items-center gap-2 sm:gap-4 max-w-full overflow-x-auto">
              {/* 1. Mute / Unmute Mic */}
              <button
                type="button"
                onClick={handleToggleMic}
                className={`p-3.5 rounded-2xl flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg ${
                  isMicMuted
                    ? 'bg-rose-500 text-white shadow-rose-500/30'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-white border border-white/10'
                }`}
                title={isMicMuted ? 'মাইক আনমিউট করুন' : 'মাইক মিউট করুন'}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* 2. Video Camera Off / On */}
              <button
                type="button"
                onClick={handleToggleVideo}
                className={`p-3.5 rounded-2xl flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg ${
                  isVideoOff
                    ? 'bg-rose-500 text-white shadow-rose-500/30'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-white border border-white/10'
                }`}
                title={isVideoOff ? 'ক্যামেরা চালু করুন' : 'ক্যামেরা বন্ধ করুন'}
              >
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>

              {/* 3. Flip Camera (Front / Back) */}
              <button
                type="button"
                onClick={handleFlipCamera}
                className="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-white border border-white/10 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg"
                title="ক্যামেরা ফ্লিপ করুন (সামনে/পেছনে)"
              >
                <SwitchCamera className="w-5 h-5 text-cyan-400" />
              </button>

              {/* 4. Screen Share */}
              <button
                type="button"
                onClick={handleToggleScreenShare}
                className={`p-3.5 rounded-2xl flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg ${
                  isScreenSharing
                    ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 font-bold'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-white border border-white/10'
                }`}
                title={isScreenSharing ? 'স্ক্রিন শেয়ার বন্ধ করুন' : 'স্ক্রিন শেয়ার করুন'}
              >
                <MonitorUp className="w-5 h-5" />
              </button>

              {/* 5. High-Res Screenshot Capture */}
              <button
                type="button"
                onClick={handleCaptureScreenshot}
                className="p-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-amber-400 border border-white/10 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-lg"
                title="চলমান ভিডিও কলের স্ক্রিনশট নিন"
              >
                <Camera className="w-5 h-5" />
              </button>

              {/* 6. End Call Button (Prominent Red Button) */}
              <button
                type="button"
                onClick={handleEndCall}
                className="p-3.5 sm:px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-rose-600/40 transition-all active:scale-90 cursor-pointer"
                title="কল কাটুন (End Call)"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="hidden sm:inline">কল শেষ</span>
              </button>
            </div>

            {/* Quick Tap Hint */}
            <p className="text-[10px] text-white/50 bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs font-mono">
              💡 স্ক্রিনে ট্যাপ করলে বাটনগুলো হাইড/শো হবে
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SCREENSHOT PREVIEW MODAL / BANNER (IF CAPTURED) */}
        {/* ========================================================================= */}
        {screenshotPreview && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 left-4 z-50 bg-slate-900/95 border border-emerald-500/40 p-3 rounded-2xl shadow-2xl backdrop-blur-md max-w-xs animate-fadeIn"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> স্ক্রিনশট সংরক্ষিত হয়েছে!
              </span>
              <button
                onClick={() => setScreenshotPreview(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <img
              src={screenshotPreview}
              alt="Screenshot Preview"
              className="w-full h-24 object-cover rounded-xl border border-slate-700"
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* CONFIGURATION DRAWER (FOR APP / ROOM CUSTOMIZATION) */}
        {/* ========================================================================= */}
        {isConfigOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 top-0 z-50 bg-slate-900/95 border-b border-slate-700 p-4 backdrop-blur-xl animate-fadeIn"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                localStorage.setItem('pts_metered_app_name', appName.trim());
                localStorage.setItem('pts_metered_room_name', customRoom.trim());
                if (onSaveMeteredConfig) {
                  onSaveMeteredConfig(appName.trim(), meteredApiKey);
                }
                setIsConfigOpen(false);
                initMeteredFrame();
              }}
              className="max-w-xl mx-auto space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" /> Metered Video App & Room সেটিংস
                </span>
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Metered App Name / ডোমেন
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="yourappname"
                      className="w-full bg-slate-950 border border-slate-700 rounded-l-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
                    />
                    <span className="bg-slate-800 border border-l-0 border-slate-700 px-2 py-1.5 text-[10px] text-slate-400 rounded-r-xl font-mono">
                      .metered.live
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    রুমের নাম (Room Name)
                  </label>
                  <input
                    type="text"
                    value={customRoom}
                    onChange={(e) => setCustomRoom(e.target.value)}
                    placeholder="tutorial"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-400 truncate max-w-xs">
                  লিঙ্ক: <span className="text-emerald-300 font-mono">{fullHttpsUrl}</span>
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={initMeteredFrame}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> রিলোড
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shadow"
                  >
                    সংরক্ষণ
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
