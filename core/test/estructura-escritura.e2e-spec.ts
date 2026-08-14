import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import type { Area } from './../src/estructura/area.types';
import type { Ubicacion } from './../src/estructura/ubicacion.types';
import type { Responsable } from './../src/estructura/responsable.types';

const SERVICE_TOKEN = 'secreto-compartido-e2e'; // igual al default de jest-e2e.setup.ts
const ADMIN_ROLES_DUOC_UC = { 'duoc-uc': ['administrador-patrimonial'] };

// Contra el seed real de base-patrimonial/DOC-005-modelo-patrimonial.md (migracion
// 1755100000001): DUOC UC / Melipilla ('melipilla'), area-biblioteca, ubicacion-biblioteca-101,
// responsable-jperez.
function buildAltaAreaBody(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: `corr-e2e-${randomUUID()}`,
    operadorId: 'op-admin-e2e',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    codigo: `AREA-E2E-${randomUUID()}`,
    nombre: 'Area E2E',
    ...overrides,
  };
}

function buildAltaUbicacionBody(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: `corr-e2e-${randomUUID()}`,
    operadorId: 'op-admin-e2e',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    sedeId: 'melipilla',
    ...overrides,
  };
}

function buildAltaResponsableBody(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: `corr-e2e-${randomUUID()}`,
    operadorId: 'op-admin-e2e',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    identificacion: `RUT-E2E-${randomUUID()}`,
    nombre: 'Responsable E2E',
    areaId: 'area-biblioteca',
    ...overrides,
  };
}

describe('RF-05 — escritura oficial de Area/Ubicacion/Responsable (e2e)', () => {
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

  describe('POST /areas + GET /areas', () => {
    it('crea el area contra Postgres real y aparece en el listado por organizacion', async () => {
      const res = await request(app.getHttpServer())
        .post('/areas')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaAreaBody())
        .expect(201);

      const area = res.body as Area;
      expect(area.organizacionId).toBe('duoc-uc');
      expect(area.id).toEqual(expect.any(String));

      const listaRes = await request(app.getHttpServer())
        .get('/areas')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({ organizacionId: 'duoc-uc' })
        .expect(200);

      expect((listaRes.body as Area[]).some((a) => a.id === area.id)).toBe(
        true,
      );
    });

    it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial', async () => {
      await request(app.getHttpServer())
        .post('/areas')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaAreaBody({ rolesPorOrganizacion: {} }))
        .expect(403);
    });

    it('devuelve 400 si organizacionId no existe', async () => {
      await request(app.getHttpServer())
        .post('/areas')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaAreaBody({
            organizacionId: 'no-existe',
            rolesPorOrganizacion: { 'no-existe': ['administrador-patrimonial'] },
          }),
        )
        .expect(400);
    });

    it('devuelve 401 sin service token', async () => {
      await request(app.getHttpServer())
        .get('/areas')
        .query({ organizacionId: 'duoc-uc' })
        .expect(401);
    });
  });

  describe('POST /ubicaciones + GET /ubicaciones', () => {
    it('crea la ubicacion contra Postgres real y aparece en el listado por sede', async () => {
      const res = await request(app.getHttpServer())
        .post('/ubicaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaUbicacionBody())
        .expect(201);

      const ubicacion = res.body as Ubicacion;
      expect(ubicacion.sedeId).toBe('melipilla');

      const listaRes = await request(app.getHttpServer())
        .get('/ubicaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({ sedeId: 'melipilla' })
        .expect(200);

      expect(
        (listaRes.body as Ubicacion[]).some((u) => u.id === ubicacion.id),
      ).toBe(true);
    });

    // Hallazgo de revision de seguridad (mismo patron que ActivoRepository): una sede real de
    // OTRA organizacion no debe alcanzar solo porque el operador tiene el rol en 'duoc-uc'.
    it('devuelve 400 si sedeId no pertenece a organizacionId', async () => {
      await request(app.getHttpServer())
        .post('/ubicaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaUbicacionBody({
            organizacionId: 'otra-organizacion',
            rolesPorOrganizacion: {
              'otra-organizacion': ['administrador-patrimonial'],
            },
            sedeId: 'melipilla',
          }),
        )
        .expect(400);
    });

    it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial', async () => {
      await request(app.getHttpServer())
        .post('/ubicaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaUbicacionBody({ rolesPorOrganizacion: {} }))
        .expect(403);
    });
  });

  describe('POST /responsables + GET /responsables + PATCH /responsables/:id/estado', () => {
    it('crea el responsable contra Postgres real, aparece en el listado y su estado se puede actualizar', async () => {
      const res = await request(app.getHttpServer())
        .post('/responsables')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaResponsableBody())
        .expect(201);

      const responsable = res.body as Responsable;
      expect(responsable.estado).toBe('activo');

      const listaRes = await request(app.getHttpServer())
        .get('/responsables')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({ areaId: 'area-biblioteca' })
        .expect(200);
      expect(
        (listaRes.body as Responsable[]).some((r) => r.id === responsable.id),
      ).toBe(true);

      const patchRes = await request(app.getHttpServer())
        .patch(`/responsables/${responsable.id}/estado`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaResponsableBody({
            correlationId: `corr-e2e-${randomUUID()}`,
            estado: 'inactivo',
          }),
        )
        .expect(200);
      expect((patchRes.body as Responsable).estado).toBe('inactivo');
    });

    it('devuelve 409 si identificacion ya existe', async () => {
      const body = buildAltaResponsableBody();
      await request(app.getHttpServer())
        .post('/responsables')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(body)
        .expect(201);

      await request(app.getHttpServer())
        .post('/responsables')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send({ ...body, correlationId: `corr-e2e-${randomUUID()}` })
        .expect(409);
    });

    it('devuelve 400 si areaId no pertenece a organizacionId', async () => {
      await request(app.getHttpServer())
        .post('/responsables')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaResponsableBody({
            organizacionId: 'otra-organizacion',
            rolesPorOrganizacion: {
              'otra-organizacion': ['administrador-patrimonial'],
            },
          }),
        )
        .expect(400);
    });

    it('devuelve 404 al actualizar el estado de un responsable inexistente', async () => {
      await request(app.getHttpServer())
        .patch('/responsables/no-existe/estado')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaResponsableBody({ estado: 'inactivo' }))
        .expect(404);
    });
  });
});
