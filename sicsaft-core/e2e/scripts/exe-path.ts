// Resuelve la ruta del ejecutable a probar. Módulo sin dependencias -- lo importan tanto
// global-setup (que arranca el `.exe`) como las specs (que necesitan la ruta para el bug #108 y
// para lanzar una 2ª instancia en la spec de single-instance).
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

export interface ExeResuelto {
  /** Ruta absoluta al `SICSAFT CORE.exe`. */
  exe: string;
  /** Carpeta de recursos empaquetados (extraResources) contigua al `.exe`. */
  resources: string;
  /** true si la ruta del `.exe` tiene un espacio -- condición del bug de PR #108 (kc.bat). */
  empaquetadoConEspacio: boolean;
}

// Orden de preferencia:
//   1. SICSAFT_CORE_EXE (override explícito)
//   2. la instalación real: %LOCALAPPDATA%\Programs\SICSAFT CORE\SICSAFT CORE.exe
//      -- ES la ruta con un espacio; cubre el bug de kc.bat spawneado sin comillas (PR #108).
//   3. release\win-unpacked\SICSAFT CORE.exe (tras `npm run pack` -- sin espacio, no cubre #108)
export function resolverExe(): ExeResuelto {
  const candidatos: string[] = [];
  if (process.env.SICSAFT_CORE_EXE)
    candidatos.push(process.env.SICSAFT_CORE_EXE);
  candidatos.push(
    join(
      process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"),
      "Programs",
      "SICSAFT CORE",
      "SICSAFT CORE.exe",
    ),
  );
  candidatos.push(
    join(AQUI, "..", "..", "release", "win-unpacked", "SICSAFT CORE.exe"),
  );

  for (const exe of candidatos) {
    if (existsSync(exe)) {
      return {
        exe,
        resources: join(dirname(exe), "resources"),
        empaquetadoConEspacio: / /.test(exe),
      };
    }
  }
  throw new Error(
    `No encontré el \`.exe\`. Probé:\n${candidatos.map((c) => `  - ${c}`).join("\n")}\n` +
      "Corré `npm run dist:win` (y opcionalmente instalá el Setup) o seteá SICSAFT_CORE_EXE.",
  );
}
