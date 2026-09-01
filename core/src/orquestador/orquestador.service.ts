import { HttpException, Injectable } from '@nestjs/common';
import { AuditoriaRepository } from '../auditoria/auditoria.repository';
import { InventariosService } from '../inventarios/inventarios.service';
import { EscrituraActivoService } from '../patrimonial/escritura-activo.service';
import { ImportacionContableService } from '../patrimonial/importacion-contable.service';
import { ImportacionContableLoteService } from '../patrimonial/importacion-contable-lote.service';
import { EscrituraContratoService } from '../entitlements/escritura-contrato.service';
import { EscrituraOrganizacionService } from '../entitlements/escritura-organizacion.service';
import { EscrituraSedeService } from '../entitlements/escritura-sede.service';
import { EscrituraEstructuraService } from '../estructura/escritura-estructura.service';
import { EscrituraDocumentoActivoService } from '../patrimonial/escritura-documento-activo.service';
import { CatalogoTipoActivoRepository } from '../patrimonial/catalogo-tipo-activo.repository';
import {
  ADMINISTRADOR_PATRIMONIAL_ROLE,
  ADMINISTRADOR_SISTEMA_ROLE,
  verificarRolAdministradorPatrimonial,
  verificarRolEnCualquierOrganizacion,
  verificarRolesPermitidos,
} from '../common/auth/administrador-patrimonial.guard';
import type {
  InventarioRequest,
  PostInventarioResponse,
} from '../inventarios/inventarios.types';
import type {
  ActualizarDescripcionActivoBody,
  AltaActivoBody,
  EscrituraOficialBody,
  CambioResponsableBody,
} from '../patrimonial/activo.schemas';
import type { Activo } from '../patrimonial/activo.types';
import type { ImportacionContableBody } from '../patrimonial/importacion-contable.schemas';
import type { ImportacionContableResultado } from '../patrimonial/importacion-contable.types';
import type {
  AprobarLoteBody,
  CrearLoteBody,
  RechazarLoteBody,
} from '../patrimonial/importacion-contable-lote.schemas';
import type {
  EstadoLote,
  LoteConFilas,
  LoteImportacionContable,
  ResumenLote,
} from '../patrimonial/importacion-contable-lote.types';
import type { AltaCatalogoTipoBody } from '../patrimonial/catalogo-tipo-activo.schemas';
import type { CatalogoTipoActivo } from '../patrimonial/catalogo-tipo-activo.types';
import type {
  AltaDocumentoActivoBody,
  EliminarDocumentoActivoBody,
} from '../patrimonial/documento-activo.schemas';
import type { DocumentoActivo } from '../patrimonial/documento-activo.types';
import type {
  ActualizarCondicionesContratoBody,
  ActualizarContratoBody,
  AltaContratoBody,
} from '../entitlements/contrato.schemas';
import type { Contrato } from '../entitlements/contrato.types';
import type {
  ActualizarEstadoOrganizacionBody,
  ActualizarOrganizacionBody,
  AltaOrganizacionBody,
} from '../entitlements/organizacion.schemas';
import type { Organizacion } from '../entitlements/organizacion.types';
import type {
  ActualizarEstadoSedeBody,
  AltaSedeBody,
} from '../entitlements/sede.schemas';
import type { Sede } from '../entitlements/sede.types';
import type {
  AltaAreaBody,
  ActualizarAreaBody,
  ActualizarUbicacionBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  ActualizarEstadoResponsableBody,
} from '../estructura/estructura.schemas';
import type { Area } from '../estructura/area.types';
import type { Ubicacion } from '../estructura/ubicacion.types';
import type { Responsable } from '../estructura/responsable.types';
import { buildContextoOperacion } from './contexto-operacion';

// DOC-007 — unico punto de entrada a los motores (Tomo IV 2.4). Generalizado en DOC-012 (Fase 4)
// con los demas casos de uso reales: escritura oficial de Activo, importacion masiva y escritura
// de Contrato — todos comparten el mismo patron de autorizacion+auditoria (ver
// ejecutarOperacionOficial).
@Injectable()
export class OrquestadorService {
  constructor(
    private readonly inventariosService: InventariosService,
    private readonly escrituraActivoService: EscrituraActivoService,
    private readonly importacionContableService: ImportacionContableService,
    private readonly importacionContableLoteService: ImportacionContableLoteService,
    private readonly escrituraContratoService: EscrituraContratoService,
    private readonly escrituraEstructuraService: EscrituraEstructuraService,
    private readonly escrituraOrganizacionService: EscrituraOrganizacionService,
    private readonly escrituraSedeService: EscrituraSedeService,
    private readonly escrituraDocumentoActivoService: EscrituraDocumentoActivoService,
    private readonly catalogoTipoActivoRepository: CatalogoTipoActivoRepository,
    private readonly auditoriaRepository: AuditoriaRepository,
  ) {}

  async procesarInventario(
    payload: InventarioRequest,
    correlationId: string,
  ): Promise<PostInventarioResponse> {
    const contexto = buildContextoOperacion(payload, correlationId);

    try {
      const resultado = await this.inventariosService.procesar(payload);
      await this.auditoriaRepository.registrar({
        usuario: contexto.operadorId,
        operacion: 'POST /inventarios',
        resultado: resultado.estado,
        // DOC-029 RF-E — una acción de control ES sobre un área concreta; queda auditada como tal.
        areaOperativa: payload.areaId,
      });
      return resultado;
    } catch (error: unknown) {
      // RF-04 / DOC-007: la auditoria se registra siempre, exito o rechazo — nunca solo en el
      // camino feliz. La transaccion se cancela de forma controlada (Tomo IV 2.16).
      await this.auditoriaRepository.registrar({
        usuario: contexto.operadorId,
        operacion: 'POST /inventarios',
        resultado: this.resultadoDeError(error),
        areaOperativa: payload.areaId,
      });
      throw error;
    }
  }

  // DOC-012 5 — POST /activos (alta).
  procesarAltaActivo(payload: AltaActivoBody): Promise<Activo> {
    return this.ejecutarEscrituraOficial(
      'POST /activos',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () => this.escrituraActivoService.alta(payload, payload.operadorId),
    );
  }

  // DOC-012 5 — POST /activos/:id/baja.
  procesarBajaActivo(
    activoId: string,
    payload: EscrituraOficialBody,
  ): Promise<Activo> {
    return this.ejecutarEscrituraOficial(
      `POST /activos/${activoId}/baja`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraActivoService.baja(
          activoId,
          payload.organizacionId,
          payload.operadorId,
        ),
    );
  }

  // DOC-012 5 — POST /activos/:id/reincorporacion.
  procesarReincorporacionActivo(
    activoId: string,
    payload: EscrituraOficialBody,
  ): Promise<Activo> {
    return this.ejecutarEscrituraOficial(
      `POST /activos/${activoId}/reincorporacion`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraActivoService.reincorporacion(
          activoId,
          payload.organizacionId,
          payload.operadorId,
        ),
    );
  }

  // DOC-012 5 — PATCH /activos/:id/responsable.
  procesarCambioResponsable(
    activoId: string,
    payload: CambioResponsableBody,
  ): Promise<Activo> {
    return this.ejecutarEscrituraOficial(
      `POST /activos/${activoId}/responsable`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraActivoService.cambioResponsable(
          activoId,
          payload.organizacionId,
          payload.responsableId,
          payload.operadorId,
        ),
    );
  }

  // DOC-021 3 — PATCH /activos/:id/descripcion.
  procesarActualizarDescripcionActivo(
    activoId: string,
    payload: ActualizarDescripcionActivoBody,
  ): Promise<Activo> {
    return this.ejecutarEscrituraOficial(
      `PATCH /activos/${activoId}/descripcion`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraActivoService.actualizarDescripcion(
          activoId,
          payload.organizacionId,
          payload.descripcion,
          payload.operadorId,
        ),
    );
  }

  // DOC-021 4 (gap "familias/categorías") — POST /catalogo-tipos.
  procesarAltaCatalogoTipo(
    payload: AltaCatalogoTipoBody,
  ): Promise<CatalogoTipoActivo> {
    return this.ejecutarOperacionOficial(
      'POST /catalogo-tipos',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () => this.catalogoTipoActivoRepository.crear(payload),
      (tipo) => tipo.id,
    );
  }

  // DOC-021 3 (gap "documentación y fotografías") — POST /activos/:id/documentos.
  procesarAltaDocumentoActivo(
    activoId: string,
    payload: AltaDocumentoActivoBody,
  ): Promise<DocumentoActivo> {
    return this.ejecutarOperacionOficial(
      `POST /activos/${activoId}/documentos`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraDocumentoActivoService.crear({
          activoId,
          organizacionId: payload.organizacionId,
          tipo: payload.tipo,
          url: payload.url,
          descripcion: payload.descripcion,
          creadoPor: payload.operadorId,
        }),
      (documento) => documento.id,
    );
  }

  // DOC-021 3 — DELETE /activos/:id/documentos/:documentoId.
  procesarEliminarDocumentoActivo(
    activoId: string,
    documentoId: string,
    payload: EliminarDocumentoActivoBody,
  ): Promise<void> {
    return this.ejecutarOperacionOficial(
      `DELETE /activos/${activoId}/documentos/${documentoId}`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraDocumentoActivoService.eliminar(
          documentoId,
          activoId,
          payload.organizacionId,
        ),
      () => documentoId,
    );
  }

  // DOC-021 4 (Administrador del Sistema) — POST /organizaciones. Unico caso de este archivo con
  // un verificador propio de un solo rol distinto al default (administrador-patrimonial no puede
  // crear organizaciones — es administracion de plataforma, no informacion patrimonial).
  procesarAltaOrganizacion(
    payload: AltaOrganizacionBody,
  ): Promise<Organizacion> {
    return this.ejecutarOperacionOficial(
      'POST /organizaciones',
      payload.operadorId,
      // Sin organizacionId real (DOC-022 3) — administrador-sistema no pertenece a ninguna
      // organizacion de negocio en particular, el verificador de abajo ignora este parametro y
      // chequea el rol en CUALQUIER organizacion del token.
      '',
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraOrganizacionService.crear({
          id: payload.id,
          nombre: payload.nombre,
        }),
      (organizacion) => organizacion.id,
      (roles) =>
        verificarRolEnCualquierOrganizacion(roles, [
          ADMINISTRADOR_SISTEMA_ROLE,
        ]),
    );
  }

  // DOC-024 1 — PATCH /organizaciones/:id (editar nombre). Mismo verificador que
  // procesarAltaOrganizacion: administrador-sistema no pertenece a ninguna organizacion de
  // negocio en particular, se chequea en CUALQUIERA.
  procesarActualizarOrganizacion(
    organizacionId: string,
    payload: ActualizarOrganizacionBody,
  ): Promise<Organizacion> {
    return this.ejecutarOperacionOficial(
      `PATCH /organizaciones/${organizacionId}`,
      payload.operadorId,
      '',
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraOrganizacionService.actualizarNombre(
          organizacionId,
          payload.nombre,
        ),
      (organizacion) => organizacion.id,
      (roles) =>
        verificarRolEnCualquierOrganizacion(roles, [
          ADMINISTRADOR_SISTEMA_ROLE,
        ]),
    );
  }

  // DOC-024 1 — PATCH /organizaciones/:id/estado. Bidireccional, sin cascada a Contrato (DOC-024
  // 1) — mismo verificador que el resto de operaciones sobre Organizacion.
  procesarActualizarEstadoOrganizacion(
    organizacionId: string,
    payload: ActualizarEstadoOrganizacionBody,
  ): Promise<Organizacion> {
    return this.ejecutarOperacionOficial(
      `PATCH /organizaciones/${organizacionId}/estado`,
      payload.operadorId,
      '',
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraOrganizacionService.actualizarEstado(
          organizacionId,
          payload.estado,
        ),
      (organizacion) => organizacion.estado,
      (roles) =>
        verificarRolEnCualquierOrganizacion(roles, [
          ADMINISTRADOR_SISTEMA_ROLE,
        ]),
    );
  }

  // Gap 2 (flujo real Admin->Directivo->Profesional AFT) — POST /sedes. A diferencia de
  // Organizacion, una Sede SI pertenece a una organizacion puntual (organizacionId obligatorio en
  // el schema), asi que usa el mismo verificador que Contrato (administrador-patrimonial O
  // administrador-sistema, contra ESA organizacion) — no verificarRolEnCualquierOrganizacion.
  // ejecutarOperacionOficial (no el atajo ejecutarEscrituraOficial) porque Sede no tiene un campo
  // `estado` que resumir en la auditoria, mismo motivo que procesarAltaOrganizacion de arriba.
  procesarAltaSede(payload: AltaSedeBody): Promise<Sede> {
    return this.ejecutarOperacionOficial(
      'POST /sedes',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraSedeService.crear({
          organizacionId: payload.organizacionId,
          nombre: payload.nombre,
        }),
      (sede) => sede.id,
      OrquestadorService.VERIFICAR_ROL_CONTRATO,
    );
  }

  // DOC-024 1 — PATCH /sedes/:id/estado. Mismos roles que pueden crear una Sede (VERIFICAR_ROL_
  // CONTRATO), bidireccional, sin cascada a Contrato (DOC-024 1).
  procesarActualizarEstadoSede(
    sedeId: string,
    payload: ActualizarEstadoSedeBody,
  ): Promise<Sede> {
    return this.ejecutarOperacionOficial(
      `PATCH /sedes/${sedeId}/estado`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraSedeService.actualizarEstado(
          sedeId,
          payload.organizacionId,
          payload.estado,
        ),
      (sede) => sede.estado,
      OrquestadorService.VERIFICAR_ROL_CONTRATO,
    );
  }

  // DOC-012 6 — POST /importaciones/contable. Idempotente por fila (no atomico por request como
  // POST /inventarios) — el resultado siempre es 200 con el detalle de cada fila, el 403 por
  // falta de rol es el unico rechazo de todo el request.
  procesarImportacionContable(
    payload: ImportacionContableBody,
  ): Promise<ImportacionContableResultado> {
    return this.ejecutarOperacionOficial(
      'POST /importaciones/contable',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.importacionContableService.procesar(
          payload.organizacionId,
          payload.filas,
          payload.operadorId,
        ),
      (resultado) =>
        `${resultado.creados} creados, ${resultado.yaImportados} ya_importados, ${resultado.conflictos} conflictos`,
    );
  }

  // DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada. crear/aprobar/rechazar
  // son escrituras oficiales (verifican rol + auditan). listar/obtener son lecturas: CIS ya validó
  // la sesión humana y acota `organizacionId`, mismo criterio que GET /auditoria.
  crearLoteImportacionContable(
    payload: CrearLoteBody,
  ): Promise<{ loteId: string; resumen: ResumenLote }> {
    return this.ejecutarOperacionOficial(
      'POST /importaciones/contable/lote',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.importacionContableLoteService.crearLote({
          organizacionId: payload.organizacionId,
          origen: payload.origen,
          archivoNombre: payload.archivoNombre,
          filas: payload.filas,
        }),
      (r) =>
        `lote ${r.loteId}: ${r.resumen.crear} crear, ${r.resumen.yaImportado} ya_importado, ${r.resumen.conflicto} conflicto`,
    );
  }

  listarLotesImportacionContable(
    organizacionId: string,
    estado?: EstadoLote,
  ): Promise<LoteImportacionContable[]> {
    return this.importacionContableLoteService.listarLotes(
      organizacionId,
      estado,
    );
  }

  obtenerLoteImportacionContable(loteId: string): Promise<LoteConFilas> {
    return this.importacionContableLoteService.obtenerLote(loteId);
  }

  aprobarLoteImportacionContable(
    loteId: string,
    payload: AprobarLoteBody,
  ): Promise<ImportacionContableResultado> {
    return this.ejecutarOperacionOficial(
      `POST /importaciones/contable/lote/${loteId}/aprobar`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.importacionContableLoteService.aprobarLote(
          loteId,
          payload.operadorId,
        ),
      (resultado) =>
        `${resultado.creados} creados, ${resultado.yaImportados} ya_importados, ${resultado.conflictos} conflictos`,
    );
  }

  async rechazarLoteImportacionContable(
    loteId: string,
    payload: RechazarLoteBody,
  ): Promise<{ estado: 'rechazado' }> {
    await this.ejecutarOperacionOficial(
      `POST /importaciones/contable/lote/${loteId}/rechazar`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.importacionContableLoteService.rechazarLote(
          loteId,
          payload.operadorId,
          payload.motivo,
        ),
      () => (payload.motivo ? `rechazado: ${payload.motivo}` : 'rechazado'),
    );
    return { estado: 'rechazado' };
  }

  // Contrato acepta administrador-patrimonial (Tomo III 1.4 se lo exigia desde DOC-012 7, no se
  // le quita) O administrador-sistema (DOC-021 2 — el Administrador del Sistema tambien puede
  // crear/editar contratos, es administracion de plataforma).
  private static readonly VERIFICAR_ROL_CONTRATO = (
    roles: unknown,
    organizacionId: string,
  ): void =>
    verificarRolesPermitidos(roles, organizacionId, [
      ADMINISTRADOR_PATRIMONIAL_ROLE,
      ADMINISTRADOR_SISTEMA_ROLE,
    ]);

  // DOC-012 7 — POST /contratos (alta).
  procesarAltaContrato(payload: AltaContratoBody): Promise<Contrato> {
    return this.ejecutarEscrituraOficial(
      'POST /contratos',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () => this.escrituraContratoService.alta(payload, payload.operadorId),
      OrquestadorService.VERIFICAR_ROL_CONTRATO,
    );
  }

  // DOC-012 7 — PATCH /contratos/:id.
  procesarActualizacionContrato(
    contratoId: string,
    payload: ActualizarContratoBody,
  ): Promise<Contrato> {
    return this.ejecutarEscrituraOficial(
      `PATCH /contratos/${contratoId}`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraContratoService.actualizarEstado(
          contratoId,
          payload.organizacionId,
          payload.estado,
          payload.operadorId,
        ),
      OrquestadorService.VERIFICAR_ROL_CONTRATO,
    );
  }

  // DOC-024 2 — PATCH /contratos/:id/condiciones. Endpoint separado de procesarActualizacionContrato
  // (que solo cambia `estado`) para no mezclar dos validaciones distintas en un mismo body — ver
  // DOC-024 2.
  procesarActualizarCondicionesContrato(
    contratoId: string,
    payload: ActualizarCondicionesContratoBody,
  ): Promise<Contrato> {
    return this.ejecutarEscrituraOficial(
      `PATCH /contratos/${contratoId}/condiciones`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraContratoService.actualizarCondiciones(
          contratoId,
          payload.organizacionId,
          {
            sedeIds: payload.sedeIds,
            vigenciaHasta: payload.vigenciaHasta,
            modulosContratados: payload.modulosContratados,
          },
          payload.operadorId,
        ),
      OrquestadorService.VERIFICAR_ROL_CONTRATO,
    );
  }

  // RF-05 — POST /areas (alta). Area no expone `estado` (a diferencia de Activo/Contrato), asi
  // que usa ejecutarOperacionOficial directo en vez del atajo ejecutarEscrituraOficial.
  procesarAltaArea(payload: AltaAreaBody): Promise<Area> {
    return this.ejecutarOperacionOficial(
      'POST /areas',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () => this.escrituraEstructuraService.altaArea(payload),
      (area) => area.id,
    );
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /areas/:id.
  procesarActualizarArea(
    areaId: string,
    payload: ActualizarAreaBody,
  ): Promise<Area> {
    return this.ejecutarOperacionOficial(
      `PATCH /areas/${areaId}`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraEstructuraService.actualizarArea(
          areaId,
          payload.organizacionId,
          payload,
        ),
      (area) => area.id,
    );
  }

  // RF-05 — POST /ubicaciones (alta). Mismo motivo que procesarAltaArea (sin `estado`).
  procesarAltaUbicacion(payload: AltaUbicacionBody): Promise<Ubicacion> {
    return this.ejecutarOperacionOficial(
      'POST /ubicaciones',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () => this.escrituraEstructuraService.altaUbicacion(payload),
      (ubicacion) => ubicacion.id,
    );
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /ubicaciones/:id.
  procesarActualizarUbicacion(
    ubicacionId: string,
    payload: ActualizarUbicacionBody,
  ): Promise<Ubicacion> {
    return this.ejecutarOperacionOficial(
      `PATCH /ubicaciones/${ubicacionId}`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraEstructuraService.actualizarUbicacion(
          ubicacionId,
          payload.organizacionId,
          payload,
        ),
      (ubicacion) => ubicacion.id,
    );
  }

  // RF-05 — POST /responsables (alta). Responsable si expone `estado`, usa el atajo.
  procesarAltaResponsable(payload: AltaResponsableBody): Promise<Responsable> {
    return this.ejecutarEscrituraOficial(
      'POST /responsables',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () => this.escrituraEstructuraService.altaResponsable(payload),
    );
  }

  // RF-05 — PATCH /responsables/:id/estado (su "baja").
  procesarActualizarEstadoResponsable(
    responsableId: string,
    payload: ActualizarEstadoResponsableBody,
  ): Promise<Responsable> {
    return this.ejecutarEscrituraOficial(
      `PATCH /responsables/${responsableId}/estado`,
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () =>
        this.escrituraEstructuraService.actualizarEstadoResponsable(
          responsableId,
          payload.organizacionId,
          payload.estado,
        ),
    );
  }

  // Activo y Contrato comparten la misma forma de resultado (ambos exponen `estado`) — atajo
  // sobre ejecutarOperacionOficial para no repetir `(valor) => valor.estado` en cada llamador.
  private ejecutarEscrituraOficial<T extends { estado: string }>(
    operacion: string,
    operadorId: string,
    organizacionId: string,
    rolesPorOrganizacion: unknown,
    accion: () => Promise<T>,
    verificarRol: (
      roles: unknown,
      organizacionId: string,
    ) => void = verificarRolAdministradorPatrimonial,
  ): Promise<T> {
    return this.ejecutarOperacionOficial(
      operacion,
      operadorId,
      organizacionId,
      rolesPorOrganizacion,
      accion,
      (valor) => valor.estado,
      verificarRol,
    );
  }

  // DOC-012 8 — la autorizacion de rol (verificarRolAdministradorPatrimonial) corre acá adentro,
  // no en un @UseGuards() a nivel de controller: asi un 403 por falta de rol pasa por el mismo
  // try/catch que cualquier otro rechazo de negocio y queda auditado (a diferencia de
  // ServiceTokenGuard, que sigue cortando antes del Orquestador porque autentica la conexion
  // CIS<->CORE, no una accion de negocio auditable por usuario). Se verifica el rol CONTRA
  // `organizacionId` (nunca "¿tiene el rol en algun lado?", hallazgo de revision de seguridad) —
  // el repository vuelve a cruzar esta misma organizacion contra la organizacion real del
  // activo/contrato objetivo como defensa en profundidad (ver activo.repository.ts/
  // contrato.repository.ts). `resultadoDe` deja el mapeo valor->string de auditoria a cada
  // llamador porque no todos los resultados tienen la misma forma (Activo/Contrato exponen
  // `estado`, ImportacionContableResultado no).
  private async ejecutarOperacionOficial<T>(
    operacion: string,
    operadorId: string,
    organizacionId: string,
    rolesPorOrganizacion: unknown,
    accion: () => Promise<T>,
    resultadoDe: (valor: T) => string,
    // DOC-021 2 — parametrizado (default = comportamiento previo, ningun caller existente de
    // Activo/Area/Ubicacion/Responsable/CatalogoTipo/Documento cambia) para que Contrato y
    // Organizacion puedan pasar un verificador que acepte otros roles (administrador-sistema).
    verificarRol: (
      roles: unknown,
      organizacionId: string,
    ) => void = verificarRolAdministradorPatrimonial,
  ): Promise<T> {
    try {
      verificarRol(rolesPorOrganizacion, organizacionId);
      const valor = await accion();
      await this.auditoriaRepository.registrar({
        usuario: operadorId,
        operacion,
        resultado: resultadoDe(valor),
      });
      return valor;
    } catch (error: unknown) {
      await this.auditoriaRepository.registrar({
        usuario: operadorId,
        operacion,
        resultado: this.resultadoDeError(error),
      });
      throw error;
    }
  }

  private resultadoDeError(error: unknown): string {
    if (error instanceof HttpException) {
      return `rechazado:${error.getStatus()}`;
    }
    return 'rechazado:error-interno';
  }
}
