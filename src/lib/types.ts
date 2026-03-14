// ============================================
// Shared Type Definitions for MediSir POS
// ============================================

export type Medicine = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  barcode?: string | null;
  buy_price: number;
  sell_price: number;
  stock: number;
  unit: string;            // tablet, strip, botol, box, tube, sachet
  supplier?: string | null;
  batch_number?: string | null;
  min_stock: number;
  expiry_date: string;
  created_at?: string;
  updated_at?: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  total_amount: number;
  discount_total: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  created_at: string;
  // MVP fields
  transaction_number?: string | null;    // TRX/YYYY/MM/NNNN
  status?: 'active' | 'voided';          // default: active
  voided_at?: string | null;
  void_reason?: string | null;
  prescription_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_id?: string | null;
  // Joined
  transaction_items?: TransactionItem[];
};

export type TransactionItem = {
  id: string;
  transaction_id: string;
  medicine_id: string;
  quantity: number;
  price_at_transaction: number;
  discount_amount: number;
  created_at?: string;
  // Joined
  medicines?: Pick<Medicine, 'name' | 'buy_price' | 'unit'>;
};

export type ProcessedTransaction = Transaction & {
  laba: number;
  itemsCount: number;
};

export type UserProfile = {
  id: string;
  full_name: string;
  pharmacy_name: string;
  pharmacy_address?: string;
  phone?: string | null;
  logo_url?: string | null;
  role: 'owner' | 'cashier';
  sia_number?: string | null;
  sipa_number?: string | null;
  apoteker_name?: string | null;
  sia_expiry_date?: string | null;
  sipa_expiry_date?: string | null;
  stra_expiry_date?: string | null;
  /** Jika kasir, ini adalah ID user owner apoteknya. NULL = user ini adalah owner. */
  pharmacy_owner_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TeamMember = {
  id: string;
  full_name: string;
  pharmacy_name: string;
  role: 'owner' | 'cashier';
  pharmacy_owner_id?: string | null;
  created_at?: string;
};

export type Invitation = {
  id: string;
  owner_id: string;
  email: string | null;
  role: 'cashier';
  code: string;
  token: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
};

export type InvitePreview = {
  pharmacy_name: string;
  owner_name: string;
  logo_url: string | null;
  email: string | null;   // obfuscated, e.g. "ku***@gmail.com"
  expires_at: string;
};

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type StockMovement = {
  id: string;
  medicine_id: string;
  user_id: string;
  type: 'sale' | 'restock' | 'adjustment' | 'expired_removal' | 'void_return';
  quantity: number;
  reference_id?: string | null;
  notes?: string | null;
  created_at: string;
  // Joined
  medicines?: Pick<Medicine, 'name' | 'unit'>;
};

export type PrescriptionStatus = 'pending' | 'dispensed' | 'cancelled';

export type Prescription = {
  id: string;
  user_id: string;
  prescription_number: string;   // No. resep dari dokter
  patient_name: string;
  patient_age?: number | null;
  doctor_name: string;
  doctor_sip?: string | null;
  prescription_date: string;
  notes?: string | null;
  status: PrescriptionStatus;
  transaction_id?: string | null;
  valid_until?: string | null;
  created_at: string;
  updated_at?: string;
  // Joined
  prescription_items?: PrescriptionItem[];
};

export type PrescriptionItem = {
  id: string;
  prescription_id: string;
  medicine_name: string;         // nama obat dari dokter
  medicine_id?: string | null;   // matched ke medicines table
  signa?: string | null;         // aturan pakai
  quantity: number;
  dispensed_quantity: number;
  created_at?: string;
  // Joined
  medicines?: Pick<Medicine, 'name' | 'sell_price' | 'unit' | 'stock' | 'expiry_date'>;
};

export type PaymentMethod = 'cash' | 'qris' | 'transfer';

export type DateFilterType = 'today' | 'week' | 'month' | 'all';

// Utility: check expiry status
export function getExpiryStatus(dateStr: string | null | undefined): 'expired' | 'near-expiry' | 'safe' {
  if (!dateStr) return 'safe';
  const expiryDate = new Date(dateStr);
  if (isNaN(expiryDate.getTime())) return 'safe';
  const today = new Date();
  const diffMs = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 90) return 'near-expiry';
  return 'safe';
}

// Utility: check license/permit expiry status with configurable thresholds
export function getLicenseExpiryStatus(dateStr: string | null | undefined): {
  status: 'expired' | 'critical' | 'warning' | 'safe';
  daysRemaining: number | null;
  label: string;
} {
  if (!dateStr) return { status: 'safe', daysRemaining: null, label: 'Belum diisi' };
  const expiryDate = new Date(dateStr);
  if (isNaN(expiryDate.getTime())) return { status: 'safe', daysRemaining: null, label: 'Tanggal tidak valid' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  const diffMs = expiryDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) return { status: 'expired', daysRemaining, label: `Sudah kadaluarsa ${Math.abs(daysRemaining)} hari lalu` };
  if (daysRemaining <= 30) return { status: 'critical', daysRemaining, label: `Kadaluarsa dalam ${daysRemaining} hari` };
  if (daysRemaining <= 90) return { status: 'warning', daysRemaining, label: `Kadaluarsa dalam ${daysRemaining} hari` };
  return { status: 'safe', daysRemaining, label: `Berlaku ${daysRemaining} hari lagi` };
}

// Utility: validate phone number (Indonesian format)
export function isValidPhone(phone: string): boolean {
  if (!phone) return true; // optional field
  const cleaned = phone.replace(/\D/g, '');
  return /^(62|0)\d{8,13}$/.test(cleaned);
}

// Utility: normalize phone to 62xxx format
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
  return cleaned;
}

// Utility: format currency Rupiah
export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

// Utility: greeting by time of day
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat Pagi';
  if (hour < 15) return 'Selamat Siang';
  if (hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

// ── SaaS Types ──

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_medicines: number | null;
  max_transactions_per_month: number | null;
  max_kasir: number;
  max_customers: number | null;
  features: string[];
  sort_order: number;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  billing_cycle: 'monthly' | 'yearly';
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  grace_ends_at: string | null;
  medicines_count: number;
  transactions_count: number;
  kasir_count: number;
  customers_count: number;
};

export type SubscriptionInfo = {
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
};

export type EntitlementResult = {
  allowed: boolean;
  reason?: string;
  plan?: string;
  status?: string;
  grace_period?: boolean;
};

// ── Compliance Types ──

export type MedicineCategory = 'bebas' | 'bebas_terbatas' | 'keras' | 'narkotika' | 'psikotropika' | 'vitamin' | 'alkes' | 'umum' | 'resep';

export type DispensingRule = {
  id: string;
  user_id: string;
  category: MedicineCategory;
  requires_prescription: boolean;
  max_qty_without_prescription: number | null;
  requires_apoteker_approval: boolean;
  notes: string | null;
};

// ── Inventory Traceability Types ──

export type MedicineBatch = {
  id: string;
  medicine_id: string;
  user_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  buy_price: number;
  received_at: string;
  supplier: string | null;
  notes: string | null;
};

export type StockOpname = {
  id: string;
  user_id: string;
  opname_date: string;
  status: 'draft' | 'in_progress' | 'completed' | 'approved';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type StockOpnameItem = {
  id: string;
  opname_id: string;
  medicine_id: string;
  system_stock: number;
  physical_stock: number;
  difference: number;
  notes: string | null;
  // Joined
  medicines?: Pick<Medicine, 'name' | 'unit'>;
};

// ── Audit Types ──

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditLogEntry = {
  id: string;
  user_id: string;
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id?: string | null;
  entity_name?: string | null;
  severity: AuditSeverity;
  actor_role?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  created_at: string;
  users?: { full_name: string };
};

// ── Category options ──

export const MEDICINE_CATEGORIES = [
  { value: 'bebas', label: 'Bebas', color: 'emerald' },
  { value: 'bebas_terbatas', label: 'Bebas Terbatas', color: 'blue' },
  { value: 'keras', label: 'Keras', color: 'rose' },
  { value: 'narkotika', label: 'Narkotika', color: 'red' },
  { value: 'psikotropika', label: 'Psikotropika', color: 'purple' },
  { value: 'vitamin', label: 'Vitamin/Suplemen', color: 'amber' },
  { value: 'alkes', label: 'Alkes', color: 'cyan' },
  { value: 'umum', label: 'Umum', color: 'slate' },
  { value: 'resep', label: 'Resep', color: 'indigo' },
] as const;

// Unit options
export const UNIT_OPTIONS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'kapsul', label: 'Kapsul' },
  { value: 'strip', label: 'Strip' },
  { value: 'botol', label: 'Botol' },
  { value: 'box', label: 'Box' },
  { value: 'tube', label: 'Tube' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'ampul', label: 'Ampul' },
  { value: 'pcs', label: 'Pcs' },
] as const;
// ── Purchasing & Finance Types ──

export type PBFInvoiceStatus = 'unpaid' | 'partial' | 'paid';

export type PBFInvoice = {
  id: string;
  pharmacy_id: string;
  supplier_id: string;
  po_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  amount_paid: number;
  status: PBFInvoiceStatus;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  // Joined
  suppliers?: { name: string };
  purchase_orders?: { order_number: string };
};

export type PBFInvoicePayment = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  notes?: string | null;
  created_at: string;
};
