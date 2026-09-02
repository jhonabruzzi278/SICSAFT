import { Client } from "pg";
import { POSTGRES_CONFIG } from "./postgres-service";
import { slugificar } from "@shared/slugificar";

// DOC-028 Fase B.2 — el wizard crea la organización del cliente en la BPI (Base Patrimonial
// Inteligente) de CORE
// (`organizaciones` + un contrato vigente + la sede principal + `contrato_sedes`), no solo la
// Organization de Keycloak. INSERT directo con `pg`: a esta altura del wizard todavía no hay un
// JWT con el que pasar por los endpoints de escritura de CIS/CORE (ni un rol asignable — el
// Director/Profesional de AFT se crean en los pasos siguientes). Mismo patrón que
// postgres-bootstrap.ts (crea las 4 bases directo contra Postgres).
//
// Sin esto, `1755000000001_seed-dev-fixture` gateado por SICSAFT_SEED_DEV (Fase B.1) deja la base
// vacía y el Profesional de AFT no ve el catálogo de su organización ni puede enviar inventarios
// reales de ella (CIS resuelve la organización del token contra lo que CORE conoce).

export interface DatosOrganizacionCore {
  organizacionId: string;
  clienteNombre: string;
  sedePrincipalNombre: string;
}

// Vocabulario controlado de DOC-004 5 — hoy el único módulo es 'inventario-qr' (mismo valor que
// usa el seed de dev, ver core/src/entitlements/contrato.seed.ts). Cuando exista un segundo
// módulo por nivel (CORE-Q-03), este mapeo pasa a depender de `nivel`.
const MODULOS_CONTRATADOS = ["inventario-qr"];

export async function provisionarOrganizacionCore(
  datos: DatosOrganizacionCore,
): Promise<void> {
  const { organizacionId, clienteNombre, sedePrincipalNombre } = datos;
  const sedeId = `${organizacionId}-${slugificar(sedePrincipalNombre)}`;
  const contratoId = `contrato-${organizacionId}`;

  const cliente = new Client({
    host: "127.0.0.1",
    port: POSTGRES_CONFIG.puerto,
    user: POSTGRES_CONFIG.usuarioAdmin,
    database: "core",
  });
  await cliente.connect();
  try {
    // Transacción: sin ella, un fallo de FK en `contrato_sedes` dejaría una organización/contrato
    // huérfanos a medio crear (mismo criterio que la escritura de Contrato en CORE, Fase 4).
    await cliente.query("BEGIN");
    await cliente.query(
      "INSERT INTO organizaciones (id, nombre) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [organizacionId, clienteNombre],
    );
    await cliente.query(
      "INSERT INTO sedes (id, organizacion_id, nombre) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
      [sedeId, organizacionId, sedePrincipalNombre],
    );
    await cliente.query(
      `INSERT INTO contratos
         (id, organizacion_id, vigencia_desde, vigencia_hasta, estado, modulos_contratados)
       VALUES ($1, $2, now(), NULL, 'vigente', $3::text[])
       ON CONFLICT (id) DO NOTHING`,
      [contratoId, organizacionId, MODULOS_CONTRATADOS],
    );
    await cliente.query(
      `INSERT INTO contrato_sedes (contrato_id, sede_id)
       VALUES ($1, $2) ON CONFLICT (contrato_id, sede_id) DO NOTHING`,
      [contratoId, sedeId],
    );
    await cliente.query("COMMIT");
  } catch (err) {
    await cliente.query("ROLLBACK");
    throw err;
  } finally {
    await cliente.end();
  }
}
