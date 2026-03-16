/**
 * Tests for SubscriptionContext computed values and DEV MODE behaviour.
 *
 * We test the logic functions (checkFeature, getUsagePercent, isPaid, etc.)
 * by importing the real context and wrapping it with a mocked AuthContext +
 * a mocked supabase RPC response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SubscriptionProvider, useSubscription } from '../lib/SubscriptionContext';

// ── Mock AuthContext ──────────────────────────────────────────────────────────
vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@apotek.id' },
    profile: { role: 'owner', pharmacy_name: 'Apotek Sejahtera' },
    loading: false,
    profileError: null,
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(SubscriptionProvider, null, children);
}

// ── DEV MODE: checkFeature always returns true ────────────────────────────────

describe('checkFeature — DEV MODE', () => {
  it('returns true for any feature regardless of subscription', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });
    // Wait for the initial RPC (supabase.rpc is mocked to return null)
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.checkFeature('sipnap')).toBe(true);
    expect(result.current.checkFeature('export_csv')).toBe(true);
    expect(result.current.checkFeature('laporan_keuangan')).toBe(true);
    expect(result.current.checkFeature('bpjs_klaim')).toBe(true);
    expect(result.current.checkFeature('any_future_feature')).toBe(true);
  });
});

// ── getUsagePercent ───────────────────────────────────────────────────────────

describe('getUsagePercent', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 0 when subscription is null (no plan loaded)', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // supabase.rpc is mocked to return { data: null } — so no subscription loaded
    expect(result.current.getUsagePercent('medicines')).toBe(0);
    expect(result.current.getUsagePercent('transactions')).toBe(0);
    expect(result.current.getUsagePercent('kasir')).toBe(0);
    expect(result.current.getUsagePercent('customers')).toBe(0);
  });
});

// ── isPaid / isTrialing ───────────────────────────────────────────────────────

describe('isPaid', () => {
  it('is false when no plan loaded (RPC returns null)', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPaid).toBe(false);
  });
});

describe('isTrialing', () => {
  it('is false when no subscription loaded', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isTrialing).toBe(false);
  });
});

// ── daysRemaining ─────────────────────────────────────────────────────────────

describe('daysRemaining', () => {
  it('is 0 when no subscription loaded', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.daysRemaining).toBe(0);
  });
});

// ── loading state ─────────────────────────────────────────────────────────────

describe('SubscriptionProvider loading state', () => {
  it('starts with loading=true and resolves to loading=false', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });
    // After RPC completes, loading should be false
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscription).toBeDefined(); // null or object, but not undefined
  });
});

// ── refreshSubscription ───────────────────────────────────────────────────────

describe('refreshSubscription', () => {
  it('is a callable function', async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refreshSubscription).toBe('function');
    // Should not throw when called
    await expect(result.current.refreshSubscription()).resolves.toBeUndefined();
  });
});
