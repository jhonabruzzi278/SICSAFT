import { z } from 'zod';

// Fase 6 — mismo mecanismo que ya usa CIS (cis/src/redis/redis.config.ts) para su rate limiter:
// URL de conexion a Redis (devops/local/docker-compose.yml, servicio `redis`), ya provisionado
// desde ADR-001 pero sin consumidor todavia en CORE. Config propia de CORE (no se comparte el
// modulo de CIS entre desplegables distintos, WAF 1 — cada sistema es su propio desplegable).
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
