import { BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';

// RF-05 — patron compartido por Area/Ubicacion/Responsable repository: consultar la
// organizacion real de un recurso referenciado (directo o via JOIN, segun `sql`) y rechazar si no
// coincide con `organizacionId` — defensa en profundidad, mismo motivo que ActivoRepository
// cruzando la organizacion real del activo objetivo (hallazgo real de revision de seguridad,
// DOC-012 3). Antes duplicado en area.repository.ts/ubicacion.repository.ts/
// responsable.repository.ts (SonarCloud lo marcaba como duplicacion real).
export async function verificarPerteneceOrganizacion(
  pool: Pick<Pool, 'query'>,
  sql: string,
  id: string,
  organizacionId: string,
  campo: string,
): Promise<void> {
  const result = await pool.query<{ organizacionId: string }>(sql, [id]);
  const row = result.rows[0];
  if (!row || row.organizacionId !== organizacionId) {
    throw new BadRequestException({
      message: `${campo} '${id}' inexistente en la organizacion '${organizacionId}'`,
    });
  }
}
