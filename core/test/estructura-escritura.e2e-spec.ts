import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import type { Area } from './../src/estructura/area.types';
import type { Ubicacion } from './../src/estructura/ubicacion.types';
import type { Responsable } from './../src/estructura/responsable.types';
import {
  ADMIN_ROLES_DUOC_UC,
  crearAppE2e,
  SERVICE_TOKEN,
} from './support/e2e-app';

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
    app = await crearAppE2e();
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

      // limit alto: corridas repetidas de este e2e contra el mismo Postgres local acumulan filas
      // (sin reset entre corridas) — sin esto, la recien creada podria caer fuera de la pagina
      // default (20) si ya hay 20+ areas previas de otras corridas.
      const listaRes = await request(app.getHttpServer())
        .get('/areas')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .query({ organizacionId: 'duoc-uc', limit: 100 })
        .expect(200);

      const pagina = listaRes.body as { areas: Area[]; total: number };
      expect(pagina.areas.some((a) => a.id === area.id)).toBe(true);
      expect(pagina.total).toBeGreaterThanOrEqual(1);
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
            rolesPorOrganizacion: {
              'no-existe': ['administrador-patrimonial'],
            },
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

  describe('PATCH /areas/:id (cierra RF-05)', () => {
    async function crearArea(): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/areas')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaAreaBody())
        .expect(201);
      return (res.body as Area).id;
    }

    it('actualiza nombre/dependencia/centroCosto contra Postgres real', async () => {
      const areaId = await crearArea();

      const res = await request(app.getHttpServer())
        .patch(`/areas/${areaId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaAreaBody({
            nombre: 'Biblioteca Central',
            dependencia: 'Rectoria',
            centroCosto: 'CC-100',
          }),
        )
        .expect(200);

      const area = res.body as Area;
      expect(area.nombre).toBe('Biblioteca Central');
      expect(area.dependencia).toBe('Rectoria');
      expect(area.centroCosto).toBe('CC-100');
    });

    it('asigna responsableId y ubicacionPrincipalId (cierra el ciclo que DOC-005 §2 dejaba abierto)', async () => {
      const areaId = await crearArea();
      const resResponsable = await request(app.getHttpServer())
        .post('/responsables')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaResponsableBody())
        .expect(201);
      const resUbicacion = await request(app.getHttpServer())
        .post('/ubicaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaUbicacionBody())
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/areas/${areaId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaAreaBody({
            responsableId: (resResponsable.body as Responsable).id,
            ubicacionPrincipalId: (resUbicacion.body as Ubicacion).id,
          }),
        )
        .expect(200);

      const area = res.body as Area;
      expect(area.responsableId).toBe((resResponsable.body as Responsable).id);
      expect(area.ubicacionPrincipalId).toBe(
        (resUbicacion.body as Ubicacion).id,
      );
    });

    it('devuelve 404 si el area no existe', async () => {
      await request(app.getHttpServer())
        .patch('/areas/no-existe')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaAreaBody({ nombre: 'X' }))
        .expect(404);
    });

    it('devuelve 404 (no 403) si el operador tiene el rol pero en otra organizacion', async () => {
      const areaId = await crearArea();

      await request(app.getHttpServer())
        .patch(`/areas/${areaId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaAreaBody({
            organizacionId: 'otra-organizacion',
            rolesPorOrganizacion: {
              'otra-organizacion': ['administrador-patrimonial'],
            },
            nombre: 'X',
          }),
        )
        .expect(404);
    });

    it('devuelve 400 si responsableId es de otra organizacion', async () => {
      const areaId = await crearArea();

      await request(app.getHttpServer())
        .patch(`/areas/${areaId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaAreaBody({ responsableId: 'no-existe' }))
        .expect(400);
    });

    it('devuelve 400 si el body no trae ningun campo a actualizar', async () => {
      const areaId = await crearArea();

      await request(app.getHttpServer())
        .patch(`/areas/${areaId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send({
          correlationId: `corr-e2e-${randomUUID()}`,
          operadorId: 'op-admin-e2e',
          organizacionId: 'duoc-uc',
          rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
        })
        .expect(400);
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
        .query({ sedeId: 'melipilla', limit: 100 })
        .expect(200);

      const pagina = listaRes.body as {
        ubicaciones: Ubicacion[];
        total: number;
      };
      expect(pagina.ubicaciones.some((u) => u.id === ubicacion.id)).toBe(true);
      expect(pagina.total).toBeGreaterThanOrEqual(1);
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

  describe('PATCH /ubicaciones/:id (cierra RF-05)', () => {
    async function crearUbicacion(): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/ubicaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaUbicacionBody())
        .expect(201);
      return (res.body as Ubicacion).id;
    }

    it('actualiza edificio/piso/oficina/dependencia/areaId contra Postgres real', async () => {
      const ubicacionId = await crearUbicacion();

      const res = await request(app.getHttpServer())
        .patch(`/ubicaciones/${ubicacionId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaUbicacionBody({
            edificio: 'Torre A',
            piso: '2',
            oficina: '201',
            dependencia: 'Biblioteca',
            areaId: 'area-biblioteca',
          }),
        )
        .expect(200);

      const ubicacion = res.body as Ubicacion;
      expect(ubicacion.edificio).toBe('Torre A');
      expect(ubicacion.piso).toBe('2');
      expect(ubicacion.oficina).toBe('201');
      expect(ubicacion.dependencia).toBe('Biblioteca');
      expect(ubicacion.areaId).toBe('area-biblioteca');
    });

    it('devuelve 404 si la ubicacion no existe', async () => {
      await request(app.getHttpServer())
        .patch('/ubicaciones/no-existe')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaUbicacionBody({ edificio: 'X' }))
        .expect(404);
    });

    it('devuelve 404 (no 403) si el operador tiene el rol pero en otra organizacion', async () => {
      const ubicacionId = await crearUbicacion();

      await request(app.getHttpServer())
        .patch(`/ubicaciones/${ubicacionId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildAltaUbicacionBody({
            organizacionId: 'otra-organizacion',
            rolesPorOrganizacion: {
              'otra-organizacion': ['administrador-patrimonial'],
            },
            edificio: 'X',
          }),
        )
        .expect(404);
    });

    it('devuelve 400 si areaId es de otra organizacion', async () => {
      const ubicacionId = await crearUbicacion();

      await request(app.getHttpServer())
        .patch(`/ubicaciones/${ubicacionId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildAltaUbicacionBody({ areaId: 'no-existe' }))
        .expect(400);
    });

    it('devuelve 400 si el body no trae ningun campo a actualizar', async () => {
      const ubicacionId = await crearUbicacion();

      await request(app.getHttpServer())
        .patch(`/ubicaciones/${ubicacionId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send({
          correlationId: `corr-e2e-${randomUUID()}`,
          operadorId: 'op-admin-e2e',
          organizacionId: 'duoc-uc',
          rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
        })
        .expect(400);
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
        .query({ areaId: 'area-biblioteca', limit: 100 })
        .expect(200);
      const pagina = listaRes.body as {
        responsables: Responsable[];
        total: number;
      };
      expect(pagina.responsables.some((r) => r.id === responsable.id)).toBe(
        true,
      );
      expect(pagina.total).toBeGreaterThanOrEqual(1);

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
