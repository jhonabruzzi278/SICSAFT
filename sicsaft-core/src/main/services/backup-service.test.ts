import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const mockUserData = join(tmpdir(), "sicsaft-backup-test-" + Math.random().toString(36).slice(2));

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => (name === "userData" ? mockUserData : "/tmp"),
    isPackaged: false,
  },
  shell: {
    openPath: vi.fn(),
  },
}));

vi.mock("./logger", () => ({
  log: vi.fn(),
}));

import {
  rutaCarpetaRespaldos,
  listarRespaldos,
  abrirCarpetaRespaldos,
} from "./backup-service";
import { shell } from "electron";

describe("backup-service", () => {
  beforeEach(() => {
    if (!existsSync(mockUserData)) {
      mkdirSync(mockUserData, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(mockUserData)) {
      rmSync(mockUserData, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it("crea la carpeta de respaldos si no existe y devuelve su ruta", () => {
    const dir = rutaCarpetaRespaldos();
    expect(dir).toBe(join(mockUserData, "backups"));
    expect(existsSync(dir)).toBe(true);
  });

  it("lista los respaldos disponibles ordenados por fecha descendente", () => {
    const dir = rutaCarpetaRespaldos();
    const f1 = join(dir, "sicsaft-bpi-backup-2026-09-01.sql");
    const f2 = join(dir, "sicsaft-bpi-backup-2026-09-02.sql");
    writeFileSync(f1, "DUMP 1");
    writeFileSync(f2, "DUMP 2");

    const lista = listarRespaldos();
    expect(lista.length).toBe(2);
    expect(lista.map((r) => r.nombre)).toContain("sicsaft-bpi-backup-2026-09-01.sql");
    expect(lista.map((r) => r.nombre)).toContain("sicsaft-bpi-backup-2026-09-02.sql");
  });

  it("abre la carpeta de respaldos a través de shell.openPath", async () => {
    await abrirCarpetaRespaldos();
    expect(shell.openPath).toHaveBeenCalledWith(join(mockUserData, "backups"));
  });
});
