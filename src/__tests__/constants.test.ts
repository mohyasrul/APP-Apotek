import { describe, it, expect } from 'vitest';
import {
  INVENTORY_FETCH_LIMIT,
  SEARCH_RESULT_LIMIT,
  MEDICINES_PAGE_SIZE,
  LAPORAN_PAGE_SIZE,
  AUDIT_LOG_LIMIT,
  RESTOCK_SEARCH_LIMIT,
  STOCK_HISTORY_LIMIT,
  PRESCRIPTION_SUGGESTION_LIMIT,
  CUSTOMER_AUTOCOMPLETE_LIMIT,
  CSV_BATCH_SIZE,
  STOCK_OPNAME_PAGE_SIZE,
  IDLE_TIMEOUT_MS,
  IDLE_WARN_DURATION_MS,
  AUTH_SAFETY_TIMEOUT_MS,
  PROFILE_FETCH_TIMEOUT_MS,
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MINUTES,
  DEFAULT_MIN_STOCK,
  EXPIRY_WARNING_DAYS,
  NEAR_EXPIRY_DAYS,
  SEARCH_DEBOUNCE_MS,
  DEFAULT_RECEIPT_FOOTER,
  RECEIPT_IFRAME_CLEANUP_MS,
  REDIRECT_DELAY_MS,
  JOIN_REDIRECT_DELAY_MS,
  TRIAL_DAYS,
  GRACE_PERIOD_DAYS,
  FREE_PLAN_ID,
  STARTER_PLAN_ID,
  PROFESSIONAL_PLAN_ID,
  ENTERPRISE_PLAN_ID,
  VOID_LIMIT_HOURS_KASIR,
  VOID_LIMIT_HOURS_OWNER,
  RESTRICTED_CATEGORIES,
  WHATSAPP_API_BASE,
  SUPPORT_WHATSAPP,
} from '../lib/constants';

describe('Pagination constants', () => {
  it('INVENTORY_FETCH_LIMIT is positive', () => expect(INVENTORY_FETCH_LIMIT).toBeGreaterThan(0));
  it('SEARCH_RESULT_LIMIT is positive', () => expect(SEARCH_RESULT_LIMIT).toBeGreaterThan(0));
  it('MEDICINES_PAGE_SIZE is positive', () => expect(MEDICINES_PAGE_SIZE).toBeGreaterThan(0));
  it('LAPORAN_PAGE_SIZE is positive', () => expect(LAPORAN_PAGE_SIZE).toBeGreaterThan(0));
  it('AUDIT_LOG_LIMIT is positive', () => expect(AUDIT_LOG_LIMIT).toBeGreaterThan(0));
  it('RESTOCK_SEARCH_LIMIT is positive', () => expect(RESTOCK_SEARCH_LIMIT).toBeGreaterThan(0));
  it('STOCK_HISTORY_LIMIT is positive', () => expect(STOCK_HISTORY_LIMIT).toBeGreaterThan(0));
  it('PRESCRIPTION_SUGGESTION_LIMIT is positive', () => expect(PRESCRIPTION_SUGGESTION_LIMIT).toBeGreaterThan(0));
  it('CUSTOMER_AUTOCOMPLETE_LIMIT is positive', () => expect(CUSTOMER_AUTOCOMPLETE_LIMIT).toBeGreaterThan(0));
  it('CSV_BATCH_SIZE is positive', () => expect(CSV_BATCH_SIZE).toBeGreaterThan(0));
  it('STOCK_OPNAME_PAGE_SIZE is positive', () => expect(STOCK_OPNAME_PAGE_SIZE).toBeGreaterThan(0));
});

describe('Session & Auth constants', () => {
  it('IDLE_TIMEOUT_MS is 30 minutes', () => {
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it('IDLE_WARN_DURATION_MS is less than IDLE_TIMEOUT_MS', () => {
    expect(IDLE_WARN_DURATION_MS).toBeLessThan(IDLE_TIMEOUT_MS);
  });

  it('AUTH_SAFETY_TIMEOUT_MS is positive and reasonable (< 30s)', () => {
    expect(AUTH_SAFETY_TIMEOUT_MS).toBeGreaterThan(0);
    expect(AUTH_SAFETY_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('PROFILE_FETCH_TIMEOUT_MS is positive', () => {
    expect(PROFILE_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
  });
});

describe('Rate limiting constants', () => {
  it('RATE_LIMIT_MAX_ATTEMPTS is at least 3', () => {
    expect(RATE_LIMIT_MAX_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });

  it('RATE_LIMIT_WINDOW_MINUTES is positive', () => {
    expect(RATE_LIMIT_WINDOW_MINUTES).toBeGreaterThan(0);
  });
});

describe('Inventory constants', () => {
  it('DEFAULT_MIN_STOCK is positive', () => {
    expect(DEFAULT_MIN_STOCK).toBeGreaterThan(0);
  });

  it('EXPIRY_WARNING_DAYS is greater than NEAR_EXPIRY_DAYS', () => {
    expect(EXPIRY_WARNING_DAYS).toBeGreaterThan(NEAR_EXPIRY_DAYS);
  });

  it('NEAR_EXPIRY_DAYS is positive', () => {
    expect(NEAR_EXPIRY_DAYS).toBeGreaterThan(0);
  });
});

describe('Debounce constants', () => {
  it('SEARCH_DEBOUNCE_MS is positive and reasonable (< 2000ms)', () => {
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(SEARCH_DEBOUNCE_MS).toBeLessThan(2000);
  });
});

describe('Receipt constants', () => {
  it('DEFAULT_RECEIPT_FOOTER is a non-empty string', () => {
    expect(typeof DEFAULT_RECEIPT_FOOTER).toBe('string');
    expect(DEFAULT_RECEIPT_FOOTER.length).toBeGreaterThan(0);
  });

  it('RECEIPT_IFRAME_CLEANUP_MS is positive', () => {
    expect(RECEIPT_IFRAME_CLEANUP_MS).toBeGreaterThan(0);
  });
});

describe('Redirect delays', () => {
  it('REDIRECT_DELAY_MS is positive', () => expect(REDIRECT_DELAY_MS).toBeGreaterThan(0));
  it('JOIN_REDIRECT_DELAY_MS is positive', () => expect(JOIN_REDIRECT_DELAY_MS).toBeGreaterThan(0));
});

describe('Subscription plan IDs', () => {
  it('FREE_PLAN_ID is a non-empty string', () => {
    expect(typeof FREE_PLAN_ID).toBe('string');
    expect(FREE_PLAN_ID.length).toBeGreaterThan(0);
  });

  it('plan IDs are unique', () => {
    const ids = [FREE_PLAN_ID, STARTER_PLAN_ID, PROFESSIONAL_PLAN_ID, ENTERPRISE_PLAN_ID];
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('TRIAL_DAYS is positive', () => expect(TRIAL_DAYS).toBeGreaterThan(0));
  it('GRACE_PERIOD_DAYS is positive', () => expect(GRACE_PERIOD_DAYS).toBeGreaterThan(0));
});

describe('Compliance constants', () => {
  it('VOID_LIMIT_HOURS_KASIR is less than VOID_LIMIT_HOURS_OWNER', () => {
    expect(VOID_LIMIT_HOURS_KASIR).toBeLessThan(VOID_LIMIT_HOURS_OWNER);
  });

  it('RESTRICTED_CATEGORIES includes narkotika and psikotropika', () => {
    expect(RESTRICTED_CATEGORIES).toContain('narkotika');
    expect(RESTRICTED_CATEGORIES).toContain('psikotropika');
  });

  it('RESTRICTED_CATEGORIES includes keras and resep', () => {
    expect(RESTRICTED_CATEGORIES).toContain('keras');
    expect(RESTRICTED_CATEGORIES).toContain('resep');
  });
});

describe('API & External constants', () => {
  it('WHATSAPP_API_BASE starts with https://', () => {
    expect(WHATSAPP_API_BASE).toMatch(/^https:\/\//);
  });

  it('SUPPORT_WHATSAPP is a numeric string', () => {
    expect(SUPPORT_WHATSAPP).toMatch(/^\d+$/);
  });
});
