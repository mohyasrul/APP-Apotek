# MediSir – Analisis Mendalam & Perencanaan Pra-Komersialisasi

> **Target Pasar:** Apotek Kecil Mandiri (Apotek Mandiri, Apotek Keluarga, dll.) di Indonesia  
> **Tujuan Dokumen:** Identifikasi komprehensif celah yang harus ditutup sebelum aplikasi ini dapat dikomersilkan dan dipakai secara nyata.  
> **Tanggal Analisis:** Maret 2026

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Inventaris Fitur Yang Sudah Ada](#2-inventaris-fitur-yang-sudah-ada)
3. [Celah Regulasi & Kepatuhan Apotek Indonesia](#3-celah-regulasi--kepatuhan-apotek-indonesia)
4. [Celah Standar SaaS Produk](#4-celah-standar-saas-produk)
5. [Celah UX & Kegunaan untuk Apotek Kecil](#5-celah-ux--kegunaan-untuk-apotek-kecil)
6. [Celah Integrasi & Ekosistem](#6-celah-integrasi--ekosistem)
7. [Celah Keamanan & Privasi Data](#7-celah-keamanan--privasi-data)
8. [Celah Bisnis & Monetisasi](#8-celah-bisnis--monetisasi)
9. [Matriks Prioritas & Roadmap](#9-matriks-prioritas--roadmap)
10. [Estimasi Sumber Daya](#10-estimasi-sumber-daya)
11. [Risiko & Mitigasi](#11-risiko--mitigasi)
12. [Kesimpulan & Rekomendasi](#12-kesimpulan--rekomendasi)

---

## 1. Ringkasan Eksekutif

MediSir adalah aplikasi POS-first SaaS berbasis web (React + Supabase) yang dirancang untuk apotek kecil di Indonesia. Aplikasi ini telah memiliki fondasi yang cukup kuat: manajemen inventaris, POS dengan FEFO, resep, pengadaan, audit trail, dan subscription billing.

**Namun**, berdasarkan analisis mendalam terhadap:
- Regulasi farmasi Indonesia (PMK 73/2016, PP 51/2009, UU 36/2009, Per-BPOM terkait)
- Standar operasional apotek mandiri kelas kecil
- Standar kematangan produk SaaS B2B
- Kebutuhan nyata pengguna apotek kecil di Indonesia

Terdapat **34 celah signifikan** yang terbagi dalam 7 kategori utama yang harus ditangani sebelum komersialisasi. Dari 34 celah tersebut, **12 bersifat BLOCKER** (wajib ada sebelum go-live), **14 bersifat HIGH** (harus ada dalam 3 bulan pertama), dan **8 bersifat MEDIUM** (roadmap 6 bulan).

---

## 2. Inventaris Fitur Yang Sudah Ada

### ✅ Fitur Inti Sudah Tersedia

| Modul | Status | Keterangan |
|-------|--------|------------|
| POS / Kasir | ✅ Lengkap | Dengan shift, FEFO allocation, barcode scanner, offline queue |
| Manajemen Obat | ✅ Lengkap | CRUD, filter kategori, import CSV, batch management |
| Resep (Resep) | ✅ Ada | Lifecycle pending→dispensed→cancelled, cetak apograph, etiket obat |
| Pengadaan | ✅ Ada | Surat Pesanan, Faktur PBF (A/P), Defecta, Supplier |
| Stock Opname | ✅ Ada | Draft→in_progress→completed→approved workflow |
| Laporan | ✅ Ada | Omset, laba kotor, grafik harian, filter waktu |
| Laporan Keuangan | ✅ Ada | P&L per bulan, HPP, margin, hutang dagang PBF, export Excel |
| Pelanggan (CRM dasar) | ✅ Ada | Nama, telepon, riwayat transaksi |
| Pengaturan Apotek | ✅ Ada | Profil, SIA, SIPA, apoteker, logo |
| Multi-Role | ✅ Ada | Owner & Kasir dengan RLS Supabase |
| Audit Trail | ✅ Ada | Immutable, terlindungi dari delete/update |
| Dispensing Rules | ✅ Ada | Per kategori obat, bisa dikustomisasi |
| Subscription/Billing | ✅ Parsial | UI ada, payment gateway belum terintegrasi |
| Dark Mode | ✅ Ada | ThemeProvider |
| Offline Queue | ✅ Ada | IndexedDB, retry 3x |
| Session Timeout | ✅ Ada | 30 menit idle |
| Error Monitoring | ✅ Ada | Sentry |
| Kartu Stok | ✅ Lengkap | Modal, format PMK 73/2016, cetak per obat |
| FEFO Allocation | ✅ Ada | First Expiry First Out untuk batch |
| Apoteker Approval | ✅ Ada | Untuk obat keras/narkotika/psikotropika |
| Receipt PMK-compliant | ✅ Ada | Nama, SIA, SIPA, apoteker di struk |
| SIPNAP | ✅ Ada | Form pelaporan narkotika bulanan |
| Buku Harian Narkotika | ✅ Ada | Catatan harian pemasukan/pengeluaran |
| Pemusnahan Obat | ✅ Ada | BAP pemusnahan sesuai PMK |
| Skrining Resep | ✅ Ada | Checklist 18 item administrasi/farmasetik/klinis |
| Bukti Penyerahan Narkotika | ✅ Ada | Modal dengan NIK |
| Etiket Obat | ✅ Ada | Cetak etiket per item resep (oral/topikal/injeksi) |
| Konseling & PIO | ✅ Ada | Dokumentasi konseling pasien, cetak, riwayat |
| Racikan/Compounding | ✅ Ada | Formula racikan, cetak formula, etiket racikan |

### ⚠️ Fitur Ada Tapi Belum Selesai

| Modul | Status | Masalah |
|-------|--------|---------|
| Payment Gateway | ⚠️ Stub | Billing.tsx hanya toast "hubungi tim MediSir" |
| Onboarding | ✅ Ada | Wizard 4 langkah (profil, info resmi, obat pertama, siap) |
| Notifikasi | ⚠️ Minimal | Hanya toast in-app, tidak ada push/WhatsApp/email |
| Export Data | ⚠️ Parsial | Import CSV ada, tapi export laporan ke Excel/PDF belum lengkap |
| Help Center | ⚠️ Tidak ada | Tidak ada dokumentasi in-app / tooltip kontekstual |
| PWA / Service Worker | ⚠️ Tidak ada | manifest.json ada tapi service worker tidak ada |

---

## 3. Celah Regulasi & Kepatuhan Apotek Indonesia

### 3.1 SIPNAP – Pelaporan Narkotika & Psikotropika [BLOCKER]

**Regulasi:** UU 35/2009 tentang Narkotika, Per-BPOM No. 4/2018 tentang Pengawasan Narkotika  
**Kewajiban:** Setiap apotek yang menyimpan dan/atau mendistribusikan narkotika/psikotropika **WAJIB** melaporkan penggunaan bulanan ke BPOM melalui sistem SIPNAP (sipnap.bpom.go.id) paling lambat tanggal 10 bulan berikutnya.

**Celah yang ada:**
- Tidak ada modul khusus pelaporan SIPNAP
- Tidak ada format laporan sesuai form SIPNAP (Form A untuk narkotika, Form B untuk psikotropika)
- Tidak ada tracking saldo narkotika/psikotropika bulanan (saldo awal + penerimaan - pengeluaran = saldo akhir)
- Tidak ada pengingat deadline laporan SIPNAP

**Rekomendasi:**
```
Modul Baru: Laporan SIPNAP
- Rekap otomatis stok narkotika & psikotropika per bulan
- Format sesuai Form A/B SIPNAP
- Export ke format Excel yang bisa diupload ke portal SIPNAP
- Reminder otomatis H-5 sebelum tanggal 10
- Riwayat pelaporan bulan-bulan sebelumnya
```

**Dampak jika tidak ada:** Apotek bisa dikenai sanksi administrasi s/d pencabutan izin oleh BPOM.

---

### 3.2 Surat Pesanan (SP) Narkotika & Psikotropika Khusus [BLOCKER]

**Regulasi:** Permenkes No. 3/2015 tentang Peredaran, Penyimpanan, Pemusnahan, dan Pelaporan Narkotika  
**Kewajiban:** SP untuk narkotika harus menggunakan form **khusus** (kertas kuning, 3 rangkap) ditandatangani Apoteker Penanggung Jawab (APJ) dengan mencantumkan nomor SIPA. SP psikotropika juga memiliki form tersendiri.

**Celah yang ada:**
- Modul Pengadaan (PurchaseOrderList) tidak membedakan SP biasa vs SP Narkotika/Psikotropika
- Tidak ada form SP sesuai format resmi BPOM
- Tidak ada nomor urut SP otomatis per jenis (SP/NARK/2026/001)
- Tidak ada validasi bahwa SP narkotika hanya bisa dibuat oleh Apoteker

**Rekomendasi:**
```
Update Modul Pengadaan:
- Tambah flag "kategori SP" (biasa / narkotika / psikotropika / OOT)
- Form SP narkotika/psikotropika dengan field wajib sesuai regulasi
- Cetak SP dengan format resmi (termasuk tanda tangan digital APJ)
- Pembatasan: hanya user dengan role apoteker/owner yang bisa buat SP narkotika
- Penomoran SP otomatis per kategori
```

---

### 3.3 Buku Harian Narkotika & Psikotropika [BLOCKER]

**Regulasi:** Per-BPOM No. 4/2018, PMK 3/2015  
**Kewajiban:** Apotek WAJIB menyimpan buku harian penggunaan narkotika dan psikotropika yang mencatat setiap pemasukan dan pengeluaran dengan saldo running.

**Celah yang ada:**
- Meskipun ada audit trail dan stock movement, tidak ada "buku harian" yang bisa dicetak sebagai dokumen resmi
- Format tidak sesuai format buku harian yang diterima saat inspeksi BPOM

**Rekomendasi:**
```
Laporan Baru: Buku Harian Nark/Psikotrop
- Tabel: tanggal | no dokumen | keterangan | masuk | keluar | saldo
- Filter per obat narkotika/psikotropika
- Cetak per bulan (format A4, siap ditunjukkan ke inspektur BPOM)
- Tandatangan APJ di footer
```

---

### 3.4 Prosedur Pemusnahan Obat [BLOCKER]

**Regulasi:** PMK 73/2016 Pasal 15, PMK 3/2015  
**Kewajiban:** Obat rusak, kadaluarsa, atau sisa racikan **harus dimusnahkan** sesuai prosedur:
1. Dibuat Berita Acara Pemusnahan (BAP) yang ditandatangani Apoteker dan saksi
2. Untuk narkotika/psikotropika, disaksikan petugas BPOM/Dinas Kesehatan
3. BAP disimpan minimal 5 tahun

**Celah yang ada:**
- Tidak ada modul pemusnahan obat sama sekali
- `StockMovement.type` ada `expired_removal` tapi hanya sebagai penyesuaian stok, bukan prosedur pemusnahan resmi
- Tidak ada cetak BAP (Berita Acara Pemusnahan)

**Rekomendasi:**
```
Modul Baru: Pemusnahan Obat
- Form pengajuan pemusnahan (pilih obat + batch, jumlah, alasan)
- Workflow: draft → dijadwalkan → dilaksanakan
- Cetak Berita Acara Pemusnahan (format resmi)
- Field: tanggal, penanggung jawab, saksi 1, saksi 2, metode pemusnahan
- Khusus narkotika: alert bahwa harus ada petugas BPOM
- Stok otomatis berkurang setelah BAP disetujui
```

---

### 3.5 Skrining Resep Formal [HIGH]

**Regulasi:** PMK 73/2016 tentang Standar Pelayanan Kefarmasian  
**Kewajiban:** Apoteker wajib melakukan skrining resep secara:
- **Administratif:** kelengkapan tulisan dokter, tanggal, paraf, dll.
- **Farmasetik:** stabilitas, kompatibilitas, dosis, cara pakai
- **Klinis:** indikasi, kontraindikasi, interaksi obat, alergi

**Celah yang ada:**
- Modul Resep ada tapi hanya form input data, tidak ada checklist skrining resep
- Tidak ada pencatatan "hasil skrining" yang bisa diaudit
- Tidak ada peringatan interaksi obat dasar

**Rekomendasi:**
```
Update Modul Resep:
- Tambah tab "Skrining" dengan checklist administratif/farmasetik/klinis
- Field alergi pasien (bisa diisi dari data pelanggan)
- Tanda tangan digital apoteker pada skrining
- Catatan skrining tersimpan dan masuk audit log
```

---

### 3.6 Pelayanan Informasi Obat (PIO) & Konseling [HIGH]

**Regulasi:** PMK 73/2016 Pasal 6-8  
**Kewajiban:** Apotek wajib menyediakan PIO dan konseling bagi pasien. Konseling wajib didokumentasikan untuk obat-obat tertentu (narkotika, psikotropika, obat dengan risiko tinggi, obat dengan indeks terapi sempit).

**Celah yang ada:**
- Tidak ada fitur pencatatan konseling/PIO
- Tidak ada catatan edukasi pasien yang terlink ke transaksi/resep

**Rekomendasi:**
```
Fitur Baru: Catatan Konseling PIO
- Bisa diakses dari halaman Resep atau Pelanggan
- Form: tanggal | pasien | obat | informasi yang disampaikan | tanda tangan pasien (digital)
- Riwayat konseling per pasien
- Ini juga menjadi nilai tambah diferensiasi produk
```

---

### 3.7 Monitoring Efek Samping Obat (MESO) [MEDIUM]

**Regulasi:** PMK 73/2016, Per-BPOM No. 24/2017 tentang Kriteria dan Tata Cara Pengajuan Notifikasi Kosmetika  
**Kewajiban:** Apotek berperan dalam Farmakovigilans – melaporkan MESO ke BPOM jika ditemukan

**Rekomendasi:**
```
Fitur Sederhana: Laporan MESO
- Form laporan MESO yang terlink ke pelanggan/resep
- Generate form e-MESO untuk dilaporkan ke portal BPOM
- Dashboard internal MESO yang pernah dilaporkan
```

---

### 3.8 Kartu Stok Digital Sesuai Regulasi [HIGH] ✅ IMPLEMENTED

**Regulasi:** PMK 73/2016 mewajibkan kartu stok untuk setiap obat  
**Format wajib kartu stok:** Nama obat, bentuk sediaan, kekuatan, no. batch, tanggal kadaluarsa, tanggal penerimaan, jumlah masuk, jumlah keluar, saldo, nama supplier, no. faktur.

**Status:** ✅ Sudah diimplementasikan
- `StockCardModal.tsx` sudah menyimpan dan menampilkan semua field yang diperlukan
- Tombol **Cetak Kartu Stok** ditambahkan pada modal kartu stok
- Format cetak sesuai PMK 73/2016: header apotek, tabel tanggal/keterangan/batch/ED/masuk/keluar
- Blok tanda tangan APJ (Apoteker Penanggung Jawab) di footer

---

### 3.9 Salinan Resep (Apograph/Copy Resep) Resmi [HIGH] ✅ IMPLEMENTED

**Regulasi:** PMK 73/2016, Per-Menkes tentang Standar Pelayanan Kefarmasian  
**Kewajiban:** Apograph (salinan resep) harus ditandatangani oleh Apoteker Penanggung Jawab Apotek (APA) dan mencantumkan:
- Cap/stempel apotek
- Tulisan "Salinan Resep" / "COPY RECIPE"
- "Pro" (nama pasien)
- "det/nedet" (sudah/belum diambil)
- "iter" (iterasi/pengulangan)

**Status:** ✅ Sudah diimplementasikan
- `printApograph` di `receipt.ts` sudah menampilkan det/nedet per item obat
- Field `iter` sudah ditambahkan ke `ApographItem` type dan ditampilkan di HTML
- Nama APJ (Apoteker Penanggung Jawab) + SIPA ditampilkan di blok tanda tangan
- Format "Apoteker Penanggung Jawab" sesuai standar

---

### 3.10 Pengelolaan Obat Rusak / Recall [MEDIUM]

**Regulasi:** Permenkes & Per-BPOM tentang penarikan obat  
**Kewajiban:** Apotek wajib merespons recall BPOM dengan menarik obat dari rak dan melaporkan sisa stok

**Celah yang ada:**
- Tidak ada mekanisme drug recall
- Tidak ada notifikasi recall dari BPOM

**Rekomendasi:**
```
Fitur: Manajemen Recall Obat
- Input nomor recall/peringatan BPOM
- Cari otomatis stok yang terdampak (berdasarkan nama obat + batch)
- Proses karantina obat (pindah ke stok "ditahan")
- Generate laporan stok recall untuk dikirim ke BPOM/distributor
```

---

### 3.11 Kadaluarsa Izin (SIA/SIPA/STRA) Tracking [HIGH]

**Regulasi:** Permenkes No. 9/2017 tentang Apotek  
**Kewajiban:** SIA (Surat Izin Apotek) memiliki masa berlaku, SIPA (Surat Izin Praktik Apoteker) berlaku 5 tahun

**Celah yang ada:**
- Settings sudah ada field SIA/SIPA number, tapi tidak ada tanggal kadaluarsa dan tidak ada reminder

**Rekomendasi:**
```
Update Settings:
- Tambah field: sia_expire_date, sipa_expire_date, stra_expire_date
- Reminder H-90, H-30, H-7 sebelum kadaluarsa
- Banner peringatan di dashboard jika izin hampir/sudah kadaluarsa
- Tidak blokir operasi, tapi alert serius
```

---

### 3.12 Pengeluaran Narkotika Ke Pasien (Bukti Penyerahan) [BLOCKER]

**Regulasi:** Per-BPOM No. 4/2018  
**Kewajiban:** Setiap penyerahan narkotika ke pasien harus ada **tanda terima** dari pasien (nama, NIK, tanda tangan/cap jempol).

**Celah yang ada:**
- Tidak ada form/modal untuk capture tanda terima penyerahan narkotika

**Rekomendasi:**
```
Fitur: Bukti Penyerahan Narkotika
- Muncul otomatis saat checkout mengandung narkotika
- Capture: nama penerima, NIK, hubungan dengan pasien, tanda tangan (digital/upload foto)
- Tersimpan dengan transaksi
- Bisa dicetak
```

---

## 4. Celah Standar SaaS Produk

### 4.1 Payment Gateway Terintegrasi [BLOCKER]

**Status saat ini:** `Billing.tsx` hanya menampilkan toast "hubungi tim MediSir untuk upgrade manual"  
**Standar SaaS:** Pembayaran harus bisa dilakukan mandiri oleh pengguna, 24/7, tanpa intervensi manusia.

**Rekomendasi:**
```
Integrasi Payment Gateway Indonesia:
- Midtrans (paling umum, snap.js sudah mudah diintegrasikan)
  atau Xendit (alternatif dengan lebih banyak metode bayar)
- Metode yang didukung:
  - Virtual Account BCA, BNI, BRI, Mandiri
  - GoPay, OVO, ShopeePay, Dana
  - QRIS
  - Kartu kredit/debit (opsional)
- Webhook untuk update status pembayaran otomatis
- Invoice/kwitansi otomatis via email/WhatsApp
- Prorate untuk upgrade/downgrade di tengah periode
```

**Dampak bisnis:** Tanpa payment gateway, tidak bisa scale. Proses manual adalah bottleneck kritis untuk growth.

---

### 4.2 Onboarding Flow Terstruktur [BLOCKER] ✅ IMPLEMENTED

**Status:** ✅ Sudah diimplementasikan

Wizard 4 langkah diaktifkan otomatis saat owner baru belum mengisi `pharmacy_name`:

```
Langkah 1: Profil Apotek (nama apotek, nama pemilik, alamat, telepon)
Langkah 2: Info Resmi (nomor SIA, nama APJ, nomor SIPA) — opsional, bisa diisi nanti
Langkah 3: Tambah Obat Pertama (nama, kategori, harga jual, stok) — bisa di-skip
Langkah 4: Siap! (ringkasan & langkah selanjutnya)
```

**Fitur:**
- Progress indicator (step bar) dengan ikon per langkah
- Step 2 dan 3 bisa di-skip dengan tombol "Lewati"
- Data profil otomatis disimpan saat lanjut ke step berikutnya
- Step 4 menampilkan panduan langkah selanjutnya (Buka Kasir, Inventaris, Undang Kasir, dll.)
- Komponen: `src/components/OnboardingWizard.tsx`

---

### 4.3 Notifikasi Multi-Channel [HIGH]

**Status saat ini:** Hanya toast in-app  
**Standar SaaS:** Pengguna harus bisa menerima notifikasi meskipun tidak sedang membuka aplikasi.

**Konteks Indonesia:** Email tidak terlalu efektif untuk apotek kecil. **WhatsApp adalah channel notifikasi #1 di Indonesia.**

**Rekomendasi:**
```
Notifikasi yang dibutuhkan:
- WhatsApp (via Fonnte/WA Business API):
  - Stok kritis (obat habis/mendekati minimum)
  - Obat mendekati kadaluarsa
  - Pengingat laporan SIPNAP (tanggal 5 tiap bulan)
  - Reminder perpanjangan izin SIA/SIPA
  - Konfirmasi pembayaran subscription
  - Rekap penjualan harian (jam 21.00)
  
- Email:
  - Invoice subscription
  - Reset password
  - Undangan tim kasir
  
- Push Notification (PWA):
  - Stok kritis real-time
  - Notifikasi dari kasir ke owner
```

---

### 4.4 Progressive Web App (PWA) Penuh [HIGH]

**Status saat ini:** `manifest.json` ada tapi tidak ada service worker  
**Standar:** Apotek kecil sering menggunakan tablet/HP murah, bukan PC. PWA yang bisa diinstall ke homescreen penting.

**Rekomendasi:**
```
Implementasi PWA:
- Service Worker dengan Workbox (caching strategi per route)
- Install prompt ("Tambahkan ke layar utama")
- Offline mode untuk fitur kritis:
  - POS bisa transaksi offline (sudah ada offlineQueue, perlu UI yang lebih baik)
  - Tampilkan daftar obat dari cache terakhir
  - Notifikasi saat kembali online & sync
- Splash screen & icon yang branded
- Ukuran bundle ≤ 500KB untuk koneksi lambat
```

---

### 4.5 Export & Backup Data Mandiri [HIGH]

**Status saat ini:** Import CSV ada, export terbatas  
**Standar SaaS:** Pengguna punya hak atas datanya sendiri (data portability – GDPR-adjacent).

**Rekomendasi:**
```
Fitur Export Lengkap:
- Export Laporan Penjualan ke Excel/CSV (dengan filter tanggal)
- Export Inventaris Obat ke Excel (untuk rekonsiliasi)
- Export Kartu Stok per obat ke PDF
- Export data pelanggan ke CSV
- Export Buku Harian Nark/Psikotrop ke PDF/Excel
- Backup data lengkap (JSON) untuk migrasi

Format prioritas:
- Excel (.xlsx) untuk laporan keuangan → bisa dibuka di HP dengan WPS Office
- PDF untuk dokumen resmi (BAP, kartu stok, buku harian)
- CSV untuk import ke sistem lain
```

---

### 4.6 Multi-Cabang (Multi-Branch) [MEDIUM]

**Status saat ini:** Setiap owner adalah satu apotek  
**Target jangka menengah:** Apotek dengan 2-3 cabang (apotek kecil yang sudah berkembang)

**Rekomendasi:**
```
Arsitektur Multi-Branch:
- Satu akun owner bisa mengelola beberapa cabang
- Laporan konsolidasi semua cabang
- Transfer stok antar cabang
- Kasir bisa di-assign ke cabang tertentu
- Harga jual bisa berbeda per cabang
```

---

### 4.7 Akuntansi Dasar & Laporan Keuangan [HIGH]

**Status saat ini:** Laporan hanya omset dan laba kotor  
**Kebutuhan apotek kecil:** HPP, laba bersih, arus kas, laporan untuk pelaporan pajak

**Rekomendasi:**
```
Laporan Keuangan Sederhana:
- Laporan Laba Rugi (Omset - HPP - Biaya Operasional = Laba Bersih)
- Laporan Arus Kas (Cash Flow)
- Laporan Hutang Dagang (A/P dari PBF)
- Rekap pembelian obat per bulan
- Estimasi PPh Pasal 21 (untuk kasir) & PPh Final (untuk apotek)
- Format yang bisa diekspor untuk akuntan/konsultan pajak
```

---

### 4.8 Trial Experience yang Optimal [HIGH]

**Status saat ini:** Trial ada tapi tidak ada tracking dan guidance khusus  
**Standar SaaS:** Trial period adalah momen paling kritis untuk konversi. Target: first value ≤ 10 menit.

**Rekomendasi:**
```
Trial Optimization:
- Data demo pre-loaded (bisa direset)
  - 50 obat contoh yang umum di apotek
  - 5 transaksi demo
  - 1 resep demo
- Trial counter yang visible: "7 hari tersisa"
- Fitur di-lock dengan preview: "Lihat fitur ini di plan Starter"
- Email drip sequence selama trial (hari 1, 3, 7, 13):
  - Hari 1: "Selamat datang, mulai dari sini"
  - Hari 3: "Coba fitur laporan"
  - Hari 7: "7 hari lagi, ini yang sudah Anda capai"
  - Hari 13: "1 hari lagi, upgrade sekarang dan hemat 2 bulan"
- In-app banner upgrade yang tidak annoying
```

---

### 4.9 Service Level Agreement (SLA) & Status Page [MEDIUM]

**Status saat ini:** Tidak ada SLA resmi  
**Standar SaaS:** Apotek beroperasi 24/7, aplikasi harus punya commitment uptime.

**Rekomendasi:**
```
SLA & Transparency:
- Status page publik (status.medisir.app) menggunakan Statuspage.io atau Better Uptime
- SLA minimal 99.5% uptime per bulan (downtime max ~3.6 jam/bulan)
- Maintenance window yang terjadwal dan dikomunikasikan
- Kompensasi otomatis jika SLA dilanggar (credit hari)
- Notifikasi downtime via WhatsApp/email sebelum maintenance
```

---

### 4.10 Customer Success & Support [MEDIUM]

**Status saat ini:** Tidak ada support in-app  
**Standar SaaS:** Untuk apotek kecil yang tidak melek teknologi, support mudah dijangkau adalah kunci retensi.

**Rekomendasi:**
```
Support Infrastructure:
- Live chat in-app (Crisp/Tawk.to - gratis) dengan jam operasional jelas
- WhatsApp support (sangat familiar untuk apotek kecil di Indonesia)
- Basis pengetahuan/FAQ dalam Bahasa Indonesia
- Video tutorial per modul (YouTube, unlisted)
- Komunitas pengguna (Facebook Group / WhatsApp Group)
- Waktu respons SLA: chat < 2 jam (jam kerja), email < 24 jam
```

---

## 5. Celah UX & Kegunaan untuk Apotek Kecil

### 5.1 Onboarding & Time-to-Value [BLOCKER] ✅ IMPLEMENTED

Sudah dibahas di 4.2. Onboarding wizard sudah diimplementasikan. Apotek kecil akan mendapat panduan 4 langkah saat pertama kali login.

**Metrik target:** Time-to-first-transaction < 20 menit

---

### 5.2 Dukungan Printer Termal [HIGH] ✅ IMPLEMENTED

**Status:** ✅ Sudah diimplementasikan
- Setting **Lebar Kertas Struk** di halaman Pengaturan: 58mm / 80mm / A4
- `receiptWidth` tersimpan di profile user dan dipropagasikan ke `ReceiptData`
- CSS struk menyesuaikan lebar, font size, title size, dan logo size berdasarkan setting
- Default: 58mm (printer termal kecil paling umum di apotek)

**Masih perlu dikembangkan:**
- Option "Auto-print tanpa dialog" (butuh ESC/POS direct printing library)
- QR code transaksi di struk
- Test pada hardware Epson TM-T82

---

### 5.3 Mode Keyboard-First di POS [HIGH] ✅ IMPLEMENTED

**Status:** ✅ Sudah diimplementasikan

```
Keyboard Shortcuts POS (sudah aktif):
- F2:          Fokus ke search obat
- F4:          Toggle scanner barcode
- F8:          Buka checkout / bayar
- Ctrl+Enter:  Buka checkout / bayar (alternatif)
- Esc:         Tutup modal / batal
- ?:           Tampilkan overlay bantuan keyboard shortcuts
```

**Bantuan keyboard:** Tekan `?` di halaman POS untuk melihat daftar shortcut (overlay modal).

---

### 5.4 Manajemen Racikan (Obat Compounding) [HIGH]

**Status saat ini:** Tidak ada  
**Konteks:** Apotek kecil masih banyak yang melayani resep racikan (puyer, kapsul, salep racik). Ini sangat umum di apotek mandiri yang melayani dokter praktek tradisional.

**Rekomendasi:**
```
Fitur Baru: Racikan/Compounding
- Buat formula racikan dari beberapa bahan baku
- Hitung harga racikan (jumlah bahan + biaya racik)
- Stok bahan baku berkurang sesuai formula
- Cetak etiket racikan (nama pasien, aturan pakai, tanggal, nama apotek)
- Template racikan yang sering dibuat (simpan formula)
- Catatan signa di etiket: "3 x sehari 1 bungkus setelah makan"
```

---

### 5.5 Etiket Obat Otomatis [HIGH]

**Regulasi:** PMK 73/2016 mewajibkan penandaan yang jelas pada obat yang diserahkan  
**Status saat ini:** Tidak ada cetak etiket obat

**Rekomendasi:**
```
Fitur: Cetak Etiket Obat
- Generate etiket dari resep/transaksi
- Format: nama pasien, nama obat, dosis, aturan pakai (signa), tanggal, nama apotek
- Ukuran: kecil (label 3x5 cm atau 5x7 cm)
- Dukungan printer label (Dymo, Zebra, atau printer termal)
- Etiket berbeda untuk obat luar (warna biru) vs obat dalam (warna putih)
- QR code/barcode ke nomor resep
```

---

### 5.6 Antrian & Manajemen Pasien [MEDIUM]

**Status saat ini:** Tidak ada  
**Konteks:** Apotek yang melayani resep ramai sering butuh manajemen antrian sederhana

**Rekomendasi:**
```
Fitur Sederhana: Antrian Racikan/Resep
- Nomor antrian per hari (001, 002, ...)
- Status: menunggu | sedang disiapkan | siap diambil
- Display/panggil nomor antrian (bisa ditampilkan di layar TV)
- Notifikasi WA ke pasien bahwa obatnya sudah siap
```

---

### 5.7 Mode Tampilan Sederhana (Simple Mode) [MEDIUM]

**Status saat ini:** UI cukup kompleks untuk pengguna non-teknis  
**Konteks:** Banyak pemilik apotek kecil berusia 40-60 tahun, tidak terlalu melek teknologi

**Rekomendasi:**
```
Toggle "Mode Sederhana":
- Dashboard hanya tampilkan KPI paling penting (omset hari ini, stok kritis)
- POS dengan tampilan lebih besar, lebih sedikit opsi
- Fitur advanced disembunyikan kecuali diaktifkan
- Teks lebih besar, kontras lebih tinggi
- Font default minimal 14px
```

---

### 5.8 Aksesibilitas (a11y) [MEDIUM]

**Status saat ini:** Tidak terlihat ada perhatian khusus a11y  
**Standar:** WCAG 2.1 Level AA sebagai baseline

**Rekomendasi:**
```
Perbaikan Aksesibilitas:
- ARIA labels untuk semua interactive elements
- Keyboard navigation yang konsisten
- Contrast ratio ≥ 4.5:1
- Focus indicator yang jelas
- Alt text untuk gambar/logo
- Screen reader support untuk tabel laporan
```

---

## 6. Celah Integrasi & Ekosistem

### 6.1 Integrasi Database Obat BPOM [HIGH]

**Status saat ini:** Input obat manual sepenuhnya  
**Masalah:** Apotek kecil bisa salah ketik nama/dosis/kategori obat. BPOM memiliki database resmi.

**Rekomendasi:**
```
Integrasi BPOM Drug Database:
- Auto-complete nama obat dari database BPOM saat input
- Auto-fill: kategori, kandungan aktif, bentuk sediaan
- Peringatan jika obat tidak terdaftar di BPOM (obat ilegal)
- Sumber data: cekbpom.pom.go.id API atau scraping periodik
- Update berkala (weekly) dari sumber resmi BPOM

Fallback: Buat internal database obat umum yang bisa dikurasi admin
```

---

### 6.2 Integrasi BPJS / E-Klaim [MEDIUM]

**Konteks:** Banyak apotek kecil (terutama Apotek Mandiri) adalah mitra BPJS Kesehatan Program Rujuk Balik (PRB) atau BPJS Faskes Tingkat 1.

**Kewajiban:** Klaim BPJS memerlukan format khusus yang dikirim ke aplikasi PCare/Vedika.

**Rekomendasi:**
```
Fitur: Manajemen Klaim BPJS
- Input transaksi dengan flag "Pasien BPJS"
- Pilih jenis: Umum / BPJS PRB / BPJS Faskes 1
- Input nomor kartu BPJS & diagnosis
- Generate format klaim sesuai format BPJS
- Tracking status klaim (belum diklaim / sudah diklaim / lunas)
- Rekap klaim per bulan untuk pengajuan ke BPJS
```

---

### 6.3 Integrasi PBF Digital (e-Purchasing) [MEDIUM]

**Konteks:** Distributor farmasi besar (PBF) di Indonesia mulai memiliki platform pemesanan digital (Kimia Farma Trading, Mensa Group, etc.)

**Rekomendasi:**
```
Fitur: Pemesanan Digital ke PBF
- Koneksi ke API PBF (jika tersedia)
- Import faktur/SP dari email atau file PDF/CSV
- Reconcile faktur PBF dengan penerimaan barang
```

---

### 6.4 Integrasi Akuntansi (Jurnal/Accurate) [MEDIUM]

**Konteks:** Apotek yang lebih serius menggunakan software akuntansi terpisah

**Rekomendasi:**
```
Export ke Format Akuntansi:
- Export jurnal harian ke format Accurate Online / Jurnal.id
- Export ke format CSV yang bisa diimpor manual
- Pemetaan akun (Chart of Accounts) yang bisa dikonfigurasi
```

---

### 6.5 WhatsApp Business Integration [HIGH]

**Konteks:** WhatsApp adalah platform komunikasi utama di Indonesia, termasuk untuk bisnis

**Rekomendasi:**
```
WhatsApp Business Features:
- Kirim struk via WhatsApp ke pelanggan (ganti/tambahan kertas)
- Pengingat refill obat kronis ke pelanggan (hipertensi, diabetes)
- Notifikasi stok kritis ke pemilik
- Konfirmasi pesanan racikan ke pelanggan
- Provider: Fonnte (murah), WA Business API, atau Zenziva
```

---

## 7. Celah Keamanan & Privasi Data

### 7.1 Two-Factor Authentication (2FA) [HIGH]

**Status saat ini:** Hanya email + password  
**Risiko:** Akses unauthorized ke data obat narkotika/psikotropika dan data pasien sangat sensitif

**Rekomendasi:**
```
Implementasi 2FA:
- 2FA opsional untuk semua user, wajib untuk owner
- Metode: OTP via WhatsApp/SMS (lebih familiar dari Google Authenticator)
- Backup codes
- Trusted device (30 hari)
- Alert email jika login dari perangkat baru
```

---

### 7.2 Kebijakan Password & Keamanan Akun [HIGH]

**Status saat ini:** Tidak ada password policy yang terlihat

**Rekomendasi:**
```
Password Policy:
- Minimum 8 karakter, kombinasi huruf+angka
- Cek password umum (password123, dll.)
- Notifikasi jika password lemah
- Force password change setelah reset
- Login history (5 login terakhir)
- Session management (lihat & terminate session aktif)
```

---

### 7.3 Kebijakan Privasi & PDPA-Compliant [BLOCKER]

**Regulasi:** UU PDP (UU No. 27/2022 tentang Perlindungan Data Pribadi) yang berlaku mulai Oktober 2024  
**Kewajiban:** Aplikasi yang mengolah data pribadi (nama pasien, NIK, data kesehatan) WAJIB memiliki:
- Kebijakan privasi yang jelas
- Mekanisme persetujuan (consent)
- Hak hapus data (right to erasure)
- Notifikasi pelanggaran data (data breach notification)

**Celah yang ada:**
- Tidak ada halaman Kebijakan Privasi
- Tidak ada halaman Syarat & Ketentuan
- Tidak ada mekanisme consent saat registrasi

**Rekomendasi:**
```
Compliance UU PDP:
- Buat halaman Kebijakan Privasi (Bahasa Indonesia)
- Buat halaman Syarat & Ketentuan
- Tambah consent checkbox saat registrasi
- Fitur "Hapus Data Saya" untuk pengguna yang berhenti berlangganan
- Prosedur internal data breach notification (72 jam ke regulator)
- DPA (Data Processing Agreement) untuk apotek sebagai data processor
```

---

### 7.4 Enkripsi Data Sensitif di Level Aplikasi [MEDIUM]

**Status saat ini:** Enkripsi at-rest via Supabase (PostgreSQL encryption)  
**Saran tambahan:** Data ekstra sensitif (NIK, SIPA) bisa dienkripsi di level aplikasi

**Rekomendasi:**
```
Enkripsi Tambahan:
- Enkripsi NIK pasien di database (pgcrypto atau aplikasi-level)
- Redact NIK di log/response (tampilkan: 340*****1234)
- Enkripsi nomor SIPA di export
```

---

### 7.5 Rate Limiting & DDoS Protection [MEDIUM]

**Status saat ini:** Rate limiting ada di Supabase Auth (5/15 min), tapi tidak ada proteksi tingkat aplikasi

**Rekomendasi:**
```
Proteksi Tambahan:
- Rate limiting di Vercel Edge (middleware)
- CAPTCHA pada form registrasi (hCaptcha - GDPR friendly)
- WAF (Web Application Firewall) via Cloudflare
- DDoS protection via Cloudflare
```

---

## 8. Celah Bisnis & Monetisasi

### 8.1 Model Pricing yang Belum Optimal [HIGH]

**Analisis pricing saat ini:**
| Plan | Harga/bulan | Target |
|------|------------|--------|
| Gratis | Rp 0 | Trial |
| Starter | Rp 99.000 | Apotek kecil |
| Professional | Rp 249.000 | Apotek menengah |
| Enterprise | Rp 499.000 | Jaringan apotek |

**Masalah:**
- Tidak ada differensiasi yang jelas antara Gratis dan Starter
- Harga Professional terlalu jauh dari Starter (2.5x) tanpa opsi tengah
- Tidak ada model "per-transaksi" untuk apotek yang sangat kecil

**Rekomendasi:**
```
Revisi Pricing:
Plan Gratis: Batasi 30 obat, 100 transaksi/bulan, tanpa laporan, 1 kasir
Plan Starter (Rp 99K): 200 obat, 500 transaksi/bulan, laporan dasar, 2 kasir
Plan Professional (Rp 199K): Unlimited obat, unlimited transaksi, semua laporan, 5 kasir, SIPNAP
Plan Enterprise (Rp 399K): Multi-cabang, API, dedicated support, SLA 99.9%

Tambah:
- Tahunan hemat 2 bulan (bayar 10, dapat 12)
- Promo 3 bulan gratis untuk apotek baru
- Referral program: dapat 1 bulan gratis per referral yang convert
```

---

### 8.2 Customer Success Metrics & Churn Prevention [HIGH]

**Status saat ini:** Tidak ada health score atau early warning churn

**Rekomendasi:**
```
Customer Health Score:
- Hitung weekly health score per apotek:
  - Login aktif (0-30 poin)
  - Transaksi terbuat (0-30 poin)
  - Fitur digunakan (0-20 poin)
  - Support ticket (0-20 poin)
- Alert ke CS jika health score < 40 selama 2 minggu
- Automated re-engagement email/WA

Churn Indicators:
- Tidak login > 7 hari → kirim WA "Ada yang bisa kami bantu?"
- Transaksi turun > 50% dari baseline → follow up CS
- Gagal perpanjang → penawaran diskon 30 hari
```

---

### 8.3 Affiliate / Referral Program [MEDIUM]

**Konteks:** Apotek kecil punya jaringan kuat antar sesama (komunitas apoteker, IAI chapter lokal)

**Rekomendasi:**
```
Program Referral:
- Kode referral unik per apotek
- Referrer dapat: 1 bulan gratis per konversi
- Referred dapat: 1 bulan gratis ekstra di akhir trial
- Dashboard referral sederhana
- Pembayaran referral otomatis via kredit akun
```

---

### 8.4 Sertifikasi & Trust Signals [HIGH]

**Status saat ini:** Tidak ada sertifikasi atau trust signal yang terlihat

**Rekomendasi:**
```
Trust Signals untuk Apotek Indonesia:
- Sertifikasi IAI (Ikatan Apoteker Indonesia) - minta endorsement
- Review di Google Business / App Store
- Testimonial apotek pilot dengan nama dan foto nyata
- Case study: "Apotek X hemat 2 jam/hari dengan MediSir"
- Logo sertifikasi keamanan (SSL, ISO 27001 jangka panjang)
- Cantumkan nama tim di website (bukan anonymous SaaS)
```

---

## 9. Matriks Prioritas & Roadmap

### 9.1 Prioritas Berdasarkan Impact vs Effort

```
IMPACT TINGGI, EFFORT RENDAH (Quick Wins - Lakukan Segera):
✅ Tracking kadaluarsa SIA/SIPA dengan reminder
✅ Export laporan ke Excel/CSV
✅ Cetak etiket obat sederhana
✅ Kebijakan Privasi & Syarat Ketentuan
✅ Onboarding wizard 4 langkah

IMPACT TINGGI, EFFORT SEDANG (Core Features - Sprint 1-3):
🔧 Payment gateway (Midtrans)
✅ Modul SIPNAP (laporan narkotika/psikotropika)
🔧 SP Narkotika/Psikotropika khusus
🔧 Notifikasi WhatsApp (stok kritis, kadaluarsa, reminder SIPNAP)
🔧 PWA dengan service worker
✅ Racikan/compounding sederhana
✅ Printer termal support (58mm/80mm/A4 configurable)

IMPACT TINGGI, EFFORT TINGGI (Strategic - Sprint 4-8):
⬜ Integrasi database BPOM
⬜ Modul BPJS/klaim
✅ Pemusnahan obat (BAP)
✅ Buku harian narkotika/psikotropika
✅ Skrining resep formal
✅ Laporan keuangan (P&L, hutang dagang)
✅ Konseling & PIO documentation

IMPACT SEDANG, EFFORT RENDAH (Nice to Have - Backlog):
✅ Keyboard shortcuts POS (F2/F4/F8/Ctrl+Enter/Esc/? help overlay)
⬜ Mode sederhana (simple mode)
⬜ Antrian sederhana
⬜ Referral program
⬜ Customer health score
```

### 9.2 Roadmap 12 Bulan

```
BULAN 1-2: Foundation (Pre-Launch Blockers)
─────────────────────────────────────────
□ Payment gateway Midtrans terintegrasi
✅ Kebijakan Privasi & Syarat Ketentuan (UU PDP compliant)
✅ Onboarding wizard
□ Modul SIPNAP (export form A/B)
□ SP Narkotika/Psikotropika khusus
✅ Export laporan ke Excel
✅ Tracking kadaluarsa SIA/SIPA

BULAN 3-4: Compliance & Core UX
─────────────────────────────────────────
□ Pemusnahan obat + BAP
✅ Buku harian narkotika/psikotropika (cetak resmi)
✅ Bukti penyerahan narkotika ke pasien
✅ Kartu stok sesuai PMK 73/2016 (verifikasi + cetak)
✅ Etiket obat & racikan
□ Notifikasi WhatsApp (stok kritis, reminder)
✅ Printer termal support (58mm/80mm/A4)
□ 2FA (OTP WhatsApp)

BULAN 5-6: SaaS Maturity
─────────────────────────────────────────
□ PWA penuh dengan service worker
✅ Skrining resep formal (checklist)
✅ PIO/Konseling documentation
□ Status page & SLA resmi
✅ Laporan keuangan sederhana (P&L, hutang dagang)
□ In-app help center (Bahasa Indonesia)
□ Trial optimization (data demo, email drip)

BULAN 7-9: Growth Features
─────────────────────────────────────────
□ Integrasi database BPOM (autocomplete)
□ BPJS/klaim management
□ Drug recall management
□ Referral program
□ Customer health score & churn prevention
□ MESO reporting

BULAN 10-12: Scale
─────────────────────────────────────────
□ Multi-cabang (multi-branch)
□ Integrasi akuntansi (Jurnal.id/Accurate export)
□ Antrian pasien
□ API publik (untuk integrasi pihak ketiga)
□ ISO 27001 preparation
```

---

## 10. Estimasi Sumber Daya

### 10.1 Tim Minimum untuk Komersialisasi

| Peran | Jumlah | Keterangan |
|-------|--------|------------|
| Full-stack Developer | 2 | React/TypeScript + Supabase/PostgreSQL |
| Product Manager | 1 | Berpengalaman dengan apotek atau farmasi |
| Customer Success | 1 | Berbicara Bahasa Indonesia, paham apotek |
| QA Engineer | 1 | Manual + automated testing |
| Advisor Apoteker | 1 | Konsultan regulasi (bisa part-time) |

### 10.2 Estimasi Waktu Pengembangan Fitur Prioritas

| Fitur | Estimasi Dev | Kompleksitas |
|-------|-------------|--------------|
| Payment gateway (Midtrans) | 3-5 hari | Sedang |
| Onboarding wizard | 3-4 hari | Rendah |
| Modul SIPNAP | 5-7 hari | Sedang |
| SP Narkotika/Psikotropika | 3-4 hari | Rendah |
| Pemusnahan obat + BAP | 4-5 hari | Sedang |
| Export Excel | 2-3 hari | Rendah |
| Notifikasi WhatsApp | 3-4 hari | Sedang |
| Printer termal CSS | 2-3 hari | Rendah |
| PWA + service worker | 5-7 hari | Sedang |
| 2FA OTP | 3-5 hari | Sedang |
| **Total Blocker Items** | **~6-8 minggu** | |

### 10.3 Biaya Operasional Bulanan (Estimasi)

| Layanan | Biaya/bulan (USD) |
|---------|------------------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Sentry (error monitoring) | $26 |
| Midtrans (% transaksi) | Variabel |
| Fonnte (WhatsApp) | ~$10 |
| Statuspage/Betteruptime | $0-29 |
| **Total Fixed Cost** | **~$80-110/bulan** |

**Break-even:** ~10-12 apotek Starter plan sudah menutup biaya infrastruktur.

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Kemungkinan | Mitigasi |
|--------|--------|-------------|---------|
| Inspeksi BPOM menemukan apotek menggunakan software tidak comply | Tinggi | Sedang | Prioritaskan SIPNAP & SP Narkotika sebelum go-live |
| Data pasien bocor (breach) | Sangat Tinggi | Rendah | 2FA, enkripsi NIK, enkripsi at-rest, DPA |
| Supabase downtime → apotek tidak bisa transaksi | Tinggi | Rendah | PWA offline mode, offlineQueue sudah ada |
| Payment gateway gagal | Tinggi | Rendah | Fallback manual, Midtrans > 99.9% uptime |
| Apotek tidak mau bayar (churn tinggi) | Tinggi | Sedang | Onboarding baik, customer success, harga sesuai |
| Kompetitor (Farmapos, iapotik, dll.) | Sedang | Tinggi | Diferensiasi di compliance + UX untuk apotek kecil |
| Regulasi berubah | Sedang | Sedang | Advisory board apoteker, monitor PMK/Per-BPOM |
| Kualitas internet apotek pelosok rendah | Sedang | Tinggi | PWA offline-first, kompresi aset, CDN |

---

## 12. Kesimpulan & Rekomendasi

### Penilaian Kesiapan Komersialisasi (Saat Ini)

| Dimensi | Skor | Keterangan |
|---------|------|------------|
| Fungsionalitas POS Inti | 8/10 | Kuat, FEFO, offline, shift |
| Kepatuhan Regulasi | 7/10 | SIPNAP, Buku Harian, Skrining, PIO, Etiket, Racikan ✅ |
| UX untuk Apotek Kecil | 7/10 | Onboarding, printer termal, racikan, konseling ✅ |
| Kematangan SaaS | 5/10 | Payment gateway belum, help center belum |
| Keamanan & Privasi | 6/10 | Tidak ada 2FA, tidak ada UU PDP compliance |
| Integrasi Ekosistem | 3/10 | Sangat terbatas |
| **Overall** | **6.0/10** | Siap go-live terbatas; payment gateway & 2FA masih diperlukan |

### Rekomendasi Urutan Tindakan

**Minggu 1-2 (Blocker Hukum):**
1. Buat halaman Kebijakan Privasi & ToS (UU PDP compliance)
2. Tambah consent checkbox di registrasi
3. Mulai desain modul SIPNAP

**Minggu 3-4 (Blocker Operasional):**
4. Integrasi Midtrans untuk payment
5. Modul SIPNAP (export form A/B)
6. SP Narkotika/Psikotropika form khusus
7. Export laporan ke Excel

**Minggu 5-6 (Blocker Pengalaman Pengguna):**
8. Onboarding wizard 4 langkah
9. Support printer termal (CSS 58/80mm)
10. Tracking kadaluarsa SIA/SIPA

**Bulan 2 (Kepatuhan Lanjutan):**
11. Pemusnahan obat + BAP
12. Buku harian narkotika (format resmi cetak)
13. Notifikasi WhatsApp (stok kritis, SIPNAP reminder)
14. 2FA via OTP WhatsApp/SMS

**Bulan 3 (Siap Pilot):**
15. PWA service worker
16. Etiket obat & racikan dasar
17. Skrining resep checklist
18. Pilot launch 5-10 apotek

### Pesan Kunci

> MediSir memiliki **fondasi teknis yang solid** – arsitektur multi-tenant, FEFO, audit trail, dan compliance resep sudah lebih baik dari rata-rata kompetitor lokal. Namun, untuk apotek kecil di Indonesia, **kepatuhan regulasi BPOM (terutama narkotika/psikotropika) adalah non-negotiable**. Seorang apoteker yang menggunakan software tanpa modul SIPNAP berisiko terkena sanksi dari BPOM.
>
> Investasi 6-8 minggu pada 12 item blocker di atas akan mengubah MediSir dari **"aplikasi POS yang bagus"** menjadi **"sistem manajemen apotek yang bisa dipercaya secara regulasi"** – dan itu adalah nilai jual yang sangat kuat untuk apotek mandiri di Indonesia.

---

*Dokumen ini disiapkan berdasarkan analisis kode MediSir versi Maret 2026, PMK 73/2016, PP 51/2009, UU 35/2009, Per-BPOM No. 4/2018, dan UU PDP No. 27/2022.*  
*Perlu direview oleh Apoteker berlisensi sebelum dijadikan dasar implementasi fitur regulasi.*
