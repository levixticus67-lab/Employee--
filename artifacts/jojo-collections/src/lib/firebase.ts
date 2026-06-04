import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

// These values are intentionally public — Firebase client config is always
// embedded in client-side JS. Hardcoded as fallbacks so a misconfigured
// GitHub secret can never break Google sign-in.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? "AIzaSyA9ER2RfVM4Iw7Ka6eQ100KDnbuFI31_pg",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? "jojo-collection.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? "jojo-collection",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? "jojo-collection.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "469101720449",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? "1:469101720449:web:c668b39259ea141f69ee80",
};

const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const isFirebaseConfigured = true;
export const googleProvider = new GoogleAuthProvider();
