import { useEffect, useState } from "react";

// DOC-029 RF-B.6 -- selector de la carpeta del PC donde el especialista contable deja los .xls.
// El proceso principal abre el diálogo nativo (elegirCarpetaIngesta), persiste la elección en
// instalacion.json y la inyecta al módulo Importaciones del CCP. Acá solo se dispara la elección
// y se muestra la ruta vigente.
export function CarpetaIngesta({ compact = false }: { compact?: boolean }) {
  const [carpeta, setCarpeta] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    window.sicsaftCore
      .leerCarpetaIngesta()
      .then((c) => {
        if (!cancelado) setCarpeta(c);
      })
      .catch(() => {
        /* sin instalación previa -- se queda en null */
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function elegir(): Promise<void> {
    setEligiendo(true);
    setError(null);
    try {
      const elegida = await window.sicsaftCore.elegirCarpetaIngesta();
      if (elegida) setCarpeta(elegida);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEligiendo(false);
    }
  }

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span aria-hidden>📁</span>
        <span className="truncate" title={carpeta ?? undefined}>
          {carpeta ?? "Sin carpeta de ingesta de Excel"}
        </span>
        <button
          type="button"
          onClick={() => void elegir()}
          disabled={eligiendo}
          className="shrink-0 underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        >
          {carpeta ? "Cambiar" : "Elegir"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 flex w-full max-w-xs flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-card p-4">
      <p className="text-sm font-semibold text-foreground">
        Carpeta de ingesta de Excel
      </p>
      <p className="text-center text-xs text-[var(--muted-foreground)]">
        El especialista contable deja ahí los archivos; SICSAFT los traduce y el
        Profesional de AFT los revisa en el portal antes de que entren a la
        base.
      </p>
      {carpeta && (
        <p className="break-all text-center font-mono text-[11px] text-[var(--faint-foreground)]">
          {carpeta}
        </p>
      )}
      <button
        type="button"
        onClick={() => void elegir()}
        disabled={eligiendo}
        className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--input)] disabled:opacity-50"
      >
        {eligiendo
          ? "Elegiendo…"
          : carpeta
            ? "Cambiar carpeta"
            : "Elegir carpeta"}
      </button>
      {error && (
        <p className="text-center text-[11px] text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}
