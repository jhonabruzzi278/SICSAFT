import { test, expect } from "../fixtures/electron";

// #2 / #3 -- el login embebido (WebContentsView con el form real de Keycloak) tenía un tope de
// 60s TOTAL que rompía el primer login (la pantalla de cambio de contraseña obligatorio lleva
// más de un minuto). El fix lo cambia por un watchdog de 90s de INACTIVIDAD: cada navegación del
// form reinicia la cuenta; sólo corta si no hay progreso en 90s. Y al fallar cierra la vista para
// no dejar un pane en blanco tapando la UI.
//
// Acá se prueba el borde: sin interactuar con el form, la promesa rechaza a ~90s (no 60s) con el
// mensaje nuevo, y el wizard queda recuperable (botón "Cambiar de usuario").

test.describe("04 - Watchdog del login embebido (bugs #2/#3)", () => {
  test("sin actividad, `mostrarPortalEmbebido` rechaza a ~90s con el mensaje nuevo", async ({
    exe,
  }) => {
    test.setTimeout(150_000);
    const { page } = exe;

    // Estamos en PasoListoConLogin (post-wizard). Su efecto ya disparó un mostrarPortalEmbebido;
    // lo cerramos y llamamos uno controlado desde el test, sin tocar el form.
    const r = await page.evaluate(async () => {
      const t0 = Date.now();
      try {
        await window.sicsaftCore.mostrarPortalEmbebido(
          { x: 0, y: 0, width: 480, height: 420 },
          true,
        );
        return { rechazo: false as const, ms: Date.now() - t0, msg: "" };
      } catch (e) {
        return {
          rechazo: true as const,
          ms: Date.now() - t0,
          msg: e instanceof Error ? e.message : String(e),
        };
      }
    });

    expect(r.rechazo, "no rechazó -- ¿el form se completó solo?").toBe(true);
    // Ventana de tolerancia amplia (la JVM de Keycloak + jitter), pero claramente por encima de 60s.
    expect(r.ms).toBeGreaterThan(80_000);
    expect(r.ms).toBeLessThan(120_000);
    expect(r.msg).toMatch(/no avanzó en 90s/i);
    expect(r.msg).toMatch(/cambiar de usuario/i);
  });

  test("tras el timeout el wizard no queda muerto: 'Cambiar de usuario' está disponible", async ({
    exe,
  }) => {
    const { page } = exe;
    // El renderer muestra su error y la franja de "Cambiar de usuario" sigue presente (nunca es
    // condicional -- ver PasoListoConLogin.tsx) y clickeable.
    const cambiar = page.getByRole("button", { name: /cambiar de usuario/i });
    await expect(cambiar).toBeVisible();
    await expect(cambiar).toBeEnabled();

    // Un click dispara un nuevo intento (sin explotar en el acto).
    await cambiar.click();
    await expect(page.getByText(/no se pudo mostrar el login/i)).toHaveCount(
      0,
      { timeout: 5_000 },
    );
  });
});
