import { test, expect, _electron as electron } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolverExe } from "../scripts/exe-path";
import {
  barrerHuerfanos,
  esperarServiciosListos,
  matarArbol,
} from "../scripts/exe-process";
import { rutaCarpetaLogs } from "../scripts/appdata";

// #4 -- cerrar el `.exe` con los servicios corriendo NO debe abrir el diálogo de crash de
// Electron ("A JavaScript error occurred in the main process" / "Object has been destroyed").
// El fix guarda `webContents.isDestroyed()` antes de cada `.send()` y suelta los listeners en
// before-quit. Se lanza una instancia propia (project `ciclo-vida`, después de `principal`).

function logCompleto(): string {
  const dir = rutaCarpetaLogs();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".log"))
    .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
    .join("\n");
}

test.describe("13 - Cierre limpio (bug #4)", () => {
  test("close() con los 5 servicios arriba: log finaliza limpio, sin excepción de main", async () => {
    await barrerHuerfanos();
    const { exe } = resolverExe();
    const app = await electron.launch({
      executablePath: exe,
      args: ["--disable-gpu"],
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

    const pid = app.process().pid;
    await Promise.race([
      app.close().catch(() => undefined),
      new Promise((r) => setTimeout(r, 20_000)),
    ]);

    // El proceso terminó (o lo rematamos) -- lo que importa es que el log cerró limpio.
    const code = app.process().exitCode;
    expect(code === 0 || code === null).toBeTruthy();

    const stderr = errores.join("\n");
    expect(stderr).not.toMatch(/Object has been destroyed/i);
    expect(stderr).not.toMatch(/A JavaScript error occurred/i);
    expect(stderr).not.toMatch(/uncaughtException|unhandledRejection/i);

    const contenido = logCompleto();
    expect(contenido).toContain("--- sesión finalizada ---");
    expect(contenido).not.toMatch(/Object has been destroyed/i);

    if (pid) await matarArbol(pid);
    await barrerHuerfanos();
  });
});
