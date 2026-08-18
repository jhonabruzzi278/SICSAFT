import { Test, TestingModule } from '@nestjs/testing';
import { HealthController, HealthStatus } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('reports status ok for the cip service', () => {
    const result: HealthStatus = controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('cip');
  });

  it('includes a valid ISO timestamp', () => {
    const result: HealthStatus = controller.check();

    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
