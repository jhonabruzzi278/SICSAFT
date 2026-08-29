import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AltaDirectorResultado } from "@shared/ipc-contract";
import { WizardCard } from "../components/WizardCard";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { PasswordReveal } from "../components/PasswordReveal";

// Paso 2 del wizard (aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Primer arranque")
// — el vendedor completa el email del Director acá mismo, en la PC del Director, y la app genera
// el password inicial (nunca lo tipea el vendedor) -- mismo mecanismo que
// KeycloakAdminService.crearUsuarioHuman/crearGrant de cis/, portado a
// keycloak-bootstrap.ts crearUsuarioDirector() (temporary: true, cambio obligatorio en el primer
// login, rol "directivo" en la organización creada en el paso 1).
const schema = z.object({
  email: z.string().email("Email inválido"),
});
type FormValues = z.infer<typeof schema>;

export function PasoDirector({
  organizacionId,
  onListo,
}: {
  organizacionId: string;
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
      const res = await window.sicsaftCore.altaDirector({
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
        paso={2}
        titulo="Director dado de alta"
        subtitulo="Rol: Directivo."
      >
        <div className="space-y-4">
          <PasswordReveal password={resultado.passwordInicial} />
          <Button type="button" onClick={() => onListo(resultado)}>
            Continuar
          </Button>
        </div>
      </WizardCard>
    );
  }

  return (
    <WizardCard
      paso={2}
      titulo="Datos del Director"
      subtitulo="Se crea con rol Directivo en la organización del paso anterior. La contraseña la genera la app."
    >
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4"
      >
        <Field
          id="email"
          type="email"
          label="Email"
          placeholder="director@municipalidad.cl"
          error={errors.email?.message}
          {...register("email")}
        />
        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando…" : "Dar de alta"}
        </Button>
      </form>
    </WizardCard>
  );
}
