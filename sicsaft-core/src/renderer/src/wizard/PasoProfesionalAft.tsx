import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AltaProfesionalAftResultado } from "@shared/ipc-contract";

// Paso 3 del wizard (aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Primer arranque") —
// designa al Profesional de AFT. Mismo mecanismo que PasoDirector: el vendedor completa el email,
// la app genera el password inicial (nunca lo tipea el vendedor) y lo muestra una sola vez. Por
// debajo llama a window.sicsaftCore.altaProfesionalAft -> crearUsuarioProfesionalAft de
// keycloak-bootstrap.ts (rol "administrador-patrimonial" en la organización creada en el paso 1,
// temporary: true). Es opcional: el Directivo también puede designarlo después desde su portal
// (core/frontend GestionarProfesionalAftPage.tsx) una vez logueado.
const schema = z.object({
  email: z.string().email("Email inválido"),
});
type FormValues = z.infer<typeof schema>;

export function PasoProfesionalAft({
  organizacionId,
  onListo,
}: {
  organizacionId: string;
  onListo: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] =
    useState<AltaProfesionalAftResultado | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const res = await window.sicsaftCore.altaProfesionalAft({
        ...values,
        organizacionId,
      });
      setResultado(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  if (resultado) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <h2 className="text-lg font-medium text-foreground">
          Profesional de AFT dado de alta
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Contraseña inicial — entregásela al Profesional de AFT, no se vuelve a
          mostrar:
        </p>
        <p className="rounded-[var(--radius)] border border-[var(--border)] bg-card px-4 py-3 font-mono text-lg text-card-foreground">
          {resultado.passwordInicial}
        </p>
        <button
          type="button"
          onClick={onListo}
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
        Profesional de AFT
      </h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        Opcional — el Directivo también puede designarlo después desde su
        portal.
      </p>
      <div>
        <label
          htmlFor="email-aft"
          className="text-sm text-[var(--muted-foreground)]"
        >
          Email
        </label>
        <input
          id="email-aft"
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
      <button
        type="button"
        onClick={onListo}
        disabled={isSubmitting}
        className="w-full rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 font-medium text-foreground disabled:opacity-50"
      >
        Saltar por ahora
      </button>
    </form>
  );
}
