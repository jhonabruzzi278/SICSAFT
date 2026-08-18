# DOC-022: Reestructuración de portales — CCP / `web_admin` / frontend de CORE (Directivo)

> **Estado**: diseño (2026-08-18), en construcción el mismo día. Precisión explícita del usuario
> del proyecto (2026-08-18, no cita textual de tomo): un solo portal WEB mezclaba tres audiencias
> con privilegios distintos — el Profesional de AFT, el Administrador del Sistema (DOC-021) y el
> Directivo (DOC-020) — y deben separarse en tres portales con login propio, uno por rol.

## 1. Mapeo rol → portal

| Rol Zitadel | Nombre funcional | Portal | Qué hace | Toca la BPI |
|---|---|---|---|---|
| `administrador-patrimonial` | Profesional de AFT | **CCP** (`ccp/`, ex-`ccp/`) | Carga/actualiza información patrimonial (activos, catálogo, documentos, importaciones) — DOC-012, DOC-021 §3-5 | Sí, es el único (junto con `administrador-sistema` para Contrato) |
| `administrador-sistema` | Administrador del Sistema | **`web_admin/`** (nuevo) | Administra la plataforma: organizaciones, contratos, usuarios, indicadores — DOC-021 | Nunca |
| `directivo` | Directivo | **`core/frontend/`** (nuevo) | Máximo privilegio a nivel de **su organización**: dashboard de solo lectura (ya existía, DOC-020) + designar quién es el Profesional de AFT de su organización + gestionar roles dentro de ella (nuevo) | Nunca |

Cada portal es un origen HTTP distinto (hostname propio en Traefik, Application OIDC propia en
Zitadel) — un usuario con más de un rol (caso de prueba ya existente `mixto-test`,
`administrador-patrimonial` + `directivo`) simplemente entra a los dos portales que le
correspondan con la misma identidad; no hay portal que sirva a más de un rol.

## 2. Por qué el Directivo no comparte portal con Administrador del Sistema

Ambos administran "algo" y ninguno toca información patrimonial, pero el alcance es opuesto en el
eje que importa: Administrador del Sistema opera sobre **todas** las organizaciones (crea
organizaciones nuevas), Directivo opera **solo sobre la suya** (no puede ver ni tocar otra
organización). Mezclarlos en un portal obligaría a resolver en el cliente una distinción que hoy
ya se resuelve mejor en el servidor (ver §4) — mismo criterio de mínimo privilegio que ya usó
DOC-021 §1 para separar Administrador del Sistema de Profesional de AFT.

## 3. Hallazgo que motiva separar `web_admin/` de CCP

`ccp/src/pages/AdminPage.tsx` (implementado en DOC-021) fuerza a que el Administrador del Sistema
tenga su grant de `administrador-sistema` **dentro de una organización específica** — el alta de
Organización manda `organizacionId: organizaciones?.[0]?.id` ("la primera de la lista") porque
`procesarAltaOrganizacion` en CORE reutiliza sin cambios `escrituraOficialSchema`
(`core/src/patrimonial/activo.schemas.ts`), diseñado para Activo/Contrato — entidades que sí
pertenecen a una organización. Para un rol que administra *toda* la plataforma esto es
incorrecto: el usuario de prueba `admin.sicsaft.localhost` solo pudo crearse funcionando porque
se le dio el grant manualmente dentro de "DUOC UC", no porque el diseño lo pida así a propósito.

**Corrección** (`core/src/common/auth/administrador-patrimonial.guard.ts`):

```ts
export function verificarRolEnCualquierOrganizacion(
  rolesPorOrganizacion: unknown,
  rolesPermitidos: readonly string[],
): void {
  // recorre TODAS las entradas de rolesPorOrganizacion, no una organizacionId puntual —
  // alcanza con que el rol aparezca en cualquiera
}
```

Usada en `procesarAltaOrganizacion` y en la asignación de usuarios (ambas ya no reciben ni
necesitan un `organizacionId` "de qué organización tengo el rol"). `verificarRolesPermitidos`
(DOC-021 §2, chequeo contra una `organizacionId` puntual) sigue existiendo sin cambios — lo siguen
usando Activo/Catálogo/Documento/Contrato, que sí pertenecen a una organización real.

## 4. Directivo: gestión de roles acotada a la propia organización

Mismo patrón que Administrador del Sistema (integración real con la API de administración de
Zitadel vía `ZitadelAdminService`, ya construido en DOC-021 — sin cambios ahí), pero con un guard
distinto en CIS:

| | `AdministradorSistemaGuard` (DOC-021) | `DirectivoGuard` (nuevo) |
|---|---|---|
| Organización objetivo | `:orgId` de la ruta — cualquiera | La propia del Directivo, leída de su JWT — nunca de la ruta |
| Roles asignables | `administrador-patrimonial`, `directivo`, `administrador-sistema` | Solo `administrador-patrimonial` |

Endpoints nuevos `cis/src/directivo/` (`directivo.controller.ts`):
`GET /directivo/usuarios` (lista grants de la propia organización, reusa
`ZitadelAdminService.listarGrants`), `POST /directivo/usuarios` (`{ email }` — el rol es
implícito, siempre `administrador-patrimonial`, no se acepta en el body). No pasa por el
Orquestador de CORE ni por el Motor de Auditoría de Tomo IV — mismo criterio que
`AdministradorSistemaGuard`: es gestión de identidad en Zitadel, no escritura de BPI.

## 5. `core/frontend/` — por qué vive ahí y no rompe "todo pasa por CIS"

Decisión explícita del usuario: el portal del Directivo vive físicamente en `core/frontend/`
("CORE va a estar conformado de backend y frontend"). Esto es **solo dónde vive el código**, no
un cambio de qué expone CORE-el-backend a internet:

- `core/frontend/` es un deploy independiente (Vite+React+TS, propio `Dockerfile`/`package.json`,
  sibling de `core/src/`) que le habla a **CIS** (`VITE_CIS_URL`), nunca a CORE directo — mismo
  patrón de autenticación OIDC/PKCE que `ccp/` y `web_admin/`.
- CORE-el-backend (`core/src/`, `core/Dockerfile`) no gana ninguna ruta HTTP nueva ni deja de ser
  un servicio interno sin exposición en Traefik (hoy solo lo llaman `cis`/`cip` dentro de la red
  de Docker). La regla no negociable de `CLAUDE.md` ("todo pasa por CIS → CORE") sigue intacta.
- Esto es una desviación puntual de [ADR-001](../../../adr/ADR-001-stack-backend-nestjs.md)
  ("Frontend: WEB, CIP" — CORE no estaba en esa lista) — se documenta con
  [ADR-003](../../../adr/ADR-003-frontend-de-core-para-directivo.md), que la reemplaza
  explícitamente sin tocar el resto de ADR-001.

Dos pantallas: Dashboard (mueve `DashboardPage.tsx` desde `ccp/` — el Directivo deja de entrar a
CCP para verlo, la redirección `esDirectivo() → /dashboard` de `HubPage.tsx`, DOC-020, queda
superada por este incremento) + pantalla nueva "Gestionar Profesional de AFT" contra
`GET/POST /directivo/usuarios` de CIS.

## 6. Fuera de alcance de este incremento

- **"Valida"** — el usuario mencionó que el Directivo también "valida", además de designar y
  gestionar roles, sin especificar qué valida ni contra qué proceso. No hay tomo ni fuente citada.
  Se deja pendiente explícitamente — no se inventa alcance sin una definición concreta.
- Que el Directivo pueda designar/revocar otro Directivo o un Administrador del Sistema — el v1
  solo permite asignar `administrador-patrimonial` (ver §4).
- Renombrar o rediseñar visualmente los tres portales (identidad de marca) — cambio funcional
  únicamente, `BRAND.md` se sigue usando tal cual en los tres.

## 7. Documentos relacionados

[DOC-020](DOC-020-segmentacion-por-rol-directivo.md) (Directivo original, solo lectura — este
documento lo extiende con escritura acotada a la organización).
[DOC-021](DOC-021-cobertura-ccp-y-administrador-sistema.md) (Administrador del Sistema y el
patrón `ZitadelAdminService` que este documento reusa).
[ADR-001](../../../adr/ADR-001-stack-backend-nestjs.md) (stack de frontend, extendido por
ADR-003 para `core/frontend/`).
[ADR-003](../../../adr/ADR-003-frontend-de-core-para-directivo.md) (por qué `core/frontend/` no
rompe la regla no negociable).
