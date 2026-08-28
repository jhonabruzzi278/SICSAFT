import { Client } from "pg";
import { POSTGRES_CONFIG } from "./postgres-service";

// Crea (si no existen) las 4 bases que necesitan Keycloak/core/cip/eventos_outbox sobre el
// Postgres embebido -- equivalente a lo que devops/onprem/postgres/init/*.sh hace vía
// docker-entrypoint-initdb.d, pero acá no hay ese hook: el proceso principal es dueño de Postgres
// directo (postgres-service.ts), así que este bootstrap corre una vez, en código, apenas Postgres
// queda listo.
//
// Simplificación deliberada frente a devops/ (documentada, no un descuido): un solo usuario
// (POSTGRES_CONFIG.usuarioAdmin, "sicsaft_admin") dueño de las 4 bases, en vez de un usuario de
// mínimo privilegio por base. devops/ protege una superficie multi-tenant (varios contenedores,
// red compartida); acá el único proceso que le habla a Postgres es esta misma app de escritorio,
// de un solo cliente -- separar usuarios no agrega aislamiento real en ese escenario.
//
// pgaudit (que sí usa devops/onprem/postgres/init/02-core.sh) se omite acá a propósito: el ZIP
// portable de EDB para Windows no lo trae, y compilarlo en tiempo de empaquetado no es realista
// para este perfil de escritorio -- gap aceptado, documentado en resources/README.md.
const BASES_REQUERIDAS = ["keycloak", "core", "cip", "eventos_outbox"] as const;

// Código de error real de Postgres para "la base ya existe" (verificado: 42P04) -- created acá en
// vez de importarlo de algún lado porque `pg` no exporta constantes de SQLSTATE.
const PG_ERROR_DUPLICATE_DATABASE = "42P04";

function esErrorBaseDuplicada(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === PG_ERROR_DUPLICATE_DATABASE
  );
}

export async function crearBasesDeDatosSiHacenFalta(): Promise<void> {
  const cliente = new Client({
    host: "127.0.0.1",
    port: POSTGRES_CONFIG.puerto,
    user: POSTGRES_CONFIG.usuarioAdmin,
    database: "postgres", // base default que initdb ya crea -- punto de entrada obligado, Postgres
    // no permite CREATE DATABASE sin estar conectado a alguna base existente.
  });
  await cliente.connect();
  try {
    for (const base of BASES_REQUERIDAS) {
      try {
        // Sin parámetros posicionales -- CREATE DATABASE no los admite (mismo motivo por el que
        // los scripts init/*.sh de devops/ arman el SQL con template strings, no queries
        // parametrizadas). El nombre de la base es una constante fija de este archivo, no input
        // externo -- no hay superficie de inyección real.
        await cliente.query(
          `CREATE DATABASE "${base}" OWNER "${POSTGRES_CONFIG.usuarioAdmin}"`,
        );
      } catch (error: unknown) {
        if (!esErrorBaseDuplicada(error)) throw error;
        // Ya existe de una corrida anterior -- idempotente, no es un error real.
      }
    }
  } finally {
    await cliente.end();
  }
}
