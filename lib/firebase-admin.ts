import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

// Verifica se o App Admin já foi inicializado
if (!getApps().length) {
  try {
    // Tenta carregar a credencial a partir da variável de ambiente Vercel
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountJson) {
      initializeApp({
        credential: cert(JSON.parse(serviceAccountJson)),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
      console.log('✅ [FIREBASE-ADMIN] Inicializado com Sucesso.');
    } else {
      console.warn('⚠️ [FIREBASE-ADMIN] Variável FIREBASE_SERVICE_ACCOUNT não encontrada!');
    }
  } catch (error) {
    console.error('❌ [FIREBASE-ADMIN] Falha na inicialização:', error);
  }
}

// Exporta as instâncias de admin
const adminDb = getApps().length ? getFirestore() : null;
const adminRtdb = getApps().length ? getDatabase() : null;

export { adminDb, adminRtdb };
