# Intent — CORE Fase 2

## Qué se pidió

Continuar `ROADMAP.md` con la Fase 2: darle a SICSAFT CORE su primer valor real más allá de
`GET /entitlements` — un Orquestador y cuatro motores (Patrimonial, Reglas, Eventos, Auditoría)
que sirvan datos reales de las tablas de `base-patrimonial/DOC-005-modelo-patrimonial.md`
(hoy vacías de tráfico real, solo tienen el seed de desarrollo).

Instrucción explícita del usuario para esta fase: documentar todo con metodología AI-DLC
(la que ya usa `app-qr-sicsaft/`), incluir diagramas, y **diseñar antes de programar** — este
directorio es esa etapa de diseño, deliberadamente sin una sola línea de código de Fase 2 todavía.

## Por qué ahora (no antes, no después)

- **No antes**: sin `base-patrimonial/DOC-005` (Fase 1) no había tablas reales contra las que
  diseñar un contrato de API — hubiera sido diseño especulativo.
- **No después**: es el primer punto donde el ecosistema deja de ser "esqueletos + entitlements"
  y empieza a resolver el problema real (inventario patrimonial vía QR) — todo lo que sigue
  (CIS real, TASK-007 de APP QR, WEB, CIP) depende de que esto exista primero.

## Qué NO es esta fase

- No es alta/baja/reincorporación/cambio de responsable de activos — eso es Fase 4
  (Administrador Patrimonial), que es el único rol autorizado a escribir oficialmente
  (Tomo III 1.4). Fase 2 es de **lectura y verificación** (consulta, inventario, traslado,
  cambio de ubicación/estado), no de alta oficial de patrimonio.
- No es Motor de Alertas ni Motor de Reportes — sin consumidor todavía (YAGNI,
  `ARQUITECTURA-WAF.md` 9).
- No es el cliente real de APP QR — sigue siendo `LocalQrConnectorClient`
  (`app-qr-sicsaft/src/lib/qr-connector.ts`) hasta TASK-007 (Fase 3). Esta fase construye lo que
  ese cliente va a consumir, no lo consume ella misma.

## Fuente de verdad

Tomo IV Cap.2 (2.4–2.16, Orquestador + motores + flujo de transacción, ya citado en
`core/README.md`), `base-patrimonial/DOC-005-modelo-patrimonial.md` (tablas), DOC-002
(`app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md`, contrato ya construido del
lado de CIS que este diseño no debe romper).
