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
| SYS-01 | [`qrvault/`](qrvault) | APP QR SICSAFT (captura vía QR) | 🟢 En desarrollo activo — ver `qrvault/HANDOFF-APP-QR-SICSAFT.md` |
| SYS-02 | [`cis/`](cis) | Centro de Interoperabilidad | 🔲 No iniciado |
| SYS-03 | [`core/`](core) | SICSAFT CORE | 🔲 No iniciado |
| SYS-04 | [`base-patrimonial/`](base-patrimonial) | Base Patrimonial Central | 🔲 No iniciado |
| SYS-05 | [`web/`](web) | Portal WEB SICSAFT | 🔲 No iniciado |
| SYS-06 | [`cip/`](cip) | Centro de Inteligencia Patrimonial | 🔲 No iniciado |
| SYS-07 | [`rfid/`](rfid) | RFID SICSAFT | 🔲 No iniciado (fase tardía) |
| SYS-08 | [`integraciones/`](integraciones) | Integraciones externas (ERP, RRHH, BI...) | 🔲 No iniciado (fase tardía) |
| SEC | [`seguridad/`](seguridad) | Identidad / RBAC (transversal) | 🔲 No iniciado |
| OPS | [`devops/`](devops) | Infraestructura / CI-CD / Observabilidad (transversal) | 🔲 No iniciado |

Cada carpeta tiene su propio `README.md` con objetivo, estado, dependencias y próximo paso.

## Dónde está el trabajo activo hoy

El único sistema con código real es **APP QR SICSAFT** (`qrvault/`). Su identificador técnico
interno (`package.json` → `name`) es `qrvault`; el nombre visible del producto sigue siendo
"APP QR SICSAFT" (ver `qrvault/aidlc-docs/design-artifacts/ADR/ADR-003-rename-app-qr-sicsaft.md`).

Backlog completo y contexto de negocio: `qrvault/HANDOFF-APP-QR-SICSAFT.md`.

## Orden de trabajo recomendado

1. **APP QR** sigue avanzando en paralelo (TASK-004 en adelante) con un mock del Conector QR.
2. Modelo de dominio compartido entre `core/` y `base-patrimonial/`.
3. `cis/` con el conector QR mockeado primero.
4. `seguridad/` (auth real) en cuanto SICSAFT CORE responda las preguntas abiertas del handoff.
5. `web/` y `cip/` una vez CORE tenga un MVP de inventarios.
6. `rfid/` e `integraciones/` quedan para fases posteriores.
7. `devops/` se diseña recién cuando cada sistema tenga su ADR de stack.
