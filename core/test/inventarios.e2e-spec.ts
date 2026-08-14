import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import type { CatalogoPagina } from './../src/patrimonial/activo.types';
import type { PostInventarioResponse } from './../src/inventarios/inventarios.types';

const SERVICE_TOKEN = 'secreto-compartido-e2e'; // igual al default de jest-e2e.setup.ts

// Contra el seed real de base-patrimonial/DOC-005-modelo-patrimonial.md (migraciones
// 1755100000001/1755200000000): DUOC UC / Melipilla, notebook (QR-000001) + proyector
// (QR-000002), area-biblioteca / ubicacion-biblioteca-101.
function buildInventarioPayload(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    correlationId: 'corr-e2e-1',
    idempotencyKey: `idem-e2e-${randomUUID()}`,
    operadorId: 'op-e2e-1',
    organizacionId: 'duoc-uc',
    areaId: 'area-biblioteca',
    ubicacionId: 'ubicacion-biblioteca-101',
    fechaInicio: '2026-02-01T09:00:00.000Z',
    fechaCierre: '2026-02-01T09:30:00.000Z',
    escaneos: [
      { codigoQr: 'QR-000001', resultado: 'correcto' },
      { codigoQr: 'QR-NOPE', resultado: 'no_registrado' },
    ],
    incidencias: [],
    ...overrides,
  };
}

describe('CORE Fase 2 — GET /catalogo, POST /inventarios (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /catalogo', () => {
    it('devuelve los activos con area/ubicacion asignada de la organizacion', async () => {
      const res = await request(app.getHttpServer())
        .get('/catalogo')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({ organizacionId: 'duoc-uc' })
        .expect(200);

      const body = res.body as CatalogoPagina;
      expect(body.total).toBeGreaterThanOrEqual(2);
      const codigos = body.activos.map((a) => a.codigoQr);
      expect(codigos).toEqual(
        expect.arrayContaining(['QR-000001', 'QR-000002']),
      );
    });

    it('devuelve 401 sin service token', async () => {
      await request(app.getHttpServer())
        .get('/catalogo')
        .query({ organizacionId: 'duoc-uc' })
        .expect(401);
    });
  });

  describe('POST /inventarios + GET /inventarios/:id/estado', () => {
    it('clasifica los escaneos reales contra Postgres y persiste la sesion', async () => {
      const payload = buildInventarioPayload();

      const res = await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(payload)
        .expect(201);

      const body = res.body as PostInventarioResponse;
      expect(body.estado).toBe('recibido');
      expect(body.inventarioId).toEqual(expect.any(String));

      const estadoRes = await request(app.getHttpServer())
        .get(`/inventarios/${body.inventarioId}/estado`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);

      expect(estadoRes.body).toMatchObject({ estado: 'recibido' });
    });

    it('reintento con el mismo idempotencyKey y payload devuelve el mismo inventarioId', async () => {
      const payload = buildInventarioPayload();

      const primera = await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(payload)
        .expect(201);

      const segunda = await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(payload)
        .expect(201);

      expect(segunda.body).toEqual(primera.body);
    });

    it('mismo idempotencyKey con payload distinto devuelve 409', async () => {
      const idempotencyKey = `idem-e2e-conflict-${randomUUID()}`;
      await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildInventarioPayload({ idempotencyKey }))
        .expect(201);

      await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildInventarioPayload({
            idempotencyKey,
            escaneos: [{ codigoQr: 'QR-000002', resultado: 'correcto' }],
          }),
        )
        .expect(409);
    });

    it('organizacion inexistente devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildInventarioPayload({ organizacionId: 'no-existe' }))
        .expect(400);
    });

    it('GET estado de un inventarioId inexistente devuelve 404', async () => {
      await request(app.getHttpServer())
        .get('/inventarios/no-existe/estado')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(404);
    });

    it('devuelve 401 sin service token', async () => {
      await request(app.getHttpServer())
        .post('/inventarios')
        .send(buildInventarioPayload())
        .expect(401);
    });
  });

  describe('GET /inventarios (listado) + GET /inventarios/:id (detalle)', () => {
    it('lista la sesion recien creada por organizacion y trae su detalle con escaneos', async () => {
      const payload = buildInventarioPayload();
      const creada = await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(payload)
        .expect(201);
      const inventarioId = (creada.body as PostInventarioResponse).inventarioId;

      const listaRes = await request(app.getHttpServer())
        .get('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({ organizacionId: 'duoc-uc' })
        .expect(200);

      const sesiones = listaRes.body as Array<{ id: string; estado: string }>;
      expect(sesiones.some((s) => s.id === inventarioId)).toBe(true);

      const detalleRes = await request(app.getHttpServer())
        .get(`/inventarios/${inventarioId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);

      const detalle = detalleRes.body as {
        id: string;
        estado: string;
        escaneos: Array<{ codigoQr: string; resultado: string }>;
      };
      expect(detalle.id).toBe(inventarioId);
      expect(detalle.estado).toBe('recibido');
      expect(detalle.escaneos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigoQr: 'QR-000001',
            resultado: 'correcto',
          }),
          expect.objectContaining({
            codigoQr: 'QR-NOPE',
            resultado: 'no_registrado',
          }),
        ]),
      );
    });

    it('GET /inventarios/:id de un id inexistente devuelve 404', async () => {
      await request(app.getHttpServer())
        .get('/inventarios/no-existe')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(404);
    });

    it('devuelve 401 sin service token', async () => {
      await request(app.getHttpServer())
        .get('/inventarios')
        .query({ organizacionId: 'duoc-uc' })
        .expect(401);
    });
  });

  describe('GET /auditoria', () => {
    it('incluye la entrada registrada por el Orquestador al procesar un inventario', async () => {
      const payload = buildInventarioPayload();
      await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(payload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/auditoria')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);

      const entradas = res.body as Array<{
        usuario: string;
        operacion: string;
        resultado: string;
      }>;
      expect(entradas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            usuario: 'op-e2e-1',
            operacion: 'POST /inventarios',
            resultado: 'recibido',
          }),
        ]),
      );
    });

    it('filtra por usuario (ILIKE parcial) contra Postgres real', async () => {
      const payload = buildInventarioPayload({
        operadorId: 'op-e2e-filtro-usuario',
        idempotencyKey: `idem-e2e-${randomUUID()}`,
      });
      await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(payload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/auditoria')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({ usuario: 'filtro-usuario' })
        .expect(200);

      const entradas = res.body as Array<{ usuario: string }>;
      expect(entradas.length).toBeGreaterThan(0);
      expect(
        entradas.every((e) => e.usuario.includes('filtro-usuario')),
      ).toBe(true);
    });

    it('filtra por rango de fecha excluyendo entradas fuera de rango', async () => {
      const payload = buildInventarioPayload({
        operadorId: 'op-e2e-filtro-fecha',
        idempotencyKey: `idem-e2e-${randomUUID()}`,
      });
      await request(app.getHttpServer())
        .post('/inventarios')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(payload)
        .expect(201);

      const enElFuturo = await request(app.getHttpServer())
        .get('/auditoria')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({
          usuario: 'filtro-fecha',
          fechaDesde: '2099-01-01T00:00:00.000Z',
        })
        .expect(200);
      expect(enElFuturo.body).toEqual([]);

      const ahora = await request(app.getHttpServer())
        .get('/auditoria')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({
          usuario: 'filtro-fecha',
          fechaDesde: '2020-01-01T00:00:00.000Z',
        })
        .expect(200);
      expect((ahora.body as unknown[]).length).toBeGreaterThan(0);
    });

    it('devuelve 401 sin service token', async () => {
      await request(app.getHttpServer()).get('/auditoria').expect(401);
    });
  });
});
