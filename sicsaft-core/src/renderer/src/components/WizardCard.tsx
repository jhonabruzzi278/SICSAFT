import type { ReactNode } from "react";
import { StepDots } from "./StepDots";

/**
 * Tarjeta centrada del wizard: título + subtítulo opcional + contenido, con
 * indicador de pasos opcional arriba. Un solo lugar para el ancho, el padding,
 * el radio y la sombra de cada paso — antes cada `Paso*.tsx` los repetía a mano
 * (`w-full max-w-sm space-y-4`).
 */
export function WizardCard({
  titulo,
  subtitulo,
  paso,
  totalPasos = 3,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  /** 1-indexado. Omitir en pantallas que no son un paso numerado (p. ej. "listo"). */
  paso?: number;
  totalPasos?: number;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-[var(--radius-2xl)] border border-[var(--border)] bg-card p-8 shadow-elev-2">
      {paso !== undefined && (
        <div className="mb-5 flex items-center justify-between">
          <StepDots total={totalPasos} actual={paso} />
          <span className="text-xs text-[var(--faint-foreground)]">
            Paso {paso} de {totalPasos}
          </span>
        </div>
      )}
      <h2 className="text-xl font-semibold text-foreground">{titulo}</h2>
      {subtitulo && (
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          {subtitulo}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}
