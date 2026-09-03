import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dirUserData: string;

// `app.getPath("userData")` -> una carpeta temporal por test.
vi.mock("electron", () => ({
  app: { getPath: () => dirUserData },
}));

type LoggerModulo = typeof import("./logger");
let logger: LoggerModulo;

beforeEach(async () => {
  dirUserData = mkdtempSync(join(tmpdir(), "logger-test-"));
  vi.resetModules();
  logger = await import("./logger");
});
afterEach(() => {
  logger.cerrarLogger();
  rmSync(dirUserData, { recursive: true, force: true });
});

describe("redactar", () => {
  test("tapa password / secret / token en clave=valor y clave: valor", () => {
    expect(logger.redactar("KEYCLOAK_ADMIN_PASSWORD=Sup3rS3cret!")).toBe(
      "KEYCLOAK_ADMIN_PASSWORD=***",
    );
    const s = logger.redactar('client_secret: "abc123def456"');
    expect(s).toContain("client_secret");
    expect(s).not.toContain("abc123def456");
    expect(logger.redactar("storePassword=xkcd-correcto-caballo")).toBe(
      "storePassword=***",
    );
  });

  test("tapa Authorization Bearer/Basic", () => {
    expect(
      logger.redactar("Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig"),
    ).toBe("Authorization: Bearer ***");
  });

  test("tapa la contraseña de una URL de Postgres", () => {
    expect(
      logger.redactar("postgres://sicsaft:mi-clave-larga@127.0.0.1:55432/core"),
    ).toBe("postgres://sicsaft:***@127.0.0.1:55432/core");
  });

  test("no toca texto normal", () => {
    const t = "Postgres listo en 127.0.0.1:55432 (12 tablas migradas)";
    expect(logger.redactar(t)).toBe(t);
  });
});

describe("registrar / obtenerBuffer", () => {
  test("parte multilínea, recorta espacios finales, ignora líneas vacías y prefija el origen", () => {
    logger.iniciarLogger();
    logger.registrar("keycloak", "arrancando   \n\nUP en 58080  \n");
    const lineas = logger
      .obtenerBuffer()
      .filter((l) => l.includes("[keycloak]"));
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toMatch(/\[keycloak\] arrancando$/);
    expect(lineas[1]).toMatch(/\[keycloak\] UP en 58080$/);
  });

  test("preserva la sangría de la izquierda (stack traces)", () => {
    logger.iniciarLogger();
    logger.registrar("core", "Error: boom\n    at foo (bar.js:1)");
    const con = logger.obtenerBuffer().filter((l) => l.includes("[core]"));
    // "[core] " (separador) + "    " (4 de sangría preservada) = 5 espacios antes de "at"
    expect(con[1]).toMatch(/\[core\] {5}at foo \(bar\.js:1\)$/);
  });

  test("redacta antes de guardar en el buffer", () => {
    logger.iniciarLogger();
    logger.registrar(
      "orquestador",
      "env KEYCLOAK_ADMIN_PASSWORD=abc123 aplicado",
    );
    const buf = logger.obtenerBuffer();
    expect(buf.some((l) => l.includes("abc123"))).toBe(false);
    expect(buf.some((l) => l.includes("KEYCLOAK_ADMIN_PASSWORD=***"))).toBe(
      true,
    );
  });

  test("emite un evento por cada línea nueva y deja de emitir tras el unsubscribe", () => {
    logger.iniciarLogger();
    const vistas: string[] = [];
    const off = logger.alRegistrar((l) => vistas.push(l));
    logger.registrar("app", "línea uno\nlínea dos");
    off();
    logger.registrar("app", "línea tres (ya no la vemos)");
    expect(vistas.filter((l) => l.includes("línea"))).toHaveLength(2);
  });
});

describe("iniciarLogger", () => {
  test("crea la carpeta logs/ y un archivo con la fecha de hoy", () => {
    logger.iniciarLogger(new Date("2026-09-03T10:00:00Z"));
    expect(readdirSync(join(dirUserData, "logs"))).toContain(
      "sicsaft-core-2026-09-03.log",
    );
  });

  test("purga los .log de más de 7 días y deja los recientes", () => {
    const dirLogs = join(dirUserData, "logs");
    mkdirSync(dirLogs, { recursive: true });
    const viejo = join(dirLogs, "sicsaft-core-2026-08-01.log");
    const reciente = join(dirLogs, "sicsaft-core-2026-09-02.log");
    writeFileSync(viejo, "x");
    writeFileSync(reciente, "x");
    const hace10dias = new Date("2026-08-24T00:00:00Z").getTime() / 1000;
    utimesSync(viejo, hace10dias, hace10dias);

    logger.iniciarLogger(new Date("2026-09-03T10:00:00Z"));

    const archivos = readdirSync(dirLogs);
    expect(archivos).not.toContain("sicsaft-core-2026-08-01.log");
    expect(archivos).toContain("sicsaft-core-2026-09-02.log");
  });
});
