# DOC-019 — Módulo Dashboard (CIP) en Portal WEB (incremento nuevo, tras Fase 6)

Contrato del frontend del primer dashboard de CIP (SYS-06, Fase 6 backend ya completa —
[DOC-014](../../../cip/aidlc-docs/design-artifacts/DOC-014-cip-dashboard.md)/[DOC-018](../../../cip/aidlc-docs/design-artifacts/DOC-018-cip-servicio-nestjs.md)).
No repite el diseño de agregación/ingesta de CIP — se centra en cómo un operador humano llega a
ver esos datos. Resuelve las dos decisiones abiertas que DOC-014 §7.1/§7.2 dejó pendientes para
"cuando se diseñe el frontend".

## 1. Decisión: sección nueva dentro de WEB, no una app propia (resuelve DOC-014 §7.2)

CIP no gana una app propia — se agrega como séptimo módulo del Portal WEB (`web/`, SYS-05).

**Motivo, con precedente directo**: `web/README.md` § "Módulos previstos" ya listaba "Dashboard"
entre los módulos futuros de WEB desde Fase 5 ("sin diseñar todavía, sin consumidor real") —
CIP es exactamente ese consumidor. Levantar una segunda SPA solo para esto duplicaría todo lo que
WEB ya resuelve una vez (login OIDC/PKCE contra Zitadel, hub por organización, `AppShell`, sistema
de diseño de `BRAND.md`, Docker/CI/Traefik) sin ganar nada — CIP no tiene identidad de operador
propia (DOC-014 §4, "CIP no valida identidad de operador"), así que necesitaría pedirle prestada la
sesión a WEB de todos modos. `ARQUITECTURA-WAF.md` §8 ya establece que WEB y APP QR son "clientes
intercambiables del mismo contrato" — este dashboard extiende esa misma idea: un módulo más del
mismo portal, no un sistema nuevo.

## 2. Decisión: quién puede leer el dashboard (resuelve DOC-014 §7.1)

Cualquier operador autenticado con contrato vigente en la organización — **sin rol adicional**,
mismo criterio que Activos/Inventarios (`qr-connector.controller.ts`, `ZitadelAuthGuard` +
`RateLimitGuard`, sin chequeo de rol), no el patrón de Auditoría/Contratos/Áreas
(`administrador.controller.ts`, reservado para escritura oficial). Fundamento: la información es
agregada y de organización completa, no PII de un individuo ni una operación de escritura — el
mismo razonamiento que ya adelantó DOC-014 §7.1 ("probablemente cualquier operador... a confirmar
con el usuario cuando se diseñe el frontend"). Al no haber una operación de escritura involucrada,
no hay una acción irreversible que proteger detrás de un rol — se resuelve acá sin bloquear en una
pregunta al usuario, con la reserva de que un rol más fino (ej. "Directivo") puede agregarse después
sin romper el contrato (RNF-03).

## 3. Arquitectura de acceso: WEB → CIS → CIP (nunca WEB → CIP directo)

Mismo patrón que **todo** el resto de WEB (RNF-03 de `requirements/REQUIREMENTS.md`): WEB nunca le
habla directo a un backend interno, siempre a través de CIS, que ya tiene la sesión OIDC del
operador y el mapeo `organizacionId` resuelto (`ADR-002`). Sin esta decisión, WEB necesitaría un
segundo mecanismo de autenticación solo para el dashboard (el `CIP_SERVICE_TOKEN` de DOC-018 §3),
rompiendo el invariante "un solo trust boundary por el que WEB pasa siempre".

```
Operador (WEB, sesión Zitadel)
  → GET /dashboard/... (CIS, ZitadelAuthGuard + RateLimitGuard, sin rol adicional)
    → GET /dashboard/... (CIP, x-internal-service-token: CIP_SERVICE_TOKEN)
```

Esto retira la nota "provisional" de DOC-018 §3 ("cualquier llamador interno del ecosistema... se
autentica igual que CIS↔CORE"): CIS pasa a ser el **único** llamador de la API de CIP — mismo rol
que ya cumple con CORE (`CORE_SERVICE_TOKEN`). No hace falta agregar `CIP_SERVICE_TOKEN` a WEB en
ningún momento.

### 3.1 Nuevo módulo en CIS: `src/dashboard-connector/`

Mismo patrón que `qr-connector.module.ts` (proxy transparente hacia un backend, sin lógica de
negocio propia) pero apuntando a CIP en vez de CORE:

```
cis/src/dashboard-connector/
  dashboard-connector.module.ts     — registra el controller + DashboardCipClientService
  dashboard-connector.controller.ts — @Controller('dashboard') @UseGuards(ZitadelAuthGuard, RateLimitGuard)
  dashboard-connector.service.ts    — construye la URL hacia CIP, agrega organizacionId del auth context
  dashboard-connector.schemas.ts    — zod, un query schema por endpoint (mismo shape que DOC-018 §6)
  dashboard-connector.types.ts      — copia local de los 8 tipos de respuesta de `cip/src/dashboard/dashboard.types.ts`
```

- `organizacionId` **no** viene del query param del cliente (a diferencia de CIP, que sí lo exige
  como parámetro libre porque no valida identidad) — WEB nunca debe poder pedir el dashboard de una
  organización a la que el operador no pertenece. `DashboardConnectorService` toma la organización
  del `AuthenticatedRequest.auth` que `ZitadelAuthGuard` ya validó (mismo patrón que
  `QrConnectorService.getCatalogo` — a confirmar contra el código real de `qr-connector.service.ts`
  al construir esto, si ese método ya recibe la organización del auth context o del query; si hoy
  confía en el query param, este módulo es la primera vez que hace falta la validación cruzada
  explícita "el organizacionId pedido debe estar entre las organizaciones con contrato vigente del
  operador" — mismo criterio de defensa en profundidad que `ActivoRepository.cambiarEstado`,
  DOC-012 §3).
- Reusa `CoreClientService`-style config pero hacia CIP: nueva var `CIP_URL` (mismo patrón que
  `CORE_URL`) + `CIP_SERVICE_TOKEN` (ya reservado en `.env.example` desde DOC-018, hoy sin
  consumidor — este módulo es su primer consumidor real).
- Los 8 endpoints son un mapeo 1:1 de DOC-018 §6 bajo el mismo prefijo `/dashboard/...` (sin
  `/admin`, ver §2): `cobertura`, `areas`, `sesiones`, `fuera-de-area`, `no-localizados`,
  `incidencias`, `estado-activos`, `categorias`.

## 4. Frontend: `web/src/pages/DashboardPage.tsx`

Séptimo módulo del hub (`pages/HubPage.tsx`), mismo patrón de tarjeta que los 6 existentes — pero
con una nota distinta en §6 sobre a qué `moduloContratado` lo asocia.

### 4.1 Layout (drill-down Organización → Área → Categoría → Activo, DOC-018 §6)

- **Encabezado de estado**: `actualizadoEn`/`alDia` de cada respuesta (todas lo devuelven, RF-10) —
  un badge "Datos al día" / "Última actualización: hace N min" cuando `alDia = false`, mismo
  criterio de degradación visible que `ARQUITECTURA-WAF.md` §8 exige ("degrada, nunca oculta que
  degradó").
- **Fila de KPI** (`GET /dashboard/cobertura`): activos registrados, activos escaneados, %
  cobertura — 3 números grandes, sin gráfico (RF-01).
- **Áreas controladas vs. pendientes** (`GET /dashboard/areas`): lista con badge
  `controlada_en_periodo` sí/no + `ultima_sesion_en` (RF-02). Click en un área filtra el resto del
  dashboard por `areaId` (query param compartido de la página, no estado global — mismo patrón que
  `InventariosPage` usa `sesionId` seleccionada).
- **Sesiones de inventario** (`GET /dashboard/sesiones`, paginado): tabla con veredicto
  (`exitoso`/`aceptable`/`defectuoso`, badge de color — reusa el sistema de badges de
  `components/ui.tsx`, no uno nuevo) — RF-03.
- **Activos fuera de área** (`GET /dashboard/fuera-de-area`, paginado) y **no localizados**
  (`GET /dashboard/no-localizados`, paginado) — dos tablas, RF-04/RF-05.
- **Incidencias** (`GET /dashboard/incidencias`, paginado, filtrable por `codigoQr`) — RF-06.
- **Estado de los AFT** (`GET /dashboard/estado-activos`): conteo por estado
  (`activo`/`mantenimiento`/`inactivo`/`dado_de_baja`/`en_transito`/`extraviado`) — RF-07.
- **Categorías** (`GET /dashboard/categorias`, filtrable por `areaId`): gráfico circular por
  `familia` (RF-09 — el único RF de DOC-018 que pedía explícitamente un gráfico, motivo por el que
  CORE ganó el campo `familia` crudo en el incremento anterior, DOC-018 §2.6).

"Hasta Activo" del drill-down (DOC-018 §6, último nivel) reusa `InventariosPage` — un click en un
`codigoQr` de cualquier tabla navega a `/inventarios/:id` si pertenece a una sesión, no duplica un
detalle de activo nuevo (mismo criterio de DOC-018: "no se duplica el detalle completo en CIP").

### 4.2 `lib/dashboard-client.ts`

Mismo patrón que `lib/cis-client.ts` — un método por endpoint, todos contra CIS (nunca contra CIP
directo, §3), todos requieren la organización activa del hub (misma que ya trae
`HubPage`/`ActivosPage`, no un selector nuevo).

### 4.3 Sin escritura

Todo el módulo es de solo lectura — ninguna operación de escritura del dashboard (a diferencia de
Activos/Contratos/Áreas). No aplica RNF-04 (validación de formularios) porque no hay formularios.

## 5. Autorización a nivel de módulo (mismo criterio que DOC-013 §4)

Ocultar la tarjeta del hub si el operador no tiene el módulo habilitado es UX, no seguridad — la
autorización real vive en `dashboard-connector.controller.ts` de CIS (§3.1, "el `organizacionId`
pedido debe estar entre las organizaciones con contrato vigente del operador"), igual que todo
módulo de escritura ya exige del lado del servidor.

## 6. Nota abierta heredada: mismo punto sin resolver que DOC-013 §5

Igual que los 6 módulos anteriores, Dashboard no tiene todavía su propio valor en el vocabulario de
`modulosContratados` (DOC-004 §5) — depende de la misma decisión de modelo de negocio que DOC-013
§5 ya dejó abierta ("¿se vende WEB completo o por módulo?"), no se resuelve acá. Mientras esa
decisión no exista, Dashboard se muestra en el hub bajo el mismo criterio que el resto: visible si
el contrato tiene *algún* módulo habilitado (provisional, ya documentado como tal en DOC-013).

## 7. Fuera de alcance de este incremento

- Informe diario automático a hora fija (`requirements/INTENT.md` de `cip/`, requiere scheduler +
  canal de entrega — sin consumidor real todavía).
- Motor de Alertas (sin consumidor real).
- Rol "Directivo" dedicado con acceso exclusivo al dashboard (§2 lo deja abierto para más adelante,
  no bloquea este incremento).
- Selector de sede en el drill-down — sigue cayéndose por el mismo motivo que DOC-018 §2.7
  (`sedeId` no resoluble desde las APIs de lectura de CORE disponibles hoy).

## 8. Documentos relacionados

[DOC-014](../../../cip/aidlc-docs/design-artifacts/DOC-014-cip-dashboard.md) §7 (decisiones que
este documento resuelve), [DOC-018](../../../cip/aidlc-docs/design-artifacts/DOC-018-cip-servicio-nestjs.md)
§3/§6 (API de lectura que este documento consume), [DOC-013](DOC-013-portal-web.md) §4/§5 (mismo
criterio de autorización a nivel de módulo y misma nota abierta de `modulosContratados`),
`ARQUITECTURA-WAF.md` §8 (WEB como cliente intercambiable, degradación visible).
