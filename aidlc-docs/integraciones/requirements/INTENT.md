# INTENT — CON-CONTABILIDAD (Fase 7 del ROADMAP)

## Qué se pidió

El usuario pidió construir el "conector o carpeta de AFT del cliente para actualización diaria e
intercambio diario con SICSAFT CORE" (2026-08-28). Confirmado en conversación: se refiere al
**CON-CONTABILIDAD** ya descrito en [`ROADMAP.md`](../../../ROADMAP.md) Fase 7 y en
[Tomo III 1.4 Entrada 5](../../../ARQUITECTURA-WAF.md#11-entradas-y-salidas-oficiales-del-ecosistema-tomo-iii-cap1) —
la única fuente de la que **siempre** proviene la Base Oficial, con responsabilidad de
actualización diaria del especialista contable de la organización.

## Por qué ahora

- El camino manual equivalente ya existe y está probado real de punta a punta desde el
  2026-08-18: `POST /importaciones/contable` en `core/` (idempotente por fila, e2e contra
  Postgres real — ver
  [`seguridad/DOC-012-administrador-patrimonial.md`](../../../seguridad/DOC-012-administrador-patrimonial.md)
  6) y su puente manual en `ccp/src/pages/ImportacionesPage.tsx`. Automatizar la entrega diaria
  no requiere tocar ese endpoint — reutiliza el mismo contrato, mismo criterio que ya usa CIS
  para el resto de sus proxies hacia CORE (`cis/src/core-client/core-client.service.ts`).
- `ROADMAP.md` Fase 7 marcaba esta pieza bloqueada hasta tener "un sistema contable/ERP real
  identificado" del lado del cliente (tabla de riesgos: "Construir CON-CONTABILIDAD contra un
  sistema contable hipotético" → mitigación "el conector solo con un sistema real identificado").
  **Decisión explícita del usuario en esta sesión (2026-08-28)**: seguir sin ese sistema real
  identificado todavía, diseñando contra un **formato genérico** (el mismo CSV que ya acepta
  `ImportacionesPage.tsx`/`filaImportacionSchema`) en vez de esperar. Se documenta como
  desviación consciente de la mitigación original, no como que el riesgo dejó de existir — ver
  DOC-016 7 "Riesgo aceptado".

## Qué NO es esta fase

- **No** es una integración de Etapa 5 (`integraciones/README.md` la tenía mal clasificada —
  corregido en el mismo commit, ver ROADMAP.md Fase 7 "Ojo con la clasificación").
- **No** modela los 11 dominios completos de `Configuración`/`Integraciones` que DOC-005 dejó
  fuera — solo lo mínimo que este conector necesita (ver DOC-016 5, decisión de reusar
  `POST /auditoria` en vez de una tabla `integraciones_registro` nueva — YAGNI, sin consumidor
  real de un registro más granular todavía).
- **No** construye contra un sistema contable/ERP real específico — eso sigue pendiente de que
  el negocio identifique uno (ver "Por qué ahora" arriba). Cuando aparezca, el formato de fila
  puede necesitar un adaptador nuevo; el transporte (carpeta vigilada → CORE) no cambia.
- **No** toca CORE — el endpoint de escritura ya existe y ya está probado; este incremento es
  enteramente del lado de CIS (conector) más la config de `sicsaft-core` (dónde vive la carpeta
  en la PC del cliente).
- **No** construye UI — sin consumidor humano directo (el especialista contable deja el archivo
  en la carpeta, no interactúa con SICSAFT). Un futuro panel de estado del conector queda fuera
  de alcance (ver DOC-016 8).

## Fuente de verdad

[ROADMAP.md](../../../ROADMAP.md) Fase 7, [Tomo III 1.4 Entrada 5](../../../ARQUITECTURA-WAF.md)
(vía cita ya existente en `ARQUITECTURA-WAF.md`), [DOC-012](../../../seguridad/DOC-012-administrador-patrimonial.md)
6 (endpoint ya implementado que este conector consume). Detalle de diseño en
[DOC-016](../design-artifacts/DOC-016-conector-con-contabilidad.md).
