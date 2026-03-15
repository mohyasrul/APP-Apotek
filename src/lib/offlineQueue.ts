/**
 * Offline Transaction Queue
 *
 * Handles queueing transactions when offline and syncing when back online.
 * Uses IndexedDB for persistent storage across sessions.
 */

import { supabase } from './supabase';
import { toast } from 'sonner';

export type QueuedTransaction = {
  id: string;  // UUID generated on client
  timestamp: number;
  totalAmount: number;
  discountTotal: number;
  paymentMethod: 'cash' | 'qris' | 'transfer';
  items: Array<{
    medicine_id: string;
    quantity: number;
    price_at_transaction: number;
    discount_amount: number;
  }>;
  prescriptionId?: string;
  customerName?: string;
  customerPhone?: string;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
  retryCount: number;
};

const DB_NAME = 'medisir_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'transaction_queue';
const MAX_RETRY = 3;

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

/**
 * Add transaction to queue
 */
export async function queueTransaction(transaction: Omit<QueuedTransaction, 'id' | 'timestamp' | 'status' | 'retryCount'>): Promise<string> {
  const db = await openDB();

  const queuedTx: QueuedTransaction = {
    ...transaction,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(queuedTx);

    request.onsuccess = () => {
      resolve(queuedTx.id);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending transactions
 */
export async function getPendingTransactions(): Promise<QueuedTransaction[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.getAll('pending');

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all transactions (for UI display)
 */
export async function getAllQueuedTransactions(): Promise<QueuedTransaction[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = (request.result || []) as QueuedTransaction[];
      // Sort by timestamp descending
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update transaction status
 */
async function updateTransaction(id: string, updates: Partial<QueuedTransaction>): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const transaction = getRequest.result;
      if (!transaction) {
        reject(new Error('Transaction not found'));
        return;
      }

      const updated = { ...transaction, ...updates };
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Remove transaction from queue
 */
async function removeTransaction(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sync a single transaction to Supabase
 */
async function syncTransaction(transaction: QueuedTransaction): Promise<{ success: boolean; error?: string }> {
  try {
    // Mark as syncing
    await updateTransaction(transaction.id, { status: 'syncing' });

    // Call process_checkout RPC
    const { error } = await supabase.rpc('process_checkout', {
      p_total_amount: transaction.totalAmount,
      p_discount_total: transaction.discountTotal,
      p_payment_method: transaction.paymentMethod,
      p_items: transaction.items,
      p_prescription_id: transaction.prescriptionId || null,
      p_customer_name: transaction.customerName || null,
      p_customer_phone: transaction.customerPhone || null,
    });

    if (error) {
      console.error('✗ Sync failed for transaction', transaction.id, error);

      // Increment retry count
      const newRetryCount = transaction.retryCount + 1;

      if (newRetryCount >= MAX_RETRY) {
        // Max retries reached, mark as failed
        await updateTransaction(transaction.id, {
          status: 'failed',
          error: error.message,
          retryCount: newRetryCount,
        });
        return { success: false, error: `Max retries (${MAX_RETRY}) exceeded: ${error.message}` };
      } else {
        // Reset to pending for retry
        await updateTransaction(transaction.id, {
          status: 'pending',
          error: error.message,
          retryCount: newRetryCount,
        });
        return { success: false, error: error.message };
      }
    }

    // Success - remove from queue
    await removeTransaction(transaction.id);
    return { success: true };

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('✗ Sync exception for transaction', transaction.id, err);

    // Update status to failed
    await updateTransaction(transaction.id, {
      status: 'failed',
      error: errorMsg,
      retryCount: transaction.retryCount + 1,
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Sync all pending transactions
 */
export async function syncAllPendingTransactions(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingTransactions();

  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const tx of pending) {
    const result = await syncTransaction(tx);
    if (result.success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Initialize offline queue system
 * Sets up online/offline event listeners and auto-sync
 */
export function initOfflineQueue() {
  // Sync when coming back online
  window.addEventListener('online', async () => {
    toast.info('Koneksi kembali! Menyinkronkan transaksi...');

    try {
      const result = await syncAllPendingTransactions();

      if (result.synced > 0) {
        toast.success(`${result.synced} transaksi offline berhasil disinkronkan`);
      }

      if (result.failed > 0) {
        toast.error(`${result.failed} transaksi gagal disinkronkan. Periksa detail di queue.`);
      }
    } catch (err) {
      console.error('Auto-sync error:', err);
      toast.error('Gagal menyinkronkan transaksi offline');
    }
  });

  window.addEventListener('offline', () => {
    toast.warning('Anda sedang offline. Transaksi akan disimpan dan disinkronkan nanti.');
  });

  // Initial sync attempt on app load (if online)
  if (navigator.onLine) {
    setTimeout(async () => {
      const pending = await getPendingTransactions();
      if (pending.length > 0) {
        toast.info(`${pending.length} transaksi offline menunggu sinkronisasi...`, {
          action: {
            label: 'Sync Sekarang',
            onClick: async () => {
              const result = await syncAllPendingTransactions();
              if (result.synced > 0) {
                toast.success(`${result.synced} transaksi berhasil disinkronkan`);
              }
            },
          },
        });
      }
    }, 2000);  // Delay to avoid blocking initial render
  }
}

/**
 * Retry failed transactions
 */
export async function retryFailedTransactions(): Promise<{ synced: number; failed: number }> {
  const db = await openDB();

  const failedTxs: QueuedTransaction[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('status');
    const request = index.getAll('failed');

    request.onsuccess = () => {
      const transactions = (request.result || []) as QueuedTransaction[];
      // Reset status to pending and reset retry count
      transactions.forEach(t => {
        t.status = 'pending';
        t.retryCount = 0;
        t.error = undefined;
        store.put(t);
      });
      resolve(transactions);
    };
    request.onerror = () => reject(request.error);
  });

  if (failedTxs.length === 0) {
    return { synced: 0, failed: 0 };
  }

  toast.info(`Mencoba ulang ${failedTxs.length} transaksi yang gagal...`);
  return syncAllPendingTransactions();
}

/**
 * Clear all completed/failed transactions older than 7 days
 */
export async function cleanupOldTransactions(): Promise<number> {
  const db = await openDB();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  let deletedCount = 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const transaction = cursor.value as QueuedTransaction;
        if (transaction.timestamp < sevenDaysAgo && transaction.status !== 'pending') {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      } else {
        resolve(deletedCount);
      }    };

    request.onerror = () => reject(request.error);
  });
}
