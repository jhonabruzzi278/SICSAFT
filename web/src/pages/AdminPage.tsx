import { useEffect, useState } from 'react';
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
  type UsuarioOrganizacion,
} from '@/lib/cis-client';
import { Alert, Badge, Button, Card, FieldError, Input, Label } from '@/components/ui';

// RF-15 (DOC-021, Administrador del Sistema) — una sola pantalla con secciones, mismo patrón
// multi-sección que EstructuraPage (Áreas/Ubicaciones/Responsables). Este rol nunca toca
// información patrimonial (Activos/Catálogo/Documentos siguen exclusivos de
// administrador-patrimonial) — ver DOC-021 1.

const altaOrganizacionSchema = z.object({
  id: z.string().min(1, 'Requerido — mismo id que la organización en Zitadel'),
  nombre: z.string().min(1, 'Requerido'),
});
type AltaOrganizacionForm = z.infer<typeof altaOrganizacionSchema>;

const altaContratoSchema = z.object({
  organizacionId: z.string().min(1, 'Elegí una organización'),
  sedeIds: z.string().min(1, 'Requerido — ids separados por coma'),
  vigenciaDesde: z.string().min(1, 'Requerido'),
});
type AltaContratoForm = z.infer<typeof altaContratoSchema>;

const asignarUsuarioSchema = z.object({
  organizacionId: z.string().min(1, 'Elegí una organización'),
  email: z.string().email('Email inválido'),
  rol: z.enum(['administrador-patrimonial', 'directivo', 'administrador-sistema']),
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
  } = useForm<AltaOrganizacionForm>({ resolver: zodResolver(altaOrganizacionSchema) });

  async function onSubmit(values: AltaOrganizacionForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      // organizacionId acá es "en qué organización tenés el rol administrador-sistema" (para el
      // chequeo de AdministradorSistemaGuard) — no la organización nueva que se está creando.
      // Usamos el id de la primera organización que ya administra el operador, si tiene alguna.
      await cisClient.altaOrganizacion({
        organizacionId: organizaciones?.[0]?.id ?? values.id,
        id: values.id,
        nombre: values.nombre,
      });
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
        {organizaciones?.length === 0 && <p className="text-text-dim">Sin organizaciones.</p>}
        {organizaciones && organizaciones.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Id</th>
                  <th className="px-4 py-2 font-medium">Nombre</th>
                </tr>
              </thead>
              <tbody>
                {organizaciones.map((org) => (
                  <tr key={org.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{org.id}</td>
                    <td className="px-4 py-2">{org.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Card className="h-fit">
        <h3 className="mb-4 font-medium text-text">Nueva organización</h3>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div>
            <Label htmlFor="org-id">Id (igual al de Zitadel)</Label>
            <Input id="org-id" {...register('id')} />
            <FieldError>{errors.id?.message}</FieldError>
          </div>
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

function ContratosSection({ organizaciones }: { organizaciones: OrganizacionAdmin[] | null }) {
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaContratoForm>({ resolver: zodResolver(altaContratoSchema) });

  function cargar() {
    setListError(null);
    cisClient
      .getContratos()
      .then(setContratos)
      .catch((err: unknown) => setListError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(cargar, []);

  async function onSubmit(values: AltaContratoForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      await cisClient.altaContrato({
        organizacionId: values.organizacionId,
        sedeIds: values.sedeIds.split(',').map((s) => s.trim()).filter(Boolean),
        vigenciaDesde: new Date(values.vigenciaDesde).toISOString(),
        modulosContratados: ['inventario-qr'],
      });
      setSubmitOk(true);
      reset();
      cargar();
    } catch (err: unknown) {
      setSubmitError(errorDeCisApi(err, 'crear un contrato'));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {listError && <Alert>{listError}</Alert>}
        {!listError && !contratos && <p className="text-text-dim">Cargando…</p>}
        {contratos?.length === 0 && <p className="text-text-dim">Sin contratos.</p>}
        {contratos && contratos.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Organización</th>
                  <th className="px-4 py-2 font-medium">Sedes</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((contrato) => (
                  <tr key={contrato.id} className="border-t border-border">
                    <td className="px-4 py-2">{contrato.organizacionNombre}</td>
                    <td className="px-4 py-2 text-xs">
                      {contrato.sedes.map((s) => s.nombre).join(', ')}
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
      <Card className="h-fit">
        <h3 className="mb-4 font-medium text-text">Nuevo contrato</h3>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div>
            <Label htmlFor="contrato-org">Organización</Label>
            <select
              id="contrato-org"
              {...register('organizacionId')}
              className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text"
            >
              <option value="">— Elegir —</option>
              {organizaciones?.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.nombre}
                </option>
              ))}
            </select>
            <FieldError>{errors.organizacionId?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="contrato-sedes">Sedes (ids separados por coma)</Label>
            <Input id="contrato-sedes" {...register('sedeIds')} />
            <FieldError>{errors.sedeIds?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="contrato-vigencia">Vigencia desde</Label>
            <Input id="contrato-vigencia" type="date" {...register('vigenciaDesde')} />
            <FieldError>{errors.vigenciaDesde?.message}</FieldError>
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          {submitOk && <Alert variant="success">Contrato creado.</Alert>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creando…' : 'Crear contrato'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function UsuariosSection({ organizaciones }: { organizaciones: OrganizacionAdmin[] | null }) {
  const [orgSeleccionada, setOrgSeleccionada] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioOrganizacion[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AsignarUsuarioForm>({ resolver: zodResolver(asignarUsuarioSchema) });

  function cargarUsuarios(orgId: string) {
    if (!orgId) {
      setUsuarios(null);
      return;
    }
    setListError(null);
    cisClient
      .getUsuariosOrganizacion(orgId)
      .then(setUsuarios)
      .catch((err: unknown) => setListError(errorDeCisApi(err, 'ver los usuarios')));
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
      reset({ organizacionId: values.organizacionId, email: '', rol: values.rol });
      cargarUsuarios(values.organizacionId);
    } catch (err: unknown) {
      setSubmitError(errorDeCisApi(err, 'asignar un usuario'));
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
        {orgSeleccionada && !usuarios && !listError && <p className="text-text-dim">Cargando…</p>}
        {usuarios?.length === 0 && <p className="text-text-dim">Sin usuarios asignados.</p>}
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
                    <td className="px-4 py-2">{usuario.email ?? usuario.userId}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {usuario.roles.map((rol) => (
                          <Badge key={rol}>{rol}</Badge>
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
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <input type="hidden" {...register('organizacionId')} />
          <FieldError>{errors.organizacionId?.message}</FieldError>
          <div>
            <Label htmlFor="usuario-email">Email (usuario ya existente en Zitadel)</Label>
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
              <option value="administrador-patrimonial">Profesional de AFT</option>
              <option value="directivo">Directivo</option>
              <option value="administrador-sistema">Administrador del Sistema</option>
            </select>
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          {submitOk && <Alert variant="success">Usuario asignado.</Alert>}
          <Button type="submit" disabled={isSubmitting || !orgSeleccionada} className="w-full">
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
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!indicadores) return <p className="text-text-dim">Cargando…</p>;

  const tarjetas = [
    { label: 'Organizaciones', valor: indicadores.totalOrganizaciones },
    { label: 'Sedes', valor: indicadores.totalSedes },
    { label: 'Contratos vigentes', valor: indicadores.contratosPorEstado.vigente },
    { label: 'Contratos suspendidos', valor: indicadores.contratosPorEstado.suspendido },
    { label: 'Contratos vencidos', valor: indicadores.contratosPorEstado.vencido },
    { label: 'Contratos cancelados', valor: indicadores.contratosPorEstado.cancelado },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tarjetas.map((t) => (
        <Card key={t.label}>
          <p className="text-sm text-text-dim">{t.label}</p>
          <p className="text-3xl font-semibold text-accent-strong">{t.valor}</p>
        </Card>
      ))}
    </div>
  );
}

const SECCIONES = ['Organizaciones', 'Contratos', 'Usuarios', 'Indicadores'] as const;
type Seccion = (typeof SECCIONES)[number];

export function AdminPage() {
  const [seccion, setSeccion] = useState<Seccion>('Organizaciones');
  const [organizaciones, setOrganizaciones] = useState<OrganizacionAdmin[] | null>(null);

  function cargarOrganizaciones() {
    cisClient.getOrganizaciones().then(setOrganizaciones).catch(() => setOrganizaciones([]));
  }

  useEffect(cargarOrganizaciones, []);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-accent-strong">Administración</h1>
      <p className="mb-6 text-sm text-text-dim">
        Administrador del Sistema — organizaciones, contratos, usuarios e indicadores de
        plataforma. Nunca información patrimonial (Activos/Catálogo/Documentos).
      </p>
      <div className="mb-6 flex gap-2 border-b border-border">
        {SECCIONES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeccion(s)}
            className={`px-3 py-2 text-sm font-medium ${
              seccion === s
                ? 'border-b-2 border-accent text-accent-strong'
                : 'text-text-dim hover:text-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {seccion === 'Organizaciones' && (
        <OrganizacionesSection organizaciones={organizaciones} onCreated={cargarOrganizaciones} />
      )}
      {seccion === 'Contratos' && <ContratosSection organizaciones={organizaciones} />}
      {seccion === 'Usuarios' && <UsuariosSection organizaciones={organizaciones} />}
      {seccion === 'Indicadores' && <IndicadoresSection />}
    </div>
  );
}
