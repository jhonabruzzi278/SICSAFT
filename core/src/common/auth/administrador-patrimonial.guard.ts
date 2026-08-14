import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { ServiceAuthenticatedRequest } from './service-token.guard';

// Rol de Proyecto en Zitadel (DOC-012 §2) — unico autorizado a escritura oficial de la Base
// Patrimonial (Tomo III §1.4 Entrada 4).
export const ADMINISTRADOR_PATRIMONIAL_ROLE = 'administrador-patrimonial';

interface EscrituraOficialBody {
  roles?: unknown;
}

// CIS certifica que Zitadel firmo el rol (ZitadelAuthGuard.roles, DOC-012 §3.1) y lo reenvia en
// el body de cada llamada de escritura oficial (mismo canal service-to-service ya protegido por
// ServiceTokenGuard/CORE_SERVICE_TOKEN). Este guard es quien decide autorizar o no — CORE nunca
// confia en que "si CIS dejo pasar el request, ya esta autorizado" (WAF §3, cero confianza entre
// niveles; DOC-012 §3.2).
//
// Nunca usar este guard sin ServiceTokenGuard antes en la cadena — un `roles` de body sin haber
// pasado por ServiceTokenGuard es un campo auto-declarado por cualquier caller, no un hecho
// confiable. `serviceAuthenticated` (seteado por ServiceTokenGuard) hace explicita esa
// dependencia y falla cerrado si algun endpoint futuro se olvida de encadenar ambos guards
// (hallazgo de la revision de seguridad de este mismo incremento).
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
    const roles = Array.isArray(body?.roles) ? body.roles : [];

    if (!roles.includes(ADMINISTRADOR_PATRIMONIAL_ROLE)) {
      throw new ForbiddenException(
        `Requiere el rol ${ADMINISTRADOR_PATRIMONIAL_ROLE}`,
      );
    }
    return true;
  }
}
