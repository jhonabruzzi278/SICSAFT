import { Injectable, NotFoundException } from '@nestjs/common';
import { CoreClientService } from '../core-client/core-client.service';
import { AuditoriaIdentidadService } from '../auditoria-identidad/auditoria-identidad.service';
import { KeycloakAdminService } from '../keycloak-admin/keycloak-admin.service';
import type { GrantUsuario } from '../keycloak-admin/keycloak-admin.types';
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
  CrearLoteImportacionContableResult,
  LoteImportacionContableResult,
  LoteConFilasImportacionContableResult,
  RechazoLoteImportacionContableResult,
  IndicadoresResult,
  OrganizacionResult,
  Paginacion,
  ResponsableResult,
  ResponsablesPaginaResult,
  SedeResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import type {
  ActualizarCondicionesContratoBody,
  ActualizarDescripcionActivoBody,
  ActualizarEstadoOrganizacionBody,
  ActualizarEstadoSedeBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaContratoBody,
  AltaDocumentoActivoBody,
  AltaOrganizacionBody,
  AltaResponsableBody,
  AltaSedeBody,
  AltaUbicacionBody,
  ActualizarAreaBody,
  ActualizarContratoBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AsignarUsuarioOrganizacionBody,
  CambioResponsableActivoBody,
  EditarOrganizacionBody,
  EscrituraOficialActivoBody,
  ImportacionContableBody,
  CrearLoteImportacionContableBody,
  AprobarLoteImportacionContableBody,
  RechazarLoteImportacionContableBody,
  QuitarRolUsuarioOrganizacionBody,
} from './administrador.schemas';

// DOC-012 5 (Fase 4/5) — puente WEB->CIS->CORE para la escritura oficial de Activo. WEB nunca
// le habla a CORE directo (regla no negociable de CLAUDE.md) — este servicio traduce el contexto
// ya autenticado por Keycloak (KeycloakAuthGuard) al contrato de escritura oficial que CORE espera
// (DOC-012 3.3).
//
// ADR-004 — ya no traduce rolesPorOrganizacion: con Zitadel, el organizacionId que firmaba el JWT
// era un id numérico interno distinto del organizacionId de texto que usa CORE
// (ORGANIZACION_MAPPING/OrganizacionMappingDinamicoService resolvían esa diferencia). Con
// Keycloak, `rolesPorOrganizacion` ya viene keyed por el alias de la Organization — el mismo
// organizacionId que usa CORE por construcción (ver KeycloakAdminService.crearOrganizacion) — así
// que se pasa tal cual, sin traducción ni caché de mapeo.
@Injectable()
export class AdministradorService {
  constructor(
    private readonly coreClientService: CoreClientService,
    private readonly keycloakAdminService: KeycloakAdminService,
    private readonly auditoriaIdentidad: AuditoriaIdentidadService,
  ) {}

  altaActivo(
    body: AltaActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivo(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-021 3 (gap "estados") — baja/reincorporacion/responsable/descripcion de Activo.
  bajaActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivoBaja(
      activoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  reincorporarActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivoReincorporacion(
      activoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  cambiarResponsableActivo(
    activoId: string,
    body: CambioResponsableActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.patchActivoResponsable(
      activoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-021 3 (gap "descripciones").
  actualizarDescripcionActivo(
    activoId: string,
    body: ActualizarDescripcionActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.patchActivoDescripcion(
      activoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
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
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<CatalogoTipoResult> {
    return this.coreClientService.postCatalogoTipo(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
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
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<DocumentoActivoResult> {
    return this.coreClientService.postDocumentoActivo(
      activoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  eliminarDocumentoActivo(
    activoId: string,
    documentoId: string,
    body: EscrituraOficialActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.coreClientService.deleteDocumentoActivo(
      activoId,
      documentoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-012 6 (gap "importaciones controladas").
  importarContable(
    body: ImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    return this.coreClientService.postImportacionContable(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada. crear/aprobar/rechazar
  // inyectan la identidad del JWT (CORE verifica el rol y audita); listar/obtener son passthrough.
  crearLoteImportacionContable(
    body: CrearLoteImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<CrearLoteImportacionContableResult> {
    return this.coreClientService.postLoteImportacionContable(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  listarLotesImportacionContable(
    organizacionId: string,
    estado: string | undefined,
    correlationId: string,
  ): Promise<LoteImportacionContableResult[]> {
    return this.coreClientService.getLotesImportacionContable(
      organizacionId,
      estado,
      correlationId,
    );
  }

  obtenerLoteImportacionContable(
    loteId: string,
    correlationId: string,
  ): Promise<LoteConFilasImportacionContableResult> {
    return this.coreClientService.getLoteImportacionContable(
      loteId,
      correlationId,
    );
  }

  aprobarLoteImportacionContable(
    loteId: string,
    body: AprobarLoteImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    return this.coreClientService.postAprobarLoteImportacionContable(
      loteId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  rechazarLoteImportacionContable(
    loteId: string,
    body: RechazarLoteImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<RechazoLoteImportacionContableResult> {
    return this.coreClientService.postRechazarLoteImportacionContable(
      loteId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-021 4 (Administrador del Sistema) — lectura abierta (mismo criterio que getContratos):
  // necesita ver TODAS las organizaciones, no solo las con contrato vigente.
  getOrganizaciones(correlationId: string): Promise<OrganizacionResult[]> {
    return this.coreClientService.getOrganizaciones(correlationId);
  }

  // Gap 1 (flujo real Admin->Directivo->Profesional AFT) — ADR-004: ya no hay paso de
  // "ProjectGrant" (concepto propio de Zitadel, sin equivalente en Keycloak) ni registro de mapeo
  // dinámico — KeycloakAdminService.crearOrganizacion decide el organizacionId (alias) y CORE usa
  // ese mismo id directo, sin pasos intermedios.
  //
  // Si CORE falla después de crear la Organization en Keycloak, esta queda huérfana (estado
  // recuperable a mano, no distinto de cualquier otra falla de red a mitad de un alta) — no se
  // implementa un rollback automático, ningún otro flujo de este servicio lo hace tampoco.
  async altaOrganizacion(
    body: AltaOrganizacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<OrganizacionResult> {
    const { id: organizacionId } =
      await this.keycloakAdminService.crearOrganizacion(
        body.nombre,
        correlationId,
      );
    return this.coreClientService.postOrganizacion(
      {
        id: organizacionId,
        nombre: body.nombre,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-024 1 — PATCH /admin/organizaciones/:orgId (editar nombre). Misma secuencia que
  // altaOrganizacion (Keycloak primero, CORE despues). ADR-004: `organizacionId` ya es el alias de
  // la Organization, sin resolución previa.
  async editarOrganizacion(
    organizacionId: string,
    body: EditarOrganizacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<OrganizacionResult> {
    await this.keycloakAdminService.actualizarNombreOrganizacion(
      organizacionId,
      body.nombre,
      correlationId,
    );
    return this.coreClientService.patchOrganizacion(
      organizacionId,
      {
        nombre: body.nombre,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-024 1 — PATCH /admin/organizaciones/:orgId/estado. Solo CORE, sin tocar Keycloak ni
  // cascada a Contrato (bookkeeping de plataforma, ver DOC-024 1).
  actualizarEstadoOrganizacion(
    organizacionId: string,
    body: ActualizarEstadoOrganizacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<OrganizacionResult> {
    return this.coreClientService.patchOrganizacionEstado(
      organizacionId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-021 4 — lectura abierta, sin auditoria (CORE tampoco la exige).
  getIndicadores(correlationId: string): Promise<IndicadoresResult> {
    return this.coreClientService.getIndicadores(correlationId);
  }

  // DOC-021 4 — asignar usuarios a organizaciones, integración real con Keycloak (no CORE: esto
  // nunca toca la BPI, es gestión de identidad). `organizacionId` acá es el id de CORE (ej.
  // 'duoc-uc'), y ADR-004 lo hace también el alias de Keycloak directo — sin traducción.
  listarUsuariosOrganizacion(
    organizacionId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    return this.keycloakAdminService.listarGrants(
      organizacionId,
      correlationId,
    );
  }

  // DOC-024 3 — envuelto en AuditoriaIdentidadService.ejecutar: esta operacion nunca toca CORE
  // (es gestion de identidad en Keycloak), asi que sin esto quedaba fuera del Motor de Auditoria
  // de Tomo IV por completo — ver DOC-024 3.
  async asignarUsuarioOrganizacion(
    organizacionId: string,
    body: AsignarUsuarioOrganizacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.auditoriaIdentidad.ejecutar(
      `POST /admin/organizaciones/${organizacionId}/usuarios`,
      auth.operadorId,
      correlationId,
      async () => {
        const usuario = await this.keycloakAdminService.buscarUsuarioPorEmail(
          body.email,
          correlationId,
        );
        if (!usuario) {
          throw new NotFoundException({
            message: `No existe ningún usuario de Keycloak con el email '${body.email}'`,
          });
        }
        await this.keycloakAdminService.crearGrant(
          organizacionId,
          usuario.id,
          body.rol,
          correlationId,
        );
      },
      { organizacionId },
    );
  }

  // DOC-024 — DELETE /admin/organizaciones/:orgId/usuarios/:userId. Inverso de
  // asignarUsuarioOrganizacion, mismo wrapper de auditoria.
  async quitarRolUsuarioOrganizacion(
    organizacionId: string,
    userId: string,
    body: QuitarRolUsuarioOrganizacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.auditoriaIdentidad.ejecutar(
      `DELETE /admin/organizaciones/${organizacionId}/usuarios/${userId}`,
      auth.operadorId,
      correlationId,
      async () => {
        await this.keycloakAdminService.quitarRolDeGrant(
          organizacionId,
          userId,
          body.rol,
          correlationId,
        );
      },
      { organizacionId },
    );
  }

  // DOC-024 — POST /admin/organizaciones/:orgId/usuarios/:userId/desactivar. Mismo wrapper de
  // auditoria. ADR-004: deshabilitar una cuenta de Keycloak es global (no scoped a una
  // organización, a diferencia del estado "initial" de Zitadel) — ya no recibe `organizacionId`.
  async desactivarUsuarioOrganizacion(
    organizacionId: string,
    userId: string,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.auditoriaIdentidad.ejecutar(
      `POST /admin/organizaciones/${organizacionId}/usuarios/${userId}/desactivar`,
      auth.operadorId,
      correlationId,
      async () => {
        await this.keycloakAdminService.desactivarUsuario(
          userId,
          correlationId,
        );
      },
      { organizacionId },
    );
  }

  // DOC-012 4 — lectura abierta, no necesita rolesPorOrganizacion (CORE no exige rol para GET
  // /contratos, mismo criterio que GET /catalogo). Paginado (RNF-01, cierra el gap).
  getContratos(
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<ContratosPaginaResult> {
    return this.coreClientService.getContratos(paginacion, correlationId);
  }

  altaContrato(
    body: AltaContratoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ContratoResult> {
    return this.coreClientService.postContrato(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  actualizarEstadoContrato(
    contratoId: string,
    body: ActualizarContratoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ContratoResult> {
    return this.coreClientService.patchContrato(
      contratoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-024 2 — PATCH /admin/contratos/:id/condiciones. Endpoint separado de
  // actualizarEstadoContrato (que solo cambia `estado`) — ver DOC-024 2.
  actualizarCondicionesContrato(
    contratoId: string,
    body: ActualizarCondicionesContratoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ContratoResult> {
    return this.coreClientService.patchContratoCondiciones(
      contratoId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // Gap 2 (flujo real Admin->Directivo->Profesional AFT) — cierra el gap "no hay ABM de Sede":
  // sin esto, ninguna organización nueva podía tener nunca un Contrato (altaContrato exige
  // sedeIds ya existentes).
  altaSede(
    body: AltaSedeBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<SedeResult> {
    return this.coreClientService.postSede(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // DOC-024 1 — GET /admin/sedes?organizacionId=, el picker que reemplaza copiar/pegar un id a
  // mano en el formulario de Contrato de web_admin. Lectura abierta, mismo criterio que
  // getOrganizaciones.
  getSedes(
    organizacionId: string,
    correlationId: string,
  ): Promise<SedeResult[]> {
    return this.coreClientService.getSedes(organizacionId, correlationId);
  }

  // DOC-024 1 — PATCH /admin/sedes/:id/estado. Bidireccional, sin cascada a Contrato (DOC-024 1).
  actualizarEstadoSede(
    sedeId: string,
    body: ActualizarEstadoSedeBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<SedeResult> {
    return this.coreClientService.patchSedeEstado(
      sedeId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
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
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    return this.coreClientService.postArea(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /admin/areas/:id.
  actualizarArea(
    areaId: string,
    body: ActualizarAreaBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    return this.coreClientService.patchArea(
      areaId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
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
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return this.coreClientService.postUbicacion(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /admin/ubicaciones/:id.
  actualizarUbicacion(
    ubicacionId: string,
    body: ActualizarUbicacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return this.coreClientService.patchUbicacion(
      ubicacionId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
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
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return this.coreClientService.postResponsable(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  actualizarEstadoResponsable(
    responsableId: string,
    body: ActualizarEstadoResponsableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return this.coreClientService.patchResponsableEstado(
      responsableId,
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }
}
