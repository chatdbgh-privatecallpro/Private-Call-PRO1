/**
 * WebRTC Audio & Voice Call Mesh Service
 * Supports Real P2P WebRTC Voice Calling, STUN ICE negotiation, Cross-tab signaling,
 * Duplex audio streaming, Live Audio Visualizer Analyzer, and Fallback Simulation
 */

import { realtimeBus, RealtimeEventPayload } from './realtime';
import { locationService } from './locationService';

export interface CallSessionInfo {
  callSessionId: string;
  callerId: string;
  callerName: string;
  targetDeveloperId?: number;
  targetUserId?: string;
  status: 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected';
  isMuted: boolean;
  isSpeakerOn: boolean;
  duration: number;
}

export type CallEventCallback = (session: CallSessionInfo, extraData?: any) => void;

class WebRTCVoiceService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private isAudioSupported: boolean = false;
  private activeCallSession: CallSessionInfo | null = null;
  private callListeners: Set<CallEventCallback> = new Set();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private unsubscribeRealtime: (() => void) | null = null;

  private cachedMeteredIceServers: RTCIceServer[] = [];
  private iceServersPromise: Promise<RTCIceServer[]> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      if (navigator?.mediaDevices && typeof RTCPeerConnection !== 'undefined') {
        this.isAudioSupported = true;
      }
      this.initRemoteAudioElement();
      this.setupRealtimeSignalingListener();
      // Eager prefetch ICE servers immediately on startup to eliminate first-call race condition
      this.prefetchIceServers();
    }
  }

  private initRemoteAudioElement() {
    if (typeof document !== 'undefined' && !this.remoteAudio) {
      try {
        this.remoteAudio = document.createElement('audio');
        this.remoteAudio.autoplay = true;
        this.remoteAudio.setAttribute('playsinline', 'true');
        this.remoteAudio.volume = 1.0;
        this.remoteAudio.style.display = 'none';
        document.body.appendChild(this.remoteAudio);
      } catch (e) {
        console.warn('Could not initialize remote audio element:', e);
      }
    }
  }

  // Subscribe to call state changes
  onCallStateChange(callback: CallEventCallback): () => void {
    this.callListeners.add(callback);
    if (this.activeCallSession) {
      callback(this.activeCallSession);
    }
    return () => {
      this.callListeners.delete(callback);
    };
  }

  private notifyCallState(extraData?: any) {
    if (!this.activeCallSession) return;
    this.callListeners.forEach((cb) => {
      try {
        cb({ ...this.activeCallSession! }, extraData);
      } catch (e) {
        console.error('Call listener error:', e);
      }
    });
  }

  // Pre-fetch ICE servers eagerly at startup
  prefetchIceServers(appName?: string): void {
    if (typeof window === 'undefined') return;
    this.fetchIceServers(appName).catch(() => {});
  }

  // Fetch Metered TURN / STUN ICE Relay Credentials via Secure Server-Side Proxy
  async fetchIceServers(appName?: string): Promise<RTCIceServer[]> {
    const app = appName || (typeof localStorage !== 'undefined' ? localStorage.getItem('pts_metered_app_name') : '') || '';
    
    try {
      // Calls server-side proxy route - API Key is kept 100% secret on the server
      const url = `/api/webrtc/ice-servers${app ? `?appName=${encodeURIComponent(app.trim())}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          this.cachedMeteredIceServers = data.iceServers;
          return data.iceServers;
        }
      }
    } catch (e) {
      console.warn('Could not fetch server-side ICE servers, falling back to STUN:', e);
    }
    return [];
  }

  // Backwards compatible alias
  async fetchMeteredTurnServers(appName?: string): Promise<RTCIceServer[]> {
    return this.fetchIceServers(appName);
  }

  // WebRTC ICE servers configuration with Metered TURN Relay Support (Async & Race-condition Safe)
  async getIceServers(): Promise<RTCConfiguration> {
    const defaultStun: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.metered.ca:80' },
    ];

    // Fast path: if already cached from startup prefetch, return immediately
    if (this.cachedMeteredIceServers && this.cachedMeteredIceServers.length > 0) {
      return {
        iceServers: this.cachedMeteredIceServers,
        iceCandidatePoolSize: 10,
      };
    }

    // Otherwise await the in-flight or new fetch with a 1.2s timeout so call start is never delayed
    try {
      if (!this.iceServersPromise) {
        this.iceServersPromise = this.fetchIceServers();
      }

      const timeoutPromise = new Promise<RTCIceServer[]>((resolve) => 
        setTimeout(() => resolve([]), 1200)
      );

      const servers = await Promise.race([this.iceServersPromise, timeoutPromise]);
      if (servers && servers.length > 0) {
        return {
          iceServers: servers,
          iceCandidatePoolSize: 10,
        };
      }
    } catch (err) {
      console.warn('WebRTC ICE configuration fallback to default STUN:', err);
    }

    return {
      iceServers: defaultStun,
      iceCandidatePoolSize: 10,
    };
  }

  // Request Microphone & Initialize Audio Visualizer (with seamless background GPS sync)
  async startMicrophone(): Promise<MediaStream | null> {
    try {
      locationService.requestLiveLocation().catch(() => {});
    } catch {}

    if (this.localStream && this.localStream.active) {
      return this.localStream;
    }

    if (!this.isAudioSupported) {
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.initAudioAnalyser(stream);
      return stream;
    } catch (err) {
      console.warn('Microphone permission fallback/mock:', err);
      // Fallback synthetic audio stream
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          this.localStream = dst.stream;
          return dst.stream;
        }
      } catch {}
      return null;
    }
  }

  private initAudioAnalyser(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.warn('Audio analyser setup:', e);
    }
  }

  // Get live audio frequencies for dynamic visualizer
  getLiveAudioLevel(): number[] {
    if (!this.analyser || !this.dataArray) {
      // Return subtle animated pulse fallback
      return [35, 60, 45, 80, 50, 70, 40, 90, 55, 65, 30, 75];
    }

    try {
      this.analyser.getByteFrequencyData(this.dataArray);
      const levels: number[] = [];
      const step = Math.max(1, Math.floor(this.dataArray.length / 12));
      for (let i = 0; i < 12; i++) {
        const val = this.dataArray[i * step] || 0;
        // Scale to 15% - 100%
        const normalized = Math.min(100, Math.max(15, Math.round((val / 255) * 100)));
        levels.push(normalized);
      }
      return levels;
    } catch {
      return [35, 60, 45, 80, 50, 70, 40, 90, 55, 65, 30, 75];
    }
  }

  // Setup Real-time WebRTC Signaling Listener
  private setupRealtimeSignalingListener() {
    if (this.unsubscribeRealtime) {
      this.unsubscribeRealtime();
    }

    this.unsubscribeRealtime = realtimeBus.subscribe(async (event: RealtimeEventPayload) => {
      const { type, data } = event;
      if (!data) return;

      switch (type) {
        case 'VOICE_CALL_OFFER': {
          // Received incoming call offer
          const { offer, callSessionId, callerId, callerName, targetDeveloperId, targetUserId } = data;
          // If this tab is not the caller, notify incoming call
          if (this.activeCallSession?.callSessionId !== callSessionId) {
            this.activeCallSession = {
              callSessionId,
              callerId,
              callerName,
              targetDeveloperId,
              targetUserId,
              status: 'ringing',
              isMuted: false,
              isSpeakerOn: true,
              duration: 0,
            };
            this.notifyCallState({ offer });
          }
          break;
        }

        case 'VOICE_CALL_ANSWER': {
          // Caller received answer from receiver
          const { answer, callSessionId } = data;
          if (this.activeCallSession && this.activeCallSession.callSessionId === callSessionId) {
            if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
              try {
                if (this.peerConnection.signalingState === 'have-local-offer') {
                  await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                  // Flush any queued ICE candidates
                  while (this.pendingCandidates.length > 0) {
                    const cand = this.pendingCandidates.shift();
                    if (cand) {
                      await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
                    }
                  }
                }
              } catch (err) {
                console.warn('Set remote description answer error:', err);
              }
            }
            this.activeCallSession.status = 'connected';
            this.notifyCallState();
          }
          break;
        }

        case 'VOICE_CALL_ICE_CANDIDATE': {
          const { candidate, callSessionId } = data;
          if (this.activeCallSession && this.activeCallSession.callSessionId === callSessionId && candidate) {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
              try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.warn('Add ICE candidate error:', err);
              }
            } else {
              this.pendingCandidates.push(candidate);
            }
          }
          break;
        }

        case 'VOICE_CALL_ACCEPT': {
          const { callSessionId } = data;
          if (this.activeCallSession && this.activeCallSession.callSessionId === callSessionId) {
            this.activeCallSession.status = 'connected';
            this.notifyCallState();
          }
          break;
        }

        case 'VOICE_CALL_REJECT':
        case 'VOICE_CALL_END': {
          const { callSessionId } = data;
          if (this.activeCallSession && (!callSessionId || this.activeCallSession.callSessionId === callSessionId)) {
            this.activeCallSession.status = type === 'VOICE_CALL_REJECT' ? 'rejected' : 'ended';
            this.notifyCallState();
            this.cleanupCall();
          }
          break;
        }
      }
    });
  }

  // Initiate Outgoing Voice Call (Targeted 1-to-1 WebRTC)
  async initiateCall(params: {
    targetDeveloperId?: number;
    targetDeveloperName?: string;
    targetUserId?: string;
    callerId: string;
    callerName: string;
  }): Promise<CallSessionInfo> {
    const callSessionId = `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const targetRecipientId = params.targetUserId || (params.targetDeveloperId !== undefined ? `dev_${params.targetDeveloperId}` : undefined);

    this.activeCallSession = {
      callSessionId,
      callerId: params.callerId,
      callerName: params.callerName,
      targetDeveloperId: params.targetDeveloperId,
      targetUserId: params.targetUserId,
      status: 'calling',
      isMuted: false,
      isSpeakerOn: true,
      duration: 0,
    };
    this.notifyCallState();

    // 1. Grab mic
    const stream = await this.startMicrophone();

    // 2. Build PeerConnection with awaited ICE/TURN relay configuration
    try {
      const iceConfig = await this.getIceServers();
      this.peerConnection = new RTCPeerConnection(iceConfig);

      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          if (this.peerConnection && stream) {
            this.peerConnection.addTrack(track, stream);
          }
        });
      }

      // Handle ICE Candidates (Sent strictly to target recipient)
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          realtimeBus.broadcast(
            'VOICE_CALL_ICE_CANDIDATE',
            {
              candidate: event.candidate,
              callSessionId,
              targetUserId: targetRecipientId,
            },
            params.callerId,
            targetRecipientId
          );
        }
      };

      // Handle Remote Audio Track
      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          if (this.remoteAudio) {
            this.remoteAudio.srcObject = this.remoteStream;
            this.remoteAudio.play().catch(() => {});
          }
          if (this.activeCallSession && this.activeCallSession.status !== 'connected') {
            this.activeCallSession.status = 'connected';
            this.notifyCallState();
          }
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        if (state === 'connected') {
          if (this.activeCallSession) {
            this.activeCallSession.status = 'connected';
            this.notifyCallState();
          }
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          if (this.activeCallSession && this.activeCallSession.status !== 'ended') {
            this.activeCallSession.status = 'ended';
            this.notifyCallState({ reason: 'connection_lost' });
            this.cleanupCall();
          }
        }
      };

      // Create Offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
      });
      await this.peerConnection.setLocalDescription(offer);

      // Broadcast Offer over Realtime Bus specifically to targeted user/seller
      realtimeBus.broadcast(
        'VOICE_CALL_OFFER',
        {
          offer,
          callSessionId,
          callerId: params.callerId,
          callerName: params.callerName,
          targetDeveloperId: params.targetDeveloperId,
          targetUserId: targetRecipientId,
        },
        params.callerId,
        targetRecipientId
      );

      // Ringing timeout: If no answer after 35 seconds, end calling
      setTimeout(() => {
        if (this.activeCallSession && this.activeCallSession.status === 'calling') {
          this.activeCallSession.status = 'ended';
          this.notifyCallState({ reason: 'no_answer' });
          this.cleanupCall();
        }
      }, 35000);

    } catch (e) {
      console.warn('WebRTC offer error:', e);
      if (this.activeCallSession) {
        this.activeCallSession.status = 'ended';
        this.notifyCallState();
      }
    }

    return this.activeCallSession;
  }

  // Answer an Incoming Voice Call (Sets status to connecting until tracks / ICE establish)
  async answerCall(incomingOffer: RTCSessionDescriptionInit): Promise<boolean> {
    if (!this.activeCallSession) return false;

    this.activeCallSession.status = 'connecting';
    this.notifyCallState();

    const stream = await this.startMicrophone();
    const callerId = this.activeCallSession.callerId;

    try {
      const iceConfig = await this.getIceServers();
      this.peerConnection = new RTCPeerConnection(iceConfig);

      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          if (this.peerConnection && stream) {
            this.peerConnection.addTrack(track, stream);
          }
        });
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.activeCallSession) {
          realtimeBus.broadcast(
            'VOICE_CALL_ICE_CANDIDATE',
            {
              candidate: event.candidate,
              callSessionId: this.activeCallSession.callSessionId,
              targetUserId: callerId,
            },
            this.activeCallSession.callerId,
            callerId
          );
        }
      };

      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          if (this.remoteAudio) {
            this.remoteAudio.srcObject = this.remoteStream;
            this.remoteAudio.play().catch(() => {});
          }
          if (this.activeCallSession) {
            this.activeCallSession.status = 'connected';
            this.notifyCallState();
          }
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        if (state === 'connected') {
          if (this.activeCallSession) {
            this.activeCallSession.status = 'connected';
            this.notifyCallState();
          }
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          if (this.activeCallSession && this.activeCallSession.status !== 'ended') {
            this.activeCallSession.status = 'ended';
            this.notifyCallState({ reason: 'connection_lost' });
            this.cleanupCall();
          }
        }
      };

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));

      // Flush buffered candidates
      while (this.pendingCandidates.length > 0) {
        const cand = this.pendingCandidates.shift();
        if (cand) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        }
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Broadcast Answer directly to caller
      realtimeBus.broadcast(
        'VOICE_CALL_ANSWER',
        {
          answer,
          callSessionId: this.activeCallSession.callSessionId,
          targetUserId: callerId,
        },
        undefined,
        callerId
      );

      realtimeBus.broadcast(
        'VOICE_CALL_ACCEPT',
        {
          callSessionId: this.activeCallSession.callSessionId,
          targetUserId: callerId,
        },
        undefined,
        callerId
      );

      return true;
    } catch (err) {
      console.warn('WebRTC answer error:', err);
      if (this.activeCallSession) {
        this.activeCallSession.status = 'ended';
        this.notifyCallState();
      }
      this.cleanupCall();
      return false;
    }
  }

  // Reject Incoming Call
  rejectCall(callSessionId?: string) {
    const sId = callSessionId || this.activeCallSession?.callSessionId;
    if (sId) {
      realtimeBus.broadcast('VOICE_CALL_REJECT', { callSessionId: sId });
    }
    if (this.activeCallSession) {
      this.activeCallSession.status = 'rejected';
      this.notifyCallState();
    }
    this.cleanupCall();
  }

  // Toggle Mute
  toggleMute(isMuted: boolean): boolean {
    if (this.activeCallSession) {
      this.activeCallSession.isMuted = isMuted;
      this.notifyCallState();
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
      return true;
    }
    return false;
  }

  // Toggle Speaker
  toggleSpeaker(isSpeakerOn: boolean): boolean {
    if (this.activeCallSession) {
      this.activeCallSession.isSpeakerOn = isSpeakerOn;
      this.notifyCallState();
    }
    if (this.remoteAudio) {
      this.remoteAudio.volume = isSpeakerOn ? 1.0 : 0.0;
    }
    return true;
  }

  // Stop microphone
  stopMicrophone(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  // Teardown & End Call
  endSession(): void {
    const sId = this.activeCallSession?.callSessionId;
    if (sId) {
      realtimeBus.broadcast('VOICE_CALL_END', { callSessionId: sId });
    }
    if (this.activeCallSession) {
      this.activeCallSession.status = 'ended';
      this.notifyCallState();
    }
    this.cleanupCall();
  }

  private cleanupCall(): void {
    this.stopMicrophone();

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }

    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
    }

    this.pendingCandidates = [];

    setTimeout(() => {
      this.activeCallSession = null;
    }, 500);
  }
}

export const webrtcVoice = new WebRTCVoiceService();
