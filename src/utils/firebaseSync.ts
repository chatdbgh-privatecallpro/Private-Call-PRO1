import {
  db,
  auth,
  onAuthStateChanged,
  COLLECTIONS,
  CONFIG_DOCS,
  authReady,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from '../firebase';
import {
  UserAccount,
  Developer,
  ChatMessage,
  PaymentRequest,
  SellerWithdrawRequest,
  ServiceOrder,
  PaymentSettings,
  SiteConfig,
  RechargePackage,
  FirebaseAccessRequest,
} from '../types';
import {
  INITIAL_DEVELOPERS,
  INITIAL_SETTINGS,
  INITIAL_SITE_CONFIG,
  INITIAL_USERS,
  INITIAL_WITHDRAW_REQUESTS,
  RECHARGE_PACKAGES,
} from '../data/initialData';
import { realtimeBus } from './realtime';
import { hashPassword } from './security';

export interface DatabaseBackupRecord {
  id: string;
  createdAt: string;
  timestamp: number;
  note?: string;
  creatorName?: string;
  counts: {
    users: number;
    developers: number;
    messages: number;
    payments: number;
    orders: number;
    withdraws: number;
  };
  data?: {
    users: UserAccount[];
    developers: Developer[];
    messages: ChatMessage[];
    payments: PaymentRequest[];
    orders: ServiceOrder[];
    withdraws: SellerWithdrawRequest[];
    siteConfig: SiteConfig;
    paymentSettings: PaymentSettings;
    rechargePackages: RechargePackage[];
  };
}

class FirebaseSyncService {
  private isInitialized = false;
  private isAuthListenerBound = false;
  private seedingCollections = new Set<string>();
  private activeCallbacks: any = null;
  private unsubs: (() => void)[] = [];
  private retryTimeout: any = null;

  /**
   * Checks if initial seeding has already been performed in Firestore.
   * If the metadata flag exists, we DO NOT re-seed hardcoded demo data when collections are empty.
   */
  private async hasCompletedInitialSeed(colName: string): Promise<boolean> {
    try {
      await authReady;
      const metaDoc = doc(db, COLLECTIONS.SYSTEM_CONFIG, `seed_status_${colName}`);
      const snap = await getDoc(metaDoc);
      return snap.exists() && snap.data()?.hasSeeded === true;
    } catch {
      return false;
    }
  }

  private async markCompletedInitialSeed(colName: string): Promise<void> {
    try {
      await authReady;
      const metaDoc = doc(db, COLLECTIONS.SYSTEM_CONFIG, `seed_status_${colName}`);
      await setDoc(metaDoc, { hasSeeded: true, seededAt: Date.now() }, { merge: true });
    } catch (e) {
      console.warn(`Could not mark seed metadata for ${colName}:`, e);
    }
  }

  /**
   * Reconnect all active listeners
   */
  public reconnect(): void {
    if (this.activeCallbacks) {
      this.clearListeners();
      this.setupListeners(this.activeCallbacks);
    }
  }

  private clearListeners(): void {
    this.unsubs.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    this.unsubs = [];
  }

  private scheduleRetry(): void {
    if (this.retryTimeout) return;
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      if (this.activeCallbacks) {
        console.log('🔄 Auto-reconnecting Firestore listeners...');
        this.reconnect();
      }
    }, 2500);
  }

  private setupListeners(callbacks: any): void {
    const unsubs = this.unsubs;

    // 1. Listen to Users
    try {
      const usersCol = collection(db, COLLECTIONS.USERS);
      const unsubUsers = onSnapshot(
        usersCol,
        async (snapshot) => {
          if (snapshot.empty) {
            if (!this.seedingCollections.has(COLLECTIONS.USERS)) {
              const alreadySeeded = await this.hasCompletedInitialSeed(COLLECTIONS.USERS);
              if (!alreadySeeded) {
                this.seedInitialUsers();
              } else if (callbacks.onUsersChange) {
                callbacks.onUsersChange([]);
              }
            }
          } else {
            const list: UserAccount[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as UserAccount;
              list.push({ ...data, id: docSnap.id });
            });
            if (callbacks.onUsersChange) {
              callbacks.onUsersChange(list);
            }
          }
        },
        (error) => {
          console.warn('Users onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubUsers);
    } catch (e) {
      console.warn('Error setting up users listener:', e);
    }

    // 2. Listen to Developers
    try {
      const devsCol = collection(db, COLLECTIONS.DEVELOPERS);
      const unsubDevs = onSnapshot(
        devsCol,
        async (snapshot) => {
          if (snapshot.empty) {
            if (!this.seedingCollections.has(COLLECTIONS.DEVELOPERS)) {
              const alreadySeeded = await this.hasCompletedInitialSeed(COLLECTIONS.DEVELOPERS);
              if (!alreadySeeded) {
                this.seedInitialDevelopers();
              } else if (callbacks.onDevelopersChange) {
                callbacks.onDevelopersChange([]);
              }
            }
          } else {
            const list: Developer[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Developer;
              const numId = Number(docSnap.id) || data.id;
              list.push({ ...data, id: numId });
            });
            list.sort((a, b) => a.id - b.id);
            if (callbacks.onDevelopersChange) {
              callbacks.onDevelopersChange(list);
            }
          }
        },
        (error) => {
          console.warn('Developers onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubDevs);
    } catch (e) {
      console.warn('Error setting up developers listener:', e);
    }

    // 3. Listen to Chat Messages (Live Realtime cross-device)
    try {
      const messagesCol = collection(db, COLLECTIONS.CHAT_MESSAGES);
      const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(500));
      const unsubMessages = onSnapshot(
        q,
        async (snapshot) => {
          if (snapshot.empty) {
            if (!this.seedingCollections.has(COLLECTIONS.CHAT_MESSAGES)) {
              const alreadySeeded = await this.hasCompletedInitialSeed(COLLECTIONS.CHAT_MESSAGES);
              if (!alreadySeeded) {
                this.seedInitialMessages();
              } else if (callbacks.onMessagesChange) {
                callbacks.onMessagesChange([]);
              }
            }
          } else {
            const list: ChatMessage[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as ChatMessage;
              list.push({ ...data, id: docSnap.id });
            });
            if (callbacks.onMessagesChange) {
              callbacks.onMessagesChange(list);
            }
          }
        },
        (error) => {
          console.warn('Messages onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubMessages);
    } catch (e) {
      console.warn('Error setting up messages listener:', e);
    }

    // 4. Listen to Payment Requests
    try {
      const paymentsCol = collection(db, COLLECTIONS.PAYMENT_REQUESTS);
      const unsubPayments = onSnapshot(
        paymentsCol,
        (snapshot) => {
          const list: PaymentRequest[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as PaymentRequest;
            list.push({ ...data, id: docSnap.id });
          });
          if (callbacks.onPaymentsChange) {
            callbacks.onPaymentsChange(list);
          }
        },
        (error) => {
          console.warn('Payments onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubPayments);
    } catch (e) {
      console.warn('Error setting up payments listener:', e);
    }

    // 5. Listen to Service Orders
    try {
      const ordersCol = collection(db, COLLECTIONS.ORDERS);
      const unsubOrders = onSnapshot(
        ordersCol,
        (snapshot) => {
          const list: ServiceOrder[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as ServiceOrder;
            list.push({ ...data, id: docSnap.id });
          });
          if (callbacks.onOrdersChange) {
            callbacks.onOrdersChange(list);
          }
        },
        (error) => {
          console.warn('Orders onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubOrders);
    } catch (e) {
      console.warn('Error setting up orders listener:', e);
    }

    // 6. Listen to Withdraw Requests
    try {
      const withdrawsCol = collection(db, COLLECTIONS.WITHDRAW_REQUESTS);
      const unsubWithdraws = onSnapshot(
        withdrawsCol,
        async (snapshot) => {
          if (snapshot.empty) {
            if (!this.seedingCollections.has(COLLECTIONS.WITHDRAW_REQUESTS)) {
              const alreadySeeded = await this.hasCompletedInitialSeed(COLLECTIONS.WITHDRAW_REQUESTS);
              if (!alreadySeeded) {
                this.seedInitialWithdraws();
              } else if (callbacks.onWithdrawsChange) {
                callbacks.onWithdrawsChange([]);
              }
            }
          } else {
            const list: SellerWithdrawRequest[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as SellerWithdrawRequest;
              list.push({ ...data, id: docSnap.id });
            });
            if (callbacks.onWithdrawsChange) {
              callbacks.onWithdrawsChange(list);
            }
          }
        },
        (error) => {
          console.warn('Withdraws onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubWithdraws);
    } catch (e) {
      console.warn('Error setting up withdraws listener:', e);
    }

    // 7. Listen to Site Config
    try {
      const siteConfigDoc = doc(db, COLLECTIONS.SYSTEM_CONFIG, CONFIG_DOCS.SITE_CONFIG);
      const unsubConfig = onSnapshot(
        siteConfigDoc,
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as SiteConfig;
            if (callbacks.onSiteConfigChange) {
              callbacks.onSiteConfigChange(data);
            }
          } else if (!this.seedingCollections.has('config_site')) {
            const alreadySeeded = await this.hasCompletedInitialSeed('config_site');
            if (!alreadySeeded) {
              this.seedingCollections.add('config_site');
              await this.saveSiteConfig(INITIAL_SITE_CONFIG);
              await this.markCompletedInitialSeed('config_site');
              this.seedingCollections.delete('config_site');
            }
          }
        },
        (error) => {
          console.warn('Site config onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubConfig);
    } catch (e) {
      console.warn('Error setting up site config listener:', e);
    }

    // 8. Listen to Payment Settings
    try {
      const paySettingsDoc = doc(db, COLLECTIONS.SYSTEM_CONFIG, CONFIG_DOCS.PAYMENT_SETTINGS);
      const unsubPaySettings = onSnapshot(
        paySettingsDoc,
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as PaymentSettings;
            if (callbacks.onPaymentSettingsChange) {
              callbacks.onPaymentSettingsChange(data);
            }
          } else if (!this.seedingCollections.has('config_payment')) {
            const alreadySeeded = await this.hasCompletedInitialSeed('config_payment');
            if (!alreadySeeded) {
              this.seedingCollections.add('config_payment');
              await this.savePaymentSettings(INITIAL_SETTINGS);
              await this.markCompletedInitialSeed('config_payment');
              this.seedingCollections.delete('config_payment');
            }
          }
        },
        (error) => {
          console.warn('Payment settings onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubPaySettings);
    } catch (e) {
      console.warn('Error setting up payment settings listener:', e);
    }

    // 9. Listen to Recharge Packages
    try {
      const pkgCol = collection(db, COLLECTIONS.RECHARGE_PACKAGES);
      const unsubPkg = onSnapshot(
        pkgCol,
        async (snapshot) => {
          if (snapshot.empty) {
            if (!this.seedingCollections.has(COLLECTIONS.RECHARGE_PACKAGES)) {
              const alreadySeeded = await this.hasCompletedInitialSeed(COLLECTIONS.RECHARGE_PACKAGES);
              if (!alreadySeeded) {
                this.seedInitialPackages();
              } else if (callbacks.onRechargePackagesChange) {
                callbacks.onRechargePackagesChange([]);
              }
            }
          } else {
            const list: RechargePackage[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as RechargePackage;
              list.push({ ...data, id: docSnap.id });
            });
            if (callbacks.onRechargePackagesChange) {
              callbacks.onRechargePackagesChange(list);
            }
          }
        },
        (error) => {
          console.warn('Recharge packages onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubPkg);
    } catch (e) {
      console.warn('Error setting up packages listener:', e);
    }

    // 11. Listen to Firebase Access Requests
    try {
      const reqCol = collection(db, COLLECTIONS.ACCESS_REQUESTS);
      const unsubReqs = onSnapshot(
        reqCol,
        (snapshot) => {
          const list: FirebaseAccessRequest[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as FirebaseAccessRequest;
            list.push({ ...data, id: docSnap.id });
          });
          list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
          if (callbacks.onAccessRequestsChange) {
            callbacks.onAccessRequestsChange(list);
          }
        },
        (error) => {
          console.warn('Access requests onSnapshot notice:', error?.message || error);
          this.scheduleRetry();
        }
      );
      unsubs.push(unsubReqs);
    } catch (e) {
      console.warn('Error setting up access requests listener:', e);
    }
  }

  /**
   * Initialize all real-time Firestore listeners and auto-seed initial data once Auth is confirmed ready.
   */
  init(callbacks: {
    onUsersChange?: (users: UserAccount[]) => void;
    onDevelopersChange?: (devs: Developer[]) => void;
    onMessagesChange?: (messages: ChatMessage[]) => void;
    onPaymentsChange?: (payments: PaymentRequest[]) => void;
    onOrdersChange?: (orders: ServiceOrder[]) => void;
    onWithdrawsChange?: (withdraws: SellerWithdrawRequest[]) => void;
    onSiteConfigChange?: (config: SiteConfig) => void;
    onPaymentSettingsChange?: (settings: PaymentSettings) => void;
    onRechargePackagesChange?: (packages: RechargePackage[]) => void;
    onAccessRequestsChange?: (requests: FirebaseAccessRequest[]) => void;
  }): () => void {
    this.activeCallbacks = callbacks;

    if (!this.isAuthListenerBound && typeof window !== 'undefined') {
      this.isAuthListenerBound = true;
      onAuthStateChanged(auth, (user) => {
        if (user && this.activeCallbacks) {
          console.log('⚡ Firebase Auth state active for Firestore sync:', user.uid);
          this.reconnect();
        }
      });
    }

    if (this.isInitialized) {
      this.reconnect();
      return () => {
        this.clearListeners();
      };
    }
    this.isInitialized = true;

    // Await authReady before setting up listeners or seeding collections
    authReady.then(() => {
      this.setupListeners(callbacks);
    });

    return () => {
      this.clearListeners();
    };
  }

  // --- Seeding Helpers (Safe, Independent & Strictly Idempotent) ---
  private async seedInitialUsers(): Promise<boolean> {
    this.seedingCollections.add(COLLECTIONS.USERS);
    try {
      await authReady;
      const batch = writeBatch(db);
      for (const u of INITIAL_USERS) {
        const uDoc = doc(db, COLLECTIONS.USERS, u.id);
        const userToSeed = { ...u };
        if (userToSeed.password && !userToSeed.password.startsWith('sha256$')) {
          userToSeed.password = await hashPassword(userToSeed.password);
        }
        batch.set(uDoc, userToSeed);
      }
      await batch.commit();
      await this.markCompletedInitialSeed(COLLECTIONS.USERS);
      console.log('Seeded initial users to Firestore');
      return true;
    } catch (e) {
      console.warn('Error seeding users:', e);
      return false;
    } finally {
      this.seedingCollections.delete(COLLECTIONS.USERS);
    }
  }

  private async seedInitialDevelopers(): Promise<boolean> {
    this.seedingCollections.add(COLLECTIONS.DEVELOPERS);
    try {
      await authReady;
      const batch = writeBatch(db);
      for (const d of INITIAL_DEVELOPERS) {
        const dDoc = doc(db, COLLECTIONS.DEVELOPERS, d.id.toString());
        const devToSeed = { ...d };
        if (devToSeed.password && !devToSeed.password.startsWith('sha256$')) {
          devToSeed.password = await hashPassword(devToSeed.password);
        }
        batch.set(dDoc, devToSeed);
      }
      await batch.commit();
      await this.markCompletedInitialSeed(COLLECTIONS.DEVELOPERS);
      console.log('Seeded initial developers to Firestore');
      return true;
    } catch (e) {
      console.warn('Error seeding developers:', e);
      return false;
    } finally {
      this.seedingCollections.delete(COLLECTIONS.DEVELOPERS);
    }
  }

  private async seedInitialMessages(): Promise<boolean> {
    this.seedingCollections.add(COLLECTIONS.CHAT_MESSAGES);
    try {
      await authReady;
      const welcomeMsg: ChatMessage = {
        id: 'welcome-1',
        sender: 'bot',
        text: '👋 হ্যালো! আমাদের প্রাইভেট চ্যাট ও সার্ভিস প্ল্যাটফর্মে আপনাকে স্বাগতম। আপনি এখান থেকে সেরা ডেভেলপার ও হোস্টদের সাথে সরাসরি কথা বলে ডায়মন্ডের মাধ্যমে যেকোনো সার্ভিস নিতে পারবেন।',
        timestamp: 'এখন',
        createdAt: Date.now(),
      };
      await setDoc(doc(db, COLLECTIONS.CHAT_MESSAGES, welcomeMsg.id), welcomeMsg);
      await this.markCompletedInitialSeed(COLLECTIONS.CHAT_MESSAGES);
      return true;
    } catch (e) {
      console.warn('Error seeding message:', e);
      return false;
    } finally {
      this.seedingCollections.delete(COLLECTIONS.CHAT_MESSAGES);
    }
  }

  private async seedInitialWithdraws(): Promise<boolean> {
    this.seedingCollections.add(COLLECTIONS.WITHDRAW_REQUESTS);
    try {
      await authReady;
      const batch = writeBatch(db);
      for (const w of INITIAL_WITHDRAW_REQUESTS) {
        batch.set(doc(db, COLLECTIONS.WITHDRAW_REQUESTS, w.id), w);
      }
      await batch.commit();
      await this.markCompletedInitialSeed(COLLECTIONS.WITHDRAW_REQUESTS);
      return true;
    } catch (e) {
      console.warn('Error seeding withdraws:', e);
      return false;
    } finally {
      this.seedingCollections.delete(COLLECTIONS.WITHDRAW_REQUESTS);
    }
  }

  private async seedInitialPackages(): Promise<boolean> {
    this.seedingCollections.add(COLLECTIONS.RECHARGE_PACKAGES);
    try {
      await authReady;
      const batch = writeBatch(db);
      for (const p of RECHARGE_PACKAGES) {
        batch.set(doc(db, COLLECTIONS.RECHARGE_PACKAGES, p.id), p);
      }
      await batch.commit();
      await this.markCompletedInitialSeed(COLLECTIONS.RECHARGE_PACKAGES);
      return true;
    } catch (e) {
      console.warn('Error seeding packages:', e);
      return false;
    } finally {
      this.seedingCollections.delete(COLLECTIONS.RECHARGE_PACKAGES);
    }
  }

  // Helper: Secure Admin Token headers for proxy fallbacks (Zero plaintext keys)
  private async getAdminHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    // 1. Get native server session token if present
    let serverToken = '';
    try {
      serverToken = localStorage.getItem('admin_server_token') || '';
      if (!serverToken) {
        const rawSession = localStorage.getItem('user_session');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed.token && parsed.token.startsWith('pts_sess_')) {
            serverToken = parsed.token;
          }
        }
      }
    } catch {}

    // 2. Get Firebase ID token if available
    let firebaseToken = '';
    try {
      if (auth.currentUser) {
        firebaseToken = await auth.currentUser.getIdToken();
      }
    } catch (err) {
      console.warn('Could not retrieve Firebase token for admin proxy call:', err);
    }

    const effectiveToken = serverToken || firebaseToken;
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
      headers['x-admin-token'] = effectiveToken;
    }

    return headers;
  }

  // --- Realtime Firestore CRUD APIs with Auth Readiness & Return Confirmation ---

  // Save/Update User
  async saveUser(user: UserAccount): Promise<boolean> {
    try {
      await authReady;
      const safeUser = { ...user };
      if (safeUser.password && !safeUser.password.startsWith('sha256$')) {
        safeUser.password = await hashPassword(safeUser.password);
      }
      const uDoc = doc(db, COLLECTIONS.USERS, safeUser.id);
      await setDoc(uDoc, safeUser, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore direct saveUser notice, attempting admin server proxy:', e);
      try {
        const safeUser = { ...user };
        if (safeUser.password && !safeUser.password.startsWith('sha256$')) {
          safeUser.password = await hashPassword(safeUser.password);
        }
        const res = await fetch('/api/admin/save-user', {
          method: 'POST',
          headers: await this.getAdminHeaders(),
          body: JSON.stringify(safeUser),
        });
        return res.ok;
      } catch {
        return false;
      }
    }
  }

  // Batch Save/Update Users
  async saveUsers(users: UserAccount[]): Promise<boolean> {
    try {
      await authReady;
      const batch = writeBatch(db);
      for (const u of users) {
        const safeUser = { ...u };
        if (safeUser.password && !safeUser.password.startsWith('sha256$')) {
          safeUser.password = await hashPassword(safeUser.password);
        }
        const uDoc = doc(db, COLLECTIONS.USERS, safeUser.id);
        batch.set(uDoc, safeUser, { merge: true });
      }
      await batch.commit();
      return true;
    } catch (e) {
      console.warn('Firestore saveUsers error, falling back to sequential proxy:', e);
      let allOk = true;
      for (const u of users) {
        const ok = await this.saveUser(u);
        if (!ok) allOk = false;
      }
      return allOk;
    }
  }

  // Delete User
  async deleteUser(userId: string): Promise<boolean> {
    try {
      await authReady;
      await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
      return true;
    } catch (e) {
      console.warn('Firestore direct deleteUser error, trying admin server proxy:', e);
      try {
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: await this.getAdminHeaders(),
          body: JSON.stringify({ userId }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }
  }

  // Save/Update Developer
  async saveDeveloper(developer: Developer): Promise<boolean> {
    try {
      await authReady;
      const safeDev = { ...developer };
      if (safeDev.password && !safeDev.password.startsWith('sha256$')) {
        safeDev.password = await hashPassword(safeDev.password);
      }
      const dDoc = doc(db, COLLECTIONS.DEVELOPERS, safeDev.id.toString());
      await setDoc(dDoc, safeDev, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore direct saveDeveloper notice, trying admin server proxy:', e);
      try {
        const safeDev = { ...developer };
        if (safeDev.password && !safeDev.password.startsWith('sha256$')) {
          safeDev.password = await hashPassword(safeDev.password);
        }
        const res = await fetch('/api/admin/save-developer', {
          method: 'POST',
          headers: await this.getAdminHeaders(),
          body: JSON.stringify(safeDev),
        });
        return res.ok;
      } catch {
        return false;
      }
    }
  }

  // Save all Developers
  async saveDevelopers(developers: Developer[]): Promise<boolean> {
    try {
      await authReady;
      const batch = writeBatch(db);
      for (const d of developers) {
        const safeDev = { ...d };
        if (safeDev.password && !safeDev.password.startsWith('sha256$')) {
          safeDev.password = await hashPassword(safeDev.password);
        }
        const dDoc = doc(db, COLLECTIONS.DEVELOPERS, safeDev.id.toString());
        batch.set(dDoc, safeDev, { merge: true });
      }
      await batch.commit();
      return true;
    } catch (e) {
      console.warn('Firestore saveDevelopers error, attempting individual proxy:', e);
      let allOk = true;
      for (const d of developers) {
        const ok = await this.saveDeveloper(d);
        if (!ok) allOk = false;
      }
      return allOk;
    }
  }

  // Delete Developer
  async deleteDeveloper(devId: number): Promise<boolean> {
    try {
      await authReady;
      await deleteDoc(doc(db, COLLECTIONS.DEVELOPERS, devId.toString()));
      return true;
    } catch (e) {
      console.warn('Firestore direct deleteDeveloper notice, trying admin server proxy:', e);
      try {
        const res = await fetch('/api/admin/delete-developer', {
          method: 'POST',
          headers: await this.getAdminHeaders(),
          body: JSON.stringify({ devId }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }
  }

  // Send / Save Chat Message (Realtime Sync with 1-to-1 Privacy Isolation)
  async sendChatMessage(message: ChatMessage): Promise<boolean> {
    try {
      await authReady;
      const msgId = message.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const senderUserId = message.senderUserId || auth.currentUser?.uid || 'user_anon';
      const receiverUserId = message.receiverUserId || (message.developerId !== undefined ? `dev_${message.developerId}` : 'admin');
      
      const participantsSet = new Set<string>();
      if (senderUserId) participantsSet.add(senderUserId);
      if (receiverUserId) participantsSet.add(receiverUserId);
      if (message.developerId !== undefined) participantsSet.add(`dev_${message.developerId}`);
      if (message.participants) {
        message.participants.forEach((p) => participantsSet.add(p));
      }

      const msgToSave: ChatMessage = {
        ...message,
        id: msgId,
        senderUserId,
        receiverUserId,
        participants: Array.from(participantsSet),
        createdAt: message.createdAt || Date.now(),
      };
      await setDoc(doc(db, COLLECTIONS.CHAT_MESSAGES, msgId), msgToSave);
      realtimeBus.broadcast('NEW_MESSAGE', msgToSave, senderUserId, receiverUserId);
      return true;
    } catch (e) {
      console.warn('Firestore sendChatMessage error:', e);
      realtimeBus.broadcast('NEW_MESSAGE', message);
      return false;
    }
  }

  // Delete Chat Message
  async deleteChatMessage(messageId: string): Promise<boolean> {
    try {
      await authReady;
      await deleteDoc(doc(db, COLLECTIONS.CHAT_MESSAGES, messageId));
      return true;
    } catch (e) {
      console.warn('Firestore deleteChatMessage error:', e);
      return false;
    }
  }

  // Clear specific chat history
  async clearDeveloperMessages(developerId?: number): Promise<boolean> {
    try {
      await authReady;
      const colRef = collection(db, COLLECTIONS.CHAT_MESSAGES);
      const snapshot = await getDocs(colRef);
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ChatMessage;
        if (developerId === undefined || data.developerId === developerId) {
          batch.delete(docSnap.ref);
        }
      });
      await batch.commit();
      return true;
    } catch (e) {
      console.warn('Firestore clearDeveloperMessages error:', e);
      return false;
    }
  }

  // Save Payment Request
  async savePaymentRequest(request: PaymentRequest): Promise<boolean> {
    try {
      await authReady;
      const pDoc = doc(db, COLLECTIONS.PAYMENT_REQUESTS, request.id);
      await setDoc(pDoc, request, { merge: true });
      realtimeBus.broadcast('PAYMENT_UPDATED', request);
      return true;
    } catch (e) {
      console.warn('Firestore savePaymentRequest error:', e);
      return false;
    }
  }

  // Save Service Order
  async saveOrder(order: ServiceOrder): Promise<boolean> {
    try {
      await authReady;
      const oDoc = doc(db, COLLECTIONS.ORDERS, order.id);
      await setDoc(oDoc, order, { merge: true });
      realtimeBus.broadcast('ORDER_UPDATED', order);
      return true;
    } catch (e) {
      console.warn('Firestore saveOrder error:', e);
      return false;
    }
  }

  // Server-Authoritative Hire Order Creation with Atomic Diamond Deduction (Authenticated)
  async createHireOrder(params: {
    userId: string;
    userName?: string;
    userAvatar?: string;
    userPhone?: string;
    developerId: number;
    durationMinutes: number;
    requirements?: string;
    durationText?: string;
  }): Promise<{ success: boolean; order?: ServiceOrder; updatedDiamonds?: number; error?: string }> {
    try {
      await authReady;
      const headers = await this.getAdminHeaders();
      const res = await fetch('/api/orders/hire', {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'হায়ার অর্ডার প্রক্রিয়াকরণে সমস্যা হয়েছে' };
      }
      if (data.order) {
        realtimeBus.broadcast('ORDER_UPDATED', data.order);
      }
      return { success: true, order: data.order, updatedDiamonds: data.updatedDiamonds };
    } catch (e: unknown) {
      console.warn('createHireOrder server error:', e);
      const errMsg = e instanceof Error ? e.message : 'নেটওয়ার্ক সংযোগ ত্রুটি';
      return { success: false, error: errMsg };
    }
  }

  // Delete Service Order
  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      await authReady;
      await deleteDoc(doc(db, COLLECTIONS.ORDERS, orderId));
      return true;
    } catch (e) {
      console.warn('Firestore deleteOrder error:', e);
      return false;
    }
  }

  // Save Withdraw Request
  async saveWithdrawRequest(request: SellerWithdrawRequest): Promise<boolean> {
    try {
      await authReady;
      const wDoc = doc(db, COLLECTIONS.WITHDRAW_REQUESTS, request.id);
      await setDoc(wDoc, request, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore saveWithdrawRequest error:', e);
      return false;
    }
  }

  // Save Site Config
  async saveSiteConfig(config: SiteConfig): Promise<boolean> {
    try {
      await authReady;
      const cfgDoc = doc(db, COLLECTIONS.SYSTEM_CONFIG, CONFIG_DOCS.SITE_CONFIG);
      await setDoc(cfgDoc, config, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore direct saveSiteConfig notice, trying server proxy:', e);
      try {
        const res = await fetch('/api/admin/save-config', {
          method: 'POST',
          headers: await this.getAdminHeaders(),
          body: JSON.stringify({ configKey: CONFIG_DOCS.SITE_CONFIG, data: config }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }
  }

  // Save Payment Settings
  async savePaymentSettings(settings: PaymentSettings): Promise<boolean> {
    try {
      await authReady;
      const payDoc = doc(db, COLLECTIONS.SYSTEM_CONFIG, CONFIG_DOCS.PAYMENT_SETTINGS);
      await setDoc(payDoc, settings, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore direct savePaymentSettings notice, trying server proxy:', e);
      try {
        const res = await fetch('/api/admin/save-config', {
          method: 'POST',
          headers: await this.getAdminHeaders(),
          body: JSON.stringify({ configKey: CONFIG_DOCS.PAYMENT_SETTINGS, data: settings }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }
  }

  // Save Recharge Packages
  async saveRechargePackages(packages: RechargePackage[]): Promise<boolean> {
    try {
      await authReady;
      const batch = writeBatch(db);
      for (const p of packages) {
        batch.set(doc(db, COLLECTIONS.RECHARGE_PACKAGES, p.id), p, { merge: true });
      }
      await batch.commit();
      return true;
    } catch (e) {
      console.warn('Firestore direct saveRechargePackages notice, trying server proxy:', e);
      try {
        const res = await fetch('/api/admin/save-packages', {
          method: 'POST',
          headers: await this.getAdminHeaders(),
          body: JSON.stringify({ packages }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }
  }

  // --- Firebase Storage & Calling Access Requests ---
  async saveAccessRequest(request: FirebaseAccessRequest): Promise<boolean> {
    try {
      await authReady;
      const rDoc = doc(db, COLLECTIONS.ACCESS_REQUESTS, request.id);
      await setDoc(rDoc, request, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore saveAccessRequest error:', e);
      return false;
    }
  }

  async deleteAccessRequest(requestId: string): Promise<boolean> {
    try {
      await authReady;
      await deleteDoc(doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId));
      return true;
    } catch (e) {
      console.warn('Firestore deleteAccessRequest error:', e);
      return false;
    }
  }

  async approveAccessRequest(requestId: string, targetUserId: string, adminNote?: string): Promise<boolean> {
    try {
      await authReady;
      // 1. Update request record
      const rDoc = doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId);
      await updateDoc(rDoc, {
        status: 'approved',
        approvedAt: new Date().toLocaleString('bn-BD'),
        adminNote: adminNote || 'ওনার কর্তৃক ফায়ারবেস অ্যাক্সেস অনুমোদিত হয়েছে।',
      });

      // 2. Grant access to user account
      const uDoc = doc(db, COLLECTIONS.USERS, targetUserId);
      await updateDoc(uDoc, {
        firebaseAccessGranted: true,
        firebaseRequestStatus: 'approved',
      });
      return true;
    } catch (e) {
      console.warn('Firestore approveAccessRequest error:', e);
      return false;
    }
  }

  async rejectAccessRequest(requestId: string, targetUserId: string, adminNote?: string): Promise<boolean> {
    try {
      await authReady;
      const rDoc = doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId);
      await updateDoc(rDoc, {
        status: 'rejected',
        adminNote: adminNote || 'অনুরোধটি ওনার কর্তৃক পর্যালোচনা শেষে বাতিল করা হয়েছে।',
      });

      const uDoc = doc(db, COLLECTIONS.USERS, targetUserId);
      await updateDoc(uDoc, {
        firebaseAccessGranted: false,
        firebaseRequestStatus: 'rejected',
      });
      return true;
    } catch (e) {
      console.warn('Firestore rejectAccessRequest error:', e);
      return false;
    }
  }

  // --- Realtime WebRTC Cloud Signaling ---
  async sendCallSignal(signalData: {
    callSessionId: string;
    type: 'OFFER' | 'ANSWER' | 'CANDIDATE' | 'ACCEPT' | 'REJECT' | 'END';
    fromUserId: string;
    fromUserName: string;
    toDeveloperId?: number;
    toUserId?: string;
    payload: any;
  }): Promise<boolean> {
    try {
      await authReady;
      const sigDoc = doc(db, COLLECTIONS.CALL_SIGNALS, signalData.callSessionId);
      await setDoc(
        sigDoc,
        {
          ...signalData,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      return true;
    } catch (e) {
      console.warn('Firestore sendCallSignal error:', e);
      return false;
    }
  }

  listenToCallSignals(callSessionId: string, onSignal: (data: any) => void): () => void {
    try {
      const sigDoc = doc(db, COLLECTIONS.CALL_SIGNALS, callSessionId);
      return onSnapshot(sigDoc, (snap) => {
        if (snap.exists()) {
          onSignal(snap.data());
        }
      });
    } catch (e) {
      console.warn('Firestore listenToCallSignals error:', e);
      return () => {};
    }
  }

  // --- Complete Cloud Database Backup & Restore Engine ---

  /**
   * Creates a full system snapshot and stores it in Firestore Database Backups
   */
  async createCloudBackup(params: {
    creatorName?: string;
    note?: string;
    users: UserAccount[];
    developers: Developer[];
    messages: ChatMessage[];
    payments: PaymentRequest[];
    orders: ServiceOrder[];
    withdraws: SellerWithdrawRequest[];
    siteConfig: SiteConfig;
    paymentSettings: PaymentSettings;
    rechargePackages: RechargePackage[];
  }): Promise<DatabaseBackupRecord | null> {
    await authReady;
    const backupId = `BACKUP-${Date.now()}`;
    const timestamp = Date.now();
    const createdAt = new Date().toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const record: DatabaseBackupRecord = {
      id: backupId,
      createdAt,
      timestamp,
      note: params.note || 'সম্পূর্ণ ক্লাউড ডাটাবেজ ব্যাকআপ',
      creatorName: params.creatorName || 'ওনার অ্যাডমিন',
      counts: {
        users: params.users.length,
        developers: params.developers.length,
        messages: params.messages.length,
        payments: params.payments.length,
        orders: params.orders.length,
        withdraws: params.withdraws.length,
      },
      data: {
        users: params.users,
        developers: params.developers,
        messages: params.messages,
        payments: params.payments,
        orders: params.orders,
        withdraws: params.withdraws,
        siteConfig: params.siteConfig,
        paymentSettings: params.paymentSettings,
        rechargePackages: params.rechargePackages,
      },
    };

    try {
      await setDoc(doc(db, COLLECTIONS.DATABASE_BACKUPS, backupId), record);
      return record;
    } catch (e) {
      console.warn('Firestore createCloudBackup error:', e);
      return null;
    }
  }

  /**
   * Fetch all Cloud Backups list
   */
  async getCloudBackups(): Promise<DatabaseBackupRecord[]> {
    try {
      await authReady;
      const q = query(
        collection(db, COLLECTIONS.DATABASE_BACKUPS),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const list: DatabaseBackupRecord[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as DatabaseBackupRecord);
      });
      return list;
    } catch (e) {
      console.warn('Firestore getCloudBackups error:', e);
      return [];
    }
  }

  /**
   * Delete a specific Cloud Backup
   */
  async deleteCloudBackup(backupId: string): Promise<boolean> {
    try {
      await authReady;
      await deleteDoc(doc(db, COLLECTIONS.DATABASE_BACKUPS, backupId));
      return true;
    } catch (e) {
      console.warn('Firestore deleteCloudBackup error:', e);
      return false;
    }
  }

  /**
   * Restore all Firestore collections from a selected DatabaseBackupRecord
   */
  async restoreFromBackup(backup: DatabaseBackupRecord): Promise<boolean> {
    if (!backup.data) return false;
    try {
      await authReady;
      const {
        users,
        developers,
        messages,
        payments,
        orders,
        withdraws,
        siteConfig,
        paymentSettings,
        rechargePackages,
      } = backup.data;

      // 1. Users
      if (users && users.length > 0) {
        await this.saveUsers(users);
      }

      // 2. Developers
      if (developers && developers.length > 0) {
        await this.saveDevelopers(developers);
      }

      // 3. Messages
      if (messages && messages.length > 0) {
        const batch = writeBatch(db);
        for (const m of messages) {
          batch.set(doc(db, COLLECTIONS.CHAT_MESSAGES, m.id), m);
        }
        await batch.commit();
      }

      // 4. Payments
      if (payments && payments.length > 0) {
        const batch = writeBatch(db);
        for (const p of payments) {
          batch.set(doc(db, COLLECTIONS.PAYMENT_REQUESTS, p.id), p);
        }
        await batch.commit();
      }

      // 5. Orders
      if (orders && orders.length > 0) {
        const batch = writeBatch(db);
        for (const o of orders) {
          batch.set(doc(db, COLLECTIONS.ORDERS, o.id), o);
        }
        await batch.commit();
      }

      // 6. Withdraws
      if (withdraws && withdraws.length > 0) {
        const batch = writeBatch(db);
        for (const w of withdraws) {
          batch.set(doc(db, COLLECTIONS.WITHDRAW_REQUESTS, w.id), w);
        }
        await batch.commit();
      }

      // 7. Site Config & Payment Settings
      if (siteConfig) {
        await this.saveSiteConfig(siteConfig);
      }
      if (paymentSettings) {
        await this.savePaymentSettings(paymentSettings);
      }

      // 8. Recharge Packages
      if (rechargePackages && rechargePackages.length > 0) {
        await this.saveRechargePackages(rechargePackages);
      }

      return true;
    } catch (e) {
      console.error('Failed to restore database from backup:', e);
      return false;
    }
  }
}

export const firebaseSync = new FirebaseSyncService();
