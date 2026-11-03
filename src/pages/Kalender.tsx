import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Download,
  Wallet,
  Clock,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { db, Transaction, Category, SavingsGoal, RecurringBill } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatRupiah, formatDateIndo, formatMonthIndo, generateIcsFile } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface KalenderProps {
  onOpenAddModal: (initialData?: Partial<Transaction>) => void;
}

export const Kalender: React.FC<KalenderProps> = ({ onOpenAddModal }) => {
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

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Category lookup
  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((c) => {
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [categories]);

  // Navigate month
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(todayStr);
  };

  // Calendar dates computation
  const { calendarDays, monthYearLabel } = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Day of week for first day (0 = Sunday, 1 = Monday, ...)
    const startDayIndex = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    // Previous month filling
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // Leading days from previous month
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevM = currentMonth === 0 ? 12 : currentMonth;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Trailing days to finish the grid (multiple of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = currentMonth === 11 ? 1 : currentMonth + 2;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    const monthYearLabel = formatMonthIndo(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);
    return { calendarDays: days, monthYearLabel };
  }, [currentYear, currentMonth, todayStr]);

  // Aggregate events per date: transactions, savings deadlines, recurring bill due days
  const eventsByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        hasIncome: boolean;
        hasExpense: boolean;
        totalExpense: number;
        totalIncome: number;
        savingsDeadlines: SavingsGoal[];
        recurringBillsDue: RecurringBill[];
      }
    >();

    transactions.forEach((t) => {
      const cur = map.get(t.date) || {
        hasIncome: false,
        hasExpense: false,
        totalExpense: 0,
        totalIncome: 0,
        savingsDeadlines: [],
        recurringBillsDue: [],
      };
      if (t.type === 'income') {
        cur.hasIncome = true;
        cur.totalIncome += t.amount;
      } else {
        cur.hasExpense = true;
        cur.totalExpense += t.amount;
      }
      map.set(t.date, cur);
    });

    // Savings goals deadlines
    savingsGoals.forEach((goal) => {
      if (goal.deadline) {
        const cur = map.get(goal.deadline) || {
          hasIncome: false,
          hasExpense: false,
          totalExpense: 0,
          totalIncome: 0,
          savingsDeadlines: [],
          recurringBillsDue: [],
        };
        cur.savingsDeadlines.push(goal);
        map.set(goal.deadline, cur);
      }
    });

    // Recurring bills due day (applied to current displayed month)
    recurringBills.forEach((bill) => {
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(bill.dueDay).padStart(2, '0')}`;
      const cur = map.get(currentMonthStr) || {
        hasIncome: false,
        hasExpense: false,
        totalExpense: 0,
        totalIncome: 0,
        savingsDeadlines: [],
        recurringBillsDue: [],
      };
      cur.recurringBillsDue.push(bill);
      map.set(currentMonthStr, cur);
    });

    return map;
  }, [transactions, savingsGoals, recurringBills, currentYear, currentMonth]);

  // Selected date details
  const selectedDateEvents = useMemo(() => {
    const items = transactions.filter((t) => t.date === selectedDate);
    const daySavings = savingsGoals.filter((g) => g.deadline === selectedDate);
    const dayNumber = Number(selectedDate.split('-')[2]);
    const dayBills = recurringBills.filter((b) => b.dueDay === dayNumber);

    const totalIncome = items.filter((i) => i.type === 'income').reduce((a, b) => a + b.amount, 0);
    const totalExpense = items.filter((i) => i.type === 'expense').reduce((a, b) => a + b.amount, 0);

    return {
      transactions: items,
      savings: daySavings,
      bills: dayBills,
      totalIncome,
      totalExpense,
    };
  }, [transactions, savingsGoals, recurringBills, selectedDate]);

  // Export .ics reminder for selected date or all recurring bills
  const handleExportIcs = () => {
    if (selectedDateEvents.bills.length > 0) {
      const bill = selectedDateEvents.bills[0];
      generateIcsFile(
        `Jatuh Tempo Tagihan: ${bill.name}`,
        selectedDate,
        `Ingat bayar tagihan ${bill.name} sebesar ${formatRupiah(bill.amount)}.`,
        `tagihan-${bill.name.toLowerCase().replace(/\s+/g, '-')}.ics`
      );
      showToast(`Pengingat .ics untuk "${bill.name}" berhasil diunduh`, 'success');
      return;
    }

    if (selectedDateEvents.savings.length > 0) {
      const goal = selectedDateEvents.savings[0];
      generateIcsFile(
        `Deadline Target Tabungan: ${goal.name}`,
        selectedDate,
        `Target: ${goal.name} sebesar ${formatRupiah(goal.targetAmount)}.`,
        `target-${goal.name.toLowerCase().replace(/\s+/g, '-')}.ics`
      );
      showToast(`Pengingat .ics untuk "${goal.name}" berhasil diunduh`, 'success');
      return;
    }

    // Default general reminder
    generateIcsFile(
      'Agenda Keuangan DompetKu',
      selectedDate,
      `Agenda keuangan tanggal ${formatDateIndo(selectedDate)}`,
      `agenda-${selectedDate}.ics`
    );
    showToast(`Pengingat .ics tanggal ${selectedDate} diunduh`, 'success');
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-28 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Kalender Keuangan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Jadwal pengeluaran, deadline tabungan, dan jatuh tempo tagihan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGoToday}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            Hari Ini
          </button>

          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-xs">
            <button
              onClick={handlePrevMonth}
              title="Bulan Lalu"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 min-w-28 text-center">
              {monthYearLabel}
            </span>
            <button
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-2xs sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          <span className="text-rose-500">Min</span>
          <span>Sen</span>
          <span>Sel</span>
          <span>Rab</span>
          <span>Kam</span>
          <span>Jum</span>
          <span className="text-blue-500">Sab</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {calendarDays.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            const events = eventsByDate.get(day.dateStr);

            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDate(day.dateStr)}
                className={`relative min-h-14 sm:min-h-18 p-1 sm:p-1.5 rounded-xl flex flex-col justify-between items-center transition-all ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-xs'
                    : day.isToday
                    ? 'bg-slate-100/80 dark:bg-slate-800/80 font-bold'
                    : day.isCurrentMonth
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    : 'text-slate-300 dark:text-slate-700 opacity-40 hover:opacity-70'
                }`}
              >
                {/* Date Number Badge */}
                <span
                  className={`text-xs sm:text-sm font-semibold rounded-full w-6 h-6 flex items-center justify-center ${
                    day.isToday
                      ? 'bg-emerald-600 text-white'
                      : isSelected
                      ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                      : ''
                  }`}
                >
                  {day.dayNumber}
                </span>

                {/* Event Indicators */}
                <div className="flex flex-wrap items-center justify-center gap-1 mt-1 w-full">
                  {events?.hasExpense && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Ada Pengeluaran" />
                  )}
                  {events?.hasIncome && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Ada Pemasukan" />
                  )}
                  {events && events.recurringBillsDue.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Jatuh Tempo Tagihan" />
                  )}
                  {events && events.savingsDeadlines.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Deadline Tabungan" />
                  )}
                </div>

                {/* Subtitle summary for larger screens */}
                {events?.totalExpense ? (
                  <span className="hidden sm:block text-3xs font-medium text-rose-500 truncate max-w-full">
                    -{Math.round(events.totalExpense / 1000)}k
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 text-2xs sm:text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Pengeluaran</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Pemasukan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Jatuh Tempo Tagihan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Deadline Target</span>
          </div>
        </div>
      </div>

      {/* Selected Date Details Panel */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Aktivitas Tanggal Terpilih
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-emerald-600" />
              {formatDateIndo(selectedDate)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportIcs}
              title="Ekspor Pengingat ke Kalender (.ics)"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ekspor .ics</span>
            </button>
            <button
              onClick={() => onOpenAddModal({ date: selectedDate })}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah di Tanggal Ini</span>
            </button>
          </div>
        </div>

        {/* Special reminders: Savings Deadline & Bills Due */}
        {selectedDateEvents.savings.length > 0 && (
          <div className="space-y-2">
            {selectedDateEvents.savings.map((g) => (
              <div
                key={g.id}
                className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Batas Waktu Target Tabungan: {g.name}
                    </p>
                    <p className="text-2xs text-purple-700 dark:text-purple-300">
                      Target: {formatRupiah(g.targetAmount)} • Terkumpul: {formatRupiah(g.savedAmount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedDateEvents.bills.length > 0 && (
          <div className="space-y-2">
            {selectedDateEvents.bills.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Jatuh Tempo Tagihan: {b.name}
                    </p>
                    <p className="text-2xs text-amber-700 dark:text-amber-300">
                      Nominal: {formatRupiah(b.amount)} (Rutin setiap tanggal {b.dueDay})
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transactions list */}
        {selectedDateEvents.transactions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Tidak ada transaksi pada tanggal ini.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium pb-1">
              <span>{selectedDateEvents.transactions.length} Transaksi Tercatat</span>
              <div className="flex items-center gap-3">
                {selectedDateEvents.totalIncome > 0 && (
                  <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{formatRupiah(selectedDateEvents.totalIncome)}
                  </span>
                )}
                {selectedDateEvents.totalExpense > 0 && (
                  <span className="text-rose-600 font-bold flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" /> -{formatRupiah(selectedDateEvents.totalExpense)}
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              {selectedDateEvents.transactions.map((t) => {
                const cat = categoryMap.get(t.categoryId);
                return (
                  <div
                    key={t.id}
                    onClick={() => onOpenAddModal(t)}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat?.color || '#64748b' }}
                      >
                        <CategoryIcon name={cat?.icon || 'MoreHorizontal'} size={15} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {t.note || cat?.name || 'Transaksi'}
                        </p>
                        <p className="text-2xs text-slate-400">{cat?.name}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-bold shrink-0 ${
                        t.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'} {formatRupiah(t.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
