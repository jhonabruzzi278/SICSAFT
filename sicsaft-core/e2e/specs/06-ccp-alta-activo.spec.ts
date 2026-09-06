import { test, expect } from "../fixtures/portales";
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

  test("da de alta un activo contra ese catálogo → BPI + visible en /catalogo", async ({
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

    // Visible en el catálogo que consumen CCP y APP QR.
    const cat = await aft.api.get(`/catalogo?organizacionId=${ORG.id}`);
    expect(cat.ok()).toBeTruthy();
    const { activos } = await cat.json();
    expect(
      (activos as Array<{ codigoQr: string }>).map((a) => a.codigoQr),
    ).toContain(ACTIVO.codigoQr);
  });

  test("el activo aparece en la pantalla Activos del CCP", async ({ aft }) => {
    await aft.page.goto(`${URLS.ccp}/activos?organizacionId=${ORG.id}`);
    await expect(aft.page).not.toHaveURL(/\/login$/);
    // La fila puede requerir un refresh manual (el CCP no re-fetcha la lista tras el alta hecha
    // por API en otra pestaña) -> recargamos y buscamos el código.
    await aft.page.reload();
    await expect(
      aft.page.getByText(ACTIVO.codigoQr, { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
