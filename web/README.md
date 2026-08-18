# CCP — Centro de Control Patrimonial (Portal WEB SICSAFT, SYS-05)

## Objetivo
Aplicación web privada de administración y operación patrimonial (no confundir con APP QR, que
es la app móvil de captura). Consume datos vía CIS/CORE — nunca le habla a CORE directo (regla no
negociable de `CLAUDE.md`).

## Estado
🟢 Los 6 módulos del MVP de Fase 5 implementados, RF-05/RF-06 cerrados por completo — login
OIDC/PKCE real contra Zitadel + **Activos** (consulta + alta), **Contratos** (consulta + alta +
cambio de estado), **Inventarios** (consulta de sesiones + detalle de escaneos), **Auditoría**
(consulta, filtrable por usuario/operación/rango de fecha, sin filtro por organización — gap
distinto, conocido, ver "Gaps" abajo) y **Áreas/Ubicaciones/Responsables** (alta/edición/consulta
de Área y Ubicación, incluida la asignación de responsable/ubicación principal a un Área, más
alta/consulta/baja de Responsable). Activos/Contratos/Inventarios verificados de punta a punta
contra Postgres real (login real de navegador incluido); Auditoría y
Áreas/Ubicaciones/Responsables verificados con unit + e2e reales contra Postgres (CORE y CIS), sin
login real de navegador todavía — ver `cis/README.md` Fase 5 y `devops/local/README.md`
"Cliente OIDC real (WEB)". Diseño AI-DLC completo en
[`aidlc-docs/`](aidlc-docs/00_PROJECT_METADATA.md) (requirements, historias, arquitectura,
[DOC-013](aidlc-docs/design-artifacts/DOC-013-portal-web.md)).

**Qué existe hoy** (`src/`):
- `lib/oidc/` — cliente OIDC authorization code + PKCE, puerto por puerto idéntico al patrón ya
  probado en `app-qr-sicsaft/src/lib/oidc/` (mismo proyecto "CIS" en Zitadel, aplicación OIDC
  propia `web-sicsaft`, ver `devops/local/README.md`). `sessionStorage`, no `localStorage` — el
  Administrador Patrimonial re-autentica cada sesión de navegador (mayor blast radius que APP QR,
  ver `aidlc-docs/design-artifacts/ARCHITECTURE.md` "Decisión abierta"). `esAdministradorPatrimonial()`/
  `esDirectivo()` (DOC-020) decodifican el rol del JWT client-side, solo para UI — la autorización
  real siempre corre en CORE.
- `lib/cis-client.ts` — cliente hacia CIS: `POST /auth/session` (entitlements), `GET /catalogo`
  (ambos ya existían, reusados tal cual — WAF 8, "WEB y APP QR son clientes intercambiables del
  mismo contrato"), `GET /inventarios` + `GET /inventarios/:id` (ya existían para APP QR salvo el
  listado, que es nuevo) y `POST /admin/activos`, `GET/POST /admin/contratos`,
  `PATCH /admin/contratos/:id` (nuevos, `cis/src/administrador/`, DOC-012 5/7).
- `pages/LoginPage.tsx`, `AuthCallbackPage.tsx` — flujo de login.
- `pages/HubPage.tsx` — lista las organizaciones con contrato vigente del operador (RF-02) y, por
  cada una, los módulos ya implementados. RF-10 (DOC-020): un Directivo puro (sin
  `administrador-patrimonial`) con una sola organización aterriza directo en `/dashboard`, sin
  pasar por este hub; con varias organizaciones, o en el caso mixto, sigue viendo el hub (reducido
  a solo Dashboard para el Directivo puro, completo para el resto).
- `pages/ActivosPage.tsx` — RF-03: tabla de `GET /catalogo` + formulario de alta (react-hook-form
  + zod, RNF-04) contra `POST /admin/activos`. RF-08 verificado: un alta desde acá aparece de
  inmediato en el mismo catálogo que consumiría APP QR.
- `pages/ContratosPage.tsx` — RF-07: tabla de `GET /admin/contratos` + formulario de alta +
  botones de transición de estado por fila (solo se ofrecen las transiciones válidas de DOC-004
  3, `TRANSICIONES_VALIDAS_CONTRATO` en `lib/cis-client.ts` — la validación real siempre vuelve a
  correr en CORE). Primer cliente que escribe la tabla `contratos` (antes solo se leía).
- `pages/InventariosPage.tsx` — RF-04: solo lectura (las sesiones se crean desde APP QR, WEB solo
  las consulta). Tabla de sesiones + panel de detalle (escaneos con su resultado) al hacer click
  en una fila. Requirió agregar `GET /inventarios` (listado) tanto en CORE como en CIS — antes
  solo existía `GET /inventarios/:id/estado`, que exige conocer el `id` de antemano.
- `pages/AuditoriaPage.tsx` — RF-06: solo lectura, tabla de las entradas más recientes (tope 200,
  `GET /admin/auditoria`) filtrables por usuario/operación (búsqueda parcial — `operacion` incluye
  el id del recurso en varias operaciones, ej. `POST /activos/{id}/baja`, un filtro exacto casi
  nunca matchearía) y por rango de fecha (`<input type="datetime-local">`, convertido a ISO antes
  de mandarlo — CORE compara directo contra la columna `timestamptz`). Sin selector de
  organización — a diferencia de Activos/Contratos/Inventarios, no vive dentro del flujo
  por-organización del hub, sino como link directo en el header (`AppShell`), porque la tabla
  `auditoria` de CORE no tiene `organizacionId` (ver "Gaps" abajo).
- `pages/EstructuraPage.tsx` — RF-05: ABM de Área/Ubicación/Responsable, tres secciones en una
  pantalla (tabla + alta + edición cada una donde aplica: `GET/POST/PATCH /admin/areas`,
  `GET/POST/PATCH /admin/ubicaciones`, `GET/POST /admin/responsables` +
  `PATCH /admin/responsables/:id/estado`, todos nuevos en CIS/CORE). El orden de las secciones
  sigue la dependencia real: Ubicaciones necesita elegir una sede (tomada de
  `organizacion.sedes` del mismo `POST /auth/session` que ya usa el hub) y Responsables necesita
  elegir un Área ya creada (`areaId` es obligatorio, no hay responsable sin área) — por eso Áreas
  va primero y alimenta el selector de las otras dos secciones. Cada tabla tiene un botón "Editar"
  por fila que reemplaza el formulario de alta por uno de edición (mismo panel, alterna entre los
  dos modos) — Área incluye la asignación de `responsableId`/`ubicacionPrincipalId` (ids en texto
  libre, DOC-005 2 dejaba ese ciclo abierto a propósito al alta; ahora se cierra vía edición) y
  Ubicación no permite cambiar `sedeId` (mover de sede es un traslado, operación distinta, fuera de
  alcance). La "baja" de un Responsable es cambiar su `estado` a `inactivo` (nunca un DELETE,
  mismo criterio que Activo/Contrato) — el botón alterna activo/inactivo en la tabla.

**Decisiones de esta primera versión, distintas del diseño original de `ARCHITECTURE.md`**:
- Sin `shadcn/ui`/`radix-ui` — primitivos propios en `components/ui.tsx` (Tailwind v4 + los
  tokens de `BRAND.md` directo, sin capa de componentes de terceros) para minimizar dependencias
  del primer incremento. Migrar a shadcn/ui es straightforward si se necesita más adelante
  (mismos tokens de color).
- Sin `next-themes`/toggle de tema — solo modo oscuro (mismo criterio que la landing oficial, ver
  `BRAND.md`). RNF-05 (foco visible, contraste AA) verificado con contraste real calculado
  (compositing de opacidad incluido, fórmula WCAG 2.1) el 2026-08-14 — encontró y corrigió un
  hallazgo real: el badge de estado `vencido`/fallback (`components/ui.tsx`) usaba
  `text-text-faint` sobre `bg-text-faint/15`, con 3.50:1 de contraste efectivo, bajo el mínimo AA
  (4.5:1); corregido a `text-text-dim`/`bg-text-dim/15` (6.64:1). El resto del sistema de color
  (texto principal/atenuado, badges `success`/`warning`/`destructive`, foco visible) ya pasaba AA
  cómodamente.
- Sin lectura de `catalogo_activos` — el campo "Catálogo (id)" del formulario de alta de Activos
  es texto libre (ids del seed de desarrollo: `catalogo-notebook`, `catalogo-proyector`) porque
  no existe todavía un endpoint que liste el catálogo de tipos de activo (gap ya anotado en
  DOC-013 3).

**Gaps de arquitectura real encontrados y resueltos en este incremento**:
- El claim de rol que Zitadel firma (`rolesPorOrganizacion`) usa el id de organización **de
  Zitadel**, no el `organizacionId` de texto que CORE entiende (`duoc-uc`) — sin traducirlo,
  ningún token real podría autorizar una escritura oficial aunque el rol estuviera bien asignado.
  Se resolvió con un mapeo explícito en CIS (`ZITADEL_ORG_ID_MAP`, ver
  `cis/src/administrador/organizacion-mapping.config.ts`) — mismo gap que `DOC-004 7` ya
  documentaba para lectura, ahora también cerrado para el camino de escritura.
- `GET /contratos` y `GET /inventarios` (listado) no existían en CORE — `Contrato` solo se leía
  indirecto vía `GET /entitlements` (sin `id`/`estado`) y las sesiones de inventario solo se
  podían consultar una por una si ya se conocía su `id`. Se agregaron
  `core/src/entitlements/contrato.controller.ts` e
  `InventariosController.getInventarios`/`getInventarioDetalle` — lectura abierta
  (`ServiceTokenGuard` a secas, sin exigir ningún rol, DOC-012 4).
- CORS de CIS solo permitía `GET`/`POST` — `PATCH /admin/contratos/:id` fallaba en el navegador
  (bloqueado en el preflight) hasta agregar `PATCH` a `CIS_CORS_ORIGIN`/`methods` en `src/main.ts`.
- `@UsePipes()` a nivel de método en `AdministradorController.actualizarEstadoContrato` validaba
  **todos** los parámetros del handler, incluido `@Param('id')` (un string) contra un schema que
  esperaba un objeto — rompía con "Payload inválido" en cualquier request real, invisible en los
  specs unitarios porque ahí se llama al método directo sin pasar por el pipeline HTTP de Nest.
  Encontrado probando el flujo real desde el navegador; corregido a un pipe por parámetro (mismo
  patrón que ya usaban los endpoints de escritura de Activo en CORE, y aplicado preventivamente a
  los nuevos endpoints de Inventarios) y cubierto con un e2e nuevo
  (`cis/test/administrador.e2e-spec.ts`) para que no vuelva a pasar desapercibido.
- **`GET /auditoria` no filtra por organización** (gap conocido, sin resolver — distinto del
  filtro por usuario/operación/fecha, ya cerrado, ver abajo): la tabla `auditoria` de CORE
  (DOC-005 7) no tiene columna `organizacionId` — audita cualquier operación del ecosistema, no
  solo las de una organización. `AuditoriaPage` en WEB muestra entradas de **todo** el ecosistema a
  cualquier operador autenticado con contrato vigente en alguna organización, sin importar cuál.
  Aceptado para este incremento porque el volumen real es bajo (mismo criterio ya aplicado a
  `GET /contratos`, que tampoco filtra) — agregar el filtro requiere una migración nueva (columna +
  índice) y threading de `organizacionId` a través de cada llamada a
  `AuditoriaRepository.registrar` en `OrquestadorService`, deliberadamente fuera de alcance de este
  incremento (ver DOC-011).
- **RF-06 (Auditoría) cerrado (2026-08-14)**: `AuditoriaRepository.listar` ganó filtros opcionales
  por `usuario`/`operacion` (`ILIKE '%valor%'`, no igualdad exacta — `operacion` incluye el id del
  recurso en varias operaciones, ej. `POST /activos/{id}/baja`, `PATCH /responsables/{id}/estado`;
  un filtro exacto casi nunca matchearía más de una fila) y por rango `fechaDesde`/`fechaHasta`
  (inclusive en ambos extremos). `AuditoriaPage` agrega el formulario correspondiente. Verificado
  con unit + e2e reales contra Postgres, incluido el caso de rango de fecha que excluye entradas
  fuera del rango.
- **RF-05 (Área/Ubicación/Responsable)** no existía ni en CORE ni en CIS — módulo nuevo
  `core/src/estructura/` (repositories + `EscrituraEstructuraService`, invocado desde
  `OrquestadorService` con el mismo patrón de autorización+auditoría que Activo/Contrato) y puente
  nuevo en `AdministradorController`/`AdministradorService` de CIS. `Ubicacion`/`Responsable` no
  tienen columna `organizacionId` propia (`sede_id`/`area_id` respectivamente) — la escritura
  cruza esas referencias contra `organizacionId` antes de insertar (defensa en profundidad, mismo
  criterio que `ActivoRepository` con activos de otra organización, DOC-012 3) en vez de confiar
  solo en la FK de Postgres, que no distinguiría una sede/área real pero de otra organización.
- **RF-05 cerrado por completo (2026-08-14)**: `AreaRepository.actualizar`/`UbicacionRepository.actualizar`
  nuevos en CORE (`PATCH /areas/:id`, `PATCH /ubicaciones/:id`), mismo patrón de defensa en
  profundidad que el alta (cross-organización antes de escribir) y mismo criterio "404 sin
  confirmar existencia en otra organización" que `ActivoRepository.cambiarEstado`. La edición de
  Área incluye `responsableId`/`ubicacionPrincipalId` — cierra el ciclo que DOC-005 2 dejaba
  abierto a propósito al alta ("sin ciclo estricto de creación" explicaba por qué el alta no los
  exige, no por qué la asignación posterior no se podía hacer nunca). Sin `sedeId` editable en
  Ubicación — mover de sede es un traslado, operación distinta y más grande, fuera de alcance
  (mismo criterio que dejó el traslado de Activo sin controller HTTP, DOC-008). Puente nuevo en
  CIS (`PATCH /admin/areas/:id`, `PATCH /admin/ubicaciones/:id`) y formularios de edición en
  `EstructuraPage` (botón "Editar" por fila, reemplaza el panel de alta). Verificado con unit +
  e2e reales contra Postgres.
- **RNF-01 (CORE) cerrado (2026-08-14)**: `GET /contratos`, `/auditoria`, `/areas`, `/ubicaciones`,
  `/responsables` de CORE devuelven ahora `{ <entidad>, total }` en vez de array plano (ver
  `../core/README.md`). `cis-client.ts` desempaqueta el envelope y sigue devolviendo un array
  plano a los componentes (`ContratosPage`, `AuditoriaPage`, `EstructuraPage`) — sin cambios ahí.
  WEB no tiene UI de paginación (ningún RF la pide todavía) — pide el tope de página (`limit=100`)
  en vez de el default (20) para no perder filas silenciosamente mientras el volumen se mantenga
  bajo esa cota; si crece más allá, hace falta una UI de paginación real (nuevo RF, no este).
- **5 gaps de cobertura del CCP frente al alcance del Profesional de AFT (auditados 2026-08-18,
  ver [DOC-012 § "Cobertura real desde el CCP hoy"](../seguridad/DOC-012-administrador-patrimonial.md)
  para el detalle completo con archivo/línea)**, ninguno resuelto todavía:
  - **Estados/ciclo de vida de Activo** — CORE tiene `baja`/`reincorporacion`/`responsable`
    completos (`core/src/patrimonial/activo-escritura.controller.ts`) pero CIS no los expone en
    `/admin/activos` y `ActivosPage.tsx` solo tiene alta+consulta — el Profesional de AFT no puede
    dar de baja un Activo, reincorporarlo ni cambiarle el responsable desde el CCP.
  - **Familias/categorías** — sin lectura ni CRUD del catálogo de tipos de activo; `catalogoId`
    sigue siendo texto libre en el alta (mismo gap que "Sin lectura de `catalogo_activos`" ya
    anotado arriba, ahora nombrado explícitamente contra el alcance funcional pedido).
  - **Descripciones** — `Activo` no tiene un campo de descripción libre editable.
  - **Documentación y fotografías** — sin modelo, endpoint ni UI en ningún sistema del
    ecosistema.
  - **Importaciones controladas desde archivos** — `POST /importaciones/contable` funciona y está
    probado en CORE, pero sin puente en CIS ni UI en WEB — solo alcanzable con una llamada HTTP
    directa a CORE hoy.

## Módulos previstos
6 en el MVP de Fase 5 (ver [DOC-013](aidlc-docs/design-artifacts/DOC-013-portal-web.md)), los 6
con código funcionando y sus requisitos cerrados: Activos (🟢), Contratos (🟢), Inventarios (🟢),
hub (🟢), Auditoría (🟢, filtrable por usuario/operación/fecha — RF-06 cerrado, ver "Gaps"
arriba), Áreas/Ubicaciones/Responsables (🟢, ABM completo incluida la edición de Área/Ubicación —
RF-05 cerrado, ver "Gaps" arriba). Un séptimo módulo, Dashboard (🟢 implementado — RF-09,
[DOC-019](aidlc-docs/design-artifacts/DOC-019-dashboard-cip-frontend.md)), expone el primer
dashboard de CIP (SYS-06, Fase 6) vía un proxy nuevo en CIS (`src/dashboard-connector/`) — WEB
nunca le habla a CIP directo. El resto — Incidencias, Movimientos, QR, RFID, Documentos, Reportes,
Usuarios, Roles, Configuración, Integraciones — sigue sin diseñar (sin consumidor real).

## Roles previstos
**Profesional de AFT** (nombre funcional del rol `administrador-patrimonial` de Zitadel, ver
[DOC-012 "Nomenclatura"](../seguridad/DOC-012-administrador-patrimonial.md)) es el usuario
principal de Nivel 1 responsable de cargar y mantener la información patrimonial desde el CCP —
activos, códigos patrimoniales, descripciones, familias/categorías, áreas, ubicaciones,
responsables, estados, documentación/fotografías, preparación de inventarios e importaciones
controladas. **Directivo** (DOC-020) ya implementado, vista ejecutiva de solo Dashboard. Perfiles
futuros anticipados, sin diseño ni rol de Zitadel todavía: Supervisor, Auditor, Administrador —
cada uno con permisos distintos, sin que ninguno reemplace la responsabilidad de Nivel 1 del
Profesional de AFT.

## Desarrollo local
Requiere el stack de `../devops/local` corriendo (Zitadel + CIS + CORE + Postgres) y la app OIDC
`web-sicsaft` ya creada (ver `../devops/local/README.md` "Cliente OIDC real (WEB)").
```bash
cd web
npm install
cp .env.example .env   # completar VITE_ZITADEL_CLIENT_ID con el Client ID real
npm run dev            # http://localhost:5174
```

**Dentro del stack de Docker** (en vez de `npm run dev` suelto): completar
`WEB_VITE_ZITADEL_CLIENT_ID` en `devops/local/.env` y correr `docker compose up -d --build web`
desde `devops/local/` — sirve el build de producción vía nginx en
`http://web.sicsaft.localhost` (Traefik, `devops/local/traefik/dynamic.yml`). Como Vite incrusta
las `VITE_*` en build time, cambiar `WEB_VITE_ZITADEL_CLIENT_ID` exige reconstruir la imagen
(`docker compose build web`), no solo reiniciar el contenedor.

## Depende de
CORE (escritura oficial de `Activo`/`Contrato`/`Area`/`Ubicacion`/`Responsable`, Fases 4/5 — ✅) y
CIS (autenticación real + puente de escritura, `src/administrador/` — ✅). Sin dependencias
pendientes para el MVP de Fase 5.

## Bloquea
Nada crítico.

## Documentos relacionados
[DOC-013](aidlc-docs/design-artifacts/DOC-013-portal-web.md) — módulos MVP y contra qué endpoint
de CIS/CORE pega cada uno.
[`seguridad/DOC-012-administrador-patrimonial.md`](../seguridad/DOC-012-administrador-patrimonial.md)
— contrato de escritura oficial que `POST /admin/activos` y `POST/PATCH /admin/contratos` exponen.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 8 (WEB y APP QR son clientes intercambiables
del mismo contrato de CIS/CORE).

## Próximo paso sugerido
Los 6 módulos del MVP de Fase 5 tienen código funcionando, y RF-05/RF-06 ya cerraron su requisito
por completo (ver `../REQUISITOS.md`, sin filas pendientes en "RF/RNF con estado parcial" para
WEB). Lo que queda:
1. Verificación real de punta a punta de Auditoría y Áreas/Ubicaciones/Responsables desde el
   navegador (login real, como ya se hizo con Activos/Contratos/Inventarios) — hoy solo están
   probados con e2e de CORE/CIS.
2. ✅ Módulo Dashboard (RF-09, [DOC-019](aidlc-docs/design-artifacts/DOC-019-dashboard-cip-frontend.md))
   implementado: `src/dashboard-connector/` nuevo en CIS (proxy hacia CIP con `CipClientService`
   propio — mismo patrón de retry+circuit breaker que `CoreClientService`, mismo criterio de
   autorización que `qr-connector.controller.ts`, sin rol adicional) + `DashboardPage.tsx` en WEB
   (KPIs de cobertura, áreas controladas con drill-down por área, sesiones con veredicto, activos
   fuera de área/no localizados, incidencias filtrables por código QR, estado de AFT, y un gráfico
   circular por categoría — SVG propio, sin librería nueva). Verificado de punta a punta contra
   Docker real: login OIDC real vía `web.sicsaft.localhost`, un `POST /inventarios` y un
   `POST /activos` reales disparados dentro de la red Docker confirmados en pantalla (cobertura,
   veredicto de sesión, estado de AFT y categorías, todos con datos reales).
3. ✅ RF-10 (segmentación por rol Directivo, [DOC-020](aidlc-docs/design-artifacts/DOC-020-segmentacion-por-rol-directivo.md))
   implementado: `esDirectivo()` en `oidc-client.ts` (mismo patrón que ya existía
   `esAdministradorPatrimonial()`, hoy sin consumidor hasta este incremento) + bifurcación en
   `HubPage.tsx` — un Directivo puro aterriza directo en `/dashboard` sin pasar por el hub, el caso
   mixto (Directivo + administrador-patrimonial) ve el hub operativo completo, y el profesional de
   AFT (sin rol especial) no tiene cambios. Verificado real de punta a punta con los 3 casos: rol
   `directivo` creado en el proyecto CIS de Zitadel (`devops/local/README.md` "Rol `directivo`"),
   tres usuarios de prueba (solo `directivo` → redirect a `/dashboard`; `directivo` +
   `administrador-patrimonial` → hub completo; solo `administrador-patrimonial` → hub completo sin
   cambios), cada login confirmado con el claim real del JWT.

✅ `Dockerfile`/`web-ci.yml`/servicio en el compose local — WEB ya tiene imagen de producción
(nginx sirviendo el build de Vite, usuario sin privilegios) y corre dentro del stack en
`http://web.sicsaft.localhost` además de `npm run dev` suelto (ver "Desarrollo local" arriba).

✅ e2e Playwright del flujo de login + alta (`tests/login-alta.spec.js`) — mismo patrón que
`app-qr-sicsaft/tests/` (MSW mockea CIS en modo `VITE_MOCK_API=true`, `.env.e2e`; el redirect real
a Zitadel se salta sembrando `sessionStorage` con un JWT sin firmar, `tests/helpers.js`
`seedAuth()` — CIS es quien valida de verdad server-side, el cliente solo mira si hay tokens
guardados). Cubre: operador sin sesión redirigido a `/login`, y login + alta de Activo visible de
inmediato en el mismo catálogo (RF-08). Corre en CI (`web-ci.yml`) y local con `npm run test:e2e`.
