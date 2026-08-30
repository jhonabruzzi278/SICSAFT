import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { X509Certificate } from "node:crypto";

const { userDataDir, obtenerIpLanMock } = vi.hoisted(() => ({
  userDataDir: { ruta: "" },
  obtenerIpLanMock: vi.fn(),
}));
vi.mock("electron", () => ({ app: { getPath: () => userDataDir.ruta } }));
vi.mock("./lan-ip", () => ({ obtenerIpLan: obtenerIpLanMock }));

import { obtenerCertificadoAppQr } from "./appqr-tls";

describe("obtenerCertificadoAppQr (DOC-028 Fase D)", () => {
  beforeEach(() => {
    userDataDir.ruta = mkdtempSync(join(tmpdir(), "sicsaft-appqr-tls-"));
    obtenerIpLanMock.mockReset();
  });
  afterEach(() => {
    rmSync(userDataDir.ruta, { recursive: true, force: true });
  });

  test("genera un cert autofirmado válido con la IP de LAN en el SubjectAltName", async () => {
    obtenerIpLanMock.mockReturnValue("192.168.1.8");

    const { key, cert } = await obtenerCertificadoAppQr();

    expect(key).toContain("BEGIN PRIVATE KEY");
    expect(cert).toContain("BEGIN CERTIFICATE");
    const x = new X509Certificate(cert);
    expect(x.subjectAltName).toContain("192.168.1.8");
    expect(new Date(x.validTo).getTime()).toBeGreaterThan(Date.now());
    // se cacheó en userData
    expect(existsSync(join(userDataDir.ruta, "appqr-tls", "cert.pem"))).toBe(
      true,
    );
    expect(existsSync(join(userDataDir.ruta, "appqr-tls", "key.pem"))).toBe(
      true,
    );
  });

  test("reusa el cert cacheado si la IP no cambió (no regenera)", async () => {
    obtenerIpLanMock.mockReturnValue("10.0.0.5");
    const primero = await obtenerCertificadoAppQr();
    const segundo = await obtenerCertificadoAppQr();
    expect(segundo.cert).toBe(primero.cert);
    expect(segundo.key).toBe(primero.key);
  });

  test("regenera si la IP de LAN cambió (el SAN del cert cacheado ya no la cubre)", async () => {
    obtenerIpLanMock.mockReturnValue("192.168.1.8");
    const viejo = await obtenerCertificadoAppQr();

    obtenerIpLanMock.mockReturnValue("192.168.1.20");
    const nuevo = await obtenerCertificadoAppQr();

    expect(nuevo.cert).not.toBe(viejo.cert);
    expect(new X509Certificate(nuevo.cert).subjectAltName).toContain(
      "192.168.1.20",
    );
  });

  test("regenera si el archivo cacheado está corrupto", async () => {
    obtenerIpLanMock.mockReturnValue("10.1.2.3");
    await obtenerCertificadoAppQr();
    const certPath = join(userDataDir.ruta, "appqr-tls", "cert.pem");
    // corromper
    const { writeFileSync } = await import("node:fs");
    writeFileSync(certPath, "no soy un cert");

    const recuperado = await obtenerCertificadoAppQr();
    expect(recuperado.cert).toContain("BEGIN CERTIFICATE");
    expect(readFileSync(certPath, "utf-8")).toContain("BEGIN CERTIFICATE");
  });
});
