# core/frontend — Portal del Directivo SICSAFT (SYS-10)

## Objetivo
Portal WEB exclusivo del rol **Directivo** (`directivo`), orientado a directores y tomadores de decisiones.
Provee visualización del dashboard gerencial ejecutivo (RF-09 / CIP) y la funcionalidad de designación del
**Profesional de AFT** (`administrador-patrimonial`) de su propia organización.

Físicamente reside bajo `core/frontend/`, pero **le habla a CIS mediante OIDC/HTTP, nunca a CORE directamente** ([ADR-003](../../adr/ADR-003-frontend-de-core-para-directivo.md)).

## Estado
🟢 **Completamente funcional y verificado**:
- **Autenticación OIDC + PKCE con Keycloak 26** ([ADR-004](../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)).
- **Dashboard Ejecutivo**: Lectura consolidada de indicadores patrimoniales vía `cis/src/dashboard-connector/`.
- **Designación de Profesional de AFT**: `GET/POST /directivo/usuarios` en CIS, protegido por `DirectivoGuard` que asegura el aislamiento multi-tenant basándose en el JWT.
- **Empaquetado en `.exe`**: Embebido dentro de `sicsaft-core` sirviendo en `directivo.sicsaft.localhost` o en ventana nativa tras login por rol.

## Desarrollo y Ejecución Local

```bash
cd core/frontend
cp .env.example .env
npm install
npm run dev             # Servidor Vite en http://localhost:5177
npm run build           # Compilación TypeScript + Vite
```

### Variables de Entorno (`.env`)
```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=sicsaft
VITE_KEYCLOAK_CLIENT_ID=core-frontend
VITE_CIS_URL=http://localhost:3000
```

## Depende de
- **CIS (`cis/`)**: Gateway para resolver el dashboard ejecutivo y la gestión del Profesional de AFT.
- **Keycloak 26**: Proveedor de identidad OIDC.

## Bloquea
- Ningún subsistema depende de `core/frontend/` (es un cliente final).

## Documentos Relacionados
- [ADR-003](../../adr/ADR-003-frontend-de-core-para-directivo.md) — Despliegue de frontend de Directivo en `core/` comunicándose vía CIS.
- [ADR-004](../../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — Autenticación oficial Keycloak 26.
- [DOC-022](../../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md) — Reestructuración y separación de portales por rol.
- [DOC-027](../../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) — Bitácora de gotchas y pruebas reales.

## Próximo Paso Sugerido
- Mantener sincronizadas las métricas del dashboard ejecutivo a medida que se incorporen nuevos indicadores en CIP.

