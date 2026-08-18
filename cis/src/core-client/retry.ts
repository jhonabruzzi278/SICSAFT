// WAF 4: "reintentos con backoff exponencial + límite de intentos, nunca reintento inmediato en
// bucle" — evita la estampida sobre un CORE que ya está degradado. Solo tiene sentido reintentar
// fallos transitorios (sin respuesta / 5xx); un 400/404/409 es un rechazo permanente (DOC-002
// 5) y reintentarlo no cambia el resultado — por eso `shouldRetry` es responsabilidad de quien
// llama, no de este helper.
export interface RetryOptions {
  // Intentos totales, incluido el primero.
  maxAttempts: number;
  // Delay antes del primer reintento; se duplica en cada intento siguiente (backoff exponencial).
  baseDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt >= options.maxAttempts || !options.shouldRetry(error)) {
        throw error;
      }
      await sleep(options.baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
