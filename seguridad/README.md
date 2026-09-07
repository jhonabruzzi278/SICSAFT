# Seguridad / Identidad / Permisos SICSAFT (capacidad transversal — SEC)

## Objetivo
Capa transversal de autenticación, autorización (RBAC) y control de acceso que atraviesa CIS, CORE,
los portales WEB y las fuentes de captura.
Modelo de gobierno: **Usuario → Organización → Contrato (vigencia, módulos, sedes) → Sede/Área → Rol → Permisos → Acción**.

El proveedor de identidad oficial y único es **Keycloak 26** ([ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)),
operando bajo el protocolo OIDC (flujo Authorization Code + PKCE) con Organizations habilitadas.

## Estado
🟢 **Implementado y verificado**:
- **Keycloak 26 OIDC**: Realm `sicsaft`, validación de tokens JWT mediante `KeycloakAuthGuard` en CIS y gestión de identidades vía `KeycloakAdminService` (`client_credentials`).
- **Resolución de Roles por Organización**: Los realm roles se asocian a grupos `{organizacionId}::{rol}` para garantizar aislamiento multi-tenant estricto.
- **Entitlements y Contratos**: Modelo de `Contrato` persistido en Postgres BPI ([`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md)) servido por `GET /entitlements` en CORE y consumido por CIS con autenticación interna por token (`CORE_SERVICE_TOKEN`).

## Roles del Ecosistema

### 1. Administrador Patrimonial (Profesional de AFT) — `administrador-patrimonial`
- Rol operativo oficial (Tomo III 1.4). Único facultado para la escritura y modificación oficial de la BPI (alta, baja, reincorporación, traslados de activos, definición de estructura y conciliación de inventarios).
- Opera a través del portal **CCP (Centro de Control Patrimonial)**.

### 2. Directivo — `directivo`
- Rol ejecutivo de mayor jerarquía a nivel de organización.
- Capacidades: Visualización de dashboards gerenciales de sólo lectura y designación/asignación del Profesional de AFT de su organización.
- Opera a través del portal **CORE frontend (Portal del Directivo)**.

### Portales y Segregación
| Rol (Keycloak) | Nombre Funcional | Portal | Entorno |
|---|---|---|---|
| `administrador-patrimonial` | Profesional de AFT | `ccp/` | Embebido en `.exe` / `ccp.sicsaft.localhost` |
| `directivo` | Directivo | `core/frontend/` | Embebido en `.exe` / `directivo.sicsaft.localhost` |

*Regla no negociable:* **Dos portales, dos roles, dos logins independientes** (DOC-022). En `sicsaft-core` (.exe) se integran tras una vista de login que detecta el rol y enruta al portal respectivo.

## Depende de
- **Keycloak 26** como servidor OIDC.
- Esquema de `Contrato` y entidades en Postgres BPI (`core/migrations/`).

## Bloquea
- Autorización en CIS/CORE y control de acceso en frontends (APP QR, CCP, CORE frontend).

## Documentos Relacionados
- [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — Adopción oficial de Keycloak 26.
- [DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) — Modelo de Contrato y Entitlements.
- [DOC-012](DOC-012-administrador-patrimonial.md) — Rol Profesional de AFT y flujos de escritura oficial.
- [DOC-023](../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md) — Matriz completa de permisos RBAC.
- [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) — Principio de Cero Confianza y Mínimo Privilegio.

