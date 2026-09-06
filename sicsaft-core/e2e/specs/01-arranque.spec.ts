import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  test,
  expect,
  PUERTOS,
  esperarHttp,
  resolverExe,
} from "../fixtures/electron";
import { URLS } from "../test-data";

// Primer arranque del `.exe`: Postgres + Keycloak + CORE + CIP suben antes del wizard (CIS
// arranca recién en el paso 1 -- se verifica en 02). Cubre además el bug de PR #108: Keycloak
// spawnea `kc.bat` con `shell:true`; si la ruta de instalación tiene un espacio y el command no
// va entre comillas, `cmd` lo corta en el primer espacio y Keycloak nunca arranca.

test.describe("01 - Primer arranque de los servicios embebidos", () => {
  test("Postgres, Keycloak, CORE y CIP quedan en 'listo' (CIS espera al wizard)", async ({
    exe,
  }) => {
    const estado = await exe.page.evaluate(() =>
      window.sicsaftCore.getEstadoServicios(),
    );
    for (const s of ["postgres", "keycloak", "core", "cip"] as const) {
      expect(estado[s]?.estado, `${s} → ${JSON.stringify(estado[s])}`).toBe(
        "listo",
      );
    }
    // cis todavía no: está en cola hasta que el wizard cree sus credenciales.
    expect(["detenido", "iniciando", "en cola", undefined]).toContain(
      estado.cis?.estado,
    );
  });

  test("Keycloak responde el well-known del realm `master` (el realm `sicsaft` lo crea el wizard)", async ({
    exe,
  }) => {
    void exe;
    // El realm `sicsaft` no existe hasta el paso 1 del wizard (bootstrapCliente) -- se verifica
    // en 02. Acá sólo que Keycloak está sirviendo (realm `master`, siempre presente). Que los
    // portales sirven su index queda probado en las specs 05..09 (login real contra cada uno);
    // sus servidores estáticos arrancan recién en el primer `mostrarPortalEmbebido`.
    await esperarHttp(
      `${URLS.keycloak}/realms/master/.well-known/openid-configuration`,
      { aceptar: (s) => s === 200 },
    );
  });

  test("#108 — Keycloak arranca aunque `kc.bat` esté en una ruta con espacio", async ({
    exe,
  }) => {
    test.skip(
      !exe.empaquetadoConEspacio,
      "el `.exe` no corre desde una ruta con espacio -- este bug no se puede reproducir acá",
    );

    // La ruta que el `.exe` empaquetado usa para los binarios de Keycloak (extraResources,
    // contigua al `.exe`) tiene un espacio...
    const rutaKc = join(
      dirname(resolverExe().exe),
      "resources",
      "keycloak",
      "bin",
      "kc.bat",
    );
    expect(rutaKc).toContain(" ");
    expect(existsSync(rutaKc), `no existe ${rutaKc}`).toBe(true);

    // ...y aun así Keycloak quedó 'listo' (sin el fix quedaría en 'error' con
    // "'C:\\...\\SICSAFT' no se reconoce como un comando").
    const estado = await exe.page.evaluate(() =>
      window.sicsaftCore.getEstadoServicios(),
    );
    expect(estado.keycloak?.estado).toBe("listo");

    // El puerto de management de Keycloak (58081) también está arriba.
    await esperarHttp(`http://127.0.0.1:${PUERTOS.keycloakManagement}/health`, {
      aceptar: (s) => s === 200 || s === 404,
    });
  });
});
