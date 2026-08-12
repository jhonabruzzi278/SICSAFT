import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllSessions, initInventoryDb, type ScanSession } from '@/lib/db';

function formatSessionDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

const SYNC_STATUS_LABEL: Record<ScanSession['syncStatus'], string> = {
  pending: 'Pendiente de sincronizar',
  synced: 'Sincronizado',
  rejected: 'Rechazado', // reservado — sin caller hoy, ver qr-connector.ts
};

const SYNC_STATUS_VARIANT: Record<ScanSession['syncStatus'], 'default' | 'outline' | 'destructive'> = {
  pending: 'outline',
  synced: 'default',
  rejected: 'destructive',
};

export function HistoryPage() {
  const [sessions, setSessions] = useState<ScanSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const db = await initInventoryDb();
      const result = await getAllSessions(db);
      if (!cancelled) setSessions(result);
    }

    refresh();
    // La cola sin conexión (sync-queue.ts) actualiza el syncStatus en segundo
    // plano — se refresca periódicamente para reflejarlo sin que el operador
    // tenga que recargar la página.
    const interval = setInterval(refresh, 2_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de escaneos</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="history-empty">
            Todavía no hay sesiones de escaneo guardadas.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="history-list">
            {sessions.map((session) => {
              const unregisteredCodes =
                session.items
                  ?.filter((i) => i.category === 'unregistered')
                  .map((i) => i.code)
                  .join(', ') || 'Ninguno';
              // session.operatorName etc. pueden faltar en sesiones locales de
              // desarrollo previas a TASK-004/TASK-005 (no hay usuarios reales todavía).
              return (
                <li key={session.id} className="bg-secondary p-3 text-sm" data-testid="history-item">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{formatSessionDate(session.date)}</span>
                    <Badge variant={SYNC_STATUS_VARIANT[session.syncStatus] ?? 'outline'} data-testid="history-sync-status">
                      {SYNC_STATUS_LABEL[session.syncStatus] ?? session.syncStatus}
                      {session.syncStatus === 'pending' && (session.syncAttempts ?? 0) > 0
                        ? ` · intento ${session.syncAttempts}`
                        : ''}
                    </Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground" data-testid="history-location">
                    {session.operatorName ?? '—'} · {session.organizationName ?? '—'} ·{' '}
                    {session.areaName ?? '—'} · {session.locationName ?? '—'}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
                    <span>{session.total} escaneados</span>
                    <span>{session.correct ?? 0} correctos</span>
                    <span>{(session.wrongArea ?? 0) + (session.wrongLocation ?? 0)} fuera de lugar</span>
                    <span>{session.unregistered ?? 0} no registrados</span>
                    <span>{session.incidents ?? 0} incidencias</span>
                  </div>
                  <div className="mt-1 text-destructive">{unregisteredCodes}</div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
