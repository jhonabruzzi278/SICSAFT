import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  cisClient,
  CisApiError,
  type Area,
  type Responsable,
  type Sede,
  type Ubicacion,
} from '@/lib/cis-client';
import { Alert, Badge, Button, Card, FieldError, Input, Label } from '@/components/ui';

// RF-05 — módulo Áreas/Ubicaciones/Responsables: ABM, el único módulo del MVP que no reusaba
// infraestructura ya construida (ni CORE ni CIS tenían ningún endpoint todavía). Una sola pantalla
// con las tres secciones, en el orden en que se necesitan para completar el ciclo real (un Area
// primero, porque Responsable exige un areaId existente; Ubicacion exige un sedeId — se toma de
// las sedes del contrato vigente de la organización, ya cargadas en el hub).

const altaAreaSchema = z.object({
  codigo: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
  dependencia: z.string().optional(),
  centroCosto: z.string().optional(),
});
type AltaAreaForm = z.infer<typeof altaAreaSchema>;

const altaUbicacionSchema = z.object({
  sedeId: z.string().min(1, 'Requerido'),
  edificio: z.string().optional(),
  piso: z.string().optional(),
  areaId: z.string().optional(),
  oficina: z.string().optional(),
});
type AltaUbicacionForm = z.infer<typeof altaUbicacionSchema>;

const altaResponsableSchema = z.object({
  identificacion: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
  cargo: z.string().optional(),
  areaId: z.string().min(1, 'Requerido'),
  correo: z.string().email('Correo inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
});
type AltaResponsableForm = z.infer<typeof altaResponsableSchema>;

export function EstructuraPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [areas, setAreas] = useState<Area[] | null>(null);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [sedes, setSedes] = useState<Sede[] | null>(null);

  useEffect(() => {
    if (!organizacionId) return;
    cisClient
      .authSession()
      .then((res) => {
        const org = res.organizaciones.find((o) => o.id === organizacionId);
        setSedes(org?.sedes ?? []);
      })
      .catch(() => setSedes([]));
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
    return <Alert>Falta organizacionId — volvé al hub y elegí una organización.</Alert>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-accent-strong">
        Áreas, ubicaciones y responsables
      </h1>
      <div className="space-y-8">
        <AreasSection
          organizacionId={organizacionId}
          areas={areas}
          error={areasError}
          onCreated={cargarAreas}
        />
        <UbicacionesSection
          organizacionId={organizacionId}
          sedes={sedes}
          areas={areas}
        />
        <ResponsablesSection organizacionId={organizacionId} areas={areas} />
      </div>
    </div>
  );
}

function AreasSection({
  organizacionId,
  areas,
  error,
  onCreated,
}: {
  organizacionId: string;
  areas: Area[] | null;
  error: string | null;
  onCreated: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaAreaForm>({ resolver: zodResolver(altaAreaSchema) });

  async function onSubmit(values: AltaAreaForm) {
    setSubmitError(null);
    try {
      await cisClient.altaArea({
        organizacionId,
        codigo: values.codigo,
        nombre: values.nombre,
        dependencia: values.dependencia || undefined,
        centroCosto: values.centroCosto || undefined,
      });
      reset();
      onCreated();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof CisApiError && err.status === 403
          ? 'No tenés el rol administrador-patrimonial en esta organización.'
          : err instanceof Error
            ? err.message
            : 'Error desconocido',
      );
    }
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="mb-4 text-lg font-medium text-text">Áreas</h2>
        {error && <Alert>{error}</Alert>}
        {!error && !areas && <p className="text-text-dim">Cargando…</p>}
        {areas?.length === 0 && <p className="text-text-dim">Sin áreas todavía.</p>}
        {areas && areas.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Código</th>
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Dependencia</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => (
                  <tr key={area.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{area.codigo}</td>
                    <td className="px-4 py-2">{area.nombre}</td>
                    <td className="px-4 py-2 text-text-dim">{area.dependencia ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Card className="h-fit">
        <h3 className="mb-4 font-medium text-text">Alta de área</h3>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div>
            <Label htmlFor="area-codigo">Código</Label>
            <Input id="area-codigo" {...register('codigo')} />
            <FieldError>{errors.codigo?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="area-nombre">Nombre</Label>
            <Input id="area-nombre" {...register('nombre')} />
            <FieldError>{errors.nombre?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="area-dependencia">Dependencia (opcional)</Label>
            <Input id="area-dependencia" {...register('dependencia')} />
          </div>
          <div>
            <Label htmlFor="area-centroCosto">Centro de costo (opcional)</Label>
            <Input id="area-centroCosto" {...register('centroCosto')} />
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creando…' : 'Crear área'}
          </Button>
        </form>
      </Card>
    </section>
  );
}

function UbicacionesSection({
  organizacionId,
  sedes,
  areas,
}: {
  organizacionId: string;
  sedes: Sede[] | null;
  areas: Area[] | null;
}) {
  const [sedeId, setSedeId] = useState('');
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<AltaUbicacionForm>({ resolver: zodResolver(altaUbicacionSchema) });

  useEffect(() => {
    if (!sedeId && sedes && sedes.length > 0) setSedeId(sedes[0].id);
  }, [sedes, sedeId]);

  function cargarUbicaciones(sede: string) {
    setListError(null);
    cisClient
      .getUbicaciones(sede)
      .then(setUbicaciones)
      .catch((err: unknown) => {
        setListError(err instanceof Error ? err.message : 'Error desconocido');
      });
  }

  useEffect(() => {
    if (sedeId) cargarUbicaciones(sedeId);
  }, [sedeId]);

  async function onSubmit(values: AltaUbicacionForm) {
    setSubmitError(null);
    try {
      await cisClient.altaUbicacion({
        organizacionId,
        sedeId: values.sedeId,
        edificio: values.edificio || undefined,
        piso: values.piso || undefined,
        areaId: values.areaId || undefined,
        oficina: values.oficina || undefined,
      });
      reset({ sedeId: values.sedeId });
      cargarUbicaciones(values.sedeId);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof CisApiError && err.status === 403
          ? 'No tenés el rol administrador-patrimonial en esta organización.'
          : err instanceof Error
            ? err.message
            : 'Error desconocido',
      );
    }
  }

  if (sedes && sedes.length === 0) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-medium text-text">Ubicaciones</h2>
        <p className="text-text-dim">Esta organización no tiene sedes contratadas.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="mb-4 text-lg font-medium text-text">Ubicaciones</h2>
        <div className="mb-4">
          <Label htmlFor="ubicacion-sede">Sede</Label>
          <select
            id="ubicacion-sede"
            value={sedeId}
            onChange={(e) => setSedeId(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text focus:border-accent"
          >
            {sedes?.map((sede) => (
              <option key={sede.id} value={sede.id}>
                {sede.nombre}
              </option>
            ))}
          </select>
        </div>
        {listError && <Alert>{listError}</Alert>}
        {!listError && !ubicaciones && <p className="text-text-dim">Cargando…</p>}
        {ubicaciones?.length === 0 && (
          <p className="text-text-dim">Sin ubicaciones en esta sede todavía.</p>
        )}
        {ubicaciones && ubicaciones.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Edificio</th>
                  <th className="px-4 py-2 font-medium">Piso</th>
                  <th className="px-4 py-2 font-medium">Oficina</th>
                  <th className="px-4 py-2 font-medium">Área</th>
                </tr>
              </thead>
              <tbody>
                {ubicaciones.map((ubicacion) => (
                  <tr key={ubicacion.id} className="border-t border-border">
                    <td className="px-4 py-2">{ubicacion.edificio ?? '—'}</td>
                    <td className="px-4 py-2">{ubicacion.piso ?? '—'}</td>
                    <td className="px-4 py-2">{ubicacion.oficina ?? '—'}</td>
                    <td className="px-4 py-2 text-text-dim">{ubicacion.areaId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Card className="h-fit">
        <h3 className="mb-4 font-medium text-text">Alta de ubicación</h3>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <input type="hidden" value={sedeId} {...register('sedeId')} />
          <div>
            <Label htmlFor="ubicacion-edificio">Edificio (opcional)</Label>
            <Input id="ubicacion-edificio" {...register('edificio')} />
          </div>
          <div>
            <Label htmlFor="ubicacion-piso">Piso (opcional)</Label>
            <Input id="ubicacion-piso" {...register('piso')} />
          </div>
          <div>
            <Label htmlFor="ubicacion-oficina">Oficina (opcional)</Label>
            <Input id="ubicacion-oficina" {...register('oficina')} />
          </div>
          <div>
            <Label htmlFor="ubicacion-area">Área (id, opcional)</Label>
            <Input
              id="ubicacion-area"
              list="areas-datalist"
              {...register('areaId')}
            />
            <datalist id="areas-datalist">
              {areas?.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.nombre}
                </option>
              ))}
            </datalist>
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          <Button type="submit" disabled={isSubmitting || !sedeId} className="w-full">
            {isSubmitting ? 'Creando…' : 'Crear ubicación'}
          </Button>
        </form>
      </Card>
    </section>
  );
}

function ResponsablesSection({
  organizacionId,
  areas,
}: {
  organizacionId: string;
  areas: Area[] | null;
}) {
  const [areaId, setAreaId] = useState('');
  const [responsables, setResponsables] = useState<Responsable[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaResponsableForm>({ resolver: zodResolver(altaResponsableSchema) });

  useEffect(() => {
    if (!areaId && areas && areas.length > 0) setAreaId(areas[0].id);
  }, [areas, areaId]);

  function cargarResponsables(area: string) {
    setListError(null);
    cisClient
      .getResponsables(area)
      .then(setResponsables)
      .catch((err: unknown) => {
        setListError(err instanceof Error ? err.message : 'Error desconocido');
      });
  }

  useEffect(() => {
    if (areaId) cargarResponsables(areaId);
  }, [areaId]);

  async function onSubmit(values: AltaResponsableForm) {
    setSubmitError(null);
    try {
      await cisClient.altaResponsable({
        organizacionId,
        identificacion: values.identificacion,
        nombre: values.nombre,
        cargo: values.cargo || undefined,
        areaId: values.areaId,
        correo: values.correo || undefined,
        telefono: values.telefono || undefined,
      });
      reset({ areaId: values.areaId });
      cargarResponsables(values.areaId);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof CisApiError && err.status === 409
          ? 'Ya existe un responsable con esa identificación.'
          : err instanceof CisApiError && err.status === 403
            ? 'No tenés el rol administrador-patrimonial en esta organización.'
            : err instanceof Error
              ? err.message
              : 'Error desconocido',
      );
    }
  }

  async function darDeBaja(responsable: Responsable) {
    const nuevoEstado = responsable.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      await cisClient.actualizarEstadoResponsable(
        responsable.id,
        organizacionId,
        nuevoEstado,
      );
      cargarResponsables(responsable.areaId);
    } catch {
      // El listado no cambia si falla — el usuario ve el estado anterior, sin efecto fantasma.
    }
  }

  if (areas && areas.length === 0) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-medium text-text">Responsables</h2>
        <p className="text-text-dim">Creá un área primero — un responsable siempre pertenece a una.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h2 className="mb-4 text-lg font-medium text-text">Responsables</h2>
        <div className="mb-4">
          <Label htmlFor="responsable-area">Área</Label>
          <select
            id="responsable-area"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-raised px-3 py-2 text-sm text-text focus:border-accent"
          >
            {areas?.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nombre}
              </option>
            ))}
          </select>
        </div>
        {listError && <Alert>{listError}</Alert>}
        {!listError && !responsables && <p className="text-text-dim">Cargando…</p>}
        {responsables?.length === 0 && (
          <p className="text-text-dim">Sin responsables en esta área todavía.</p>
        )}
        {responsables && responsables.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Identificación</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {responsables.map((responsable) => (
                  <tr key={responsable.id} className="border-t border-border">
                    <td className="px-4 py-2">{responsable.nombre}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {responsable.identificacion}
                    </td>
                    <td className="px-4 py-2">
                      <Badge>{responsable.estado}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" onClick={() => void darDeBaja(responsable)}>
                        {responsable.estado === 'activo' ? 'Dar de baja' : 'Reactivar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Card className="h-fit">
        <h3 className="mb-4 font-medium text-text">Alta de responsable</h3>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <input type="hidden" value={areaId} {...register('areaId')} />
          <div>
            <Label htmlFor="responsable-identificacion">Identificación</Label>
            <Input id="responsable-identificacion" {...register('identificacion')} />
            <FieldError>{errors.identificacion?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="responsable-nombre">Nombre</Label>
            <Input id="responsable-nombre" {...register('nombre')} />
            <FieldError>{errors.nombre?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="responsable-cargo">Cargo (opcional)</Label>
            <Input id="responsable-cargo" {...register('cargo')} />
          </div>
          <div>
            <Label htmlFor="responsable-correo">Correo (opcional)</Label>
            <Input id="responsable-correo" type="email" {...register('correo')} />
            <FieldError>{errors.correo?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="responsable-telefono">Teléfono (opcional)</Label>
            <Input id="responsable-telefono" {...register('telefono')} />
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          <Button type="submit" disabled={isSubmitting || !areaId} className="w-full">
            {isSubmitting ? 'Creando…' : 'Crear responsable'}
          </Button>
        </form>
      </Card>
    </section>
  );
}
