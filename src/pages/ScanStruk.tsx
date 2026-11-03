import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  DollarSign,
  Calendar,
  Building,
  ShoppingBag,
  ArrowRight,
  WifiOff,
} from 'lucide-react';
import { db, Transaction, Category } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface ScanStrukProps {
  onSuccessSave: (transaction: Transaction) => void;
  onManualAdd: (initialData?: Partial<Transaction>) => void;
}

interface ExtractedReceipt {
  merchant?: string;
  tanggal?: string;
  total?: number;
  items?: Array<{ name: string; qty?: number; price?: number }>;
}

export const ScanStruk: React.FC<ScanStrukProps> = ({ onSuccessSave, onManualAdd }) => {
  const { showToast } = useToast();
  const { userId } = useAuth();
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ExtractedReceipt | null>(null);
  const [providerUsed, setProviderUsed] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form confirmation state
  const [merchantName, setMerchantName] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih file gambar (JPG, PNG, WebP)', 'error');
      return;
    }

    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
      setScanResult(null);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  // Perform AI OCR via backend proxy
  const handlePerformScan = async () => {
    if (!imageBase64) {
      showToast('Pilih atau ambil foto struk terlebih dahulu', 'error');
      return;
    }

    // Check offline status
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('Fitur ini memerlukan koneksi internet. Anda sedang offline.');
      showToast('Fitur ini memerlukan koneksi internet', 'error');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses struk dengan AI.');
      }

      const receipt = data.data as ExtractedReceipt;
      setScanResult(receipt);
      setProviderUsed(data.provider || 'AI Vision');

      // Autofill fields
      setMerchantName(receipt.merchant || 'Struk Belanja');
      setTxDate(receipt.tanggal || new Date().toISOString().split('T')[0]);
      setTotalAmount(receipt.total || 0);

      // Guess smart category
      const belanjaCat = categories.find((c) =>
        ['makan', 'belanja', 'supermarket'].some((k) => c.name.toLowerCase().includes(k))
      );
      if (belanjaCat?.id) {
        setSelectedCategoryId(belanjaCat.id);
      } else if (categories[0]?.id) {
        setSelectedCategoryId(categories[0].id);
      }

      // Generate notes summary from items if any
      const itemsSummary = receipt.items?.length
        ? `Item: ${receipt.items.map((i) => `${i.name}${i.qty ? ` (x${i.qty})` : ''}`).join(', ')}`
        : '';
      setNotes(receipt.merchant ? `${receipt.merchant}${itemsSummary ? ` - ${itemsSummary}` : ''}` : itemsSummary);

      showToast('Struk berhasil dibaca! Silakan periksa & konfirmasi.', 'success');
    } catch (err: any) {
      console.error('Scan error:', err);
      const isNetworkErr = err.message.includes('fetch') || err.message.includes('Failed to fetch');
      const msg = isNetworkErr
        ? 'Fitur ini memerlukan koneksi internet. Gagal menghubungi server proxy.'
        : err.message || 'Gagal mengekstrak data struk.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Save confirmed transaction to IndexedDB
  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalAmount || totalAmount <= 0) {
      showToast('Nominal harus lebih dari 0', 'error');
      return;
    }
    if (!selectedCategoryId) {
      showToast('Pilih kategori transaksi', 'error');
      return;
    }

    try {
      const transaction: Omit<Transaction, 'id'> = {
        userId,
        type: 'expense',
        amount: totalAmount,
        date: txDate,
        categoryId: selectedCategoryId,
        note: notes.trim() || merchantName || 'Belanja Struk',
        createdAt: Date.now(),
      };

      const newId = await db.transactions.add(transaction as Transaction);
      showToast('Transaksi dari struk berhasil disimpan ke DompetKu!', 'success');
      onSuccessSave({ ...transaction, id: newId as number });
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan transaksi', 'error');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="pt-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
          <Sparkles className="w-4 h-4" />
          OCR Struk Cerdas
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Scan Struk Belanja
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Foto struk kasir atau belanjaan Anda untuk mengekstrak tanggal, toko, dan total secara otomatis.
        </p>
      </div>

      {/* Upload & Preview Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Upload Box */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-purple-50/20 group h-64"
            >
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Ambil Foto atau Pilih Gambar
              </p>
              <p className="text-2xs text-slate-400 mt-1 max-w-xs">
                Mendukung struk belanja minimarket, restoran, supermarket (JPG, PNG, WebP)
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 max-h-72 flex items-center justify-center group">
              <img
                src={imagePreview}
                alt="Preview Struk"
                className="max-h-72 w-auto object-contain"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-white/90 text-slate-800 text-xs font-semibold hover:bg-white shadow-xs"
                >
                  Ganti Foto
                </button>
              </div>
            </div>
          )}

          {/* Action buttons below preview */}
          <div className="space-y-2">
            <button
              onClick={handlePerformScan}
              disabled={!imagePreview || isScanning}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-md shadow-purple-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menganalisis Struk dengan AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Scan dengan AI (GLM-4.6V-Flash)</span>
                </>
              )}
            </button>

            {/* Manual fallback button */}
            <button
              type="button"
              onClick={() => onManualAdd()}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Atau masukkan data transaksi secara manual</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Results & Confirmation Form */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>Pemberitahuan</span>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {errorMessage}
              </p>
              <button
                onClick={() => onManualAdd()}
                className="mt-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
              >
                Gunakan Input Manual
              </button>
            </div>
          )}

          {!scanResult ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingBag className="w-12 h-12 stroke-1 mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Belum ada data struk
              </p>
              <p className="text-2xs text-slate-400 mt-1 max-w-xs">
                Unggah foto struk Anda di sisi kiri dan tekan tombol scan. Hasil pembacaan akan otomatis terisi di sini untuk Anda konfirmasi.
              </p>
            </div>
          ) : (
            <form onSubmit={handleConfirmSave} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Konfirmasi Hasil Scan
                </span>
                {providerUsed && (
                  <span className="text-3xs font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                    {providerUsed}
                  </span>
                )}
              </div>

              {/* Merchant */}
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                  <Building className="w-3 h-3" /> Nama Toko / Merchant
                </label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              {/* Total & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Total Pengeluaran
                  </label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Tanggal Struk
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Kategori
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes / Item breakdown */}
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Catatan Transaksi & Daftar Item
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Item chips if any */}
              {scanResult.items && scanResult.items.length > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-2xs space-y-1">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    Rincian Item Terdeteksi ({scanResult.items.length}):
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {scanResult.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>{item.name} {item.qty ? `x${item.qty}` : ''}</span>
                        {item.price ? <span className="font-semibold">{formatRupiah(item.price)}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Simpan ke DompetKu
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
