import { test, expect } from "../fixtures/portales";
import { consultar } from "../scripts/db";
import { ORG } from "../test-data";

// Variantes de error / validación en el borde que de verdad protege al sistema: el schema de CIS
// y la máquina de estados de CORE (server-side, no la validación de la UI). Login inválido, ruta
// protegida y RBAC 403 ya están cubiertos en specs 05 y 10.

async function catalogoId(
  aft: { api: import("@playwright/test").APIRequestContext },
  sufijo: string,
): Promise<string> {
  const r = await aft.api.post("/admin/catalogo-tipos", {
    data: {
      organizacionId: ORG.id,
      tipo: `TipoVal-${sufijo}`,
      familia: "Informatica",
      criticidad: "baja",
      tecnologiaIdentificacion: "qr",
    },
  });
  expect(r.ok(), `${r.status()} ${await r.text()}`).toBeTruthy();
  return (await r.json()).id as string;
}

test.describe("16 - Validaciones y errores", () => {
  test("alta de activo con código patrimonial duplicado → la BPI lo rechaza (no lo duplica)", async ({
    aft,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const cid = await catalogoId(aft, sufijo);
    const data = {
      organizacionId: ORG.id,
      codigoPatrimonial: `E2E-DUP-${sufijo}`,
      codigoQr: `E2EDUP${sufijo}`,
      catalogoId: cid,
    };
    const primero = await aft.api.post("/admin/activos", { data });
    expect(primero.ok(), `1er alta → ${primero.status()}`).toBeTruthy();

    const segundo = await aft.api.post("/admin/activos", { data });
    expect(
      segundo.ok(),
      "el 2º alta con el mismo código NO debería pasar",
    ).toBeFalsy();
    expect([400, 409, 422]).toContain(segundo.status());

    const filas = await consultar(
      "core",
      "select id from activos where organizacion_id=$1 and codigo_patrimonial=$2",
      [ORG.id, `E2E-DUP-${sufijo}`],
    );
    expect(filas.length).toBe(1);
  });

  test("alta de activo sin catalogoId → 400 (schema de CIS)", async ({
    aft,
  }) => {
    const r = await aft.api.post("/admin/activos", {
      data: {
        organizacionId: ORG.id,
        codigoPatrimonial: `E2E-NOCAT-${Date.now().toString(36)}`,
        codigoQr: `E2ENOCAT${Date.now().toString(36)}`,
      },
    });
    expect(r.status()).toBe(400);
  });

  test("alta de área sin nombre → 400", async ({ aft }) => {
    const r = await aft.api.post("/admin/areas", {
      data: {
        organizacionId: ORG.id,
        codigo: `SOLO-COD-${Date.now().toString(36)}`,
      },
    });
    expect(r.status()).toBe(400);
  });

  test("alta de responsable con identificación duplicada → 409", async ({
    aft,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const rArea = await aft.api.post("/admin/areas", {
      data: {
        organizacionId: ORG.id,
        codigo: `AV-${sufijo}`,
        nombre: `Área Val ${sufijo}`,
      },
    });
    expect(rArea.ok()).toBeTruthy();
    const areaId = (await rArea.json()).id as string;

    const data = {
      organizacionId: ORG.id,
      identificacion: `RUT-DUP-${sufijo}`,
      nombre: `Responsable ${sufijo}`,
      areaId,
    };
    const primero = await aft.api.post("/admin/responsables", { data });
    expect(primero.ok(), `1er alta → ${primero.status()}`).toBeTruthy();

    const segundo = await aft.api.post("/admin/responsables", { data });
    expect(segundo.status()).toBe(409);
  });

  test("alta de responsable con correo inválido → 400", async ({ aft }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const rArea = await aft.api.post("/admin/areas", {
      data: {
        organizacionId: ORG.id,
        codigo: `AC-${sufijo}`,
        nombre: `Área Correo ${sufijo}`,
      },
    });
    expect(rArea.ok()).toBeTruthy();
    const areaId = (await rArea.json()).id as string;

    const r = await aft.api.post("/admin/responsables", {
      data: {
        organizacionId: ORG.id,
        identificacion: `RUT-COR-${sufijo}`,
        nombre: `Responsable ${sufijo}`,
        areaId,
        correo: "no-es-un-correo",
      },
    });
    expect(r.status()).toBe(400);
  });

  test("PATCH /admin/areas/:id sin ningún campo a actualizar → 400", async ({
    aft,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const rArea = await aft.api.post("/admin/areas", {
      data: {
        organizacionId: ORG.id,
        codigo: `AE-${sufijo}`,
        nombre: `Área Edit ${sufijo}`,
      },
    });
    expect(rArea.ok()).toBeTruthy();
    const areaId = (await rArea.json()).id as string;

    const r = await aft.api.patch(`/admin/areas/${areaId}`, {
      data: { organizacionId: ORG.id },
    });
    expect(r.status()).toBe(400);
  });

  test("GET /admin/auditoria?limit=200 → 400 (paginación tope 100)", async ({
    aft,
  }) => {
    const r = await aft.api.get("/admin/auditoria?limit=200");
    expect(r.status()).toBe(400);
  });

  test("escritura sobre un activo con una organización donde el AFT no tiene rol → 403 (guard de CIS)", async ({
    aft,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const cid = await catalogoId(aft, sufijo);
    const ra = await aft.api.post("/admin/activos", {
      data: {
        organizacionId: ORG.id,
        codigoPatrimonial: `E2E-XORG-${sufijo}`,
        codigoQr: `E2EXORG${sufijo}`,
        catalogoId: cid,
      },
    });
    expect(ra.ok()).toBeTruthy();
    const activoId = (await ra.json()).id as string;

    // Aislamiento entre organizaciones: CIS verifica el rol contra la `organizacionId` del body
    // ANTES de reenviar a CORE (verificarRolAdministradorPatrimonial). El token del AFT no tiene
    // rol en esa organización -> 403 en el borde de CIS, sin llegar a CORE (que además haría 404).
    const r = await aft.api.post(`/admin/activos/${activoId}/baja`, {
      data: { organizacionId: "organizacion-que-no-existe-e2e" },
    });
    expect(r.status()).toBe(403);
  });
});
