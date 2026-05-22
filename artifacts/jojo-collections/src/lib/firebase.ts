import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

let _auth: Auth | null = null;

if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
  const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig as Record<string, string>);
  _auth = getAuth(app);
} else {
  console.warn(
    "[Jojo Firebase] Client SDK not initialised — set VITE_FIREBASE_API_KEY, " +
    "VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID to enable email verification."
  );
}

export const auth: Auth | null = _auth;
export const isFirebaseConfigured: boolean = _auth !== null;
