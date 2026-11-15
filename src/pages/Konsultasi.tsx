import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  RefreshCw,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import { db, Category } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
}

export const Konsultasi: React.FC = () => {
  const { showToast } = useToast();
  const { userId } = useAuth();

  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const allSavingsGoals = useLiveQuery(() => db.savingsGoals.toArray()) || [];
  const allRecurringBills = useLiveQuery(() => db.recurringBills.toArray()) || [];
  const allWallets = useLiveQuery(() => db.wallets.toArray()) || [];

  const transactions = useMemo(
    () => allTransactions.filter((t) => t.userId === userId),
    [allTransactions, userId]
  );

  const savingsGoals = useMemo(
    () => allSavingsGoals.filter((g) => g.userId === userId),
    [allSavingsGoals, userId]
  );

  const recurringBills = useMemo(
    () => allRecurringBills.filter((b) => b.userId === userId),
    [allRecurringBills, userId]
  );

  const wallets = useMemo(
    () => allWallets.filter((w) => w.userId === userId),
    [allWallets, userId]
  );

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Halo! Saya Uangku AI, asisten keuangan pribadi Anda. Saya dapat membantu menganalisis pengeluaran, tabungan, dan tagihan Anda. Apa yang ingin Anda tanyakan hari ini?',
      timestamp: Date.now(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Compute 3-Month Financial Snapshot from IndexedDB
  const financialSummary = useMemo(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();

    const last3MonthKeys: string[] = [];
    for (let i = 0; i < 3; i++) {
      let m = currMonth - i;
      let y = currYear;
      if (m < 0) {
        m += 12;
        y -= 1;
      }
      last3MonthKeys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    }

    const currentMonthKey = last3MonthKeys[0];

    let totalIncome3Months = 0;
    let totalExpense3Months = 0;
    let currentMonthIncome = 0;
    let currentMonthExpense = 0;

    const catExpenseMap = new Map<number, number>();

    transactions.forEach((t) => {
      const ym = t.date.substring(0, 7);
      if (last3MonthKeys.includes(ym)) {
        if (t.type === 'income') {
          totalIncome3Months += t.amount;
        } else {
          totalExpense3Months += t.amount;
          const cur = catExpenseMap.get(t.categoryId) || 0;
          catExpenseMap.set(t.categoryId, cur + t.amount);
        }
      }

      if (ym === currentMonthKey) {
        if (t.type === 'income') currentMonthIncome += t.amount;
        else currentMonthExpense += t.amount;
      }
    });

    const categoryMap = new Map<number, Category>();
    categories.forEach((c) => {
      if (c.id) categoryMap.set(c.id, c);
    });

    const topExpenseCategories = Array.from(catExpenseMap.entries())
      .map(([catId, amount]) => ({
        name: categoryMap.get(catId)?.name || 'Lainnya',
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    const savingsGoalsStatus = savingsGoals.map((g) => ({
      name: g.name,
      savedAmount: g.savedAmount,
      targetAmount: g.targetAmount,
      percentage: Math.round((g.savedAmount / (g.targetAmount || 1)) * 100),
    }));

    const upcomingBills = recurringBills.slice(0, 4).map((b) => ({
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
    }));

    const totalWalletBalance = wallets.reduce((acc, w) => acc + (w.balance || 0), 0);

    return {
      totalIncome3Months,
      totalExpense3Months,
      netSavings3Months: totalIncome3Months - totalExpense3Months,
      currentMonthIncome,
      currentMonthExpense,
      totalWalletBalance,
      topExpenseCategories,
      savingsGoalsStatus,
      upcomingBills,
    };
  }, [transactions, categories, savingsGoals, recurringBills, wallets]);

  const suggestedPrompts = [
    'Evaluasi pengeluaran 3 bulan terakhir saya',
    'Tips memangkas pengeluaran terbesar',
    'Apakah target tabungan saya realistis?',
    'Strategi alokasi gaji bulanan',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setErrorBanner(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineMsg = 'Fitur konsultasi AI memerlukan koneksi internet aktif.';
      setErrorBanner(offlineMsg);
      showToast(offlineMsg, 'error');
      return;
    }

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const nextHistory = [...messages.slice(-6), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextHistory.slice(0, -1),
          financialSummary,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal menerima tanggapan dari asisten AI.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: data.reply,
          timestamp: Date.now(),
        },
      ]);
    } catch (err: any) {
      console.error('Consultation error:', err);
      const isNetworkErr =
        err.message?.includes('fetch') || err.message?.includes('Failed to fetch');
      const errMsg = isNetworkErr
        ? 'Tidak dapat terhubung ke server AI. Periksa koneksi internet Anda.'
        : err.message || 'Terjadi kesalahan saat menghubungi layanan AI.';

      setErrorBanner(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `Maaf, permintaan tidak dapat diproses saat ini: ${errMsg}`,
          timestamp: Date.now(),
        },
      ]);
      showToast('Gagal menghubungi Konsultan AI', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-10.5rem)] lg:h-[calc(100dvh-7.5rem)] w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
              Konsultasi Keuangan AI
            </h1>
            <p className="text-xs text-slate-400 truncate">
              Analisis cerdas berdasarkan pembukuan Anda
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg shrink-0">
          <span>Net 3 Bln:</span>
          <span
            className={`font-bold ${
              financialSummary.netSavings3Months >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatRupiah(financialSummary.netSavings3Months)}
          </span>
        </div>
      </div>

      {/* Compact Yellow Disclaimer Banner */}
      <div className="p-3 my-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center gap-2 shrink-0 text-xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Perhatian:</strong> Ini saran edukasi AI, bukan nasihat keuangan berlisensi.
        </span>
      </div>

      {/* Error Alert Banner if failed */}
      {errorBanner && (
        <div className="p-3 mb-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 shrink-0 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{errorBanner}</span>
        </div>
      )}

      {/* WhatsApp-style Chat Messages Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 rounded-2xl bg-slate-100/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const timeStr = new Date(m.timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[82%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-bl-sm whitespace-pre-line'
                }`}
              >
                <p>{m.content}</p>
                <p
                  className={`text-[10px] mt-1 text-right ${
                    isUser ? 'text-emerald-100/80' : 'text-slate-400'
                  }`}
                >
                  {timeStr}
                </p>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-full bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Uangku AI sedang mengetik...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 shrink-0 no-scrollbar">
        {suggestedPrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isLoading}
            onClick={() => handleSendMessage(p)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium whitespace-nowrap transition-colors border border-slate-200 dark:border-slate-700 shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Side-by-side Input & Send Button cleanly aligned above bottom nav */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 pt-1 pb-2 shrink-0"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
          placeholder="Ketik pertanyaan keuangan..."
          className="flex-1 min-w-0 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-xs"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || isLoading}
          aria-label="Kirim Pesan"
          className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
