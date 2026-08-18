import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CoreClientService } from '../core-client/core-client.service';
import { ZitadelAdminService } from '../zitadel-admin/zitadel-admin.service';
import type { GrantUsuario } from '../zitadel-admin/zitadel-admin.types';
import type {
  ActivoResult,
  AreaResult,
  AreasPaginaResult,
  AuditoriaFiltro,
  AuditoriaPaginaResult,
  CatalogoTipoResult,
  ContratoResult,
  ContratosPaginaResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  IndicadoresResult,
  OrganizacionResult,
  Paginacion,
  ResponsableResult,
  ResponsablesPaginaResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import { ORGANIZACION_MAPPING } from './administrador.constants';
import type { OrganizacionMapping } from './organizacion-mapping.config';
import type {
  ActualizarDescripcionActivoBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaContratoBody,
  AltaDocumentoActivoBody,
  AltaOrganizacionBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  ActualizarAreaBody,
  ActualizarContratoBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AsignarUsuarioOrganizacionBody,
  CambioResponsableActivoBody,
  EscrituraOficialActivoBody,
  ImportacionContableBody,
} from './administrador.schemas';

// DOC-012 5 (Fase 4/5) — puente WEB->CIS->CORE para la escritura oficial de Activo. WEB nunca
// le habla a CORE directo (regla no negociable de CLAUDE.md) — este servicio traduce el contexto
// ya autenticado por Zitadel (ZitadelAuthGuard) al contrato de escritura oficial que CORE espera
// (DOC-012 3.3).
@Injectable()
export class AdministradorService {
  constructor(
    private readonly coreClientService: CoreClientService,
    private readonly zitadelAdminService: ZitadelAdminService,
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

  // DOC-021 3 (gap "estados") — baja/reincorporacion/responsable/descripcion de Activo.
  bajaActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivoBaja(
      activoId,
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

  reincorporarActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivoReincorporacion(
      activoId,
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

  cambiarResponsableActivo(
    activoId: string,
    body: CambioResponsableActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.patchActivoResponsable(
      activoId,
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

  // DOC-021 3 (gap "descripciones").
  actualizarDescripcionActivo(
    activoId: string,
    body: ActualizarDescripcionActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.patchActivoDescripcion(
      activoId,
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

  // DOC-021 4 (gap "familias/categorías") — lectura abierta, mismo criterio que getContratos.
  getCatalogoTipos(correlationId: string): Promise<CatalogoTipoResult[]> {
    return this.coreClientService.getCatalogoTipos(correlationId);
  }

  altaCatalogoTipo(
    body: AltaCatalogoTipoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<CatalogoTipoResult> {
    return this.coreClientService.postCatalogoTipo(
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

  // DOC-021 3 (gap "documentación y fotografías").
  getDocumentosActivo(
    activoId: string,
    organizacionId: string,
    correlationId: string,
  ): Promise<DocumentoActivoResult[]> {
    return this.coreClientService.getDocumentosActivo(
      activoId,
      organizacionId,
      correlationId,
    );
  }

  altaDocumentoActivo(
    activoId: string,
    body: AltaDocumentoActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<DocumentoActivoResult> {
    return this.coreClientService.postDocumentoActivo(
      activoId,
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

  eliminarDocumentoActivo(
    activoId: string,
    documentoId: string,
    body: EscrituraOficialActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.coreClientService.deleteDocumentoActivo(
      activoId,
      documentoId,
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

  // DOC-012 6 (gap "importaciones controladas").
  importarContable(
    body: ImportacionContableBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    return this.coreClientService.postImportacionContable(
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

  // DOC-021 4 (Administrador del Sistema) — lectura abierta (mismo criterio que getContratos):
  // necesita ver TODAS las organizaciones, no solo las con contrato vigente.
  getOrganizaciones(correlationId: string): Promise<OrganizacionResult[]> {
    return this.coreClientService.getOrganizaciones(correlationId);
  }

  altaOrganizacion(
    body: AltaOrganizacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<OrganizacionResult> {
    return this.coreClientService.postOrganizacion(
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

  // DOC-021 4 — lectura abierta, sin auditoria (CORE tampoco la exige).
  getIndicadores(correlationId: string): Promise<IndicadoresResult> {
    return this.coreClientService.getIndicadores(correlationId);
  }

  // DOC-021 4 — asignar usuarios a organizaciones, integración real con Zitadel (no CORE: esto
  // nunca toca la BPI, es gestión de identidad). `organizacionId` acá es el id de CORE (ej.
  // 'duoc-uc', mismo formato que el resto de este servicio) — se traduce al id real de Zitadel
  // antes de llamar a ZitadelAdminService, que solo conoce ids de Zitadel.
  listarUsuariosOrganizacion(
    organizacionId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    return this.zitadelAdminService.listarGrants(
      this.organizacionIdAZitadel(organizacionId),
      correlationId,
    );
  }

  async asignarUsuarioOrganizacion(
    organizacionId: string,
    body: AsignarUsuarioOrganizacionBody,
    correlationId: string,
  ): Promise<void> {
    const zitadelOrgId = this.organizacionIdAZitadel(organizacionId);
    const usuario = await this.zitadelAdminService.buscarUsuarioPorEmail(
      body.email,
      correlationId,
    );
    if (!usuario) {
      throw new NotFoundException({
        message: `No existe ningún usuario de Zitadel con el email '${body.email}'`,
      });
    }
    await this.zitadelAdminService.crearGrant(
      zitadelOrgId,
      usuario.id,
      body.rol,
      correlationId,
    );
  }

  // Inverso de traducirAOrganizacionesCore — ORGANIZACION_MAPPING es {zitadelOrgId:
  // organizacionId-core}, sin índice inverso propio porque hasta este incremento nada lo
  // necesitaba (todo lo demas traduce Zitadel->CORE, nunca al revés).
  private organizacionIdAZitadel(organizacionId: string): string {
    const entrada = Object.entries(this.organizacionMapping).find(
      ([, core]) => core === organizacionId,
    );
    if (!entrada) {
      throw new NotFoundException({
        message: `Organización '${organizacionId}' sin mapeo a un id de Zitadel (ZITADEL_ORG_ID_MAP)`,
      });
    }
    return entrada[0];
  }

  // DOC-012 4 — lectura abierta, no necesita traducir rolesPorOrganizacion (CORE no exige rol
  // para GET /contratos, mismo criterio que GET /catalogo). Paginado (RNF-01, cierra el gap).
  getContratos(
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<ContratosPaginaResult> {
    return this.coreClientService.getContratos(paginacion, correlationId);
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

  // RF-06 (Fase 5) — lectura abierta, mismo criterio que getContratos.
  getAuditoria(
    filtro: AuditoriaFiltro,
    correlationId: string,
  ): Promise<AuditoriaPaginaResult> {
    return this.coreClientService.getAuditoria(filtro, correlationId);
  }

  // RF-05 (Fase 5) — lectura abierta, mismo criterio que getContratos. Paginado (RNF-01, cierra
  // el gap).
  getAreas(
    organizacionId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<AreasPaginaResult> {
    return this.coreClientService.getAreas(
      organizacionId,
      paginacion,
      correlationId,
    );
  }

  altaArea(
    body: AltaAreaBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    return this.coreClientService.postArea(
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

  // RF-05 (cierra el gap "ABM completo") — PATCH /admin/areas/:id.
  actualizarArea(
    areaId: string,
    body: ActualizarAreaBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    return this.coreClientService.patchArea(
      areaId,
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

  // Paginado (RNF-01, cierra el gap).
  getUbicaciones(
    sedeId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<UbicacionesPaginaResult> {
    return this.coreClientService.getUbicaciones(
      sedeId,
      paginacion,
      correlationId,
    );
  }

  altaUbicacion(
    body: AltaUbicacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return this.coreClientService.postUbicacion(
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

  // RF-05 (cierra el gap "ABM completo") — PATCH /admin/ubicaciones/:id.
  actualizarUbicacion(
    ubicacionId: string,
    body: ActualizarUbicacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return this.coreClientService.patchUbicacion(
      ubicacionId,
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

  // Paginado (RNF-01, cierra el gap).
  getResponsables(
    areaId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<ResponsablesPaginaResult> {
    return this.coreClientService.getResponsables(
      areaId,
      paginacion,
      correlationId,
    );
  }

  altaResponsable(
    body: AltaResponsableBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return this.coreClientService.postResponsable(
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

  actualizarEstadoResponsable(
    responsableId: string,
    body: ActualizarEstadoResponsableBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return this.coreClientService.patchResponsableEstado(
      responsableId,
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
