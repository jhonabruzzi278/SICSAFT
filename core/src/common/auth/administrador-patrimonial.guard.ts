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

// Rol de Proyecto en Zitadel (DOC-021 1) — administracion de la plataforma (organizaciones,
// contratos, usuarios, indicadores), nunca de informacion patrimonial. Mismo mecanismo que
// ADMINISTRADOR_PATRIMONIAL_ROLE (rol de Proyecto asignado por organizacion), sin cambios en
// ZitadelAuthGuard — generico por nombre de rol (mismo precedente que `directivo`, DOC-020).
export const ADMINISTRADOR_SISTEMA_ROLE = 'administrador-sistema';

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
// Generalizacion (DOC-021 2) — Contrato pasa a aceptar administrador-patrimonial O
// administrador-sistema (Tomo III 1.4 ya se lo exigia al primero, no se le quita esa capacidad;
// el segundo la gana para poder administrar la plataforma). Los endpoints puramente
// patrimoniales (Activo, Catalogo, Documento) siguen usando solo
// verificarRolAdministradorPatrimonial (wrapper de abajo, un solo rol) y los puramente
// administrativos (Organizacion) usan [ADMINISTRADOR_SISTEMA_ROLE] en solitario.
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

// DOC-022 3 — variante sin `organizacionId`, para el unico caso donde no tiene sentido pedirlo:
// crear una Organizacion nueva. `verificarRolesPermitidos` de arriba (usado por
// Activo/Contrato/Catalogo/Documento) exige el rol DENTRO de una organizacionId puntual a
// proposito (evita que alguien de la Organizacion A escriba sobre la Organizacion B) — pero
// Administrador del Sistema administra la plataforma entera, no pertenece a una organizacion de
// negocio en particular. Antes de esta funcion, `procesarAltaOrganizacion` reusaba el chequeo de
// arriba con un organizacionId inventado por el cliente ("la primera organizacion que administro"),
// lo que en la practica forzaba a que el grant de administrador-sistema viviera dentro de una
// organizacion especifica para que el chequeo pasara — incorrecto para un rol que no deberia
// depender de ninguna. Alcanza con que el rol aparezca en CUALQUIER entrada de
// rolesPorOrganizacion.
export function verificarRolEnCualquierOrganizacion(
  rolesPorOrganizacion: unknown,
  rolesPermitidos: readonly string[],
): void {
  const mapa = esRecordDeRoles(rolesPorOrganizacion) ? rolesPorOrganizacion : {};
  const tieneAlguno = Object.values(mapa).some((roles) => {
    const lista = Array.isArray(roles) ? roles : [];
    return rolesPermitidos.some((rol) => lista.includes(rol));
  });
  if (!tieneAlguno) {
    throw new ForbiddenException(
      `Requiere alguno de estos roles en alguna organizacion: ${rolesPermitidos.join(', ')}`,
    );
  }
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
