// Worker de MSW para e2e (ver src/main.tsx). Los handlers corren dentro del Service Worker, no en
// `window` — `worker.use()`/`worker.resetHandlers()` sí viven en el hilo principal, es el canal
// soportado por MSW para overrides en runtime. Se expone en window.__mockControls porque
// Playwright sólo puede llegar acá vía page.evaluate() (tests/helpers.js, setInventarioFailing).
import { setupWorker } from 'msw/browser';
import { defaultHandlers, inventarioFailureHandler } from './handlers';

export const worker = setupWorker(...defaultHandlers);

function setInventarioFailing(failing: boolean): void {
  if (failing) {
    worker.use(inventarioFailureHandler);
  } else {
    worker.resetHandlers(...defaultHandlers);
  }
}

declare global {
  interface Window {
    __mockControls?: { setInventarioFailing: (failing: boolean) => void };
  }
}

window.__mockControls = { setInventarioFailing };
