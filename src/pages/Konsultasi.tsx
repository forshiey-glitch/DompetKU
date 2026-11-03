import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';
import { db, Transaction, Category, SavingsGoal, RecurringBill } from '../db';
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

  const transactions = useMemo(() => {
    return allTransactions.filter((t) => !t.userId || t.userId === userId || t.userId === 'default-user');
  }, [allTransactions, userId]);

  const savingsGoals = useMemo(() => {
    return allSavingsGoals.filter((g) => !g.userId || g.userId === userId || g.userId === 'default-user');
  }, [allSavingsGoals, userId]);

  const recurringBills = useMemo(() => {
    return allRecurringBills.filter((b) => !b.userId || b.userId === userId || b.userId === 'default-user');
  }, [allRecurringBills, userId]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Halo! Saya **DompetKu AI**, asisten konsultasi keuangan pribadi Anda. Saya telah mempelajari ringkasan pemasukan, pengeluaran, target tabungan, dan tagihan Anda di aplikasi ini. Apa yang ingin Anda diskusikan hari ini?',
      timestamp: Date.now(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Compute 3-Month Financial Snapshot from IndexedDB
  const financialSummary = useMemo(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth(); // 0-indexed

    // Calculate last 3 months keys
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

    // Top categories
    const topExpenseCategories = Array.from(catExpenseMap.entries())
      .map(([catId, amount]) => ({
        name: categoryMap.get(catId)?.name || 'Lainnya',
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    // Savings goals status
    const savingsGoalsStatus = savingsGoals.map((g) => ({
      name: g.name,
      savedAmount: g.savedAmount,
      targetAmount: g.targetAmount,
      percentage: Math.round((g.savedAmount / (g.targetAmount || 1)) * 100),
    }));

    // Upcoming bills
    const upcomingBills = recurringBills.slice(0, 4).map((b) => ({
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
    }));

    return {
      totalIncome3Months,
      totalExpense3Months,
      netSavings3Months: totalIncome3Months - totalExpense3Months,
      currentMonthIncome,
      currentMonthExpense,
      topExpenseCategories,
      savingsGoalsStatus,
      upcomingBills,
    };
  }, [transactions, categories, savingsGoals, recurringBills]);

  // Suggested prompt chips
  const suggestedPrompts = [
    'Bagaimana evaluasi pengeluaran 3 bulan terakhir saya?',
    'Tips memangkas pos pengeluaran terbesar saya saat ini?',
    'Apakah target tabungan saya sudah realistis?',
    'Bantu susun strategi alokasi gaji bulanan yang seimbang',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    // Check offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Fitur konsultasi AI memerlukan koneksi internet', 'error');
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'assistant',
          content: '⚠️ Anda sedang offline. Fitur konsultasi AI memerlukan koneksi internet untuk terhubung ke model OpenRouter.',
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-5).map((m) => ({
            role: m.role,
            content: m.content,
          })),
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
      const isNetworkErr = err.message.includes('fetch') || err.message.includes('Failed to fetch');
      const errorReply = isNetworkErr
        ? '⚠️ Fitur ini memerlukan koneksi internet. Gagal menghubungi server proxy AI.'
        : `⚠️ Maaf, terjadi kesalahan: ${err.message}. Pastikan OPENROUTER_API_KEY telah dikonfigurasi di file .env.`;

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: errorReply,
          timestamp: Date.now(),
        },
      ]);
      showToast('Gagal menghubungi AI Konsultan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-4xl mx-auto pb-20 sm:pb-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Konsultasi Keuangan AI
              <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                OpenRouter Free
              </span>
            </h1>
            <p className="text-2xs text-slate-400">
              Analisis cerdas berdasarkan data pembukuan nyata Anda
            </p>
          </div>
        </div>

        {/* Financial Context Pill */}
        <div className="hidden sm:flex items-center gap-2 text-2xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
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

      {/* Professional Advice Disclaimer Banner */}
      <div className="py-2 px-3 my-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center gap-2 shrink-0 text-2xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="font-medium">
          <strong>Perhatian:</strong> Ini bukan saran keuangan profesional berlisensi. Gunakan rekomendasi AI ini sebagai bahan pertimbangan dan edukasi keuangan pribadi Anda.
        </span>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs my-1">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white ${
                  isUser
                    ? 'bg-slate-700 dark:bg-slate-600'
                    : 'bg-emerald-600 shadow-sm'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 rounded-tl-none whitespace-pre-line'
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-tl-none flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>DompetKu AI sedang memikirkan solusi keuangan Anda...</span>
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
            disabled={isLoading}
            onClick={() => handleSendMessage(p)}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-2xs font-medium whitespace-nowrap transition-colors border border-slate-200 dark:border-slate-700 shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="flex items-center gap-2 pt-1 shrink-0">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          disabled={isLoading}
          placeholder="Tanyakan analisis keuangan, tips hemat, atau saran tabungan..."
          className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-xs"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isLoading}
          className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-all shadow-md shadow-emerald-600/20"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
