import type { ActivoFilaAft } from '../types';
import type { DocumentoActivo } from '@/lib/cis-client';
import { Badge, Button, Card } from '@/components/ui';
import { IconFileText } from '@/components/icons';

interface CipFichaModalProps {
  activo: ActivoFilaAft;
  qrDataUrl: string | null;
  documentos: DocumentoActivo[] | null;
  cargandoDocs: boolean;
  onCerrar: () => void;
}

export function CipFichaModal({
  activo,
  qrDataUrl,
  documentos,
  cargandoDocs,
  onCerrar,
}: CipFichaModalProps) {
  return (
    <Card className="border-accent/40 bg-gradient-to-b from-bg-card to-bg-raised p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <span className="rounded bg-accent px-2 py-0.5 font-mono text-xs font-bold text-bg">
              {activo.codigoQr}
            </span>
            <h2 className="text-lg font-bold text-text">
              {activo.nombre}
            </h2>
            <Badge
              variant={
                activo.estado === 'En Servicio'
                  ? 'success'
                  : activo.estado === 'Baja'
                  ? 'error'
                  : 'warning'
              }
            >
              {activo.estado}
            </Badge>
          </div>
          <p className="text-xs text-text-dim">
            Código AFT: <code className="font-mono text-accent-strong">{activo.codigoAft}</code> · Familia: {activo.familia} ({activo.categoria})
          </p>
        </div>

        <Button
          variant="ghost"
          className="text-xs !py-1 text-text-dim hover:text-text"
          onClick={onCerrar}
        >
          ✕ Cerrar Ficha
        </Button>
      </div>

      {/* Grid: QR Badge + Atributos Detallados */}
      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        {/* Código QR */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-3 text-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Código QR de ${activo.codigoQr}`}
              className="h-32 w-32 object-contain"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center bg-gray-100 text-xs text-gray-400">
              Cargando QR...
            </div>
          )}
          <span className="mt-1 font-mono text-xs font-bold text-gray-800">
            {activo.codigoQr}
          </span>
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`QR-${activo.codigoQr}.png`}
              className="mt-1 text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Descargar PNG ↗
            </a>
          )}
        </div>

        {/* Atributos AFT */}
        <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-bg/60 p-2.5">
            <span className="block text-[10px] text-text-dim uppercase">Marca / Modelo</span>
            <span className="font-semibold text-text truncate block">{activo.marca} / {activo.modelo}</span>
          </div>

          <div className="rounded-lg border border-border bg-bg/60 p-2.5">
            <span className="block text-[10px] text-text-dim uppercase">Número de Serie</span>
            <span className="font-mono font-bold text-accent-strong truncate block">{activo.serie}</span>
          </div>

          <div className="rounded-lg border border-border bg-bg/60 p-2.5">
            <span className="block text-[10px] text-text-dim uppercase">Área Operativa</span>
            <span className="font-semibold text-text truncate block">{activo.areaNombre}</span>
          </div>

          <div className="rounded-lg border border-border bg-bg/60 p-2.5">
            <span className="block text-[10px] text-text-dim uppercase">Ubicación / Sede</span>
            <span className="font-semibold text-text truncate block">{activo.sedeUbicacion}</span>
          </div>

          <div className="rounded-lg border border-border bg-bg/60 p-2.5">
            <span className="block text-[10px] text-text-dim uppercase">Custodio Responsable</span>
            <span className="font-semibold text-text truncate block">{activo.responsableNombre}</span>
            <span className="text-[10px] text-text-faint">{activo.rutResponsable}</span>
          </div>

          <div className="rounded-lg border border-border bg-bg/60 p-2.5">
            <span className="block text-[10px] text-text-dim uppercase">Valor Adquisición</span>
            <span className="font-semibold text-text block">${activo.valorAdquisicion.toLocaleString('es-CL')} CLP</span>
          </div>

          <div className="rounded-lg border border-border bg-bg/60 p-2.5">
            <span className="block text-[10px] text-text-dim uppercase">Valor Libro Neto</span>
            <span className="font-semibold text-emerald-400 block">${activo.valorLibro.toLocaleString('es-CL')} CLP</span>
          </div>

          <div className="rounded-lg border border-border bg-bg/60 p-2.5">
            <span className="block text-[10px] text-text-dim uppercase">Vida Útil / Relevamiento</span>
            <span className="font-semibold text-text block">{activo.vidaUtilMeses}m · {activo.ultimoEscaneo}</span>
          </div>
        </div>
      </div>

      {/* Descripción */}
      <div className="rounded-lg border border-border bg-bg/40 p-3 text-xs text-text">
        <span className="block text-[10px] font-semibold text-text-dim uppercase mb-0.5">
          Especificación Técnica:
        </span>
        <p>{activo.descripcion}</p>
      </div>

      {/* Documentación Adjunta */}
      {cargandoDocs ? (
        <p className="text-xs text-text-dim">Cargando expediente documental…</p>
      ) : documentos && documentos.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
            Fotografías y Documentos
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {documentos.map((doc) => (
              <div
                key={doc.id}
                className="rounded-lg border border-border bg-bg-raised p-2 overflow-hidden space-y-1"
              >
                {doc.tipo === 'fotografia' ? (
                  <img src={doc.url} alt="Fotografía" className="h-20 w-full rounded object-cover" />
                ) : (
                  <div className="flex h-20 w-full flex-col items-center justify-center rounded bg-bg p-1">
                    <IconFileText className="h-6 w-6 text-accent mb-0.5" />
                    <span className="text-[10px] text-text-dim truncate">{doc.descripcion || 'Documento'}</span>
                  </div>
                )}
                <span className="text-[10px] text-text font-medium truncate block">{doc.descripcion || 'Archivo adjunto'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
