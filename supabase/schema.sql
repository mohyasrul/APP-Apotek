-- ============================================================
-- MediSir POS – Supabase Database Schema
-- Jalankan file ini di Supabase SQL Editor (Settings → SQL Editor)
-- Urutan eksekusi sudah diurutkan agar FK dapat dibuat dengan benar.
-- ============================================================

-- ── 0. Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Untuk pencarian obat lebih cepat

-- ============================================================
-- BAGIAN 1: TABEL INTI (Core Tables)
-- ============================================================

-- ── 1.1 Profil Pengguna (Users / Profiles) ───────────────────────────────────
-- Tabel ini meng-extend auth.users milik Supabase.
-- Satu owner bisa memiliki banyak kasir (cashier) melalui pharmacy_owner_id.
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT        NOT NULL DEFAULT '',
  pharmacy_name       TEXT        NOT NULL DEFAULT '',
  pharmacy_address    TEXT,
  phone               TEXT,
  logo_url            TEXT,
  role                TEXT        NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'cashier')),
  sia_number          TEXT,
  sipa_number         TEXT,
  apoteker_name       TEXT,
  sia_expiry_date     DATE,
  sipa_expiry_date    DATE,
  stra_expiry_date    DATE,
  receipt_width       TEXT        DEFAULT '58mm' CHECK (receipt_width IN ('58mm', '80mm', 'A4')),
  pharmacy_owner_id   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.users IS 'Profil pengguna apotek (owner & kasir). Satu baris per auth.users.';
COMMENT ON COLUMN public.users.pharmacy_owner_id IS 'NULL = user ini adalah owner. Berisi id owner jika user adalah kasir.';

-- ── 1.2 Obat (Medicines) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medicines (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'umum'
                              CHECK (category IN ('bebas','bebas_terbatas','keras','narkotika','psikotropika','vitamin','alkes','umum','resep')),
  barcode         TEXT,
  buy_price       NUMERIC(15,2) NOT NULL DEFAULT 0,
  sell_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
  stock           INTEGER     NOT NULL DEFAULT 0,
  unit            TEXT        NOT NULL DEFAULT 'tablet',
  supplier        TEXT,
  batch_number    TEXT,
  min_stock       INTEGER     NOT NULL DEFAULT 0,
  expiry_date     DATE        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.medicines IS 'Katalog obat per apotek (user_id = owner ID).';

-- ── 1.3 Pelanggan (Customers) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.customers IS 'Data pelanggan tetap apotek.';

-- ── 1.4 Resep Dokter (Prescriptions) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prescription_number TEXT        NOT NULL,
  patient_name        TEXT        NOT NULL,
  patient_age         INTEGER,
  doctor_name         TEXT        NOT NULL,
  doctor_sip          TEXT,
  prescription_date   DATE        NOT NULL,
  valid_until         DATE,
  notes               TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'dispensed', 'cancelled')),
  transaction_id      UUID,       -- FK ditambahkan setelah tabel transactions dibuat
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.prescriptions IS 'Data resep dari dokter.';

-- ── 1.5 Item Resep (Prescription Items) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id    UUID        NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medicine_name      TEXT        NOT NULL,
  medicine_id        UUID        REFERENCES public.medicines(id) ON DELETE SET NULL,
  signa              TEXT,
  quantity           INTEGER     NOT NULL DEFAULT 1,
  dispensed_quantity INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.prescription_items IS 'Item obat dalam satu resep dokter.';

-- ── 1.6 Transaksi Penjualan (Transactions) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_number   TEXT,
  total_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_total       NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method       TEXT          NOT NULL DEFAULT 'cash'
                                     CHECK (payment_method IN ('cash', 'qris', 'transfer')),
  notes                TEXT,
  status               TEXT          NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active', 'voided')),
  voided_at            TIMESTAMPTZ,
  void_reason          TEXT,
  prescription_id      UUID          REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  customer_name        TEXT,
  customer_phone       TEXT,
  customer_id          UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.transactions IS 'Header transaksi penjualan POS.';

-- Tambahkan FK dari prescriptions ke transactions (setelah transactions dibuat)
DO $add_fk$ BEGIN
  ALTER TABLE public.prescriptions
    ADD CONSTRAINT fk_prescriptions_transaction
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $add_fk$;

-- ── 1.7 Item Transaksi (Transaction Items) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transaction_items (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id          UUID          NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  medicine_id             UUID          NOT NULL REFERENCES public.medicines(id) ON DELETE RESTRICT,
  quantity                INTEGER       NOT NULL DEFAULT 1,
  price_at_transaction    NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.transaction_items IS 'Detail obat dalam satu transaksi penjualan.';

-- ============================================================
-- BAGIAN 2: INVENTORI & STOK
-- ============================================================

-- ── 2.1 Batch Obat (Medicine Batches) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medicine_batches (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id  UUID          NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  user_id      UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  batch_number TEXT          NOT NULL,
  expiry_date  DATE          NOT NULL,
  quantity     INTEGER       NOT NULL DEFAULT 0,
  buy_price    NUMERIC(15,2) NOT NULL DEFAULT 0,
  received_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  supplier     TEXT,
  notes        TEXT
);
COMMENT ON TABLE public.medicine_batches IS 'Batch/lot obat untuk traceability FEFO (First Expired First Out).';

-- ── 2.2 Pergerakan Stok (Stock Movements) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicine_id  UUID        NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  batch_id     UUID        REFERENCES public.medicine_batches(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL
               CHECK (type IN ('sale', 'restock', 'adjustment', 'expired_removal', 'void_return')),
  quantity     INTEGER     NOT NULL,
  reference_id UUID,       -- ID transaksi/PO/opname terkait (generic)
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.stock_movements IS 'Log setiap perubahan stok obat (masuk/keluar/koreksi).';
COMMENT ON COLUMN public.stock_movements.batch_id IS 'FK ke medicine_batches untuk join di Kartu Stok.';
COMMENT ON COLUMN public.stock_movements.reference_id IS 'ID dokumen terkait (transaction, PO, stock opname, dsb).';

-- ── 2.3 Stock Opname (Sesi) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opname_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'in_progress', 'completed', 'approved')),
  approved_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at  TIMESTAMPTZ,
  notes        TEXT,
  created_by   UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.stock_opnames IS 'Sesi stock opname (penghitungan fisik stok).';

-- ── 2.4 Item Stock Opname ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  opname_id      UUID    NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  medicine_id    UUID    NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  system_stock   INTEGER NOT NULL DEFAULT 0,
  physical_stock INTEGER NOT NULL DEFAULT 0,
  difference     INTEGER GENERATED ALWAYS AS (physical_stock - system_stock) STORED,
  notes          TEXT
);
COMMENT ON TABLE public.stock_opname_items IS 'Detail obat dalam satu sesi stock opname.';

-- ── 2.5 Alternatif Obat (Medicine Alternatives) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.medicine_alternatives (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  medicine_id     UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  alternative_id  UUID NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  UNIQUE (medicine_id, alternative_id)
);
COMMENT ON TABLE public.medicine_alternatives IS 'Pasangan obat yang bisa saling menggantikan (two-way).';

-- ============================================================
-- BAGIAN 3: PENGADAAN & KEUANGAN
-- ============================================================

-- ── 3.1 Supplier / PBF ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  email       TEXT
);
COMMENT ON TABLE public.suppliers IS 'Data Pedagang Besar Farmasi (PBF) / supplier obat.';

-- ── 3.2 Surat Pesanan / Purchase Orders ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id  UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supplier_id  UUID          NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_number TEXT          NOT NULL UNIQUE,
  order_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  order_type   TEXT          NOT NULL DEFAULT 'reguler'
               CHECK (order_type IN ('reguler', 'narkotika', 'psikotropika', 'mendesak', 'lainnya')),
  status       TEXT          NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.purchase_orders IS 'Surat Pesanan ke PBF (SP Reguler, SP Narkotika, dsb).';

-- ── 3.3 Item Surat Pesanan ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id           UUID          NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  medicine_id     UUID          NOT NULL REFERENCES public.medicines(id) ON DELETE RESTRICT,
  quantity        INTEGER       NOT NULL DEFAULT 0,
  unit            TEXT          NOT NULL,
  estimated_price NUMERIC(15,2) NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.purchase_order_items IS 'Detail obat dalam satu Surat Pesanan.';

-- ── 3.4 Faktur PBF (Accounts Payable Invoice) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pbf_invoices (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id    UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supplier_id    UUID          NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  po_id          UUID          REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  invoice_number TEXT          NOT NULL,
  invoice_date   DATE          NOT NULL,
  due_date       DATE          NOT NULL,
  total_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid    NUMERIC(15,2) NOT NULL DEFAULT 0,
  status         TEXT          NOT NULL DEFAULT 'unpaid'
                 CHECK (status IN ('unpaid', 'partial', 'paid')),
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, invoice_number)
);
COMMENT ON TABLE public.pbf_invoices IS 'Faktur hutang dari PBF (Accounts Payable).';

-- ── 3.5 Pembayaran Faktur PBF ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pbf_invoice_payments (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id     UUID          NOT NULL REFERENCES public.pbf_invoices(id) ON DELETE CASCADE,
  payment_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  amount         NUMERIC(15,2) NOT NULL,
  payment_method TEXT          NOT NULL DEFAULT 'transfer',
  notes          TEXT,
  created_by     UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.pbf_invoice_payments IS 'Riwayat pembayaran per faktur PBF.';

-- ── 3.6 Buku Defecta ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.defecta_books (
  id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id    UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  medicine_id    UUID    NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  recorded_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
  status         TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'ordered')),
  required_stock INTEGER NOT NULL DEFAULT 0,
  current_stock  INTEGER NOT NULL DEFAULT 0,
  notes          TEXT
);
COMMENT ON TABLE public.defecta_books IS 'Buku defecta: catatan obat yang habis/perlu dipesan.';

-- ============================================================
-- BAGIAN 4: KEPATUHAN & REGULASI (Compliance)
-- ============================================================

-- ── 4.1 Laporan MESO ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meso_reports (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tanggal           DATE        NOT NULL,
  patient_name      TEXT        NOT NULL,
  patient_age       TEXT,
  patient_gender    TEXT        CHECK (patient_gender IN ('laki-laki', 'perempuan')),
  medicine_name     TEXT        NOT NULL,
  batch_number      TEXT,
  indication        TEXT        NOT NULL,
  reaction          TEXT        NOT NULL,
  severity          TEXT        NOT NULL DEFAULT 'ringan'
                    CHECK (severity IN ('ringan', 'sedang', 'berat', 'mengancam_jiwa')),
  onset             TEXT        NOT NULL,
  action_taken      TEXT        NOT NULL,
  outcome           TEXT        NOT NULL,
  reported_to_bpom  BOOLEAN     NOT NULL DEFAULT FALSE,
  reporter_name     TEXT        NOT NULL,
  catatan           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.meso_reports IS 'Laporan MESO (Monitoring Efek Samping Obat) ke BPOM.';

-- ── 4.2 Formula Racikan ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.racikan_formula (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nama_racikan    TEXT          NOT NULL,
  jenis           TEXT          NOT NULL DEFAULT 'puyer'
                  CHECK (jenis IN ('puyer', 'kapsul', 'krim', 'salep', 'sirup', 'lainnya')),
  jumlah_bungkus  INTEGER       NOT NULL DEFAULT 10,
  signa           TEXT          NOT NULL,
  notes           TEXT,
  biaya_racik     NUMERIC(15,2) NOT NULL DEFAULT 0,
  ingredients     JSONB         NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.racikan_formula IS 'Formula racikan (puyer/kapsul/krim/dll) untuk pembuatan obat.';
COMMENT ON COLUMN public.racikan_formula.ingredients IS 'Array JSON: [{medicine_id, medicine_name, qty_per_bungkus, unit}]';

-- ── 4.3 Catatan Konseling PIO ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.konseling_pio (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tanggal             DATE        NOT NULL,
  patient_name        TEXT        NOT NULL,
  patient_phone       TEXT,
  prescription_number TEXT,
  medicines           TEXT        NOT NULL,
  informasi           TEXT        NOT NULL,
  catatan             TEXT,
  petugas             TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.konseling_pio IS 'Catatan konseling dan Pelayanan Informasi Obat (PIO).';

-- ============================================================
-- BAGIAN 5: AUTH, TIM & AUDIT
-- ============================================================

-- ── 5.1 Undangan Kasir (Invitations) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email      TEXT,
  role       TEXT        NOT NULL DEFAULT 'cashier' CHECK (role IN ('cashier')),
  code       TEXT        NOT NULL UNIQUE,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.invitations IS 'Link undangan untuk menambah kasir ke apotek.';

-- ── 5.2 Audit Log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type TEXT        NOT NULL,
  entity_id   UUID,
  entity_name TEXT,
  severity    TEXT        NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  actor_role  TEXT,
  before_data JSONB,
  after_data  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail semua aksi penting di sistem.';

-- ── 5.3 Shift Kasir (Cashier Shifts) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  cashier_id    UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pharmacy_id   UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        TEXT          NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  start_time    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  end_time      TIMESTAMPTZ,
  opening_cash  NUMERIC(15,2) NOT NULL DEFAULT 0,
  closing_cash  NUMERIC(15,2),
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.cashier_shifts IS 'Manajemen shift kasir (buka/tutup kasir).';

-- ============================================================
-- BAGIAN 6: SaaS SUBSCRIPTION
-- ============================================================

-- ── 6.1 Paket Langganan (Subscription Plans) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                        TEXT          NOT NULL UNIQUE,
  description                 TEXT          NOT NULL DEFAULT '',
  price_monthly               NUMERIC(15,2) NOT NULL DEFAULT 0,
  price_yearly                NUMERIC(15,2) NOT NULL DEFAULT 0,
  max_medicines               INTEGER,      -- NULL = tidak terbatas
  max_transactions_per_month  INTEGER,      -- NULL = tidak terbatas
  max_kasir                   INTEGER       NOT NULL DEFAULT 1,
  max_customers               INTEGER,      -- NULL = tidak terbatas
  features                    JSONB         NOT NULL DEFAULT '[]'::jsonb,
  is_active                   BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order                  INTEGER       NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.subscription_plans IS 'Paket harga SaaS MediSir.';
COMMENT ON COLUMN public.subscription_plans.features IS 'Array string nama fitur yang tersedia di paket ini.';

-- ── 6.2 Langganan Aktif (Subscriptions) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id              UUID        NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status               TEXT        NOT NULL DEFAULT 'trialing'
                       CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  billing_cycle        TEXT        NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  trial_ends_at        TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  grace_ends_at        TIMESTAMPTZ,
  medicines_count      INTEGER     NOT NULL DEFAULT 0,
  transactions_count   INTEGER     NOT NULL DEFAULT 0,
  kasir_count          INTEGER     NOT NULL DEFAULT 0,
  customers_count      INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.subscriptions IS 'Langganan aktif tiap owner apotek.';

-- ============================================================
-- BAGIAN 7: INDEXES (untuk performa query)
-- ============================================================

-- medicines
CREATE INDEX IF NOT EXISTS idx_medicines_user_id      ON public.medicines(user_id);
CREATE INDEX IF NOT EXISTS idx_medicines_category      ON public.medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_name_trgm     ON public.medicines USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medicines_expiry        ON public.medicines(expiry_date);
CREATE INDEX IF NOT EXISTS idx_medicines_stock         ON public.medicines(stock);

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id   ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created   ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status    ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_customer  ON public.transactions(customer_id);

-- transaction_items
CREATE INDEX IF NOT EXISTS idx_trx_items_transaction  ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_trx_items_medicine     ON public.transaction_items(medicine_id);

-- prescriptions
CREATE INDEX IF NOT EXISTS idx_prescriptions_user     ON public.prescriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status   ON public.prescriptions(status);

-- prescription_items
CREATE INDEX IF NOT EXISTS idx_prx_items_prescription ON public.prescription_items(prescription_id);

-- customers
CREATE INDEX IF NOT EXISTS idx_customers_user_id      ON public.customers(user_id);

-- stock_movements
CREATE INDEX IF NOT EXISTS idx_stockmov_medicine     ON public.stock_movements(medicine_id);
CREATE INDEX IF NOT EXISTS idx_stockmov_user         ON public.stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stockmov_created      ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stockmov_batch        ON public.stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_stockmov_type         ON public.stock_movements(type);

-- medicine_batches
CREATE INDEX IF NOT EXISTS idx_batches_medicine      ON public.medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry        ON public.medicine_batches(expiry_date);

-- stock_opnames
CREATE INDEX IF NOT EXISTS idx_opnames_user          ON public.stock_opnames(user_id);

-- suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_pharmacy    ON public.suppliers(pharmacy_id);

-- purchase_orders
CREATE INDEX IF NOT EXISTS idx_po_pharmacy           ON public.purchase_orders(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier           ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_created            ON public.purchase_orders(created_at DESC);

-- pbf_invoices
CREATE INDEX IF NOT EXISTS idx_invoices_pharmacy     ON public.pbf_invoices(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier     ON public.pbf_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON public.pbf_invoices(status);

-- defecta_books
CREATE INDEX IF NOT EXISTS idx_defecta_pharmacy      ON public.defecta_books(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_defecta_status        ON public.defecta_books(status);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_user            ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created         ON public.audit_logs(created_at DESC);

-- cashier_shifts
CREATE INDEX IF NOT EXISTS idx_shifts_cashier        ON public.cashier_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_pharmacy       ON public.cashier_shifts(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status         ON public.cashier_shifts(status);

-- subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user    ON public.subscriptions(user_id);

-- meso_reports
CREATE INDEX IF NOT EXISTS idx_meso_user             ON public.meso_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_meso_tanggal          ON public.meso_reports(tanggal DESC);

-- racikan_formula
CREATE INDEX IF NOT EXISTS idx_racikan_user          ON public.racikan_formula(user_id);

-- konseling_pio
CREATE INDEX IF NOT EXISTS idx_konseling_user        ON public.konseling_pio(user_id);

-- ============================================================
-- BAGIAN 8: ROW LEVEL SECURITY (RLS)
-- Setiap apotek hanya bisa melihat/mengubah data miliknya sendiri.
-- ============================================================

ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opnames        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pbf_invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pbf_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defecta_books        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meso_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.racikan_formula      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.konseling_pio        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_shifts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions        ENABLE ROW LEVEL SECURITY;

-- Helper function: dapatkan effective user ID (owner ID untuk kasir, diri sendiri untuk owner)
CREATE OR REPLACE FUNCTION public.get_effective_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT pharmacy_owner_id FROM public.users WHERE id = auth.uid()),
    auth.uid()
  );
$$;

-- ── RLS: users ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users: baca profil sendiri dan tim" ON public.users;
CREATE POLICY "users: baca profil sendiri dan tim" ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR pharmacy_owner_id = auth.uid()
    OR id = (SELECT pharmacy_owner_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "users: update profil sendiri" ON public.users;
CREATE POLICY "users: update profil sendiri" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users: insert profil baru" ON public.users;
CREATE POLICY "users: insert profil baru" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

-- ── RLS: medicines ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "medicines: akses apotek sendiri" ON public.medicines;
CREATE POLICY "medicines: akses apotek sendiri" ON public.medicines
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: customers ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "customers: akses apotek sendiri" ON public.customers;
CREATE POLICY "customers: akses apotek sendiri" ON public.customers
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: prescriptions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "prescriptions: akses apotek sendiri" ON public.prescriptions;
CREATE POLICY "prescriptions: akses apotek sendiri" ON public.prescriptions
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: prescription_items ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "prescription_items: akses via prescription" ON public.prescription_items;
CREATE POLICY "prescription_items: akses via prescription" ON public.prescription_items
  FOR ALL USING (
    prescription_id IN (
      SELECT id FROM public.prescriptions WHERE user_id = public.get_effective_user_id()
    )
  );

-- ── RLS: transactions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "transactions: akses apotek sendiri" ON public.transactions;
CREATE POLICY "transactions: akses apotek sendiri" ON public.transactions
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: transaction_items ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "transaction_items: akses via transaction" ON public.transaction_items;
CREATE POLICY "transaction_items: akses via transaction" ON public.transaction_items
  FOR ALL USING (
    transaction_id IN (
      SELECT id FROM public.transactions WHERE user_id = public.get_effective_user_id()
    )
  );

-- ── RLS: medicine_batches ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "medicine_batches: akses apotek sendiri" ON public.medicine_batches;
CREATE POLICY "medicine_batches: akses apotek sendiri" ON public.medicine_batches
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: stock_movements ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stock_movements: akses apotek sendiri" ON public.stock_movements;
CREATE POLICY "stock_movements: akses apotek sendiri" ON public.stock_movements
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: stock_opnames ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stock_opnames: akses apotek sendiri" ON public.stock_opnames;
CREATE POLICY "stock_opnames: akses apotek sendiri" ON public.stock_opnames
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: stock_opname_items ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "stock_opname_items: akses via opname" ON public.stock_opname_items;
CREATE POLICY "stock_opname_items: akses via opname" ON public.stock_opname_items
  FOR ALL USING (
    opname_id IN (
      SELECT id FROM public.stock_opnames WHERE user_id = public.get_effective_user_id()
    )
  );

-- ── RLS: medicine_alternatives ────────────────────────────────────────────────
DROP POLICY IF EXISTS "medicine_alternatives: akses apotek sendiri" ON public.medicine_alternatives;
CREATE POLICY "medicine_alternatives: akses apotek sendiri" ON public.medicine_alternatives
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: suppliers ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "suppliers: akses apotek sendiri" ON public.suppliers;
CREATE POLICY "suppliers: akses apotek sendiri" ON public.suppliers
  FOR ALL USING (pharmacy_id = public.get_effective_user_id());

-- ── RLS: purchase_orders ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchase_orders: akses apotek sendiri" ON public.purchase_orders;
CREATE POLICY "purchase_orders: akses apotek sendiri" ON public.purchase_orders
  FOR ALL USING (pharmacy_id = public.get_effective_user_id());

-- ── RLS: purchase_order_items ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchase_order_items: akses via PO" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items: akses via PO" ON public.purchase_order_items
  FOR ALL USING (
    po_id IN (
      SELECT id FROM public.purchase_orders WHERE pharmacy_id = public.get_effective_user_id()
    )
  );

-- ── RLS: pbf_invoices ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pbf_invoices: akses apotek sendiri" ON public.pbf_invoices;
CREATE POLICY "pbf_invoices: akses apotek sendiri" ON public.pbf_invoices
  FOR ALL USING (pharmacy_id = public.get_effective_user_id());

-- ── RLS: pbf_invoice_payments ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "pbf_invoice_payments: akses via invoice" ON public.pbf_invoice_payments;
CREATE POLICY "pbf_invoice_payments: akses via invoice" ON public.pbf_invoice_payments
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM public.pbf_invoices WHERE pharmacy_id = public.get_effective_user_id()
    )
  );

-- ── RLS: defecta_books ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "defecta_books: akses apotek sendiri" ON public.defecta_books;
CREATE POLICY "defecta_books: akses apotek sendiri" ON public.defecta_books
  FOR ALL USING (pharmacy_id = public.get_effective_user_id());

-- ── RLS: meso_reports ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "meso_reports: akses apotek sendiri" ON public.meso_reports;
CREATE POLICY "meso_reports: akses apotek sendiri" ON public.meso_reports
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: racikan_formula ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "racikan_formula: akses apotek sendiri" ON public.racikan_formula;
CREATE POLICY "racikan_formula: akses apotek sendiri" ON public.racikan_formula
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: konseling_pio ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "konseling_pio: akses apotek sendiri" ON public.konseling_pio;
CREATE POLICY "konseling_pio: akses apotek sendiri" ON public.konseling_pio
  FOR ALL USING (user_id = public.get_effective_user_id());

-- ── RLS: invitations ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "invitations: owner bisa lihat undangannya" ON public.invitations;
CREATE POLICY "invitations: owner bisa lihat undangannya" ON public.invitations
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "invitations: owner bisa buat undangan" ON public.invitations;
CREATE POLICY "invitations: owner bisa buat undangan" ON public.invitations
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "invitations: owner bisa hapus undangannya" ON public.invitations;
CREATE POLICY "invitations: owner bisa hapus undangannya" ON public.invitations
  FOR DELETE USING (owner_id = auth.uid());

-- Siapa saja (anon) bisa baca token undangan untuk validasi join
DROP POLICY IF EXISTS "invitations: siapa saja bisa baca token" ON public.invitations;
CREATE POLICY "invitations: siapa saja bisa baca token" ON public.invitations
  FOR SELECT USING (used_at IS NULL AND expires_at > NOW());

-- ── RLS: audit_logs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_logs: baca log sendiri" ON public.audit_logs;
CREATE POLICY "audit_logs: baca log sendiri" ON public.audit_logs
  FOR SELECT USING (user_id = public.get_effective_user_id());

DROP POLICY IF EXISTS "audit_logs: insert log sendiri" ON public.audit_logs;
CREATE POLICY "audit_logs: insert log sendiri" ON public.audit_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Audit logs tidak boleh di-update atau delete
DROP POLICY IF EXISTS "audit_logs: tidak boleh update" ON public.audit_logs;
CREATE POLICY "audit_logs: tidak boleh update" ON public.audit_logs
  FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS "audit_logs: tidak boleh delete" ON public.audit_logs;
CREATE POLICY "audit_logs: tidak boleh delete" ON public.audit_logs
  FOR DELETE USING (FALSE);

-- ── RLS: cashier_shifts ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cashier_shifts: akses apotek sendiri" ON public.cashier_shifts;
CREATE POLICY "cashier_shifts: akses apotek sendiri" ON public.cashier_shifts
  FOR ALL USING (pharmacy_id = public.get_effective_user_id());

-- ── RLS: subscription_plans ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "subscription_plans: semua bisa baca" ON public.subscription_plans;
CREATE POLICY "subscription_plans: semua bisa baca" ON public.subscription_plans
  FOR SELECT USING (is_active = TRUE);

-- ── RLS: subscriptions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "subscriptions: baca milik sendiri" ON public.subscriptions;
CREATE POLICY "subscriptions: baca milik sendiri" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- BAGIAN 9: DATABASE TRIGGERS
-- ============================================================

-- Trigger: otomatis isi/update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_medicines_updated_at
  BEFORE UPDATE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_stock_opnames_updated_at
  BEFORE UPDATE ON public.stock_opnames
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_pbf_invoices_updated_at
  BEFORE UPDATE ON public.pbf_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: otomatis update amount_paid dan status di pbf_invoices setelah ada pembayaran
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_invoice_id    UUID;
  v_total_paid    NUMERIC;
  v_total_amount  NUMERIC;
  v_new_status    TEXT;
BEGIN
  -- Pada DELETE, NEW adalah NULL; gunakan OLD.invoice_id
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.pbf_invoice_payments
  WHERE invoice_id = v_invoice_id;

  SELECT total_amount INTO v_total_amount
  FROM public.pbf_invoices
  WHERE id = v_invoice_id;

  IF v_total_paid >= v_total_amount THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'unpaid';
  END IF;

  UPDATE public.pbf_invoices
  SET amount_paid = v_total_paid,
      status = v_new_status,
      updated_at = NOW()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER trg_invoice_payment_update
  AFTER INSERT OR UPDATE OR DELETE ON public.pbf_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();

-- ============================================================
-- BAGIAN 10: RPC FUNCTIONS
-- Fungsi-fungsi yang dipanggil langsung dari frontend via supabase.rpc()
-- ============================================================

-- ── 10.1 get_dashboard_metrics ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_user_id   UUID,
  p_start_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_revenue NUMERIC;
  v_laba NUMERIC;
  v_trx_count INTEGER;
  v_low_stock INTEGER;
  v_expiring INTEGER;
BEGIN
  -- Total pendapatan periode
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_revenue
  FROM public.transactions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND created_at >= p_start_date;

  -- Hitung laba (pendapatan - HPP)
  SELECT COALESCE(SUM(
    (ti.price_at_transaction - COALESCE(m.buy_price, 0)) * ti.quantity - ti.discount_amount
  ), 0)
  INTO v_laba
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.medicines m ON m.id = ti.medicine_id
  WHERE t.user_id = p_user_id
    AND t.status = 'active'
    AND t.created_at >= p_start_date;

  -- Jumlah transaksi
  SELECT COUNT(*)
  INTO v_trx_count
  FROM public.transactions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND created_at >= p_start_date;

  -- Obat stok rendah
  SELECT COUNT(*)
  INTO v_low_stock
  FROM public.medicines
  WHERE user_id = p_user_id
    AND stock <= min_stock;

  -- Obat mendekati kadaluarsa (dalam 90 hari)
  SELECT COUNT(*)
  INTO v_expiring
  FROM public.medicines
  WHERE user_id = p_user_id
    AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days';

  v_result := jsonb_build_object(
    'revenue', v_revenue,
    'laba', v_laba,
    'trx_count', v_trx_count,
    'low_stock_count', v_low_stock,
    'expiring_count', v_expiring
  );

  RETURN v_result;
END;
$$;

-- ── 10.2 get_top_selling ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_top_selling(
  p_start_date DATE,
  p_limit      INTEGER DEFAULT 5
)
RETURNS TABLE (
  medicine_id   UUID,
  medicine_name TEXT,
  unit          TEXT,
  total_qty     BIGINT,
  total_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS medicine_id,
    m.name AS medicine_name,
    m.unit,
    SUM(ti.quantity) AS total_qty,
    SUM(ti.quantity * ti.price_at_transaction - ti.discount_amount) AS total_revenue
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.medicines m ON m.id = ti.medicine_id
  WHERE t.user_id = public.get_effective_user_id()
    AND t.status = 'active'
    AND t.created_at >= p_start_date
  GROUP BY m.id, m.name, m.unit
  ORDER BY total_qty DESC
  LIMIT p_limit;
END;
$$;

-- ── 10.3 get_total_laba ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_total_laba(
  p_user_id    UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_laba NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    (ti.price_at_transaction - COALESCE(m.buy_price, 0)) * ti.quantity - ti.discount_amount
  ), 0)
  INTO v_laba
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.medicines m ON m.id = ti.medicine_id
  WHERE t.user_id = p_user_id
    AND t.status = 'active'
    AND t.created_at::date BETWEEN p_start_date AND p_end_date;

  RETURN v_laba;
END;
$$;

-- ── 10.4 increment_stock ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_stock(
  p_medicine_id UUID,
  p_quantity    INTEGER,
  p_user_id     UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.medicines
  SET stock = stock + p_quantity,
      updated_at = NOW()
  WHERE id = p_medicine_id
    AND user_id = p_user_id;

  INSERT INTO public.stock_movements (medicine_id, user_id, type, quantity, notes)
  VALUES (p_medicine_id, p_user_id, 'restock', p_quantity, 'Restock manual');
END;
$$;

-- ── 10.5 process_checkout ─────────────────────────────────────────────────────
-- Transaksi atomik: buat transaksi + item + kurangi stok + catat movement
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_user_id        UUID,
  p_cart           JSONB,      -- [{medicine_id, quantity, price, discount, signa, allocations?}]
  p_payment_method TEXT,
  p_discount_total NUMERIC,
  p_total_amount   NUMERIC,
  p_notes          TEXT DEFAULT NULL,
  p_customer_name  TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_id    UUID DEFAULT NULL,
  p_prescription_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trx_id        UUID;
  v_trx_number    TEXT;
  v_item          JSONB;
  v_medicine_id   UUID;
  v_qty           INTEGER;
  v_price         NUMERIC;
  v_discount      NUMERIC;
  v_current_stock INTEGER;
BEGIN
  -- Generate nomor transaksi: TRX/YYYY/MM/NNNN
  SELECT 'TRX/' || TO_CHAR(NOW(), 'YYYY/MM/') ||
         LPAD(COALESCE(
           (SELECT COUNT(*) + 1 FROM public.transactions
            WHERE user_id = p_user_id
              AND created_at >= DATE_TRUNC('month', NOW())), 1)::TEXT, 4, '0')
  INTO v_trx_number;

  -- Insert header transaksi
  INSERT INTO public.transactions (
    user_id, transaction_number, total_amount, discount_total,
    payment_method, notes, status, customer_name, customer_phone, customer_id, prescription_id
  ) VALUES (
    p_user_id, v_trx_number, p_total_amount, p_discount_total,
    p_payment_method, p_notes, 'active', p_customer_name, p_customer_phone, p_customer_id, p_prescription_id
  )
  RETURNING id INTO v_trx_id;

  -- Loop per item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart)
  LOOP
    v_medicine_id := (v_item->>'medicine_id')::UUID;
    v_qty         := (v_item->>'quantity')::INTEGER;
    v_price       := (v_item->>'price')::NUMERIC;
    v_discount    := COALESCE((v_item->>'discount')::NUMERIC, 0);

    -- Cek stok
    SELECT stock INTO v_current_stock
    FROM public.medicines
    WHERE id = v_medicine_id
    FOR UPDATE;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk obat id %', v_medicine_id;
    END IF;

    -- Insert item transaksi
    INSERT INTO public.transaction_items (
      transaction_id, medicine_id, quantity, price_at_transaction, discount_amount
    ) VALUES (v_trx_id, v_medicine_id, v_qty, v_price, v_discount);

    -- Kurangi stok
    UPDATE public.medicines
    SET stock = stock - v_qty, updated_at = NOW()
    WHERE id = v_medicine_id;

    -- Catat pergerakan stok
    INSERT INTO public.stock_movements (
      medicine_id, user_id, type, quantity, reference_id, notes
    ) VALUES (
      v_medicine_id, p_user_id, 'sale', -v_qty, v_trx_id,
      'Penjualan ' || v_trx_number
    );
  END LOOP;

  -- Update status resep jika ada
  IF p_prescription_id IS NOT NULL THEN
    UPDATE public.prescriptions
    SET status = 'dispensed', transaction_id = v_trx_id, updated_at = NOW()
    WHERE id = p_prescription_id;
  END IF;

  RETURN jsonb_build_object(
    'transaction_id', v_trx_id,
    'transaction_number', v_trx_number
  );
END;
$$;

-- ── 10.6 void_transaction ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_transaction(
  p_transaction_id UUID,
  p_void_reason    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_user_id UUID;
BEGIN
  -- Verifikasi transaksi milik pengguna aktif
  SELECT user_id INTO v_user_id
  FROM public.transactions
  WHERE id = p_transaction_id
    AND user_id = public.get_effective_user_id()
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan atau sudah dibatalkan';
  END IF;

  -- Kembalikan stok untuk setiap item
  FOR v_item IN
    SELECT medicine_id, quantity FROM public.transaction_items
    WHERE transaction_id = p_transaction_id
  LOOP
    UPDATE public.medicines
    SET stock = stock + v_item.quantity, updated_at = NOW()
    WHERE id = v_item.medicine_id;

    INSERT INTO public.stock_movements (
      medicine_id, user_id, type, quantity, reference_id, notes
    ) VALUES (
      v_item.medicine_id, v_user_id, 'void_return', v_item.quantity,
      p_transaction_id, 'Void transaksi: ' || p_void_reason
    );
  END LOOP;

  -- Tandai transaksi sebagai void
  UPDATE public.transactions
  SET status = 'voided',
      voided_at = NOW(),
      void_reason = p_void_reason
  WHERE id = p_transaction_id;
END;
$$;

-- ── 10.7 approve_stock_opname ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_stock_opname(
  p_opname_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := public.get_effective_user_id();

  -- Verifikasi opname milik user
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_opnames
    WHERE id = p_opname_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Stock opname tidak ditemukan';
  END IF;

  -- Terapkan penyesuaian stok untuk setiap item yang berbeda
  FOR v_item IN
    SELECT medicine_id, physical_stock, difference
    FROM public.stock_opname_items
    WHERE opname_id = p_opname_id
      AND difference != 0
  LOOP
    UPDATE public.medicines
    SET stock = v_item.physical_stock, updated_at = NOW()
    WHERE id = v_item.medicine_id;

    INSERT INTO public.stock_movements (
      medicine_id, user_id, type, quantity, reference_id, notes
    ) VALUES (
      v_item.medicine_id, v_user_id, 'adjustment', v_item.difference,
      p_opname_id, 'Stock opname adjustment'
    );
  END LOOP;

  -- Update status opname
  UPDATE public.stock_opnames
  SET status = 'approved',
      approved_by = v_user_id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_opname_id;
END;
$$;

-- ── 10.8 get_fefo_preview ─────────────────────────────────────────────────────
-- Preview alokasi batch FEFO (First Expired First Out) untuk POS
CREATE OR REPLACE FUNCTION public.get_fefo_preview(
  p_medicine_id UUID,
  p_user_id     UUID,
  p_qty_needed  INTEGER
)
RETURNS TABLE (
  batch_id     UUID,
  batch_number TEXT,
  expiry_date  DATE,
  quantity     INTEGER,
  allocated    INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining INTEGER := p_qty_needed;
  v_batch RECORD;
  v_alloc INTEGER;
BEGIN
  FOR v_batch IN
    SELECT id, batch_number, expiry_date, quantity
    FROM public.medicine_batches
    WHERE medicine_id = p_medicine_id
      AND user_id = p_user_id
      AND quantity > 0
      AND expiry_date >= CURRENT_DATE
    ORDER BY expiry_date ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := LEAST(v_batch.quantity, v_remaining);
    v_remaining := v_remaining - v_alloc;

    batch_id     := v_batch.id;
    batch_number := v_batch.batch_number;
    expiry_date  := v_batch.expiry_date;
    quantity     := v_batch.quantity;
    allocated    := v_alloc;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ── 10.9 get_subscription_info ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_subscription_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_sub RECORD;
  v_plan RECORD;
  v_result JSONB;
BEGIN
  v_owner_id := public.get_effective_user_id();

  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE user_id = v_owner_id;

  IF NOT FOUND THEN
    -- Tidak ada subscription → kembalikan free plan default
    RETURN jsonb_build_object(
      'subscription', NULL,
      'plan', NULL
    );
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  v_result := jsonb_build_object(
    'subscription', row_to_json(v_sub),
    'plan', row_to_json(v_plan)
  );

  RETURN v_result;
END;
$$;

-- ── 10.10 check_entitlement ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_entitlement(p_feature TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_plan RECORD;
  v_sub RECORD;
BEGIN
  v_owner_id := public.get_effective_user_id();

  SELECT s.*, sp.features, sp.max_medicines, sp.max_transactions_per_month, sp.max_kasir, sp.max_customers
  INTO v_sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.user_id = v_owner_id;

  IF NOT FOUND THEN
    -- Free / no subscription → akses terbatas
    RETURN jsonb_build_object('allowed', true, 'plan', 'free');
  END IF;

  -- Cek status langganan
  IF v_sub.status NOT IN ('trialing', 'active') THEN
    -- Grace period check
    IF v_sub.grace_ends_at IS NOT NULL AND v_sub.grace_ends_at > NOW() THEN
      RETURN jsonb_build_object('allowed', true, 'grace_period', true, 'status', v_sub.status);
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'Langganan tidak aktif', 'status', v_sub.status);
  END IF;

  -- Cek apakah fitur ada di plan
  IF v_sub.features ? p_feature THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  RETURN jsonb_build_object('allowed', false, 'reason', 'Fitur tidak tersedia di paket Anda');
END;
$$;

-- ── 10.11 create_invite_link ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invite_link(
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id    UUID;
  v_invite_code TEXT;
  v_token       TEXT;
  v_invite_id   UUID;
BEGIN
  v_owner_id := auth.uid();

  -- Verifikasi caller adalah owner
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_owner_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Hanya owner yang bisa membuat undangan';
  END IF;

  -- Generate kode 6 karakter dan token UUID
  v_invite_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
  v_token       := gen_random_uuid()::TEXT;

  INSERT INTO public.invitations (owner_id, email, role, code, token, expires_at)
  VALUES (v_owner_id, p_email, 'cashier', v_invite_code, v_token, NOW() + INTERVAL '7 days')
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'invitation_id', v_invite_id,
    'code', v_invite_code,
    'token', v_token
  );
END;
$$;

-- ── 10.12 get_invite_preview ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
  v_owner RECORD;
  v_email_obfuscated TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Undangan tidak valid atau sudah kadaluarsa';
  END IF;

  SELECT full_name, pharmacy_name, logo_url INTO v_owner
  FROM public.users WHERE id = v_inv.owner_id;

  -- Obfuscate email: "ku***@gmail.com" — safe untuk email pendek sekalipun
  IF v_inv.email IS NOT NULL AND v_inv.email LIKE '%@%' THEN
    v_email_obfuscated :=
      SUBSTRING(v_inv.email, 1, LEAST(2, LENGTH(SPLIT_PART(v_inv.email, '@', 1))))
      || '***@' || SPLIT_PART(v_inv.email, '@', 2);
  END IF;

  RETURN jsonb_build_object(
    'pharmacy_name', v_owner.pharmacy_name,
    'owner_name', v_owner.full_name,
    'logo_url', v_owner.logo_url,
    'email', v_email_obfuscated,
    'expires_at', v_inv.expires_at
  );
END;
$$;

-- ── 10.13 accept_invite_by_token ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invite_by_token(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token undangan tidak valid atau sudah digunakan';
  END IF;

  -- Tandai undangan sebagai sudah dipakai
  UPDATE public.invitations
  SET used_at = NOW()
  WHERE id = v_inv.id;

  -- Update profil kasir dengan pharmacy_owner_id
  UPDATE public.users
  SET pharmacy_owner_id = v_inv.owner_id,
      role = 'cashier',
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- ── 10.14 remove_kasir ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_kasir(p_kasir_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifikasi caller adalah owner dari kasir tersebut
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_kasir_id
      AND pharmacy_owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Kasir tidak ditemukan atau bukan milik Anda';
  END IF;

  -- Lepas kasir dari apotek (tidak hapus akun)
  UPDATE public.users
  SET pharmacy_owner_id = NULL,
      role = 'owner',       -- Kembalikan ke role owner (bisa buka apotek sendiri)
      updated_at = NOW()
  WHERE id = p_kasir_id;
END;
$$;

-- ── 10.15 revoke_invitation ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.invitations
  WHERE id = p_invitation_id
    AND owner_id = auth.uid();
END;
$$;

-- ============================================================
-- BAGIAN 11: STORAGE BUCKET
-- ============================================================

-- Buat bucket untuk logo dan aset apotek
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pharmacy-assets',
  'pharmacy-assets',
  TRUE,
  5242880,    -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Izinkan user yang terautentikasi meng-upload ke folder miliknya
DROP POLICY IF EXISTS "pharmacy-assets: upload milik sendiri" ON storage.objects;
CREATE POLICY "pharmacy-assets: upload milik sendiri"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pharmacy-assets'
    AND auth.uid()::TEXT = (SPLIT_PART(name, '/', 1))
  );

-- Izinkan user meng-update/hapus file miliknya
DROP POLICY IF EXISTS "pharmacy-assets: update milik sendiri" ON storage.objects;
CREATE POLICY "pharmacy-assets: update milik sendiri"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pharmacy-assets'
    AND auth.uid()::TEXT = (SPLIT_PART(name, '/', 1))
  );

DROP POLICY IF EXISTS "pharmacy-assets: delete milik sendiri" ON storage.objects;
CREATE POLICY "pharmacy-assets: delete milik sendiri"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pharmacy-assets'
    AND auth.uid()::TEXT = (SPLIT_PART(name, '/', 1))
  );

-- Bucket publik → siapa saja bisa baca (untuk logo apotek yang ditampilkan ke publik)
DROP POLICY IF EXISTS "pharmacy-assets: publik bisa baca" ON storage.objects;
CREATE POLICY "pharmacy-assets: publik bisa baca"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pharmacy-assets');

-- ============================================================
-- BAGIAN 12: SEED DATA
-- ============================================================

-- Paket Langganan MediSir
INSERT INTO public.subscription_plans
  (id, name, description, price_monthly, price_yearly, max_medicines, max_transactions_per_month, max_kasir, max_customers, features, is_active, sort_order)
VALUES
  (
    uuid_generate_v4(),
    'Gratis',
    'Untuk apotek yang baru mulai. Cocok untuk dicoba.',
    0, 0,
    50, 100, 1, 50,
    '["pos", "medicines", "customers_basic"]'::jsonb,
    TRUE, 0
  ),
  (
    uuid_generate_v4(),
    'Starter',
    'Untuk apotek kecil dengan kebutuhan dasar.',
    149000, 1490000,
    200, 500, 2, 200,
    '["pos", "medicines", "customers", "prescriptions", "laporan_basic", "export_csv"]'::jsonb,
    TRUE, 1
  ),
  (
    uuid_generate_v4(),
    'Professional',
    'Untuk apotek yang berkembang. Semua fitur compliance.',
    299000, 2990000,
    NULL, NULL, 5, NULL,
    '["pos", "medicines", "customers", "prescriptions", "laporan_lengkap", "export_csv", "export_excel", "stock_opname", "pengadaan", "sipnap", "meso", "racikan", "konseling", "audit_log", "multi_kasir"]'::jsonb,
    TRUE, 2
  ),
  (
    uuid_generate_v4(),
    'Enterprise',
    'Untuk jaringan apotek. Dukungan prioritas.',
    599000, 5990000,
    NULL, NULL, 20, NULL,
    '["pos", "medicines", "customers", "prescriptions", "laporan_lengkap", "export_csv", "export_excel", "stock_opname", "pengadaan", "sipnap", "meso", "racikan", "konseling", "audit_log", "multi_kasir", "api_access", "priority_support", "custom_branding"]'::jsonb,
    TRUE, 3
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SELESAI
-- Jalankan script ini satu kali di Supabase SQL Editor.
-- Jika ada error karena tabel/policy sudah ada, gunakan
-- IF NOT EXISTS dan ON CONFLICT yang sudah disertakan.
-- ============================================================
