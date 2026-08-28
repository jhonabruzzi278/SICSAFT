"use strict";

// Bug real de electron-builder encontrado empaquetando por primera vez (2026-08-27): el filtro
// de `extraResources` (glob vía minimatch) NO copia carpetas literalmente llamadas
// "node_modules" -- las trata como un caso especial reservado para SU PROPIA resolución de
// dependencias del paquete principal (basada en package.json), no para una fuente externa
// arbitraria como cis/core/cip. Confirmado real: con
// `filter: ["dist/**/*", "node_modules/**/*", "package.json"]` la carpeta node_modules
// simplemente no aparecía en el output empaquetado, sin error ni warning.
//
// Workaround: copiar node_modules de cis/core/cip a mano acá, con un fs.cpSync plano (Node 22+,
// nativo) que no pasa por el motor de filtros de electron-builder -- mismo contenido final que
// copian los Dockerfile de cis/core/cip (`COPY --from=build .../node_modules ./node_modules`),
// solo que ejecutado en este hook en vez de en un Dockerfile.
const { cpSync, existsSync } = require("node:fs");
const path = require("node:path");

const SISTEMAS = ["cis", "core", "cip"];

module.exports = async function afterPack(context) {
  for (const sistema of SISTEMAS) {
    const origen = path.join(__dirname, "..", "..", sistema, "node_modules");
    const destino = path.join(
      context.appOutDir,
      "resources",
      sistema,
      "node_modules",
    );
    if (!existsSync(origen)) {
      throw new Error(
        `No se encontró ${origen} -- correr "npm ci" en ${sistema}/ antes de empaquetar.`,
      );
    }
    cpSync(origen, destino, { recursive: true });
  }
};
