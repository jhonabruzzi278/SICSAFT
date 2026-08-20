# Intent — Portal WEB SICSAFT (Fase 5, diseño adelantado)

## Qué se pidió

Durante la sesión de diseño de Fase 2 (CORE), el usuario pidió explícitamente cerrar "la parte
visual" del ecosistema — aclaró que eso incluye tanto renderizar los diagramas ya escritos como
**planificar el diseño visual del Portal WEB**, aunque su construcción (Fase 5) está tres fases
por delante en `ROADMAP.md`.

## Por qué se diseña ahora y no se construye ahora

- **Por qué ahora**: pedido explícito — tener la dirección visual y el contrato de módulos
  definidos de antemano evita improvisar decisiones de UX cuando llegue el momento de construir,
  y permite que Fase 2/3/4 se diseñen ya sabiendo qué forma de datos va a necesitar consumir WEB.
- **Por qué no se construye ahora**: `ccp/README.md` Depende de es explícito — "CORE (MVP de
  inventarios) y CIS (autenticación real)". Ninguno de los dos existe todavía (Fase 2/3 sin
  construir). Construir WEB antes sería código sin nada real contra qué correr.

## Qué NO es este diseño

- No es el diseño de los 17 módulos que `ccp/README.md` lista como "previstos" — solo los 6 que
  `ROADMAP.md` Fase 5 ya acotó como MVP (Activos, Inventarios, Áreas/Ubicaciones/Responsables,
  Auditoría, Contratos, hub).
- No es un design system completo — es una dirección visual concreta (paleta, tipografía, layout
  de referencia) suficiente para no arrancar Fase 5 desde cero, no un Storybook de componentes.
- No define el mecanismo exacto de sesión (SPA pura vs. backend-for-frontend) — queda anotado
  como decisión abierta en DOC-013, a resolver cuando se implemente, con más contexto real de
  qué tan sensible es la sesión de un Administrador Patrimonial (permisos amplios de escritura).

## Fuente de verdad

`ROADMAP.md` Fase 5, `ccp/README.md`, `ARQUITECTURA-WAF.md` 8, `ADR-002` (flujo de login,
Organización→Contrato→Sede), `BRAND.md` (paleta oficial), `DOC-006` (contrato de datos que CIS ya
expone y que WEB también va a consumir).
