/**
 * Indicador de progreso del wizard (1·2·3). `total` pasos, `actual` 1-indexado.
 * Los pasos ya completados y el actual van con el acento; los pendientes,
 * atenuados.
 */
export function StepDots({ total, actual }: { total: number; actual: number }) {
  return (
    <ol
      className="flex items-center gap-2"
      aria-label={`Paso ${actual} de ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const hecho = n <= actual;
        return (
          <li
            key={n}
            aria-current={n === actual ? "step" : undefined}
            className={`h-1.5 rounded-full transition-all ${
              n === actual
                ? "w-6 bg-[var(--primary)]"
                : hecho
                  ? "w-3 bg-[var(--primary-dim)]"
                  : "w-3 bg-[var(--border)]"
            }`}
          />
        );
      })}
    </ol>
  );
}
