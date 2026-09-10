import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

// Modo mock (e2e con MSW, ver src/mocks/) — arranca el Service Worker antes de renderizar para
// que ningun fetch salga sin ser interceptado, mismo criterio que
// El modo `e2e` (playwright.config.js: `vite build --mode e2e && vite preview`) es un build de
// PRODUCCIÓN, así que no alcanza con exigir DEV. Pero mirar solo `VITE_MOCK_API` tampoco
// servía: Vite carga `.env.local` también al buildear para producción, así que un
// `VITE_MOCK_API=true` olvidado ahí horneaba MSW en el `dist/` que sirve el .exe y el portal
// mostraba activos falsos en vez de los de la BPI (bug real 2026-09-08). Con el modo como
// condición, un build de producción no puede quedar mockeado diga lo que diga cualquier .env.
const isMockMode =
  import.meta.env.MODE === 'e2e' ||
  (import.meta.env.DEV && import.meta.env.VITE_MOCK_API !== 'false');

async function bootstrap() {
  if (isMockMode) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  createRoot(rootEl!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

bootstrap();
