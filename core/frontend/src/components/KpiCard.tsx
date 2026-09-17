// Tarjeta de KPI reutilizable — extraída de ResumenTab.tsx cuando PantallaControlArea.tsx
// necesitó la misma tarjeta para su fila de indicadores (2026-09-15). `acento` (2026-09-16) tiñe
// el borde/fondo de la tarjeta entera con el color de severidad — para las tarjetas de "AFT
// extraviados"/"AFT de otra área" (mismo criterio amarillo/rojo del resto de la app) sin afectar
// los usos neutros existentes en ResumenTab.tsx (que no pasan la prop).
const ACENTO_BORDE: Record<'error' | 'warning', string> = {
  error: 'border-destructive/30 bg-destructive/5',
  warning: 'border-warning/30 bg-warning/5',
};

export function KpiCard({
  titulo,
  valor,
  dato,
  colorValor,
  acento,
}: {
  titulo: string;
  valor: string;
  dato: string;
  colorValor?: string;
  acento?: 'error' | 'warning';
}) {
  return (
    <div
      className={`dashboard-metrics rounded-2xl border p-5 ${
        acento ? ACENTO_BORDE[acento] : 'border-border bg-bg-card'
      }`}
    >
      <p className="text-xs font-medium text-text-dim">{titulo}</p>
      <p
        className={`mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl ${colorValor ?? 'text-text'}`}
      >
        {valor}
      </p>
      <p className="mt-1 text-[0.75rem] text-text-faint">{dato}</p>
    </div>
  );
}
