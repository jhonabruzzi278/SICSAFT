import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsModule } from './entitlements.module';
import { EntitlementsController } from './entitlements.controller';

describe('EntitlementsModule', () => {
  it('wires EntitlementsController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EntitlementsModule],
    }).compile();

    expect(module.get(EntitlementsController)).toBeInstanceOf(
      EntitlementsController,
    );
  });
});
