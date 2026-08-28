# Seguridad / Identidad / Permisos SICSAFT (capacidad transversal — SEC)

## Objetivo
No es un sistema aislado: es una capa transversal que atraviesa CIS, CORE, los tres portales WEB
y toda fuente de captura. Modelo: Usuario → Organización → Contrato (vigencia, módulos, sedes
cubiertas) → Sede/Área → Rol → Permisos → Acción — ver
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) para el porqué de agregar "Contrato"
al modelo original. El **proveedor** de identidad cambió de Zitadel a Keycloak self-hosted
([ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md), 2026-08-27, porque Zitadel no
publica binario nativo de Windows y la instalación on-premise sin Docker/WSL2 — `sicsaft-core.exe`
— lo necesita); el modelo Organización→Contrato→Sede no cambió.

## Estado
🟡 Mecanismo de identidad decidido **e implementado en CIS**: **Keycloak** self-hosted, OIDC/OAuth2
(realm `sicsaft`, Organizations habilitado) — ver
[ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) (reemplaza a ADR-002 en el
proveedor). `cis/src/common/auth/` (`KeycloakAuthGuard`) valida tokens de Keycloak reales
(firma/JWKS, `iss`, `aud`, vencimiento) y resuelve `rolesPorOrganizacion` vía
`cis/src/keycloak-admin/` (`KeycloakAdminService`, grupos `{organizacionId}::{rol}` con caché
corta) — los realm roles de Keycloak son una lista plana global por usuario, no un claim anidado
por organización como el de Zitadel (DOC-027 BUG-02), así que la organización no viaja en el JWT
del cliente, se resuelve server-side. El modelo de dominio de `Contrato` también está documentado
**e implementado sobre Postgres real**:
[`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md) +
`core/src/entitlements/` sirviendo `GET /entitlements` contra la base `core` (esquema versionado
en `core/migrations/`), ya consumido por CIS en `auth/session`
(`cis/src/core-client/`) y protegido con auth servicio-a-servicio (secreto compartido
`CORE_SERVICE_TOKEN`, `core/src/common/auth/service-token.guard.ts` — comparación en tiempo
constante, CIS es el único llamador válido). Lo que sigue sin resolver: `sedeId`/vigencia de
contrato con **datos reales de negocio** (la base `core` hoy solo tiene el caso DUOC UC/Melipilla
precargado y no hay mapeo operador→organización — cualquier operador ve el mismo resultado hoy,
ver DOC-004 7). El token del operador solo trae `sub`/identidad, no sede — coincide con ADR-002
"Punto de validación" (vigente bajo ADR-004): eso se resuelve en CORE, no en el token.

## Permisos previstos
Consultar, crear, modificar, eliminar, autorizar, exportar, administrar, configurar — bajo
principio de mínimo privilegio necesario.

### Rol ✅ implementado: Administrador Patrimonial (Tomo III 1.4, Entrada 4) — nombre funcional: Profesional de AFT
El tomo oficial define un rol que hasta la Fase 4 no existía en ningún sistema del ecosistema: el
**Administrador Patrimonial** (`administrador-patrimonial` es el nombre técnico del realm role de
Keycloak; **Profesional de AFT** es el nombre funcional/oficial con el que el negocio identifica a
quien lo ejerce — ver [DOC-012 "Nomenclatura"](DOC-012-administrador-patrimonial.md)), el único
autorizado a modificar oficialmente la Base Patrimonial
(incorporar/eliminar activos, modificar responsables/áreas, actualizar estados oficiales,
importar bases contables). Ninguna otra entrada (APP QR, Plataforma WEB, RFID) puede hacerlo
directamente — ver [ARQUITECTURA-WAF.md 11](../ARQUITECTURA-WAF.md#11-entradas-y-salidas-oficiales-del-ecosistema-tomo-iii-cap1)
para la matriz completa de permisos por entrada. Diseño completo en
[DOC-012](DOC-012-administrador-patrimonial.md). **Ya implementado, las 3 operaciones que Tomo
III 1.4 le exige**: realm role de Keycloak, resuelto por `KeycloakAuthGuard` en CIS vía
`KeycloakAdminService` (grupos `{organizacionId}::{rol}`) y expuesto como `rolesPorOrganizacion`
(nunca una lista plana sin organización — corrige un hallazgo real de revisión de seguridad;
bajo Zitadel esto venía en el claim `urn:zitadel:iam:org:project:roles`, con Keycloak lo resuelve
el guard, DOC-027 BUG-02), autorización verificada en CORE por organización dentro de
`OrquestadorService`, los 4 endpoints de escritura de `Activo` (alta/baja/reincorporación/
cambio de responsable, `core/src/patrimonial/activo-escritura.controller.ts`), importación masiva
idempotente por fila de base contable (`POST /importaciones/contable`,
`core/src/patrimonial/importacion-contable.service.ts`, precursor manual de `CON-CONTABILIDAD`) y
escritura de `Contrato` (`POST /contratos`, `PATCH /contratos/:id`,
`core/src/entitlements/contrato-escritura.controller.ts` + `escritura-contrato.service.ts`).
**Pendiente**: las 4 acciones restantes de Gestión de Permisos (Autorizar/Exportar/Administrar/
Configurar) — sin consumidor real hasta que WEB (Fase 5) tenga su propio ABM.

### Rol ✅ implementado: Administrador del Sistema (DOC-021, sin fuente en un tomo — vision del usuario 2026-08-18)
Segundo realm role de Keycloak (`administrador-sistema`), administra la **plataforma**
(organizaciones, contratos además del Profesional de AFT, usuarios, indicadores) — nunca
información patrimonial (Activos/Catálogo/Documentos siguen exclusivos de
`administrador-patrimonial`, y simétricamente el Profesional de AFT nunca administra la
plataforma). Diseño completo en
[DOC-021](../aidlc-docs/ccp/design-artifacts/DOC-021-cobertura-ccp-y-administrador-sistema.md),
extraído a su propio portal (`web_admin/`) por
[DOC-022](../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md).
Único caso de este repo con autorización server-side en dos niveles distintos según el endpoint:
`POST /organizaciones` (verifica el rol en **cualquier** organización del token, vía el
Orquestador de CORE — `verificarRolEnCualquierOrganizacion`, DOC-022 2, no una organización
puntual como el resto de las escrituras oficiales) y `GET/POST /organizaciones/:orgId/usuarios`
(guard normal de CIS, `AdministradorSistemaGuard` — no pasa por CORE, es gestión de identidad en
el proveedor de identidad, no información patrimonial auditable por Tomo IV). `POST/PATCH /contratos`
generalizado para aceptar este rol además de `administrador-patrimonial` (Tomo III 1.4 no le quita
esa capacidad al Profesional de AFT). Integración real con la Admin REST API para asignar usuarios
— hoy `cis/src/keycloak-admin/` (`KeycloakAdminService`, ADR-004 Fase 1). La versión Zitadel de
esto (`cis/src/zitadel-admin/`, **verificada real contra Zitadel v2.65 el 2026-08-19**, DOC-022 4)
corrigió en su momento dos bugs de la API de Zitadel que la documentación pública no revelaba
(`listarGrants` pedía un filtro de organización que la API real no tiene; `crearGrant` no sabía
sumar un rol a un usuario que ya tenía otro rol en el mismo proyecto) — ese módulo ya no existe,
pero la lógica de negocio se portó tal cual a `keycloak-admin/`. El equivalente de Keycloak trajo
sus propios hallazgos: `POST /organizations/{id}/members` roto en Keycloak 26.0.0-26.0.5 y luego
exigiendo string JSON con comillas + `Content-Type` explícito (DOC-027 BUG-25/26) — ver
`cis/README.md`.

### Rol ✅ implementado: Directivo (DOC-020, reestructurado por DOC-022 3/4 el 2026-08-19)
Tercer realm role de Keycloak (`directivo`) — el de **mayor privilegio a nivel de
organización**: dashboard ejecutivo de solo lectura (RF-09/DOC-019) y designación de quién es el
Profesional de AFT de su propia organización (`administrador-patrimonial`). Nunca información
patrimonial en sí (Activos/Catálogo/Documentos exclusivos del Profesional de AFT en CCP) ni
administración de plataforma (exclusiva del Administrador del Sistema en `web_admin/`). Portal
propio (`core/frontend/`, ver ese README) — hasta DOC-022 vivía dentro de CCP con una redirección
automática al Dashboard (DOC-020, superado). El límite de organización es **estructural, no solo
verificado por tests**: `DirectivoGuard` (`cis/src/directivo/directivo.guard.ts`) nunca acepta un
organizacionId de ruta o body para este rol, siempre lo deriva del propio JWT — si el rol
`directivo` no aparece en exactamente una organización del token, rechaza con 403. Mismo enfoque
de autorización en dos niveles que Administrador del Sistema: `GET/POST /directivo/usuarios` es
gestión de identidad en el proveedor de identidad (guard normal de CIS, no pasa por CORE),
reusando el mismo `KeycloakAdminService` (ver arriba). Diseño completo en
[DOC-022](../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md).
La tercera capacidad que el usuario mencionó para este rol ("valida") queda explícitamente fuera
de alcance — sin tomo ni definición todavía, ver DOC-022 "Fuera de alcance".

## Mapeo rol → portal → hostname (local)

| Realm role (Keycloak) | Nombre funcional | Portal | Hostname (local) |
|---|---|---|---|
| `administrador-patrimonial` | Profesional de AFT | `ccp/` | `ccp.sicsaft.localhost` |
| `administrador-sistema` | Administrador del Sistema | `web_admin/` | `admin.sicsaft.localhost` |
| `directivo` | Directivo | `core/frontend/` | `directivo.sicsaft.localhost` |

Tres portales, tres roles, tres logins — nunca uno compartido (DOC-022, regla no negociable de
`CLAUDE.md`). Los tres son SPAs independientes contra el mismo realm `sicsaft` de Keycloak, cada
uno con su propio client OIDC público con PKCE (ver `devops/local/README.md` "Cliente OIDC real"
para cada uno). **Excepción — `sicsaft-core.exe`** (CORE-RF-04): la app de escritorio embebe `ccp`
y `core/frontend` detrás de **un** login embebido (el formulario real de Keycloak en una
`WebContentsView`) que lee `realm_access.roles` del JWT y muestra el portal que corresponde —
sigue siendo un token por portal, pero el operador tipea sus credenciales una sola vez. `web_admin`
no se embebe. Ver [DOC-027](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) §F.

## Capacidades previstas
Autenticación, refresh/expiración de sesión, RBAC, segregación por organización, segregación
por área, auditoría de accesos, rate limiting, TLS, gestión de secretos, políticas de
contraseña, protección de APIs, logs de acceso.

## Depende de
Más datos reales de Base Patrimonial (hoy solo un caso precargado) y mapeo operador→organización
(membership real de la Organization en Keycloak) para que `GET /entitlements` deje de devolver el
mismo resultado a cualquier operador — ver DOC-004 7.

## Bloquea
CIS (validar `sedeId`/contrato vigente en cada request — ver ADR-002), CORE (autorización), los
tres portales WEB (`ccp/`, `web_admin/`, `core/frontend/` — roles/permisos), APP QR (login de
operador — TASK futura), `sicsaft-core.exe` (reusa `KeycloakAdminService`/`KeycloakAuthGuard` y el
modelo de roles por Organization tal cual, ver `aidlc-docs/sicsaft-core/`).

## Documentos relacionados
[ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) (proveedor de identidad actual:
Keycloak self-hosted; reemplaza a ADR-002 en el proveedor, no en el modelo).
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (modelo Organización→Contrato→Sede,
flujo de login — vigente; el proveedor Zitadel que describe fue reemplazado por ADR-004).
[DOC-027](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) — bitácora
de bugs reales de la migración a Keycloak (realm roles globales no anidados, Admin API con
comportamientos no documentados, secure context y armado de URLs OIDC).
[`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md)
(modelo de `Contrato` — entidades, estados, invariantes, cómo lo consume CIS).
[DOC-012](DOC-012-administrador-patrimonial.md) — diseño del rol Administrador Patrimonial y el
camino de escritura oficial (Fase 4 del ROADMAP), items 1/3/4/5 implementados, ver "Estado" de
este documento.
[`ccp/DOC-023`](../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md) — matriz de
permisos por rol (Rol × Módulo × Acción) extraída endpoint por endpoint de los guards reales de
CIS/CORE; encontró y corrigió el mismo día un hallazgo real (`GET /admin/indicadores` sin guard de
rol en backend, solo restringido en la UI de `web_admin/` — ver `AdministradorSistemaEnCualquierOrganizacionGuard`
en `cis/src/administrador/`).
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 3 (cero confianza entre niveles, permisos
mínimos necesarios, segregación por organización/área validada en el CORE, no solo en el cliente
— ahora extendida a sede/contrato).

## Próximo paso sugerido
El círculo CIS↔CORE↔`Contrato` ya está cerrado, protegido y sobre Postgres real (DOC-004,
`core/src/entitlements/`, `cis/src/core-client/`, secreto compartido). El siguiente paso con
valor real es que CORE tenga más datos reales (resto de los 11 dominios, DOC-005) y motores
reales sobre los que aplicar todo esto — hoy solo `Contrato`/`Sede`/`Organizacion` tienen tabla.
