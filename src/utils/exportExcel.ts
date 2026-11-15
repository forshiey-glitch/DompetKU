import XLSX from 'xlsx-js-style';
import { Transaction, Category, Wallet } from '../db';
import { formatMonthIndo } from './format';

interface ExportExcelParams {
  transactions: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  periodLabel?: string;
  yearMonth?: string; // e.g. '2026-11' for filename Laporan_Uangku_[Bulan_Tahun].xlsx
}

const BORDER_THIN = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '1E3A8A' } }, // Dark Blue
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_THIN,
};

const TITLE_STYLE = {
  font: { bold: true, color: { rgb: '0F172A' }, sz: 14 },
};

const SUBTITLE_STYLE = {
  font: { italic: true, color: { rgb: '475569' }, sz: 10 },
};

const ZEBRA_EVEN_FILL = { fgColor: { rgb: 'EFF6FF' } }; // Soft pastel blue
const ZEBRA_ODD_FILL = { fgColor: { rgb: 'FFFFFF' } };

export function exportToExcel({
  transactions,
  categories,
  wallets,
  periodLabel,
  yearMonth,
}: ExportExcelParams): string {
  const catMap = new Map<number, Category>();
  categories.forEach((c) => {
    if (c.id) catMap.set(c.id, c);
  });

  const walletMap = new Map<number, Wallet>();
  wallets.forEach((w) => {
    if (w.id) walletMap.set(w.id, w);
  });

  const now = new Date();
  const targetYm =
    yearMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthYearText = formatMonthIndo(targetYm).replace(/\s+/g, '_');
  const displayPeriod = periodLabel || formatMonthIndo(targetYm);
  const filename = `Laporan_Uangku_${monthYearText}.xlsx`;

  // Compute Totals
  let totalIncome = 0;
  let totalExpense = 0;
  const catExpenseMap = new Map<number, number>();

  transactions.forEach((t) => {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
      catExpenseMap.set(t.categoryId, (catExpenseMap.get(t.categoryId) || 0) + t.amount);
    }
  });

  const netBalance = totalIncome - totalExpense;
  const totalWalletBalance = wallets.reduce((acc, w) => acc + (w.balance || 0), 0);

  const wb = XLSX.utils.book_new();

  // =========================================================
  // SHEET 1: Ringkasan
  // =========================================================
  const summaryRows: any[][] = [
    [{ v: 'LAPORAN KEUANGAN UANGKU', s: TITLE_STYLE }],
    [{ v: `Periode: ${displayPeriod}`, s: SUBTITLE_STYLE }],
    [],
    [
      { v: 'Keterangan', s: HEADER_STYLE },
      { v: 'Nominal (Rp)', s: HEADER_STYLE },
      { v: 'Catatan', s: HEADER_STYLE },
    ],
    [
      {
        v: 'Total Pemasukan',
        s: {
          font: { bold: true, color: { rgb: '166534' } },
          fill: { fgColor: { rgb: 'DCFCE7' } }, // Green background
          border: BORDER_THIN,
        },
      },
      {
        v: totalIncome,
        t: 'n',
        z: '#,##0',
        s: {
          font: { bold: true, color: { rgb: '166534' } },
          fill: { fgColor: { rgb: 'DCFCE7' } }, // Green background
          alignment: { horizontal: 'right' },
          border: BORDER_THIN,
        },
      },
      {
        v: `${transactions.filter((t) => t.type === 'income').length} transaksi pemasukan`,
        s: {
          font: { color: { rgb: '166534' } },
          fill: { fgColor: { rgb: 'DCFCE7' } },
          border: BORDER_THIN,
        },
      },
    ],
    [
      {
        v: 'Total Pengeluaran',
        s: {
          font: { bold: true, color: { rgb: '991B1B' } },
          fill: { fgColor: { rgb: 'FEE2E2' } }, // Red background
          border: BORDER_THIN,
        },
      },
      {
        v: totalExpense,
        t: 'n',
        z: '#,##0',
        s: {
          font: { bold: true, color: { rgb: '991B1B' } },
          fill: { fgColor: { rgb: 'FEE2E2' } }, // Red background
          alignment: { horizontal: 'right' },
          border: BORDER_THIN,
        },
      },
      {
        v: `${transactions.filter((t) => t.type === 'expense').length} transaksi pengeluaran`,
        s: {
          font: { color: { rgb: '991B1B' } },
          fill: { fgColor: { rgb: 'FEE2E2' } },
          border: BORDER_THIN,
        },
      },
    ],
    [
      {
        v: 'Saldo (Selisih Kas)',
        s: {
          font: { bold: true, color: { rgb: '1E3A8A' } },
          fill: { fgColor: { rgb: 'DBEAFE' } },
          border: BORDER_THIN,
        },
      },
      {
        v: netBalance,
        t: 'n',
        z: '#,##0',
        s: {
          font: { bold: true, color: { rgb: netBalance >= 0 ? '166534' : '991B1B' } },
          fill: { fgColor: { rgb: 'DBEAFE' } },
          alignment: { horizontal: 'right' },
          border: BORDER_THIN,
        },
      },
      {
        v: netBalance >= 0 ? 'Surplus' : 'Defisit',
        s: {
          font: { bold: true, color: { rgb: '1E3A8A' } },
          fill: { fgColor: { rgb: 'DBEAFE' } },
          border: BORDER_THIN,
        },
      },
    ],
    [
      {
        v: 'Total Saldo Semua Dompet Saat Ini',
        s: {
          font: { bold: true, color: { rgb: '334155' } },
          fill: { fgColor: { rgb: 'FEF3C7' } }, // Soft pastel yellow
          border: BORDER_THIN,
        },
      },
      {
        v: totalWalletBalance,
        t: 'n',
        z: '#,##0',
        s: {
          font: { bold: true, color: { rgb: '334155' } },
          fill: { fgColor: { rgb: 'FEF3C7' } },
          alignment: { horizontal: 'right' },
          border: BORDER_THIN,
        },
      },
      {
        v: `${wallets.length} dompet aktif`,
        s: {
          font: { color: { rgb: '334155' } },
          fill: { fgColor: { rgb: 'FEF3C7' } },
          border: BORDER_THIN,
        },
      },
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 30 }];
  wsSummary['!rows'] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 10 }, { hpt: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // =========================================================
  // SHEET 2: Daftar Transaksi
  // Columns: Tanggal, Kategori, Tipe, Nominal, Catatan, Dompet
  // =========================================================
  const sortedTxs = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const txHeader = ['Tanggal', 'Kategori', 'Tipe', 'Nominal', 'Catatan', 'Dompet'].map((h) => ({
    v: h,
    s: HEADER_STYLE,
  }));

  const txRows = sortedTxs.map((t, idx) => {
    const fill = idx % 2 === 0 ? ZEBRA_ODD_FILL : ZEBRA_EVEN_FILL;
    const isIncome = t.type === 'income';
    const catName = catMap.get(t.categoryId)?.name || 'Lainnya';
    const walletName = t.walletId ? walletMap.get(t.walletId)?.name || '-' : '-';

    return [
      { v: t.date, s: { fill, border: BORDER_THIN, alignment: { horizontal: 'center' } } },
      { v: catName, s: { fill, border: BORDER_THIN } },
      {
        v: isIncome ? 'Pemasukan' : 'Pengeluaran',
        s: {
          fill,
          border: BORDER_THIN,
          font: { bold: true, color: { rgb: isIncome ? '15803D' : 'B91C1C' } },
          alignment: { horizontal: 'center' },
        },
      },
      {
        v: t.amount,
        t: 'n',
        z: '#,##0',
        s: {
          fill,
          border: BORDER_THIN,
          font: { bold: true, color: { rgb: isIncome ? '15803D' : '0F172A' } },
          alignment: { horizontal: 'right' },
        },
      },
      { v: t.note || '-', s: { fill, border: BORDER_THIN } },
      { v: walletName, s: { fill, border: BORDER_THIN } },
    ];
  });

  const wsTransactions = XLSX.utils.aoa_to_sheet([txHeader, ...txRows]);
  wsTransactions['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 15 },
    { wch: 18 },
    { wch: 36 },
    { wch: 18 },
  ];
  wsTransactions['!rows'] = [{ hpt: 24 }];
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Daftar Transaksi');

  // =========================================================
  // SHEET 3: Rekap Kategori
  // =========================================================
  const categoryBreakdown = Array.from(catExpenseMap.entries())
    .map(([catId, amount]) => {
      const cat = catMap.get(catId);
      const pct = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      return {
        name: cat?.name || 'Lainnya',
        amount,
        percentage: Math.round(pct * 10) / 10,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const catHeader = ['Kategori', 'Total Pengeluaran (Rp)', 'Persentase (%)'].map((h) => ({
    v: h,
    s: HEADER_STYLE,
  }));

  const catRows = categoryBreakdown.map((item, idx) => {
    const fill = idx % 2 === 0 ? ZEBRA_ODD_FILL : { fgColor: { rgb: 'F5F3FF' } }; // Soft pastel lavender zebra
    return [
      { v: item.name, s: { fill, border: BORDER_THIN, font: { bold: true } } },
      {
        v: item.amount,
        t: 'n',
        z: '#,##0',
        s: { fill, border: BORDER_THIN, alignment: { horizontal: 'right' } },
      },
      {
        v: item.percentage / 100,
        t: 'n',
        z: '0.0%',
        s: { fill, border: BORDER_THIN, alignment: { horizontal: 'right' } },
      },
    ];
  });

  const catTotalRow = [
    {
      v: 'TOTAL PENGELUARAN',
      s: {
        font: { bold: true, color: { rgb: '1E3A8A' } },
        fill: { fgColor: { rgb: 'DBEAFE' } },
        border: BORDER_THIN,
      },
    },
    {
      v: totalExpense,
      t: 'n',
      z: '#,##0',
      s: {
        font: { bold: true, color: { rgb: '1E3A8A' } },
        fill: { fgColor: { rgb: 'DBEAFE' } },
        alignment: { horizontal: 'right' },
        border: BORDER_THIN,
      },
    },
    {
      v: categoryBreakdown.length > 0 ? 1 : 0,
      t: 'n',
      z: '0.0%',
      s: {
        font: { bold: true, color: { rgb: '1E3A8A' } },
        fill: { fgColor: { rgb: 'DBEAFE' } },
        alignment: { horizontal: 'right' },
        border: BORDER_THIN,
      },
    },
  ];

  const wsCategoryRecap = XLSX.utils.aoa_to_sheet([catHeader, ...catRows, catTotalRow]);
  wsCategoryRecap['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 18 }];
  wsCategoryRecap['!rows'] = [{ hpt: 24 }];
  XLSX.utils.book_append_sheet(wb, wsCategoryRecap, 'Rekap Kategori');

  XLSX.writeFile(wb, filename);
  return filename;
}
