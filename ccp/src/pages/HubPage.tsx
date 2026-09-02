import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { cisClient, type Organizacion } from '@/lib/cis-client';
import { moduloHabilitado } from '@/lib/nivel';
import { Alert } from '@/components/ui';
import {
  IconBox,
  IconChart,
  IconChevronDown,
  IconFileText,
  IconLayers,
  IconMapPin,
  IconQrCode,
  IconUpload,
} from '@/components/icons';

// RF-02 — hub post-login. DOC-013 5 deja abierto si el resto de los módulos WEB necesita su
// propio valor en `modulosContratados` — acá simplemente se listan las organizaciones donde el
// operador tiene contrato vigente (GET /entitlements vía auth/session) y, por cada una, los
// módulos ya implementados (Activos, Contratos).
//
// DOC-022 — el Directivo ya no entra a CCP: tiene su propio portal (`core/frontend/`), así que la
// segmentación por rol de DOC-020 (vista ejecutiva de solo-Dashboard, redirect automático) queda
// superada por este incremento y se elimina de acá. `dashboard` se queda en este listado porque
// sigue siendo un módulo legítimo para el Profesional de AFT (RF-09/DOC-019, anterior a que
// existiera el rol Directivo).
type Modulo = {
  path: string;
  nombre: string;
  descripcion: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

// DOC-029 RF-A (corregido 2026-09-02) -- el CCP va completo en todos los niveles; lo unico que
// `moduloHabilitado` oculta en Nivel 1 es `dashboard` (CIP). Contratos/Inventarios estan
// retirados en cualquier nivel. Decide por `path` (ver lib/nivel.ts).
const MODULOS: Modulo[] = [
  {
    path: 'activos',
    nombre: 'Activos',
    descripcion: 'Consulta y alta de activos fijos',
    icon: IconBox,
  },
  {
    path: 'contratos',
    nombre: 'Contratos',
    descripcion: 'Vigencia y transiciones de estado',
    icon: IconFileText,
  },
  {
    path: 'inventarios',
    nombre: 'Inventarios',
    descripcion: 'Sesiones de control y sus escaneos',
    icon: IconLayers,
  },
  {
    path: 'estructura',
    nombre: 'Áreas, ubicaciones y responsables',
    descripcion: 'ABM de la estructura patrimonial',
    icon: IconMapPin,
  },
  // RF-14 (DOC-021, gap "importaciones controladas") — por organización, como el resto (a
  // diferencia de "Administración", que es transversal — ver AppShell).
  {
    path: 'importaciones',
    nombre: 'Importaciones',
    descripcion: 'Carga masiva desde archivo',
    icon: IconUpload,
  },
  // DOC-029 RF-F — todos los QR acuñados, por dirección, listos para imprimir en etiquetas.
  {
    path: 'etiquetas',
    nombre: 'QR / Etiquetas',
    descripcion: 'Códigos QR por dirección, listos para imprimir',
    icon: IconQrCode,
  },
  {
    path: 'dashboard',
    nombre: 'Dashboard',
    descripcion: 'Indicadores de cobertura y estado',
    icon: IconChart,
  },
];

export function HubPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cisClient
      .authSession()
      .then((res) => {
        if (!cancelled) setOrganizaciones(res.organizaciones);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Con una sola organización (caso común, ver fixtures/README) el sidebar de módulos recién
  // aparece cuando hay organizacionId en la URL — sin este redirect el operador aterrizaba
  // primero en esta lista de tarjetas, con el AppShell "viejo" (sin sidebar), y solo veía el
  // rediseño después de entrar manualmente a un módulo. Mismo patrón que
  // core/frontend/InicioPage.tsx para el Directivo.
  if (organizaciones?.length === 1) {
    const [unicaOrg] = organizaciones;
    return (
      <Navigate
        to={`/dashboard?organizacionId=${encodeURIComponent(unicaOrg.id)}`}
        replace
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-accent-strong">
        Organizaciones
      </h1>
      <p className="mt-1 mb-6 text-sm text-text-dim">
        Elegí la organización y el módulo con el que vas a trabajar.
      </p>
      {error && <Alert>{error}</Alert>}
      {!error && !organizaciones && <p className="text-text-dim">Cargando…</p>}
      {organizaciones?.length === 0 && (
        <p className="text-text-dim">
          No hay organizaciones con contrato vigente.
        </p>
      )}
      <div className="space-y-8">
        {organizaciones?.map((org) => (
          <div key={org.id}>
            <h2 className="mb-3 font-medium text-text">
              {org.nombre}{' '}
              <span className="text-sm font-normal text-text-dim">
                — {org.sedes.length} {org.sedes.length === 1 ? 'sede' : 'sedes'}
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {MODULOS.filter(({ path }) => moduloHabilitado(path)).map(
                ({ path, nombre, descripcion, icon: Icon }) => (
                  <Link
                    key={path}
                    to={`/${path}?organizacionId=${encodeURIComponent(org.id)}`}
                    className="group flex items-start gap-4 rounded-xl border border-border bg-bg-card p-5 shadow-elev-1 transition-colors hover:border-border-strong hover:bg-bg-raised"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent-strong">
                      <Icon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-text">{nombre}</h3>
                      <p className="mt-0.5 text-xs text-text-dim">
                        {descripcion}
                      </p>
                    </div>
                    <IconChevronDown className="mt-1 -rotate-90 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-text-dim" />
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
