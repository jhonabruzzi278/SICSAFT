/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ContratoEscrituraController } from './contrato-escritura.controller';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { AltaContratoBody } from './contrato.schemas';
import type { Contrato } from './contrato.types';

const CONTRATO: Contrato = {
  id: 'contrato-1',
  organizacionId: 'duoc-uc',
  organizacionNombre: 'DUOC UC',
  sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
  vigenciaDesde: '2026-01-01T00:00:00.000Z',
  vigenciaHasta: null,
  estado: 'vigente',
  modulosContratados: ['inventario-qr'],
};

describe('ContratoEscrituraController', () => {
  let controller: ContratoEscrituraController;
  let orquestadorService: jest.Mocked<OrquestadorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContratoEscrituraController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: {
            procesarAltaContrato: jest.fn(),
            procesarActualizacionContrato: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ContratoEscrituraController);
    orquestadorService = module.get(OrquestadorService);
  });

  it('alta delega en OrquestadorService.procesarAltaContrato con el body', async () => {
    orquestadorService.procesarAltaContrato.mockResolvedValue(CONTRATO);
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      sedeIds: ['melipilla'],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      modulosContratados: ['inventario-qr'],
    } as AltaContratoBody;

    await expect(controller.alta(body)).resolves.toBe(CONTRATO);
    expect(orquestadorService.procesarAltaContrato).toHaveBeenCalledWith(body);
  });

  it('actualizarEstado delega en OrquestadorService.procesarActualizacionContrato con el id y el body', async () => {
    const suspendido = { ...CONTRATO, estado: 'suspendido' as const };
    orquestadorService.procesarActualizacionContrato.mockResolvedValue(
      suspendido,
    );
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      estado: 'suspendido' as const,
    };

    await expect(controller.actualizarEstado('contrato-1', body)).resolves.toBe(
      suspendido,
    );
    expect(
      orquestadorService.procesarActualizacionContrato,
    ).toHaveBeenCalledWith('contrato-1', body);
  });
});
