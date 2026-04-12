import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
const firebaseConfig = {
  "projectId": "auditor-2-b1b88",
  "appId": "1:762826992579:web:b2e7cb8c792552e0202b76",
  "apiKey": "AIzaSyDPkGUmpEUPvjTjmAzaQQZ1PP6jGkfpC2s",
  "authDomain": "auditor-2-b1b88.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-3d519558-1860-4eac-970e-da9408ef778e",
  "storageBucket": "auditor-2-b1b88.firebasestorage.app",
  "messagingSenderId": "762826992579",
  "measurementId": ""
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
