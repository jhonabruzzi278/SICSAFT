/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { SedeEscrituraController } from './sede-escritura.controller';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { ActualizarEstadoSedeBody, AltaSedeBody } from './sede.schemas';
import type { Sede } from './sede.types';

describe('SedeEscrituraController', () => {
  let controller: SedeEscrituraController;
  let orquestadorService: jest.Mocked<OrquestadorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SedeEscrituraController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: {
            procesarAltaSede: jest.fn(),
            procesarActualizarEstadoSede: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SedeEscrituraController);
    orquestadorService = module.get(OrquestadorService);
  });

  it('alta delega en OrquestadorService.procesarAltaSede con el body', async () => {
    const sede: Sede = {
      id: 'sede-1',
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
      estado: 'activo',
    };
    orquestadorService.procesarAltaSede.mockResolvedValue(sede);
    const body: AltaSedeBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
      nombre: 'Melipilla',
    };

    await expect(controller.alta(body)).resolves.toBe(sede);
    expect(orquestadorService.procesarAltaSede).toHaveBeenCalledWith(body);
  });

  it('actualizarEstado delega en OrquestadorService.procesarActualizarEstadoSede (DOC-024 1)', async () => {
    const sede: Sede = {
      id: 'sede-1',
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
      estado: 'inactivo',
    };
    orquestadorService.procesarActualizarEstadoSede.mockResolvedValue(sede);
    const body: ActualizarEstadoSedeBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
      estado: 'inactivo',
    };

    await expect(controller.actualizarEstado('sede-1', body)).resolves.toBe(
      sede,
    );
    expect(
      orquestadorService.procesarActualizarEstadoSede,
    ).toHaveBeenCalledWith('sede-1', body);
  });
});
