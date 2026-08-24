import { loadMetricsConfig } from './metrics.config';

describe('loadMetricsConfig', () => {
  it('lee METRICS_TOKEN del env cuando esta presente', () => {
    const config = loadMetricsConfig({ METRICS_TOKEN: 'secreto-metrics' });
    expect(config).toEqual({ token: 'secreto-metrics' });
  });

  it('devuelve token undefined cuando METRICS_TOKEN no esta configurado', () => {
    const config = loadMetricsConfig({});
    expect(config).toEqual({ token: undefined });
  });

  it('lanza si METRICS_TOKEN esta presente pero vacio', () => {
    expect(() => loadMetricsConfig({ METRICS_TOKEN: '' })).toThrow('Metrics');
  });
});
