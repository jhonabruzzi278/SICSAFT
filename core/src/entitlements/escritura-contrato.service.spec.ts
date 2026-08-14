/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { EscrituraContratoService } from './escritura-contrato.service';
import { ContratoRepository } from './contrato.repository';
import { EventoRepository } from '../eventos/evento.repository';
import type { Contrato, NuevoContratoInput } from './contrato.types';

const CONTRATO: Contrato = {
  id: 'contrato-1',
  organizacionId: 'duoc-uc',
  organizacionNombre: 'DUOC UC',
  sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
  vigenciaDesde: '2026-01-01T00:00:00.000Z',
  vigenciaHasta: null,
  estado: 'vigente',
  modulosContratados: ['inventario-qr'],
};

function buildService() {
  const contratoRepository = {
    crear: jest.fn(),
    actualizarEstado: jest.fn(),
  } as unknown as jest.Mocked<ContratoRepository>;
  const eventoRepository = {
    registrarContrato: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventoRepository>;

  const service = new EscrituraContratoService(
    contratoRepository,
    eventoRepository,
  );

  return { service, contratoRepository, eventoRepository };
}

describe('EscrituraContratoService', () => {
  describe('alta', () => {
    it('crea el contrato y registra un evento contrato_actualizado', async () => {
      const { service, contratoRepository, eventoRepository } = buildService();
      contratoRepository.crear.mockResolvedValue(CONTRATO);
      const input: NuevoContratoInput = {
        organizacionId: 'duoc-uc',
        sedeIds: ['melipilla'],
        vigenciaDesde: '2026-01-01T00:00:00.000Z',
        modulosContratados: ['inventario-qr'],
      };

      const contrato = await service.alta(input, 'op-admin');

      expect(contrato).toBe(CONTRATO);
      expect(contratoRepository.crear).toHaveBeenCalledWith(input);
      expect(eventoRepository.registrarContrato).toHaveBeenCalledWith({
        contratoId: 'contrato-1',
        tipo: 'contrato_actualizado',
        usuario: 'op-admin',
        detalle: { estadoNuevo: 'vigente' },
      });
    });
  });

  describe('actualizarEstado', () => {
    it('actualiza el estado y registra un evento contrato_actualizado', async () => {
      const { service, contratoRepository, eventoRepository } = buildService();
      const suspendido = { ...CONTRATO, estado: 'suspendido' as const };
      contratoRepository.actualizarEstado.mockResolvedValue(suspendido);

      const contrato = await service.actualizarEstado(
        'contrato-1',
        'duoc-uc',
        'suspendido',
        'op-admin',
      );

      expect(contrato).toBe(suspendido);
      expect(contratoRepository.actualizarEstado).toHaveBeenCalledWith(
        'contrato-1',
        'duoc-uc',
        'suspendido',
      );
      expect(eventoRepository.registrarContrato).toHaveBeenCalledWith({
        contratoId: 'contrato-1',
        tipo: 'contrato_actualizado',
        usuario: 'op-admin',
        detalle: { estadoNuevo: 'suspendido' },
      });
    });
  });
});
