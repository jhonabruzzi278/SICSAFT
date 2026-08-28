import { app } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { ManagedProcess, esperarCondicion } from "./managed-process";
import { POSTGRES_CONFIG } from "./postgres-service";
import { obtenerIpLan } from "./lan-ip";

// Vendorizado real (2026-08-27): Eclipse Temurin JRE 17.0.20.1+1 en `resources/keycloak/jre/` +
// Keycloak 26.0.0 (misma versión que devops/onprem/) en `resources/keycloak/` -- ver
// resources/README.md para las versiones/fuentes exactas. `kc.bat` no trae su propio JRE (a
// diferencia de un JDK completo) -- necesita `JAVA_HOME` apuntando al JRE vendorizado, si no
// intenta resolver un Java del sistema que la PC del cliente no tiene por qué tener instalado
// (todo el punto de vendorizarlo). El costo real de arranque (varios segundos de JVM) sigue sin
// resolver acá -- CORE-RNF-02 (pantalla de carga) es responsabilidad del renderer/wizard, no de
// este archivo.

const PUERTO_KEYCLOAK = 58080;
// Keycloak 26 mueve el health-check a una interfaz de management SEPARADA del puerto HTTP
// principal (default 9000) -- verificado real arrancando Keycloak de punta a punta hoy:
// GET http://127.0.0.1:<PUERTO_KEYCLOAK>/health/ready nunca responde (404), el real está en
// http://127.0.0.1:<PUERTO_KEYCLOAK_MANAGEMENT>/health/ready. Puerto fijo no estándar, mismo
// criterio que el resto de los puertos acá.
const PUERTO_KEYCLOAK_MANAGEMENT = 58081;

// CORE-RF-05 -- la APP QR (PWA/APK) corre en el teléfono del Profesional de AFT, no en esta PC,
// así que Keycloak tiene que anunciarse (KC_HOSTNAME, el `iss` que firma en cada token) por la IP
// de LAN, no por 127.0.0.1 -- desde el teléfono eso apuntaría a sí mismo. Se calcula una sola vez
// al cargar el módulo (no cambia durante una corrida). Efecto secundario intencional: el propio
// escritorio (keycloak-bootstrap.ts, backend-configs.ts) también pasa a hablarle a Keycloak por
// esta IP en vez de 127.0.0.1 -- necesario para que el `Host` header sea el mismo que
// KC_HOSTNAME espera (Keycloak con hostname-strict rechaza un Host distinto al configurado);
// sigue siendo local (misma PC), solo cambia la interfaz de red usada.
const IP_LAN = obtenerIpLan();

export interface AdminBootstrapKeycloak {
  usuario: string;
  password: string; // generado una vez por instalación, nunca hardcodeado -- ver generarPassword()
}

function rutaRecursosKeycloak(): string {
  // Mismo bug real de "../" de más que tenía postgres-service.ts (ver rutaRecursosPostgres) --
  // corregido con la misma verificación real (`npm run dev`, 2026-08-27).
  const base = app.isPackaged
    ? join(process.resourcesPath, "keycloak")
    : join(__dirname, "..", "..", "resources", "keycloak");
  if (!existsSync(base)) {
    throw new Error(
      `No se encontró ${base} -- el JRE + Keycloak no están vendorizados ahí (ver ` +
        "resources/README.md).",
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
  // acá es la IP de LAN (ver IP_LAN arriba), no un dominio de cliente (sin Traefik ni dominios de
  // por medio, ver ARCHITECTURE.md "Red: localhost para el escritorio, LAN para el teléfono").
  const proceso = new ManagedProcess({
    command: join(recursos, "bin", "kc.bat"),
    args: ["start", "--optimized"],
    env: {
      ...process.env,
      // Sin esto, kc.bat busca `java` en PATH/JAVA_HOME del sistema -- puede no existir en la PC
      // del cliente, o ser una versión distinta a la que se probó acá. `JRE_HOME` también se
      // setea porque kc.bat lo prueba primero (ver el propio script); JAVA_HOME es el que
      // realmente usa Quarkus/Keycloak internamente.
      JAVA_HOME: join(recursos, "jre"),
      JRE_HOME: join(recursos, "jre"),
      KC_DB: "postgres",
      KC_DB_URL_HOST: "127.0.0.1",
      KC_DB_URL_PORT: String(POSTGRES_CONFIG.puerto),
      KC_DB_URL_DATABASE: "keycloak",
      KC_DB_USERNAME: POSTGRES_CONFIG.usuarioAdmin,
      KC_HTTP_PORT: String(PUERTO_KEYCLOAK),
      KC_HTTP_MANAGEMENT_PORT: String(PUERTO_KEYCLOAK_MANAGEMENT),
      KC_HOSTNAME: `http://${IP_LAN}:${PUERTO_KEYCLOAK}`,
      KC_HTTP_ENABLED: "true",
      // KC_HEALTH_ENABLED NO se pasa acá a propósito -- "health-enabled" es una opción de BUILD
      // TIME en Keycloak 26 (verificado real: `start --optimized` con un valor de runtime distinto
      // al que se compiló con `kc.bat build` tira "ERROR: build time options have values that
      // differ from what is persisted" y el proceso muere sin arrancar). Se hornea en el paso de
      // empaquetado (`kc.bat build --db=postgres --health-enabled=true`, ver resources/README.md),
      // no acá en runtime.
      KEYCLOAK_ADMIN: admin.usuario,
      KEYCLOAK_ADMIN_PASSWORD: admin.password,
    },
    esperarListo: (proceso_) =>
      esperarCondicion(
        async () => {
          const res = await fetch(
            `http://127.0.0.1:${PUERTO_KEYCLOAK_MANAGEMENT}/health/ready`,
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
  url: `http://${IP_LAN}:${PUERTO_KEYCLOAK}`,
  realm: "sicsaft",
} as const;
