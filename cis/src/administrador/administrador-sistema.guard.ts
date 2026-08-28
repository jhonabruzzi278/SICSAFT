import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/auth/keycloak-auth.guard';

const ADMINISTRADOR_SISTEMA_ROLE = 'administrador-sistema';

// DOC-021 4 — a diferencia del resto de escrituras oficiales (Activo/Contrato/Área/...), esto NO
// pasa por CORE ni por el Motor de Auditoría de Tomo IV: es gestión de usuarios en el proveedor de
// identidad, así que un guard normal de CIS alcanza (no hace falta el patrón "verificar dentro del
// Orquestador para que el 403 quede auditado" de DOC-012 8, que existe específicamente para que la
// auditoría patrimonial capture los rechazos).
//
// Chequea el rol contra `:orgId` de la URL (organizacionId de CORE, ej. 'duoc-uc'). ADR-004 quitó
// la traducción de ids que este guard necesitaba con Zitadel (orgId numérico de Zitadel vs
// organizacionId de texto de CORE, resuelta antes vía ORGANIZACION_MAPPING/
// OrganizacionMappingDinamicoService): con Keycloak, `rolesPorOrganizacion` ya viene keyed por el
// mismo organizacionId que usa CORE (el alias de la Organization, ver
// KeycloakAdminService.crearOrganizacion) — comparación directa, sin resolver nada.
@Injectable()
export class AdministradorSistemaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { params: Record<string, string> }>();

    const organizacionId = request.params.orgId;
    const rolesPorOrganizacion = request.auth?.rolesPorOrganizacion ?? {};

    const roles = rolesPorOrganizacion[organizacionId] ?? [];
    if (roles.includes(ADMINISTRADOR_SISTEMA_ROLE)) {
      return true;
    }

    throw new ForbiddenException({
      message: `Requiere el rol ${ADMINISTRADOR_SISTEMA_ROLE} en la organización '${organizacionId}'`,
    });
  }
}
