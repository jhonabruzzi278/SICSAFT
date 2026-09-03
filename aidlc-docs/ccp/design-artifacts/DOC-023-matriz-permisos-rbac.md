# DOC-023: Matriz de permisos por rol (RBAC)

> **Estado**: documentación (2026-08-19) — extraída del código real (guards de `cis/src/` y
> `core/src/orquestador/orquestador.service.ts`), no diseño nuevo — motivada por el rediseño de
> sidebar de los portales (DOC-022): antes de exponer módulos como links de navegación
> directa hacía falta confirmar, contra el backend, que cada portal solo ofrece lo que su rol
> puede efectivamente hacer. Complementa
> [`seguridad/README.md`](../../../seguridad/README.md) "Permisos previstos" con el detalle
> endpoint por endpoint que ese documento no baja a ese nivel. El hallazgo de 3
> (`GET /admin/indicadores` sin guard de rol) se encontró y se corrigió el mismo día — ver 3.

> **Actualizado (2026-09).** Se eliminó el rol `administrador-sistema` y el portal `web_admin/`.
> Con ellos se borraron de CIS/CORE: `AdministradorSistemaGuard`,
> `AdministradorSistemaEnCualquierOrganizacionGuard`, el módulo `core/src/indicadores/`, los
> controllers/servicios de escritura de Organización/Sede/Contrato y los `GET` standalone de
> Organización/Sede/Contrato/Indicadores. La matriz de abajo ya refleja el estado nuevo: quedan
> **dos roles** con portal. El CRUD de Organización/Contrato/Sede y la asignación de usuarios pasó
> a intervención directa del proveedor externo (BD / script con service-token) + el bootstrap del
> wizard de `sicsaft-core`; los `GET admin-sistema` que se listaban abajo ya no existen como
> endpoint. `GET /entitlements` (contrato vigente + módulos, sin chequeo de rol) queda intacto —
> lo consume `cis` en `auth/session` para todos los portales.

## 1. Los dos roles (recap)

| Rol Keycloak | Nombre funcional | Portal | Alcance |
|---|---|---|---|
| `administrador-patrimonial` | Profesional de AFT | `ccp/` | Escritura oficial de la Base Patrimonial de **su(s) organización(es)** — Tomo III 1.4 |
| `directivo` | Directivo | `core/frontend/` | Máximo privilegio dentro de **su propia organización** (dashboard + designar al Profesional de AFT) — nunca otra organización |

Un usuario puede tener más de un rol (caso de prueba `mixto-test`) y simplemente entra a cada
portal por separado — ningún portal sirve a más de un rol (DOC-022 1, regla no negociable de
`CLAUDE.md`). El tercer rol histórico, `administrador-sistema` (portal `web_admin/`), se eliminó
en 2026-09 — su función pasó a intervención directa del proveedor.

## 2. Matriz Rol × Módulo × Acción

✅ = autorizado y verificado server-side · ➖ = no aplica al módulo · ⚠️ = ver hallazgo en 3/4.
"CIS→CORE" es la ruta real de la request (WEB nunca le habla a CORE directo).

| Módulo | Acción | `administrador-patrimonial` | `directivo` | Guard / mecanismo |
|---|---|:---:|:---:|---|
| **Activos** | Consultar | ⚠️ | ➖ | Sin chequeo de rol, solo autenticación (`GET /admin/catalogo`) |
| | Alta / Baja / Reincorporación | ✅ | ➖ | `verificarRolAdministradorPatrimonial` en `OrquestadorService.ejecutarOperacionOficial` |
| | Modificar responsable / descripción | ✅ | ➖ | ídem |
| **Catálogo Tipo Activo** | Consultar | ⚠️ | ➖ | Sin chequeo de rol |
| | Crear | ✅ | ➖ | `verificarRolAdministradorPatrimonial` |
| **Documentos de Activo** | Consultar | ⚠️ | ➖ | Sin chequeo de rol |
| | Adjuntar / Eliminar | ✅ | ➖ | `verificarRolAdministradorPatrimonial` |
| **Importaciones contables** | Ejecutar (masiva) + bandeja de staging | ✅ | ➖ | `verificarRolAdministradorPatrimonial` |
| **Áreas / Ubicaciones / Responsables** | Consultar | ⚠️ | ➖ | Sin chequeo de rol |
| | Crear / Modificar | ✅ | ➖ | `verificarRolAdministradorPatrimonial` |
| **Profesional de AFT** (Keycloak, org propia) | Consultar / Designar | ➖ | ✅ | `DirectivoGuard` — organización **derivada siempre del JWT**, nunca de la ruta/body |
| **Auditoría** | Consultar | ⚠️ | ➖ | Sin chequeo de rol |
| **Dashboard** (CIP, vía CIS) | Consultar | ⚠️ | ⚠️ | Sin chequeo de rol — accesible a cualquier operador autenticado |
| **Inventarios** (sesiones QR/RFID) | Crear / Consultar | ⚠️ | ➖ | Sin chequeo de rol — módulo de fuente de captura, no exclusivo de este portal |

**Organización / Sede / Contrato (escritura) e Indicadores de plataforma** ya no aparecen en la
matriz: sus endpoints (`POST/PATCH /admin/organizaciones|sedes|contratos`, `GET /admin/indicadores`,
`GET/POST /admin/organizaciones/:orgId/usuarios`) y sus guards se **eliminaron en 2026-09** junto
con `web_admin/`. Ese trabajo es hoy intervención directa del proveedor externo (BD / script con
service-token) + el bootstrap del wizard de `sicsaft-core`, sin superficie HTTP ni rol propio.
`GET /entitlements` (contrato vigente + módulos contratados de la organización) sigue vivo y sin
chequeo de rol — lo consume `cis` en `auth/session` para armar la sesión de cualquier portal.

## 3. Hallazgo histórico: `GET /admin/indicadores` sin guard de rol en backend

> **Endpoint eliminado (2026-09).** `GET /admin/indicadores` (CIS) → `GET /indicadores` (CORE), el
> módulo `core/src/indicadores/` y el guard que lo protegía se borraron con `web_admin/`. Lo de
> abajo queda como registro del hallazgo y del método.

Al construir esta matriz se encontró que `core/src/indicadores/indicadores.controller.ts`
documentaba explícitamente que la restricción a `administrador-sistema` era **solo de UI** en
`web_admin/` (`esAdministradorSistema`, cliente) — el endpoint en sí aceptaba cualquier operador
autenticado, sin chequeo de rol server-side. Era el único módulo de administración del ecosistema
sin verificación de rol en el backend. **Se corrigió el mismo día** (2026-08-19) con un guard
`AdministradorSistemaEnCualquierOrganizacionGuard` ("el rol aparece en cualquier organización del
token", ya que los indicadores eran agregados de toda la plataforma, sin `organizacionId` propio).
Guard y endpoint se retiraron por completo en 2026-09 al eliminar `web_admin/`.

## 4. Lecturas (`GET`) sin distinción de rol — alcance actual

Todos los `GET` de Activos, Catálogo, Documentos, Áreas/Ubicaciones/Responsables, Auditoría y
Dashboard están abiertos a **cualquier operador autenticado**, sin distinguir
`administrador-patrimonial` / `directivo` — la autorización
real de este ecosistema vive en las operaciones de **escritura**, no en las de lectura. Esto es
consistente con `seguridad/README.md` "Permisos previstos" (que lista "Consultar" como uno de los
8 verbos bajo "principio de mínimo privilegio necesario" sin decir que ya está implementado
granularmente) — no es una regresión de este incremento, es el estado ya documentado del
ecosistema. Se deja registrado acá porque hasta ahora no había una matriz que lo mostrara de forma
explícita módulo por módulo.

En la práctica esto no expone datos entre organizaciones (`administrador-patrimonial` de la
organización A no puede ver activos de la organización B — eso sí está enforced, cada request de
lectura exige `organizacionId` y CORE no filtra por rol pero sí siempre por esa organización); el
gap es que un `directivo` técnicamente podría hacer `GET /admin/activos?organizacionId=...` de su
propia organización sin pasar por `ccp/`, cosa que hoy ninguna UI ofrece pero que el backend no
impide.

## 5. Cómo queda reflejado en el sidebar de `ccp/` (DOC-022, rediseño de portales)

El sidebar de `ccp/` (`ccp/src/components/AppShell.tsx`) solo linkea a módulos donde
`administrador-patrimonial` tiene alguna acción real según esta matriz — Activos, Áreas y
ubicaciones, Importaciones (con la bandeja de staging), Auditoría, QR/Etiquetas y el
Dashboard/Resumen. **Nunca** Organizaciones/Contratos/Usuarios de plataforma/Indicadores (esos
módulos vivían en `web_admin/`, eliminado en 2026-09), ni la gestión del Profesional de AFT
(exclusiva de `core/frontend/`) — la separación de portales de DOC-022 ya hace que cada sidebar
sea, por construcción, un subconjunto de lo que el rol de ese portal puede hacer. Este documento es lo que
permite afirmar eso con una fuente concreta en vez de "porque así se diseñó".

## Documentos relacionados

- [`seguridad/README.md`](../../../seguridad/README.md) — modelo de roles, mapeo rol → portal →
  hostname, capacidades previstas.
- [`seguridad/DOC-012-administrador-patrimonial.md`](../../../seguridad/DOC-012-administrador-patrimonial.md)
  — diseño original del rol `administrador-patrimonial` y el camino de escritura oficial.
- [DOC-021](DOC-021-cobertura-ccp-y-administrador-sistema.md) — diseño (histórico) del rol
  `administrador-sistema` y `verificarRolesPermitidos`/`AdministradorSistemaGuard`; el rol y esos
  guards se eliminaron en 2026-09.
- [DOC-022](DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md) — separación en portales
  y `DirectivoGuard` (vigente); la parte de `web_admin/` y `verificarRolEnCualquierOrganizacion`
  quedó revertida al eliminar el portal en 2026-09.

## Próximo paso sugerido

El hallazgo de 3 ya está corregido. Lo que sigue abierto es lo de 4 (lecturas sin distinción de
rol) — no es una regresión ni bloquea nada hoy, pero si en algún momento se decide granularizar
permisos de lectura (ej. que `directivo` no pueda leer `GET /admin/activos` directo, solo lo que
`core/frontend/` expone), ese es el punto de partida.
