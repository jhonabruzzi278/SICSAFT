// Paso 2/3 del wizard ("alta del Director" / "alta del Profesional de AFT") — port de
// cis/src/keycloak-admin/keycloak-admin.service.ts `crearUsuarioHuman`/`crearGrant`, recortado a
// lo que este wizard necesita (crear el usuario + darle el rol en su organización), no el
// `KeycloakAdminService` completo (listar grants, desactivar usuario, etc. no aplican acá).
// Mismo comportamiento verificado: password inicial de 20 caracteres sin ambigüedad visual,
// `temporary: true` (fuerza cambio en el primer login), y el modelo de "rol por organización" de
// ADR-004 (grupo `{organizacionId}::{rol}` con el realm role asignado al grupo — ver el
// comentario de KeycloakAdminService sobre por qué los realm roles de Keycloak son globales, no
// nativos por organización).

import { randomBytes } from "node:crypto";
import type { AdminBootstrapKeycloak } from "./services/keycloak-service";
import {
  adminApi,
  idDeLocation,
  obtenerTokenAdmin,
} from "./keycloak-admin-api";
import {
  agregarMiembroSiHaceFalta,
  resolverOrganizacionPorAlias,
} from "./keycloak-realm";

const LONGITUD_PASSWORD_INICIAL = 20;
// Debe calzar exacto con GRUPO_ORGANIZACION_ROL_SEPARADOR
// (cis/src/common/auth/keycloak-auth.constants.ts) -- keycloak-auth.guard.ts de cis/ interpreta
// los grupos de un usuario con este mismo separador para resolver sus roles por organización.
const GRUPO_ORGANIZACION_ROL_SEPARADOR = "::";
const ROL_DIRECTIVO = "directivo";
export const ROL_ADMINISTRADOR_PATRIMONIAL = "administrador-patrimonial";

function generarPasswordInicial(): string {
  const alfabeto =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(LONGITUD_PASSWORD_INICIAL);
  let password = "";
  for (let i = 0; i < LONGITUD_PASSWORD_INICIAL; i += 1) {
    password += alfabeto[bytes[i] % alfabeto.length];
  }
  return password;
}

// Resuelve (o crea) el grupo `{organizacionId}::{rol}` -- usado tanto por altas humanas
// (crearUsuarioHumano) como por el service account de ingesta (keycloak-ingesta.ts), que necesita
// el mismo rol "como si fuera un humano con ese rol en esa organización".
export async function resolverOCrearGrupoRol(
  token: string,
  organizacionId: string,
  rol: string,
): Promise<string> {
  const nombre = `${organizacionId}${GRUPO_ORGANIZACION_ROL_SEPARADOR}${rol}`;
  const rolDef = (await (
    await adminApi(token, "GET", `/roles/${encodeURIComponent(rol)}`)
  ).json()) as { id: string; name: string };

  const gruposExistentes = (await (
    await adminApi(
      token,
      "GET",
      `/groups?search=${encodeURIComponent(nombre)}&exact=true`,
    )
  ).json()) as Array<{ id: string; name: string }>;
  const existente = gruposExistentes.find((g) => g.name === nombre);
  const grupoId = existente
    ? existente.id
    : idDeLocation(
        (await adminApi(token, "POST", "/groups", { name: nombre })).location,
      );

  // Asignar el role mapping SIEMPRE, no solo al crear el grupo -- POST role-mappings/realm es
  // idempotente en Keycloak (un rol ya presente no da error). Si el grupo ya existía de una
  // corrida anterior pero sin el mapping (p.ej. el rol se agregó a ROLES_DE_NEGOCIO después, ver
  // DOC-027 BUG-29), esto lo repara en vez de devolver un grupo que no otorga el rol -- misma
  // clase de gap silencioso que crearGrant() de cis/, cerrado acá para el camino porteado.
  await adminApi(token, "POST", `/groups/${grupoId}/role-mappings/realm`, [
    { id: rolDef.id, name: rolDef.name },
  ]);
  return grupoId;
}

export interface UsuarioHumanoCreado {
  userId: string;
  passwordInicial: string;
}

// Port recortado de KeycloakAdminService.crearUsuarioHuman/crearGrant (cis/src/keycloak-admin/):
// crea el usuario en Keycloak con un password inicial temporal (cambio obligatorio en el primer
// login), lo hace miembro de la Organization del cliente y le asigna el grupo
// `{organizacionId}::{rol}` -- que keycloak-auth.guard.ts de cis/ interpreta como "este usuario
// tiene `rol` en `organizacionId`". Se porta acá, en vez de llamar al endpoint real de cis/ por
// HTTP, porque el wizard corre estas altas con las credenciales de admin de Keycloak que ya
// tiene el proceso principal -- en el primer arranque todavía no hay un JWT de Director / Admin
// del Sistema con el que autenticarse contra el guard de ese endpoint.
export async function crearUsuarioHumano(
  admin: AdminBootstrapKeycloak,
  organizacionId: string,
  email: string,
  rol: string,
): Promise<UsuarioHumanoCreado> {
  const token = await obtenerTokenAdmin(admin);
  const passwordInicial = generarPasswordInicial();

  const creado = await adminApi(token, "POST", "/users", {
    username: email,
    email,
    enabled: true,
    emailVerified: true,
    firstName: email,
    lastName: email,
    credentials: [
      { type: "password", value: passwordInicial, temporary: true },
    ],
  });
  const userId = idDeLocation(creado.location);

  const organizacion = await resolverOrganizacionPorAlias(
    token,
    organizacionId,
  );
  await agregarMiembroSiHaceFalta(token, organizacion.id, userId);
  const grupoId = await resolverOCrearGrupoRol(token, organizacionId, rol);
  await adminApi(token, "PUT", `/users/${userId}/groups/${grupoId}`, {});

  return { userId, passwordInicial };
}

// Paso 2 del wizard -- rol "directivo".
export function crearUsuarioDirector(
  admin: AdminBootstrapKeycloak,
  organizacionId: string,
  email: string,
): Promise<UsuarioHumanoCreado> {
  return crearUsuarioHumano(admin, organizacionId, email, ROL_DIRECTIVO);
}

// Paso 3 del wizard -- rol "administrador-patrimonial" (el que cis/ asigna y ccp/ exige para el
// Profesional de AFT, ver DOC-027 BUG-29; NO "profesional-aft", que no lo usa ningún código real).
export function crearUsuarioProfesionalAft(
  admin: AdminBootstrapKeycloak,
  organizacionId: string,
  email: string,
): Promise<UsuarioHumanoCreado> {
  return crearUsuarioHumano(
    admin,
    organizacionId,
    email,
    ROL_ADMINISTRADOR_PATRIMONIAL,
  );
}
