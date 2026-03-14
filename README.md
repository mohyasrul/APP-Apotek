# MediSir POS — Aplikasi Kasir & Manajemen Stok Apotek

Aplikasi SaaS kasir (Point of Sale) dan manajemen stok untuk apotek modern Indonesia. Dibangun dengan React + TypeScript + Supabase.

## Fitur Utama

| Modul | Fitur |
|---|---|
| **Kasir / POS** | Scan barcode, diskon per-item & global, multi-metode bayar (tunai/QRIS/transfer), cetak struk thermal 58mm, kirim struk via WhatsApp |
| **Stok Obat** | CRUD obat, server-side search & pagination, restock, import CSV (batch), export Excel, riwayat gerakan stok |
| **Laporan** | Omzet, laba kotor, riwayat transaksi, void transaksi, export CSV, filter periode |
| **Resep Digital** | Buat & kelola resep, validasi `valid_until`, tebus langsung ke POS |
| **Pelanggan** | CRUD pelanggan, statistik belanja, WhatsApp dari profil |
| **Multi-Kasir** | Undang kasir via kode 8 karakter, kasir akses data owner otomatis via RLS |
| **Pengaturan** | Logo apotek, info SIA/SIPA, tim kasir, log aktivitas |
| **PWA** | Dapat di-install ke homescreen, service worker untuk offline basic |

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **State:** Zustand (cart POS, persist localStorage)
- **Icons:** @phosphor-icons/react
- **Charts:** Recharts
- **Forms:** uncontrolled state (react-hook-form tersedia untuk extension)
- **Barcode:** html5-qrcode (kamera)
- **CSV:** PapaParse

## Setup & Instalasi

### Prasyarat
- Node.js >= 18
- Akun Supabase (gratis)

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd aplikasi-saas-apotek
npm install
```

### 2. Setup environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` dan isi dengan kredensial Supabase Anda:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Nilai didapat dari: **Supabase Dashboard → Project Settings → API**

### 3. Setup database Supabase

Jalankan semua file migration secara berurutan di **Supabase SQL Editor**:

```
supabase/migrations/20240311_init_schema.sql
supabase/migrations/20240312_schema_improvements.sql
supabase/migrations/20260312_mvp_features.sql
supabase/migrations/20260312_fase3_features.sql
supabase/migrations/20260313_p0_p1_fixes.sql
supabase/migrations/20260313_p2_features.sql
```

### 4. Setup Supabase Storage

Di Supabase Dashboard → **Storage**, buat bucket baru:
- Nama: `pharmacy-assets`
- Public: ✅ (ya, public)

### 5. Aktifkan Realtime

Di Supabase Dashboard → **Database → Replication**, aktifkan realtime untuk tabel:
- `medicines` (untuk sync stok multi-kasir di POS)

### 6. Jalankan development server

```bash
npm run dev
```

Buka `http://localhost:5173`

## Struktur Proyek

```
src/
├── App.tsx           # Router + lazy loading + ProtectedRoute
├── main.tsx          # Entry point + SW registration
├── pages/
│   ├── Dashboard.tsx   # KPI cards + chart penjualan
│   ├── POS.tsx         # Kasir utama
│   ├── Medicines.tsx   # Manajemen stok + import/export
│   ├── Laporan.tsx     # Laporan & void transaksi
│   ├── Resep.tsx       # Resep digital
│   ├── Customers.tsx   # Manajemen pelanggan
│   ├── Settings.tsx    # Pengaturan apotek + tim + audit log
│   └── Login.tsx       # Auth (sign in / sign up / reset)
├── components/
│   ├── ErrorBoundary.tsx
│   ├── SessionTimeout.tsx
│   └── layout/
│       ├── TopNavigation.tsx
│       └── MobileBottomNav.tsx
└── lib/
    ├── AuthContext.tsx  # Session, profile, effectiveUserId
    ├── store.ts         # Zustand POS cart (persisted)
    ├── supabase.ts      # Supabase client
    ├── types.ts         # Shared types + utilities
    ├── receipt.ts       # Print & WhatsApp struk
    └── utils.ts         # cn() helper
```

## Model Multi-Tenant

Setiap apotek punya `user_id` sendiri. Kasir terhubung ke owner via `pharmacy_owner_id`.
Semua query menggunakan `get_effective_user_id()` (PostgreSQL function) agar data kasir
otomatis mengakses data owner-nya.

**Alur undang kasir:**
1. Owner buka Settings → Tim Kasir → Undang Kasir → masukkan email kasir
2. Kode 8 karakter muncul — kirim ke kasir
3. Kasir daftar akun baru (dengan email yang sama), lalu masukkan kode di Settings → Masukkan Kode

## Build untuk Production

```bash
npm run build
```

Output di `dist/`. Deploy ke Vercel, Netlify, atau host statis apapun.

> **Catatan:** Set environment variables di platform hosting Anda (bukan di `.env.local`).

## Database Schema

Tabel utama:
- `users` — profil apotek + kasir
- `medicines` — master obat
- `transactions` + `transaction_items` — transaksi POS
- `stock_movements` — audit trail stok
- `prescriptions` + `prescription_items` — resep digital
- `customers` — data pelanggan
- `invitations` — undangan kasir
- `audit_logs` — log aktivitas CRUD
- `medicine_alternatives` — obat pengganti
- `transaction_counters` — sequence nomor nota (thread-safe)

Semua tabel dilindungi **Row Level Security (RLS)**.
