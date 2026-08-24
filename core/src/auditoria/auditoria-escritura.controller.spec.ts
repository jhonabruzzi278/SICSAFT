/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaEscrituraController } from './auditoria-escritura.controller';
import { AuditoriaRepository } from './auditoria.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { RegistrarAuditoriaBody } from './auditoria.schemas';

describe('AuditoriaEscrituraController', () => {
  let controller: AuditoriaEscrituraController;
  let auditoriaRepository: jest.Mocked<AuditoriaRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditoriaEscrituraController],
      providers: [
        {
          provide: AuditoriaRepository,
          useValue: { registrar: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuditoriaEscrituraController);
    auditoriaRepository = module.get(AuditoriaRepository);
  });

  it('registrar fuerza categoria "identidad" sin importar lo que mande el body', async () => {
    const body: RegistrarAuditoriaBody = {
      usuario: 'op-1',
      operacion: 'DELETE /admin/organizaciones/org-1/usuarios/user-1',
      resultado: 'ok',
      observaciones: 'quito rol administrador-patrimonial',
      organizacionId: 'org-1',
    };

    await controller.registrar(body);

    expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
      ...body,
      categoria: 'identidad',
    });
  });

  it('registrar funciona sin los campos opcionales', async () => {
    const body: RegistrarAuditoriaBody = {
      usuario: 'op-1',
      operacion: 'POST /admin/organizaciones/org-1/usuarios',
      resultado: 'rechazado:404',
    };

    await controller.registrar(body);

    expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
      ...body,
      categoria: 'identidad',
    });
  });
});
