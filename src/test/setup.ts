/**
 * Global Vitest setup file.
 *
 * Runs once before each test file. Sets up:
 *  - @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, …)
 *  - Supabase client mock (prevents real network calls)
 *  - localStorage / sessionStorage mock via jsdom (built-in)
 *  - IndexedDB mock (for offlineQueue tests)
 *  - window.print mock (receipt tests)
 *  - framer-motion mock (removes animation complexity from component tests)
 *  - react-router-dom MemoryRouter helper (re-exported for test files)
 */

import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// ── Cleanup React trees after every test ─────────────────────────────────────
afterEach(() => {
  cleanup();
});

// ── window.print mock ────────────────────────────────────────────────────────
// Prevents jsdom "not implemented" error when receipt code calls window.print
Object.defineProperty(window, 'print', {
  value: vi.fn(),
  writable: true,
});

// ── window.open mock ────────────────────────────────────────────────────────
Object.defineProperty(window, 'open', {
  value: vi.fn(() => ({
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
  })),
  writable: true,
});

// ── window.matchMedia mock ───────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── ResizeObserver mock ──────────────────────────────────────────────────────
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── IntersectionObserver mock ────────────────────────────────────────────────
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── Supabase mock ────────────────────────────────────────────────────────────
// Prevents any real HTTP requests. Individual tests can override specific methods
// via vi.mocked(supabase.from).mockReturnValue(...) or similar patterns.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
      })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

// ── framer-motion mock ───────────────────────────────────────────────────────
// Renders motion.div etc. as plain divs — avoids animation timers in tests
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const createProxy = (tag: string) => {
    const { createElement } = await import('react');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ({ children, ...props }: any) => {
      // Strip framer-specific props that cause React warnings
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { initial, animate, exit, transition, variants, whileHover, whileTap, whileFocus, layout, layoutId, ...rest } = props;
      return createElement(tag, rest, children);
    };
  };
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => createProxy(prop),
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

// ── sonner (toast) mock ──────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  },
  Toaster: () => null,
}));

// ── Minimal IndexedDB mock ───────────────────────────────────────────────────
// jsdom does not ship IDB. This lightweight mock satisfies the offlineQueue module.
// Tests that need real IDB behaviour should use fake-indexeddb (npm install separately).
if (!global.indexedDB) {
  const idbStore: Record<string, unknown> = {};
  const mockRequest = (result: unknown = undefined): IDBRequest => {
    const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
    const req = {
      result,
      error: null,
      addEventListener: (type: string, cb: EventListenerOrEventListenerObject) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(cb);
      },
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as IDBRequest;
    // Fire onsuccess asynchronously
    setTimeout(() => {
      if ((req as unknown as { onsuccess?: (e: Event) => void }).onsuccess)
        (req as unknown as { onsuccess: (e: Event) => void }).onsuccess({ target: req } as unknown as Event);
      (listeners['success'] || []).forEach(l =>
        typeof l === 'function' ? l({ target: req } as unknown as Event) : l.handleEvent({ target: req } as unknown as Event)
      );
    }, 0);
    return req;
  };

  const mockObjectStore = () => ({
    add: () => mockRequest(),
    get: () => mockRequest(null),
    getAll: () => mockRequest([]),
    put: () => mockRequest(),
    delete: () => mockRequest(),
    index: () => ({ getAll: () => mockRequest([]) }),
  });

  const mockDB = {
    objectStoreNames: { contains: () => false },
    createObjectStore: vi.fn(() => ({ createIndex: vi.fn() })),
    transaction: vi.fn(() => ({ objectStore: mockObjectStore })),
  };

  global.indexedDB = {
    open: () => {
      const req = mockRequest(mockDB);
      setTimeout(() => {
        if ((req as unknown as { onupgradeneeded?: (e: IDBVersionChangeEvent) => void }).onupgradeneeded)
          (req as unknown as { onupgradeneeded: (e: IDBVersionChangeEvent) => void }).onupgradeneeded({ target: req } as unknown as IDBVersionChangeEvent);
        if ((req as unknown as { onsuccess?: (e: Event) => void }).onsuccess)
          (req as unknown as { onsuccess: (e: Event) => void }).onsuccess({ target: req } as unknown as Event);
      }, 0);
      return req;
    },
    deleteDatabase: () => mockRequest(),
    databases: vi.fn().mockResolvedValue([]),
    cmp: vi.fn().mockReturnValue(0),
  } as unknown as IDBFactory;

  void idbStore; // suppress unused warning
}
