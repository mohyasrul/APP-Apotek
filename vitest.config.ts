import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Use jsdom for DOM + React component tests
    environment: 'jsdom',

    // Inject vi, describe, it, expect globally — no need to import in every file
    globals: true,

    // Global test setup: mocks, @testing-library/jest-dom matchers, etc.
    setupFiles: ['./src/test/setup.ts'],

    // Cover all test files under src (both __tests__ folder and co-located *.test.* files)
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
    ],

    // Exclude generated / build files
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],

    // Test timeout (ms) — generous for async/DB tests
    testTimeout: 10_000,

    // Code coverage using v8 (no extra instrumentation needed)
    coverage: {
      provider: 'v8',
      // Directories to measure coverage for
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',          // app entry point
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/test/**',           // setup files
        'src/__tests__/**',      // test files themselves
        'src/lib/supabase.ts',   // thin Supabase client wrapper
      ],
      // Reporters: text summary in terminal + lcov for CI/IDE
      reporter: ['text', 'lcov', 'html'],
      // Output directory for HTML report
      reportsDirectory: './coverage',
      // Fail if coverage drops below thresholds
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 30,
        statements: 30,
      },
    },

    // Reporter: verbose shows each test name; can switch to 'default' for quiet mode
    reporter: 'verbose',
  },
})
