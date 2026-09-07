import { code128b } from '@/lib/code128';
import type { EtiquetaActivo as EtiquetaActivoData } from '@/lib/etiquetas';

// DOC-029 RF-F / Mejora 2 — Etiqueta imprimible multi-plantilla (Avery 3x10, Tarjetas 2x5,
// Térmica 1x1). QR de alta nitidez + código de barras Code 128 + código patrimonial + nombre +
// área. El QR llega ya renderizado como data URL (PNG) desde EtiquetasPage para optimizar
// el rendimiento al renderizar cientos de etiquetas en masa.

export type PlantillaEtiqueta = 'avery' | 'tarjeta' | 'termica';

function Barcode({ valor, alto = 24 }: { valor: string; alto?: number }) {
  let datos;
  try {
    datos = code128b(valor);
  } catch {
    return null;
  }
  return (
    <svg
      viewBox={`0 0 ${datos.modulos} ${alto}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: `${alto}px` }}
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

export interface EtiquetaActivoProps {
  etiqueta: EtiquetaActivoData;
  qrDataUrl: string;
  plantilla?: PlantillaEtiqueta;
  mostrarBarcode?: boolean;
  mostrarInstitucion?: boolean;
  nombreOrganizacion?: string;
}

export function EtiquetaActivo({
  etiqueta,
  qrDataUrl,
  plantilla = 'avery',
  mostrarBarcode = true,
  mostrarInstitucion = true,
  nombreOrganizacion = 'SICSAFT PATRIMONIO',
}: EtiquetaActivoProps) {
  if (plantilla === 'termica') {
    return (
      <div className="etiqueta etiqueta-termica flex flex-col items-center justify-between rounded border border-neutral-400 bg-white p-2 text-black shadow-sm">
        {mostrarInstitucion && (
          <div className="w-full border-b border-neutral-300 pb-0.5 text-center text-[9px] font-bold tracking-wider text-neutral-800 uppercase">
            {nombreOrganizacion}
          </div>
        )}
        <div className="flex w-full items-center justify-around gap-2 py-1">
          <img
            src={qrDataUrl}
            alt={`QR ${etiqueta.codigoQr}`}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <p className="truncate text-xs font-bold" title={etiqueta.nombre}>
              {etiqueta.nombre}
            </p>
            <p className="truncate text-[10px] text-neutral-600">
              {etiqueta.areaNombre}
            </p>
            <p className="font-mono text-xs font-bold tracking-wider text-black">
              AFT: {etiqueta.codigoAft || etiqueta.codigoQr}
            </p>
          </div>
        </div>
        {mostrarBarcode && (
          <div className="w-full pt-0.5">
            <Barcode valor={etiqueta.codigoQr} alto={18} />
          </div>
        )}
      </div>
    );
  }

  if (plantilla === 'tarjeta') {
    return (
      <div className="etiqueta etiqueta-tarjeta flex flex-col justify-between rounded-lg border border-neutral-400 bg-white p-3 text-black shadow-sm">
        {mostrarInstitucion && (
          <div className="flex items-center justify-between border-b border-neutral-300 pb-1">
            <span className="text-[10px] font-bold tracking-widest text-neutral-700 uppercase">
              {nombreOrganizacion}
            </span>
            <span className="rounded bg-neutral-100 px-1.5 py-0.2 text-[9px] font-semibold text-neutral-600">
              ACTIVO FIJO
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 py-1.5">
          <img
            src={qrDataUrl}
            alt={`QR ${etiqueta.codigoQr}`}
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 rounded border border-neutral-200 p-0.5"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p
              className="truncate text-sm font-bold text-black"
              title={etiqueta.nombre}
            >
              {etiqueta.nombre}
            </p>
            <p className="truncate text-xs text-neutral-600">
              {etiqueta.areaNombre}
            </p>
            {mostrarBarcode && (
              <div className="mt-0.5">
                <Barcode valor={etiqueta.codigoQr} alto={24} />
              </div>
            )}
            <p className="font-mono text-sm font-bold tracking-wider text-black">
              AFT: {etiqueta.codigoAft || etiqueta.codigoQr} | QR:{' '}
              {etiqueta.codigoQr}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Plantilla por defecto: Avery 5160 (compacta 3x10)
  return (
    <div className="etiqueta etiqueta-avery flex items-center gap-2.5 rounded border border-neutral-300 bg-white p-2 text-black shadow-xs">
      <img
        src={qrDataUrl}
        alt={`QR ${etiqueta.codigoQr}`}
        width={68}
        height={68}
        className="h-[68px] w-[68px] shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        {mostrarInstitucion && (
          <p className="truncate text-[9px] font-bold text-neutral-500 uppercase tracking-tight">
            {nombreOrganizacion}
          </p>
        )}
        <p
          className="truncate text-xs font-semibold text-neutral-900"
          title={etiqueta.nombre}
        >
          {etiqueta.nombre}
        </p>
        <p className="truncate text-[10px] text-neutral-600">
          {etiqueta.areaNombre}
        </p>
        {mostrarBarcode && (
          <div className="py-0.5">
            <Barcode valor={etiqueta.codigoQr} alto={18} />
          </div>
        )}
        <p className="font-mono text-[11px] font-bold tracking-wide text-neutral-950">
          AFT: {etiqueta.codigoAft || etiqueta.codigoQr} | QR:{' '}
          {etiqueta.codigoQr}
        </p>
      </div>
    </div>
  );
}
