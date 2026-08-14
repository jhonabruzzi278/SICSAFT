import type { Redis } from 'ioredis';
import { DeviceRegistryService } from './device-registry.service';

describe('DeviceRegistryService', () => {
  let redis: jest.Mocked<Pick<Redis, 'set'>>;
  let service: DeviceRegistryService;

  beforeEach(() => {
    redis = { set: jest.fn() };
    service = new DeviceRegistryService(redis as unknown as Redis);
  });

  it('registra el deviceId del operador con el TTL indicado', async () => {
    redis.set.mockResolvedValue('OK');

    await service.registerDevice('op-1', 'device-a', 900_000);

    expect(redis.set).toHaveBeenCalledWith(
      'device:operador:op-1',
      'device-a',
      'PX',
      900_000,
    );
  });

  it('el registro de un dispositivo nuevo sobreescribe al anterior (supersede, no rechazo)', async () => {
    redis.set.mockResolvedValue('OK');

    await service.registerDevice('op-1', 'device-a', 900_000);
    await service.registerDevice('op-1', 'device-b', 900_000);

    expect(redis.set).toHaveBeenNthCalledWith(
      2,
      'device:operador:op-1',
      'device-b',
      'PX',
      900_000,
    );
  });

  it('falla abierto si Redis rechaza el comando (no propaga el error)', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.registerDevice('op-1', 'device-a', 900_000),
    ).resolves.toBeUndefined();
  });
});
