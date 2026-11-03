import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  TrendingUp,
  Edit2,
  Trash2,
  X,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { db, SavingsGoal } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah, formatDateIndo, getDaysLeft } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const Tabungan: React.FC = () => {
  const { showToast } = useToast();
  const { userId } = useAuth();
  const allSavingsGoals = useLiveQuery(() => db.savingsGoals.toArray()) || [];

  const savingsGoals = React.useMemo(() => {
    return allSavingsGoals.filter((g) => !g.userId || g.userId === userId || g.userId === 'default-user');
  }, [allSavingsGoals, userId]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [savedAmount, setSavedAmount] = useState('');

  // Quick Deposit/Withdraw modal
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [fundGoal, setFundGoal] = useState<SavingsGoal | null>(null);
  const [fundType, setFundType] = useState<'deposit' | 'withdraw'>('deposit');
  const [fundDelta, setFundDelta] = useState('');

  const handleOpenAdd = (goal?: SavingsGoal) => {
    if (goal) {
      setEditingGoal(goal);
      setName(goal.name);
      setTargetAmount(String(goal.targetAmount));
      setDeadline(goal.deadline);
      setSavedAmount(String(goal.savedAmount));
    } else {
      setEditingGoal(null);
      setName('');
      setTargetAmount('5000000');
      // 6 months from now
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      setDeadline(d.toISOString().split('T')[0]);
      setSavedAmount('0');
    }
    setModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(targetAmount);
    const saved = Number(savedAmount) || 0;

    if (!name.trim()) {
      showToast('Nama target tidak boleh kosong', 'error');
      return;
    }
    if (!target || target <= 0) {
      showToast('Nominal target tabungan harus lebih dari 0', 'error');
      return;
    }

    try {
      if (editingGoal?.id) {
        await db.savingsGoals.update(editingGoal.id, {
          name: name.trim(),
          targetAmount: target,
          deadline,
          savedAmount: saved,
        });
        showToast('Target tabungan berhasil diperbarui!', 'success');
      } else {
        await db.savingsGoals.add({
          userId,
          name: name.trim(),
          targetAmount: target,
          deadline,
          savedAmount: saved,
        });
        showToast('Target tabungan baru berhasil dibuat!', 'success');
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan target', 'error');
    }
  };

  const handleDeleteGoal = async (id: number) => {
    try {
      await db.savingsGoals.delete(id);
      showToast('Target tabungan dihapus', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus target', 'error');
    }
  };

  const handleOpenFundModal = (goal: SavingsGoal, type: 'deposit' | 'withdraw') => {
    setFundGoal(goal);
    setFundType(type);
    setFundDelta('');
    setFundModalOpen(true);
  };

  const handleSaveFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundGoal?.id) return;
    const delta = Number(fundDelta);
    if (!delta || delta <= 0) {
      showToast('Masukkan nominal yang valid', 'error');
      return;
    }

    const current = fundGoal.savedAmount || 0;
    const nextSaved = fundType === 'deposit' ? current + delta : Math.max(0, current - delta);

    try {
      await db.savingsGoals.update(fundGoal.id, { savedAmount: nextSaved });
      showToast(
        fundType === 'deposit'
          ? `Berhasil menambah tabungan sebesar ${formatRupiah(delta)}!`
          : `Penarikan ${formatRupiah(delta)} berhasil dicatat`,
        'success'
      );
      setFundModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui saldo tabungan', 'error');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Target Tabungan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rencanakan impian, dana darurat, dan pantau progres pencapaian
          </p>
        </div>

        <button
          onClick={() => handleOpenAdd()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Buat Target Baru
        </button>
      </div>

      {/* Goals Grid */}
      {savingsGoals.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <Wallet className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Belum Ada Target Tabungan
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Mulailah mengalokasikan impian keuangan Anda seperti dana darurat, liburan, atau gadget baru.
          </p>
          <button
            onClick={() => handleOpenAdd()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
          >
            + Buat Target Tabungan Sekarang
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savingsGoals.map((g) => {
            const percent = Math.min(
              100,
              Math.round((g.savedAmount / (g.targetAmount || 1)) * 100)
            );
            const daysLeft = getDaysLeft(g.deadline);
            const isCompleted = g.savedAmount >= g.targetAmount;

            return (
              <div
                key={g.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 relative overflow-hidden"
              >
                {isCompleted && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-3xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Tercapai!
                  </div>
                )}

                <div className="flex items-start justify-between pr-14">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {g.name}
                    </h3>
                    <p className="text-2xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-purple-500" />
                      Deadline: {formatDateIndo(g.deadline, { showDay: false })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenAdd(g)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => g.id && handleDeleteGoal(g.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Amount status */}
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(g.savedAmount)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      Target: {formatRupiah(g.targetAmount)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-purple-600'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Days Left & Percentage Footer */}
                <div className="flex items-center justify-between text-2xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {daysLeft > 0 ? (
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {daysLeft} hari lagi
                      </span>
                    ) : daysLeft === 0 ? (
                      <span className="font-bold text-amber-600">Hari ini jatuh tempo</span>
                    ) : (
                      <span className="font-bold text-rose-600">Batas waktu terlewat</span>
                    )}
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Progres: {percent}%
                  </span>
                </div>

                {/* Deposit / Withdraw Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleOpenFundModal(g, 'deposit')}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                    Tambah Saldo
                  </button>
                  <button
                    onClick={() => handleOpenFundModal(g, 'withdraw')}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-slate-500" />
                    Tarik Dana
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Goal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingGoal ? 'Edit Target Tabungan' : 'Buat Target Tabungan'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3.5">
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Nama Target
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Dana Darurat, DP Rumah, Beli Laptop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Nominal Target (Rp)
                </label>
                <input
                  type="number"
                  placeholder="5000000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Sudah Terkumpul Saat Ini (Rp)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={savedAmount}
                  onChange={(e) => setSavedAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Batas Waktu (Deadline)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
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
                  Simpan Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit / Withdraw Modal */}
      {fundModalOpen && fundGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {fundType === 'deposit' ? 'Tambah Tabungan' : 'Tarik Dana Tabungan'}
              </h3>
              <button
                onClick={() => setFundModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Target: <strong className="text-slate-800 dark:text-slate-200">{fundGoal.name}</strong> (Saat ini: {formatRupiah(fundGoal.savedAmount)})
            </p>

            <form onSubmit={handleSaveFund} className="space-y-4">
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Nominal {fundType === 'deposit' ? 'Penambahan' : 'Penarikan'} (Rp)
                </label>
                <input
                  type="number"
                  placeholder="100000"
                  value={fundDelta}
                  onChange={(e) => setFundDelta(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setFundModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-semibold rounded-xl text-white ${
                    fundType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Konfirmasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
