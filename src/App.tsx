import React, { useState, useEffect } from 'react';
import {
  Home,
  ReceiptText,
  BarChart2,
  Calendar,
  Menu,
  X,
  Plus,
  Camera,
  PiggyBank,
  PieChart,
  Clock,
  Settings,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { initializeDatabase, Transaction, seedSampleData } from './db';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TransactionModal } from './components/TransactionModal';

// Pages
import { AuthPage } from './pages/Auth';
import { Beranda } from './pages/Beranda';
import { Transaksi } from './pages/Transaksi';
import { RekapBulanan } from './pages/RekapBulanan';
import { Kalender } from './pages/Kalender';
import { ScanStruk } from './pages/ScanStruk';
import { Konsultasi } from './pages/Konsultasi';
import { Anggaran } from './pages/Anggaran';
import { Tabungan } from './pages/Tabungan';
import { Tagihan } from './pages/Tagihan';
import { Pengaturan } from './pages/Pengaturan';

type Tab =
  | 'beranda'
  | 'transactions'
  | 'recap'
  | 'calendar'
  | 'scan'
  | 'consult'
  | 'budgets'
  | 'savings'
  | 'bills'
  | 'settings';

function MainApp() {
  const { user, isLoading, signOut, userEmail, username, isDemoUser, userId } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('beranda');
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Transaction Modal State
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalInitialData, setTxModalInitialData] = useState<Partial<Transaction> | null>(null);

  // Initialize DB and seed initial sample data for new user on mount
  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
        if (userId) {
          await seedSampleData(userId);
        }
      } catch (err) {
        console.error('Failed to init IndexedDB:', err);
      }
    }
    init();
  }, [userId]);

  const handleOpenAddModal = (initialData?: Partial<Transaction> | null) => {
    setTxModalInitialData(initialData || null);
    setTxModalOpen(true);
    setIsFabOpen(false);
  };

  const navigateTo = (tab: string) => {
    setActiveTab(tab as Tab);
    setIsMoreDrawerOpen(false);
    setIsFabOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white shadow-lg animate-pulse">
          <Wallet className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">
          Memuat DompetKu...
        </p>
      </div>
    );
  }

  // Not logged in -> Show Supabase Auth Screen
  if (!user) {
    return <AuthPage />;
  }

  // Nav items for desktop header and mobile drawer
  const allNavItems = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'transactions', label: 'Transaksi', icon: ReceiptText },
    { id: 'recap', label: 'Rekap Bulanan', icon: BarChart2 },
    { id: 'calendar', label: 'Kalender', icon: Calendar },
    { id: 'budgets', label: 'Anggaran', icon: PieChart },
    { id: 'savings', label: 'Target Tabungan', icon: PiggyBank },
    { id: 'bills', label: 'Tagihan Berulang', icon: Clock },
    { id: 'scan', label: 'Scan Struk (AI)', icon: Camera, badge: 'AI' },
    { id: 'consult', label: 'Konsultasi (AI)', icon: Sparkles, badge: 'AI' },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div
          onClick={() => navigateTo('beranda')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Dompet<span className="text-emerald-600 dark:text-emerald-400">Ku</span>
              </span>
              <span className="text-3xs font-extrabold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Offline First
              </span>
            </div>
            <p className="text-3xs text-slate-400 font-medium truncate max-w-[150px] sm:max-w-none">
              {isDemoUser ? 'Demo Lokal' : `@${username}`}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {allNavItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : ''}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-3xs px-1 rounded-sm bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenAddModal()}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Transaksi</span>
          </button>

          <button
            onClick={() => setIsMoreDrawerOpen(true)}
            className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            title="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area: Spacious & Uncrowded Padding */}
      <main className="flex-1 px-4 sm:px-8 py-5 max-w-5xl mx-auto w-full">
        {activeTab === 'beranda' && (
          <Beranda onOpenAddModal={handleOpenAddModal} onNavigate={navigateTo} />
        )}
        {activeTab === 'transactions' && <Transaksi onOpenAddModal={handleOpenAddModal} />}
        {activeTab === 'recap' && <RekapBulanan onOpenAddModal={handleOpenAddModal} />}
        {activeTab === 'calendar' && <Kalender onOpenAddModal={handleOpenAddModal} />}
        {activeTab === 'scan' && (
          <ScanStruk
            onSuccessSave={() => navigateTo('transactions')}
            onManualAdd={(data) => handleOpenAddModal(data)}
          />
        )}
        {activeTab === 'consult' && <Konsultasi />}
        {activeTab === 'budgets' && <Anggaran />}
        {activeTab === 'savings' && <Tabungan />}
        {activeTab === 'bills' && <Tagihan />}
        {activeTab === 'settings' && <Pengaturan />}
      </main>

      {/* Floating Action Button (FAB) on Mobile */}
      <div className="fixed bottom-20 right-4 z-40 sm:bottom-8 sm:right-8">
        {isFabOpen && (
          <div className="flex flex-col gap-2 mb-3 animate-in slide-in-from-bottom-2">
            <button
              onClick={() => {
                navigateTo('scan');
                setIsFabOpen(false);
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-purple-600 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 hover:bg-purple-700 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Scan Struk AI
            </button>
            <button
              onClick={() => handleOpenAddModal({ type: 'income' })}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" />
              + Pemasukan
            </button>
            <button
              onClick={() => handleOpenAddModal({ type: 'expense' })}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-500/30 hover:bg-rose-600 transition-colors"
            >
              <ArrowDownRight className="w-4 h-4" />
              - Pengeluaran
            </button>
          </div>
        )}

        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 ${
            isFabOpen
              ? 'bg-slate-800 rotate-45 scale-95'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 scale-100 hover:scale-105'
          }`}
          title="Tambah Transaksi Cepat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* 4. BOTTOM NAVIGATION FOR MOBILE: Max Height 60px, iPhone Safe Area Padding */}
      <nav
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-3 h-[60px] max-h-[60px] flex items-center justify-around shadow-sm"
      >
        <button
          onClick={() => navigateTo('beranda')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
            activeTab === 'beranda'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Beranda</span>
        </button>

        <button
          onClick={() => navigateTo('transactions')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
            activeTab === 'transactions'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <ReceiptText className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Transaksi</span>
        </button>

        <button
          onClick={() => navigateTo('recap')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
            activeTab === 'recap'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Rekap</span>
        </button>

        <button
          onClick={() => navigateTo('calendar')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
            activeTab === 'calendar'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Kalender</span>
        </button>

        <button
          onClick={() => setIsMoreDrawerOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
            ['budgets', 'savings', 'bills', 'scan', 'consult', 'settings'].includes(activeTab)
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">Lainnya</span>
        </button>
      </nav>

      {/* "Lainnya" Mobile Drawer Menu */}
      {isMoreDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {isDemoUser ? 'Pengguna Demo' : `@${username}`}
                  </h2>
                  <p className="text-3xs text-slate-400 truncate max-w-[200px]">{userEmail}</p>
                </div>
              </div>

              <button
                onClick={() => setIsMoreDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navigateTo('budgets')}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <PieChart className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Anggaran</p>
                  <p className="text-3xs text-slate-400">Batas pos belanja</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('savings')}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Target Tabungan</p>
                  <p className="text-3xs text-slate-400">Impian & dana darurat</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('bills')}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Tagihan Rutin</p>
                  <p className="text-3xs text-slate-400">Pengingat tempo</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('scan')}
                className="flex items-center gap-3 p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-purple-900 dark:text-purple-200">Scan Struk AI</p>
                  <p className="text-3xs text-purple-600 dark:text-purple-300">GLM-4.6V-Flash</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('consult')}
                className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Konsultasi AI</p>
                  <p className="text-3xs text-emerald-600 dark:text-emerald-300">OpenRouter Free</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('settings')}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Pengaturan</p>
                  <p className="text-3xs text-slate-400">Tema & cadangan</p>
                </div>
              </button>
            </div>

            {/* Logout button in drawer */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={async () => {
                  setIsMoreDrawerOpen(false);
                  await signOut();
                  showToast('Sesi Anda telah diakhiri.', 'info');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun ({userEmail})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal (Add / Edit) */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        initialData={txModalInitialData}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}
