import { Injectable } from '@nestjs/common';

const DEVICE_KEY_PREFIX = 'device:operador:';

interface RegistroDispositivo {
  deviceId: string;
  timer: NodeJS.Timeout;
}

// DOC-002 1: "un solo dispositivo por operador". El contrato de APP QR solo manda `deviceId` en
// POST /auth/session (no en catalogo/inventarios/estado) — ahí es el único punto donde CIS puede
// registrar o comparar el dispositivo activo; las otras 3 rutas siguen dependiendo solo del
// access token de Keycloak, que no lleva `deviceId`.
//
// Decisión de conflicto (confirmada explícitamente, no inferida de DOC-002 — el documento solo
// declara la restricción, no la resolución): el dispositivo nuevo **reemplaza** al viejo en vez
// de rechazarse. No existe todavía un rol Administrador (Fase 4) para destrabar manualmente a un
// operador, así que rechazar dejaría varado a cualquiera que pierda o cambie de celular. El
// registro expira solo (TTL = vigencia del token, ver QrConnectorService.authSession) — no hace
// falta un logout explícito.
//
// ADR-005 — reemplaza al backend Redis por un Map en memoria del propio proceso (mismo criterio
// que InMemoryRateLimiter: cis/ no tiene Postgres, corre como instancia única). Es una restricción
// de negocio complementaria, no un control de seguridad (Keycloak ya autentica) — perder este
// estado en un reinicio del proceso ya era aceptable con Redis, que tampoco persistía en disco por
// defecto acá.
@Injectable()
export class DeviceRegistryService {
  private readonly registros = new Map<string, RegistroDispositivo>();

  registerDevice(operadorId: string, deviceId: string, ttlMs: number): void {
    const clave = `${DEVICE_KEY_PREFIX}${operadorId}`;

    // Un dispositivo nuevo reemplaza al viejo (ver comentario de clase) — hay que cancelar el
    // timer anterior explícitamente, si no, cuando venza terminaría borrando el registro nuevo en
    // vez del que reemplazó.
    const anterior = this.registros.get(clave);
    if (anterior) {
      clearTimeout(anterior.timer);
    }

    const timer = setTimeout(() => this.registros.delete(clave), ttlMs);
    timer.unref();
    this.registros.set(clave, { deviceId, timer });
  }
}
