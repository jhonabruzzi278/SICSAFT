import type { RateLimitOptions, RateLimitResult } from './rate-limit.types';

interface Contador {
  cuenta: number;
  // epoch ms — fin de la ventana actual.
  expiraEn: number;
}

// ADR-005 — reemplaza a RedisRateLimiter. `cis/` no tiene Postgres (proxy delgado sin estado) y
// corre como instancia única en los 3 perfiles de devops/ hoy (sin réplicas) — un Map en memoria
// del propio proceso implementa la misma ventana fija que el script Lua INCR+PEXPIRE original,
// sin depender de ningún proceso externo. Sin I/O de red no hay nada que "falle": el
// comportamiento "falla abierto" del limiter original (WAF 4, aislamiento de fallos) queda
// automáticamente satisfecho, no hace falta try/catch.
//
// NOTA DE HONESTIDAD: las entradas nunca se limpian activamente entre ventanas (a diferencia de
// Redis, que expiraba la clave sola) — el Map crece con la cantidad de claves *distintas* vistas
// alguna vez (hoy, un operador por clave), no con el volumen de requests. Al tamaño real de
// operadores concurrentes de este ecosistema es despreciable; si esto se vuelve un problema real,
// agregar un barrido periódico (mismo patrón que usa `rate-limiter-flexible` internamente) es la
// solución, no se implementa preventivamente (YAGNI).
export class InMemoryRateLimiter {
  private readonly contadores = new Map<string, Contador>();

  constructor(private readonly options: RateLimitOptions) {}

  consume(key: string): RateLimitResult {
    const ahora = Date.now();
    const contador = this.contadores.get(key);

    if (!contador || contador.expiraEn <= ahora) {
      this.contadores.set(key, {
        cuenta: 1,
        expiraEn: ahora + this.options.windowMs,
      });
      return { allowed: true, retryAfterMs: 0 };
    }

    contador.cuenta += 1;
    if (contador.cuenta <= this.options.maxRequests) {
      return { allowed: true, retryAfterMs: 0 };
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(contador.expiraEn - ahora, 0),
    };
  }
}
