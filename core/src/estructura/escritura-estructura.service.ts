import { Injectable } from '@nestjs/common';
import { AreaRepository } from './area.repository';
import { UbicacionRepository } from './ubicacion.repository';
import { ResponsableRepository } from './responsable.repository';
import type { Area, NuevaAreaInput } from './area.types';
import type { NuevaUbicacionInput, Ubicacion } from './ubicacion.types';
import type {
  EstadoResponsable,
  NuevoResponsableInput,
  Responsable,
} from './responsable.types';

// RF-05 (Fase 5) — alta de Area/Ubicacion/Responsable + cambio de estado de Responsable (su
// "baja"). Invocado por OrquestadorService, no directo desde el controller — mismo criterio que
// EscrituraActivoService/EscrituraContratoService: la autorizacion de rol
// (verificarRolAdministradorPatrimonial) vive en el Orquestador, no acá. Sin registro en el Motor
// de Eventos (DOC-010): sus tipos de evento son especificos de Activo/Contrato, Area/Ubicacion/
// Responsable no estan en su alcance — la Auditoria (que el Orquestador registra siempre) ya deja
// constancia de quien hizo que.
@Injectable()
export class EscrituraEstructuraService {
  constructor(
    private readonly areaRepository: AreaRepository,
    private readonly ubicacionRepository: UbicacionRepository,
    private readonly responsableRepository: ResponsableRepository,
  ) {}

  altaArea(input: NuevaAreaInput): Promise<Area> {
    return this.areaRepository.crear(input);
  }

  altaUbicacion(input: NuevaUbicacionInput): Promise<Ubicacion> {
    return this.ubicacionRepository.crear(input);
  }

  altaResponsable(input: NuevoResponsableInput): Promise<Responsable> {
    return this.responsableRepository.crear(input);
  }

  actualizarEstadoResponsable(
    id: string,
    organizacionId: string,
    estado: EstadoResponsable,
  ): Promise<Responsable> {
    return this.responsableRepository.actualizarEstado(id, organizacionId, estado);
  }
}
