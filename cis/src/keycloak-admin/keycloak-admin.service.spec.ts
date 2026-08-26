import { BadGatewayException } from '@nestjs/common';
import { AxiosError } from 'axios';
import type { HttpService } from '@nestjs/axios';
import { KeycloakAdminService } from './keycloak-admin.service';
import { CircuitBreaker } from '../core-client/circuit-breaker';
import type { KeycloakAdminConfig } from './keycloak-admin.config';

const CONFIG: KeycloakAdminConfig = {
  tokenUrl: 'http://keycloak:8080/realms/sicsaft/protocol/openid-connect/token',
  adminBaseUrl: 'http://keycloak:8080/admin/realms/sicsaft',
  clientId: 'cis-admin',
  clientSecret: 'secreto',
};

function axiosResponse(data: unknown, headers: Record<string, string> = {}) {
  return { data, headers };
}

function conflictError(): AxiosError {
  const error = new AxiosError('Conflict');
  error.response = { status: 409 } as AxiosError['response'];
  return error;
}

function badRequestError(): AxiosError {
  const error = new AxiosError('Bad Request');
  error.response = { status: 400 } as AxiosError['response'];
  return error;
}

function buildService() {
  const axiosRef = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  const httpService = { axiosRef } as unknown as HttpService;
  const breaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
  });
  const service = new KeycloakAdminService(CONFIG, breaker, httpService);
  return { service, axiosRef };
}

const TOKEN_RESPONSE = axiosResponse({
  access_token: 'token-servicio',
  expires_in: 300,
});

describe('KeycloakAdminService', () => {
  describe('crearOrganizacion', () => {
    it('slugifica el nombre como alias cuando no hay colision', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE) // token
        .mockResolvedValueOnce(axiosResponse({})); // POST /organizations
      axiosRef.get.mockResolvedValueOnce(axiosResponse([])); // listarOrganizaciones

      const resultado = await service.crearOrganizacion(
        'Municipalidad de Melipilla',
        'corr-1',
      );

      expect(resultado).toEqual({ id: 'municipalidad-de-melipilla' });
      const [url, body, options] = axiosRef.post.mock.calls[1] as unknown as [
        string,
        unknown,
        { headers: Record<string, string> },
      ];
      expect(url).toBe(`${CONFIG.adminBaseUrl}/organizations`);
      expect(body).toEqual({
        name: 'Municipalidad de Melipilla',
        alias: 'municipalidad-de-melipilla',
        domains: [
          {
            name: 'municipalidad-de-melipilla.sicsaft.invalid',
            verified: false,
          },
        ],
      });
      expect(options.headers.Authorization).toBe('Bearer token-servicio');
    });

    it('agrega un sufijo numerico si el alias ya existe (colision)', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockResolvedValueOnce(axiosResponse({}));
      axiosRef.get.mockResolvedValueOnce(
        axiosResponse([
          { id: 'uuid-1', name: 'DUOC UC', alias: 'duoc-uc', enabled: true },
        ]),
      );

      const resultado = await service.crearOrganizacion('DUOC UC', 'corr-1');

      expect(resultado).toEqual({ id: 'duoc-uc-2' });
    });
  });

  describe('actualizarNombreOrganizacion', () => {
    it('lee la organizacion actual y hace PUT con la representacion completa', async () => {
      const { service, axiosRef } = buildService();
      const org = {
        id: 'uuid-1',
        name: 'DUOC UC',
        alias: 'duoc-uc',
        enabled: true,
      };
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get
        .mockResolvedValueOnce(axiosResponse([org]))
        .mockResolvedValueOnce(axiosResponse(org));
      axiosRef.put.mockResolvedValueOnce(axiosResponse({}));

      await service.actualizarNombreOrganizacion(
        'duoc-uc',
        'DUOC UC (renombrada)',
        'corr-1',
      );

      expect(axiosRef.put).toHaveBeenCalledWith(
        `${CONFIG.adminBaseUrl}/organizations/uuid-1`,
        { ...org, name: 'DUOC UC (renombrada)' },
        expect.any(Object),
      );
    });

    it('lanza BadGatewayException si no encuentra la organizacion por alias', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(axiosResponse([]));

      await expect(
        service.actualizarNombreOrganizacion('sin-existir', 'x', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('buscarUsuarioPorEmail', () => {
    it('devuelve el usuario cuando existe', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(
        axiosResponse([
          {
            id: 'usuario-1',
            username: 'a@duoc.cl',
            email: 'a@duoc.cl',
            firstName: 'Ana',
            lastName: 'Soto',
          },
        ]),
      );

      const usuario = await service.buscarUsuarioPorEmail(
        'a@duoc.cl',
        'corr-1',
      );

      expect(usuario).toEqual({
        id: 'usuario-1',
        email: 'a@duoc.cl',
        displayName: 'Ana Soto',
      });
    });

    it('devuelve null cuando no existe ningun usuario con ese email', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(axiosResponse([]));

      await expect(
        service.buscarUsuarioPorEmail('nadie@duoc.cl', 'corr-1'),
      ).resolves.toBeNull();
    });

    it('devuelve email/displayName null si el usuario no tiene esos campos en Keycloak', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(
        axiosResponse([{ id: 'usuario-1', username: 'op-1' }]),
      );

      await expect(
        service.buscarUsuarioPorEmail('op-1', 'corr-1'),
      ).resolves.toEqual({ id: 'usuario-1', email: null, displayName: null });
    });
  });

  describe('crearUsuarioHuman', () => {
    it('extrae el userId del header Location y devuelve la password generada', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE).mockResolvedValueOnce(
        axiosResponse(
          {},
          {
            location: `${CONFIG.adminBaseUrl}/users/usuario-nuevo-1`,
          },
        ),
      );

      const resultado = await service.crearUsuarioHuman(
        'nuevo@duoc.cl',
        'corr-1',
      );

      expect(resultado.userId).toBe('usuario-nuevo-1');
      expect(resultado.passwordInicial).toHaveLength(20);
      const [, body] = axiosRef.post.mock.calls[1] as unknown as [
        string,
        Record<string, unknown>,
      ];
      expect(body).toMatchObject({
        username: 'nuevo@duoc.cl',
        email: 'nuevo@duoc.cl',
        firstName: 'nuevo@duoc.cl',
        lastName: 'nuevo@duoc.cl',
      });
    });

    it('lanza BadGatewayException si Keycloak no devuelve header Location', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockResolvedValueOnce(axiosResponse({}));

      await expect(
        service.crearUsuarioHuman('nuevo@duoc.cl', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('crearGrant', () => {
    const ORG = {
      id: 'org-uuid-1',
      name: 'DUOC UC',
      alias: 'duoc-uc',
      enabled: true,
    };

    it('crea el grupo organizacion+rol si no existe, asigna el realm role, y agrega al usuario', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE) // token
        .mockResolvedValueOnce(axiosResponse({})) // agregar miembro
        .mockResolvedValueOnce(
          axiosResponse(
            {},
            { location: `${CONFIG.adminBaseUrl}/groups/grupo-1` },
          ),
        ) // crear grupo
        .mockResolvedValueOnce(axiosResponse({})); // asignar role al grupo
      axiosRef.get
        .mockResolvedValueOnce(axiosResponse([ORG])) // resolverOrganizacionPorAlias
        .mockResolvedValueOnce(axiosResponse([])) // buscarGrupoPorNombre -> no existe
        .mockResolvedValueOnce(
          axiosResponse({
            id: 'rol-administrador-sistema',
            name: 'administrador-sistema',
          }),
        ); // obtenerRol
      axiosRef.put.mockResolvedValueOnce(axiosResponse({}));

      await service.crearGrant(
        'duoc-uc',
        'usuario-1',
        'administrador-sistema',
        'corr-1',
      );

      expect(axiosRef.post).toHaveBeenNthCalledWith(
        2,
        `${CONFIG.adminBaseUrl}/organizations/org-uuid-1/members`,
        'usuario-1',
        expect.any(Object),
      );
      expect(axiosRef.post).toHaveBeenNthCalledWith(
        4,
        `${CONFIG.adminBaseUrl}/groups/grupo-1/role-mappings/realm`,
        [{ id: 'rol-administrador-sistema', name: 'administrador-sistema' }],
        expect.any(Object),
      );
      expect(axiosRef.put).toHaveBeenCalledWith(
        `${CONFIG.adminBaseUrl}/users/usuario-1/groups/grupo-1`,
        {},
        expect.any(Object),
      );
    });

    it('reusa el grupo existente sin volver a crearlo', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockResolvedValueOnce(axiosResponse({})); // agregar miembro
      axiosRef.get
        .mockResolvedValueOnce(axiosResponse([ORG]))
        .mockResolvedValueOnce(
          axiosResponse([
            { id: 'grupo-existente', name: 'duoc-uc::directivo' },
          ]),
        );
      axiosRef.put.mockResolvedValueOnce(axiosResponse({}));

      await service.crearGrant('duoc-uc', 'usuario-1', 'directivo', 'corr-1');

      expect(axiosRef.post).toHaveBeenCalledTimes(2); // solo token + agregar miembro
      expect(axiosRef.put).toHaveBeenCalledWith(
        `${CONFIG.adminBaseUrl}/users/usuario-1/groups/grupo-existente`,
        {},
        expect.any(Object),
      );
    });

    it('ignora el 409 "ya es miembro" y continua con el resto del flujo', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockRejectedValueOnce(conflictError()); // agregar miembro -> 409
      axiosRef.get
        .mockResolvedValueOnce(axiosResponse([ORG]))
        .mockResolvedValueOnce(
          axiosResponse([
            { id: 'grupo-existente', name: 'duoc-uc::directivo' },
          ]),
        );
      axiosRef.put.mockResolvedValueOnce(axiosResponse({}));

      await expect(
        service.crearGrant('duoc-uc', 'usuario-1', 'directivo', 'corr-1'),
      ).resolves.toBeUndefined();
      expect(axiosRef.put).toHaveBeenCalled();
    });

    it('propaga un error real (no-409) al agregar el miembro, sin tragarlo', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockRejectedValueOnce(badRequestError());
      axiosRef.get.mockResolvedValueOnce(axiosResponse([ORG]));

      await expect(
        service.crearGrant('duoc-uc', 'usuario-1', 'directivo', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('quitarRolDeGrant', () => {
    it('quita al usuario del grupo cuando existe', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(
        axiosResponse([{ id: 'grupo-1', name: 'duoc-uc::directivo' }]),
      );
      axiosRef.delete.mockResolvedValueOnce(axiosResponse({}));

      await service.quitarRolDeGrant(
        'duoc-uc',
        'usuario-1',
        'directivo',
        'corr-1',
      );

      expect(axiosRef.delete).toHaveBeenCalledWith(
        `${CONFIG.adminBaseUrl}/users/usuario-1/groups/grupo-1`,
        expect.any(Object),
      );
    });

    it('es un no-op si el grupo organizacion+rol no existe', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(axiosResponse([]));

      await service.quitarRolDeGrant(
        'duoc-uc',
        'usuario-1',
        'directivo',
        'corr-1',
      );

      expect(axiosRef.delete).not.toHaveBeenCalled();
    });
  });

  describe('desactivarUsuario', () => {
    it('deshabilita al usuario con un PUT parcial (ADR-004: ya no recibe organizacionId)', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.put.mockResolvedValueOnce(axiosResponse({}));

      await service.desactivarUsuario('usuario-1', 'corr-1');

      expect(axiosRef.put).toHaveBeenCalledWith(
        `${CONFIG.adminBaseUrl}/users/usuario-1`,
        { enabled: false },
        expect.any(Object),
      );
    });
  });

  describe('listarGrants', () => {
    it('arma un grant por cada miembro que tiene al menos un grupo de la organizacion, omite los que no tienen ninguno', async () => {
      const { service, axiosRef } = buildService();
      const ORG = {
        id: 'org-uuid-1',
        name: 'DUOC UC',
        alias: 'duoc-uc',
        enabled: true,
      };
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get
        .mockResolvedValueOnce(axiosResponse([ORG])) // resolverOrganizacionPorAlias
        .mockResolvedValueOnce(
          axiosResponse([
            {
              id: 'usuario-1',
              username: 'a@duoc.cl',
              email: 'a@duoc.cl',
              firstName: 'Ana',
              lastName: 'Soto',
            },
            {
              id: 'usuario-2',
              username: 'b@duoc.cl',
              email: 'b@duoc.cl',
              firstName: 'Beto',
              lastName: 'Perez',
            },
          ]),
        ) // members
        .mockResolvedValueOnce(
          axiosResponse([{ id: 'g1', name: 'duoc-uc::administrador-sistema' }]),
        ) // grupos de usuario-1
        .mockResolvedValueOnce(axiosResponse([])); // grupos de usuario-2 (ninguno)

      const grants = await service.listarGrants('duoc-uc', 'corr-1');

      expect(grants).toEqual([
        {
          userId: 'usuario-1',
          email: 'a@duoc.cl',
          displayName: 'Ana Soto',
          roles: ['administrador-sistema'],
        },
      ]);
    });

    it('devuelve displayName null si el miembro no tiene firstName/lastName en Keycloak', async () => {
      const { service, axiosRef } = buildService();
      const ORG = {
        id: 'org-uuid-1',
        name: 'DUOC UC',
        alias: 'duoc-uc',
        enabled: true,
      };
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get
        .mockResolvedValueOnce(axiosResponse([ORG]))
        .mockResolvedValueOnce(
          axiosResponse([{ id: 'usuario-1', username: 'op-1' }]),
        )
        .mockResolvedValueOnce(
          axiosResponse([{ id: 'g1', name: 'duoc-uc::directivo' }]),
        );

      const grants = await service.listarGrants('duoc-uc', 'corr-1');

      expect(grants).toEqual([
        {
          userId: 'usuario-1',
          email: null,
          displayName: null,
          roles: ['directivo'],
        },
      ]);
    });
  });

  describe('resolverRolesPorOrganizacionDeUsuario', () => {
    it('agrupa los roles por organizacion, solo para las organizaciones pedidas', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(
        axiosResponse([
          { id: 'g1', name: 'duoc-uc::administrador-sistema' },
          { id: 'g2', name: 'duoc-uc::directivo' },
          { id: 'g3', name: 'otra-org::administrador-sistema' },
        ]),
      );

      const resultado = await service.resolverRolesPorOrganizacionDeUsuario(
        'usuario-1',
        ['duoc-uc'],
        'corr-1',
      );

      expect(resultado).toEqual({
        'duoc-uc': ['administrador-sistema', 'directivo'],
      });
    });

    it('devuelve un objeto vacio si el usuario no tiene grupos de ninguna organizacion pedida', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(axiosResponse([]));

      await expect(
        service.resolverRolesPorOrganizacionDeUsuario(
          'usuario-1',
          ['duoc-uc'],
          'corr-1',
        ),
      ).resolves.toEqual({});
    });
  });

  describe('caché del token de servicio', () => {
    it('reutiliza el token cacheado en llamadas subsiguientes en vez de pedir uno nuevo', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get
        .mockResolvedValueOnce(axiosResponse([]))
        .mockResolvedValueOnce(axiosResponse([]));

      await service.buscarUsuarioPorEmail('a@duoc.cl', 'corr-1');
      await service.buscarUsuarioPorEmail('b@duoc.cl', 'corr-2');

      // Un solo POST en total (el del token) -- ninguna de las dos llamadas a
      // buscarUsuarioPorEmail hace POST, así que 1 confirma que no se pidió un token de más.
      expect(axiosRef.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('manejo de errores genérico', () => {
    it('traduce un error no-conflicto de la Admin API a BadGatewayException', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockRejectedValueOnce(badRequestError());

      await expect(
        service.buscarUsuarioPorEmail('a@duoc.cl', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('traduce tambien un error que no es de axios (ej. un fallo de red genérico)', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockRejectedValueOnce(new Error('red caida'));

      await expect(
        service.buscarUsuarioPorEmail('a@duoc.cl', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('lanza BadGatewayException si Keycloak devuelve una forma inesperada', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockResolvedValueOnce(axiosResponse('no-es-un-array'));

      await expect(
        service.buscarUsuarioPorEmail('a@duoc.cl', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('abre el circuito despues de varios fallos consecutivos y corta rapido sin volver a llamar a Keycloak', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post.mockResolvedValueOnce(TOKEN_RESPONSE);
      axiosRef.get.mockRejectedValue(badRequestError());

      for (let intento = 0; intento < 5; intento += 1) {
        await expect(
          service.buscarUsuarioPorEmail('a@duoc.cl', 'corr-1'),
        ).rejects.toThrow(BadGatewayException);
      }
      const llamadasAntesDeAbrir = axiosRef.get.mock.calls.length;

      await expect(
        service.buscarUsuarioPorEmail('a@duoc.cl', 'corr-1'),
      ).rejects.toThrow('circuito abierto');
      expect(axiosRef.get.mock.calls).toHaveLength(llamadasAntesDeAbrir);
    });
  });

  describe('casos borde de generacion de alias/id', () => {
    it('usa "organizacion" como base cuando el nombre no tiene ningun caracter alfanumerico', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockResolvedValueOnce(axiosResponse({}));
      axiosRef.get.mockResolvedValueOnce(axiosResponse([]));

      const resultado = await service.crearOrganizacion('!!!', 'corr-1');

      expect(resultado).toEqual({ id: 'organizacion' });
    });

    it('sigue sumando sufijos si ya existen varias colisiones (alias, alias-2, ...)', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockResolvedValueOnce(axiosResponse({}));
      axiosRef.get.mockResolvedValueOnce(
        axiosResponse([
          { id: 'u1', name: 'DUOC UC', alias: 'duoc-uc', enabled: true },
          { id: 'u2', name: 'DUOC UC 2', alias: 'duoc-uc-2', enabled: true },
        ]),
      );

      const resultado = await service.crearOrganizacion('DUOC UC', 'corr-1');

      expect(resultado).toEqual({ id: 'duoc-uc-3' });
    });

    it('lanza BadGatewayException si el header Location de un usuario nuevo no trae un id (termina en "/")', async () => {
      const { service, axiosRef } = buildService();
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockResolvedValueOnce(
          axiosResponse({}, { location: `${CONFIG.adminBaseUrl}/users/` }),
        );

      await expect(
        service.crearUsuarioHuman('nuevo@duoc.cl', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('lanza BadGatewayException si el header Location de un grupo nuevo no trae un id (termina en "/")', async () => {
      const { service, axiosRef } = buildService();
      const ORG = {
        id: 'org-uuid-1',
        name: 'DUOC UC',
        alias: 'duoc-uc',
        enabled: true,
      };
      axiosRef.post
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockResolvedValueOnce(axiosResponse({})) // agregar miembro
        .mockResolvedValueOnce(
          axiosResponse({}, { location: `${CONFIG.adminBaseUrl}/groups/` }),
        ); // crear grupo sin id
      axiosRef.get
        .mockResolvedValueOnce(axiosResponse([ORG]))
        .mockResolvedValueOnce(axiosResponse([]));

      await expect(
        service.crearGrant('duoc-uc', 'usuario-1', 'directivo', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
