export interface RateLimitOptions {
  // Requests permitidas dentro de la ventana.
  maxRequests: number;
  // Duración de la ventana, en milisegundos.
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  // Tiempo restante de la ventana actual, en milisegundos. Solo tiene sentido cuando
  // `allowed` es `false`.
  retryAfterMs: number;
}
