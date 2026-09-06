import {
  test,
  expect,
  esperarCisListo,
  esperarHttp,
} from "../fixtures/electron";
import { consultar, unaFila } from "../scripts/db";
import { registrarUsuario } from "../fixtures/artefactos";
import { ORG, USUARIOS, URLS, REALM } from "../test-data";

// El wizard de primer arranque (3 pasos) manejado por la UI real del renderer. Deja escrito
// e2e/.artefactos/credenciales.json para las specs de portal.

test.describe("02 - Wizard de primer arranque", () => {
  test("paso 1 — datos de la instalación → realm + Organización + BPI", async ({
    exe,
  }) => {
    const { page } = exe;
    await expect(
      page.getByRole("heading", { name: "Datos de esta instalación" }),
    ).toBeVisible();

    await page.getByLabel("Nombre del cliente").fill(ORG.nombre);
    await expect(page.getByLabel("Identificador")).toHaveValue(ORG.id);
    await page.getByLabel("Sede principal").fill(ORG.sede);
    await page.locator(`input[name="nivel"][value="${ORG.nivel}"]`).check();

    await page.getByRole("button", { name: "Continuar" }).click();

    // El paso 1 llama bootstrapCliente + provisionarOrganizacionCore + arranca CIS -> puede tardar.
    await expect(
      page.getByRole("heading", { name: "Datos del Director" }),
    ).toBeVisible({ timeout: 90_000 });

    // CIS arrancó como parte del paso 1.
    await esperarCisListo(page);
    await esperarHttp(`${URLS.cis}/health`, { aceptar: (s) => s === 200 });

    const wk = await fetch(
      `${URLS.keycloak}/realms/${REALM}/.well-known/openid-configuration`,
    );
    expect(wk.status).toBe(200);

    const org = await unaFila(
      "core",
      "select id, nombre, estado from organizaciones where id=$1",
      [ORG.id],
    );
    expect(org).toMatchObject({
      id: ORG.id,
      nombre: ORG.nombre,
      estado: "activo",
    });

    const sede = await unaFila(
      "core",
      "select organizacion_id, estado from sedes where organizacion_id=$1",
      [ORG.id],
    );
    expect(sede).toMatchObject({ organizacion_id: ORG.id, estado: "activo" });

    const contrato = await unaFila(
      "core",
      "select organizacion_id, estado from contratos where organizacion_id=$1",
      [ORG.id],
    );
    expect(contrato).toMatchObject({
      organizacion_id: ORG.id,
      estado: "vigente",
    });
  });

  test("paso 2 — alta del Director (rol directivo, clave inicial de un solo uso)", async ({
    exe,
  }) => {
    const { page } = exe;
    await page.getByLabel("Email").fill(USUARIOS.director.email);
    await page.getByRole("button", { name: "Dar de alta" }).click();

    await expect(
      page.getByRole("heading", { name: "Director dado de alta" }),
    ).toBeVisible({ timeout: 30_000 });
    const clave = (await page.locator("code").first().textContent())?.trim();
    expect(clave, "no se leyó la clave inicial del Director").toBeTruthy();
    registrarUsuario("director", ORG.id, USUARIOS.director.email, clave!);

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByRole("heading", { name: "Profesional de AFT" }),
    ).toBeVisible();
  });

  test("paso 3 — alta del Profesional de AFT (rol administrador-patrimonial)", async ({
    exe,
  }) => {
    const { page } = exe;
    await page.getByLabel("Email").fill(USUARIOS.aft.email);
    await page.getByRole("button", { name: "Dar de alta" }).click();

    await expect(
      page.getByRole("heading", { name: "Profesional de AFT dado de alta" }),
    ).toBeVisible({ timeout: 30_000 });
    const clave = (await page.locator("code").first().textContent())?.trim();
    expect(clave).toBeTruthy();
    registrarUsuario("aft", ORG.id, USUARIOS.aft.email, clave!);

    // Cerrar el wizard -> pantalla "Instalación completa" (PasoListoConLogin), que es el estado
    // que esperan las specs 03/04 (botón "Cambiar de usuario") y donde arrancan los servidores
    // estáticos de los portales.
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByRole("heading", { name: "Instalación completa" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("los usuarios quedaron en Keycloak con grupo {org}::{rol} y UPDATE_PASSWORD", async ({
    exe,
  }) => {
    void exe;
    const grupos = await consultar(
      "keycloak",
      "select name from keycloak_group where realm_id=(select id from realm where name=$1)",
      [REALM],
    );
    const nombres = grupos.map((g) => g.name as string);
    expect(nombres).toContain(`${ORG.id}::${USUARIOS.director.rol}`);
    expect(nombres).toContain(`${ORG.id}::${USUARIOS.aft.rol}`);

    const users = await consultar(
      "keycloak",
      `select ue.username, ra.required_action
         from user_entity ue
         left join user_required_action ra on ra.user_id = ue.id
        where ue.realm_id=(select id from realm where name=$1)
          and ue.username = any($2::text[])`,
      [REALM, [USUARIOS.director.email, USUARIOS.aft.email]],
    );
    const porUser = new Map(users.map((u) => [u.username, u.required_action]));
    expect(porUser.get(USUARIOS.director.email)).toBe("UPDATE_PASSWORD");
    expect(porUser.get(USUARIOS.aft.email)).toBe("UPDATE_PASSWORD");
  });
});
