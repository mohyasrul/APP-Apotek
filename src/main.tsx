import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

declare const __BUILD_TIMESTAMP__: string;

// Inisialisasi Sentry (hanya di production, hanya jika DSN tersedia)
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,       // 10% performance tracing
    replaysOnErrorSampleRate: 0, // disable replay untuk hemat kuota free tier
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Daftarkan Service Worker untuk PWA (hanya di production, bukan saat dev)
// Pass build timestamp as version param for cache busting
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const buildVersion = typeof __BUILD_TIMESTAMP__ !== 'undefined'
    ? __BUILD_TIMESTAMP__.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
    : 'v1';

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`/sw.js?v=${buildVersion}`)
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              if (confirm('Versi baru MediSir tersedia. Muat ulang sekarang?')) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((err) => console.warn('[MediSir SW] Registrasi gagal:', err));
  });
}
