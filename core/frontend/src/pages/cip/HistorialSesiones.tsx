import { useEffect, useState } from 'react';
import { dashboardClient, type ResumenDiario } from '@/lib/dashboard-client';
import { Alert, Card } from '@/components/ui';

// DOC-034 Parte B — corte diario generado a medianoche (ResumenDiarioScheduler, cip/) a partir de
// veredicto_sesion. No calcula nada acá: solo lista lo que CIP ya resumió. Vive como una vista
// más del toggle de ControlesAreaTab (junto a "Control BPI"/"Escaneos"), no como pestaña propia
// del sidebar — confirmado con el usuario 2026-09-15.
function formatFecha(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-');
  return `${dia}-${mes}-${anio}`;
}

export function HistorialSesiones({
  organizacionId,
}: {
  organizacionId: string;
}) {
  const [dias, setDias] = useState<ResumenDiario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDias(null);
    setError(null);
    dashboardClient
      .getHistorico(organizacionId)
      .then((res) => {
        if (!cancelled) setDias(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizacionId]);

  return (
    <Card className="h-fit">
      <h2 className="mb-1 font-medium text-text">
        Historial de controles por día
      </h2>
      <p className="mb-4 text-xs text-text-dim">
        Corte generado automáticamente cada medianoche — el día de hoy todavía
        no tiene fila hasta el próximo corte.
      </p>

      {error && <Alert>{error}</Alert>}
      {!error && !dias && (
        <p className="text-sm text-text-dim">Cargando historial…</p>
      )}
      {dias?.length === 0 && (
        <p className="text-sm text-text-dim">
          Sin cortes diarios todavía — el primero se genera en la próxima
          medianoche con actividad.
        </p>
      )}
      {dias && dias.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-text-dim">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Día</th>
                <th className="py-1.5 pr-3 font-medium">Sesiones</th>
                <th className="py-1.5 pr-3 font-medium text-success">
                  Exitoso
                </th>
                <th className="py-1.5 pr-3 font-medium text-warning">
                  Aceptable
                </th>
                <th className="py-1.5 font-medium text-destructive">
                  Defectuoso
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {dias.map((dia) => (
                <tr key={dia.fecha}>
                  <td className="py-1.5 pr-3 font-medium text-text">
                    {formatFecha(dia.fecha)}
                  </td>
                  <td className="py-1.5 pr-3 text-text">{dia.totalSesiones}</td>
                  <td className="py-1.5 pr-3 text-text">{dia.exitoso}</td>
                  <td className="py-1.5 pr-3 text-text">{dia.aceptable}</td>
                  <td className="py-1.5 text-text">{dia.defectuoso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
