// ── Pagination & Limits ──
export const INVENTORY_FETCH_LIMIT = 150;
export const SEARCH_RESULT_LIMIT = 50;
export const MEDICINES_PAGE_SIZE = 20;
export const LAPORAN_PAGE_SIZE = 15;
export const AUDIT_LOG_LIMIT = 100;
export const RESTOCK_SEARCH_LIMIT = 50;
export const STOCK_HISTORY_LIMIT = 8;
export const PRESCRIPTION_SUGGESTION_LIMIT = 6;
export const CUSTOMER_AUTOCOMPLETE_LIMIT = 5;
export const CSV_BATCH_SIZE = 100;
export const STOCK_OPNAME_PAGE_SIZE = 20;

// ── Session & Auth ──
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;       // 30 min
export const IDLE_WARN_DURATION_MS = 5 * 60 * 1000;   // 5 min warning
export const AUTH_SAFETY_TIMEOUT_MS = 10_000;          // 10s
export const PROFILE_FETCH_TIMEOUT_MS = 8_000;         // 8s

// ── Rate Limiting ──
export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MINUTES = 15;

// ── Inventory ──
export const DEFAULT_MIN_STOCK = 5;
export const EXPIRY_WARNING_DAYS = 90;
export const NEAR_EXPIRY_DAYS = 30;

// ── Debounce ──
export const SEARCH_DEBOUNCE_MS = 400;

// ── Receipt ──
export const DEFAULT_RECEIPT_FOOTER = 'Terima kasih,\nSemoga lekas sembuh!';
export const RECEIPT_IFRAME_CLEANUP_MS = 60_000;

// ── Redirect delays ──
export const REDIRECT_DELAY_MS = 3000;
export const JOIN_REDIRECT_DELAY_MS = 2500;

// ── SaaS / Subscription ──
export const TRIAL_DAYS = 14;
export const GRACE_PERIOD_DAYS = 7;
export const FREE_PLAN_ID = 'free';
export const STARTER_PLAN_ID = 'starter';
export const PROFESSIONAL_PLAN_ID = 'professional';
export const ENTERPRISE_PLAN_ID = 'enterprise';

// ── Compliance ──
export const VOID_LIMIT_HOURS_KASIR = 2;
export const VOID_LIMIT_HOURS_OWNER = 36;
export const RESTRICTED_CATEGORIES = ['keras', 'narkotika', 'psikotropika', 'resep'] as const;

// ── API & External ──
export const WHATSAPP_API_BASE = 'https://wa.me/';
export const SUPPORT_WHATSAPP = '6281234567890';

