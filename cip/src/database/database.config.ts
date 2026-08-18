import { z } from 'zod';

// Conexion a la base `cip` propia (separada de `core`, DOC-014 RNF-01/RNF-05) — ver
// devops/local/docker-compose.yml (servicio `postgres`, base creada por
// devops/local/postgres/init/03-cip.sh) y cip/aidlc-docs/design-artifacts/DOC-018-cip-servicio-nestjs.md §4.
const databaseEnvSchema = z.object({
  CIP_DB_HOST: z.string().min(1, 'es requerido'),
  CIP_DB_PORT: z.coerce.number().int().positive().default(5432),
  CIP_DB_NAME: z.string().min(1, 'es requerido'),
  CIP_DB_USER: z.string().min(1, 'es requerido'),
  CIP_DB_PASSWORD: z.string().min(1, 'es requerido'),
});

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function loadDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const parsed = databaseEnvSchema.safeParse(env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `Configuración de base de datos de CIP inválida: ${detalle}`,
    );
  }

  return {
    host: parsed.data.CIP_DB_HOST,
    port: parsed.data.CIP_DB_PORT,
    database: parsed.data.CIP_DB_NAME,
    user: parsed.data.CIP_DB_USER,
    password: parsed.data.CIP_DB_PASSWORD,
  };
}
