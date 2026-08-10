import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      data-testid="update-banner"
      className="fixed left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 bg-popover px-4 py-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <span>{needRefresh ? 'Hay una nueva versión disponible.' : 'APP QR SICSAFT está lista para usarse sin conexión.'}</span>
      {needRefresh && (
        <Button size="sm" onClick={() => updateServiceWorker(true)} data-testid="update-banner-btn">
          Actualizar
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={close}>
        Cerrar
      </Button>
    </div>
  );
}
