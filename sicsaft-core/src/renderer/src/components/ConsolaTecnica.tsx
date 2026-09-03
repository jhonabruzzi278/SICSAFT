import { useCallback, useEffect, useRef, useState } from "react";

// CORE-RNF-02 -- "nunca una ventana en blanco sin feedback". Consola de diagnóstico embebida:
// muestra en vivo el log unificado del proceso principal (arranque de Postgres/Keycloak/CIS/CORE/
// CIP, transiciones del orquestador, errores de migración). Sirve para diagnosticar en pantalla un
// arranque que falla en la PC de un cliente, sin abrir una terminal. "Copiar todo" pega el detalle
// en un correo de soporte; "Abrir carpeta de logs" abre el .log del día en el explorador para
// adjuntarlo. El log se guarda a disco igual esté esta consola abierta o no (logger.ts).

// Un poco menos que el buffer del proceso principal (3000, ver logger.ts) -- alcanza de sobra para
// ver el arranque completo y evita que la consola crezca sin techo en una sesión larga.
const MAX_LINEAS = 2000;

// Heurística para resaltar en rojo las líneas que probablemente expliquen un fallo. No pretende
// ser exhaustiva -- una línea sin match igual se ve, solo no va resaltada.
const RE_LINEA_ERROR =
  /\berror\b|\bfatal\b|\bfail(?:ed|ure)?\b|exception|→ error|✕/i;

type Entrada = { id: number; texto: string };

type Props = {
  /** Abrir la consola ya desplegada -- p. ej. cuando un servicio quedó en "error". */
  defaultAbierta?: boolean;
};

export function ConsolaTecnica({ defaultAbierta = false }: Props) {
  const [abierta, setAbierta] = useState(defaultAbierta);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [copiado, setCopiado] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const idRef = useRef(0);
  // Auto-scroll al fondo, salvo que el usuario haya scrolleado hacia arriba a leer algo.
  const pegadoAbajoRef = useRef(true);

  useEffect(() => {
    let cancelado = false;
    const agregar = (textos: string[]): void => {
      setEntradas((prev) => {
        const nuevas = textos.map((texto) => ({ id: idRef.current++, texto }));
        const juntas = [...prev, ...nuevas];
        return juntas.length > MAX_LINEAS ? juntas.slice(-MAX_LINEAS) : juntas;
      });
    };

    window.sicsaftCore
      .obtenerLog()
      .then((buf) => {
        if (!cancelado) agregar(buf);
      })
      .catch(() => {
        /* el logger todavía no arrancó -- se llena con onLogLinea */
      });
    const off = window.sicsaftCore.onLogLinea((linea) => agregar([linea]));

    return () => {
      cancelado = true;
      off();
    };
  }, []);

  useEffect(() => {
    const pre = preRef.current;
    if (pre && pegadoAbajoRef.current) pre.scrollTop = pre.scrollHeight;
  }, [entradas, abierta]);

  const alScrollear = useCallback(() => {
    const pre = preRef.current;
    if (!pre) return;
    pegadoAbajoRef.current =
      pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40;
  }, []);

  async function copiar(): Promise<void> {
    try {
      await window.sicsaftCore.copiarAlPortapapeles(
        entradas.map((e) => e.texto).join("\n"),
      );
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* si falla, quedan "Abrir carpeta de logs" y el texto en pantalla */
    }
  }

  return (
    <div className="mt-4 w-full max-w-md overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-card text-left">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-foreground"
      >
        <span aria-hidden className="text-xs">
          {abierta ? "▾" : "▸"}
        </span>
        Detalle técnico
        <span className="ml-auto text-xs text-[var(--faint-foreground)]">
          {entradas.length} líneas
        </span>
      </button>

      {abierta && (
        <div className="border-t border-[var(--border)]">
          <div className="flex flex-wrap gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => void copiar()}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-[var(--input)]"
            >
              {copiado ? "Copiado ✓" : "Copiar todo"}
            </button>
            <button
              type="button"
              onClick={() => void window.sicsaftCore.abrirCarpetaLog()}
              className="rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-[var(--input)]"
            >
              Abrir carpeta de logs
            </button>
          </div>
          <pre
            ref={preRef}
            onScroll={alScrollear}
            className="max-h-64 overflow-auto whitespace-pre-wrap break-words bg-[var(--input)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--faint-foreground)]"
          >
            {entradas.length === 0
              ? "Sin actividad todavía…"
              : entradas.map((entrada) => (
                  <div
                    key={entrada.id}
                    className={
                      RE_LINEA_ERROR.test(entrada.texto)
                        ? "text-[var(--destructive)]"
                        : undefined
                    }
                  >
                    {entrada.texto}
                  </div>
                ))}
          </pre>
        </div>
      )}
    </div>
  );
}
