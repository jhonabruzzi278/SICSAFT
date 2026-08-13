import { z } from 'zod';
import { loadEnvConfig } from '../common/load-env-config';

// URL de conexión a Redis (ver devops/local/docker-compose.yml, servicio `redis`), ej.
// `redis://:password@redis:6379`. Redis ya está en el stack decidido (ADR-001) — consumido por
// src/rate-limit/ (WAF §4) y src/device-registry/ (DOC-002 §1), ambos comparten este cliente.
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
