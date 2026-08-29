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
    <WizardCard
      paso={1}
      titulo="Datos de esta instalación"
      subtitulo="Se usan para crear el realm de identidad y la organización del cliente."
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
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Configurando…" : "Continuar"}
        </Button>
      </form>
    </WizardCard>
  );
}
