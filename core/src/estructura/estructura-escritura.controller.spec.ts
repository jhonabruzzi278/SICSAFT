/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { EstructuraEscrituraController } from './estructura-escritura.controller';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Area } from './area.types';
import type { Ubicacion } from './ubicacion.types';
import type { Responsable } from './responsable.types';
import type {
  AltaAreaBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  ActualizarEstadoResponsableBody,
} from './estructura.schemas';

const ROLES = { 'duoc-uc': ['administrador-patrimonial'] };

const AREA: Area = {
  id: 'area-1',
  organizacionId: 'duoc-uc',
  codigo: 'BIB',
  nombre: 'Biblioteca',
  dependencia: null,
  centroCosto: null,
  responsableId: null,
  ubicacionPrincipalId: null,
};

const UBICACION: Ubicacion = {
  id: 'ubicacion-1',
  sedeId: 'melipilla',
  edificio: null,
  piso: null,
  areaId: null,
  oficina: null,
  dependencia: null,
};

const RESPONSABLE: Responsable = {
  id: 'responsable-1',
  identificacion: '11.111.111-1',
  nombre: 'Ana Soto',
  cargo: null,
  areaId: 'area-1',
  correo: null,
  telefono: null,
  estado: 'activo',
};

describe('EstructuraEscrituraController', () => {
  let controller: EstructuraEscrituraController;
  let orquestadorService: jest.Mocked<OrquestadorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstructuraEscrituraController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: {
            procesarAltaArea: jest.fn(),
            procesarAltaUbicacion: jest.fn(),
            procesarAltaResponsable: jest.fn(),
            procesarActualizarEstadoResponsable: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EstructuraEscrituraController);
    orquestadorService = module.get(OrquestadorService);
  });

  it('altaArea delega en OrquestadorService.procesarAltaArea', async () => {
    orquestadorService.procesarAltaArea.mockResolvedValue(AREA);
    const body: AltaAreaBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ROLES,
      codigo: 'BIB',
      nombre: 'Biblioteca',
    };

    await expect(controller.altaArea(body)).resolves.toBe(AREA);
    expect(orquestadorService.procesarAltaArea).toHaveBeenCalledWith(body);
  });

  it('altaUbicacion delega en OrquestadorService.procesarAltaUbicacion', async () => {
    orquestadorService.procesarAltaUbicacion.mockResolvedValue(UBICACION);
    const body: AltaUbicacionBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ROLES,
      sedeId: 'melipilla',
    };

    await expect(controller.altaUbicacion(body)).resolves.toBe(UBICACION);
    expect(orquestadorService.procesarAltaUbicacion).toHaveBeenCalledWith(body);
  });

  it('altaResponsable delega en OrquestadorService.procesarAltaResponsable', async () => {
    orquestadorService.procesarAltaResponsable.mockResolvedValue(RESPONSABLE);
    const body: AltaResponsableBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ROLES,
      identificacion: '11.111.111-1',
      nombre: 'Ana Soto',
      areaId: 'area-1',
    };

    await expect(controller.altaResponsable(body)).resolves.toBe(RESPONSABLE);
    expect(orquestadorService.procesarAltaResponsable).toHaveBeenCalledWith(
      body,
    );
  });

  it('actualizarEstadoResponsable delega en OrquestadorService.procesarActualizarEstadoResponsable', async () => {
    const inactivo = { ...RESPONSABLE, estado: 'inactivo' as const };
    orquestadorService.procesarActualizarEstadoResponsable.mockResolvedValue(
      inactivo,
    );
    const body: ActualizarEstadoResponsableBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ROLES,
      estado: 'inactivo',
    };

    await expect(
      controller.actualizarEstadoResponsable('responsable-1', body),
    ).resolves.toBe(inactivo);
    expect(
      orquestadorService.procesarActualizarEstadoResponsable,
    ).toHaveBeenCalledWith('responsable-1', body);
  });
});
