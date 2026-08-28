# core/frontend — Portal del Directivo SICSAFT (DOC-022)

## Objetivo

Portal WEB exclusivo del rol **Directivo** (`directivo`) — el rol de mayor privilegio a nivel de
organización: dashboard ejecutivo de solo lectura (RF-09, movido desde `ccp/`) y designación de
quién es el Profesional de AFT de su organización (`administrador-patrimonial`, gestión de
identidad acotada a la propia organización). **Nunca** toca información patrimonial en sí
(Activos/Catálogo/Documentos son exclusivos de [`../../ccp`](../../ccp), Profesional de AFT) — ver
[DOC-022](../../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
§3/§4.

Vive físicamente dentro de `core/` (por eso "CORE está conformado de backend y frontend"), pero
**le habla a CIS, nunca al backend de CORE directo** — mismo patrón exacto que `ccp/`/`web_admin/`,
documentado formalmente en
[ADR-003](../../adr/ADR-003-frontend-de-core-para-directivo.md). El backend de CORE
(`core/src/`) no gana ninguna superficie HTTP nueva por este incremento.

## Estado

🟢 **Verificado real de punta a punta contra Docker/Zitadel (2026-08-19)**: Application OIDC
`core-frontend-sicsaft` creada en Zitadel, login OIDC/PKCE real con el usuario `directivo-test`
(rol `directivo`, DOC-020), Dashboard con datos reales (copiado de
`ccp/src/pages/DashboardPage.tsx`, RF-09/DOC-019 — sigue existiendo también en `ccp/` porque el
Profesional de AFT lo sigue usando) y la pantalla "Profesional de AFT"
(`GET/POST /directivo/usuarios` de CIS, [cis/src/directivo/](../../cis/src/directivo/), DOC-022 3)
confirmada con dos casos reales: designar un usuario sin grant previo en el proyecto CIS, y sumar
un rol a un usuario que ya tenía otro (esto último destapó dos bugs reales en
`cis/src/zitadel-admin/`, corregidos en el mismo incremento — ver `../README.md` para el detalle).
Sin selector de organización en la pantalla de designación: `DirectivoGuard` en CIS deriva siempre
la organización del propio JWT, no de lo que mande este cliente — confirmado real (el guard dejó
pasar la request y devolvió solo los datos de la organización del token).

## Desarrollo local

```bash
cd core/frontend
cp .env.example .env   # completar VITE_KEYCLOAK_CLIENT_ID, ver devops/local/README.md
npm install
npm run dev             # puerto 5177
```

Contra el stack completo: `docker compose up -d --build core-frontend` en `devops/local/`, sirve
en `http://directivo.sicsaft.localhost` (Traefik). **Nota (2026-08-26)**: `devops/local/docker-compose.yml`
todavía no migró a Keycloak ([ADR-004](../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)
Fase 1 solo cubrió `cis/`) — hoy el stack de Docker Compose sigue levantando Zitadel, así que este
flujo queda temporalmente inconsistente hasta que esa fase se complete.

## Depende de

CIS (`cis/src/directivo/` + `cis/src/dashboard-connector/`, ya implementados) y CORE indirectamente
a través de CIS (`cis/src/core-client/`) — nunca contra CORE directo.

## Bloquea

Nada — es un cliente más de CIS, ningún otro sistema depende de `core/frontend/`.

## Documentos relacionados

[DOC-022](../../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
(diseño de este portal y de la reestructuración completa).
[ADR-003](../../adr/ADR-003-frontend-de-core-para-directivo.md) (por qué vive en `core/` pero le
habla a CIS).
[DOC-020](../../aidlc-docs/ccp/design-artifacts/DOC-020-segmentacion-por-rol-directivo.md)
(diseño original del rol Directivo, cuando todavía era solo-lectura dentro de `ccp/`).
[DOC-019](../../aidlc-docs/ccp/design-artifacts/DOC-019-dashboard-cip-frontend.md) (diseño
original del Dashboard, del que este portal reusa el código tal cual).
[DOC-027](../../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) —
bitácora de bugs reales. Los que tocaron `core/frontend/`: `AppShell` perdiendo la sidebar y
"Cerrar sesión" tras el login client-side por leer `isAuthenticated()` no reactivo durante el
render (BUG-44), el mismo bug de armado de URL de OIDC que `ccp` (BUG-09) y el correo duplicado en
el display name (BUG-43). Salieron cuando `sicsaft-core` embebió este portal.

## Próximo paso sugerido

Verificación de aislamiento entre organizaciones con un usuario real (el límite ya está cubierto
por unit + e2e reales en `cis/test/directivo.e2e-spec.ts` con JWTs firmados de dos organizaciones
distintas — falta repetirlo con un segundo Directivo de prueba real en otra organización desde
este mismo frontend, no solo contra la API).
