import { HttpException, Injectable } from '@nestjs/common';
import { AuditoriaRepository } from '../auditoria/auditoria.repository';
import { InventariosService } from '../inventarios/inventarios.service';
import { EscrituraActivoService } from '../patrimonial/escritura-activo.service';
import { verificarRolAdministradorPatrimonial } from '../common/auth/administrador-patrimonial.guard';
import type {
  InventarioRequest,
  PostInventarioResponse,
} from '../inventarios/inventarios.types';
import type {
  AltaActivoBody,
  EscrituraOficialBody,
  CambioResponsableBody,
} from '../patrimonial/activo.schemas';
import type { Activo } from '../patrimonial/activo.types';
import { buildContextoOperacion } from './contexto-operacion';

// DOC-007 — unico punto de entrada a los motores (Tomo IV §2.4). Generalizado en DOC-012 (Fase 4)
// con el segundo caso de uso real: escritura oficial de Activo.
@Injectable()
export class OrquestadorService {
  constructor(
    private readonly inventariosService: InventariosService,
    private readonly escrituraActivoService: EscrituraActivoService,
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
      });
      return resultado;
    } catch (error: unknown) {
      // RF-04 / DOC-007: la auditoria se registra siempre, exito o rechazo — nunca solo en el
      // camino feliz. La transaccion se cancela de forma controlada (Tomo IV §2.16).
      await this.auditoriaRepository.registrar({
        usuario: contexto.operadorId,
        operacion: 'POST /inventarios',
        resultado: this.resultadoDeError(error),
      });
      throw error;
    }
  }

  // DOC-012 §5 — POST /activos (alta).
  procesarAltaActivo(payload: AltaActivoBody): Promise<Activo> {
    return this.ejecutarEscrituraOficial(
      'POST /activos',
      payload.operadorId,
      payload.organizacionId,
      payload.rolesPorOrganizacion,
      () => this.escrituraActivoService.alta(payload, payload.operadorId),
    );
  }

  // DOC-012 §5 — POST /activos/:id/baja.
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

  // DOC-012 §5 — POST /activos/:id/reincorporacion.
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

  // DOC-012 §5 — PATCH /activos/:id/responsable.
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

  // DOC-012 §8 — la autorizacion de rol (verificarRolAdministradorPatrimonial) corre acá adentro,
  // no en un @UseGuards() a nivel de controller: asi un 403 por falta de rol pasa por el mismo
  // try/catch que cualquier otro rechazo de negocio y queda auditado (a diferencia de
  // ServiceTokenGuard, que sigue cortando antes del Orquestador porque autentica la conexion
  // CIS<->CORE, no una accion de negocio auditable por usuario). Se verifica el rol CONTRA
  // `organizacionId` (nunca "¿tiene el rol en algun lado?", hallazgo de revision de seguridad) —
  // el repository vuelve a cruzar esta misma organizacion contra la organizacion real del activo
  // objetivo como defensa en profundidad (ver activo.repository.ts).
  private async ejecutarEscrituraOficial(
    operacion: string,
    operadorId: string,
    organizacionId: string,
    rolesPorOrganizacion: unknown,
    accion: () => Promise<Activo>,
  ): Promise<Activo> {
    try {
      verificarRolAdministradorPatrimonial(
        rolesPorOrganizacion,
        organizacionId,
      );
      const activo = await accion();
      await this.auditoriaRepository.registrar({
        usuario: operadorId,
        operacion,
        resultado: activo.estado,
      });
      return activo;
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
