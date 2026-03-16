import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, CalendarBlank,
  Pill, Warning
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import type { SipnapReportItem } from '../lib/types';

type ReportType = 'narkotika' | 'psikotropika';

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function Sipnap() {
  const { profile, effectiveUserId } = useAuth();

  const now = new Date();
  const [bulan, setBulan] = useState(now.getMonth()); // 0-indexed
  const [tahun, setTahun] = useState(now.getFullYear());
  const [jenis, setJenis] = useState<ReportType>('narkotika');
  const [items, setItems] = useState<SipnapReportItem[]>([]);
  const [loading, setLoading] = useState(false);

  const generateReport = useCallback(async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      // 1. Ambil semua obat narkotika/psikotropika
      const { data: medicines, error: medErr } = await supabase
        .from('medicines')
        .select('id, name, unit, stock, category')
        .eq('user_id', effectiveUserId)
        .eq('category', jenis);

      if (medErr) throw medErr;
      if (!medicines || medicines.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // 2. Hitung periode
      const startDate = new Date(tahun, bulan, 1).toISOString();
      const endDate = new Date(tahun, bulan + 1, 0, 23, 59, 59).toISOString();

      // 3. Ambil stock movements dalam periode
      const medIds = medicines.map(m => m.id);
      const { data: movements, error: movErr } = await supabase
        .from('stock_movements')
        .select('medicine_id, type, quantity, created_at')
        .eq('user_id', effectiveUserId)
        .in('medicine_id', medIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (movErr) throw movErr;

      // 4. Hitung per obat
      const report: SipnapReportItem[] = medicines.map(med => {
        const medMovements = (movements || []).filter(m => m.medicine_id === med.id);

        let penerimaan = 0;
        let pengeluaran = 0;

        for (const mov of medMovements) {
          if (mov.type === 'restock' || mov.type === 'void_return') {
            penerimaan += Math.abs(mov.quantity);
          } else if (mov.type === 'sale' || mov.type === 'adjustment' || mov.type === 'expired_removal') {
            pengeluaran += Math.abs(mov.quantity);
          }
        }

        // Saldo akhir = stok saat ini (jika periode = bulan ini)
        // Untuk bulan lalu, saldo_akhir dihitung dari saldo_awal + penerimaan - pengeluaran
        const saldo_akhir = med.stock;
        const saldo_awal = saldo_akhir - penerimaan + pengeluaran;

        return {
          medicine_id: med.id,
          medicine_name: med.name,
          unit: med.unit,
          saldo_awal: Math.max(0, saldo_awal),
          penerimaan,
          pengeluaran,
          saldo_akhir,
          keterangan: '',
        };
      });

      setItems(report.sort((a, b) => a.medicine_name.localeCompare(b.medicine_name)));
    } catch (err) {
      toast.error('Gagal generate laporan SIPNAP');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, bulan, tahun, jenis]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  // Deadline warning
  const isCurrentMonth = bulan === now.getMonth() && tahun === now.getFullYear();
  const deadlineDate = new Date(tahun, bulan + 1, 10);
  const daysToDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const deadlineWarning = isCurrentMonth && daysToDeadline <= 15 && daysToDeadline > 0;
  const deadlinePassed = daysToDeadline < 0;

  // Export to CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const formLabel = jenis === 'narkotika' ? 'FORM A - NARKOTIKA' : 'FORM B - PSIKOTROPIKA';
    const header = `LAPORAN SIPNAP ${formLabel}\nPeriode: ${MONTHS[bulan]} ${tahun}\nApotek: ${profile?.pharmacy_name || '-'}\nSIA: ${profile?.sia_number || '-'}\n\n`;

    const csvHeader = 'No,Nama Obat,Satuan,Saldo Awal,Penerimaan,Pengeluaran,Saldo Akhir,Keterangan\n';
    const csvRows = items.map((item, i) =>
      `${i + 1},"${item.medicine_name}",${item.unit},${item.saldo_awal},${item.penerimaan},${item.pengeluaran},${item.saldo_akhir},"${item.keterangan}"`
    ).join('\n');

    const blob = new Blob([header + csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SIPNAP_${jenis === 'narkotika' ? 'FormA' : 'FormB'}_${MONTHS[bulan]}_${tahun}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('File CSV berhasil diunduh');
  };

  // Export to Excel (XML Spreadsheet format)
  const handleExportExcel = () => {
    if (items.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const formLabel = jenis === 'narkotika' ? 'FORM A - NARKOTIKA' : 'FORM B - PSIKOTROPIKA';
    const pharmacyName = profile?.pharmacy_name || '-';
    const siaNumber = profile?.sia_number || '-';
    const period = `${MONTHS[bulan]} ${tahun}`;

    const esc = (s: string | number) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const headerRows = `
      <Row><Cell ss:MergeAcross="7"><Data ss:Type="String">LAPORAN SIPNAP ${esc(formLabel)}</Data></Cell></Row>
      <Row><Cell ss:MergeAcross="7"><Data ss:Type="String">Apotek: ${esc(pharmacyName)} | SIA: ${esc(siaNumber)} | Periode: ${esc(period)}</Data></Cell></Row>
      <Row/>
    `;

    const colHeader = `
      <Row>
        <Cell><Data ss:Type="String">No</Data></Cell>
        <Cell><Data ss:Type="String">Nama Obat</Data></Cell>
        <Cell><Data ss:Type="String">Satuan</Data></Cell>
        <Cell><Data ss:Type="String">Saldo Awal</Data></Cell>
        <Cell><Data ss:Type="String">Penerimaan</Data></Cell>
        <Cell><Data ss:Type="String">Pengeluaran</Data></Cell>
        <Cell><Data ss:Type="String">Saldo Akhir</Data></Cell>
        <Cell><Data ss:Type="String">Keterangan</Data></Cell>
      </Row>
    `;

    const dataRows = items.map((item, i) => `
      <Row>
        <Cell><Data ss:Type="Number">${i + 1}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(item.medicine_name)}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(item.unit)}</Data></Cell>
        <Cell><Data ss:Type="Number">${item.saldo_awal}</Data></Cell>
        <Cell><Data ss:Type="Number">${item.penerimaan}</Data></Cell>
        <Cell><Data ss:Type="Number">${item.pengeluaran}</Data></Cell>
        <Cell><Data ss:Type="Number">${item.saldo_akhir}</Data></Cell>
        <Cell><Data ss:Type="String">${esc(item.keterangan)}</Data></Cell>
      </Row>
    `).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="SIPNAP">
    <Table>
      ${headerRows}
      ${colHeader}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIPNAP_${jenis === 'narkotika' ? 'FormA' : 'FormB'}_${MONTHS[bulan]}_${tahun}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File Excel berhasil diunduh');
  };

  // Print
  const handlePrint = () => {
    if (items.length === 0) {
      toast.error('Tidak ada data untuk dicetak');
      return;
    }

    const formLabel = jenis === 'narkotika' ? 'FORM A — NARKOTIKA' : 'FORM B — PSIKOTROPIKA';
    const pharmacyName = escapeHtml(profile?.pharmacy_name || '-');
    const siaNumber = escapeHtml(profile?.sia_number || '-');
    const apotekerName = escapeHtml(profile?.apoteker_name || profile?.full_name || '-');
    const sipaNumber = escapeHtml(profile?.sipa_number || '-');

    const rows = items.map((item, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${escapeHtml(item.medicine_name)}</td>
        <td style="text-align:center">${escapeHtml(item.unit)}</td>
        <td style="text-align:right">${item.saldo_awal}</td>
        <td style="text-align:right">${item.penerimaan}</td>
        <td style="text-align:right">${item.pengeluaran}</td>
        <td style="text-align:right">${item.saldo_akhir}</td>
        <td>${escapeHtml(item.keterangan)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Laporan SIPNAP ${formLabel}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12px; padding: 20mm; }
        h2 { text-align: center; margin-bottom: 2px; }
        h3 { text-align: center; margin-top: 2px; color: #333; }
        .info { margin: 10px 0; }
        .info td { padding: 2px 8px 2px 0; }
        table.report { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.report th, table.report td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
        table.report th { background: #f0f0f0; font-weight: bold; }
        .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
        .signature-block { text-align: center; min-width: 200px; }
        .signature-block .line { margin-top: 60px; border-top: 1px solid #000; padding-top: 4px; }
        @media print { body { padding: 10mm; } }
      </style>
    </head><body>
      <h2>LAPORAN PENGGUNAAN ${formLabel}</h2>
      <h3>(SIPNAP - Sistem Pelaporan Narkotika dan Psikotropika)</h3>
      <table class="info">
        <tr><td><b>Apotek</b></td><td>: ${pharmacyName}</td></tr>
        <tr><td><b>No. SIA</b></td><td>: ${siaNumber}</td></tr>
        <tr><td><b>Periode</b></td><td>: ${MONTHS[bulan]} ${tahun}</td></tr>
      </table>
      <table class="report">
        <thead>
          <tr>
            <th style="width:30px">No</th>
            <th>Nama Obat</th>
            <th style="width:60px">Satuan</th>
            <th style="width:70px">Saldo Awal</th>
            <th style="width:70px">Penerimaan</th>
            <th style="width:70px">Pengeluaran</th>
            <th style="width:70px">Saldo Akhir</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="signature">
        <div class="signature-block">
          <p>Apoteker Penanggung Jawab</p>
          <div class="line">
            ${apotekerName}<br/>
            <small>SIPA: ${sipaNumber}</small>
          </div>
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

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-[1400px] mx-auto w-full pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 dark:bg-red-900/30 rounded-xl">
            <FileText weight="duotone" className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Laporan SIPNAP</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pelaporan Narkotika & Psikotropika ke BPOM</p>
          </div>
        </div>
      </div>

      {/* Deadline warning */}
      {deadlineWarning && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <Warning weight="fill" className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Deadline Pelaporan SIPNAP</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Laporan bulan {MONTHS[bulan]} {tahun} harus dilaporkan ke BPOM paling lambat <b>tanggal 10 {MONTHS[(bulan + 1) % 12]} {bulan === 11 ? tahun + 1 : tahun}</b> ({daysToDeadline} hari lagi)
            </p>
          </div>
        </div>
      )}
      {deadlinePassed && !isCurrentMonth && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <Warning weight="fill" className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Deadline pelaporan SIPNAP untuk bulan ini sudah lewat. Segera laporkan untuk menghindari sanksi BPOM.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Jenis */}
          <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-xl p-0.5">
            <button
              onClick={() => setJenis('narkotika')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                jenis === 'narkotika'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Form A — Narkotika
            </button>
            <button
              onClick={() => setJenis('psikotropika')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                jenis === 'psikotropika'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Form B — Psikotropika
            </button>
          </div>

          {/* Bulan & Tahun */}
          <div className="flex items-center gap-2 ml-auto">
            <CalendarBlank weight="bold" className="w-4 h-4 text-gray-400" />
            <select
              value={bulan}
              onChange={e => setBulan(Number(e.target.value))}
              className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={tahun}
              onChange={e => setTahun(Number(e.target.value))}
              className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {[tahun - 1, tahun, tahun + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Actions */}
          <button
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            <Download weight="bold" className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleExportExcel}
            disabled={items.length === 0}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            <Download weight="bold" className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={handlePrint}
            disabled={items.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            <FileText weight="bold" className="w-4 h-4" />
            Cetak
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">
            {jenis === 'narkotika' ? 'Form A — Narkotika' : 'Form B — Psikotropika'}
            <span className="text-gray-400 dark:text-gray-500 font-normal ml-2">
              {MONTHS[bulan]} {tahun}
            </span>
          </h3>
          <span className="text-xs text-gray-400">{items.length} obat</span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Menggenerate laporan...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Pill weight="duotone" className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tidak ada obat {jenis} yang terdaftar di sistem
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Tambahkan obat dengan kategori "{jenis}" di menu Inventaris
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800/50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 w-10">No</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Obat</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">Satuan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Saldo Awal</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Penerimaan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Pengeluaran</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item, i) => (
                  <tr key={item.medicine_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-center">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">{item.medicine_name}</td>
                    <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{item.unit}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{item.saldo_awal}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                      {item.penerimaan > 0 ? `+${item.penerimaan}` : '0'}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-medium">
                      {item.pengeluaran > 0 ? `-${item.pengeluaran}` : '0'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-200">{item.saldo_akhir}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-zinc-800/50 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-gray-600 dark:text-gray-300">Total</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{items.reduce((s, i) => s + i.saldo_awal, 0)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{items.reduce((s, i) => s + i.penerimaan, 0)}</td>
                  <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{items.reduce((s, i) => s + i.pengeluaran, 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{items.reduce((s, i) => s + i.saldo_akhir, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Info SIPNAP */}
      <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2">📋 Panduan Pelaporan SIPNAP</h4>
        <ul className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
          <li>• Laporan wajib disampaikan ke BPOM <b>paling lambat tanggal 10</b> bulan berikutnya</li>
          <li>• Upload melalui portal <b>sipnap.bpom.go.id</b></li>
          <li>• Form A: Narkotika (Gol. II & III) — Form B: Psikotropika (Gol. IV)</li>
          <li>• Simpan bukti pelaporan minimal 5 tahun</li>
          <li>• Pelanggaran dapat dikenai sanksi administrasi hingga pencabutan izin</li>
        </ul>
      </div>
    </div>
  );
}
