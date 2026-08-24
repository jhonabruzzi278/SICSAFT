import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosResponse } from 'axios';
import { randomBytes } from 'node:crypto';
import type { ZodType } from 'zod';
import {
  ZITADEL_ADMIN_CIRCUIT_BREAKER,
  ZITADEL_ADMIN_CONFIG,
} from './zitadel-admin.constants';
import type { ZitadelAdminConfig } from './zitadel-admin.config';
import {
  CircuitBreaker,
  CircuitOpenError,
} from '../core-client/circuit-breaker';
import { withRetry } from '../core-client/retry';
import {
  buscarUsuariosResponseSchema,
  crearOrganizacionResponseSchema,
  crearProjectGrantResponseSchema,
  crearUsuarioHumanResponseSchema,
  listarGrantsResponseSchema,
  listarProjectGrantsResponseSchema,
  obtenerUsuarioResponseSchema,
  type GrantUsuario,
  type OrganizacionZitadel,
  type UsuarioHumanCreado,
  type UsuarioZitadel,
} from './zitadel-admin.types';

// DOC-024 — estado real de Zitadel que bloquea `_deactivate` (ver desactivarUsuario). Nunca
// llega a completar el primer login en este stack sin SMTP (mismo motivo ya documentado para
// crearUsuarioHuman) — cualquier Profesional de AFT recien creado por el Directivo queda en este
// estado indefinidamente en devops/local.
const USER_STATE_INITIAL = 'USER_STATE_INITIAL';

// Contraseña inicial: generada, no elegida por el Directivo — quien la asigna nunca debería
// poder fijar la contraseña de otra persona a mano (mismo criterio que cualquier flujo de alta de
// usuario administrado). `changeRequired: true` fuerza a cambiarla en el primer login real.
const LONGITUD_PASSWORD_INICIAL = 20;

// Los 3 roles de Proyecto que existen hoy en Zitadel (DOC-020/DOC-012/DOC-021 1). Repetidos acá en
// vez de importados de cis/src/directivo/administrador (evita invertir la dirección de
// dependencia: esos módulos ya dependen de zitadel-admin/, no al revés) — mismo enum cerrado que
// ya usa asignarUsuarioOrganizacionSchema en administrador.schemas.ts.
const ADMINISTRADOR_PATRIMONIAL_ROLE = 'administrador-patrimonial';
const DIRECTIVO_ROLE = 'directivo';
const ADMINISTRADOR_SISTEMA_ROLE = 'administrador-sistema';

// Mismos parametros conservadores que CoreClientService/CipClientService (WAF 4).
const ZITADEL_RETRY_MAX_ATTEMPTS = 3;
const ZITADEL_RETRY_BASE_DELAY_MS = 200;

// Header propio de Zitadel para escopar una llamada de Management API a una organizacion
// especifica cuando el service user que llama no pertenece a ella (nuestro caso: un service user
// administrativo operando sobre cualquier organizacion del ecosistema).
const ZITADEL_ORG_HEADER = 'x-zitadel-orgid';

function isTransientZitadelError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }
  return error.response === undefined || error.response.status >= 500;
}

// Zitadel modela un solo UserGrant por (usuario, proyecto, organizacion) — un segundo
// POST .../grants para el mismo trio devuelve 409 "User grant already exists" (verificado real,
// no documentado en la referencia publica). `call()` lo traduce a este error interno para que
// `crearGrant` pueda distinguirlo del resto de fallas (que sí son 502 genérico) y reaccionar
// sumando el rol al grant existente en vez de fallar.
class ZitadelGrantConflictError extends Error {}

// DOC-021 4 (Administrador del Sistema) — cliente de la API de administracion de Zitadel
// (`/management/v1/...`), autenticado con un PAT de service user (ver zitadel-admin.config.ts).
// Nunca lo usa CIP/CORE — es exclusivo de CIS, que es quien ya administra la relacion con
// Zitadel para el resto del ecosistema (ZitadelAuthGuard).
@Injectable()
export class ZitadelAdminService {
  constructor(
    @Inject(ZITADEL_ADMIN_CONFIG) private readonly config: ZitadelAdminConfig,
    @Inject(ZITADEL_ADMIN_CIRCUIT_BREAKER)
    private readonly breaker: CircuitBreaker,
    private readonly httpService: HttpService,
  ) {}

  async buscarUsuarioPorEmail(
    email: string,
    correlationId: string,
  ): Promise<UsuarioZitadel | null> {
    const data = await this.post(
      '/management/v1/users/_search',
      {
        queries: [
          {
            emailQuery: {
              emailAddress: email,
              method: 'TEXT_QUERY_METHOD_EQUALS',
            },
          },
        ],
      },
      correlationId,
    );
    const parsed = this.parse(
      buscarUsuariosResponseSchema,
      data,
      'users/_search',
    );
    const usuario = parsed.result[0];
    if (!usuario) {
      return null;
    }
    return {
      id: usuario.id,
      email: usuario.human?.email?.email ?? null,
      displayName: usuario.human?.profile?.displayName ?? null,
    };
  }

  // ATENCION: `ListUserGrantsRequest.UserGrantQuery` de la API real de Zitadel NO tiene un query
  // type por org id (verificado real contra Zitadel v2.65 — un `orgIdQuery` como el que este
  // metodo mandaba antes devuelve 400 "UserGrantQuery.Query: value is required", el campo no
  // existe; los unicos filtros de organizacion disponibles son por dominio o nombre, no por id, y
  // el header `x-zitadel-orgid` NO filtra los resultados para un service user con permisos de
  // instancia como el que usa este cliente — devuelve los grants de TODAS las organizaciones sin
  // ese query type). Se filtra acá, en memoria, por el `orgId` que cada grant ya trae en la
  // respuesta — la unica forma correcta de acotar por organizacion con esta API.
  async listarGrants(
    zitadelOrgId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    const data = await this.post(
      '/management/v1/users/grants/_search',
      {
        queries: [{ projectIdQuery: { projectId: this.config.projectId } }],
      },
      correlationId,
      { orgId: zitadelOrgId },
    );
    const parsed = this.parse(
      listarGrantsResponseSchema,
      data,
      'users/grants/_search',
    );
    return parsed.result
      .filter((grant) => grant.orgId === zitadelOrgId)
      .map((grant) => ({
        userId: grant.userId,
        email: grant.email ?? null,
        displayName: grant.displayName ?? null,
        roles: grant.roleKeys,
      }));
  }

  // Gap 0/1 (flujo real Admin->Directivo->Profesional AFT) — antes esto solo mandaba `projectId`,
  // que únicamente funciona si `zitadelOrgId` es la organización dueña del proyecto "CIS"
  // ("DUOC UC"). Para cualquier otra organización, Zitadel exige el `projectGrantId` del
  // ProjectGrant correspondiente (ver otorgarProyectoAOrganizacion) o responde "Project not
  // found" — hallazgo real, no documentado, verificado contra el Zitadel de devops/local.
  async crearGrant(
    zitadelOrgId: string,
    userId: string,
    rol: string,
    correlationId: string,
  ): Promise<void> {
    const projectGrantId = await this.resolverProjectGrantId(
      zitadelOrgId,
      correlationId,
    );
    try {
      await this.post(
        `/management/v1/users/${encodeURIComponent(userId)}/grants`,
        {
          projectId: this.config.projectId,
          ...(projectGrantId ? { projectGrantId } : {}),
          roleKeys: [rol],
        },
        correlationId,
        { orgId: zitadelOrgId, translateConflict: true },
      );
    } catch (error: unknown) {
      if (!(error instanceof ZitadelGrantConflictError)) {
        throw error;
      }
      await this.agregarRolAGrantExistente(
        zitadelOrgId,
        userId,
        rol,
        correlationId,
      );
    }
  }

  // El usuario ya tiene un UserGrant en este proyecto+organizacion (ej. un Administrador del
  // Sistema al que ahora tambien se designa Profesional de AFT) — Zitadel exige sumar el rol al
  // grant existente via PUT, no crear uno nuevo via POST.
  private async agregarRolAGrantExistente(
    zitadelOrgId: string,
    userId: string,
    rol: string,
    correlationId: string,
  ): Promise<void> {
    const grant = await this.buscarGrantDeUsuario(
      zitadelOrgId,
      userId,
      correlationId,
    );
    if (!grant) {
      // No debería pasar (Zitadel recién dijo "already exists"), pero si la vista de lectura no
      // lo devuelve todavía (consistencia eventual), no hay nada seguro que actualizar.
      throw new BadGatewayException({
        message: `Zitadel reportó un grant existente para el usuario '${userId}' pero no se pudo encontrar al buscarlo`,
      });
    }
    if (grant.roles.includes(rol)) {
      return; // ya tiene el rol — idempotente, nada que hacer.
    }
    await this.put(
      `/management/v1/users/${encodeURIComponent(userId)}/grants/${encodeURIComponent(grant.grantId)}`,
      { roleKeys: [...grant.roles, rol] },
      correlationId,
      { orgId: zitadelOrgId },
    );
  }

  // DOC-024 — inverso de agregarRolAGrantExistente. Verificado real contra el Zitadel de
  // devops/local (2026-08-21): quitar un rol de un grant multi-rol es el mismo PUT que agregar
  // uno (mandar el array ya sin ese rol); si no queda ningun rol, Zitadel exige borrar el grant
  // completo en vez de aceptar un PUT con `roleKeys: []` — no se probó un PUT vacío porque el
  // propio invariante de Zitadel ("un grant siempre tiene al menos un rol") lo vuelve el camino
  // correcto de todos modos, no una suposición.
  async quitarRolDeGrant(
    zitadelOrgId: string,
    userId: string,
    rol: string,
    correlationId: string,
  ): Promise<void> {
    const grant = await this.buscarGrantDeUsuario(
      zitadelOrgId,
      userId,
      correlationId,
    );
    if (!grant || !grant.roles.includes(rol)) {
      return; // idempotente — no tenia ese rol, nada que quitar.
    }
    const restantes = grant.roles.filter((r) => r !== rol);
    if (restantes.length === 0) {
      await this.delete(
        `/management/v1/users/${encodeURIComponent(userId)}/grants/${encodeURIComponent(grant.grantId)}`,
        correlationId,
        { orgId: zitadelOrgId },
      );
      return;
    }
    await this.put(
      `/management/v1/users/${encodeURIComponent(userId)}/grants/${encodeURIComponent(grant.grantId)}`,
      { roleKeys: restantes },
      correlationId,
      { orgId: zitadelOrgId },
    );
  }

  // DOC-024 — hallazgo real al verificar contra el Zitadel de devops/local (2026-08-21), no
  // documentado en la referencia pública: un usuario en USER_STATE_INITIAL (cualquier
  // Profesional de AFT recien creado por crearUsuarioHuman en este stack sin SMTP, que nunca
  // completa su primer login) NO se puede desactivar — Zitadel responde
  // "User with state initial can only be deleted not deactivated". Se resuelve el estado primero
  // (en vez de intentar `_deactivate` y parsear el mensaje de error de un 404 generico, que
  // `call()` ya traduce a NotFoundException sin distinguir "no existe" de "existe pero en el
  // estado equivocado") y se elige DELETE o `_deactivate` segun corresponda — único caso donde
  // este servicio borra un usuario de verdad en vez de solo desactivarlo.
  async desactivarUsuario(
    zitadelOrgId: string,
    userId: string,
    correlationId: string,
  ): Promise<void> {
    const estado = await this.obtenerEstadoUsuario(
      zitadelOrgId,
      userId,
      correlationId,
    );
    if (estado === USER_STATE_INITIAL) {
      await this.delete(
        `/management/v1/users/${encodeURIComponent(userId)}`,
        correlationId,
        { orgId: zitadelOrgId },
      );
      return;
    }
    await this.post(
      `/management/v1/users/${encodeURIComponent(userId)}/_deactivate`,
      {},
      correlationId,
      { orgId: zitadelOrgId },
    );
  }

  private async obtenerEstadoUsuario(
    zitadelOrgId: string,
    userId: string,
    correlationId: string,
  ): Promise<string> {
    const data = await this.get(
      `/management/v1/users/${encodeURIComponent(userId)}`,
      correlationId,
      { orgId: zitadelOrgId },
    );
    return this.parse(obtenerUsuarioResponseSchema, data, 'users/{userId}')
      .user.state;
  }

  private async buscarGrantDeUsuario(
    zitadelOrgId: string,
    userId: string,
    correlationId: string,
  ): Promise<{ grantId: string; roles: string[] } | null> {
    const data = await this.post(
      '/management/v1/users/grants/_search',
      {
        queries: [
          { projectIdQuery: { projectId: this.config.projectId } },
          { userIdQuery: { userId } },
        ],
      },
      correlationId,
      { orgId: zitadelOrgId },
    );
    const parsed = this.parse(
      listarGrantsResponseSchema,
      data,
      'users/grants/_search',
    );
    const grant = parsed.result.find((g) => g.orgId === zitadelOrgId);
    if (!grant) {
      return null;
    }
    return { grantId: grant.id, roles: grant.roleKeys };
  }

  // Gap 1 (flujo real Admin->Directivo->Profesional AFT) — cierra el paso manual de crear la
  // Organización en la Console de Zitadel antes de poder registrarla en CORE
  // (AdministradorService.altaOrganizacion). Verificado real contra el Zitadel de devops/local:
  // `POST /management/v1/orgs` no necesita `x-zitadel-orgid` (el service user opera a nivel de
  // instancia, y crear una organización no está "dentro" de ninguna organización todavía).
  async crearOrganizacion(
    nombre: string,
    correlationId: string,
  ): Promise<OrganizacionZitadel> {
    const data = await this.post(
      '/management/v1/orgs',
      { name: nombre },
      correlationId,
    );
    return this.parse(crearOrganizacionResponseSchema, data, 'orgs');
  }

  // DOC-024 1 — verificado real contra el Zitadel de devops/local (2026-08-21):
  // `PUT /management/v1/orgs/me` con `x-zitadel-orgid` apuntando a la organizacion objetivo
  // renombra ESA organizacion, no la del PAT — mismo truco de header que ya usan crearGrant/
  // otorgarProyectoAOrganizacion para operar sobre una organizacion que no es la dueña del
  // proyecto. `/orgs/me` es real pese al nombre ("mi" organizacion es la que trae el header, no
  // la del service user). Respuesta sin datos utiles (`{ details }`), no se parsea — mismo
  // criterio que el PUT de agregarRolAGrantExistente.
  async actualizarNombreOrganizacion(
    zitadelOrgId: string,
    nombre: string,
    correlationId: string,
  ): Promise<void> {
    await this.put(
      '/management/v1/orgs/me',
      { name: nombre },
      correlationId,
      { orgId: zitadelOrgId },
    );
  }

  // Gap 1 (flujo real Admin->Directivo->Profesional AFT) — hallazgo real: sin esto, ningún
  // usuario puede recibir NUNCA un rol del proyecto "CIS" en la organización recién creada
  // (Zitadel responde "Project not found" — ver el comentario de crearGrant y el de
  // zitadel-admin.types.ts). AdministradorService.altaOrganizacion llama a esto justo después de
  // crearOrganizacion, antes de escribir en CORE.
  async otorgarProyectoAOrganizacion(
    zitadelOrgId: string,
    correlationId: string,
  ): Promise<void> {
    const data = await this.post(
      `/management/v1/projects/${encodeURIComponent(this.config.projectId)}/grants`,
      {
        grantedOrgId: zitadelOrgId,
        roleKeys: [
          ADMINISTRADOR_SISTEMA_ROLE,
          DIRECTIVO_ROLE,
          ADMINISTRADOR_PATRIMONIAL_ROLE,
        ],
      },
      correlationId,
    );
    this.parse(crearProjectGrantResponseSchema, data, 'projects/grants');
  }

  // Gap 0/1 — resuelve el projectGrantId que crearGrant necesita para cualquier organización
  // que NO sea la dueña del proyecto "CIS" (ver el comentario de crearGrant). `null` si la
  // organización no tiene ProjectGrant — hoy eso solo pasa para la organización dueña del
  // proyecto ("DUOC UC"), que no lo necesita. Mismo motivo que listarGrants para filtrar en
  // memoria: `_search` no filtra por `grantedOrgId` en la request (devuelve todos los grants del
  // proyecto), verificado real contra el Zitadel de devops/local.
  private async resolverProjectGrantId(
    zitadelOrgId: string,
    correlationId: string,
  ): Promise<string | null> {
    const data = await this.post(
      `/management/v1/projects/${encodeURIComponent(this.config.projectId)}/grants/_search`,
      {},
      correlationId,
    );
    const parsed = this.parse(
      listarProjectGrantsResponseSchema,
      data,
      'projects/grants/_search',
    );
    const grant = parsed.result.find((g) => g.grantedOrgId === zitadelOrgId);
    return grant?.grantId ?? null;
  }

  // Gap 3 (flujo real Admin->Directivo->Profesional AFT) — DirectivoService.asignarProfesionalAft
  // llama a esto solo cuando buscarUsuarioPorEmail ya confirmó que el email no existe todavía.
  // `isEmailVerified: true` + password ya fijada (en vez del flujo nativo de invitación por
  // correo de Zitadel) porque este stack no tiene SMTP configurado — mismo motivo ya documentado
  // en devops/local/README.md para usuarios de prueba creados a mano: sin esas dos cosas, el
  // usuario queda en estado "Initial" esperando un email que nunca llega. La contraseña generada
  // se devuelve para que el Directivo la comparta fuera de banda — nunca se persiste acá ni se
  // loguea.
  async crearUsuarioHuman(
    email: string,
    correlationId: string,
  ): Promise<{ userId: string; passwordInicial: string }> {
    const passwordInicial = this.generarPasswordInicial();
    const data = await this.post(
      '/management/v1/users/human',
      {
        userName: email,
        profile: { firstName: email, lastName: email },
        email: { email, isEmailVerified: true },
        password: { password: passwordInicial, changeRequired: true },
      },
      correlationId,
    );
    const { userId } = this.parse(
      crearUsuarioHumanResponseSchema,
      data,
      'users/human',
    );
    return { userId, passwordInicial };
  }

  // Longitud y alfabeto elegidos para pasar cómodo cualquier política de complejidad razonable de
  // Zitadel sin caracteres que rompan copy/paste (sin espacios, sin comillas).
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

  private async post(
    path: string,
    body: unknown,
    correlationId: string,
    options: { orgId?: string; translateConflict?: boolean } = {},
  ): Promise<unknown> {
    return this.call(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.post(`${this.config.issuer}${path}`, body, {
          headers: this.headers(correlationId, options.orgId),
        }),
      options.translateConflict ?? false,
    );
  }

  private async put(
    path: string,
    body: unknown,
    correlationId: string,
    options: { orgId?: string } = {},
  ): Promise<unknown> {
    return this.call(path, correlationId, () =>
      this.httpService.axiosRef.put(`${this.config.issuer}${path}`, body, {
        headers: this.headers(correlationId, options.orgId),
      }),
    );
  }

  private async get(
    path: string,
    correlationId: string,
    options: { orgId?: string } = {},
  ): Promise<unknown> {
    return this.call(path, correlationId, () =>
      this.httpService.axiosRef.get(`${this.config.issuer}${path}`, {
        headers: this.headers(correlationId, options.orgId),
      }),
    );
  }

  private async delete(
    path: string,
    correlationId: string,
    options: { orgId?: string } = {},
  ): Promise<unknown> {
    return this.call(path, correlationId, () =>
      this.httpService.axiosRef.delete(`${this.config.issuer}${path}`, {
        headers: this.headers(correlationId, options.orgId),
      }),
    );
  }

  private headers(
    correlationId: string,
    orgId?: string,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      'x-correlation-id': correlationId,
      ...(orgId ? { [ZITADEL_ORG_HEADER]: orgId } : {}),
    };
  }

  // Mismo criterio de reintentos + circuit breaker que CoreClientService/CipClientService (WAF
  // 4) — un 404 (usuario/grant inexistente) se traduce, el resto colapsa a 502 sin exponer
  // detalle interno de Zitadel.
  private async call(
    path: string,
    correlationId: string,
    request: () => Promise<AxiosResponse>,
    translateConflict = false,
  ): Promise<unknown> {
    try {
      const response = await this.breaker.execute(() =>
        withRetry(request, {
          maxAttempts: ZITADEL_RETRY_MAX_ATTEMPTS,
          baseDelayMs: ZITADEL_RETRY_BASE_DELAY_MS,
          shouldRetry: isTransientZitadelError,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof CircuitOpenError) {
        throw new BadGatewayException({
          message: `Zitadel no disponible (circuito abierto) al pedir ${path}`,
        });
      }
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw new NotFoundException({
          message: `Zitadel no encontró el recurso en ${path}`,
        });
      }
      // Solo la creación de grants (crearGrant) espera y maneja este caso puntual — el resto de
      // las llamadas (búsquedas) nunca deberían recibir un 409 real, así que ahí se deja caer al
      // 502 genérico de abajo en vez de arriesgar que ZitadelGrantConflictError se escape sin
      // capturar.
      if (
        translateConflict &&
        error instanceof AxiosError &&
        error.response?.status === 409
      ) {
        throw new ZitadelGrantConflictError();
      }
      throw new BadGatewayException({
        message: `No se pudo resolver ${path} contra la API de administración de Zitadel`,
      });
    }
  }

  private parse<T>(schema: ZodType<T>, data: unknown, label: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success || parsed.data === undefined) {
      throw new BadGatewayException({
        message: `Zitadel devolvió una respuesta de ${label} con forma inesperada`,
      });
    }
    return parsed.data;
  }
}
