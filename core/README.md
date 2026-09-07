# SICSAFT CORE (SYS-03)

Núcleo operativo del Modelo Inteligente de Gestión Patrimonial (Tomo IV, Cap. 2). Administra, coordina, controla y supervisa el ciclo de vida completo de los Activos Fijos Tangibles (AFT).

Es el **único componente autorizado a modificar la BPI** (Base Patrimonial Inteligente). Todas las aplicaciones y fuentes de captura interactúan exclusivamente a través de CIS.

## Objetivo

- Implementar los motores funcionales y de reglas de negocio patrimoniales (CFPS).
- Garantizar la integridad transaccional, persistencia inmutable y auditoría de todas las operaciones sobre la BPI.
- Resolver entitlements, catálogos, sesiones de inventario, importaciones contables y estructuras organizacionales.

## Estado

🟢 **Operativo y Testeado**:
- **Cobertura de Tests**: 100% de cobertura en ramas, funciones y líneas con suites unitarias y e2e contra PostgreSQL real.
- **Seguridad Inter-Servicios**: Validación de cabecera `x-internal-service-token` con secreto compartido (`CORE_SERVICE_TOKEN`) en tiempo constante (`ServiceTokenGuard`).
- **Trazabilidad**: Middleware de correlación (`X-Correlation-Id`) integrado transversalmente.

## Módulos y Arquitectura

```
core/src/
├── app.controller.ts             # Health check y metadatos de servicio
├── app.service.ts                # Información descriptiva del núcleo
├── auditoria/                    # Motor de Auditoría y persistencia de eventos
├── common/                       # Guards (ServiceToken), Middlewares y Utilidades
├── database/                     # Conexión y pool a PostgreSQL
├── entitlements/                 # Modelos de Organizaciones, Sedes y Contratos
├── estructura/                   # Áreas, Ubicaciones y Responsables institucionales
├── eventos/                      # Motor de Eventos patrimoniales
├── inventarios/                  # Sesiones de inventario, clasificación y veredictos
├── orquestador/                  # MOP (Motor de Orquestación Patrimonial)
├── patrimonial/                  # Altas, bajas, traslados, importación contable
└── reglas/                       # Motor de Reglas CFPS (validación patrimonial)
```

### Endpoints Principales

| Ruta | Método | Propósito |
|---|---|---|
| `/health` | `GET` | Verificación de estado del servicio y conexión a BD |
| `/entitlements` | `GET` | Consulta de organizaciones y sedes con contrato activo |
| `/catalogo` | `GET` | Consulta paginada del catálogo de activos de la BPI |
| `/inventarios` | `POST` | Procesamiento e ingesta de sesiones de inventario con clasificación |
| `/inventarios/:id/control` | `GET` | Informe de control y veredicto de inventario ("Pantalla 8") |
| `/activos` | `POST` | Alta oficial de un activo patrimonial |
| `/activos/:id/baja` | `POST` | Baja transaccional y registro de motivo en historial |
| `/importaciones/contable/lote` | `POST` | Staging de importación masiva contable |
| `/auditoria` | `GET` | Consulta paginada y filtrable de eventos de auditoría |

## Desarrollo y Ejecución Local

### Requisitos

- Node.js 20+
- PostgreSQL 16+ con base de datos configurada

### Comandos de Ejecución

```bash
# Instalar dependencias
npm install

# Correr migraciones de base de datos
npm run migrate:up

# Ejecutar en modo desarrollo
npm run start:dev

# Ejecutar tests unitarios y de cobertura
npm run test:cov

# Ejecutar tests end-to-end
npm run test:e2e
```

## Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo / Default |
|---|---|---|
| `PORT` | Puerto de escucha HTTP | `3001` |
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://postgres:pass@localhost:5432/core` |
| `CORE_SERVICE_TOKEN` | Token secreto compartido para validar peticiones desde CIS | `hex_string_32_bytes` |
| `EVENTOS_OUTBOX_DATABASE_URL` | Cadena de conexión PostgreSQL para cola pg-boss | `postgresql://postgres:pass@localhost:5432/eventos` |
| `NODE_ENV` | Entorno de ejecución (`development`, `test`, `production`) | `development` |

## Depende de

- **PostgreSQL 16+**: Persistencia relacional de la BPI.
- **CIS (Nivel 2)**: Entrada autorizada de peticiones (CIS valida identidad OIDC de operadores).

## Bloquea

- **CIS**, **CCP**, **APP QR**, **CIP**: Ninguna operación patrimonial puede completarse sin CORE.

## Documentos Relacionados

- [`../NOMENCLATURA.md`](../NOMENCLATURA.md) — Nomenclatura oficial BPI y actores.
- [`../base-patrimonial/README.md`](../base-patrimonial/README.md) — Estructura y 11 dominios de la BPI.
- [`../base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md) — Modelo de Contrato y Entitlements.
- [`../base-patrimonial/DOC-005-modelo-patrimonial.md`](../base-patrimonial/DOC-005-modelo-patrimonial.md) — Modelo de Dominio Patrimonial Esencial.
- [`../aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md`](../aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md) — Contrato de API CIS↔CORE.
- [`../aidlc-docs/core/design-artifacts/DOC-007-orquestador.md`](../aidlc-docs/core/design-artifacts/DOC-007-orquestador.md) — Motor de Orquestación Patrimonial (MOP).

## Próximo Paso Sugerido

Mantener la cobertura al 100% ante nuevas reglas CFPS y extender los conectores de integración contable/ERP cuando se requiera interoperabilidad externa.
