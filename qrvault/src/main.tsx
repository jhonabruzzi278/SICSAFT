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

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="qrvault-theme">
      <BrowserRouter>
        <PrintLabelsProvider>
          <App />
          <Toaster />
          <UpdatePrompt />
        </PrintLabelsProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
