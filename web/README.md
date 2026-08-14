# Portal WEB SICSAFT (SYS-05)

## Objetivo
Aplicación web privada de administración y operación patrimonial (no confundir con APP QR, que
es la app móvil de captura). Consume datos vía CIS/CORE — nunca le habla a CORE directo (regla no
negociable de `CLAUDE.md`).

## Estado
🟡 En desarrollo — login OIDC/PKCE real contra Zitadel + módulos **Activos** (consulta + alta),
**Contratos** (consulta + alta + cambio de estado) e **Inventarios** (consulta de sesiones +
detalle de escaneos), los tres verificados de punta a punta contra Postgres real (ver
`cis/README.md` § Fase 5 y `devops/local/README.md` § "Cliente OIDC real (WEB)"). Diseño AI-DLC
completo para el resto del MVP en [`aidlc-docs/`](aidlc-docs/00_PROJECT_METADATA.md)
(requirements, historias, arquitectura, [DOC-013](aidlc-docs/design-artifacts/DOC-013-portal-web.md)).

**Qué existe hoy** (`src/`):
- `lib/oidc/` — cliente OIDC authorization code + PKCE, puerto por puerto idéntico al patrón ya
  probado en `app-qr-sicsaft/src/lib/oidc/` (mismo proyecto "CIS" en Zitadel, aplicación OIDC
  propia `web-sicsaft`, ver `devops/local/README.md`). `sessionStorage`, no `localStorage` — el
  Administrador Patrimonial re-autentica cada sesión de navegador (mayor blast radius que APP QR,
  ver `aidlc-docs/design-artifacts/ARCHITECTURE.md` § "Decisión abierta").
- `lib/cis-client.ts` — cliente hacia CIS: `POST /auth/session` (entitlements), `GET /catalogo`
  (ambos ya existían, reusados tal cual — WAF §8, "WEB y APP QR son clientes intercambiables del
  mismo contrato"), `GET /inventarios` + `GET /inventarios/:id` (ya existían para APP QR salvo el
  listado, que es nuevo) y `POST /admin/activos`, `GET/POST /admin/contratos`,
  `PATCH /admin/contratos/:id` (nuevos, `cis/src/administrador/`, DOC-012 §5/§7).
- `pages/LoginPage.tsx`, `AuthCallbackPage.tsx` — flujo de login.
- `pages/HubPage.tsx` — lista las organizaciones con contrato vigente del operador (RF-02) y, por
  cada una, los módulos ya implementados (Activos, Contratos, Inventarios).
- `pages/ActivosPage.tsx` — RF-03: tabla de `GET /catalogo` + formulario de alta (react-hook-form
  + zod, RNF-04) contra `POST /admin/activos`. RF-08 verificado: un alta desde acá aparece de
  inmediato en el mismo catálogo que consumiría APP QR.
- `pages/ContratosPage.tsx` — RF-07: tabla de `GET /admin/contratos` + formulario de alta +
  botones de transición de estado por fila (solo se ofrecen las transiciones válidas de DOC-004
  §3, `TRANSICIONES_VALIDAS_CONTRATO` en `lib/cis-client.ts` — la validación real siempre vuelve a
  correr en CORE). Primer cliente que escribe la tabla `contratos` (antes solo se leía).
- `pages/InventariosPage.tsx` — RF-04: solo lectura (las sesiones se crean desde APP QR, WEB solo
  las consulta). Tabla de sesiones + panel de detalle (escaneos con su resultado) al hacer click
  en una fila. Requirió agregar `GET /inventarios` (listado) tanto en CORE como en CIS — antes
  solo existía `GET /inventarios/:id/estado`, que exige conocer el `id` de antemano.

**Decisiones de esta primera versión, distintas del diseño original de `ARCHITECTURE.md`**:
- Sin `shadcn/ui`/`radix-ui` — primitivos propios en `components/ui.tsx` (Tailwind v4 + los
  tokens de `BRAND.md` directo, sin capa de componentes de terceros) para minimizar dependencias
  del primer incremento. Migrar a shadcn/ui es straightforward si se necesita más adelante
  (mismos tokens de color).
- Sin `next-themes`/toggle de tema — solo modo oscuro (mismo criterio que la landing oficial, ver
  `BRAND.md`), RNF-05 (foco visible, contraste AA) ya se cumple en un solo tema.
- Sin lectura de `catalogo_activos` — el campo "Catálogo (id)" del formulario de alta de Activos
  es texto libre (ids del seed de desarrollo: `catalogo-notebook`, `catalogo-proyector`) porque
  no existe todavía un endpoint que liste el catálogo de tipos de activo (gap ya anotado en
  DOC-013 §3).

**Gaps de arquitectura real encontrados y resueltos en este incremento**:
- El claim de rol que Zitadel firma (`rolesPorOrganizacion`) usa el id de organización **de
  Zitadel**, no el `organizacionId` de texto que CORE entiende (`duoc-uc`) — sin traducirlo,
  ningún token real podría autorizar una escritura oficial aunque el rol estuviera bien asignado.
  Se resolvió con un mapeo explícito en CIS (`ZITADEL_ORG_ID_MAP`, ver
  `cis/src/administrador/organizacion-mapping.config.ts`) — mismo gap que `DOC-004 §7` ya
  documentaba para lectura, ahora también cerrado para el camino de escritura.
- `GET /contratos` y `GET /inventarios` (listado) no existían en CORE — `Contrato` solo se leía
  indirecto vía `GET /entitlements` (sin `id`/`estado`) y las sesiones de inventario solo se
  podían consultar una por una si ya se conocía su `id`. Se agregaron
  `core/src/entitlements/contrato.controller.ts` e
  `InventariosController.getInventarios`/`getInventarioDetalle` — lectura abierta
  (`ServiceTokenGuard` a secas, sin exigir ningún rol, DOC-012 §4).
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

## Módulos previstos
6 en el MVP de Fase 5 (ver [DOC-013](aidlc-docs/design-artifacts/DOC-013-portal-web.md)): Activos
(🟢), Contratos (🟢), Inventarios (🟢), hub (🟢), Áreas/Ubicaciones/Responsables, Auditoría. El
resto — Dashboard, Incidencias, Movimientos, QR, RFID, Documentos, Reportes, Usuarios, Roles,
Configuración, Integraciones — queda para después, sin diseñar todavía (sin consumidor real).

## Roles previstos
Administrador, Responsable Patrimonial, Operador, Supervisor, Auditor, Directivo.

## Desarrollo local
Requiere el stack de `../devops/local` corriendo (Zitadel + CIS + CORE + Postgres) y la app OIDC
`web-sicsaft` ya creada (ver `../devops/local/README.md` § "Cliente OIDC real (WEB)").
```bash
cd web
npm install
cp .env.example .env   # completar VITE_ZITADEL_CLIENT_ID con el Client ID real
npm run dev            # http://localhost:5174
```

## Depende de
CORE (escritura oficial de `Activo`/`Contrato`, Fase 4 — ✅) y CIS (autenticación real + puente de
escritura, `src/administrador/` — ✅). Para el módulo que falta: los endpoints de escritura de
Áreas/Ubicaciones/Responsables/Auditoría siguen sin existir ni en CORE ni en CIS (DOC-013 §3).

## Bloquea
Nada crítico.

## Documentos relacionados
[DOC-013](aidlc-docs/design-artifacts/DOC-013-portal-web.md) — módulos MVP y contra qué endpoint
de CIS/CORE pega cada uno.
[`seguridad/DOC-012-administrador-patrimonial.md`](../seguridad/DOC-012-administrador-patrimonial.md)
— contrato de escritura oficial que `POST /admin/activos` y `POST/PATCH /admin/contratos` exponen.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §8 (WEB y APP QR son clientes intercambiables
del mismo contrato de CIS/CORE).

## Próximo paso sugerido
Áreas/Ubicaciones/Responsables (RF-05) es el único módulo del MVP que falta y el que más esfuerzo
real requiere: no existe ningún endpoint de escritura todavía, ni en CORE ni en CIS (a diferencia
de Inventarios/Contratos, que reusaron o extendieron infraestructura ya construida). Auditoría
(RF-06, solo lectura) es más simple — requiere agregar `GET /auditoria` en CORE (mencionado como
pendiente en DOC-011) y su puente en CIS.
