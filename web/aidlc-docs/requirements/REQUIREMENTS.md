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

## No funcionales

| ID | Requisito | Estado | Fuente |
|---|---|---|---|
| RNF-01 | Identidad visual desde `BRAND.md` — sin reinventar paleta ni tipografía por sistema. | ✅ Implementado | `CLAUDE.md`, `BRAND.md` |
| RNF-02 | SPA sin SSR (ADR-001) — todo lo que hay detrás de login no necesita SEO. | ✅ Implementado (Vite/React) | ADR-001 |
| RNF-03 | Ningún dato de escritura oficial de Base Patrimonial se envía directo — todo pasa por CIS→CORE (regla no negociable, `CLAUDE.md`). | ✅ Verificado (WEB solo le habla a CIS, nunca a CORE) | `CLAUDE.md` |
| RNF-04 | Formularios (Áreas, Responsables, Contratos) validados con el mismo patrón ya usado en el ecosistema — schema-first (Zod o equivalente), no validación ad hoc. | ✅ Implementado (react-hook-form + zod en los 3 formularios) | Consistencia con `cis/`/`core/` |
| RNF-05 | Accesibilidad: estados de foco visibles, contraste AA mínimo en ambos temas (ver mockup visual). | ⚠️ **Sin verificar** — `:focus-visible` está en el CSS base por diseño, pero nunca se auditó con una herramienta (axe, Lighthouse); contraste AA no confirmado formalmente. | `BRAND.md` § "Cómo extender a modo claro" |

## Gaps reales (no solo "fuera de alcance" — pedidos y no resueltos)

Ninguno abierto — los dos gaps detectados en la revisión de requisitos del 2026-08-14 quedaron
cerrados el mismo día:

~~RF-05: sin edición de Área/Ubicación~~ — **cerrado 2026-08-14**, ver tabla de arriba.
~~RF-06: sin filtro por usuario/fecha/operación~~ — **cerrado 2026-08-14**, ver tabla de arriba.

## Fuera de alcance (explícito)

- Dashboard ejecutivo, RFID, Documentos, Reportes, Integraciones, Roles/Permisos como módulo
  propio, Configuración — los 11 módulos restantes de `web/README.md`, sin consumidor real hasta
  fases posteriores.
- Baja, traslado y cambio de responsable de Activos desde WEB — el MVP solo agrega alta (RF-03),
  el resto de la escritura patrimonial queda sin UI hasta una fase posterior.
