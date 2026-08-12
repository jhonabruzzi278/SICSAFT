/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, la regla
   solo tiene falsos positivos al referenciar un metodo mockeado sin invocarlo dentro de expect(). */
import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { EntitlementsResponse } from './entitlements.types';

describe('EntitlementsController', () => {
  let controller: EntitlementsController;
  let service: jest.Mocked<EntitlementsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntitlementsController],
      providers: [
        {
          provide: EntitlementsService,
          useValue: { resolve: jest.fn() },
        },
      ],
    })
      // El controller no ejecuta el guard en estos tests (se llama el metodo directo, sin HTTP)
      // — se sobreescribe igual porque Nest resuelve las dependencias de ServiceTokenGuard al
      // armar el modulo aunque nunca corra canActivate.
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EntitlementsController);
    service = module.get(EntitlementsService);
  });

  it('getEntitlements delega en el service con operadorId', async () => {
    const expected: EntitlementsResponse = { organizaciones: [] };
    service.resolve.mockResolvedValue(expected);

    await expect(
      controller.getEntitlements({ operadorId: 'op-1' }),
    ).resolves.toBe(expected);
    expect(service.resolve).toHaveBeenCalledWith('op-1');
  });
});
