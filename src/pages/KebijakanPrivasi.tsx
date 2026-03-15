import { ArrowLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

export default function KebijakanPrivasi() {
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
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Kebijakan Privasi</h1>
          <p className="text-sm text-gray-400 mb-6">Terakhir diperbarui: Maret 2026</p>

          <div className="prose prose-gray prose-sm max-w-none space-y-6 text-sm text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-gray-900 mt-0">1. Pendahuluan</h2>
              <p>
                MediSir (&quot;kami&quot;, &quot;milik kami&quot;) berkomitmen untuk melindungi privasi dan data pribadi Anda
                sesuai dengan Undang-Undang Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP) Republik Indonesia.
                Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi
                Anda saat menggunakan layanan kami.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">2. Data yang Kami Kumpulkan</h2>
              <p>Kami mengumpulkan jenis data berikut:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Data Identitas:</strong> Nama lengkap, alamat email, nomor telepon.</li>
                <li><strong>Data Apotek:</strong> Nama apotek, alamat, SIA, SIPA, nama apoteker penanggung jawab.</li>
                <li><strong>Data Transaksi:</strong> Riwayat penjualan, pembelian obat, metode pembayaran.</li>
                <li><strong>Data Inventaris:</strong> Daftar obat, stok, batch, tanggal kadaluarsa.</li>
                <li><strong>Data Pelanggan Apotek:</strong> Nama pasien, nomor telepon, riwayat pembelian (yang Anda input).</li>
                <li><strong>Data Teknis:</strong> Alamat IP, jenis perangkat, browser, log akses.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">3. Tujuan Penggunaan Data</h2>
              <p>Data Anda digunakan untuk:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Menyediakan dan mengelola layanan manajemen apotek.</li>
                <li>Memproses transaksi penjualan dan manajemen inventaris.</li>
                <li>Mengirimkan notifikasi terkait layanan (stok kritis, kadaluarsa obat, langganan).</li>
                <li>Meningkatkan kualitas dan keamanan layanan kami.</li>
                <li>Memenuhi kewajiban hukum dan regulasi yang berlaku.</li>
                <li>Memberikan dukungan pelanggan.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">4. Dasar Hukum Pemrosesan Data</h2>
              <p>
                Kami memproses data pribadi Anda berdasarkan persetujuan yang Anda berikan saat mendaftar dan menggunakan
                layanan kami, serta untuk pemenuhan kontrak layanan, sesuai dengan Pasal 20 UU PDP.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">5. Penyimpanan dan Keamanan Data</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Data disimpan di server yang terenkripsi dan dilindungi dengan standar keamanan industri.</li>
                <li>Akses ke data dibatasi hanya untuk personel yang berwenang.</li>
                <li>Kami menggunakan enkripsi SSL/TLS untuk transmisi data.</li>
                <li>Data disimpan selama Anda menggunakan layanan kami, atau sesuai ketentuan hukum yang berlaku.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">6. Hak Anda Sebagai Subjek Data</h2>
              <p>Sesuai UU PDP, Anda memiliki hak untuk:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Hak Akses:</strong> Meminta salinan data pribadi Anda yang kami simpan.</li>
                <li><strong>Hak Perbaikan:</strong> Meminta perbaikan data yang tidak akurat atau tidak lengkap.</li>
                <li><strong>Hak Penghapusan:</strong> Meminta penghapusan data pribadi Anda (&quot;right to erasure&quot;).</li>
                <li><strong>Hak Pembatasan:</strong> Membatasi pemrosesan data Anda dalam kondisi tertentu.</li>
                <li><strong>Hak Portabilitas:</strong> Meminta transfer data Anda ke pihak lain.</li>
                <li><strong>Hak Keberatan:</strong> Menolak pemrosesan data untuk tujuan tertentu.</li>
              </ul>
              <p>
                Untuk menggunakan hak-hak di atas, silakan hubungi kami melalui informasi kontak di bawah.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">7. Berbagi Data dengan Pihak Ketiga</h2>
              <p>
                Kami tidak menjual data pribadi Anda. Data hanya dibagikan kepada pihak ketiga dalam kondisi berikut:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Penyedia layanan infrastruktur (hosting, database) yang terikat perjanjian kerahasiaan.</li>
                <li>Otoritas hukum jika diwajibkan oleh peraturan perundang-undangan.</li>
                <li>Penyedia layanan pembayaran untuk memproses transaksi langganan.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">8. Cookie dan Teknologi Pelacakan</h2>
              <p>
                Kami menggunakan cookie dan teknologi serupa untuk menjaga sesi login, preferensi pengguna,
                dan meningkatkan pengalaman penggunaan. Anda dapat mengatur preferensi cookie melalui pengaturan browser Anda.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">9. Notifikasi Pelanggaran Data</h2>
              <p>
                Sesuai UU PDP, apabila terjadi pelanggaran data yang mempengaruhi data pribadi Anda, kami akan
                memberitahukan kepada Anda dan otoritas terkait dalam waktu paling lambat 3 x 24 jam sejak
                pelanggaran terdeteksi.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">10. Perubahan Kebijakan Privasi</h2>
              <p>
                Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan material akan
                diberitahukan melalui email atau notifikasi dalam aplikasi. Penggunaan layanan setelah perubahan
                dianggap sebagai persetujuan atas kebijakan yang diperbarui.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">11. Hubungi Kami</h2>
              <p>
                Jika Anda memiliki pertanyaan tentang Kebijakan Privasi ini atau ingin menggunakan hak-hak Anda
                terkait data pribadi, silakan hubungi kami melalui email di halaman kontak atau melalui fitur
                bantuan dalam aplikasi.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
