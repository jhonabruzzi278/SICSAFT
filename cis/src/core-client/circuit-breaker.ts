// WAF §4: "circuit breaker en el CIS hacia el CORE... si un sistema externo empieza a fallar,
// el CIS deja de insistir temporalmente en vez de propagar la falla hacia arriba". Implementacion
// propia (no una libreria) — el algoritmo es chico y bien acotado (3 estados, 2 parametros), y
// una dependencia nueva para esto seria mas superficie que resolver.
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  // Fallos consecutivos antes de abrir el circuito.
  failureThreshold: number;
  // Cuanto tiempo se mantiene abierto antes de permitir un intento de sondeo (half-open).
  resetTimeoutMs: number;
}

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuito abierto: CORE viene fallando, no se reintenta todavia');
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.debeIntentarSondeo()) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError();
      }
    }

    try {
      const resultado = await fn();
      this.onSuccess();
      return resultado;
    } catch (error: unknown) {
      this.onFailure();
      throw error;
    }
  }

  private debeIntentarSondeo(): boolean {
    return (
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.options.resetTimeoutMs
    );
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
    this.openedAt = null;
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;
    // Un fallo en half-open vuelve a abrir de inmediato — el sondeo no salio bien.
    if (
      this.state === 'half-open' ||
      this.consecutiveFailures >= this.options.failureThreshold
    ) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }
}
