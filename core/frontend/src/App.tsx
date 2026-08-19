import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { oidcClient } from '@/lib/oidc/oidc-client';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { InicioPage } from '@/pages/InicioPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GestionarProfesionalAftPage } from '@/pages/GestionarProfesionalAftPage';

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
              <InicioPage />
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
