import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { cisClient, type Area } from '@/lib/cis-client';
import { Alert } from '@/components/ui';
import { PantallaControlArea } from '@/components/PantallaControlArea';
import { IconChevronLeft } from '@/components/icons';

// DOC-035 — página de pantalla completa de un reporte puntual (reemplaza el pop-up de
// ControlesAreaTab.tsx). Resuelve el área/dirección/departamento de la sesión por su cuenta (vía
// GET /inventarios/:id, que ya trae `areaId`) en vez de depender de que quien enlace acá pase esos
// datos por query — así funciona igual desde el organigrama, la lista de reportes o el link "Ver
// reporte completo" de AlertasTab.tsx.

export function ReporteControlPage() {
  const { sesionId } = useParams<{ sesionId: string }>();
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [areaId, setAreaId] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizacionId || !sesionId) return;
    let cancelled = false;
    setError(null);
    Promise.all([
      cisClient.getAreas(organizacionId),
      cisClient.getInventarioDetalle(sesionId),
    ])
      .then(([areasRes, detalle]) => {
        if (cancelled) return;
        setAreas(areasRes);
        setAreaId(detalle.areaId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId, sesionId]);

  if (!organizacionId || !sesionId) {
    return (
      <Alert>
        Falta organizacionId o el identificador de la sesión — volvé al
        organigrama.
      </Alert>
    );
  }

  if (error) return <Alert>{error}</Alert>;
  if (!areas || !areaId) {
    return <p className="text-text-dim">Cargando reporte…</p>;
  }

  const area = areas.find((a) => a.id === areaId);
  const areaNombre = area?.nombre ?? '(área no encontrada)';

  return (
    <div className="space-y-5">
      <Link
        to={`/dashboard/controles-area/reportes?organizacionId=${encodeURIComponent(organizacionId)}&areaId=${encodeURIComponent(areaId)}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-text-dim hover:text-text"
      >
        <IconChevronLeft />
        Volver a los reportes de {areaNombre}
      </Link>

      <PantallaControlArea
        sesionId={sesionId}
        organizacionId={organizacionId}
        areaNombre={areaNombre}
        direccionNombre={area?.dependencia ?? null}
        departamentoNombre={area?.departamento ?? null}
      />
    </div>
  );
}
