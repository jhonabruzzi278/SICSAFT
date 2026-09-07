#!/usr/bin/env node
// Inventario del repo para la revisión de código y documentación (DOC-032).
//
// Por qué existe: una revisión de 70k líneas repartidas en 8 sistemas no se sostiene de memoria
// entre sesiones. Este script recalcula las métricas que ORDENAN la revisión (dónde hay más
// comentario por línea, qué documento afirma algo que el código ya no hace) y las deja en un JSON
// que el grafo de `aidlc-docs/diagrams/grafo-revision-codigo.html` inyecta. Correrlo de nuevo es
// la forma de saber si una fase realmente movió la aguja, en vez de creerlo.
//
// No reemplaza el criterio: marca CANDIDATOS. Un comentario largo puede ser el más valioso del
// archivo (ver managed-process.ts, que documenta por qué taskkill va antes del kill).
//
//   node herramientas/revision-codigo/inventario.mjs            # escribe inventario.json
//   node herramientas/revision-codigo/inventario.mjs --tabla    # además imprime la tabla

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

// Un "sistema" es una unidad de revisión: se lee, se decide y se mergea por separado. `rutas` son
// prefijos de path; `capa` agrupa para el grafo y `entrega` marca lo que el cliente recibe (eso
// sube la prioridad: un comentario equivocado ahí cuesta más caro).
const SISTEMAS = [
  { id: "cis", nombre: "CIS", capa: "backend", rutas: ["cis/"], entrega: true },
  { id: "core", nombre: "CORE", capa: "backend", rutas: ["core/src/", "core/test/", "core/migrations/"], entrega: true },
  { id: "cip", nombre: "CIP", capa: "backend", rutas: ["cip/"], entrega: false },
  { id: "ccp", nombre: "CCP (portal AFT)", capa: "frontend", rutas: ["ccp/"], entrega: true },
  { id: "core-frontend", nombre: "CORE frontend (Directivo)", capa: "frontend", rutas: ["core/frontend/"], entrega: true },
  { id: "app-qr", nombre: "APP QR (PWA)", capa: "frontend", rutas: ["app-qr-sicsaft/"], entrega: true },
  { id: "sicsaft-core", nombre: "SICSAFT CORE (.exe)", capa: "entregable", rutas: ["sicsaft-core/"], entrega: true },
  { id: "herramientas", nombre: "Herramientas (ETL)", capa: "tooling", rutas: ["herramientas/"], entrega: true },
  { id: "devops", nombre: "DevOps", capa: "tooling", rutas: ["devops/"], entrega: false },
  { id: "casos-de-uso", nombre: "Casos de uso (e2e)", capa: "tooling", rutas: ["casos-de-uso/"], entrega: false },
  { id: "landing", nombre: "Landing", capa: "frontend", rutas: ["landing/"], entrega: false },
  { id: "docs", nombre: "Documentación", capa: "docs", rutas: ["aidlc-docs/", "adr/", "base-patrimonial/", "seguridad/", "integraciones/", "rfid/", "apk-aft/"], entrega: false },
];

// Términos que describen una realidad que el repo ya dejó atrás. `salvoEn` son los lugares donde
// mencionarlos es correcto: un ADR que documenta la decisión superada, o el catálogo que declara
// la depreciación, tienen que poder nombrarla.
const TERMINOS_DEPRECADOS = [
  {
    termino: "Zitadel",
    vigente: "Keycloak",
    fuente: "adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md",
    salvoEn: [/^adr\/ADR-002/, /^adr\/ADR-004/, /CHANGELOG/i],
  },
  {
    termino: "Base Patrimonial Central",
    vigente: "BPI — Base Patrimonial Inteligente",
    fuente: "NOMENCLATURA.md",
    salvoEn: [/^NOMENCLATURA\.md$/],
  },
];

const EXT_CODIGO = /\.(ts|tsx|js|jsx|mjs|py|ps1)$/;
const ES_TEST = /(\.spec\.|\.test\.|[/\\](tests?|e2e)[/\\])/;
const ES_COMENTARIO = /^\s*(\/\/|\/\*|\*|#(?!!)|<!--)/;

function git(...args) {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const archivos = git("ls-files").split("\n").filter(Boolean).filter((f) => !f.includes("node_modules/"));

// Índice de nombres de archivo existentes — la base del detector de comentarios huérfanos.
const nombresExistentes = new Set(archivos.map((f) => basename(f).toLowerCase()));

// El repo está en CRLF: sin normalizar, cada línea termina en `\r` invisible y cualquier chequeo
// de fin de línea (el guión de corte de un comentario envuelto, por ejemplo) falla en silencio.
const leer = (f) => {
  try {
    return readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");
  } catch {
    return null; // archivo trackeado pero borrado en el working tree
  }
};

// Artefactos de build (no versionados, pero existen en runtime) y nombres genéricos que aparecen
// en globs. Citarlos NO es un comentario huérfano: `dist/main.js` existe cuando el .exe corre.
const CITA_NO_ES_HUERFANA = /^(main|index|renderer|preload|bundle|vendor)\.(js|mjs|cjs)$/i;
const DIRECTORIO_DE_BUILD = /\b(dist|out|build|release|coverage|node_modules)\//;
// `.d.ts` casi siempre nombra tipos de una dependencia (`electron.d.ts`), no un módulo del repo.
const ES_DECLARACION_DE_TIPOS = /\.d\.ts$/i;

/**
 * Comentarios que citan un archivo fuente que ya no existe en el repo.
 *
 * Es el hallazgo más objetivo de toda la revisión: no depende de gusto. Si un comentario dice
 * "mismo criterio que zitadel-admin.service.ts" y ese archivo se borró en la migración, el
 * comentario le pide al lector comparar contra algo que no puede abrir. Se corrige o se elimina.
 *
 * Se descartan las familias de falso positivo detectadas al validar las primeras corridas:
 *  - globs (`*.schemas.ts`, `core/src/**\/*.spec.ts`) — nombran un patrón, no un archivo;
 *  - salidas de build (`dist/main.js`) — no están versionadas pero sí existen al ejecutar;
 *  - `.d.ts` de dependencias (`electron.d.ts`) — no son módulos del repo;
 *  - nombres partidos por el salto de línea: un comentario que envuelve `service-` / `orchestrator.ts`
 *    cita un archivo que SÍ existe. Por eso se analiza el bloque de comentario completo, no la
 *    línea suelta, reuniendo el guión de corte.
 */
function comentariosHuerfanos(rutaArchivo, contenido) {
  const hallazgos = [];
  const lineas = contenido.split("\n");

  let bloque = null; // { texto, lineaInicio }
  const cerrarBloque = () => {
    if (!bloque) return;
    // Sólo nombres de módulo del proyecto: extensión de código, nombre en kebab/camel.
    // El prefijo captura `*` o `/` pegados para poder distinguir un glob de un nombre suelto.
    const citados = bloque.texto.match(/[*/\w.-]*[a-zA-Z0-9][\w.-]*\.(ts|tsx|js|jsx|mjs|py)\b/g) ?? [];
    for (const cita of citados) {
      if (cita.includes("*")) continue; // glob, no un archivo concreto
      if (DIRECTORIO_DE_BUILD.test(cita)) continue;
      if (ES_DECLARACION_DE_TIPOS.test(cita)) continue;
      const nombre = basename(cita).toLowerCase();
      if (CITA_NO_ES_HUERFANA.test(nombre)) continue;
      if (nombresExistentes.has(nombre)) continue;
      hallazgos.push({
        archivo: rutaArchivo,
        linea: bloque.lineaInicio,
        cita,
        texto: bloque.texto.trim().slice(0, 200),
      });
    }
    bloque = null;
  };

  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (!ES_COMENTARIO.test(linea)) {
      cerrarBloque();
      continue;
    }
    const limpia = linea.replace(/^\s*(\/\/+|\/\*+|\*+\/?|#|<!--)\s?/, "").replace(/-->\s*$/, "");
    if (bloque === null) {
      bloque = { texto: limpia, lineaInicio: i + 1 };
    } else {
      // Un guión al final de la línea anterior es un corte de palabra: se une sin espacio para
      // reconstruir `service-orchestrator.ts`.
      bloque.texto += bloque.texto.endsWith("-") ? limpia : ` ${limpia}`;
    }
  }
  cerrarBloque();
  return hallazgos;
}

function metricasDe(sistema) {
  const suyos = archivos.filter((f) => sistema.rutas.some((r) => f.startsWith(r)));
  // core/ contiene a core/frontend/: sin esto las líneas del frontend se contarían dos veces.
  const propios = sistema.id === "core" ? suyos.filter((f) => !f.startsWith("core/frontend/")) : suyos;

  const codigo = propios.filter((f) => EXT_CODIGO.test(f));
  const fuente = codigo.filter((f) => !ES_TEST.test(f));
  const tests = codigo.filter((f) => ES_TEST.test(f));
  const docs = propios.filter((f) => f.endsWith(".md"));

  let loc = 0;
  let locComentario = 0;
  let locTests = 0;
  let todos = 0;
  const huerfanos = [];

  for (const f of fuente) {
    const c = leer(f);
    if (c === null) continue;
    const lineas = c.split("\n");
    loc += lineas.length;
    locComentario += lineas.filter((l) => ES_COMENTARIO.test(l)).length;
    todos += (c.match(/\b(TODO|FIXME|XXX|HACK)\b/g) ?? []).length;
    huerfanos.push(...comentariosHuerfanos(f, c));
  }
  for (const f of tests) {
    const c = leer(f);
    if (c !== null) locTests += c.split("\n").length;
  }

  // Documentos del sistema que afirman algo superado.
  const docsDesactualizados = [];
  for (const f of docs) {
    const c = leer(f);
    if (c === null) continue;
    for (const t of TERMINOS_DEPRECADOS) {
      if (t.salvoEn.some((re) => re.test(f))) continue;
      const n = (c.match(new RegExp(t.termino, "gi")) ?? []).length;
      if (n > 0) docsDesactualizados.push({ archivo: f, termino: t.termino, vigente: t.vigente, veces: n });
    }
  }

  return {
    archivosFuente: fuente.length,
    archivosTest: tests.length,
    docs: docs.length,
    loc,
    locComentario,
    locTests,
    pctComentario: loc > 0 ? Number(((locComentario * 100) / loc).toFixed(1)) : 0,
    // Un sistema con mucho código y poco test se revisa distinto: no hay red que avise si el
    // "limpiar" rompió algo.
    ratioTest: loc > 0 ? Number((locTests / loc).toFixed(2)) : 0,
    todos,
    huerfanos,
    docsDesactualizados,
  };
}

// Aristas del ecosistema — el flujo no negociable de CLAUDE.md ("ninguna fuente de captura escribe
// la BPI directo"). Se declaran a mano porque son la regla, no el resultado de un import graph:
// justamente lo que hay que poder ver de un vistazo es si algo la rompe.
const ARISTAS = [
  { de: "app-qr", a: "cis", tipo: "captura" },
  { de: "ccp", a: "cis", tipo: "captura" },
  { de: "core-frontend", a: "cis", tipo: "captura" },
  { de: "cis", a: "core", tipo: "orquestacion" },
  { de: "core", a: "cip", tipo: "eventos" },
  { de: "herramientas", a: "cis", tipo: "captura" },
  { de: "sicsaft-core", a: "cis", tipo: "embebe" },
  { de: "sicsaft-core", a: "core", tipo: "embebe" },
  { de: "sicsaft-core", a: "cip", tipo: "embebe" },
  { de: "sicsaft-core", a: "ccp", tipo: "embebe" },
  { de: "sicsaft-core", a: "core-frontend", tipo: "embebe" },
  { de: "casos-de-uso", a: "cis", tipo: "prueba" },
  { de: "devops", a: "cis", tipo: "despliega" },
];

const nodos = SISTEMAS.map((s) => ({ ...s, ...metricasDe(s) }));

const inventario = {
  generado: new Date().toISOString(),
  commit: git("rev-parse", "--short", "HEAD").trim(),
  rama: git("rev-parse", "--abbrev-ref", "HEAD").trim(),
  totales: {
    loc: nodos.reduce((a, n) => a + n.loc, 0),
    locTests: nodos.reduce((a, n) => a + n.locTests, 0),
    docs: nodos.reduce((a, n) => a + n.docs, 0),
    huerfanos: nodos.reduce((a, n) => a + n.huerfanos.length, 0),
    docsDesactualizados: nodos.reduce((a, n) => a + n.docsDesactualizados.length, 0),
    todos: nodos.reduce((a, n) => a + n.todos, 0),
  },
  nodos,
  aristas: ARISTAS,
};

const salida = join(AQUI, "inventario.json");
writeFileSync(salida, `${JSON.stringify(inventario, null, 2)}\n`, "utf8");

// `--grafo` inyecta el inventario dentro del HTML del grafo, entre marcadores. El grafo se abre
// desde el disco (file://) y no puede hacer fetch del JSON, así que los datos viajan embebidos.
// El estado de avance y los hallazgos se leen de estado-revision.json y se adjuntan acá: viven en
// otro archivo justamente para que volver a correr este script no pise el criterio ya aplicado.
if (process.argv.includes("--grafo")) {
  const rutaGrafo = join(RAIZ, "aidlc-docs", "diagrams", "grafo-revision-codigo.html");
  const rutaEstado = join(AQUI, "estado-revision.json");

  const revision = JSON.parse(readFileSync(rutaEstado, "utf8"));
  const conRevision = {
    ...inventario,
    revision: { estados: revision.estados ?? {}, hallazgos: revision.hallazgos ?? [] },
  };

  const html = readFileSync(rutaGrafo, "utf8");
  const inicio = "// <!-- INVENTARIO:INICIO -->";
  const fin = "// <!-- INVENTARIO:FIN -->";
  const i = html.indexOf(inicio);
  const f = html.indexOf(fin);
  if (i === -1 || f === -1) {
    throw new Error(`No encontré los marcadores INVENTARIO:INICIO/FIN en ${rutaGrafo}`);
  }
  const bloque =
    `${inicio} bloque reemplazado por inventario.mjs --grafo\n` +
    `const DATOS = ${JSON.stringify(conRevision)};\n`;
  writeFileSync(rutaGrafo, html.slice(0, i) + bloque + html.slice(f), "utf8");

  // Un hallazgo apuntando a un sistema que no existe queda invisible en el grafo — avisar, no
  // fallar: el estado se edita a mano y un id mal escrito no debe romper la regeneración.
  const ids = new Set(nodos.map((n) => n.id));
  for (const h of revision.hallazgos ?? []) {
    if (!ids.has(h.sistema)) {
      console.warn(`  aviso: el hallazgo ${h.id} apunta al sistema "${h.sistema}", que no existe`);
    }
  }
  console.log(`→ ${rutaGrafo}`);
}

if (process.argv.includes("--tabla")) {
  const p = (v, n) => String(v).padStart(n);
  console.log(`\ncommit ${inventario.commit} (${inventario.rama})\n`);
  console.log("sistema                      loc   coment%  test/loc   docs  huérf  docs✗");
  console.log("─".repeat(78));
  for (const n of [...nodos].sort((a, b) => b.loc - a.loc)) {
    console.log(
      `${n.nombre.padEnd(26)}${p(n.loc, 6)}  ${p(n.pctComentario, 6)}%  ${p(n.ratioTest, 8)}  ${p(n.docs, 5)}  ${p(n.huerfanos.length, 5)}  ${p(n.docsDesactualizados.length, 5)}`,
    );
  }
  const t = inventario.totales;
  console.log("─".repeat(78));
  console.log(
    `${"TOTAL".padEnd(26)}${p(t.loc, 6)}  ${p("", 7)}  ${p("", 8)}  ${p(t.docs, 5)}  ${p(t.huerfanos, 5)}  ${p(t.docsDesactualizados, 5)}`,
  );
  console.log(`\nTODO/FIXME: ${t.todos}   ·   líneas de test: ${t.locTests}`);
}

console.log(`\n→ ${salida}`);
