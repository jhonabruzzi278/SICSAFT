import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { HubPage } from '@/pages/HubPage';
import { ActivosPage } from '@/pages/ActivosPage';
import { ContratosPage } from '@/pages/ContratosPage';
import { InventariosPage } from '@/pages/InventariosPage';
import { AuditoriaPage } from '@/pages/AuditoriaPage';
import { EstructuraPage } from '@/pages/EstructuraPage';

function RequireAuth({ children }: { children: ReactNode }) {
  if (!oidcClient.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <HubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/activos"
          element={
            <RequireAuth>
              <ActivosPage />
            </RequireAuth>
          }
        />
        <Route
          path="/contratos"
          element={
            <RequireAuth>
              <ContratosPage />
            </RequireAuth>
          }
        />
        <Route
          path="/inventarios"
          element={
            <RequireAuth>
              <InventariosPage />
            </RequireAuth>
          }
        />
        <Route
          path="/estructura"
          element={
            <RequireAuth>
              <EstructuraPage />
            </RequireAuth>
          }
        />
        <Route
          path="/auditoria"
          element={
            <RequireAuth>
              <AuditoriaPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
