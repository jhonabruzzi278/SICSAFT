import { Injectable } from '@nestjs/common';
import { ActivoRepository } from './activo.repository';
import { EventoRepository } from '../eventos/evento.repository';
import type { Activo, NuevoActivoInput } from './activo.types';

// DOC-012 §5 — resto del ciclo de vida de Activo (Tomo III §4.15) que el Motor Patrimonial de la
// Fase 2 no cubria (ese solo tenia lectura: GET /catalogo). Invocado por OrquestadorService, no
// directo desde el controller (mismo criterio que InventariosService en RF-06) — la autorizacion
// de rol (verificarRolAdministradorPatrimonial) vive en el Orquestador, no acá. `organizacionId`
// se reenvia al repository en baja/reincorporacion/cambioResponsable para que vuelva a cruzarlo
// contra la organizacion real del activo (defensa en profundidad, ver activo.repository.ts).
@Injectable()
export class EscrituraActivoService {
  constructor(
    private readonly activoRepository: ActivoRepository,
    private readonly eventoRepository: EventoRepository,
  ) {}

  async alta(input: NuevoActivoInput, operadorId: string): Promise<Activo> {
    const activo = await this.activoRepository.crear(input);
    await this.eventoRepository.registrar({
      activoId: activo.id,
      tipo: 'alta',
      usuario: operadorId,
      detalle: { codigoPatrimonial: input.codigoPatrimonial },
    });
    return activo;
  }

  async baja(
    activoId: string,
    organizacionId: string,
    operadorId: string,
  ): Promise<Activo> {
    const activo = await this.activoRepository.cambiarEstado(
      activoId,
      organizacionId,
      ['activo', 'extraviado'],
      'dado_de_baja',
    );
    await this.eventoRepository.registrar({
      activoId: activo.id,
      tipo: 'baja',
      usuario: operadorId,
    });
    return activo;
  }

  async reincorporacion(
    activoId: string,
    organizacionId: string,
    operadorId: string,
  ): Promise<Activo> {
    const activo = await this.activoRepository.cambiarEstado(
      activoId,
      organizacionId,
      ['extraviado'],
      'activo',
    );
    await this.eventoRepository.registrar({
      activoId: activo.id,
      tipo: 'reincorporacion',
      usuario: operadorId,
    });
    return activo;
  }

  async cambioResponsable(
    activoId: string,
    organizacionId: string,
    responsableId: string,
    operadorId: string,
  ): Promise<Activo> {
    const activo = await this.activoRepository.actualizarResponsable(
      activoId,
      organizacionId,
      responsableId,
    );
    await this.eventoRepository.registrar({
      activoId: activo.id,
      tipo: 'cambio_responsable',
      usuario: operadorId,
      detalle: { responsableId },
    });
    return activo;
  }
}
