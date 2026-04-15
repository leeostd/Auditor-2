import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { auth, db, signInWithGoogle, signInWithGoogleRedirect, logout } from './lib/firebase';
import { UserProfile, UserRole } from './types';
import { logActivity } from './lib/logger';
import { useDarkMode } from './hooks/useDarkMode';
import { Toaster, toast } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ReceiptUpload } from './components/ReceiptUpload';
import { ReceiptList } from './components/ReceiptList';
import { ReceiverManagement } from './components/ReceiverManagement';
import { UserManagement } from './components/UserManagement';
import { ActivityLogs } from './components/ActivityLogs';
import { LogIn, ShieldCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const { isDark, toggleDarkMode } = useDarkMode();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    // Handle redirect result for mobile logins
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect login error:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Check if first admin
          const isAdmin = firebaseUser.email === "elionilsonp13.upal@gmail.com";
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            role: isAdmin ? 'admin' : 'employee',
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, newProfile);
          setProfile(newProfile);
        } else {
          setProfile(userDoc.data() as UserProfile);
        }
        logActivity(firebaseUser.uid, 'LOGIN', `Usuário ${firebaseUser.email} entrou no sistema.`);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      // Check if mobile or standalone (PWA)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;

      if (isMobile || isStandalone) {
        await signInWithGoogleRedirect();
      } else {
        await signInWithGoogle();
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('O bloqueador de popups impediu o login. Tentando redirecionamento...');
        try {
          await signInWithGoogleRedirect();
        } catch (redirectError) {
          toast.error('Erro ao redirecionar para login.');
        }
      } else if (error.code === 'auth/cancelled-popup-request') {
        // User closed the popup
      } else {
        toast.error('Erro ao entrar com Google. Tente novamente.');
      }
    } finally {
      // Don't set loading false if redirecting, as the page will unload
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
      if (!isMobile && !isStandalone) {
        setIsLoggingIn(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800 transition-colors duration-300"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Auditor PIX Pro</h1>
          <p className="text-slate-600 dark:text-slate-400 text-center text-sm mb-8">
            Sistema inteligente de auditoria e prevenção de fraudes em comprovantes PIX.
          </p>
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-2xl border-2 border-slate-100 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            )}
            {isLoggingIn ? 'Conectando...' : 'Entrar com Google'}
          </button>
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard profile={profile} />;
      case 'upload': return <ReceiptUpload profile={profile} />;
      case 'receipts': return <ReceiptList profile={profile} />;
      case 'receivers': return <ReceiverManagement profile={profile} />;
      case 'users': return <UserManagement profile={profile} />;
      case 'logs': return <ActivityLogs profile={profile} />;
      default: return <Dashboard profile={profile} />;
    }
  };

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors theme={isDark ? 'dark' : 'light'} />
      <Layout 
        profile={profile} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onLogout={logout}
        isDark={isDark}
        toggleDarkMode={toggleDarkMode}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </Layout>
    </ErrorBoundary>
  );
}
