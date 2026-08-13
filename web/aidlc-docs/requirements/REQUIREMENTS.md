# Requirements — Portal WEB SICSAFT (Fase 5)

## Funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RF-01 | Login vía Zitadel (authorization code + PKCE), mismo mecanismo probado end-to-end en Fase 0 — sin credenciales propias del portal. | ADR-002, `devops/local/README.md` § "Cliente OIDC real" |
| RF-02 | Hub post-login muestra solo los módulos habilitados por el contrato vigente del operador — nunca todos los módulos a todos los usuarios. | ADR-002 § flujo de login, DOC-004 §5 (`modulosContratados`) |
| RF-03 | Módulo Activos: consulta/búsqueda por organización/área/ubicación, **más alta** — el criterio "Done" de Fase 5 exige poder dar de alta un activo desde WEB. La operación de escritura ya existe en CORE (la habilita Fase 4, Administrador Patrimonial); WEB solo agrega la UI sobre un endpoint que Fase 5 no necesita construir. Baja/traslado/cambio de responsable quedan fuera (sin UI todavía, aunque la capacidad exista en CORE). | ROADMAP.md Fase 5 ("Qué se construye" + criterio "Done") |
| RF-04 | Módulo Inventarios: estado y detalle de sesiones de inventario (`GET /inventarios/:id/estado`, DOC-006 §4) — solo lectura. | ROADMAP.md Fase 5, DOC-006 |
| RF-05 | Módulo Áreas/Ubicaciones/Responsables: ABM completo — es la herramienta del Administrador Patrimonial para mantener la estructura organizacional (DOC-005). | ROADMAP.md Fase 5, Fase 4 |
| RF-06 | Módulo Auditoría: solo lectura, filtrable por usuario/fecha/operación. | DOC-011 (Motor de Auditoría) |
| RF-07 | Módulo Contratos: ABM — hoy la tabla `contratos` de DOC-004 solo se lee; este es el primer cliente que la escribe. | DOC-004 §7 ("quién crea/edita un Contrato") |
| RF-08 | El alta de RF-03 debe hacer visible el activo en el catálogo que consume APP QR (mismo `GET /catalogo`, DOC-006 §2) — criterio "Done" de Fase 5, verifica que WEB y APP QR de verdad comparten el mismo contrato (WAF §8). | ROADMAP.md Fase 5 |

## No funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RNF-01 | Identidad visual desde `BRAND.md` — sin reinventar paleta ni tipografía por sistema. | `CLAUDE.md`, `BRAND.md` |
| RNF-02 | SPA sin SSR (ADR-001) — todo lo que hay detrás de login no necesita SEO. | ADR-001 |
| RNF-03 | Ningún dato de escritura oficial de Base Patrimonial se envía directo — todo pasa por CIS→CORE (regla no negociable, `CLAUDE.md`). | `CLAUDE.md` |
| RNF-04 | Formularios (Áreas, Responsables, Contratos) validados con el mismo patrón ya usado en el ecosistema — schema-first (Zod o equivalente), no validación ad hoc. | Consistencia con `cis/`/`core/` |
| RNF-05 | Accesibilidad: estados de foco visibles, contraste AA mínimo en ambos temas (ver mockup visual). | `BRAND.md` § "Cómo extender a modo claro" |

## Fuera de alcance (explícito)

- Dashboard ejecutivo, RFID, Documentos, Reportes, Integraciones, Roles/Permisos como módulo
  propio, Configuración — los 11 módulos restantes de `web/README.md`, sin consumidor real hasta
  fases posteriores.
- Baja, traslado y cambio de responsable de Activos desde WEB — el MVP solo agrega alta (RF-03),
  el resto de la escritura patrimonial queda sin UI hasta una fase posterior.
