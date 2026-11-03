# DompetKu - Aplikasi Pencatat Keuangan Pribadi

**DompetKu** adalah aplikasi web pencatat keuangan pribadi modern, responsif, dan *offline-first*. Seluruh data transaksi, kategori, anggaran, target tabungan, dan tagihan disimpan secara lokal di dalam browser Anda menggunakan **IndexedDB (Dexie.js)**. Backend Node.js Express hanya bertindak sebagai proxy aman untuk fitur AI tanpa menyimpan data pengguna apa pun.

---

## 🌟 Fitur Utama

1. **100% Offline-First (IndexedDB)**: Pembukuan harian, CRUD transaksi, rekap bulanan, kalender, anggaran, dan target tabungan berfungsi penuh tanpa koneksi internet.
2. **Scan Struk AI (z.ai GLM-4.6V-Flash)**: Cukup foto struk belanja, AI mengekstrak nama toko, tanggal, total nominal, dan rincian item ke formulir secara instan. Fallback otomatis ke input manual jika offline.
3. **Konsultasi Keuangan AI (OpenRouter Free)**: Chatbot penasihat keuangan yang membaca ringkasan data 3 bulan terakhir Anda untuk memberikan analisis dan saran pengelolaan uang yang realistis.
4. **Beranda Interaktif**: Ringkasan arus kas bulan berjalan, peringatan tagihan yang akan jatuh tempo dalam 7 hari, progres target tabungan, 5 transaksi terkini, dan tombol tambah cepat.
5. **Daftar Transaksi Lengkap**: Kelompokan per tanggal, filter dinamis (tipe, kategori, periode bulan, rentang nominal), pencarian catatan, serta ekspor CSV.
6. **Rekap Bulanan & Analisis Visual**:
   - Perbandingan persentase dengan bulan lalu (aman dari pembagian nol).
   - Diagram lingkaran (Pie Chart) distribusi pengeluaran per kategori.
   - Diagram batang (Bar Chart) tren pemasukan vs pengeluaran 6 bulan terakhir.
   - Tabel persentase tiap kategori dan ekspor CSV.
7. **Kalender Keuangan**:
   - Grid tanggal dengan indikator transaksi (hijau untuk pemasukan, merah untuk pengeluaran).
   - Penanda deadline target tabungan dan jatuh tempo tagihan rutin.
   - Klik tanggal untuk melihat transaksi dan menambah transaksi langsung.
   - Ekspor pengingat kalender `.ics`.
8. **Anggaran Bulanan**:
   - Tetapkan batas anggaran per kategori.
   - Indikator bar berwarna: Hijau (&lt;70%), Kuning (70%-100%), Merah (&gt;100% over-budget).
9. **Target Tabungan**:
   - Catat target impian (nama, target, tenggat waktu, nominal tersimpan).
   - Hitungan sisa hari otomatis serta tombol cepat setor/tarik saldo tabungan.
10. **Tagihan Berulang**:
    - Catat tagihan rutin (listrik, internet, sewa, dll.).
    - Tombol "Tandai Dibayar" yang otomatis mencatatkan pengeluaran di pembukuan.
    - Ekspor pengingat `.ics`.
11. **Pengaturan & Cadangan Data**:
    - Mode Gelap / Mode Terang.
    - Kelola kategori kustom (pilih ikon & warna).
    - Cadangan lengkap & Pemulihan (Ekspor / Impor JSON).
    - Hapus seluruh data dengan konfirmasi ganda.

---

## 🛠️ Konfigurasi API AI (Gratis)

Aplikasi menggunakan dua penyedia API gratis untuk backend proxy:

1. **OCR Struk**: [z.ai](https://api.z.ai/) model `glm-4.6v-flash`
   - Dapatkan API Key gratis di dashboard z.ai.
2. **Konsultasi Keuangan**: [OpenRouter](https://openrouter.ai/) model `openrouter/free`
   - Dapatkan API Key gratis di dashboard OpenRouter.

### Pengaturan Variabel Lingkungan (`.env`)

Buat atau sunting file `.env` di direktori proyek:

```env
# SUPABASE AUTH: Autentikasi akun pengguna (Email & Kata Sandi)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"

# API Key z.ai untuk OCR Struk GLM-4.6V-Flash (Backend only)
ZAI_API_KEY="kunci_api_z_ai_anda"

# API Key OpenRouter untuk Konsultasi AI gratis (Backend only)
OPENROUTER_API_KEY="kunci_api_openrouter_anda"

# (Opsional) Port server jika ingin disesuaikan (default: 3000)
PORT=3000
```

### Alur Autentikasi Supabase:
- **Online saat Login / Registrasi**: Pengguna wajib online saat mendaftar akun (`signUp`) atau masuk pertama kali (`signInWithPassword`).
- **Offline Setelahnya**: Supabase menyimpan sesi di `localStorage`. Saat membuka kembali aplikasi, sesi langsung dipulihkan secara offline sehingga pengguna langsung masuk ke Beranda tanpa perlu internet.
- **Penyimpanan Lokal**: Supabase HANYA digunakan untuk autentikasi identitas akun (`userId`). Seluruh data transaksi, kategori, anggaran, dan tabungan TETAP disimpan secara lokal di IndexedDB (Dexie.js).
- **Mode Demo Offline**: Tersedia tombol cepat untuk menguji seluruh fitur offline tanpa registrasi Supabase.

---

## 🚀 Cara Menjalankan

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Mode Pengembangan (Development)
Menjalankan server Express terintegrasi dengan Vite middleware:
```bash
npm run dev
```
Akses aplikasi melalui browser di `http://localhost:3000`.

### 3. Mode Produksi (Production)
```bash
npm run build
npm start
```
Atau jika menggunakan Node.js langsung:
```bash
node server.ts
# atau dengan tsx:
npx tsx server.ts
```

---

## 📂 Struktur Proyek
- `/server.ts` - Node.js Express backend proxy untuk API OCR & Konsultasi AI
- `/src/db/index.ts` - Skema Dexie.js (IndexedDB) & data inisialisasi default
- `/src/pages/` - Halaman utama: Beranda, Transaksi, RekapBulanan, Kalender, ScanStruk, Konsultasi, Anggaran, Tabungan, Tagihan, Pengaturan
- `/src/components/` - Komponen modular: CategoryIcon, TransactionModal, dll.
- `/src/context/` - ToastContext & ThemeContext
- `/src/utils/format.ts` - Format Rupiah, tanggal Indonesia, ekspor CSV, dan ekspor kalender .ics
