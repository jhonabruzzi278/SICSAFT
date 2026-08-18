import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

const DEVICE_KEY_PREFIX = 'device:operador:';

// DOC-002 1: "un solo dispositivo por operador". El contrato de APP QR solo manda `deviceId` en
// POST /auth/session (no en catalogo/inventarios/estado) — ahí es el único punto donde CIS puede
// registrar o comparar el dispositivo activo; las otras 3 rutas siguen dependiendo solo del
// access token de Zitadel, que no lleva `deviceId`.
//
// Decisión de conflicto (confirmada explícitamente, no inferida de DOC-002 — el documento solo
// declara la restricción, no la resolución): el dispositivo nuevo **reemplaza** al viejo en vez
// de rechazarse. No existe todavía un rol Administrador (Fase 4) para destrabar manualmente a un
// operador, así que rechazar dejaría varado a cualquiera que pierda o cambie de celular. El
// registro expira solo (TTL = vigencia del token, ver QrConnectorService.authSession) — no hace
// falta un logout explícito.
//
// Mismo criterio de resiliencia que RedisRateLimiter (WAF 4, aislamiento de fallos): esto es una
// restricción de negocio complementaria, no un control de seguridad — Zitadel ya es quien
// autentica. Si Redis falla, no vale la pena bloquear auth/session por perder el tracking de
// dispositivo.
@Injectable()
export class DeviceRegistryService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async registerDevice(
    operadorId: string,
    deviceId: string,
    ttlMs: number,
  ): Promise<void> {
    try {
      await this.redis.set(
        `${DEVICE_KEY_PREFIX}${operadorId}`,
        deviceId,
        'PX',
        ttlMs,
      );
    } catch {
      // Falla abierto — ver comentario de clase.
    }
  }
}
