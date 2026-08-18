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

const ADMINISTRADOR_SISTEMA_ROLE = 'administrador-sistema';

// DOC-021 4 — a diferencia del resto de escrituras oficiales (Activo/Contrato/Área/...), esto NO
// pasa por CORE ni por el Motor de Auditoría de Tomo IV: es gestión de usuarios en Zitadel, así
// que un guard normal de CIS alcanza (no hace falta el patrón "verificar dentro del Orquestador
// para que el 403 quede auditado" de DOC-012 8, que existe específicamente para que la
// auditoría patrimonial capture los rechazos).
//
// Chequea el rol contra `:orgId` de la URL (organizacionId de CORE, ej. 'duoc-uc' — mismo id que
// usa el resto de endpoints de administrador.controller.ts) — traduce `rolesPorOrganizacion` de
// claves Zitadel a claves CORE con el mismo ORGANIZACION_MAPPING que AdministradorService, para
// no duplicar esa traducción con una lógica distinta.
@Injectable()
export class AdministradorSistemaGuard implements CanActivate {
  constructor(
    @Inject(ORGANIZACION_MAPPING)
    private readonly organizacionMapping: OrganizacionMapping,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { params: Record<string, string> }>();

    const organizacionId = request.params.orgId;
    const rolesPorOrganizacionZitadel =
      request.auth?.rolesPorOrganizacion ?? {};

    const tieneElRol = Object.entries(rolesPorOrganizacionZitadel).some(
      ([zitadelOrgId, roles]) =>
        this.organizacionMapping[zitadelOrgId] === organizacionId &&
        roles.includes(ADMINISTRADOR_SISTEMA_ROLE),
    );

    if (!tieneElRol) {
      throw new ForbiddenException({
        message: `Requiere el rol ${ADMINISTRADOR_SISTEMA_ROLE} en la organización '${organizacionId}'`,
      });
    }
    return true;
  }
}
