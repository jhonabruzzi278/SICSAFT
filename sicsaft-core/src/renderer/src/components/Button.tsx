import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "fantasma";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
};

const BASE =
  "inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:opacity-50 disabled:pointer-events-none";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-[var(--primary)] text-background hover:bg-[var(--primary-strong)] shadow-elev-float",
  secundario:
    "border border-[var(--border-strong)] text-foreground hover:bg-[var(--input)]",
  fantasma:
    "text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--input)]",
};

/** Botón del wizard — 3 variantes, ancho completo por defecto (columna del formulario). */
export function Button({ variante = "primario", className, ...rest }: Props) {
  return (
    <button
      className={`${BASE} ${VARIANTES[variante]} ${className ?? ""}`}
      {...rest}
    />
  );
}
