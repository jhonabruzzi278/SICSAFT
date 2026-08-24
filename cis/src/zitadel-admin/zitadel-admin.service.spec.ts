import { BadGatewayException, NotFoundException } from '@nestjs/common';
import type { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { ZitadelAdminService } from './zitadel-admin.service';
import type { ZitadelAdminConfig } from './zitadel-admin.config';
import {
  CircuitBreaker,
  CircuitOpenError,
} from '../core-client/circuit-breaker';

function buildAxiosResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

function buildAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed', String(status));
  error.response = {
    data,
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

// Sin `.response` — asi lanza axios real ante ECONNREFUSED/timeout.
function buildAxiosNetworkError(): AxiosError {
  return new AxiosError('ECONNREFUSED', AxiosError.ERR_NETWORK);
}

describe('ZitadelAdminService', () => {
  const config: ZitadelAdminConfig = {
    issuer: 'http://zitadel:8080',
    token: 'pat-secreto',
    projectId: 'proyecto-cis',
  };
  let axiosPost: jest.Mock;
  let axiosPut: jest.Mock;
  let axiosGet: jest.Mock;
  let axiosDelete: jest.Mock;
  let httpService: HttpService;
  let breaker: CircuitBreaker;
  let service: ZitadelAdminService;

  beforeEach(() => {
    jest.useFakeTimers();
    axiosPost = jest.fn();
    axiosPut = jest.fn();
    axiosGet = jest.fn();
    axiosDelete = jest.fn();
    httpService = {
      axiosRef: {
        post: axiosPost,
        put: axiosPut,
        get: axiosGet,
        delete: axiosDelete,
      },
    } as unknown as HttpService;
    // Umbral alto: en estos tests un solo fallo nunca debe abrir el circuito por accidente.
    breaker = new CircuitBreaker({ failureThreshold: 100, resetTimeoutMs: 1 });
    service = new ZitadelAdminService(config, breaker, httpService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('buscarUsuarioPorEmail', () => {
    it('llama a POST {issuer}/management/v1/users/_search con la query por email y los headers esperados', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ result: [] }));

      await service.buscarUsuarioPorEmail('usuario@duoc.cl', 'corr-1');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/_search',
        {
          queries: [
            {
              emailQuery: {
                emailAddress: 'usuario@duoc.cl',
                method: 'TEXT_QUERY_METHOD_EQUALS',
              },
            },
          ],
        },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
          },
        },
      );
    });

    it('devuelve null cuando Zitadel no encuentra ningun usuario con ese email', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ result: [] }));

      await expect(
        service.buscarUsuarioPorEmail('nadie@duoc.cl', 'corr-1'),
      ).resolves.toBeNull();
    });

    it('devuelve el usuario mapeado cuando Zitadel encuentra una coincidencia', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({
          result: [
            {
              id: 'usuario-1',
              human: {
                profile: { displayName: 'Usuario Uno' },
                email: { email: 'usuario@duoc.cl' },
              },
            },
          ],
        }),
      );

      await expect(
        service.buscarUsuarioPorEmail('usuario@duoc.cl', 'corr-1'),
      ).resolves.toEqual({
        id: 'usuario-1',
        email: 'usuario@duoc.cl',
        displayName: 'Usuario Uno',
      });
    });

    it('usa null para email/displayName cuando el usuario no trae datos de human', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({ result: [{ id: 'usuario-2' }] }),
      );

      await expect(
        service.buscarUsuarioPorEmail('usuario2@duoc.cl', 'corr-1'),
      ).resolves.toEqual({
        id: 'usuario-2',
        email: null,
        displayName: null,
      });
    });

    it('lanza 502 si Zitadel responde una forma inesperada', async () => {
      // `result` tiene default([]), asi que solo un tipo invalido (no faltante) rompe el schema.
      axiosPost.mockResolvedValue(
        buildAxiosResponse({ result: 'no-es-un-array' }),
      );

      await expect(
        service.buscarUsuarioPorEmail('usuario@duoc.cl', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('listarGrants', () => {
    it('llama a POST {issuer}/management/v1/users/grants/_search con projectId y el header x-zitadel-orgid (sin orgIdQuery — ese query type no existe en la API real, ver el comentario en zitadel-admin.service.ts)', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ result: [] }));

      await service.listarGrants('zitadel-org-1', 'corr-1');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/grants/_search',
        {
          queries: [{ projectIdQuery: { projectId: 'proyecto-cis' } }],
        },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
    });

    it('filtra en memoria los grants de otras organizaciones — Zitadel devuelve grants de TODAS las organizaciones del proyecto, no solo la pedida', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({
          result: [
            {
              id: 'grant-1',
              userId: 'usuario-1',
              orgId: 'zitadel-org-1',
              projectId: 'proyecto-cis',
              roleKeys: ['administrador-patrimonial'],
              email: 'usuario1@duoc.cl',
            },
            {
              id: 'grant-2',
              userId: 'usuario-2',
              orgId: 'zitadel-org-OTRA',
              projectId: 'proyecto-cis',
              roleKeys: ['directivo'],
              email: 'usuario2@otra-org.cl',
            },
          ],
        }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).resolves.toEqual([
        {
          userId: 'usuario-1',
          email: 'usuario1@duoc.cl',
          displayName: null,
          roles: ['administrador-patrimonial'],
        },
      ]);
    });

    it('devuelve los grants mapeados cuando Zitadel responde una forma valida', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({
          result: [
            {
              id: 'grant-1',
              userId: 'usuario-1',
              orgId: 'zitadel-org-1',
              projectId: 'proyecto-cis',
              roleKeys: ['administrador-patrimonial'],
              email: 'usuario@duoc.cl',
              displayName: 'Usuario Uno',
            },
          ],
        }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).resolves.toEqual([
        {
          userId: 'usuario-1',
          email: 'usuario@duoc.cl',
          displayName: 'Usuario Uno',
          roles: ['administrador-patrimonial'],
        },
      ]);
    });

    it('usa null para email/displayName y [] para roles cuando Zitadel no los trae', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({
          result: [
            {
              id: 'grant-2',
              userId: 'usuario-2',
              orgId: 'zitadel-org-1',
              projectId: 'proyecto-cis',
            },
          ],
        }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).resolves.toEqual([
        {
          userId: 'usuario-2',
          email: null,
          displayName: null,
          roles: [],
        },
      ]);
    });

    it('lanza 502 si la request a Zitadel falla (red/timeout/5xx) tras agotar los reintentos', async () => {
      axiosPost.mockRejectedValue(buildAxiosNetworkError());

      const assertion = expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(200); // backoff del 1er reintento
      await jest.advanceTimersByTimeAsync(400); // backoff del 2do reintento (exponencial)
      await assertion;

      // WAF 4: reintentos con backoff, 3 intentos totales, mismo criterio que CoreClientService.
      expect(axiosPost).toHaveBeenCalledTimes(3);
    });

    it('no reintenta si el error no es un AxiosError (bug inesperado del cliente HTTP)', async () => {
      axiosPost.mockRejectedValue(
        new Error('bug inesperado, no deberia pasar'),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('propaga un 404 de Zitadel como NotFoundException, sin reintentar', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(404, { message: 'organizacion inexistente' }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('propaga un 400 de Zitadel como BadGatewayException, sin exponer el detalle interno', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(400, { message: 'detalle interno de zitadel' }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('cuando el circuito esta abierto, lanza 502 sin llamar a axios', async () => {
      const breakerAbierto = {
        execute: jest.fn().mockRejectedValue(new CircuitOpenError()),
      } as unknown as CircuitBreaker;
      const serviceConCircuitoAbierto = new ZitadelAdminService(
        config,
        breakerAbierto,
        httpService,
      );

      await expect(
        serviceConCircuitoAbierto.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosPost).not.toHaveBeenCalled();
    });
  });

  describe('crearGrant', () => {
    // Gap 0/1 — antes de crear el grant, siempre resuelve el projectGrantId de la organización
    // (ver resolverProjectGrantId) — un search vacío significa "organización dueña del proyecto,
    // no hace falta projectGrantId" (mismo comportamiento que antes de este cambio).
    const SIN_PROJECT_GRANT = buildAxiosResponse({ result: [] });

    it('llama primero a POST .../projects/:id/grants/_search, y con resultado vacio manda projectId sin projectGrantId', async () => {
      axiosPost
        .mockResolvedValueOnce(SIN_PROJECT_GRANT)
        .mockResolvedValueOnce(buildAxiosResponse({}));

      await service.crearGrant(
        'zitadel-org-1',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );

      expect(axiosPost).toHaveBeenNthCalledWith(
        1,
        'http://zitadel:8080/management/v1/projects/proyecto-cis/grants/_search',
        {},
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
          },
        },
      );
      expect(axiosPost).toHaveBeenNthCalledWith(
        2,
        'http://zitadel:8080/management/v1/users/usuario-1/grants',
        {
          projectId: 'proyecto-cis',
          roleKeys: ['administrador-patrimonial'],
        },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
    });

    // Gap 0/1 — el caso real que motivó este cambio: una organización nueva SI tiene
    // ProjectGrant (AdministradorService.altaOrganizacion ya lo creó), y el projectGrantId debe
    // viajar en el body del UserGrant o Zitadel responde "Project not found".
    it('si la organización tiene ProjectGrant, incluye projectGrantId en el body del UserGrant', async () => {
      axiosPost
        .mockResolvedValueOnce(
          buildAxiosResponse({
            result: [
              { grantId: 'pg-otra-org', grantedOrgId: 'zitadel-org-OTRA' },
              { grantId: 'pg-1', grantedOrgId: 'zitadel-org-nueva' },
            ],
          }),
        )
        .mockResolvedValueOnce(buildAxiosResponse({}));

      await service.crearGrant(
        'zitadel-org-nueva',
        'usuario-1',
        'directivo',
        'corr-1',
      );

      expect(axiosPost).toHaveBeenNthCalledWith(
        2,
        'http://zitadel:8080/management/v1/users/usuario-1/grants',
        {
          projectId: 'proyecto-cis',
          projectGrantId: 'pg-1',
          roleKeys: ['directivo'],
        },
        expect.anything(),
      );
    });

    it('escapa el userId al armar la URL', async () => {
      axiosPost
        .mockResolvedValueOnce(SIN_PROJECT_GRANT)
        .mockResolvedValueOnce(buildAxiosResponse({}));

      await service.crearGrant(
        'zitadel-org-1',
        'usuario con espacio',
        'directivo',
        'corr-1',
      );

      expect(axiosPost).toHaveBeenNthCalledWith(
        2,
        'http://zitadel:8080/management/v1/users/usuario%20con%20espacio/grants',
        expect.anything(),
        expect.anything(),
      );
    });

    it('propaga un 404 de Zitadel como NotFoundException (usuario inexistente), sin reintentar', async () => {
      axiosPost
        .mockResolvedValueOnce(SIN_PROJECT_GRANT)
        .mockRejectedValueOnce(
          buildAxiosError(404, { message: 'usuario inexistente' }),
        );

      await expect(
        service.crearGrant('zitadel-org-1', 'no-existe', 'directivo', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(axiosPost).toHaveBeenCalledTimes(2);
    });

    // Verificado real contra Zitadel v2.65 (DOC-022 4) — Zitadel modela un solo UserGrant por
    // usuario+proyecto+organizacion, un segundo POST .../grants para el mismo trio devuelve 409
    // "User grant already exists". crearGrant reacciona sumando el rol al grant existente (PUT)
    // en vez de fallar.
    it('si el usuario ya tiene un grant en el proyecto (409), le suma el rol via PUT en vez de fallar', async () => {
      axiosPost
        .mockResolvedValueOnce(SIN_PROJECT_GRANT)
        .mockRejectedValueOnce(
          buildAxiosError(409, { message: 'User grant already exists' }),
        )
        .mockResolvedValueOnce(
          buildAxiosResponse({
            result: [
              {
                id: 'grant-1',
                userId: 'usuario-1',
                orgId: 'zitadel-org-1',
                projectId: 'proyecto-cis',
                roleKeys: ['administrador-sistema'],
              },
            ],
          }),
        );
      axiosPut.mockResolvedValue(buildAxiosResponse({}));

      await service.crearGrant(
        'zitadel-org-1',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );

      expect(axiosPut).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/usuario-1/grants/grant-1',
        { roleKeys: ['administrador-sistema', 'administrador-patrimonial'] },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
    });

    it('si el grant existente ya tiene el rol pedido (409 redundante), no llama a PUT — idempotente', async () => {
      axiosPost
        .mockResolvedValueOnce(SIN_PROJECT_GRANT)
        .mockRejectedValueOnce(
          buildAxiosError(409, { message: 'User grant already exists' }),
        )
        .mockResolvedValueOnce(
          buildAxiosResponse({
            result: [
              {
                id: 'grant-1',
                userId: 'usuario-1',
                orgId: 'zitadel-org-1',
                projectId: 'proyecto-cis',
                roleKeys: ['administrador-patrimonial'],
              },
            ],
          }),
        );

      await service.crearGrant(
        'zitadel-org-1',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );

      expect(axiosPut).not.toHaveBeenCalled();
    });

    it('devuelve 502 si Zitadel dijo 409 pero la búsqueda del grant existente no encuentra nada (consistencia eventual)', async () => {
      axiosPost
        .mockResolvedValueOnce(SIN_PROJECT_GRANT)
        .mockRejectedValueOnce(
          buildAxiosError(409, { message: 'User grant already exists' }),
        )
        .mockResolvedValueOnce(buildAxiosResponse({ result: [] }));

      await expect(
        service.crearGrant(
          'zitadel-org-1',
          'usuario-1',
          'administrador-patrimonial',
          'corr-1',
        ),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosPut).not.toHaveBeenCalled();
    });
  });

  describe('otorgarProyectoAOrganizacion', () => {
    it('llama a POST {issuer}/management/v1/projects/:id/grants con los 3 roles, sin header x-zitadel-orgid', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ grantId: 'pg-1' }));

      await service.otorgarProyectoAOrganizacion('zitadel-org-nueva', 'corr-1');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/projects/proyecto-cis/grants',
        {
          grantedOrgId: 'zitadel-org-nueva',
          roleKeys: [
            'administrador-sistema',
            'directivo',
            'administrador-patrimonial',
          ],
        },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
          },
        },
      );
    });

    it('lanza 502 si Zitadel responde una forma inesperada', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({}));

      await expect(
        service.otorgarProyectoAOrganizacion('zitadel-org-nueva', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('propaga un 409 de Zitadel (ProjectGrant ya existe) como BadGatewayException, sin reintentar', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(409, { message: 'Project grant already exists' }),
      );

      await expect(
        service.otorgarProyectoAOrganizacion('zitadel-org-nueva', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('crearOrganizacion', () => {
    it('llama a POST {issuer}/management/v1/orgs con el nombre, sin header x-zitadel-orgid', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ id: 'org-nueva-1' }));

      await service.crearOrganizacion('DUOC UC — Melipilla', 'corr-1');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/orgs',
        { name: 'DUOC UC — Melipilla' },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
          },
        },
      );
    });

    it('devuelve el id que Zitadel asigna a la organización nueva', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ id: 'org-nueva-1' }));

      await expect(
        service.crearOrganizacion('DUOC UC — Melipilla', 'corr-1'),
      ).resolves.toEqual({ id: 'org-nueva-1' });
    });

    it('lanza 502 si Zitadel responde una forma inesperada', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({}));

      await expect(
        service.crearOrganizacion('DUOC UC — Melipilla', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('crearUsuarioHuman', () => {
    it('llama a POST {issuer}/management/v1/users/human con el email y una contraseña inicial generada', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ userId: 'usuario-9' }));

      await service.crearUsuarioHuman('nuevo@duoc.cl', 'corr-1');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/human',
        {
          userName: 'nuevo@duoc.cl',
          profile: { firstName: 'nuevo@duoc.cl', lastName: 'nuevo@duoc.cl' },
          email: { email: 'nuevo@duoc.cl', isEmailVerified: true },
          password: {
            password: expect.stringMatching(/^.{20}$/) as unknown as string,
            changeRequired: true,
          },
        },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
          },
        },
      );
    });

    it('devuelve el userId y la MISMA contraseña que mandó a Zitadel, para compartir fuera de banda', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ userId: 'usuario-9' }));

      const resultado = await service.crearUsuarioHuman(
        'nuevo@duoc.cl',
        'corr-1',
      );

      expect(resultado.userId).toBe('usuario-9');
      expect(resultado.passwordInicial).toHaveLength(20);
      const [, bodyEnviado] = axiosPost.mock.calls[0] as [
        string,
        { password: { password: string } },
      ];
      expect(bodyEnviado.password.password).toBe(resultado.passwordInicial);
    });

    it('genera una contraseña distinta en cada llamada', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ userId: 'usuario-9' }));

      const primera = await service.crearUsuarioHuman(
        'uno@duoc.cl',
        'corr-1',
      );
      const segunda = await service.crearUsuarioHuman(
        'dos@duoc.cl',
        'corr-1',
      );

      expect(primera.passwordInicial).not.toBe(segunda.passwordInicial);
    });

    it('lanza 502 si Zitadel responde una forma inesperada', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({}));

      await expect(
        service.crearUsuarioHuman('nuevo@duoc.cl', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('actualizarNombreOrganizacion', () => {
    // DOC-024 1 — verificado real contra el Zitadel de devops/local (2026-08-21): PUT /orgs/me
    // con x-zitadel-orgid renombra la organizacion del header, no la del PAT.
    it('llama a PUT {issuer}/management/v1/orgs/me con el nombre y el header x-zitadel-orgid', async () => {
      axiosPut.mockResolvedValue(buildAxiosResponse({}));

      await service.actualizarNombreOrganizacion(
        'zitadel-org-1',
        'DUOC UC (renombrada)',
        'corr-1',
      );

      expect(axiosPut).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/orgs/me',
        { name: 'DUOC UC (renombrada)' },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
    });

    it('propaga un 404 de Zitadel como NotFoundException, sin reintentar', async () => {
      axiosPut.mockRejectedValue(
        buildAxiosError(404, { message: 'organizacion inexistente' }),
      );

      await expect(
        service.actualizarNombreOrganizacion(
          'no-existe',
          'Nombre nuevo',
          'corr-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('quitarRolDeGrant', () => {
    function mockBuscarGrant(roleKeys: string[]) {
      axiosPost.mockResolvedValueOnce(
        buildAxiosResponse({
          result: [
            {
              id: 'grant-1',
              userId: 'usuario-1',
              orgId: 'zitadel-org-1',
              projectId: 'proyecto-cis',
              roleKeys,
            },
          ],
        }),
      );
    }

    it('quita el rol via PUT cuando al usuario le quedan otros roles en el grant', async () => {
      mockBuscarGrant(['administrador-patrimonial', 'directivo']);
      axiosPut.mockResolvedValue(buildAxiosResponse({}));

      await service.quitarRolDeGrant(
        'zitadel-org-1',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );

      expect(axiosPut).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/usuario-1/grants/grant-1',
        { roleKeys: ['directivo'] },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
      expect(axiosDelete).not.toHaveBeenCalled();
    });

    // DOC-024 — verificado real: Zitadel no acepta un grant sin roles, hay que borrarlo entero.
    it('borra el grant completo via DELETE cuando el rol que se quita era el unico', async () => {
      mockBuscarGrant(['administrador-patrimonial']);
      axiosDelete.mockResolvedValue(buildAxiosResponse({}));

      await service.quitarRolDeGrant(
        'zitadel-org-1',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );

      expect(axiosDelete).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/usuario-1/grants/grant-1',
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
      expect(axiosPut).not.toHaveBeenCalled();
    });

    it('es idempotente: no llama a PUT ni DELETE si el usuario no tiene ningun grant en esa organizacion', async () => {
      axiosPost.mockResolvedValueOnce(buildAxiosResponse({ result: [] }));

      await service.quitarRolDeGrant(
        'zitadel-org-1',
        'usuario-1',
        'directivo',
        'corr-1',
      );

      expect(axiosPut).not.toHaveBeenCalled();
      expect(axiosDelete).not.toHaveBeenCalled();
    });

    it('es idempotente: no llama a PUT ni DELETE si el grant no tiene el rol pedido', async () => {
      mockBuscarGrant(['directivo']);

      await service.quitarRolDeGrant(
        'zitadel-org-1',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );

      expect(axiosPut).not.toHaveBeenCalled();
      expect(axiosDelete).not.toHaveBeenCalled();
    });
  });

  describe('desactivarUsuario', () => {
    // DOC-024 — hallazgo real: un usuario en USER_STATE_INITIAL (cualquier Profesional de AFT
    // recien creado en este stack sin SMTP) no se puede desactivar, solo borrar.
    it('borra al usuario via DELETE cuando esta en USER_STATE_INITIAL', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({
          user: { id: 'usuario-1', state: 'USER_STATE_INITIAL' },
        }),
      );
      axiosDelete.mockResolvedValue(buildAxiosResponse({}));

      await service.desactivarUsuario('zitadel-org-1', 'usuario-1', 'corr-1');

      expect(axiosDelete).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/usuario-1',
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
      expect(axiosPost).not.toHaveBeenCalled();
    });

    it('desactiva via POST _deactivate cuando el usuario ya esta activo', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({
          user: { id: 'usuario-1', state: 'USER_STATE_ACTIVE' },
        }),
      );
      axiosPost.mockResolvedValue(buildAxiosResponse({}));

      await service.desactivarUsuario('zitadel-org-1', 'usuario-1', 'corr-1');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/usuario-1/_deactivate',
        {},
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
      expect(axiosDelete).not.toHaveBeenCalled();
    });

    it('propaga un 404 de Zitadel (usuario inexistente) al resolver el estado, sin llamar a POST/DELETE', async () => {
      axiosGet.mockRejectedValue(
        buildAxiosError(404, { message: 'usuario inexistente' }),
      );

      await expect(
        service.desactivarUsuario('zitadel-org-1', 'no-existe', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(axiosPost).not.toHaveBeenCalled();
      expect(axiosDelete).not.toHaveBeenCalled();
    });

    it('lanza 502 si Zitadel responde una forma inesperada al consultar el estado', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse({}));

      await expect(
        service.desactivarUsuario('zitadel-org-1', 'usuario-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
