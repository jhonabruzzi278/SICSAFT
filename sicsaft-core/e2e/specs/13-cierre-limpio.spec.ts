import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import {
  barrerHuerfanos,
  esperarExeAbajo,
  leerHandleExe,
  matarArbol,
  pedirCierreLimpio,
} from "../scripts/exe-process";
import { rutaCarpetaLogs } from "../scripts/appdata";

// #4 -- cerrar el `.exe` con los servicios corriendo NO debe abrir el diálogo de crash de
// Electron ("A JavaScript error occurred in the main process" / "Object has been destroyed").
// El fix guarda `webContents.isDestroyed()` antes de cada `.send()` y suelta los listeners en
// before-quit. Se cierra la instancia compartida (que la spec 12 relanzó) con un WM_CLOSE -- el
// mismo camino que el usuario clickeando la X -> dispara el `before-quit`.

function logCompleto(): string {
  const dir = rutaCarpetaLogs();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".log"))
    .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
    .join("\n");
}

test.describe("13 - Cierre limpio (bug #4)", () => {
  test("cerrar la ventana con los 5 servicios arriba: log finaliza limpio, sin excepción de main", async () => {
    const { pid } = leerHandleExe();

    await pedirCierreLimpio(pid); // WM_CLOSE -> window-all-closed -> before-quit
    await esperarExeAbajo(60_000);
    // rematar el `java` de Keycloak que el `.exe` deja huérfano al cerrar en Windows
    await matarArbol(pid);
    await barrerHuerfanos();

    const contenido = logCompleto();
    // El logger escribe esto en el before-quit, después de apagar los 5 servicios.
    expect(contenido).toContain("--- sesión finalizada ---");
    // Nada del diálogo de crash de Electron ni excepción no capturada en el proceso principal.
    expect(contenido).not.toMatch(/Object has been destroyed/i);
    expect(contenido).not.toMatch(/A JavaScript error occurred/i);
    expect(contenido).not.toMatch(/uncaughtException|unhandledRejection/i);
  });
});
