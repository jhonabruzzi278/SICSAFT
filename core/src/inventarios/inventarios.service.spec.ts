/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InventariosService } from './inventarios.service';
import { ActivoRepository } from '../patrimonial/activo.repository';
import { EventoRepository } from '../eventos/evento.repository';
import { SesionInventarioRepository } from './sesion-inventario.repository';
import type { Activo } from '../patrimonial/activo.types';
import type { InventarioRequest } from './inventarios.types';

const ACTIVO: Activo = {
  id: 'activo-notebook-001',
  codigoPatrimonial: 'AFT-2026-000001',
  codigoQr: 'QR-000001',
  organizacionId: 'duoc-uc',
  responsableId: null,
  areaId: 'area-biblioteca',
  ubicacionId: 'ubicacion-biblioteca-101',
  estado: 'activo',
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: 'Notebook',
    marca: 'Dell',
    modelo: 'Latitude 5440',
  },
};

function buildPayload(
  overrides: Partial<InventarioRequest> = {},
): InventarioRequest {
  return {
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    operadorId: 'op-1',
    organizacionId: 'duoc-uc',
    areaId: 'area-biblioteca',
    ubicacionId: 'ubicacion-biblioteca-101',
    fechaInicio: '2026-01-15T10:00:00.000Z',
    fechaCierre: '2026-01-15T10:30:00.000Z',
    escaneos: [{ codigoQr: 'QR-000001', resultado: 'correcto' }],
    incidencias: [],
    ...overrides,
  };
}

function buildService() {
  const sesionRepository = {
    findByIdempotencyKey: jest.fn(),
    findEstado: jest.fn(),
    findByOrganizacion: jest.fn(),
    findDetalle: jest.fn(),
    crear: jest.fn(),
  } as unknown as jest.Mocked<SesionInventarioRepository>;
  const activoRepository = {
    findByCodigoQr: jest.fn(),
    existeMasDeUnActivoConCodigoQr: jest.fn().mockResolvedValue(false),
    findCatalogo: jest.fn(),
    cambiarEstado: jest.fn(),
  } as unknown as jest.Mocked<ActivoRepository>;
  const eventoRepository = {
    registrar: jest.fn(),
  } as unknown as jest.Mocked<EventoRepository>;

  const service = new InventariosService(
    sesionRepository,
    activoRepository,
    eventoRepository,
  );

  return { service, sesionRepository, activoRepository, eventoRepository };
}

describe('InventariosService', () => {
  describe('procesar — sesion nueva', () => {
    it('clasifica cada escaneo, persiste la sesion y registra un evento por activo real', async () => {
      const { service, sesionRepository, activoRepository, eventoRepository } =
        buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockImplementation((codigoQr) =>
        Promise.resolve(codigoQr === 'QR-000001' ? ACTIVO : null),
      );

      const payload = buildPayload({
        escaneos: [
          { codigoQr: 'QR-000001', resultado: 'correcto' },
          { codigoQr: 'QR-NOPE', resultado: 'no_registrado' },
        ],
      });

      const respuesta = await service.procesar(payload);

      expect(respuesta.estado).toBe('recibido');
      expect(respuesta.inventarioId).toEqual(expect.any(String));

      expect(sesionRepository.crear).toHaveBeenCalledTimes(1);
      const [sesionArg, filasArg] = sesionRepository.crear.mock.calls[0];
      expect(sesionArg.idempotencyKey).toBe('idem-1');
      expect(filasArg).toHaveLength(2);
      expect(filasArg[0]).toMatchObject({
        codigoQr: 'QR-000001',
        activoId: 'activo-notebook-001',
        resultado: 'correcto',
      });
      expect(filasArg[1]).toMatchObject({
        codigoQr: 'QR-NOPE',
        activoId: null,
        resultado: 'no_registrado',
      });

      // Solo el escaneo con activo real genera evento.
      expect(eventoRepository.registrar).toHaveBeenCalledTimes(1);
      expect(eventoRepository.registrar).toHaveBeenCalledWith({
        activoId: 'activo-notebook-001',
        tipo: 'escaneo_qr',
        usuario: 'op-1',
        detalle: { resultado: 'correcto', sesionId: respuesta.inventarioId },
      });
    });

    it('marca ya_escaneado si el mismo codigo aparece dos veces en la misma sesion', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(ACTIVO);

      await service.procesar(
        buildPayload({
          escaneos: [
            { codigoQr: 'QR-000001', resultado: 'correcto' },
            { codigoQr: 'QR-000001', resultado: 'correcto' },
          ],
        }),
      );

      const [, filasArg] = sesionRepository.crear.mock.calls[0];
      expect(filasArg[0].resultado).toBe('correcto');
      expect(filasArg[1].resultado).toBe('ya_escaneado');
    });

    it('adjunta la descripcion de la incidencia como observaciones', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(ACTIVO);

      await service.procesar(
        buildPayload({
          incidencias: [
            { codigoQr: 'QR-000001', descripcion: 'Pantalla trizada' },
          ],
        }),
      );

      const [, filasArg] = sesionRepository.crear.mock.calls[0];
      expect(filasArg[0].resultado).toBe('con_incidencia');
      expect(filasArg[0].observaciones).toBe('Pantalla trizada');
    });
  });

  describe('procesar — estado operativo declarado (Fase 3.1/DOC-012 §5.1)', () => {
    it('aplica la transicion de estado sin requerir rol, sin evento para "activo"', async () => {
      const { service, sesionRepository, activoRepository, eventoRepository } =
        buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(ACTIVO);
      activoRepository.cambiarEstado.mockResolvedValue({
        ...ACTIVO,
        estado: 'activo',
      });

      await service.procesar(
        buildPayload({
          escaneos: [
            {
              codigoQr: 'QR-000001',
              resultado: 'correcto',
              estadoDeclarado: 'activo',
            },
          ],
        }),
      );

      expect(activoRepository.cambiarEstado).toHaveBeenCalledWith(
        'activo-notebook-001',
        'duoc-uc',
        ['activo', 'mantenimiento', 'inactivo'],
        'activo',
      );
      // Solo el evento escaneo_qr — "activo" no genera evento propio (§ inventarios.service.ts).
      expect(eventoRepository.registrar).toHaveBeenCalledTimes(1);
    });

    it('mantenimiento/inactivo registran ademas un evento propio', async () => {
      const { service, sesionRepository, activoRepository, eventoRepository } =
        buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(ACTIVO);
      activoRepository.cambiarEstado.mockResolvedValue({
        ...ACTIVO,
        estado: 'mantenimiento',
      });

      await service.procesar(
        buildPayload({
          escaneos: [
            {
              codigoQr: 'QR-000001',
              resultado: 'correcto',
              estadoDeclarado: 'mantenimiento',
            },
          ],
        }),
      );

      expect(eventoRepository.registrar).toHaveBeenCalledWith({
        activoId: 'activo-notebook-001',
        tipo: 'mantenimiento',
        usuario: 'op-1',
        detalle: { origen: 'control_inventario' },
      });
    });

    it('estado incompatible (400 de cambiarEstado) se ignora sin abortar la sesion', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue({
        ...ACTIVO,
        estado: 'dado_de_baja',
      });
      activoRepository.cambiarEstado.mockRejectedValue(
        new BadRequestException({ message: 'estado incompatible' }),
      );

      const respuesta = await service.procesar(
        buildPayload({
          escaneos: [
            {
              codigoQr: 'QR-000001',
              resultado: 'correcto',
              estadoDeclarado: 'mantenimiento',
            },
          ],
        }),
      );

      expect(respuesta.estado).toBe('recibido');
    });

    it('codigoQr repetido en el mismo request aplica estadoDeclarado una sola vez', async () => {
      const { service, sesionRepository, activoRepository, eventoRepository } =
        buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(ACTIVO);
      activoRepository.cambiarEstado.mockResolvedValue({
        ...ACTIVO,
        estado: 'mantenimiento',
      });

      await service.procesar(
        buildPayload({
          escaneos: [
            {
              codigoQr: 'QR-000001',
              resultado: 'correcto',
              estadoDeclarado: 'mantenimiento',
            },
            {
              codigoQr: 'QR-000001',
              resultado: 'correcto',
              estadoDeclarado: 'mantenimiento',
            },
          ],
        }),
      );

      // 2 eventos escaneo_qr (uno por ocurrencia) + 1 solo evento mantenimiento (no 2).
      expect(activoRepository.cambiarEstado).toHaveBeenCalledTimes(1);
      expect(eventoRepository.registrar).toHaveBeenCalledTimes(3);
    });

    it('un error inesperado de cambiarEstado (no 400/404) se relanza tal cual', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(ACTIVO);
      const errorInesperado = new Error('conexion perdida');
      activoRepository.cambiarEstado.mockRejectedValue(errorInesperado);

      await expect(
        service.procesar(
          buildPayload({
            escaneos: [
              {
                codigoQr: 'QR-000001',
                resultado: 'correcto',
                estadoDeclarado: 'mantenimiento',
              },
            ],
          }),
        ),
      ).rejects.toBe(errorInesperado);
    });

    it('bajaSugerida registra un evento informativo, sin tocar Activo.estado', async () => {
      const { service, sesionRepository, activoRepository, eventoRepository } =
        buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(ACTIVO);

      const respuesta = await service.procesar(
        buildPayload({
          escaneos: [
            {
              codigoQr: 'QR-000001',
              resultado: 'correcto',
              bajaSugerida: { motivo: 'Pantalla rota, no enciende' },
            },
          ],
        }),
      );

      expect(activoRepository.cambiarEstado).not.toHaveBeenCalled();
      expect(eventoRepository.registrar).toHaveBeenCalledWith({
        activoId: 'activo-notebook-001',
        tipo: 'baja_sugerida',
        usuario: 'op-1',
        detalle: {
          motivo: 'Pantalla rota, no enciende',
          sesionId: respuesta.inventarioId,
        },
      });
    });
  });

  describe('procesar — idempotencia', () => {
    it('reintento con el mismo payload devuelve el resultado ya procesado sin reclasificar', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      const payload = buildPayload();
      sesionRepository.findByIdempotencyKey.mockResolvedValue({
        id: 'sesion-existente',
        estado: 'recibido',
        requestHash: createHash('sha256')
          .update(JSON.stringify(payload))
          .digest('hex'),
      });

      const respuesta = await service.procesar(payload);

      expect(respuesta).toEqual({
        inventarioId: 'sesion-existente',
        estado: 'recibido',
      });
      expect(activoRepository.findByCodigoQr).not.toHaveBeenCalled();
      expect(sesionRepository.crear).not.toHaveBeenCalled();
    });

    it('mismo idempotencyKey con payload distinto lanza 409', async () => {
      const { service, sesionRepository } = buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue({
        id: 'sesion-existente',
        estado: 'recibido',
        requestHash: 'hash-completamente-distinto',
      });

      await expect(service.procesar(buildPayload())).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('procesar — errores de persistencia', () => {
    it('violacion de foreign key se traduce a 400', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(null);
      sesionRepository.crear.mockRejectedValue({ code: '23503' });

      await expect(service.procesar(buildPayload())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('carrera de idempotencyKey (unique violation) resuelve como reintento si la sesion ya existe', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      const payload = buildPayload();
      const hash = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
      sesionRepository.findByIdempotencyKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'sesion-de-la-otra-request',
          estado: 'recibido',
          requestHash: hash,
        });
      activoRepository.findByCodigoQr.mockResolvedValue(null);
      sesionRepository.crear.mockRejectedValue({ code: '23505' });

      const respuesta = await service.procesar(payload);

      expect(respuesta).toEqual({
        inventarioId: 'sesion-de-la-otra-request',
        estado: 'recibido',
      });
    });

    it('unique violation sin sesion recuperable relanza el error original', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      sesionRepository.findByIdempotencyKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      activoRepository.findByCodigoQr.mockResolvedValue(null);
      const errorOriginal = { code: '23505' };
      sesionRepository.crear.mockRejectedValue(errorOriginal);

      await expect(service.procesar(buildPayload())).rejects.toBe(
        errorOriginal,
      );
    });

    it('cualquier otro error de persistencia se relanza tal cual', async () => {
      const { service, sesionRepository, activoRepository } = buildService();
      sesionRepository.findByIdempotencyKey.mockResolvedValue(null);
      activoRepository.findByCodigoQr.mockResolvedValue(null);
      const errorInesperado = new Error('conexion perdida');
      sesionRepository.crear.mockRejectedValue(errorInesperado);

      await expect(service.procesar(buildPayload())).rejects.toBe(
        errorInesperado,
      );
    });
  });

  describe('obtenerEstado', () => {
    it('devuelve el estado cuando la sesion existe', async () => {
      const { service, sesionRepository } = buildService();
      sesionRepository.findEstado.mockResolvedValue({
        estado: 'recibido',
        ultimoIntento: '2026-01-15T10:30:00.000Z',
      });

      await expect(service.obtenerEstado('sesion-1')).resolves.toEqual({
        estado: 'recibido',
        ultimoIntento: '2026-01-15T10:30:00.000Z',
      });
    });

    it('lanza 404 cuando la sesion no existe', async () => {
      const { service, sesionRepository } = buildService();
      sesionRepository.findEstado.mockResolvedValue(null);

      await expect(service.obtenerEstado('sesion-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listarSesiones', () => {
    it('delega en sesionRepository.findByOrganizacion', async () => {
      const { service, sesionRepository } = buildService();
      const sesiones = [
        {
          id: 'sesion-1',
          organizacionId: 'duoc-uc',
          areaId: 'area-biblioteca',
          ubicacionId: 'ubicacion-biblioteca-101',
          operadorId: 'op-1',
          fechaInicio: '2026-01-15T10:00:00.000Z',
          fechaCierre: '2026-01-15T10:30:00.000Z',
          estado: 'recibido' as const,
          creadoEn: '2026-01-15T10:30:05.000Z',
        },
      ];
      sesionRepository.findByOrganizacion.mockResolvedValue(sesiones);

      await expect(service.listarSesiones('duoc-uc')).resolves.toBe(sesiones);
      expect(sesionRepository.findByOrganizacion).toHaveBeenCalledWith(
        'duoc-uc',
      );
    });
  });

  describe('obtenerDetalle', () => {
    it('devuelve el detalle cuando la sesion existe', async () => {
      const { service, sesionRepository } = buildService();
      const detalle = {
        id: 'sesion-1',
        organizacionId: 'duoc-uc',
        areaId: 'area-biblioteca',
        ubicacionId: 'ubicacion-biblioteca-101',
        operadorId: 'op-1',
        fechaInicio: '2026-01-15T10:00:00.000Z',
        fechaCierre: '2026-01-15T10:30:00.000Z',
        estado: 'recibido' as const,
        creadoEn: '2026-01-15T10:30:05.000Z',
        escaneos: [],
      };
      sesionRepository.findDetalle.mockResolvedValue(detalle);

      await expect(service.obtenerDetalle('sesion-1')).resolves.toBe(detalle);
    });

    it('lanza 404 cuando la sesion no existe', async () => {
      const { service, sesionRepository } = buildService();
      sesionRepository.findDetalle.mockResolvedValue(null);

      await expect(service.obtenerDetalle('sesion-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
