// Capturas de pantalla de la corrida: se guardan en e2e/.artefactos/capturas/ (gitignoreado, igual
// que credenciales.json) y además se adjuntan al reporte HTML de Playwright. El usuario pidió
// "ir guardando las capturas" mientras se prueba todo -- este helper es el punto único para eso.
// No falla el test si la captura no sale (una pantalla que no cargó no debe tumbar la aserción
// real que sí importa).
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, TestInfo } from "@playwright/test";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const DIR_CAPTURAS = join(AQUI, "..", ".artefactos", "capturas");

let n = 0;

/**
 * Guarda una captura `NN-<nombre>.png` en e2e/.artefactos/capturas/ y la adjunta al reporte.
 * `nombre` va en kebab-case; el prefijo numérico mantiene el orden de la corrida.
 */
export async function capturar(
  page: Page,
  testInfo: TestInfo,
  nombre: string,
): Promise<void> {
  n += 1;
  const prefijo = String(n).padStart(2, "0");
  const archivo = join(DIR_CAPTURAS, `${prefijo}-${nombre}.png`);
  try {
    mkdirSync(DIR_CAPTURAS, { recursive: true });
    const buffer = await page.screenshot({ path: archivo, fullPage: true });
    await testInfo.attach(`${prefijo}-${nombre}`, {
      body: buffer,
      contentType: "image/png",
    });
  } catch {
    // pantalla que no cargó / contexto cerrado -- la aserción del test es la que manda
  }
}
