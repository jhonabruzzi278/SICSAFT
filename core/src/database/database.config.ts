import { z } from 'zod';

// Conexion a la base `core` del postgres compartido — ver
// devops/local/docker-compose.yml (servicio `postgres`, base creada por
// devops/local/postgres/init/02-core.sh) y base-patrimonial/DOC-004-modelo-contrato.md.
const databaseEnvSchema = z.object({
  CORE_DB_HOST: z.string().min(1, 'es requerido'),
  CORE_DB_PORT: z.coerce.number().int().positive().default(5432),
  CORE_DB_NAME: z.string().min(1, 'es requerido'),
  CORE_DB_USER: z.string().min(1, 'es requerido'),
  CORE_DB_PASSWORD: z.string().min(1, 'es requerido'),
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
      `Configuración de base de datos de CORE inválida: ${detalle}`,
    );
  }

  return {
    host: parsed.data.CORE_DB_HOST,
    port: parsed.data.CORE_DB_PORT,
    database: parsed.data.CORE_DB_NAME,
    user: parsed.data.CORE_DB_USER,
    password: parsed.data.CORE_DB_PASSWORD,
  };
}
