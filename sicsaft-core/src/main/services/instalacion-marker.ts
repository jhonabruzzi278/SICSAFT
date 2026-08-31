import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InstalacionCompleta } from "@shared/ipc-contract";

// Bug real encontrado 2026-08-28: cada instalación de sicsaft-core.exe es de un solo cliente (ver
// el comentario de bootstrapPrimeraInstalacion en keycloak-bootstrap.ts), pero nada impedía que el
// wizard reintentara el paso 1 (crear el realm 'sicsaft') en cada relanzamiento -- con
// postgres-data persistido (el caso normal de un desktop app real, no solo de dev) Keycloak ya
// tiene el realm de la corrida anterior y responde 409 Conflict. Se persiste acá, mismo patrón que
// keycloak-admin.json (ver keycloak-service.ts), y el wizard lo consulta al arrancar para saltar
// directo al login si esta instalación ya tiene un cliente configurado.
//
// Limitación aceptada: si la app se cierra a mitad del wizard (bootstrapCliente ya corrió pero
// altaDirector todavía no), el marcador ya existe y el próximo arranque salta directo al login sin
// Director creado -- recuperarse de ese estado a medias no está resuelto acá, requeriría lógica de
// "reanudar wizard" que no hace falta para este incremento (CORE-RF-04).
//
// El shape (organizacionId/clienteNombre/ipLan) vive en @shared/ipc-contract -- el renderer también
// lo necesita tipado (getInstalacionExistente), y tener dos definiciones separadas ya se
// desincronizó una vez.
export type { InstalacionCompleta };

function rutaMarcador(): string {
  return join(app.getPath("userData"), "instalacion.json");
}

export function leerInstalacionExistente(): InstalacionCompleta | null {
  const ruta = rutaMarcador();
  if (!existsSync(ruta)) return null;
  return JSON.parse(readFileSync(ruta, "utf-8")) as InstalacionCompleta;
}

export function marcarInstalacionCompleta(datos: InstalacionCompleta): void {
  writeFileSync(rutaMarcador(), JSON.stringify(datos));
}

// DOC-028 Fase C.1 -- reescribe solo la ipLan del marcador, dejando el resto intacto. Se llama
// después de reconfigurar el client OIDC de la APP QR (ipc/handlers.ts reconfigurarIpLan) y como
// backfill para instalaciones anteriores a Fase C (getEstadoIpLan). Tira si no hay instalación
// previa -- el marcador base lo escribe marcarInstalacionCompleta() al terminar el paso 1.
export function actualizarIpLanInstalacion(ipLan: string): void {
  const existente = leerInstalacionExistente();
  if (!existente) {
    throw new Error(
      "actualizarIpLanInstalacion() sin instalación previa -- llamar marcarInstalacionCompleta() primero.",
    );
  }
  writeFileSync(rutaMarcador(), JSON.stringify({ ...existente, ipLan }));
}

// DOC-029 RF-B.6 -- reescribe solo la carpetaIngesta del marcador. Se llama desde
// ipc/handlers.ts elegirCarpetaIngesta cuando el usuario elige una carpeta en el diálogo nativo.
// Mismo criterio que actualizarIpLanInstalacion: exige que el marcador base ya exista.
export function actualizarCarpetaIngestaInstalacion(
  carpetaIngesta: string,
): void {
  const existente = leerInstalacionExistente();
  if (!existente) {
    throw new Error(
      "actualizarCarpetaIngestaInstalacion() sin instalación previa -- llamar marcarInstalacionCompleta() primero.",
    );
  }
  writeFileSync(
    rutaMarcador(),
    JSON.stringify({ ...existente, carpetaIngesta }),
  );
}
