import type { ReactNode } from "react";

/**
 * Barra de marca del instalador — misma familia visual que la app bar de
 * app-qr-sicsaft: wordmark SICSAFT con tracking amplio sobre el degradado de
 * marca. Sin acciones (el wizard no tiene sesión todavía); `right` queda para
 * cuando haga falta (p. ej. un "Cambiar de usuario" global).
 */
export function BrandBar({
  subtitle,
  right,
}: {
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6"
      style={{ background: "var(--brand-grad)" }}
    >
      <div className="flex min-w-0 flex-1 flex-col leading-none">
        <span className="text-sm font-bold tracking-[0.25em] text-foreground uppercase">
          SICSAFT
        </span>
        <span className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {subtitle ?? "Instalador de escritorio"}
        </span>
      </div>
      {right}
    </header>
  );
}
