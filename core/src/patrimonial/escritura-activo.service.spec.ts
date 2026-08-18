/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { EscrituraActivoService } from './escritura-activo.service';
import { ActivoRepository } from './activo.repository';
import { EventoRepository } from '../eventos/evento.repository';
import type { Activo, NuevoActivoInput } from './activo.types';

const ACTIVO: Activo = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-2026-000099',
  codigoQr: 'QR-000099',
  organizacionId: 'duoc-uc',
  areaId: null,
  ubicacionId: null,
  responsableId: null,
  estado: 'activo',
  descripcion: null,
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

function buildService() {
  const activoRepository = {
    crear: jest.fn(),
    cambiarEstado: jest.fn(),
    actualizarResponsable: jest.fn(),
    actualizarDescripcion: jest.fn(),
  } as unknown as jest.Mocked<ActivoRepository>;
  const eventoRepository = {
    registrar: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EventoRepository>;

  const service = new EscrituraActivoService(
    activoRepository,
    eventoRepository,
  );

  return { service, activoRepository, eventoRepository };
}

describe('EscrituraActivoService', () => {
  describe('alta', () => {
    it('crea el activo y registra un evento de tipo alta', async () => {
      const { service, activoRepository, eventoRepository } = buildService();
      activoRepository.crear.mockResolvedValue(ACTIVO);
      const input: NuevoActivoInput = {
        codigoPatrimonial: 'AFT-2026-000099',
        codigoQr: 'QR-000099',
        organizacionId: 'duoc-uc',
        catalogoId: 'catalogo-notebook',
      };

      const activo = await service.alta(input, 'op-admin');

      expect(activo).toBe(ACTIVO);
      expect(activoRepository.crear).toHaveBeenCalledWith(input);
      expect(eventoRepository.registrar).toHaveBeenCalledWith({
        activoId: 'activo-1',
        tipo: 'alta',
        usuario: 'op-admin',
        detalle: { codigoPatrimonial: 'AFT-2026-000099' },
      });
    });
  });

  describe('baja', () => {
    it('transiciona a dado_de_baja y registra un evento de tipo baja', async () => {
      const { service, activoRepository, eventoRepository } = buildService();
      const dadoDeBaja = { ...ACTIVO, estado: 'dado_de_baja' as const };
      activoRepository.cambiarEstado.mockResolvedValue(dadoDeBaja);

      const activo = await service.baja('activo-1', 'duoc-uc', 'op-admin');

      expect(activo).toBe(dadoDeBaja);
      expect(activoRepository.cambiarEstado).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        ['activo', 'extraviado'],
        'dado_de_baja',
      );
      expect(eventoRepository.registrar).toHaveBeenCalledWith({
        activoId: 'activo-1',
        tipo: 'baja',
        usuario: 'op-admin',
      });
    });
  });

  describe('reincorporacion', () => {
    it('transiciona extraviado -> activo y registra un evento de tipo reincorporacion', async () => {
      const { service, activoRepository, eventoRepository } = buildService();
      activoRepository.cambiarEstado.mockResolvedValue(ACTIVO);

      const activo = await service.reincorporacion(
        'activo-1',
        'duoc-uc',
        'op-admin',
      );

      expect(activo).toBe(ACTIVO);
      expect(activoRepository.cambiarEstado).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        ['extraviado'],
        'activo',
      );
      expect(eventoRepository.registrar).toHaveBeenCalledWith({
        activoId: 'activo-1',
        tipo: 'reincorporacion',
        usuario: 'op-admin',
      });
    });
  });

  describe('cambioResponsable', () => {
    it('actualiza el responsable y registra un evento de tipo cambio_responsable', async () => {
      const { service, activoRepository, eventoRepository } = buildService();
      const conResponsable = { ...ACTIVO, responsableId: 'resp-2' };
      activoRepository.actualizarResponsable.mockResolvedValue(conResponsable);

      const activo = await service.cambioResponsable(
        'activo-1',
        'duoc-uc',
        'resp-2',
        'op-admin',
      );

      expect(activo).toBe(conResponsable);
      expect(activoRepository.actualizarResponsable).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        'resp-2',
      );
      expect(eventoRepository.registrar).toHaveBeenCalledWith({
        activoId: 'activo-1',
        tipo: 'cambio_responsable',
        usuario: 'op-admin',
        detalle: { responsableId: 'resp-2' },
      });
    });
  });

  describe('actualizarDescripcion', () => {
    it('actualiza la descripcion y registra un evento de tipo cambio_descripcion', async () => {
      const { service, activoRepository, eventoRepository } = buildService();
      const conDescripcion = { ...ACTIVO, descripcion: 'Notebook nuevo' };
      activoRepository.actualizarDescripcion.mockResolvedValue(conDescripcion);

      const activo = await service.actualizarDescripcion(
        'activo-1',
        'duoc-uc',
        'Notebook nuevo',
        'op-admin',
      );

      expect(activo).toBe(conDescripcion);
      expect(activoRepository.actualizarDescripcion).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        'Notebook nuevo',
      );
      expect(eventoRepository.registrar).toHaveBeenCalledWith({
        activoId: 'activo-1',
        tipo: 'cambio_descripcion',
        usuario: 'op-admin',
      });
    });
  });
});
