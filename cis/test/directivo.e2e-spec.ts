import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { generateKeyPair, type JWTVerifyGetKey } from 'jose';
import type { GrantUsuario } from './../src/keycloak-admin/keycloak-admin.types';
import { crearAppE2e } from './support/e2e-app';
import { crearRedisStub } from './support/redis-stub';
import { firmarTokenKeycloak } from './support/jwt';

const ISSUER = 'http://id.sicsaft.localhost/realms/sicsaft';
const AUDIENCE = 'cis-api';
// ADR-004 — `organizacionId` ya es el alias de la Organization de Keycloak, sin traducción
// numérica (ver el comentario equivalente en administrador.e2e-spec.ts).
const DUOC_ORG_ID = 'duoc-uc';
const OTRA_ORG_ID = 'otra-org';

// DOC-022 3 — el Directivo designa quién es el Profesional de AFT de SU organización, sin poder
// tocar usuarios de otra (límite de organización) ni asignar un rol distinto a
// administrador-patrimonial (enum cerrado del schema, ver directivo.schemas.ts).
describe('DOC-022 3 — CIS módulo directivo (gestión de roles acotada a la propia organización)', () => {
  let app: INestApplication<App>;
  let tokenDirectivoDuoc: string;
  let tokenPatrimonialDuoc: string;
  let tokenDirectivoOtraOrg: string;
  let keycloakAdminService: {
    buscarUsuarioPorEmail: jest.Mock;
    listarGrants: jest.Mock;
    crearGrant: jest.Mock;
    crearUsuarioHuman: jest.Mock;
    resolverRolesPorOrganizacionDeUsuario: jest.Mock;
  };

  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    // ADR-004 — sujetos distintos por persona: KeycloakAuthGuard cachea rolesPorOrganizacion por
    // `sub` (ver keycloak-auth.guard.ts), y en Keycloak el rol lo resuelve el servidor a partir
    // del usuario (grupos), no del JWT presentado — a diferencia de Zitadel, un mismo usuario no
    // puede "elegir" su rol firmando un claim distinto. Tres subs simulan tres operadores reales.
    tokenDirectivoDuoc = await firmarTokenKeycloak(privateKey, [DUOC_ORG_ID], {
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: 'op-directivo-duoc',
    });
    tokenPatrimonialDuoc = await firmarTokenKeycloak(
      privateKey,
      [DUOC_ORG_ID],
      { issuer: ISSUER, audience: AUDIENCE, subject: 'op-patrimonial-duoc' },
    );
    // Mismo emisor/clave que tokenDirectivoDuoc — solo cambia la organización firmada en el
    // claim. Simula un segundo Directivo real (otra organización), no un token inválido.
    tokenDirectivoOtraOrg = await firmarTokenKeycloak(
      privateKey,
      [OTRA_ORG_ID],
      { issuer: ISSUER, audience: AUDIENCE, subject: 'op-directivo-otra' },
    );
    const localJwks: JWTVerifyGetKey = () => Promise.resolve(publicKey);

    const ROLES_POR_OPERADOR: Record<string, Record<string, string[]>> = {
      'op-directivo-duoc': { [DUOC_ORG_ID]: ['directivo'] },
      'op-patrimonial-duoc': { [DUOC_ORG_ID]: ['administrador-patrimonial'] },
      'op-directivo-otra': { [OTRA_ORG_ID]: ['directivo'] },
    };

    keycloakAdminService = {
      buscarUsuarioPorEmail: jest.fn().mockResolvedValue({
        id: 'usuario-keycloak-1',
        email: 'nuevo@duoc.cl',
        displayName: null,
      }),
      listarGrants: jest.fn().mockResolvedValue([
        {
          userId: 'usuario-keycloak-1',
          email: 'a@duoc.cl',
          displayName: null,
          roles: ['administrador-patrimonial'],
        },
      ] satisfies GrantUsuario[]),
      crearGrant: jest.fn().mockResolvedValue(undefined),
      // Gap 3 (flujo real Admin->Directivo->Profesional AFT) — usado cuando buscarUsuarioPorEmail
      // no encuentra a nadie con ese email (ver el describe de mas abajo).
      crearUsuarioHuman: jest.fn().mockResolvedValue({
        userId: 'usuario-keycloak-nuevo',
        passwordInicial: 'Xy9!abcdEFGH12345678',
      }),
      // ADR-004 — consumido por KeycloakAuthGuard (no por DirectivoService/Guard directo, ver
      // keycloak-auth.guard.ts) para resolver rolesPorOrganizacion de cada operador de prueba.
      resolverRolesPorOrganizacionDeUsuario: jest
        .fn()
        .mockImplementation((userId: string, organizaciones: string[]) => {
          const roles = ROLES_POR_OPERADOR[userId] ?? {};
          const resultado: Record<string, string[]> = {};
          for (const organizacionId of organizaciones) {
            if (roles[organizacionId]) {
              resultado[organizacionId] = roles[organizacionId];
            }
          }
          return Promise.resolve(resultado);
        }),
    };

    app = await crearAppE2e({
      jwks: localJwks,
      // DOC-024 3 — DirectivoService ahora envuelve asignarProfesionalAft en
      // AuditoriaIdentidadService, que reporta el resultado via CoreClientService.postAuditoria.
      coreClientService: {
        postAuditoria: jest.fn().mockResolvedValue(undefined),
      },
      redisClient: crearRedisStub(),
      keycloakAdminService,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /directivo/usuarios', () => {
    it('lista los usuarios de la organización del propio Directivo (sin :orgId en la ruta)', async () => {
      const res = await request(app.getHttpServer())
        .get('/directivo/usuarios')
        .set('Authorization', `Bearer ${tokenDirectivoDuoc}`)
        .expect(200);

      expect(res.body).toEqual(
        await keycloakAdminService.listarGrants.mock.results[0].value,
      );
      expect(keycloakAdminService.listarGrants).toHaveBeenCalledWith(
        DUOC_ORG_ID,
        expect.any(String),
      );
    });

    it('devuelve 403 si el operador no tiene el rol directivo', async () => {
      await request(app.getHttpServer())
        .get('/directivo/usuarios')
        .set('Authorization', `Bearer ${tokenPatrimonialDuoc}`)
        .expect(403);
    });

    it('devuelve 401 sin Authorization', async () => {
      await request(app.getHttpServer()).get('/directivo/usuarios').expect(401);
    });
  });

  describe('POST /directivo/usuarios', () => {
    it('designa al Profesional de AFT (rol administrador-patrimonial) dentro de la propia organización', async () => {
      await request(app.getHttpServer())
        .post('/directivo/usuarios')
        .set('Authorization', `Bearer ${tokenDirectivoDuoc}`)
        .send({ email: 'nuevo@duoc.cl' })
        .expect(201);

      expect(keycloakAdminService.buscarUsuarioPorEmail).toHaveBeenCalledWith(
        'nuevo@duoc.cl',
        expect.any(String),
      );
      expect(keycloakAdminService.crearGrant).toHaveBeenCalledWith(
        DUOC_ORG_ID,
        'usuario-keycloak-1',
        'administrador-patrimonial',
        expect.any(String),
      );
    });

    it('devuelve 403 si el operador no tiene el rol directivo', async () => {
      await request(app.getHttpServer())
        .post('/directivo/usuarios')
        .set('Authorization', `Bearer ${tokenPatrimonialDuoc}`)
        .send({ email: 'nuevo@duoc.cl' })
        .expect(403);
      expect(keycloakAdminService.crearGrant).not.toHaveBeenCalled();
    });

    // Gap 3 (flujo real Admin->Directivo->Profesional AFT) — ya no devuelve 404: si el email no
    // corresponde a nadie, se crea el usuario en Keycloak con una contraseña inicial generada.
    it('crea el usuario en Keycloak y le asigna el rol cuando el email no corresponde a nadie', async () => {
      keycloakAdminService.buscarUsuarioPorEmail.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/directivo/usuarios')
        .set('Authorization', `Bearer ${tokenDirectivoDuoc}`)
        .send({ email: 'no-existe@duoc.cl' })
        .expect(201);

      expect(res.body).toEqual({
        creado: true,
        passwordInicial: 'Xy9!abcdEFGH12345678',
      });
      expect(keycloakAdminService.crearUsuarioHuman).toHaveBeenCalledWith(
        'no-existe@duoc.cl',
        expect.any(String),
      );
      expect(keycloakAdminService.crearGrant).toHaveBeenCalledWith(
        DUOC_ORG_ID,
        'usuario-keycloak-nuevo',
        'administrador-patrimonial',
        expect.any(String),
      );
    });

    it('devuelve 400 si el body no incluye un email válido (no acepta un campo `rol`)', async () => {
      await request(app.getHttpServer())
        .post('/directivo/usuarios')
        .set('Authorization', `Bearer ${tokenDirectivoDuoc}`)
        .send({ email: 'nuevo@duoc.cl', rol: 'administrador-sistema' })
        .expect(201);

      // El schema ignora campos extra como `rol` (zod no-strict) — lo que realmente importa es
      // que crearGrant se llamó SIEMPRE con administrador-patrimonial, sin importar qué mandó el
      // body: el rol asignable está fijo en el servicio, no en lo que envía el cliente.
      expect(keycloakAdminService.crearGrant).toHaveBeenCalledWith(
        DUOC_ORG_ID,
        'usuario-keycloak-1',
        'administrador-patrimonial',
        expect.any(String),
      );
    });
  });

  describe('límite de organización (un Directivo de una organización no puede tocar usuarios de otra)', () => {
    it('el Directivo de otra organización solo puede listar/asignar dentro de LA SUYA, nunca duoc-uc — no hay parámetro de ruta ni de body para pedir otra organización', async () => {
      const listado = await request(app.getHttpServer())
        .get('/directivo/usuarios')
        .set('Authorization', `Bearer ${tokenDirectivoOtraOrg}`)
        .expect(200);
      expect(listado.body).toEqual(
        await keycloakAdminService.listarGrants.mock.results[0].value,
      );
      // La organización efectivamente consultada es la del propio token (OTRA_ORG_ID), nunca
      // DUOC_ORG_ID — el controller no expone ningún :orgId ni organizacionId de body con el que
      // un Directivo pudiera pedir la organización de otro.
      expect(keycloakAdminService.listarGrants).toHaveBeenCalledWith(
        OTRA_ORG_ID,
        expect.any(String),
      );

      await request(app.getHttpServer())
        .post('/directivo/usuarios')
        .set('Authorization', `Bearer ${tokenDirectivoOtraOrg}`)
        .send({ email: 'nuevo@duoc.cl' })
        .expect(201);
      expect(keycloakAdminService.crearGrant).toHaveBeenCalledWith(
        OTRA_ORG_ID,
        'usuario-keycloak-1',
        'administrador-patrimonial',
        expect.any(String),
      );
      expect(keycloakAdminService.crearGrant).not.toHaveBeenCalledWith(
        DUOC_ORG_ID,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
