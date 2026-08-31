import { useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui';
import { CargaManualCsv } from './importaciones/CargaManualCsv';
import { LotesRevision } from './importaciones/LotesRevision';

// DOC-012 6 + DOC-029 RF-B. Dos caminos de carga:
//  - Carpeta vigilada (RF-B): el especialista deja Excel, SICSAFT los traduce y el AFT revisa y
//    aprueba lote a lote antes de que toquen la Base Patrimonial. Es el camino de carga inicial
//    del cliente Nivel 1.
//  - Carga manual (CSV): puntual, con IDs ya resueltos, sin bandeja de staging.
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
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold text-accent-strong">
        Importaciones controladas
      </h1>

      <LotesRevision organizacionId={organizacionId} />

      <hr className="border-border" />

      <CargaManualCsv organizacionId={organizacionId} />
    </div>
  );
}
