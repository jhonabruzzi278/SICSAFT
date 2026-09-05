import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

// portal-login-service.ts importa `electron` (WebContentsView) y config de otros servicios que a
// su vez tocan `app.getPath` -- nada de eso lo usa crearWatchdogLogin, así que se mockean para
// que el import sea hermético (mismo patrón que appqr-tls.test.ts).
vi.mock("electron", () => ({
  WebContentsView: class {},
}));
vi.mock("./keycloak-service", () => ({
  KEYCLOAK_CONFIG: { url: "http://127.0.0.1:58080", realm: "sicsaft" },
}));
vi.mock("./backend-configs", () => ({
  PUERTO_CCP: 8766,
  PUERTO_CORE_FRONTEND: 8768,
}));

import {
  crearWatchdogLogin,
  INACTIVIDAD_LOGIN_MS,
  TOPE_ABSOLUTO_LOGIN_MS,
} from "./portal-login-service";

describe("crearWatchdogLogin (bug del timeout de 60s del login embebido, 2026-09-05)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("vence tras el período de inactividad si no hay actividad", () => {
    const alVencer = vi.fn();
    crearWatchdogLogin(alVencer);

    vi.advanceTimersByTime(INACTIVIDAD_LOGIN_MS - 1);
    expect(alVencer).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(alVencer).toHaveBeenCalledTimes(1);
  });

  test("cada actividad() posterga el vencimiento (un primer login largo no dispara timeout)", () => {
    const alVencer = vi.fn();
    const wd = crearWatchdogLogin(alVencer);

    // El usuario tarda 5 minutos entre pantallas de Keycloak (usuario -> contraseña -> cambio de
    // contraseña obligatorio), pero cada submit navega y llama actividad() antes de los 90s.
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(INACTIVIDAD_LOGIN_MS - 5_000);
      wd.actividad();
    }
    expect(alVencer).not.toHaveBeenCalled();

    // Recién cuando de verdad se queda sin actividad, corta.
    vi.advanceTimersByTime(INACTIVIDAD_LOGIN_MS);
    expect(alVencer).toHaveBeenCalledTimes(1);
  });

  test("vence igual al llegar al tope absoluto aunque haya actividad continua", () => {
    const alVencer = vi.fn();
    const wd = crearWatchdogLogin(alVencer);

    // Actividad cada 10s indefinidamente -- sin tope absoluto no vencería nunca.
    let transcurrido = 0;
    while (transcurrido < TOPE_ABSOLUTO_LOGIN_MS + 60_000 && alVencer.mock.calls.length === 0) {
      vi.advanceTimersByTime(10_000);
      transcurrido += 10_000;
      wd.actividad();
    }

    expect(alVencer).toHaveBeenCalledTimes(1);
    expect(transcurrido).toBeGreaterThanOrEqual(TOPE_ABSOLUTO_LOGIN_MS);
    expect(transcurrido).toBeLessThan(TOPE_ABSOLUTO_LOGIN_MS + INACTIVIDAD_LOGIN_MS);
  });

  test("cancelar() frena el watchdog para siempre", () => {
    const alVencer = vi.fn();
    const wd = crearWatchdogLogin(alVencer);

    wd.cancelar();
    vi.advanceTimersByTime(TOPE_ABSOLUTO_LOGIN_MS * 2);
    expect(alVencer).not.toHaveBeenCalled();

    // actividad() después de cancelar no lo revive.
    wd.actividad();
    vi.advanceTimersByTime(TOPE_ABSOLUTO_LOGIN_MS);
    expect(alVencer).not.toHaveBeenCalled();
  });

  test("no vuelve a llamar alVencer si ya venció", () => {
    const alVencer = vi.fn();
    const wd = crearWatchdogLogin(alVencer);

    vi.advanceTimersByTime(INACTIVIDAD_LOGIN_MS);
    expect(alVencer).toHaveBeenCalledTimes(1);

    wd.actividad();
    vi.advanceTimersByTime(INACTIVIDAD_LOGIN_MS * 3);
    expect(alVencer).toHaveBeenCalledTimes(1);
  });

  test("parámetros de inactividad/tope configurables (para tests rápidos)", () => {
    const alVencer = vi.fn();
    crearWatchdogLogin(alVencer, 1_000, 5_000);

    vi.advanceTimersByTime(999);
    expect(alVencer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(alVencer).toHaveBeenCalledTimes(1);
  });
});
