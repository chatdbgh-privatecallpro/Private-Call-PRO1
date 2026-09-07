import { db, auth, COLLECTIONS, collection, doc, setDoc, deleteDoc, onSnapshot, query, where, onAuthStateChanged } from '../firebase';

export type RealtimeEventType =
  | 'NEW_MESSAGE'
  | 'MESSAGE_STATUS_UPDATE'
  | 'TYPING_START'
  | 'TYPING_STOP'
  | 'VOICE_CALL_OFFER'
  | 'VOICE_CALL_ANSWER'
  | 'VOICE_CALL_ICE_CANDIDATE'
  | 'VOICE_CALL_ACCEPT'
  | 'VOICE_CALL_REJECT'
  | 'VOICE_CALL_START'
  | 'VOICE_CALL_END'
  | 'VOICE_CALL_STATUS'
  | 'PAYMENT_UPDATED'
  | 'ORDER_UPDATED'
  | 'USER_UPDATED'
  | 'SLOT_AVAILABILITY_UPDATED'
  | 'CLIENT_LOCATION_UPDATE';

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  data: any;
  senderId?: string;
  recipientId?: string;
  callSessionId?: string;
  timestamp: number;
  nonce?: string;
}

type EventCallback = (payload: RealtimeEventPayload) => void;

class RealtimeChannelService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<EventCallback> = new Set();
  private channelName = 'pts_live_realtime_bus_v4';
  private processedEventNonces: Set<string> = new Set();
  private isListeningFirestore = false;
  private currentUserId: string = 'USR-CUSTOMER';
  private unsubscribeFirestore: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUid = localStorage.getItem('active_user_id');
      if (savedUid) this.currentUserId = savedUid;

      if ('BroadcastChannel' in window) {
        try {
          this.channel = new BroadcastChannel(this.channelName);
          this.channel.onmessage = (event: MessageEvent<RealtimeEventPayload>) => {
            if (event && event.data) {
              this.handleIncomingPayload(event.data);
            }
          };
        } catch (e) {
          console.warn('BroadcastChannel fallback:', e);
        }
      }

      // Fallback: Storage event listener for cross-window / cross-tab sync
      window.addEventListener('storage', (e) => {
        if (e.key?.startsWith('pts_realtime_event_packet_') && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            this.handleIncomingPayload(parsed);
          } catch {}
        }
      });
    }

    // Initialize filtered Firestore listener
    this.setupFirestoreSignalListener();

    if (typeof window !== 'undefined') {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          this.setupFirestoreSignalListener();
        }
      });
    }
  }

  private userAliases: Set<string> = new Set();

  setCurrentUser(userId: string, additionalAliases?: string[]) {
    this.currentUserId = userId;
    this.userAliases = new Set([userId, 'all', 'broadcast']);
    if (additionalAliases) {
      additionalAliases.forEach((alias) => {
        if (alias) this.userAliases.add(alias);
      });
    }
    // Re-bind listener with updated user filter
    this.setupFirestoreSignalListener();
  }

  addUserAlias(alias: string) {
    if (alias && !this.userAliases.has(alias)) {
      this.userAliases.add(alias);
      this.setupFirestoreSignalListener();
    }
  }

  private setupFirestoreSignalListener() {
    if (typeof window === 'undefined') return;
    if (this.unsubscribeFirestore) {
      try {
        this.unsubscribeFirestore();
      } catch {}
      this.unsubscribeFirestore = null;
    }

    try {
      this.isListeningFirestore = true;
      const signalsCol = collection(db, COLLECTIONS.CALL_SIGNALS);
      const allowedRecipients = Array.from(this.userAliases.size > 0 ? this.userAliases : new Set([this.currentUserId, 'all', 'broadcast'])).slice(0, 10);

      // Targeted Listener: Filter signals for current user or registered aliases
      // Avoids global leakage of ICE candidates and call payloads
      const targetQuery = query(
        signalsCol,
        where('recipientId', 'in', allowedRecipients)
      );

      this.unsubscribeFirestore = onSnapshot(
        targetQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const data = change.doc.data();
              const docId = change.doc.id;

              if (data && data.type && data.nonce) {
                // Ignore events older than 45 seconds & auto-clean them
                if (data.timestamp && Date.now() - data.timestamp > 45000) {
                  deleteDoc(doc(db, COLLECTIONS.CALL_SIGNALS, docId)).catch(() => {});
                  return;
                }

                const payload: RealtimeEventPayload = {
                  type: data.type as RealtimeEventType,
                  data: data.data,
                  senderId: data.senderId,
                  recipientId: data.recipientId,
                  callSessionId: data.callSessionId,
                  timestamp: data.timestamp || Date.now(),
                  nonce: data.nonce,
                };

                this.handleIncomingPayload(payload);

                // Auto-cleanup WebRTC signal document once received to avoid Firestore bloat & candidate leakage
                if (data.type.startsWith('VOICE_CALL_') || data.type.startsWith('TYPING_')) {
                  setTimeout(() => {
                    deleteDoc(doc(db, COLLECTIONS.CALL_SIGNALS, docId)).catch(() => {});
                  }, 1000);
                }
              }
            }
          });
        },
        (err) => {
          // Fallback to basic collection query if composite index not yet ready
          if (err) {
            onSnapshot(
              signalsCol,
              (fallbackSnap) => {
                fallbackSnap.docChanges().forEach((change) => {
                  if (change.type === 'added') {
                    const data = change.doc.data();
                    const docId = change.doc.id;
                    if (data && data.type && data.nonce) {
                      // Filter client-side if query failed
                      if (data.recipientId && data.recipientId !== this.currentUserId && data.recipientId !== 'all' && data.recipientId !== 'broadcast') {
                        return;
                      }
                      if (data.timestamp && Date.now() - data.timestamp > 45000) {
                        deleteDoc(doc(db, COLLECTIONS.CALL_SIGNALS, docId)).catch(() => {});
                        return;
                      }
                      const payload: RealtimeEventPayload = {
                        type: data.type as RealtimeEventType,
                        data: data.data,
                        senderId: data.senderId,
                        recipientId: data.recipientId,
                        callSessionId: data.callSessionId,
                        timestamp: data.timestamp || Date.now(),
                        nonce: data.nonce,
                      };
                      this.handleIncomingPayload(payload);
                      if (data.type.startsWith('VOICE_CALL_')) {
                        setTimeout(() => {
                          deleteDoc(doc(db, COLLECTIONS.CALL_SIGNALS, docId)).catch(() => {});
                        }, 1200);
                      }
                    }
                  }
                });
              },
              () => {}
            );
          }
        }
      );
    } catch (e) {
      console.warn('Could not setup Firestore signal listener:', e);
    }
  }

  // Subscribe to real-time events
  subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Broadcast event (Strict 1-to-1 routing to avoid global ringing broadcast)
  broadcast(type: RealtimeEventType, data: any, senderId?: string, recipientId?: string) {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Explicit recipient targeting for voice calls and direct messages
    let effectiveRecipient = recipientId;
    if (!effectiveRecipient) {
      if (data?.targetUserId) effectiveRecipient = data.targetUserId;
      else if (data?.recipientId) effectiveRecipient = data.recipientId;
      else if (data?.toUserId) effectiveRecipient = data.toUserId;
      else if (data?.targetDeveloperId !== undefined && data?.targetDeveloperId !== null) {
        effectiveRecipient = `dev_${data.targetDeveloperId}`;
      } else if (type.startsWith('VOICE_CALL_')) {
        effectiveRecipient = data?.peerId || data?.callerId || 'targeted';
      } else {
        effectiveRecipient = 'all';
      }
    }

    const callSessionId = data?.callSessionId || data?.sessionId;

    const payload: RealtimeEventPayload = {
      type,
      data,
      senderId: senderId || this.currentUserId,
      recipientId: effectiveRecipient,
      callSessionId,
      timestamp: Date.now(),
      nonce,
    };

    // Mark as processed locally to prevent self-echo loop
    this.processedEventNonces.add(nonce);
    if (this.processedEventNonces.size > 500) {
      const first = Array.from(this.processedEventNonces).slice(0, 100);
      first.forEach((n) => this.processedEventNonces.delete(n));
    }

    // 1. Local BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (e) {
        console.warn('BroadcastChannel post error:', e);
      }
    }

    // 2. Storage Event trigger for iframe sync
    try {
      const storageKey = `pts_realtime_event_packet_${Date.now()}`;
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setTimeout(() => {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
      }, 1500);
    } catch {}

    // 3. Cloud Signaling via Firestore (Targeted & Auto-cleaned)
    if (
      type.startsWith('VOICE_CALL_') ||
      type.startsWith('TYPING_') ||
      type === 'PAYMENT_UPDATED' ||
      type === 'ORDER_UPDATED' ||
      type === 'SLOT_AVAILABILITY_UPDATED'
    ) {
      const docId = `SIG-${callSessionId || 'GEN'}-${type.replace(/[^a-zA-Z0-9_]/g, '_')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const sigDoc = doc(db, COLLECTIONS.CALL_SIGNALS, docId);
        setDoc(
          sigDoc,
          {
            type,
            data,
            senderId: payload.senderId,
            recipientId: effectiveRecipient,
            callSessionId,
            timestamp: Date.now(),
            nonce,
          },
          { merge: true }
        ).catch(() => {});
      } catch {}
    }

    // 4. Notify local listeners in current tab immediately
    this.notifyListeners(payload);
  }

  private handleIncomingPayload(payload: RealtimeEventPayload) {
    if (!payload || !payload.nonce) {
      this.notifyListeners(payload);
      return;
    }
    if (this.processedEventNonces.has(payload.nonce)) {
      return;
    }
    this.processedEventNonces.add(payload.nonce);
    if (this.processedEventNonces.size > 500) {
      const first = Array.from(this.processedEventNonces).slice(0, 100);
      first.forEach((n) => this.processedEventNonces.delete(n));
    }
    this.notifyListeners(payload);
  }

  private notifyListeners(payload: RealtimeEventPayload) {
    this.listeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error('Error in realtime listener:', e);
      }
    });
  }
}

export const realtimeBus = new RealtimeChannelService();
