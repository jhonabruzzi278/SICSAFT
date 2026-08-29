import { useState } from "react";

/**
 * Muestra la contraseña inicial generada (Director / Profesional de AFT) una
 * sola vez, con botón de copiar. Antes cada paso la pintaba con un `<p>` mono
 * suelto y sin forma de copiarla.
 */
export function PasswordReveal({ password }: { password: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin portapapeles disponible — el usuario puede seleccionar el texto a mano.
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--primary-dim)] bg-[var(--input)] p-4">
      <p className="text-xs font-medium tracking-wide text-[var(--faint-foreground)] uppercase">
        Contraseña inicial
      </p>
      <div className="mt-2 flex items-center gap-3">
        <code className="min-w-0 flex-1 truncate font-mono text-lg text-card-foreground">
          {password}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 rounded-[var(--radius)] border border-[var(--border-strong)] px-2.5 py-1 text-xs font-medium text-foreground hover:bg-card"
        >
          {copiado ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Entregásela ahora — no se vuelve a mostrar.
      </p>
    </div>
  );
}
