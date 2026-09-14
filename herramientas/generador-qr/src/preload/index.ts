import { contextBridge, ipcRenderer } from "electron";
import type {
  GenerarError,
  GenerarInput,
  GenerarResultado,
  GeneradorQrApi,
} from "@shared/ipc-contract";

// Único punto de contacto entre el renderer (sandboxeado, sin Node) y el proceso principal —
// mismo patrón que sicsaft-core/src/preload/index.ts y ccp-desktop/src/preload/index.ts.
const api: GeneradorQrApi = {
  elegirExcel: () => ipcRenderer.invoke("generador-qr:elegirExcel"),
  elegirMapeo: () => ipcRenderer.invoke("generador-qr:elegirMapeo"),
  generar: (input: GenerarInput) =>
    ipcRenderer.invoke("generador-qr:generar", input) as Promise<
      GenerarResultado | GenerarError
    >,
};

contextBridge.exposeInMainWorld("generadorQr", api);
