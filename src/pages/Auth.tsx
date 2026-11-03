import React, { useState } from 'react';
import {
  Wallet,
  Lock,
  User as UserIcon,
  Mail,
  ArrowRight,
  ShieldCheck,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  AtSign,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isSupabaseConfigured } from '../lib/supabase';

export const AuthPage: React.FC = () => {
  const { signIn, signUp, loginAsDemoUser, isOnline } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form states (Minimalist: identifier & password & rememberMe)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register form states
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    // Online verification
    if (!navigator.onLine) {
      const msg = 'Proses ini memerlukan koneksi internet.';
      setErrorMessage(msg);
      showToast(msg, 'error');
      return;
    }

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Harap isi Email atau Username dan kata sandi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn(identifier.trim(), password, rememberMe);
      if (!res.success) {
        setErrorMessage(res.error || 'Gagal masuk akun.');
        showToast(res.error || 'Gagal masuk akun.', 'error');
      } else {
        showToast('Selamat datang kembali di DompetKu!', 'success');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (!navigator.onLine) {
      const msg = 'Proses ini memerlukan koneksi internet.';
      setErrorMessage(msg);
      showToast(msg, 'error');
      return;
    }

    if (!regEmail.trim() || !regUsername.trim() || !regPassword.trim()) {
      setErrorMessage('Harap lengkapi semua kolom pendaftaran.');
      return;
    }

    // Clean username validation (letters, numbers, underscores)
    const cleanUser = regUsername.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUser)) {
      setErrorMessage('Username harus 3-20 karakter alfanumerik (huruf, angka, atau underscore).');
      return;
    }

    if (regPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Kata sandi minimal 6 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUp(regEmail.trim(), regPassword, cleanUser);
      if (!res.success) {
        setErrorMessage(res.error || 'Gagal mendaftar.');
        showToast(res.error || 'Gagal mendaftar.', 'error');
      } else {
        if (res.requireEmailConfirmation) {
          setSuccessNotice(
            'Pendaftaran berhasil! Tautan konfirmasi telah dikirim ke email Anda. Silakan periksa inbox/spam email Anda.'
          );
          showToast('Pendaftaran berhasil! Periksa email konfirmasi.', 'success');
        } else {
          showToast('Akun berhasil dibuat! Selamat datang di DompetKu.', 'success');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4 py-8 sm:px-6">
      {/* Brand Header */}
      <div className="w-full max-w-sm text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-700/20 mb-3">
          <Wallet className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Dompet<span className="text-emerald-600 dark:text-emerald-400">Ku</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Pencatat Keuangan Pribadi Offline-First
        </p>

        {/* Network status badge */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-3xs font-bold">
          {isOnline ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Wifi className="w-3 h-3 text-emerald-600" />
              Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <WifiOff className="w-3 h-3 text-rose-600" />
              Offline (Registrasi & Login Butuh Internet)
            </span>
          )}
        </div>
      </div>

      {/* Main Minimalist Auth Card */}
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 space-y-5">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Daftar Akun
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="leading-relaxed">{successNotice}</span>
          </div>
        )}

        {/* 1. MINIMALIST LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Input 1: Email atau Username */}
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Email atau Username
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="nama@email.com atau nama_pengguna"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Input 2: Kata Sandi */}
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Checkbox: Ingat Saya (Remember Me) */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ingat Saya
                </span>
              </label>
              <span className="text-3xs text-slate-400">
                {rememberMe ? 'Sesi tetap tersimpan' : 'Keluar saat browser ditutup'}
              </span>
            </div>

            {/* Tombol Masuk */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Memproses...</span>
              ) : (
                <>
                  <span>Masuk ke DompetKu</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Helper Text as requested in Requirement 3 */}
            <p className="text-xs text-slate-400 text-center leading-relaxed pt-1">
              Jika Anda sudah pernah mendaftar di perangkat ini, cukup masukkan Username dan Password Anda.
            </p>
          </form>
        )}

        {/* 2. REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Username / Nama Pengguna
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="contoh: budi_santoso"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-3xs text-slate-400 mt-0.5">
                Gunakan untuk login cepat tanpa mengetik email.
              </p>
            </div>

            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Ulangi Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <span>Mendaftarkan...</span> : <span>Daftar Akun Baru</span>}
            </button>
          </form>
        )}

        {/* Offline Demo Access Button */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            type="button"
            onClick={() => loginAsDemoUser('demo_user')}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Coba Mode Demo Lokal (Tanpa Akun)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
