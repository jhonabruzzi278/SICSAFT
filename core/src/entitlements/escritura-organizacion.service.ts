import { Injectable } from '@nestjs/common';
import { OrganizacionRepository } from './organizacion.repository';
import type {
  NuevaOrganizacionInput,
  Organizacion,
} from './organizacion.types';

// DOC-021 4 — invocado por OrquestadorService, no directo desde el controller (mismo criterio
// que EscrituraContratoService).
@Injectable()
export class EscrituraOrganizacionService {
  constructor(
    private readonly organizacionRepository: OrganizacionRepository,
  ) {}

  crear(input: NuevaOrganizacionInput): Promise<Organizacion> {
    return this.organizacionRepository.crear(input);
  }
}
