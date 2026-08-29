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
// networkInterfaces() es la única entrada de datos externos de este módulo. Se valida en el
// borde: cada dirección tiene que ser un IPv4 canónico (4 octetos numéricos 0-255, sin ceros a
// la izquierda) Y estar en un rango de uso local -- loopback (127/8) o privado RFC 1918
// (10/8, 172.16/12, 192.168/16). Cualquier otra cosa (una IP pública, una cadena con forma
// rara) se descarta y obtenerIpLan() cae a "127.0.0.1". Así ningún consumidor
// (KC_HOSTNAME, los orígenes CORS, las URLs de la Admin API que arma keycloak-bootstrap.ts)
// recibe jamás una dirección que apunte fuera de esta misma red local.
function octetosDeIpv4(ip: string): number[] | null {
  const partes = ip.split(".");
  if (partes.length !== 4) return null;
  const octetos: number[] = [];
  for (const parte of partes) {
    if (parte.length === 0 || parte.length > 3 || !/^\d+$/.test(parte)) {
      return null;
    }
    const n = Number(parte);
    if (n < 0 || n > 255 || String(n) !== parte) return null;
    octetos.push(n);
  }
  return octetos;
}

function esIpLocalValida(ip: string): boolean {
  const o = octetosDeIpv4(ip);
  if (!o) return false;
  const [a, b] = o;
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 10) return true; // privada 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // privada 172.16.0.0/12
  if (a === 192 && b === 168) return true; // privada 192.168.0.0/16
  return false;
}

export function obtenerIpLan(): string {
  // Override explícito (SICSAFT_CORE_LAN_IP) -- para cuando la heurística de abajo no sirve:
  // DHCP que reasigna la IP cada pocos minutos (la app hornea IP_LAN una sola vez al arrancar,
  // ver keycloak-service.ts -- un cambio de IP deja KC_HOSTNAME/el client OIDC apuntando a una
  // dirección muerta), una LAN con varias interfaces válidas, o una corrida automatizada/CI que
  // quiere fijar 127.0.0.1. Se valida con el mismo criterio que networkInterfaces() (IPv4
  // canónico y de rango local); si no pasa, se ignora y se cae a la heurística normal -- nunca
  // deja pasar una dirección fuera de la red local.
  const override = process.env.SICSAFT_CORE_LAN_IP?.trim();
  if (override && esIpLocalValida(override)) return override;

  const interfaces = networkInterfaces();
  const candidatas: string[] = [];

  for (const nombre of Object.keys(interfaces)) {
    for (const dir of interfaces[nombre] ?? []) {
      if (
        dir.family === "IPv4" &&
        !dir.internal &&
        esIpLocalValida(dir.address)
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
