# Ecosistema SICSAFT — índice de sistemas

Programa compuesto por varios sistemas coordinados. Ninguna fuente de captura debe modificar la
BPI (Base Patrimonial Inteligente) directamente — todo pasa por CIS → CORE.

```
Fuentes de captura (APP SICSAFT/QR, CCP/WEB, RFID, ERP, ...)
        ↓
      CIS (interoperabilidad)
        ↓
    SICSAFT CORE (orquestador + motores)
        ↓
  BPI — Base Patrimonial Inteligente (fuente única de verdad)
        ↓
      CIP (inteligencia patrimonial — Nivel 2)
        ↓
  Usuarios / Organización
```

**Nomenclatura vigente** (Tomo IV): [NOMENCLATURA.md](NOMENCLATURA.md). "Base Patrimonial Central"
está depreciada → **BPI**; niveles = **Modo Básico / Profesional / Enterprise**; el CCP está en
todos los niveles; CIP entra en Nivel 2.

Diagrama completo con los módulos internos de cada nivel:
[ARQUITECTURA-WAF.md 1.1](ARQUITECTURA-WAF.md#11-diagrama-maestro-de-arquitectura-funcional).

## Sistemas

Orden de prioridad de negocio (por qué mirar cada uno primero) y verificación contra código real:
[`aidlc-docs/README.md` §1.1](aidlc-docs/README.md#11-orden-de-prioridad-qué-mirar-primero).
Detalle completo por sistema, estado real y próximo paso: el `README.md` propio de cada carpeta.

| Código | Carpeta | Sistema | Estado |
|---|---|---|---|
| SYS-01 | [`app-qr-sicsaft/`](app-qr-sicsaft) | APP QR SICSAFT — captura vía QR (Nivel 1) | 🟢 Flujo oficial completo (DOC-001, 12 pantallas), auth Keycloak OIDC/PKCE, sync real con CORE, cola offline. Empaquetada en el `.exe` de `sicsaft-core`, además de imagen Docker + CI propios |
| SYS-02 | [`cis/`](cis) | Centro de Interoperabilidad (API Gateway) | 🟢 Único punto de entrada real: auth Keycloak, proxy+circuit breaker hacia CORE/CIP, CRUD contra Keycloak sin Console, ingesta contable (DOC-029). Sin DOC-XXX propio todavía (gap, ver `aidlc-docs/README.md`) |
| SYS-03 | [`core/`](core) | SICSAFT CORE (orquestador + motores) | 🟢 4 motores (Patrimonial, Reglas, Eventos, Auditoría) reales sobre Postgres, 100% cobertura, CRUD de Organización/Sede/Contrato con `estado` bidireccional (nunca `DELETE`, Tomo III 4.10) |
| SYS-04 | [`base-patrimonial/`](base-patrimonial) | BPI — Base Patrimonial Inteligente | 🟢 Modelo (DOC-004/DOC-005) y API transaccional operativos de punta a punta contra Postgres real — resto de los 11 dominios documentados a nivel esquema, sin necesidad de módulos propios adicionales hoy |
| SYS-05 | [`ccp/`](ccp) | CCP — Centro de Control Patrimonial (Profesional de AFT) | 🟢 Estructura, Importaciones, Auditoría y Resumen verificados de punta a punta. Activos/Controles de área se mudaron al CIP (`core/frontend/`) y QR/Etiquetas a `herramientas/generador-qr/` el 2026-09-13. Exclusivo del rol `administrador-patrimonial` (DOC-022) |
| SYS-06 | [`cip/`](cip) | Centro de Inteligencia Patrimonial | 🟢 Backend real (worker `pg-boss`, ADR-005, + 10 endpoints incl. una escritura nueva sin DOC-XXX) — sin frontend propio, lo consume `core/frontend/`. DOC-026 (inteligencia decisional) sigue siendo solo diseño |
| SYS-07 | [`rfid/`](rfid) | RFID SICSAFT | 🔲 No iniciado (fase tardía, deliberado — YAGNI) |
| SYS-08 | [`integraciones/`](integraciones) | Integraciones externas (ERP, RRHH, BI...) | 🔲 No iniciado (fase tardía), salvo CON-CONTABILIDAD ya resuelto por otra vía (ver SYS-01/DOC-029 RF-B) |
| SYS-09 | — | web_admin — Portal del Administrador del Sistema | ⚫ **Eliminado (2026-09).** CRUD de Organización/Contrato/Sede/usuarios: intervención directa del proveedor (BD/script) + bootstrap del wizard; diagnóstico por la consola de logs de `sicsaft-core` |
| SYS-10 | [`core/frontend/`](core/frontend) | Portal WEB del Directivo (+ CIP) | 🟢 Segundo deployable de `core/` — dashboard ejecutivo, organigrama de controles de área con PDF (DOC-035), designar Profesional de AFT. Habla a CIS, nunca a CORE directo (ADR-003) |
| SYS-11 | [`sicsaft-core/`](sicsaft-core) | SICSAFT CORE — app de escritorio (.exe) | 🟢 Instalador Electron real (Nivel 1 y 2, mismo binario): wizard de 3 pasos, 6 servicios embebidos, consola técnica de diagnóstico, empaquetado NSIS. Harness e2e propio (20 specs, 56 tests) contra el `.exe` real |
| SYS-12 | [`ccp-desktop/`](ccp-desktop) | Launcher LAN del puesto del AFT | 🟢 Electron real en producción (DOC-028 Fase G): descubre `sicsaft-core.exe` por UDP en la LAN, TOFU por certificado, abre el CCP real |
| — | [`apk-aft/`](apk-aft) | WebView Android nativa (DOC-029 RF-H) | 🟡 Scaffold Kotlin/Gradle real, sin `.apk` firmado ni prueba en dispositivo todavía |
| SEC | [`seguridad/`](seguridad) | Identidad / RBAC (transversal) | 🟢 Keycloak 26/OIDC ([ADR-004](adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md)) y modelo de `Contrato` (DOC-004) resueltos e implementados en CIS/CORE |
| OPS | — | Infraestructura / Despliegue On-Premise | ⚫ **Retirado (2026-09).** El stack de contenedores `devops/onprem/` (Podman/Docker Compose) fue retirado para consolidar el 100% de la distribución y el despliegue en la app de escritorio `sicsaft-core/` (.exe) |
| — | [`herramientas/etl-contable/`](herramientas/etl-contable) | ETL Python del Excel contable | 🟢 Sidecar `pandas`+`xlrd` real (DOC-029 RF-B), invocado por `sicsaft-core`. `pytest`+`ruff`, sin workflow de CI propio (no es desplegable) |
| — | [`landing/`](landing) | Landing comercial | 🟢 Construida (Vite+Tailwind), solo Vercel — único proyecto Vercel real del repo (`.vercel/repo.json`) |

Cada carpeta tiene su propio `README.md` con objetivo, estado, dependencias y próximo paso.

Arquitectura de referencia transversal (escalable, modular, resiliente, marco Well-Architected
sin atarse a un proveedor de nube): [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md).

Plan de fases para lo que falta construir en todo el ecosistema, ordenado por dependencia real y
verificado contra el código (no solo contra los README): [ROADMAP.md](ROADMAP.md). Índice
consolidado de requisitos funcionales y no funcionales de todos los sistemas (RF/RNF, con estado
real y gaps conocidos): [REQUISITOS.md](REQUISITOS.md).

Identidad visual / paleta de colores oficial (todo trabajo visual del ecosistema debe salir de
acá, no reinventar colores por sistema): [BRAND.md](BRAND.md).

Decisiones de arquitectura del ecosistema (stack, identidad/SSO, dominios, infraestructura):
[`adr/`](adr) — [ADR-001](adr/ADR-001-stack-backend-nestjs.md) (NestJS + Vite/React + Postgres),
[ADR-004](adr/ADR-004-identidad-keycloak-reemplaza-zitadel.md) (Keycloak 26 self-hosted, reemplaza a
[ADR-002](adr/ADR-002-identidad-zitadel-multi-tenant.md) — modelo Organización→Contrato→Sede sin
cambios, dominios bajo `sicsaft.cl`), [ADR-005](adr/ADR-005-postgres-pgboss-reemplaza-redis.md)
(cola de eventos y rate-limiting sobre Postgres — `pg-boss`/memoria, reemplaza a Redis). Operación
e instalación por cliente: [`sicsaft-core/README.md`](sicsaft-core/README.md) y su
[`RUNBOOK-INSTALACION.md`](sicsaft-core/RUNBOOK-INSTALACION.md).

Documentación de metodología AI-DLC (requisitos, historias, diseño y estrategia de testing por
fase, generada antes de escribir código): [`aidlc-docs/`](aidlc-docs), una subcarpeta por sistema
(`aidlc-docs/app-qr-sicsaft/`, `aidlc-docs/ccp/`, `aidlc-docs/cip/`, `aidlc-docs/core/`) —
convención completa en [CLAUDE.md](CLAUDE.md) "Metodología AI-DLC para features nuevas".

Casos de Uso oficiales (Cap. 12 del tomo — actor, objetivo, precondiciones, flujo, reglas,
excepciones, evidencia; con el estado real de cada uno en el repo) y el **plan de QA para el
cliente Nivel 1**: [`casos-de-uso/`](casos-de-uso). Es una de las bases del Plan Maestro de
Desarrollo y del Plan Maestro de Pruebas.

## Dónde está el trabajo activo hoy

Todos los sistemas de la tabla de arriba tienen código real, salvo `rfid/` e `integraciones/`
(deliberadamente no iniciados, fase tardía) y `apk-aft/` (scaffold sin `.apk` firmado todavía). El
próximo incremento pendiente más relevante es **DOC-026** (inteligencia decisional de CIP, 8
preguntas que hoy siguen sin código) — ver el orden de prioridad y el detalle fase por fase en
[ROADMAP.md](ROADMAP.md), que es la fuente de verdad de qué falta y en qué orden (verificado
contra el código, no solo contra los README).

Backlog completo y contexto de negocio de APP QR: `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md`.

## Orden de prioridad

Ver [`aidlc-docs/README.md` §1.1](aidlc-docs/README.md#11-orden-de-prioridad-qué-mirar-primero) —
mismo orden de dependencia real que sigue [ROADMAP.md](ROADMAP.md) "Principio de ordenamiento", no
duplicado acá para no desalinearse con el tiempo.

Tablero Trello: [SICSAFT](https://trello.com/b/nCi6W4oB/sicsaft) — las tarjetas de cada sistema
llevan el prefijo del código (`CORE-`, `BASE-`, `CIS-`, `SEC-`/`DEC-`, `OPS-`) para diferenciarlas
de las de APP QR (`TASK-`/`DOC-`/`ADR-`, sin prefijo de sistema por ser el primero en marcha).
