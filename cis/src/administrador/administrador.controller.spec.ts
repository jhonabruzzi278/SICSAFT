/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { AdministradorController } from './administrador.controller';
import { AdministradorService } from './administrador.service';
import { AdministradorSistemaGuard } from './administrador-sistema.guard';
import { AdministradorSistemaEnCualquierOrganizacionGuard } from './administrador-sistema-cualquier-organizacion.guard';
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
  ContratoResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  IndicadoresResult,
  OrganizacionResult,
  ResponsableResult,
  SedeResult,
  UbicacionResult,
} from '../core-client/core-client.types';
import type { GrantUsuario } from '../keycloak-admin/keycloak-admin.types';
import type {
  ActualizarAreaBody,
  ActualizarCondicionesContratoBody,
  ActualizarContratoBody,
  ActualizarEstadoOrganizacionBody,
  ActualizarEstadoResponsableBody,
  ActualizarEstadoSedeBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaContratoBody,
  AltaDocumentoActivoBody,
  AltaOrganizacionBody,
  AltaResponsableBody,
  AltaSedeBody,
  AltaUbicacionBody,
  CambioResponsableActivoBody,
  EditarOrganizacionBody,
  EscrituraOficialActivoBody,
  ImportacionContableBody,
  QuitarRolUsuarioOrganizacionBody,
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
            getContratos: jest.fn(),
            altaContrato: jest.fn(),
            actualizarEstadoContrato: jest.fn(),
            altaSede: jest.fn(),
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
            getOrganizaciones: jest.fn(),
            altaOrganizacion: jest.fn(),
            editarOrganizacion: jest.fn(),
            actualizarEstadoOrganizacion: jest.fn(),
            getIndicadores: jest.fn(),
            listarUsuariosOrganizacion: jest.fn(),
            asignarUsuarioOrganizacion: jest.fn(),
            quitarRolUsuarioOrganizacion: jest.fn(),
            desactivarUsuarioOrganizacion: jest.fn(),
            getSedes: jest.fn(),
            actualizarEstadoSede: jest.fn(),
            actualizarCondicionesContrato: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdministradorSistemaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdministradorSistemaEnCualquierOrganizacionGuard)
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

  const CONTRATO: ContratoResult = {
    id: 'contrato-1',
    organizacionId: 'duoc-uc',
    organizacionNombre: 'DUOC UC',
    sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    vigenciaDesde: '2026-01-01T00:00:00.000Z',
    vigenciaHasta: null,
    estado: 'vigente',
    modulosContratados: ['inventario-qr'],
  };

  it('getContratos delega en el service con la paginacion y el correlationId', async () => {
    const pagina = { contratos: [CONTRATO], total: 1 };
    service.getContratos.mockResolvedValue(pagina);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(
      controller.getContratos({ limit: 20, offset: 0 }, request),
    ).resolves.toEqual(pagina);
    expect(service.getContratos).toHaveBeenCalledWith(
      { limit: 20, offset: 0 },
      CORRELATION_ID,
    );
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

  it('altaContrato delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaContrato.mockResolvedValue(CONTRATO);
    const body: AltaContratoBody = {
      organizacionId: 'duoc-uc',
      sedeIds: ['melipilla'],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      modulosContratados: ['inventario-qr'],
    };
    const auth: KeycloakAuthContext = {
      operadorId: 'op-1',
      accessToken: 'keycloak-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(controller.altaContrato(body, request)).resolves.toBe(
      CONTRATO,
    );
    expect(service.altaContrato).toHaveBeenCalledWith(
      body,
      auth,
      CORRELATION_ID,
    );
  });

  it('actualizarEstadoContrato delega en el service con el id, el body, el auth del guard y el correlationId', async () => {
    const suspendido = { ...CONTRATO, estado: 'suspendido' as const };
    service.actualizarEstadoContrato.mockResolvedValue(suspendido);
    const body: ActualizarContratoBody = {
      organizacionId: 'duoc-uc',
      estado: 'suspendido',
    };
    const auth: KeycloakAuthContext = {
      operadorId: 'op-1',
      accessToken: 'keycloak-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(
      controller.actualizarEstadoContrato('contrato-1', body, request),
    ).resolves.toBe(suspendido);
    expect(service.actualizarEstadoContrato).toHaveBeenCalledWith(
      'contrato-1',
      body,
      auth,
      CORRELATION_ID,
    );
  });

  it('altaSede delega en el service con el body, el auth del guard y el correlationId', async () => {
    const sede: SedeResult = {
      id: 'sede-1',
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
      estado: 'activo',
    };
    service.altaSede.mockResolvedValue(sede);
    const body: AltaSedeBody = {
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
    };
    const auth: KeycloakAuthContext = {
      operadorId: 'op-1',
      accessToken: 'keycloak-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(controller.altaSede(body, request)).resolves.toBe(sede);
    expect(service.altaSede).toHaveBeenCalledWith(body, auth, CORRELATION_ID);
  });

  it('getSedes delega en el service con el organizacionId de la query y el correlationId (DOC-024 1)', async () => {
    const sedes: SedeResult[] = [
      {
        id: 'sede-1',
        organizacionId: 'duoc-uc',
        nombre: 'Melipilla',
        estado: 'activo',
      },
    ];
    service.getSedes.mockResolvedValue(sedes);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(
      controller.getSedes({ organizacionId: 'duoc-uc' }, request),
    ).resolves.toBe(sedes);
    expect(service.getSedes).toHaveBeenCalledWith('duoc-uc', CORRELATION_ID);
  });

  it('actualizarEstadoSede delega en el service con el id, el body, el auth del guard y el correlationId (DOC-024 1)', async () => {
    const sede: SedeResult = {
      id: 'sede-1',
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
      estado: 'inactivo',
    };
    service.actualizarEstadoSede.mockResolvedValue(sede);
    const body: ActualizarEstadoSedeBody = {
      organizacionId: 'duoc-uc',
      estado: 'inactivo',
    };
    const auth: KeycloakAuthContext = {
      operadorId: 'op-1',
      accessToken: 'keycloak-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(
      controller.actualizarEstadoSede('sede-1', body, request),
    ).resolves.toBe(sede);
    expect(service.actualizarEstadoSede).toHaveBeenCalledWith(
      'sede-1',
      body,
      auth,
      CORRELATION_ID,
    );
  });

  it('actualizarCondicionesContrato delega en el service con el id, el body, el auth del guard y el correlationId (DOC-024 2)', async () => {
    const actualizado: ContratoResult = {
      id: 'contrato-1',
      organizacionId: 'duoc-uc',
      organizacionNombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      vigenciaHasta: '2027-01-01T00:00:00.000Z',
      estado: 'vigente',
      modulosContratados: ['inventario-qr'],
    };
    service.actualizarCondicionesContrato.mockResolvedValue(actualizado);
    const body: ActualizarCondicionesContratoBody = {
      organizacionId: 'duoc-uc',
      vigenciaHasta: '2027-01-01T00:00:00.000Z',
    };
    const auth: KeycloakAuthContext = {
      operadorId: 'op-1',
      accessToken: 'keycloak-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(
      controller.actualizarCondicionesContrato('contrato-1', body, request),
    ).resolves.toBe(actualizado);
    expect(service.actualizarCondicionesContrato).toHaveBeenCalledWith(
      'contrato-1',
      body,
      auth,
      CORRELATION_ID,
    );
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

  // DOC-021 4 (Administrador del Sistema) — usa AdministradorSistemaGuard (el guard ya valida el
  // rol antes de llegar acá) ADEMAS de requireAuthContext (DOC-024 3: se agregó para tener un
  // operadorId real que auditar via AuditoriaIdentidadService — antes este endpoint no lo
  // capturaba, a diferencia de cada otro endpoint de escritura de este archivo).
  it('asignarUsuarioOrganizacion delega en el service con el orgId, el body, el auth del guard y el correlationId', async () => {
    service.asignarUsuarioOrganizacion.mockResolvedValue(undefined);
    const body = {
      email: 'nuevo@duoc.cl',
      rol: 'administrador-patrimonial' as const,
    };
    const request = buildAuthenticatedRequest(AUTH);

    await controller.asignarUsuarioOrganizacion('duoc-uc', body, request);

    expect(service.asignarUsuarioOrganizacion).toHaveBeenCalledWith(
      'duoc-uc',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-024 — inverso de asignarUsuarioOrganizacion.
  it('quitarRolUsuarioOrganizacion delega en el service con el orgId, el userId, el body, el auth del guard y el correlationId', async () => {
    service.quitarRolUsuarioOrganizacion.mockResolvedValue(undefined);
    const body: QuitarRolUsuarioOrganizacionBody = { rol: 'directivo' };
    const request = buildAuthenticatedRequest(AUTH);

    await controller.quitarRolUsuarioOrganizacion(
      'duoc-uc',
      'usuario-1',
      body,
      request,
    );

    expect(service.quitarRolUsuarioOrganizacion).toHaveBeenCalledWith(
      'duoc-uc',
      'usuario-1',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-024 — dar de baja a un usuario en el proveedor de identidad.
  it('desactivarUsuarioOrganizacion delega en el service con el orgId, el userId, el auth del guard y el correlationId', async () => {
    service.desactivarUsuarioOrganizacion.mockResolvedValue(undefined);
    const request = buildAuthenticatedRequest(AUTH);

    await controller.desactivarUsuarioOrganizacion(
      'duoc-uc',
      'usuario-1',
      request,
    );

    expect(service.desactivarUsuarioOrganizacion).toHaveBeenCalledWith(
      'duoc-uc',
      'usuario-1',
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

  const ORGANIZACION: OrganizacionResult = {
    id: 'duoc-uc',
    nombre: 'DUOC UC',
    estado: 'activo',
  };

  // DOC-021 4 (Administrador del Sistema).
  it('getOrganizaciones delega en el service con el correlationId', async () => {
    service.getOrganizaciones.mockResolvedValue([ORGANIZACION]);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(controller.getOrganizaciones(request)).resolves.toEqual([
      ORGANIZACION,
    ]);
    expect(service.getOrganizaciones).toHaveBeenCalledWith(CORRELATION_ID);
  });

  it('altaOrganizacion delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaOrganizacion.mockResolvedValue(ORGANIZACION);
    const body: AltaOrganizacionBody = { nombre: 'Nueva Organización' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaOrganizacion(body, request)).resolves.toBe(
      ORGANIZACION,
    );
    expect(service.altaOrganizacion).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('editarOrganizacion delega en el service con el orgId, el body, el auth del guard y el correlationId (DOC-024 1)', async () => {
    const renombrada = { ...ORGANIZACION, nombre: 'DUOC UC (renombrada)' };
    service.editarOrganizacion.mockResolvedValue(renombrada);
    const body: EditarOrganizacionBody = { nombre: 'DUOC UC (renombrada)' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.editarOrganizacion('duoc-uc', body, request),
    ).resolves.toBe(renombrada);
    expect(service.editarOrganizacion).toHaveBeenCalledWith(
      'duoc-uc',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('actualizarEstadoOrganizacion delega en el service con el orgId, el body, el auth del guard y el correlationId (DOC-024 1)', async () => {
    const inactiva = { ...ORGANIZACION, estado: 'inactivo' as const };
    service.actualizarEstadoOrganizacion.mockResolvedValue(inactiva);
    const body: ActualizarEstadoOrganizacionBody = { estado: 'inactivo' };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(
      controller.actualizarEstadoOrganizacion('duoc-uc', body, request),
    ).resolves.toBe(inactiva);
    expect(service.actualizarEstadoOrganizacion).toHaveBeenCalledWith(
      'duoc-uc',
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  it('getIndicadores delega en el service con el correlationId', async () => {
    const indicadores: IndicadoresResult = {
      totalOrganizaciones: 1,
      totalSedes: 1,
      contratosPorEstado: {
        vigente: 1,
        suspendido: 0,
        vencido: 0,
        cancelado: 0,
      },
    };
    service.getIndicadores.mockResolvedValue(indicadores);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(controller.getIndicadores(request)).resolves.toEqual(
      indicadores,
    );
    expect(service.getIndicadores).toHaveBeenCalledWith(CORRELATION_ID);
  });

  it('getUsuariosOrganizacion delega en el service con el orgId y el correlationId', async () => {
    const grants: GrantUsuario[] = [
      {
        userId: 'usuario-1',
        email: 'usuario@duoc.cl',
        displayName: 'Usuario Uno',
        roles: ['administrador-patrimonial'],
      },
    ];
    service.listarUsuariosOrganizacion.mockResolvedValue(grants);
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;

    await expect(
      controller.getUsuariosOrganizacion('duoc-uc', request),
    ).resolves.toEqual(grants);
    expect(service.listarUsuariosOrganizacion).toHaveBeenCalledWith(
      'duoc-uc',
      CORRELATION_ID,
    );
  });
});
