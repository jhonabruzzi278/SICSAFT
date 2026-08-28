import { networkInterfaces } from "node:os";

// CORE-RF-05 (aidlc-docs/sicsaft-core/requirements/REQUIREMENTS.md) -- la APK/PWA de
// app-qr-sicsaft corre en el teléfono del Profesional de AFT, no en esta PC, así que necesita
// alcanzar Keycloak/cis por la IP de LAN de la PC del Director, no por 127.0.0.1 (que desde el
// teléfono apunta a sí mismo). Heurística: primera interfaz IPv4 no interna que no sea un rango
// típico de red virtual (Docker/Podman/WSL2 suelen usar 172.16-31.x.x o 192.168.x.x en algunos
// setups, pero también hay LANs reales en 192.168.x.x -- no hay forma 100% confiable de
// distinguir sin inspeccionar más, así que se prioriza explícitamente 10.x.x.x/192.168.x.x reales
// sobre 172.x que es el rango por defecto de Docker/Podman/WSL2 Hyper-V). Fallback a 127.0.0.1
// documentado, no oculto -- si no hay LAN real, la APK/PWA simplemente no va a poder conectarse,
// pero el resto de la app (escritorio) sigue funcionando.
// Valida forma canónica de IPv4 (4 octetos 0-255, sin ceros a la izquierda) sobre lo que devuelve
// networkInterfaces(). No debería hacer falta -- para family "IPv4" el valor ya viene de la API
// del SO --, pero validarlo explícitamente acá, en el borde, garantiza que ningún consumidor de
// obtenerIpLan() (KC_HOSTNAME, los orígenes CORS, las URLs que arma keycloak-bootstrap.ts) reciba
// una cadena con forma inesperada, y deja la única entrada de datos externos de este módulo
// saneada en un solo lugar.
function esIpv4Canonica(ip: string): boolean {
  const octetos = ip.split(".");
  if (octetos.length !== 4) return false;
  return octetos.every((parte) => {
    if (parte.length === 0 || parte.length > 3) return false;
    if (!/^\d+$/.test(parte)) return false;
    const n = Number(parte);
    return n >= 0 && n <= 255 && String(n) === parte;
  });
}

export function obtenerIpLan(): string {
  const interfaces = networkInterfaces();
  const candidatas: string[] = [];

  for (const nombre of Object.keys(interfaces)) {
    for (const dir of interfaces[nombre] ?? []) {
      if (
        dir.family === "IPv4" &&
        !dir.internal &&
        esIpv4Canonica(dir.address)
      ) {
        candidatas.push(dir.address);
      }
    }
  }

  // Rangos típicos de adaptadores virtuales (Docker Desktop, Podman machine, WSL2/Hyper-V) que
  // NO son la LAN real de la PC -- se descartan primero si hay alguna alternativa.
  const esVirtualProbable = (ip: string): boolean => ip.startsWith("172.");
  const reales = candidatas.filter((ip) => !esVirtualProbable(ip));

  return reales[0] ?? candidatas[0] ?? "127.0.0.1";
}

// Puerto fijo de `vite preview` de app-qr-sicsaft/ (ver app-qr-sicsaft/vite.config.ts
// `preview.port`) -- compartido entre keycloak-bootstrap.ts (redirect URI del client OIDC) y
// backend-configs.ts (CIS_CORS_ORIGIN), ambos necesitan el mismo origen exacto.
export const PUERTO_APP_QR = 8765;

// CORE-RF-05 -- app-qr-sicsaft/ sirve por HTTPS (autofirmado, @vitejs/plugin-basic-ssl) incluso
// en dev/preview: crypto.subtle (PKCE) y crypto.randomUUID solo existen en "contexto seguro", y
// la IP de LAN nunca es "localhost" desde el punto de vista del teléfono. Esquema centralizado
// acá (no hardcodeado por separado en keycloak-bootstrap.ts y backend-configs.ts) para que el
// redirect URI del client OIDC y el CIS_CORS_ORIGIN nunca queden desincronizados entre sí.
export function obtenerOrigenAppQr(): string {
  return `https://${obtenerIpLan()}:${PUERTO_APP_QR}`;
}
