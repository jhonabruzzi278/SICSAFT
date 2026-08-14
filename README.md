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
[ARQUITECTURA-WAF.md § 1.1](ARQUITECTURA-WAF.md#11-diagrama-maestro-de-arquitectura-funcional).

## Sistemas

| Código | Carpeta | Sistema | Estado |
|---|---|---|---|
| SYS-01 | [`app-qr-sicsaft/`](app-qr-sicsaft) | APP QR SICSAFT (captura vía QR) | 🟢 En desarrollo activo — ver `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` |
| SYS-02 | [`cis/`](cis) | Centro de Interoperabilidad | 🟢 Conector QR real, proxy delgado hacia CORE (DOC-002/DOC-006), auth real via Zitadel (ADR-002), circuit breaker + reintentos + rate limiting (WAF §4), `deviceId` enforced, CORS para APP QR/WEB, puente de escritura oficial para Administrador Patrimonial (DOC-012 §5) |
| SYS-03 | [`core/`](core) | SICSAFT CORE | 🟡 Orquestador + 4 motores (Patrimonial, Reglas, Eventos, Auditoría — Fase 2) + escritura oficial de Activo/Contrato/importación masiva (Fase 4, DOC-012) sobre Postgres real — resto de los 9 motores de `core/README.md` sin implementar |
| SYS-04 | [`base-patrimonial/`](base-patrimonial) | Base Patrimonial Central | 🟡 Modelo de `Contrato` documentado e implementado en Postgres (DOC-004) — resto de los 11 dominios sin definir |
| SYS-05 | [`web/`](web) | Portal WEB SICSAFT | 🟢 Los 6 módulos del MVP implementados — login OIDC/PKCE real + Activos/Contratos/Inventarios verificados de punta a punta contra Postgres real, Auditoría y Áreas/Ubicaciones/Responsables verificados con e2e de CORE/CIS |
| SYS-06 | [`cip/`](cip) | Centro de Inteligencia Patrimonial | 🔲 No iniciado |
| SYS-07 | [`rfid/`](rfid) | RFID SICSAFT | 🔲 No iniciado (fase tardía) |
| SYS-08 | [`integraciones/`](integraciones) | Integraciones externas (ERP, RRHH, BI...) | 🔲 No iniciado (fase tardía) |
| SEC | [`seguridad/`](seguridad) | Identidad / RBAC (transversal) | 🟡 Mecanismo (Zitadel/OIDC) y modelo de `Contrato` (DOC-004) resueltos e implementados en CIS/CORE |
| OPS | [`devops/`](devops) | Infraestructura / CI-CD / Observabilidad (transversal) | 🟡 Stack local (Traefik + Postgres + Redis + Zitadel + CIS + CORE) funcionando en Docker Compose |
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
[`adr/`](adr) — [ADR-001](adr/ADR-001-stack-backend-nestjs.md) (NestJS + Vite/React + Postgres +
Redis), [ADR-002](adr/ADR-002-identidad-zitadel-multi-tenant.md) (Zitadel self-hosted, modelo
Organización→Contrato→Sede, dominios bajo `sicsaft.cl`). Operación de infraestructura (VPS,
Docker Compose, CI/CD, DevSecOps): [`devops/README.md`](devops/README.md).

## Dónde está el trabajo activo hoy

**APP QR SICSAFT** (`app-qr-sicsaft/`) sigue siendo el sistema con más código y el único con
usuarios reales en mente. Su identificador técnico interno (`package.json` → `name`) es
`app-qr-sicsaft`; el nombre visible del producto sigue siendo "APP QR SICSAFT" (ver
`app-qr-sicsaft/aidlc-docs/design-artifacts/ADR/ADR-003-rename-app-qr-sicsaft.md`).

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
   `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` §7 (incluye un bug real de payload encontrado y
   corregido durante la verificación).
2. Modelo de dominio compartido entre `core/` y `base-patrimonial/` — Trello `CORE-ADR-001` /
   `BASE-DOC-001` — **`Contrato` hecho, incluida la tabla real en Postgres**
   ([DOC-004](base-patrimonial/DOC-004-modelo-contrato.md)); Motor Patrimonial (catálogo,
   inventarios) también hecho sobre `sesiones_inventario` (Fase 2 de `ROADMAP.md`) — el resto de
   los 11 dominios de Base Patrimonial sigue pendiente (DOC-005).
3. `cis/` — Trello `CIS-ADR-001` — **hecho**: proxy real hacia CORE (ya no mock), auth real contra
   Zitadel (ADR-002), circuit breaker + reintentos + rate limiting (WAF §4), `deviceId` enforced
   (DOC-002 §1) y CORS habilitado para que APP QR le hable directo. `core/` tiene su Orquestador +
   4 motores (Fase 2) y `GET /entitlements` (DOC-004 §6) sobre Postgres real — **hecho**. CIS ya lo
   consume vía `CoreClientService`, con auth servicio-a-servicio (secreto compartido) — **hecho**.
4. `seguridad/`: mecanismo de identidad (Zitadel/OIDC), modelo de `Contrato` (DOC-004) y auth
   servicio-a-servicio CIS→CORE ya resueltos e implementados. Lo que sigue abierto es que CORE
   tenga motores reales (Patrimonial, Reglas, Eventos...) sobre el resto del dominio de Base
   Patrimonial (DOC-005), que todavía no tiene tabla ni modelo.
5. `web/` — en desarrollo (login + módulo Activos, ver ROADMAP.md Fase 5); `cip/` sigue sin
   iniciar, pendiente de que existan inventarios/eventos reales que medir.
6. `rfid/` e `integraciones/` quedan para fases posteriores.
7. `devops/` se diseña recién cuando cada sistema tenga su ADR de stack — usa
   [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md) como marco (Trello `OPS-DOC-001`, ya entregado).

Tablero Trello: [SICSAFT](https://trello.com/b/nCi6W4oB/sicsaft) — las tarjetas de cada sistema
llevan el prefijo del código (`CORE-`, `BASE-`, `CIS-`, `SEC-`/`DEC-`, `OPS-`) para diferenciarlas
de las de APP QR (`TASK-`/`DOC-`/`ADR-`, sin prefijo de sistema por ser el primero en marcha).
