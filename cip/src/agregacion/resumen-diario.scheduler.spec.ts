/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { AgregacionService } from './agregacion.service';
import { ResumenDiarioScheduler } from './resumen-diario.scheduler';

// El decorador @Cron solo registra metadata que Nest usa para programar la ejecución real — no
// hace falta simular el paso del tiempo para testear la lógica de `ejecutar()`, alcanza con
// invocar el método directamente (mismo criterio que no se testea la librería @nestjs/schedule).
describe('ResumenDiarioScheduler', () => {
  it('ejecutar delega en AgregacionService.procesarResumenDiario', async () => {
    const agregacionService = {
      procesarResumenDiario: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AgregacionService>;
    const scheduler = new ResumenDiarioScheduler(agregacionService);

    await scheduler.ejecutar();

    expect(agregacionService.procesarResumenDiario).toHaveBeenCalledWith();
  });

  it('no propaga el error si procesarResumenDiario falla (sin reintento de @nestjs/schedule)', async () => {
    const agregacionService = {
      procesarResumenDiario: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as jest.Mocked<AgregacionService>;
    const scheduler = new ResumenDiarioScheduler(agregacionService);

    await expect(scheduler.ejecutar()).resolves.toBeUndefined();
  });
});
