import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import QRCode from 'qrcode';
import {
  cisClient,
  CisApiError,
  type ActivoCatalogo,
  type CatalogoTipoActivo,
  type DocumentoActivo,
} from '@/lib/cis-client';
import {
  Alert,
  Badge,
  Button,
  Card,
  FieldError,
  Input,
  Label,
} from '@/components/ui';

const altaSchema = z.object({
  codigoPatrimonial: z.string().min(1, 'Requerido'),
  codigoQr: z.string().min(1, 'Requerido'),
  catalogoId: z.string().min(1, 'Requerido'),
  serie: z.string().optional(),
  areaId: z.string().optional(),
  ubicacionId: z.string().optional(),
  descripcion: z.string().optional(),
});
type AltaForm = z.infer<typeof altaSchema>;

const catalogoTipoSchema = z.object({
  tipo: z.string().min(1, 'Requerido'),
  familia: z.string().min(1, 'Requerido'),
  subfamilia: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  criticidad: z.enum(['baja', 'media', 'alta']),
  tecnologiaIdentificacion: z.enum(['qr', 'rfid', 'qr_rfid']),
});
type CatalogoTipoForm = z.infer<typeof catalogoTipoSchema>;

const editarSchema = z.object({
  descripcion: z.string().optional(),
  responsableId: z.string().optional(),
});
type EditarForm = z.infer<typeof editarSchema>;

const documentoSchema = z.object({
  tipo: z.enum(['documento', 'fotografia']),
  url: z.string().min(1, 'Requerido'),
  descripcion: z.string().optional(),
});
type DocumentoForm = z.infer<typeof documentoSchema>;

function errorDeCisApi(err: unknown, accion: string): string {
  if (err instanceof CisApiError && err.status === 403) {
    return `No tenés el rol necesario para ${accion} en esta organización.`;
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}

export function ActivosPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';
  const [activos, setActivos] = useState<ActivoCatalogo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const [catalogoTipos, setCatalogoTipos] = useState<CatalogoTipoActivo[]>([]);

  // Búsqueda y filtrado
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Ficha y edición
  const [fichaActivo, setFichaActivo] = useState<ActivoCatalogo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [editarError, setEditarError] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoActivo[] | null>(null);
  const [documentoError, setDocumentoError] = useState<string | null>(null);
  const [archivoCargando, setArchivoCargando] = useState(false);

  const [nuevoTipoAbierto, setNuevoTipoAbierto] = useState(false);
  const [tipoError, setTipoError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaForm>({ resolver: zodResolver(altaSchema) });

  const {
    register: registerTipo,
    handleSubmit: handleSubmitTipo,
    reset: resetTipo,
    formState: { errors: erroresTipo, isSubmitting: creandoTipo },
  } = useForm<CatalogoTipoForm>({ resolver: zodResolver(catalogoTipoSchema) });

  const {
    register: registerEditar,
    handleSubmit: handleSubmitEditar,
    reset: resetEditar,
    formState: { isSubmitting: guardandoEdicion },
  } = useForm<EditarForm>({ resolver: zodResolver(editarSchema) });

  const {
    register: registerDocumento,
    handleSubmit: handleSubmitDocumento,
    reset: resetDocumento,
    setValue: setValorDocumento,
    watch: observarDocumento,
    formState: { errors: erroresDocumento, isSubmitting: agregandoDocumento },
  } = useForm<DocumentoForm>({
    resolver: zodResolver(documentoSchema),
    defaultValues: { tipo: 'fotografia', url: '', descripcion: '' },
  });

  const tipoDocumentoSeleccionado = observarDocumento('tipo');

  function cargarCatalogo() {
    setListError(null);
    cisClient
      .getCatalogo(organizacionId)
      .then(setActivos)
      .catch((err: unknown) => {
        setListError(err instanceof Error ? err.message : 'Error desconocido');
      });
  }

  function cargarCatalogoTipos() {
    cisClient
      .getCatalogoTipos()
      .then(setCatalogoTipos)
      .catch(() => setCatalogoTipos([]));
  }

  useEffect(() => {
    if (organizacionId) cargarCatalogo();
    cargarCatalogoTipos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizacionId]);

  // Generar QR visual al abrir la ficha técnica
  useEffect(() => {
    if (fichaActivo) {
      QRCode.toDataURL(fichaActivo.codigoQr, {
        width: 180,
        margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [fichaActivo]);

  // Activos filtrados reactivamente
  const activosFiltrados = useMemo(() => {
    if (!activos) return [];
    return activos.filter((a) => {
      const matchBusqueda =
        a.codigoQr.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (a.codigoAft &&
          a.codigoAft.toLowerCase().includes(busqueda.toLowerCase())) ||
        (a.areaNombre &&
          a.areaNombre.toLowerCase().includes(busqueda.toLowerCase()));
      const matchEstado =
        filtroEstado === 'todos' ||
        a.estado.toLowerCase() === filtroEstado.toLowerCase();
      return matchBusqueda && matchEstado;
    });
  }, [activos, busqueda, filtroEstado]);

  async function onSubmit(values: AltaForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      await cisClient.altaActivo({
        organizacionId,
        codigoPatrimonial: values.codigoPatrimonial,
        codigoQr: values.codigoQr,
        catalogoId: values.catalogoId,
        serie: values.serie || undefined,
        areaId: values.areaId || undefined,
        ubicacionId: values.ubicacionId || undefined,
        descripcion: values.descripcion || undefined,
      });
      setSubmitOk(true);
      reset();
      cargarCatalogo();
    } catch (err: unknown) {
      setSubmitError(errorDeCisApi(err, 'crear un activo'));
    }
  }

  async function onSubmitTipo(values: CatalogoTipoForm) {
    setTipoError(null);
    try {
      await cisClient.altaCatalogoTipo({
        organizacionId,
        tipo: values.tipo,
        familia: values.familia,
        subfamilia: values.subfamilia || undefined,
        marca: values.marca || undefined,
        modelo: values.modelo || undefined,
        criticidad: values.criticidad,
        tecnologiaIdentificacion: values.tecnologiaIdentificacion,
      });
      resetTipo();
      setNuevoTipoAbierto(false);
      cargarCatalogoTipos();
    } catch (err: unknown) {
      setTipoError(errorDeCisApi(err, 'crear un tipo de catálogo'));
    }
  }

  async function darDeBaja(activo: ActivoCatalogo) {
    setListError(null);
    try {
      await cisClient.bajaActivo(activo.id, organizacionId);
      cargarCatalogo();
      if (fichaActivo?.id === activo.id) {
        setFichaActivo({ ...fichaActivo, estado: 'baja' });
      }
    } catch (err: unknown) {
      setListError(errorDeCisApi(err, 'dar de baja un activo'));
    }
  }

  async function reincorporar(activo: ActivoCatalogo) {
    setListError(null);
    try {
      await cisClient.reincorporarActivo(activo.id, organizacionId);
      cargarCatalogo();
      if (fichaActivo?.id === activo.id) {
        setFichaActivo({ ...fichaActivo, estado: 'activo' });
      }
    } catch (err: unknown) {
      setListError(errorDeCisApi(err, 'reincorporar un activo'));
    }
  }

  function abrirFicha(activo: ActivoCatalogo) {
    setFichaActivo(activo);
    setEditarError(null);
    setDocumentoError(null);
    resetEditar({
      descripcion:
        (activo as unknown as { descripcion?: string }).descripcion || '',
      responsableId:
        (activo as unknown as { responsableId?: string }).responsableId || '',
    });
    setDocumentos(null);
    cisClient
      .getDocumentosActivo(activo.id, organizacionId)
      .then(setDocumentos)
      .catch(() => setDocumentos([]));
  }

  async function onSubmitEditar(values: EditarForm) {
    if (!fichaActivo) return;
    setEditarError(null);
    try {
      if (values.descripcion !== undefined) {
        await cisClient.actualizarDescripcionActivo(
          fichaActivo.id,
          organizacionId,
          values.descripcion,
        );
      }
      if (values.responsableId) {
        await cisClient.cambiarResponsableActivo(
          fichaActivo.id,
          organizacionId,
          values.responsableId,
        );
      }
      cargarCatalogo();
    } catch (err: unknown) {
      setEditarError(errorDeCisApi(err, 'editar un activo'));
    }
  }

  // Carga de archivo real (PDF, Word, Fotos) mediante FileReader a Base64 / DataURL
  function manejarCargaArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivoCargando(true);
    const esFoto = file.type.startsWith('image/');
    setValorDocumento('tipo', esFoto ? 'fotografia' : 'documento');
    setValorDocumento('descripcion', file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setValorDocumento('url', dataUrl);
      setArchivoCargando(false);
    };
    reader.onerror = () => {
      setDocumentoError('Error al leer el archivo local.');
      setArchivoCargando(false);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmitDocumento(values: DocumentoForm) {
    if (!fichaActivo) return;
    setDocumentoError(null);
    try {
      await cisClient.altaDocumentoActivo(fichaActivo.id, {
        organizacionId,
        tipo: values.tipo,
        url: values.url,
        descripcion: values.descripcion || undefined,
      });
      resetDocumento({ tipo: 'fotografia', url: '', descripcion: '' });
      const lista = await cisClient.getDocumentosActivo(
        fichaActivo.id,
        organizacionId,
      );
      setDocumentos(lista);
    } catch (err: unknown) {
      setDocumentoError(
        errorDeCisApi(err, 'agregar un documento o fotografía'),
      );
    }
  }

  async function eliminarDocumento(documentoId: string) {
    if (!fichaActivo) return;
    setDocumentoError(null);
    try {
      await cisClient.eliminarDocumentoActivo(
        fichaActivo.id,
        documentoId,
        organizacionId,
      );
      const lista = await cisClient.getDocumentosActivo(
        fichaActivo.id,
        organizacionId,
      );
      setDocumentos(lista);
    } catch (err: unknown) {
      setDocumentoError(errorDeCisApi(err, 'eliminar un documento'));
    }
  }

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  const fotos =
    documentos?.filter(
      (d) => d.tipo === 'fotografia' || d.url.startsWith('data:image/'),
    ) || [];
  const docsNoFotos =
    documentos?.filter(
      (d) => d.tipo !== 'fotografia' && !d.url.startsWith('data:image/'),
    ) || [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* Cabecera y Barra de Filtros */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Catálogo de Activos Fijos
            </h1>
            <p className="text-sm text-text-dim">
              Gestión maestra, fichas técnicas, trazabilidad física y documental
              de la BPI.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent-strong">
              {activos
                ? `${activos.length} activos registrados`
                : 'Cargando...'}
            </span>
          </div>
        </div>

        {/* Buscador reactivo y filtro de estado */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg-raised p-3">
          <div className="relative min-w-[240px] flex-1">
            <Input
              placeholder="Buscar por código QR, nombre, serie o área..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full text-sm"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">En Servicio (Activo)</option>
            <option value="baja">Baja</option>
            <option value="extraviado">Extraviado</option>
          </select>
        </div>

        {listError && <Alert variant="error">{listError}</Alert>}
        {!listError && !activos && (
          <p className="text-text-dim">Cargando catálogo...</p>
        )}
        {activos && activos.length === 0 && (
          <p className="text-text-dim">Sin activos en el catálogo todavía.</p>
        )}

        {/* Tabla enriquecida con acceso a Ficha Técnica */}
        {activos && activos.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border bg-bg-raised shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-bg-card/50 text-xs font-semibold uppercase tracking-wider text-text-dim">
                <tr>
                  <th className="px-4 py-3">Código QR</th>
                  <th className="px-4 py-3">Código AFT</th>
                  <th className="px-4 py-3">Nombre del Activo</th>
                  <th className="px-4 py-3">Área Asignada</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activosFiltrados.map((activo) => {
                  const seleccionado = fichaActivo?.id === activo.id;
                  return (
                    <tr
                      key={activo.codigoQr}
                      className={`transition-colors hover:bg-bg-card/40 ${
                        seleccionado ? 'bg-accent/10 font-medium' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-accent-strong">
                        {activo.codigoQr}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text">
                        {activo.codigoAft || activo.codigoQr}
                      </td>
                      <td className="px-4 py-3 font-semibold text-text">
                        {activo.nombre}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-dim">
                        {activo.areaNombre || activo.areaId || 'Área General'}
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant={seleccionado ? 'primary' : 'secondary'}
                            className="!px-2.5 !py-1 text-xs shadow-none"
                            onClick={() => abrirFicha(activo)}
                          >
                            📋 Ficha Técnica
                          </Button>
                          {(activo.estado === 'activo' ||
                            activo.estado === 'extraviado') && (
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1 text-xs text-red-400 hover:text-red-300"
                              onClick={() => void darDeBaja(activo)}
                            >
                              Dar de baja
                            </Button>
                          )}
                          {activo.estado === 'extraviado' && (
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1 text-xs text-emerald-400"
                              onClick={() => void reincorporar(activo)}
                            >
                              Reincorporar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================= */}
        {/* PANEL: FICHA TÉCNICA COMPLETA DEL ACTIVO (DETALLE Y FOTOS) */}
        {/* ========================================================= */}
        {fichaActivo && (
          <Card className="border-accent/40 bg-gradient-to-b from-bg-card to-bg-raised p-6 shadow-xl">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-accent px-2.5 py-1 font-mono text-sm font-bold text-bg">
                    {fichaActivo.codigoQr}
                  </span>
                  <h2 className="text-xl font-bold text-text">
                    {fichaActivo.nombre}
                  </h2>
                  <Badge
                    variant={
                      fichaActivo.estado === 'activo' ? 'success' : 'error'
                    }
                  >
                    {fichaActivo.estado === 'activo'
                      ? 'En Servicio'
                      : fichaActivo.estado}
                  </Badge>
                </div>
                <p className="text-xs text-text-dim">
                  ID del registro BPI:{' '}
                  <code className="font-mono">{fichaActivo.id}</code>
                </p>
              </div>
              <Button
                variant="ghost"
                className="!px-3 !py-1 text-xs font-semibold"
                onClick={() => setFichaActivo(null)}
              >
                ✕ Cerrar Ficha
              </Button>
            </div>

            {/* Grid Principal: QR Badge + Especificaciones Técnicas */}
            <div className="grid gap-6 md:grid-cols-[180px_1fr]">
              {/* Código QR Interactivo */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-3 text-center shadow-sm">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Código QR de ${fichaActivo.codigoQr}`}
                    className="h-36 w-36 object-contain"
                  />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center bg-gray-100 text-xs text-gray-400">
                    Generando QR...
                  </div>
                )}
                <span className="mt-2 font-mono text-xs font-bold text-gray-800">
                  {fichaActivo.codigoQr}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Etiqueta Oficial
                </span>
              </div>

              {/* Atributos y Características del Bien */}
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-bg/50 p-3">
                  <span className="block text-[11px] font-medium text-text-dim uppercase">
                    Código Patrimonial
                  </span>
                  <span className="font-mono text-sm font-bold text-accent-strong">
                    {fichaActivo.codigoAft || fichaActivo.codigoQr}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-bg/50 p-3">
                  <span className="block text-[11px] font-medium text-text-dim uppercase">
                    Área Patrimonial
                  </span>
                  <span className="font-semibold text-text">
                    {fichaActivo.areaNombre ||
                      fichaActivo.areaId ||
                      'No asignada'}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-bg/50 p-3">
                  <span className="block text-[11px] font-medium text-text-dim uppercase">
                    Ubicación / Sede
                  </span>
                  <span className="font-semibold text-text">
                    {fichaActivo.ubicacionId || 'Sede Principal'}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-bg/50 p-3">
                  <span className="block text-[11px] font-medium text-text-dim uppercase">
                    Estado Operativo
                  </span>
                  <span className="font-semibold text-emerald-400">
                    {fichaActivo.estado === 'activo'
                      ? 'Operativo en Planta'
                      : fichaActivo.estado}
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-bg/50 p-3">
                  <span className="block text-[11px] font-medium text-text-dim uppercase">
                    Tecnología Captura
                  </span>
                  <span className="font-semibold text-text">
                    QR / Matriz 2D
                  </span>
                </div>
                <div className="rounded-lg border border-border bg-bg/50 p-3">
                  <span className="block text-[11px] font-medium text-text-dim uppercase">
                    Sincronización BPI
                  </span>
                  <span className="font-semibold text-emerald-400">
                    ● En Línea
                  </span>
                </div>
              </div>
            </div>

            {/* Edición de Responsable y Observaciones */}
            <form
              onSubmit={(e) => void handleSubmitEditar(onSubmitEditar)(e)}
              className="mt-6 rounded-xl border border-border bg-bg/40 p-4"
            >
              <h3 className="mb-3 text-sm font-semibold text-text">
                Actualizar Asignación y Observaciones
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="editar-responsable">
                    Responsable Asignado
                  </Label>
                  <Input
                    id="editar-responsable"
                    placeholder="Ej. JEFE DEPARTAMENTO COMERCIAL"
                    {...registerEditar('responsableId')}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="editar-descripcion">
                    Notas / Descripción Técnica
                  </Label>
                  <Input
                    id="editar-descripcion"
                    placeholder="Detalles sobre el estado físico o mantenciones..."
                    {...registerEditar('descripcion')}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
              {editarError && (
                <div className="mt-3">
                  <Alert variant="error">{editarError}</Alert>
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <Button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="!px-4 !py-1.5 text-xs font-semibold"
                >
                  {guardandoEdicion ? 'Guardando…' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>

            {/* Galería Fotográfica y Documentación Adjunta */}
            <div className="mt-6 border-t border-border pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text">
                    Fotografías y Documentos de Respaldo
                  </h3>
                  <p className="text-xs text-text-dim">
                    Sube fotografías del bien, fichas en PDF, garantías o actas
                    en Word.
                  </p>
                </div>
                <span className="text-xs font-medium text-text-dim">
                  {documentos
                    ? `${documentos.length} archivos adjuntos`
                    : 'Cargando...'}
                </span>
              </div>

              {/* Vista previa de Fotografías */}
              {fotos.length > 0 && (
                <div className="mb-6 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-accent-strong">
                    📷 Fotografías del Activo
                  </h4>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {fotos.map((foto) => (
                      <div
                        key={foto.id}
                        className="group relative overflow-hidden rounded-xl border border-border bg-bg-card shadow-sm transition hover:border-accent"
                      >
                        <img
                          src={foto.url}
                          alt={foto.descripcion || 'Foto del activo'}
                          className="h-32 w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent p-2 opacity-0 transition group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            className="self-end !p-1 text-xs text-red-300 hover:bg-red-500/20"
                            onClick={() => void eliminarDocumento(foto.id)}
                          >
                            🗑️
                          </Button>
                          <span className="truncate text-[11px] font-medium text-white">
                            {foto.descripcion || 'Fotografía'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de Documentos (PDF, Word, etc.) */}
              {docsNoFotos.length > 0 && (
                <div className="mb-6 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-accent-strong">
                    📄 Documentos y Manuales (PDF / Word)
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {docsNoFotos.map((doc) => {
                      const esPdf =
                        doc.url.toLowerCase().includes('.pdf') ||
                        doc.descripcion?.toLowerCase().includes('.pdf');
                      const esWord =
                        doc.url.toLowerCase().includes('.doc') ||
                        doc.descripcion?.toLowerCase().includes('.doc');
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-xl border border-border bg-bg p-3 shadow-sm transition hover:border-accent/50"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-card text-xl">
                              {esPdf ? '📕' : esWord ? '📘' : '📄'}
                            </span>
                            <div className="truncate">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-sm font-semibold text-accent hover:text-accent-strong"
                              >
                                {doc.descripcion || doc.url}
                              </a>
                              <span className="text-[10px] text-text-dim uppercase">
                                {esPdf
                                  ? 'Documento PDF'
                                  : esWord
                                    ? 'Documento Word'
                                    : 'Archivo adjunto'}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs text-red-400 hover:text-red-300"
                            onClick={() => void eliminarDocumento(doc.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {documentos?.length === 0 && (
                <div className="mb-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-dim">
                  Sin fotografías ni documentos adjuntos. Selecciona un archivo
                  abajo para agregar.
                </div>
              )}

              {/* Formulario de Carga de Archivos / URL */}
              <form
                onSubmit={(e) =>
                  void handleSubmitDocumento(onSubmitDocumento)(e)
                }
                className="rounded-xl border border-border bg-bg/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text">
                    Adjuntar Nuevo Archivo o Foto
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setValorDocumento('tipo', 'fotografia')}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                        tipoDocumentoSeleccionado === 'fotografia'
                          ? 'bg-accent text-bg'
                          : 'bg-bg-card text-text-dim hover:text-text'
                      }`}
                    >
                      📷 Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => setValorDocumento('tipo', 'documento')}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                        tipoDocumentoSeleccionado === 'documento'
                          ? 'bg-accent text-bg'
                          : 'bg-bg-card text-text-dim hover:text-text'
                      }`}
                    >
                      📄 Documento (PDF/Word)
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Selector de archivo local */}
                  <div>
                    <Label htmlFor="doc-file">
                      Seleccionar archivo desde tu equipo
                    </Label>
                    <input
                      id="doc-file"
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={manejarCargaArchivo}
                      className="mt-1 block w-full text-xs text-text-dim file:mr-3 file:rounded-lg file:border-0 file:bg-accent/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-accent-strong hover:file:bg-accent/30"
                    />
                    {archivoCargando && (
                      <span className="mt-1 block text-xs text-accent">
                        Procesando archivo...
                      </span>
                    )}
                  </div>

                  {/* Nombre / Descripción */}
                  <div>
                    <Label htmlFor="doc-descripcion">
                      Nombre o Descripción
                    </Label>
                    <Input
                      id="doc-descripcion"
                      placeholder="Ej. Fotografía frontal, Factura de compra..."
                      {...registerDocumento('descripcion')}
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>

                {/* Campo URL / DataURL generado */}
                <div className="mt-3">
                  <Label htmlFor="doc-url">
                    URL o Contenido Base64 del Archivo
                  </Label>
                  <Input
                    id="doc-url"
                    placeholder="https://... o selecciona un archivo arriba"
                    {...registerDocumento('url')}
                    className="mt-1 text-xs font-mono"
                  />
                  <FieldError>{erroresDocumento.url?.message}</FieldError>
                </div>

                {documentoError && (
                  <div className="mt-3">
                    <Alert variant="error">{documentoError}</Alert>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <Button
                    type="submit"
                    disabled={agregandoDocumento || archivoCargando}
                    className="!px-5 !py-2 text-xs font-bold"
                  >
                    {agregandoDocumento
                      ? 'Subiendo…'
                      : '✔ Guardar en la Base de Datos'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        )}
      </div>

      {/* ========================================================= */}
      {/* PANEL LATERAL: ALTA MANUAL Y TIPOS DE CATÁLOGO */}
      {/* ========================================================= */}
      <div className="space-y-6">
        <Card className="h-fit">
          <h2 className="mb-4 text-base font-bold text-text">
            Alta Rápida de Activo
          </h2>
          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="space-y-4 text-sm"
          >
            <div>
              <Label htmlFor="codigoPatrimonial">Código patrimonial</Label>
              <Input
                id="codigoPatrimonial"
                placeholder="Ej. DC-40"
                {...register('codigoPatrimonial')}
                className="mt-1"
              />
              <FieldError>{errors.codigoPatrimonial?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="codigoQr">Código QR</Label>
              <Input
                id="codigoQr"
                placeholder="Ej. DC-40"
                {...register('codigoQr')}
                className="mt-1"
              />
              <FieldError>{errors.codigoQr?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="catalogoId">Catálogo (tipo)</Label>
              <select
                id="catalogoId"
                {...register('catalogoId')}
                className="mt-1 w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
              >
                <option value="">— Elegir tipo —</option>
                {catalogoTipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.tipo} — {tipo.familia}
                  </option>
                ))}
              </select>
              <FieldError>{errors.catalogoId?.message}</FieldError>
              <button
                type="button"
                className="mt-1.5 text-xs font-semibold text-accent hover:text-accent-strong"
                onClick={() => setNuevoTipoAbierto((v) => !v)}
              >
                {nuevoTipoAbierto
                  ? '✕ Cancelar'
                  : '+ Crear nuevo tipo de catálogo'}
              </button>
            </div>
            <div>
              <Label htmlFor="serie">Número de Serie</Label>
              <Input
                id="serie"
                placeholder="Ej. SN-DC40-9999"
                {...register('serie')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="areaId">Área Patrimonial</Label>
              <Input
                id="areaId"
                placeholder="Ej. DEPARTAMENTO COMERCIAL"
                {...register('areaId')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                placeholder="Notas sobre el bien..."
                {...register('descripcion')}
                className="mt-1"
              />
            </div>

            {submitError && <Alert variant="error">{submitError}</Alert>}
            {submitOk && <Alert variant="success">Activo creado.</Alert>}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creando…' : 'Crear activo'}
            </Button>
          </form>
        </Card>

        {nuevoTipoAbierto && (
          <Card className="h-fit border-accent/40">
            <h2 className="mb-4 text-base font-bold text-text">
              Nuevo Tipo de Catálogo
            </h2>
            <form
              onSubmit={(e) => void handleSubmitTipo(onSubmitTipo)(e)}
              className="space-y-4 text-sm"
            >
              <div>
                <Label htmlFor="tipo-tipo">Tipo</Label>
                <Input
                  id="tipo-tipo"
                  placeholder="Ej. Silla Ergonómica"
                  {...registerTipo('tipo')}
                  className="mt-1"
                />
                <FieldError>{erroresTipo.tipo?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="tipo-familia">Familia</Label>
                <Input
                  id="tipo-familia"
                  placeholder="Ej. Mobiliario"
                  {...registerTipo('familia')}
                  className="mt-1"
                />
                <FieldError>{erroresTipo.familia?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="tipo-marca">Marca</Label>
                <Input
                  id="tipo-marca"
                  placeholder="Ej. Herman Miller"
                  {...registerTipo('marca')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="tipo-modelo">Modelo</Label>
                <Input
                  id="tipo-modelo"
                  placeholder="Ej. Aeron V2"
                  {...registerTipo('modelo')}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="tipo-criticidad">Criticidad</Label>
                  <select
                    id="tipo-criticidad"
                    {...registerTipo('criticidad')}
                    className="mt-1 w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="tipo-tech">Tecnología</Label>
                  <select
                    id="tipo-tech"
                    {...registerTipo('tecnologiaIdentificacion')}
                    className="mt-1 w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
                  >
                    <option value="qr">QR</option>
                    <option value="rfid">RFID</option>
                    <option value="qr_rfid">QR + RFID</option>
                  </select>
                </div>
              </div>

              {tipoError && <Alert variant="error">{tipoError}</Alert>}

              <Button type="submit" disabled={creandoTipo} className="w-full">
                {creandoTipo ? 'Guardando…' : 'Crear Tipo de Catálogo'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
