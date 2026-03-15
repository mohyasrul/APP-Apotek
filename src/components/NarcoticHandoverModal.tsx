import { useState } from 'react';
import { Warning, X, FloppyDisk, IdentificationCard } from '@phosphor-icons/react';

export type NarcoticHandoverData = {
  penerima_nama: string;
  penerima_nik: string;
  hubungan_pasien: string;
  items: { medicine_name: string; quantity: number; unit: string }[];
};

type Props = {
  narcoticItems: { medicine_name: string; quantity: number; unit: string }[];
  onConfirm: (data: NarcoticHandoverData) => void;
  onClose: () => void;
};

const NIK_PATTERN = /^\d{16}$/;

export function NarcoticHandoverModal({ narcoticItems, onConfirm, onClose }: Props) {
  const [form, setForm] = useState({
    penerima_nama: '',
    penerima_nik: '',
    hubungan_pasien: 'sendiri',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.penerima_nama.trim()) errs.penerima_nama = 'Nama penerima wajib diisi';
    if (!form.penerima_nik.trim()) errs.penerima_nik = 'NIK wajib diisi';
    else if (!NIK_PATTERN.test(form.penerima_nik.trim())) errs.penerima_nik = 'NIK harus 16 digit';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onConfirm({
      ...form,
      items: narcoticItems,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="narcotic-handover-title"
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-zinc-800">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <Warning weight="fill" className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 id="narcotic-handover-title" className="font-bold text-gray-900 dark:text-gray-100">Bukti Penyerahan Narkotika</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Per-BPOM No. 4/2018 — Wajib untuk setiap penyerahan narkotika</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
            <X weight="bold" className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Narcotic items being dispensed */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
              Obat Narkotika yang Diserahkan
            </label>
            <div className="space-y-1.5">
              {narcoticItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-red-800 dark:text-red-200">{item.medicine_name}</span>
                  <span className="text-xs text-red-600 dark:text-red-400">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recipient info */}
          <div>
            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">Nama Penerima *</label>
            <input
              type="text"
              value={form.penerima_nama}
              onChange={e => setForm({ ...form, penerima_nama: e.target.value })}
              placeholder="Nama lengkap penerima obat"
              aria-invalid={!!errors.penerima_nama}
              className={`w-full border ${errors.penerima_nama ? 'border-red-400' : 'border-gray-200 dark:border-zinc-700'} bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
            />
            {errors.penerima_nama && <p className="text-xs text-red-500 mt-1">{errors.penerima_nama}</p>}
          </div>

          <div>
            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">NIK (No. KTP) *</label>
            <div className="relative">
              <IdentificationCard weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.penerima_nik}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                  setForm({ ...form, penerima_nik: val });
                }}
                placeholder="16 digit NIK"
                maxLength={16}
                aria-invalid={!!errors.penerima_nik}
                className={`w-full border ${errors.penerima_nik ? 'border-red-400' : 'border-gray-200 dark:border-zinc-700'} bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono tracking-wider`}
              />
            </div>
            {errors.penerima_nik && <p className="text-xs text-red-500 mt-1">{errors.penerima_nik}</p>}
          </div>

          <div>
            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">Hubungan dengan Pasien</label>
            <select
              value={form.hubungan_pasien}
              onChange={e => setForm({ ...form, hubungan_pasien: e.target.value })}
              className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="sendiri">Pasien Sendiri</option>
              <option value="keluarga">Keluarga</option>
              <option value="wali">Wali / Penanggung Jawab</option>
            </select>
          </div>

          {/* Legal notice */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <b>⚠️ Perhatian:</b> Data ini disimpan sesuai Per-BPOM No. 4/2018. Setiap penyerahan narkotika ke pasien
              harus ada <b>tanda terima</b> dari penerima. Data NIK dilindungi UU PDP No. 27/2022.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-5 border-t border-gray-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold"
          >
            <FloppyDisk weight="bold" className="w-4 h-4" />
            Konfirmasi Penyerahan
          </button>
        </div>
      </div>
    </div>
  );
}
