import { ArrowLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

export default function SyaratKetentuan() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Syarat dan Ketentuan</h1>
          <p className="text-sm text-gray-400 mb-6">Terakhir diperbarui: Maret 2026</p>

          <div className="prose prose-gray prose-sm max-w-none space-y-6 text-sm text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mt-0">1. Ketentuan Umum</h2>
              <p>
                Dengan mengakses dan menggunakan layanan MediSir, Anda menyetujui untuk terikat oleh Syarat dan
                Ketentuan ini. Jika Anda tidak menyetujui ketentuan ini, Anda tidak diperkenankan menggunakan
                layanan kami. Layanan ini ditujukan untuk pengelolaan operasional apotek di Indonesia.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">2. Definisi</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>&quot;Layanan&quot;</strong> berarti aplikasi web MediSir beserta seluruh fitur dan fungsinya.</li>
                <li><strong>&quot;Pengguna&quot;</strong> berarti setiap orang atau entitas yang mendaftar dan menggunakan Layanan.</li>
                <li><strong>&quot;Akun&quot;</strong> berarti akses unik yang diberikan kepada Pengguna setelah registrasi.</li>
                <li><strong>&quot;Data&quot;</strong> berarti semua informasi yang dimasukkan oleh Pengguna ke dalam Layanan.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">3. Pendaftaran dan Akun</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Anda wajib memberikan informasi yang akurat dan lengkap saat mendaftar.</li>
                <li>Anda bertanggung jawab atas keamanan akun dan kata sandi Anda.</li>
                <li>Satu akun apotek hanya untuk satu entitas apotek (satu SIA).</li>
                <li>Anda wajib segera memberitahu kami jika terjadi penggunaan akun yang tidak sah.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">4. Penggunaan Layanan</h2>
              <p>Anda setuju untuk:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Menggunakan Layanan sesuai dengan peraturan perundang-undangan yang berlaku di Indonesia.</li>
                <li>Tidak menggunakan Layanan untuk tujuan ilegal atau melanggar regulasi farmasi.</li>
                <li>Menjaga keakuratan data obat, transaksi, dan informasi pasien yang Anda masukkan.</li>
                <li>Mematuhi standar kefarmasian yang berlaku (PMK 73/2016, PP 51/2009, dan regulasi terkait).</li>
                <li>Tidak menyalin, memodifikasi, atau mendistribusikan bagian dari Layanan tanpa izin tertulis.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">5. Langganan dan Pembayaran</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Layanan tersedia dalam beberapa paket langganan dengan fitur dan batasan yang berbeda.</li>
                <li>Pembayaran dilakukan sesuai siklus billing yang dipilih (bulanan/tahunan).</li>
                <li>Harga dapat berubah dengan pemberitahuan minimal 30 hari sebelumnya.</li>
                <li>Periode uji coba gratis tersedia sesuai kebijakan yang berlaku.</li>
                <li>Keterlambatan pembayaran dapat mengakibatkan pembatasan akses ke fitur tertentu.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">6. Data dan Kepemilikan</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Data yang Anda masukkan ke dalam Layanan tetap menjadi milik Anda.</li>
                <li>Kami berhak menggunakan data agregat dan anonim untuk peningkatan layanan.</li>
                <li>Anda dapat mengekspor data Anda kapan saja selama berlangganan aktif.</li>
                <li>Setelah penghentian akun, data Anda akan disimpan selama 90 hari sebelum dihapus secara permanen.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">7. Ketersediaan Layanan</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Kami berusaha menyediakan Layanan 24/7, namun tidak menjamin ketersediaan tanpa gangguan.</li>
                <li>Pemeliharaan terjadwal akan diinformasikan sebelumnya.</li>
                <li>Kami tidak bertanggung jawab atas kerugian akibat gangguan layanan di luar kendali kami.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">8. Batasan Tanggung Jawab</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Layanan disediakan &quot;sebagaimana adanya&quot; (as is).</li>
                <li>MediSir adalah alat bantu manajemen dan tidak menggantikan tanggung jawab profesional apoteker.</li>
                <li>Kami tidak bertanggung jawab atas keputusan klinis atau kefarmasian yang dibuat berdasarkan data dalam Layanan.</li>
                <li>Pengguna bertanggung jawab penuh atas kepatuhan terhadap regulasi apotek yang berlaku.</li>
                <li>Total kewajiban kami tidak melebihi jumlah yang Anda bayarkan dalam 12 bulan terakhir.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">9. Penghentian</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Anda dapat menghentikan akun Anda kapan saja.</li>
                <li>Kami berhak menangguhkan atau menghentikan akun yang melanggar ketentuan ini.</li>
                <li>Setelah penghentian, Anda tetap dapat mengekspor data selama 30 hari.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">10. Penyelesaian Sengketa</h2>
              <p>
                Sengketa yang timbul dari penggunaan Layanan akan diselesaikan secara musyawarah.
                Apabila musyawarah tidak berhasil, sengketa akan diselesaikan melalui Badan Arbitrase
                Nasional Indonesia (BANI) sesuai hukum Republik Indonesia.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">11. Perubahan Syarat dan Ketentuan</h2>
              <p>
                Kami berhak mengubah Syarat dan Ketentuan ini kapan saja. Perubahan material akan
                diberitahukan melalui email atau notifikasi dalam aplikasi minimal 14 hari sebelum berlaku.
                Penggunaan Layanan setelah perubahan berlaku dianggap sebagai persetujuan atas ketentuan yang baru.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">12. Hubungi Kami</h2>
              <p>
                Untuk pertanyaan mengenai Syarat dan Ketentuan ini, silakan hubungi kami melalui
                email di halaman kontak atau melalui fitur bantuan dalam aplikasi.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
