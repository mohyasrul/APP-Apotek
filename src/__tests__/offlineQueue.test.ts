/**
 * Tests for the offline transaction queue module.
 *
 * Because IndexedDB is not available in jsdom, we test:
 *  1. The QueuedTransaction shape (type safety)
 *  2. initOfflineQueue — listens to 'online' / 'offline' events
 *  3. syncAllPendingTransactions — returns { synced, failed } when queue is empty
 *
 * Tests that need real IDB operations require fake-indexeddb and are marked
 * with `.todo` so they serve as a reminder to implement with that library.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { QueuedTransaction } from '../lib/offlineQueue';

// ── Type-shape tests (no IDB needed) ─────────────────────────────────────────

describe('QueuedTransaction type shape', () => {
  it('constructs a valid pending QueuedTransaction', () => {
    const tx: QueuedTransaction = {
      id: 'uuid-001',
      timestamp: Date.now(),
      totalAmount: 50000,
      discountTotal: 5000,
      paymentMethod: 'cash',
      items: [
        {
          medicine_id: 'med-1',
          quantity: 2,
          price_at_transaction: 10000,
          discount_amount: 0,
        },
      ],
      status: 'pending',
      retryCount: 0,
    };
    expect(tx.status).toBe('pending');
    expect(tx.retryCount).toBe(0);
    expect(tx.items).toHaveLength(1);
  });

  it('constructs a failed QueuedTransaction with error', () => {
    const tx: QueuedTransaction = {
      id: 'uuid-002',
      timestamp: Date.now(),
      totalAmount: 30000,
      discountTotal: 0,
      paymentMethod: 'qris',
      items: [],
      status: 'failed',
      error: 'Network error',
      retryCount: 3,
    };
    expect(tx.status).toBe('failed');
    expect(tx.error).toBe('Network error');
    expect(tx.retryCount).toBe(3);
  });

  it('constructs a syncing QueuedTransaction with optional fields', () => {
    const tx: QueuedTransaction = {
      id: 'uuid-003',
      timestamp: Date.now(),
      totalAmount: 75000,
      discountTotal: 0,
      paymentMethod: 'transfer',
      items: [],
      prescriptionId: 'rx-001',
      customerName: 'Budi',
      customerPhone: '08123456789',
      status: 'syncing',
      retryCount: 1,
    };
    expect(tx.prescriptionId).toBe('rx-001');
    expect(tx.customerName).toBe('Budi');
  });

  it('allows all three paymentMethod values', () => {
    const methods: QueuedTransaction['paymentMethod'][] = ['cash', 'qris', 'transfer'];
    methods.forEach(method => {
      const tx: QueuedTransaction = {
        id: `uuid-${method}`,
        timestamp: Date.now(),
        totalAmount: 10000,
        discountTotal: 0,
        paymentMethod: method,
        items: [],
        status: 'pending',
        retryCount: 0,
      };
      expect(tx.paymentMethod).toBe(method);
    });
  });
});

// ── initOfflineQueue — event listener registration ───────────────────────────

describe('initOfflineQueue', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers window online/offline event listeners', async () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener');

    const { initOfflineQueue } = await import('../lib/offlineQueue');
    initOfflineQueue();

    const types = addEventSpy.mock.calls.map(([type]) => type);
    expect(types).toContain('online');
    expect(types).toContain('offline');
  });
});

// ── syncAllPendingTransactions — empty queue ──────────────────────────────────

describe('syncAllPendingTransactions — empty queue', () => {
  it.todo('returns { synced: 0, failed: 0 } when queue is empty (requires fake-indexeddb)');
});

describe('queueTransaction', () => {
  it.todo('returns a UUID string and adds transaction to IDB (requires fake-indexeddb)');
});

describe('getPendingTransactions', () => {
  it.todo('returns only transactions with status=pending (requires fake-indexeddb)');
});

describe('cleanupOldTransactions', () => {
  it.todo('deletes transactions older than 7 days (requires fake-indexeddb)');
});

describe('retryFailedTransactions', () => {
  it.todo('retries only failed transactions and updates their status (requires fake-indexeddb)');
});
