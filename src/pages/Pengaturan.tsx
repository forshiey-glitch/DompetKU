import React, { useState, useRef, useEffect } from 'react';
import {
  Moon,
  Sun,
  Database,
  Download,
  Upload,
  Trash2,
  Plus,
  Edit2,
  Check,
  AlertTriangle,
  X,
  Sparkles,
  Server,
  RefreshCw,
  FolderPlus,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { db, Category, DEFAULT_CATEGORIES, seedSampleData } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { CategoryIcon, ICON_OPTIONS, COLOR_OPTIONS } from '../components/CategoryIcon';

export const Pengaturan: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { user, userEmail, userId, signOut, isDemoUser, isOnline } = useAuth();

  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const transactionsCount = useLiveQuery(() => db.transactions.count()) || 0;

  // Category Modal State
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('ShoppingBag');
  const [catColor, setCatColor] = useState('#3b82f6');
  const [catType, setCatType] = useState<'expense' | 'income' | 'both'>('expense');

  // Double confirmation for Wipe Data
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);
  const [wipeInputConfirm, setWipeInputConfirm] = useState('');

  // Server health check
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err: any) {
      setHealthStatus({ error: err.message || 'Offline' });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Category Management
  const handleOpenCatModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCatName(cat.name);
      setCatIcon(cat.icon);
      setCatColor(cat.color);
      setCatType(cat.type || 'expense');
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatIcon('ShoppingBag');
      setCatColor('#10b981');
      setCatType('expense');
    }
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast('Nama kategori tidak boleh kosong', 'error');
      return;
    }

    try {
      if (editingCategory?.id) {
        await db.categories.update(editingCategory.id, {
          name: catName.trim(),
          icon: catIcon,
          color: catColor,
          type: catType,
        });
        showToast('Kategori berhasil diperbarui', 'success');
      } else {
        await db.categories.add({
          name: catName.trim(),
          icon: catIcon,
          color: catColor,
          isDefault: false,
          type: catType,
        });
        showToast('Kategori baru ditambahkan', 'success');
      }
      setCatModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan kategori', 'error');
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!cat.id) return;
    try {
      // Check if transactions exist with this category
      const count = await db.transactions.where('categoryId').equals(cat.id).count();
      if (count > 0) {
        showToast(`Kategori ini memiliki ${count} transaksi, tidak dapat dihapus langsung.`, 'error');
        return;
      }
      await db.categories.delete(cat.id);
      showToast('Kategori berhasil dihapus', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus kategori', 'error');
    }
  };

  // Export JSON Backup
  const handleExportJson = async () => {
    try {
      const data = {
        app: 'DompetKu',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        transactions: await db.transactions.toArray(),
        categories: await db.categories.toArray(),
        budgets: await db.budgets.toArray(),
        savingsGoals: await db.savingsGoals.toArray(),
        recurringBills: await db.recurringBills.toArray(),
        settings: await db.settings.toArray(),
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-dompetku-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Cadangan data berhasil diunduh (JSON)', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengekspor data', 'error');
    }
  };

  // Import JSON Backup
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed.transactions || !parsed.categories) {
          throw new Error('Format file cadangan tidak valid.');
        }

        // Restore transactions, budgets, savings, bills
        await db.transaction('rw', [db.transactions, db.categories, db.budgets, db.savingsGoals, db.recurringBills], async () => {
          if (parsed.categories?.length) {
            await db.categories.clear();
            await db.categories.bulkAdd(parsed.categories);
          }
          if (parsed.transactions?.length) {
            await db.transactions.clear();
            await db.transactions.bulkAdd(parsed.transactions);
          }
          if (parsed.budgets?.length) {
            await db.budgets.clear();
            await db.budgets.bulkAdd(parsed.budgets);
          }
          if (parsed.savingsGoals?.length) {
            await db.savingsGoals.clear();
            await db.savingsGoals.bulkAdd(parsed.savingsGoals);
          }
          if (parsed.recurringBills?.length) {
            await db.recurringBills.clear();
            await db.recurringBills.bulkAdd(parsed.recurringBills);
          }
        });

        showToast('Data berhasil dipulihkan dari cadangan!', 'success');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        showToast(err.message || 'Gagal memulihkan file cadangan', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Double-Confirmation Wipe Data
  const handlePerformWipeData = async () => {
    if (wipeInputConfirm !== 'HAPUS SEMUA') {
      showToast('Ketik konfirmasi kata "HAPUS SEMUA" dengan benar', 'error');
      return;
    }

    try {
      await db.transaction('rw', [db.transactions, db.categories, db.budgets, db.savingsGoals, db.recurringBills], async () => {
        await db.transactions.clear();
        await db.budgets.clear();
        await db.savingsGoals.clear();
        await db.recurringBills.clear();
        await db.categories.clear();
        await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[]);
      });

      setWipeStep(0);
      setWipeInputConfirm('');
      showToast('Semua data berhasil dibersihkan dari IndexedDB', 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus data', 'error');
    }
  };

  // Seed sample data helper
  const handleSeedData = async () => {
    try {
      await seedSampleData();
      showToast('Data simulasi berhasil dimuat ke IndexedDB!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data simulasi', 'error');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Pengaturan
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Akun, tampilan, kategori kustom, dan cadangan data
        </p>
      </div>

      {/* Akun Pengguna & Logout Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {userEmail}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {isDemoUser ? 'Mode Demo Lokal' : 'Akun Supabase'}
                </span>
                <span className="text-3xs text-emerald-600 dark:text-emerald-400 font-bold">
                  @{user?.user_metadata?.username || userEmail.split('@')[0]}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              await signOut();
              showToast('Sesi Anda telah diakhiri. Sampai jumpa!', 'info');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-colors shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </div>

      {/* Theme Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Tampilan Aplikasi
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-500" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Mode Gelap / Terang
              </p>
              <p className="text-2xs text-slate-400">
                Saat ini: {theme === 'dark' ? 'Mode Gelap (Dark)' : 'Mode Terang (Light)'}
              </p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
          >
            Ganti ke {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </button>
        </div>
      </div>

      {/* Categories Manager */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Kelola Kategori ({categories.length})
            </h2>
            <p className="text-2xs text-slate-400">
              Sesuaikan ikon, warna, dan nama kategori transaksi Anda
            </p>
          </div>
          <button
            onClick={() => handleOpenCatModal()}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Kategori
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                  style={{ backgroundColor: cat.color }}
                >
                  <CategoryIcon name={cat.icon} size={15} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {cat.name}
                  </p>
                  <span className="text-3xs text-slate-400 capitalize">
                    {cat.type || 'expense'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenCatModal(cat)}
                  className="p-1 text-slate-400 hover:text-emerald-600 rounded-md"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                {!cat.isDefault && (
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Backup & Restore (JSON) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            Cadangan & Pemulihan Data (IndexedDB)
          </h2>
          <p className="text-2xs text-slate-400">
            Semua data disimpan di peramban Anda. Unduh cadangan JSON secara berkala agar tidak hilang saat membersihkan riwayat browser.
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileImport}
          accept="application/json"
          className="hidden"
        />

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Ekspor Cadangan (JSON)
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
          >
            <Upload className="w-4 h-4 text-purple-600" />
            Pulihkan dari Cadangan (JSON)
          </button>

          {transactionsCount === 0 && (
            <button
              onClick={handleSeedData}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold hover:bg-purple-100 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              Muat Data Contoh Simulasi
            </button>
          )}
        </div>
      </div>

      {/* Backend & AI Service Status */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" />
            Status Backend Proxy & Kunci API
          </h2>
          <button
            onClick={checkHealth}
            disabled={isCheckingHealth}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">z.ai GLM-4.6V-Flash (OCR)</p>
              <p className="text-3xs text-slate-400">Variabel: ZAI_API_KEY</p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                healthStatus?.zaiConfigured
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : healthStatus?.geminiFallbackConfigured
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {healthStatus?.zaiConfigured
                ? 'Aktif (z.ai)'
                : healthStatus?.geminiFallbackConfigured
                ? 'Aktif (Gemini Fallback)'
                : 'Belum Terhubung'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">OpenRouter (Konsultasi AI)</p>
              <p className="text-3xs text-slate-400">Variabel: OPENROUTER_API_KEY</p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                healthStatus?.openrouterConfigured
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : healthStatus?.geminiFallbackConfigured
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {healthStatus?.openrouterConfigured
                ? 'Aktif (OpenRouter Free)'
                : healthStatus?.geminiFallbackConfigured
                ? 'Aktif (Gemini Fallback)'
                : 'Belum Terhubung'}
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone: Wipe All Data */}
      <div className="p-5 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h2 className="text-sm font-bold">Zona Bahaya (Hapus Data)</h2>
        </div>
        <p className="text-2xs text-rose-600 dark:text-rose-400">
          Tindakan ini akan mengosongkan seluruh riwayat transaksi, anggaran, tagihan, dan target tabungan dari IndexedDB browser ini.
        </p>

        {wipeStep === 0 && (
          <button
            onClick={() => setWipeStep(1)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
          >
            Hapus Semua Data Aplikasi
          </button>
        )}

        {wipeStep === 1 && (
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 space-y-3 animate-in fade-in">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Konfirmasi Tahap 1: Anda yakin ingin melanjutkan penghapusan?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setWipeStep(0)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => setWipeStep(2)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              >
                Ya, Lanjutkan ke Konfirmasi Akhir
              </button>
            </div>
          </div>
        )}

        {wipeStep === 2 && (
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-rose-400 dark:border-rose-800 space-y-3 animate-in fade-in">
            <p className="text-xs font-bold text-rose-600">
              Konfirmasi Terakhir: Ketik teks <span className="underline">HAPUS SEMUA</span> di bawah ini untuk mengeksekusi penghapusan:
            </p>
            <input
              type="text"
              placeholder="Ketik HAPUS SEMUA"
              value={wipeInputConfirm}
              onChange={(e) => setWipeInputConfirm(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-lg text-xs font-bold text-rose-600"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setWipeStep(0);
                  setWipeInputConfirm('');
                }}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
              >
                Batalkan
              </button>
              <button
                onClick={handlePerformWipeData}
                disabled={wipeInputConfirm !== 'HAPUS SEMUA'}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
              >
                Eksekusi Hapus Seluruh Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </h3>
              <button
                onClick={() => setCatModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Skincare, Gym, Asuransi"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Tipe Transaksi
                </label>
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                  <option value="both">Keduanya (Pengeluaran & Pemasukan)</option>
                </select>
              </div>

              {/* Icon selector */}
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Pilih Ikon
                </label>
                <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-xl">
                  {ICON_OPTIONS.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setCatIcon(item.name)}
                      className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                        catIcon === item.name
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <item.icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color selector */}
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Pilih Warna
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setCatColor(col)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        catColor === col ? 'scale-125 ring-2 ring-emerald-500 ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
