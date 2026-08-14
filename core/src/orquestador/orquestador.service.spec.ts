/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { OrquestadorService } from './orquestador.service';
import { InventariosService } from '../inventarios/inventarios.service';
import { EscrituraActivoService } from '../patrimonial/escritura-activo.service';
import { AuditoriaRepository } from '../auditoria/auditoria.repository';
import type { InventarioRequest } from '../inventarios/inventarios.types';
import type { AltaActivoBody } from '../patrimonial/activo.schemas';
import type { Activo } from '../patrimonial/activo.types';

// El rol es de Proyecto pero asignado por organizacion (DOC-012 §2) — el operador de estos tests
// tiene el rol en 'duoc-uc', nunca "en cualquier organizacion".
const ADMIN_ROLES_DUOC_UC = { 'duoc-uc': ['administrador-patrimonial'] };

const ACTIVO: Activo = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-2026-000099',
  codigoQr: 'QR-000099',
  organizacionId: 'duoc-uc',
  areaId: null,
  ubicacionId: null,
  responsableId: null,
  estado: 'activo',
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

function buildPayload(): InventarioRequest {
  return {
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    operadorId: 'op-1',
    organizacionId: 'duoc-uc',
    areaId: 'area-biblioteca',
    ubicacionId: 'ubicacion-biblioteca-101',
    fechaInicio: '2026-01-15T10:00:00.000Z',
    fechaCierre: '2026-01-15T10:30:00.000Z',
    escaneos: [],
    incidencias: [],
  };
}

function buildAltaPayload(
  overrides: Partial<AltaActivoBody> = {},
): AltaActivoBody {
  return {
    correlationId: 'corr-1',
    operadorId: 'op-admin',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    codigoPatrimonial: 'AFT-2026-000099',
    codigoQr: 'QR-000099',
    organizacionId: 'duoc-uc',
    catalogoId: 'catalogo-notebook',
    ...overrides,
  };
}

function buildService() {
  const inventariosService = {
    procesar: jest.fn(),
  } as unknown as jest.Mocked<InventariosService>;
  const escrituraActivoService = {
    alta: jest.fn(),
    baja: jest.fn(),
    reincorporacion: jest.fn(),
    cambioResponsable: jest.fn(),
  } as unknown as jest.Mocked<EscrituraActivoService>;
  const auditoriaRepository = {
    registrar: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditoriaRepository>;

  const service = new OrquestadorService(
    inventariosService,
    escrituraActivoService,
    auditoriaRepository,
  );

  return {
    service,
    inventariosService,
    escrituraActivoService,
    auditoriaRepository,
  };
}

describe('OrquestadorService', () => {
  it('procesa, audita con el resultado y devuelve la respuesta (camino feliz)', async () => {
    const { service, inventariosService, auditoriaRepository } = buildService();
    inventariosService.procesar.mockResolvedValue({
      inventarioId: 'sesion-1',
      estado: 'recibido',
    });

    const respuesta = await service.procesarInventario(
      buildPayload(),
      'x-corr-http',
    );

    expect(respuesta).toEqual({ inventarioId: 'sesion-1', estado: 'recibido' });
    expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
      usuario: 'op-1',
      operacion: 'POST /inventarios',
      resultado: 'recibido',
    });
  });

  it('audita el rechazo con el status HTTP y relanza cuando el motor lanza una HttpException', async () => {
    const { service, inventariosService, auditoriaRepository } = buildService();
    inventariosService.procesar.mockRejectedValue(
      new ConflictException('idempotencyKey ya usada'),
    );

    await expect(
      service.procesarInventario(buildPayload(), 'x-corr-http'),
    ).rejects.toThrow(ConflictException);

    expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
      usuario: 'op-1',
      operacion: 'POST /inventarios',
      resultado: 'rechazado:409',
    });
  });

  it('audita como error interno y relanza cuando el motor lanza un error no-HTTP', async () => {
    const { service, inventariosService, auditoriaRepository } = buildService();
    const errorInesperado = new Error('conexion perdida');
    inventariosService.procesar.mockRejectedValue(errorInesperado);

    await expect(
      service.procesarInventario(buildPayload(), 'x-corr-http'),
    ).rejects.toBe(errorInesperado);

    expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
      usuario: 'op-1',
      operacion: 'POST /inventarios',
      resultado: 'rechazado:error-interno',
    });
  });

  // DOC-012 §5/§8 — escritura oficial de Activo. La autorizacion de rol se resuelve acá adentro
  // (verificarRolAdministradorPatrimonial), no en un guard, para que un 403 por falta de rol
  // tambien quede auditado como rechazo (a diferencia de ServiceTokenGuard, que corta antes del
  // Orquestador porque autentica la conexion CIS<->CORE, no una accion de negocio).
  describe('procesarAltaActivo', () => {
    it('crea el activo, audita el resultado y lo devuelve (camino feliz)', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();
      escrituraActivoService.alta.mockResolvedValue(ACTIVO);

      const activo = await service.procesarAltaActivo(buildAltaPayload());

      expect(activo).toBe(ACTIVO);
      expect(escrituraActivoService.alta).toHaveBeenCalledWith(
        expect.objectContaining({ codigoPatrimonial: 'AFT-2026-000099' }),
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos',
        resultado: 'activo',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si rolesPorOrganizacion no incluye el rol', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaActivo(
          buildAltaPayload({
            rolesPorOrganizacion: { 'duoc-uc': ['operador'] },
          }),
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraActivoService.alta).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos',
        resultado: 'rechazado:403',
      });
    });

    // Hallazgo de revision de seguridad: el rol en OTRA organizacion nunca debe alcanzar.
    it('rechaza con 403 si el operador tiene el rol pero en otra organizacion', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaActivo(
          buildAltaPayload({
            rolesPorOrganizacion: { 'otra-org': ['administrador-patrimonial'] },
          }),
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraActivoService.alta).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos',
        resultado: 'rechazado:403',
      });
    });

    it('audita el rechazo con el status HTTP y relanza cuando el servicio lanza una HttpException', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();
      escrituraActivoService.alta.mockRejectedValue(
        new ConflictException('ya existe'),
      );

      await expect(
        service.procesarAltaActivo(buildAltaPayload()),
      ).rejects.toThrow(ConflictException);

      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos',
        resultado: 'rechazado:409',
      });
    });
  });

  describe('procesarBajaActivo', () => {
    it('da de baja, audita el resultado y lo devuelve', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();
      const dadoDeBaja = { ...ACTIVO, estado: 'dado_de_baja' as const };
      escrituraActivoService.baja.mockResolvedValue(dadoDeBaja);

      const activo = await service.procesarBajaActivo('activo-1', {
        correlationId: 'corr-1',
        operadorId: 'op-admin',
        organizacionId: 'duoc-uc',
        rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      });

      expect(activo).toBe(dadoDeBaja);
      expect(escrituraActivoService.baja).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos/activo-1/baja',
        resultado: 'dado_de_baja',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarBajaActivo('activo-1', {
          correlationId: 'corr-1',
          operadorId: 'op-admin',
          organizacionId: 'duoc-uc',
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraActivoService.baja).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos/activo-1/baja',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarReincorporacionActivo', () => {
    it('reincorpora, audita el resultado y lo devuelve', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();
      escrituraActivoService.reincorporacion.mockResolvedValue(ACTIVO);

      const activo = await service.procesarReincorporacionActivo('activo-1', {
        correlationId: 'corr-1',
        operadorId: 'op-admin',
        organizacionId: 'duoc-uc',
        rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      });

      expect(activo).toBe(ACTIVO);
      expect(escrituraActivoService.reincorporacion).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos/activo-1/reincorporacion',
        resultado: 'activo',
      });
    });
  });

  describe('procesarCambioResponsable', () => {
    it('actualiza el responsable, audita el resultado y lo devuelve', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();
      const conResponsable = { ...ACTIVO, responsableId: 'resp-2' };
      escrituraActivoService.cambioResponsable.mockResolvedValue(
        conResponsable,
      );

      const activo = await service.procesarCambioResponsable('activo-1', {
        correlationId: 'corr-1',
        operadorId: 'op-admin',
        organizacionId: 'duoc-uc',
        rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
        responsableId: 'resp-2',
      });

      expect(activo).toBe(conResponsable);
      expect(escrituraActivoService.cambioResponsable).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        'resp-2',
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos/activo-1/responsable',
        resultado: 'activo',
      });
    });
  });
});
