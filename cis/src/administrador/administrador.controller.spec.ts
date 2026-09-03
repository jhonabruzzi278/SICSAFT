/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { AdministradorController } from './administrador.controller';
import { AdministradorService } from './administrador.service';
import {
  KeycloakAuthGuard,
  type AuthenticatedRequest,
  type KeycloakAuthContext,
} from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import type {
  ActivoResult,
  AreaResult,
  AuditoriaEntradaResult,
  CatalogoTipoResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  ResponsableResult,
  UbicacionResult,
} from '../core-client/core-client.types';
import type {
  ActualizarAreaBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaDocumentoActivoBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  CambioResponsableActivoBody,
  EscrituraOficialActivoBody,
  ImportacionContableBody,
} from './administrador.schemas';

const CORRELATION_ID = 'correlation-test';

function buildAuthenticatedRequest(
  auth: KeycloakAuthContext,
): AuthenticatedRequest & RequestWithCorrelationId {
  return { auth, correlationId: CORRELATION_ID } as AuthenticatedRequest &
    RequestWithCorrelationId &
    Request;
}

const ACTIVO: ActivoResult = {
  id: 'activo-1',
  codigoPatrimonial: 'AFT-1',
  codigoQr: 'QR-1',
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

describe('AdministradorController', () => {
  let controller: AdministradorController;
  let service: jest.Mocked<AdministradorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdministradorController],
      providers: [
        {
          provide: AdministradorService,
          useValue: {
            altaActivo: jest.fn(),
            getAuditoria: jest.fn(),
            getAreas: jest.fn(),
            altaArea: jest.fn(),
            actualizarArea: jest.fn(),
            getUbicaciones: jest.fn(),
            altaUbicacion: jest.fn(),
            actualizarUbicacion: jest.fn(),
            getResponsables: jest.fn(),
            altaResponsable: jest.fn(),
            actualizarEstadoResponsable: jest.fn(),
            bajaActivo: jest.fn(),
            reincorporarActivo: jest.fn(),
            cambiarResponsableActivo: jest.fn(),
            actualizarDescripcionActivo: jest.fn(),
            getCatalogoTipos: jest.fn(),
            altaCatalogoTipo: jest.fn(),
            getDocumentosActivo: jest.fn(),
            altaDocumentoActivo: jest.fn(),
            eliminarDocumentoActivo: jest.fn(),
            importarContable: jest.fn(),
            crearLoteImportacionContable: jest.fn(),
            listarLotesImportacionContable: jest.fn(),
            obtenerLoteImportacionContable: jest.fn(),
            aprobarLoteImportacionContable: jest.fn(),
            rechazarLoteImportacionContable: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdministradorController);
    service = module.get(AdministradorService);
  });

  it('altaActivo delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaActivo.mockResolvedValue(ACTIVO);
    const body: AltaActivoBody = {
      organizacionId: 'duoc-uc',
      codigoPatrimonial: 'AFT-1',
      codigoQr: 'QR-1',
      catalogoId: 'catalogo-notebook',
    };
    const auth: KeycloakAuthContext = {
      operadorId: 'op-1',
      accessToken: 'keycloak-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(controller.altaActivo(body, request)).resolves.toBe(ACTIVO);
    expect(service.altaActivo).toHaveBeenCalledWith(body, auth, CORRELATION_ID);
  });

  it('getAuditoria delega en el service con la query y el correlationId', async () => {
    const entradas: AuditoriaEntradaResult[] = [
      {
        id: 'audit-1',
        usuario: 'op-1',
        fecha: '2026-08-14T10:00:00.000Z',
        equipo: null,
        ip: null,
        operacion: 'POST /inventarios',
        resultado: 'recibido',
        observaciones: null,
        areaOperativa: 'area-biblioteca',
      },
    ];
    const pagina = { entradas, total: entradas.length };
    service.getAuditoria.mockResolvedValue(pagina);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;
    const query = {
      usuario: 'op-1',
      operacion: 'baja',
      limit: 20,
      offset: 0,
    };

    await expect(controller.getAuditoria(query, request)).resolves.toEqual(
      pagina,
    );
    expect(service.getAuditoria).toHaveBeenCalledWith(query, CORRELATION_ID);
  });

  const AREA: AreaResult = {
    id: 'area-1',
    organizacionId: 'duoc-uc',
    codigo: 'BIB',
    nombre: 'Biblioteca',
    dependencia: null,
    centroCosto: null,
    responsableId: null,
    ubicacionPrincipalId: null,
  };

  const UBICACION: UbicacionResult = {
    id: 'ubicacion-1',
    sedeId: 'melipilla',
    edificio: null,
    piso: null,
    areaId: null,
    oficina: null,
    dependencia: null,
  };

  const RESPONSABLE: ResponsableResult = {
    id: 'responsable-1',
    identificacion: '11.111.111-1',
    nombre: 'Ana Soto',
    cargo: null,
    areaId: 'area-1',
    correo: null,
    telefono: null,
    estado: 'activo',
  };

  const AUTH: KeycloakAuthContext = {
    operadorId: 'op-1',
    accessToken: 'keycloak-token',
    expiresAt: '2026-08-12T10:15:00.000Z',
    rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
  };

  it('getAreas delega en el service con organizacionId, la paginacion y el correlationId', async () => {
    const pagina = { areas: [AREA], total: 1 };
    service.getAreas.mockResolvedValue(pagina);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(
      controller.getAreas(
        { organizacionId: 'duoc-uc', limit: 20, offset: 0 },
        request,
      ),
    ).resolves.toEqual(pagina);
    expect(service.getAreas).toHaveBeenCalledWith(
      'duoc-uc',
      { limit: 20, offset: 0 },
      CORRELATION_ID,
    );
  });

  it('altaArea delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaArea.mockResolvedValue(AREA);
    const body: AltaAreaBody = {
      organizacionId: 'duoc-uc',
      codigo: 'BIB',
      nombre: 'Biblioteca',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaArea(body, request)).resolves.toBe(AREA);
    expect(service.altaArea).toHaveBeenCalledWith(body, AUTH, CORRELATION_ID);
  });

  it('actualizarArea delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const actualizada = { ...AREA, nombre: 'Biblioteca Central' };
    service.actualizarArea.mockResolvedValue(actualizada);
    const body: ActualizarAreaBody = {
      organizacionId: 'duoc-uc',
      nombre: 'Biblioteca Central',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarArea('area-1', body, request),
    ).resolves.toBe(actualizada);
    expect(service.actualizarArea).toHaveBeenCalledWith(
      'area-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('getUbicaciones delega en el service con sedeId, la paginacion y el correlationId', async () => {
    const pagina = { ubicaciones: [UBICACION], total: 1 };
    service.getUbicaciones.mockResolvedValue(pagina);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(
      controller.getUbicaciones(
        { sedeId: 'melipilla', limit: 20, offset: 0 },
        request,
      ),
    ).resolves.toEqual(pagina);
    expect(service.getUbicaciones).toHaveBeenCalledWith(
      'melipilla',
      { limit: 20, offset: 0 },
      CORRELATION_ID,
    );
  });

  it('altaUbicacion delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaUbicacion.mockResolvedValue(UBICACION);
    const body: AltaUbicacionBody = {
      organizacionId: 'duoc-uc',
      sedeId: 'melipilla',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaUbicacion(body, request)).resolves.toBe(
      UBICACION,
    );
    expect(service.altaUbicacion).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('actualizarUbicacion delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const actualizada = { ...UBICACION, edificio: 'Torre A' };
    service.actualizarUbicacion.mockResolvedValue(actualizada);
    const body: ActualizarUbicacionBody = {
      organizacionId: 'duoc-uc',
      edificio: 'Torre A',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarUbicacion('ubicacion-1', body, request),
    ).resolves.toBe(actualizada);
    expect(service.actualizarUbicacion).toHaveBeenCalledWith(
      'ubicacion-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('getResponsables delega en el service con areaId, la paginacion y el correlationId', async () => {
    const pagina = { responsables: [RESPONSABLE], total: 1 };
    service.getResponsables.mockResolvedValue(pagina);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(
      controller.getResponsables(
        { areaId: 'area-1', limit: 20, offset: 0 },
        request,
      ),
    ).resolves.toEqual(pagina);
    expect(service.getResponsables).toHaveBeenCalledWith(
      'area-1',
      { limit: 20, offset: 0 },
      CORRELATION_ID,
    );
  });

  it('altaResponsable delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaResponsable.mockResolvedValue(RESPONSABLE);
    const body: AltaResponsableBody = {
      organizacionId: 'duoc-uc',
      identificacion: '11.111.111-1',
      nombre: 'Ana Soto',
      areaId: 'area-1',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaResponsable(body, request)).resolves.toBe(
      RESPONSABLE,
    );
    expect(service.altaResponsable).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('actualizarEstadoResponsable delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const inactivo = { ...RESPONSABLE, estado: 'inactivo' as const };
    service.actualizarEstadoResponsable.mockResolvedValue(inactivo);
    const body: ActualizarEstadoResponsableBody = {
      organizacionId: 'duoc-uc',
      estado: 'inactivo',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarEstadoResponsable('responsable-1', body, request),
    ).resolves.toBe(inactivo);
    expect(service.actualizarEstadoResponsable).toHaveBeenCalledWith(
      'responsable-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-021 3 (gap "descripciones").
  it('actualizarDescripcionActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const conDescripcion = { ...ACTIVO, descripcion: 'Con rayón' };
    service.actualizarDescripcionActivo.mockResolvedValue(conDescripcion);
    const body = { organizacionId: 'duoc-uc', descripcion: 'Con rayón' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarDescripcionActivo('activo-1', body, request),
    ).resolves.toBe(conDescripcion);
    expect(service.actualizarDescripcionActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-021 3 (gap "estados").
  it('bajaActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const dadoDeBaja = { ...ACTIVO, estado: 'dado_de_baja' as const };
    service.bajaActivo.mockResolvedValue(dadoDeBaja);
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.bajaActivo('activo-1', body, request),
    ).resolves.toBe(dadoDeBaja);
    expect(service.bajaActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('reincorporarActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    service.reincorporarActivo.mockResolvedValue(ACTIVO);
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.reincorporarActivo('activo-1', body, request),
    ).resolves.toBe(ACTIVO);
    expect(service.reincorporarActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('cambiarResponsableActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const conResponsable = { ...ACTIVO, responsableId: 'responsable-1' };
    service.cambiarResponsableActivo.mockResolvedValue(conResponsable);
    const body: CambioResponsableActivoBody = {
      organizacionId: 'duoc-uc',
      responsableId: 'responsable-1',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.cambiarResponsableActivo('activo-1', body, request),
    ).resolves.toBe(conResponsable);
    expect(service.cambiarResponsableActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  const CATALOGO_TIPO: CatalogoTipoResult = {
    id: 'catalogo-1',
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: null,
    marca: null,
    modelo: null,
    fabricante: null,
    vidaUtilMeses: null,
    criticidad: 'media',
    tecnologiaIdentificacion: 'qr',
  };

  // DOC-021 4 (gap "familias/categorías").
  it('getCatalogoTipos delega en el service con el correlationId', async () => {
    service.getCatalogoTipos.mockResolvedValue([CATALOGO_TIPO]);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(controller.getCatalogoTipos(request)).resolves.toEqual([
      CATALOGO_TIPO,
    ]);
    expect(service.getCatalogoTipos).toHaveBeenCalledWith(CORRELATION_ID);
  });

  it('altaCatalogoTipo delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaCatalogoTipo.mockResolvedValue(CATALOGO_TIPO);
    const body: AltaCatalogoTipoBody = {
      organizacionId: 'duoc-uc',
      tipo: 'Equipo Computacional',
      familia: 'Informática',
      criticidad: 'media',
      tecnologiaIdentificacion: 'qr',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaCatalogoTipo(body, request)).resolves.toBe(
      CATALOGO_TIPO,
    );
    expect(service.altaCatalogoTipo).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  const DOCUMENTO_ACTIVO: DocumentoActivoResult = {
    id: 'documento-1',
    activoId: 'activo-1',
    organizacionId: 'duoc-uc',
    tipo: 'documento',
    url: 'https://ejemplo.cl/documento.pdf',
    descripcion: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    creadoPor: 'op-1',
  };

  // DOC-021 3 (gap "documentación y fotografías").
  it('getDocumentosActivo delega en el service con el id, organizacionId y el correlationId', async () => {
    service.getDocumentosActivo.mockResolvedValue([DOCUMENTO_ACTIVO]);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(
      controller.getDocumentosActivo(
        'activo-1',
        { organizacionId: 'duoc-uc' },
        request,
      ),
    ).resolves.toEqual([DOCUMENTO_ACTIVO]);
    expect(service.getDocumentosActivo).toHaveBeenCalledWith(
      'activo-1',
      'duoc-uc',
      CORRELATION_ID,
    );
  });

  it('altaDocumentoActivo delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    service.altaDocumentoActivo.mockResolvedValue(DOCUMENTO_ACTIVO);
    const body: AltaDocumentoActivoBody = {
      organizacionId: 'duoc-uc',
      tipo: 'documento',
      url: 'https://ejemplo.cl/documento.pdf',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.altaDocumentoActivo('activo-1', body, request),
    ).resolves.toBe(DOCUMENTO_ACTIVO);
    expect(service.altaDocumentoActivo).toHaveBeenCalledWith(
      'activo-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('eliminarDocumentoActivo delega en el service con el id, documentoId, el body, el auth del guard y el correlationId', async () => {
    service.eliminarDocumentoActivo.mockResolvedValue(undefined);
    const body: EscrituraOficialActivoBody = { organizacionId: 'duoc-uc' };
    const request = buildAuthenticatedRequest(AUTH);

    await controller.eliminarDocumentoActivo(
      'activo-1',
      'documento-1',
      body,
      request,
    );

    expect(service.eliminarDocumentoActivo).toHaveBeenCalledWith(
      'activo-1',
      'documento-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-012 6 (gap "importaciones controladas").
  it('importarContable delega en el service con el body, el auth del guard y el correlationId', async () => {
    const resultado: ImportacionContableResult = {
      filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'creado' }],
      creados: 1,
      yaImportados: 0,
      conflictos: 0,
    };
    service.importarContable.mockResolvedValue(resultado);
    const body: ImportacionContableBody = {
      organizacionId: 'duoc-uc',
      filas: [
        {
          codigoPatrimonial: 'AFT-1',
          codigoQr: 'QR-1',
          catalogoId: 'catalogo-notebook',
        },
      ],
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.importarContable(body, request)).resolves.toBe(
      resultado,
    );
    expect(service.importarContable).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada.
  describe('bandeja de staging de importación contable', () => {
    it('crearLoteImportacionContable delega body + auth + correlationId', async () => {
      const resultado = {
        loteId: 'lote-1',
        resumen: { totalFilas: 1, crear: 1, yaImportado: 0, conflicto: 0 },
      };
      service.crearLoteImportacionContable.mockResolvedValue(resultado);
      const body = {
        organizacionId: 'duoc-uc',
        origen: 'carpeta',
        archivoNombre: 'activos.xls',
        filas: [
          {
            linea: 1,
            codigoPatrimonial: 'DG-001',
            codigoQr: 'DG-001',
            catalogoId: 'cat-1',
            crudo: {},
          },
        ],
      } as Parameters<typeof controller.crearLoteImportacionContable>[0];
      const request = buildAuthenticatedRequest(AUTH);

      await expect(
        controller.crearLoteImportacionContable(body, request),
      ).resolves.toBe(resultado);
      expect(service.crearLoteImportacionContable).toHaveBeenCalledWith(
        body,
        AUTH,
        CORRELATION_ID,
      );
    });

    it('listarLotesImportacionContable delega organizacionId + estado + correlationId', async () => {
      service.listarLotesImportacionContable.mockResolvedValue([]);
      const request = {
        correlationId: CORRELATION_ID,
      } as RequestWithCorrelationId;

      await controller.listarLotesImportacionContable(
        { organizacionId: 'duoc-uc', estado: 'pendiente_revision' },
        request,
      );

      expect(service.listarLotesImportacionContable).toHaveBeenCalledWith(
        'duoc-uc',
        'pendiente_revision',
        CORRELATION_ID,
      );
    });

    it('obtenerLoteImportacionContable delega id + correlationId', async () => {
      service.obtenerLoteImportacionContable.mockResolvedValue({
        lote: {} as never,
        filas: [],
      });
      const request = {
        correlationId: CORRELATION_ID,
      } as RequestWithCorrelationId;

      await controller.obtenerLoteImportacionContable('lote-1', request);

      expect(service.obtenerLoteImportacionContable).toHaveBeenCalledWith(
        'lote-1',
        CORRELATION_ID,
      );
    });

    it('aprobarLoteImportacionContable delega id + body + auth + correlationId', async () => {
      service.aprobarLoteImportacionContable.mockResolvedValue({
        filas: [],
        creados: 1,
        yaImportados: 0,
        conflictos: 0,
      });
      const request = buildAuthenticatedRequest(AUTH);

      await controller.aprobarLoteImportacionContable(
        'lote-1',
        { organizacionId: 'duoc-uc' },
        request,
      );

      expect(service.aprobarLoteImportacionContable).toHaveBeenCalledWith(
        'lote-1',
        { organizacionId: 'duoc-uc' },
        AUTH,
        CORRELATION_ID,
      );
    });

    it('rechazarLoteImportacionContable delega id + body + auth + correlationId', async () => {
      service.rechazarLoteImportacionContable.mockResolvedValue({
        estado: 'rechazado',
      });
      const request = buildAuthenticatedRequest(AUTH);

      await controller.rechazarLoteImportacionContable(
        'lote-1',
        { organizacionId: 'duoc-uc', motivo: 'no cuadra' },
        request,
      );

      expect(service.rechazarLoteImportacionContable).toHaveBeenCalledWith(
        'lote-1',
        { organizacionId: 'duoc-uc', motivo: 'no cuadra' },
        AUTH,
        CORRELATION_ID,
      );
    });
  });
});
