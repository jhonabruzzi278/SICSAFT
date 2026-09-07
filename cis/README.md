# CIS — Centro de Interoperabilidad SICSAFT (SYS-02)

## Objetivo
Punto único de entrada entre las fuentes de captura (APP QR, CCP, RFID, ERP, etc.) y SICSAFT CORE.
Responsable de autenticación OIDC/JWT, validación estructural de esquemas (Zod), correlación de transacciones,
circuit breaker/reintentos hacia el CORE y control de rate-limiting. Ninguna fuente de captura habla directo
a la BPI (Base Patrimonial Inteligente) ni a CORE — todo pasa por CIS.

## Estado
🟢 **Completamente funcional y verificado**:
- **Autenticación OIDC con Keycloak 26** ([ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)): `KeycloakAuthGuard` valida firma/issuer/audience/vencimiento contra el JWKS de Keycloak. `KeycloakAdminService` gestiona organizaciones, roles y usuarios vía Admin REST API (`client_credentials`).
- **Conector QR y Proxy hacia CORE**: Los endpoints de captura (`/auth/session`, `/catalogo`, `/inventarios`, `/inventarios/:id/estado`, `/inventarios/:id/control`) delegan en `CoreClientService` con autenticación servicio-a-servicio (`x-internal-service-token`).
- **Resiliencia (WAF 4)**: `CircuitBreaker` propio (abre a 5 fallos transitorios consecutivos, half-open en 30s) + reintentos con backoff exponencial (`retry.ts`).
- **Protección y Gobernanza**: `RateLimitGuard` en memoria (30 req/10s por operador), `DeviceRegistryService` para registro de dispositivo único (`deviceId`), y `CorrelationIdMiddleware` para trazabilidad de peticiones.
- **Módulo Administrador (CCP)** (`src/administrador/`): Soporta las operaciones oficiales del Profesional de AFT (escritura de Activo, Catálogo de Tipos, Documentos, Ingesta Contable supervisada en staging, Auditoría con filtro `?area=` y gestión de Áreas/Ubicaciones/Responsables).
- **Módulo Directivo** (`src/directivo/`): Permite al Directivo designar al Profesional de AFT dentro de su organización, derivando el `organizacionId` de su token JWT.
- **Métricas y Salud**: `/health` (HealthController) y `/metrics` protegido con `MetricsTokenGuard`.
- **Cobertura**: 100% de statements, líneas y funciones en suites de Jest (37 suites, 310 tests).

## Módulos y Arquitectura

```
src/
├── common/             # Guards globales (KeycloakAuthGuard, MetricsTokenGuard), Middleware (CorrelationId), Validaciones Zod
├── core-client/        # Cliente HTTP hacia SICSAFT CORE con Circuit Breaker y Reintentos
├── cip-client/         # Cliente HTTP hacia CIP (Centro de Inteligencia Patrimonial)
├── keycloak-admin/     # Integración con la Admin REST API de Keycloak 26
├── qr-connector/       # Controlador y servicio del Conector QR (captura e inventarios)
├── administrador/      # Endpoints oficiales para el portal CCP (activos, estructura, lotes de ingesta)
├── directivo/          # Endpoints para el portal del Directivo (designación de AFT)
├── auditoria-identidad/# Registro de auditoría de identidad hacia CORE
├── device-registry/    # Registro de dispositivo activo por operador en memoria
└── rate-limit/         # Limitador de tasa en memoria (InMemoryRateLimiter)
```

## Desarrollo y Ejecución Local

```bash
cd cis
npm install

# Variables de entorno principales
export KEYCLOAK_URL=http://localhost:8080
export KEYCLOAK_REALM=sicsaft
export KEYCLOAK_AUDIENCE=cis
export KEYCLOAK_ADMIN_CLIENT_ID=cis-admin
export KEYCLOAK_ADMIN_CLIENT_SECRET=secreto-del-client
export CORE_URL=http://localhost:3001
export CORE_SERVICE_TOKEN=secreto-compartido-core
export CIS_CORS_ORIGIN=http://localhost:5173,http://localhost:5174

npm run start:dev       # Inicia NestJS en modo watch (http://localhost:3000)
npm run lint:ci         # Verificación de linter
npm test                # Tests unitarios
npm run test:cov        # Reporte de cobertura
npm run build           # Compilación a dist/
```

## Variables de Entorno Requeridas

| Variable | Descripción |
|---|---|
| `KEYCLOAK_URL` | URL base del servidor de Keycloak 26 (ej. `http://keycloak:8080` en On-Prem). |
| `KEYCLOAK_REALM` | Realm OIDC oficial (`sicsaft`). |
| `KEYCLOAK_AUDIENCE` | Client ID de la aplicación en Keycloak (`cis`). |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Client confidencial con permisos de administración. |
| `KEYCLOAK_ADMIN_CLIENT_SECRET`| Secreto del client confidencial de administración. |
| `CORE_URL` | URL base de SICSAFT CORE (ej. `http://localhost:3001`). |
| `CORE_SERVICE_TOKEN` | Token secreto compartido para autenticación interna con CORE. |
| `CIS_CORS_ORIGIN` | Orígenes permitidos separados por coma para clientes navegador (APP QR, CCP). |
| `METRICS_TOKEN` | Token Bearer opcional para proteger el endpoint `/metrics`. |

## Depende de
- **Keycloak 26**: Proveedor oficial de identidad OIDC y autenticación.
- **SICSAFT CORE (`core/`)**: Orquestador y gestor de la BPI (Postgres).

## Bloquea
- Clientes de frontend (**APP QR**, **CCP**, **CORE frontend**) que requieren de CIS como gateway obligatorio.

## Documentos Relacionados
- [ADR-004](../adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) — Adopción de Keycloak 26.
- [DOC-002](../aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-002-conector-qr.md) — Contrato de Conector QR.
- [DOC-006](../aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md) — Contrato de API CIS ↔ CORE.
- [DOC-023](../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md) — Matriz de permisos RBAC.
- [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) — Marco arquitectónico general.

## Próximo Paso Sugerido
- Mantener sincronizados los schemas Zod ante nuevas extensiones de CORE y verificar la degradación adecuada cuando CIP no esté presente en despliegues Nivel 1.

