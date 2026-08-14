/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaRepository } from './auditoria.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { AuditoriaEntrada } from './auditoria.types';

const ENTRADAS: AuditoriaEntrada[] = [
  {
    id: 'audit-1',
    usuario: 'op-1',
    fecha: '2026-08-14T10:00:00.000Z',
    equipo: null,
    ip: null,
    operacion: 'POST /inventarios',
    resultado: 'recibido',
    observaciones: null,
  },
];

describe('AuditoriaController', () => {
  let controller: AuditoriaController;
  let auditoriaRepository: jest.Mocked<AuditoriaRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [
        {
          provide: AuditoriaRepository,
          useValue: { listar: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuditoriaController);
    auditoriaRepository = module.get(AuditoriaRepository);
  });

  it('getAuditoria delega en AuditoriaRepository.listar con los filtros', async () => {
    auditoriaRepository.listar.mockResolvedValue(ENTRADAS);
    const query = { usuario: 'op-1', operacion: 'inventarios' };

    await expect(controller.getAuditoria(query)).resolves.toBe(ENTRADAS);
    expect(auditoriaRepository.listar).toHaveBeenCalledWith(query);
  });

  it('getAuditoria delega en AuditoriaRepository.listar sin filtros', async () => {
    auditoriaRepository.listar.mockResolvedValue(ENTRADAS);

    await expect(controller.getAuditoria({})).resolves.toBe(ENTRADAS);
    expect(auditoriaRepository.listar).toHaveBeenCalledWith({});
  });
});
