import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, getRedirectResult, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
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
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [adminPin, setAdminPin] = useState('');

  const handleAdminSetup = async () => {
    if (adminPin !== '1234') {
      toast.error('PIN de segurança incorreto.');
      return;
    }
    
    setIsLoggingIn(true);
    // Usamos um e-mail fixo que já é reconhecido como Admin no código
    const adminEmail = 'admin@auditor.com';
    const adminPass = 'admin123';
    
    try {
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPass);
        toast.success('Login de Administrador realizado!');
      } catch (e: any) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
          await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
          toast.success('Conta Administradora criada com sucesso!');
        } else {
          throw e;
        }
      }
    } catch (error: any) {
      console.error('Admin setup error:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setIsLoggingIn(false);
      setShowAdminSetup(false);
    }
  };

  useEffect(() => {
    // Handle redirect result for mobile logins
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        console.log('Login por redirecionamento bem-sucedido');
        toast.success('Bem-vindo de volta!');
      }
    }).catch((error) => {
      console.error('Redirect login error:', error);
      if (error.code !== 'auth/cancelled-popup-request') {
        toast.error(`Erro no redirecionamento: ${error.code}`);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            console.log('Creating new profile for:', firebaseUser.email);
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
            console.log('Profile loaded:', userDoc.data()?.role);
            setProfile(userDoc.data() as UserProfile);
          }
          logActivity(firebaseUser.uid, 'LOGIN', `Usuário ${firebaseUser.email} entrou no sistema.`);
        } catch (error) {
          console.error('Error loading/creating profile:', error);
          toast.error('Erro ao carregar seu perfil. Tente atualizar a página.');
          // Fallback profile if Firestore fails but Auth succeeded
          setProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            role: firebaseUser.email === "elionilsonp13.upal@gmail.com" ? 'admin' : 'employee',
            createdAt: new Date().toISOString()
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha todos os campos.');
      return;
    }
    setIsLoggingIn(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Conta criada com sucesso!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Login realizado!');
      }
    } catch (error: any) {
      console.error('Email auth error:', error);
      const errorCode = error.code;
      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        toast.error('E-mail ou senha incorretos.');
      } else if (errorCode === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está em uso.');
      } else if (errorCode === 'auth/weak-password') {
        toast.error('A senha deve ter pelo menos 6 caracteres.');
      } else if (errorCode === 'auth/operation-not-allowed') {
        toast.error('Login por E-mail não está ativado no Console do Firebase (Authentication > Sign-in method).');
      } else {
        toast.error(`Erro: ${errorCode}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithGoogleRedirect();
      } else {
        const result = await signInWithGoogle();
        if (result.user) {
          toast.success('Login realizado com sucesso!');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorCode = error.code || 'unknown';
      if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/popup-closed-by-user') {
        toast.error('O login do Google foi bloqueado ou fechado. Use a opção de e-mail abaixo.');
        setShowEmailLogin(true);
      } else if (errorCode === 'auth/unauthorized-domain') {
        toast.error(`Domínio não autorizado. Use o login por e-mail.`);
        setShowEmailLogin(true);
      } else {
        toast.error(`Erro técnico: ${errorCode}. Tente o login por e-mail.`);
        setShowEmailLogin(true);
      }
      setIsLoggingIn(false);
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
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Auditor PIX Pro</h1>
          <p className="text-slate-600 dark:text-slate-400 text-center text-sm mb-8">
            Sistema inteligente de auditoria e prevenção de fraudes.
          </p>

          {!showEmailLogin ? (
            <div className="space-y-4">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-2xl border-2 border-slate-100 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-70"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                )}
                {isLoggingIn ? 'Conectando...' : 'Entrar com Google'}
              </button>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100 dark:border-slate-800"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-900 px-2 text-slate-400">Ou</span></div>
              </div>

              <button
                onClick={() => setShowEmailLogin(true)}
                className="w-full py-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Entrar com e-mail e senha
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">E-mail</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Senha</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  placeholder="••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-70"
              >
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isSignUp ? 'Criar Conta' : 'Entrar')}
              </button>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 text-center"
                >
                  {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailLogin(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 text-center"
                >
                  Voltar para login com Google
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminSetup(true)}
                  className="text-xs text-slate-400 hover:text-red-400 text-center mt-4 border-t border-slate-100 dark:border-slate-800 pt-4"
                >
                  Acesso de Emergência (Admin)
                </button>
              </div>
            </form>
          )}

          {showAdminSetup && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-slate-900 p-8 rounded-3xl max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800"
              >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 text-center">Configurar Administrador</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 text-center">Insira o PIN de segurança para gerar sua conta mestre.</p>
                <input 
                  type="password"
                  maxLength={4}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full text-center text-2xl tracking-[1em] py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 outline-none mb-6"
                  placeholder="0000"
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowAdminSetup(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleAdminSetup}
                    disabled={isLoggingIn}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirmar'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
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
