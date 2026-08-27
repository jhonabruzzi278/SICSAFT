import { app } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { ManagedProcess, esperarCondicion } from "./managed-process";
import { POSTGRES_CONFIG } from "./postgres-service";

// NOTA DE HONESTIDAD (2026-08-27): igual que postgres-service.ts, asume un JRE + Keycloak ya
// vendorizados en `resources/keycloak/` (JRE de Eclipse Temurin + la distribución ZIP oficial de
// Keycloak, ya construida con `kc.bat build` en tiempo de empaquetado -- ver
// aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Keycloak — factible, pero con costo
// real"). Nada de eso está descargado/vendorizado todavía. El costo real de arranque (varios
// segundos de JVM) tampoco está resuelto acá -- CORE-RNF-02 (pantalla de carga) es
// responsabilidad del renderer/wizard, no de este archivo.

const PUERTO_KEYCLOAK = 58080;

export interface AdminBootstrapKeycloak {
  usuario: string;
  password: string; // generado una vez por instalación, nunca hardcodeado -- ver generarPassword()
}

function rutaRecursosKeycloak(): string {
  const base = app.isPackaged
    ? join(process.resourcesPath, "keycloak")
    : join(__dirname, "..", "..", "..", "resources", "keycloak");
  if (!existsSync(base)) {
    throw new Error(
      `No se encontró ${base} -- el JRE + Keycloak no están vendorizados todavía (ver NOTA DE ` +
        "HONESTIDAD en keycloak-service.ts).",
    );
  }
  return base;
}

function generarPassword(): string {
  return randomBytes(24).toString("base64url");
}

export async function crearKeycloakService(): Promise<{
  proceso: ManagedProcess;
  admin: AdminBootstrapKeycloak;
}> {
  const recursos = rutaRecursosKeycloak();
  const admin: AdminBootstrapKeycloak = {
    usuario: "admin",
    password: generarPassword(),
  };

  // Mismo patrón de env vars que devops/onprem/docker-compose.yml (ADR-004 Fase 3) -- KC_HOSTNAME
  // acá es 127.0.0.1 fijo, no un dominio de cliente (sin Traefik ni dominios de por medio, ver
  // ARCHITECTURE.md "Red: localhost para el escritorio, LAN para el teléfono" -- el teléfono con
  // la APK sigue siendo un problema aparte, no resuelto en este servicio).
  const proceso = new ManagedProcess({
    command: join(recursos, "bin", "kc.bat"),
    args: ["start", "--optimized"],
    env: {
      ...process.env,
      KC_DB: "postgres",
      KC_DB_URL_HOST: "127.0.0.1",
      KC_DB_URL_PORT: String(POSTGRES_CONFIG.puerto),
      KC_DB_URL_DATABASE: "keycloak",
      KC_DB_USERNAME: POSTGRES_CONFIG.usuarioAdmin,
      KC_HTTP_PORT: String(PUERTO_KEYCLOAK),
      KC_HOSTNAME: `http://127.0.0.1:${PUERTO_KEYCLOAK}`,
      KC_HTTP_ENABLED: "true",
      KC_HEALTH_ENABLED: "true",
      KEYCLOAK_ADMIN: admin.usuario,
      KEYCLOAK_ADMIN_PASSWORD: admin.password,
    },
    esperarListo: (proceso_) =>
      esperarCondicion(
        async () => {
          const res = await fetch(
            `http://127.0.0.1:${PUERTO_KEYCLOAK}/health/ready`,
          );
          return res.ok;
        },
        { intervaloMs: 1000, maxIntentos: 60, nombre: "keycloak" }, // hasta 60s -- JVM en frío
      ).catch((err) => {
        throw new Error(
          `${err.message}\nstderr:\n${proceso_.stderrAcumulado.slice(-2000)}`,
        );
      }),
  });

  return { proceso, admin };
}

export const KEYCLOAK_CONFIG = {
  puerto: PUERTO_KEYCLOAK,
  url: `http://127.0.0.1:${PUERTO_KEYCLOAK}`,
  realm: "sicsaft",
} as const;
