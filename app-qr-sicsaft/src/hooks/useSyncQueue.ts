import { useEffect } from 'react';
import { startSyncQueueTicker } from '@/lib/sync-queue';

// Arranca los reintentos automáticos de la cola sin conexión (TASK-008) una
// sola vez para toda la app — deben seguir corriendo aunque el operador
// navegue fuera de ScanPage, no solo mientras está escaneando.
export function useSyncQueue(): void {
  useEffect(() => startSyncQueueTicker(), []);
}
