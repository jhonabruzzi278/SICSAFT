/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizacionEscrituraController } from './organizacion-escritura.controller';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type {
  ActualizarEstadoOrganizacionBody,
  ActualizarOrganizacionBody,
  AltaOrganizacionBody,
} from './organizacion.schemas';
import type { Organizacion } from './organizacion.types';

describe('OrganizacionEscrituraController', () => {
  let controller: OrganizacionEscrituraController;
  let orquestadorService: jest.Mocked<OrquestadorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizacionEscrituraController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: {
            procesarAltaOrganizacion: jest.fn(),
            procesarActualizarOrganizacion: jest.fn(),
            procesarActualizarEstadoOrganizacion: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OrganizacionEscrituraController);
    orquestadorService = module.get(OrquestadorService);
  });

  it('crear delega en OrquestadorService.procesarAltaOrganizacion con el body', async () => {
    const organizacion: Organizacion = {
      id: 'duoc-uc',
      nombre: 'DUOC UC',
      estado: 'activo',
    };
    orquestadorService.procesarAltaOrganizacion.mockResolvedValue(organizacion);
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
      id: 'duoc-uc',
      nombre: 'DUOC UC',
    } as AltaOrganizacionBody;

    await expect(controller.crear(body)).resolves.toBe(organizacion);
    expect(orquestadorService.procesarAltaOrganizacion).toHaveBeenCalledWith(
      body,
    );
  });

  it('actualizar delega en OrquestadorService.procesarActualizarOrganizacion (DOC-024 1)', async () => {
    const organizacion: Organizacion = {
      id: 'duoc-uc',
      nombre: 'DUOC UC (renombrada)',
      estado: 'activo',
    };
    orquestadorService.procesarActualizarOrganizacion.mockResolvedValue(
      organizacion,
    );
    const body: ActualizarOrganizacionBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
      nombre: 'DUOC UC (renombrada)',
    };

    await expect(controller.actualizar('duoc-uc', body)).resolves.toBe(
      organizacion,
    );
    expect(
      orquestadorService.procesarActualizarOrganizacion,
    ).toHaveBeenCalledWith('duoc-uc', body);
  });

  it('actualizarEstado delega en OrquestadorService.procesarActualizarEstadoOrganizacion (DOC-024 1)', async () => {
    const organizacion: Organizacion = {
      id: 'duoc-uc',
      nombre: 'DUOC UC',
      estado: 'inactivo',
    };
    orquestadorService.procesarActualizarEstadoOrganizacion.mockResolvedValue(
      organizacion,
    );
    const body: ActualizarEstadoOrganizacionBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
      estado: 'inactivo',
    };

    await expect(controller.actualizarEstado('duoc-uc', body)).resolves.toBe(
      organizacion,
    );
    expect(
      orquestadorService.procesarActualizarEstadoOrganizacion,
    ).toHaveBeenCalledWith('duoc-uc', body);
  });
});
