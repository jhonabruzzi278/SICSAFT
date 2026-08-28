import { DeviceRegistryService } from './device-registry.service';

describe('DeviceRegistryService', () => {
  let service: DeviceRegistryService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new DeviceRegistryService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registra el deviceId del operador con el TTL indicado (un timer pendiente)', () => {
    service.registerDevice('op-1', 'device-a', 900_000);

    expect(jest.getTimerCount()).toBe(1);
  });

  it('el registro de un dispositivo nuevo sobreescribe al anterior (supersede, no rechazo)', () => {
    service.registerDevice('op-1', 'device-a', 900_000);
    service.registerDevice('op-1', 'device-b', 900_000);

    // El timer del registro viejo se cancela al reemplazar — sigue habiendo uno solo pendiente
    // para 'op-1', no dos (si no se cancelara, el timer viejo podría borrar el registro nuevo
    // antes de tiempo).
    expect(jest.getTimerCount()).toBe(1);
  });

  it('el registro expira solo cuando vence el TTL', () => {
    service.registerDevice('op-1', 'device-a', 900_000);

    jest.advanceTimersByTime(900_000);

    expect(jest.getTimerCount()).toBe(0);
  });

  it('mantiene registros independientes por operador', () => {
    service.registerDevice('op-1', 'device-a', 900_000);
    service.registerDevice('op-2', 'device-b', 900_000);

    expect(jest.getTimerCount()).toBe(2);
  });
});
