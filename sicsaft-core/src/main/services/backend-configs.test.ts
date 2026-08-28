import { describe, expect, test, vi } from "vitest";

// rutaDistDeSistema() (node-backend-service.ts) usa `app.isPackaged` de Electron, que no existe
// en un test de Vitest puro (no corre dentro de Electron) -- se mockea acá, no se testea de
// nuevo (node-backend-service.ts es responsable de su propio comportamiento).
vi.mock("./node-backend-service", () => ({
  rutaDistDeSistema: (sistema: string) => `/repo/${sistema}/dist/main.js`,
}));

import {
  crearConfigCip,
  crearConfigCis,
  crearConfigCore,
  crearEventosOutboxUrl,
  generarTokenServicio,
  PUERTO_CIP,
  PUERTO_CIS,
  PUERTO_CORE,
} from "./backend-configs";

const TOKENS = { coreServiceToken: "core-token", cipServiceToken: "cip-token" };

describe("backend-configs", () => {
  test("generarTokenServicio devuelve 64 hex chars (32 bytes) y no repite entre llamadas", () => {
    const a = generarTokenServicio();
    const b = generarTokenServicio();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  test("crearEventosOutboxUrl apunta a la base eventos_outbox del Postgres embebido", () => {
    expect(crearEventosOutboxUrl()).toMatch(
      /^postgres:\/\/.*@127\.0\.0\.1:\d+\/eventos_outbox$/,
    );
  });

  test("crearConfigCore expone el puerto y las env vars que loadDatabaseConfig/loadEventosOutboxQueueConfig de core/ requieren", () => {
    const config = crearConfigCore("postgres://x", TOKENS);
    expect(config.nombre).toBe("core");
    expect(config.puerto).toBe(PUERTO_CORE);
    expect(config.healthPath).toBe("/health");
    expect(config.env.CORE_SERVICE_TOKEN).toBe("core-token");
    expect(config.env.CORE_DB_HOST).toBe("127.0.0.1");
    expect(config.env.EVENTOS_OUTBOX_DATABASE_URL).toBe("postgres://x");
  });

  test("crearConfigCip expone CORE_URL apuntando al puerto fijo de core y ambos tokens", () => {
    const config = crearConfigCip("postgres://x", TOKENS);
    expect(config.nombre).toBe("cip");
    expect(config.puerto).toBe(PUERTO_CIP);
    expect(config.env.CORE_URL).toBe(`http://127.0.0.1:${PUERTO_CORE}`);
    expect(config.env.CORE_SERVICE_TOKEN).toBe("core-token");
    expect(config.env.CIP_SERVICE_TOKEN).toBe("cip-token");
  });

  test("crearConfigCis expone las credenciales del client admin generadas por el wizard", () => {
    const config = crearConfigCis(TOKENS, {
      clientId: "cis-admin",
      secret: "shh",
    });
    expect(config.nombre).toBe("cis");
    expect(config.puerto).toBe(PUERTO_CIS);
    expect(config.env.CORE_URL).toBe(`http://127.0.0.1:${PUERTO_CORE}`);
    expect(config.env.CIP_URL).toBe(`http://127.0.0.1:${PUERTO_CIP}`);
    expect(config.env.KEYCLOAK_ADMIN_CLIENT_ID).toBe("cis-admin");
    expect(config.env.KEYCLOAK_ADMIN_CLIENT_SECRET).toBe("shh");
    expect(config.env.KEYCLOAK_AUDIENCE).toBe("cis");
  });
});
