import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/auth/keycloak-auth.guard';
import { DIRECTIVO_ROLE } from './directivo.constants';

export interface DirectivoRequest extends AuthenticatedRequest {
  directivoOrganizacionId?: string;
}

// El guard siempre setea `request.directivoOrganizacionId` antes de dejar pasar la request (o
// lanza 403) — mismo patrón que requireAuthContext en zitadel-auth.guard.ts.
export function requireDirectivoOrganizacionId(
  request: DirectivoRequest,
): string {
  if (!request.directivoOrganizacionId) {
    throw new ForbiddenException({
      message: `Requiere el rol ${DIRECTIVO_ROLE}`,
    });
  }
  return request.directivoOrganizacionId;
}

// DOC-022 3 — a diferencia de AdministradorSistemaGuard (que lee `:orgId` de la URL porque
// Administrador del Sistema puede operar sobre cualquier organización), el Directivo solo puede
// operar sobre LA SUYA — este controller nunca acepta un organizacionId de ruta o body, siempre
// se deriva del propio JWT ya validado por ZitadelAuthGuard (cero confianza en lo que manda el
// cliente, mismo criterio que el resto de CIS).
//
// Si el rol `directivo` aparece en más de una organización del token se rechaza en vez de
// adivinar cuál usar: hoy ningún flujo asigna `directivo` a la misma persona en más de una
// organización, así que la ambigüedad es una configuración inesperada, no un caso válido que
// resolver con un default silencioso.
@Injectable()
export class DirectivoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<DirectivoRequest>();
    const rolesPorOrganizacion = request.auth?.rolesPorOrganizacion ?? {};

    const organizacionesConRol = Object.entries(rolesPorOrganizacion)
      .filter(([, roles]) => roles.includes(DIRECTIVO_ROLE))
      .map(([organizacionId]) => organizacionId);

    if (organizacionesConRol.length !== 1) {
      throw new ForbiddenException({
        message: `Requiere el rol ${DIRECTIVO_ROLE} en exactamente una organización`,
      });
    }

    request.directivoOrganizacionId = organizacionesConRol[0];
    return true;
  }
}
