export interface RedisStub {
  eval: jest.Mock;
  pttl: jest.Mock;
  set: jest.Mock;
  disconnect: jest.Mock;
}

// RateLimitGuard (WAF 4) — stub que por defecto siempre permite (count=1), no hace falta un
// Redis real para probar el resto de un conector. Compartido entre e2e specs (evitaba
// duplicacion real, marcada por SonarCloud).
export function crearRedisStub(): RedisStub {
  return {
    eval: jest.fn().mockResolvedValue(1),
    pttl: jest.fn().mockResolvedValue(0),
    set: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
  };
}
