// Donut SVG reutilizable — extraído de ResumenTab.tsx (Distribución por Categorías) cuando
// PantallaControlArea.tsx necesitó el mismo gráfico para "AFT por categoría" (2026-09-15): dos
// usos reales, no especulativo. Sin librería de gráficos — mismo criterio que el resto de
// components/ui.tsx ("sin radix/shadcn").
interface Segmento {
  nombre: string;
  cantidad: number;
  color: string;
}

function calcularCoordenadas(angulo: number, radio: number): [number, number] {
  const rad = ((angulo - 90) * Math.PI) / 180;
  return [100 + radio * Math.cos(rad), 100 + radio * Math.sin(rad)];
}

export function DonutChart({
  segmentos,
  centroValor,
  centroEtiqueta,
  vacioTexto,
}: {
  segmentos: Segmento[];
  centroValor: string | number;
  centroEtiqueta: string;
  vacioTexto: string;
}) {
  const total = segmentos.reduce((sum, s) => sum + s.cantidad, 0);
  let acumAngulo = 0;
  const arcos = segmentos.map((seg) => {
    const fraccion = total > 0 ? seg.cantidad / total : 0;
    const inicio = acumAngulo;
    acumAngulo += fraccion * 360;
    return {
      ...seg,
      inicio,
      fin: acumAngulo,
      porcentaje: total > 0 ? ((seg.cantidad / total) * 100).toFixed(1) : '0',
    };
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
      <div className="relative h-40 w-40 shrink-0">
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full -rotate-90 transform"
        >
          {arcos.map((seg) => {
            const radioExterior = 85;
            const radioInterior = 55;
            const [x1Ext, y1Ext] = calcularCoordenadas(
              seg.inicio,
              radioExterior,
            );
            const [x2Ext, y2Ext] = calcularCoordenadas(seg.fin, radioExterior);
            const [x1Int, y1Int] = calcularCoordenadas(
              seg.inicio,
              radioInterior,
            );
            const [x2Int, y2Int] = calcularCoordenadas(seg.fin, radioInterior);
            const granArco = seg.fin - seg.inicio > 180 ? 1 : 0;
            const d = [
              `M ${x1Ext} ${y1Ext}`,
              `A ${radioExterior} ${radioExterior} 0 ${granArco} 1 ${x2Ext} ${y2Ext}`,
              `L ${x2Int} ${y2Int}`,
              `A ${radioInterior} ${radioInterior} 0 ${granArco} 0 ${x1Int} ${y1Int}`,
              'Z',
            ].join(' ');
            return (
              <path key={seg.nombre} d={d} fill={seg.color}>
                <title>{`${seg.nombre}: ${seg.cantidad} (${seg.porcentaje}%)`}</title>
              </path>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold text-text">
            {centroValor}
          </span>
          <span className="text-[0.6rem] font-medium tracking-wider text-text-dim uppercase">
            {centroEtiqueta}
          </span>
        </div>
      </div>

      <div className="w-full space-y-2 sm:max-w-xs">
        {arcos.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-dim">
            {vacioTexto}
          </p>
        )}
        {arcos.map((seg) => (
          <div
            key={seg.nombre}
            className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-text">{seg.nombre}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text">{seg.cantidad}</span>
              <span className="text-text-faint">({seg.porcentaje}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
