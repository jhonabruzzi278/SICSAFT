import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { cisClient, type ActivoCatalogo, type Area } from '@/lib/cis-client';
import { agruparParaEtiquetas } from '@/lib/etiquetas';
import { EtiquetaActivo } from '@/components/EtiquetaActivo';
import { Alert, Button } from '@/components/ui';

// DOC-029 RF-F — módulo "QR / Etiquetas": todos los códigos QR acuñados, agrupados por dirección
// y área, listos para imprimir en etiquetas (QR + código de barras Code 128). Sin backend nuevo
// — lee el catálogo (`GET /catalogo`) y la estructura (`GET /admin/areas`) que CIS ya expone. La
// impresión sale sin el chrome de la app y con una dirección por página (ver @media print en
// index.css).

const TODAS = '__todas__';

export function EtiquetasPage() {
  const [searchParams] = useSearchParams();
  const organizacionId = searchParams.get('organizacionId') ?? '';

  const [catalogo, setCatalogo] = useState<ActivoCatalogo[] | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [qrPorId, setQrPorId] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [soloActivos, setSoloActivos] = useState(true);
  const [direccionSel, setDireccionSel] = useState<string>(TODAS);

  useEffect(() => {
    if (!organizacionId) return;
    let ignorar = false;
    setCatalogo(null);
    setError(null);
    void (async () => {
      try {
        const [activos, estructura] = await Promise.all([
          cisClient.getCatalogo(organizacionId),
          cisClient.getAreas(organizacionId),
        ]);
        if (ignorar) return;
        setAreas(estructura);
        setCatalogo(activos);
      } catch (err: unknown) {
        if (!ignorar) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      }
    })();
    return () => {
      ignorar = true;
    };
  }, [organizacionId]);

  useEffect(() => {
    if (!catalogo) return;
    let ignorar = false;
    void (async () => {
      const pares = await Promise.all(
        catalogo.map(async (activo) => {
          const dataUrl = await QRCode.toDataURL(activo.codigoQr, {
            width: 184,
            margin: 0,
            errorCorrectionLevel: 'M',
          });
          return [activo.id, dataUrl] as const;
        }),
      );
      if (!ignorar) setQrPorId(new Map(pares));
    })();
    return () => {
      ignorar = true;
    };
  }, [catalogo]);

  const gruposCompletos = useMemo(() => {
    if (!catalogo) return [];
    const filtrados = soloActivos
      ? catalogo.filter((a) => a.estado === 'activo')
      : catalogo;
    return agruparParaEtiquetas(filtrados, areas);
  }, [catalogo, areas, soloActivos]);

  const gruposVisibles =
    direccionSel === TODAS
      ? gruposCompletos
      : gruposCompletos.filter((g) => g.direccion === direccionSel);

  const totalVisible = gruposVisibles.reduce((n, g) => n + g.total, 0);
  const qrListo = catalogo !== null && catalogo.every((a) => qrPorId.has(a.id));

  if (!organizacionId) {
    return (
      <Alert>
        Falta organizacionId — volvé al hub y elegí una organización.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-accent-strong">
            QR / Etiquetas
          </h1>
          <p className="mt-1 text-sm text-text-dim">
            Todos los códigos QR de la organización, agrupados por dirección y
            área. Imprimí una dirección y metela en su sobre para el
            relevamiento.
          </p>
        </div>

        {error && <Alert>{error}</Alert>}

        {catalogo && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-bg-card p-4">
            <span className="text-sm text-text-dim">
              {totalVisible} {totalVisible === 1 ? 'etiqueta' : 'etiquetas'}
              {direccionSel !== TODAS && ' en esta dirección'}
            </span>

            <label className="flex items-center gap-2 text-sm text-text-dim">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
                className="accent-accent"
              />
              Solo activos vigentes
            </label>

            <label className="flex items-center gap-2 text-sm text-text-dim">
              Dirección
              <select
                value={direccionSel}
                onChange={(e) => setDireccionSel(e.target.value)}
                className="rounded-lg border border-border bg-bg-raised px-2 py-1 text-sm text-text"
              >
                <option value={TODAS}>Todas</option>
                {gruposCompletos.map((g) => (
                  <option key={g.direccion} value={g.direccion}>
                    {g.direccion} ({g.total})
                  </option>
                ))}
              </select>
            </label>

            <Button
              className="ml-auto"
              disabled={!qrListo || totalVisible === 0}
              onClick={() => window.print()}
            >
              {qrListo ? 'Imprimir' : 'Generando QR…'}
            </Button>
          </div>
        )}
      </div>

      {catalogo && gruposVisibles.length === 0 && (
        <p className="text-sm text-text-dim">
          {soloActivos
            ? 'No hay activos vigentes para etiquetar.'
            : 'No hay activos en el catálogo de esta organización.'}
        </p>
      )}

      <div className="space-y-10">
        {gruposVisibles.map((grupo) => (
          <section key={grupo.direccion} className="direccion space-y-5">
            <h2 className="border-b border-border pb-2 text-lg font-semibold text-text">
              {grupo.direccion}{' '}
              <span className="text-sm font-normal text-text-dim">
                — {grupo.total} {grupo.total === 1 ? 'activo' : 'activos'}
              </span>
            </h2>
            {grupo.areas.map((area) => (
              <div key={area.areaNombre} className="space-y-2">
                <h3 className="text-sm font-medium text-text-dim">
                  {area.areaNombre}
                </h3>
                <div className="lista-etiquetas grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {area.activos.map((etiqueta) => {
                    const qr = qrPorId.get(etiqueta.id);
                    if (!qr) return null;
                    return (
                      <EtiquetaActivo
                        key={etiqueta.id}
                        etiqueta={etiqueta}
                        qrDataUrl={qr}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
