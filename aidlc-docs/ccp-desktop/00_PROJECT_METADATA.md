# `ccp-desktop` — launcher instalable del puesto del Profesional de AFT — Metadata del proyecto

**Sistema:** `ccp-desktop/` (nuevo — nombre de carpeta propuesto, a confirmar con el usuario)
**Tipo:** Cliente de escritorio liviano Electron (sin backend propio) — ver INTENT.md/RNF-01
**Fase AI-DLC:** Inception — diseño en curso, sin código todavía
**Fecha:** 2026-09-11 (pedido durante la prueba manual de `sicsaft-core` Fase G)
**Gobernanza:** No forma parte todavía de la matriz de
[`GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md`](../GOBERNANZA-ETAPAS-Y-LIMITES-MAESTRO.md) — se agrega
ahí (Stage 1 o incremento propio) recién cuando el diseño esté confirmado.

## Estado

- [x] Intent (qué se pidió, por qué ahora, qué NO es esta fase) — `requirements/INTENT.md`
- [x] Requirements (RF/RNF con ID y fuente) — `requirements/REQUIREMENTS.md`
- [x] Architecture (flujo de discovery, confianza de certificado, empaquetado) —
      `design-artifacts/ARCHITECTURE.md`
- [ ] Confirmación del usuario sobre las preguntas abiertas (timeout de discovery, múltiples PC
      madre en la misma LAN, Opción A vs. B de confianza del certificado) antes de pasar a
      Construction
- [ ] Domain model — no aplica en el sentido clásico (no hay entidades propias, `ccp-desktop` no
      tiene modelo de datos, ver RNF-01); se omite a propósito
- [ ] User stories — pendiente si se pide explícitamente; el alcance ya está acotado en
      REQUIREMENTS.md y no hay ambigüedad de "para quién es" (un único rol: Profesional de AFT)

## Por qué este directorio existe ahora, adelantado

El usuario pidió reemplazar la experiencia "web" de Fase G ([DOC-028](../sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md))
por un `.exe` instalable con descubrimiento automático, y explícitamente antes de retomar el
backlog ya pendiente (actualizar Linear, arreglar APP QR CI). Seguí la regla del repo
("Metodología AI-DLC para features nuevas" en `CLAUDE.md`): diseño en `aidlc-docs/` antes que
código en `src/`, en su propia carpeta al nivel raíz de `aidlc-docs/` — nunca anidada dentro de un
sistema existente, aunque reuse partes de `sicsaft-core/` y `ccp/`.

## Quick Links

- Intent: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requirements: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Lo que reemplaza en la experiencia (no en el backend):
  [DOC-028 Fase G](../sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md)
- Protocolo que reusa: `sicsaft-core/src/main/services/discovery-service.ts`

## Depende de

- **`sicsaft-core`**: sigue siendo el único que corre Postgres/Keycloak/CIS/CORE/CIP y sirve el
  CCP — `ccp-desktop` es un cliente de lo que `sicsaft-core` ya expone (HTTPS `:8767` + UDP
  discovery `:58765`).
- **`ccp`**: el `dist/` que `ccp-desktop` carga es exactamente el build de `ccp/` sin cambios.

## Bloquea

- Nada todavía — es un sistema nuevo en paralelo, no reemplaza a `sicsaft-core` ni a `ccp` en su
  forma actual (ver INTENT.md, RNF-04 de REQUIREMENTS.md).

## Próximo paso sugerido

Presentar `requirements/INTENT.md`, `requirements/REQUIREMENTS.md` y
`design-artifacts/ARCHITECTURE.md` al usuario, resolver las 3 preguntas abiertas + la elección de
confianza de certificado (sección 3 de ARCHITECTURE.md), y **recién ahí** crear el esqueleto de
`ccp-desktop/` (Electron + `electron-vite`, mismo patrón que `sicsaft-core`) en una rama propia.
