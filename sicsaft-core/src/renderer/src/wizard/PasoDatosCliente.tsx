import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BootstrapClienteResultado } from "@shared/ipc-contract";
import { slugificar } from "@shared/slugificar";

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
});
type FormValues = z.infer<typeof schema>;

export function PasoDatosCliente({
  onListo,
}: {
  onListo: (resultado: BootstrapClienteResultado) => void;
}) {
  const [error, setError] = useState<string | null>(null);
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
        nivel: 1,
      });
      onListo(resultado);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="w-full max-w-sm space-y-4"
    >
      <h2 className="text-lg font-medium text-foreground">
        Datos de esta instalación
      </h2>
      <div>
        <label
          htmlFor="clienteNombre"
          className="text-sm text-[var(--muted-foreground)]"
        >
          Nombre del cliente
        </label>
        <input
          id="clienteNombre"
          className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-card px-3 py-2 text-card-foreground"
          {...register("clienteNombre", {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setValue("organizacionId", slugificar(e.target.value)),
          })}
        />
        {errors.clienteNombre && (
          <p className="mt-1 text-xs text-[var(--destructive)]">
            {errors.clienteNombre.message}
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor="organizacionId"
          className="text-sm text-[var(--muted-foreground)]"
        >
          Identificador
        </label>
        <input
          id="organizacionId"
          className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-card px-3 py-2 text-card-foreground"
          {...register("organizacionId")}
        />
        {errors.organizacionId && (
          <p className="mt-1 text-xs text-[var(--destructive)]">
            {errors.organizacionId.message}
          </p>
        )}
      </div>
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 font-medium text-background disabled:opacity-50"
      >
        {isSubmitting ? "Configurando…" : "Continuar"}
      </button>
    </form>
  );
}
