import { describe, it, expect } from 'vitest';
import {
  getExpiryStatus,
  formatRupiah,
  getGreeting,
  isValidPhone,
  normalizePhone,
} from '../lib/types';

describe('getExpiryStatus', () => {
  it('returns "expired" for past dates', () => {
    expect(getExpiryStatus('2020-01-01')).toBe('expired');
  });

  it('returns "near-expiry" for dates within 90 days', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    expect(getExpiryStatus(futureDate.toISOString())).toBe('near-expiry');
  });

  it('returns "safe" for dates more than 90 days away', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 180);
    expect(getExpiryStatus(futureDate.toISOString())).toBe('safe');
  });

  it('handles null/undefined gracefully', () => {
    expect(getExpiryStatus(null)).toBe('safe');
    expect(getExpiryStatus(undefined)).toBe('safe');
    expect(getExpiryStatus('')).toBe('safe');
  });

  it('handles invalid date strings', () => {
    expect(getExpiryStatus('not-a-date')).toBe('safe');
  });

  it('returns "near-expiry" at exactly 90 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    expect(getExpiryStatus(date.toISOString())).toBe('near-expiry');
  });

  it('returns "safe" at 91 days', () => {
    const date = new Date();
    date.setDate(date.getDate() + 91);
    expect(getExpiryStatus(date.toISOString())).toBe('safe');
  });
});

describe('formatRupiah', () => {
  it('formats positive numbers', () => {
    const result = formatRupiah(15000);
    expect(result).toContain('Rp');
    expect(result).toContain('15');
  });

  it('formats zero', () => {
    expect(formatRupiah(0)).toContain('0');
  });

  it('formats large numbers', () => {
    const result = formatRupiah(1500000);
    expect(result).toContain('Rp');
  });
});

describe('getGreeting', () => {
  it('returns a string greeting', () => {
    const greeting = getGreeting();
    expect(typeof greeting).toBe('string');
    expect(greeting).toMatch(/^Selamat (Pagi|Siang|Sore|Malam)$/);
  });
});

describe('isValidPhone', () => {
  it('accepts empty string (optional field)', () => {
    expect(isValidPhone('')).toBe(true);
  });

  it('accepts valid Indonesian phone numbers', () => {
    expect(isValidPhone('628123456789')).toBe(true);
    expect(isValidPhone('08123456789')).toBe(true);
    expect(isValidPhone('6281234567890')).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('+628123456789')).toBe(true); // digits extracted: 628...
  });

  it('rejects too short numbers', () => {
    expect(isValidPhone('6281234')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('converts 0xxx to 62xxx', () => {
    expect(normalizePhone('08123456789')).toBe('628123456789');
  });

  it('keeps 62xxx format', () => {
    expect(normalizePhone('628123456789')).toBe('628123456789');
  });

  it('strips non-digit characters', () => {
    expect(normalizePhone('+62-812-345-6789')).toBe('628123456789');
  });
});
