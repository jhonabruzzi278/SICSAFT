# Changelog Oficial — SICSAFT

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Sin publicar]

_Sin cambios registrados todavía._

## [1.1.0] - 2026-09-11

### Added
- **`sicsaft-core` — Fase G: puesto del Profesional de AFT en su propia PC ([DOC-028](aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md) Fase G, `CORE-RF-06`)**:
  - La PC del Director (la "PC madre", instalación única = BPI única) sirve el CCP también en `https://<ip-lan>:8767` por HTTPS con el certificado autofirmado de la APP QR. En la PC del AFT **no se instala nada**.
  - Proxy de mismo origen en `static-portal-server.ts` para `/cis/*` y el token endpoint del realm (`/kc/token`), porque una página HTTPS no puede hacer `fetch` a CIS/Keycloak por HTTP (contenido mixto) y CIS no tiene ese origen en su CORS. Rutas fijas, sin proxy abierto; verificación explícita del origen de destino (saneador S5144), cabeceras hop-by-hop filtradas, `502` si la PC madre no responde.
  - El client OIDC `ccp` de Keycloak acepta loopback + el origen de LAN, re-sincronizado en cada relanzamiento y al reconfigurar la IP (`sincronizarOrigenesClientCcp`).
  - Pantalla "listo" del wizard: tarjeta **"Puesto del Profesional de AFT — otra PC"** con *Copiar dirección* y *Guardar acceso directo* (`SICSAFT CCP.url`).
  - `ccp/`: override opcional `VITE_KEYCLOAK_TOKEN_URL` en `oidc-config.ts` / `oidc-client.ts` (sin él, comportamiento idéntico en dev/Docker/portal embebido).
  - Firewall: `scripts/installer.nsh` (NSIS, al instalar "para todos los usuarios") y `herramientas/devops/configurar-firewall-sicsaft.ps1` (manual) crean las reglas de entrada TCP 8765/8767/56000/58080 + UDP 58765, **solo perfiles Privado y Dominio**.
  - e2e: `sicsaft-core/e2e/specs/20-puesto-aft-lan.spec.ts` (login real del AFT por la IP de LAN + lectura de CIS por el proxy, sin contenido mixto).
  - Doc: DOC-028 Fase G, `REQUIREMENTS.md` `CORE-RF-06`, `ARCHITECTURE.md` (mapa de puertos de LAN), `sicsaft-core/README.md`, `RUNBOOK-INSTALACION.md` §5.1.
- **`core` — ubicación por defecto del área en la ingesta contable ([DOC-029](aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) RF-B)**: el Excel del especialista trae el área pero nunca una ubicación física y el catálogo operativo exige `ubicacion_id` no nulo. Al aprobar un lote, el activo toma la ubicación principal del área (o se crea una en la sede de la organización). Migración `1756300000000_ubicacion-por-defecto-ingesta-contable.ts`, `UbicacionRepository.resolverPorArea`.
- **Portal Directivo (`core/frontend`) — Ficha Técnica analítica en modo lectura** dentro del CIP (pestaña Activos): visor de QR institucional, trazabilidad, expediente documental y valor contable, con separación estricta entre BI analítico (CIP) y administración operativa (CCP).
- **`sicsaft-core` — banco de pruebas de dev**: handler IPC `vaciarBpiDev` (`reset-bpi-dev.ts`) para vaciar la BPI entre corridas manuales de prueba. Solo disponible en desarrollo.

### Changed
- **CIP retirado del CCP y modularizado en el Portal Directivo (`core/frontend`)**: el Centro de Inteligencia Patrimonial se accede únicamente desde el portal del Directivo. Se descompone en módulos dedicados (`use-cip-data` como fachada de datos, `CipSidebar`, `CipHeader`, `CipKpiCards`, `CipCharts`, `CipActivosTable`, `CipFichaModal`) y adopta un diseño institucional a pantalla completa sin scroll horizontal.
- **`app-qr-sicsaft` — reescritura del conector QR y del gate de operador**: `qr-connector.ts` y `OperatorGate` (login directo usuario/contraseña vía OIDC), `OrganizationPicker` / `AreaLocationPicker` separados. `main.tsx` de `ccp` y `app-qr` deciden el modo mock por `import.meta.env.MODE === 'e2e'` en vez de `VITE_MOCK_API`, para que un `.env.local` olvidado no hornee MSW en un build de producción.
- **CI / SonarCloud**: exclusión de CPD para los entrypoints de SPA (`**/src/main.tsx`), los handlers de MSW (`ccp/src/mocks/handlers.ts`) y el spec de galería (`ccp/tests/galeria-completa.spec.js`) — mismo criterio ya documentado para `App.tsx` / `app.e2e-spec.ts` (SPAs independientes sin workspace, boilerplate inherente).

### Fixed
- **`core` — dry-run de la ingesta contable**: reimportar un Excel ya aprobado daba `conflicto` en vez de `ya_importado` porque el dry-run comparaba la `ubicacion_id` ya resuelta del activo contra `undefined`. El dry-run ahora resuelve la ubicación por área en solo-lectura (`ubicacionPrincipalDeArea`), mismo patrón que ya se usaba para área/responsable/catálogo.
- **`ccp` — galería visual de `/importaciones`**: los casos 16/17 esperaban un `<h2>` de `DropzoneImportacionExcel`, componente que `ImportacionesPage` ya no monta; se repuntan a la bandeja de lotes que la ruta renderiza hoy.
- **`sicsaft-core` — SonarCloud S5332** en el parser de rutas del proxy de Fase G: la base ficticia `BASE_RUTA_REQUEST` pasa de `http://portal.invalid` a `https://` (host reservado RFC 2606, nunca se contacta; no-op funcional).

### Security
- **SEC-01 (continuación)**: `token-store.ts` de `ccp` y `app-qr-sicsaft` limita el ciclo de vida del token a `sessionStorage` y trata un `expiresAt` no parseable (`NaN`) como expirado.

### Verificación
- **Verde**: `sicsaft-core` (`typecheck` / `lint:ci` / `build` / `vitest`), `ccp` (`lint:ci` / `vitest` / `build`), `core` (`lint:ci` / `test` unit 403 / cobertura 100 % líneas-funciones / `build`), `cis`, `core/frontend`, `ETL contable`. SonarCloud Quality Gate en verde en los PRs #117 y #118.
- **Pendiente / conocido**:
  - `sicsaft-core/e2e` (specs 01/02/20, incluido el ciclo de Fase G) nunca se corrió contra el `.exe` empaquetado — el fixture del `.exe` falla al lanzar, en revisión.
  - `APP QR CI` está en rojo en `main` desde `ea0b6e0` (2026-09-08): la migración del flujo `OperatorGate` / pickers dejó `tests/helpers.js`, `src/mocks/fixtures.ts` y los handlers MSW desincronizados; toda la suite e2e de `app-qr-sicsaft` hace timeout esperando el selector de organización. Requiere una corrección aparte antes de considerar publicable el camino de captura móvil.

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
