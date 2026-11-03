import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  X,
  TrendingDown,
  TrendingUp,
  Download,
} from 'lucide-react';
import { db, Transaction, Category } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah, formatDateIndo, exportToCsv } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface TransaksiProps {
  onOpenAddModal: (initialData?: Partial<Transaction> | null) => void;
}

export const Transaksi: React.FC<TransaksiProps> = ({ onOpenAddModal }) => {
  const { showToast } = useToast();
  const { userId } = useAuth();

  const allTransactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const transactions = useMemo(() => {
    return allTransactions.filter((t) => !t.userId || t.userId === userId || t.userId === 'default-user');
  }, [allTransactions, userId]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM or ''
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Category lookup
  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((c) => {
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [categories]);

  // Unique list of available months from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.substring(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Search note
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const noteMatch = (t.note || '').toLowerCase().includes(query);
        const catName = (categoryMap.get(t.categoryId)?.name || '').toLowerCase();
        const catMatch = catName.includes(query);
        if (!noteMatch && !catMatch) return false;
      }

      // Type filter
      if (selectedType !== 'all' && t.type !== selectedType) {
        return false;
      }

      // Category filter
      if (selectedCategoryId !== 'all' && t.categoryId !== selectedCategoryId) {
        return false;
      }

      // Month filter
      if (selectedMonth && !t.date.startsWith(selectedMonth)) {
        return false;
      }

      // Min amount
      if (minAmount && Number(minAmount) > 0 && t.amount < Number(minAmount)) {
        return false;
      }

      // Max amount
      if (maxAmount && Number(maxAmount) > 0 && t.amount > Number(maxAmount)) {
        return false;
      }

      return true;
    });
  }, [
    transactions,
    searchTerm,
    selectedType,
    selectedCategoryId,
    selectedMonth,
    minAmount,
    maxAmount,
    categoryMap,
  ]);

  // Group transactions by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: Transaction[]; dailyTotalExpense: number; dailyTotalIncome: number }[] = [];
    const dateMap = new Map<string, Transaction[]>();

    filteredTransactions.forEach((t) => {
      const arr = dateMap.get(t.date) || [];
      arr.push(t);
      dateMap.set(t.date, arr);
    });

    const sortedDates = Array.from(dateMap.keys()).sort().reverse();

    sortedDates.forEach((date) => {
      const items = dateMap.get(date) || [];
      const dailyTotalExpense = items.filter((i) => i.type === 'expense').reduce((acc, cur) => acc + cur.amount, 0);
      const dailyTotalIncome = items.filter((i) => i.type === 'income').reduce((acc, cur) => acc + cur.amount, 0);
      groups.push({ date, items, dailyTotalExpense, dailyTotalIncome });
    });

    return groups;
  }, [filteredTransactions]);

  // Delete transaction handler
  const handleDeleteTransaction = async (id: number) => {
    try {
      await db.transactions.delete(id);
      showToast('Transaksi berhasil dihapus', 'info');
      setDeletingId(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus transaksi', 'error');
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedType('all');
    setSelectedCategoryId('all');
    setSelectedMonth('');
    setMinAmount('');
    setMaxAmount('');
    setSearchTerm('');
  };

  const hasActiveFilters =
    selectedType !== 'all' ||
    selectedCategoryId !== 'all' ||
    Boolean(selectedMonth) ||
    Boolean(minAmount) ||
    Boolean(maxAmount) ||
    Boolean(searchTerm);

  return (
    <div className="space-y-6 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Daftar Transaksi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filteredTransactions.length} transaksi ditemukan
          </p>
        </div>

        <div className="flex items-center gap-2">
          {filteredTransactions.length > 0 && (
            <button
              onClick={() => exportToCsv(filteredTransactions, categories)}
              title="Ekspor CSV"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>
          )}

          <button
            onClick={() => onOpenAddModal()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Catat Transaksi
          </button>
        </div>
      </div>

      {/* Search Bar & Filter Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari catatan atau nama kategori..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilterDrawer(!showFilterDrawer)}
          className={`px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            hasActiveFilters
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Filter</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
          )}
        </button>
      </div>

      {/* Expandable Filter Box */}
      {showFilterDrawer && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Filter Transaksi
            </h3>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:underline font-semibold"
              >
                Reset Semua Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Tipe Transaksi
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
              >
                <option value="all">Semua Tipe</option>
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Kategori
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) =>
                  setSelectedCategoryId(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Periode Bulan
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
              >
                <option value="">Semua Periode</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount range */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Nominal Minimal (Rp)
              </label>
              <input
                type="number"
                placeholder="0"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Nominal Maksimal (Rp)
              </label>
              <input
                type="number"
                placeholder="Tak terbatas"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Transactions List Grouped by Date */}
      {groupedByDate.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            Tidak ada transaksi ditemukan
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            {hasActiveFilters
              ? 'Coba atur ulang filter pencarian Anda untuk melihat transaksi.'
              : 'Mulai dengan mencatat transaksi pengeluaran atau pemasukan pertama Anda.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 rounded-xl"
            >
              Reset Filter
            </button>
          ) : (
            <button
              onClick={() => onOpenAddModal()}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
            >
              + Catat Transaksi Baru
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((group) => (
            <div
              key={group.date}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
            >
              {/* Date Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatDateIndo(group.date)}
                </span>
                <div className="flex items-center gap-3">
                  {group.dailyTotalIncome > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> +{formatRupiah(group.dailyTotalIncome)}
                    </span>
                  )}
                  {group.dailyTotalExpense > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> -{formatRupiah(group.dailyTotalExpense)}
                    </span>
                  )}
                </div>
              </div>

              {/* Transactions in this day */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {group.items.map((t) => {
                  const cat = categoryMap.get(t.categoryId);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        {/* Desktop icon */}
                        <div
                          className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center shrink-0 shadow-xs"
                          style={{ backgroundColor: cat?.color || '#64748b' }}
                        >
                          <CategoryIcon name={cat?.icon || 'MoreHorizontal'} size={18} className="text-white" />
                        </div>

                        {/* Mobile minimalist color dot */}
                        <div
                          className="sm:hidden w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat?.color || '#64748b' }}
                        />

                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {t.note || cat?.name || 'Transaksi'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {cat?.name || 'Tanpa Kategori'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs sm:text-base font-extrabold ${
                            t.type === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {t.type === 'income' ? '+' : '-'} {formatRupiah(t.amount)}
                        </span>

                        {/* Action buttons (Edit & Delete) */}
                        <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onOpenAddModal(t)}
                            title="Edit Transaksi"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => t.id && setDeletingId(t.id)}
                            title="Hapus Transaksi"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Hapus Transaksi?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Transaksi yang dihapus tidak dapat dipulihkan kembali. Anda yakin ingin melanjutkan?
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteTransaction(deletingId)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
