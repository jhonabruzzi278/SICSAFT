import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllSessions, initInventoryDb, type ScanSession } from '@/lib/db';

function formatSessionDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

export function HistoryPage() {
  const [sessions, setSessions] = useState<ScanSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    initInventoryDb()
      .then((db) => getAllSessions(db))
      .then((result) => {
        if (!cancelled) setSessions(result);
      });
    return () => {
      cancelled = true;
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
              const missingCodes = session.missing.map((m) => m.code).join(', ') || 'Ninguno';
              return (
                <li key={session.id} className="bg-secondary p-3 text-sm" data-testid="history-item">
                  <div className="font-semibold">{formatSessionDate(session.date)}</div>
                  <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
                    <span>{session.total} escaneados</span>
                    <span>{session.found} encontrados</span>
                    <span>{session.missing.length} fuera de BD</span>
                  </div>
                  <div className="mt-1 text-destructive">{missingCodes}</div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
