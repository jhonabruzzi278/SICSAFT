// Gráfico de pastel simple — reemplaza al donut anterior (DonutChart.tsx, 2026-09-15): con pocas
// categorías (caso real más común, ver Pantalla 8) el anillo con hueco y el total en el centro
// quedaban recargados para lo poco que agregaban — el total ya se muestra en una tarjeta KPI
// aparte en las dos pantallas que usan este gráfico (ResumenTab.tsx "Total AFT",
// PantallaControlArea.tsx "AFT escaneados"), así que repetirlo en el centro era redundante.
// Reemplazado 2026-09-16 a pedido del usuario ("no se ve bien, pon un gráfico de pastel sencillo").
interface Segmento {
  nombre: string;
  cantidad: number;
  color: string;
}

function calcularCoordenadas(angulo: number, radio: number): [number, number] {
  const rad = ((angulo - 90) * Math.PI) / 180;
  return [100 + radio * Math.cos(rad), 100 + radio * Math.sin(rad)];
}

export function PieChart({
  segmentos,
  vacioTexto,
}: {
  segmentos: Segmento[];
  vacioTexto: string;
}) {
  const total = segmentos.reduce((sum, s) => sum + s.cantidad, 0);
  let acumAngulo = 0;
  const porciones = segmentos.map((seg) => {
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

  const radio = 85;
  // Una única porción al 100% (caso real más común: una sola categoría) dibuja un círculo
  // completo — un arco de 360° con el mismo punto de inicio y fin no traza nada, así que ese
  // caso se resuelve aparte en vez de forzarlo por el camino general de <path>.
  const esCirculoCompleto = porciones.length === 1 && total > 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
      <div className="h-40 w-40 shrink-0">
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full -rotate-90 transform"
        >
          {esCirculoCompleto ? (
            <circle cx="100" cy="100" r={radio} fill={porciones[0].color} />
          ) : (
            porciones.map((seg) => {
              const [x1, y1] = calcularCoordenadas(seg.inicio, radio);
              const [x2, y2] = calcularCoordenadas(seg.fin, radio);
              const granArco = seg.fin - seg.inicio > 180 ? 1 : 0;
              const d = [
                'M 100 100',
                `L ${x1} ${y1}`,
                `A ${radio} ${radio} 0 ${granArco} 1 ${x2} ${y2}`,
                'Z',
              ].join(' ');
              return (
                <path
                  key={seg.nombre}
                  d={d}
                  fill={seg.color}
                  stroke="var(--color-bg-card)"
                  strokeWidth="2"
                >
                  <title>{`${seg.nombre}: ${seg.cantidad} (${seg.porcentaje}%)`}</title>
                </path>
              );
            })
          )}
        </svg>
      </div>

      <div className="w-full space-y-2 sm:max-w-xs">
        {porciones.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-dim">
            {vacioTexto}
          </p>
        )}
        {porciones.map((seg) => (
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
