import { test, expect, irARuta } from "../fixtures/portales";
import { capturar } from "../fixtures/capturas";
import { unaFila } from "../scripts/db";
import { ORG, URLS } from "../test-data";

// Funciones del Profesional de AFT en el CCP más allá del alta (specs 06/07): ciclo de vida del
// activo (baja lógica + máquina de estados), edición, documentos, cambio de responsable, y que
// cada módulo del hub (activos/estructura/importaciones/etiquetas/auditoría/dashboard) abre con la
// sesión real sin rebotar al login. Los módulos `contratos`/`inventarios` están retirados del CCP
// a propósito (ccp/src/lib/nivel.ts MODULOS_RETIRADOS) -- se verifica que su ruta redirige al hub.

// Crea un catálogo + un activo nuevos y devuelve el id del activo (uuid de la BPI).
async function nuevoActivo(
  aft: { api: import("@playwright/test").APIRequestContext },
  sufijo: string,
): Promise<string> {
  const rc = await aft.api.post("/admin/catalogo-tipos", {
    data: {
      organizacionId: ORG.id,
      tipo: `Tipo-${sufijo}`,
      familia: "Informatica",
      criticidad: "baja",
      tecnologiaIdentificacion: "qr",
    },
  });
  expect(
    rc.ok(),
    `catalogo-tipos → ${rc.status()} ${await rc.text()}`,
  ).toBeTruthy();
  const catalogoId = (await rc.json()).id as string;

  const ra = await aft.api.post("/admin/activos", {
    data: {
      organizacionId: ORG.id,
      codigoPatrimonial: `E2E-AFT-${sufijo}`,
      codigoQr: `E2EAFT${sufijo}`,
      catalogoId,
    },
  });
  expect(ra.ok(), `activos → ${ra.status()} ${await ra.text()}`).toBeTruthy();
  return (await ra.json()).id as string;
}

test.describe("14 - CCP: funciones del Profesional de AFT", () => {
  test("baja lógica de un activo → 'dado_de_baja' en la BPI, la fila NO se borra (Tomo III 4.10)", async ({
    aft,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const activoId = await nuevoActivo(aft, sufijo);

    const rb = await aft.api.post(`/admin/activos/${activoId}/baja`, {
      data: { organizacionId: ORG.id },
    });
    expect(rb.ok(), `baja → ${rb.status()} ${await rb.text()}`).toBeTruthy();
    expect((await rb.json()).estado).toBe("dado_de_baja");

    // La fila sigue en la tabla (baja lógica, nunca DELETE real).
    const fila = await unaFila(
      "core",
      "select codigo_patrimonial, estado from activos where id=$1",
      [activoId],
    );
    expect(fila).toMatchObject({
      codigo_patrimonial: `E2E-AFT-${sufijo}`,
      estado: "dado_de_baja",
    });

    // Máquina de estados: reincorporación solo desde 'extraviado' -> sobre 'dado_de_baja' es 400.
    const rr = await aft.api.post(
      `/admin/activos/${activoId}/reincorporacion`,
      {
        data: { organizacionId: ORG.id },
      },
    );
    expect(rr.status()).toBe(400);
  });

  test("editar la descripción de un activo → persiste en la BPI", async ({
    aft,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const activoId = await nuevoActivo(aft, sufijo);
    const descripcion = `Descripción E2E ${sufijo}`;

    const r = await aft.api.patch(`/admin/activos/${activoId}/descripcion`, {
      data: { organizacionId: ORG.id, descripcion },
    });
    expect(
      r.ok(),
      `descripcion → ${r.status()} ${await r.text()}`,
    ).toBeTruthy();

    const fila = await unaFila(
      "core",
      "select descripcion from activos where id=$1",
      [activoId],
    );
    expect(fila?.descripcion).toBe(descripcion);
  });

  test("documentación de un activo: alta → aparece en el listado → baja (204)", async ({
    aft,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const activoId = await nuevoActivo(aft, sufijo);

    const ralta = await aft.api.post(`/admin/activos/${activoId}/documentos`, {
      data: {
        organizacionId: ORG.id,
        tipo: "documento",
        url: `https://ejemplo.test/acta-${sufijo}.pdf`,
        descripcion: "Acta de entrega",
      },
    });
    expect(
      ralta.ok(),
      `alta documento → ${ralta.status()} ${await ralta.text()}`,
    ).toBeTruthy();
    const documentoId = (await ralta.json()).id as string;

    const rlist = await aft.api.get(
      `/admin/activos/${activoId}/documentos?organizacionId=${ORG.id}`,
    );
    expect(rlist.ok()).toBeTruthy();
    const docs = (await rlist.json()) as Array<{ id: string; url: string }>;
    expect(docs.some((d) => d.id === documentoId)).toBe(true);

    const rdel = await aft.api.delete(
      `/admin/activos/${activoId}/documentos/${documentoId}`,
      { data: { organizacionId: ORG.id } },
    );
    expect(rdel.status()).toBe(204);

    const rlist2 = await aft.api.get(
      `/admin/activos/${activoId}/documentos?organizacionId=${ORG.id}`,
    );
    expect(((await rlist2.json()) as unknown[]).length).toBe(0);
  });

  test("cambiar el responsable de un activo → responsable_id en la BPI", async ({
    aft,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const activoId = await nuevoActivo(aft, sufijo);

    const rArea = await aft.api.post("/admin/areas", {
      data: {
        organizacionId: ORG.id,
        codigo: `AR-${sufijo}`,
        nombre: `Área ${sufijo}`,
      },
    });
    expect(
      rArea.ok(),
      `areas → ${rArea.status()} ${await rArea.text()}`,
    ).toBeTruthy();
    const areaId = (await rArea.json()).id as string;

    const rResp = await aft.api.post("/admin/responsables", {
      data: {
        organizacionId: ORG.id,
        identificacion: `ID-${sufijo}`,
        nombre: `Responsable ${sufijo}`,
        areaId,
      },
    });
    expect(
      rResp.ok(),
      `responsables → ${rResp.status()} ${await rResp.text()}`,
    ).toBeTruthy();
    const responsableId = (await rResp.json()).id as string;

    const r = await aft.api.patch(`/admin/activos/${activoId}/responsable`, {
      data: { organizacionId: ORG.id, responsableId },
    });
    expect(
      r.ok(),
      `responsable → ${r.status()} ${await r.text()}`,
    ).toBeTruthy();

    const fila = await unaFila(
      "core",
      "select responsable_id from activos where id=$1",
      [activoId],
    );
    expect(fila?.responsable_id).toBe(responsableId);
  });

  test("cada módulo del hub abre con la sesión del AFT sin volver al login (+ capturas)", async ({
    aft,
  }, testInfo) => {
    const modulos: Array<{ ruta: string; heading: RegExp; nombre: string }> = [
      { ruta: "activos", heading: /^Activos$/, nombre: "ccp-activos" },
      {
        ruta: "estructura",
        heading: /áreas, ubicaciones y responsables/i,
        nombre: "ccp-estructura",
      },
      {
        ruta: "importaciones",
        heading: /importaciones controladas/i,
        nombre: "ccp-importaciones",
      },
      {
        ruta: "etiquetas",
        heading: /qr \/ etiquetas/i,
        nombre: "ccp-etiquetas",
      },
      { ruta: "auditoria", heading: /^Auditoría$/, nombre: "ccp-auditoria" },
      { ruta: "dashboard", heading: /^Dashboard$/, nombre: "ccp-dashboard" },
    ];

    for (const { ruta, heading, nombre } of modulos) {
      await irARuta(aft.page, `${URLS.ccp}/${ruta}?organizacionId=${ORG.id}`);
      await expect(aft.page, `${ruta} rebotó al login`).not.toHaveURL(
        /\/login$/,
      );
      await expect(
        aft.page.getByRole("heading", { name: heading }),
        `${ruta} no mostró su encabezado`,
      ).toBeVisible({ timeout: 15_000 });
      await capturar(aft.page, testInfo, nombre);
    }
  });

  test("los módulos retirados (`/contratos`, `/inventarios`) redirigen al hub", async ({
    aft,
  }) => {
    for (const ruta of ["contratos", "inventarios"]) {
      await irARuta(aft.page, `${URLS.ccp}/${ruta}?organizacionId=${ORG.id}`);
      // RequireModulo redirige a "/" (el hub, que con una sola org reenvía a /dashboard) --
      // el redirect es client-side, hay que esperarlo.
      await aft.page.waitForURL((u) => !u.pathname.endsWith(`/${ruta}`), {
        timeout: 15_000,
      });
      await expect(aft.page).not.toHaveURL(/\/login$/);
    }
  });
});
