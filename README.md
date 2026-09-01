# Ecosistema SICSAFT — índice de sistemas

Programa compuesto por varios sistemas coordinados. Ninguna fuente de captura debe modificar la
Base Patrimonial Central directamente — todo pasa por CIS → CORE.

```
Fuentes de captura (APP QR, WEB, RFID, ERP, ...)
        ↓
      CIS (interoperabilidad)
        ↓
    SICSAFT CORE (orquestador + motores)
        ↓
  Base Patrimonial Central (fuente única de verdad)
        ↓
      CIP (inteligencia / BI)
        ↓
  Usuarios / Organización
```

Diagrama completo con los módulos internos de cada nivel:
[ARQUITECTURA-WAF.md 1.1](ARQUITECTURA-WAF.md#11-diagrama-maestro-de-arquitectura-funcional).

## Sistemas

| Código | Carpeta | Sistema | Estado |
|---|---|---|---|
| SYS-01 | [`app-qr-sicsaft/`](app-qr-sicsaft) | APP QR SICSAFT (captura vía QR) | 🟢 En desarrollo activo — ver `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` |
| SYS-02 | [`cis/`](cis) | Centro de Interoperabilidad | 🟢 Conector QR real, proxy delgado hacia CORE (DOC-002/DOC-006), auth real via Keycloak (ADR-004, reemplaza a ADR-002), circuit breaker + reintentos + rate limiting (WAF 4), `deviceId` enforced, CORS para APP QR/WEB, puente de escritura oficial para Administrador Patrimonial (DOC-012 5), CRUD completo contra Keycloak sin Console (editar organización, quitar rol, dar de baja usuario) + auditoría de identidad hacia CORE (DOC-024). **DOC-029 (stack local, sin merge):** puente de lote de ingesta contable, passthrough de `GET /inventarios/:id/control` (Pantalla 8) y de `?area=` en `GET /auditoria` |
| SYS-03 | [`core/`](core) | SICSAFT CORE | 🟡 Orquestador + 4 motores (Patrimonial, Reglas, Eventos, Auditoría — Fase 2) + escritura oficial de Activo/Contrato/importación masiva (Fase 4, DOC-012) sobre Postgres real, CRUD completo de Organización/Sede/Contrato con `estado` bidireccional (nunca DELETE real, Tomo III 4.10) y auditoría de identidad (DOC-024) — resto de los 9 motores de `core/README.md` sin implementar. **DOC-029 (stack local, sin merge):** bandeja de staging de ingesta contable (resuelve-o-crea) + `GET /inventarios/:id/control` + `auditoria.area_operativa` + `inventarios.estado_declarado`/`baja_sugerida_motivo` |
| SYS-04 | [`base-patrimonial/`](base-patrimonial) | Base Patrimonial Central | 🟡 Modelo de Organización/Contrato/Sede documentado e implementado en Postgres (DOC-004), con CRUD completo y `estado` bidireccional (DOC-024) — resto de los 11 dominios sin definir |
| SYS-05 | [`ccp/`](ccp) | CCP — Centro de Control Patrimonial (Portal WEB del Profesional de AFT) | 🟢 Los 6 módulos del MVP implementados — login OIDC/PKCE real + Activos/Contratos/Inventarios verificados de punta a punta contra Postgres real, Auditoría y Áreas/Ubicaciones/Responsables verificados con e2e de CORE/CIS. Exclusivo del rol `administrador-patrimonial` (DOC-022) — Administrador del Sistema y Directivo tienen sus propios portales, ver SYS-09/SYS-10. **DOC-029 (stack local, sin merge):** flag de nivel 1/2 (oculta gestión avanzada), módulo QR/Etiquetas (RF-F), revisión de lotes de ingesta de Excel (RF-B), Pantalla 8 en el Resumen (RF-I), Auditoría por área operativa con columna "Revisar" (RF-E) |
| SYS-06 | [`cip/`](cip) | Centro de Inteligencia Patrimonial | 🟢 Primer dashboard (Fase 6): worker de agregación (`pg-boss`, ADR-005) + 8 endpoints de lectura sobre base propia, verificado real de punta a punta — sin frontend todavía |
| SYS-07 | [`rfid/`](rfid) | RFID SICSAFT | 🔲 No iniciado (fase tardía) |
| SYS-08 | [`integraciones/`](integraciones) | Integraciones externas (ERP, RRHH, BI...) | 🔲 No iniciado (fase tardía) |
| SYS-09 | [`web_admin/`](web_admin) | web_admin — Portal WEB del Administrador del Sistema | 🟢 Extraído de `ccp/AdminPage.tsx` (DOC-022) — organizaciones/contratos/usuarios/indicadores. Verificado real de punta a punta en su momento contra Docker/Zitadel (integración con la API de administración, hoy `cis/src/keycloak-admin/` — ADR-004). CRUD completo (editar/dar de baja organización y sede, editar condiciones de contrato, quitar rol) sin necesitar la Console de Keycloak + matriz de roles de solo lectura (DOC-024) |
| SYS-10 | [`core/frontend/`](core/frontend) | Portal WEB del Directivo | 🟢 Segundo deployable de `core/` (backend NestJS sin cambios) — dashboard ejecutivo (RF-09) + designar Profesional de AFT (`cis/src/directivo/`), le habla a CIS, nunca al backend de CORE directo (ADR-003). Verificado real de punta a punta en su momento contra Docker/Zitadel |
| SYS-11 | [`sicsaft-core/`](sicsaft-core) | SICSAFT CORE — app de escritorio nativa | 🟢 Nivel 1 completo (Electron) arrancando de verdad — Postgres/Keycloak/CIS/CORE/CIP embebidos con binarios reales vendorizados (sin Redis desde ADR-005), camino prioritario de instalación por cliente junto a `devops/onprem/` (coexisten). Wizard de primer arranque con alta real del Director (`crearUsuarioDirector`, port de `KeycloakAdminService`) + login único embebido que detecta el rol y muestra `ccp` o `core/frontend` (CORE-RF-04, 2026-08-28). Falta cablear el paso del Profesional de AFT y el empaquetado final de los portales (`electron-builder`). Bitácora de bugs reales de toda la línea: [`DOC-027`](aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md) — ver `aidlc-docs/sicsaft-core/`. **DOC-029 (stack local, sin merge):** fix del crash del login por timeout + layout del wizard a pantalla completa (RF-G), flag de nivel inyectado al servir `ccp`, selector de carpeta de ingesta de Excel por IPC (RF-B) |
| SEC | [`seguridad/`](seguridad) | Identidad / RBAC (transversal) | 🟡 Mecanismo (Keycloak/OIDC, [ADR-004](adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)) y modelo de `Contrato` (DOC-004) resueltos e implementados en CIS/CORE |
| OPS | [`devops/`](devops) | Infraestructura / CI-CD / Observabilidad (transversal) | 🟡 Stack local (Traefik + Postgres + Zitadel + CIS + CORE) funcionando en Docker Compose. Instalación on-premise por cliente (Nivel 1/2, `devops/onprem/`) diseñada y con primer entregable construible sobre Podman — ver `aidlc-docs/devops/` |
| — | [`herramientas/etl-contable/`](herramientas/etl-contable) | ETL Python del Excel contable (herramienta, no desplegable) | 🟡 **DOC-029 (stack local, sin merge):** sidecar `pandas`+`xlrd` que normaliza el `.xls`/`.xlsx` del cliente al modelo SICSAFT y lo empuja a la bandeja de staging de CORE vía CIS. Lo invoca `sicsaft-core` (`execFile`); en el `.exe` va empaquetado con un Python embebido. `pytest` + `ruff`, sin workflow de CI propio (como `landing/`) |
| — | [`landing/`](landing) | Landing comercial (cara al cliente) | 🟢 Construida — `npm install && npm run dev`. Sin datos internos de desarrollo. |

Cada carpeta tiene su propio `README.md` con objetivo, estado, dependencias y próximo paso.

Arquitectura de referencia transversal (escalable, modular, resiliente, marco Well-Architected
sin atarse a un proveedor de nube): [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md).

Plan de fases pendientes: [ROADMAP.md](ROADMAP.md). Índice consolidado de requisitos funcionales y
no funcionales de todos los sistemas (RF/RNF, con estado real y gaps conocidos):
[REQUISITOS.md](REQUISITOS.md).

Plan de fases para lo que falta construir en todo el ecosistema, ordenado por dependencia real
(verificado contra el código, no solo contra los README): [ROADMAP.md](ROADMAP.md).

Identidad visual / paleta de colores oficial (todo trabajo visual del ecosistema debe salir de
acá, no reinventar colores por sistema): [BRAND.md](BRAND.md).

Decisiones de arquitectura del ecosistema (stack, identidad/SSO, dominios, infraestructura):
[`adr/`](adr) — [ADR-001](adr/ADR-001-stack-backend-nestjs.md) (NestJS + Vite/React + Postgres),
[ADR-004](adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) (Keycloak self-hosted, reemplaza a
[ADR-002](adr/ADR-002-identidad-zitadel-multi-tenant.md) — modelo Organización→Contrato→Sede sin
cambios, dominios bajo `sicsaft.cl`), [ADR-005](adr/ADR-005-postgres-pgboss-reemplaza-redis.md)
(cola de eventos y rate-limiting sobre Postgres — `pg-boss`/memoria, reemplaza a Redis en los 3
perfiles de `devops/`). Operación de infraestructura (VPS, Docker Compose, CI/CD, DevSecOps):
[`devops/README.md`](devops/README.md).

Documentación de metodología AI-DLC (requisitos, historias, diseño y estrategia de testing por
fase, generada antes de escribir código): [`aidlc-docs/`](aidlc-docs), una subcarpeta por sistema
(`aidlc-docs/app-qr-sicsaft/`, `aidlc-docs/ccp/`, `aidlc-docs/cip/`, `aidlc-docs/core/`) —
convención completa en [CLAUDE.md](CLAUDE.md) "Metodología AI-DLC para features nuevas".

Casos de Uso oficiales (Cap. 12 del tomo — actor, objetivo, precondiciones, flujo, reglas,
excepciones, evidencia; con el estado real de cada uno en el repo) y el **plan de QA para el
cliente Nivel 1**: [`casos-de-uso/`](casos-de-uso). Es una de las bases del Plan Maestro de
Desarrollo y del Plan Maestro de Pruebas.

## Dónde está el trabajo activo hoy

**APP QR SICSAFT** (`app-qr-sicsaft/`) sigue siendo el sistema con más código y el único con
usuarios reales en mente. Su identificador técnico interno (`package.json` → `name`) es
`app-qr-sicsaft`; el nombre visible del producto sigue siendo "APP QR SICSAFT" (ver
`aidlc-docs/app-qr-sicsaft/design-artifacts/ADR/ADR-003-rename-app-qr-sicsaft.md`).

**CIS** (`cis/`) ya tiene código real también: esqueleto NestJS + el Conector QR mockeado
(DOC-002) corriendo detrás de autenticación real vía Zitadel (ADR-002) — lint, unit, e2e, build y
`docker build`/`docker run` verificados. **CORE** (`core/`) tiene el mismo esqueleto base (`GET
/`, `GET /health`) más `GET /entitlements`, que resuelve el modelo de `Contrato`
([DOC-004](base-patrimonial/DOC-004-modelo-contrato.md)) sobre una base Postgres real dedicada
(esquema versionado con migraciones reales en `core/migrations/`, ya no un seed en memoria ni un
`.sql` aplicado a mano) — corre como servicio
interno en el compose local, sin ruta de Traefik (solo lo consume CIS). **El círculo CIS↔CORE ya
está cerrado y protegido**: `auth/session` llama a `GET /entitlements` de verdad
(`cis/src/core-client/`) con un secreto compartido (`CORE_SERVICE_TOKEN`) que CORE valida en
tiempo constante — sin ese header, 401. Conectividad entre contenedores verificada de forma real
(no solo tests), incluidos los 3 casos del secreto y una corrida real de `docker build`/`docker
run` de CORE contra el Postgres del compose. Lo que sigue faltando: un cliente OIDC real (WEB/APP
QR) que reemplace los tokens firmados a mano de los tests de CIS, y el resto de los 11 dominios de
Base Patrimonial (hoy solo `Contrato`/`Sede`/`Organizacion` tienen tabla real).

Backlog completo y contexto de negocio de APP QR: `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md`.

## Orden de trabajo recomendado

1. **APP QR** completó su backlog local (TASK-004 a TASK-010) — las 12 pantallas del flujo oficial
   están cubiertas, incluida TASK-007 (sincronización real con CORE): las 4 preguntas abiertas del
   handoff ya tienen respuesta (ver `cis/`/`core/` abajo) y `qr-connector.ts` habla HTTP real
   contra CIS. **Verificado real de punta a punta el 2026-08-13** — login OIDC contra Zitadel,
   catálogo real, escaneo y envío persistido en Postgres vía CIS→CORE, ver
   `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` 7 (incluye un bug real de payload encontrado y
   corregido durante la verificación).
2. Modelo de dominio compartido entre `core/` y `base-patrimonial/` — Trello `CORE-ADR-001` /
   `BASE-DOC-001` — **`Contrato` hecho, incluida la tabla real en Postgres**
   ([DOC-004](base-patrimonial/DOC-004-modelo-contrato.md)); Motor Patrimonial (catálogo,
   inventarios) también hecho sobre `sesiones_inventario` (Fase 2 de `ROADMAP.md`) — el resto de
   los 11 dominios de Base Patrimonial sigue pendiente (DOC-005).
3. `cis/` — Trello `CIS-ADR-001` — **hecho**: proxy real hacia CORE (ya no mock), auth real contra
   Zitadel (ADR-002), circuit breaker + reintentos + rate limiting (WAF 4), `deviceId` enforced
   (DOC-002 1) y CORS habilitado para que APP QR le hable directo. `core/` tiene su Orquestador +
   4 motores (Fase 2) y `GET /entitlements` (DOC-004 6) sobre Postgres real — **hecho**. CIS ya lo
   consume vía `CoreClientService`, con auth servicio-a-servicio (secreto compartido) — **hecho**.
4. `seguridad/`: mecanismo de identidad (Zitadel/OIDC), modelo de `Contrato` (DOC-004) y auth
   servicio-a-servicio CIS→CORE ya resueltos e implementados. Lo que sigue abierto es que CORE
   tenga motores reales (Patrimonial, Reglas, Eventos...) sobre el resto del dominio de Base
   Patrimonial (DOC-005), que todavía no tiene tabla ni modelo.
5. `ccp/` — MVP de Fase 5 completo (ver SYS-05 arriba); `cip/` también completo del lado de
   lectura (SYS-06). Después de esta fase, DOC-022 (2026-08-19) separó `ccp/` en tres portales por
   rol: `ccp/` (Profesional de AFT, ex-`web/`), `web_admin/` (Administrador del Sistema, SYS-09) y
   `core/frontend/` (Directivo, SYS-10) — ver `seguridad/README.md` "Mapeo rol → portal →
   hostname".
6. `rfid/` e `integraciones/` quedan para fases posteriores.
7. `devops/` se diseña recién cuando cada sistema tenga su ADR de stack — usa
   [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md) como marco (Trello `OPS-DOC-001`, ya entregado).

Tablero Trello: [SICSAFT](https://trello.com/b/nCi6W4oB/sicsaft) — las tarjetas de cada sistema
llevan el prefijo del código (`CORE-`, `BASE-`, `CIS-`, `SEC-`/`DEC-`, `OPS-`) para diferenciarlas
de las de APP QR (`TASK-`/`DOC-`/`ADR-`, sin prefijo de sistema por ser el primero en marcha).
