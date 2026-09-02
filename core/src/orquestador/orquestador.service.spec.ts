/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { OrquestadorService } from './orquestador.service';
import { InventariosService } from '../inventarios/inventarios.service';
import { EscrituraActivoService } from '../patrimonial/escritura-activo.service';
import { ImportacionContableService } from '../patrimonial/importacion-contable.service';
import { ImportacionContableLoteService } from '../patrimonial/importacion-contable-lote.service';
import { EscrituraContratoService } from '../entitlements/escritura-contrato.service';
import { EscrituraOrganizacionService } from '../entitlements/escritura-organizacion.service';
import { EscrituraSedeService } from '../entitlements/escritura-sede.service';
import { EscrituraEstructuraService } from '../estructura/escritura-estructura.service';
import { EscrituraDocumentoActivoService } from '../patrimonial/escritura-documento-activo.service';
import { CatalogoTipoActivoRepository } from '../patrimonial/catalogo-tipo-activo.repository';
import { AuditoriaRepository } from '../auditoria/auditoria.repository';
import type { InventarioRequest } from '../inventarios/inventarios.types';
import type { AltaActivoBody } from '../patrimonial/activo.schemas';
import type { Activo } from '../patrimonial/activo.types';
import type { ImportacionContableResultado } from '../patrimonial/importacion-contable.types';
import type { AltaContratoBody } from '../entitlements/contrato.schemas';
import type { Contrato } from '../entitlements/contrato.types';
import type { AltaCatalogoTipoBody } from '../patrimonial/catalogo-tipo-activo.schemas';
import type { CatalogoTipoActivo } from '../patrimonial/catalogo-tipo-activo.types';
import type {
  AltaDocumentoActivoBody,
  EliminarDocumentoActivoBody,
} from '../patrimonial/documento-activo.schemas';
import type { DocumentoActivo } from '../patrimonial/documento-activo.types';
import type { AltaOrganizacionBody } from '../entitlements/organizacion.schemas';
import type { Organizacion } from '../entitlements/organizacion.types';
import type { AltaSedeBody } from '../entitlements/sede.schemas';
import type { Sede } from '../entitlements/sede.types';
import type {
  AltaAreaBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  ActualizarAreaBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
} from '../estructura/estructura.schemas';
import type { Area } from '../estructura/area.types';
import type { Ubicacion } from '../estructura/ubicacion.types';
import type { Responsable } from '../estructura/responsable.types';

// El rol es de Proyecto pero asignado por organizacion (DOC-012 2) — el operador de estos tests
// tiene el rol en 'duoc-uc', nunca "en cualquier organizacion".
const ADMIN_ROLES_DUOC_UC = { 'duoc-uc': ['administrador-patrimonial'] };

const ACTIVO: Activo = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-2026-000099',
  codigoQr: 'QR-000099',
  serie: null,
  organizacionId: 'duoc-uc',
  areaId: null,
  ubicacionId: null,
  responsableId: null,
  estado: 'activo',
  descripcion: null,
  ultimoInventario: null,
  catalogo: {
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
  },
};

const CATALOGO_TIPO: CatalogoTipoActivo = {
  id: 'catalogo-notebook',
  tipo: 'Equipo Computacional',
  familia: 'Informática',
  subfamilia: null,
  marca: null,
  modelo: null,
  fabricante: null,
  vidaUtilMeses: null,
  criticidad: 'alta',
  tecnologiaIdentificacion: 'qr',
};

const DOCUMENTO: DocumentoActivo = {
  id: 'documento-1',
  activoId: 'activo-1',
  organizacionId: 'duoc-uc',
  tipo: 'documento',
  url: 'https://example.com/doc.pdf',
  descripcion: 'Factura de compra',
  creadoEn: '2026-01-01T00:00:00.000Z',
  creadoPor: 'op-admin',
};

const ORGANIZACION: Organizacion = {
  id: 'duoc-uc',
  nombre: 'DUOC UC',
  estado: 'activo',
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
    actualizarDescripcion: jest.fn(),
  } as unknown as jest.Mocked<EscrituraActivoService>;
  const importacionContableService = {
    procesar: jest.fn(),
  } as unknown as jest.Mocked<ImportacionContableService>;
  const importacionContableLoteService = {
    crearLote: jest.fn(),
    listarLotes: jest.fn(),
    obtenerLote: jest.fn(),
    aprobarLote: jest.fn(),
    rechazarLote: jest.fn(),
  } as unknown as jest.Mocked<ImportacionContableLoteService>;
  const escrituraContratoService = {
    alta: jest.fn(),
    actualizarEstado: jest.fn(),
    actualizarCondiciones: jest.fn(),
  } as unknown as jest.Mocked<EscrituraContratoService>;
  const escrituraEstructuraService = {
    altaArea: jest.fn(),
    actualizarArea: jest.fn(),
    altaUbicacion: jest.fn(),
    actualizarUbicacion: jest.fn(),
    altaResponsable: jest.fn(),
    actualizarEstadoResponsable: jest.fn(),
  } as unknown as jest.Mocked<EscrituraEstructuraService>;
  const escrituraOrganizacionService = {
    crear: jest.fn(),
    actualizarNombre: jest.fn(),
    actualizarEstado: jest.fn(),
  } as unknown as jest.Mocked<EscrituraOrganizacionService>;
  const escrituraSedeService = {
    crear: jest.fn(),
    actualizarEstado: jest.fn(),
  } as unknown as jest.Mocked<EscrituraSedeService>;
  const escrituraDocumentoActivoService = {
    crear: jest.fn(),
    eliminar: jest.fn(),
  } as unknown as jest.Mocked<EscrituraDocumentoActivoService>;
  const catalogoTipoActivoRepository = {
    listar: jest.fn(),
    crear: jest.fn(),
  } as unknown as jest.Mocked<CatalogoTipoActivoRepository>;
  const auditoriaRepository = {
    registrar: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditoriaRepository>;

  const service = new OrquestadorService(
    inventariosService,
    escrituraActivoService,
    importacionContableService,
    importacionContableLoteService,
    escrituraContratoService,
    escrituraEstructuraService,
    escrituraOrganizacionService,
    escrituraSedeService,
    escrituraDocumentoActivoService,
    catalogoTipoActivoRepository,
    auditoriaRepository,
  );

  return {
    service,
    inventariosService,
    escrituraActivoService,
    importacionContableService,
    importacionContableLoteService,
    escrituraContratoService,
    escrituraEstructuraService,
    escrituraOrganizacionService,
    escrituraSedeService,
    escrituraDocumentoActivoService,
    catalogoTipoActivoRepository,
    auditoriaRepository,
  };
}

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

function buildAltaContratoPayload(
  overrides: Partial<AltaContratoBody> = {},
): AltaContratoBody {
  return {
    correlationId: 'corr-1',
    operadorId: 'op-admin',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    sedeIds: ['melipilla'],
    vigenciaDesde: '2026-01-01T00:00:00.000Z',
    modulosContratados: ['inventario-qr'],
    ...overrides,
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
      areaOperativa: 'area-biblioteca',
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
      areaOperativa: 'area-biblioteca',
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
      areaOperativa: 'area-biblioteca',
    });
  });

  // DOC-012 5/8 — escritura oficial de Activo. La autorizacion de rol se resuelve acá adentro
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

  describe('procesarActualizarDescripcionActivo', () => {
    it('actualiza la descripcion, audita el resultado y la devuelve', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();
      const conDescripcion = { ...ACTIVO, descripcion: 'Notebook nuevo' };
      escrituraActivoService.actualizarDescripcion.mockResolvedValue(
        conDescripcion,
      );

      const activo = await service.procesarActualizarDescripcionActivo(
        'activo-1',
        {
          correlationId: 'corr-1',
          operadorId: 'op-admin',
          organizacionId: 'duoc-uc',
          rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
          descripcion: 'Notebook nuevo',
        },
      );

      expect(activo).toBe(conDescripcion);
      expect(escrituraActivoService.actualizarDescripcion).toHaveBeenCalledWith(
        'activo-1',
        'duoc-uc',
        'Notebook nuevo',
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /activos/activo-1/descripcion',
        resultado: 'activo',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraActivoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizarDescripcionActivo('activo-1', {
          correlationId: 'corr-1',
          operadorId: 'op-admin',
          organizacionId: 'duoc-uc',
          rolesPorOrganizacion: {},
          descripcion: 'Notebook nuevo',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        escrituraActivoService.actualizarDescripcion,
      ).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /activos/activo-1/descripcion',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarAltaCatalogoTipo', () => {
    const payload: AltaCatalogoTipoBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      tipo: 'Equipo Computacional',
      familia: 'Informática',
      criticidad: 'alta',
      tecnologiaIdentificacion: 'qr',
    };

    it('crea el tipo de catalogo, audita el resultado (id) y lo devuelve', async () => {
      const { service, catalogoTipoActivoRepository, auditoriaRepository } =
        buildService();
      catalogoTipoActivoRepository.crear.mockResolvedValue(CATALOGO_TIPO);

      await expect(service.procesarAltaCatalogoTipo(payload)).resolves.toBe(
        CATALOGO_TIPO,
      );
      expect(catalogoTipoActivoRepository.crear).toHaveBeenCalledWith(payload);
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /catalogo-tipos',
        resultado: 'catalogo-notebook',
      });
    });

    it('rechaza con 403 y audita sin llamar al repository si falta el rol', async () => {
      const { service, catalogoTipoActivoRepository, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaCatalogoTipo({
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(catalogoTipoActivoRepository.crear).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /catalogo-tipos',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarAltaDocumentoActivo', () => {
    const payload: AltaDocumentoActivoBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      tipo: 'documento',
      url: 'https://example.com/doc.pdf',
      descripcion: 'Factura de compra',
    };

    it('crea el documento, audita el resultado (id) y lo devuelve', async () => {
      const { service, escrituraDocumentoActivoService, auditoriaRepository } =
        buildService();
      escrituraDocumentoActivoService.crear.mockResolvedValue(DOCUMENTO);

      await expect(
        service.procesarAltaDocumentoActivo('activo-1', payload),
      ).resolves.toBe(DOCUMENTO);
      expect(escrituraDocumentoActivoService.crear).toHaveBeenCalledWith({
        activoId: 'activo-1',
        organizacionId: 'duoc-uc',
        tipo: 'documento',
        url: 'https://example.com/doc.pdf',
        descripcion: 'Factura de compra',
        creadoPor: 'op-admin',
      });
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos/activo-1/documentos',
        resultado: 'documento-1',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraDocumentoActivoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaDocumentoActivo('activo-1', {
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraDocumentoActivoService.crear).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /activos/activo-1/documentos',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarEliminarDocumentoActivo', () => {
    const payload: EliminarDocumentoActivoBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    };

    it('elimina el documento, audita el resultado (documentoId) y no devuelve nada', async () => {
      const { service, escrituraDocumentoActivoService, auditoriaRepository } =
        buildService();
      escrituraDocumentoActivoService.eliminar.mockResolvedValue(undefined);

      await expect(
        service.procesarEliminarDocumentoActivo(
          'activo-1',
          'documento-1',
          payload,
        ),
      ).resolves.toBeUndefined();
      expect(escrituraDocumentoActivoService.eliminar).toHaveBeenCalledWith(
        'documento-1',
        'activo-1',
        'duoc-uc',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'DELETE /activos/activo-1/documentos/documento-1',
        resultado: 'documento-1',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraDocumentoActivoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarEliminarDocumentoActivo('activo-1', 'documento-1', {
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraDocumentoActivoService.eliminar).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'DELETE /activos/activo-1/documentos/documento-1',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarAltaOrganizacion', () => {
    const payload: AltaOrganizacionBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
      id: 'duoc-uc',
      nombre: 'DUOC UC',
    };

    it('crea la organizacion, audita el resultado (id) y la devuelve', async () => {
      const { service, escrituraOrganizacionService, auditoriaRepository } =
        buildService();
      escrituraOrganizacionService.crear.mockResolvedValue(ORGANIZACION);

      await expect(service.procesarAltaOrganizacion(payload)).resolves.toBe(
        ORGANIZACION,
      );
      expect(escrituraOrganizacionService.crear).toHaveBeenCalledWith({
        id: 'duoc-uc',
        nombre: 'DUOC UC',
      });
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /organizaciones',
        resultado: 'duoc-uc',
      });
    });

    // DOC-021 4 — a diferencia de Activo/Catalogo/Documento (solo administrador-patrimonial),
    // Organizacion solo acepta administrador-sistema: administrador-patrimonial no alcanza.
    it('rechaza con 403 y audita sin llamar al servicio si el operador solo tiene administrador-patrimonial', async () => {
      const { service, escrituraOrganizacionService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaOrganizacion({
          ...payload,
          rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraOrganizacionService.crear).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /organizaciones',
        resultado: 'rechazado:403',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraOrganizacionService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaOrganizacion({
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraOrganizacionService.crear).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /organizaciones',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarActualizarOrganizacion', () => {
    const payload = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
      nombre: 'DUOC UC (renombrada)',
    };

    it('edita el nombre, audita el resultado (id) y lo devuelve (DOC-024 1)', async () => {
      const { service, escrituraOrganizacionService, auditoriaRepository } =
        buildService();
      const renombrada = { ...ORGANIZACION, nombre: 'DUOC UC (renombrada)' };
      escrituraOrganizacionService.actualizarNombre.mockResolvedValue(
        renombrada,
      );

      await expect(
        service.procesarActualizarOrganizacion('duoc-uc', payload),
      ).resolves.toBe(renombrada);
      expect(
        escrituraOrganizacionService.actualizarNombre,
      ).toHaveBeenCalledWith('duoc-uc', 'DUOC UC (renombrada)');
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /organizaciones/duoc-uc',
        resultado: 'duoc-uc',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol administrador-sistema', async () => {
      const { service, escrituraOrganizacionService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizarOrganizacion('duoc-uc', {
          ...payload,
          rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        escrituraOrganizacionService.actualizarNombre,
      ).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /organizaciones/duoc-uc',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarActualizarEstadoOrganizacion', () => {
    const payload = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
      estado: 'inactivo' as const,
    };

    it('cambia el estado, audita el resultado (estado) y lo devuelve — sin cascada (DOC-024 1)', async () => {
      const { service, escrituraOrganizacionService, auditoriaRepository } =
        buildService();
      const inactiva = { ...ORGANIZACION, estado: 'inactivo' as const };
      escrituraOrganizacionService.actualizarEstado.mockResolvedValue(inactiva);

      await expect(
        service.procesarActualizarEstadoOrganizacion('duoc-uc', payload),
      ).resolves.toBe(inactiva);
      expect(
        escrituraOrganizacionService.actualizarEstado,
      ).toHaveBeenCalledWith('duoc-uc', 'inactivo');
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /organizaciones/duoc-uc/estado',
        resultado: 'inactivo',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol administrador-sistema', async () => {
      const { service, escrituraOrganizacionService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizarEstadoOrganizacion('duoc-uc', {
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        escrituraOrganizacionService.actualizarEstado,
      ).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /organizaciones/duoc-uc/estado',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarAltaSede', () => {
    const SEDE: Sede = {
      id: 'sede-1',
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
      estado: 'activo',
    };
    const payload: AltaSedeBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      nombre: 'Melipilla',
    };

    // A diferencia de Organizacion (solo administrador-sistema), Sede usa el mismo verificador
    // que Contrato — administrador-patrimonial SI alcanza, contra la organizacion puntual.
    it('crea la sede, audita el resultado (id) y la devuelve', async () => {
      const { service, escrituraSedeService, auditoriaRepository } =
        buildService();
      escrituraSedeService.crear.mockResolvedValue(SEDE);

      await expect(service.procesarAltaSede(payload)).resolves.toBe(SEDE);
      expect(escrituraSedeService.crear).toHaveBeenCalledWith({
        organizacionId: 'duoc-uc',
        nombre: 'Melipilla',
      });
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /sedes',
        resultado: 'sede-1',
      });
    });

    it('administrador-sistema tambien puede crear una sede (administracion de plataforma)', async () => {
      const { service, escrituraSedeService } = buildService();
      escrituraSedeService.crear.mockResolvedValue(SEDE);

      await expect(
        service.procesarAltaSede({
          ...payload,
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
        }),
      ).resolves.toBe(SEDE);
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraSedeService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaSede({ ...payload, rolesPorOrganizacion: {} }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraSedeService.crear).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /sedes',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarActualizarEstadoSede', () => {
    const payload = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      estado: 'inactivo' as const,
    };

    it('cambia el estado, audita el resultado (estado) y lo devuelve — sin cascada (DOC-024 1)', async () => {
      const { service, escrituraSedeService, auditoriaRepository } =
        buildService();
      const inactiva = {
        id: 'sede-1',
        organizacionId: 'duoc-uc',
        nombre: 'Melipilla',
        estado: 'inactivo' as const,
      };
      escrituraSedeService.actualizarEstado.mockResolvedValue(inactiva);

      await expect(
        service.procesarActualizarEstadoSede('sede-1', payload),
      ).resolves.toBe(inactiva);
      expect(escrituraSedeService.actualizarEstado).toHaveBeenCalledWith(
        'sede-1',
        'duoc-uc',
        'inactivo',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /sedes/sede-1/estado',
        resultado: 'inactivo',
      });
    });

    it('administrador-sistema tambien puede desactivar una sede (administracion de plataforma)', async () => {
      const { service, escrituraSedeService } = buildService();
      escrituraSedeService.actualizarEstado.mockResolvedValue({
        id: 'sede-1',
        organizacionId: 'duoc-uc',
        nombre: 'Melipilla',
        estado: 'inactivo',
      });

      await expect(
        service.procesarActualizarEstadoSede('sede-1', {
          ...payload,
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
        }),
      ).resolves.toEqual(expect.objectContaining({ estado: 'inactivo' }));
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraSedeService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizarEstadoSede('sede-1', {
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraSedeService.actualizarEstado).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /sedes/sede-1/estado',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarImportacionContable', () => {
    const RESULTADO: ImportacionContableResultado = {
      filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'creado' }],
      creados: 1,
      yaImportados: 0,
      conflictos: 0,
    };

    it('procesa las filas, audita el resumen y devuelve el resultado', async () => {
      const { service, importacionContableService, auditoriaRepository } =
        buildService();
      importacionContableService.procesar.mockResolvedValue(RESULTADO);

      const resultado = await service.procesarImportacionContable({
        correlationId: 'corr-1',
        operadorId: 'op-admin',
        organizacionId: 'duoc-uc',
        rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
        filas: [
          {
            codigoPatrimonial: 'AFT-1',
            codigoQr: 'QR-1',
            catalogoId: 'catalogo-notebook',
          },
        ],
      });

      expect(resultado).toBe(RESULTADO);
      expect(importacionContableService.procesar).toHaveBeenCalledWith(
        'duoc-uc',
        [
          {
            codigoPatrimonial: 'AFT-1',
            codigoQr: 'QR-1',
            catalogoId: 'catalogo-notebook',
          },
        ],
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /importaciones/contable',
        resultado: '1 creados, 0 ya_importados, 0 conflictos',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, importacionContableService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarImportacionContable({
          correlationId: 'corr-1',
          operadorId: 'op-admin',
          organizacionId: 'duoc-uc',
          rolesPorOrganizacion: {},
          filas: [
            {
              codigoPatrimonial: 'AFT-1',
              codigoQr: 'QR-1',
              catalogoId: 'catalogo-notebook',
            },
          ],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(importacionContableService.procesar).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /importaciones/contable',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('bandeja de staging de importación contable (DOC-029 RF-B)', () => {
    const IDENTIDAD = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    };
    const FILA = {
      linea: 1,
      codigoPatrimonial: 'DG-001',
      codigoQr: 'DG-001',
      catalogoId: 'cat-1',
      crudo: {},
    };

    it('crearLoteImportacionContable crea el lote y audita el resumen', async () => {
      const { service, importacionContableLoteService, auditoriaRepository } =
        buildService();
      importacionContableLoteService.crearLote.mockResolvedValue({
        loteId: 'lote-1',
        resumen: { totalFilas: 2, crear: 1, yaImportado: 0, conflicto: 1 },
      });

      const res = await service.crearLoteImportacionContable({
        ...IDENTIDAD,
        origen: 'carpeta',
        archivoNombre: 'activos.xls',
        filas: [FILA],
      });

      expect(res.loteId).toBe('lote-1');
      expect(importacionContableLoteService.crearLote).toHaveBeenCalledWith({
        organizacionId: 'duoc-uc',
        origen: 'carpeta',
        archivoNombre: 'activos.xls',
        filas: [FILA],
      });
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /importaciones/contable/lote',
        resultado: 'lote lote-1: 1 crear, 0 ya_importado, 1 conflicto',
      });
    });

    it('crearLoteImportacionContable rechaza con 403 sin llamar al servicio', async () => {
      const { service, importacionContableLoteService } = buildService();
      await expect(
        service.crearLoteImportacionContable({
          ...IDENTIDAD,
          rolesPorOrganizacion: {},
          origen: 'manual',
          filas: [FILA],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(importacionContableLoteService.crearLote).not.toHaveBeenCalled();
    });

    it('listarLotesImportacionContable delega sin auditar', async () => {
      const { service, importacionContableLoteService, auditoriaRepository } =
        buildService();
      importacionContableLoteService.listarLotes.mockResolvedValue([]);

      await service.listarLotesImportacionContable('duoc-uc', 'aprobado');

      expect(importacionContableLoteService.listarLotes).toHaveBeenCalledWith(
        'duoc-uc',
        'aprobado',
      );
      expect(auditoriaRepository.registrar).not.toHaveBeenCalled();
    });

    it('obtenerLoteImportacionContable delega el id', async () => {
      const { service, importacionContableLoteService } = buildService();
      importacionContableLoteService.obtenerLote.mockResolvedValue({
        lote: {} as never,
        filas: [],
      });

      await service.obtenerLoteImportacionContable('lote-1');

      expect(importacionContableLoteService.obtenerLote).toHaveBeenCalledWith(
        'lote-1',
      );
    });

    it('aprobarLoteImportacionContable aprueba y audita el resultado', async () => {
      const { service, importacionContableLoteService, auditoriaRepository } =
        buildService();
      importacionContableLoteService.aprobarLote.mockResolvedValue({
        filas: [],
        creados: 3,
        yaImportados: 1,
        conflictos: 0,
      });

      const res = await service.aprobarLoteImportacionContable(
        'lote-1',
        IDENTIDAD,
      );

      expect(res.creados).toBe(3);
      expect(importacionContableLoteService.aprobarLote).toHaveBeenCalledWith(
        'lote-1',
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /importaciones/contable/lote/lote-1/aprobar',
        resultado: '3 creados, 1 ya_importados, 0 conflictos',
      });
    });

    it('aprobarLoteImportacionContable rechaza con 403 sin aprobar', async () => {
      const { service, importacionContableLoteService } = buildService();
      await expect(
        service.aprobarLoteImportacionContable('lote-1', {
          ...IDENTIDAD,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(importacionContableLoteService.aprobarLote).not.toHaveBeenCalled();
    });

    it('rechazarLoteImportacionContable con motivo audita el motivo y devuelve estado rechazado', async () => {
      const { service, importacionContableLoteService, auditoriaRepository } =
        buildService();
      importacionContableLoteService.rechazarLote.mockResolvedValue(undefined);

      const res = await service.rechazarLoteImportacionContable('lote-1', {
        ...IDENTIDAD,
        motivo: 'faltan columnas',
      });

      expect(res).toEqual({ estado: 'rechazado' });
      expect(importacionContableLoteService.rechazarLote).toHaveBeenCalledWith(
        'lote-1',
        'op-admin',
        'faltan columnas',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /importaciones/contable/lote/lote-1/rechazar',
        resultado: 'rechazado: faltan columnas',
      });
    });

    it('rechazarLoteImportacionContable sin motivo audita "rechazado" a secas', async () => {
      const { service, importacionContableLoteService, auditoriaRepository } =
        buildService();
      importacionContableLoteService.rechazarLote.mockResolvedValue(undefined);

      await service.rechazarLoteImportacionContable('lote-1', IDENTIDAD);

      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /importaciones/contable/lote/lote-1/rechazar',
        resultado: 'rechazado',
      });
    });
  });

  describe('procesarAltaContrato', () => {
    it('crea el contrato, audita el resultado y lo devuelve (camino feliz)', async () => {
      const { service, escrituraContratoService, auditoriaRepository } =
        buildService();
      escrituraContratoService.alta.mockResolvedValue(CONTRATO);

      const contrato = await service.procesarAltaContrato(
        buildAltaContratoPayload(),
      );

      expect(contrato).toBe(CONTRATO);
      expect(escrituraContratoService.alta).toHaveBeenCalledWith(
        expect.objectContaining({ sedeIds: ['melipilla'] }),
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /contratos',
        resultado: 'vigente',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraContratoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaContrato(
          buildAltaContratoPayload({ rolesPorOrganizacion: {} }),
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraContratoService.alta).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /contratos',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarActualizacionContrato', () => {
    it('actualiza el estado, audita el resultado y lo devuelve', async () => {
      const { service, escrituraContratoService, auditoriaRepository } =
        buildService();
      const suspendido = { ...CONTRATO, estado: 'suspendido' as const };
      escrituraContratoService.actualizarEstado.mockResolvedValue(suspendido);

      const contrato = await service.procesarActualizacionContrato(
        'contrato-1',
        {
          correlationId: 'corr-1',
          operadorId: 'op-admin',
          organizacionId: 'duoc-uc',
          rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
          estado: 'suspendido',
        },
      );

      expect(contrato).toBe(suspendido);
      expect(escrituraContratoService.actualizarEstado).toHaveBeenCalledWith(
        'contrato-1',
        'duoc-uc',
        'suspendido',
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /contratos/contrato-1',
        resultado: 'suspendido',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraContratoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizacionContrato('contrato-1', {
          correlationId: 'corr-1',
          operadorId: 'op-admin',
          organizacionId: 'duoc-uc',
          rolesPorOrganizacion: {},
          estado: 'suspendido',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraContratoService.actualizarEstado).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /contratos/contrato-1',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarActualizarCondicionesContrato', () => {
    const payload = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      vigenciaHasta: '2027-01-01T00:00:00.000Z',
    };

    it('edita las condiciones, audita el resultado (estado) y lo devuelve (DOC-024 2)', async () => {
      const { service, escrituraContratoService, auditoriaRepository } =
        buildService();
      const actualizado = {
        ...CONTRATO,
        vigenciaHasta: '2027-01-01T00:00:00.000Z',
      };
      escrituraContratoService.actualizarCondiciones.mockResolvedValue(
        actualizado,
      );

      await expect(
        service.procesarActualizarCondicionesContrato('contrato-1', payload),
      ).resolves.toBe(actualizado);
      expect(
        escrituraContratoService.actualizarCondiciones,
      ).toHaveBeenCalledWith(
        'contrato-1',
        'duoc-uc',
        {
          sedeIds: undefined,
          vigenciaHasta: '2027-01-01T00:00:00.000Z',
          modulosContratados: undefined,
        },
        'op-admin',
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /contratos/contrato-1/condiciones',
        resultado: 'vigente',
      });
    });

    it('administrador-sistema tambien puede editar las condiciones (administracion de plataforma)', async () => {
      const { service, escrituraContratoService } = buildService();
      escrituraContratoService.actualizarCondiciones.mockResolvedValue(
        CONTRATO,
      );

      await expect(
        service.procesarActualizarCondicionesContrato('contrato-1', {
          ...payload,
          rolesPorOrganizacion: { 'duoc-uc': ['administrador-sistema'] },
        }),
      ).resolves.toBe(CONTRATO);
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraContratoService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizarCondicionesContrato('contrato-1', {
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        escrituraContratoService.actualizarCondiciones,
      ).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /contratos/contrato-1/condiciones',
        resultado: 'rechazado:403',
      });
    });
  });

  const AREA: Area = {
    id: 'area-1',
    organizacionId: 'duoc-uc',
    codigo: 'BIB',
    nombre: 'Biblioteca',
    dependencia: null,
    centroCosto: null,
    responsableId: null,
    ubicacionPrincipalId: null,
  };

  const UBICACION: Ubicacion = {
    id: 'ubicacion-1',
    sedeId: 'melipilla',
    edificio: null,
    piso: null,
    areaId: null,
    oficina: null,
    dependencia: null,
  };

  const RESPONSABLE: Responsable = {
    id: 'responsable-1',
    identificacion: '11.111.111-1',
    nombre: 'Ana Soto',
    cargo: null,
    areaId: 'area-1',
    correo: null,
    telefono: null,
    estado: 'activo',
  };

  describe('procesarAltaArea', () => {
    const payload: AltaAreaBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      codigo: 'BIB',
      nombre: 'Biblioteca',
    };

    it('crea el area, audita el resultado (id) y la devuelve', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();
      escrituraEstructuraService.altaArea.mockResolvedValue(AREA);

      await expect(service.procesarAltaArea(payload)).resolves.toBe(AREA);
      expect(escrituraEstructuraService.altaArea).toHaveBeenCalledWith(payload);
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /areas',
        resultado: 'area-1',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaArea({ ...payload, rolesPorOrganizacion: {} }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraEstructuraService.altaArea).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /areas',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarActualizarArea', () => {
    const payload: ActualizarAreaBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      nombre: 'Biblioteca Central',
    };

    it('actualiza el area, audita el resultado (id) y la devuelve', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();
      const actualizada = { ...AREA, nombre: 'Biblioteca Central' };
      escrituraEstructuraService.actualizarArea.mockResolvedValue(actualizada);

      await expect(
        service.procesarActualizarArea('area-1', payload),
      ).resolves.toBe(actualizada);
      expect(escrituraEstructuraService.actualizarArea).toHaveBeenCalledWith(
        'area-1',
        'duoc-uc',
        payload,
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /areas/area-1',
        resultado: 'area-1',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizarArea('area-1', {
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraEstructuraService.actualizarArea).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /areas/area-1',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarAltaUbicacion', () => {
    const payload: AltaUbicacionBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      sedeId: 'melipilla',
    };

    it('crea la ubicacion, audita el resultado (id) y la devuelve', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();
      escrituraEstructuraService.altaUbicacion.mockResolvedValue(UBICACION);

      await expect(service.procesarAltaUbicacion(payload)).resolves.toBe(
        UBICACION,
      );
      expect(escrituraEstructuraService.altaUbicacion).toHaveBeenCalledWith(
        payload,
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /ubicaciones',
        resultado: 'ubicacion-1',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaUbicacion({ ...payload, rolesPorOrganizacion: {} }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraEstructuraService.altaUbicacion).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /ubicaciones',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarActualizarUbicacion', () => {
    const payload: ActualizarUbicacionBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      edificio: 'Torre A',
    };

    it('actualiza la ubicacion, audita el resultado (id) y la devuelve', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();
      const actualizada = { ...UBICACION, edificio: 'Torre A' };
      escrituraEstructuraService.actualizarUbicacion.mockResolvedValue(
        actualizada,
      );

      await expect(
        service.procesarActualizarUbicacion('ubicacion-1', payload),
      ).resolves.toBe(actualizada);
      expect(
        escrituraEstructuraService.actualizarUbicacion,
      ).toHaveBeenCalledWith('ubicacion-1', 'duoc-uc', payload);
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /ubicaciones/ubicacion-1',
        resultado: 'ubicacion-1',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizarUbicacion('ubicacion-1', {
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        escrituraEstructuraService.actualizarUbicacion,
      ).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /ubicaciones/ubicacion-1',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarAltaResponsable', () => {
    const payload: AltaResponsableBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      identificacion: '11.111.111-1',
      nombre: 'Ana Soto',
      areaId: 'area-1',
    };

    it('crea el responsable, audita el resultado (estado) y lo devuelve', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();
      escrituraEstructuraService.altaResponsable.mockResolvedValue(RESPONSABLE);

      await expect(service.procesarAltaResponsable(payload)).resolves.toBe(
        RESPONSABLE,
      );
      expect(escrituraEstructuraService.altaResponsable).toHaveBeenCalledWith(
        payload,
      );
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /responsables',
        resultado: 'activo',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarAltaResponsable({
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(escrituraEstructuraService.altaResponsable).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'POST /responsables',
        resultado: 'rechazado:403',
      });
    });
  });

  describe('procesarActualizarEstadoResponsable', () => {
    const payload: ActualizarEstadoResponsableBody = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
      estado: 'inactivo',
    };

    it('actualiza el estado, audita el resultado y lo devuelve', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();
      const inactivo = { ...RESPONSABLE, estado: 'inactivo' as const };
      escrituraEstructuraService.actualizarEstadoResponsable.mockResolvedValue(
        inactivo,
      );

      const responsable = await service.procesarActualizarEstadoResponsable(
        'responsable-1',
        payload,
      );

      expect(responsable).toBe(inactivo);
      expect(
        escrituraEstructuraService.actualizarEstadoResponsable,
      ).toHaveBeenCalledWith('responsable-1', 'duoc-uc', 'inactivo');
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /responsables/responsable-1/estado',
        resultado: 'inactivo',
      });
    });

    it('rechaza con 403 y audita sin llamar al servicio si falta el rol', async () => {
      const { service, escrituraEstructuraService, auditoriaRepository } =
        buildService();

      await expect(
        service.procesarActualizarEstadoResponsable('responsable-1', {
          ...payload,
          rolesPorOrganizacion: {},
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        escrituraEstructuraService.actualizarEstadoResponsable,
      ).not.toHaveBeenCalled();
      expect(auditoriaRepository.registrar).toHaveBeenCalledWith({
        usuario: 'op-admin',
        operacion: 'PATCH /responsables/responsable-1/estado',
        resultado: 'rechazado:403',
      });
    });
  });
});
