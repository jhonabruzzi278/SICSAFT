// Port a Node del bootstrap de Keycloak — mismas llamadas a la Admin REST API que
// devops/onprem/lib/Bootstrap-Keycloak.psm1 y sicsaft-core/src/main/keycloak-bootstrap.ts, ya
// verificadas reales call-by-call contra un Keycloak 26.0 (2026-08-26). No se reinventa el diseño
// acá, sólo el lenguaje.
//
// Qué crea, en orden:
//   1. realm `sicsaft` (organizationsEnabled), scope `organization` promovido a default,
//      scope `cis-audience` con Audience mapper fijo a "cis", realm roles de negocio.
//   2. Organization con alias = ORG_ID (== organizacionId de CORE).
//   3. client confidencial `cis-admin` (service account) con los roles de realm-management que
//      usa cis/ → devuelve su client secret.
//   4. clients OIDC públicos (PKCE): ccp-sicsaft, core-frontend-sicsaft, app-qr-sicsaft.
//   5. usuarios Director y Profesional de AFT: password fija NO temporal, miembros de la
//      Organization, en el grupo `{orgId}::{rol}` con el realm role mapeado al grupo.
//
// Idempotente: si el realm ya existe (corrida con KEEP_STACK=1 sin `down -v`), saltea el scaffold,
// recupera el secret de `cis-admin` y garantiza los usuarios (tolera 409).

const REALM = 'sicsaft';
const GRUPO_SEP = '::'; // == GRUPO_ORGANIZACION_ROL_SEPARADOR de cis/src/common/auth/keycloak-auth.constants.ts
const ROLES_DE_NEGOCIO = ['administrador-patrimonial', 'directivo', 'profesional-aft'];
const REINTENTOS_TOKEN = 5;
const ESPERA_REINTENTO_MS = 800;

/** @param {{ keycloakUrl: string, admin: { usuario: string, password: string }, orgId: string, orgNombre: string, dominioBase: string, usuarios: Record<string, { email: string, password: string, rol: string }> }} cfg */
export async function seedKeycloak(cfg) {
  const { keycloakUrl, admin, orgId, orgNombre, dominioBase, usuarios } = cfg;
  const token = await obtenerTokenAdmin(keycloakUrl, admin);

  const yaExiste = await realmExiste(keycloakUrl, token);
  if (yaExiste) {
    console.log(`  realm '${REALM}' ya existe — salteo scaffold, garantizo usuarios`);
  } else {
    await crearRealmScaffold(keycloakUrl, token);
    await crearOrganizacion(keycloakUrl, token, orgNombre, orgId);
    await crearClientesPublicos(keycloakUrl, token, dominioBase);
  }

  const cisAdminSecret = yaExiste
    ? await recuperarSecretClienteAdmin(keycloakUrl, token)
    : await crearClienteAdminCis(keycloakUrl, token);

  for (const clave of Object.keys(usuarios)) {
    const u = usuarios[clave];
    await crearUsuarioHumano(keycloakUrl, token, orgId, u.email, u.password, u.rol);
    console.log(`  usuario '${u.email}' → ${orgId}${GRUPO_SEP}${u.rol}`);
  }

  return { cisAdminSecret };
}

// ── HTTP helpers ────────────────────────────────────────────────────────────────

async function obtenerTokenAdmin(keycloakUrl, admin) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: admin.usuario,
    password: admin.password,
  });
  let ultimo = 0;
  for (let intento = 1; intento <= REINTENTOS_TOKEN; intento += 1) {
    const res = await fetch(
      `${keycloakUrl}/realms/master/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    if (res.ok) return /** @type {{ access_token: string }} */ (await res.json()).access_token;
    ultimo = res.status;
    // 5xx = Keycloak recién arranca y el realm master todavía no responde el token — reintentar.
    if (res.status < 500 || intento === REINTENTOS_TOKEN) break;
    await new Promise((r) => setTimeout(r, ESPERA_REINTENTO_MS));
  }
  throw new Error(`No se pudo autenticar contra Keycloak (master): HTTP ${ultimo}`);
}

/** Llamada a `/admin/realms/{realm}{path}`. Lanza en !ok salvo que el status esté en `permitir`. */
async function api(keycloakUrl, token, method, path, body, permitir = []) {
  const res = await fetch(`${keycloakUrl}/admin/realms/${REALM}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && !permitir.includes(res.status)) {
    throw new Error(
      `Keycloak Admin API ${method} ${path} → HTTP ${res.status}: ${await res.text()}`,
    );
  }
  return {
    status: res.status,
    location: res.headers.get('location'),
    json: async () => (res.status === 204 ? null : res.json()),
  };
}

function idDeLocation(location) {
  if (!location) throw new Error('Keycloak no devolvió header Location');
  const partes = location.split('/');
  const id = partes[partes.length - 1];
  if (!id) throw new Error(`Location con forma inesperada: ${location}`);
  return id;
}

async function realmExiste(keycloakUrl, token) {
  const res = await fetch(`${keycloakUrl}/admin/realms/${REALM}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

// ── Scaffold ───────────────────────────────────────────────────────────────────

async function crearRealmScaffold(keycloakUrl, token) {
  console.log(`  creando realm '${REALM}' (organizationsEnabled)`);
  const resRealm = await fetch(`${keycloakUrl}/admin/realms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ realm: REALM, enabled: true, organizationsEnabled: true }),
  });
  if (!resRealm.ok) {
    throw new Error(`No se pudo crear el realm '${REALM}': HTTP ${resRealm.status}`);
  }

  const scopes = await (await api(keycloakUrl, token, 'GET', '/client-scopes')).json();
  const orgScope = scopes.find((s) => s.name === 'organization');
  if (!orgScope) throw new Error("Keycloak no expuso el client scope 'organization'");

  console.log("  promoviendo scope 'organization' de opcional a default");
  await api(keycloakUrl, token, 'DELETE', `/default-optional-client-scopes/${orgScope.id}`, undefined, [404]);
  await api(keycloakUrl, token, 'PUT', `/default-default-client-scopes/${orgScope.id}`);

  console.log("  creando client scope 'cis-audience' + Audience mapper");
  const audLoc = await api(keycloakUrl, token, 'POST', '/client-scopes', {
    name: 'cis-audience',
    protocol: 'openid-connect',
    attributes: {
      'include.in.token.scope': 'false',
      'display.on.consent.screen': 'false',
    },
  });
  const audScopeId = idDeLocation(audLoc.location);
  await api(keycloakUrl, token, 'POST', `/client-scopes/${audScopeId}/protocol-mappers/models`, {
    name: 'cis-audience-mapper',
    protocol: 'openid-connect',
    protocolMapper: 'oidc-audience-mapper',
    config: {
      'included.custom.audience': 'cis',
      'id.token.claim': 'false',
      'access.token.claim': 'true',
    },
  });
  await api(keycloakUrl, token, 'PUT', `/default-default-client-scopes/${audScopeId}`);

  console.log(`  creando realm roles: ${ROLES_DE_NEGOCIO.join(', ')}`);
  for (const rol of ROLES_DE_NEGOCIO) {
    await api(keycloakUrl, token, 'POST', '/roles', { name: rol }, [409]);
  }
}

async function crearOrganizacion(keycloakUrl, token, nombre, orgId) {
  console.log(`  creando Organization '${nombre}' (alias: ${orgId})`);
  await api(keycloakUrl, token, 'POST', '/organizations', {
    name: nombre,
    alias: orgId,
    domains: [{ name: `${orgId}.sicsaft.invalid`, verified: false }],
  }, [409]);
}

async function crearClientePublico(keycloakUrl, token, clientId, dominio) {
  const origen = `http://${dominio}`;
  await api(keycloakUrl, token, 'POST', '/clients', {
    clientId,
    name: clientId,
    protocol: 'openid-connect',
    publicClient: true,
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: false,
    redirectUris: [`${origen}/auth/callback`],
    webOrigins: [origen],
    attributes: {
      'pkce.code.challenge.method': 'S256',
      'post.logout.redirect.uris': `${origen}/`,
    },
  }, [409]);
  console.log(`  client público '${clientId}' → ${origen}/auth/callback`);
}

async function crearClientesPublicos(keycloakUrl, token, dominioBase) {
  await crearClientePublico(keycloakUrl, token, 'ccp-sicsaft', `ccp.${dominioBase}`);
  await crearClientePublico(keycloakUrl, token, 'core-frontend-sicsaft', `directivo.${dominioBase}`);
  await crearClientePublico(keycloakUrl, token, 'app-qr-sicsaft', `qr.${dominioBase}`);
}

async function crearClienteAdminCis(keycloakUrl, token) {
  console.log("  creando client confidencial 'cis-admin' (service account)");
  await api(keycloakUrl, token, 'POST', '/clients', {
    clientId: 'cis-admin',
    name: 'cis-admin',
    protocol: 'openid-connect',
    publicClient: false,
    standardFlowEnabled: false,
    serviceAccountsEnabled: true,
    directAccessGrantsEnabled: false,
  }, [409]);

  const uuid = await uuidDeCliente(keycloakUrl, token, 'cis-admin');
  const secret = (await (await api(keycloakUrl, token, 'GET', `/clients/${uuid}/client-secret`)).json()).value;
  const saUser = await (await api(keycloakUrl, token, 'GET', `/clients/${uuid}/service-account-user`)).json();
  const rmUuid = await uuidDeCliente(keycloakUrl, token, 'realm-management');

  const nombresRoles = ['manage-users', 'manage-realm', 'query-groups', 'query-users', 'view-users'];
  const roles = await Promise.all(
    nombresRoles.map((n) =>
      api(keycloakUrl, token, 'GET', `/clients/${rmUuid}/roles/${n}`).then((r) => r.json()),
    ),
  );
  await api(keycloakUrl, token, 'POST', `/users/${saUser.id}/role-mappings/clients/${rmUuid}`, roles);
  return secret;
}

async function recuperarSecretClienteAdmin(keycloakUrl, token) {
  const uuid = await uuidDeCliente(keycloakUrl, token, 'cis-admin');
  return (await (await api(keycloakUrl, token, 'GET', `/clients/${uuid}/client-secret`)).json()).value;
}

async function uuidDeCliente(keycloakUrl, token, clientId) {
  const clientes = await (
    await api(keycloakUrl, token, 'GET', `/clients?clientId=${encodeURIComponent(clientId)}`)
  ).json();
  const uuid = clientes[0]?.id;
  if (!uuid) throw new Error(`No se encontró el client '${clientId}'`);
  return uuid;
}

// ── Usuarios ───────────────────────────────────────────────────────────────────

async function crearUsuarioHumano(keycloakUrl, token, orgId, email, password, rol) {
  const creado = await api(keycloakUrl, token, 'POST', '/users', {
    username: email,
    email,
    enabled: true,
    emailVerified: true,
    firstName: email,
    lastName: email,
    requiredActions: [],
    credentials: [{ type: 'password', value: password, temporary: false }],
  }, [409]);

  const userId =
    creado.status === 409
      ? await userIdPorUsername(keycloakUrl, token, email)
      : idDeLocation(creado.location);

  // Password reset explícito — si el usuario ya existía (409), garantiza la password del harness.
  await api(keycloakUrl, token, 'PUT', `/users/${userId}/reset-password`, {
    type: 'password',
    value: password,
    temporary: false,
  });

  const org = await resolverOrganizacionPorAlias(keycloakUrl, token, orgId);
  await agregarMiembro(keycloakUrl, token, org.id, userId);

  const grupoId = await resolverOCrearGrupoRol(keycloakUrl, token, orgId, rol);
  await api(keycloakUrl, token, 'PUT', `/users/${userId}/groups/${grupoId}`, {});
}

async function userIdPorUsername(keycloakUrl, token, username) {
  const arr = await (
    await api(keycloakUrl, token, 'GET', `/users?username=${encodeURIComponent(username)}&exact=true`)
  ).json();
  if (!arr[0]?.id) throw new Error(`No se encontró el usuario '${username}'`);
  return arr[0].id;
}

async function resolverOrganizacionPorAlias(keycloakUrl, token, orgId) {
  const orgs = await (await api(keycloakUrl, token, 'GET', '/organizations')).json();
  const org = orgs.find((o) => o.alias === orgId);
  if (!org) throw new Error(`No hay Organization con alias '${orgId}'`);
  return org;
}

async function agregarMiembro(keycloakUrl, token, orgUuid, userId) {
  // El body es el userId como string JSON (verificado real). 409 = ya era miembro.
  const res = await fetch(
    `${keycloakUrl}/admin/realms/${REALM}/organizations/${orgUuid}/members`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(userId),
    },
  );
  if (!res.ok && res.status !== 409) {
    throw new Error(`No se pudo agregar el usuario a la Organization: HTTP ${res.status}`);
  }
}

async function resolverOCrearGrupoRol(keycloakUrl, token, orgId, rol) {
  const nombre = `${orgId}${GRUPO_SEP}${rol}`;
  const rolDef = await (
    await api(keycloakUrl, token, 'GET', `/roles/${encodeURIComponent(rol)}`)
  ).json();

  const existentes = await (
    await api(keycloakUrl, token, 'GET', `/groups?search=${encodeURIComponent(nombre)}&exact=true`)
  ).json();
  const existente = existentes.find((g) => g.name === nombre);
  const grupoId = existente
    ? existente.id
    : idDeLocation((await api(keycloakUrl, token, 'POST', '/groups', { name: nombre })).location);

  // Idempotente (POST role-mappings/realm no falla si el rol ya está).
  await api(keycloakUrl, token, 'POST', `/groups/${grupoId}/role-mappings/realm`, [
    { id: rolDef.id, name: rolDef.name },
  ]);
  return grupoId;
}
