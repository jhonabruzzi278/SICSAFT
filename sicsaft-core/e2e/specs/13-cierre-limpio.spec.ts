import { test, expect, _electron as electron } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolverExe, esperarServiciosListos } from "../fixtures/electron";
import { rutaCarpetaLogs } from "../scripts/appdata";

// #4 -- cerrar el `.exe` con los servicios corriendo NO debe abrir el diálogo de crash de
// Electron ("A JavaScript error occurred in the main process" / "Object has been destroyed").
// El fix guarda `webContents.isDestroyed()` antes de cada `.send()` y suelta los listeners en
// before-quit.
//
// Igual que la spec 12, usa su propia instancia (no la fixture worker).

test.describe("13 - Cierre limpio (bug #4)", () => {
  test("close() con los 5 servicios arriba: exit 0, sin excepción no capturada, log finaliza limpio", async () => {
    const { exe } = resolverExe();
    const app = await electron.launch({
      executablePath: exe,
      args: [],
      timeout: 60_000,
    });
    const page = await app.firstWindow({ timeout: 60_000 });
    await page.waitForLoadState("domcontentloaded");
    await esperarServiciosListos(page, { incluirCis: true });

    const errores: string[] = [];
    app.process().stderr?.on("data", (b: Buffer) => errores.push(b.toString()));
    app.on("console", (msg) => {
      if (msg.type() === "error") errores.push(msg.text());
    });

    await app.close();

    // El proceso terminó sin código de error.
    const code = app.process().exitCode;
    expect(code === 0 || code === null).toBeTruthy();

    // Nada de "Object has been destroyed" / excepción no capturada en stderr.
    const stderr = errores.join("\n");
    expect(stderr).not.toMatch(/Object has been destroyed/i);
    expect(stderr).not.toMatch(/A JavaScript error occurred/i);
    expect(stderr).not.toMatch(/uncaughtException/i);

    // El log del `.exe` cierra con "--- sesión finalizada ---" y sin la excepción.
    const dir = rutaCarpetaLogs();
    const contenido = readdirSync(dir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .join("\n");
    expect(contenido).toContain("--- sesión finalizada ---");
    expect(contenido).not.toMatch(/Object has been destroyed/i);
  });
});
