import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Camera,
  ArrowRight,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { db, Transaction, Category, RecurringBill, SavingsGoal } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah, formatDateIndo, getDaysLeft } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface BerandaProps {
  onOpenAddModal: (initialData?: Partial<Transaction>) => void;
  onNavigate: (tab: string) => void;
}

export const Beranda: React.FC<BerandaProps> = ({ onOpenAddModal, onNavigate }) => {
  const { showToast } = useToast();
  const { userId, userEmail, username, isDemoUser } = useAuth();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
  const todayDay = now.getDate();

  // Queries from Dexie filtered by userId (or legacy records)
  const allTransactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const allSavingsGoals = useLiveQuery(() => db.savingsGoals.toArray()) || [];
  const allRecurringBills = useLiveQuery(() => db.recurringBills.toArray()) || [];

  // Scoped to current active user
  const transactions = useMemo(() => {
    return allTransactions.filter((t) => !t.userId || t.userId === userId || t.userId === 'default-user');
  }, [allTransactions, userId]);

  const savingsGoals = useMemo(() => {
    return allSavingsGoals.filter((g) => !g.userId || g.userId === userId || g.userId === 'default-user');
  }, [allSavingsGoals, userId]);

  const recurringBills = useMemo(() => {
    return allRecurringBills.filter((b) => !b.userId || b.userId === userId || b.userId === 'default-user');
  }, [allRecurringBills, userId]);

  // Category map
  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((c) => {
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [categories]);

  // Current month summary
  const currentMonthSummary = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      if (t.date.startsWith(currentMonthStr)) {
        if (t.type === 'income') {
          income += t.amount;
        } else {
          expense += t.amount;
        }
      }
    });

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions, currentMonthStr]);

  // Upcoming bills due in the next 7 days
  const upcomingBills = useMemo(() => {
    return recurringBills.filter((bill) => {
      const isPaidThisMonth = bill.lastPaidMonth === currentMonthStr;
      if (isPaidThisMonth) return false;
      const diff = bill.dueDay - todayDay;
      return diff >= -5 && diff <= 7;
    });
  }, [recurringBills, todayDay, currentMonthStr]);

  // Max 3 recent transactions on Mobile as requested
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 3);
  }, [transactions]);

  // Mark bill as paid action
  const handlePayBill = async (bill: RecurringBill) => {
    try {
      const tagihanCat = categories.find((c) => c.name.toLowerCase().includes('tagihan')) || categories[0];

      await db.transactions.add({
        userId,
        type: 'expense',
        amount: bill.amount,
        date: new Date().toISOString().split('T')[0],
        categoryId: tagihanCat?.id || 1,
        note: `Pembayaran tagihan: ${bill.name}`,
        createdAt: Date.now(),
      });

      if (bill.id) {
        await db.recurringBills.update(bill.id, {
          lastPaidMonth: currentMonthStr,
        });
      }

      showToast(`Tagihan "${bill.name}" berhasil dicatat dibayar!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses tagihan', 'error');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Top Greeting & User Badge */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
            {formatDateIndo(new Date().toISOString().split('T')[0])}
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Ringkasan Keuangan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px] sm:max-w-none">
            {isDemoUser ? 'Mode Demo Lokal' : `@${username} • ${userEmail}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('scan')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold hover:bg-purple-100 transition-colors shadow-xs"
          >
            <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">Scan Struk</span> AI
          </button>
          <button
            onClick={() => onNavigate('consult')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Konsultasi</span> AI
          </button>
        </div>
      </div>

      {/* 1. KARTU UTAMA BESAR: SALDO BULAN INI */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 sm:p-8 shadow-sm">
        <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-44 h-44 rounded-full bg-white/5 pointer-events-none blur-xl" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">
              Total Saldo Bulan Ini
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-white font-medium">
              {now.toLocaleString('id-ID', { month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight pt-1">
            {formatRupiah(currentMonthSummary.balance)}
          </div>
          <p className="text-xs text-emerald-100/70 pt-1">
            {currentMonthSummary.balance >= 0 ? 'Kondisi kas surplus bulan ini' : 'Defisit (pengeluaran > pemasukan)'}
          </p>
        </div>
      </div>

      {/* PEMASUKAN & PENGELUARAN KECIL BERDAMPINGAN DI BAWAH KARTU UTAMA */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
        {/* Pemasukan Kecil */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Pemasukan</p>
            <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
              {formatRupiah(currentMonthSummary.income)}
            </p>
          </div>
        </div>

        {/* Pengeluaran Kecil */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Pengeluaran</p>
            <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
              {formatRupiah(currentMonthSummary.expense)}
            </p>
          </div>
        </div>
      </div>

      {/* QUICK ACTION BUTTONS */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onOpenAddModal({ type: 'expense' })}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-xs hover:bg-rose-100 transition-colors shadow-xs"
        >
          <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center">
            <Plus className="w-3.5 h-3.5" />
          </div>
          Catat Pengeluaran
        </button>

        <button
          onClick={() => onOpenAddModal({ type: 'income' })}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 transition-colors shadow-xs"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
            <Plus className="w-3.5 h-3.5" />
          </div>
          Catat Pemasukan
        </button>
      </div>

      {/* TAGIHAN DALAM BENTUK HORIZONTAL SCROLL (ANTI-MENUMPUK DI MOBILE) */}
      {upcomingBills.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Tagihan Segera ({upcomingBills.length})
              </h2>
            </div>
            <button
              onClick={() => onNavigate('bills')}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Horizontal Scroll Carousel */}
          <div className="flex gap-3.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar snap-x">
            {upcomingBills.map((bill) => {
              const daysLeft = bill.dueDay - todayDay;
              const isOverdue = daysLeft < 0;

              return (
                <div
                  key={bill.id}
                  className="min-w-[260px] max-w-[280px] p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs shrink-0 snap-start flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {bill.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isOverdue ? (
                          <span className="text-rose-600 font-semibold">
                            Terlewat {Math.abs(daysLeft)} hari
                          </span>
                        ) : daysLeft === 0 ? (
                          <span className="text-amber-600 font-semibold">Jatuh tempo hari ini</span>
                        ) : (
                          <span>{daysLeft} hari lagi (Tgl {bill.dueDay})</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {formatRupiah(bill.amount)}
                    </span>
                  </div>

                  <button
                    onClick={() => handlePayBill(bill)}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tandai Dibayar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TARGET TABUNGAN DALAM BENTUK HORIZONTAL SCROLL (ANTI-MENUMPUK DI MOBILE) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Target Tabungan
            </h2>
          </div>
          <button
            onClick={() => onNavigate('savings')}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            Kelola <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {savingsGoals.length === 0 ? (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-center shadow-xs">
            <p className="text-xs text-slate-500 mb-2">
              Belum ada target tabungan yang dibuat.
            </p>
            <button
              onClick={() => onNavigate('savings')}
              className="text-xs font-bold text-emerald-600 hover:underline"
            >
              + Buat Target Tabungan
            </button>
          </div>
        ) : (
          <div className="flex gap-3.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar snap-x">
            {savingsGoals.map((goal) => {
              const percent = Math.min(
                100,
                Math.round((goal.savedAmount / (goal.targetAmount || 1)) * 100)
              );
              const daysLeft = getDaysLeft(goal.deadline);

              return (
                <div
                  key={goal.id}
                  onClick={() => onNavigate('savings')}
                  className="min-w-[260px] max-w-[280px] p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs shrink-0 snap-start flex flex-col justify-between space-y-3 cursor-pointer hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {goal.name}
                    </p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {percent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatRupiah(goal.savedAmount)}</span>
                      <span className="text-slate-400">/ {formatRupiah(goal.targetAmount)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                    {daysLeft > 0 ? `${daysLeft} hari lagi` : 'Tenggat waktu selesai'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3 TRANSAKSI TERAKHIR (DIBATASI 3 ITEM DENGAN TOMBOL LIHAT SEMUA) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Transaksi Terakhir
            </h2>
          </div>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            Lihat Semua <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-center shadow-xs">
            <p className="text-xs text-slate-500 mb-3">Belum ada transaksi tercatat.</p>
            <button
              onClick={() => onOpenAddModal()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs"
            >
              + Catat Sekarang
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {recentTransactions.map((t) => {
              const cat = categoryMap.get(t.categoryId);

              return (
                <div
                  key={t.id}
                  onClick={() => onOpenAddModal(t)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {t.note || cat?.name || 'Transaksi'}
                    </p>
                    {/* Teks sekunder 12px (text-xs) tanpa visual clutter di mobile */}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {cat?.name} • {formatDateIndo(t.date, { showDay: false })}
                    </p>
                  </div>

                  <span
                    className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                      t.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'} {formatRupiah(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
