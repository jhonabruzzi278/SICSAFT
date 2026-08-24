import { Injectable } from '@nestjs/common';
import { SedeRepository } from './sede.repository';
import type { EstadoSede, NuevaSedeInput, Sede } from './sede.types';

// Gap 2 (flujo real Admin->Directivo->Profesional AFT) — invocado por OrquestadorService, no
// directo desde el controller (mismo criterio que EscrituraOrganizacionService).
@Injectable()
export class EscrituraSedeService {
  constructor(private readonly sedeRepository: SedeRepository) {}

  crear(input: NuevaSedeInput): Promise<Sede> {
    return this.sedeRepository.crear(input);
  }

  // DOC-024 1 — PATCH /sedes/:id/estado.
  actualizarEstado(
    id: string,
    organizacionId: string,
    estado: EstadoSede,
  ): Promise<Sede> {
    return this.sedeRepository.actualizarEstado(id, organizacionId, estado);
  }
}
