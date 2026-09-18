# Changelog Oficial — SICSAFT

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Sin publicar]

### Changed
- **CIP — línea base congelada de sus 4 secciones ([DOC-037](aidlc-docs/cip/design-artifacts/DOC-037-linea-base-pestanas-cip.md))**. No se modifican sin un documento que lo formalice.
  - **"Controles de Área y Contrastación BPI" → "Reportes"** en el sidebar y en el título, iniciando la línea de nomenclatura de reportes. La ruta `/dashboard/controles-area` se mantiene (enlaces ya compartidos).
  - **Se retiran los indicadores de color del organigrama junto con "marcar como revisado"**: eran la misma funcionalidad — el badge rojo/amarillo solo se pintaba si la sesión no estaba revisada. Queda el total de reportes por Dirección, en azul.
  - **Las alarmas pasan a ser AFT extraviados de controles defectuosos**: antes listaban "AFT fuera de lugar" (encontrados en otra área) con ambos veredictos. Ahora, una alarma por Área, solo veredicto `defectuoso`, y la regla de baja es **derivada, nunca persistida** — solo un control posterior con veredicto `exitoso` en la misma Dirección y Área la quita. Sin botón de descarte, a propósito: sin estado que escribir, nadie puede silenciar una alarma sin el control real en terreno.
  - **"Portal del Directivo" → "Modelo Inteligente de Gestión Patrimonial"** en el header, el login y el teaser de Nivel 1. El sidebar nombra el nivel instalado (`Nivel 2. QR + Dashboard` / `Nivel 1. QR`) usando la validación que ya existía.

### Removed
- **CIP vuelve a ser 100% lectura — se retira DOC-036 (`PATCH /dashboard/sesiones/:id/revisar`)** en las tres capas: botón y modal en Pantalla 8, `marcarRevisado` del cliente, la ruta con `DirectivoGuard` en CIS y el endpoint + repositorio en CIP. **Las columnas `revisado`/`revisadoPor`/`revisadoEn` de `veredicto_sesion` y su migración no se tocan**: el retiro es reversible y no se pierde el registro histórico.

### Added
- **CIP — alertas entrelazadas con reportes + historial nocturno ([DOC-034](aidlc-docs/cip/design-artifacts/DOC-034-alertas-entrelazadas-con-reportes.md))**: cada alerta de "AFT fuera de área" trae el veredicto de la sesión que la generó y un link directo al reporte completo; corte diario por veredicto vía `GET /dashboard/historico`.
- **core/frontend — organigrama de Controles de área + informe PDF ([DOC-035](aidlc-docs/core/design-artifacts/DOC-035-organigrama-controles-de-area.md))**: vista jerárquica Organización→Dirección→Departamento→Área con contador de reportes, y exportación del informe de control ("Pantalla 8") a PDF (`lib/pdf-informe-control.ts`).
- **CIP — marcar sesión revisada, primera escritura del módulo ([DOC-036](aidlc-docs/cip/design-artifacts/DOC-036-marcar-sesion-revisada-cip.md))**: el Directivo baja el contador de notificaciones de un Área al revisar una sesión desde el organigrama.

### Fixed
- **"En servicio" en 0 del informe de control de área** (commit `0a784f5`).

### Added (Fase G)
- **`sicsaft-core` — Fase G: puesto del Profesional de AFT en su propia PC ([DOC-028](aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md) Fase G, `CORE-RF-06`)**:
  - La PC del Director (la "PC madre", instalación única = BPI única) sirve el CCP también en `https://<ip-lan>:8767` por HTTPS con el certificado autofirmado de la APP QR. En la PC del AFT **no se instala nada**.
  - Proxy de mismo origen en `static-portal-server.ts` para `/cis/*` y el token endpoint del realm (`/kc/token`), porque una página HTTPS no puede hacer `fetch` a CIS/Keycloak por HTTP (contenido mixto) y CIS no tiene ese origen en su CORS. Rutas fijas, sin proxy abierto; verificación explícita del origen de destino (saneador S5144).
  - El client OIDC `ccp` de Keycloak acepta loopback + el origen de LAN, re-sincronizado en cada relanzamiento y al reconfigurar la IP (`sincronizarOrigenesClientCcp`).
  - Pantalla "listo" del wizard: tarjeta **"Puesto del Profesional de AFT — otra PC"** con *Copiar dirección* y *Guardar acceso directo* (`SICSAFT CCP.url`).
  - `ccp/`: override opcional `VITE_KEYCLOAK_TOKEN_URL` en `oidc-config.ts` / `oidc-client.ts` (sin él, comportamiento idéntico en dev/Docker/portal embebido).
  - Firewall: `scripts/installer.nsh` (NSIS, al instalar "para todos los usuarios") y `herramientas/devops/configurar-firewall-sicsaft.ps1` (manual) crean las reglas de entrada TCP 8765/8767/56000/58080 + UDP 58765, **solo perfiles Privado y Dominio**.
  - e2e: `sicsaft-core/e2e/specs/20-puesto-aft-lan.spec.ts` (login real del AFT por la IP de LAN + lectura de CIS por el proxy, sin contenido mixto).
  - Doc: DOC-028 Fase G, `REQUIREMENTS.md` `CORE-RF-06`, `ARCHITECTURE.md` (mapa de puertos de LAN), `sicsaft-core/README.md`, `RUNBOOK-INSTALACION.md` §5.1.

### Verificación
- `sicsaft-core`: `typecheck` / `lint:ci` / `build` / `vitest` (unit) en verde. `ccp`: `lint:ci` / `vitest` / `build` en verde.
- **Pendiente**: correr `sicsaft-core/e2e` (specs 01/02/20) contra el `.exe` empaquetado — el fixture del `.exe` falló al lanzar en el último intento, en revisión.

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
- **Reemplazo de Autenticación ([ADR-004](adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md))**: Migración completa a Keycloak 26 OIDC/PKCE con roles por organización.
- **Reemplazo de Cola de Mensajería ([ADR-005](adr/ADR-005-postgres-pgboss-reemplaza-redis.md))**: Eliminación definitiva de Redis en favor de PostgreSQL con `pg-boss`.
- **Nomenclatura Oficial**: Adopción de **BPI (Base Patrimonial Inteligente)** como término oficial en todo el código y documentación.

### Fixed
- **Comentarios Huérfanos (H-04, [DOC-032](aidlc-docs/revision-codigo/DOC-032-revision-de-codigo-y-documentacion.md))**: Eliminación y resolución de los 14 comentarios huérfanos en `cis/`, `core/`, `cip/` y `ccp/`.
- **Timeout en Login Embebido**: Corrección de fallos en el handshake OIDC en arranques lentos de Keycloak ([DOC-027](aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md)).
- **Layout a Pantalla Completa**: Corrección del viewport y overflow en el wizard de instalación de `sicsaft-core`.

### Removed
- Eliminado portal legacy `web_admin/` y dependencias de administración remota descartadas ([DOC-028 Fase F](aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md)).
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
