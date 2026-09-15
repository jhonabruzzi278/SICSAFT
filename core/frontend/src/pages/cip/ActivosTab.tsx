import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  cisClient,
  type ActivoCatalogo,
  type DocumentoActivo,
} from '@/lib/cis-client';
import { Alert, Badge, Button, Card, Input, Modal } from '@/components/ui';

const SIN_ASIGNAR = 'Sin asignar';

function formatearFecha(fechaIso: string | null): string {
  if (!fechaIso) return '—';
  const [anio, mes, dia] = fechaIso.split('-');
  return `${dia}-${mes}-${anio}`;
}

function formatearClp(valor: number | null): string {
  if (valor === null) return '—';
  return `$${valor.toLocaleString('es-CL')}`;
}

function valoresUnicos(valores: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(valores.filter((v): v is string => Boolean(v))),
  ).sort((a, b) => a.localeCompare(b, 'es'));
}

function DetalleActivo({
  activo,
  organizacionId,
}: {
  activo: ActivoCatalogo;
  organizacionId: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoActivo[] | null>(null);
  const [documentoError, setDocumentoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    void QRCode.toDataURL(activo.codigoQr, {
      width: 180,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activo.codigoQr]);

  useEffect(() => {
    let cancelled = false;
    setDocumentos(null);
    setDocumentoError(null);
    void cisClient
      .getDocumentosActivo(activo.id, organizacionId)
      .then((data) => {
        if (!cancelled) setDocumentos(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDocumentoError(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los documentos.',
          );
          setDocumentos([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activo.id, organizacionId]);

  const fotos =
    documentos?.filter(
      (documento) =>
        documento.tipo === 'fotografia' ||
        documento.url.startsWith('data:image/'),
    ) ?? [];
  const documentosNoFotos =
    documentos?.filter(
      (documento) =>
        documento.tipo !== 'fotografia' &&
        !documento.url.startsWith('data:image/'),
    ) ?? [];

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start gap-4 border-b border-border pb-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-accent px-2.5 py-1 font-mono text-sm font-bold text-bg">
              {activo.codigoQr}
            </span>
            <h2 className="text-xl font-bold text-text">{activo.nombre}</h2>
            <Badge variant={activo.estado === 'activo' ? 'success' : 'error'}>
              {activo.estado === 'activo' ? 'En Servicio' : activo.estado}
            </Badge>
          </div>
          <p className="text-xs text-text-dim">
            ID del registro BPI: <code className="font-mono">{activo.id}</code>
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-3 text-center shadow-sm">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Código QR de ${activo.codigoQr}`}
              className="h-36 w-36 object-contain"
            />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center bg-gray-100 text-xs text-gray-400">
              Generando QR...
            </div>
          )}
          <span className="mt-2 font-mono text-xs font-bold text-gray-800">
            {activo.codigoQr}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            Etiqueta oficial
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-bg/50 p-3">
            <dt className="text-[11px] text-text-dim">Código patrimonial</dt>
            <dd className="font-mono font-bold text-accent-strong">
              {activo.codigoAft || activo.codigoQr}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-bg/50 p-3">
            <dt className="text-[11px] text-text-dim">Dirección</dt>
            <dd className="font-semibold text-text">
              {activo.areaDependencia || SIN_ASIGNAR}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-bg/50 p-3">
            <dt className="text-[11px] text-text-dim">Área patrimonial</dt>
            <dd className="font-semibold text-text">
              {activo.areaNombre || activo.areaId || 'No asignada'}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-bg/50 p-3">
            <dt className="text-[11px] text-text-dim">Estado operativo</dt>
            <dd className="font-semibold text-text">
              {activo.estado === 'activo'
                ? 'Operativo en planta'
                : activo.estado}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-bg/50 p-3">
            <dt className="text-[11px] text-text-dim">Marca / modelo</dt>
            <dd className="font-semibold text-text">
              {[activo.marca, activo.modelo].filter(Boolean).join(' / ') || '—'}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-bg/50 p-3">
            <dt className="text-[11px] text-text-dim">Serie / compra</dt>
            <dd className="font-semibold text-text">
              {activo.serie || '—'} · {formatearFecha(activo.fechaCompra)}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-bg/50 p-3">
            <dt className="text-[11px] text-text-dim">Valor patrimonial</dt>
            <dd className="font-semibold text-text">
              {formatearClp(activo.valorPatrimonial)}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-bg/50 p-3">
            <dt className="text-[11px] text-text-dim">Responsable</dt>
            <dd className="font-semibold text-text">
              {activo.responsableNombre || '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-text">
              Fotografías y documentos
            </h3>
            <p className="text-xs text-text-dim">
              Información documental existente en la BPI. El CIP no permite
              modificarla.
            </p>
          </div>
          <span className="text-xs font-medium text-text-dim">
            {documentos ? `${documentos.length} archivos` : 'Cargando...'}
          </span>
        </div>
        {documentoError && <Alert variant="error">{documentoError}</Alert>}
        {fotos.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {fotos.map((foto) => (
              <div
                key={foto.id}
                className="overflow-hidden rounded-xl border border-border bg-bg-card"
              >
                <img
                  src={foto.url}
                  alt={foto.descripcion || 'Foto del activo'}
                  className="h-32 w-full object-cover"
                />
                <p className="truncate p-2 text-[11px] text-text-dim">
                  {foto.descripcion || 'Fotografía'}
                </p>
              </div>
            ))}
          </div>
        )}
        {documentosNoFotos.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {documentosNoFotos.map((documento) => (
              <a
                key={documento.id}
                href={documento.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border bg-bg p-3 text-sm font-semibold text-accent hover:border-accent/50"
              >
                {documento.descripcion || documento.url}
              </a>
            ))}
          </div>
        )}
        {documentos?.length === 0 && !documentoError && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-dim">
            Sin fotografías ni documentos adjuntos.
          </p>
        )}
      </div>
    </div>
  );
}

interface Filtros {
  busqueda: string;
  estado: string;
  direccion: string;
  area: string;
  categoria: string;
}

const FILTROS_INICIALES: Filtros = {
  busqueda: '',
  estado: 'todos',
  direccion: 'todas',
  area: 'todas',
  categoria: 'todas',
};

export function ActivosTab() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const [activos, setActivos] = useState<ActivoCatalogo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [fichaActivo, setFichaActivo] = useState<ActivoCatalogo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setActivos(null);
    setFichaActivo(null);
    setListError(null);
    if (!organizacionId) return () => undefined;

    void cisClient
      .getCatalogo(organizacionId)
      .then((data) => {
        if (!cancelled) setActivos(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setListError(
            error instanceof Error
              ? error.message
              : 'No se pudo cargar el catálogo.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId]);

  const opciones = useMemo(
    () => ({
      direcciones: valoresUnicos((activos ?? []).map((a) => a.areaDependencia)),
      areas: valoresUnicos((activos ?? []).map((a) => a.areaNombre)),
      categorias: valoresUnicos((activos ?? []).map((a) => a.familia)),
    }),
    [activos],
  );

  const activosFiltrados = useMemo(() => {
    const texto = filtros.busqueda.trim().toLowerCase();
    return (activos ?? []).filter((activo) => {
      const coincideTexto =
        !texto ||
        [
          activo.codigoQr,
          activo.codigoAft,
          activo.nombre,
          activo.serie,
          activo.areaNombre,
        ]
          .filter(Boolean)
          .some((valor) => valor!.toLowerCase().includes(texto));
      const coincideEstado =
        filtros.estado === 'todos' ||
        activo.estado.toLowerCase() === filtros.estado;
      const coincideDireccion =
        filtros.direccion === 'todas' ||
        (filtros.direccion === SIN_ASIGNAR
          ? !activo.areaDependencia
          : activo.areaDependencia === filtros.direccion);
      const coincideArea =
        filtros.area === 'todas' || activo.areaNombre === filtros.area;
      const coincideCategoria =
        filtros.categoria === 'todas' || activo.familia === filtros.categoria;
      return (
        coincideTexto &&
        coincideEstado &&
        coincideDireccion &&
        coincideArea &&
        coincideCategoria
      );
    });
  }, [activos, filtros]);

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Catálogo analítico de activos
          </h1>
          <p className="text-sm text-text-dim">
            Consulta de la BPI para el Directivo. Las operaciones patrimoniales
            se realizan fuera del CIP.
          </p>
        </div>
        <span className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent-strong">
          {activos ? `${activos.length} activos registrados` : 'Cargando...'}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-raised p-3">
        <Input
          placeholder="Buscar por código, nombre, serie o área..."
          value={filtros.busqueda}
          onChange={(event) =>
            setFiltros((f) => ({ ...f, busqueda: event.target.value }))
          }
          className="text-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            value={filtros.direccion}
            onChange={(event) =>
              setFiltros((f) => ({ ...f, direccion: event.target.value }))
            }
            aria-label="Filtrar por dirección"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="todas">Toda dirección</option>
            {opciones.direcciones.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value={SIN_ASIGNAR}>{SIN_ASIGNAR}</option>
          </select>
          <select
            value={filtros.area}
            onChange={(event) =>
              setFiltros((f) => ({ ...f, area: event.target.value }))
            }
            aria-label="Filtrar por área"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="todas">Toda área</option>
            {opciones.areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={filtros.categoria}
            onChange={(event) =>
              setFiltros((f) => ({ ...f, categoria: event.target.value }))
            }
            aria-label="Filtrar por categoría"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="todas">Toda categoría</option>
            {opciones.categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filtros.estado}
            onChange={(event) =>
              setFiltros((f) => ({ ...f, estado: event.target.value }))
            }
            aria-label="Filtrar por estado"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">En servicio</option>
            <option value="baja">Baja</option>
            <option value="extraviado">Extraviado</option>
          </select>
        </div>
      </div>

      {listError && <Alert variant="error">{listError}</Alert>}
      {!listError && !activos && (
        <p className="text-text-dim">Cargando catálogo...</p>
      )}
      {activos && activos.length === 0 && (
        <p className="text-text-dim">Sin activos en el catálogo todavía.</p>
      )}
      {activos && activos.length > 0 && activosFiltrados.length === 0 && (
        <p className="text-text-dim">Ningún activo coincide con los filtros.</p>
      )}

      {activosFiltrados.length > 0 && (
        <>
          {/* Desktop / tablet: tabla completa. Mobile (<sm): tarjetas apiladas — una tabla de 7
              columnas con overflow-x-auto como único tratamiento mobile no cumple el estándar de
              diseño del repo (ver ecc/web/design-quality.md), así que abajo hay una vista
              alternativa real, no solo scroll horizontal. */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-bg-raised shadow-sm sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-bg-card/50 text-xs font-semibold uppercase tracking-wider text-text-dim">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nombre AFT</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Dirección</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3 text-right">Consulta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activosFiltrados.map((activo) => (
                  <tr
                    key={activo.id}
                    className="transition-colors hover:bg-bg-card/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-accent-strong">
                      {activo.codigoAft || activo.codigoQr}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text">
                      {activo.nombre}
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {activo.familia}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          activo.estado === 'activo'
                            ? 'success'
                            : activo.estado === 'baja'
                              ? 'error'
                              : 'warning'
                        }
                      >
                        {activo.estado === 'activo'
                          ? 'En Servicio'
                          : activo.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {activo.areaDependencia || SIN_ASIGNAR}
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {activo.areaNombre || activo.areaId || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {activo.responsableNombre || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        className="!px-2.5 !py-1 text-xs shadow-none"
                        onClick={() => setFichaActivo(activo)}
                      >
                        Ver ficha
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {activosFiltrados.map((activo) => (
              <Card key={activo.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-accent-strong">
                      {activo.codigoAft || activo.codigoQr}
                    </p>
                    <p className="truncate font-semibold text-text">
                      {activo.nombre}
                    </p>
                  </div>
                  <Badge
                    variant={
                      activo.estado === 'activo'
                        ? 'success'
                        : activo.estado === 'baja'
                          ? 'error'
                          : 'warning'
                    }
                  >
                    {activo.estado === 'activo' ? 'En Servicio' : activo.estado}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-text-dim">Categoría</dt>
                    <dd className="font-medium text-text">{activo.familia}</dd>
                  </div>
                  <div>
                    <dt className="text-text-dim">Dirección</dt>
                    <dd className="font-medium text-text">
                      {activo.areaDependencia || SIN_ASIGNAR}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-dim">Área</dt>
                    <dd className="font-medium text-text">
                      {activo.areaNombre || activo.areaId || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-dim">Responsable</dt>
                    <dd className="font-medium text-text">
                      {activo.responsableNombre || '—'}
                    </dd>
                  </div>
                </dl>
                <Button
                  variant="secondary"
                  className="w-full !py-1.5 text-xs shadow-none"
                  onClick={() => setFichaActivo(activo)}
                >
                  Ver ficha
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal
        open={fichaActivo !== null}
        onClose={() => setFichaActivo(null)}
        className="max-h-[calc(100vh-5rem)] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-bg-card/95 px-5 py-3 backdrop-blur sm:px-6">
          <h2 className="text-sm font-bold text-text-dim uppercase tracking-wide">
            Ficha del activo
          </h2>
          <Button
            variant="ghost"
            className="!px-3 !py-1 text-xs font-semibold"
            onClick={() => setFichaActivo(null)}
          >
            Cerrar ✕
          </Button>
        </div>
        {fichaActivo && (
          <DetalleActivo activo={fichaActivo} organizacionId={organizacionId} />
        )}
      </Modal>
    </div>
  );
}
