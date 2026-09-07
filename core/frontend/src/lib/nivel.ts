// DOC-029 RF-A — nivel de producto contratado para el portal del Directivo.
// window.__SICSAFT_PORTAL_CONFIG__.VITE_SICSAFT_NIVEL inyectado en runtime por sicsaft-core.exe
export type NivelProducto = 1 | 2;

declare global {
  interface Window {
    __SICSAFT_PORTAL_CONFIG__?: Record<string, string>;
  }
}

export function nivelActual(): NivelProducto {
  const crudo =
    window.__SICSAFT_PORTAL_CONFIG__?.VITE_SICSAFT_NIVEL ??
    import.meta.env.VITE_SICSAFT_NIVEL;
  return String(crudo) === '1' ? 1 : 2;
}

export function esNivel2(): boolean {
  return nivelActual() === 2;
}
