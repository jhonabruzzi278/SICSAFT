/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ActivoEscrituraController } from './activo-escritura.controller';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { AltaActivoBody } from './activo.schemas';
import type { Activo } from './activo.types';

const ACTIVO: Activo = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-2026-000099',
  codigoQr: 'QR-000099',
  organizacionId: 'duoc-uc',
  areaId: null,
  ubicacionId: null,
  responsableId: null,
  estado: 'activo',
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

describe('ActivoEscrituraController', () => {
  let controller: ActivoEscrituraController;
  let orquestadorService: jest.Mocked<OrquestadorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivoEscrituraController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: {
            procesarAltaActivo: jest.fn(),
            procesarBajaActivo: jest.fn(),
            procesarReincorporacionActivo: jest.fn(),
            procesarCambioResponsable: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ActivoEscrituraController);
    orquestadorService = module.get(OrquestadorService);
  });

  it('alta delega en OrquestadorService.procesarAltaActivo con el body', async () => {
    orquestadorService.procesarAltaActivo.mockResolvedValue(ACTIVO);
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      codigoPatrimonial: 'AFT-2026-000099',
      codigoQr: 'QR-000099',
      catalogoId: 'catalogo-notebook',
    } as AltaActivoBody;

    await expect(controller.alta(body)).resolves.toBe(ACTIVO);
    expect(orquestadorService.procesarAltaActivo).toHaveBeenCalledWith(body);
  });

  it('baja delega en OrquestadorService.procesarBajaActivo con el id y el body', async () => {
    orquestadorService.procesarBajaActivo.mockResolvedValue(ACTIVO);
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };

    await expect(controller.baja('activo-1', body)).resolves.toBe(ACTIVO);
    expect(orquestadorService.procesarBajaActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
    );
  });

  it('reincorporacion delega en OrquestadorService.procesarReincorporacionActivo', async () => {
    orquestadorService.procesarReincorporacionActivo.mockResolvedValue(ACTIVO);
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };

    await expect(controller.reincorporacion('activo-1', body)).resolves.toBe(
      ACTIVO,
    );
    expect(
      orquestadorService.procesarReincorporacionActivo,
    ).toHaveBeenCalledWith('activo-1', body);
  });

  it('cambioResponsable delega en OrquestadorService.procesarCambioResponsable', async () => {
    const conResponsable = { ...ACTIVO, responsableId: 'resp-2' };
    orquestadorService.procesarCambioResponsable.mockResolvedValue(
      conResponsable,
    );
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      responsableId: 'resp-2',
    };

    await expect(controller.cambioResponsable('activo-1', body)).resolves.toBe(
      conResponsable,
    );
    expect(orquestadorService.procesarCambioResponsable).toHaveBeenCalledWith(
      'activo-1',
      body,
    );
  });
});
