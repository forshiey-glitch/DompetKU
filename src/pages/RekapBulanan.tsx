import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Download,
  ChevronLeft,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Minus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { db, Transaction, Category } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  formatRupiah,
  formatDateIndo,
  formatMonthIndo,
  calculatePercentageChange,
  exportToCsv,
} from '../utils/format';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';

interface RekapBulananProps {
  onOpenAddModal: (initialData?: Partial<Transaction>) => void;
}

export const RekapBulanan: React.FC<RekapBulananProps> = ({ onOpenAddModal }) => {
  const { userId } = useAuth();
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const transactions = useMemo(() => {
    return allTransactions.filter((t) => !t.userId || t.userId === userId || t.userId === 'default-user');
  }, [allTransactions, userId]);

  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedYm, setSelectedYm] = useState<string>(currentYm);

  // Accordion state: default CLOSED (tertutup) as requested
  const [isChartsOpen, setIsChartsOpen] = useState<boolean>(false);

  // Category lookup
  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((c) => {
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [categories]);

  // Navigate months
  const handlePrevMonth = () => {
    const [year, month] = selectedYm.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    setSelectedYm(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedYm.split('-').map(Number);
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setSelectedYm(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
  };

  // Previous month string for safe percentage comparison
  const previousYm = useMemo(() => {
    const [year, month] = selectedYm.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }, [selectedYm]);

  // Transactions in selected month
  const currentMonthTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.date.startsWith(selectedYm))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, selectedYm]);

  // Totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    currentMonthTransactions.forEach((t) => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [currentMonthTransactions]);

  // Previous month totals
  const prevTotals = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      if (t.date.startsWith(previousYm)) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
    });

    return { income, expense };
  }, [transactions, previousYm]);

  // Comparison changes
  const expenseChange = useMemo(() => {
    return calculatePercentageChange(totals.expense, prevTotals.expense);
  }, [totals.expense, prevTotals.expense]);

  const incomeChange = useMemo(() => {
    return calculatePercentageChange(totals.income, prevTotals.income);
  }, [totals.income, prevTotals.income]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const catAmounts = new Map<number, number>();
    currentMonthTransactions.forEach((t) => {
      if (t.type === 'expense') {
        const current = catAmounts.get(t.categoryId) || 0;
        catAmounts.set(t.categoryId, current + t.amount);
      }
    });

    const list: {
      categoryId: number;
      name: string;
      color: string;
      amount: number;
      percentage: number;
    }[] = [];

    catAmounts.forEach((amount, catId) => {
      const cat = categoryMap.get(catId);
      const percentage = totals.expense > 0 ? (amount / totals.expense) * 100 : 0;
      list.push({
        categoryId: catId,
        name: cat?.name || 'Lainnya',
        color: cat?.color || '#94a3b8',
        amount,
        percentage: Math.round(percentage * 10) / 10,
      });
    });

    return list.sort((a, b) => b.amount - a.amount);
  }, [currentMonthTransactions, categoryMap, totals.expense]);

  // 6-Month Trend Data for Bar Chart
  const sixMonthsTrend = useMemo(() => {
    const [currY, currM] = selectedYm.split('-').map(Number);
    const months: string[] = [];

    for (let i = 5; i >= 0; i--) {
      let targetM = currM - i;
      let targetY = currY;
      while (targetM <= 0) {
        targetM += 12;
        targetY -= 1;
      }
      months.push(`${targetY}-${String(targetM).padStart(2, '0')}`);
    }

    return months.map((ym) => {
      let inc = 0;
      let exp = 0;
      transactions.forEach((t) => {
        if (t.date.startsWith(ym)) {
          if (t.type === 'income') inc += t.amount;
          else exp += t.amount;
        }
      });
      const [y, m] = ym.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      return {
        key: ym,
        label: `${monthNames[Number(m) - 1]} ${y.slice(2)}`,
        Pemasukan: inc,
        Pengeluaran: exp,
      };
    });
  }, [selectedYm, transactions]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Month Navigator Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Rekap Bulanan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Arus kas dan rincian pengeluaran per kategori
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Month Stepper */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-1 shadow-xs">
            <button
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 min-w-28 text-center">
              {formatMonthIndo(selectedYm)}
            </span>
            <button
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {currentMonthTransactions.length > 0 && (
            <button
              onClick={() => exportToCsv(currentMonthTransactions, categories, `rekap-${selectedYm}.csv`)}
              className="p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Income */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Pemasukan</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatRupiah(totals.income)}
          </div>
          <div className="text-xs font-medium">
            {incomeChange.isNew ? (
              <span className="text-slate-400">Bulan lalu: Rp 0</span>
            ) : incomeChange.percent === 0 ? (
              <span className="text-slate-400 flex items-center gap-0.5">
                <Minus className="w-3 h-3" /> Sama dengan bulan lalu
              </span>
            ) : (
              <span className={`flex items-center gap-0.5 ${incomeChange.isIncrease ? 'text-emerald-600' : 'text-rose-600'}`}>
                {incomeChange.isIncrease ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {incomeChange.percent}% vs bulan lalu
              </span>
            )}
          </div>
        </div>

        {/* Expense */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Pengeluaran</span>
            <div className="w-7 h-7 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatRupiah(totals.expense)}
          </div>
          <div className="text-xs font-medium">
            {expenseChange.isNew ? (
              <span className="text-slate-400">Bulan lalu: Rp 0</span>
            ) : expenseChange.percent === 0 ? (
              <span className="text-slate-400 flex items-center gap-0.5">
                <Minus className="w-3 h-3" /> Sama dengan bulan lalu
              </span>
            ) : (
              <span className={`flex items-center gap-0.5 ${expenseChange.isIncrease ? 'text-rose-600' : 'text-emerald-600'}`}>
                {expenseChange.isIncrease ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {expenseChange.percent}% vs bulan lalu
              </span>
            )}
          </div>
        </div>

        {/* Net Cashflow */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Sisa Kas (Net)</span>
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
              Saldo
            </span>
          </div>
          <div
            className={`text-xl sm:text-2xl font-extrabold ${
              totals.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatRupiah(totals.balance)}
          </div>
          <p className="text-xs text-slate-400">
            {totals.balance >= 0 ? 'Surplus anggaran' : 'Defisit anggaran'}
          </p>
        </div>
      </div>

      {/* ACCORDION PIE CHART & BAR CHART (DEFAULT TERTUTUP AGAR MOBILE TIDAK PADAT) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsChartsOpen(!isChartsOpen)}
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Grafik Analitik & Tren
              </h2>
              <p className="text-xs text-slate-400">
                {isChartsOpen ? 'Klik untuk menutup grafik' : 'Buka diagram lingkaran & perbandingan 6 bulan'}
              </p>
            </div>
          </div>
          <div className="p-1 rounded-lg text-slate-400">
            {isChartsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {isChartsOpen && (
          <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 space-y-6 animate-in slide-in-from-top-2">
            {/* Pie Chart */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Distribusi Kategori
              </h3>
              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Belum ada transaksi pengeluaran.</p>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {categoryBreakdown.map((entry) => (
                          <Cell key={entry.categoryId} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [formatRupiah(Number(val)), 'Pengeluaran']}
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderRadius: '12px',
                          color: '#fff',
                          border: 'none',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* 6-Month Bar Chart */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tren 6 Bulan Terakhir
              </h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sixMonthsTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      tickFormatter={(val) => {
                        if (val >= 1000000) return `${val / 1000000}Jt`;
                        if (val >= 1000) return `${val / 1000}Rb`;
                        return String(val);
                      }}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatRupiah(Number(val)), '']}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderRadius: '12px',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Bar dataKey="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RINCIAN PENGELUARAN DALAM BENTUK LIST VIEW LAPANG (BARIS PER BARIS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Rincian Kategori Pengeluaran
          </h2>
          <span className="text-xs text-slate-400">
            Total {formatRupiah(totals.expense)}
          </span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-400">
            Tidak ada pengeluaran di bulan {formatMonthIndo(selectedYm)}.
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {categoryBreakdown.map((item) => (
              /* Bentuk List View: [Nama Kategori] - [Persentase] - [Nominal] */
              <div
                key={item.categoryId}
                className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.percentage}%
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatRupiah(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transactions in Month List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
          <span>Daftar Transaksi Bulan Ini</span>
          <span className="text-xs font-normal text-slate-400">
            {currentMonthTransactions.length} transaksi
          </span>
        </h2>

        {currentMonthTransactions.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-xs text-slate-400">
            Belum ada transaksi.
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {currentMonthTransactions.map((t) => {
              const cat = categoryMap.get(t.categoryId);
              return (
                <div
                  key={t.id}
                  onClick={() => onOpenAddModal(t)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {t.note || cat?.name || 'Transaksi'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {cat?.name} • {formatDateIndo(t.date, { showDay: false })}
                    </p>
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                      t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
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
