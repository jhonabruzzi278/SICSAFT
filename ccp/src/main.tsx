import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

// Modo mock (e2e con MSW, ver src/mocks/) — arranca el Service Worker antes de renderizar para
// que ningun fetch salga sin ser interceptado, mismo criterio que
// app-qr-sicsaft/src/main.tsx.
const isMockMode = import.meta.env.VITE_MOCK_API === 'true';

async function bootstrap() {
  if (isMockMode) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'error' });
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
