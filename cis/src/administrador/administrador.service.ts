import { Inject, Injectable } from '@nestjs/common';
import { CoreClientService } from '../core-client/core-client.service';
import type {
  ActivoResult,
  ContratoResult,
} from '../core-client/core-client.types';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import { ORGANIZACION_MAPPING } from './administrador.constants';
import type { OrganizacionMapping } from './organizacion-mapping.config';
import type {
  AltaActivoBody,
  AltaContratoBody,
  ActualizarContratoBody,
} from './administrador.schemas';

// DOC-012 §5 (Fase 4/5) — puente WEB->CIS->CORE para la escritura oficial de Activo. WEB nunca
// le habla a CORE directo (regla no negociable de CLAUDE.md) — este servicio traduce el contexto
// ya autenticado por Zitadel (ZitadelAuthGuard) al contrato de escritura oficial que CORE espera
// (DOC-012 §3.3).
@Injectable()
export class AdministradorService {
  constructor(
    private readonly coreClientService: CoreClientService,
    @Inject(ORGANIZACION_MAPPING)
    private readonly organizacionMapping: OrganizacionMapping,
  ) {}

  altaActivo(
    body: AltaActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivo(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: this.traducirAOrganizacionesCore(
          auth.rolesPorOrganizacion,
        ),
      },
      correlationId,
    );
  }

  // DOC-012 §4 — lectura abierta, no necesita traducir rolesPorOrganizacion (CORE no exige rol
  // para GET /contratos, mismo criterio que GET /catalogo).
  getContratos(correlationId: string): Promise<ContratoResult[]> {
    return this.coreClientService.getContratos(correlationId);
  }

  altaContrato(
    body: AltaContratoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ContratoResult> {
    return this.coreClientService.postContrato(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: this.traducirAOrganizacionesCore(
          auth.rolesPorOrganizacion,
        ),
      },
      correlationId,
    );
  }

  actualizarEstadoContrato(
    contratoId: string,
    body: ActualizarContratoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ContratoResult> {
    return this.coreClientService.patchContrato(
      contratoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: this.traducirAOrganizacionesCore(
          auth.rolesPorOrganizacion,
        ),
      },
      correlationId,
    );
  }

  // `auth.rolesPorOrganizacion` viene keyed por organizacionId de ZITADEL (lo que Zitadel firmo
  // en el claim) — CORE necesita la clave en el organizacionId que EL conoce (ver
  // organizacion-mapping.config.ts). Una organizacion sin entrada en el mapeo simplemente no
  // aparece en el resultado (nunca se inventa una clave) — CORE la rechaza con 403 igual que si
  // el operador no tuviera el rol ahí, comportamiento correcto y seguro por defecto.
  private traducirAOrganizacionesCore(
    rolesPorOrganizacionZitadel: Record<string, string[]>,
  ): Record<string, string[]> {
    const resultado: Record<string, string[]> = {};
    for (const [zitadelOrgId, roles] of Object.entries(
      rolesPorOrganizacionZitadel,
    )) {
      const organizacionId = this.organizacionMapping[zitadelOrgId];
      if (organizacionId) {
        resultado[organizacionId] = roles;
      }
    }
    return resultado;
  }
}
