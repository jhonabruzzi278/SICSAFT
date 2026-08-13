import { HttpException, Injectable } from '@nestjs/common';
import { AuditoriaRepository } from '../auditoria/auditoria.repository';
import { InventariosService } from '../inventarios/inventarios.service';
import type {
  InventarioRequest,
  PostInventarioResponse,
} from '../inventarios/inventarios.types';
import { buildContextoOperacion } from './contexto-operacion';

// DOC-007 — unico punto de entrada a los motores (Tomo IV §2.4). Un solo metodo publico en esta
// fase: procesarInventario. Se generaliza cuando exista un segundo caso de uso real (YAGNI).
@Injectable()
export class OrquestadorService {
  constructor(
    private readonly inventariosService: InventariosService,
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

  private resultadoDeError(error: unknown): string {
    if (error instanceof HttpException) {
      return `rechazado:${error.getStatus()}`;
    }
    return 'rechazado:error-interno';
  }
}
