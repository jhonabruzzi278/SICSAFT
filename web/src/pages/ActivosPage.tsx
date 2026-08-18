import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cisClient, CisApiError, type ActivoCatalogo } from '@/lib/cis-client';
import { Alert, Button, Card, FieldError, Input, Label } from '@/components/ui';

// RF-03 — módulo Activos: consulta (GET /catalogo, ya existía) + alta (POST /admin/activos,
// nuevo en Fase 5/DOC-012). RF-08: el alta debe hacerse visible en el mismo catálogo que consume
// APP QR — por eso la lista se recarga después de un alta exitosa, contra el mismo endpoint.

const altaSchema = z.object({
  codigoPatrimonial: z.string().min(1, 'Requerido'),
  codigoQr: z.string().min(1, 'Requerido'),
  // Sin endpoint de lectura de catalogo_activos todavía (DOC-013 3 lo deja como gap conocido) —
  // se escribe el id a mano; los ids del seed de desarrollo son 'catalogo-notebook' y
  // 'catalogo-proyector' (ver core/migrations/..._seed-dev-fixture-patrimonial.ts).
  catalogoId: z.string().min(1, 'Requerido'),
  serie: z.string().optional(),
  areaId: z.string().optional(),
  ubicacionId: z.string().optional(),
});
type AltaForm = z.infer<typeof altaSchema>;

export function ActivosPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [activos, setActivos] = useState<ActivoCatalogo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaForm>({ resolver: zodResolver(altaSchema) });

  function cargarCatalogo() {
    setListError(null);
    cisClient
      .getCatalogo(organizacionId)
      .then(setActivos)
      .catch((err: unknown) => {
        setListError(err instanceof Error ? err.message : 'Error desconocido');
      });
  }

  useEffect(() => {
    if (organizacionId) cargarCatalogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargarCatalogo se recrea cada render a proposito (usa organizacionId del closure)
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
      });
      setSubmitOk(true);
      reset();
      cargarCatalogo();
    } catch (err: unknown) {
      if (err instanceof CisApiError && err.status === 403) {
        setSubmitError('No tenés el rol administrador-patrimonial en esta organización.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Error desconocido');
      }
    }
  }

  if (!organizacionId) {
    return <Alert>Falta organizacionId — volvé al hub y elegí una organización.</Alert>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-accent-strong">Activos</h1>
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
                </tr>
              </thead>
              <tbody>
                {activos.map((activo) => (
                  <tr key={activo.codigoQr} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{activo.codigoQr}</td>
                    <td className="px-4 py-2">{activo.nombre}</td>
                    <td className="px-4 py-2">{activo.areaId}</td>
                    <td className="px-4 py-2">{activo.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Card className="h-fit">
        <h2 className="mb-4 font-medium text-text">Alta de activo</h2>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div>
            <Label htmlFor="codigoPatrimonial">Código patrimonial</Label>
            <Input id="codigoPatrimonial" {...register('codigoPatrimonial')} />
            <FieldError>{errors.codigoPatrimonial?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="codigoQr">Código QR</Label>
            <Input id="codigoQr" {...register('codigoQr')} />
            <FieldError>{errors.codigoQr?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="catalogoId">Catálogo (id)</Label>
            <Input id="catalogoId" placeholder="catalogo-notebook" {...register('catalogoId')} />
            <FieldError>{errors.catalogoId?.message}</FieldError>
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

          {submitError && <Alert>{submitError}</Alert>}
          {submitOk && <Alert variant="success">Activo creado.</Alert>}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creando…' : 'Crear activo'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
