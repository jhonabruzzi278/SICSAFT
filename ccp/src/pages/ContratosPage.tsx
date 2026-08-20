import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  cisClient,
  CisApiError,
  TRANSICIONES_VALIDAS_CONTRATO,
  type Contrato,
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

// RF-07 — módulo Contratos: primer cliente que escribe la tabla `contratos` (antes solo se leía,
// DOC-004 7). Mismo patrón que ActivosPage: tabla de lectura (GET /admin/contratos, nuevo en
// este incremento) + formulario de alta, más botones de transición de estado por fila
// (PATCH /admin/contratos/:id) — solo se ofrecen las transiciones válidas de DOC-004 3
// (`TRANSICIONES_VALIDAS_CONTRATO`), la validación real siempre vuelve a correr en CORE.

const altaSchema = z.object({
  sedeIds: z.string().min(1, 'Requerido — ids separados por coma'),
  vigenciaDesde: z.string().min(1, 'Requerido'),
  vigenciaHasta: z.string().optional(),
});
type AltaForm = z.infer<typeof altaSchema>;

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL');
}

export function ContratosPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AltaForm>({ resolver: zodResolver(altaSchema) });

  function cargarContratos() {
    setListError(null);
    cisClient
      .getContratos()
      .then((todos) =>
        setContratos(todos.filter((c) => c.organizacionId === organizacionId)),
      )
      .catch((err: unknown) => {
        setListError(err instanceof Error ? err.message : 'Error desconocido');
      });
  }

  useEffect(() => {
    if (organizacionId) cargarContratos();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargarContratos se recrea cada render a proposito (usa organizacionId del closure)
  }, [organizacionId]);

  async function onSubmit(values: AltaForm) {
    setSubmitError(null);
    setSubmitOk(false);
    try {
      await cisClient.altaContrato({
        organizacionId,
        sedeIds: values.sedeIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        vigenciaDesde: new Date(values.vigenciaDesde).toISOString(),
        vigenciaHasta: values.vigenciaHasta
          ? new Date(values.vigenciaHasta).toISOString()
          : undefined,
        modulosContratados: ['inventario-qr'],
      });
      setSubmitOk(true);
      reset();
      cargarContratos();
    } catch (err: unknown) {
      setSubmitError(mensajeError(err));
    }
  }

  async function cambiarEstado(contratoId: string, estado: string) {
    setActionError(null);
    setPendingId(contratoId);
    try {
      await cisClient.actualizarEstadoContrato(
        contratoId,
        organizacionId,
        estado,
      );
      cargarContratos();
    } catch (err: unknown) {
      setActionError(mensajeError(err));
    } finally {
      setPendingId(null);
    }
  }

  function mensajeError(err: unknown): string {
    if (err instanceof CisApiError && err.status === 403) {
      return 'No tenés el rol administrador-patrimonial en esta organización.';
    }
    return err instanceof Error ? err.message : 'Error desconocido';
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
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-accent-strong">
          Contratos
        </h1>
        {listError && <Alert>{listError}</Alert>}
        {actionError && <Alert>{actionError}</Alert>}
        {!listError && !contratos && <p className="text-text-dim">Cargando…</p>}
        {contratos?.length === 0 && (
          <p className="text-text-dim">
            Sin contratos en esta organización todavía.
          </p>
        )}
        {contratos && contratos.length > 0 && (
          <div className="space-y-3">
            {contratos.map((contrato) => (
              <Card key={contrato.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-text">
                      {contrato.sedes.map((s) => s.nombre).join(', ') ||
                        'Sin sedes'}
                    </p>
                    <p className="mt-1 text-sm text-text-dim">
                      {formatFecha(contrato.vigenciaDesde)} —{' '}
                      {formatFecha(contrato.vigenciaHasta)}
                    </p>
                  </div>
                  <Badge>{contrato.estado}</Badge>
                </div>
                {TRANSICIONES_VALIDAS_CONTRATO[contrato.estado]?.length > 0 && (
                  <div className="mt-4 flex gap-2">
                    {TRANSICIONES_VALIDAS_CONTRATO[contrato.estado].map(
                      (destino) => (
                        <Button
                          key={destino}
                          variant="secondary"
                          disabled={pendingId === contrato.id}
                          onClick={() =>
                            void cambiarEstado(contrato.id, destino)
                          }
                        >
                          {pendingId === contrato.id
                            ? 'Actualizando…'
                            : `→ ${destino}`}
                        </Button>
                      ),
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="h-fit">
        <h2 className="mb-4 font-medium text-text">Alta de contrato</h2>
        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="sedeIds">Sedes (ids separados por coma)</Label>
            <Input
              id="sedeIds"
              placeholder="melipilla, santiago"
              {...register('sedeIds')}
            />
            <FieldError>{errors.sedeIds?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="vigenciaDesde">Vigencia desde</Label>
            <Input
              id="vigenciaDesde"
              type="date"
              {...register('vigenciaDesde')}
            />
            <FieldError>{errors.vigenciaDesde?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="vigenciaHasta">Vigencia hasta (opcional)</Label>
            <Input
              id="vigenciaHasta"
              type="date"
              {...register('vigenciaHasta')}
            />
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
