import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cisClient, type Area } from '@/lib/cis-client';
import { Alert } from '@/components/ui';
import { JerarquiaSection } from '@/pages/estructura/JerarquiaSection';
import { DireccionesSection } from '@/pages/estructura/DireccionesSection';
import { AreasSection } from '@/pages/estructura/AreasSection';
import { ResponsablesSection } from '@/pages/estructura/ResponsablesSection';

// RF-05 — módulo "Organización": Organigrama (Dirección→Departamento→Área) + rollup de
// Direcciones + ABM de Áreas y Responsables. Cada sección vive en su propio archivo bajo
// `pages/estructura/` — este componente solo orquesta la carga de datos compartida (áreas,
// nombre de la organización) y arma el layout.
export function EstructuraPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [areas, setAreas] = useState<Area[] | null>(null);
  const [areasError, setAreasError] = useState<string | null>(null);
  // DOC-033 — nombre real de la organización para el encabezado de la jerarquía
  // Organización→Dirección→Departamento→Área (siempre "lo más arriba", ver diseño). Antes se
  // descartaba, este mismo `authSession()` ya lo trae.
  const [organizacionNombre, setOrganizacionNombre] = useState('');

  useEffect(() => {
    if (!organizacionId) return;
    cisClient
      .authSession()
      .then((res) => {
        const org = res.organizaciones.find((o) => o.id === organizacionId);
        setOrganizacionNombre(org?.nombre ?? '');
      })
      .catch(() => {
        // Sin nombre de organización el encabezado del organigrama cae al fallback genérico
        // ("Organización") — no es un error que el operador necesite ver.
      });
  }, [organizacionId]);

  function cargarAreas() {
    setAreasError(null);
    cisClient
      .getAreas(organizacionId)
      .then(setAreas)
      .catch((err: unknown) => {
        setAreasError(err instanceof Error ? err.message : 'Error desconocido');
      });
  }

  useEffect(() => {
    if (organizacionId) cargarAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargarAreas se recrea cada render a proposito
  }, [organizacionId]);

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-accent-strong">
        Organización
      </h1>
      <p className="mb-6 text-sm text-text-dim">
        Organigrama, direcciones, áreas y responsables.
      </p>
      <div className="space-y-8">
        <JerarquiaSection
          organizacionNombre={organizacionNombre}
          areas={areas}
        />
        <DireccionesSection areas={areas} />
        <AreasSection
          organizacionId={organizacionId}
          areas={areas}
          error={areasError}
          onCreated={cargarAreas}
        />
        <ResponsablesSection organizacionId={organizacionId} areas={areas} />
      </div>
    </div>
  );
}
