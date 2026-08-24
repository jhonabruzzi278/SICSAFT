import { Injectable } from '@nestjs/common';
import { OrganizacionRepository } from './organizacion.repository';
import type {
  EstadoOrganizacion,
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

  // DOC-024 1 — PATCH /organizaciones/:id.
  actualizarNombre(id: string, nombre: string): Promise<Organizacion> {
    return this.organizacionRepository.actualizarNombre(id, nombre);
  }

  // DOC-024 1 — PATCH /organizaciones/:id/estado.
  actualizarEstado(
    id: string,
    estado: EstadoOrganizacion,
  ): Promise<Organizacion> {
    return this.organizacionRepository.actualizarEstado(id, estado);
  }
}
