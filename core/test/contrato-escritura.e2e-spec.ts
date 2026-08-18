import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import type { Contrato } from './../src/entitlements/contrato.types';
import {
  ADMIN_ROLES_DUOC_UC,
  crearAppE2e,
  SERVICE_TOKEN,
} from './support/e2e-app';

// Contra el seed real de base-patrimonial/DOC-004-modelo-contrato.md: DUOC UC ya tiene un
// contrato vigente cubriendo 'melipilla' (migracion 1755000000001_seed-dev-fixture.ts) — por eso
// estos tests usan una sede/organizacion nueva para no chocar con el invariante DOC-004 4.
function buildAltaBody(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: `corr-e2e-${randomUUID()}`,
    operadorId: 'op-admin-e2e',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    sedeIds: ['melipilla'],
    vigenciaDesde: '2026-01-01T00:00:00.000Z',
    modulosContratados: ['inventario-qr'],
    ...overrides,
  };
}

function buildActualizarBody(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: `corr-e2e-${randomUUID()}`,
    operadorId: 'op-admin-e2e',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    estado: 'suspendido',
    ...overrides,
  };
}

describe('DOC-012 7 — escritura oficial de Contrato (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await crearAppE2e();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /contratos (lectura, paginado — RNF-01)', () => {
    it('devuelve la pagina de contratos contra Postgres real con el total, sin exigir el rol de escritura', async () => {
      const res = await request(app.getHttpServer())
        .get('/contratos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);

      const pagina = res.body as { contratos: Contrato[]; total: number };
      expect(
        pagina.contratos.some((c) => c.id === 'contrato-duoc-uc-melipilla'),
      ).toBe(true);
      expect(pagina.total).toBeGreaterThanOrEqual(1);
    });

    it('respeta limit/offset', async () => {
      const res = await request(app.getHttpServer())
        .get('/contratos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({ limit: 1, offset: 0 })
        .expect(200);

      const pagina = res.body as { contratos: Contrato[]; total: number };
      expect(pagina.contratos.length).toBe(1);
    });

    it('devuelve 401 sin service token', async () => {
      await request(app.getHttpServer()).get('/contratos').expect(401);
    });
  });

  describe('POST /contratos (alta)', () => {
    it('devuelve 409 (DOC-004 4) porque melipilla ya esta cubierta por el contrato vigente del seed', async () => {
      // Prueba el invariante en el camino de escritura: 'melipilla' ya tiene un contrato vigente
      // (seed de Fase 0), así que un alta nueva sobre la misma sede debe rechazarse, nunca
      // duplicar cobertura silenciosamente.
      await request(app.getHttpServer())
        .post('/contratos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaBody())
        .expect(409);
    });

    it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial (queda auditado)', async () => {
      await request(app.getHttpServer())
        .post('/contratos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaBody({ rolesPorOrganizacion: { 'duoc-uc': ['operador'] } }),
        )
        .expect(403);
    });

    it('devuelve 403 si el operador tiene el rol pero en otra organizacion', async () => {
      await request(app.getHttpServer())
        .post('/contratos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaBody({
            rolesPorOrganizacion: {
              'otra-organizacion': ['administrador-patrimonial'],
            },
          }),
        )
        .expect(403);
    });

    it('devuelve 401 sin service token', async () => {
      await request(app.getHttpServer())
        .post('/contratos')
        .send(buildAltaBody())
        .expect(401);
    });

    it('devuelve 400 si alguna sedeId no existe (foreign key)', async () => {
      await request(app.getHttpServer())
        .post('/contratos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaBody({ sedeIds: ['no-existe'] }))
        .expect(400);
    });
  });

  describe('PATCH /contratos/:id', () => {
    it('transiciona vigente -> suspendido contra Postgres real', async () => {
      const res = await request(app.getHttpServer())
        .patch('/contratos/contrato-duoc-uc-melipilla')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildActualizarBody())
        .expect(200);

      const contrato = res.body as Contrato;
      expect(contrato.estado).toBe('suspendido');

      // Revertir para no dejar el seed mutado para otros specs que corran contra la misma base.
      await request(app.getHttpServer())
        .patch('/contratos/contrato-duoc-uc-melipilla')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildActualizarBody({ estado: 'vigente' }))
        .expect(200);
    });

    it('devuelve 400 si la transicion no es valida (vigente -> vigente)', async () => {
      await request(app.getHttpServer())
        .patch('/contratos/contrato-duoc-uc-melipilla')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildActualizarBody({ estado: 'vigente' }))
        .expect(400);
    });

    it('devuelve 404 si el contrato no existe', async () => {
      await request(app.getHttpServer())
        .patch('/contratos/no-existe')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildActualizarBody())
        .expect(404);
    });

    it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial', async () => {
      await request(app.getHttpServer())
        .patch('/contratos/contrato-duoc-uc-melipilla')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildActualizarBody({ rolesPorOrganizacion: {} }))
        .expect(403);
    });

    // Hallazgo de revision de seguridad (mismo patron que ActivoRepository): el rol en OTRA
    // organizacion nunca debe alcanzar para modificar un contrato real de 'duoc-uc'.
    it('devuelve 404 (no 403) si el operador tiene el rol pero en otra organizacion', async () => {
      await request(app.getHttpServer())
        .patch('/contratos/contrato-duoc-uc-melipilla')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildActualizarBody({
            organizacionId: 'otra-organizacion',
            rolesPorOrganizacion: {
              'otra-organizacion': ['administrador-patrimonial'],
            },
          }),
        )
        .expect(404);
    });
  });
});
