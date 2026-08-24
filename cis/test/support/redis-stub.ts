export interface RedisStub {
  eval: jest.Mock;
  pttl: jest.Mock;
  set: jest.Mock;
  get: jest.Mock;
  mset: jest.Mock;
  disconnect: jest.Mock;
}

// RateLimitGuard (WAF 4) — stub que por defecto siempre permite (count=1), no hace falta un
// Redis real para probar el resto de un conector. Compartido entre e2e specs (evitaba
// duplicacion real, marcada por SonarCloud). `get`/`mset` (Gap 0, OrganizacionMappingDinamicoService)
// — default `get` a `null` ("sin mapeo dinamico todavia", mismo comportamiento seguro por defecto
// que el servicio ya asume si Redis fallara).
export function crearRedisStub(): RedisStub {
  return {
    eval: jest.fn().mockResolvedValue(1),
    pttl: jest.fn().mockResolvedValue(0),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    mset: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
  };
}
