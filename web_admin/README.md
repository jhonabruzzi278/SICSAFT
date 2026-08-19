# web_admin — Portal del Administrador del Sistema SICSAFT (DOC-022)

## Objetivo

Portal WEB exclusivo del rol **Administrador del Sistema** (`administrador-sistema`) — administra
la *plataforma* SICSAFT: organizaciones, contratos, usuarios (asignación de roles vía integración
real con la API de administración de Zitadel) e indicadores. **Nunca** toca información
patrimonial (Activos/Catálogo/Documentos son exclusivos de [`ccp/`](../ccp), Profesional de AFT) —
ver [DOC-021](../ccp/aidlc-docs/design-artifacts/DOC-021-cobertura-ccp-y-administrador-sistema.md)
§1 y [DOC-022](../ccp/aidlc-docs/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md).

## Estado

🟢 Extraído de `ccp/AdminPage.tsx` en la reestructuración de portales (DOC-022, 2026-08-18) — las
4 secciones (Organizaciones, Contratos, Usuarios, Indicadores) migradas tal cual, mismo patrón de
login OIDC/PKCE que `ccp/`/`app-qr-sicsaft`, contra su propia Application OIDC en Zitadel
(`web-admin-sicsaft`, no reusa `web-sicsaft`). Corrige en el mismo incremento el bug real que
motivó la extracción: crear una organización ya no exige decir "en qué organización tengo el rol"
(`verificarRolEnCualquierOrganizacion` en CORE) — el grant de `administrador-sistema` puede vivir
en cualquier organización, o en ninguna todavía.

**Verificado real de punta a punta contra Docker/Zitadel (2026-08-19, junto con DOC-022 4)**:
login OIDC/PKCE real, alta de organización, y la pestaña **Usuarios** (listado por organización +
asignación de rol) — esta última destapó dos bugs reales en `cis/src/zitadel-admin/` (nunca antes
ejercitados contra una instancia real de Zitadel: `listarGrants`/`crearGrant` mandaban una query y
un manejo de conflicto que la API real rechazaba) corregidos en el mismo incremento, ver
`../cis/README.md` para el detalle.

## Desarrollo local

```bash
cd web_admin
cp .env.example .env   # completar VITE_ZITADEL_CLIENT_ID, ver devops/local/README.md
npm install
npm run dev             # puerto 5176
```

Contra el stack completo: `docker compose up -d --build web-admin` en `devops/local/`, sirve en
`http://admin.sicsaft.localhost` (Traefik).

## Depende de

CIS (`cis/src/administrador/` + `cis/src/zitadel-admin/`, ya implementados en DOC-021) y CORE
(`core/src/entitlements/organizacion.*`, `core/src/indicadores/`).

## Bloquea

Nada — es un cliente más de CIS, ningún otro sistema depende de `web_admin/`.

## Documentos relacionados

[DOC-021](../ccp/aidlc-docs/design-artifacts/DOC-021-cobertura-ccp-y-administrador-sistema.md)
(diseño original del rol Administrador del Sistema, cuando todavía vivía dentro de `ccp/`).
[DOC-022](../ccp/aidlc-docs/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
(diseño de la extracción a este sistema propio).

## Próximo paso sugerido

Nada pendiente propio — verificación real de punta a punta completa (ver "Estado" arriba).
