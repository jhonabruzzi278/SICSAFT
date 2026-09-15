// Tarjeta de KPI reutilizable — extraída de ResumenTab.tsx cuando PantallaControlArea.tsx
// necesitó la misma tarjeta para su fila de indicadores (2026-09-15).
export function KpiCard({
  titulo,
  valor,
  dato,
  colorValor,
}: {
  titulo: string;
  valor: string;
  dato: string;
  colorValor?: string;
}) {
  return (
    <div className="dashboard-metrics rounded-2xl border border-border bg-bg-card p-5">
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
