import { code128b } from '@/lib/code128';
import type { EtiquetaActivo as EtiquetaActivoData } from '@/lib/etiquetas';

// DOC-029 RF-F — una etiqueta imprimible: QR + código de barras Code 128 + código patrimonial +
// nombre + área. El QR llega ya renderizado como data URL (PNG) desde EtiquetasPage — así la
// página genera los ~cientos de QR una sola vez con Promise.all, no uno por render.

function Barcode({ valor }: { valor: string }) {
  let datos;
  try {
    datos = code128b(valor);
  } catch {
    // Código con un carácter fuera de Code 128-B — se cae al texto, sin barra.
    return null;
  }
  const alto = 34;
  return (
    <svg
      viewBox={`0 0 ${datos.modulos} ${alto}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      role="img"
      aria-label={`Código de barras ${valor}`}
    >
      {datos.barras.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={0}
          width={b.ancho}
          height={alto}
          fill="#000"
        />
      ))}
    </svg>
  );
}

export function EtiquetaActivo({
  etiqueta,
  qrDataUrl,
}: {
  etiqueta: EtiquetaActivoData;
  qrDataUrl: string;
}) {
  return (
    <div className="etiqueta flex items-center gap-3 rounded-md border border-border bg-white p-2 text-black">
      <img
        src={qrDataUrl}
        alt={`QR ${etiqueta.codigoQr}`}
        width={92}
        height={92}
        className="h-[92px] w-[92px] shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-semibold" title={etiqueta.nombre}>
          {etiqueta.nombre}
        </p>
        <p className="truncate text-[11px] text-neutral-600">
          {etiqueta.areaNombre}
        </p>
        <Barcode valor={etiqueta.codigoQr} />
        <p className="text-center font-mono text-xs tracking-wider">
          {etiqueta.codigoQr}
        </p>
      </div>
    </div>
  );
}
