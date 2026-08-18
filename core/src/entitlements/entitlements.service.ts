import { Injectable } from '@nestjs/common';
import { ContratoRepository } from './contrato.repository';
import type { Contrato } from './contrato.types';
import type { EntitlementsResponse, Organizacion } from './entitlements.types';

@Injectable()
export class EntitlementsService {
  constructor(private readonly contratoRepository: ContratoRepository) {}

  // TODO(DOC-004 7): sin mapeo operador->organizacion todavia (requiere membership real de
  // Zitadel) — cualquier operadorId ve las mismas organizaciones con contrato vigente.
  // `operadorId` se recibe y valida igual porque el contrato de la API ya lo exige (ver
  // core/README.md), queda listo para filtrar en cuanto exista esa fuente de datos.
  async resolve(
    operadorId: string,
    ahora: Date = new Date(),
  ): Promise<EntitlementsResponse> {
    const contratos = await this.contratoRepository.findAll();

    const organizaciones: Organizacion[] = contratos
      .filter((contrato) => this.esVigente(contrato, ahora))
      .filter((contrato) =>
        contrato.modulosContratados.includes('inventario-qr'),
      )
      .map((contrato) => ({
        id: contrato.organizacionId,
        nombre: contrato.organizacionNombre,
        sedes: contrato.sedes,
      }));

    return { organizaciones };
  }

  private esVigente(contrato: Contrato, ahora: Date): boolean {
    // El campo `estado` manda para suspendido/cancelado/vencido-guardado — pero tambien se
    // verifica la fecha para el caso "vencido por tiempo" que nada escribe de vuelta al campo
    // (no hay cron, ver contrato.types.ts).
    if (contrato.estado !== 'vigente') {
      return false;
    }
    if (ahora < new Date(contrato.vigenciaDesde)) {
      return false;
    }
    if (
      contrato.vigenciaHasta !== null &&
      ahora > new Date(contrato.vigenciaHasta)
    ) {
      return false;
    }
    return true;
  }
}
