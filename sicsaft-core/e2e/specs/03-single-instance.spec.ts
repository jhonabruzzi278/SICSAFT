import { test, expect, resolverExe } from "../fixtures/electron";
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { rutaCarpetaLogs } from "../scripts/appdata";

// #1 -- single-instance lock. Abrir el `.exe` una segunda vez no debe levantar un segundo proceso
// completo (su Postgres embebido chocaría con el postmaster.pid del primero y el wizard mostraría
// "Hubo un problema al iniciar" aunque la primera instancia esté sana).

function contarLineasLog(patron: RegExp): number {
  const dir = rutaCarpetaLogs();
  let total = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".log")) continue;
    for (const linea of readFileSync(`${dir}/${f}`, "utf8").split(/\r?\n/)) {
      if (patron.test(linea)) total += 1;
    }
  }
  return total;
}

test.describe("03 - Una sola instancia (bug #1)", () => {
  test("una segunda invocación no arranca nada y termina sola", async ({
    exe,
  }) => {
    const ventanasAntes = (await exe.app.windows()).length;
    const listoAntes = contarLineasLog(/proceso principal listo/);
    const colisionAntes = contarLineasLog(
      /postmaster\.pid.*already exists|Hubo un problema/,
    );

    const { exe: rutaExe } = resolverExe();
    const segunda = spawn(rutaExe, [], { detached: false, stdio: "ignore" });

    const codigo = await new Promise<number | null>((resolve) => {
      const t = setTimeout(() => {
        segunda.kill();
        resolve(-999); // no terminó sola en 15s -> fallo
      }, 15_000);
      segunda.on("exit", (c) => {
        clearTimeout(t);
        resolve(c);
      });
    });

    expect(
      codigo,
      "la 2ª instancia no terminó sola (¿arrancó un proceso completo?)",
    ).not.toBe(-999);

    // La primera instancia sigue con una sola ventana y no registró un arranque nuevo.
    expect((await exe.app.windows()).length).toBe(ventanasAntes);
    expect(contarLineasLog(/proceso principal listo/)).toBe(listoAntes);
    // Y no hubo colisión de Postgres nueva.
    expect(
      contarLineasLog(/postmaster\.pid.*already exists|Hubo un problema/),
    ).toBe(colisionAntes);

    // El wizard de la primera instancia sigue operativo (no en pantalla de error).
    await expect(
      exe.page.getByText(/hubo un problema al iniciar/i),
    ).toHaveCount(0);
  });
});
