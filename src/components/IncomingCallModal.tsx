import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, PhoneCall, Radio, Volume2, ShieldCheck } from 'lucide-react';
import { webrtcVoice, CallSessionInfo } from '../utils/webrtc';
import { sounds } from '../utils/sound';
import { UserSession, UserAccount } from '../types';

interface IncomingCallModalProps {
  onCallAccepted: (session: CallSessionInfo) => void;
  currentUser?: UserSession | UserAccount | null;
  isOwner?: boolean;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  onCallAccepted,
  currentUser,
  isOwner = false,
}) => {
  const [incomingSession, setIncomingSession] = useState<CallSessionInfo | null>(null);
  const [pendingOffer, setPendingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stop ringtone loop helper
  const stopRingSound = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
  };

  // Start ringtone loop helper
  const startRingSound = () => {
    stopRingSound();
    sounds.playCallRing();
    ringIntervalRef.current = setInterval(() => {
      sounds.playCallRing();
    }, 2800);
  };

  useEffect(() => {
    const unsubscribe = webrtcVoice.onCallStateChange((session, extraData) => {
      const currentId = (currentUser as any)?.id || (currentUser as any)?.userId;
      const currentUsername = (currentUser as any)?.username;
      const currentSellerId = (currentUser as any)?.sellerId;

      // If caller is the same as current session, do not show incoming modal
      if (
        session.callerId &&
        (session.callerId === currentId ||
          (currentUsername && (session.callerId === currentUsername || session.callerId === `seller_${currentUsername}`)) ||
          (currentSellerId && session.callerId === `dev_${currentSellerId}`))
      ) {
        return;
      }

      // Check recipient match: only pop up if current user is the targeted buyer/seller or owner
      const isTargeted =
        !session.targetUserId ||
        (currentId && (session.targetUserId === currentId || session.targetUserId === `user_${currentId}`)) ||
        (currentUsername && (session.targetUserId === currentUsername || session.targetUserId === `seller_${currentUsername}`)) ||
        (session.targetDeveloperId !== undefined && (currentSellerId === session.targetDeveloperId || currentUser?.role === 'developer' || currentUser?.role === 'seller')) ||
        isOwner;

      if (session.status === 'ringing' && isTargeted) {
        setIncomingSession(session);
        if (extraData?.offer) {
          setPendingOffer(extraData.offer);
        }
        startRingSound();
      } else if (session.status === 'ended' || session.status === 'rejected' || session.status === 'connected') {
        stopRingSound();
        setIncomingSession(null);
        setPendingOffer(null);
      }
    });

    return () => {
      stopRingSound();
      unsubscribe();
    };
  }, [currentUser, isOwner]);

  if (!incomingSession || incomingSession.status !== 'ringing') {
    return null;
  }

  const handleAccept = async () => {
    stopRingSound();
    sounds.playCallConnected();
    if (pendingOffer) {
      await webrtcVoice.answerCall(pendingOffer);
    }
    onCallAccepted(incomingSession);
    setIncomingSession(null);
  };

  const handleDecline = () => {
    stopRingSound();
    sounds.playCancel();
    webrtcVoice.rejectCall(incomingSession.callSessionId);
    setIncomingSession(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl shadow-emerald-500/20 text-center space-y-5 relative overflow-hidden">
        {/* Animated ambient glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-lime-400/15 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs font-bold text-emerald-300 font-mono">
          <Radio className="w-3.5 h-3.5 animate-pulse text-lime-400" />
          <span>ইনকামিং WebRTC ভয়েস কল</span>
        </div>

        {/* Caller Avatar with pulsing waves */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
          <div className="relative w-full h-full rounded-full p-1 bg-gradient-to-tr from-lime-400 to-emerald-500 shadow-xl shadow-emerald-500/40 overflow-hidden flex items-center justify-center bg-slate-950">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(incomingSession.callerName || 'Caller')}`}
              alt={incomingSession.callerName}
              className="w-full h-full object-cover rounded-full bg-slate-900"
            />
          </div>
        </div>

        {/* Caller Info */}
        <div className="space-y-1">
          <h3 className="text-lg font-black text-white">{incomingSession.callerName || 'কাস্টমার / হোস্ট'}</h3>
          <p className="text-xs text-slate-400">লাইভ অডিও সেশনে যুক্ত হতে কল করছেন...</p>
        </div>

        {/* Call Action Buttons */}
        <div className="flex items-center justify-center gap-6 pt-3">
          {/* Decline Button */}
          <button
            type="button"
            onClick={handleDecline}
            className="flex flex-col items-center gap-1.5 text-xs text-rose-400 font-semibold transition active:scale-95 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-rose-600/90 group-hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span>বাতিল</span>
          </button>

          {/* Accept Button */}
          <button
            type="button"
            onClick={handleAccept}
            className="flex flex-col items-center gap-1.5 text-xs text-emerald-400 font-semibold transition active:scale-95 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-lime-400 group-hover:from-emerald-400 group-hover:to-lime-300 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-bounce">
              <PhoneCall className="w-6 h-6" />
            </div>
            <span>রিসিভ করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
