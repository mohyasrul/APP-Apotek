import { useState, useEffect, useCallback } from 'react';
import {
  Book, CalendarBlank, Printer, Download, Pill
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import type { BukuHarianItem, Medicine } from '../lib/types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

type FilterCategory = 'narkotika' | 'psikotropika';

export default function BukuHarianNarkotika() {
  const { profile, effectiveUserId } = useAuth();

  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth());
  const [tahun, setTahun] = useState(now.getFullYear());
  const [category, setCategory] = useState<FilterCategory>('narkotika');
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [entries, setEntries] = useState<BukuHarianItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load medicines list
  useEffect(() => {
    if (!effectiveUserId) return;
    (async () => {
      const { data } = await supabase
        .from('medicines')
        .select('id, name, unit, stock, category')
        .eq('user_id', effectiveUserId)
        .eq('category', category)
        .order('name');
      setMedicines((data as Medicine[]) || []);
      if (data && data.length > 0 && !selectedMedicineId) {
        setSelectedMedicineId(data[0].id);
      }
    })();
  }, [effectiveUserId, category]);

  // Generate daily logbook entries
  const generateLogbook = useCallback(async () => {
    if (!effectiveUserId || !selectedMedicineId) return;
    setLoading(true);
    try {
      const startDate = new Date(tahun, bulan, 1).toISOString();
      const endDate = new Date(tahun, bulan + 1, 0, 23, 59, 59).toISOString();

      const { data: movements, error } = await supabase
        .from('stock_movements')
        .select('id, type, quantity, notes, reference_id, created_at')
        .eq('user_id', effectiveUserId)
        .eq('medicine_id', selectedMedicineId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Build running balance
      const medicine = medicines.find(m => m.id === selectedMedicineId);
      if (!medicine) return;

      // Calculate initial balance at start of period
      let currentStock = medicine.stock;
      // Work backwards from current stock to get saldo awal
      const allMovements = movements || [];
      for (const mov of [...allMovements].reverse()) {
        if (mov.type === 'restock' || mov.type === 'void_return') {
          currentStock -= Math.abs(mov.quantity);
        } else {
          currentStock += Math.abs(mov.quantity);
        }
      }

      // Now build forward with running balance
      let saldo = Math.max(0, currentStock);
      const items: BukuHarianItem[] = allMovements.map(mov => {
        const date = new Date(mov.created_at);
        const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
        let masuk = 0;
        let keluar = 0;
        let keterangan = '';

        if (mov.type === 'restock' || mov.type === 'void_return') {
          masuk = Math.abs(mov.quantity);
          keterangan = mov.type === 'restock' ? 'Penerimaan' : 'Retur void';
        } else if (mov.type === 'sale') {
          keluar = Math.abs(mov.quantity);
          keterangan = 'Penjualan';
        } else if (mov.type === 'adjustment') {
          if (mov.quantity > 0) { masuk = mov.quantity; keterangan = 'Penyesuaian (+)'; }
          else { keluar = Math.abs(mov.quantity); keterangan = 'Penyesuaian (-)'; }
        } else if (mov.type === 'expired_removal') {
          keluar = Math.abs(mov.quantity);
          keterangan = 'Penghapusan kadaluarsa';
        }

        if (mov.notes) keterangan += ` - ${mov.notes}`;

        saldo = saldo + masuk - keluar;
        const noDoc = mov.reference_id
          ? mov.reference_id.substring(0, 12).toUpperCase()
          : mov.id.substring(0, 8).toUpperCase();

        return {
          tanggal: dateStr,
          no_dokumen: noDoc,
          keterangan,
          masuk,
          keluar,
          saldo: Math.max(0, saldo),
        };
      });

      setEntries(items);
    } catch (err) {
      toast.error('Gagal memuat buku harian');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, selectedMedicineId, bulan, tahun, medicines]);

  useEffect(() => {
    if (selectedMedicineId) generateLogbook();
  }, [generateLogbook, selectedMedicineId]);

  const selectedMedicine = medicines.find(m => m.id === selectedMedicineId);

  // Print
  const handlePrint = () => {
    if (entries.length === 0) {
      toast.error('Tidak ada data untuk dicetak');
      return;
    }

    const pharmacyName = escapeHtml(profile?.pharmacy_name || '-');
    const siaNumber = escapeHtml(profile?.sia_number || '-');
    const apotekerName = escapeHtml(profile?.apoteker_name || profile?.full_name || '-');
    const sipaNumber = escapeHtml(profile?.sipa_number || '-');
    const medName = escapeHtml(selectedMedicine?.name || '-');
    const medUnit = escapeHtml(selectedMedicine?.unit || '-');
    const catLabel = category === 'narkotika' ? 'NARKOTIKA' : 'PSIKOTROPIKA';

    const rows = entries.map(e => `
      <tr>
        <td>${escapeHtml(e.tanggal)}</td>
        <td>${escapeHtml(e.no_dokumen)}</td>
        <td>${escapeHtml(e.keterangan)}</td>
        <td style="text-align:right">${e.masuk || '-'}</td>
        <td style="text-align:right">${e.keluar || '-'}</td>
        <td style="text-align:right;font-weight:bold">${e.saldo}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Buku Harian ${catLabel}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12px; padding: 15mm; }
        h2 { text-align: center; margin-bottom: 4px; }
        h3 { text-align: center; margin-top: 2px; color: #555; font-size: 13px; }
        .info td { padding: 2px 8px 2px 0; font-size: 12px; }
        table.report { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.report th, table.report td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
        table.report th { background: #f0f0f0; }
        .sig { margin-top: 40px; display: flex; justify-content: flex-end; }
        .sig-block { text-align: center; min-width: 200px; }
        .sig-block .line { margin-top: 60px; border-top: 1px solid #000; padding-top: 4px; }
        @media print { body { padding: 10mm; } }
      </style>
    </head><body>
      <h2>BUKU HARIAN ${catLabel}</h2>
      <h3>(Per-BPOM No. 4/2018 & PMK 3/2015)</h3>
      <table class="info" style="margin:10px 0">
        <tr><td><b>Apotek</b></td><td>: ${pharmacyName}</td></tr>
        <tr><td><b>No. SIA</b></td><td>: ${siaNumber}</td></tr>
        <tr><td><b>Nama Obat</b></td><td>: ${medName}</td></tr>
        <tr><td><b>Satuan</b></td><td>: ${medUnit}</td></tr>
        <tr><td><b>Periode</b></td><td>: ${MONTHS[bulan]} ${tahun}</td></tr>
      </table>
      <table class="report">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>No. Dokumen</th>
            <th>Keterangan</th>
            <th style="width:60px">Masuk</th>
            <th style="width:60px">Keluar</th>
            <th style="width:60px">Saldo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sig">
        <div class="sig-block">
          <p>Apoteker Penanggung Jawab</p>
          <div class="line">${apotekerName}<br/><small>SIPA: ${sipaNumber}</small></div>
        </div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 400);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (entries.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const medName = selectedMedicine?.name || '-';
    const header = `BUKU HARIAN ${category.toUpperCase()}\nObat: ${medName}\nPeriode: ${MONTHS[bulan]} ${tahun}\n\n`;
    const csvHeader = 'Tanggal,No Dokumen,Keterangan,Masuk,Keluar,Saldo\n';
    const csvRows = entries.map(e =>
      `"${e.tanggal}","${e.no_dokumen}","${e.keterangan}",${e.masuk},${e.keluar},${e.saldo}`
    ).join('\n');

    const blob = new Blob([header + csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BukuHarian_${category}_${medName.replace(/\s/g, '_')}_${MONTHS[bulan]}_${tahun}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('File CSV berhasil diunduh');
  };

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-[1400px] mx-auto w-full pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
            <Book weight="duotone" className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Buku Harian Narkotika/Psikotropika</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Per-BPOM No. 4/2018 & PMK 3/2015</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Category */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => { setCategory('narkotika'); setSelectedMedicineId(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                category === 'narkotika'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Narkotika
            </button>
            <button
              onClick={() => { setCategory('psikotropika'); setSelectedMedicineId(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                category === 'psikotropika'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Psikotropika
            </button>
          </div>

          {/* Medicine select */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">Pilih Obat</label>
            <select
              value={selectedMedicineId}
              onChange={e => setSelectedMedicineId(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">— Pilih obat —</option>
              {medicines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </select>
          </div>

          {/* Period */}
          <div className="flex items-center gap-2">
            <CalendarBlank weight="bold" className="w-4 h-4 text-slate-400" />
            <select
              value={bulan}
              onChange={e => setBulan(Number(e.target.value))}
              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={tahun}
              onChange={e => setTahun(Number(e.target.value))}
              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {[tahun - 1, tahun, tahun + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Actions */}
          <button
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            <Download weight="bold" className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={entries.length === 0}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            <Printer weight="bold" className="w-4 h-4" />
            Cetak
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">
            {selectedMedicine ? selectedMedicine.name : 'Pilih obat untuk melihat buku harian'}
            {selectedMedicine && <span className="text-slate-400 font-normal ml-2">({selectedMedicine.unit})</span>}
          </h3>
          <span className="text-xs text-slate-400">{entries.length} entri</span>
        </div>

        {!selectedMedicineId ? (
          <div className="p-12 text-center">
            <Pill weight="duotone" className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Pilih obat {category} dari dropdown di atas</p>
          </div>
        ) : loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Memuat data...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <Book weight="duotone" className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada pergerakan stok untuk obat ini di bulan {MONTHS[bulan]} {tahun}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Tanggal</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">No. Dokumen</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Keterangan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Masuk</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Keluar</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((entry, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{entry.tanggal}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{entry.no_dokumen}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{entry.keterangan}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                      {entry.masuk > 0 ? `+${entry.masuk}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-medium">
                      {entry.keluar > 0 ? `-${entry.keluar}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">{entry.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">📖 Ketentuan Buku Harian</h4>
        <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <li>• Wajib disimpan oleh apotek yang menyimpan narkotika & psikotropika (Per-BPOM No. 4/2018)</li>
          <li>• Mencatat <b>setiap pemasukan dan pengeluaran</b> dengan saldo berjalan (running balance)</li>
          <li>• Harus bisa ditunjukkan saat <b>inspeksi BPOM/Dinas Kesehatan</b></li>
          <li>• Cetak buku harian ini dan simpan selama <b>minimal 5 tahun</b></li>
        </ul>
      </div>
    </div>
  );
}
