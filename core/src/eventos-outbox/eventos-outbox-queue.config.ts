import { z } from 'zod';

// ADR-005 — antes REDIS_URL (Redis/BullMQ), ahora la conexión Postgres dedicada que comparten
// core/ (productor) y cip/ (consumidor) para la cola `cip-eventos` vía pg-boss. Base separada de
// CORE_DB_*/CIP_DB_* a propósito (RNF-01/RNF-05): ni core ni cip se dan acceso a la base de datos
// del otro — esta es infraestructura de mensajería explícitamente compartida, no la base de
// dominio de ningún sistema.
const eventosOutboxQueueEnvSchema = z.object({
  EVENTOS_OUTBOX_DATABASE_URL: z.string().min(1, 'es requerido'),
});

export interface EventosOutboxQueueConfig {
  connectionString: string;
}

export function loadEventosOutboxQueueConfig(
  env: NodeJS.ProcessEnv = process.env,
): EventosOutboxQueueConfig {
  const parsed = eventosOutboxQueueEnvSchema.safeParse(env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de la cola de eventos inválida: ${detalle}`);
  }

  return { connectionString: parsed.data.EVENTOS_OUTBOX_DATABASE_URL };
}
