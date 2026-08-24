import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  it('delega en PrometheusController.index (Content-Type + body de metricas)', async () => {
    const controller = new MetricsController();
    const response = { header: jest.fn() };

    const body = await controller.index(response as never);

    expect(response.header).toHaveBeenCalledWith(
      'Content-Type',
      expect.any(String),
    );
    expect(typeof body).toBe('string');
  });
});
