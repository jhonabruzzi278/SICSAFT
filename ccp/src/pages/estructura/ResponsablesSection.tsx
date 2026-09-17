import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  cisClient,
  CisApiError,
  type Area,
  type Responsable,
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
import { altaResponsableSchema, type AltaResponsableForm } from './schemas';

export function ResponsablesSection({
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
  } = useForm<AltaResponsableForm>({
    resolver: zodResolver(altaResponsableSchema),
  });

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
        <p className="text-text-dim">
          Creá un área primero — un responsable siempre pertenece a una.
        </p>
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
        {!listError && !responsables && (
          <p className="text-text-dim">Cargando…</p>
        )}
        {responsables?.length === 0 && (
          <p className="text-text-dim">
            Sin responsables en esta área todavía.
          </p>
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
                      <Button
                        variant="ghost"
                        onClick={() => void darDeBaja(responsable)}
                      >
                        {responsable.estado === 'activo'
                          ? 'Dar de baja'
                          : 'Reactivar'}
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
        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
        >
          <input type="hidden" value={areaId} {...register('areaId')} />
          <div>
            <Label htmlFor="responsable-identificacion">Identificación</Label>
            <Input
              id="responsable-identificacion"
              {...register('identificacion')}
            />
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
            <Input
              id="responsable-correo"
              type="email"
              {...register('correo')}
            />
            <FieldError>{errors.correo?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="responsable-telefono">Teléfono (opcional)</Label>
            <Input id="responsable-telefono" {...register('telefono')} />
          </div>
          {submitError && <Alert>{submitError}</Alert>}
          <Button
            type="submit"
            disabled={isSubmitting || !areaId}
            className="w-full"
          >
            {isSubmitting ? 'Creando…' : 'Crear responsable'}
          </Button>
        </form>
      </Card>
    </section>
  );
}
