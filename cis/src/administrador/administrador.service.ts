import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CoreClientService } from '../core-client/core-client.service';
import { AuditoriaIdentidadService } from '../auditoria-identidad/auditoria-identidad.service';
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
  SedeResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import { ORGANIZACION_MAPPING } from './administrador.constants';
import type { OrganizacionMapping } from './organizacion-mapping.config';
import { OrganizacionMappingDinamicoService } from './organizacion-mapping-dinamico.service';
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
  QuitarRolUsuarioOrganizacionBody,
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
    private readonly organizacionMappingDinamico: OrganizacionMappingDinamicoService,
    private readonly auditoriaIdentidad: AuditoriaIdentidadService,
    @Inject(ORGANIZACION_MAPPING)
    private readonly organizacionMapping: OrganizacionMapping,
  ) {}

  async altaActivo(
    body: AltaActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postActivo(
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // DOC-021 3 (gap "estados") — baja/reincorporacion/responsable/descripcion de Activo.
  async bajaActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postActivoBaja(
      activoId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  async reincorporarActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postActivoReincorporacion(
      activoId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  async cambiarResponsableActivo(
    activoId: string,
    body: CambioResponsableActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchActivoResponsable(
      activoId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // DOC-021 3 (gap "descripciones").
  async actualizarDescripcionActivo(
    activoId: string,
    body: ActualizarDescripcionActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchActivoDescripcion(
      activoId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // DOC-021 4 (gap "familias/categorías") — lectura abierta, mismo criterio que getContratos.
  getCatalogoTipos(correlationId: string): Promise<CatalogoTipoResult[]> {
    return this.coreClientService.getCatalogoTipos(correlationId);
  }

  async altaCatalogoTipo(
    body: AltaCatalogoTipoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<CatalogoTipoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postCatalogoTipo(
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
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

  async altaDocumentoActivo(
    activoId: string,
    body: AltaDocumentoActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<DocumentoActivoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postDocumentoActivo(
      activoId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  async eliminarDocumentoActivo(
    activoId: string,
    documentoId: string,
    body: EscrituraOficialActivoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<void> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.deleteDocumentoActivo(
      activoId,
      documentoId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // DOC-012 6 (gap "importaciones controladas").
  async importarContable(
    body: ImportacionContableBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postImportacionContable(
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // DOC-021 4 (Administrador del Sistema) — lectura abierta (mismo criterio que getContratos):
  // necesita ver TODAS las organizaciones, no solo las con contrato vigente.
  getOrganizaciones(correlationId: string): Promise<OrganizacionResult[]> {
    return this.coreClientService.getOrganizaciones(correlationId);
  }

  // Gap 1 (flujo real Admin->Directivo->Profesional AFT) — ya no recibe el id de Zitadel del
  // cliente: lo crea acá mismo (ZitadelAdminService.crearOrganizacion) y usa el id real que
  // Zitadel devuelve para escribir en CORE. Orden deliberado: Zitadel (org) -> Zitadel
  // (ProjectGrant) -> CORE -> mapeo dinámico.
  //
  // El paso de ProjectGrant es un hallazgo real (no parte del diseño original): sin otorgarle el
  // proyecto "CIS" a la organización nueva, Zitadel nunca deja asignarle NINGÚN rol a NADIE en esa
  // organización ("Project not found") — descubierto verificando este flujo contra el Zitadel
  // real de devops/local, no algo que se pueda inferir leyendo el código. Va antes que CORE
  // porque una organización sin ProjectGrant es inútil (nadie podría ser Directivo ni Profesional
  // de AFT ahí) — mejor fallar antes de registrarla que dejar una organización "creada" pero
  // inoperable.
  //
  // Si CORE falla después de estos dos pasos de Zitadel, la organización queda huérfana (estado
  // recuperable a mano, no distinto de cualquier otra falla de red a mitad de un alta) — no se
  // implementa un rollback automático de Zitadel, ningún otro flujo de este servicio lo hace
  // tampoco. Si el registro del mapeo dinámico falla al final, se propaga (ver el comentario de
  // OrganizacionMappingDinamicoService.registrar): la organización ya existe en Zitadel y en
  // CORE, solo falta el mapeo — recuperable reintentando el registro, no un alta duplicada.
  async altaOrganizacion(
    body: AltaOrganizacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<OrganizacionResult> {
    const { id: zitadelOrgId } = await this.zitadelAdminService.crearOrganizacion(
      body.nombre,
      correlationId,
    );
    await this.zitadelAdminService.otorgarProyectoAOrganizacion(
      zitadelOrgId,
      correlationId,
    );
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    const organizacion = await this.coreClientService.postOrganizacion(
      {
        id: zitadelOrgId,
        nombre: body.nombre,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion,
      },
      correlationId,
    );
    await this.organizacionMappingDinamico.registrar(zitadelOrgId, zitadelOrgId);
    return organizacion;
  }

  // DOC-024 1 — PATCH /admin/organizaciones/:orgId (editar nombre). Misma secuencia que
  // altaOrganizacion (Zitadel primero, CORE despues) — mismo riesgo ya aceptado ahi si Zitadel
  // falla, CORE nunca se toca.
  async editarOrganizacion(
    organizacionId: string,
    body: EditarOrganizacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<OrganizacionResult> {
    const zitadelOrgId = await this.organizacionIdAZitadel(organizacionId);
    await this.zitadelAdminService.actualizarNombreOrganizacion(
      zitadelOrgId,
      body.nombre,
      correlationId,
    );
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchOrganizacion(
      organizacionId,
      { nombre: body.nombre, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // DOC-024 1 — PATCH /admin/organizaciones/:orgId/estado. Solo CORE, sin tocar Zitadel ni
  // cascada a Contrato (bookkeeping de plataforma, ver DOC-024 1).
  async actualizarEstadoOrganizacion(
    organizacionId: string,
    body: ActualizarEstadoOrganizacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<OrganizacionResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchOrganizacionEstado(
      organizacionId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
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
  async listarUsuariosOrganizacion(
    organizacionId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    const zitadelOrgId = await this.organizacionIdAZitadel(organizacionId);
    return this.zitadelAdminService.listarGrants(zitadelOrgId, correlationId);
  }

  // DOC-024 3 — envuelto en AuditoriaIdentidadService.ejecutar: esta operacion nunca toca CORE
  // (es gestion de identidad en Zitadel), asi que sin esto quedaba fuera del Motor de Auditoria
  // de Tomo IV por completo — ver DOC-024 3. `auth` ahora se recibe explicito (antes este metodo
  // no capturaba la identidad de quien llamaba, a diferencia de cada otro metodo de este
  // archivo) para tener un `operadorId` real que auditar.
  async asignarUsuarioOrganizacion(
    organizacionId: string,
    body: AsignarUsuarioOrganizacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.auditoriaIdentidad.ejecutar(
      `POST /admin/organizaciones/${organizacionId}/usuarios`,
      auth.operadorId,
      correlationId,
      async () => {
        const zitadelOrgId = await this.organizacionIdAZitadel(organizacionId);
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
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.auditoriaIdentidad.ejecutar(
      `DELETE /admin/organizaciones/${organizacionId}/usuarios/${userId}`,
      auth.operadorId,
      correlationId,
      async () => {
        const zitadelOrgId = await this.organizacionIdAZitadel(organizacionId);
        await this.zitadelAdminService.quitarRolDeGrant(
          zitadelOrgId,
          userId,
          body.rol,
          correlationId,
        );
      },
      { organizacionId },
    );
  }

  // DOC-024 — POST /admin/organizaciones/:orgId/usuarios/:userId/desactivar. Mismo wrapper de
  // auditoria — ver ZitadelAdminService.desactivarUsuario para el hallazgo real sobre usuarios en
  // USER_STATE_INITIAL.
  async desactivarUsuarioOrganizacion(
    organizacionId: string,
    userId: string,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.auditoriaIdentidad.ejecutar(
      `POST /admin/organizaciones/${organizacionId}/usuarios/${userId}/desactivar`,
      auth.operadorId,
      correlationId,
      async () => {
        const zitadelOrgId = await this.organizacionIdAZitadel(organizacionId);
        await this.zitadelAdminService.desactivarUsuario(
          zitadelOrgId,
          userId,
          correlationId,
        );
      },
      { organizacionId },
    );
  }

  // Inverso de traducirAOrganizacionesCore — ORGANIZACION_MAPPING es {zitadelOrgId:
  // organizacionId-core}, sin índice inverso propio en el mapa estático porque hasta DOC-021 nada
  // lo necesitaba (todo lo demas traduce Zitadel->CORE, nunca al revés). Gap 0: si no hay entrada
  // en el mapa estático, se prueba el mapeo dinámico (organizaciones creadas via
  // altaOrganizacion, donde el id de CORE YA ES el id de Zitadel — ver
  // OrganizacionMappingDinamicoService) antes de rendirse con 404.
  private async organizacionIdAZitadel(organizacionId: string): Promise<string> {
    const entradaEstatica = Object.entries(this.organizacionMapping).find(
      ([, core]) => core === organizacionId,
    );
    if (entradaEstatica) {
      return entradaEstatica[0];
    }
    const zitadelOrgId =
      await this.organizacionMappingDinamico.resolverZitadelOrgId(organizacionId);
    if (!zitadelOrgId) {
      throw new NotFoundException({
        message: `Organización '${organizacionId}' sin mapeo a un id de Zitadel (ZITADEL_ORG_ID_MAP)`,
      });
    }
    return zitadelOrgId;
  }

  // DOC-012 4 — lectura abierta, no necesita traducir rolesPorOrganizacion (CORE no exige rol
  // para GET /contratos, mismo criterio que GET /catalogo). Paginado (RNF-01, cierra el gap).
  getContratos(
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<ContratosPaginaResult> {
    return this.coreClientService.getContratos(paginacion, correlationId);
  }

  async altaContrato(
    body: AltaContratoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ContratoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postContrato(
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  async actualizarEstadoContrato(
    contratoId: string,
    body: ActualizarContratoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ContratoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchContrato(
      contratoId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // DOC-024 2 — PATCH /admin/contratos/:id/condiciones. Endpoint separado de
  // actualizarEstadoContrato (que solo cambia `estado`) — ver DOC-024 2.
  async actualizarCondicionesContrato(
    contratoId: string,
    body: ActualizarCondicionesContratoBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ContratoResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchContratoCondiciones(
      contratoId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // Gap 2 (flujo real Admin->Directivo->Profesional AFT) — cierra el gap "no hay ABM de Sede":
  // sin esto, ninguna organización nueva podía tener nunca un Contrato (altaContrato exige
  // sedeIds ya existentes).
  async altaSede(
    body: AltaSedeBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<SedeResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postSede(
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // DOC-024 1 — GET /admin/sedes?organizacionId=, el picker que reemplaza copiar/pegar un id a
  // mano en el formulario de Contrato de web_admin. Lectura abierta, mismo criterio que
  // getOrganizaciones.
  getSedes(organizacionId: string, correlationId: string): Promise<SedeResult[]> {
    return this.coreClientService.getSedes(organizacionId, correlationId);
  }

  // DOC-024 1 — PATCH /admin/sedes/:id/estado. Bidireccional, sin cascada a Contrato (DOC-024 1).
  async actualizarEstadoSede(
    sedeId: string,
    body: ActualizarEstadoSedeBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<SedeResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchSedeEstado(
      sedeId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
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

  async altaArea(
    body: AltaAreaBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postArea(
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /admin/areas/:id.
  async actualizarArea(
    areaId: string,
    body: ActualizarAreaBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchArea(
      areaId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
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

  async altaUbicacion(
    body: AltaUbicacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postUbicacion(
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /admin/ubicaciones/:id.
  async actualizarUbicacion(
    ubicacionId: string,
    body: ActualizarUbicacionBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchUbicacion(
      ubicacionId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
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

  async altaResponsable(
    body: AltaResponsableBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.postResponsable(
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  async actualizarEstadoResponsable(
    responsableId: string,
    body: ActualizarEstadoResponsableBody,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    const rolesPorOrganizacion = await this.traducirAOrganizacionesCore(
      auth.rolesPorOrganizacion,
    );
    return this.coreClientService.patchResponsableEstado(
      responsableId,
      { ...body, correlationId, operadorId: auth.operadorId, rolesPorOrganizacion },
      correlationId,
    );
  }

  // `auth.rolesPorOrganizacion` viene keyed por organizacionId de ZITADEL (lo que Zitadel firmo
  // en el claim) — CORE necesita la clave en el organizacionId que EL conoce (ver
  // organizacion-mapping.config.ts). Gap 0: el mapa estático (ZITADEL_ORG_ID_MAP) solo cubre
  // organizaciones legacy con id de CORE distinto del id de Zitadel (ej. 'duoc-uc') — para
  // cualquier otra, se prueba el mapeo dinámico que altaOrganizacion registra en el momento de
  // creación (donde el id de CORE YA ES el id de Zitadel por construcción, ver
  // OrganizacionMappingDinamicoService). Una organización sin entrada en NINGUNO de los dos
  // mapeos simplemente no aparece en el resultado (nunca se inventa una clave) — CORE la rechaza
  // con 403 igual que si el operador no tuviera el rol ahí, comportamiento correcto y seguro por
  // defecto (sin cambios respecto del criterio original).
  private async traducirAOrganizacionesCore(
    rolesPorOrganizacionZitadel: Record<string, string[]>,
  ): Promise<Record<string, string[]>> {
    const resultado: Record<string, string[]> = {};
    for (const [zitadelOrgId, roles] of Object.entries(
      rolesPorOrganizacionZitadel,
    )) {
      const organizacionId =
        this.organizacionMapping[zitadelOrgId] ??
        (await this.organizacionMappingDinamico.resolverOrganizacionId(
          zitadelOrgId,
        ));
      if (organizacionId) {
        resultado[organizacionId] = roles;
      }
    }
    return resultado;
  }
}
