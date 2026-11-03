import { Transaction, Category } from '../db';

/**
 * Format numbers as Indonesian Rupiah (e.g. Rp 150.000)
 */
export function formatRupiah(value: number): string {
  if (isNaN(value)) return 'Rp 0';
  const isNegative = value < 0;
  const absVal = Math.abs(Math.round(value));
  const formatted = new Intl.NumberFormat('id-ID').format(absVal);
  return `${isNegative ? '-Rp ' : 'Rp '}${formatted}`;
}

/**
 * Format date string (YYYY-MM-DD) to friendly Indonesian format
 */
export function formatDateIndo(dateStr: string, options?: { showDay?: boolean }): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

    const dayName = options?.showDay !== false
      ? ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()] + ', '
      : '';

    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return `${dayName}${parts[2]} ${months[Number(parts[1]) - 1]} ${parts[0]}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format YYYY-MM into Indonesian Month and Year (e.g. 'November 2026')
 */
export function formatMonthIndo(yearMonth: string): string {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-');
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const mIndex = Number(month) - 1;
  return `${months[mIndex] || month} ${year}`;
}

/**
 * Calculate difference in days from today to a target date
 */
export function getDaysLeft(deadlineStr: string): number {
  if (!deadlineStr) return 0;
  const [year, month, day] = deadlineStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Safely calculate percentage change between current and previous numbers (prevents div by 0)
 */
export function calculatePercentageChange(
  current: number,
  previous: number
): { percent: number; isIncrease: boolean; isNew: boolean } {
  if (previous === 0) {
    if (current === 0) return { percent: 0, isIncrease: false, isNew: false };
    return { percent: 100, isIncrease: true, isNew: true };
  }
  const diff = current - previous;
  const percent = Math.abs((diff / previous) * 100);
  return {
    percent: Math.round(percent * 10) / 10,
    isIncrease: diff >= 0,
    isNew: false,
  };
}

/**
 * Export transactions to standard CSV with UTF-8 BOM for Excel compatibility
 */
export function exportToCsv(transactions: Transaction[], categories: Category[], filename = 'dompetku-transaksi.csv') {
  const catMap = new Map<number, string>();
  categories.forEach((c) => {
    if (c.id) catMap.set(c.id, c.name);
  });

  const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Nominal (Rp)', 'Catatan', 'Waktu Dibuat'];
  const rows = transactions.map((t) => [
    t.id || '',
    t.date,
    t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    `"${(catMap.get(t.categoryId) || 'Lainnya').replace(/"/g, '""')}"`,
    t.amount,
    `"${(t.note || '').replace(/"/g, '""')}"`,
    new Date(t.createdAt).toLocaleString('id-ID'),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download an iCalendar (.ics) file for reminders
 */
export function generateIcsFile(
  title: string,
  targetDate: string,
  description: string,
  filename = 'pengingat.ics'
) {
  // Format date to YYYYMMDD
  const dateFormatted = targetDate.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `dompetku-${Date.now()}@dompetku.app`;

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//DompetKu//Catatan Keuangan Pribadi//ID
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART;VALUE=DATE:${dateFormatted}
DTEND;VALUE=DATE:${dateFormatted}
SUMMARY:${title}
DESCRIPTION:${description}
STATUS:CONFIRMED
BEGIN:VALARM
TRIGGER:-PT9H
ACTION:DISPLAY
DESCRIPTION:Pengingat: ${title}
END:VALARM
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
