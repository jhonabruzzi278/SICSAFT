import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AltaDirectorResultado } from "@shared/ipc-contract";

// Paso 2 del wizard (aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Primer arranque")
// — el vendedor completa el email del Director acá mismo, en la PC del Director, y la app genera
// el password inicial (nunca lo tipea el vendedor) -- mismo mecanismo que
// KeycloakAdminService.crearUsuarioHuman ya implementado en cis/ (temporary: true, cambio
// obligatorio en el primer login), pendiente de portar acá (ver ipc/handlers.ts altaDirector).
const schema = z.object({
  email: z.string().email("Email inválido"),
});
type FormValues = z.infer<typeof schema>;

export function PasoDirector({
  onListo,
}: {
  onListo: (resultado: AltaDirectorResultado) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AltaDirectorResultado | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const res = await window.sicsaftCore.altaDirector(values);
      setResultado(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  if (resultado) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <h2 className="text-lg font-medium text-foreground">
          Director dado de alta
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Contraseña inicial — entregásela al Director, no se vuelve a mostrar:
        </p>
        <p className="rounded-[var(--radius)] border border-[var(--border)] bg-card px-4 py-3 font-mono text-lg text-card-foreground">
          {resultado.passwordInicial}
        </p>
        <button
          type="button"
          onClick={() => onListo(resultado)}
          className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 font-medium text-background"
        >
          Continuar
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="w-full max-w-sm space-y-4"
    >
      <h2 className="text-lg font-medium text-foreground">
        Datos del Director
      </h2>
      <div>
        <label
          htmlFor="email"
          className="text-sm text-[var(--muted-foreground)]"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-card px-3 py-2 text-card-foreground"
          {...register("email")}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-[var(--destructive)]">
            {errors.email.message}
          </p>
        )}
      </div>
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 font-medium text-background disabled:opacity-50"
      >
        {isSubmitting ? "Creando…" : "Dar de alta"}
      </button>
    </form>
  );
}
