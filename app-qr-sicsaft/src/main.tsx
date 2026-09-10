import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import App from "./App";
import { Toaster } from "@/components/ui/sonner";
import { PrintLabelsProvider } from "@/components/PrintLabelsProvider";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { installGlobalErrorHandler } from "@/lib/global-error-handler";
import "./index.css";

installGlobalErrorHandler();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found");

// Modo mock (e2e con MSW, ver src/mocks/) — arranca el Service Worker de MSW ANTES de renderizar
// para que ningún fetch salga sin ser interceptado (ver plan de e2e, HANDOFF 7). La app ya tiene
// su propio Service Worker de Workbox (UpdatePrompt.tsx) — se omite acá para no tener dos Service
// Atado al MODO de Vite, no a una variable de entorno: `.env.local` se carga TAMBIEN al
// buildear para produccion, asi que un `VITE_MOCK_API=true` olvidado ahi horneaba MSW en el
// `dist/` que sirve el .exe y la APP QR mostraba datos falsos en vez de los de la BPI (mismo
// bug que en ccp/, 2026-09-08). El modo `e2e` es un build de produccion (playwright.config:
// `vite build --mode e2e`), por eso no alcanza con exigir DEV.
const isMockMode =
  import.meta.env.MODE === "e2e" ||
  (import.meta.env.DEV && import.meta.env.VITE_MOCK_API !== "false");

async function bootstrap() {
  if (isMockMode) {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  createRoot(rootEl!).render(
    <StrictMode>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="qrvault-theme"
      >
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
