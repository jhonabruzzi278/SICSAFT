import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  cisClient,
  CisApiError,
  type Contrato,
  type Indicadores,
  type OrganizacionAdmin,
  type RolAsignable,
  type SedeCreada,
  type UsuarioOrganizacion,
} from '@/lib/cis-client';
import { MATRIZ_PERMISOS, type Acceso } from '@/lib/matriz-permisos';
import {
  Alert,
  Badge,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  StatCard,
} from '@/components/ui';
import { IconFileText, IconLayers, IconMapPin } from '@/components/icons';

// RF-15 (DOC-021) / DOC-022 — pantalla única del portal, con secciones (mismo patrón que
// EstructuraPage tenía en ccp/ para Áreas/Ubicaciones/Responsables). Este rol nunca toca
// información patrimonial (Activos/Catálogo/Documentos son exclusivos de ccp/,
// administrador-patrimonial) — ver DOC-021 1, DOC-022 2.

const altaOrganizacionSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
});
type AltaOrganizacionForm = z.infer<typeof altaOrganizacionSchema>;

const editarOrganizacionSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
});
type EditarOrganizacionForm = z.infer<typeof editarOrganizacionSchema>;

const altaContratoSchema = z.object({
  organizacionId: z.string().min(1, 'Elegí una organización'),
  sedeIds: z.array(z.string()).min(1, 'Elegí al menos una sede'),
  vigenciaDesde: z.string().min(1, 'Requerido'),
});
type AltaContratoForm = z.infer<typeof altaContratoSchema>;

const editarCondicionesSchema = z.object({
  vigenciaHasta: z.string().optional(),
});
type EditarCondicionesForm = z.infer<typeof editarCondicionesSchema>;

const altaSedeSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
});
type AltaSedeForm = z.infer<typeof altaSedeSchema>;

const asignarUsuarioSchema = z.object({
  organizacionId: z.string().min(1, 'Elegí una organización'),
  email: z.string().email('Email inválido'),
  rol: z.enum([
    'administrador-patrimonial',
    'directivo',
    'administrador-sistema',
  ]),
});
type AsignarUsuarioForm = z.infer<typeof asignarUsuarioSchema>;

function errorDeCisApi(err: unknown, accion: string): string {
  if (err instanceof CisApiError && err.status === 403) {
    return `No tenés el rol administrador-sistema necesario para ${accion}.`;
  }
  if (err instanceof CisApiError && err.status === 404) {
    return err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}

// DOC-024 1 — fila con edición inline de nombre y baja/reactivación. Estado propio por fila (no
// levantado al padre): cada organización se edita de forma independiente, sin bloquear al resto
// de la tabla mientras una fila está en modo edición.
function OrganizacionRow({
  organizacion,
  onUpdated,
}: {
  organizacion: OrganizacionAdmin;
  onUpdated: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditarOrganizacionForm>({
    resolver: zodResolver(editarOrganizacionSchema),
    defaultValues: { nombre: organizacion.nombre },
  });

  async function guardar(values: EditarOrganizacionForm) {
    setBusy(true);
    setError(null);
    try {
      await cisClient.editarOrganizacion(organizacion.id, values);
      setEditando(false);
      onUpdated();
    } catch (err: unknown) {
      setError(errorDeCisApi(err, 'editar la organización'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleEstado() {
    setBusy(true);
    setError(null);
    try {
      await cisClient.actualizarEstadoOrganizacion(
        organizacion.id,
        organizacion.estado === 'activo' ? 'inactivo' : 'activo',
      );
      onUpdated();
    } catch (err: unknown) {
      setError(errorDeCisApi(err, 'cambiar el estado de la organización'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-2 font-mono text-xs">{organizacion.id}</td>
      <td className="px-4 py-2">
        {editando ? (
          <form
            onSubmit={(e) => void handleSubmit(guardar)(e)}
            className="flex items-center gap-2"
          >
            <Input {...register('nombre')} className="h-8 max-w-xs py-1" />
            <Button type="submit" variant="secondary" disabled={busy} className="px-2 py-1 text-xs">
              Guardar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => {
                setEditando(false);
                reset({ nombre: organizacion.nombre });
              }}
            >
              Cancelar
            </Button>
          </form>
        ) : (
          organizacion.nombre
        )}
        <FieldError>{errors.nombre?.message}</FieldError>
      </td>
      <td className="px-4 py-2">
        <Badge>{organizacion.estado}</Badge>
      </td>
      <td className="px-4 py-2">
        {!editando && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => setEditando(true)}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              className="px-2 py-1 text-xs"
              onClick={() => void toggleEstado()}
            >
              {organizacion.estado === 'activo' ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </td>
    </tr>
  );
}

function OrganizacionesSection({
  organizaciones,
  onCreated,
}: {
  organizaciones: OrganizacionAdmin[] | null;
  onCreated: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaOrganizacionForm>({
    resolver: zodResolver(altaOrganizacionSchema),
  });

  async function onSubmit(values: AltaOrganizacionForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      // DOC-022 3 — ya no hace falta decir "en qué organización tengo el rol" (era el bug que
      // motivó separar este portal): el rol administrador-sistema se verifica en cualquier
      // organización del token del operador. Gap 1 — tampoco hace falta decir el id de Zitadel:
      // CIS crea la organización en Zitadel y usa ese id.
      await cisClient.altaOrganizacion({ nombre: values.nombre });
      setSubmitOk(true);
      reset();
      onCreated();
    } catch (err: unknown) {
      setSubmitError(errorDeCisApi(err, 'crear una organización'));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {!organizaciones && <p className="text-text-dim">Cargando…</p>}
        {organizaciones?.length === 0 && (
          <p className="text-text-dim">Sin organizaciones.</p>
        )}
        {organizaciones && organizaciones.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Id</th>
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {organizaciones.map((org) => (
                  <OrganizacionRow
                    key={org.id}
                    organizacion={org}
                    onUpdated={onCreated}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Card className="h-fit">
        <h3 className="mb-4 font-medium text-text">Nueva organización</h3>
        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="org-nombre">Nombre</Label>
            <Input id="org-nombre" {...register('nombre')} />
            <FieldError>{errors.nombre?.message}</FieldError>
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          {submitOk && <Alert variant="success">Organización creada.</Alert>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creando…' : 'Crear organización'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// Gap 2 (flujo real Admin->Directivo->Profesional AFT) — sin esto, ninguna organización nueva
// podía tener nunca un Contrato. DOC-024 1 — ya no maneja su propio selector de organización: lo
// recibe de ContratosSection (mismo estado que alimenta el picker de sedes del formulario de
// Contrato) y además lista las sedes existentes con acción de baja/reactivación.
function NuevaSedeCard({
  organizacionId,
  sedes,
  onChanged,
}: {
  organizacionId: string;
  sedes: SedeCreada[] | null;
  onChanged: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sedeCreada, setSedeCreada] = useState<SedeCreada | null>(null);
  const [estadoError, setEstadoError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaSedeForm>({ resolver: zodResolver(altaSedeSchema) });

  async function onSubmit(values: AltaSedeForm) {
    setSubmitError(null);
    setSedeCreada(null);
    try {
      const sede = await cisClient.altaSede({ organizacionId, ...values });
      setSedeCreada(sede);
      reset();
      onChanged();
    } catch (err: unknown) {
      setSubmitError(errorDeCisApi(err, 'crear una sede'));
    }
  }

  async function toggleEstado(sede: SedeCreada) {
    setBusyId(sede.id);
    setEstadoError(null);
    try {
      await cisClient.actualizarEstadoSede(
        sede.id,
        organizacionId,
        sede.estado === 'activo' ? 'inactivo' : 'activo',
      );
      onChanged();
    } catch (err: unknown) {
      setEstadoError(errorDeCisApi(err, 'cambiar el estado de la sede'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="h-fit">
      <h3 className="mb-4 font-medium text-text">Sedes</h3>
      {!organizacionId && (
        <p className="mb-4 text-sm text-text-dim">
          Elegí una organización para ver y crear sedes.
        </p>
      )}
      {organizacionId && sedes && sedes.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {sedes.map((sede) => (
            <li
              key={sede.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>
                {sede.nombre} <Badge>{sede.estado}</Badge>
              </span>
              <Button
                variant="ghost"
                disabled={busyId === sede.id}
                className="px-2 py-1 text-xs"
                onClick={() => void toggleEstado(sede)}
              >
                {sede.estado === 'activo' ? 'Desactivar' : 'Activar'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {organizacionId && sedes?.length === 0 && (
        <p className="mb-4 text-sm text-text-dim">
          Sin sedes todavía para esta organización.
        </p>
      )}
      {estadoError && <Alert>{estadoError}</Alert>}
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="sede-nombre">Nombre de la nueva sede</Label>
          <Input id="sede-nombre" {...register('nombre')} />
          <FieldError>{errors.nombre?.message}</FieldError>
        </div>
        {submitError && <Alert>{submitError}</Alert>}
        {sedeCreada && (
          <Alert variant="success">Sede «{sedeCreada.nombre}» creada.</Alert>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !organizacionId}
          className="w-full"
        >
          {isSubmitting ? 'Creando…' : 'Crear sede'}
        </Button>
      </form>
    </Card>
  );
}

// DOC-024 2 — editar condiciones (hoy solo extender/acotar vigencia desde la UI; el backend ya
// soporta también sedeIds/modulosContratados vía la misma API para uso futuro). Endpoint separado
// del cambio de estado que ya existía.
function EditarCondicionesContrato({
  contrato,
  onUpdated,
}: {
  contrato: Contrato;
  onUpdated: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<EditarCondicionesForm>({
    resolver: zodResolver(editarCondicionesSchema),
    defaultValues: { vigenciaHasta: contrato.vigenciaHasta ?? '' },
  });
  const editable = contrato.estado === 'vigente' || contrato.estado === 'suspendido';

  async function onSubmit(values: EditarCondicionesForm) {
    setError(null);
    try {
      await cisClient.actualizarCondicionesContrato(contrato.id, {
        organizacionId: contrato.organizacionId,
        vigenciaHasta: values.vigenciaHasta
          ? new Date(values.vigenciaHasta).toISOString()
          : null,
      });
      setAbierto(false);
      onUpdated();
    } catch (err: unknown) {
      setError(errorDeCisApi(err, 'editar las condiciones del contrato'));
    }
  }

  if (!editable) return null;

  return (
    <div className="mt-1">
      {!abierto && (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          onClick={() => setAbierto(true)}
        >
          Editar vigencia
        </Button>
      )}
      {abierto && (
        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="mt-2 flex items-center gap-2"
        >
          <Input
            type="date"
            className="h-8 max-w-[10rem] py-1"
            {...register('vigenciaHasta')}
          />
          <Button type="submit" variant="secondary" disabled={isSubmitting} className="px-2 py-1 text-xs">
            Guardar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </Button>
        </form>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ContratosSection({
  organizaciones,
}: {
  organizaciones: OrganizacionAdmin[] | null;
}) {
  const [orgSeleccionada, setOrgSeleccionada] = useState('');
  const [sedes, setSedes] = useState<SedeCreada[] | null>(null);
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AltaContratoForm>({
    resolver: zodResolver(altaContratoSchema),
    defaultValues: { sedeIds: [] },
  });

  function cargarContratos() {
    setListError(null);
    cisClient
      .getContratos()
      .then(setContratos)
      .catch((err: unknown) =>
        setListError(err instanceof Error ? err.message : 'Error desconocido'),
      );
  }

  // DOC-024 1 — el picker que reemplaza copiar/pegar un id de sede a mano.
  function cargarSedes(orgId: string) {
    if (!orgId) {
      setSedes(null);
      return;
    }
    cisClient.getSedes(orgId).then(setSedes).catch(() => setSedes([]));
  }

  useEffect(cargarContratos, []);

  function onOrgChange(orgId: string) {
    setOrgSeleccionada(orgId);
    setValue('organizacionId', orgId);
    setValue('sedeIds', []);
    cargarSedes(orgId);
  }

  async function onSubmit(values: AltaContratoForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      await cisClient.altaContrato({
        organizacionId: values.organizacionId,
        sedeIds: values.sedeIds,
        vigenciaDesde: new Date(values.vigenciaDesde).toISOString(),
        modulosContratados: ['inventario-qr'],
      });
      setSubmitOk(true);
      reset({ organizacionId: values.organizacionId, sedeIds: [] });
      cargarContratos();
    } catch (err: unknown) {
      setSubmitError(errorDeCisApi(err, 'crear un contrato'));
    }
  }

  const sedesActivas = sedes?.filter((s) => s.estado === 'activo') ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {listError && <Alert>{listError}</Alert>}
        {!listError && !contratos && <p className="text-text-dim">Cargando…</p>}
        {contratos?.length === 0 && (
          <p className="text-text-dim">Sin contratos.</p>
        )}
        {contratos && contratos.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Organización</th>
                  <th className="px-4 py-2 font-medium">Sedes</th>
                  <th className="px-4 py-2 font-medium">Vigencia hasta</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((contrato) => (
                  <tr key={contrato.id} className="border-t border-border align-top">
                    <td className="px-4 py-2">{contrato.organizacionNombre}</td>
                    <td className="px-4 py-2 text-xs">
                      {contrato.sedes.map((s) => s.nombre).join(', ')}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {contrato.vigenciaHasta
                        ? new Date(contrato.vigenciaHasta).toLocaleDateString()
                        : 'Indefinida'}
                      <EditarCondicionesContrato
                        contrato={contrato}
                        onUpdated={cargarContratos}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Badge>{contrato.estado}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="space-y-6">
        <div>
          <Label htmlFor="contratos-org">Organización</Label>
          <select
            id="contratos-org"
            value={orgSeleccionada}
            onChange={(e) => onOrgChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
          >
            <option value="">— Elegir —</option>
            {organizaciones?.map((org) => (
              <option key={org.id} value={org.id}>
                {org.nombre}
              </option>
            ))}
          </select>
        </div>
        <NuevaSedeCard
          organizacionId={orgSeleccionada}
          sedes={sedes}
          onChanged={() => cargarSedes(orgSeleccionada)}
        />
        <Card className="h-fit">
          <h3 className="mb-4 font-medium text-text">Nuevo contrato</h3>
          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="space-y-4"
          >
            <input type="hidden" {...register('organizacionId')} />
            <FieldError>{errors.organizacionId?.message}</FieldError>
            <div>
              <Label>Sedes cubiertas</Label>
              {!orgSeleccionada && (
                <p className="text-sm text-text-dim">
                  Elegí una organización arriba.
                </p>
              )}
              {orgSeleccionada && sedesActivas.length === 0 && (
                <p className="text-sm text-text-dim">
                  Sin sedes activas para esta organización — creá una primero.
                </p>
              )}
              {sedesActivas.length > 0 && (
                <div className="space-y-1.5">
                  {sedesActivas.map((sede) => (
                    <label
                      key={sede.id}
                      className="flex items-center gap-2 text-sm text-text"
                    >
                      <input
                        type="checkbox"
                        value={sede.id}
                        {...register('sedeIds')}
                      />
                      {sede.nombre}
                    </label>
                  ))}
                </div>
              )}
              <FieldError>{errors.sedeIds?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="contrato-vigencia">Vigencia desde</Label>
              <Input
                id="contrato-vigencia"
                type="date"
                {...register('vigenciaDesde')}
              />
              <FieldError>{errors.vigenciaDesde?.message}</FieldError>
            </div>
            {submitError && <Alert>{submitError}</Alert>}
            {submitOk && <Alert variant="success">Contrato creado.</Alert>}
            <Button
              type="submit"
              disabled={isSubmitting || !orgSeleccionada}
              className="w-full"
            >
              {isSubmitting ? 'Creando…' : 'Crear contrato'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function UsuariosSection({
  organizaciones,
}: {
  organizaciones: OrganizacionAdmin[] | null;
}) {
  const [orgSeleccionada, setOrgSeleccionada] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioOrganizacion[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const [rolBusy, setRolBusy] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AsignarUsuarioForm>({
    resolver: zodResolver(asignarUsuarioSchema),
  });

  function cargarUsuarios(orgId: string) {
    if (!orgId) {
      setUsuarios(null);
      return;
    }
    setListError(null);
    cisClient
      .getUsuariosOrganizacion(orgId)
      .then(setUsuarios)
      .catch((err: unknown) =>
        setListError(errorDeCisApi(err, 'ver los usuarios')),
      );
  }

  function onOrgChange(orgId: string) {
    setOrgSeleccionada(orgId);
    setValue('organizacionId', orgId);
    cargarUsuarios(orgId);
  }

  async function onSubmit(values: AsignarUsuarioForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      await cisClient.asignarUsuarioOrganizacion(
        values.organizacionId,
        values.email,
        values.rol as RolAsignable,
      );
      setSubmitOk(true);
      reset({
        organizacionId: values.organizacionId,
        email: '',
        rol: values.rol,
      });
      cargarUsuarios(values.organizacionId);
    } catch (err: unknown) {
      setSubmitError(errorDeCisApi(err, 'asignar un usuario'));
    }
  }

  // DOC-024 — inverso de asignar: quita un rol puntual, no borra al usuario de la organización si
  // le quedan otros roles (mismo criterio que ZitadelAdminService.quitarRolDeGrant).
  async function quitarRol(usuario: UsuarioOrganizacion, rol: string) {
    const busyKey = `${usuario.userId}:${rol}`;
    setRolBusy(busyKey);
    setListError(null);
    try {
      await cisClient.quitarRolUsuarioOrganizacion(
        orgSeleccionada,
        usuario.userId,
        rol as RolAsignable,
      );
      cargarUsuarios(orgSeleccionada);
    } catch (err: unknown) {
      setListError(errorDeCisApi(err, 'quitar el rol'));
    } finally {
      setRolBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <Label htmlFor="usuarios-org">Organización</Label>
        <select
          id="usuarios-org"
          value={orgSeleccionada}
          onChange={(e) => onOrgChange(e.target.value)}
          className="mb-4 w-full max-w-xs rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
        >
          <option value="">— Elegir —</option>
          {organizaciones?.map((org) => (
            <option key={org.id} value={org.id}>
              {org.nombre}
            </option>
          ))}
        </select>
        {listError && <Alert>{listError}</Alert>}
        {orgSeleccionada && !usuarios && !listError && (
          <p className="text-text-dim">Cargando…</p>
        )}
        {usuarios?.length === 0 && (
          <p className="text-text-dim">Sin usuarios asignados.</p>
        )}
        {usuarios && usuarios.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Roles</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.userId} className="border-t border-border">
                    <td className="px-4 py-2">
                      {usuario.email ?? usuario.userId}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {usuario.roles.map((rol) => (
                          <span key={rol} className="flex items-center gap-1">
                            <Badge>{rol}</Badge>
                            <button
                              type="button"
                              title={`Quitar ${rol}`}
                              disabled={rolBusy === `${usuario.userId}:${rol}`}
                              onClick={() => void quitarRol(usuario, rol)}
                              className="text-xs text-text-faint hover:text-destructive disabled:opacity-50"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Card className="h-fit">
        <h3 className="mb-4 font-medium text-text">Asignar usuario</h3>
        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
        >
          <input type="hidden" {...register('organizacionId')} />
          <FieldError>{errors.organizacionId?.message}</FieldError>
          <div>
            <Label htmlFor="usuario-email">
              Email (usuario ya existente en Zitadel)
            </Label>
            <Input id="usuario-email" type="email" {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="usuario-rol">Rol</Label>
            <select
              id="usuario-rol"
              {...register('rol')}
              className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
            >
              <option value="administrador-patrimonial">
                Profesional de AFT
              </option>
              <option value="directivo">Directivo</option>
              <option value="administrador-sistema">
                Administrador del Sistema
              </option>
            </select>
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          {submitOk && <Alert variant="success">Usuario asignado.</Alert>}
          <Button
            type="submit"
            disabled={isSubmitting || !orgSeleccionada}
            className="w-full"
          >
            {isSubmitting ? 'Asignando…' : 'Asignar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function IndicadoresSection() {
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cisClient
      .getIndicadores()
      .then(setIndicadores)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Error desconocido'),
      );
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!indicadores) return <p className="text-text-dim">Cargando…</p>;

  const tarjetas = [
    {
      label: 'Organizaciones',
      valor: indicadores.totalOrganizaciones,
      icon: <IconLayers />,
      tone: 'accent' as const,
    },
    {
      label: 'Sedes',
      valor: indicadores.totalSedes,
      icon: <IconMapPin />,
      tone: 'accent' as const,
    },
    {
      label: 'Contratos vigentes',
      valor: indicadores.contratosPorEstado.vigente,
      icon: <IconFileText />,
      tone: 'success' as const,
    },
    {
      label: 'Contratos suspendidos',
      valor: indicadores.contratosPorEstado.suspendido,
      icon: <IconFileText />,
      tone: 'warning' as const,
    },
    {
      label: 'Contratos vencidos',
      valor: indicadores.contratosPorEstado.vencido,
      icon: <IconFileText />,
      tone: 'warning' as const,
    },
    {
      label: 'Contratos cancelados',
      valor: indicadores.contratosPorEstado.cancelado,
      icon: <IconFileText />,
      tone: 'destructive' as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tarjetas.map((t) => (
        <StatCard
          key={t.label}
          label={t.label}
          value={t.valor}
          icon={t.icon}
          tone={t.tone}
        />
      ))}
    </div>
  );
}

const ACCESO_LABEL: Record<Acceso, string> = {
  si: 'Sí',
  no: '—',
  lectura: 'Lectura',
};

// DOC-024 4 — pantalla de solo lectura: muestra los 3 roles fijos que ya existen y qué puede
// hacer cada uno (DOC-023 §2 transcripto en matriz-permisos.ts). No crea roles nuevos ni permisos
// configurables — decidido explícitamente con el usuario.
function MatrizRolesSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-dim">
        Los 3 roles de este ecosistema son fijos — esta pantalla es de solo
        lectura, calculada desde el código real (guards de CIS/CORE).
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-raised text-text-dim">
            <tr>
              <th className="px-4 py-2 font-medium">Módulo</th>
              <th className="px-4 py-2 font-medium">Acción</th>
              <th className="px-4 py-2 font-medium">Profesional de AFT</th>
              <th className="px-4 py-2 font-medium">Admin. del Sistema</th>
              <th className="px-4 py-2 font-medium">Directivo</th>
              <th className="px-4 py-2 font-medium">Mecanismo</th>
            </tr>
          </thead>
          <tbody>
            {MATRIZ_PERMISOS.map((fila) => (
              <tr
                key={`${fila.modulo}-${fila.accion}`}
                className="border-t border-border"
              >
                <td className="px-4 py-2">{fila.modulo}</td>
                <td className="px-4 py-2 text-text-dim">{fila.accion}</td>
                <td className="px-4 py-2">{ACCESO_LABEL[fila.patrimonial]}</td>
                <td className="px-4 py-2">{ACCESO_LABEL[fila.sistema]}</td>
                <td className="px-4 py-2">{ACCESO_LABEL[fila.directivo]}</td>
                <td className="px-4 py-2 font-mono text-xs text-text-faint">
                  {fila.mecanismo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const SECCIONES = [
  'Organizaciones',
  'Contratos',
  'Usuarios',
  'MatrizRoles',
  'Indicadores',
] as const;
export type Seccion = (typeof SECCIONES)[number];

const SECCION_TITULOS: Record<Seccion, string> = {
  Organizaciones: 'Organizaciones',
  Contratos: 'Contratos',
  Usuarios: 'Usuarios',
  MatrizRoles: 'Matriz de roles',
  Indicadores: 'Indicadores',
};

export function AdminPage() {
  const [searchParams] = useSearchParams();
  const seccionParam = searchParams.get('seccion');
  const seccion: Seccion = (SECCIONES as readonly string[]).includes(
    seccionParam ?? '',
  )
    ? (seccionParam as Seccion)
    : 'Organizaciones';
  const [organizaciones, setOrganizaciones] = useState<
    OrganizacionAdmin[] | null
  >(null);

  function cargarOrganizaciones() {
    cisClient
      .getOrganizaciones()
      .then(setOrganizaciones)
      .catch(() => setOrganizaciones([]));
  }

  useEffect(cargarOrganizaciones, []);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-accent-strong">
        {SECCION_TITULOS[seccion]}
      </h1>
      <p className="mb-6 text-sm text-text-dim">
        Administrador del Sistema — organizaciones, contratos, usuarios e
        indicadores de plataforma. Nunca información patrimonial
        (Activos/Catálogo/Documentos, exclusivo de CCP).
      </p>
      {seccion === 'Organizaciones' && (
        <OrganizacionesSection
          organizaciones={organizaciones}
          onCreated={cargarOrganizaciones}
        />
      )}
      {seccion === 'Contratos' && (
        <ContratosSection organizaciones={organizaciones} />
      )}
      {seccion === 'Usuarios' && (
        <UsuariosSection organizaciones={organizaciones} />
      )}
      {seccion === 'MatrizRoles' && <MatrizRolesSection />}
      {seccion === 'Indicadores' && <IndicadoresSection />}
    </div>
  );
}
