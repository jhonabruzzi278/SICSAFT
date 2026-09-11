# CCP — Centro de Control Patrimonial (Portal WEB SICSAFT, SYS-05)

## Objetivo
Aplicación web privada de administración y operación patrimonial para el **Profesional de AFT** (`administrador-patrimonial`).
Permite el control integral del inventario físico, altas/bajas de activos, gestión de la estructura organizacional (Áreas, Ubicaciones, Responsables), generación e impresión de etiquetas QR / Code 128, revisión de lotes de ingesta contable y consulta de auditorías.

Consume servicios exclusivamente a través de **CIS**, respetando la regla no negociable de cero acceso directo a la BPI.

## Estado
🟢 **Completamente funcional y verificado**:
- **Autenticación OIDC + PKCE con Keycloak 26** ([ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)).
- **Módulos Operativos (Modo Básico / Profesional / Enterprise)**:
  - **Activos**: Catálogo interactivo con alta manual, bajas, reincorporaciones, cambio de responsable y asignación de documentos.
  - **Estructura**: Administración completa de Áreas, Ubicaciones y Responsables con estados bidireccionales.
  - **Importaciones Contables** (DOC-029 RF-B): Bandeja de staging de lotes de Excel (revisión, aprobación y rechazo supervisado).
  - **Etiquetas y Códigos QR** (DOC-029 RF-F): Generación masiva y maquetación de impresión (`@media print`) de etiquetas con QR y Code 128 por área/dirección.
  - **Auditoría** (DOC-029 RF-E): Registro histórico con filtro por área operativa (`?area=`) y panel de revisión de trazabilidad.
  - **Resumen Operativo**: Indicadores básicos de catálogo, estructura, custodios y cobertura de relevamiento, más accesos directos a los módulos (Pantalla 8).
- **El CIP no vive acá** (2026-09-09): el Centro de Inteligencia Patrimonial es la analítica de Nivel 2 del **Directivo** y se accede únicamente desde su portal ([`core/frontend/`](../core/frontend/)). El CCP no lo enlaza, no lo hospeda y no cambia según `VITE_SICSAFT_NIVEL` — va completo en todos los niveles.
- **Despliegue y Empaquetado**: Corre como SPA local y va embebida en el ejecutable [`sicsaft-core`](../sicsaft-core/).

## Módulos y Arquitectura

```
src/
├── components/         # Primitivos UI (Tailwind v4, tokens BRAND.md), AppShell, PantallaControlArea
├── lib/                # Clientes HTTP (cis-client.ts), OIDC PKCE (oidc/), helpers de nivel, etiquetas y lotes
├── pages/              # ActivosPage, EstructuraPage, EtiquetasPage, AuditoriaPage, HubPage, LoginPage
│   └── importaciones/  # LotesRevision, CargaManualCsv
└── tests/              # Suites Playwright e2e (login, alta de activos)
```

## Desarrollo y Ejecución Local

```bash
cd ccp
npm install
cp .env.example .env
npm run dev             # Servidor Vite en http://localhost:5174
npm run build           # Build de producción (dist/)
npm run test:e2e        # Tests e2e con Playwright
```

### Variables de Entorno (`.env`)
```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=sicsaft
VITE_KEYCLOAK_CLIENT_ID=web-sicsaft
VITE_CIS_URL=http://localhost:3000
VITE_SICSAFT_NIVEL=2
```

## Depende de
- **CIS (`cis/`)**: Gateway de interoperabilidad para todas las operaciones de lectura y escritura oficial.
- **Keycloak 26**: Servidor OIDC para emisión y validación de tokens del Profesional de AFT.

## Bloquea
- Ningún subsistema de backend depende de `ccp/` (es una interfaz de usuario final).

## Documentos Relacionados
- [DOC-013](../aidlc-docs/ccp/design-artifacts/DOC-013-portal-web.md) — Requisitos y diseño de módulos del CCP.
- [DOC-022](../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md) — Separación de portales por rol.
- [DOC-023](../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md) — Matriz de permisos RBAC.
- [DOC-029](../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) — Endurecimiento para cliente real (Lotes, Etiquetas, Pantalla 8).
- [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) — Marco arquitectónico general.

## Próximo Paso Sugerido
- Avanzar con el enlace bidireccional del veredicto accionable de sesiones de inventario hacia auditoría (RF-D).

