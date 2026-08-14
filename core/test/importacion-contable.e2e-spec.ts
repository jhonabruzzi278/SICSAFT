import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import type { ImportacionContableResultado } from './../src/patrimonial/importacion-contable.types';
import {
  ADMIN_ROLES_DUOC_UC,
  crearAppE2e,
  SERVICE_TOKEN,
} from './support/e2e-app';

function buildFila(overrides: Record<string, unknown> = {}) {
  const sufijo = randomUUID();
  return {
    codigoPatrimonial: `AFT-IMPORT-${sufijo}`,
    codigoQr: `QR-IMPORT-${sufijo}`,
    catalogoId: 'catalogo-notebook',
    ...overrides,
  };
}

function buildBody(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: `corr-e2e-${randomUUID()}`,
    operadorId: 'op-admin-e2e',
    organizacionId: 'duoc-uc',
    rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
    filas: [buildFila()],
    ...overrides,
  };
}

describe('DOC-012 §6 — importacion masiva de base contable (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await crearAppE2e();
  });

  afterEach(async () => {
    await app.close();
  });

  it('crea un activo nuevo contra Postgres real cuando el operador tiene el rol', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones/contable')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(buildBody())
      .expect(200);

    const resultado = res.body as ImportacionContableResultado;
    expect(resultado.creados).toBe(1);
    expect(resultado.conflictos).toBe(0);
    expect(resultado.filas[0]).toMatchObject({ resultado: 'creado' });
  });

  it('reintentar la misma fila (mismo contenido) no duplica — reporta ya_importado', async () => {
    const fila = buildFila();

    const primera = await request(app.getHttpServer())
      .post('/importaciones/contable')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(buildBody({ filas: [fila] }))
      .expect(200);
    expect((primera.body as ImportacionContableResultado).creados).toBe(1);

    const segunda = await request(app.getHttpServer())
      .post('/importaciones/contable')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(buildBody({ filas: [fila] }))
      .expect(200);

    const resultado = segunda.body as ImportacionContableResultado;
    expect(resultado.creados).toBe(0);
    expect(resultado.yaImportados).toBe(1);
    expect(resultado.filas[0]).toMatchObject({ resultado: 'ya_importado' });
  });

  it('reintentar el mismo codigoPatrimonial con contenido distinto reporta conflicto, nunca sobrescribe', async () => {
    const fila = buildFila();

    await request(app.getHttpServer())
      .post('/importaciones/contable')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(buildBody({ filas: [fila] }))
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/importaciones/contable')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(
        buildBody({
          filas: [{ ...fila, codigoQr: `${fila.codigoQr}-distinto` }],
        }),
      )
      .expect(200);

    const resultado = res.body as ImportacionContableResultado;
    expect(resultado.creados).toBe(0);
    expect(resultado.conflictos).toBe(1);
    expect(resultado.filas[0]).toMatchObject({ resultado: 'conflicto' });
  });

  it('procesa filas independientes en el mismo request — una fila invalida no aborta el resto', async () => {
    const res = await request(app.getHttpServer())
      .post('/importaciones/contable')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(
        buildBody({
          filas: [buildFila({ catalogoId: 'no-existe' }), buildFila()],
        }),
      )
      .expect(200);

    const resultado = res.body as ImportacionContableResultado;
    expect(resultado.creados).toBe(1);
    expect(resultado.conflictos).toBe(1);
  });

  it('devuelve 403 si rolesPorOrganizacion no incluye administrador-patrimonial (queda auditado)', async () => {
    await request(app.getHttpServer())
      .post('/importaciones/contable')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(buildBody({ rolesPorOrganizacion: {} }))
      .expect(403);
  });

  it('devuelve 401 sin service token', async () => {
    await request(app.getHttpServer())
      .post('/importaciones/contable')
      .send(buildBody())
      .expect(401);
  });
});
