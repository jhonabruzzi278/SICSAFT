import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosResponse } from 'axios';
import { randomBytes } from 'node:crypto';
import type { ZodType } from 'zod';
import {
  KEYCLOAK_ADMIN_CIRCUIT_BREAKER,
  KEYCLOAK_ADMIN_CONFIG,
} from './keycloak-admin.constants';
import type { KeycloakAdminConfig } from './keycloak-admin.config';
import {
  CircuitBreaker,
  CircuitOpenError,
} from '../core-client/circuit-breaker';
import { withRetry } from '../core-client/retry';
import { GRUPO_ORGANIZACION_ROL_SEPARADOR } from '../common/auth/keycloak-auth.constants';
import {
  gruposResponseSchema,
  organizacionResponseSchema,
  organizacionesResponseSchema,
  rolResponseSchema,
  tokenServicioResponseSchema,
  usuariosResponseSchema,
  type GrantUsuario,
  type GrupoKeycloak,
  type OrganizacionKeycloak,
  type UsuarioKeycloak,
} from './keycloak-admin.types';

const LONGITUD_PASSWORD_INICIAL = 20;
const KEYCLOAK_RETRY_MAX_ATTEMPTS = 3;
const KEYCLOAK_RETRY_BASE_DELAY_MS = 200;

// Margen antes de que expire el token de servicio para renovarlo — evita mandar una request con un
// token que expira a mitad de la llamada.
const TOKEN_SERVICIO_MARGEN_MS = 10_000;

function isTransientKeycloakError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }
  return error.response === undefined || error.response.status >= 500;
}

const DIACRITICOS_COMBINANTES = new RegExp('[\\u0300-\\u036f]', 'g');

function slugificar(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(DIACRITICOS_COMBINANTES, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nombreGrupo(organizacionId: string, rol: string): string {
  return `${organizacionId}${GRUPO_ORGANIZACION_ROL_SEPARADOR}${rol}`;
}

// Keycloak responde 409 si el usuario ya es miembro de la Organization — agregarMiembroSiHaceFalta
// necesita distinguir ESTE caso puntual (idempotente, ignorable) de cualquier otra falla real
// (Keycloak caído, request malformado, etc.), que sí debe propagarse. Sin esta distinción, atrapar
// el 502 genérico de `call()` para "ya es miembro" también se tragaría silenciosamente un Keycloak
// caído de verdad — mismo tipo de hallazgo que ZitadelGrantConflictError ya resolvía en
// zitadel-admin.service.ts.
class KeycloakConflictError extends Error {}

// ADR-004 — cliente de la Admin REST API de Keycloak (`/admin/realms/{realm}/...`), reemplaza a
// ZitadelAdminService. Autenticación: client_credentials contra un client confidencial con
// serviceAccountsEnabled (a diferencia del PAT estático de Zitadel, este token expira — se cachea
// y renueva acá, ver obtenerTokenDeServicio). Nunca lo usa CIP/CORE — exclusivo de CIS, mismo
// criterio que ya tenía ZitadelAdminService.
//
// Diseño de roles por organización: verificado real contra un Keycloak 26.6 de prueba (2026-08-26)
// que los realm roles son globales por usuario (`realm_access.roles` del JWT no distingue por
// organización) — no existe una forma nativa de Keycloak de anidar "este rol aplica solo en esta
// organización". Se resuelve con un grupo por combinación organización+rol
// (`{organizacionId}::{rol}`, ver nombreGrupo) con el realm role asignado al grupo — la
// pertenencia del usuario a ese grupo ES el UserGrant equivalente al de Zitadel. keycloak-auth.guard.ts
// resuelve rolesPorOrganizacion leyendo los grupos del usuario, no el JWT directo.
@Injectable()
export class KeycloakAdminService {
  private tokenServicio: { valor: string; expiraEn: number } | null = null;

  constructor(
    @Inject(KEYCLOAK_ADMIN_CONFIG) private readonly config: KeycloakAdminConfig,
    @Inject(KEYCLOAK_ADMIN_CIRCUIT_BREAKER)
    private readonly breaker: CircuitBreaker,
    private readonly httpService: HttpService,
  ) {}

  // Gap 1 (equivalente al de zitadel-admin.service.ts) — a diferencia de Zitadel (que devuelve un
  // id numérico propio), Keycloak ignora cualquier `id` provisto al crear una Organization y
  // siempre genera su propio UUID interno (verificado real) — lo único que sí honra es `alias`.
  // Por eso acá el `organizacionId` que usa el resto del ecosistema (CORE, el claim `organization`
  // del JWT) se decide ACÁ, antes de llamar a Keycloak, slugificando el nombre — Zitadel en cambio
  // decidía el id y CIS solo lo propagaba. `domains` es obligatorio para crear una Organization;
  // como SICSAFT no ata organizaciones a un dominio de email real, se usa un dominio sintético bajo
  // `.invalid` (RFC 2606, nunca resuelve — mismo criterio que ya usan los placeholders de CI de
  // ccp-ci.yml/web-admin-ci.yml) solo para satisfacer el requisito de la API.
  async crearOrganizacion(
    nombre: string,
    correlationId: string,
  ): Promise<{ id: string }> {
    const alias = await this.generarAliasUnico(nombre, correlationId);
    await this.post(
      '/organizations',
      {
        name: nombre,
        alias,
        domains: [{ name: `${alias}.sicsaft.invalid`, verified: false }],
      },
      correlationId,
    );
    return { id: alias };
  }

  private async generarAliasUnico(
    nombre: string,
    correlationId: string,
  ): Promise<string> {
    const base = slugificar(nombre) || 'organizacion';
    const existentes = new Set(
      (await this.listarOrganizaciones(correlationId)).map((o) => o.alias),
    );
    if (!existentes.has(base)) {
      return base;
    }
    let sufijo = 2;
    while (existentes.has(`${base}-${sufijo}`)) {
      sufijo += 1;
    }
    return `${base}-${sufijo}`;
  }

  private async listarOrganizaciones(
    correlationId: string,
  ): Promise<OrganizacionKeycloak[]> {
    const data = await this.get('/organizations', correlationId);
    return this.parse(organizacionesResponseSchema, data, 'organizations');
  }

  // No hay forma de filtrar por alias en la request (mismo tipo de gap que listarGrants tenía en
  // zitadel-admin.service.ts para orgId) — se filtra en memoria sobre el listado completo.
  private async resolverOrganizacionPorAlias(
    organizacionId: string,
    correlationId: string,
  ): Promise<OrganizacionKeycloak> {
    const organizaciones = await this.listarOrganizaciones(correlationId);
    const organizacion = organizaciones.find((o) => o.alias === organizacionId);
    if (!organizacion) {
      throw new BadGatewayException({
        message: `No se encontró en Keycloak ninguna Organization con alias '${organizacionId}'`,
      });
    }
    return organizacion;
  }

  // PUT de Organization exige la representación completa (a diferencia de PUT de User, que sí
  // acepta parches parciales — verificado real) — se lee primero para no perder `domains`/`enabled`.
  async actualizarNombreOrganizacion(
    organizacionId: string,
    nombre: string,
    correlationId: string,
  ): Promise<void> {
    const organizacion = await this.resolverOrganizacionPorAlias(
      organizacionId,
      correlationId,
    );
    const data = await this.get(
      `/organizations/${organizacion.id}`,
      correlationId,
    );
    const actual = this.parse(
      organizacionResponseSchema,
      data,
      'organizations/{id}',
    ) as unknown as Record<string, unknown>;
    await this.put(
      `/organizations/${organizacion.id}`,
      { ...actual, name: nombre },
      correlationId,
    );
  }

  async buscarUsuarioPorEmail(
    email: string,
    correlationId: string,
  ): Promise<UsuarioKeycloak | null> {
    const data = await this.get(
      `/users?email=${encodeURIComponent(email)}&exact=true`,
      correlationId,
    );
    const usuarios = this.parse(usuariosResponseSchema, data, 'users');
    const usuario = usuarios[0];
    if (!usuario) {
      return null;
    }
    return {
      id: usuario.id,
      email: usuario.email ?? null,
      displayName:
        [usuario.firstName, usuario.lastName].filter(Boolean).join(' ') || null,
    };
  }

  // Gap 3 (equivalente al de zitadel-admin.service.ts) — `firstName`/`lastName` son obligatorios
  // acá: sin ellos Keycloak deja crear el usuario, pero después rechaza cualquier login con
  // "Account is not fully set up" (hallazgo real, verificado contra un Keycloak 26.6 de prueba —
  // no documentado). `temporary: true` en la credencial es el equivalente de `changeRequired` de
  // Zitadel. Keycloak no devuelve el usuario creado en el body — el id va en el header `Location`
  // de la respuesta 201 (`.../users/{id}`), se extrae acá.
  async crearUsuarioHuman(
    email: string,
    correlationId: string,
  ): Promise<{ userId: string; passwordInicial: string }> {
    const passwordInicial = this.generarPasswordInicial();
    const location = await this.postConLocation(
      '/users',
      {
        username: email,
        email,
        enabled: true,
        emailVerified: true,
        firstName: email,
        lastName: email,
        credentials: [
          { type: 'password', value: passwordInicial, temporary: true },
        ],
      },
      correlationId,
    );
    const userId = location.split('/').pop();
    if (!userId) {
      throw new BadGatewayException({
        message:
          'Keycloak no devolvió un header Location válido al crear el usuario',
      });
    }
    return { userId, passwordInicial };
  }

  // Equivalente a un UserGrant de Zitadel: agrega al usuario como miembro de la Organization (si
  // no lo era ya) y lo agrega al grupo `{organizacionId}::{rol}` (lo crea si no existe todavía,
  // con el realm role ya asignado al grupo).
  async crearGrant(
    organizacionId: string,
    userId: string,
    rol: string,
    correlationId: string,
  ): Promise<void> {
    const organizacion = await this.resolverOrganizacionPorAlias(
      organizacionId,
      correlationId,
    );
    await this.agregarMiembroSiHaceFalta(
      organizacion.id,
      userId,
      correlationId,
    );
    const grupoId = await this.resolverOCrearGrupoRol(
      organizacionId,
      rol,
      correlationId,
    );
    await this.put(`/users/${userId}/groups/${grupoId}`, {}, correlationId);
  }

  private async agregarMiembroSiHaceFalta(
    organizacionUuid: string,
    userId: string,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.post(
        `/organizations/${organizacionUuid}/members`,
        userId,
        correlationId,
        { translateConflict: true },
      );
    } catch (error: unknown) {
      // Idempotente SOLO para el 409 "ya era miembro" — cualquier otra falla (Keycloak caído,
      // request malformado) se propaga igual que antes.
      if (!(error instanceof KeycloakConflictError)) {
        throw error;
      }
    }
  }

  private async resolverOCrearGrupoRol(
    organizacionId: string,
    rol: string,
    correlationId: string,
  ): Promise<string> {
    const nombre = nombreGrupo(organizacionId, rol);
    const existente = await this.buscarGrupoPorNombre(nombre, correlationId);
    if (existente) {
      return existente.id;
    }
    const location = await this.postConLocation(
      '/groups',
      { name: nombre },
      correlationId,
    );
    const grupoId = location.split('/').pop();
    if (!grupoId) {
      throw new BadGatewayException({
        message:
          'Keycloak no devolvió un header Location válido al crear el grupo',
      });
    }
    const rolDef = await this.obtenerRol(rol, correlationId);
    await this.post(
      `/groups/${grupoId}/role-mappings/realm`,
      [{ id: rolDef.id, name: rolDef.name }],
      correlationId,
    );
    return grupoId;
  }

  private async buscarGrupoPorNombre(
    nombre: string,
    correlationId: string,
  ): Promise<GrupoKeycloak | null> {
    const data = await this.get(
      `/groups?search=${encodeURIComponent(nombre)}&exact=true`,
      correlationId,
    );
    const grupos = this.parse(gruposResponseSchema, data, 'groups');
    return grupos.find((g) => g.name === nombre) ?? null;
  }

  private async obtenerRol(
    rol: string,
    correlationId: string,
  ): Promise<{ id: string; name: string }> {
    const data = await this.get(
      `/roles/${encodeURIComponent(rol)}`,
      correlationId,
    );
    return this.parse(rolResponseSchema, data, 'roles/{name}');
  }

  // Idempotente — si el grupo no existe, no había nada que quitar.
  async quitarRolDeGrant(
    organizacionId: string,
    userId: string,
    rol: string,
    correlationId: string,
  ): Promise<void> {
    const grupo = await this.buscarGrupoPorNombre(
      nombreGrupo(organizacionId, rol),
      correlationId,
    );
    if (!grupo) {
      return;
    }
    await this.delete(`/users/${userId}/groups/${grupo.id}`, correlationId);
  }

  // Sin equivalente al estado "initial" de Zitadel (que exigía elegir entre DELETE y
  // `_deactivate` según el estado del usuario) — Keycloak modela habilitado/deshabilitado con un
  // solo campo, así que un PUT parcial alcanza siempre. Ya no recibe `organizacionId`: deshabilitar
  // una cuenta de Keycloak es global, no está scoped a una organización.
  async desactivarUsuario(
    userId: string,
    correlationId: string,
  ): Promise<void> {
    await this.put(`/users/${userId}`, { enabled: false }, correlationId);
  }

  // Reemplaza a listarGrants — resuelve los miembros de la Organization y, para cada uno, los
  // grupos `{organizacionId}::*` a los que pertenece (que son sus roles efectivos en ESA
  // organización, ver el comentario de la clase). N+1 requests (una por miembro) porque Keycloak
  // no tiene un endpoint combinado "miembros con sus roles" como el `_search` de grants de
  // Zitadel — aceptable dado el volumen esperado (organizaciones con decenas de usuarios, no miles).
  async listarGrants(
    organizacionId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    const organizacion = await this.resolverOrganizacionPorAlias(
      organizacionId,
      correlationId,
    );
    const data = await this.get(
      `/organizations/${organizacion.id}/members`,
      correlationId,
    );
    const miembros = this.parse(usuariosResponseSchema, data, 'members');
    const resultado: GrantUsuario[] = [];
    for (const miembro of miembros) {
      const roles = await this.resolverRolesDeUsuarioEnOrganizacion(
        miembro.id,
        organizacionId,
        correlationId,
      );
      if (roles.length === 0) {
        continue;
      }
      resultado.push({
        userId: miembro.id,
        email: miembro.email ?? null,
        displayName:
          [miembro.firstName, miembro.lastName].filter(Boolean).join(' ') ||
          null,
        roles,
      });
    }
    return resultado;
  }

  // Usado tanto por listarGrants como por keycloak-auth.guard.ts (vía resolverRolesPorOrganizacion)
  // para el mismo cálculo: qué roles tiene este usuario dentro de esta organización puntual.
  private async resolverRolesDeUsuarioEnOrganizacion(
    userId: string,
    organizacionId: string,
    correlationId: string,
  ): Promise<string[]> {
    const grupos = await this.obtenerGruposDeUsuario(userId, correlationId);
    const prefijo = `${organizacionId}${GRUPO_ORGANIZACION_ROL_SEPARADOR}`;
    return grupos
      .filter((g) => g.name.startsWith(prefijo))
      .map((g) => g.name.slice(prefijo.length));
  }

  private async obtenerGruposDeUsuario(
    userId: string,
    correlationId: string,
  ): Promise<GrupoKeycloak[]> {
    const data = await this.get(`/users/${userId}/groups`, correlationId);
    return this.parse(gruposResponseSchema, data, 'users/{id}/groups');
  }

  // Consumido por keycloak-auth.guard.ts — dado el `sub` del JWT y las organizaciones que el
  // propio claim `organization` ya confirmó, arma rolesPorOrganizacion con UNA sola llamada a
  // Keycloak (los grupos del usuario), no una por organización. Solo considera organizaciones que
  // el token ya declaró (defensa en profundidad: nunca atribuye un rol de un grupo cuyo prefijo de
  // organización no fue confirmado por el propio JWT).
  async resolverRolesPorOrganizacionDeUsuario(
    userId: string,
    organizaciones: string[],
    correlationId: string,
  ): Promise<Record<string, string[]>> {
    const grupos = await this.obtenerGruposDeUsuario(userId, correlationId);
    const resultado: Record<string, string[]> = {};
    for (const organizacionId of organizaciones) {
      const prefijo = `${organizacionId}${GRUPO_ORGANIZACION_ROL_SEPARADOR}`;
      const roles = grupos
        .filter((g) => g.name.startsWith(prefijo))
        .map((g) => g.name.slice(prefijo.length));
      if (roles.length > 0) {
        resultado[organizacionId] = roles;
      }
    }
    return resultado;
  }

  private generarPasswordInicial(): string {
    const alfabeto =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = randomBytes(LONGITUD_PASSWORD_INICIAL);
    let password = '';
    for (let i = 0; i < LONGITUD_PASSWORD_INICIAL; i += 1) {
      password += alfabeto[bytes[i] % alfabeto.length];
    }
    return password;
  }

  // client_credentials contra el propio realm — a diferencia del PAT estático de Zitadel, este
  // token expira (minutos), así que se cachea en memoria del proceso y se renueva con margen
  // (TOKEN_SERVICIO_MARGEN_MS) en vez de pedirse una vez al arrancar.
  private async obtenerTokenDeServicio(): Promise<string> {
    if (
      this.tokenServicio &&
      this.tokenServicio.expiraEn - TOKEN_SERVICIO_MARGEN_MS > Date.now()
    ) {
      return this.tokenServicio.valor;
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const response = await this.httpService.axiosRef.post(
      this.config.tokenUrl,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const parsed = this.parse(
      tokenServicioResponseSchema,
      response.data,
      'protocol/openid-connect/token',
    );
    this.tokenServicio = {
      valor: parsed.access_token,
      expiraEn: Date.now() + parsed.expires_in * 1000,
    };
    return parsed.access_token;
  }

  private adminPath(path: string): string {
    return `${this.config.adminBaseUrl}${path}`;
  }

  private async post(
    path: string,
    body: unknown,
    correlationId: string,
    options: { translateConflict?: boolean } = {},
  ): Promise<unknown> {
    return this.call(
      path,
      correlationId,
      async () =>
        this.httpService.axiosRef.post(this.adminPath(path), body, {
          headers: await this.headers(correlationId),
        }),
      options.translateConflict ?? false,
    );
  }

  // Igual que post(), pero devuelve el header Location en vez del body — Keycloak no devuelve el
  // recurso creado en el body para /users y /groups, solo un 201 con Location.
  private async postConLocation(
    path: string,
    body: unknown,
    correlationId: string,
  ): Promise<string> {
    const response = await this.callRaw(path, correlationId, async () =>
      this.httpService.axiosRef.post(this.adminPath(path), body, {
        headers: await this.headers(correlationId),
      }),
    );
    const location = response.headers.location as string | undefined;
    if (!location) {
      throw new BadGatewayException({
        message: `Keycloak no devolvió un header Location al crear el recurso en ${path}`,
      });
    }
    return location;
  }

  private async put(
    path: string,
    body: unknown,
    correlationId: string,
  ): Promise<unknown> {
    return this.call(path, correlationId, async () =>
      this.httpService.axiosRef.put(this.adminPath(path), body, {
        headers: await this.headers(correlationId),
      }),
    );
  }

  private async get(path: string, correlationId: string): Promise<unknown> {
    return this.call(path, correlationId, async () =>
      this.httpService.axiosRef.get(this.adminPath(path), {
        headers: await this.headers(correlationId),
      }),
    );
  }

  private async delete(path: string, correlationId: string): Promise<unknown> {
    return this.call(path, correlationId, async () =>
      this.httpService.axiosRef.delete(this.adminPath(path), {
        headers: await this.headers(correlationId),
      }),
    );
  }

  private async headers(
    correlationId: string,
  ): Promise<Record<string, string>> {
    const token = await this.obtenerTokenDeServicio();
    return {
      Authorization: `Bearer ${token}`,
      'x-correlation-id': correlationId,
    };
  }

  private async call(
    path: string,
    correlationId: string,
    request: () => Promise<AxiosResponse>,
    translateConflict = false,
  ): Promise<unknown> {
    const response = await this.callRaw(
      path,
      correlationId,
      request,
      translateConflict,
    );
    return response.data;
  }

  private async callRaw(
    path: string,
    correlationId: string,
    request: () => Promise<AxiosResponse>,
    translateConflict = false,
  ): Promise<AxiosResponse> {
    try {
      return await this.breaker.execute(() =>
        withRetry(request, {
          maxAttempts: KEYCLOAK_RETRY_MAX_ATTEMPTS,
          baseDelayMs: KEYCLOAK_RETRY_BASE_DELAY_MS,
          shouldRetry: isTransientKeycloakError,
        }),
      );
    } catch (error: unknown) {
      if (error instanceof CircuitOpenError) {
        throw new BadGatewayException({
          message: `Keycloak no disponible (circuito abierto) al pedir ${path}`,
        });
      }
      // Solo crearGrant (via agregarMiembroSiHaceFalta) espera y maneja este caso puntual — el
      // resto de las llamadas nunca deberían recibir un 409 real, así que ahí se deja caer al 502
      // genérico de abajo en vez de arriesgar que KeycloakConflictError se escape sin capturar.
      if (
        translateConflict &&
        error instanceof AxiosError &&
        error.response?.status === 409
      ) {
        throw new KeycloakConflictError();
      }
      throw new BadGatewayException({
        message: `No se pudo resolver ${path} contra la Admin API de Keycloak (correlationId: ${correlationId})`,
      });
    }
  }

  private parse<T>(schema: ZodType<T>, data: unknown, label: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new BadGatewayException({
        message: `Keycloak devolvió una respuesta de ${label} con forma inesperada`,
      });
    }
    return parsed.data;
  }
}
