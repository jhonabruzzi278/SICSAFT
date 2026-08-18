import { z } from 'zod';

// Mismo REDIS_URL que ya consume core/src/eventos-outbox/redis.config.ts (el productor) — CIP es
// el consumidor de la misma cola `cip-eventos`.
const redisEnvSchema = z.object({
  REDIS_URL: z.string().min(1, 'es requerido'),
});

export interface RedisConnectionConfig {
  url: string;
}

export function loadRedisConfig(
  env: NodeJS.ProcessEnv = process.env,
): RedisConnectionConfig {
  const parsed = redisEnvSchema.safeParse(env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de Redis inválida: ${detalle}`);
  }

  return { url: parsed.data.REDIS_URL };
}
