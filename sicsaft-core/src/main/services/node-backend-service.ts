import { app } from "electron";
import { join } from "node:path";
import { ManagedProcess, esperarCondicion } from "./managed-process";

// Corre cis/core/cip embebidos -- a diferencia de Postgres/Keycloak (binarios externos que hay
// que bundlear aparte, ver postgres-service.ts/keycloak-service.ts), estos ya son código propio
// del monorepo compilado a JS plano (`node dist/main.js`, igual que corren hoy en
// devops/onprem/docker-compose.yml) -- no hace falta bundlear ningún runtime adicional, Electron
// ya trae Node embebido y puede ejecutar este JS directo. Es la pieza de menor riesgo de todo
// ARCHITECTURE.md "Componente por componente".
export interface NodeBackendConfig {
  nombre: "cis" | "core" | "cip";
  // Ruta al `dist/main.js` ya compilado de cis/core/cip. En dev apunta al build real del monorepo
  // (../../<sistema>/dist/main.js relativo a sicsaft-core/); en producción, electron-builder debe
  // copiar cada `dist/` a `resources/<sistema>/` del instalador (ver package.json "build",
  // pendiente de configurar junto con el resto del empaquetado real).
  distMainPath: string;
  puerto: number;
  env: NodeJS.ProcessEnv;
  healthPath: string; // ej. "/health" para cis, ver cis/src/health/
}

export function crearNodeBackendService(
  config: NodeBackendConfig,
): ManagedProcess {
  const proceso = new ManagedProcess({
    command: process.execPath, // el propio binario de Node que trae Electron embebido
    args: [config.distMainPath],
    env: {
      ...process.env,
      ...config.env,
      PORT: String(config.puerto),
      // ELECTRON_RUN_AS_NODE hace que el binario de Electron se comporte como un Node normal en
      // vez de intentar levantar una ventana -- imprescindible para poder reusar
      // `nodeProcess.execPath` (el .exe de Electron) como intérprete de un script cualquiera.
      ELECTRON_RUN_AS_NODE: "1",
    },
    esperarListo: (proceso_) =>
      esperarCondicion(
        async () => {
          const res = await fetch(
            `http://127.0.0.1:${config.puerto}${config.healthPath}`,
          );
          return res.ok;
        },
        { intervaloMs: 500, maxIntentos: 60, nombre: config.nombre },
      ).catch((err) => {
        // Contexto extra en el error -- sin esto, un fallo acá solo dice "cis no quedó listo",
        // sin pistas de por qué (crash al arrancar, env var faltante, etc.) -- el stderr
        // acumulado normalmente tiene el stack trace real de NestJS.
        throw new Error(
          `${err.message}\nstderr:\n${proceso_.stderrAcumulado.slice(-2000)}`,
        );
      }),
  });

  return proceso;
}

// Resuelve la ruta al dist/main.js de un sistema del monorepo -- en dev, sicsaft-core/ vive como
// hermano de cis/core/cip en la raíz del repo (mismo patrón que devops/onprem/docker-compose.yml
// usa "../../cis" para el build.context). En producción esto cambia a `process.resourcesPath`
// (dentro del .exe empaquetado) -- pendiente configurar `electron-builder` `extraResources` para
// copiar cis/core/cip ahí (ver aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md "Próximo paso
// sugerido"); el branch de dev SÍ está verificado real (`npm run dev`, 2026-08-27) -- tenía el
// mismo bug de un "../" de más que rutaRecursosPostgres()/rutaRecursosKeycloak(), ya corregido.
export function rutaDistDeSistema(sistema: "cis" | "core" | "cip"): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, sistema, "dist", "main.js");
  }
  return join(__dirname, "..", "..", "..", sistema, "dist", "main.js");
}
