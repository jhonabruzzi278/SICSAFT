import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui';
import { DropzoneImportacionExcel } from './importaciones/DropzoneImportacionExcel';
import { LotesRevision } from './importaciones/LotesRevision';
import { CargaManualCsv } from './importaciones/CargaManualCsv';
import { IconUpload, IconLayers } from '@/components/icons';

// DOC-012 6 + DOC-029 RF-B / Mejora 6 — Módulo de Importaciones Controladas:
//  - Ingesta Directa con Diff Visual (Mejora 6): arrastrar y soltar Excel/CSV, previsualizar
//    altas/cambios/conflictos en tiempo real y confirmar en la BPI.
//  - Bandeja de Staging (RF-B): revisión y aprobación de lotes normalizados por la carpeta vigilada.
//  - Carga manual tradicional (CSV).

export function ImportacionesPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const [pestana, setPestana] = useState<'diff' | 'lotes' | 'csv'>('diff');

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-accent-strong">
          Importaciones Patrimoniales
        </h1>
        <p className="mt-1 text-sm text-text-dim">
          Módulo de ingesta masiva de inventario contable y control patrimonial.
          Previsualiza diferencias o gestiona lotes de staging.
        </p>
      </div>

      {/* Selector de modo / Pestañas */}
      <div className="flex rounded-xl border border-border bg-bg-card p-1 text-xs">
        <button
          type="button"
          onClick={() => setPestana('diff')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-medium transition-all ${
            pestana === 'diff'
              ? 'bg-accent text-bg shadow-elev-float'
              : 'text-text-dim hover:text-text'
          }`}
        >
          <IconUpload /> Ingesta Directa (Drag & Drop + Diff Visual)
        </button>
        <button
          type="button"
          onClick={() => setPestana('lotes')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-medium transition-all ${
            pestana === 'lotes'
              ? 'bg-accent text-bg shadow-elev-float'
              : 'text-text-dim hover:text-text'
          }`}
        >
          <IconLayers /> Bandeja de Staging (Carpeta Vigilada)
        </button>
        <button
          type="button"
          onClick={() => setPestana('csv')}
          className={`rounded-lg px-4 py-2 font-medium transition-all ${
            pestana === 'csv'
              ? 'bg-accent text-bg shadow-elev-float'
              : 'text-text-dim hover:text-text'
          }`}
        >
          CSV Estricto
        </button>
      </div>

      {/* Contenido de la pestaña activa */}
      {pestana === 'diff' && (
        <DropzoneImportacionExcel organizacionId={organizacionId} />
      )}

      {pestana === 'lotes' && <LotesRevision organizacionId={organizacionId} />}

      {pestana === 'csv' && <CargaManualCsv organizacionId={organizacionId} />}
    </div>
  );
}
