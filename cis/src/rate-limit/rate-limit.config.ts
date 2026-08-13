import { z } from 'zod';
import { loadEnvConfig } from '../common/load-env-config';

// URL de conexión a Redis (ver devops/local/docker-compose.yml, servicio `redis`), ej.
// `redis://:password@redis:6379`. Redis ya está en el stack decidido (ADR-001) pero esta es la
// primera vez que un servicio de código lo consume — hoy solo para rate limiting (WAF §4).
const redisEnvSchema = z.object({
  REDIS_URL: z.string().min(1, 'es requerido'),
});

export interface RedisConnectionConfig {
  url: string;
}

export function loadRedisConfig(
  env: NodeJS.ProcessEnv = process.env,
): RedisConnectionConfig {
  const parsed = loadEnvConfig(redisEnvSchema, env, 'Redis');
  return { url: parsed.REDIS_URL };
}
