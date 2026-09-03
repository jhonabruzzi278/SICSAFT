# CU-ADM — Administración

Dominio §12.25–§12.26. Componentes: intervención directa del proveedor de SICSAFT (acceso a BD /
script con service-token) + el bootstrap del wizard de `sicsaft-core` + `core/frontend/` (el
Directivo designa Profesional de AFT); `cis/` (`keycloak-admin`), Keycloak, `core/` (Auditoría).
**El portal `web_admin/` y el rol `administrador-sistema` se eliminaron (2026-09)** — cuando un
cliente reporta un problema, el encargado de soporte de SICSAFT lo diagnostica por la consola de
logs en pantalla de `sicsaft-core` y lo corrige contra la BD. Matriz de permisos:
[DOC-023](../../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md).

---

## CU-ADM-001 — Crear Usuario

| Campo | Detalle |
|---|---|
| **Código** | CU-ADM-001 |
| **Nombre** | Crear Usuario |
| **Objetivo** | Dar de alta una identidad con organización, rol y permisos (§12.25). |
| **Actor principal** | Proveedor de SICSAFT (soporte), o el instalador en el primer arranque. |
| **Actores secundarios** | wizard `.exe` / BD directa, CIS (`keycloak-admin`), Keycloak, Auditoría. |
| **Precondiciones** | El proveedor tiene acceso a la BD / un service-token, o corre el wizard de primer arranque; organización existente. |
| **Disparador** | "Nuevo usuario". |
| **Entradas** | Identidad (nombre, correo), organización, rol, permisos. |
| **Flujo principal** | 1. Registrar identidad. 2. Validar información. 3. Asignar organización. 4. Asignar rol. 5. Asignar permisos. 6. Crear el usuario en Keycloak. 7. Auditoría (`categoria = identidad`, DOC-024 §3). 8. Notificación (credencial temporal, cambio obligatorio al primer login). |
| **Reglas aplicables** | Reglas de identidad y RBAC del tomo; DOC-023. |
| **Flujos alternativos** | Alta del **Director** en el wizard del `.exe` (`altaDirector`). "Designar Profesional de AFT" desde el portal del Directivo (rol acotado a su organización, DOC-022). |
| **Excepciones** | Correo ya en uso → rechazo. Rol inexistente → rechazo. Sin permiso → 403. |
| **Postcondiciones** | Usuario habilitado, con credencial temporal de un solo uso. |
| **Eventos generados** | Evento de alta de identidad → auditoría de identidad. |
| **Auditoría** | Fila en `auditoria` con `categoria = identidad`. |
| **Resultado esperado** | Usuario operativo tras el cambio de contraseña inicial. |
| **Componentes** | wizard `.exe` / BD directa · CIS · Keycloak · CORE (auditoría). |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟡 **Parcial**: existen (a) el alta del **Director** en el wizard del `.exe` con contraseña temporal random de 20 chars y cambio forzado, y (b) "Designar Profesional de AFT" desde `core/frontend/` (Directivo). El CRUD amplio de usuarios/organizaciones **no tiene portal** desde 2026-09 (`web_admin/` eliminado) — es intervención directa del proveedor (BD / script con service-token). Para Nivel 1, con 2-3 usuarios por organización, el wizard + "designar AFT" cubren el alta. |

---

## CU-ADM-002 — Asignar Roles y Permisos

| Campo | Detalle |
|---|---|
| **Código** | CU-ADM-002 |
| **Nombre** | Asignar Roles y Permisos |
| **Objetivo** | Definir quién puede ver / crear / modificar / aprobar / administrar (§12.26). |
| **Actor principal** | Proveedor de SICSAFT (BD / script), o Directivo acotado a su organización (`core/frontend/`). |
| **Actores secundarios** | `core/frontend/` / BD directa, CIS, Keycloak, Auditoría. |
| **Precondiciones** | Usuario objetivo existente; administrador autorizado. |
| **Disparador** | Edición de roles de un usuario. |
| **Entradas** | `usuarioId`, organización, conjunto de roles. |
| **Flujo principal** | 1. Seleccionar usuario. 2. Elegir organización y roles. 3. CIS aplica el cambio en Keycloak. 4. Auditoría. 5. Los permisos se re-evalúan **antes de cada proceso protegido** (guards de CIS/CORE, no la UI). |
| **Reglas aplicables** | DOC-023 (matriz Rol × Módulo × Acción, extraída de los guards reales). |
| **Flujos alternativos** | Revocar un rol. Asignar el rol en varias organizaciones. |
| **Excepciones** | Rol no permitido para el actor (ej. Directivo asignando un rol distinto de `administrador-patrimonial`) → 403. |
| **Postcondiciones** | El usuario gana/pierde acceso; efectivo en el siguiente token. |
| **Eventos generados** | Evento de cambio de rol → auditoría de identidad. |
| **Auditoría** | Registro del cambio de roles con antes/después. |
| **Resultado esperado** | Permisos coherentes con DOC-023, verificados en el backend. |
| **Componentes** | `core/frontend/` / BD directa · CIS · Keycloak · CORE. |
| **Prioridad** | Crítica (seguridad). |
| **Estado en el repo** | 🟡 **Parcial**: el patrón de guards existe y está documentado endpoint por endpoint en DOC-023; "designar Profesional de AFT" funciona desde `core/frontend/` (Directivo, acotada). No hay pantalla de administración de roles desde 2026-09 (`web_admin/` eliminado) — cualquier otro cambio de rol es intervención directa del proveedor en Keycloak / BD. La matriz "definitiva parametrizable" (§12.31) hoy es código, no configuración. |
