# Requirements — Portal WEB SICSAFT (Fase 5)

## Funcionales

| ID | Requisito | Estado | Fuente |
|---|---|---|---|
| RF-01 | Login vía Zitadel (authorization code + PKCE), mismo mecanismo probado end-to-end en Fase 0 — sin credenciales propias del portal. | ✅ Implementado, verificado con login real de navegador | ADR-002, `devops/local/README.md` § "Cliente OIDC real" |
| RF-02 | Hub post-login muestra solo los módulos habilitados por el contrato vigente del operador — nunca todos los módulos a todos los usuarios. | ✅ Implementado | ADR-002 § flujo de login, DOC-004 §5 (`modulosContratados`) |
| RF-03 | Módulo Activos: consulta/búsqueda por organización/área/ubicación, **más alta** — el criterio "Done" de Fase 5 exige poder dar de alta un activo desde WEB. La operación de escritura ya existe en CORE (la habilita Fase 4, Administrador Patrimonial); WEB solo agrega la UI sobre un endpoint que Fase 5 no necesita construir. Baja/traslado/cambio de responsable quedan fuera (sin UI todavía, aunque la capacidad exista en CORE). | ✅ Implementado, verificado de punta a punta | ROADMAP.md Fase 5 ("Qué se construye" + criterio "Done") |
| RF-04 | Módulo Inventarios: estado y detalle de sesiones de inventario (`GET /inventarios/:id/estado`, DOC-006 §4) — solo lectura. | ✅ Implementado, verificado de punta a punta | ROADMAP.md Fase 5, DOC-006 |
| RF-05 | Módulo Áreas/Ubicaciones/Responsables: ABM completo — es la herramienta del Administrador Patrimonial para mantener la estructura organizacional (DOC-005). | ✅ Implementado (2026-08-14) — alta/edición/consulta de Área y Ubicación (`PATCH /areas/:id` y `PATCH /ubicaciones/:id` nuevos, incluida la asignación de `responsableId`/`ubicacionPrincipalId` a un Área) + alta/consulta/baja de Responsable (cambio de estado activo/inactivo, nunca DELETE — Tomo III §4.10). Sin `sedeId` editable en Ubicación (mover de sede es un traslado, fuera de alcance, no lo pide el requisito). Verificado con unit + e2e reales contra Postgres. | ROADMAP.md Fase 5, Fase 4 |
| RF-06 | Módulo Auditoría: solo lectura, **filtrable por usuario/fecha/operación**. | ✅ Implementado (2026-08-14) — filtros por `usuario`/`operacion` (búsqueda parcial, ILIKE) y rango `fechaDesde`/`fechaHasta`, tanto en `AuditoriaRepository.listar` (CORE) como en el formulario de `AuditoriaPage` (WEB). Verificado con unit + e2e reales contra Postgres. | DOC-011 (Motor de Auditoría) |
| RF-07 | Módulo Contratos: ABM — hoy la tabla `contratos` de DOC-004 solo se lee; este es el primer cliente que la escribe. | ✅ Implementado (alta + transición de estado; sin DELETE, por diseño — Tomo III §4.10) | DOC-004 §7 ("quién crea/edita un Contrato") |
| RF-08 | El alta de RF-03 debe hacer visible el activo en el catálogo que consume APP QR (mismo `GET /catalogo`, DOC-006 §2) — criterio "Done" de Fase 5, verifica que WEB y APP QR de verdad comparten el mismo contrato (WAF §8). | ✅ Implementado, verificado | ROADMAP.md Fase 5 |
| RF-09 | Módulo Dashboard: séptimo módulo del hub, expone el primer dashboard de CIP (cobertura, áreas controladas, sesiones con veredicto, activos fuera de área/no localizados, incidencias, estado de AFT, categorías) — solo lectura, cualquier operador con contrato vigente en la organización, sin rol adicional. | ✅ Implementado (2026-08-18) — `src/dashboard-connector/` en CIS (proxy hacia CIP) + `DashboardPage.tsx` en WEB, verificado en el navegador contra MSW y de punta a punta contra Docker real (login OIDC real, evento `alta` real poblando estado/categorías) | DOC-014 §7.1/§7.2 (decisiones que DOC-019 resuelve), DOC-018 §6, DOC-019 |
| RF-10 | Segmentación por rol: el Directivo (rol Zitadel `directivo`, nuevo) aterriza directo en el Dashboard de su organización sin pasar por el hub operativo — no ve Activos/Contratos/Inventarios/Estructura. El profesional de AFT (sin rol especial) sigue viendo el hub operativo actual, sin cambios. | ✅ Implementado (2026-08-18) — `esDirectivo()` en `oidc-client.ts` + bifurcación en `HubPage.tsx`, verificado en el navegador (redirect directo, hub reducido, caso mixto); pendiente verificación contra Zitadel real | DOC-019 §2/§7 (decisión diferida que DOC-020 resuelve), DOC-013 §4, DOC-020 |

## No funcionales

| ID | Requisito | Estado | Fuente |
|---|---|---|---|
| RNF-01 | Identidad visual desde `BRAND.md` — sin reinventar paleta ni tipografía por sistema. | ✅ Implementado | `CLAUDE.md`, `BRAND.md` |
| RNF-02 | SPA sin SSR (ADR-001) — todo lo que hay detrás de login no necesita SEO. | ✅ Implementado (Vite/React) | ADR-001 |
| RNF-03 | Ningún dato de escritura oficial de Base Patrimonial se envía directo — todo pasa por CIS→CORE (regla no negociable, `CLAUDE.md`). | ✅ Verificado (WEB solo le habla a CIS, nunca a CORE) | `CLAUDE.md` |
| RNF-04 | Formularios (Áreas, Responsables, Contratos) validados con el mismo patrón ya usado en el ecosistema — schema-first (Zod o equivalente), no validación ad hoc. | ✅ Implementado (react-hook-form + zod en los 3 formularios) | Consistencia con `cis/`/`core/` |
| RNF-05 | Accesibilidad: estados de foco visibles, contraste AA mínimo en ambos temas (ver mockup visual). | ✅ Verificado (2026-08-14) — contraste calculado real (compositing de opacidad incluido, no solo el color base) contra fórmula WCAG 2.1: texto principal 17.99:1, texto atenuado 9.79:1, texto tenue 4.57:1, todos sobre `--color-bg`; contra `--color-bg-card` los mismos bajan levemente (16.26/8.85/4.13) sin cruzar el mínimo salvo en un caso puntual (ver hallazgo). `:focus-visible` con outline 2px accent, 6.60:1 contra el fondo — supera el 3:1 exigido para indicadores de foco (WCAG 1.4.11). **Hallazgo real corregido**: el badge de estado `vencido`/fallback usaba `text-text-faint` sobre `bg-text-faint/15`, con contraste efectivo real de 3.50:1 — por debajo del mínimo AA (4.5:1) para texto normal. Corregido a `text-text-dim`/`bg-text-dim/15` (6.64:1). Los demás badges (`success`/`warning`/`destructive`) ya pasaban (5.1–6.7:1). Sin modo claro — WEB es solo modo oscuro por diseño (ver `web/README.md` § "Decisiones"), "en ambos temas" del requisito original no aplica. | `BRAND.md` § "Cómo extender a modo claro" |

## Gaps reales (no solo "fuera de alcance" — pedidos y no resueltos)

Ninguno abierto — los dos gaps detectados en la revisión de requisitos del 2026-08-14 quedaron
cerrados el mismo día:

~~RF-05: sin edición de Área/Ubicación~~ — **cerrado 2026-08-14**, ver tabla de arriba.
~~RF-06: sin filtro por usuario/fecha/operación~~ — **cerrado 2026-08-14**, ver tabla de arriba.

## Fuera de alcance (explícito)

- RFID, Documentos, Reportes, Integraciones, Roles/Permisos como módulo propio, Configuración — 10
  de los 11 módulos restantes de `web/README.md`, sin consumidor real hasta fases posteriores.
  Dashboard ejecutivo deja de estar acá: ganó consumidor real (CIP, Fase 6) y su diseño es RF-09.
- Baja, traslado y cambio de responsable de Activos desde WEB — el MVP solo agrega alta (RF-03),
  el resto de la escritura patrimonial queda sin UI hasta una fase posterior.
