import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/auth/keycloak-auth.guard';

const ADMINISTRADOR_SISTEMA_ROLE = 'administrador-sistema';

// DOC-023 3 — hallazgo real: GET /admin/indicadores no tenia guard de rol en el backend, solo
// ocultamiento en la UI de web_admin (esAdministradorSistema, cliente). A diferencia de
// AdministradorSistemaGuard (que chequea el rol contra un `:orgId` puntual de la URL), este
// endpoint no tiene organizacionId propio — son indicadores agregados de TODA la plataforma, asi
// que el chequeo correcto es "el rol aparece en cualquier organizacion del token", mismo criterio
// que `verificarRolEnCualquierOrganizacion` en CORE (administrador-patrimonial.guard.ts) usa para
// el alta de Organizacion. No reusa esa funcion porque vive en CORE (este endpoint nunca pasa por
// el Orquestador, ver comentario en indicadores.controller.ts de CORE) — misma logica, guard de
// CIS porque es el unico punto donde se puede cortar esta request.
@Injectable()
export class AdministradorSistemaEnCualquierOrganizacionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rolesPorOrganizacion = request.auth?.rolesPorOrganizacion ?? {};

    const tieneElRol = Object.values(rolesPorOrganizacion).some((roles) =>
      roles.includes(ADMINISTRADOR_SISTEMA_ROLE),
    );

    if (!tieneElRol) {
      throw new ForbiddenException({
        message: `Requiere el rol ${ADMINISTRADOR_SISTEMA_ROLE} en alguna organización`,
      });
    }
    return true;
  }
}
