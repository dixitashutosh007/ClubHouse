import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

/**
 * Server-Side Firebase Admin Initialization
 * Connects securely to Google Cloud Firestore on AWS Amplify or localhost.
 */
let app: App;

if (!getApps().length) {
  let serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson && process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
    try {
      serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf8');
    } catch {
      // ignore
    }
  }

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid service account JSON');
      }
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON, using default app', e);
      app = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'saath-societyapps',
      });
    }
  } else {
    app = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'saath-societyapps',
    });
  }
} else {
  app = getApps()[0];
}

/** True when server credentials for Firestore are configured */
export function hasFirebaseCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64
  );
}

export const adminDb: Firestore = getFirestore(app);
// Optional fields left undefined (e.g. a ride without a place ID) are skipped
// instead of failing the write. settings() throws if this module is evaluated
// again for the same app (dev hot reload), where it is already applied.
try {
  adminDb.settings({ ignoreUndefinedProperties: true });
} catch {
  // already configured
}
export const adminAuth: Auth = getAuth(app);

export const adminMessaging: Messaging = getMessaging(app);
