"use strict";

// Fase A de DOC-028 (camino a cliente final) — corre ANTES de `electron-builder` (ver
// package.json `pack`/`dist:win`). Deja listo todo lo que `extraResources` va a copiar y que
// hasta ahora era un paso manual:
//
//   1. `npm run build` en cada sistema hermano cuyo `dist/` se empaqueta: ccp, core/frontend
//      (portales servidos por static-portal-server.ts) y cis, core, cip (backends que corre
//      node-backend-service.ts). Sin esto, `extraResources` copia un `dist/` viejo o inexistente.
//   2. `kc.bat build --db=postgres --health-enabled=true` una vez dentro de
//      resources/keycloak/bin/ — `--db`/`--health-enabled` son opciones de BUILD TIME en
//      Keycloak 26 (hallazgo real, ver resources/README.md): sin este paso `kc.bat start
//      --optimized` (lo que usa keycloak-service.ts) muere con "build time options have values
//      that differ from what is persisted". Se corre solo si el output no existe todavía.
//
// No bundlea ningún toolchain nuevo: usa el `npm` de cada sistema y el JRE ya vendorizado.

const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const RAIZ_SICSAFT_CORE = path.join(__dirname, "..");
const RAIZ_MONOREPO = path.join(RAIZ_SICSAFT_CORE, "..");

// Los `dist/` que package.json `build.extraResources` copia. ccp/core-frontend son los portales
// (static-portal-server.ts), el resto son los backends (node-backend-service.ts).
const SISTEMAS_A_BUILDEAR = [
  { nombre: "ccp", carpeta: "ccp" },
  { nombre: "core/frontend", carpeta: path.join("core", "frontend") },
  { nombre: "cis", carpeta: "cis" },
  { nombre: "core", carpeta: "core" },
  { nombre: "cip", carpeta: "cip" },
];

function log(msg) {
  process.stdout.write(`[prepack] ${msg}\n`);
}

function buildarSistemas() {
  for (const { nombre, carpeta } of SISTEMAS_A_BUILDEAR) {
    const cwd = path.join(RAIZ_MONOREPO, carpeta);
    if (!existsSync(path.join(cwd, "node_modules"))) {
      throw new Error(
        `[prepack] Falta ${carpeta}/node_modules — correr "npm ci" en ${carpeta}/ antes de empaquetar.`,
      );
    }
    log(`build ${nombre} …`);
    execSync("npm run build", { cwd, stdio: "inherit", shell: true });
    if (!existsSync(path.join(cwd, "dist"))) {
      throw new Error(
        `[prepack] "npm run build" en ${carpeta}/ no generó dist/.`,
      );
    }
  }
}

function kcBuild() {
  const keycloak = path.join(RAIZ_SICSAFT_CORE, "resources", "keycloak");
  const jre = path.join(keycloak, "jre");
  const marcador = path.join(
    keycloak,
    "lib",
    "quarkus",
    "quarkus-application.dat",
  );
  if (!existsSync(path.join(keycloak, "bin", "kc.bat"))) {
    throw new Error(
      `[prepack] No se encontró ${keycloak}/bin/kc.bat — Keycloak no está vendorizado (ver resources/README.md).`,
    );
  }
  if (existsSync(marcador)) {
    log(
      "kc.bat build — ya hecho (borrar resources/keycloak/lib/quarkus/ para rehacerlo)",
    );
    return;
  }
  if (!existsSync(path.join(jre, "bin", "java.exe"))) {
    throw new Error(
      `[prepack] No se encontró el JRE vendorizado en ${jre} (ver resources/README.md).`,
    );
  }
  log("kc.bat build --db=postgres --health-enabled=true …");
  execSync("kc.bat build --db=postgres --health-enabled=true", {
    cwd: path.join(keycloak, "bin"),
    stdio: "inherit",
    shell: true,
    env: { ...process.env, JAVA_HOME: jre, JRE_HOME: jre },
  });
  if (!existsSync(marcador)) {
    throw new Error(
      "[prepack] kc.bat build corrió pero no generó lib/quarkus/quarkus-application.dat.",
    );
  }
}

function main() {
  log("preparando artefactos para electron-builder (DOC-028 Fase A)");
  buildarSistemas();
  kcBuild();
  log("listo — artefactos de portales/backends y build de Keycloak al día");
}

main();
