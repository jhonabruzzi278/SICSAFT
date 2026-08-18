import type { Redis } from 'ioredis';
import type { RateLimitOptions, RateLimitResult } from './rate-limit.types';

// Ventana fija atomica: INCR + PEXPIRE en un unico script Lua. Necesario para evitar el race
// condition de hacer esos dos comandos por separado — dos requests concurrentes podrian ver
// count===1 al mismo tiempo y ambas resetear el TTL, dejando la ventana sin expirar nunca.
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

// WAF 4 "rate limiting hacia el CORE" + pilar de resiliencia "aislamiento de fallos": si Redis
// no responde, el rate limiter no debe tumbar el flujo real Captura -> CIS -> CORE. Falla abierto
// (deja pasar la request) en vez de cerrado — un Redis caido nunca debe bloquear operadores
// legitimos, la proteccion que se pierde es aceptable frente a bloquear el ecosistema completo.
export class RedisRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly options: RateLimitOptions,
  ) {}

  async consume(key: string): Promise<RateLimitResult> {
    let count: number;
    try {
      count = (await this.redis.eval(
        INCREMENT_SCRIPT,
        1,
        key,
        this.options.windowMs,
      )) as number;
    } catch {
      return { allowed: true, retryAfterMs: 0 };
    }

    if (count <= this.options.maxRequests) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const ttl = await this.redis.pttl(key).catch(() => 0);
    return { allowed: false, retryAfterMs: Math.max(ttl, 0) };
  }
}
