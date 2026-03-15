import { useState } from 'react';
import {
  Question, CaretDown, CaretRight, Phone, WhatsappLogo,
  BookOpen, ShoppingCart, Package, ClipboardText, ChartBar,
  GearSix, FirstAidKit, Truck, UsersFour
} from '@phosphor-icons/react';

// ─── Support Contact ──────────────────────────────────────────────────────────
// Update SUPPORT_WHATSAPP with the actual MediSir support number when deploying
const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP || '6281234567890';
const SUPPORT_EMAIL    = import.meta.env.VITE_SUPPORT_EMAIL    || 'support@medisir.app';

// ─── Types ────────────────────────────────────────────────────────────────────
type FaqItem = {
  q: string;
  a: string;
};

type FaqSection = {
  id: string;
  title: string;
  icon: React.ReactNode;
  faqs: FaqItem[];
};

// ─── FAQ Data ─────────────────────────────────────────────────────────────────
const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'pos',
    title: 'Kasir & POS',
    icon: <ShoppingCart weight="fill" className="w-5 h-5 text-indigo-600" />,
    faqs: [
      {
        q: 'Bagaimana cara melakukan transaksi penjualan?',
        a: 'Buka halaman Kasir (POS), ketik nama obat di kolom pencarian atau gunakan barcode scanner. Klik obat untuk menambahkan ke keranjang, lalu klik tombol "Bayar" (atau tekan F8) untuk memproses pembayaran.'
      },
      {
        q: 'Apa saja shortcut keyboard di kasir?',
        a: 'F2: Fokus ke pencarian obat | F4: Toggle barcode scanner | F8: Buka dialog bayar | Ctrl+Enter: Bayar | Esc: Tutup dialog | ?: Tampilkan panduan shortcut'
      },
      {
        q: 'Bagaimana cara membuka dan menutup shift kasir?',
        a: 'Klik tombol "Buka Shift" di halaman Kasir sebelum mulai berjualan. Isikan modal awal dan nama kasir. Klik "Tutup Shift" di akhir hari untuk melihat rekap penjualan shift tersebut.'
      },
      {
        q: 'Apakah saya bisa berjualan saat internet mati (offline)?',
        a: 'Ya! MediSir memiliki antrian offline. Transaksi yang dilakukan saat offline akan tersimpan sementara dan otomatis tersinkronisasi saat koneksi kembali.'
      },
      {
        q: 'Bagaimana cara mencetak struk?',
        a: 'Setelah pembayaran berhasil, dialog konfirmasi akan muncul dengan tombol "Cetak Struk". Anda bisa mengatur ukuran kertas struk (58mm/80mm/A4) di menu Pengaturan > Apotek.'
      },
    ]
  },
  {
    id: 'resep',
    title: 'Resep & Dispensing',
    icon: <ClipboardText weight="fill" className="w-5 h-5 text-purple-500" />,
    faqs: [
      {
        q: 'Bagaimana alur proses resep di MediSir?',
        a: 'Alur resep: Pending (baru diterima) → Skrining (dicek apoteker) → Dispensed (obat diserahkan) / Cancelled (dibatalkan). Setiap perubahan status tercatat di audit trail.'
      },
      {
        q: 'Apa itu skrining resep dan mengapa penting?',
        a: 'Skrining resep adalah pemeriksaan kesesuaian resep secara administratif, farmasetik, dan klinis sesuai PMK 73/2016. Apoteker wajib melakukan skrining sebelum obat diserahkan ke pasien.'
      },
      {
        q: 'Bagaimana cara mencetak apograph (salinan resep)?',
        a: 'Buka detail resep, klik tombol "Apograph". Sistem akan generate salinan resep lengkap dengan tanda tangan APJ dan cap apotek, sesuai format PMK 73/2016.'
      },
      {
        q: 'Bagaimana cara mencetak etiket obat?',
        a: 'Di halaman detail resep, klik "Etiket Obat". Pilih item obat yang akan dicetak etiketnya. Etiket berisi nama pasien, nama obat, dosis, aturan pakai, dan nama apotek.'
      },
      {
        q: 'Obat narkotika membutuhkan prosedur khusus?',
        a: 'Ya. Saat resep mengandung narkotika, sistem akan meminta Bukti Penyerahan Narkotika (nama penerima, NIK, hubungan dengan pasien) sesuai Per-BPOM No. 4/2018.'
      },
    ]
  },
  {
    id: 'stok',
    title: 'Manajemen Stok & Obat',
    icon: <Package weight="fill" className="w-5 h-5 text-emerald-500" />,
    faqs: [
      {
        q: 'Bagaimana cara menambah obat baru?',
        a: 'Buka Stok Obat > klik "+ Obat Baru". Isi nama, kategori, harga beli, harga jual, stok minimum, dan informasi batch (no. batch, tanggal kadaluarsa). Klik Simpan.'
      },
      {
        q: 'Apa itu FEFO dan bagaimana cara kerjanya?',
        a: 'FEFO (First Expiry, First Out) adalah aturan pengeluaran obat berdasarkan tanggal kadaluarsa terdekat. MediSir otomatis mengalokasikan batch dengan kadaluarsa terdekat saat penjualan.'
      },
      {
        q: 'Bagaimana cara melihat kartu stok?',
        a: 'Di halaman Stok Obat, klik ikon "Kartu Stok" pada baris obat. Kartu stok menampilkan semua mutasi stok (masuk/keluar) dengan format sesuai PMK 73/2016.'
      },
      {
        q: 'Bagaimana cara import obat dari CSV?',
        a: 'Buka Stok Obat > klik "Import CSV". Download template CSV, isi data obat sesuai format template, lalu upload file. Sistem akan memvalidasi dan memasukkan data secara massal.'
      },
      {
        q: 'Bagaimana cara melakukan stock opname?',
        a: 'Buka menu Stock Opname > Buat Opname Baru. Hitung stok fisik dan masukkan di kolom "Stok Aktual". Simpan sebagai Draft, lalu klik "Selesai" setelah semua obat dicek. Owner dapat menyetujui opname.'
      },
    ]
  },
  {
    id: 'pengadaan',
    title: 'Pengadaan & Pembelian',
    icon: <Truck weight="fill" className="w-5 h-5 text-amber-500" />,
    faqs: [
      {
        q: 'Bagaimana membuat Surat Pesanan (SP) ke PBF?',
        a: 'Buka Pengadaan > Surat Pesanan > Buat SP Baru. Pilih PBF, pilih jenis SP (Reguler/Narkotika/Psikotropika/Prekursor/OOT), tambahkan obat yang dipesan, lalu simpan.'
      },
      {
        q: 'Apa perbedaan SP Reguler, Narkotika, dan Psikotropika?',
        a: 'SP Reguler untuk obat biasa. SP Narkotika dan Psikotropika memiliki format khusus sesuai Permenkes 3/2015 dan hanya dapat dibuat oleh Apoteker (pemilik). Keduanya harus ditandatangani APJ.'
      },
      {
        q: 'Bagaimana cara mencatat penerimaan obat dari PBF?',
        a: 'Buka Pengadaan > Faktur PBF (A/P) > Input Faktur Baru. Masukkan nomor faktur, tanggal, dan daftar obat yang diterima beserta no. batch dan ED. Stok obat akan bertambah otomatis.'
      },
    ]
  },
  {
    id: 'laporan',
    title: 'Laporan & Keuangan',
    icon: <ChartBar weight="fill" className="w-5 h-5 text-indigo-500" />,
    faqs: [
      {
        q: 'Laporan apa saja yang tersedia di MediSir?',
        a: 'Tersedia: Laporan Penjualan (omset, grafik harian), Laporan Keuangan (P&L, HPP, hutang PBF), Laporan SIPNAP (narkotika/psikotropika), Buku Harian Narkotika, dan Kartu Stok.'
      },
      {
        q: 'Bagaimana cara export laporan ke Excel?',
        a: 'Di halaman laporan yang mendukung export, klik tombol "Export Excel". File akan terunduh ke perangkat Anda dalam format .xlsx yang bisa dibuka di Microsoft Excel atau WPS Office.'
      },
      {
        q: 'Apa itu laporan SIPNAP dan kapan harus dilaporkan?',
        a: 'SIPNAP adalah laporan penggunaan narkotika dan psikotropika bulanan yang wajib dikirim ke BPOM (sipnap.bpom.go.id) paling lambat tanggal 10 bulan berikutnya. Buka menu SIPNAP untuk membuat laporan.'
      },
    ]
  },
  {
    id: 'pelanggan',
    title: 'Pelanggan (CRM)',
    icon: <UsersFour weight="fill" className="w-5 h-5 text-rose-500" />,
    faqs: [
      {
        q: 'Bagaimana cara menambah data pelanggan?',
        a: 'Buka menu Pelanggan > Tambah Pelanggan. Isi nama dan nomor HP. Pelanggan dapat dihubungkan ke transaksi di kasir dengan mencarinya di kolom "Pelanggan" saat checkout.'
      },
      {
        q: 'Bagaimana cara mengirim pesan WhatsApp ke pelanggan?',
        a: 'Di daftar pelanggan, klik ikon WhatsApp pada baris pelanggan yang memiliki nomor HP. Browser akan membuka WhatsApp Web/App dengan nomor pelanggan tersebut.'
      },
      {
        q: 'Bagaimana cara export data pelanggan?',
        a: 'Di halaman Pelanggan, klik tombol "Export CSV" (tersedia untuk pemilik). Data semua pelanggan termasuk statistik transaksi akan terunduh dalam format CSV.'
      },
    ]
  },
  {
    id: 'compliance',
    title: 'Kepatuhan & Regulasi',
    icon: <FirstAidKit weight="fill" className="w-5 h-5 text-teal-500" />,
    faqs: [
      {
        q: 'Fitur kepatuhan regulasi apa saja yang ada di MediSir?',
        a: 'MediSir mendukung: SIPNAP, Buku Harian Narkotika, Pemusnahan Obat (BAP), Skrining Resep (18 item), Bukti Penyerahan Narkotika, Kartu Stok PMK 73/2016, Apograph, Etiket Obat, Konseling PIO, dan MESO.'
      },
      {
        q: 'Bagaimana cara membuat Berita Acara Pemusnahan (BAP)?',
        a: 'Buka menu Pemusnahan Obat > Buat BAP Baru. Pilih obat dan batch yang akan dimusnahkan, isi data saksi dan metode pemusnahan. Setelah disetujui, stok berkurang dan BAP siap dicetak.'
      },
      {
        q: 'Apa itu MESO dan apakah wajib?',
        a: 'MESO (Monitoring Efek Samping Obat) adalah bagian dari Farmakovigilans sesuai PMK 73/2016. Apotek berperan melaporkan ESO serius ke BPOM via e-meso.pom.go.id. Gunakan menu MESO di MediSir untuk dokumentasi internal.'
      },
      {
        q: 'Bagaimana MediSir membantu kepatuhan UU PDP (Privasi)?',
        a: 'MediSir telah memiliki Kebijakan Privasi dan Syarat & Ketentuan sesuai UU PDP No. 27/2022. Data pasien disimpan terenkripsi oleh Supabase. Fitur consent sudah ada di form registrasi.'
      },
    ]
  },
  {
    id: 'settings',
    title: 'Pengaturan & Akun',
    icon: <GearSix weight="fill" className="w-5 h-5 text-gray-500" />,
    faqs: [
      {
        q: 'Bagaimana cara mengundang kasir ke apotek saya?',
        a: 'Buka Pengaturan > Tim & Akses > Undang Kasir. Masukkan email kasir. Kasir akan mendapat email undangan untuk mendaftar. Kasir hanya memiliki akses kasir (tidak bisa lihat laporan keuangan).'
      },
      {
        q: 'Bagaimana cara mengatur ukuran kertas struk?',
        a: 'Buka Pengaturan > Apotek > Lebar Kertas Struk. Pilih 58mm (printer termal kecil), 80mm (printer termal standar), atau A4 (printer biasa). Perubahan berlaku langsung.'
      },
      {
        q: 'Bagaimana cara mengaktifkan mode gelap?',
        a: 'Klik ikon Matahari/Bulan di pojok kanan atas navigasi. Mode gelap aktif sesuai pilihan Anda dan tersimpan otomatis di browser.'
      },
      {
        q: 'Bagaimana jika SIA/SIPA saya hampir kadaluarsa?',
        a: 'MediSir akan menampilkan banner peringatan di dashboard saat izin apotek (SIA/SIPA/STRA) mendekati kadaluarsa (H-90, H-30, H-7). Pastikan tanggal izin diisi di Pengaturan > Info Resmi.'
      },
    ]
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
function FaqAccordion({ faq }: { faq: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 dark:border-zinc-800 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left py-4 flex items-start justify-between gap-3 group"
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {faq.q}
        </span>
        {open
          ? <CaretDown weight="bold" className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          : <CaretRight weight="bold" className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        }
      </button>
      {open && (
        <div className="pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {faq.a}
        </div>
      )}
    </div>
  );
}

export default function Bantuan() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery.trim()
    ? FAQ_SECTIONS.map(sec => ({
        ...sec,
        faqs: sec.faqs.filter(f =>
          f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(sec => sec.faqs.length > 0)
    : activeSection
      ? FAQ_SECTIONS.filter(s => s.id === activeSection)
      : FAQ_SECTIONS;

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto w-full pb-20 lg:pb-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Question weight="fill" className="w-6 h-6 text-indigo-600" />
          Pusat Bantuan
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Panduan penggunaan MediSir untuk apotek Anda
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <BookOpen weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          placeholder="Cari pertanyaan atau kata kunci..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setActiveSection(null); }}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm dark:text-gray-200 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600"
        />
      </div>

      {/* Category Pills */}
      {!searchQuery && (
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveSection(null)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeSection === null
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            Semua
          </button>
          {FAQ_SECTIONS.map(sec => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeSection === sec.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {sec.title}
            </button>
          ))}
        </div>
      )}

      {/* FAQ Sections */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Question className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-semibold">Pertanyaan tidak ditemukan</p>
            <p className="text-sm mt-1">Coba kata kunci lain atau hubungi support kami</p>
          </div>
        ) : (
          filtered.map(sec => (
            <div key={sec.id} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                {sec.icon}
                <h2 className="font-bold text-gray-700 dark:text-gray-200 text-sm">{sec.title}</h2>
                <span className="ml-auto text-xs text-gray-400 bg-gray-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">{sec.faqs.length} FAQ</span>
              </div>
              <div className="px-5">
                {sec.faqs.map((faq, i) => (
                  <FaqAccordion key={i} faq={faq} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Contact Support */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Masih butuh bantuan?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Tim kami siap membantu Anda pada jam kerja (Senin–Sabtu, 08.00–17.00 WIB).</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}?text=Halo%20MediSir%2C%20saya%20butuh%20bantuan`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <WhatsappLogo weight="fill" className="w-4 h-4" />
            Chat WhatsApp Support
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <Phone weight="fill" className="w-4 h-4" />
            Email Support
          </a>
        </div>
      </div>
    </div>
  );
}
