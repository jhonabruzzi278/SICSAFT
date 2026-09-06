import { test, expect } from "../fixtures/portales";
import { consultar } from "../scripts/db";
import { ORG } from "../test-data";

// Estructura patrimonial desde el CCP (Profesional de AFT): área → ubicación → responsable, y su
// persistencia en la BPI. Luego un activo asignado a esa área/ubicación/responsable.

const sufijo = Date.now().toString(36).toUpperCase();
const AREA = { codigo: `A-${sufijo}`, nombre: `Area E2E ${sufijo}` };

test.describe("07 - CCP: estructura (área/ubicación/responsable)", () => {
  let areaId: string;
  let ubicacionId: string;
  let responsableId: string;
  let catalogoId: string;

  test("crea un área", async ({ aft }) => {
    const r = await aft.api.post("/admin/areas", {
      data: {
        organizacionId: ORG.id,
        codigo: AREA.codigo,
        nombre: AREA.nombre,
      },
    });
    expect(r.ok(), `${r.status()} ${await r.text()}`).toBeTruthy();
    areaId = (await r.json()).id;
    expect(areaId).toBeTruthy();

    const filas = await consultar(
      "core",
      "select id, nombre, estado from areas where organizacion_id=$1 and id=$2",
      [ORG.id, areaId],
    );
    expect(filas[0]).toMatchObject({ nombre: AREA.nombre, estado: "activo" });
  });

  test("crea una ubicación en la sede del wizard, ligada al área", async ({
    aft,
  }) => {
    const r = await aft.api.post("/admin/ubicaciones", {
      data: {
        organizacionId: ORG.id,
        sedeId: ORG.sedeId,
        areaId,
        edificio: "Central",
        piso: "1",
        oficina: `Of-${sufijo}`,
      },
    });
    expect(r.ok(), `${r.status()} ${await r.text()}`).toBeTruthy();
    ubicacionId = (await r.json()).id;
    expect(ubicacionId).toBeTruthy();
  });

  test("crea un responsable en esa área", async ({ aft }) => {
    const r = await aft.api.post("/admin/responsables", {
      data: {
        organizacionId: ORG.id,
        identificacion: `RUT-${sufijo}`,
        nombre: `Responsable E2E ${sufijo}`,
        cargo: "Encargado",
        areaId,
        correo: `resp-${sufijo}@organizacion-e2e-playwright.test`,
      },
    });
    expect(r.ok(), `${r.status()} ${await r.text()}`).toBeTruthy();
    responsableId = (await r.json()).id;

    const filas = await consultar(
      "core",
      "select id, nombre, estado, area_id from responsables where id=$1",
      [responsableId],
    );
    expect(filas[0]).toMatchObject({ estado: "activo", area_id: areaId });
  });

  test("un activo se da de alta asignado a área + ubicación + responsable", async ({
    aft,
  }) => {
    const rc = await aft.api.post("/admin/catalogo-tipos", {
      data: {
        organizacionId: ORG.id,
        tipo: `Proyector-${sufijo}`,
        familia: "Multimedia",
        criticidad: "media",
        tecnologiaIdentificacion: "qr",
      },
    });
    expect(rc.ok()).toBeTruthy();
    catalogoId = (await rc.json()).id;

    const ra = await aft.api.post("/admin/activos", {
      data: {
        organizacionId: ORG.id,
        codigoPatrimonial: `E2E-EST-${sufijo}`,
        codigoQr: `E2E-ESTQR-${sufijo}`,
        catalogoId,
        areaId,
        ubicacionId,
        responsableId,
      },
    });
    expect(ra.ok(), `${ra.status()} ${await ra.text()}`).toBeTruthy();

    const fila = await consultar(
      "core",
      "select area_id, ubicacion_id, responsable_id from activos where codigo_patrimonial=$1",
      [`E2E-EST-${sufijo}`],
    );
    expect(fila[0]).toMatchObject({
      area_id: areaId,
      ubicacion_id: ubicacionId,
      responsable_id: responsableId,
    });
  });
});
