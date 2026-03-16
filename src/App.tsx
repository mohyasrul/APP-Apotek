import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { SubscriptionProvider } from './lib/SubscriptionContext';
import { ThemeProvider } from './lib/ThemeContext';
import { SidebarProvider, useSidebar } from './lib/SidebarContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopNavigation } from './components/layout/TopNavigation';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { SidebarNav } from './components/layout/SidebarNav';
import { PageTransition } from './components/layout/PageTransition';
import { SessionTimeout } from './components/SessionTimeout';
import { Toaster } from 'sonner';
import { initOfflineQueue } from './lib/offlineQueue';
import { cn } from './lib/cn';
import Dashboard from './pages/Dashboard'; // eager — halaman utama, tidak perlu lazy

// Lazy-loaded routes — halaman sekunder jadi chunk terpisah.
const Medicines    = lazy(() => import('./pages/Medicines'));
const POS          = lazy(() => import('./pages/POS'));
const Laporan      = lazy(() => import('./pages/Laporan'));
const Resep        = lazy(() => import('./pages/Resep'));
const Pengadaan    = lazy(() => import('./pages/Pengadaan'));
const Settings     = lazy(() => import('./pages/Settings'));
const Customers    = lazy(() => import('./pages/Customers'));
const Login        = lazy(() => import('./pages/Login'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound     = lazy(() => import('./pages/NotFound'));
const Join         = lazy(() => import('./pages/Join'));
const StockOpname  = lazy(() => import('./pages/StockOpname'));
const Billing      = lazy(() => import('./pages/Billing'));
const KebijakanPrivasi = lazy(() => import('./pages/KebijakanPrivasi'));
const SyaratKetentuan  = lazy(() => import('./pages/SyaratKetentuan'));
const Sipnap           = lazy(() => import('./pages/Sipnap'));
const BukuHarianNarkotika = lazy(() => import('./pages/BukuHarianNarkotika'));
const PemusnahanObat   = lazy(() => import('./pages/PemusnahanObat'));
const Konseling        = lazy(() => import('./pages/Konseling'));
const LaporanKeuangan  = lazy(() => import('./pages/LaporanKeuangan'));
const Racikan          = lazy(() => import('./pages/Racikan'));
const Meso             = lazy(() => import('./pages/Meso'));
const Bantuan          = lazy(() => import('./pages/Bantuan'));
const RecallObat       = lazy(() => import('./pages/RecallObat'));
const Antrian          = lazy(() => import('./pages/Antrian'));
const BpjsKlaim        = lazy(() => import('./pages/BpjsKlaim'));

// Fallback loading UI untuk route publik (Login, ResetPassword)
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Memuat...</span>
      </div>
    </div>
  );
}

// Skeleton ringan untuk area konten (TopNavigation tetap tampil)
function ContentLoader() {
  return (
    <div className="flex-1 p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-48" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />)}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl mt-4" />
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { collapsed } = useSidebar();
  return (
    <div className="flex min-h-screen pt-[57px]">
      <SidebarNav />
      <main
        className={cn(
          'flex-1 min-w-0 overflow-auto bg-canvas dark:bg-zinc-950 transition-[margin] duration-200',
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            {children}
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, profile, loading, profileError } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) return <Navigate to="/login" />;

  // Still loading profile — wait before rendering protected content
  if (!profile && !profileError) return <PageLoader />;

  if (!profile && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-sm w-full text-center">
          <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Gagal memuat profil</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Koneksi ke server bermasalah. Coba refresh halaman.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider>
      <TopNavigation />
      <AppLayout>
        <Suspense fallback={<ContentLoader />}>
          {children}
        </Suspense>
      </AppLayout>
      <MobileBottomNav />
    </SidebarProvider>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-center text-sm py-2 font-medium">
      Anda sedang offline. Beberapa fitur mungkin tidak tersedia.
    </div>
  );
}

function App() {
  // Initialize offline queue system on app mount
  useEffect(() => {
    initOfflineQueue();
  }, []);

  return (
    <ThemeProvider>
    <ErrorBoundary>
      <AuthProvider>
        <SubscriptionProvider>
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: { fontFamily: "'Plus Jakarta Sans', sans-serif" }
            }}
          />
          <Router>
            <OfflineBanner />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login"          element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/join"           element={<Join />} />
                <Route path="/kebijakan-privasi" element={<KebijakanPrivasi />} />
                <Route path="/syarat-ketentuan"  element={<SyaratKetentuan />} />
                <Route path="/"               element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/pos"            element={<ProtectedRoute><POS /></ProtectedRoute>} />
                <Route path="/medicines"      element={<ProtectedRoute><Medicines /></ProtectedRoute>} />
                <Route path="/laporan"        element={<ProtectedRoute allowedRoles={['owner']}><Laporan /></ProtectedRoute>} />
                <Route path="/resep"          element={<ProtectedRoute><Resep /></ProtectedRoute>} />
                <Route path="/pengadaan"      element={<ProtectedRoute><Pengadaan /></ProtectedRoute>} />
                <Route path="/customers"      element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/settings"       element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/stock-opname"   element={<ProtectedRoute allowedRoles={['owner']}><StockOpname /></ProtectedRoute>} />
                <Route path="/billing"        element={<ProtectedRoute allowedRoles={['owner']}><Billing /></ProtectedRoute>} />
                <Route path="/sipnap"         element={<ProtectedRoute allowedRoles={['owner']}><Sipnap /></ProtectedRoute>} />
                <Route path="/buku-harian-narkotika" element={<ProtectedRoute allowedRoles={['owner']}><BukuHarianNarkotika /></ProtectedRoute>} />
                <Route path="/pemusnahan-obat" element={<ProtectedRoute allowedRoles={['owner']}><PemusnahanObat /></ProtectedRoute>} />
                <Route path="/konseling"      element={<ProtectedRoute><Konseling /></ProtectedRoute>} />
                <Route path="/laporan-keuangan" element={<ProtectedRoute allowedRoles={['owner']}><LaporanKeuangan /></ProtectedRoute>} />
                <Route path="/racikan"        element={<ProtectedRoute><Racikan /></ProtectedRoute>} />
                <Route path="/meso"           element={<ProtectedRoute><Meso /></ProtectedRoute>} />
                <Route path="/bantuan"        element={<ProtectedRoute><Bantuan /></ProtectedRoute>} />
                <Route path="/recall-obat"    element={<ProtectedRoute allowedRoles={['owner']}><RecallObat /></ProtectedRoute>} />
                <Route path="/antrian"        element={<ProtectedRoute><Antrian /></ProtectedRoute>} />
                <Route path="/bpjs-klaim"     element={<ProtectedRoute allowedRoles={['owner']}><BpjsKlaim /></ProtectedRoute>} />
                <Route path="*"               element={<NotFound />} />
              </Routes>
            </Suspense>
            <SessionTimeout />
          </Router>
        </SubscriptionProvider>
      </AuthProvider>
    </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
