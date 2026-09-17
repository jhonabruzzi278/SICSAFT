import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cisClient, type Area } from '@/lib/cis-client';
import { dashboardClient, type VeredictoSesion } from '@/lib/dashboard-client';
import { Alert, Button } from '@/components/ui';
import { HistorialSesiones } from './HistorialSesiones';

// DOC-035 — landing nueva de "Controles de área": antes era directo la tabla plana de sesiones
// (UUIDs crudos, ~23 filas reales sin agrupar). Ahora es el organigrama
// Organización→Dirección→Departamento→Área que ya existe en ccp/EstructuraPage.tsx (mismos
// `area.dependencia`/`area.departamento`, cargados por Excel — DOC-033), con un contador de
// reportes por área. Clic en un Área/Dirección/Departamento navega a la lista de reportes de ese
// alcance (ReportesDeAreaPage.tsx). ccp/ y core/frontend/ no comparten código (son SPAs
// independientes) — esto es una adaptación, no una extracción compartida.
//
// 2026-09-16 (notificaciones) — Dirección sigue mostrando el TOTAL de reportes (foto general de
// volumen), pero Departamento/Área pasan a mostrar solo el conteo de "notificación": sesiones
// aceptable/defectuoso que todavía no se marcaron revisadas (ver PantallaControlArea.tsx "Marcar
// como revisado"). Por eso la fuente de datos cambia de cisClient.getInventarios (CORE, sin
// veredicto) a dashboardClient.getSesiones (CIP, sí trae veredicto/revisado) — paginado hasta
// agotar porque CIP tope a 100 filas por página.

const SIN_DIRECCION = 'Sin dirección';
const SIN_DEPARTAMENTO = 'Sin departamento';

const ACENTO_DIRECCION = [
  { borde: 'border-l-blue-500', punto: 'bg-blue-500' },
  { borde: 'border-l-emerald-500', punto: 'bg-emerald-500' },
  { borde: 'border-l-amber-500', punto: 'bg-amber-500' },
  { borde: 'border-l-purple-500', punto: 'bg-purple-500' },
  { borde: 'border-l-sky-500', punto: 'bg-sky-500' },
] as const;

type SeveridadVeredicto = 'critico' | 'atencion';

interface Notificacion {
  total: number;
  severidad: SeveridadVeredicto;
}

interface AreaConConteo {
  area: Area;
  conteoTotal: number;
  notificacion: Notificacion | null;
}

interface DepartamentoGrupo {
  departamento: string;
  areas: AreaConConteo[];
  notificacion: Notificacion | null;
}

interface DireccionGrupo {
  direccion: string;
  areas: AreaConConteo[];
  porDepartamento: DepartamentoGrupo[] | null;
  conteoTotal: number;
}

function severidadDeVeredicto(veredicto: string): SeveridadVeredicto | null {
  if (veredicto === 'defectuoso') return 'critico';
  if (veredicto === 'aceptable') return 'atencion';
  return null;
}

// El peor caso gana (rojo tapa amarillo) — mismo criterio que el contador de Hallazgos de
// Pantalla 8: si un área/departamento tiene aunque sea 1 sesión defectuosa sin revisar, el nodo
// entero se pinta rojo, no amarillo.
function combinarNotificaciones(
  notificaciones: Array<Notificacion | null>,
): Notificacion | null {
  const total = notificaciones.reduce((acc, n) => acc + (n?.total ?? 0), 0);
  if (total === 0) return null;
  const severidad = notificaciones.some((n) => n?.severidad === 'critico')
    ? 'critico'
    : 'atencion';
  return { total, severidad };
}

function agrupar(areas: Area[], sesiones: VeredictoSesion[]): DireccionGrupo[] {
  const conteoTotalPorArea = new Map<string, number>();
  const notificacionPorArea = new Map<string, Notificacion>();
  for (const s of sesiones) {
    conteoTotalPorArea.set(
      s.areaId,
      (conteoTotalPorArea.get(s.areaId) ?? 0) + 1,
    );
    const severidad = !s.revisado ? severidadDeVeredicto(s.veredicto) : null;
    if (!severidad) continue;
    const actual = notificacionPorArea.get(s.areaId);
    notificacionPorArea.set(s.areaId, {
      total: (actual?.total ?? 0) + 1,
      severidad:
        actual?.severidad === 'critico'
          ? 'critico'
          : severidad === 'critico'
            ? 'critico'
            : severidad,
    });
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
      const conAreaConteo = areasDeDireccion.map((area): AreaConConteo => ({
        area,
        conteoTotal: conteoTotalPorArea.get(area.id) ?? 0,
        notificacion: notificacionPorArea.get(area.id) ?? null,
      }));
      const usaDepartamento = areasDeDireccion.some((a) =>
        a.departamento?.trim(),
      );
      const conteoTotal = conAreaConteo.reduce(
        (acc, a) => acc + a.conteoTotal,
        0,
      );

      if (!usaDepartamento) {
        return {
          direccion,
          areas: conAreaConteo,
          porDepartamento: null,
          conteoTotal,
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
          notificacion: combinarNotificaciones(
            areasDelDepartamento.map((a) => a.notificacion),
          ),
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
        conteoTotal,
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

function NotificacionBadge({
  notificacion,
}: {
  notificacion: Notificacion | null;
}) {
  if (!notificacion) return null;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-bold text-bg ${
        notificacion.severidad === 'critico' ? 'bg-destructive' : 'bg-warning'
      }`}
    >
      {notificacion.total}
    </span>
  );
}

export function OrganigramaControlesArea() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const navigate = useNavigate();

  const [organizacionNombre, setOrganizacionNombre] = useState('');
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [sesiones, setSesiones] = useState<VeredictoSesion[] | null>(null);
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
      dashboardClient.getTodasLasSesiones(organizacionId),
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

  function irAReportes(
    params: Record<string, string>,
    notificacion?: Notificacion | null,
  ) {
    const query = new URLSearchParams({ organizacionId, ...params });
    // "conectado a los reportes con ese estado veredicto" — filtra a la severidad que mostró el
    // badge (el peor caso, si combina aceptable+defectuoso). Sin notificación (o Dirección, que
    // no pasa `notificacion`), la lista llega sin filtrar, como siempre.
    if (notificacion) {
      query.set(
        'veredicto',
        notificacion.severidad === 'critico' ? 'defectuoso' : 'aceptable',
      );
    }
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
                      {grupo.conteoTotal}
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
                                irAReportes(
                                  {
                                    direccion: grupo.direccion,
                                    departamento: dep.departamento,
                                  },
                                  dep.notificacion,
                                )
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
                              <NotificacionBadge
                                notificacion={dep.notificacion}
                              />
                            </button>
                            <ul className="mt-1.5 space-y-1">
                              {dep.areas.map((a) => (
                                <AreaItem
                                  key={a.area.id}
                                  areaConConteo={a}
                                  punto={esSinDireccion ? null : acento.punto}
                                  onClick={() =>
                                    irAReportes(
                                      { areaId: a.area.id },
                                      a.notificacion,
                                    )
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
                          onClick={() =>
                            irAReportes({ areaId: a.area.id }, a.notificacion)
                          }
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
        <NotificacionBadge notificacion={areaConConteo.notificacion} />
      </button>
    </li>
  );
}
