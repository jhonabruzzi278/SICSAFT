import { test, expect, irARuta } from "../fixtures/portales";
import { unaFila } from "../scripts/db";
import { ORG, URLS } from "../test-data";

// El Profesional de AFT da de alta un tipo de catálogo y un activo desde el CCP: la cadena real
// ACTOR -> Keycloak -> CIS -> CORE -> BPI, con auditoría. (El `.exe` sirve el CCP en 127.0.0.1.)

const sufijo = Date.now().toString(36).toUpperCase();
const CATALOGO = { tipo: `Notebook-${sufijo}`, familia: "Informatica" };
const ACTIVO = {
  codigoPatrimonial: `E2E-PAT-${sufijo}`,
  codigoQr: `E2E-QR-${sufijo}`,
};

test.describe("06 - CCP: alta de tipo de catálogo y de activo", () => {
  test("crea un tipo de catálogo → persiste en la BPI", async ({ aft }) => {
    const res = await aft.api.post("/admin/catalogo-tipos", {
      data: {
        organizacionId: ORG.id,
        tipo: CATALOGO.tipo,
        familia: CATALOGO.familia,
        criticidad: "baja",
        tecnologiaIdentificacion: "qr",
      },
    });
    expect(
      res.ok(),
      `POST /admin/catalogo-tipos → ${res.status()} ${await res.text()}`,
    ).toBeTruthy();
    const tipo = await res.json();
    expect(tipo.id).toBeTruthy();

    const fila = await unaFila(
      "core",
      "select tipo, familia from catalogo_activos where id=$1",
      [tipo.id],
    );
    expect(fila).toMatchObject({
      tipo: CATALOGO.tipo,
      familia: CATALOGO.familia,
    });

    // Guardamos el id para el siguiente test vía el propio catálogo.
    process.env.E2E_CATALOGO_ID = tipo.id;
  });

  test("da de alta un activo contra ese catálogo → persiste en la BPI", async ({
    aft,
  }) => {
    const catalogoId =
      process.env.E2E_CATALOGO_ID ??
      (await (async () => {
        const r = await aft.api.get("/admin/catalogo-tipos");
        const lista = (await r.json()) as Array<{ id: string; tipo: string }>;
        return lista.find((c) => c.tipo === CATALOGO.tipo)?.id;
      })());
    expect(catalogoId, "no hay catálogo para el alta").toBeTruthy();

    const alta = await aft.api.post("/admin/activos", {
      data: {
        organizacionId: ORG.id,
        codigoPatrimonial: ACTIVO.codigoPatrimonial,
        codigoQr: ACTIVO.codigoQr,
        catalogoId,
      },
    });
    expect(
      alta.ok(),
      `POST /admin/activos → ${alta.status()} ${await alta.text()}`,
    ).toBeTruthy();
    const activo = await alta.json();
    expect(activo.codigoPatrimonial).toBe(ACTIVO.codigoPatrimonial);
    expect(activo.estado).toBeTruthy();

    // Persistido en la BPI.
    const fila = await unaFila(
      "core",
      "select codigo_patrimonial, codigo_qr, estado, organizacion_id from activos where codigo_patrimonial=$1",
      [ACTIVO.codigoPatrimonial],
    );
    expect(fila).toMatchObject({
      codigo_patrimonial: ACTIVO.codigoPatrimonial,
      codigo_qr: ACTIVO.codigoQr,
      estado: "activo",
      organizacion_id: ORG.id,
    });
    // Nota: `GET /catalogo` (el que consume la APP QR) filtra por `area_id`/`ubicacion_id NOT
    // NULL` (ver core activo.repository.ts findCatalogo) -- un activo sin ubicación no aparece
    // ahí a propósito. Esa visibilidad se prueba en la 07 (activo con área + ubicación).
  });

  test("la sesión del AFT abre la pantalla Activos del CCP sin volver al login", async ({
    aft,
  }) => {
    // El listado del CCP pagina/virtualiza -> no se asume que la fila recién creada por API sea
    // visible sin buscarla (mismo criterio que casos-de-uso/e2e cu-pat-001). La cobertura dura
    // del alta es la cadena de API + BPI de los tests de arriba.
    await irARuta(aft.page, `${URLS.ccp}/activos?organizacionId=${ORG.id}`);
    await expect(aft.page).not.toHaveURL(/\/login$/);
    await expect(aft.page.getByText(/sicsaft/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
