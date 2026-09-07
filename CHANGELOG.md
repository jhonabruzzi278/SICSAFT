# Changelog Oficial — SICSAFT

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.0.1] - 2026-09-07

### Added
- **Skills y Auditoría de Seguridad Automatizada**:
  - Integración del catálogo de skills de auditoría (`security-and-hardening`, `security-audit`, `security-best-practices`, `improve-codebase-architecture`) en `.agents/skills/`.
  - Documento de auditoría exhaustiva de vulnerabilidades en [AUDITORIA-VULNERABILIDADES.md](AUDITORIA-VULNERABILIDADES.md).
  - Verificación de duplicados y validación estricta de coherencia contable en `herramientas/etl-contable/`.

### Changed
- **Migración Integral a Bun**:
  - Transición completa del gestor de paquetes de todo el monorepo de `npm` a `bun` (`bun.lock` en los 9 subsistemas).
  - Eliminación de archivos obsoletos `package-lock.json`.
  - Actualización de `Dockerfile`s multi-stage a imágenes base `oven/bun:1-alpine`.
  - Actualización de pipelines de CI/CD en `.github/workflows/` a `oven-sh/setup-bun@v2`.
  - Homologación de comandos de ejecución y desarrollo en `CLAUDE.md` y `sicsaft.ps1`.

### Security
- **SEC-01 (OIDC Token Store)**: Eliminación de persistencia de tokens en `localStorage` en `ccp/src/lib/oidc/token-store.ts`, limitando el ciclo de vida a `sessionStorage` para mitigar ataques XSS.
- **SEC-02 (Protección de Métricas Prometheus)**: Endurecimiento de `cis/src/common/metrics/metrics-token.guard.ts` con política *fail-closed* en entornos de producción si `METRICS_TOKEN` no está configurado.
- **SEC-03 (Seguridad de Credenciales en Ingesta Contable)**: Pasaje seguro de tokens JWT a través de la variable de entorno `ETL_TOKEN` en lugar de argumentos de línea de comandos en `sicsaft-core` y `etl_contable.py`.
- **SEC-04 (Cabeceras de Seguridad HTTP)**: Incorporación de middleware de cabeceras seguras (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`) en `devops/onprem/traefik/dynamic.yml.template` para protección contra Clickjacking y MIME-sniffing.

---

## [1.0.0] - 2026-09-07

### Added
- **Empaquetado Nativo `.exe` ([DOC-030](aidlc-docs/sicsaft-core/design-artifacts/DOC-030-nivel-2-en-sicsaft-core-exe.md))**:
  - Instalador único NSIS (`sicsaft-core.exe`) para Windows con procesos embebidos (PostgreSQL 16 portable, Eclipse Temurin JRE 17, Keycloak 26, CIS, CORE, CIP).
  - Selector de modo en el wizard de instalación: **Nivel 1 (Modo Básico)** y **Nivel 2 (Modo Profesional)**.
  - Consola técnica en vivo para diagnóstico y logs en pantalla.
  - **Mecanismo de Respaldo de Emergencia (BPI)**: Volcados SQL y copias de seguridad de la base patrimonial desde la interfaz y vía script `herramientas/devops/respaldo-bpi.ps1`.
  - **Configuración Automatizada de Red / Firewall**: Script `herramientas/devops/configurar-firewall-sicsaft.ps1` para apertura de puertos 8765, 58080 y 56000 en Windows Defender Firewall.
- **Portales Web Unificados**:
  - Centro de Control Patrimonial (`ccp/`) completo en Nivel 1 y Nivel 2 con 6 módulos activos (Activos, Estructura, Ingesta Excel, Etiquetas QR, Auditoría y Reportes).
  - Portal Directivo (`core/frontend/`) segmentado por rol Keycloak 26 ([DOC-022](aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)).
- **Aplicación de Captura Móvil (`app-qr-sicsaft/` y `apk-aft/`)**:
  - Flujo oficial de captura patrimonial en 8 pasos con soporte offline mediante IndexedDB y cola de reintentos.
  - Servidor PWA en LAN con certificado HTTPS autofirmado y distribución directa de APK nativa (`sicsaft-aft.apk`) con código QR de descarga.

- **Centro de Inteligencia Patrimonial (`cip/`)**:
  - Worker de agregación asíncrono con PostgreSQL y `pg-boss` para cálculo de evolución patrimonial y cobertura.
- **Integración y Automatización con Linear**:
  - Sincronización integral de 6 proyectos, Milestones, Iniciativas y Enlaces de Recursos mediante Linear GraphQL API y Linear MCP Server.
  - Workflow de CI/CD en GitHub Actions (`.github/workflows/linear-sync.yml`).
- **Control de Versiones Profesional**:
  - Gestor de versiones centralizado (`herramientas/versionado/version-manager.mjs` y `actualizar-version.ps1`).

### Changed
- **Estandarización de Documentación**: Todos los `README.md` de subsistemas activos actualizados bajo el estándar de 8 secciones institucionales.
- **Reemplazo de Autenticación ([ADR-004](adr/ADR-004-keycloak-26-reemplaza-autenticacion.md))**: Migración completa a Keycloak 26 OIDC/PKCE con roles por organización.
- **Reemplazo de Cola de Mensajería ([ADR-005](adr/ADR-005-postgres-pgboss-reemplaza-redis.md))**: Eliminación definitiva de Redis en favor de PostgreSQL con `pg-boss`.
- **Nomenclatura Oficial**: Adopción de **BPI (Base Patrimonial Inteligente)** como término oficial en todo el código y documentación.

### Fixed
- **Comentarios Huérfanos ([H-04](documentacion/auditoria/DOC-032-CONTRATO-INSPECCION-PROFUNDA.md))**: Eliminación y resolución de los 14 comentarios huérfanos en `cis/`, `core/`, `cip/` y `ccp/`.
- **Timeout en Login Embebido**: Corrección de fallos en el handshake OIDC en arranques lentos de Keycloak ([DOC-027](aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md)).
- **Layout a Pantalla Completa**: Corrección del viewport y overflow en el wizard de instalación de `sicsaft-core`.

### Removed
- Eliminado portal legacy `web_admin/` y dependencias de administración remota descartadas ([DOC-028 Fase F](aidlc-docs/sicsaft-core/design-artifacts/DOC-028-fases-sicsaft-core.md)).
- Eliminado backend Redis de todos los perfiles de despliegue.

---

## [0.2.0] - 2026-08-28

### Added
- Spike y verificación de `sicsaft-core` con procesos hijos de Electron.
- Ingesta supervisada de planillas Excel contables (`herramientas/etl-contable/`).
- Despliegue on-premise con Podman y scripts de PowerShell asistidos (`devops/onprem/`).

---

## [0.1.0] - 2026-08-15

### Added
- Núcleo de Backend: API Gateway CIS y Motor Patrimonial CORE con PostgreSQL.
- Modelo de Entitlements y Contratos ([DOC-004](base-patrimonial/DOC-004-modelo-contrato.md)).
- Modelo Patrimonial BPI ([DOC-005](base-patrimonial/DOC-005-modelo-patrimonial.md)).
