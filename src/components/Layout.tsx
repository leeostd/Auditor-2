import React, { ReactNode } from 'react';
import { UserProfile } from '../types';
import { 
  LayoutDashboard, 
  Upload, 
  FileText, 
  Users, 
  Building2, 
  LogOut, 
  ShieldCheck,
  Menu,
  X,
  RefreshCw,
  User as UserIcon,
  ClipboardList,
  Moon,
  Sun
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
  profile: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isDark: boolean;
  toggleDarkMode: () => void;
}

export function Layout({ children, profile, activeTab, setActiveTab, onLogout, isDark, toggleDarkMode }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'employee'] },
    { id: 'upload', label: 'Auditar PIX', icon: Upload, roles: ['admin', 'employee'] },
    { id: 'receipts', label: 'Histórico', icon: FileText, roles: ['admin', 'employee'] },
    { id: 'receivers', label: 'Recebedores', icon: Building2, roles: ['admin'] },
    { id: 'users', label: 'Equipe', icon: Users, roles: ['admin'] },
    { id: 'logs', label: 'Logs', icon: ClipboardList, roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    profile && item.roles.includes(profile.role)
  );

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex overflow-hidden transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-4 flex-shrink-0 transition-colors duration-300">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2 mb-8 px-2 hover:opacity-80 transition-opacity text-left"
        >
          <img src="/logo.svg" className="w-8 h-8 rounded-lg shadow-lg shadow-blue-100 dark:shadow-none" alt="Logo" />
          <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Auditor PIX Pro</span>
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                activeTab === item.id 
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold text-xs" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white text-xs"
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 px-2 mb-4">
            <img 
              src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
              className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-800"
              alt="Profile"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{profile?.displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{profile?.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header (Desktop & Mobile) */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 h-14 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 md:hidden hover:opacity-80 transition-opacity"
            >
              <img src="/logo.svg" className="w-6 h-6" alt="Logo" />
              <span className="font-bold text-slate-900 dark:text-white text-sm">Auditor PIX</span>
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={toggleDarkMode}
              className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
              title={isDark ? "Modo Claro" : "Modo Noturno"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button 
              onClick={() => window.location.reload()}
              className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            <div className="h-6 w-px bg-slate-100 dark:bg-slate-800 mx-1 hidden md:block" />

            <div className="flex items-center gap-3 pl-1">
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <UserIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden sm:block">
                  {profile?.displayName.split(' ')[0]}
                </span>
              </div>
              
              <button 
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-white dark:bg-slate-900 p-6 flex flex-col overflow-y-auto transition-colors duration-300">
            <div className="flex justify-between items-center mb-10">
              <span className="text-xl font-bold text-slate-900 dark:text-white">Menu</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 dark:text-slate-400"><X /></button>
            </div>
            <nav className="space-y-4 flex-1">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                    activeTab === item.id 
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold" 
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-3 py-2.5 text-red-500 text-sm mt-6 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
