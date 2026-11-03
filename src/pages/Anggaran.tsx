import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Plus,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { db, Budget, Category, Transaction } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const Anggaran: React.FC = () => {
  const { showToast } = useToast();
  const { userId } = useAuth();

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allBudgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];

  const budgets = useMemo(() => {
    return allBudgets.filter((b) => !b.userId || b.userId === userId || b.userId === 'default-user');
  }, [allBudgets, userId]);

  const transactions = useMemo(() => {
    return allTransactions.filter((t) => !t.userId || t.userId === userId || t.userId === 'default-user');
  }, [allTransactions, userId]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [monthlyLimit, setMonthlyLimit] = useState<string>('');

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((c) => {
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [categories]);

  // Current month spent per category
  const currentMonthSpending = useMemo(() => {
    const map = new Map<number, number>();
    transactions.forEach((t) => {
      if (t.type === 'expense' && t.date.startsWith(currentMonthStr)) {
        const cur = map.get(t.categoryId) || 0;
        map.set(t.categoryId, cur + t.amount);
      }
    });
    return map;
  }, [transactions, currentMonthStr]);

  // Grand totals
  const totalBudget = useMemo(() => {
    return budgets.reduce((acc, b) => acc + b.monthlyLimit, 0);
  }, [budgets]);

  const totalExpenseOnBudgetedCategories = useMemo(() => {
    let sum = 0;
    budgets.forEach((b) => {
      sum += currentMonthSpending.get(b.categoryId) || 0;
    });
    return sum;
  }, [budgets, currentMonthSpending]);

  const overallPercentage = totalBudget > 0 ? (totalExpenseOnBudgetedCategories / totalBudget) * 100 : 0;

  const handleOpenModal = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      setSelectedCategoryId(budget.categoryId);
      setMonthlyLimit(String(budget.monthlyLimit));
    } else {
      setEditingBudget(null);
      // Select first available category without budget
      const existingCategoryIds = new Set(budgets.map((b) => b.categoryId));
      const available = categories.find((c) => c.id && !existingCategoryIds.has(c.id) && c.type !== 'income');
      setSelectedCategoryId(available?.id || categories[0]?.id || 1);
      setMonthlyLimit('500000');
    }
    setModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(monthlyLimit);
    if (!limit || limit <= 0) {
      showToast('Masukkan batas anggaran yang valid', 'error');
      return;
    }

    try {
      if (editingBudget?.id) {
        await db.budgets.update(editingBudget.id, {
          categoryId: selectedCategoryId,
          monthlyLimit: limit,
        });
        showToast('Anggaran kategori berhasil diperbarui', 'success');
      } else {
        // Check if category already has a budget
        const exists = budgets.find((b) => b.categoryId === selectedCategoryId);
        if (exists?.id) {
          await db.budgets.update(exists.id, { monthlyLimit: limit });
          showToast('Anggaran kategori berhasil diperbarui', 'success');
        } else {
          await db.budgets.add({
            userId,
            categoryId: selectedCategoryId,
            monthlyLimit: limit,
          });
          showToast('Anggaran kategori baru ditambahkan!', 'success');
        }
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan anggaran', 'error');
    }
  };

  const handleDeleteBudget = async (id: number) => {
    try {
      await db.budgets.delete(id);
      showToast('Anggaran dihapus', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus anggaran', 'error');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Anggaran Bulanan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Batasi pengeluaran per kategori agar keuangan tetap terkendali
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Atur Anggaran Kategori
        </button>
      </div>

      {/* Summary Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Total Realisasi vs Anggaran ({now.toLocaleString('id-ID', { month: 'long' })})
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {formatRupiah(totalExpenseOnBudgetedCategories)}
              </span>
              <span className="text-sm font-medium text-slate-400">
                / {formatRupiah(totalBudget)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                overallPercentage > 100
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : overallPercentage >= 70
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {Math.round(overallPercentage)}% Terpakai
            </span>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              overallPercentage > 100
                ? 'bg-rose-500'
                : overallPercentage >= 70
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, overallPercentage)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-2xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;70% Aman
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 70-100% Waspada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> &gt;100% Melebihi Anggaran
          </span>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Daftar Pos Anggaran ({budgets.length})
        </h2>

        {budgets.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 mb-3">
              Anda belum menetapkan batas anggaran untuk kategori mana pun.
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
            >
              + Tetapkan Anggaran Pertama
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {budgets.map((b) => {
              const cat = categoryMap.get(b.categoryId);
              const spent = currentMonthSpending.get(b.categoryId) || 0;
              const percent = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
              const remaining = b.monthlyLimit - spent;
              const isOver = percent > 100;
              const isWarning = percent >= 70 && percent <= 100;

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: cat?.color || '#64748b' }}
                      >
                        <CategoryIcon name={cat?.icon || 'MoreHorizontal'} size={18} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {cat?.name || 'Kategori'}
                        </h3>
                        <p className="text-2xs text-slate-400">
                          Batas: {formatRupiah(b.monthlyLimit)}/bulan
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(b)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => b.id && handleDeleteBudget(b.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar with 3 color thresholds */}
                  <div className="space-y-1.5">
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-2xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Terpakai: {formatRupiah(spent)}
                      </span>
                      <span
                        className={`font-bold ${
                          isOver
                            ? 'text-rose-600 dark:text-rose-400'
                            : isWarning
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {Math.round(percent)}%
                      </span>
                    </div>

                    <div className="text-2xs text-slate-400">
                      {isOver ? (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Melebihi anggaran sebesar{' '}
                          {formatRupiah(Math.abs(remaining))}
                        </span>
                      ) : (
                        <span>Sisa anggaran: {formatRupiah(remaining)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Budget Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingBudget ? 'Edit Anggaran Kategori' : 'Atur Anggaran Kategori'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Kategori Pengeluaran
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
                  disabled={Boolean(editingBudget)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {categories
                    .filter((c) => c.type !== 'income')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Batas Maksimal Bulanan (Rp)
                </label>
                <input
                  type="number"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  placeholder="500000"
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Simpan Anggaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
