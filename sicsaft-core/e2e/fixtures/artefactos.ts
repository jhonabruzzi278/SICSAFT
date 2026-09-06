// Estado compartido entre specs de la misma corrida (workers: 1, serie). `02-wizard.spec.ts` lo
// escribe tras correr el wizard; las specs de portal lo leen para loguearse. No se commitea
// (e2e/.artefactos/ está en .gitignore).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR = join(AQUI, "..", ".artefactos");
const ARCHIVO = join(DIR, "credenciales.json");

export interface DatosUsuario {
  email: string;
  passwordInicial: string;
  /** La clave vigente: == passwordInicial hasta que el primer login la cambie. */
  passwordActual: string;
}

export interface CredencialesCorrida {
  organizacionId: string;
  director: DatosUsuario;
  aft: DatosUsuario;
}

export function leerCredencialesSiHay(): CredencialesCorrida | null {
  if (!existsSync(ARCHIVO)) return null;
  return JSON.parse(readFileSync(ARCHIVO, "utf8")) as CredencialesCorrida;
}

export function leerCredenciales(): CredencialesCorrida {
  const c = leerCredencialesSiHay();
  if (!c) {
    throw new Error(
      "Falta e2e/.artefactos/credenciales.json -- `02-wizard.spec.ts` tiene que correr primero.",
    );
  }
  return c;
}

function escribir(c: CredencialesCorrida): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(ARCHIVO, JSON.stringify(c, null, 2));
}

/** Fija el email + clave inicial de un rol (deja passwordActual = passwordInicial). */
export function registrarUsuario(
  rol: "director" | "aft",
  organizacionId: string,
  email: string,
  passwordInicial: string,
): void {
  const c =
    leerCredencialesSiHay() ??
    ({
      organizacionId,
      director: { email: "", passwordInicial: "", passwordActual: "" },
      aft: { email: "", passwordInicial: "", passwordActual: "" },
    } satisfies CredencialesCorrida);
  c.organizacionId = organizacionId;
  c[rol] = { email, passwordInicial, passwordActual: passwordInicial };
  escribir(c);
}

/** Marca que un usuario ya cambió su clave inicial (tras el flujo UPDATE_PASSWORD). */
export function marcarPasswordCambiada(
  rol: "director" | "aft",
  nueva: string,
): void {
  const c = leerCredenciales();
  c[rol].passwordActual = nueva;
  escribir(c);
}
