import type { EstadoIpLan } from "@shared/ipc-contract";
import { obtenerIpLan } from "./lan-ip";
import { leerInstalacionExistente } from "./instalacion-marker";

// DOC-028 Fase C.1 -- estabilidad de IP en red real. `sicsaft-core.exe` congela la IP de LAN de la
// PC al arrancar (keycloak-service.ts IP_LAN, y todo lo que deriva de obtenerIpLan()). En el
// relanzamiento eso se recalcula solo -- KC_HOSTNAME y las URLs de cis salen con la IP nueva sin
// hacer nada. Lo que NO se autocura es lo persistido en Keycloak: el redirectUri/webOrigins del
// client OIDC `app-qr-sicsaft`, el único registrado con un origen de LAN (los de ccp/core-frontend/
// sicsaft-core son 127.0.0.1). Si la IP cambió, el login del teléfono se rompe con "Invalid
// parameter: redirect_uri" hasta reconfigurar.
//
// Este módulo solo decide si hubo cambio -- la reconfiguración (Admin API + reescritura del
// marcador) la orquesta ipc/handlers.ts. Se mantiene sin dependencias de Electron a propósito:
// leerInstalacionExistente() y obtenerIpLan() son las únicas entradas, ambas mockeables en test.
export function evaluarCambioIpLan(): EstadoIpLan {
  const ipActual = obtenerIpLan();
  const ipGuardada = leerInstalacionExistente()?.ipLan ?? null;
  return {
    // Solo hay "cambio" si hay una IP previa contra la cual comparar. Una instalación anterior a
    // Fase C (sin ipLan) devuelve cambio: false -- getEstadoIpLan() en el handler la rellena con
    // la IP actual como línea base.
    cambio: ipGuardada !== null && ipGuardada !== ipActual,
    ipGuardada,
    ipActual,
  };
}
