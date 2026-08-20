# DOC-023: Matriz de permisos por rol (RBAC)

> **Estado**: documentación (2026-08-19) — extraída del código real (guards de `cis/src/` y
> `core/src/orquestador/orquestador.service.ts`), no diseño nuevo — motivada por el rediseño de
> sidebar de los tres portales (DOC-022): antes de exponer módulos como links de navegación
> directa hacía falta confirmar, contra el backend, que cada portal solo ofrece lo que su rol
> puede efectivamente hacer. Complementa
> [`seguridad/README.md`](../../../seguridad/README.md) "Permisos previstos" con el detalle
> endpoint por endpoint que ese documento no baja a ese nivel. El hallazgo de §3
> (`GET /admin/indicadores` sin guard de rol) se encontró y se corrigió el mismo día — ver §3.

## 1. Los tres roles (recap)

| Rol Zitadel | Nombre funcional | Portal | Alcance |
|---|---|---|---|
| `administrador-patrimonial` | Profesional de AFT | `ccp/` | Escritura oficial de la Base Patrimonial de **su(s) organización(es)** — Tomo III 1.4 |
| `administrador-sistema` | Administrador del Sistema | `web_admin/` | Administración de la **plataforma** (todas las organizaciones) — nunca información patrimonial |
| `directivo` | Directivo | `core/frontend/` | Máximo privilegio dentro de **su propia organización** (dashboard + designar al Profesional de AFT) — nunca otra organización |

Un usuario puede tener más de un rol (caso de prueba `mixto-test`) y simplemente entra a cada
portal por separado — ningún portal sirve a más de un rol (DOC-022 §1, regla no negociable de
`CLAUDE.md`).

## 2. Matriz Rol × Módulo × Acción

✅ = autorizado y verificado server-side · ➖ = no aplica al módulo · ⚠️ = ver hallazgo en §3/§4.
"CIS→CORE" es la ruta real de la request (WEB nunca le habla a CORE directo).

| Módulo | Acción | `administrador-patrimonial` | `administrador-sistema` | `directivo` | Guard / mecanismo |
|---|---|:---:|:---:|:---:|---|
| **Activos** | Consultar | ⚠️ | ⚠️ | ➖ | Sin chequeo de rol, solo autenticación (`GET /admin/catalogo`) |
| | Alta / Baja / Reincorporación | ✅ | ➖ | ➖ | `verificarRolAdministradorPatrimonial` en `OrquestadorService.ejecutarOperacionOficial` |
| | Modificar responsable / descripción | ✅ | ➖ | ➖ | ídem |
| **Catálogo Tipo Activo** | Consultar | ⚠️ | ⚠️ | ➖ | Sin chequeo de rol |
| | Crear | ✅ | ➖ | ➖ | `verificarRolAdministradorPatrimonial` |
| **Documentos de Activo** | Consultar | ⚠️ | ⚠️ | ➖ | Sin chequeo de rol |
| | Adjuntar / Eliminar | ✅ | ➖ | ➖ | `verificarRolAdministradorPatrimonial` |
| **Importaciones contables** | Ejecutar (masiva) | ✅ | ➖ | ➖ | `verificarRolAdministradorPatrimonial` |
| **Áreas / Ubicaciones / Responsables** | Consultar | ⚠️ | ⚠️ | ➖ | Sin chequeo de rol |
| | Crear / Modificar | ✅ | ➖ | ➖ | `verificarRolAdministradorPatrimonial` |
| **Contratos** | Consultar | ⚠️ | ⚠️ | ➖ | Sin chequeo de rol |
| | Crear / Cambiar estado | ✅ | ✅ | ➖ | `verificarRolesPermitidos([admin-patrimonial, admin-sistema])` — único módulo que comparten los dos roles |
| **Organizaciones** | Consultar | ⚠️ | ⚠️ | ➖ | Sin chequeo de rol |
| | Crear | ➖ | ✅ | ➖ | `verificarRolEnCualquierOrganizacion([admin-sistema])` — sin `organizacionId`, alcanza con tener el rol en cualquiera |
| **Usuarios de una organización** (Zitadel) | Consultar / Asignar rol | ➖ | ✅ | ➖ | `AdministradorSistemaGuard` — rol verificado contra el `:orgId` de la ruta |
| **Profesional de AFT** (Zitadel, org propia) | Consultar / Designar | ➖ | ➖ | ✅ | `DirectivoGuard` — organización **derivada siempre del JWT**, nunca de la ruta/body |
| **Indicadores de plataforma** | Consultar | ➖ | ✅ | ➖ | `AdministradorSistemaEnCualquierOrganizacionGuard` — corregido, ver §3 |
| **Auditoría** | Consultar | ⚠️ | ⚠️ | ➖ | Sin chequeo de rol |
| **Dashboard** (CIP, vía CIS) | Consultar | ⚠️ | ➖ | ⚠️ | Sin chequeo de rol — accesible a cualquier operador autenticado |
| **Inventarios** (sesiones QR/RFID) | Crear / Consultar | ⚠️ | ➖ | ➖ | Sin chequeo de rol — módulo de fuente de captura, no exclusivo de este portal |

## 3. Hallazgo corregido: `GET /admin/indicadores` sin guard de rol en backend

Al construir esta matriz se encontró que `core/src/indicadores/indicadores.controller.ts`
documentaba explícitamente que la restricción a `administrador-sistema` era **solo de UI** en
`web_admin/` (`esAdministradorSistema`, cliente) — el endpoint en sí (`GET /admin/indicadores` en
CIS → `GET /indicadores` en CORE) aceptaba cualquier operador autenticado, sin chequeo de rol
server-side. Era el único módulo de escritura/administración del ecosistema sin verificación de
rol en el backend — todos los demás guards de esta matriz (`verificarRolAdministradorPatrimonial`,
`AdministradorSistemaGuard`, `DirectivoGuard`, `verificarRolEnCualquierOrganizacion`) sí cortaban
server-side.

**Corregido el mismo día** con un guard nuevo,
`AdministradorSistemaEnCualquierOrganizacionGuard`
(`cis/src/administrador/administrador-sistema-cualquier-organizacion.guard.ts`): a diferencia de
`AdministradorSistemaGuard` (que chequea el rol contra un `:orgId` puntual de la URL), este
endpoint no tiene organizacionId propio — son indicadores agregados de **toda** la plataforma — así
que el chequeo es "el rol `administrador-sistema` aparece en cualquier organización del token",
mismo criterio que `verificarRolEnCualquierOrganizacion` usa en CORE para el alta de Organización.
Aplicado con `@UseGuards(...)` en `GET /admin/indicadores`
(`cis/src/administrador/administrador.controller.ts`). Cobertura: guard unitario propio
(`administrador-sistema-cualquier-organizacion.guard.spec.ts`) + e2e actualizado
(`cis/test/gaps-ccp-admin-sistema.e2e-spec.ts`, ahora cubre el caso 200 con `administrador-sistema`
y el caso 403 con `administrador-patrimonial`) — 100% líneas/funciones, branches 85.24% (umbral
84%), 305/305 tests en verde.

## 4. Lecturas (`GET`) sin distinción de rol — alcance actual

Todos los `GET` de Activos, Catálogo, Documentos, Áreas/Ubicaciones/Responsables, Contratos,
Organizaciones, Auditoría y Dashboard están abiertos a **cualquier operador autenticado**, sin
distinguir `administrador-patrimonial` / `administrador-sistema` / `directivo` — la autorización
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
`administrador-patrimonial` tiene alguna acción real según esta matriz — Activos, Contratos
(compartido con `administrador-sistema`), Inventarios, Áreas y ubicaciones, Importaciones,
Auditoría, y el Dashboard/Resumen. **Nunca** Organizaciones, Usuarios de plataforma o Indicadores
(exclusivos de `web_admin/`), ni la gestión del Profesional de AFT (exclusiva de
`core/frontend/`) — la separación de portales de DOC-022 ya hace que cada sidebar sea, por
construcción, un subconjunto de lo que el rol de ese portal puede hacer. Este documento es lo que
permite afirmar eso con una fuente concreta en vez de "porque así se diseñó".

## Documentos relacionados

- [`seguridad/README.md`](../../../seguridad/README.md) — modelo de roles, mapeo rol → portal →
  hostname, capacidades previstas.
- [`seguridad/DOC-012-administrador-patrimonial.md`](../../../seguridad/DOC-012-administrador-patrimonial.md)
  — diseño original del rol `administrador-patrimonial` y el camino de escritura oficial.
- [DOC-021](DOC-021-cobertura-ccp-y-administrador-sistema.md) — diseño del rol
  `administrador-sistema` y `verificarRolesPermitidos`/`AdministradorSistemaGuard`.
- [DOC-022](DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md) — separación en tres
  portales, `verificarRolEnCualquierOrganizacion`, `DirectivoGuard`.

## Próximo paso sugerido

El hallazgo de §3 ya está corregido. Lo que sigue abierto es lo de §4 (lecturas sin distinción de
rol) — no es una regresión ni bloquea nada hoy, pero si en algún momento se decide granularizar
permisos de lectura (ej. que `directivo` no pueda leer `GET /admin/activos` directo, solo lo que
`core/frontend/` expone), ese es el punto de partida.
