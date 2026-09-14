import { SectionHeader } from '@/components/mobile/SectionHeader';

export interface ReportItemListsData {
  scannedItems: { code: string; name: string }[];
  nonCorrectItems: { code: string; name: string; category: string; incidentNote?: string }[];
  missingAssets: { codigoQr: string; nombre: string }[];
  outOfAreaByArea: Map<string, { code: string; name: string }[]>;
}

/**
 * Las 4 listas de detalle de "Resultado del control" (DOC-029 RF-I / CONTRATO-PANTALLA-8), debajo
 * de ReportSummaryCard. Presentacional pura — misma razón que ReportSummaryCard: ScanPage (sesión
 * recién escaneada) y HistoryPage (sesión guardada, reconstruida desde IndexedDB) tienen que verse
 * exactamente igual (pedido del usuario 2026-09-11).
 */
export function ReportItemLists({ data }: { data: ReportItemListsData }) {
  const { scannedItems, nonCorrectItems, missingAssets, outOfAreaByArea } = data;

  return (
    <>
      <div className="space-y-2">
        <SectionHeader>AFT escaneados</SectionHeader>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
          {scannedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="report-scanned-list">
              {scannedItems.map((item) => (
                <li key={item.code} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-brand">{item.code}</span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {/* La APP QR sólo lee etiquetas QR → ORDINARIO. EXTRAORDINARIO (QR + RFID) es
                      Nivel 3 y lo marca CORE en el informe del CCP a partir de
                      catalogo_activos.tecnologia_identificacion. */}
                  <span className="text-[0.6rem] font-semibold tracking-wide text-muted-foreground">
                    ORDINARIO
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeader>Detalle (todo lo que no fue correcto)</SectionHeader>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
          {nonCorrectItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="report-detail-list">
              {nonCorrectItems.map((item) => (
                <li key={item.code} className="text-destructive">
                  {item.code} – {item.name} · {item.category}
                  {item.incidentNote ? ` · incidencia: ${item.incidentNote}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeader>Activos faltantes (esperados y no escaneados)</SectionHeader>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
          {missingAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="report-missing-list">
              {missingAssets.map((asset) => (
                <li key={asset.codigoQr} className="text-warning">
                  {asset.codigoQr} – {asset.nombre}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeader>AFT que no corresponden a esta área</SectionHeader>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
          {outOfAreaByArea.size === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-2 text-sm" data-testid="report-out-of-area-list">
              {Array.from(outOfAreaByArea.entries()).map(([areaName, grupo]) => (
                <li key={areaName}>
                  <span className="font-semibold">{areaName}</span>
                  <ul className="ml-4 space-y-0.5">
                    {grupo.map((item) => (
                      <li key={item.code} className="text-warning">
                        {item.code} – {item.name}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
