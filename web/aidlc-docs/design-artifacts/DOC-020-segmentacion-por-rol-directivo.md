# DOC-020 — Segmentación por rol: vista ejecutiva (Directivo) vs. vista operativa (profesional de AFT)

Diseña la primera segmentación real por rol del Portal WEB (`web/`). Hoy **todo operador
autenticado con contrato vigente ve exactamente el mismo hub** (`HubPage.tsx`, 7 tarjetas
estáticas) — la única autorización real que existe es el rol `administrador-patrimonial`
(escritura oficial, verificado server-side en CORE, DOC-012). "Directivo" solo existía como
nombre en `web/README.md` § "Roles previstos" y como decisión diferida en
[DOC-019](DOC-019-dashboard-cip-frontend.md) §2/§7 — este documento la resuelve.

## 0. Punto de partida: qué NO está definido en ningún tomo

Ningún tomo oficial (`TOMO III/IV`) ni DOC-XXX previo asigna permisos concretos a "Directivo",
"Supervisor", "Auditor" ni "Responsable Patrimonial" como roles técnicos — solo aparecen nombrados
una vez en `web/README.md`. El único rol con semántica real hoy es `administrador-patrimonial`
(DOC-012). Por eso este diseño no reinterpreta ningún tomo: define un rol de **producto** nuevo
(alcance de UI/UX, confirmado con el usuario — ver decisiones §1/§2) sin tocar ninguna regla de
negocio patrimonial existente.

## 1. Alcance del Directivo: solo Dashboard (decisión confirmada con el usuario)

El Directivo ve **únicamente** el módulo Dashboard — no Activos, Contratos, Inventarios ni
Estructura (son herramientas operativas del profesional de AFT), ni Auditoría (queda para un rol
`auditor` propio, si algún día se implementa — no se conflacionan ambos roles acá, mismo criterio
de no-alcance-especulativo que ya aplicó DOC-013 §5 con `modulosContratados`).

## 2. Landing: directo al Dashboard, sin pasar por el hub (decisión confirmada con el usuario)

Si el operador tiene el rol `directivo` (y no `administrador-patrimonial` — ver §5 caso mixto), el
login lo lleva directo a `/dashboard?organizacionId=<única organización con contrato vigente>` —
sin la parada intermedia por el hub de tarjetas. Si tiene contrato vigente en **más de una**
organización, no hay forma de elegir "la organización" sin un paso intermedio — en ese caso cae a
un hub reducido (§4) que solo lista la tarjeta Dashboard por organización, mismo layout que el hub
actual pero con `MODULOS` filtrado a 1 elemento.

## 3. Rol nuevo en Zitadel: `directivo` (config, no código en CIS)

Mismo mecanismo ya usado para crear `administrador-patrimonial` (`devops/local/README.md` §
"Cliente OIDC real (WEB)" — Proyecto "CIS" en Zitadel → Roles → rol nuevo, "Assert Roles on
Authentication" ya habilitado a nivel de proyecto desde ese incremento). El guard que ya parsea el
claim (`ZitadelAuthGuard.extractRolesPorOrganizacion`, `cis/src/common/auth/zitadel-auth.guard.ts`)
es genérico — invierte `{"<rol>": {"<orgId>": "<nombre>"}}` a `{"<orgId>": ["<rol>", ...]}` sin
hardcodear nombres de rol, así que agregar `directivo` **no requiere ningún cambio en CIS**. Se
asigna al usuario/operador igual que se asignó `administrador-patrimonial` en su momento (Console
de Zitadel, sin script).

## 4. Cliente: mismo patrón ya preparado en `oidc-client.ts`, sin usar todavía

`esAdministradorPatrimonial()` (`web/src/lib/oidc/oidc-client.ts` líneas 168-172) ya decodifica el
JWT client-side y expone un booleano — preparado desde Fase 5 pero **sin consumidor real hoy**
(grep confirma que ningún componente lo llama todavía). Mismo criterio explícito en su comentario:
*"Solo para UI... el 403 real lo aplica CORE"* (DOC-013 §4, "ocultar un ítem del menú no es
autorización"). Este documento reusa exactamente ese patrón:

```ts
// oidc-client.ts — nuevo, mismo shape que tieneRolAdministradorPatrimonial
function tieneRolDirectivo(claims: Record<string, unknown> | null): boolean {
  if (!claims) return false;
  const rolesClaim = claims[ZITADEL_PROJECT_ROLES_CLAIM];
  if (!rolesClaim || typeof rolesClaim !== 'object') return false;
  return 'directivo' in rolesClaim;
}

function esDirectivo(): boolean {
  const tokens = loadTokens();
  if (!tokens) return false;
  return tieneRolDirectivo(decodeJwtClaims(tokens.accessToken));
}
```

Exportado desde `oidcClient` junto a `esAdministradorPatrimonial` (mismo objeto, sin API nueva).

## 5. `HubPage.tsx`: bifurca por rol, sin duplicar el componente

No se crea una "página del Directivo" separada — `HubPage` ya calcula `organizaciones` desde
`POST /auth/session`; se agrega una rama antes del render:

- **`esDirectivo() && !esAdministradorPatrimonial()`** (caso puro, el más común): si
  `organizaciones.length === 1`, `<Navigate to="/dashboard?organizacionId=..." replace />`
  inmediato (§2). Si `organizaciones.length > 1`, renderiza el hub con `MODULOS` reducido a
  `[{ path: 'dashboard', nombre: 'Dashboard' }]` por organización (§4/§1).
- **Caso mixto** (`esDirectivo() && esAdministradorPatrimonial()`, un operador con ambos roles en
  alguna organización — posible aunque no forzado por este diseño): gana la vista operativa
  completa (hub actual, los 5+1 módulos) — un administrador-patrimonial necesita **actuar**, no
  solo mirar; ocultarle Activos/Contratos porque también es directivo sería una regresión
  funcional. Mismo criterio "server decide, cliente nunca resta capacidad real" de DOC-013 §4.
- **Caso default** (ninguno de los dos roles — Responsable Patrimonial/Operador/Supervisor de
  `web/README.md`, sin rol Zitadel propio hoy): sin cambios — es la "vista operativa" que ya existe
  y responde la pregunta original ("¿cuál es la página del profesional de AFT?": es el hub actual,
  sin rol especial, porque ningún tomo le exige uno distinto de "operador autenticado con contrato
  vigente").

## 6. `DashboardPage.tsx`: sin cambios de código, un ajuste de contexto

El Directivo llega ahí vía redirect en vez de click en una tarjeta — la página ya funciona
standalone por query param `organizacionId` (no depende de venir del hub), así que no requiere
ningún cambio. El link "SICSAFT" del header (`AppShell.tsx`) sigue apuntando a `/` — para un
Directivo con una sola organización, volver a "/" lo vuelve a mandar directo al Dashboard (mismo
comportamiento del redirect, no un bug).

## 7. Fuera de alcance de este incremento

- Roles Zitadel para Supervisor/Auditor/Responsable Patrimonial — sin necesidad de negocio
  concreta identificada todavía (YAGNI, mismo criterio que dejó `administrador-patrimonial` como
  único rol real desde DOC-012).
- Enforcement server-side de que un Directivo NO pueda escribir — no hace falta: un Directivo sin
  `administrador-patrimonial` ya recibe 403 de CORE ante cualquier intento de escritura
  (`OrquestadorService.verificarRolAdministradorPatrimonial`), este diseño no cambia esa lógica, ni
  necesita replicarla — es una consecuencia gratuita de que los roles son independientes.
- Rol `auditor` combinado con Dashboard (pregunta 1 del usuario, opción no elegida) — si aparece
  demanda real más adelante, es una extensión aditiva de §1 (agregar `Auditoría` a `MODULOS` del
  Directivo), no un rediseño.

## 8. Documentos relacionados

[DOC-019](DOC-019-dashboard-cip-frontend.md) §2/§7 (decisión diferida que este documento resuelve),
[DOC-013](DOC-013-portal-web.md) §4 (autorización a nivel de módulo, no solo de ruta — mismo
criterio aplicado acá), [DOC-012](../../../seguridad/DOC-012-administrador-patrimonial.md) §2
(precedente de creación de rol en Zitadel), `web/README.md` § "Roles previstos".
