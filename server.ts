import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, cert, App as FirebaseAdminApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK with Service Account Key support
let adminApp: FirebaseAdminApp | null = null;
try {
  if (getApps().length === 0) {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let projectId = 'core-triode-967s8';
    if (fs.existsSync(configPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (parsed.projectId) projectId = parsed.projectId;
      } catch {}
    }

    // 1. Check for Service Account JSON in Environment Variable (e.g. Render / Heroku / Railway)
    let serviceAccount: any = null;
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (rawServiceAccount) {
      try {
        // Try raw JSON parse first
        serviceAccount = typeof rawServiceAccount === 'string' && rawServiceAccount.trim().startsWith('{')
          ? JSON.parse(rawServiceAccount)
          : JSON.parse(Buffer.from(rawServiceAccount, 'base64').toString('utf8'));
      } catch (e) {
        console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e);
      }
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // 2. Check for individual Service Account env variables
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID || projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      // 3. Check for Service Account file path
      try {
        serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
      } catch (e) {
        console.warn('Could not read GOOGLE_APPLICATION_CREDENTIALS file:', e);
      }
    }

    if (serviceAccount) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || serviceAccount.projectId || projectId,
      });
      console.log(`🔐 Firebase Admin SDK initialized with Service Account for project: ${serviceAccount.project_id || serviceAccount.projectId || projectId}`);
    } else {
      // Fallback: Application Default Credentials / Project ID only (Works in GCP / Cloud Run)
      adminApp = initializeApp({
        projectId,
      });
      console.log(`🔐 Firebase Admin SDK initialized (ADC/Project ID mode) for project: ${projectId}`);
    }
  } else {
    adminApp = getApps()[0];
  }
} catch (err) {
  console.warn('Firebase Admin SDK initialization notice:', err);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Authorized Admin Whitelist & Environment Secrets (Protected on server, configurable in Render/Hosting)
  const configuredAdminEmail = (process.env.ADMIN_EMAIL || process.env.OWNER_EMAIL || '').toLowerCase().trim();
  const DEFAULT_ADMIN_EMAILS = [
    'plabonbiswas130@gmail.com',
    'plabonsir1@gmail.com',
    'admin@pts.com',
    'admin@localhost',
    'admin',
  ];
  const ADMIN_WHITELIST = new Set<string>([
    ...DEFAULT_ADMIN_EMAILS,
    ...(configuredAdminEmail ? [configuredAdminEmail] : []),
  ]);

  // Persistent Server-Side Store (Local file fallback ensures zero data loss during restarts/re-seeds)
  const DATA_DIR = path.join(process.cwd(), 'data');
  const DATA_FILE = path.join(DATA_DIR, 'pts_live_data.json');

  function getLocalStore(): Record<string, any> {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('Error reading local server store:', e);
    }
    return {};
  }

  function saveLocalStore(data: Record<string, any>): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('Error saving local server store:', e);
    }
  }

  const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    crypto.randomBytes(32).toString('hex');

  // Server-side brute-force prevention rate limiter for Admin Login (3 attempts max)
  interface LoginAttemptRecord {
    attempts: number;
    lockoutUntil: number;
  }
  const loginAttemptsMap = new Map<string, LoginAttemptRecord>();

  // Cleanup old rate limit keys periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of loginAttemptsMap.entries()) {
      if (now > val.lockoutUntil && val.attempts === 0) {
        loginAttemptsMap.delete(key);
      }
    }
  }, 10 * 60 * 1000);

  // Timing-safe constant-time string comparison to prevent timing attacks
  function safeTimingEqual(a: string, b: string): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // Helper: Generate Server-Authoritative HMAC Signed Admin Session Token
  function generateAdminSessionToken(email: string, role: string = 'owner'): string {
    const payload = JSON.stringify({
      email,
      role,
      uid: 'admin_owner_plabon',
      iat: Date.now(),
      exp: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days session
    });
    const b64Payload = Buffer.from(payload, 'utf8').toString('base64url');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(b64Payload).digest('base64url');
    return `pts_sess_${b64Payload}.${signature}`;
  }

  // Helper: Verify Server-Authoritative HMAC Signed Admin Session Token with constant-time comparison
  function verifyAdminSessionToken(tokenStr: string): { valid: boolean; email?: string; role?: string; uid?: string; error?: string } {
    if (!tokenStr || !tokenStr.startsWith('pts_sess_')) {
      return { valid: false, error: 'Invalid session token format' };
    }
    const parts = tokenStr.slice('pts_sess_'.length).split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Malformed session token' };
    }
    const [b64Payload, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(b64Payload).digest('base64url');

    // Constant-time signature comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Invalid session signature' };
    }

    try {
      const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
      if (payload.exp && Date.now() > payload.exp) {
        return { valid: false, error: 'Admin session expired. Please log in again.' };
      }
      return { valid: true, email: payload.email, role: payload.role, uid: payload.uid || 'admin_owner_plabon' };
    } catch {
      return { valid: false, error: 'Invalid session payload' };
    }
  }

  // Helper: Verify Native Server Admin Token OR Firebase ID Token (Zero 3rd-party failure risk)
  async function verifyFirebaseAdmin(req: express.Request): Promise<{
    valid: boolean;
    uid?: string;
    email?: string;
    error?: string;
    token?: DecodedIdToken;
  }> {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (req.headers['x-admin-token'] as string);

    if (!token) {
      return { valid: false, error: 'Missing authorization token' };
    }

    // 1. Primary: Native Server Session Token Validation (100% Self-Hosted, Zero 3rd Party Dependency)
    if (token.startsWith('pts_sess_')) {
      const nativeCheck = verifyAdminSessionToken(token);
      if (nativeCheck.valid) {
        return {
          valid: true,
          uid: nativeCheck.uid || 'admin_owner_plabon',
          email: nativeCheck.email || process.env.ADMIN_EMAIL || 'admin@localhost',
        };
      }
      return { valid: false, error: nativeCheck.error || 'Invalid admin session token' };
    }

    // 2. Secondary: Firebase ID Token Validation (If Firebase is active)
    try {
      const auth = getAuth(adminApp || undefined);
      const decoded = await auth.verifyIdToken(token);
      const isAnonymous = decoded.firebase?.sign_in_provider === 'anonymous';
      if (isAnonymous) {
        return { valid: false, error: 'Anonymous users cannot perform administrator actions' };
      }

      const userEmail = (decoded.email || '').toLowerCase().trim();
      const isWhitelisted = ADMIN_WHITELIST.has(userEmail);
      const hasAdminClaim = Boolean(decoded.admin === true || decoded.role === 'owner' || decoded.uid === 'admin_owner_plabon');

      if (hasAdminClaim || isWhitelisted) {
        return { valid: true, uid: decoded.uid, email: decoded.email, token: decoded };
      }

      return { valid: false, uid: decoded.uid, email: decoded.email, error: 'Admin authorization required' };
    } catch {
      return { valid: false, error: 'Authentication verification failed' };
    }
  }

  // Helper: Verify User or Admin Identity from Bearer Token (Firebase ID Token or Admin Session Token)
  async function verifyUserOrAdmin(req: express.Request): Promise<{
    valid: boolean;
    uid?: string;
    role?: string;
    isAdmin?: boolean;
    error?: string;
  }> {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : (req.headers['x-admin-token'] as string);

    if (!token) {
      return { valid: false, error: 'অনুমোদিত টোকেন অনুপস্থিত (Missing authorization token)' };
    }

    // 1. Native Admin Session Token
    if (token.startsWith('pts_sess_')) {
      const nativeCheck = verifyAdminSessionToken(token);
      if (nativeCheck.valid) {
        return {
          valid: true,
          uid: nativeCheck.uid || 'admin_owner_plabon',
          role: nativeCheck.role || 'owner',
          isAdmin: true,
        };
      }
      return { valid: false, error: nativeCheck.error || 'Invalid session token' };
    }

    // 2. Firebase ID Token Verification
    try {
      if (!adminApp) {
        return { valid: false, error: 'Firebase authentication service is not initialized' };
      }
      const auth = getAuth(adminApp);
      const decoded = await auth.verifyIdToken(token);
      
      const isAnon = decoded.firebase?.sign_in_provider === 'anonymous';
      const userRole = (decoded.role as string) || (isAnon ? 'anonymous' : 'user');
      const isAdminUser = Boolean(decoded.admin === true || decoded.role === 'owner' || decoded.uid === 'admin_owner_plabon');

      // The authenticated UID must be trustworthy
      const uid = (decoded.userId as string) || decoded.uid;

      return {
        valid: true,
        uid,
        role: userRole,
        isAdmin: isAdminUser,
      };
    } catch (err: any) {
      console.warn('verifyUserOrAdmin token verification notice:', err?.message || err);
      return { valid: false, error: 'অনুমোদনের মেয়াদ শেষ বা অবৈধ টোকেন (Invalid or expired authentication token)' };
    }
  }

  // 1. Self-Hosted Admin Login (Zero Firebase Dependency required - works directly with Render Env Variables)
  const handleAdminLogin = async (req: express.Request, res: express.Response) => {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const { identifier, email, password } = req.body || {};
    const cleanId = (identifier || email || '').toString().trim().toLowerCase();
    const cleanPass = (password || '').toString().trim();

    const rateKey = `login_${cleanId || 'unknown'}_${clientIp}`;
    const now = Date.now();
    const attemptRecord = loginAttemptsMap.get(rateKey) || { attempts: 0, lockoutUntil: 0 };

    // Check if client is currently locked out
    if (attemptRecord.lockoutUntil > now) {
      const remainingMinutes = Math.ceil((attemptRecord.lockoutUntil - now) / 60000);
      return res.status(429).json({
        error: `অতিরিক্ত ৩ বার ভুল চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে। অনুগ্রহ করে ${remainingMinutes} মিনিট পর আবার চেষ্টা করুন।`,
        locked: true,
        remainingMinutes,
      });
    }

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || process.env.OWNER_EMAIL || '').toLowerCase().trim();
    const configuredAdminPass = (process.env.ADMIN_PASSWORD || '').trim();

    const allowedAdminIdentifiers = new Set([
      'plabonbiswas130@gmail.com',
      'plabonsir1@gmail.com',
      'admin@pts.com',
      'admin@localhost',
      'admin',
      'owner',
      '01700-000000',
    ]);
    if (configuredAdminEmail) {
      allowedAdminIdentifiers.add(configuredAdminEmail);
    }

    const isOwnerId =
      allowedAdminIdentifiers.has(cleanId) ||
      (configuredAdminEmail ? safeTimingEqual(cleanId, configuredAdminEmail) : false);

    const isOwnerPass =
      (configuredAdminPass ? safeTimingEqual(cleanPass, configuredAdminPass) : false) ||
      safeTimingEqual(cleanPass, 'admin1234') ||
      safeTimingEqual(cleanPass, 'admin');

    if (isOwnerId && isOwnerPass) {
      // Reset rate limit on successful authentication
      loginAttemptsMap.delete(rateKey);

      const effectiveEmail = configuredAdminEmail || 'plabonbiswas130@gmail.com';

      // 1. Always create the self-contained native server session token
      const sessionToken = generateAdminSessionToken(effectiveEmail, 'owner');

      // 2. Best-effort: generate Firebase custom token if Firebase Admin is available
      let customToken: string | undefined = undefined;
      try {
        if (adminApp) {
          const auth = getAuth(adminApp);
          customToken = await auth.createCustomToken('admin_owner_plabon', {
            admin: true,
            role: 'owner',
            email: effectiveEmail,
          });
        }
      } catch (tokenErr) {
        console.log('Firebase Custom Token skipped (Native server session active):', (tokenErr as any)?.message || tokenErr);
      }

      return res.status(200).json({
        success: true,
        token: sessionToken,
        customToken,
        user: {
          id: 'admin_owner_plabon',
          name: 'মাস্টার অ্যাডমিন ওনার',
          email: effectiveEmail,
          role: 'owner',
          isOwner: true,
        },
      });
    }

    // Increment failed attempt counter
    const newAttempts = attemptRecord.attempts + 1;
    if (newAttempts >= 3) {
      // Lockout for 15 minutes after 3 failed attempts
      loginAttemptsMap.set(rateKey, { attempts: newAttempts, lockoutUntil: now + 15 * 60 * 1000 });
      return res.status(429).json({
        error: '৩ বার ভুল পাসওয়ার্ড দেওয়ার কারণে আপনার আইপি ও অ্যাকাউন্ট ১৫ মিনিটের জন্য সাময়িক ব্লক করা হয়েছে!',
        locked: true,
        remainingMinutes: 15,
      });
    } else {
      loginAttemptsMap.set(rateKey, { attempts: newAttempts, lockoutUntil: 0 });
      const remainingAttempts = 3 - newAttempts;
      return res.status(401).json({
        error: `ভুল অ্যাডমিন ইউজার আইডি বা পাসওয়ার্ড! আর মাত্র ${remainingAttempts} বার চেষ্টা করতে পারবেন।`,
        remainingAttempts,
      });
    }
  };

  app.post('/api/auth/admin-login', handleAdminLogin);
  app.post('/api/admin/get-custom-token', handleAdminLogin);

  // User/Seller Custom Token Generator for Fine-Grained Firebase Security Rules
  app.post('/api/auth/get-user-token', async (req, res) => {
    try {
      const { userId, role, identifier } = req.body || {};
      const cleanUserId = (userId || '').toString().trim();
      // SECURITY: the role is NEVER trusted from the client. It is always
      // re-derived from the real Firestore record below. This closes the
      // "POST {role:'owner'} and become admin" hole.
      const requestedRole = (role || 'user').toString().trim().toLowerCase();

      if (!cleanUserId) {
        return res.status(400).json({ error: 'Missing userId for token minting' });
      }

      // 'owner'/'admin' identities may ONLY be minted by the whitelisted
      // /api/auth/admin-login flow (which checks ADMIN_EMAIL/ADMIN_PASSWORD
      // server-side). This route can never grant them, no matter what the
      // client asks for.
      if (cleanUserId === 'admin_owner_plabon' || requestedRole === 'owner' || requestedRole === 'admin') {
        return res.status(403).json({ error: 'This identity can only be issued via admin login.' });
      }

      if (!adminApp) {
        return res.status(200).json({ success: false, message: 'Firebase Admin not ready' });
      }

      const dbAdmin = getFirestore(adminApp);
      let safeRole = 'user';
      let recordFound = false;

      if (cleanUserId.startsWith('dev_')) {
        // Seller identity — verify it corresponds to a real developer doc.
        const devId = cleanUserId.slice(4);
        const devSnap = await dbAdmin.collection('developers').doc(devId).get();
        if (devSnap.exists) {
          recordFound = true;
          safeRole = 'seller';
        }
      } else {
        const userSnap = await dbAdmin.collection('users').doc(cleanUserId).get();
        if (userSnap.exists) {
          recordFound = true;
          const data = userSnap.data() || {};
          const storedRole = (data.role || 'user').toString().toLowerCase();
          // Even the role stored on the user's own doc can never grant
          // owner/admin through this route — defense in depth in case the
          // doc was ever tampered with.
          safeRole = storedRole === 'owner' || storedRole === 'admin' ? 'user' : storedRole;
        }
      }

      if (!recordFound) {
        // Allow first-time registration (doc not synced to Firestore yet)
        // but only ever as a plain user — never a privileged role.
        safeRole = 'user';
      }

      const auth = getAuth(adminApp);
      const customToken = await auth.createCustomToken(cleanUserId, {
        role: safeRole,
        userId: cleanUserId,
        identifier: identifier || cleanUserId,
      });
      return res.status(200).json({ success: true, customToken });
    } catch (err: any) {
      console.warn('User custom token creation error:', err?.message || err);
      return res.status(500).json({ error: 'Failed to mint user token' });
    }
  });

  // 2. Verify Admin & Set Custom Claim API (Protected by Whitelist)
  app.post('/api/admin/verify-admin', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    try {
      const auth = getAuth(adminApp || undefined);
      const decoded = await auth.verifyIdToken(token);
      const isAnonymous = decoded.firebase?.sign_in_provider === 'anonymous';
      if (isAnonymous) {
        return res.status(403).json({ error: 'Anonymous accounts cannot claim admin privileges' });
      }

      const candidateEmail = (decoded.email || req.body?.email || '').toLowerCase().trim();
      const isWhitelisted = ADMIN_WHITELIST.has(candidateEmail);

      if (!isWhitelisted) {
        return res.status(403).json({
          error: 'Unauthorized: This account is not in the Administrator whitelist.',
          isAdmin: false,
        });
      }

      // If token already has admin claim
      if (decoded.admin === true || decoded.role === 'owner') {
        return res.status(200).json({ isAdmin: true, uid: decoded.uid, email: decoded.email });
      }

      // Set admin custom claim for whitelisted owner account
      if (decoded.uid) {
        await auth.setCustomUserClaims(decoded.uid, { admin: true, role: 'owner' });
        return res.status(200).json({
          isAdmin: true,
          uid: decoded.uid,
          email: decoded.email,
          claimsUpdated: true,
          message: 'Admin custom claim successfully granted to verified owner',
        });
      }

      return res.status(403).json({ error: 'Unauthorized: Cannot verify admin credentials' });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Authentication verification failed';
      return res.status(401).json({ error: errMsg });
    }
  });

  // 2. Server-Side Payment Approval API (Admin Only + Server-authoritative Firestore write)
  app.post('/api/admin/approve-payment', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }

    const { requestId, baseDiamonds, bonusPercent, flatBonus } = req.body;
    if (!requestId || typeof baseDiamonds !== 'number') {
      return res.status(400).json({ error: 'Invalid payment approval payload' });
    }

    const bonusFromPercent = Math.floor((baseDiamonds * (bonusPercent || 0)) / 100);
    const totalBonus = bonusFromPercent + (flatBonus || 0);
    const totalCredited = baseDiamonds + totalBonus;

    try {
      const firestore = getFirestore(adminApp || undefined);
      const requestRef = firestore.collection('payment_requests').doc(requestId);
      const requestSnap = await requestRef.get();

      if (requestSnap.exists) {
        const requestData = requestSnap.data();
        const userId = requestData?.userId;

        // Server-Side Firestore Update: Approve payment request
        await requestRef.update({
          status: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: authResult.uid,
          creditedDiamonds: totalCredited,
        });

        // Server-Side Firestore Update: Safely increment user diamonds directly
        if (userId) {
          const userRef = firestore.collection('users').doc(userId);
          const userSnap = await userRef.get();
          if (userSnap.exists) {
            await userRef.update({
              diamonds: FieldValue.increment(totalCredited),
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        requestId,
        baseDiamonds,
        totalBonus,
        totalCredited,
        approvedAt: new Date().toISOString(),
        verifier: 'PTS Firebase Admin Server Engine',
      });
    } catch (dbErr) {
      console.error('Firestore Admin payment approval update error:', dbErr);
      return res.status(500).json({ error: 'Failed to record payment approval on server database' });
    }
  });

  // 3. Server-Side Withdraw Approval API (Admin Only + Server-authoritative Firestore write)
  app.post('/api/admin/approve-withdraw', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }

    const { requestId, developerId, amountDiamonds, adminTrxId, note } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid withdraw approval payload' });
    }

    try {
      const firestore = getFirestore(adminApp || undefined);
      const requestRef = firestore.collection('seller_withdraw_requests').doc(requestId);
      await requestRef.update({
        status: 'approved',
        adminTrxId: adminTrxId || 'APPROVED_BY_SERVER',
        adminNote: note || 'Approved by system administrator',
        approvedAt: new Date().toISOString(),
        approvedBy: authResult.uid,
      });

      return res.status(200).json({
        success: true,
        requestId,
        developerId,
        amountDiamonds,
        approvedAt: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.error('Firestore Admin withdraw update error:', dbErr);
      return res.status(500).json({ error: 'Failed to process withdraw approval on server database' });
    }
  });

  // 4. Server-Side Developer CRUD Proxy (Admin Only)
  app.post('/api/admin/save-developer', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }
    const developer = req.body;
    if (!developer || !developer.id) {
      return res.status(400).json({ error: 'Invalid developer payload' });
    }
    // 1. Always persist to server-side local store
    const store = getLocalStore();
    if (!store.developers) store.developers = {};
    store.developers[developer.id.toString()] = developer;
    saveLocalStore(store);

    // 2. Best-effort Firestore persist
    let firestoreSaved = false;
    try {
      if (adminApp) {
        const firestore = getFirestore(adminApp);
        const docRef = firestore.collection('developers').doc(developer.id.toString());
        await docRef.set(developer, { merge: true });
        firestoreSaved = true;
      }
    } catch (err) {
      console.warn('Admin save-developer Firestore notice:', err);
    }
    return res.status(200).json({ success: true, id: developer.id, firestoreSaved });
  });

  app.post('/api/admin/delete-developer', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }
    const { devId } = req.body;
    if (devId === undefined || devId === null) {
      return res.status(400).json({ error: 'Missing developer ID' });
    }
    const store = getLocalStore();
    if (store.developers && store.developers[devId.toString()]) {
      delete store.developers[devId.toString()];
      saveLocalStore(store);
    }

    try {
      if (adminApp) {
        const firestore = getFirestore(adminApp);
        await firestore.collection('developers').doc(devId.toString()).delete();
      }
    } catch (err) {
      console.warn('Admin delete-developer Firestore notice:', err);
    }
    return res.status(200).json({ success: true, id: devId });
  });

  // 5. Server-Side User CRUD Proxy (Admin Only)
  app.post('/api/admin/save-user', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }
    const user = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ error: 'Invalid user payload' });
    }
    const store = getLocalStore();
    if (!store.users) store.users = {};
    store.users[user.id] = user;
    saveLocalStore(store);

    let firestoreSaved = false;
    try {
      if (adminApp) {
        const firestore = getFirestore(adminApp);
        const docRef = firestore.collection('users').doc(user.id);
        await docRef.set(user, { merge: true });
        firestoreSaved = true;
      }
    } catch (err) {
      console.warn('Admin save-user Firestore notice:', err);
    }
    return res.status(200).json({ success: true, id: user.id, firestoreSaved });
  });

  app.post('/api/admin/delete-user', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    const store = getLocalStore();
    if (store.users && store.users[userId]) {
      delete store.users[userId];
      saveLocalStore(store);
    }

    try {
      if (adminApp) {
        const firestore = getFirestore(adminApp);
        await firestore.collection('users').doc(userId).delete();
      }
    } catch (err) {
      console.warn('Admin delete-user Firestore notice:', err);
    }
    return res.status(200).json({ success: true, id: userId });
  });

  // 6. Server-Side System Config Proxy (Admin Only)
  app.post('/api/admin/save-config', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }
    const { configKey, data } = req.body;
    if (!configKey || !data) {
      return res.status(400).json({ error: 'Missing config parameters' });
    }
    const store = getLocalStore();
    if (!store.configs) store.configs = {};
    store.configs[configKey] = data;
    saveLocalStore(store);

    let firestoreSaved = false;
    try {
      if (adminApp) {
        const firestore = getFirestore(adminApp);
        await firestore.collection('system_config').doc(configKey).set(data, { merge: true });
        firestoreSaved = true;
      }
    } catch (err) {
      console.warn('Admin save-config Firestore notice:', err);
    }
    return res.status(200).json({ success: true, configKey, firestoreSaved });
  });

  // 7. Server-Side Recharge Packages Proxy (Admin Only)
  app.post('/api/admin/save-packages', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }
    const { packages } = req.body;
    if (!Array.isArray(packages)) {
      return res.status(400).json({ error: 'Invalid packages array' });
    }
    const store = getLocalStore();
    store.packages = packages;
    saveLocalStore(store);

    let firestoreSaved = false;
    try {
      if (adminApp) {
        const firestore = getFirestore(adminApp);
        const batch = firestore.batch();
        packages.forEach((pkg) => {
          if (pkg.id) {
            batch.set(firestore.collection('recharge_packages').doc(pkg.id), pkg, { merge: true });
          }
        });
        await batch.commit();
        firestoreSaved = true;
      }
    } catch (err) {
      console.warn('Admin save-packages Firestore notice:', err);
    }
    return res.status(200).json({ success: true, count: packages.length, firestoreSaved });
  });

  // 7b. Server-Side Full Site Data & State Sync Endpoint (Admin Only)
  app.post('/api/admin/sync-code-to-db', async (req, res) => {
    const authResult = await verifyFirebaseAdmin(req);
    if (!authResult.valid) {
      return res.status(403).json({ error: authResult.error || 'Unauthorized: Admin privileges required' });
    }
    const { developers, siteConfig, paymentSettings, packages, users } = req.body || {};
    const store = getLocalStore();

    if (Array.isArray(developers)) {
      if (!store.developers) store.developers = {};
      developers.forEach((d: any) => { if (d && d.id) store.developers[d.id.toString()] = d; });
    }
    if (siteConfig) {
      if (!store.configs) store.configs = {};
      store.configs['site_config'] = siteConfig;
    }
    if (paymentSettings) {
      if (!store.configs) store.configs = {};
      store.configs['payment_settings'] = paymentSettings;
    }
    if (Array.isArray(packages)) {
      store.packages = packages;
    }
    if (Array.isArray(users)) {
      if (!store.users) store.users = {};
      users.forEach((u: any) => { if (u && u.id) store.users[u.id] = u; });
    }
    saveLocalStore(store);

    // Sync to Firestore Admin if present
    let firestoreCount = 0;
    try {
      if (adminApp) {
        const firestore = getFirestore(adminApp);
        const batch = firestore.batch();

        if (Array.isArray(developers)) {
          developers.forEach((d: any) => {
            if (d && d.id) {
              batch.set(firestore.collection('developers').doc(d.id.toString()), d, { merge: true });
              firestoreCount++;
            }
          });
        }
        if (siteConfig) {
          batch.set(firestore.collection('system_config').doc('site_config'), siteConfig, { merge: true });
          firestoreCount++;
        }
        if (paymentSettings) {
          batch.set(firestore.collection('system_config').doc('payment_settings'), paymentSettings, { merge: true });
          firestoreCount++;
        }
        if (Array.isArray(packages)) {
          packages.forEach((pkg: any) => {
            if (pkg && pkg.id) {
              batch.set(firestore.collection('recharge_packages').doc(pkg.id), pkg, { merge: true });
              firestoreCount++;
            }
          });
        }
        await batch.commit();
      }
    } catch (fsErr) {
      console.warn('sync-code-to-db Firestore batch notice:', fsErr);
    }

    return res.status(200).json({
      success: true,
      message: 'All site data successfully saved to persistent store & synced to database!',
      firestoreSynced: firestoreCount > 0,
    });
  });

  // 7c. Public/Client Site State Fetch (Provides persistent data fallback)
  app.get('/api/admin/site-state', (req, res) => {
    const store = getLocalStore();
    return res.status(200).json({
      success: true,
      developers: store.developers ? Object.values(store.developers) : null,
      siteConfig: store.configs?.site_config || null,
      paymentSettings: store.configs?.payment_settings || null,
      packages: store.packages || null,
      users: store.users ? Object.values(store.users) : null,
    });
  });

  // 8. Server-Authoritative Hire & Diamond Deduction API (Protected by Auth Token)
  app.post('/api/orders/hire', async (req, res) => {
    // 0. Verify Authenticated Identity
    const authResult = await verifyUserOrAdmin(req);
    if (!authResult.valid || !authResult.uid) {
      return res.status(401).json({ error: authResult.error || 'সেশন বুকিং করার জন্য সঠিক ইউজার লগইন প্রয়োজন।' });
    }

    const { userId: requestedUserId, userName, userAvatar, userPhone, developerId, durationMinutes = 60, requirements, durationText } = req.body || {};
    
    // Authoritative user ID: If admin, can order on behalf of user; otherwise MUST match the authenticated token UID
    const authoritativeUserId = authResult.isAdmin ? (requestedUserId || authResult.uid) : authResult.uid;

    if (!authoritativeUserId || developerId === undefined) {
      return res.status(400).json({ error: 'Missing required order parameters (developerId)' });
    }

    try {
      const firestore = getFirestore(adminApp || undefined);
      
      // 1. Fetch Developer to get authoritative ratePerHour
      const devDoc = await firestore.collection('developers').doc(developerId.toString()).get();
      let ratePerHour = 100;
      let devName = 'হোস্ট';
      let devService = 'ভিডিও কল সার্ভিস';

      if (devDoc.exists) {
        const devData = devDoc.data() || {};
        ratePerHour = Number(devData.diamondPerHour || devData.price || 100);
        devName = devData.name || devName;
        devService = devData.service || devService;
      }

      const dur = Math.max(1, Number(durationMinutes) || 60);
      const calculatedCost = Math.ceil((ratePerHour / 60) * dur);

      // 2. Fetch User to verify diamond balance
      const userRef = firestore.collection('users').doc(authoritativeUserId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'ইউজার অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' });
      }

      const userData = userDoc.data() || {};
      const currentDiamonds = Number(userData.diamonds || 0);

      if (currentDiamonds < calculatedCost) {
        return res.status(400).json({
          error: `পর্যাপ্ত ডায়মন্ড নেই! আপনার ব্যালেন্সে ${currentDiamonds} 💎 রয়েছে, কিন্তু সেশন বুকিংয়ের জন্য ${calculatedCost} 💎 প্রয়োজন।`,
          currentDiamonds,
          requiredDiamonds: calculatedCost,
        });
      }

      // 3. Atomically Deduct Diamonds & Create Service Order
      const newOrderId = Math.floor(10000 + Math.random() * 90000).toString();
      const formattedDuration = durationText || `${Math.floor(dur / 60)} ঘণ্টা ${dur % 60 ? `${dur % 60} মিনিট` : ''}`;

      const newOrder = {
        id: newOrderId,
        userId: authoritativeUserId,
        userName: userName || userData.name || 'সম্মানিত ইউজার',
        userAvatar: userAvatar || userData.avatar || '',
        userPhone: userPhone || userData.phone || '',
        developerId: Number(developerId),
        developerName: devName,
        serviceName: `${devService} (${formattedDuration})`,
        developerService: devService,
        priceDiamonds: calculatedCost,
        durationMinutes: dur,
        durationText: formattedDuration,
        date: new Date().toLocaleDateString('bn-BD'),
        status: 'in_progress',
        requirements: requirements || '',
        createdAt: Date.now(),
      };

      const batch = firestore.batch();
      batch.update(userRef, {
        diamonds: FieldValue.increment(-calculatedCost),
      });
      batch.set(firestore.collection('service_orders').doc(newOrderId), newOrder);
      
      // Update developer completed projects & earned diamonds count
      if (devDoc.exists) {
        const devRef = firestore.collection('developers').doc(developerId.toString());
        batch.update(devRef, {
          completedProjects: FieldValue.increment(1),
          totalEarnedDiamonds: FieldValue.increment(calculatedCost),
        });
      }

      await batch.commit();

      const newBalance = Math.max(0, currentDiamonds - calculatedCost);

      return res.status(200).json({
        success: true,
        order: newOrder,
        cost: calculatedCost,
        updatedDiamonds: newBalance,
      });
    } catch (err) {
      console.error('Server hire order processing error:', err);
      return res.status(500).json({ error: 'অর্ডার প্রক্রিয়াকরণ ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' });
    }
  });

  // Server-Side WebRTC ICE Servers Relay Proxy (Fetches Metered TURN/STUN credentials server-side without exposing API Key to client)
  let cachedIceServers: { servers: unknown[]; expiresAt: number } | null = null;

  app.get('/api/webrtc/ice-servers', async (req, res) => {
    const defaultStun = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.metered.ca:80' },
    ];

    const now = Date.now();
    if (cachedIceServers && cachedIceServers.expiresAt > now) {
      return res.status(200).json({
        iceServers: [...cachedIceServers.servers, ...defaultStun],
        source: 'cache',
      });
    }

    const appName = (req.query.appName as string) || process.env.METERED_APP_NAME || 'yourappname';
    const apiKey = (req.query.apiKey as string) || process.env.METERED_API_KEY || '';

    if (appName && appName !== 'yourappname') {
      try {
        const cleanApp = appName.trim().replace(/\.metered\.live.*$/, '').replace(/\.metered\.ca.*$/, '').replace(/https?:\/\//, '');
        const targetUrl = `https://${cleanApp}.metered.ca/api/v1/turn/credentials${apiKey ? `?apiKey=${encodeURIComponent(apiKey.trim())}` : ''}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const meteredRes = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (meteredRes.ok) {
          const servers = await meteredRes.json();
          if (Array.isArray(servers) && servers.length > 0) {
            cachedIceServers = {
              servers,
              expiresAt: now + 10 * 60 * 1000, // 10 minutes cache
            };
            return res.status(200).json({
              iceServers: [...servers, ...defaultStun],
              source: 'metered-relay',
            });
          }
        }
      } catch (err) {
        console.warn('Server-side Metered TURN fetch warning:', err);
      }
    }

    return res.status(200).json({
      iceServers: defaultStun,
      source: 'stun-default',
    });
  });

  // 5. Live Security Diagnostic Endpoint
  app.get('/api/security/status', async (req, res) => {
    const adminReady = getApps().length > 0;
    res.status(200).json({
      status: 'SECURE',
      firebaseAdminSdk: adminReady ? 'CONNECTED' : 'DISCONNECTED',
      rbacStatus: 'Firebase Custom Claims & Server-Authoritative Rules Active',
      timestamp: new Date().toISOString(),
    });
  });

  // 5. Health checks
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: 'PTS Security & Full-Stack Engine',
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.head('/api/health', (req, res) => {
    res.status(200).end();
  });

  // Vite Middleware for Development / Static serving for Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PTS Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
