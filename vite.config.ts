import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Inject build timestamp for SW cache busting
    '__BUILD_TIMESTAMP__': JSON.stringify(new Date().toISOString()),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-router':   ['react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-recharts': ['recharts'],
          'vendor-utils':    ['zustand', 'sonner'],
        },
      },
    },
    modulePreload: { polyfill: true },
  },
})
