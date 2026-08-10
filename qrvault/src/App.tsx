import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { useEntrance } from '@/hooks/useEntrance';

const ScanPage = lazy(() => import('@/pages/ScanPage').then((m) => ({ default: m.ScanPage })));
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const CatalogPage = lazy(() => import('@/pages/CatalogPage').then((m) => ({ default: m.CatalogPage })));

function RouteTransition({ children }: { children: ReactNode }) {
  const shown = useEntrance();

  return (
    <div
      data-open={shown || undefined}
      className="translate-y-2.5 opacity-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-open:translate-y-0 data-open:opacity-100"
    >
      {children}
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();

  return (
    <AppShell>
      <Suspense fallback={null}>
        {/* key={pathname} remonta en cada navegación para que la
            transición de entrada se repita. */}
        <RouteTransition key={pathname}>
          <Routes>
            <Route path="/" element={<ScanPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RouteTransition>
      </Suspense>
    </AppShell>
  );
}
