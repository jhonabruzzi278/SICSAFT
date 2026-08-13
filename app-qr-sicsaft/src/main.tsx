import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import App from './App';
import { Toaster } from '@/components/ui/sonner';
import { PrintLabelsProvider } from '@/components/PrintLabelsProvider';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { installGlobalErrorHandler } from '@/lib/global-error-handler';
import './index.css';

installGlobalErrorHandler();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

// Modo mock (e2e con MSW, ver src/mocks/) — arranca el Service Worker de MSW ANTES de renderizar
// para que ningún fetch salga sin ser interceptado (ver plan de e2e, HANDOFF §7). La app ya tiene
// su propio Service Worker de Workbox (UpdatePrompt.tsx) — se omite acá para no tener dos Service
// Workers compitiendo por el scope "/".
const isMockMode = import.meta.env.VITE_MOCK_API === 'true';

async function bootstrap() {
  if (isMockMode) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'error' });
  }

  createRoot(rootEl!).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="qrvault-theme">
        <BrowserRouter>
          <PrintLabelsProvider>
            <App />
            <Toaster />
            {!isMockMode && <UpdatePrompt />}
          </PrintLabelsProvider>
        </BrowserRouter>
      </ThemeProvider>
    </StrictMode>,
  );
}

bootstrap();
