// Consultas de sólo lectura a la Postgres embebida del `.exe` (127.0.0.1:55432, auth `trust`,
// usuario admin único `sicsaft_admin` -- ver src/main/services/postgres-service.ts). Las specs la
// usan para comprobar que lo que hace la UI de verdad quedó persistido en la Base Patrimonial.
import pg from "pg";

const PUERTO = 55432;
const USUARIO = "sicsaft_admin";

export type Base = "keycloak" | "core" | "cip" | "eventos_outbox";
type Fila = Record<string, unknown>;

export async function consultar<T extends Fila = Fila>(
  base: Base,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const cliente = new pg.Client({
    host: "127.0.0.1",
    port: PUERTO,
    user: USUARIO,
    database: base,
  });
  await cliente.connect();
  try {
    const r = await cliente.query(sql, params);
    return r.rows as T[];
  } finally {
    await cliente.end();
  }
}

export async function unaFila<T extends Fila = Fila>(
  base: Base,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const filas = await consultar<T>(base, sql, params);
  return filas[0] ?? null;
}

export async function escalar(
  base: Base,
  sql: string,
  params: unknown[] = [],
): Promise<unknown> {
  const fila = await unaFila(base, sql, params);
  return fila ? Object.values(fila)[0] : null;
}
