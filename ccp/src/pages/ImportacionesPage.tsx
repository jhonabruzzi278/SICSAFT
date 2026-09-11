import { useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui';
import { LotesRevision } from './importaciones/LotesRevision';
import { IconLayers } from '@/components/icons';

export function ImportacionesPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Encabezado del Módulo Oficial de Ingesta */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent-strong uppercase">
            <IconLayers />
            <span>Sidecar Python ETL & Base Patrimonial</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-text">
            Bandeja de Ingesta Contable Directa a BPI
          </h1>
          <p className="mt-0.5 text-xs text-text-dim">
            Trazabilidad y supervisión de planillas Excel (.xlsx) procesadas
            automáticamente e ingresadas a la BPI (CIS → CORE → Base
            Patrimonial) sin revisión manual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Vigilante Python Activo
          </span>
        </div>
      </div>

      {/* Bandeja de Staging Oficial (Lotes de Revisión CIS / CORE) */}
      <LotesRevision organizacionId={organizacionId} />
    </div>
  );
}
