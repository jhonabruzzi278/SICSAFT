import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AltaProfesionalAftResultado } from "@shared/ipc-contract";
import { WizardCard } from "../components/WizardCard";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { PasswordReveal } from "../components/PasswordReveal";

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
      <WizardCard
        paso={3}
        titulo="Profesional de AFT dado de alta"
        subtitulo="Rol: Administrador Patrimonial."
      >
        <div className="space-y-4">
          <PasswordReveal password={resultado.passwordInicial} />
          <Button type="button" onClick={onListo}>
            Continuar
          </Button>
        </div>
      </WizardCard>
    );
  }

  return (
    <WizardCard
      paso={3}
      titulo="Profesional de AFT"
      subtitulo="Opcional — el Directivo también puede designarlo después desde su portal."
    >
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4"
      >
        <Field
          id="email-aft"
          type="email"
          label="Email"
          placeholder="aft@municipalidad.cl"
          error={errors.email?.message}
          {...register("email")}
        />
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando…" : "Dar de alta"}
        </Button>
        <Button
          type="button"
          variante="fantasma"
          onClick={onListo}
          disabled={isSubmitting}
        >
          Saltar por ahora
        </Button>
      </form>
    </WizardCard>
  );
}
