import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import type { Activo } from './../src/patrimonial/activo.types';
import {
  ADMIN_ROLES_DUOC_UC,
  crearAppE2e,
  SERVICE_TOKEN,
} from './support/e2e-app';

// Contra el seed real de base-patrimonial/DOC-005-modelo-patrimonial.md: DUOC UC / Melipilla,
// catalogo-notebook ya existe (migracion 1755100000001_seed-dev-fixture-patrimonial.ts).
function buildAltaBody(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: `corr-e2e-${randomUUID()}`,
    operadorId: 'op-admin-e2e',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    codigoPatrimonial: `AFT-E2E-${randomUUID()}`,
    codigoQr: `QR-E2E-${randomUUID()}`,
    catalogoId: 'catalogo-notebook',
    ...overrides,
  };
}

function buildEscrituraOficialBody(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: `corr-e2e-${randomUUID()}`,
    operadorId: 'op-admin-e2e',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    ...overrides,
  };
}

describe('DOC-012 §5 — escritura oficial de Activo (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await crearAppE2e();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /activos (alta)', () => {
    it('crea el activo contra Postgres real cuando el operador tiene el rol en esa organizacion', async () => {
      const res = await request(app.getHttpServer())
        .post('/activos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaBody())
        .expect(201);

      const activo = res.body as Activo;
      expect(activo).toMatchObject({ estado: 'activo' });
      expect(activo.id).toEqual(expect.any(String));
    });

    it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial (queda auditado, no solo rechazado)', async () => {
      await request(app.getHttpServer())
        .post('/activos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaBody({ rolesPorOrganizacion: { 'duoc-uc': ['operador'] } }),
        )
        .expect(403);
    });

    // Hallazgo de revision de seguridad: el rol en OTRA organizacion nunca debe alcanzar para
    // escribir en 'duoc-uc'.
    it('devuelve 403 si el operador tiene el rol pero en otra organizacion', async () => {
      await request(app.getHttpServer())
        .post('/activos')
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
        .post('/activos')
        .send(buildAltaBody())
        .expect(401);
    });

    it('devuelve 409 si codigoPatrimonial/codigoQr ya existe', async () => {
      const body = buildAltaBody();
      await request(app.getHttpServer())
        .post('/activos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(body)
        .expect(201);

      await request(app.getHttpServer())
        .post('/activos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send({ ...body, correlationId: `corr-e2e-${randomUUID()}` })
        .expect(409);
    });

    it('devuelve 400 si catalogoId no existe', async () => {
      await request(app.getHttpServer())
        .post('/activos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaBody({ catalogoId: 'no-existe' }))
        .expect(400);
    });
  });

  describe('POST /activos/:id/baja + POST /activos/:id/reincorporacion', () => {
    async function crearActivo(): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/activos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaBody())
        .expect(201);
      return (res.body as Activo).id;
    }

    it('da de baja un activo activo y lo deja en dado_de_baja', async () => {
      const activoId = await crearActivo();

      const res = await request(app.getHttpServer())
        .post(`/activos/${activoId}/baja`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildEscrituraOficialBody())
        .expect(200);

      expect((res.body as Activo).estado).toBe('dado_de_baja');
    });

    it('devuelve 400 al reincorporar un activo que no esta extraviado', async () => {
      const activoId = await crearActivo();

      await request(app.getHttpServer())
        .post(`/activos/${activoId}/reincorporacion`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildEscrituraOficialBody())
        .expect(400);
    });

    it('devuelve 404 si el activo no existe', async () => {
      await request(app.getHttpServer())
        .post('/activos/no-existe/baja')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildEscrituraOficialBody())
        .expect(404);
    });

    it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial', async () => {
      const activoId = await crearActivo();

      await request(app.getHttpServer())
        .post(`/activos/${activoId}/baja`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildEscrituraOficialBody({ rolesPorOrganizacion: {} }))
        .expect(403);
    });

    // Hallazgo de revision de seguridad: sin este chequeo, un administrador-patrimonial con rol
    // valido en OTRA organizacion podia dar de baja un activo real de 'duoc-uc' con solo conocer
    // su id — acá se prueba contra Postgres real, no solo mockeado.
    it('devuelve 404 (no 403) si el operador tiene el rol pero en otra organizacion — no confirma que el activo exista', async () => {
      const activoId = await crearActivo();

      await request(app.getHttpServer())
        .post(`/activos/${activoId}/baja`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            organizacionId: 'otra-organizacion',
            rolesPorOrganizacion: {
              'otra-organizacion': ['administrador-patrimonial'],
            },
          }),
        )
        .expect(404);
    });
  });

  describe('PATCH /activos/:id/responsable', () => {
    it('devuelve 400 si responsableId no existe (foreign key)', async () => {
      const res = await request(app.getHttpServer())
        .post('/activos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaBody())
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/activos/${(res.body as Activo).id}/responsable`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildEscrituraOficialBody({ responsableId: 'no-existe' }))
        .expect(400);
    });

    it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial', async () => {
      const res = await request(app.getHttpServer())
        .post('/activos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaBody())
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/activos/${(res.body as Activo).id}/responsable`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            rolesPorOrganizacion: { 'duoc-uc': ['operador'] },
            responsableId: 'no-importa',
          }),
        )
        .expect(403);
    });
  });
});
