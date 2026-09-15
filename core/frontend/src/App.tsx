import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { RequireNivel2 } from '@/components/RequireNivel2';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { InicioPage } from '@/pages/InicioPage';
import { GestionarProfesionalAftPage } from '@/pages/GestionarProfesionalAftPage';
import { ResumenTab } from '@/pages/cip/ResumenTab';
import { ActivosTab } from '@/pages/cip/ActivosTab';
import { ControlesAreaTab } from '@/pages/cip/ControlesAreaTab';
import { AlertasTab } from '@/pages/cip/AlertasTab';

function RequireAuth({ children }: { children: ReactNode }) {
  if (!oidcClient.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// 2026-09-14 — el CIP dejó de ser una única ruta (`/dashboard`) con sub-pestañas internas
// (`CipPage.tsx`, eliminado) y pasó a ser 4 rutas directas, cada una navegable desde su propia
// entrada del sidebar (ver AppShell.tsx). `/dashboard` sigue siendo la ruta "hogar" (Resumen) para
// no romper el redirect que ya hace InicioPage.tsx tras resolver la organización.
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
              <InicioPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <RequireNivel2>
                <ResumenTab />
              </RequireNivel2>
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/activos"
          element={
            <RequireAuth>
              <RequireNivel2>
                <ActivosTab />
              </RequireNivel2>
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/controles-area"
          element={
            <RequireAuth>
              <RequireNivel2>
                <ControlesAreaTab />
              </RequireNivel2>
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/alertas"
          element={
            <RequireAuth>
              <RequireNivel2>
                <AlertasTab />
              </RequireNivel2>
            </RequireAuth>
          }
        />
        <Route
          path="/gestionar-profesional-aft"
          element={
            <RequireAuth>
              <GestionarProfesionalAftPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
