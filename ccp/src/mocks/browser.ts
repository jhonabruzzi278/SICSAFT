// Worker de MSW para e2e (ver src/main.tsx) — mismo patron que
// app-qr-sicsaft/src/mocks/browser.ts.
import { setupWorker } from 'msw/browser';
import { defaultHandlers, resetCatalogo } from './handlers';

export const worker = setupWorker(...defaultHandlers);

declare global {
  interface Window {
    __mockControls?: { resetCatalogo: () => void };
  }
}

window.__mockControls = { resetCatalogo };
