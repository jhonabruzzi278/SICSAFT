import { spawnSync } from "node:child_process";
import { rutaDistDeSistema } from "./node-backend-service";

// core/ y cip/ aplican su esquema con `node scripts/migrate.js up` (node-pg-migrate, ver
// core/scripts/migrate.js) -- mismo comando que corre el servicio `core-migrate`/`cip-migrate` de
// devops/onprem/docker-compose.yml antes de arrancar el backend real. Acá no hay un `depends_on:
// condition: service_completed_successfully` de Compose que lo garantice -- este runner se llama
// a mano, de forma síncrona, ANTES de arrancar el proceso `core`/`cip` real (ver
// service-orchestrator.ts).
//
// `scripts/migrate.js` vive como hermano de `dist/main.js` dentro de cada carpeta de sistema
// (ver rutaDistDeSistema) -- no se compila con `nest build` (deliberado, ver el comentario real en
// core/Dockerfile), así que se ejecuta directo con Node, igual que dist/main.js.
export interface MigracionConfig {
  sistema: "core" | "cip";
  env: NodeJS.ProcessEnv;
}

export function correrMigraciones(config: MigracionConfig): void {
  const distMainPath = rutaDistDeSistema(config.sistema);
  // scripts/migrate.js vive en <raíz-del-sistema>/scripts/migrate.js -- dist/main.js vive en
  // <raíz-del-sistema>/dist/main.js, así que scripts/migrate.js es ../scripts/migrate.js relativo
  // a dist/.
  const raizSistema = distMainPath.replace(/[/\\]dist[/\\]main\.js$/, "");
  const rutaScript = `${raizSistema}/scripts/migrate.js`;

  const resultado = spawnSync(
    process.execPath, // el propio Node embebido de Electron, igual que node-backend-service.ts
    [rutaScript, "up"],
    {
      // Bug real encontrado corriendo `npm run dev` por primera vez (2026-08-27): scripts/
      // migrate.js le pasa a node-pg-migrate `dir: 'migrations'` (ruta RELATIVA, ver
      // core/scripts/migrate.js) -- sin `cwd` acá, el hijo hereda el cwd del proceso principal de
      // Electron (sicsaft-core/), no el de `core/`/`cip/`, y node-pg-migrate intenta escanear
      // "sicsaft-core/migrations/" (que no existe) en vez de "core/migrations/".
      cwd: raizSistema,
      env: {
        ...process.env,
        ...config.env,
        ELECTRON_RUN_AS_NODE: "1",
      },
      windowsHide: true,
      encoding: "utf8",
    },
  );

  if (resultado.status !== 0) {
    throw new Error(
      `Migraciones de ${config.sistema} fallaron (código ${resultado.status}):\n` +
        `${resultado.stderr}\n${resultado.stdout}`,
    );
  }
}
