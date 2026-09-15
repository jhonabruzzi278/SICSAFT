import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cisClient, type Area, type SesionInventario } from '@/lib/cis-client';
import { Alert, Button } from '@/components/ui';
import { HistorialSesiones } from './HistorialSesiones';

// DOC-035 — landing nueva de "Controles de área": antes era directo la tabla plana de sesiones
// (UUIDs crudos, ~23 filas reales sin agrupar). Ahora es el organigrama
// Organización→Dirección→Departamento→Área que ya existe en ccp/EstructuraPage.tsx (mismos
// `area.dependencia`/`area.departamento`, cargados por Excel — DOC-033), con un contador de
// reportes por área. Clic en un Área/Dirección/Departamento navega a la lista de reportes de ese
// alcance (ReportesDeAreaPage.tsx). ccp/ y core/frontend/ no comparten código (son SPAs
// independientes) — esto es una adaptación, no una extracción compartida.

const SIN_DIRECCION = 'Sin dirección';
const SIN_DEPARTAMENTO = 'Sin departamento';

const ACENTO_DIRECCION = [
  { borde: 'border-l-blue-500', punto: 'bg-blue-500' },
  { borde: 'border-l-emerald-500', punto: 'bg-emerald-500' },
  { borde: 'border-l-amber-500', punto: 'bg-amber-500' },
  { borde: 'border-l-purple-500', punto: 'bg-purple-500' },
  { borde: 'border-l-sky-500', punto: 'bg-sky-500' },
] as const;

interface AreaConConteo {
  area: Area;
  conteo: number;
}

interface DepartamentoGrupo {
  departamento: string;
  areas: AreaConConteo[];
  conteo: number;
}

interface DireccionGrupo {
  direccion: string;
  areas: AreaConConteo[];
  porDepartamento: DepartamentoGrupo[] | null;
  conteo: number;
}

function agrupar(
  areas: Area[],
  sesiones: SesionInventario[],
): DireccionGrupo[] {
  const conteoPorArea = new Map<string, number>();
  for (const s of sesiones) {
    conteoPorArea.set(s.areaId, (conteoPorArea.get(s.areaId) ?? 0) + 1);
  }

  const porDireccion = new Map<string, Area[]>();
  for (const area of areas) {
    const direccion = area.dependencia?.trim() || SIN_DIRECCION;
    const lista = porDireccion.get(direccion) ?? [];
    lista.push(area);
    porDireccion.set(direccion, lista);
  }

  const grupos = Array.from(porDireccion.entries()).map(
    ([direccion, areasDeDireccion]): DireccionGrupo => {
      const conAreaConteo = areasDeDireccion.map((area) => ({
        area,
        conteo: conteoPorArea.get(area.id) ?? 0,
      }));
      const usaDepartamento = areasDeDireccion.some((a) =>
        a.departamento?.trim(),
      );
      const conteoTotal = conAreaConteo.reduce((acc, a) => acc + a.conteo, 0);

      if (!usaDepartamento) {
        return {
          direccion,
          areas: conAreaConteo,
          porDepartamento: null,
          conteo: conteoTotal,
        };
      }

      const porDepartamento = new Map<string, AreaConConteo[]>();
      for (const a of conAreaConteo) {
        const departamento = a.area.departamento?.trim() || SIN_DEPARTAMENTO;
        const lista = porDepartamento.get(departamento) ?? [];
        lista.push(a);
        porDepartamento.set(departamento, lista);
      }
      const gruposDepartamento = Array.from(porDepartamento.entries())
        .map(([departamento, areasDelDepartamento]): DepartamentoGrupo => ({
          departamento,
          areas: areasDelDepartamento,
          conteo: areasDelDepartamento.reduce((acc, a) => acc + a.conteo, 0),
        }))
        .sort((a, b) =>
          a.departamento === SIN_DEPARTAMENTO
            ? 1
            : b.departamento === SIN_DEPARTAMENTO
              ? -1
              : a.departamento.localeCompare(b.departamento, 'es'),
        );

      return {
        direccion,
        areas: conAreaConteo,
        porDepartamento: gruposDepartamento,
        conteo: conteoTotal,
      };
    },
  );

  return grupos.sort((a, b) =>
    a.direccion === SIN_DIRECCION
      ? 1
      : b.direccion === SIN_DIRECCION
        ? -1
        : a.direccion.localeCompare(b.direccion, 'es'),
  );
}

export function OrganigramaControlesArea() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const navigate = useNavigate();

  const [organizacionNombre, setOrganizacionNombre] = useState('');
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [sesiones, setSesiones] = useState<SesionInventario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  useEffect(() => {
    if (!organizacionId) return;
    let cancelled = false;
    setError(null);
    cisClient
      .authSession()
      .then((res) => {
        if (cancelled) return;
        const org = res.organizaciones.find((o) => o.id === organizacionId);
        setOrganizacionNombre(org?.nombre ?? '');
      })
      .catch(() => {
        // Sin nombre de organización el encabezado cae al fallback genérico.
      });
    Promise.all([
      cisClient.getAreas(organizacionId),
      cisClient.getInventarios(organizacionId),
    ])
      .then(([areasRes, sesionesRes]) => {
        if (cancelled) return;
        setAreas(areasRes);
        setSesiones(sesionesRes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId]);

  const porDireccion = useMemo(
    () => agrupar(areas ?? [], sesiones ?? []),
    [areas, sesiones],
  );

  function irAReportes(params: Record<string, string>) {
    const query = new URLSearchParams({ organizacionId, ...params });
    navigate(`/dashboard/controles-area/reportes?${query.toString()}`);
  }

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  const totalReportes = sesiones?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-accent-strong">
            Controles de Área y Contrastación BPI
          </h1>
          <p className="mt-1 text-sm text-text-dim">
            Recepción y supervisión de sesiones de relevamiento en terreno
            enviadas desde la App Móvil QR.
          </p>
        </div>
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          onClick={() => setMostrarHistorial((v) => !v)}
        >
          {mostrarHistorial ? 'Ocultar historial' : 'Ver historial'}
        </Button>
      </div>

      {mostrarHistorial && (
        <HistorialSesiones organizacionId={organizacionId} />
      )}

      {error && <Alert>{error}</Alert>}
      {!error && (!areas || !sesiones) && (
        <p className="text-text-dim">Cargando organigrama…</p>
      )}

      {areas && areas.length === 0 && (
        <p className="text-text-dim">
          Sin áreas cargadas todavía — se definen desde el Excel de carga masiva
          en el CCP.
        </p>
      )}

      {areas && areas.length > 0 && sesiones && (
        <div className="rounded-xl border border-border bg-bg-card p-6 shadow-elev-1">
          <p className="text-xl font-bold tracking-tight text-text">
            {organizacionNombre || 'Organización'}
          </p>
          <p className="mt-0.5 text-xs text-text-dim">
            {porDireccion.length}{' '}
            {porDireccion.length === 1 ? 'dirección' : 'direcciones'} ·{' '}
            {areas.length} {areas.length === 1 ? 'área' : 'áreas'} ·{' '}
            {totalReportes} {totalReportes === 1 ? 'reporte' : 'reportes'}{' '}
            recibidos
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {porDireccion.map((grupo, i) => {
              const esSinDireccion = grupo.direccion === SIN_DIRECCION;
              const acento = ACENTO_DIRECCION[i % ACENTO_DIRECCION.length];
              return (
                <div
                  key={grupo.direccion}
                  className={`rounded-lg border border-border bg-bg-raised p-4 ${
                    esSinDireccion
                      ? 'border-dashed opacity-80'
                      : `border-l-4 ${acento.borde}`
                  }`}
                >
                  <button
                    type="button"
                    disabled={esSinDireccion}
                    onClick={() => irAReportes({ direccion: grupo.direccion })}
                    className={`flex w-full items-center justify-between gap-2 rounded-md ${
                      esSinDireccion ? 'cursor-default' : 'hover:bg-bg-card'
                    } -m-1 p-1 text-left`}
                  >
                    <span
                      className={`text-sm font-semibold ${esSinDireccion ? 'text-text-dim' : 'text-text'}`}
                    >
                      {grupo.direccion}
                    </span>
                    <span className="shrink-0 rounded-full bg-bg-card px-2 py-0.5 text-[0.7rem] font-medium text-accent-strong">
                      {grupo.conteo}
                    </span>
                  </button>

                  {grupo.porDepartamento ? (
                    <div className="mt-3 space-y-3">
                      {grupo.porDepartamento.map((dep) => {
                        const esSinDepartamento =
                          dep.departamento === SIN_DEPARTAMENTO;
                        return (
                          <div key={dep.departamento}>
                            <button
                              type="button"
                              disabled={esSinDepartamento}
                              onClick={() =>
                                irAReportes({
                                  direccion: grupo.direccion,
                                  departamento: dep.departamento,
                                })
                              }
                              className={`flex w-full items-center justify-between gap-2 rounded ${
                                esSinDepartamento
                                  ? 'cursor-default'
                                  : 'hover:bg-bg-card'
                              } px-0.5 text-left`}
                            >
                              <span className="text-[0.7rem] font-semibold tracking-wide text-text-faint uppercase">
                                {dep.departamento}
                              </span>
                              <span className="text-[0.65rem] font-medium text-text-faint">
                                {dep.conteo}
                              </span>
                            </button>
                            <ul className="mt-1.5 space-y-1">
                              {dep.areas.map((a) => (
                                <AreaItem
                                  key={a.area.id}
                                  areaConConteo={a}
                                  punto={esSinDireccion ? null : acento.punto}
                                  onClick={() =>
                                    irAReportes({ areaId: a.area.id })
                                  }
                                />
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-1">
                      {grupo.areas.map((a) => (
                        <AreaItem
                          key={a.area.id}
                          areaConConteo={a}
                          punto={esSinDireccion ? null : acento.punto}
                          onClick={() => irAReportes({ areaId: a.area.id })}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AreaItem({
  areaConConteo,
  punto,
  onClick,
}: {
  areaConConteo: AreaConConteo;
  punto: string | null;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-2 rounded px-0.5 py-0.5 text-left text-xs text-text-dim hover:bg-bg-card hover:text-text"
      >
        <span className="flex min-w-0 items-center gap-2">
          {punto && (
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${punto}`} />
          )}
          <span className="truncate">{areaConConteo.area.nombre}</span>
        </span>
        <span className="shrink-0 rounded-full bg-bg-card px-1.5 py-0.5 text-[0.65rem] font-semibold text-text-faint">
          {areaConConteo.conteo}
        </span>
      </button>
    </li>
  );
}
