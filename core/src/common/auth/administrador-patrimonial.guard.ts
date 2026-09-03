import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { ServiceAuthenticatedRequest } from './service-token.guard';

// Rol de Proyecto en Zitadel (DOC-012 2) — unico autorizado a escritura oficial de la Base
// Patrimonial (Tomo III 1.4 Entrada 4).
export const ADMINISTRADOR_PATRIMONIAL_ROLE = 'administrador-patrimonial';

interface EscrituraOficialBody {
  organizacionId?: unknown;
  rolesPorOrganizacion?: unknown;
}

function esRecordDeRoles(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Chequeo puro, reutilizable tanto por el guard de abajo como por OrquestadorService (DOC-012
// 5-7): los endpoints de escritura oficial de Activo NO usan este guard via @UseGuards() —
// invocan esta funcion dentro del propio Orquestador para que un 403 por falta de rol quede
// auditado igual que cualquier otro rechazo (DOC-012 8; un guard corta antes de que el
// Orquestador pueda envolver el error en su try/catch, asi que auditar ahi requeria mover el
// chequeo adentro).
//
// Siempre valida el rol CONTRA `organizacionId` — nunca "¿tiene el rol en algun lado?". El rol es
// de Proyecto en Zitadel pero asignado por organizacion (DOC-012 2); una version anterior de
// este chequeo aceptaba una lista plana de roles sin organizacion, lo que le permitia a un
// administrador-patrimonial de la Organizacion A escribir sobre activos de la Organizacion B
// (hallazgo real de revision de seguridad, corregido en este mismo incremento — ver tambien el
// cruce adicional contra la organizacion real del activo en ActivoRepository).
// `verificarRolesPermitidos` es generico (acepta una lista de roles) pero hoy solo lo invoca
// `verificarRolAdministradorPatrimonial` de abajo con un unico rol — la variante multi-rol se
// habia agregado para Contrato/Organizacion (DOC-021 2), camino que se elimino en 2026-09 con el
// portal web_admin/.
export function verificarRolesPermitidos(
  rolesPorOrganizacion: unknown,
  organizacionId: string,
  rolesPermitidos: readonly string[],
): void {
  const mapa = esRecordDeRoles(rolesPorOrganizacion)
    ? rolesPorOrganizacion
    : {};
  const rolesEnOrganizacion = mapa[organizacionId];
  const lista = Array.isArray(rolesEnOrganizacion) ? rolesEnOrganizacion : [];
  if (!rolesPermitidos.some((rol) => lista.includes(rol))) {
    throw new ForbiddenException(
      `Requiere alguno de estos roles en la organizacion '${organizacionId}': ${rolesPermitidos.join(', ')}`,
    );
  }
}

export function verificarRolAdministradorPatrimonial(
  rolesPorOrganizacion: unknown,
  organizacionId: string,
): void {
  return verificarRolesPermitidos(rolesPorOrganizacion, organizacionId, [
    ADMINISTRADOR_PATRIMONIAL_ROLE,
  ]);
}

// CIS certifica que Zitadel firmo el rol en esa organizacion (ZitadelAuthGuard.rolesPorOrganizacion,
// DOC-012 3.1) y lo reenvia en el body de cada llamada de escritura oficial (mismo canal
// service-to-service ya protegido por ServiceTokenGuard/CORE_SERVICE_TOKEN). CORE nunca confia en
// que "si CIS dejo pasar el request, ya esta autorizado" (WAF 3, cero confianza entre niveles;
// DOC-012 3.2) — pero este guard en si (a diferencia de `verificarRolAdministradorPatrimonial`)
// no se usa en los endpoints reales de escritura de Activo (ver arriba); queda disponible para un
// futuro caso donde cortar antes del Orquestador sea aceptable (sin auditoria de rechazo).
//
// Nunca usar este guard sin ServiceTokenGuard antes en la cadena — un body sin haber pasado por
// ServiceTokenGuard es autodeclarado por cualquier caller, no un hecho confiable.
// `serviceAuthenticated` (seteado por ServiceTokenGuard) hace explicita esa dependencia y falla
// cerrado si algun endpoint futuro se olvida de encadenar ambos guards.
@Injectable()
export class AdministradorPatrimonialGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<ServiceAuthenticatedRequest>();

    if (request.serviceAuthenticated !== true) {
      throw new ForbiddenException(
        'AdministradorPatrimonialGuard requiere ServiceTokenGuard antes en la cadena de guards',
      );
    }

    const body = request.body as EscrituraOficialBody | undefined;
    const organizacionId =
      typeof body?.organizacionId === 'string' ? body.organizacionId : '';
    verificarRolAdministradorPatrimonial(
      body?.rolesPorOrganizacion,
      organizacionId,
    );
    return true;
  }
}
