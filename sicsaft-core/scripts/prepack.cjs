"use strict";

// Fase A de DOC-028 (camino a cliente final) — corre ANTES de `electron-builder` (ver
// package.json `pack`/`dist:win`). Deja listo todo lo que `extraResources` va a copiar y que
// hasta ahora era un paso manual:
//
//   1. `npm run build` en cada sistema hermano cuyo `dist/` se empaqueta: ccp, core/frontend,
//      app-qr-sicsaft (portales/PWA servidos por static-portal-server.ts) y cis, core, cip
//      (backends que corre node-backend-service.ts). Sin esto, `extraResources` copia un `dist/`
//      viejo o inexistente.
//   2. `kc.bat build --db=postgres --health-enabled=true` una vez dentro de
//      resources/keycloak/bin/ — `--db`/`--health-enabled` son opciones de BUILD TIME en
//      Keycloak 26 (hallazgo real, ver resources/README.md): sin este paso `kc.bat start
//      --optimized` (lo que usa keycloak-service.ts) muere con "build time options have values
//      that differ from what is persisted". Se corre solo si el output no existe todavía.
//
// No bundlea ningún toolchain nuevo: usa el `npm` de cada sistema y el JRE ya vendorizado.

const { execSync } = require("node:child_process");
const { cpSync, existsSync, mkdirSync, readdirSync } = require("node:fs");
const path = require("node:path");

const RAIZ_SICSAFT_CORE = path.join(__dirname, "..");
const RAIZ_MONOREPO = path.join(RAIZ_SICSAFT_CORE, "..");
const RECURSOS = path.join(RAIZ_SICSAFT_CORE, "resources");

// PATH acotado a directorios fijos y no-escribibles (sonar javascript:S4036 — "el PATH solo debe
// contener directorios fijos e inescribibles"): System32 (cmd.exe + utilidades base) + la
// carpeta del Node que corre este script (donde vive `npm` en Windows y Linux). Se reemplaza el
// PATH heredado, que podría tener un `npm`/`kc.bat` malicioso más adelante. `npm run build` en
// cada hermano suma `node_modules/.bin` por su cuenta, no depende de este PATH para resolver
// tsc/vite/nest.
const SYSTEM32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
const NODE_DIR = path.dirname(process.execPath);
const PATH_BUILD = [SYSTEM32, NODE_DIR].join(path.delimiter);

// Ruta ABSOLUTA a npm (no vía búsqueda en PATH): `npm.cmd` en Windows, `npm` en Linux/CI.
const NPM = path.join(
  NODE_DIR,
  process.platform === "win32" ? "npm.cmd" : "npm",
);

function log(msg) {
  process.stdout.write(`[prepack] ${msg}\n`);
}

// `execSync` con el ejecutable entre comillas (ruta absoluta, puede tener espacios —
// "C:\Program Files\nodejs\") y el PATH acotado. Args fijos, ninguno viene de fuera.
function correr(exe, args, opts) {
  execSync(`"${exe}" ${args.join(" ")}`, {
    stdio: "inherit",
    ...opts,
    env: { ...process.env, ...(opts.env || {}) },
  });
}

// Los `dist/` que package.json `build.extraResources` copia. ccp/core-frontend son los portales
// (static-portal-server.ts), el resto son los backends (node-backend-service.ts).
const SISTEMAS_A_BUILDEAR = [
  { nombre: "ccp", carpeta: "ccp" },
  { nombre: "core/frontend", carpeta: path.join("core", "frontend") },
  { nombre: "app-qr-sicsaft", carpeta: "app-qr-sicsaft" },
  { nombre: "cis", carpeta: "cis" },
  { nombre: "core", carpeta: "core" },
  { nombre: "cip", carpeta: "cip" },
];

function buildarSistemas() {
  for (const { nombre, carpeta } of SISTEMAS_A_BUILDEAR) {
    const cwd = path.join(RAIZ_MONOREPO, carpeta);
    if (!existsSync(path.join(cwd, "node_modules"))) {
      throw new Error(
        `[prepack] Falta ${carpeta}/node_modules — correr "npm ci" en ${carpeta}/ antes de empaquetar.`,
      );
    }
    log(`build ${nombre} …`);
    correr(NPM, ["run", "build"], { cwd, env: { PATH: PATH_BUILD } });
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
  const kcBat = path.join(keycloak, "bin", "kc.bat");
  const marcador = path.join(
    keycloak,
    "lib",
    "quarkus",
    "quarkus-application.dat",
  );
  if (!existsSync(kcBat)) {
    throw new Error(
      `[prepack] No se encontró ${kcBat} — Keycloak no está vendorizado (ver resources/README.md).`,
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
  // Ruta ABSOLUTA a kc.bat + PATH acotado (System32 + el bin del JRE vendorizado). kc.bat
  // resuelve `java` por JAVA_HOME/JRE_HOME, que se le pasan explícitos.
  correr(kcBat, ["build", "--db=postgres", "--health-enabled=true"], {
    cwd: path.join(keycloak, "bin"),
    env: {
      PATH: [SYSTEM32, path.join(jre, "bin")].join(path.delimiter),
      JAVA_HOME: jre,
      JRE_HOME: jre,
    },
  });
  if (!existsSync(marcador)) {
    throw new Error(
      "[prepack] kc.bat build corrió pero no generó lib/quarkus/quarkus-application.dat.",
    );
  }
}

// DOC-029 RF-H -- el `.exe` sirve la APK Android en https://<ip>:8765/sicsaft-aft.apk (mismo
// servidor estático de la PWA) y muestra un 2º QR para descargarla. El `.apk` NO vive en el repo
// (binario, ver apk-aft/.gitignore): sale del artefacto de la CI `apk-aft` o de un build local.
// Si no está, se avisa y se sigue -- el `.exe` queda con la PWA por navegador como único camino.
// `resources/apk/` se crea siempre para que `extraResources` (package.json) no falle por carpeta
// faltante.
function copiarApk() {
  const destinoDir = path.join(RECURSOS, "apk");
  mkdirSync(destinoDir, { recursive: true });
  const origenDir = path.join(
    RAIZ_MONOREPO,
    "apk-aft",
    "app",
    "build",
    "outputs",
    "apk",
    "release",
  );
  const apk = existsSync(origenDir)
    ? readdirSync(origenDir).find((f) => f.toLowerCase().endsWith(".apk"))
    : undefined;
  if (!apk) {
    log(
      "APK Android no encontrada (apk-aft/app/build/outputs/apk/release/*.apk) — el .exe se " +
        "empaqueta sin ella; bajar el artefacto de la CI `apk-aft` y re-empaquetar para incluirla.",
    );
    return;
  }
  cpSync(path.join(origenDir, apk), path.join(destinoDir, "sicsaft-aft.apk"));
  log(`APK copiada: ${apk} -> resources/apk/sicsaft-aft.apk`);
}

// DOC-029 RF-B.6.2 -- sidecar Python de la ingesta contable. `app/` (el script + mapeos + los
// requirements) se copia siempre desde herramientas/etl-contable/. El intérprete embebido
// (`resources/etl-contable/python/`, python-build-standalone + venv con pandas/xlrd/requests, ~40
// MB) hay que vendorizarlo a mano una vez (necesita red y un Windows real) -- ver
// resources/README.md. Sin él, el watcher (ingesta-watcher.ts) no puede correr el ETL en el
// `.exe` y solo queda la carga manual de CSV desde el CCP.
function prepararEtlContable() {
  const destinoDir = path.join(RECURSOS, "etl-contable");
  const appDir = path.join(destinoDir, "app");
  mkdirSync(appDir, { recursive: true });
  const origen = path.join(RAIZ_MONOREPO, "herramientas", "etl-contable");
  for (const entrada of ["etl_contable.py", "requirements.txt", "mapeo"]) {
    const src = path.join(origen, entrada);
    if (existsSync(src)) {
      cpSync(src, path.join(appDir, entrada), { recursive: true });
    }
  }
  log(
    "ETL contable: herramientas/etl-contable/ -> resources/etl-contable/app/",
  );
  const python = path.join(
    destinoDir,
    "python",
    process.platform === "win32" ? "python.exe" : path.join("bin", "python3"),
  );
  if (!existsSync(python)) {
    log(
      "intérprete Python embebido NO vendorizado (resources/etl-contable/python/) — la ingesta " +
        "automática por carpeta no va a andar en el .exe; ver resources/README.md.",
    );
  }
}

function main() {
  log("preparando artefactos para electron-builder (DOC-028 Fase A)");
  buildarSistemas();
  kcBuild();
  copiarApk();
  prepararEtlContable();
  log("listo — artefactos de portales/backends y build de Keycloak al día");
}

main();
