import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  cisClient,
  CisApiError,
  type Area,
  type Responsable,
} from '@/lib/cis-client';
// Antes vivían en lib/etiquetas.ts (compartidas con la hoja de etiquetas QR) — ese módulo se
// extrajo del CCP en la Fase 5 de la reestructuración CCP/CIP (2026-09-13, ver
// herramientas/generador-qr/), así que quedan acá como constantes locales, únicas usuarias ahora.
const SIN_DIRECCION = 'Sin dirección';
const SIN_DEPARTAMENTO = 'Sin departamento';
import {
  Alert,
  Badge,
  Button,
  Card,
  FieldError,
  Input,
  Label,
} from '@/components/ui';
import { EditFormFooter } from '@/pages/estructura/EditFormFooter';

// RF-05 — módulo "Organización": Organigrama (Dirección→Departamento→Área) + rollup de
// Direcciones + ABM de Áreas y Responsables. La sección de Ubicaciones que vivía acá se quitó de
// esta pantalla (2026-09-13) — el backend de Ubicacion sigue existiendo (UbicacionRepository en
// CORE sigue resolviendo/creando la ubicación placeholder que necesita todo activo importado,
// ver `ubicacion.repository.ts` `resolverPorArea`), pero ya no tiene ABM propio en el CCP.

const altaAreaSchema = z.object({
  codigo: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
  dependencia: z.string().optional(),
  departamento: z.string().optional(),
  centroCosto: z.string().optional(),
});
type AltaAreaForm = z.infer<typeof altaAreaSchema>;

// RF-05 (cierra el gap "ABM completo") — edición de Área, incluida la asignación de
// responsableId/ubicacionPrincipalId (DOC-005 2, el ciclo que el alta dejaba abierto a propósito).
// Ids en texto libre — esta sección no tiene cargada la lista de Responsables de la otra sección
// (vive con su propio scope de área), agregar un selector cruzado es más alcance del que este
// incremento necesita.
const actualizarAreaSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().optional(),
  dependencia: z.string().optional(),
  departamento: z.string().optional(),
  centroCosto: z.string().optional(),
  responsableId: z.string().optional(),
  ubicacionPrincipalId: z.string().optional(),
});
type ActualizarAreaForm = z.infer<typeof actualizarAreaSchema>;

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
  // DOC-033 — nombre real de la organización para el encabezado de la jerarquía
  // Organización→Dirección→Departamento→Área (siempre "lo más arriba", ver diseño). Antes se
  // descartaba, este mismo `authSession()` ya lo trae.
  const [organizacionNombre, setOrganizacionNombre] = useState('');

  useEffect(() => {
    if (!organizacionId) return;
    cisClient
      .authSession()
      .then((res) => {
        const org = res.organizaciones.find((o) => o.id === organizacionId);
        setOrganizacionNombre(org?.nombre ?? '');
      })
      .catch(() => {
        // Sin nombre de organización el encabezado del organigrama cae al fallback genérico
        // ("Organización") — no es un error que el operador necesite ver.
      });
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
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-accent-strong">
        Organización
      </h1>
      <p className="mb-6 text-sm text-text-dim">
        Organigrama, direcciones, áreas y responsables.
      </p>
      <div className="space-y-8">
        <JerarquiaSection
          organizacionNombre={organizacionNombre}
          areas={areas}
        />
        <DireccionesSection areas={areas} />
        <AreasSection
          organizacionId={organizacionId}
          areas={areas}
          error={areasError}
          onCreated={cargarAreas}
        />
        <ResponsablesSection organizacionId={organizacionId} areas={areas} />
      </div>
    </div>
  );
}

// Acento por dirección — mismo criterio que la paleta de categorías del Resumen Ejecutivo (CIP):
// un color fijo por posición, no por hash del nombre, para que el orden alfabético ya estable de
// `porDireccion` alcance para que el color de una dirección no salte de sesión a sesión. "Sin
// dirección" no entra en el ciclo — se distingue con un estilo neutro/punteado a propósito, ver
// abajo.
const ACENTO_DIRECCION = [
  { borde: 'border-l-blue-500', punto: 'bg-blue-500', texto: 'text-blue-400' },
  {
    borde: 'border-l-emerald-500',
    punto: 'bg-emerald-500',
    texto: 'text-emerald-400',
  },
  {
    borde: 'border-l-amber-500',
    punto: 'bg-amber-500',
    texto: 'text-amber-400',
  },
  {
    borde: 'border-l-purple-500',
    punto: 'bg-purple-500',
    texto: 'text-purple-400',
  },
  { borde: 'border-l-sky-500', punto: 'bg-sky-500', texto: 'text-sky-400' },
] as const;

// DOC-033 — organigrama Organización→Dirección→Departamento→Área sobre los mismos datos que la
// tabla plana de abajo (ningún endpoint nuevo). "Dirección" es `area.dependencia` y
// "Departamento" es `area.departamento`, ambos texto libre, ingresados por el Profesional de AFT
// vía las columnas DIRECCION/DEPARTAMENTO del Excel de carga masiva — mismo criterio y misma
// etiqueta de "sin …" que ya usa la hoja de etiquetas (DOC-029 RF-F, ver lib/etiquetas.ts), para
// no inventar una segunda convención para el mismo concepto. Tarjetas en vez de un diagrama de
// cajas-y-líneas a propósito: con datos reales (decenas de áreas, nombres largos) un layout de
// líneas conectoras se rompe o necesita una librería nueva; una tarjeta por dirección escala mejor
// (wrap/scroll) y sigue el mismo lenguaje visual que el resto del portal (Card + acento de color).
function JerarquiaSection({
  organizacionNombre,
  areas,
}: {
  organizacionNombre: string;
  areas: Area[] | null;
}) {
  const porDireccion = useMemo(() => {
    const grupos = new Map<string, Area[]>();
    for (const area of areas ?? []) {
      const direccion = area.dependencia?.trim() || SIN_DIRECCION;
      const lista = grupos.get(direccion) ?? [];
      lista.push(area);
      grupos.set(direccion, lista);
    }
    return Array.from(grupos.entries())
      .sort(([a], [b]) =>
        a === SIN_DIRECCION
          ? 1
          : b === SIN_DIRECCION
            ? -1
            : a.localeCompare(b, 'es'),
      )
      .map(([direccion, areasDeDireccion]) => {
        // Solo vale la pena sub-agrupar por Departamento si alguna área de esta Dirección
        // realmente tiene uno cargado — si nadie usa el campo todavía, se ve como antes: lista
        // plana de áreas, sin un "Sin departamento" repetido en cada tarjeta.
        const usaDepartamento = areasDeDireccion.some((a) =>
          a.departamento?.trim(),
        );
        if (!usaDepartamento) {
          return { direccion, areasDeDireccion, porDepartamento: null };
        }
        const grupos = new Map<string, Area[]>();
        for (const area of areasDeDireccion) {
          const departamento = area.departamento?.trim() || SIN_DEPARTAMENTO;
          const lista = grupos.get(departamento) ?? [];
          lista.push(area);
          grupos.set(departamento, lista);
        }
        const porDepartamento = Array.from(grupos.entries()).sort(([a], [b]) =>
          a === SIN_DEPARTAMENTO
            ? 1
            : b === SIN_DEPARTAMENTO
              ? -1
              : a.localeCompare(b, 'es'),
        );
        return { direccion, areasDeDireccion, porDepartamento };
      });
  }, [areas]);

  if (!areas || areas.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2 text-xs font-bold tracking-wider text-accent-strong uppercase">
        <span>Organigrama</span>
      </div>
      <div className="workspace-card rounded-xl border border-border bg-bg-card p-6 shadow-elev-1">
        <p className="text-xl font-bold tracking-tight text-text">
          {organizacionNombre || 'Organización'}
        </p>
        <p className="mt-0.5 text-xs text-text-dim">
          {porDireccion.length}{' '}
          {porDireccion.length === 1 ? 'dirección' : 'direcciones'} ·{' '}
          {areas.length} {areas.length === 1 ? 'área' : 'áreas'} — definidas por
          el Profesional de AFT (carga desde Excel a la BPI).
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {porDireccion.map(
            ({ direccion, areasDeDireccion, porDepartamento }, i) => {
              const esSinDireccion = direccion === SIN_DIRECCION;
              const acento = ACENTO_DIRECCION[i % ACENTO_DIRECCION.length];
              return (
                <div
                  key={direccion}
                  className={`rounded-lg border border-border bg-bg-raised p-4 ${
                    esSinDireccion
                      ? 'border-dashed opacity-80'
                      : `border-l-4 ${acento.borde}`
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-semibold ${esSinDireccion ? 'text-text-dim' : 'text-text'}`}
                    >
                      {direccion}
                    </p>
                    <span className="shrink-0 rounded-full bg-bg-card px-2 py-0.5 text-[0.7rem] font-medium text-text-faint">
                      {areasDeDireccion.length}
                    </span>
                  </div>
                  {porDepartamento ? (
                    <div className="mt-3 space-y-3">
                      {porDepartamento.map(
                        ([departamento, areasDelDepartamento]) => (
                          <div key={departamento}>
                            <p className="text-[0.7rem] font-semibold tracking-wide text-text-faint uppercase">
                              {departamento}
                            </p>
                            <ul className="mt-1.5 space-y-1.5">
                              {areasDelDepartamento.map((area) => (
                                <li
                                  key={area.id}
                                  className="flex items-center gap-2 text-xs text-text-dim"
                                >
                                  {!esSinDireccion && (
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${acento.punto}`}
                                    />
                                  )}
                                  <span className="truncate">
                                    {area.nombre}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {areasDeDireccion.map((area) => (
                        <li
                          key={area.id}
                          className="flex items-center gap-2 text-xs text-text-dim"
                        >
                          {!esSinDireccion && (
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${acento.punto}`}
                            />
                          )}
                          <span className="truncate">{area.nombre}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}

// Rollup de solo-lectura pedido aparte del Organigrama: una fila por Dirección con el conteo de
// Departamentos y Áreas — mismo acento de color por índice que ya usa JerarquiaSection, para que
// el color de una Dirección sea el mismo en ambas secciones.
function DireccionesSection({ areas }: { areas: Area[] | null }) {
  const direcciones = useMemo(() => {
    const grupos = new Map<string, Area[]>();
    for (const area of areas ?? []) {
      const direccion = area.dependencia?.trim() || SIN_DIRECCION;
      const lista = grupos.get(direccion) ?? [];
      lista.push(area);
      grupos.set(direccion, lista);
    }
    return Array.from(grupos.entries())
      .sort(([a], [b]) =>
        a === SIN_DIRECCION
          ? 1
          : b === SIN_DIRECCION
            ? -1
            : a.localeCompare(b, 'es'),
      )
      .map(([direccion, areasDeDireccion]) => {
        const departamentos = new Set(
          areasDeDireccion
            .map((a) => a.departamento?.trim())
            .filter((d): d is string => Boolean(d)),
        );
        return {
          direccion,
          totalAreas: areasDeDireccion.length,
          totalDepartamentos: departamentos.size,
        };
      });
  }, [areas]);

  if (direcciones.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-text">Direcciones</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-raised text-text-dim">
            <tr>
              <th className="px-4 py-2 font-medium">Dirección</th>
              <th className="px-4 py-2 font-medium">Departamentos</th>
              <th className="px-4 py-2 font-medium">Áreas</th>
            </tr>
          </thead>
          <tbody>
            {direcciones.map(
              ({ direccion, totalAreas, totalDepartamentos }, i) => {
                const esSinDireccion = direccion === SIN_DIRECCION;
                const acento = ACENTO_DIRECCION[i % ACENTO_DIRECCION.length];
                return (
                  <tr key={direccion} className="border-t border-border">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        {!esSinDireccion && (
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${acento.punto}`}
                          />
                        )}
                        <span
                          className={
                            esSinDireccion
                              ? 'text-text-dim'
                              : 'font-medium text-text'
                          }
                        >
                          {direccion}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-text-dim">
                      {totalDepartamentos}
                    </td>
                    <td className="px-4 py-2 text-text-dim">{totalAreas}</td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </section>
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
