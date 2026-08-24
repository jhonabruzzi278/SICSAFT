import { Injectable } from '@nestjs/common';
import { ContratoRepository } from './contrato.repository';
import { EventoRepository } from '../eventos/evento.repository';
import type {
  CambiosCondicionesContrato,
  Contrato,
  EstadoContrato,
  NuevoContratoInput,
} from './contrato.types';

// DOC-012 7 — escritura de Contrato (hoy ContratoRepository solo leia). Invocado por
// OrquestadorService, no directo desde el controller (mismo criterio que EscrituraActivoService)
// — la autorizacion de rol vive en el Orquestador, no acá. La validacion de transiciones validas
// (DOC-004 3) vive en ContratoRepository.actualizarEstado, mismo lugar que valida el invariante
// de sedes (cruza contra el estado real en la misma transaccion lógica que la lectura).
@Injectable()
export class EscrituraContratoService {
  constructor(
    private readonly contratoRepository: ContratoRepository,
    private readonly eventoRepository: EventoRepository,
  ) {}

  async alta(input: NuevoContratoInput, operadorId: string): Promise<Contrato> {
    const contrato = await this.contratoRepository.crear(input);
    await this.eventoRepository.registrarContrato({
      contratoId: contrato.id,
      tipo: 'contrato_actualizado',
      usuario: operadorId,
      detalle: { estadoNuevo: contrato.estado },
    });
    return contrato;
  }

  async actualizarEstado(
    contratoId: string,
    organizacionId: string,
    estadoNuevo: EstadoContrato,
    operadorId: string,
  ): Promise<Contrato> {
    const contrato = await this.contratoRepository.actualizarEstado(
      contratoId,
      organizacionId,
      estadoNuevo,
    );
    await this.eventoRepository.registrarContrato({
      contratoId: contrato.id,
      tipo: 'contrato_actualizado',
      usuario: operadorId,
      detalle: { estadoNuevo },
    });
    return contrato;
  }

  // DOC-024 2 — PATCH /contratos/:id/condiciones. Mismo tipo de evento que actualizarEstado
  // ('contrato_actualizado', DOC-012 7) — el detalle distingue el caso por las claves que trae en
  // vez de por un tipo de evento nuevo, mismo criterio ya usado para 'alta' vs 'actualizado' acá.
  async actualizarCondiciones(
    contratoId: string,
    organizacionId: string,
    cambios: CambiosCondicionesContrato,
    operadorId: string,
  ): Promise<Contrato> {
    const contrato = await this.contratoRepository.actualizarCondiciones(
      contratoId,
      organizacionId,
      cambios,
    );
    await this.eventoRepository.registrarContrato({
      contratoId: contrato.id,
      tipo: 'contrato_actualizado',
      usuario: operadorId,
      detalle: { condicionesActualizadas: cambios },
    });
    return contrato;
  }
}
