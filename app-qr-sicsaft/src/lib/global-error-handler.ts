// Instalado una vez al arrancar. Atrapa errores que de otra forma fallarían
// en silencio (una pantalla en blanco, un botón que no hace nada) y los
// muestra al usuario, mientras el detalle real queda en la consola.
import { toast } from 'sonner';

function notify(message: string): void {
  console.error(message);
  toast.error('⚠️ Ocurrió un error inesperado. Intentá de nuevo.', { description: message });
}

export function installGlobalErrorHandler(): void {
  window.addEventListener('error', (event) => {
    notify(event.message);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason as unknown;
    const message =
      reason && typeof reason === 'object' && 'message' in reason
        ? String((reason as { message: unknown }).message)
        : String(reason);
    notify(message);
  });
}
