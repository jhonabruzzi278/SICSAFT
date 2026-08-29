import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/mobile/Screen';
import { StatusPill } from '@/components/mobile/StatusPill';
import {
  getAllSessions,
  getAuditEntriesByCorrelationId,
  initInventoryDb,
  type AuditEntry,
  type AuditEvent,
  type ScanSession,
} from '@/lib/db';

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
  rejected: 'Rechazado', // CORE rechazó el payload (400/409, DOC-002 5) — ver sync-queue.ts
};

const SYNC_STATUS_TONE: Record<ScanSession['syncStatus'], 'neutral' | 'success' | 'destructive'> = {
  pending: 'neutral',
  synced: 'success',
  rejected: 'destructive',
};

const AUDIT_EVENT_LABEL: Record<AuditEvent, string> = {
  inventory_started: 'Inventario iniciado',
  scan: 'Escaneo',
  incident_added: 'Incidencia registrada',
  inventory_finished: 'Inventario finalizado',
  sync_status_changed: 'Estado de sincronización',
};

function formatAuditEntry(entry: AuditEntry): string {
  const parts = [AUDIT_EVENT_LABEL[entry.event]];
  if (entry.code) parts.push(entry.code);
  if (entry.category) parts.push(entry.category);
  if (entry.incidentNote) parts.push(entry.incidentNote);
  if (entry.syncStatus) parts.push(SYNC_STATUS_LABEL[entry.syncStatus]);
  return parts.join(' · ');
}

export function HistoryPage() {
  const [sessions, setSessions] = useState<ScanSession[] | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  async function toggleAudit(session: ScanSession) {
    if (expandedId === session.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(session.id ?? null);
    setAuditEntries([]);
    if (!session.correlationId) return;
    const db = await initInventoryDb();
    const entries = await getAuditEntriesByCorrelationId(db, session.correlationId);
    setAuditEntries(entries);
  }

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
    <Screen
      title="Historial"
      subtitle={
        sessions && sessions.length > 0
          ? `${sessions.length} ${sessions.length === 1 ? 'sesión guardada' : 'sesiones guardadas'}`
          : 'Controles de inventario realizados'
      }
    >
      {sessions === null ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : sessions.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground"
          data-testid="history-empty"
        >
          Todavía no hay sesiones de escaneo guardadas.
        </div>
      ) : (
        <ul className="space-y-3" data-testid="history-list">
          {sessions.map((session) => {
            const unregisteredCodes =
              session.items
                ?.filter((i) => i.category === 'unregistered')
                .map((i) => i.code)
                .join(', ') || 'Ninguno';
            const isExpanded = expandedId === session.id;
            // session.operatorName etc. pueden faltar en sesiones locales de
            // desarrollo previas a TASK-004/TASK-005 (no hay usuarios reales todavía).
            return (
              <li
                key={session.id}
                className="rounded-xl border border-border bg-card p-4 text-sm shadow-elev-1"
                data-testid="history-item"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-semibold">{formatSessionDate(session.date)}</span>
                  <StatusPill
                    tone={SYNC_STATUS_TONE[session.syncStatus] ?? 'neutral'}
                    data-testid="history-sync-status"
                  >
                    {SYNC_STATUS_LABEL[session.syncStatus] ?? session.syncStatus}
                    {session.syncStatus === 'pending' && (session.syncAttempts ?? 0) > 0
                      ? ` · intento ${session.syncAttempts}`
                      : ''}
                  </StatusPill>
                </div>
                <div className="mt-1.5 text-muted-foreground" data-testid="history-location">
                  {session.operatorName ?? '—'} · {session.organizationName ?? '—'} ·{' '}
                  {session.areaName ?? '—'} · {session.locationName ?? '—'}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  <span>{session.total} escaneados</span>
                  <span className="text-success">{session.correct ?? 0} correctos</span>
                  <span className="text-warning">
                    {(session.wrongArea ?? 0) + (session.wrongLocation ?? 0)} fuera de lugar
                  </span>
                  <span className="text-destructive">{session.unregistered ?? 0} no registrados</span>
                  <span>{session.incidents ?? 0} incidencias</span>
                </div>
                <div className="mt-1 text-xs text-destructive">{unregisteredCodes}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 -ml-2"
                  disabled={!session.correlationId}
                  onClick={() => toggleAudit(session)}
                  data-testid="toggle-audit-btn"
                >
                  {isExpanded ? 'Ocultar auditoría' : 'Ver auditoría'}
                </Button>
                {isExpanded && (
                  <ul
                    className="mt-1 space-y-1 border-l-2 border-border pl-3 text-xs text-muted-foreground"
                    data-testid="audit-list"
                  >
                    {auditEntries.length === 0 ? (
                      <li>Sin datos de auditoría.</li>
                    ) : (
                      auditEntries.map((entry) => (
                        <li key={entry.id} data-testid="audit-entry">
                          {formatSessionDate(entry.timestamp)} — {formatAuditEntry(entry)}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
