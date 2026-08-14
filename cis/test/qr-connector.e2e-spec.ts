import {
  BadGatewayException,
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SignJWT, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import {
  AuthSessionResponse,
  CatalogoResponse,
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './../src/qr-connector/qr-connector.types';
import { crearAppE2e } from './support/e2e-app';
import { crearRedisStub, type RedisStub } from './support/redis-stub';

const ISSUER = 'http://id.sicsaft.localhost';
const AUDIENCE = 'cis-api';

const ENTITLEMENTS_STUB = {
  organizaciones: [
    {
      id: 'duoc-uc',
      nombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    },
  ],
};

const CATALOGO_STUB = {
  activos: [
    {
      codigoQr: 'QR-0001',
      nombre: 'Notebook Dell Latitude',
      organizacionId: 'duoc-uc',
      areaId: 'laboratorio-informatica',
      ubicacionId: 'melipilla',
      estado: 'activo',
    },
  ],
  total: 1,
};

describe('Conector QR (e2e) — DOC-002 + auth Zitadel (ADR-002) + entitlements de CORE', () => {
  let app: INestApplication<App>;
  let bearerToken: string;
  let coreClientService: {
    getEntitlements: jest.Mock;
    getCatalogo: jest.Mock;
    postInventario: jest.Mock;
    getInventarioEstado: jest.Mock;
    getInventarios: jest.Mock;
    getInventarioDetalle: jest.Mock;
  };
  let redisClient: RedisStub;

  beforeAll(() => {
    process.env.ZITADEL_ISSUER = ISSUER;
    process.env.ZITADEL_AUDIENCE = AUDIENCE;
  });

  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    bearerToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('op-1')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('15m')
      .sign(privateKey);

    // Se reemplaza el JWKS remoto (createRemoteJWKSet contra un Zitadel real, ver
    // zitadel-auth.module.ts) por la llave publica local — el e2e prueba el guard de punta a
    // punta vía HTTP real sin depender de que haya un Zitadel corriendo.
    const localJwks: JWTVerifyGetKey = () => Promise.resolve(publicKey);

    // Idem para CORE: se reemplaza el cliente HTTP real por un stub — el e2e prueba
    // QrConnectorController + guard + servicio de punta a punta vía HTTP real, sin depender de
    // que haya un CORE corriendo (CoreClientService ya tiene su propia cobertura unitaria contra
    // HttpService mockeado, ver core-client.service.spec.ts). QrConnectorService es un proxy
    // delgado desde Fase 3 — este stub simula lo que CORE ya resuelve (idempotencia, validación
    // de organización), no lo reimplementa.
    coreClientService = {
      getEntitlements: jest.fn().mockResolvedValue(ENTITLEMENTS_STUB),
      getCatalogo: jest.fn().mockResolvedValue(CATALOGO_STUB),
      postInventario: jest
        .fn()
        .mockImplementation((body: { organizacionId: string }) => {
          if (body.organizacionId === 'no-existe') {
            return Promise.reject(
              new BadRequestException({
                message: 'Rechazado: organización inexistente',
                errores: [
                  {
                    campo: 'organizacionId',
                    detalle: "No existe la organización 'no-existe'",
                  },
                ],
              }),
            );
          }
          return Promise.resolve({
            inventarioId: 'inv-e2e-1',
            estado: 'recibido',
          });
        }),
      getInventarios: jest.fn().mockResolvedValue([
        {
          id: 'sesion-e2e-1',
          organizacionId: 'duoc-uc',
          areaId: 'laboratorio-informatica',
          ubicacionId: 'melipilla',
          operadorId: 'op-1',
          fechaInicio: '2026-08-12T10:00:00.000Z',
          fechaCierre: '2026-08-12T11:00:00.000Z',
          estado: 'recibido',
          creadoEn: '2026-08-12T11:00:05.000Z',
        },
      ]),
      getInventarioDetalle: jest.fn().mockImplementation((id: string) => {
        if (id === 'sesion-e2e-1') {
          return Promise.resolve({
            id: 'sesion-e2e-1',
            organizacionId: 'duoc-uc',
            areaId: 'laboratorio-informatica',
            ubicacionId: 'melipilla',
            operadorId: 'op-1',
            fechaInicio: '2026-08-12T10:00:00.000Z',
            fechaCierre: '2026-08-12T11:00:00.000Z',
            estado: 'recibido',
            creadoEn: '2026-08-12T11:00:05.000Z',
            escaneos: [
              {
                codigoQr: 'QR-0001',
                resultado: 'correcto',
                observaciones: null,
              },
            ],
          });
        }
        return Promise.reject(
          new NotFoundException({
            message: `No existe el inventario '${id}'`,
          }),
        );
      }),
      getInventarioEstado: jest.fn().mockImplementation((id: string) => {
        if (id === 'inv-e2e-1') {
          return Promise.resolve({
            estado: 'recibido',
            ultimoIntento: '2026-08-12T10:00:00.000Z',
          });
        }
        return Promise.reject(
          new NotFoundException({
            message: `No existe el inventario '${id}'`,
          }),
        );
      }),
    };

    // Idem para Redis (RateLimitGuard, WAF §4): se reemplaza el cliente real por un stub que por
    // defecto siempre permite (count=1) — no hace falta un Redis real para probar el resto del
    // conector. El test dedicado de 429 más abajo simula el conteo por encima del límite.
    redisClient = crearRedisStub();

    app = await crearAppE2e({
      jwks: localJwks,
      coreClientService,
      redisClient,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /auth/session sin Authorization devuelve 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/session')
      .send({ deviceId: 'd-1' })
      .expect(401);
  });

  it('POST /auth/session con token Zitadel valido devuelve el mismo token y las organizaciones de CORE', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/session')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({ deviceId: 'd-1' })
      .expect(201);

    const body = res.body as AuthSessionResponse;
    expect(body.accessToken).toBe(bearerToken);
    expect(body.organizaciones).toEqual(ENTITLEMENTS_STUB.organizaciones);
    // El correlationId lo genera CorrelationIdMiddleware (no llega ninguno en la request) —
    // se verifica que CoreClientService reciba el mismo valor que la response expuso.
    expect(res.headers['x-correlation-id']).toEqual(expect.any(String));
    expect(coreClientService.getEntitlements).toHaveBeenCalledWith(
      'op-1',
      res.headers['x-correlation-id'],
    );
  });

  it('POST /auth/session registra el deviceId como dispositivo activo del operador (DOC-002 §1)', async () => {
    await request(app.getHttpServer())
      .post('/auth/session')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({ deviceId: 'device-e2e' })
      .expect(201);

    expect(redisClient.set).toHaveBeenCalledWith(
      'device:operador:op-1',
      'device-e2e',
      'PX',
      expect.any(Number),
    );
  });

  it('POST /auth/session devuelve 502 si CORE no responde', async () => {
    coreClientService.getEntitlements.mockRejectedValue(
      new BadGatewayException({
        message: 'No se pudo resolver entitlements contra CORE',
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/session')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({ deviceId: 'd-1' })
      .expect(502);
  });

  it('POST /auth/session con payload invalido devuelve 400 con errores', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/session')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({})
      .expect(400);

    const body = res.body as { errores: unknown[] };
    expect(body.errores.length).toBeGreaterThan(0);
  });

  it('GET /catalogo sin Authorization devuelve 401', async () => {
    await request(app.getHttpServer())
      .get('/catalogo')
      .query({ organizacionId: 'duoc-uc' })
      .expect(401);
  });

  it('GET /catalogo filtra por organizacionId con token valido', async () => {
    const res = await request(app.getHttpServer())
      .get('/catalogo')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(200);

    const body = res.body as CatalogoResponse;
    expect(body.activos.length).toBeGreaterThan(0);
  });

  it('flujo completo: POST /inventarios y luego GET estado', async () => {
    const inventarioReq = {
      correlationId: 'corr-e2e',
      idempotencyKey: 'idem-e2e',
      operadorId: 'op-1',
      organizacionId: 'duoc-uc',
      areaId: 'laboratorio-informatica',
      ubicacionId: 'melipilla',
      fechaInicio: '2026-08-12T10:00:00.000Z',
      fechaCierre: '2026-08-12T11:00:00.000Z',
      escaneos: [{ codigoQr: 'QR-0001', resultado: 'correcto' }],
      incidencias: [],
    };

    const postRes = await request(app.getHttpServer())
      .post('/inventarios')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(inventarioReq)
      .expect(201);

    const postBody = postRes.body as PostInventarioResponse;
    expect(postBody.estado).toBe('recibido');

    const estadoRes = await request(app.getHttpServer())
      .get(`/inventarios/${postBody.inventarioId}/estado`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .expect(200);

    const estadoBody = estadoRes.body as InventarioEstadoResponse;
    expect(estadoBody.estado).toBe('recibido');
  });

  it('POST /inventarios con organizacion inexistente devuelve 400', async () => {
    await request(app.getHttpServer())
      .post('/inventarios')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send({
        correlationId: 'c',
        idempotencyKey: 'k-invalida',
        operadorId: 'op-1',
        organizacionId: 'no-existe',
        areaId: 'a',
        ubicacionId: 'u',
        fechaInicio: 'x',
        fechaCierre: 'y',
        escaneos: [],
        incidencias: [],
      })
      .expect(400);
  });

  it('GET /inventarios/:id/estado con id inexistente devuelve 404', async () => {
    await request(app.getHttpServer())
      .get('/inventarios/no-existe/estado')
      .set('Authorization', `Bearer ${bearerToken}`)
      .expect(404);
  });

  it('GET /inventarios/:id/estado con token invalido devuelve 401', async () => {
    await request(app.getHttpServer())
      .get('/inventarios/no-existe/estado')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('GET /inventarios (listado) devuelve las sesiones de la organizacion', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventarios')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(200);

    const sesiones = res.body as Array<{ id: string }>;
    expect(sesiones.some((s) => s.id === 'sesion-e2e-1')).toBe(true);
  });

  it('GET /inventarios sin Authorization devuelve 401', async () => {
    await request(app.getHttpServer())
      .get('/inventarios')
      .query({ organizacionId: 'duoc-uc' })
      .expect(401);
  });

  it('GET /inventarios/:id (detalle) devuelve la sesion con sus escaneos', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventarios/sesion-e2e-1')
      .set('Authorization', `Bearer ${bearerToken}`)
      .expect(200);

    const detalle = res.body as { id: string; escaneos: unknown[] };
    expect(detalle.id).toBe('sesion-e2e-1');
    expect(detalle.escaneos).toHaveLength(1);
  });

  it('GET /inventarios/:id con id inexistente devuelve 404', async () => {
    await request(app.getHttpServer())
      .get('/inventarios/no-existe')
      .set('Authorization', `Bearer ${bearerToken}`)
      .expect(404);
  });

  it('devuelve 429 cuando el operador supera el limite de requests (RateLimitGuard, WAF §4)', async () => {
    // El stub de Redis simula que este operador ya superó el límite de la ventana actual.
    redisClient.eval.mockResolvedValue(31);
    redisClient.pttl.mockResolvedValue(4_000);

    const res = await request(app.getHttpServer())
      .get('/catalogo')
      .set('Authorization', `Bearer ${bearerToken}`)
      .query({ organizacionId: 'duoc-uc' })
      .expect(429);

    const body = res.body as { retryAfterMs: number };
    expect(body.retryAfterMs).toBe(4_000);
  });
});
