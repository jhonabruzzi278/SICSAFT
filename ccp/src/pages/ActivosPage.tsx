import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

// RF-03 — módulo Activos: consulta (GET /catalogo, ya existía) + alta (POST /admin/activos,
// Fase 5/DOC-012). RF-08: el alta debe hacerse visible en el mismo catálogo que consume APP QR —
// por eso la lista se recarga después de un alta exitosa, contra el mismo endpoint.
// RF-11/RF-12/RF-13 (DOC-021) — cierra los gaps de estados/catálogo/documentos que RF-03 dejó
// fuera a propósito (solo alta, ver REQUISITOS.md).

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

  const [editando, setEditando] = useState<ActivoCatalogo | null>(null);
  const [editarError, setEditarError] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoActivo[] | null>(null);
  const [documentoError, setDocumentoError] = useState<string | null>(null);

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
    formState: { errors: erroresDocumento, isSubmitting: agregandoDocumento },
  } = useForm<DocumentoForm>({ resolver: zodResolver(documentoSchema) });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargarCatalogo/cargarCatalogoTipos se recrean cada render a proposito
  }, [organizacionId]);

  async function onSubmit(values: AltaForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      await cisClient.altaActivo({
        organizacionId,
        codigoPatrimonial: values.codigoPatrimonial,
        codigoQr: values.codigoQr,
        catalogoId: values.catalogoId,
        // react-hook-form deja '' en campos opcionales sin tocar, no undefined — el schema de
        // CIS exige min(1) en los opcionales (o ausentes), un '' se rechaza como payload inválido.
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
    } catch (err: unknown) {
      setListError(errorDeCisApi(err, 'dar de baja un activo'));
    }
  }

  async function reincorporar(activo: ActivoCatalogo) {
    setListError(null);
    try {
      await cisClient.reincorporarActivo(activo.id, organizacionId);
      cargarCatalogo();
    } catch (err: unknown) {
      setListError(errorDeCisApi(err, 'reincorporar un activo'));
    }
  }

  function abrirEdicion(activo: ActivoCatalogo) {
    setEditando(activo);
    setEditarError(null);
    resetEditar({ descripcion: '', responsableId: '' });
    setDocumentos(null);
    cisClient
      .getDocumentosActivo(activo.id, organizacionId)
      .then(setDocumentos)
      .catch(() => setDocumentos([]));
  }

  async function onSubmitEditar(values: EditarForm) {
    if (!editando) return;
    setEditarError(null);
    try {
      if (values.descripcion) {
        await cisClient.actualizarDescripcionActivo(
          editando.id,
          organizacionId,
          values.descripcion,
        );
      }
      if (values.responsableId) {
        await cisClient.cambiarResponsableActivo(
          editando.id,
          organizacionId,
          values.responsableId,
        );
      }
      setEditando(null);
      cargarCatalogo();
    } catch (err: unknown) {
      setEditarError(errorDeCisApi(err, 'editar un activo'));
    }
  }

  async function onSubmitDocumento(values: DocumentoForm) {
    if (!editando) return;
    setDocumentoError(null);
    try {
      await cisClient.altaDocumentoActivo(editando.id, {
        organizacionId,
        tipo: values.tipo,
        url: values.url,
        descripcion: values.descripcion || undefined,
      });
      resetDocumento();
      const lista = await cisClient.getDocumentosActivo(
        editando.id,
        organizacionId,
      );
      setDocumentos(lista);
    } catch (err: unknown) {
      setDocumentoError(errorDeCisApi(err, 'agregar un documento'));
    }
  }

  async function eliminarDocumento(documentoId: string) {
    if (!editando) return;
    setDocumentoError(null);
    try {
      await cisClient.eliminarDocumentoActivo(
        editando.id,
        documentoId,
        organizacionId,
      );
      const lista = await cisClient.getDocumentosActivo(
        editando.id,
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

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <h1 className="mb-4 text-2xl font-semibold text-accent-strong">
            Activos
          </h1>
          {listError && <Alert>{listError}</Alert>}
          {!listError && !activos && <p className="text-text-dim">Cargando…</p>}
          {activos?.length === 0 && (
            <p className="text-text-dim">Sin activos en el catálogo todavía.</p>
          )}
          {activos && activos.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-raised text-text-dim">
                  <tr>
                    <th className="px-4 py-2 font-medium">Código QR</th>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Área</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activos.map((activo) => (
                    <tr
                      key={activo.codigoQr}
                      className="border-t border-border"
                    >
                      <td className="px-4 py-2 font-mono text-xs">
                        {activo.codigoQr}
                      </td>
                      <td className="px-4 py-2">{activo.nombre}</td>
                      <td className="px-4 py-2">{activo.areaId}</td>
                      <td className="px-4 py-2">
                        <Badge>{activo.estado}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          {(activo.estado === 'activo' ||
                            activo.estado === 'extraviado') && (
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1 text-xs"
                              onClick={() => void darDeBaja(activo)}
                            >
                              Dar de baja
                            </Button>
                          )}
                          {activo.estado === 'extraviado' && (
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1 text-xs"
                              onClick={() => void reincorporar(activo)}
                            >
                              Reincorporar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs"
                            onClick={() => abrirEdicion(activo)}
                          >
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editando && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium text-text">
                Editar {editando.codigoQr} — {editando.nombre}
              </h2>
              <Button
                variant="ghost"
                className="!px-2 !py-1 text-xs"
                onClick={() => setEditando(null)}
              >
                Cerrar
              </Button>
            </div>
            <form
              onSubmit={(e) => void handleSubmitEditar(onSubmitEditar)(e)}
              className="mb-6 grid gap-4 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor="editar-descripcion">Nueva descripción</Label>
                <Input
                  id="editar-descripcion"
                  {...registerEditar('descripcion')}
                />
              </div>
              <div>
                <Label htmlFor="editar-responsable">
                  Nuevo responsable (id)
                </Label>
                <Input
                  id="editar-responsable"
                  {...registerEditar('responsableId')}
                />
              </div>
              {editarError && (
                <div className="sm:col-span-2">
                  <Alert>{editarError}</Alert>
                </div>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={guardandoEdicion}>
                  {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </form>

            <h3 className="mb-2 text-sm font-medium text-text-dim">
              Documentación y fotografías
            </h3>
            {!documentos && <p className="text-text-dim">Cargando…</p>}
            {documentos?.length === 0 && (
              <p className="mb-4 text-text-dim">Sin documentos todavía.</p>
            )}
            {documentos && documentos.length > 0 && (
              <ul className="mb-4 space-y-2">
                {documentos.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-accent hover:text-accent-strong"
                    >
                      [{doc.tipo}] {doc.descripcion ?? doc.url}
                    </a>
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1 text-xs"
                      onClick={() => void eliminarDocumento(doc.id)}
                    >
                      Eliminar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => void handleSubmitDocumento(onSubmitDocumento)(e)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor="doc-tipo">Tipo</Label>
                <select
                  id="doc-tipo"
                  {...registerDocumento('tipo')}
                  className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
                >
                  <option value="fotografia">Fotografía</option>
                  <option value="documento">Documento</option>
                </select>
              </div>
              <div>
                <Label htmlFor="doc-url">URL</Label>
                <Input
                  id="doc-url"
                  placeholder="https://…"
                  {...registerDocumento('url')}
                />
                <FieldError>{erroresDocumento.url?.message}</FieldError>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="doc-descripcion">Descripción (opcional)</Label>
                <Input
                  id="doc-descripcion"
                  {...registerDocumento('descripcion')}
                />
              </div>
              {documentoError && (
                <div className="sm:col-span-2">
                  <Alert>{documentoError}</Alert>
                </div>
              )}
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={agregandoDocumento}
                >
                  {agregandoDocumento ? 'Agregando…' : 'Agregar'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      {/* Alta manual de activo + tipo de catalogo -- operacion del CCP, disponible en todos los
          niveles (el gate de Nivel 1 se retiro con la correccion 2026-09-02, ver lib/nivel.ts). */}
      <div className="space-y-6">
        <Card className="h-fit">
          <h2 className="mb-4 font-medium text-text">Alta de activo</h2>
          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="codigoPatrimonial">Código patrimonial</Label>
              <Input
                id="codigoPatrimonial"
                {...register('codigoPatrimonial')}
              />
              <FieldError>{errors.codigoPatrimonial?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="codigoQr">Código QR</Label>
              <Input id="codigoQr" {...register('codigoQr')} />
              <FieldError>{errors.codigoQr?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="catalogoId">Catálogo (tipo)</Label>
              <select
                id="catalogoId"
                {...register('catalogoId')}
                className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
              >
                <option value="">— Elegir —</option>
                {catalogoTipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.tipo} — {tipo.familia}
                  </option>
                ))}
              </select>
              <FieldError>{errors.catalogoId?.message}</FieldError>
              <button
                type="button"
                className="mt-1 text-xs text-accent hover:text-accent-strong"
                onClick={() => setNuevoTipoAbierto((v) => !v)}
              >
                {nuevoTipoAbierto ? 'Cancelar' : '+ Nuevo tipo de catálogo'}
              </button>
            </div>
            <div>
              <Label htmlFor="serie">Serie (opcional)</Label>
              <Input id="serie" {...register('serie')} />
            </div>
            <div>
              <Label htmlFor="areaId">Área (opcional)</Label>
              <Input id="areaId" {...register('areaId')} />
            </div>
            <div>
              <Label htmlFor="ubicacionId">Ubicación (opcional)</Label>
              <Input id="ubicacionId" {...register('ubicacionId')} />
            </div>
            <div>
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Input id="descripcion" {...register('descripcion')} />
            </div>

            {submitError && <Alert>{submitError}</Alert>}
            {submitOk && <Alert variant="success">Activo creado.</Alert>}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creando…' : 'Crear activo'}
            </Button>
          </form>
        </Card>

        {nuevoTipoAbierto && (
          <Card className="h-fit">
            <h2 className="mb-4 font-medium text-text">
              Nuevo tipo de catálogo
            </h2>
            <form
              onSubmit={(e) => void handleSubmitTipo(onSubmitTipo)(e)}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="tipo-tipo">Tipo</Label>
                <Input id="tipo-tipo" {...registerTipo('tipo')} />
                <FieldError>{erroresTipo.tipo?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="tipo-familia">Familia</Label>
                <Input id="tipo-familia" {...registerTipo('familia')} />
                <FieldError>{erroresTipo.familia?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="tipo-subfamilia">Subfamilia (opcional)</Label>
                <Input id="tipo-subfamilia" {...registerTipo('subfamilia')} />
              </div>
              <div>
                <Label htmlFor="tipo-marca">Marca (opcional)</Label>
                <Input id="tipo-marca" {...registerTipo('marca')} />
              </div>
              <div>
                <Label htmlFor="tipo-modelo">Modelo (opcional)</Label>
                <Input id="tipo-modelo" {...registerTipo('modelo')} />
              </div>
              <div>
                <Label htmlFor="tipo-criticidad">Criticidad</Label>
                <select
                  id="tipo-criticidad"
                  {...registerTipo('criticidad')}
                  className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div>
                <Label htmlFor="tipo-tecnologia">
                  Tecnología de identificación
                </Label>
                <select
                  id="tipo-tecnologia"
                  {...registerTipo('tecnologiaIdentificacion')}
                  className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
                >
                  <option value="qr">QR</option>
                  <option value="rfid">RFID</option>
                  <option value="qr_rfid">QR + RFID</option>
                </select>
              </div>
              {tipoError && <Alert>{tipoError}</Alert>}
              <Button type="submit" disabled={creandoTipo} className="w-full">
                {creandoTipo ? 'Creando…' : 'Crear tipo'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
