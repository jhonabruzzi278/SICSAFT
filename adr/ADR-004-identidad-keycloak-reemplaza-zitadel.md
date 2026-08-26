# ADR-004: Identidad y SSO — Keycloak self-hosted reemplaza a Zitadel

## Status
Aceptada — reemplaza a [ADR-002](ADR-002-identidad-zitadel-multi-tenant.md). Fase 1 (`cis/`)
implementada; fases siguientes (4 portales, 3 stacks de `devops/`) pendientes — ver
"Consequences" y `cis/README.md` "Estado".

## Context

[ADR-002](ADR-002-identidad-zitadel-multi-tenant.md) eligió Zitadel por su modelo nativo de
"Organización" (mapea 1:1 con tenant) y por ser Docker-first, coherente con el resto del ecosistema
en ese momento. Esa premisa deja de sostenerse: `devops/onprem/` necesita distribuirse como un
instalador Windows nativo sin Podman/Docker/WSL2 de por medio (decisión de producto — ver
`aidlc-docs/devops/`), y Zitadel no publica binario oficial de Windows — solo Linux, macOS, Docker
y Kubernetes. Compilarlo nosotros mismos para Windows es técnicamente posible (es Go, cross-compila
sin problema en teoría), pero significa mantener un build no oficial y no probado por el fabricante
del componente más crítico de seguridad de todo el ecosistema — riesgo inaceptable para algo que
valida identidad de cada usuario de cada portal.

Verificado contra documentación actual (no de memoria): Keycloak sí tiene distribución Windows
oficial (ZIP + `kc.bat`, corre sobre JVM — Java 17 mínimo, 21 recomendado en la línea 26.x) y usa
Postgres 16/17 en producción — mismo motor de base de datos que ya usa todo el ecosistema
(`base-patrimonial/DOC-004-modelo-contrato.md`), sin introducir un motor nuevo.

El punto que mantenía a Zitadel como mejor encaje — modelar "Organización" como entidad nativa —
ya no es una ventaja exclusiva: Keycloak introdujo su feature de **Organizations** (GA/estable
desde Keycloak 26), pensada específicamente para multi-tenancy B2B dentro de un solo realm — un
realm compartido puede alojar múltiples "Organizations", cada una con sus propios usuarios,
dominios de email e IdP externo si hiciera falta. Esto da un mapeo casi directo del modelo actual
sin necesitar un realm por cliente.

## Decision

**Identidad/SSO: Keycloak, self-hosted, en los 3 stacks de devops (`local/`, `prod/`, `onprem/`).**

Un solo modelo de identidad para todo el ecosistema, sin bifurcar por perfil de despliegue:

- **Un realm único (`sicsaft`)** en los 3 entornos. En `devops/local/`/`devops/prod/` (instancia
  compartida, multi-cliente) cada tenant es una **Organization** de Keycloak dentro de ese realm —
  reemplazo directo de la "Organización" de Zitadel. En `devops/onprem/` (una instancia aislada por
  cliente, ver `aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md`) el mismo
  realm igual existe con una sola Organization activa — sin caso especial en código: `cis/` habla
  siempre contra "un realm con Organizations", nunca necesita saber si está en modo compartido o
  aislado.
- **Roles de producto** (`profesional-aft`, `directivo`, `administrador-sistema`) pasan a ser
  **realm roles** de Keycloak — hoy son roles del "Proyecto CIS" de Zitadel, compartidos por los 4
  portales; en Keycloak esa noción de "proyecto compartiendo roles entre apps" es exactamente lo
  que ya hacen los realm roles por defecto, sin necesitar un concepto adicional.
- **Cada portal** (`app-qr-sicsaft`, `web-admin-sicsaft`, `core-frontend-sicsaft`, `ccp-sicsaft`)
  pasa a ser un **client OIDC público** (authorization code + PKCE, `standardFlowEnabled`,
  `publicClient`) del realm `sicsaft` — mismo rol que las "Apps OIDC" de Zitadel hoy, 1:1.
- **Sin cambios en el modelo de Contrato/Sede**: ese dominio vive enteramente en Base Patrimonial
  (`base-patrimonial/DOC-004-modelo-contrato.md`), nunca en el IdP — ADR-002 ya estableció "el
  punto de validación es el CIS, no el token" (el JWT no codifica sedes habilitadas, CIS resuelve
  contra un caché de entitlements). Ese principio se mantiene sin cambios con Keycloak: el JWT
  lleva `sub`/rol(es) de realm/claim de `organization`, nada de vigencia de contrato.
- **Bootstrap sin Console manual**: Keycloak soporta un admin de arranque configurable por variables
  de entorno (`KC_BOOTSTRAP_ADMIN_USERNAME`/`KC_BOOTSTRAP_ADMIN_PASSWORD`) — el equivalente al
  `ZITADEL_FIRSTINSTANCE_*`/PAT auto-provisionado que ya usa `devops/onprem/`. El bootstrap de cada
  cliente pasa a autenticar ese admin, crear (o reusar) un client confidencial con
  `serviceAccountsEnabled` para obtener un token vía `client_credentials`, y desde ahí llamar a la
  Admin REST API de Keycloak (`/admin/realms/{realm}/...`) — mismo patrón de "un script hace todo,
  sin tocar la consola web" que ya tienen `bootstrap-zitadel.ps1`/`Bootstrap-Zitadel.psm1`.

### Alternativas descartadas

**Mantener Zitadel corriendo dentro de una WSL2 oculta** (el instalador la automatiza, invisible
para el cliente final): técnicamente resuelve el empaquetado, pero WSL2 sigue siendo una
dependencia real (virtualización habilitada en BIOS/Windows Features, reinicios, espacio en disco,
otra superficie de fallo ya documentada en `devops/onprem/README.md` — varios bugs reales
encontrados ahí). Contradice el objetivo explícito de esta fase: que toda la aplicación viva en el
ejecutable, sin ninguna capa de compatibilidad Linux de por medio, ni siquiera oculta.

**Cross-compilar Zitadel para Windows nosotros mismos**: Go permite compilación cruzada sin
problema en teoría, pero Zitadel nunca prueba ni soporta ese binario — cualquier diferencia de
comportamiento en Windows (manejo de señales para shutdown graceful, separadores de ruta,
comportamiento del filesystem) quedaría sin ningún canal de soporte del fabricante, en el
componente que valida la identidad de cada usuario de cada portal del ecosistema. Riesgo
desproporcionado para lo que se gana.

**Reemplazar Zitadel solo en `devops/onprem/`, mantenerlo en `local/`/`prod/`**: evita reabrir la
decisión para el ecosistema completo, pero obliga a `cis/src/zitadel-admin/` y a
`cis/src/common/auth/` a soportar dos proveedores de identidad distintos según el perfil de
despliegue — dos APIs de administración, dos esquemas de validación de JWT, dos bootstraps
distintos para mantener indefinidamente. Con un equipo de una persona, dos IdPs en paralelo es la
peor combinación de complejidad para el beneficio que da; converger a uno solo es más simple a
mediano plazo aunque el costo de migración inicial sea mayor.

## Consequences

- **`cis/src/zitadel-admin/`** se reescribe contra la Admin REST API de Keycloak (endpoints,
  payloads y auth completamente distintos a la Management API de Zitadel) — misma responsabilidad
  (alta/edición de organización, usuarios, roles desde `web_admin` sin pasar por la consola del
  IdP, ver DOC-021/DOC-024).
- **`cis/src/common/auth/`** (JWKS + validación de JWT) cambia el `issuer`/JWKS URI (Keycloak:
  `/realms/sicsaft/protocol/openid-connect/certs`, no `/oauth/v2/keys` de Zitadel) y los nombres de
  claim que lee (`realm_access.roles`/`organization` de Keycloak en vez de `roles[]`/`org_id` de
  Zitadel). La librería (`jose`, `createRemoteJWKSet`) y el mecanismo (JWT firmado, JWKS remoto,
  caché de 10 min) no cambian — sigue siendo OIDC estándar.
- **Login de los 4 portales** (`*/src/lib/oidc/`): cambia el `issuer`/`client_id` configurados, pero
  el flujo PKCE en sí (RFC 7636, `pkce.ts` — generación de `code_verifier`/`code_challenge` vía
  `crypto.subtle.digest`) es estándar OIDC y no depende del proveedor — no hace falta tocar esa
  lógica, solo la config de issuer/client por entorno.
- **DOC-023** (matriz RBAC Rol×Módulo×Acción) y **DOC-024** (auditoría de identidad) se actualizan
  para reflejar los guards/patrones de integración nuevos — el contenido de la matriz de permisos
  en sí (qué rol puede qué acción) no cambia, cambia cómo se obtiene el rol del token.
- Bootstrap de identidad en los 3 stacks de devops (`devops/onprem/lib/Bootstrap-Zitadel.psm1` y
  equivalentes de `local/`/`prod/`) se reescribe contra la Admin REST API de Keycloak.
- **Sin migración de datos**: confirmado que `devops/prod/` todavía no tiene organizaciones/usuarios
  reales corriendo (2026-08-26) — el corte es una instalación limpia de Keycloak, no una migración
  de datos existentes desde Zitadel.
- El trabajo de implementación (5+ sistemas: `cis/`, 4 portales, 3 stacks de devops) se planea y
  ejecuta como su propia fase de `ROADMAP.md`, en una sesión aparte de este ADR — dado que toca
  varias capas (CORE/CIS/WEB/devops), sigue el patrón de `gh stack` que ya usa el repo para
  incrementos multi-fase (ver CLAUDE.md "Git / commits").
