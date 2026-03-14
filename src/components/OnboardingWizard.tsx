import { useState } from 'react';
import { Storefront, User, Pill, Rocket, ArrowRight, ArrowLeft, Check, CheckCircle } from '@phosphor-icons/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';

type OnboardingStep = 1 | 2 | 3 | 4;

type Props = {
  onComplete: () => void;
};

export function OnboardingWizard({ onComplete }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Profil Apotek
  const [pharmacyForm, setPharmacyForm] = useState({
    pharmacy_name: profile?.pharmacy_name || '',
    pharmacy_address: profile?.pharmacy_address || '',
    phone: profile?.phone || '',
    full_name: profile?.full_name || '',
  });

  // Step 2: Info Resmi
  const [officialForm, setOfficialForm] = useState({
    sia_number: profile?.sia_number || '',
    sipa_number: profile?.sipa_number || '',
    apoteker_name: profile?.apoteker_name || '',
  });

  // Step 3: Obat Pertama (optional)
  const [sampleMedicine, setSampleMedicine] = useState({
    name: '',
    category: 'bebas',
    sell_price: '',
    stock: '',
    unit: 'tablet',
  });
  const [medicineAdded, setMedicineAdded] = useState(false);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          pharmacy_name: pharmacyForm.pharmacy_name,
          pharmacy_address: pharmacyForm.pharmacy_address,
          phone: pharmacyForm.phone,
          full_name: pharmacyForm.full_name,
          sia_number: officialForm.sia_number || null,
          sipa_number: officialForm.sipa_number || null,
          apoteker_name: officialForm.apoteker_name || null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      toast.error('Gagal menyimpan profil: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddMedicine = async () => {
    if (!profile || !sampleMedicine.name) return;
    setSaving(true);
    try {
      const effectiveUserId = profile.pharmacy_owner_id ?? profile.id;
      const { error } = await supabase.from('medicines').insert({
        user_id: effectiveUserId,
        name: sampleMedicine.name,
        category: sampleMedicine.category,
        sell_price: Number(sampleMedicine.sell_price) || 0,
        buy_price: 0,
        stock: Number(sampleMedicine.stock) || 0,
        unit: sampleMedicine.unit,
        min_stock: 5,
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      if (error) throw error;
      setMedicineAdded(true);
      toast.success('Obat berhasil ditambahkan!');
    } catch (err) {
      toast.error('Gagal menambah obat: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    await handleSaveProfile();
    onComplete();
  };

  const handleNext = async () => {
    if (step === 2) {
      // Save profile data before moving on
      await handleSaveProfile();
    }
    if (step < 4) setStep((step + 1) as OnboardingStep);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as OnboardingStep);
  };

  const steps = [
    { num: 1, label: 'Profil Apotek', icon: Storefront },
    { num: 2, label: 'Info Resmi', icon: User },
    { num: 3, label: 'Obat Pertama', icon: Pill },
    { num: 4, label: 'Siap!', icon: Rocket },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        {/* Progress Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-6">
          <h1 className="text-xl font-bold text-slate-800 mb-1">Selamat Datang di MediSir! 🎉</h1>
          <p className="text-sm text-slate-500">Mari siapkan apotek Anda dalam beberapa langkah</p>

          {/* Step Indicators */}
          <div className="flex items-center gap-2 mt-6">
            {steps.map((s, idx) => (
              <div key={s.num} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  step === s.num ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' :
                  step > s.num ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {step > s.num ? <Check weight="bold" className="w-3.5 h-3.5" /> : <s.icon weight="fill" className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded ${step > s.num ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-8">
          {/* Step 1: Profil Apotek */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Profil Apotek Anda</h2>
                <p className="text-sm text-slate-500">Informasi ini akan tampil di struk dan dokumen resmi.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Apotek *</label>
                  <input
                    type="text"
                    value={pharmacyForm.pharmacy_name}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, pharmacy_name: e.target.value })}
                    placeholder="contoh: Apotek Sehat Makmur"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Pemilik / Apoteker *</label>
                  <input
                    type="text"
                    value={pharmacyForm.full_name}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, full_name: e.target.value })}
                    placeholder="Nama lengkap"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Alamat</label>
                  <input
                    type="text"
                    value={pharmacyForm.pharmacy_address}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, pharmacy_address: e.target.value })}
                    placeholder="Jl. Contoh No. 1, Kota"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Telepon / WhatsApp</label>
                  <input
                    type="tel"
                    value={pharmacyForm.phone}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, phone: e.target.value })}
                    placeholder="08123456789"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Info Resmi */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Informasi Resmi</h2>
                <p className="text-sm text-slate-500">Nomor izin resmi apotek Anda (opsional, bisa diisi nanti di Pengaturan).</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nomor SIA</label>
                  <input
                    type="text"
                    value={officialForm.sia_number}
                    onChange={(e) => setOfficialForm({ ...officialForm, sia_number: e.target.value })}
                    placeholder="SIA-XX-XXXX-XXXX"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Apoteker Penanggung Jawab</label>
                  <input
                    type="text"
                    value={officialForm.apoteker_name}
                    onChange={(e) => setOfficialForm({ ...officialForm, apoteker_name: e.target.value })}
                    placeholder="Apt. Nama Lengkap, S.Farm"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nomor SIPA</label>
                  <input
                    type="text"
                    value={officialForm.sipa_number}
                    onChange={(e) => setOfficialForm({ ...officialForm, sipa_number: e.target.value })}
                    placeholder="SIPA-XXXX"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                💡 Jika belum memiliki nomor izin, Anda bisa lewati dan mengisi nanti di menu <strong>Pengaturan</strong>.
              </div>
            </div>
          )}

          {/* Step 3: Obat Pertama */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">Tambah Obat Pertama</h2>
                <p className="text-sm text-slate-500">Coba tambahkan satu obat sebagai latihan. Anda juga bisa mengimpor dari CSV nanti.</p>
              </div>
              {medicineAdded ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                  <CheckCircle weight="fill" className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="font-bold text-emerald-700 text-lg">Obat berhasil ditambahkan!</p>
                  <p className="text-sm text-emerald-600 mt-1">Anda bisa menambahkan lebih banyak obat nanti di menu <strong>Inventaris</strong>.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Obat *</label>
                    <input
                      type="text"
                      value={sampleMedicine.name}
                      onChange={(e) => setSampleMedicine({ ...sampleMedicine, name: e.target.value })}
                      placeholder="contoh: Paracetamol 500mg"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori</label>
                      <select
                        value={sampleMedicine.category}
                        onChange={(e) => setSampleMedicine({ ...sampleMedicine, category: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                      >
                        <option value="bebas">Obat Bebas</option>
                        <option value="bebas_terbatas">Bebas Terbatas</option>
                        <option value="keras">Obat Keras</option>
                        <option value="narkotika">Narkotika</option>
                        <option value="psikotropika">Psikotropika</option>
                        <option value="fitofarmaka">Fitofarmaka</option>
                        <option value="obat_herbal">Obat Herbal</option>
                        <option value="suplemen">Suplemen</option>
                        <option value="alat_kesehatan">Alat Kesehatan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Satuan</label>
                      <select
                        value={sampleMedicine.unit}
                        onChange={(e) => setSampleMedicine({ ...sampleMedicine, unit: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                      >
                        <option value="tablet">Tablet</option>
                        <option value="strip">Strip</option>
                        <option value="botol">Botol</option>
                        <option value="box">Box</option>
                        <option value="tube">Tube</option>
                        <option value="sachet">Sachet</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Harga Jual (Rp)</label>
                      <input
                        type="number"
                        value={sampleMedicine.sell_price}
                        onChange={(e) => setSampleMedicine({ ...sampleMedicine, sell_price: e.target.value })}
                        placeholder="5000"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Stok Awal</label>
                      <input
                        type="number"
                        value={sampleMedicine.stock}
                        onChange={(e) => setSampleMedicine({ ...sampleMedicine, stock: e.target.value })}
                        placeholder="100"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMedicine}
                    disabled={saving || !sampleMedicine.name}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Pill weight="fill" className="w-4 h-4" />
                    )}
                    Tambah Obat
                  </button>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                💡 Anda juga bisa mengimpor daftar obat dari file <strong>CSV</strong> di menu Inventaris nanti.
              </div>
            </div>
          )}

          {/* Step 4: Selesai */}
          {step === 4 && (
            <div className="text-center space-y-6 py-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Rocket weight="fill" className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Apotek Anda Siap! 🎉</h2>
                <p className="text-slate-500">Semua pengaturan dasar sudah selesai. Anda bisa mulai menggunakan MediSir.</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-6 text-left space-y-3">
                <h3 className="font-bold text-slate-700 text-sm">Langkah selanjutnya:</h3>
                <div className="space-y-2">
                  {[
                    { text: 'Buka Kasir untuk transaksi pertama', path: '/pos' },
                    { text: 'Tambahkan lebih banyak obat di Inventaris', path: '/medicines' },
                    { text: 'Undang kasir di Pengaturan → Tim', path: '/settings' },
                    { text: 'Lihat laporan penjualan di Laporan', path: '/laporan' },
                  ].map((item) => (
                    <div key={item.path} className="flex items-center gap-3 text-sm text-slate-600">
                      <CheckCircle weight="fill" className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-slate-200 bg-slate-50 px-8 py-5 flex items-center justify-between">
          <div>
            {step > 1 && step < 4 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
              >
                <ArrowLeft weight="bold" className="w-4 h-4" /> Kembali
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 3 && (
              <button
                onClick={() => setStep(4)}
                className="text-sm text-slate-400 hover:text-slate-600 font-medium"
              >
                Lewati
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={handleNext}
                disabled={saving || (step === 1 && !pharmacyForm.pharmacy_name)}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)] disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Lanjutkan <ArrowRight weight="bold" className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-[0_4px_12px_rgba(16,185,129,0.3)] disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Rocket weight="fill" className="w-4 h-4" /> Mulai Gunakan MediSir
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
