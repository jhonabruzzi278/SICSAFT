import { z } from 'zod';

// ADR-005 — mismo EVENTOS_OUTBOX_DATABASE_URL que ya consume
// core/src/eventos-outbox/eventos-outbox-queue.config.ts (el productor) — CIP es el consumidor de
// la misma cola `cip-eventos` vía pg-boss. Base dedicada, separada de CORE_DB_*/CIP_DB_* a
// propósito (RNF-01/RNF-05): es infraestructura de mensajería explícitamente compartida, no la
// base de dominio de ningún sistema.
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
