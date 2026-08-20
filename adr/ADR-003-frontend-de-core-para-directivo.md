# ADR-003: `core/frontend/` — CORE gana un frontend, sin dejar de ser un servicio interno

## Status
Aceptado

## Context

[ADR-001](ADR-001-stack-backend-nestjs.md) decidió el stack del ecosistema y fue explícito sobre
quién tiene frontend: "Backend (CIS + CORE): NestJS" / "Frontend (WEB, CIP): Vite + React +
TypeScript" — CORE no estaba en la lista de frontend, por diseño: `ARQUITECTURA-WAF.md` lo
modela como capa de decisión/gobierno (Nivel de "validar y gobernar"), sin exposición HTTP
pública — hoy `core` no tiene ruta en Traefik, solo lo llaman `cis`/`cip` dentro de la red interna
de Docker, y la regla no negociable de `CLAUDE.md` es "ninguna fuente de captura puede modificar
la Base Patrimonial directamente — todo pasa por CIS → CORE".

[DOC-022](../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
separa los tres roles del ecosistema (Profesional de AFT, Administrador del Sistema, Directivo) en
tres portales con login propio. El usuario del proyecto pidió explícitamente que el portal del
Directivo viva dentro de la carpeta `core/` ("CORE va a estar conformado de backend y frontend"),
no como un cuarto sistema top-level separado. Esto reabre la decisión de ADR-001 sobre qué
sistemas tienen frontend, así que necesita su propio ADR en vez de simplemente contradecir el
anterior en silencio (`CLAUDE.md` § "Decisiones de stack ya tomadas").

## Decision

**`core/frontend/` es un deploy independiente (Vite + React + TypeScript, mismo stack que
`ccp/`/`web_admin/` — no cambia la elección de ADR-001, solo dónde se usa) que le habla a CIS, no
a CORE directamente.**

- `core/frontend/` es sibling de `core/src/` dentro de la misma carpeta de sistema: `core/` pasa
  a tener dos Dockerfiles (`core/Dockerfile`, el backend NestJS de siempre, sin cambios; y
  `core/frontend/Dockerfile`, un build nginx-unprivileged calcado de `ccp/Dockerfile`) y dos
  pipelines de CI independientes con path filters distintos (`core/**` excluyendo
  `core/frontend/**` para el backend; `core/frontend/**` para el frontend).
- El frontend nunca llama al puerto interno de CORE ni a su base de datos — usa el mismo patrón
  de autenticación OIDC/PKCE y el mismo cliente HTTP contra CIS que ya usan `ccp/`/`web_admin/`.
  Las capacidades nuevas que necesita (designar Profesional de AFT, gestionar roles de su
  organización) se implementan como endpoints nuevos en CIS
  (`cis/src/directivo/`, DOC-022 §4) con un guard propio (`DirectivoGuard`) — mismo patrón ya
  usado para Administrador del Sistema (`AdministradorSistemaGuard`, DOC-021): la escritura es
  gestión de identidad en Zitadel, no un cambio a la Base Patrimonial, así que no pasa por el
  Orquestador de CORE ni por el Motor de Auditoría de Tomo IV.
- CORE-el-backend no gana ninguna ruta HTTP nueva ni deja de ser un servicio interno — "CORE gana
  un frontend" describe únicamente dónde vive el código en el repositorio, no un cambio de qué
  expone CORE a la red. La regla no negociable de `CLAUDE.md` sigue intacta sin excepción.

## Consequences

- **Positivo**: la carpeta `core/` queda alineada con el pedido explícito del usuario
  ("CORE va a estar conformado de backend y frontend") sin abrir una brecha real en el modelo de
  zero-trust de `ARQUITECTURA-WAF.md` §3 — el invariante "todo pasa por CIS" se verifica
  literalmente igual que en `ccp/`/`web_admin/`, porque el frontend de `core/` es, en los hechos,
  un cliente más de CIS.
- **Negativo/a vigilar**: el nombre "frontend de CORE" puede sugerir erróneamente que CORE ganó
  una API pública o que el Orquestador ahora se llama desde fuera de la red interna de Docker —
  ninguna de las dos cosas es cierta. Cualquier cambio futuro que sí exponga CORE directamente
  (saltándose CIS) necesita su propio ADR que reemplace este, no un commit silencioso.
- Si en el futuro se agrega una cuarta superficie de escritura que si necesite pasar por el
  Orquestador/Motor de Auditoría de CORE (por ejemplo, si "valida" — capacidad del Directivo
  dejada fuera de alcance en DOC-022 §6 — termina siendo una validación real sobre datos
  patrimoniales), esa pieza específica sí seguiría el patrón CIS→CORE existente, no el atajo de
  `cis/src/directivo/`.

## Documentos relacionados

[ADR-001](ADR-001-stack-backend-nestjs.md) (decisión de stack que este documento extiende, sin
reemplazarla). [ADR-002](ADR-002-identidad-zitadel-multi-tenant.md) (modelo de identidad que los
tres portales comparten). [DOC-022](../aidlc-docs/ccp/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
(diseño completo de la reestructuración de portales que motiva este ADR).
