import { test, expect } from "../fixtures/portales";
import { consultar, unaFila } from "../scripts/db";
import { ORG } from "../test-data";

// Estructura patrimonial desde el CCP (Profesional de AFT): área → ubicación → responsable, y su
// persistencia en la BPI; luego un activo asignado a las tres, que SÍ aparece en `GET /catalogo`.
//
// Todo en UN test: el estado se encadena (areaId -> ubicacionId -> responsableId -> activo) y
// Playwright recicla el worker tras cada fallo -- un `let` compartido entre tests se perdería.

const sufijo = Date.now().toString(36).toUpperCase();

test.describe("07 - CCP: estructura (área/ubicación/responsable)", () => {
  test("área → ubicación → responsable → activo asignado a las tres (BPI + /catalogo)", async ({
    aft,
  }) => {
    // --- área ---
    const rArea = await aft.api.post("/admin/areas", {
      data: {
        organizacionId: ORG.id,
        codigo: `A-${sufijo}`,
        nombre: `Area E2E ${sufijo}`,
      },
    });
    expect(
      rArea.ok(),
      `POST /admin/areas → ${rArea.status()} ${await rArea.text()}`,
    ).toBeTruthy();
    const areaId = (await rArea.json()).id as string;
    expect(areaId).toBeTruthy();
    const area = await unaFila(
      "core",
      "select codigo, nombre from areas where organizacion_id=$1 and id=$2",
      [ORG.id, areaId],
    );
    expect(area).toMatchObject({
      codigo: `A-${sufijo}`,
      nombre: `Area E2E ${sufijo}`,
    });

    // --- ubicación (en la sede del wizard) ---
    const rUbi = await aft.api.post("/admin/ubicaciones", {
      data: {
        organizacionId: ORG.id,
        sedeId: ORG.sedeId,
        areaId,
        edificio: "Central",
        piso: "1",
        oficina: `Of-${sufijo}`,
      },
    });
    expect(
      rUbi.ok(),
      `POST /admin/ubicaciones → ${rUbi.status()} ${await rUbi.text()}`,
    ).toBeTruthy();
    const ubicacionId = (await rUbi.json()).id as string;
    expect(ubicacionId).toBeTruthy();

    // --- responsable ---
    const rResp = await aft.api.post("/admin/responsables", {
      data: {
        organizacionId: ORG.id,
        identificacion: `RUT-${sufijo}`,
        nombre: `Responsable E2E ${sufijo}`,
        cargo: "Encargado",
        areaId,
        correo: `resp-${sufijo}@organizacion-e2e-playwright.test`,
      },
    });
    expect(
      rResp.ok(),
      `POST /admin/responsables → ${rResp.status()} ${await rResp.text()}`,
    ).toBeTruthy();
    const responsableId = (await rResp.json()).id as string;
    const resp = await unaFila(
      "core",
      "select estado, area_id from responsables where id=$1",
      [responsableId],
    );
    expect(resp).toMatchObject({ estado: "activo", area_id: areaId });

    // --- activo asignado a las tres ---
    const rc = await aft.api.post("/admin/catalogo-tipos", {
      data: {
        organizacionId: ORG.id,
        tipo: `Proyector-${sufijo}`,
        familia: "Multimedia",
        criticidad: "media",
        tecnologiaIdentificacion: "qr",
      },
    });
    expect(rc.ok(), `${rc.status()} ${await rc.text()}`).toBeTruthy();
    const catalogoId = (await rc.json()).id as string;

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
    expect(
      ra.ok(),
      `POST /admin/activos → ${ra.status()} ${await ra.text()}`,
    ).toBeTruthy();

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

    // Con área + ubicación asignadas, el activo SÍ aparece en `GET /catalogo` (el que consume la
    // APP QR -- filtra por area_id/ubicacion_id NOT NULL, ver core activo.repository.ts).
    const cat = await aft.api.get(`/catalogo?organizacionId=${ORG.id}`);
    expect(cat.ok()).toBeTruthy();
    const { activos } = await cat.json();
    expect(
      (activos as Array<{ codigoQr: string }>).map((a) => a.codigoQr),
    ).toContain(`E2E-ESTQR-${sufijo}`);
  });
});
