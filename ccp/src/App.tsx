import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { moduloHabilitado } from '@/lib/nivel';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { HubPage } from '@/pages/HubPage';
import { ActivosPage } from '@/pages/ActivosPage';
import { ContratosPage } from '@/pages/ContratosPage';
import { InventariosPage } from '@/pages/InventariosPage';
import { AuditoriaPage } from '@/pages/AuditoriaPage';
import { EstructuraPage } from '@/pages/EstructuraPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ImportacionesPage } from '@/pages/ImportacionesPage';

function RequireAuth({ children }: { children: ReactNode }) {
  if (!oidcClient.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// DOC-029 RF-A -- un modulo no habilitado (retirado del CCP, o de "gestion avanzada"/Nivel 2 en
// una instalacion Nivel 1) abierto por URL directa redirige al hub. El gate real igual esta en
// CIS/CORE (DOC-023) -- esto solo evita mostrar una pantalla sin salida.
function RequireModulo({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  if (!moduloHabilitado(path)) {
    return <Navigate to="/" replace />;
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
              <RequireModulo path="contratos">
                <ContratosPage />
              </RequireModulo>
            </RequireAuth>
          }
        />
        <Route
          path="/inventarios"
          element={
            <RequireAuth>
              <RequireModulo path="inventarios">
                <InventariosPage />
              </RequireModulo>
            </RequireAuth>
          }
        />
        <Route
          path="/estructura"
          element={
            <RequireAuth>
              <RequireModulo path="estructura">
                <EstructuraPage />
              </RequireModulo>
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
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/importaciones"
          element={
            <RequireAuth>
              <ImportacionesPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
