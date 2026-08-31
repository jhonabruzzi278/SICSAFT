import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SERVICE_TOKEN_HEADER } from './../src/common/auth/service-token.guard';
import type { ImportacionContableResultado } from './../src/patrimonial/importacion-contable.types';
import type {
  DryRunFila,
  LoteConFilas,
  LoteImportacionContable,
} from './../src/patrimonial/importacion-contable-lote.types';
import {
  ADMIN_ROLES_DUOC_UC,
  crearAppE2e,
  SERVICE_TOKEN,
} from './support/e2e-app';

const IDENTIDAD = {
  correlationId: `corr-e2e-${randomUUID()}`,
  operadorId: 'op-admin-e2e',
  organizacionId: 'duoc-uc',
  rolesPorOrganizacion: ADMIN_ROLES_DUOC_UC,
};

function filaCanonica(codigo: string) {
  return {
    linea: 1,
    codigoPatrimonial: codigo,
    codigoQr: codigo,
    catalogoId: 'catalogo-notebook',
    crudo: { CODIGO: codigo, DIRECCION: 'DIRECCION GENERAL' },
  };
}

// Fila tal cual la manda el ETL desde el Excel: solo nombres, sin ids resueltos.
function filaConNombres(codigo: string, sufijo: string) {
  return {
    linea: 1,
    codigoPatrimonial: codigo,
    codigoQr: codigo,
    categoriaNombre: `Mobiliario ${sufijo}`,
    areaNombre: `Oficina ${sufijo}`,
    responsableNombre: `Encargado ${sufijo}`,
    direccionNombre: 'DIRECCION GENERAL',
    nombreAft: '1 MESA BURO / 4 GAVETAS',
    crudo: { CODIGO: codigo },
  };
}

// DOC-029 RF-B — bandeja de staging: un lote no toca la Base Patrimonial hasta que se aprueba.
describe('DOC-029 RF-B — ingesta de Excel supervisada, bandeja de staging (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await crearAppE2e();
  });

  afterEach(async () => {
    await app.close();
  });

  function postLote(
    filas: Record<string, unknown>[],
    identidad: Record<string, unknown> = IDENTIDAD,
  ) {
    return request(app.getHttpServer())
      .post('/importaciones/contable/lote')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send({
        ...identidad,
        origen: 'carpeta',
        archivoNombre: 'activos.xls',
        filas,
      });
  }

  function getLote(loteId: string) {
    return request(app.getHttpServer())
      .get(`/importaciones/contable/lote/${loteId}`)
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN);
  }

  async function crearYObtenerId(codigo: string): Promise<string> {
    const res = await postLote([filaCanonica(codigo)]).expect(200);
    return (res.body as { loteId: string }).loteId;
  }

  // El activo se creó si un lote nuevo con la misma fila ya no diría 'crear' sino 'ya_importado'.
  async function dryRunDe(codigo: string): Promise<DryRunFila> {
    const loteId = await crearYObtenerId(codigo);
    const detalle = await getLote(loteId).expect(200);
    return (detalle.body as LoteConFilas).filas[0]
      .dryRunResultado as DryRunFila;
  }

  it('crea un lote en pendiente_revision con el dry-run calculado, sin tocar la Base Patrimonial', async () => {
    const codigo = `AFT-LOTE-${randomUUID()}`;
    const loteId = await crearYObtenerId(codigo);

    const detalle = await getLote(loteId).expect(200);
    const cuerpo = detalle.body as LoteConFilas;
    expect(cuerpo.lote.estado).toBe('pendiente_revision');
    expect(cuerpo.lote.resumen).toMatchObject({ totalFilas: 1, crear: 1 });
    expect(cuerpo.filas[0].dryRunResultado).toBe('crear');
    expect(cuerpo.filas[0].crudo).toMatchObject({
      DIRECCION: 'DIRECCION GENERAL',
    });
    expect(await dryRunDe(codigo)).toBe('crear');
  });

  it('aprobar el lote ejecuta la importación real', async () => {
    const codigo = `AFT-LOTE-${randomUUID()}`;
    const loteId = await crearYObtenerId(codigo);

    const aprobado = await request(app.getHttpServer())
      .post(`/importaciones/contable/lote/${loteId}/aprobar`)
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(IDENTIDAD)
      .expect(200);
    expect((aprobado.body as ImportacionContableResultado).creados).toBe(1);

    const detalle = await getLote(loteId).expect(200);
    expect((detalle.body as LoteConFilas).lote.estado).toBe('aprobado');
    expect((detalle.body as LoteConFilas).lote.revisadoPor).toBe(
      'op-admin-e2e',
    );

    expect(await dryRunDe(codigo)).toBe('ya_importado');
  });

  it('un segundo aprobar sobre un lote ya cerrado responde 409', async () => {
    const loteId = await crearYObtenerId(`AFT-LOTE-${randomUUID()}`);
    await request(app.getHttpServer())
      .post(`/importaciones/contable/lote/${loteId}/aprobar`)
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(IDENTIDAD)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/importaciones/contable/lote/${loteId}/aprobar`)
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(IDENTIDAD)
      .expect(409);
  });

  it('rechazar el lote no crea ningún activo', async () => {
    const codigo = `AFT-LOTE-${randomUUID()}`;
    const loteId = await crearYObtenerId(codigo);

    await request(app.getHttpServer())
      .post(`/importaciones/contable/lote/${loteId}/rechazar`)
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send({ ...IDENTIDAD, motivo: 'columnas incompletas' })
      .expect(200);

    const detalle = await getLote(loteId).expect(200);
    expect((detalle.body as LoteConFilas).lote.estado).toBe('rechazado');
    expect((detalle.body as LoteConFilas).lote.motivoRechazo).toBe(
      'columnas incompletas',
    );
    expect(await dryRunDe(codigo)).toBe('crear');
  });

  it('listar filtra por organización y por estado', async () => {
    const loteId = await crearYObtenerId(`AFT-LOTE-${randomUUID()}`);
    await request(app.getHttpServer())
      .post(`/importaciones/contable/lote/${loteId}/rechazar`)
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(IDENTIDAD)
      .expect(200);

    const rechazados = await request(app.getHttpServer())
      .get(
        '/importaciones/contable/lote?organizacionId=duoc-uc&estado=rechazado',
      )
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .expect(200);
    const lotes = rechazados.body as LoteImportacionContable[];
    expect(lotes.map((l) => l.id)).toContain(loteId);
    expect(lotes.every((l) => l.estado === 'rechazado')).toBe(true);
  });

  it('listar sin organizacionId responde 400', async () => {
    await request(app.getHttpServer())
      .get('/importaciones/contable/lote')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .expect(400);
  });

  it('crear un lote sin rol responde 403', async () => {
    await postLote([filaCanonica(`AFT-LOTE-${randomUUID()}`)], {
      ...IDENTIDAD,
      rolesPorOrganizacion: {},
    }).expect(403);
  });

  it('una fila sin catalogoId ni categoriaNombre responde 400', async () => {
    await postLote([
      {
        linea: 1,
        codigoPatrimonial: `AFT-LOTE-${randomUUID()}`,
        codigoQr: 'X',
        crudo: {},
      },
    ]).expect(400);
  });

  it('aprobar resuelve-o-crea área/responsable/catálogo desde los nombres del Excel', async () => {
    const sufijo = randomUUID().slice(0, 8);
    const codigo = `AFT-LOTE-${randomUUID()}`;
    const res = await postLote([filaConNombres(codigo, sufijo)]).expect(200);
    const loteId = (res.body as { loteId: string }).loteId;

    const aprobado = await request(app.getHttpServer())
      .post(`/importaciones/contable/lote/${loteId}/aprobar`)
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .send(IDENTIDAD)
      .expect(200);
    expect((aprobado.body as ImportacionContableResultado).creados).toBe(1);

    // El activo quedó creado: un segundo lote con la misma fila ya diría ya_importado.
    const res2 = await postLote([filaConNombres(codigo, sufijo)]).expect(200);
    const detalle = await getLote(
      (res2.body as { loteId: string }).loteId,
    ).expect(200);
    expect((detalle.body as LoteConFilas).filas[0].dryRunResultado).toBe(
      'ya_importado',
    );

    // El área nueva quedó registrada en la organización.
    const areas = await request(app.getHttpServer())
      .get('/areas?organizacionId=duoc-uc&limit=100&offset=0')
      .set(SERVICE_TOKEN_HEADER, SERVICE_TOKEN)
      .expect(200);
    const nombres = (areas.body as { areas: { nombre: string }[] }).areas.map(
      (a) => a.nombre,
    );
    expect(nombres).toContain(`Oficina ${sufijo}`);
  });
});
