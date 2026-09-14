import { Link } from 'react-router-dom';
import { esNivel2 } from '@/lib/nivel';
import { IconSparkles, IconUsers } from '@/components/icons';
import { CipPage } from './cip/CipPage';

// Fase 2 (rediseño CIP) — esta página solo decide Nivel 1 (teaser) vs Nivel 2 (CIP real). Todo el
// contenido de Nivel 2 vivía acá antes como un único bloque; ahora es `CipPage` con sus
// sub-pestañas (Resumen / Activos / Controles de área, ver pages/cip/CipPage.tsx).
export function DashboardPage() {
  const nivel2Habilitado = esNivel2();

  if (!nivel2Habilitado) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-5">
          <div className="flex items-center gap-2 text-xs font-bold text-text-dim uppercase tracking-wider">
            <span>Portal del Directivo</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-text">
            Resumen Institucional
          </h1>
          <p className="mt-0.5 text-sm text-text-dim">
            Monitoreo general de la organización y designación de profesionales
            de AFT.
          </p>
        </div>

        <div className="rounded-2xl border border-accent/30 bg-bg-card p-6 shadow-elev-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-bg font-bold">
              <IconSparkles />
            </span>
            <div>
              <h2 className="font-bold text-text text-base">
                Inteligencia de Negocio Patrimonial (CIP)
              </h2>
              <p className="text-xs text-text-dim">
                El Centro de Inteligencia Patrimonial con analítica en tiempo
                real, gráficos predictivos y control de desvíos está disponible
                en <strong>Nivel 2 Enterprise</strong>.
              </p>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Link
              to="/gestionar-profesional-aft"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-bg"
            >
              <IconUsers />
              Gestionar Profesionales de AFT
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <CipPage />;
}
