import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";

// Credenciais da Central Inofarm Vision
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Evita a dupla inicialização no Next.js (Fast Refresh)
let app: any;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.warn("⚠️ [AVISO] Falha ao inicializar o Firebase.", error);
}

// Serviços da Plataforma
const db = (app ? getFirestore(app) : null) as any;
const rtdb = (app ? getDatabase(app) : null) as any;
const storage = (app ? getStorage(app) : null) as any;
const auth = (app ? getAuth(app) : null) as any;

// Força o Firebase a NÂO salvar a senha (exige login toda vez que abrir o site)
if (auth && typeof window !== "undefined") {
  setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Erro ao configurar persistência de login:", error);
  });
}

export { app, db, rtdb, storage, auth };
