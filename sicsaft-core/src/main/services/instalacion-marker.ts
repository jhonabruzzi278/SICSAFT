import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
export interface InstalacionCompleta {
  organizacionId: string;
  clienteNombre: string;
}

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
