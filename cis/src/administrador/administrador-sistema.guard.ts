import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/auth/zitadel-auth.guard';
import { ORGANIZACION_MAPPING } from './administrador.constants';
import type { OrganizacionMapping } from './organizacion-mapping.config';
import { OrganizacionMappingDinamicoService } from './organizacion-mapping-dinamico.service';

const ADMINISTRADOR_SISTEMA_ROLE = 'administrador-sistema';

// DOC-021 4 — a diferencia del resto de escrituras oficiales (Activo/Contrato/Área/...), esto NO
// pasa por CORE ni por el Motor de Auditoría de Tomo IV: es gestión de usuarios en Zitadel, así
// que un guard normal de CIS alcanza (no hace falta el patrón "verificar dentro del Orquestador
// para que el 403 quede auditado" de DOC-012 8, que existe específicamente para que la
// auditoría patrimonial capture los rechazos).
//
// Chequea el rol contra `:orgId` de la URL (organizacionId de CORE, ej. 'duoc-uc' — mismo id que
// usa el resto de endpoints de administrador.controller.ts) — traduce `rolesPorOrganizacion` de
// claves Zitadel a claves CORE. Gap 0 (hallazgo real, verificado contra el Zitadel de
// devops/local): este guard tiene su PROPIA traducción, separada de
// AdministradorService.traducirAOrganizacionesCore — corregir una sin la otra deja este endpoint
// (`/admin/organizaciones/:orgId/usuarios`, la pestaña Usuarios de web_admin) devolviendo 403 para
// cualquier organización creada después de este incremento, aunque el resto de la app ya la
// reconozca. Mismo fallback: mapa estático primero, mapeo dinámico (organizaciones creadas via
// altaOrganizacion) después.
@Injectable()
export class AdministradorSistemaGuard implements CanActivate {
  constructor(
    @Inject(ORGANIZACION_MAPPING)
    private readonly organizacionMapping: OrganizacionMapping,
    private readonly organizacionMappingDinamico: OrganizacionMappingDinamicoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { params: Record<string, string> }>();

    const organizacionId = request.params.orgId;
    const rolesPorOrganizacionZitadel =
      request.auth?.rolesPorOrganizacion ?? {};

    for (const [zitadelOrgId, roles] of Object.entries(
      rolesPorOrganizacionZitadel,
    )) {
      if (!roles.includes(ADMINISTRADOR_SISTEMA_ROLE)) {
        continue;
      }
      const organizacionIdTraducido =
        this.organizacionMapping[zitadelOrgId] ??
        (await this.organizacionMappingDinamico.resolverOrganizacionId(
          zitadelOrgId,
        ));
      if (organizacionIdTraducido === organizacionId) {
        return true;
      }
    }

    throw new ForbiddenException({
      message: `Requiere el rol ${ADMINISTRADOR_SISTEMA_ROLE} en la organización '${organizacionId}'`,
    });
  }
}
