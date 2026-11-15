import React, { useState, useMemo } from 'react';
import {
  HandCoins,
  Plus,
  CheckCircle2,
  RotateCcw,
  Edit2,
  Trash2,
  X,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { db, Debt, DebtType } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah, formatDateIndo } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const Hutang: React.FC = () => {
  const { showToast } = useToast();
  const { userId } = useAuth();

  const allDebts = useLiveQuery(() => db.debts.orderBy('createdAt').reverse().toArray()) || [];

  const debts = useMemo(() => {
    return allDebts.filter((d) => d.userId === userId);
  }, [allDebts, userId]);

  const [filterType, setFilterType] = useState<'all' | DebtType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const [type, setType] = useState<DebtType>('hutang');
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const totals = useMemo(() => {
    let totalHutangUnpaid = 0;
    let totalPiutangUnpaid = 0;
    debts.forEach((d) => {
      if (!d.isPaid) {
        if (d.type === 'hutang') totalHutangUnpaid += d.amount;
        else totalPiutangUnpaid += d.amount;
      }
    });
    return { totalHutangUnpaid, totalPiutangUnpaid };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    const list = filterType === 'all' ? debts : debts.filter((d) => d.type === filterType);
    // Unpaid first, then paid
    return [...list].sort((a, b) => Number(a.isPaid) - Number(b.isPaid));
  }, [debts, filterType]);

  const handleOpenModal = (d?: Debt) => {
    if (d) {
      setEditingDebt(d);
      setType(d.type);
      setPersonName(d.personName);
      setAmount(String(d.amount));
      setDueDate(d.dueDate || '');
      setNote(d.note || '');
    } else {
      setEditingDebt(null);
      setType('hutang');
      setPersonName('');
      setAmount('');
      setDueDate('');
      setNote('');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Math.abs(Number(amount));
    if (!personName.trim()) {
      showToast('Masukkan nama orang atau pihak terkait', 'error');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      showToast('Nominal harus lebih dari 0', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingDebt?.id) {
        await db.debts.update(editingDebt.id, {
          type,
          personName: personName.trim(),
          amount: numAmount,
          dueDate: dueDate || undefined,
          note: note.trim() || undefined,
        });
        showToast('Catatan hutang/piutang diperbarui', 'success');
      } else {
        await db.debts.add({
          userId,
          type,
          personName: personName.trim(),
          amount: numAmount,
          dueDate: dueDate || undefined,
          note: note.trim() || undefined,
          isPaid: false,
          createdAt: Date.now(),
        });
        showToast('Catatan berhasil disimpan!', 'success');
      }
      setModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan catatan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePaid = async (d: Debt) => {
    if (!d.id) return;
    try {
      const nextPaid = !d.isPaid;
      await db.debts.update(d.id, {
        isPaid: nextPaid,
        paidAt: nextPaid ? Date.now() : undefined,
      });
      showToast(
        nextPaid ? 'Ditandai Lunas!' : 'Status dikembalikan ke Belum Lunas',
        nextPaid ? 'success' : 'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await db.debts.delete(id);
      showToast('Catatan dihapus', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus catatan', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-8 w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hutang & Piutang
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Catat pinjaman Anda dan uang yang dipinjam orang lain
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Catat Baru
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-xs font-bold">Hutang Saya</span>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
            {formatRupiah(totals.totalHutangUnpaid)}
          </p>
          <p className="text-[11px] text-slate-400">Belum lunas (harus dibayar)</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <ArrowDownLeft className="w-4 h-4" />
            <span className="text-xs font-bold">Piutang Saya</span>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
            {formatRupiah(totals.totalPiutangUnpaid)}
          </p>
          <p className="text-[11px] text-slate-400">Dipinjam orang (belum kembali)</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
        {[
          { key: 'all', label: 'Semua' },
          { key: 'hutang', label: 'Hutang' },
          { key: 'piutang', label: 'Piutang' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key as any)}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              filterType === tab.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Debt List */}
      {filteredDebts.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <HandCoins className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Belum Ada Catatan Hutang/Piutang
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Catat pinjaman agar mudah diingat kapan harus melunasi atau menagih.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
          >
            + Tambah Catatan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDebts.map((d) => {
            const isHutang = d.type === 'hutang';
            return (
              <div
                key={d.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  d.isPaid
                    ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isHutang
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {isHutang ? 'Hutang (Saya Pinjam)' : 'Piutang (Orang Pinjam)'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.isPaid
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {d.isPaid ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </div>

                    <p
                      className={`text-sm font-bold text-slate-900 dark:text-white mt-1.5 truncate ${
                        d.isPaid ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {d.personName}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {d.dueDate
                        ? `Jatuh tempo: ${formatDateIndo(d.dueDate, { showDay: false })}`
                        : 'Tanpa tenggat'}
                      {d.note ? ` • ${d.note}` : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm sm:text-base font-extrabold ${
                        d.isPaid
                          ? 'text-slate-400 line-through'
                          : isHutang
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatRupiah(d.amount)}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <button
                        onClick={() => handleOpenModal(d)}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded-md"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => d.id && handleDelete(d.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleTogglePaid(d)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      d.isPaid
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    {d.isPaid ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Tandai Belum Lunas
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Tandai Lunas
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Add / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-t-3xl sm:rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingDebt ? 'Edit Catatan' : 'Catat Hutang / Piutang'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType('hutang')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    type === 'hutang'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Hutang (Saya Pinjam)
                </button>
                <button
                  type="button"
                  onClick={() => setType('piutang')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    type === 'piutang'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Piutang (Orang Pinjam)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Nama Orang / Pihak
                </label>
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Contoh: Budi, Andi, Toko Sumber"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100000"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Tanggal Jatuh Tempo (Opsional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: Talangan makan siang"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
