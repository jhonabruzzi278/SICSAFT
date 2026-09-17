import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cisClient, type Area, type SesionInventario } from '@/lib/cis-client';
import { dashboardClient, type VeredictoSesion } from '@/lib/dashboard-client';
import { nombreOperador } from '@/lib/pantalla-8';
import { Alert, Badge, Button, Input, Label } from '@/components/ui';
import { IconChevronLeft } from '@/components/icons';

// DOC-035 — pantalla intermedia entre el organigrama y un reporte puntual: lista de sesiones del
// alcance elegido (una Área, o todas las áreas de una Dirección/Departamento), con filtro por día
// y paginación real en vez de una tabla que crece sin límite (antes: ~23 filas de UUIDs crudos,
// todas a la vez, sin filtro — ver ControlesAreaTab.tsx, eliminado por este mismo incremento).
//
// 2026-09-16 (notificaciones) — muestra TODOS los reportes del alcance (no solo los pendientes),
// pero cada fila lleva su veredicto con color (mismo criterio amarillo/rojo del resto de la app) +
// un filtro por veredicto. Junta dos fuentes: CIS (operadorId, vía cisClient.getInventarios) y CIP
// (veredicto/revisado, vía dashboardClient — sin ella no hay forma de saber el resultado de la
// sesión, ver el mismo hallazgo en OrganigramaControlesArea.tsx).

const POR_PAGINA = 10;

const ETIQUETA_VEREDICTO: Record<string, string> = {
  exitoso: 'Exitoso',
  aceptable: 'Aceptable',
  defectuoso: 'Defectuoso',
};

const VARIANTE_VEREDICTO: Record<string, 'success' | 'warning' | 'error'> = {
  exitoso: 'success',
  aceptable: 'warning',
  defectuoso: 'error',
};

const FILTROS_VEREDICTO = [
  { id: '', label: 'Todos' },
  { id: 'exitoso', label: 'Exitoso' },
  { id: 'aceptable', label: 'Aceptable' },
  { id: 'defectuoso', label: 'Defectuoso' },
] as const;

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CL');
}

// Fecha local (no UTC) — comparar por día calendario de Chile, no por el corte UTC que correría
// el día para sesiones cerradas después de las 21:00/20:00 local (UTC-3/UTC-4).
function fechaLocalISO(iso: string): string {
  const d = new Date(iso);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// El nombre real de la Dirección/Departamento (texto libre, cargado por Excel) suele venir ya
// prefijado ("Dirección Económica Administrativa", ver captura de referencia del usuario) — anteponer
// la etiqueta genérica sin chequear duplicaba la palabra ("Dirección Dirección..."). Solo se
// antepone cuando el valor no la trae ya.
function tituloConPrefijo(prefijo: string, valor: string): string {
  const yaLaTiene = valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .startsWith(prefijo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  return yaLaTiene ? valor : `${prefijo} ${valor}`;
}

interface Alcance {
  areaIds: Set<string>;
  titulo: string;
  ruta: string | null;
  // Se propagan al reporte individual para que su header no vuelva a mostrar el UUID.
  areaNombrePorId: Map<string, string>;
  direccionNombrePorAreaId: Map<string, string | null>;
  departamentoNombrePorAreaId: Map<string, string | null>;
}

function resolverAlcance(
  areas: Area[],
  areaId: string | null,
  direccion: string | null,
  departamento: string | null,
): Alcance | null {
  const areaNombrePorId = new Map(areas.map((a) => [a.id, a.nombre]));
  const direccionNombrePorAreaId = new Map(
    areas.map((a) => [a.id, a.dependencia]),
  );
  const departamentoNombrePorAreaId = new Map(
    areas.map((a) => [a.id, a.departamento]),
  );
  const base = {
    areaNombrePorId,
    direccionNombrePorAreaId,
    departamentoNombrePorAreaId,
  };

  if (areaId) {
    const area = areas.find((a) => a.id === areaId);
    if (!area) return null;
    return {
      ...base,
      areaIds: new Set([areaId]),
      titulo: area.nombre,
      ruta: null,
    };
  }
  if (departamento) {
    const enDepartamento = areas.filter(
      (a) =>
        a.departamento === departamento &&
        (!direccion || a.dependencia === direccion),
    );
    return {
      ...base,
      areaIds: new Set(enDepartamento.map((a) => a.id)),
      titulo: tituloConPrefijo('Departamento', departamento),
      ruta: direccion,
    };
  }
  if (direccion) {
    const enDireccion = areas.filter((a) => a.dependencia === direccion);
    return {
      ...base,
      areaIds: new Set(enDireccion.map((a) => a.id)),
      titulo: tituloConPrefijo('Dirección', direccion),
      ruta: null,
    };
  }
  return null;
}

export function ReportesDeAreaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const areaId = searchParams.get('areaId');
  const direccion = searchParams.get('direccion');
  const departamento = searchParams.get('departamento');
  const fecha = searchParams.get('fecha') ?? '';
  const veredictoFiltro = searchParams.get('veredicto') ?? '';
  const pagina = Math.max(1, Number(searchParams.get('pagina') ?? '1') || 1);

  const [areas, setAreas] = useState<Area[] | null>(null);
  const [sesiones, setSesiones] = useState<SesionInventario[] | null>(null);
  const [sesionesVeredicto, setSesionesVeredicto] = useState<
    VeredictoSesion[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizacionId) return;
    let cancelled = false;
    setError(null);
    Promise.all([
      cisClient.getAreas(organizacionId),
      cisClient.getInventarios(organizacionId),
      dashboardClient.getTodasLasSesiones(organizacionId),
    ])
      .then(([areasRes, sesionesRes, sesionesVeredictoRes]) => {
        if (cancelled) return;
        setAreas(areasRes);
        setSesiones(sesionesRes);
        setSesionesVeredicto(sesionesVeredictoRes);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId]);

  const veredictoPorSesionId = useMemo(() => {
    const mapa = new Map<string, VeredictoSesion>();
    for (const v of sesionesVeredicto ?? []) mapa.set(v.sesionId, v);
    return mapa;
  }, [sesionesVeredicto]);

  const alcance = useMemo(
    () =>
      areas ? resolverAlcance(areas, areaId, direccion, departamento) : null,
    [areas, areaId, direccion, departamento],
  );

  const filtradas = useMemo(() => {
    if (!alcance || !sesiones) return [];
    return sesiones
      .filter((s) => alcance.areaIds.has(s.areaId))
      .filter((s) => !fecha || fechaLocalISO(s.fechaCierre) === fecha)
      .filter(
        (s) =>
          !veredictoFiltro ||
          veredictoPorSesionId.get(s.id)?.veredicto === veredictoFiltro,
      )
      .sort((a, b) => b.fechaCierre.localeCompare(a.fechaCierre));
  }, [alcance, sesiones, fecha, veredictoFiltro, veredictoPorSesionId]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaClamp = Math.min(pagina, totalPaginas);
  const pagina_ = filtradas.slice(
    (paginaClamp - 1) * POR_PAGINA,
    paginaClamp * POR_PAGINA,
  );

  function actualizarQuery(cambios: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(cambios)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  }

  function verReporte(sesionId: string) {
    const query = new URLSearchParams({ organizacionId });
    if (areaId) query.set('areaId', areaId);
    if (direccion) query.set('direccion', direccion);
    if (departamento) query.set('departamento', departamento);
    navigate(
      `/dashboard/controles-area/reporte/${sesionId}?${query.toString()}`,
    );
  }

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={`/dashboard/controles-area?organizacionId=${encodeURIComponent(organizacionId)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-dim hover:text-text"
        >
          <IconChevronLeft />
          Volver al organigrama
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}
      {!error && (!areas || !sesiones || !sesionesVeredicto) && (
        <p className="text-text-dim">Cargando reportes…</p>
      )}

      {areas && sesiones && !alcance && (
        <Alert>
          No se encontró el área/dirección/departamento solicitado — volvé al
          organigrama.
        </Alert>
      )}

      {alcance && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <div>
              <h1 className="text-xl font-bold text-accent-strong">
                Reportes — {alcance.titulo}
              </h1>
              {alcance.ruta && (
                <p className="mt-0.5 text-xs text-text-faint">{alcance.ruta}</p>
              )}
              <p className="mt-1 text-sm text-text-dim">
                {filtradas.length}{' '}
                {filtradas.length === 1 ? 'reporte' : 'reportes'}
                {fecha ? ` el ${fecha}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="filtro-veredicto">Filtrar por veredicto</Label>
                <select
                  id="filtro-veredicto"
                  value={veredictoFiltro}
                  onChange={(e) =>
                    actualizarQuery({
                      veredicto: e.target.value,
                      pagina: null,
                    })
                  }
                  className="h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs text-text focus:border-accent focus:outline-none"
                >
                  {FILTROS_VEREDICTO.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="filtro-fecha">Filtrar por día</Label>
                <Input
                  id="filtro-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) =>
                    actualizarQuery({ fecha: e.target.value, pagina: null })
                  }
                  className="w-auto"
                />
              </div>
              {(fecha || veredictoFiltro) && (
                <Button
                  variant="ghost"
                  className="px-2 py-2 text-xs"
                  onClick={() =>
                    actualizarQuery({
                      fecha: null,
                      veredicto: null,
                      pagina: null,
                    })
                  }
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {filtradas.length === 0 && (
            <p className="text-text-dim">
              Sin reportes{' '}
              {fecha || veredictoFiltro ? 'para este filtro' : 'todavía'} en
              este alcance.
            </p>
          )}

          {pagina_.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border bg-bg-card shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-raised text-text-dim">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cierre</th>
                    <th className="px-4 py-3 font-medium">Dirección</th>
                    <th className="px-4 py-3 font-medium">Área</th>
                    <th className="px-4 py-3 font-medium">Operador</th>
                    <th className="px-4 py-3 font-medium">Veredicto</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Reporte
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagina_.map((sesion) => {
                    const veredicto = veredictoPorSesionId.get(sesion.id);
                    return (
                      <tr
                        key={sesion.id}
                        className="border-t border-border transition-colors hover:bg-bg-raised"
                      >
                        <td className="px-4 py-3 font-medium">
                          {formatFechaHora(sesion.fechaCierre)}
                        </td>
                        <td className="px-4 py-3 text-text-dim">
                          {alcance.direccionNombrePorAreaId.get(
                            sesion.areaId,
                          ) || '—'}
                        </td>
                        <td className="px-4 py-3 text-text-dim">
                          {alcance.areaNombrePorId.get(sesion.areaId) ??
                            sesion.areaId}
                        </td>
                        <td className="px-4 py-3 text-text-dim">
                          {nombreOperador(sesion.operadorId)}
                        </td>
                        <td className="px-4 py-3">
                          {veredicto ? (
                            <Badge
                              variant={VARIANTE_VEREDICTO[veredicto.veredicto]}
                            >
                              {ETIQUETA_VEREDICTO[veredicto.veredicto] ??
                                veredicto.veredicto}
                            </Badge>
                          ) : (
                            <span className="text-xs text-text-faint">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="secondary"
                            className="!px-2.5 !py-1 text-xs shadow-none"
                            onClick={() => verReporte(sesion.id)}
                          >
                            Ver reporte
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtradas.length > POR_PAGINA && (
            <div className="flex items-center justify-between text-sm">
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                disabled={paginaClamp <= 1}
                onClick={() =>
                  actualizarQuery({ pagina: String(paginaClamp - 1) })
                }
              >
                ← Anterior
              </Button>
              <span className="text-text-dim">
                Página {paginaClamp} de {totalPaginas}
              </span>
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                disabled={paginaClamp >= totalPaginas}
                onClick={() =>
                  actualizarQuery({ pagina: String(paginaClamp + 1) })
                }
              >
                Siguiente →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
