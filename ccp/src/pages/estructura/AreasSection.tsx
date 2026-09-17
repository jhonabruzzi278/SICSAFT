import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cisClient, CisApiError, type Area } from '@/lib/cis-client';
import { Alert, Button, Card, FieldError, Input, Label } from '@/components/ui';
import { EditFormFooter } from './EditFormFooter';
import {
  altaAreaSchema,
  actualizarAreaSchema,
  type AltaAreaForm,
  type ActualizarAreaForm,
} from './schemas';

// RF-05 — módulo "Organización": ABM de Áreas. La sección de Ubicaciones que vivía en esta
// pantalla se quitó (2026-09-13) — el backend de Ubicacion sigue existiendo
// (`UbicacionRepository` en CORE sigue resolviendo/creando la ubicación placeholder que necesita
// todo activo importado, ver `ubicacion.repository.ts` `resolverPorArea`), pero ya no tiene ABM
// propio en el CCP.
export function AreasSection({
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
  const [editando, setEditando] = useState<Area | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaAreaForm>({ resolver: zodResolver(altaAreaSchema) });
  const {
    register: registerEdicion,
    handleSubmit: handleSubmitEdicion,
    reset: resetEdicion,
    formState: { isSubmitting: isEditSubmitting },
  } = useForm<ActualizarAreaForm>({
    resolver: zodResolver(actualizarAreaSchema),
  });

  async function onSubmit(values: AltaAreaForm) {
    setSubmitError(null);
    try {
      await cisClient.altaArea({
        organizacionId,
        codigo: values.codigo,
        nombre: values.nombre,
        dependencia: values.dependencia || undefined,
        departamento: values.departamento || undefined,
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

  function editar(area: Area) {
    setEditError(null);
    setEditando(area);
    resetEdicion({
      codigo: area.codigo,
      nombre: area.nombre,
      dependencia: area.dependencia ?? '',
      departamento: area.departamento ?? '',
      centroCosto: area.centroCosto ?? '',
      responsableId: area.responsableId ?? '',
      ubicacionPrincipalId: area.ubicacionPrincipalId ?? '',
    });
  }

  async function onSubmitEdicion(values: ActualizarAreaForm) {
    if (!editando) return;
    setEditError(null);
    try {
      await cisClient.actualizarArea(editando.id, {
        organizacionId,
        codigo: values.codigo || undefined,
        nombre: values.nombre || undefined,
        dependencia: values.dependencia || undefined,
        departamento: values.departamento || undefined,
        centroCosto: values.centroCosto || undefined,
        responsableId: values.responsableId || undefined,
        ubicacionPrincipalId: values.ubicacionPrincipalId || undefined,
      });
      setEditando(null);
      onCreated();
    } catch (err: unknown) {
      setEditError(
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
        {areas?.length === 0 && (
          <p className="text-text-dim">Sin áreas todavía.</p>
        )}
        {areas && areas.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-raised text-text-dim">
                <tr>
                  <th className="px-4 py-2 font-medium">Código</th>
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Dirección</th>
                  <th className="px-4 py-2 font-medium">Departamento</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => (
                  <tr key={area.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">
                      {area.codigo}
                    </td>
                    <td className="px-4 py-2">{area.nombre}</td>
                    <td className="px-4 py-2 text-text-dim">
                      {area.dependencia ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-text-dim">
                      {area.departamento ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" onClick={() => editar(area)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando ? (
        <Card className="h-fit">
          <h3 className="mb-4 font-medium text-text">
            Editar área — {editando.codigo}
          </h3>
          <form
            onSubmit={(e) => void handleSubmitEdicion(onSubmitEdicion)(e)}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="area-edit-codigo">Código</Label>
              <Input id="area-edit-codigo" {...registerEdicion('codigo')} />
            </div>
            <div>
              <Label htmlFor="area-edit-nombre">Nombre</Label>
              <Input id="area-edit-nombre" {...registerEdicion('nombre')} />
            </div>
            <div>
              <Label htmlFor="area-edit-dependencia">Dirección</Label>
              <Input
                id="area-edit-dependencia"
                {...registerEdicion('dependencia')}
              />
            </div>
            <div>
              <Label htmlFor="area-edit-departamento">Departamento</Label>
              <Input
                id="area-edit-departamento"
                {...registerEdicion('departamento')}
              />
            </div>
            <div>
              <Label htmlFor="area-edit-centroCosto">Centro de costo</Label>
              <Input
                id="area-edit-centroCosto"
                {...registerEdicion('centroCosto')}
              />
            </div>
            <div>
              <Label htmlFor="area-edit-responsableId">Responsable (id)</Label>
              <Input
                id="area-edit-responsableId"
                {...registerEdicion('responsableId')}
              />
            </div>
            <div>
              <Label htmlFor="area-edit-ubicacionPrincipalId">
                Ubicación principal (id)
              </Label>
              <Input
                id="area-edit-ubicacionPrincipalId"
                {...registerEdicion('ubicacionPrincipalId')}
              />
            </div>
            <EditFormFooter
              error={editError}
              isSubmitting={isEditSubmitting}
              onCancel={() => setEditando(null)}
            />
          </form>
        </Card>
      ) : (
        <Card className="h-fit">
          <h3 className="mb-4 font-medium text-text">Alta de área</h3>
          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="space-y-4"
          >
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
              <Label htmlFor="area-dependencia">Dirección (opcional)</Label>
              <Input id="area-dependencia" {...register('dependencia')} />
            </div>
            <div>
              <Label htmlFor="area-departamento">Departamento (opcional)</Label>
              <Input id="area-departamento" {...register('departamento')} />
            </div>
            <div>
              <Label htmlFor="area-centroCosto">
                Centro de costo (opcional)
              </Label>
              <Input id="area-centroCosto" {...register('centroCosto')} />
            </div>
            {submitError && <Alert>{submitError}</Alert>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creando…' : 'Crear área'}
            </Button>
          </form>
        </Card>
      )}
    </section>
  );
}
