import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  Landmark,
  Smartphone,
  Banknote,
  Plus,
  Edit2,
  Trash2,
  ArrowLeftRight,
  X,
  Check,
  History,
  ArrowRight,
} from 'lucide-react';
import {
  db,
  Wallet,
  WalletType,
  WalletTransfer,
  ensureDefaultWallet,
  transferBetweenWallets,
} from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah, formatDateIndo } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const WALLET_TYPE_META: Record<
  WalletType,
  { label: string; icon: React.FC<{ className?: string }>; defaultColor: string }
> = {
  cash: { label: 'Tunai', icon: Banknote, defaultColor: '#10b981' },
  bank: { label: 'Bank', icon: Landmark, defaultColor: '#4f46e5' },
  ewallet: { label: 'E-Wallet', icon: Smartphone, defaultColor: '#8b5cf6' },
};

const WALLET_COLORS = ['#10b981', '#4f46e5', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#0ea5e9', '#64748b'];

export const Dompet: React.FC = () => {
  const { showToast } = useToast();
  const { userId } = useAuth();

  const allWallets = useLiveQuery(() => db.wallets.toArray()) || [];
  const allTransfers = useLiveQuery(() => db.transfers.orderBy('createdAt').reverse().toArray()) || [];

  useEffect(() => {
    if (userId) {
      ensureDefaultWallet(userId).catch(() => {});
    }
  }, [userId]);

  const wallets = useMemo(() => {
    return allWallets.filter((w) => w.userId === userId);
  }, [allWallets, userId]);

  const transfers = useMemo(() => {
    return allTransfers.filter((t) => t.userId === userId);
  }, [allTransfers, userId]);

  const walletMap = useMemo(() => {
    const map = new Map<number, Wallet>();
    wallets.forEach((w) => {
      if (w.id) map.set(w.id, w);
    });
    return map;
  }, [wallets]);

  const totalBalance = useMemo(() => {
    return wallets.reduce((acc, w) => acc + (w.balance || 0), 0);
  }, [wallets]);

  // Wallet Modal state
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [walletName, setWalletName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('cash');
  const [walletInitialBalance, setWalletInitialBalance] = useState('0');
  const [walletColor, setWalletColor] = useState('#10b981');
  const [isSavingWallet, setIsSavingWallet] = useState(false);

  // Transfer Modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [fromWalletId, setFromWalletId] = useState<number>(0);
  const [toWalletId, setToWalletId] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferNote, setTransferNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const handleOpenWalletModal = (w?: Wallet) => {
    if (w) {
      setEditingWallet(w);
      setWalletName(w.name);
      setWalletType(w.type);
      setWalletInitialBalance(String(w.balance));
      setWalletColor(w.color || '#10b981');
    } else {
      setEditingWallet(null);
      setWalletName('');
      setWalletType('bank');
      setWalletInitialBalance('0');
      setWalletColor('#4f46e5');
    }
    setWalletModalOpen(true);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName.trim()) {
      showToast('Nama dompet tidak boleh kosong', 'error');
      return;
    }

    const numBalance = Number(walletInitialBalance) || 0;
    setIsSavingWallet(true);
    try {
      if (editingWallet?.id) {
        await db.wallets.update(editingWallet.id, {
          name: walletName.trim(),
          type: walletType,
          balance: numBalance,
          color: walletColor,
        });
        showToast('Dompet berhasil diperbarui', 'success');
      } else {
        await db.wallets.add({
          userId,
          name: walletName.trim(),
          type: walletType,
          balance: numBalance,
          initialBalance: numBalance,
          color: walletColor,
          createdAt: Date.now(),
        });
        showToast('Dompet baru berhasil ditambahkan!', 'success');
      }
      setWalletModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan dompet', 'error');
    } finally {
      setIsSavingWallet(false);
    }
  };

  const handleDeleteWallet = async (w: Wallet) => {
    if (!w.id) return;
    if (wallets.length <= 1) {
      showToast('Minimal harus ada 1 dompet aktif', 'error');
      return;
    }
    try {
      const txCount = await db.transactions.where('walletId').equals(w.id).count();
      if (txCount > 0) {
        showToast(
          `Dompet ini memiliki ${txCount} transaksi terkait. Edit nama/saldo alih-alih menghapusnya.`,
          'error'
        );
        return;
      }
      await db.wallets.delete(w.id);
      showToast('Dompet berhasil dihapus', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus dompet', 'error');
    }
  };

  const handleOpenTransferModal = () => {
    if (wallets.length < 2) {
      showToast('Tambahkan minimal 2 dompet untuk melakukan transfer antar dompet', 'error');
      return;
    }
    setFromWalletId(wallets[0]?.id || 0);
    setToWalletId(wallets[1]?.id || 0);
    setTransferAmount('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferNote('');
    setTransferModalOpen(true);
  };

  const handlePerformTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Math.abs(Number(transferAmount));
    if (!fromWalletId || !toWalletId) {
      showToast('Pilih dompet asal dan dompet tujuan', 'error');
      return;
    }
    if (fromWalletId === toWalletId) {
      showToast('Dompet asal dan tujuan tidak boleh sama', 'error');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      showToast('Masukkan nominal transfer yang valid', 'error');
      return;
    }

    setIsTransferring(true);
    try {
      await transferBetweenWallets({
        userId,
        fromWalletId,
        toWalletId,
        amount: numAmount,
        date: transferDate,
        note: transferNote,
      });
      showToast('Transfer antar dompet berhasil dicatat!', 'success');
      setTransferModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses transfer', 'error');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Dompet & Rekening
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola saldo Tunai, Bank, E-Wallet, dan transfer antar dompet
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleOpenTransferModal}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold text-xs hover:bg-indigo-100 transition-colors shadow-xs"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Transfer
          </button>
          <button
            onClick={() => handleOpenWalletModal()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Dompet
          </button>
        </div>
      </div>

      {/* Total Balance Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-emerald-600 text-white p-6 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-100 uppercase tracking-wider">
            Total Saldo Semua Dompet
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 font-medium">
            {wallets.length} Dompet Aktif
          </span>
        </div>
        <div className="text-3xl font-extrabold tracking-tight pt-1">
          {formatRupiah(totalBalance)}
        </div>
        <p className="text-xs text-indigo-100/80 pt-1">
          Saldo setiap dompet diperbarui otomatis saat Anda mencatat transaksi atau transfer.
        </p>
      </div>

      {/* Wallets List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Daftar Dompet Anda</h2>
        {wallets.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <WalletIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500">Belum ada dompet. Tambahkan dompet pertama Anda.</p>
            <button
              onClick={() => handleOpenWalletModal()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              + Buat Dompet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {wallets.map((w) => {
              const meta = WALLET_TYPE_META[w.type] || WALLET_TYPE_META.cash;
              const IconComp = meta.icon;
              return (
                <div
                  key={w.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: w.color || meta.defaultColor }}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {w.name}
                      </p>
                      <p className="text-xs text-slate-400">{meta.label}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p
                        className={`text-sm font-extrabold ${
                          w.balance < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {formatRupiah(w.balance)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleOpenWalletModal(w)}
                        title="Edit Dompet"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {wallets.length > 1 && (
                        <button
                          onClick={() => handleDeleteWallet(w)}
                          title="Hapus Dompet"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transfer History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            Riwayat Transfer Antar Dompet
          </h2>
          <span className="text-xs text-slate-400">{transfers.length} transfer</span>
        </div>

        {transfers.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            Belum ada riwayat perpindahan saldo antar dompet.
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {transfers.map((tr) => {
              const fromW = walletMap.get(tr.fromWalletId);
              const toW = walletMap.get(tr.toWalletId);
              return (
                <div key={tr.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{fromW?.name || 'Dompet Asal'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{toW?.name || 'Dompet Tujuan'}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {formatDateIndo(tr.date, { showDay: false })}
                      {tr.note ? ` • ${tr.note}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 shrink-0">
                    {formatRupiah(tr.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Wallet Modal */}
      {walletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-t-3xl sm:rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingWallet ? 'Edit Dompet' : 'Tambah Dompet Baru'}
              </h3>
              <button
                onClick={() => setWalletModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Nama Dompet / Rekening
                </label>
                <input
                  type="text"
                  required
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="Contoh: Tunai, BCA, GoPay, Dana"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Jenis Dompet
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'bank', 'ewallet'] as WalletType[]).map((t) => {
                    const meta = WALLET_TYPE_META[t];
                    const active = walletType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setWalletType(t);
                          if (!editingWallet) setWalletColor(meta.defaultColor);
                        }}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold transition-colors ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  {editingWallet ? 'Saldo Saat Ini (Rp)' : 'Saldo Awal (Rp)'}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  value={walletInitialBalance}
                  onChange={(e) => setWalletInitialBalance(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Warna Ikon
                </label>
                <div className="flex flex-wrap gap-2">
                  {WALLET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setWalletColor(col)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        walletColor === col ? 'scale-125 ring-2 ring-emerald-500 ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingWallet}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSavingWallet ? 'Menyimpan...' : 'Simpan Dompet'}
                </button>
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Between Wallets Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-t-3xl sm:rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                Transfer Antar Dompet
              </h3>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePerformTransfer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Dari Dompet
                </label>
                <select
                  value={fromWalletId}
                  onChange={(e) => setFromWalletId(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRupiah(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Ke Dompet
                </label>
                <select
                  value={toWalletId}
                  onChange={(e) => setToWalletId(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatRupiah(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Nominal Transfer (Rp)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Contoh: 100000"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Contoh: Top up e-wallet / Tarik tunai ATM"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {isTransferring ? 'Memproses...' : 'Transfer Sekarang'}
                </button>
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
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
