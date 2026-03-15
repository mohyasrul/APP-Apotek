import { useState } from 'react';
import {
  ClipboardText, X, FloppyDisk, CheckCircle, Warning, XCircle
} from '@phosphor-icons/react';
import type { ScreeningChecklist, PrescriptionScreening } from '../lib/types';

const defaultChecklist = (): ScreeningChecklist => ({
  adm_nama_pasien: false,
  adm_umur_bb: false,
  adm_nama_dokter: false,
  adm_sip_dokter: false,
  adm_tanggal_resep: false,
  adm_paraf_dokter: false,
  adm_alamat_dokter: false,
  far_bentuk_sediaan: false,
  far_dosis: false,
  far_stabilitas: false,
  far_kompatibilitas: false,
  far_cara_pemberian: false,
  kli_ketepatan_indikasi: false,
  kli_dosis_tepat: false,
  kli_interaksi_obat: false,
  kli_efek_samping: false,
  kli_kontraindikasi: false,
  kli_alergi: false,
});

const SECTION_STYLES = {
  blue: {
    heading: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  purple: {
    heading: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
  emerald: {
    heading: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
} as const;

const RESULT_STYLES = {
  emerald: 'bg-emerald-500 text-white shadow-sm',
  amber: 'bg-amber-500 text-white shadow-sm',
  red: 'bg-red-500 text-white shadow-sm',
} as const;

const SECTIONS = [
  {
    title: 'Skrining Administratif',
    color: 'blue',
    items: [
      { key: 'adm_nama_pasien', label: 'Nama, umur, jenis kelamin pasien tertulis jelas' },
      { key: 'adm_umur_bb', label: 'Umur/BB pasien (untuk dosis pediatrik) tercantum' },
      { key: 'adm_nama_dokter', label: 'Nama dokter penulis resep jelas' },
      { key: 'adm_sip_dokter', label: 'No. SIP dokter tercantum' },
      { key: 'adm_tanggal_resep', label: 'Tanggal penulisan resep' },
      { key: 'adm_paraf_dokter', label: 'Paraf/tanda tangan dokter ada' },
      { key: 'adm_alamat_dokter', label: 'Alamat praktek dokter tercantum' },
    ],
  },
  {
    title: 'Skrining Farmasetik',
    color: 'purple',
    items: [
      { key: 'far_bentuk_sediaan', label: 'Bentuk sediaan sesuai (tablet/kapsul/sirup/dll)' },
      { key: 'far_dosis', label: 'Dosis lazim sesuai referensi' },
      { key: 'far_stabilitas', label: 'Stabilitas obat terjamin (suhu, cahaya)' },
      { key: 'far_kompatibilitas', label: 'Kompatibilitas antar obat dalam resep OK' },
      { key: 'far_cara_pemberian', label: 'Cara dan lama pemberian jelas (signa)' },
    ],
  },
  {
    title: 'Skrining Klinis',
    color: 'emerald',
    items: [
      { key: 'kli_ketepatan_indikasi', label: 'Ketepatan indikasi obat sesuai diagnosis' },
      { key: 'kli_dosis_tepat', label: 'Dosis tepat untuk usia/BB pasien' },
      { key: 'kli_interaksi_obat', label: 'Tidak ada interaksi obat yang berbahaya' },
      { key: 'kli_efek_samping', label: 'Potensi efek samping sudah dipertimbangkan' },
      { key: 'kli_kontraindikasi', label: 'Tidak ada kontraindikasi pada pasien' },
      { key: 'kli_alergi', label: 'Riwayat alergi pasien sudah dicek' },
    ],
  },
] as const;

type Props = {
  prescriptionId: string;
  patientName: string;
  screenerName: string;
  onSave: (screening: PrescriptionScreening) => void;
  onClose: () => void;
  existingScreening?: PrescriptionScreening | null;
};

export function PrescriptionScreeningModal({
  prescriptionId, patientName, screenerName, onSave, onClose, existingScreening
}: Props) {
  const [checklist, setChecklist] = useState<ScreeningChecklist>(
    existingScreening?.checklist || defaultChecklist()
  );
  const [catatan, setCatatan] = useState(existingScreening?.catatan || '');
  const [hasil, setHasil] = useState<PrescriptionScreening['hasil']>(
    existingScreening?.hasil || 'layak'
  );

  const toggle = (key: keyof ScreeningChecklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalItems = SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const checkedItems = Object.values(checklist).filter(Boolean).length;
  const progress = Math.round((checkedItems / totalItems) * 100);

  const handleSave = () => {
    const screening: PrescriptionScreening = {
      prescription_id: prescriptionId,
      screened_by: screenerName,
      screened_at: new Date().toISOString(),
      checklist,
      catatan,
      hasil,
    };
    onSave(screening);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prescription-screening-title"
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
              <ClipboardText weight="duotone" className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 id="prescription-screening-title" className="font-bold text-slate-800 dark:text-slate-100">Skrining Resep</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pasien: <b>{patientName}</b> — PMK 73/2016
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X weight="bold" className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Progress: {checkedItems}/{totalItems} item terverifikasi
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checklist sections */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <h4 className={`text-sm font-bold ${SECTION_STYLES[section.color].heading} mb-2 flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full ${SECTION_STYLES[section.color].dot}`} />
                {section.title}
              </h4>
              <div className="space-y-1.5">
                {section.items.map(item => (
                  <label
                    key={item.key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      checklist[item.key as keyof ScreeningChecklist]
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checklist[item.key as keyof ScreeningChecklist]}
                      onChange={() => toggle(item.key as keyof ScreeningChecklist)}
                      className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
                    />
                    <span className={`text-sm ${
                      checklist[item.key as keyof ScreeningChecklist]
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Result */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Hasil Skrining</h4>
            <div className="flex gap-2">
              {([
                { value: 'layak', label: 'Layak Dilayani', icon: CheckCircle, color: 'emerald' },
                { value: 'perlu_konfirmasi', label: 'Perlu Konfirmasi Dokter', icon: Warning, color: 'amber' },
                { value: 'tidak_layak', label: 'Tidak Layak', icon: XCircle, color: 'red' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setHasil(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    hasil === opt.value
                      ? RESULT_STYLES[opt.color]
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <opt.icon weight="bold" className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">Catatan Skrining</label>
            <textarea
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              rows={2}
              placeholder="Catatan hasil skrining (opsional)"
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-5 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold"
          >
            <FloppyDisk weight="bold" className="w-4 h-4" />
            Simpan Skrining
          </button>
        </div>
      </div>
    </div>
  );
}
