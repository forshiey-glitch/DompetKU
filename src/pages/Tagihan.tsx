import React, { useState } from 'react';
import {
  Clock,
  Plus,
  CheckCircle2,
  Calendar,
  Download,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { db, RecurringBill, Category, Transaction } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah, generateIcsFile } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const Tagihan: React.FC = () => {
  const { showToast } = useToast();
  const { userId } = useAuth();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
  const todayDay = now.getDate();

  const allRecurringBills = useLiveQuery(() => db.recurringBills.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const recurringBills = React.useMemo(() => {
    return allRecurringBills.filter((b) => !b.userId || b.userId === userId || b.userId === 'default-user');
  }, [allRecurringBills, userId]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState<number>(10);

  const handleOpenAdd = (bill?: RecurringBill) => {
    if (bill) {
      setEditingBill(bill);
      setName(bill.name);
      setAmount(String(bill.amount));
      setDueDay(bill.dueDay);
    } else {
      setEditingBill(null);
      setName('');
      setAmount('150000');
      setDueDay(10);
    }
    setModalOpen(true);
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!name.trim()) {
      showToast('Nama tagihan tidak boleh kosong', 'error');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      showToast('Nominal tagihan harus lebih dari 0', 'error');
      return;
    }
    if (dueDay < 1 || dueDay > 31) {
      showToast('Tanggal jatuh tempo harus antara 1 sampai 31', 'error');
      return;
    }

    try {
      if (editingBill?.id) {
        await db.recurringBills.update(editingBill.id, {
          name: name.trim(),
          amount: numAmount,
          dueDay,
        });
        showToast('Tagihan berhasil diperbarui', 'success');
      } else {
        await db.recurringBills.add({
          userId,
          name: name.trim(),
          amount: numAmount,
          dueDay,
        });
        showToast('Tagihan rutin baru berhasil dicatat!', 'success');
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan tagihan', 'error');
    }
  };

  const handleDeleteBill = async (id: number) => {
    try {
      await db.recurringBills.delete(id);
      showToast('Tagihan dihapus', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus tagihan', 'error');
    }
  };

  // Mark bill as paid: creates transaction & updates lastPaidMonth
  const handleMarkAsPaid = async (bill: RecurringBill) => {
    try {
      const tagihanCat =
        categories.find((c) => c.name.toLowerCase().includes('tagihan')) || categories[0];

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
      showToast(err.message || 'Gagal memproses pembayaran tagihan', 'error');
    }
  };

  // Reset paid status for bill
  const handleResetPaidStatus = async (bill: RecurringBill) => {
    try {
      if (bill.id) {
        await db.recurringBills.update(bill.id, {
          lastPaidMonth: '',
        });
      }
      showToast(`Status tagihan "${bill.name}" direset ke belum dibayar`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal mereset status tagihan', 'error');
    }
  };

  // Export .ics for a single bill reminder
  const handleExportBillIcs = (bill: RecurringBill) => {
    const targetDateStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-${String(bill.dueDay).padStart(2, '0')}`;
    generateIcsFile(
      `Jatuh Tempo: ${bill.name}`,
      targetDateStr,
      `Pengingat pembayaran tagihan rutin ${bill.name} sebesar ${formatRupiah(bill.amount)}.`,
      `tagihan-${bill.name.toLowerCase().replace(/\s+/g, '-')}.ics`
    );
    showToast(`File pengingat .ics untuk ${bill.name} diunduh`, 'success');
  };

  const totalMonthlyBills = recurringBills.reduce((acc, b) => acc + b.amount, 0);

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tagihan Berulang
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola tagihan bulanan (listrik, wifi, streaming, kos) agar tidak terlambat bayar
          </p>
        </div>

        <button
          onClick={() => handleOpenAdd()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Tagihan
        </button>
      </div>

      {/* Summary Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
            Total Estimasi Tagihan Rutin Per Bulan
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            {formatRupiah(totalMonthlyBills)}
          </div>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sudah Dibayar Bulan Ini
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Belum Dibayar
          </span>
        </div>
      </div>

      {/* Bills List */}
      {recurringBills.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Belum Ada Tagihan Berulang
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Catat pengeluaran rutin Anda seperti listrik, air, internet, kontrakan, atau langganan aplikasi.
          </p>
          <button
            onClick={() => handleOpenAdd()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
          >
            + Catat Tagihan Rutin Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {recurringBills.map((b) => {
            const isPaidThisMonth = b.lastPaidMonth === currentMonthStr;
            const daysLeft = b.dueDay - todayDay;
            const isOverdue = !isPaidThisMonth && daysLeft < 0;

            return (
              <div
                key={b.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  isPaidThisMonth
                    ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                    : isOverdue
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {b.name}
                    </h3>
                    <p className="text-2xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Jatuh tempo tiap tanggal <strong>{b.dueDay}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleExportBillIcs(b)}
                      title="Ekspor Pengingat .ics"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenAdd(b)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => b.id && handleDeleteBill(b.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {formatRupiah(b.amount)}
                  </span>
                  <span
                    className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                      isPaidThisMonth
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : isOverdue
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {isPaidThisMonth
                      ? 'Lunas Bulan Ini'
                      : isOverdue
                      ? `Terlambat ${Math.abs(daysLeft)} hari`
                      : daysLeft === 0
                      ? 'Jatuh Tempo Hari Ini'
                      : `${daysLeft} hari lagi`}
                  </span>
                </div>

                {/* Bottom Action */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {isPaidThisMonth ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-2xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sudah dibayar
                      </span>
                      <button
                        onClick={() => handleResetPaidStatus(b)}
                        className="text-2xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset Status
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleMarkAsPaid(b)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tandai Sudah Dibayar (Catat Pengeluaran)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Bill Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingBill ? 'Edit Tagihan Rutin' : 'Tambah Tagihan Rutin'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-3.5">
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Nama Tagihan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: WiFi Indihome, Listrik PLN, BPJS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Nominal Tagihan (Rp)
                </label>
                <input
                  type="number"
                  placeholder="250000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Tanggal Jatuh Tempo Tiap Bulan (1 - 31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(Number(e.target.value))}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
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
                  Simpan Tagihan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
