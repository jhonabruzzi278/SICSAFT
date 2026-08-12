/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, la regla
   solo tiene falsos positivos al referenciar un metodo mockeado sin invocarlo dentro de expect(). */
import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
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
    }).compile();

    controller = module.get(EntitlementsController);
    service = module.get(EntitlementsService);
  });

  it('getEntitlements delega en el service con operadorId', () => {
    const expected: EntitlementsResponse = { organizaciones: [] };
    service.resolve.mockReturnValue(expected);

    expect(controller.getEntitlements({ operadorId: 'op-1' })).toBe(expected);
    expect(service.resolve).toHaveBeenCalledWith('op-1');
  });
});
