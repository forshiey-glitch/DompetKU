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
  Sun,
  Moon,
  HandCoins,
  CreditCard,
} from 'lucide-react';
import { initializeDatabase, ensureDefaultWallet, Transaction } from './db';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TransactionModal } from './components/TransactionModal';
import { PWAInstallButton } from './components/PWAInstallButton';

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
import { Dompet } from './pages/Dompet';
import { Hutang } from './pages/Hutang';
import { Pengaturan } from './pages/Pengaturan';

type Tab =
  | 'beranda'
  | 'transactions'
  | 'recap'
  | 'calendar'
  | 'wallets'
  | 'debts'
  | 'scan'
  | 'consult'
  | 'budgets'
  | 'savings'
  | 'bills'
  | 'settings';

function MainApp() {
  const { user, isLoading, isPasswordRecovery, signOut, userEmail, username, isDemoUser, userId } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('beranda');
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Transaction Modal State
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalInitialData, setTxModalInitialData] = useState<Partial<Transaction> | null>(null);

  // Initialize database schema, default categories & default wallet (zero dummy data)
  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
        if (userId) {
          await ensureDefaultWallet(userId);
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
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-lg animate-pulse">
          <Wallet className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          Memuat Uangku...
        </p>
      </div>
    );
  }

  // Not logged in OR processing password recovery link -> Show Auth Screen
  if (!user || isPasswordRecovery) {
    return <AuthPage />;
  }

  // Nav items for desktop header and mobile drawer
  const allNavItems = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'transactions', label: 'Transaksi', icon: ReceiptText },
    { id: 'wallets', label: 'Dompet', icon: CreditCard },
    { id: 'recap', label: 'Rekap', icon: BarChart2 },
    { id: 'calendar', label: 'Kalender', icon: Calendar },
    { id: 'debts', label: 'Hutang', icon: HandCoins },
    { id: 'budgets', label: 'Anggaran', icon: PieChart },
    { id: 'savings', label: 'Tabungan', icon: PiggyBank },
    { id: 'bills', label: 'Tagihan', icon: Clock },
    { id: 'scan', label: 'Scan Struk', icon: Camera, badge: 'AI' },
    { id: 'consult', label: 'Konsultasi', icon: Sparkles, badge: 'AI' },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div
          onClick={() => navigateTo('beranda')}
          className="flex items-center gap-2.5 cursor-pointer group min-w-0 shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white block leading-tight">
              Uang<span className="text-indigo-600 dark:text-indigo-400">ku</span>
            </span>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[130px] sm:max-w-none">
              {isDemoUser ? 'Mode Tamu' : `@${username}`}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {allNavItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] px-1 rounded-sm bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton variant="compact" />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Ganti Tema"
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          <button
            onClick={() => handleOpenAddModal()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xl:inline">Catat Transaksi</span>
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

      {/* Main Content Area: w-full max-w-md on mobile, expandable on desktop, min 80px bottom padding */}
      <main className="flex-1 w-full max-w-md md:max-w-4xl mx-auto px-4 md:px-8 pt-5 pb-24">
        {activeTab === 'beranda' && (
          <Beranda onOpenAddModal={handleOpenAddModal} onNavigate={navigateTo} />
        )}
        {activeTab === 'transactions' && <Transaksi onOpenAddModal={handleOpenAddModal} />}
        {activeTab === 'wallets' && <Dompet />}
        {activeTab === 'debts' && <Hutang />}
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

      {/* Floating Action Button (FAB) — hidden on Konsultasi so it never overlaps the Send button */}
      {activeTab !== 'consult' && (
        <div className="fixed bottom-20 right-4 z-40 sm:bottom-8 sm:right-8 no-print">
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
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        className="lg:hidden z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-sm no-print"
      >
        <div className="w-full max-w-md mx-auto px-2 h-[60px] flex items-center justify-around">
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
            onClick={() => navigateTo('wallets')}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
              activeTab === 'wallets'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Dompet</span>
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
            onClick={() => setIsMoreDrawerOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${
              ['calendar', 'debts', 'budgets', 'savings', 'bills', 'scan', 'consult', 'settings'].includes(
                activeTab
              )
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Lainnya</span>
          </button>
        </div>
      </nav>

      {/* "Lainnya" Mobile Drawer Menu */}
      {isMoreDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {isDemoUser ? 'Pengguna Tamu' : `@${username}`}
                  </h2>
                  <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
                </div>
              </div>

              <button
                onClick={() => setIsMoreDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navigateTo('debts')}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 flex items-center justify-center shrink-0">
                  <HandCoins className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Hutang & Piutang</p>
                  <p className="text-[11px] text-slate-400 truncate">Catatan pinjaman</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('calendar')}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Kalender</p>
                  <p className="text-[11px] text-slate-400 truncate">Transaksi harian</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('budgets')}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <PieChart className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Anggaran</p>
                  <p className="text-[11px] text-slate-400 truncate">Batas belanja</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('savings')}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Tabungan</p>
                  <p className="text-[11px] text-slate-400 truncate">Target impian</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('bills')}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Tagihan</p>
                  <p className="text-[11px] text-slate-400 truncate">Pengingat rutin</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('scan')}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-purple-900 dark:text-purple-200 truncate">Scan Struk</p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-300 truncate">Baca otomatis</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('consult')}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">Konsultasi</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-300 truncate">Asisten AI</p>
                </div>
              </button>

              <button
                onClick={() => navigateTo('settings')}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-100 dark:border-slate-700 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">Pengaturan</p>
                  <p className="text-[11px] text-slate-400 truncate">Profil & cadangan</p>
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
                <span className="truncate">Keluar Akun ({userEmail})</span>
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
