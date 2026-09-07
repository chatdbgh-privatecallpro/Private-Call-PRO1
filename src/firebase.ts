import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  getDocFromServer,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with long-polling enabled to eliminate 10s WebChannel connection delay in sandbox
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId || '(default)'
  );
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
}

export const db = firestoreInstance;

// Initialize Firebase Auth
export const auth = getAuth(app);

// Auto Sign-in anonymously so Firestore requests are authenticated
let currentFirebaseUser: User | null = null;
let resolveAuthReady: (user: User | null) => void;
export const authReady: Promise<User | null> = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

let isAuthResolved = false;

if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    currentFirebaseUser = user;
    if (!user) {
      signInAnonymously(auth)
        .then((cred) => {
          currentFirebaseUser = cred.user;
          if (!isAuthResolved) {
            isAuthResolved = true;
            resolveAuthReady(cred.user);
          }
        })
        .catch((err) => {
          console.warn('Firebase anonymous auth notice:', err);
          if (!isAuthResolved) {
            isAuthResolved = true;
            resolveAuthReady(null);
          }
        });
    } else {
      if (!isAuthResolved) {
        isAuthResolved = true;
        resolveAuthReady(user);
      }
    }
  });

  // Validate connection to Firestore per skill
  const validateConnection = async () => {
    try {
      await getDocFromServer(doc(db, 'system_config', 'site_config'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firestore offline cache active.');
      }
    }
  };
  validateConnection();
}

export const getFirebaseUser = () => currentFirebaseUser;

// Collections constants
export const COLLECTIONS = {
  USERS: 'users',
  DEVELOPERS: 'developers',
  CHAT_MESSAGES: 'chat_messages',
  PAYMENT_REQUESTS: 'payment_requests',
  ORDERS: 'service_orders',
  WITHDRAW_REQUESTS: 'seller_withdraw_requests',
  SYSTEM_CONFIG: 'system_config',
  RECHARGE_PACKAGES: 'recharge_packages',
  CALL_SIGNALS: 'call_signals',
  DATABASE_BACKUPS: 'database_backups',
  ACCESS_REQUESTS: 'firebase_access_requests',
  USER_LOCATIONS: 'user_locations',
};

// Document ID for system configs
export const CONFIG_DOCS = {
  SITE_CONFIG: 'site_config',
  PAYMENT_SETTINGS: 'payment_settings',
};

export {
  signInWithCustomToken,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
};
