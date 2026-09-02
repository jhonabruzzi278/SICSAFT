import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BootstrapClienteResultado } from "@shared/ipc-contract";
import { slugificar } from "@shared/slugificar";
import { WizardCard } from "../components/WizardCard";
import { Field } from "../components/Field";
import { Button } from "../components/Button";

// Equivalente al -ClienteNombre/-OrganizacionId/-Nivel de
// devops/onprem/instalar-cliente.ps1/bootstrap-keycloak.ps1 -- acá lo completa el vendedor desde
// un formulario en vez de flags de PowerShell. organizacionId se deriva del nombre (mismo criterio
// que New-DominioDesdeNombre en instalar-cliente.ps1: slug DNS-safe), pero editable a mano por si
// el vendedor prefiere un id específico.
const schema = z.object({
  clienteNombre: z.string().min(2, "Ingresá el nombre del cliente"),
  organizacionId: z
    .string()
    .min(2, "Ingresá un identificador")
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  // DOC-028 Fase B.2 — el contrato de CORE necesita al menos una sede.
  sedePrincipalNombre: z
    .string()
    .min(2, "Ingresá el nombre de la sede principal"),
});
type FormValues = z.infer<typeof schema>;

export function PasoDatosCliente({
  onListo,
}: {
  onListo: (resultado: BootstrapClienteResultado) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // DOC-030 — nivel de producto contratado (DOC-025). Antes se horneaba `1`; ahora lo elige el
  // vendedor según el contrato. Toggle de dos opciones fijas -> `useState` tipado en vez de zod
  // (no puede quedar inválido). Se persiste en instalacion.json y el .exe lo inyecta al servir
  // `ccp` (VITE_SICSAFT_NIVEL): en Nivel 2 el CCP muestra Estructura y el alta manual de Activos.
  const [nivel, setNivel] = useState<1 | 2>(1);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const resultado = await window.sicsaftCore.bootstrapCliente({
        ...values,
        nivel,
      });
      onListo(resultado);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  return (
    <WizardCard
      paso={1}
      titulo="Datos de esta instalación"
      subtitulo="Crean el realm de identidad y la organización + contrato del cliente en la Base Patrimonial."
    >
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4"
      >
        <Field
          id="clienteNombre"
          label="Nombre del cliente"
          placeholder="Municipalidad de Melipilla"
          error={errors.clienteNombre?.message}
          {...register("clienteNombre", {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setValue("organizacionId", slugificar(e.target.value)),
          })}
        />
        <Field
          id="organizacionId"
          label="Identificador"
          placeholder="municipalidad-melipilla"
          hint="Se autocompleta desde el nombre. Solo minúsculas, números y guiones."
          error={errors.organizacionId?.message}
          {...register("organizacionId")}
        />
        <Field
          id="sedePrincipalNombre"
          label="Sede principal"
          placeholder="Casa Central"
          hint="El contrato cubre esta sede. Podés agregar más después desde el portal."
          error={errors.sedePrincipalNombre?.message}
          {...register("sedePrincipalNombre")}
        />
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-foreground">
            Nivel contratado
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                valor: 1 as const,
                titulo: "Nivel 1",
                detalle: "APP QR + consulta e inventarios",
              },
              {
                valor: 2 as const,
                titulo: "Nivel 2",
                detalle: "+ gestión avanzada (Estructura, alta de Activos)",
              },
            ].map(({ valor, titulo, detalle }) => (
              <label
                key={valor}
                className={
                  "flex cursor-pointer flex-col gap-0.5 rounded-[var(--radius)] border px-3 py-2 transition-colors " +
                  (nivel === valor
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 "
                    : "border-[var(--border)] hover:border-[var(--primary)]/50 ")
                }
              >
                <span className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                  <input
                    type="radio"
                    name="nivel"
                    value={valor}
                    checked={nivel === valor}
                    onChange={() => setNivel(valor)}
                    className="accent-[var(--primary)]"
                  />
                  {titulo}
                </span>
                <span className="text-xs text-[var(--faint-foreground)]">
                  {detalle}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Configurando…" : "Continuar"}
        </Button>
      </form>
    </WizardCard>
  );
}
