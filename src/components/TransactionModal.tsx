import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, Calendar, Tag, FileText, Check } from 'lucide-react';
import { db, Transaction, Category } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { CategoryIcon } from './CategoryIcon';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatRupiah } from '../utils/format';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Partial<Transaction> | null;
  onSuccess?: (transaction: Transaction) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { userId } = useAuth();
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type || 'expense');
        setAmount(initialData.amount ? String(initialData.amount) : '');
        setDate(initialData.date || new Date().toISOString().split('T')[0]);
        setCategoryId(initialData.categoryId || 0);
        setNote(initialData.note || '');
      } else {
        setType('expense');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setCategoryId(0);
        setNote('');
      }
    }
  }, [isOpen, initialData]);

  // Set default category when type changes if category is empty
  useEffect(() => {
    if (categories.length > 0 && (!categoryId || categoryId === 0)) {
      const defaultCat = categories.find((c) =>
        type === 'income' ? c.type === 'income' : c.type === 'expense' || !c.type
      ) || categories[0];
      if (defaultCat?.id) setCategoryId(defaultCat.id);
    }
  }, [categories, type, categoryId]);

  if (!isOpen) return null;

  const quickAmounts = [10000, 25000, 50000, 100000, 250000, 500000, 1000000];

  const handleAddQuickAmount = (val: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + val));
  };

  const filteredCategories = categories.filter((c) => {
    if (type === 'income') return c.type === 'income' || c.type === 'both';
    return c.type === 'expense' || c.type === 'both' || !c.type;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Math.abs(Number(amount));

    if (!numAmount || numAmount <= 0) {
      showToast('Masukkan nominal transaksi yang valid', 'error');
      return;
    }

    if (!categoryId) {
      showToast('Pilih kategori transaksi', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const transactionData: Omit<Transaction, 'id'> = {
        userId: initialData?.userId || userId,
        type,
        amount: numAmount,
        date,
        categoryId,
        note: note.trim(),
        createdAt: initialData?.createdAt || Date.now(),
      };

      if (initialData?.id) {
        await db.transactions.update(initialData.id, transactionData);
        showToast('Transaksi berhasil diperbarui', 'success');
        onSuccess?.({ ...transactionData, id: initialData.id });
      } else {
        const newId = await db.transactions.add(transactionData as Transaction);
        showToast('Transaksi berhasil dicatat!', 'success');
        onSuccess?.({ ...transactionData, id: newId as number });
      }

      onClose();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan transaksi', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {initialData?.id ? 'Edit Transaksi' : 'Catat Transaksi Baru'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* Transaction Type Segmented Control */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Pemasukan
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Nominal (Rupiah)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-14 pr-4 py-3 text-2xl font-bold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
            {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                Terbilang: {formatRupiah(Number(amount))}
              </p>
            )}

            {/* Quick add chip amounts */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAddQuickAmount(q)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  +{q >= 1000000 ? `${q / 1000000}jt` : `${q / 1000}rb`}
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Tanggal Transaksi
            </label>
            <div className="relative">
              <Calendar className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Pilih Kategori
              </label>
              <span className="text-xs text-slate-400">
                {filteredCategories.find((c) => c.id === categoryId)?.name || 'Pilih salah satu'}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
              {filteredCategories.map((cat) => {
                const isSelected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => cat.id && setCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center group ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-xs'
                        : 'border-transparent hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white mb-1 shadow-xs transition-transform group-hover:scale-105"
                      style={{ backgroundColor: cat.color }}
                    >
                      <CategoryIcon name={cat.icon} size={18} className="text-white" />
                    </div>
                    <span className="text-xs font-semibold line-clamp-1">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Catatan / Keterangan
            </label>
            <input
              type="text"
              placeholder="Contoh: Makan Siang Nasi Padang, Belanja Bulanan"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Menyimpan...' : initialData?.id ? 'Perbarui Transaksi' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
