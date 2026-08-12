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

## Sistemas

| Código | Carpeta | Sistema | Estado |
|---|---|---|---|
| SYS-01 | [`app-qr-sicsaft/`](app-qr-sicsaft) | APP QR SICSAFT (captura vía QR) | 🟢 En desarrollo activo — ver `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md` |
| SYS-02 | [`cis/`](cis) | Centro de Interoperabilidad | 🟡 Esqueleto NestJS + mock del Conector QR (DOC-002), auth real via Zitadel (ADR-002) y entitlements reales desde CORE (DOC-004) |
| SYS-03 | [`core/`](core) | SICSAFT CORE | 🟡 Esqueleto NestJS + mock `GET /entitlements` (DOC-004), ya consumido por CIS — ningún motor implementado |
| SYS-04 | [`base-patrimonial/`](base-patrimonial) | Base Patrimonial Central | 🟡 Modelo de `Contrato` documentado (DOC-004) — resto del dominio y motor de BD sin definir |
| SYS-05 | [`web/`](web) | Portal WEB SICSAFT | 🔲 No iniciado |
| SYS-06 | [`cip/`](cip) | Centro de Inteligencia Patrimonial | 🔲 No iniciado |
| SYS-07 | [`rfid/`](rfid) | RFID SICSAFT | 🔲 No iniciado (fase tardía) |
| SYS-08 | [`integraciones/`](integraciones) | Integraciones externas (ERP, RRHH, BI...) | 🔲 No iniciado (fase tardía) |
| SEC | [`seguridad/`](seguridad) | Identidad / RBAC (transversal) | 🟡 Mecanismo (Zitadel/OIDC) y modelo de `Contrato` (DOC-004) resueltos e implementados en CIS/CORE |
| OPS | [`devops/`](devops) | Infraestructura / CI-CD / Observabilidad (transversal) | 🟡 Stack local (Traefik + Postgres + Redis + Zitadel + CIS + CORE) funcionando en Docker Compose |
| — | [`landing/`](landing) | Landing comercial (cara al cliente) | 🟢 Construida — `npm install && npm run dev`. Sin datos internos de desarrollo. |

Cada carpeta tiene su propio `README.md` con objetivo, estado, dependencias y próximo paso.

Arquitectura de referencia transversal (escalable, modular, resiliente, marco Well-Architected
sin atarse a un proveedor de nube): [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md).

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
([DOC-004](base-patrimonial/DOC-004-modelo-contrato.md)) sobre un seed en memoria — corre como
servicio interno en el compose local, sin ruta de Traefik (solo lo consume CIS). **El círculo
CIS↔CORE ya está cerrado**: `auth/session` llama a `GET /entitlements` de verdad
(`cis/src/core-client/`), con la conectividad entre contenedores verificada de forma real (no
solo tests). Lo que sigue faltando: auth servicio-a-servicio CIS→CORE, y un cliente OIDC real
(WEB/APP QR) que reemplace los tokens firmados a mano de los tests de CIS.

Backlog completo y contexto de negocio de APP QR: `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md`.

## Orden de trabajo recomendado

1. **APP QR** completó su backlog local (TASK-004 a TASK-006, TASK-008 a TASK-010) contra un stub
   del Conector QR — las 12 pantallas del flujo oficial están cubiertas. Solo queda TASK-007
   (sincronización real con CORE), bloqueada hasta que CORE responda las preguntas abiertas del
   handoff.
2. Modelo de dominio compartido entre `core/` y `base-patrimonial/` — Trello `CORE-ADR-001` /
   `BASE-DOC-001` — **`Contrato` hecho** ([DOC-004](base-patrimonial/DOC-004-modelo-contrato.md)),
   el resto de los 11 dominios de Base Patrimonial sigue pendiente.
3. `cis/` con el conector QR mockeado — Trello `CIS-ADR-001` — **hecho**, incluye auth real
   contra Zitadel (ADR-002). `core/` tiene su esqueleto básico y `GET /entitlements` (DOC-004 §6)
   — **hecho**. CIS ya lo consume vía `CoreClientService` — **hecho**. Sigue pendiente auth
   servicio-a-servicio CIS→CORE (hoy sin credenciales, aceptable local, no en producción).
4. `seguridad/`: mecanismo de identidad ya resuelto (Zitadel/OIDC, implementado en CIS) y modelo
   de `Contrato` ya documentado (DOC-004, decisión antes rastreada en Trello `DEC-001`). Lo que
   sigue abierto es que CORE lo implemente.
5. `web/` y `cip/` una vez CORE tenga un MVP de inventarios.
6. `rfid/` e `integraciones/` quedan para fases posteriores.
7. `devops/` se diseña recién cuando cada sistema tenga su ADR de stack — usa
   [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md) como marco (Trello `OPS-DOC-001`, ya entregado).

Tablero Trello: [SICSAFT](https://trello.com/b/nCi6W4oB/sicsaft) — las tarjetas de cada sistema
llevan el prefijo del código (`CORE-`, `BASE-`, `CIS-`, `SEC-`/`DEC-`, `OPS-`) para diferenciarlas
de las de APP QR (`TASK-`/`DOC-`/`ADR-`, sin prefijo de sistema por ser el primero en marcha).
