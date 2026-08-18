import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import type { Activo } from './../src/patrimonial/activo.types';
import type { Indicadores } from './../src/indicadores/indicadores.types';
import {
  ADMIN_ROLES_DUOC_UC,
  crearAppE2e,
  SERVICE_TOKEN,
} from './support/e2e-app';

const ADMIN_SISTEMA_ROLES_DUOC_UC = { 'duoc-uc': ['administrador-sistema'] };

function buildAltaActivoBody(overrides: Record<string, unknown> = {}) {
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

describe('DOC-021 — cierre de gaps del CCP + Administrador del Sistema (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await crearAppE2e();
  });

  afterEach(async () => {
    await app.close();
  });

  async function crearActivo(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/activos')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(buildAltaActivoBody())
      .expect(201);
    return (res.body as Activo).id;
  }

  describe('PATCH /activos/:id/descripcion (gap "descripciones")', () => {
    it('actualiza la descripcion contra Postgres real', async () => {
      const activoId = await crearActivo();

      const res = await request(app.getHttpServer())
        .patch(`/activos/${activoId}/descripcion`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            descripcion: 'Notebook con rayón en la tapa',
          }),
        )
        .expect(200);

      expect((res.body as Activo).descripcion).toBe(
        'Notebook con rayón en la tapa',
      );
    });

    it('permite limpiar la descripcion con null', async () => {
      const activoId = await crearActivo();
      await request(app.getHttpServer())
        .patch(`/activos/${activoId}/descripcion`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildEscrituraOficialBody({ descripcion: 'algo' }))
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/activos/${activoId}/descripcion`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildEscrituraOficialBody({ descripcion: null }))
        .expect(200);

      expect((res.body as Activo).descripcion).toBeNull();
    });

    it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial', async () => {
      const activoId = await crearActivo();
      await request(app.getHttpServer())
        .patch(`/activos/${activoId}/descripcion`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            descripcion: 'algo',
            rolesPorOrganizacion: ADMIN_SISTEMA_ROLES_DUOC_UC,
          }),
        )
        .expect(403);
    });
  });

  describe('GET/POST /catalogo-tipos (gap "familias/categorías")', () => {
    it('lista el seed real (catalogo-notebook) sin necesitar rol', async () => {
      const res = await request(app.getHttpServer())
        .get('/catalogo-tipos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);

      expect(
        (res.body as { id: string }[]).some(
          (t) => t.id === 'catalogo-notebook',
        ),
      ).toBe(true);
    });

    it('crea un tipo nuevo cuando el operador tiene administrador-patrimonial', async () => {
      const res = await request(app.getHttpServer())
        .post('/catalogo-tipos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            tipo: 'Silla',
            familia: 'Mobiliario',
            criticidad: 'baja',
            tecnologiaIdentificacion: 'qr',
          }),
        )
        .expect(201);

      expect(res.body).toMatchObject({ tipo: 'Silla', familia: 'Mobiliario' });
    });

    it('devuelve 403 si el operador no tiene administrador-patrimonial', async () => {
      await request(app.getHttpServer())
        .post('/catalogo-tipos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            tipo: 'Silla',
            familia: 'Mobiliario',
            criticidad: 'baja',
            tecnologiaIdentificacion: 'qr',
            rolesPorOrganizacion: ADMIN_SISTEMA_ROLES_DUOC_UC,
          }),
        )
        .expect(403);
    });
  });

  describe('POST/GET/DELETE /activos/:id/documentos (gap "documentación y fotografías")', () => {
    it('agrega, lista y elimina un documento contra Postgres real', async () => {
      const activoId = await crearActivo();

      const alta = await request(app.getHttpServer())
        .post(`/activos/${activoId}/documentos`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            tipo: 'fotografia',
            url: 'https://ejemplo.org/foto.jpg',
          }),
        )
        .expect(201);

      const documentoId = (alta.body as { id: string }).id;

      const listado = await request(app.getHttpServer())
        .get(`/activos/${activoId}/documentos`)
        .query({ organizacionId: 'duoc-uc' })
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);
      expect(listado.body).toHaveLength(1);

      await request(app.getHttpServer())
        .delete(`/activos/${activoId}/documentos/${documentoId}`)
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(buildEscrituraOficialBody())
        .expect(204);

      const listadoTrasBaja = await request(app.getHttpServer())
        .get(`/activos/${activoId}/documentos`)
        .query({ organizacionId: 'duoc-uc' })
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);
      expect(listadoTrasBaja.body).toHaveLength(0);
    });

    it('devuelve 404 si el activo no existe en esa organizacion', async () => {
      await request(app.getHttpServer())
        .get('/activos/no-existe/documentos')
        .query({ organizacionId: 'duoc-uc' })
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(404);
    });
  });

  describe('GET/POST /organizaciones (Administrador del Sistema)', () => {
    it('crea una organizacion cuando el operador tiene administrador-sistema', async () => {
      const id = `org-e2e-${randomUUID()}`;
      await request(app.getHttpServer())
        .post('/organizaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            id,
            nombre: 'Organizacion E2E',
            rolesPorOrganizacion: ADMIN_SISTEMA_ROLES_DUOC_UC,
          }),
        )
        .expect(201);

      const listado = await request(app.getHttpServer())
        .get('/organizaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);
      expect((listado.body as { id: string }[]).some((o) => o.id === id)).toBe(
        true,
      );
    });

    // DOC-021 1 — el circulo cerrado: administrador-patrimonial (Profesional de AFT) no puede
    // administrar la plataforma, aunque tenga el rol en la misma organizacion.
    it('devuelve 403 si el operador tiene administrador-patrimonial pero no administrador-sistema', async () => {
      await request(app.getHttpServer())
        .post('/organizaciones')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            id: `org-e2e-${randomUUID()}`,
            nombre: 'Organizacion E2E',
          }),
        )
        .expect(403);
    });
  });

  describe('POST /contratos acepta administrador-patrimonial O administrador-sistema (DOC-021 2)', () => {
    it('devuelve 403 si el operador no tiene ninguno de los dos roles', async () => {
      await request(app.getHttpServer())
        .post('/contratos')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .send(
          buildEscrituraOficialBody({
            sedeIds: ['melipilla'],
            vigenciaDesde: new Date().toISOString(),
            modulosContratados: ['inventario-qr'],
            rolesPorOrganizacion: { 'duoc-uc': ['directivo'] },
          }),
        )
        .expect(403);
    });
  });

  describe('GET /indicadores (Administrador del Sistema)', () => {
    it('devuelve conteos de plataforma sin exigir rol', async () => {
      const res = await request(app.getHttpServer())
        .get('/indicadores')
        .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
        .expect(200);

      const indicadores = res.body as Indicadores;
      expect(typeof indicadores.totalOrganizaciones).toBe('number');
      expect(typeof indicadores.totalSedes).toBe('number');
      expect(typeof indicadores.contratosPorEstado).toBe('object');
    });
  });
});
