import { Test, TestingModule } from '@nestjs/testing';
import { MetricsModule } from './metrics.module';
import { MetricsTokenGuard } from './metrics-token.guard';
import { MetricsController } from './metrics.controller';
import { METRICS_CONFIG } from './metrics.constants';

describe('MetricsModule', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires MetricsTokenGuard y MetricsController con la config leida de env', async () => {
    process.env = { ...originalEnv, METRICS_TOKEN: 'secreto-metrics' };

    const module: TestingModule = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();

    expect(module.get(MetricsTokenGuard)).toBeInstanceOf(MetricsTokenGuard);
    // MetricsController vive en el modulo dinamico de PrometheusModule.register(), no en el
    // nuestro (ver comentario de metrics.module.ts) -- strict: false busca en todo el arbol.
    expect(module.get(MetricsController, { strict: false })).toBeInstanceOf(
      MetricsController,
    );
    expect(module.get(METRICS_CONFIG)).toEqual({ token: 'secreto-metrics' });
  });

  it('wires con token undefined cuando METRICS_TOKEN no esta configurado', async () => {
    process.env = { ...originalEnv };
    delete process.env.METRICS_TOKEN;

    const module: TestingModule = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();

    expect(module.get(METRICS_CONFIG)).toEqual({ token: undefined });
  });
});
