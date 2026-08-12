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
| SYS-02 | [`cis/`](cis) | Centro de Interoperabilidad | 🔲 No iniciado |
| SYS-03 | [`core/`](core) | SICSAFT CORE | 🔲 No iniciado |
| SYS-04 | [`base-patrimonial/`](base-patrimonial) | Base Patrimonial Central | 🔲 No iniciado |
| SYS-05 | [`web/`](web) | Portal WEB SICSAFT | 🔲 No iniciado |
| SYS-06 | [`cip/`](cip) | Centro de Inteligencia Patrimonial | 🔲 No iniciado |
| SYS-07 | [`rfid/`](rfid) | RFID SICSAFT | 🔲 No iniciado (fase tardía) |
| SYS-08 | [`integraciones/`](integraciones) | Integraciones externas (ERP, RRHH, BI...) | 🔲 No iniciado (fase tardía) |
| SEC | [`seguridad/`](seguridad) | Identidad / RBAC (transversal) | 🔲 No iniciado |
| OPS | [`devops/`](devops) | Infraestructura / CI-CD / Observabilidad (transversal) | 🔲 No iniciado |
| — | [`landing/`](landing) | Landing comercial (cara al cliente) | 🟢 Construida — `npm install && npm run dev`. Sin datos internos de desarrollo. |

Cada carpeta tiene su propio `README.md` con objetivo, estado, dependencias y próximo paso.

Arquitectura de referencia transversal (escalable, modular, resiliente, marco Well-Architected
sin atarse a un proveedor de nube): [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md).

## Dónde está el trabajo activo hoy

El único sistema con código real es **APP QR SICSAFT** (`app-qr-sicsaft/`). Su identificador técnico
interno (`package.json` → `name`) es `app-qr-sicsaft`; el nombre visible del producto sigue siendo
"APP QR SICSAFT" (ver `app-qr-sicsaft/aidlc-docs/design-artifacts/ADR/ADR-003-rename-app-qr-sicsaft.md`).

Backlog completo y contexto de negocio: `app-qr-sicsaft/HANDOFF-APP-QR-SICSAFT.md`.

## Orden de trabajo recomendado

1. **APP QR** completó su backlog local (TASK-004 a TASK-006, TASK-008 a TASK-010) contra un stub
   del Conector QR — las 12 pantallas del flujo oficial están cubiertas. Solo queda TASK-007
   (sincronización real con CORE), bloqueada hasta que CORE responda las preguntas abiertas del
   handoff.
2. Modelo de dominio compartido entre `core/` y `base-patrimonial/` — Trello `CORE-ADR-001` /
   `BASE-DOC-001`.
3. `cis/` con el conector QR mockeado primero — Trello `CIS-ADR-001`.
4. `seguridad/` (auth real) en cuanto SICSAFT CORE responda las preguntas abiertas del handoff —
   decisión abierta rastreada en Trello `DEC-001`.
5. `web/` y `cip/` una vez CORE tenga un MVP de inventarios.
6. `rfid/` e `integraciones/` quedan para fases posteriores.
7. `devops/` se diseña recién cuando cada sistema tenga su ADR de stack — usa
   [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md) como marco (Trello `OPS-DOC-001`, ya entregado).

Tablero Trello: [SICSAFT](https://trello.com/b/nCi6W4oB/sicsaft) — las tarjetas de cada sistema
llevan el prefijo del código (`CORE-`, `BASE-`, `CIS-`, `SEC-`/`DEC-`, `OPS-`) para diferenciarlas
de las de APP QR (`TASK-`/`DOC-`/`ADR-`, sin prefijo de sistema por ser el primero en marcha).
