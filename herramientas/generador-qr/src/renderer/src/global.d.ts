import type { GeneradorQrApi } from "@shared/ipc-contract";

declare global {
  interface Window {
    generadorQr: GeneradorQrApi;
  }
}
