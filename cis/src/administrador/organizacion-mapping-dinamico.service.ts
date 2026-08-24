import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

const ZITADEL_A_CORE_PREFIX = 'organizacion-mapping:zitadel-a-core:';
const CORE_A_ZITADEL_PREFIX = 'organizacion-mapping:core-a-zitadel:';

// Cierra el gap real de ZITADEL_ORG_ID_MAP (organizacion-mapping.config.ts): ese mapa estático
// solo cubre organizaciones legacy con id de CORE distinto del id de Zitadel (ej. 'duoc-uc',
// sembrada antes de que existiera POST /admin/organizaciones). Desde DOC-021/022,
// organizacion.repository.ts en CORE inserta `id = body.id` — el id real de Zitadel — así que
// toda organización nueva ya usa el mismo id en ambos lados por construcción. Acá se registra esa
// correspondencia explícitamente en el momento exacto en que AdministradorService.altaOrganizacion
// la crea (nunca se infiere ni se asume): mismo espíritu que el comentario de
// traducirAOrganizacionesCore ("nunca se inventa una clave"), solo que la clave ahora se declara
// en el instante de creación legítima en vez de exigir una edición manual de env var + redeploy.
//
// Redis en vez de una tabla propia: CIS no tiene base de datos propia, y esto es exactamente el
// mismo patrón ya usado por DeviceRegistryService (mismo REDIS_CLIENT global). A diferencia de
// ese servicio (una restricción de negocio complementaria, "falla abierto" sin problema), acá el
// dato es parte del camino de autorización de escritura — por eso `registrar` propaga el error de
// Redis en vez de tragarlo: un alta de organización que no puede registrar su mapeo debe fallar
// visiblemente, no quedar en un estado a medias donde la organización existe pero nadie puede
// escribir nada en ella sin que quede rastro de por qué. `resolver*`, en cambio, sí devuelven
// `null` si Redis falla — el resultado es idéntico a "sin mapeo dinámico todavía", el mismo
// comportamiento seguro por defecto que ya existía antes de este cambio.
@Injectable()
export class OrganizacionMappingDinamicoService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async registrar(zitadelOrgId: string, organizacionId: string): Promise<void> {
    await this.redis.mset(
      `${ZITADEL_A_CORE_PREFIX}${zitadelOrgId}`,
      organizacionId,
      `${CORE_A_ZITADEL_PREFIX}${organizacionId}`,
      zitadelOrgId,
    );
  }

  async resolverOrganizacionId(zitadelOrgId: string): Promise<string | null> {
    try {
      return await this.redis.get(`${ZITADEL_A_CORE_PREFIX}${zitadelOrgId}`);
    } catch {
      return null;
    }
  }

  async resolverZitadelOrgId(organizacionId: string): Promise<string | null> {
    try {
      return await this.redis.get(`${CORE_A_ZITADEL_PREFIX}${organizacionId}`);
    } catch {
      return null;
    }
  }
}
