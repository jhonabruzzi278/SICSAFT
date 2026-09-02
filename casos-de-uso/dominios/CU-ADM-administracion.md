# CU-ADM — Administración

Dominio §12.25–§12.26. Componentes: `web_admin/` (portal del Administrador SICSAFT), `cis/`
(`keycloak-admin`), Keycloak, `core/` (Auditoría). Matriz de permisos:
[DOC-023](../../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md).

---

## CU-ADM-001 — Crear Usuario

| Campo | Detalle |
|---|---|
| **Código** | CU-ADM-001 |
| **Nombre** | Crear Usuario |
| **Objetivo** | Dar de alta una identidad con organización, rol y permisos (§12.25). |
| **Actor principal** | Administrador SICSAFT. |
| **Actores secundarios** | web_admin, CIS, Keycloak, Auditoría. |
| **Precondiciones** | Administrador autenticado con rol `administrador-sistema`; organización existente. |
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
| **Componentes** | web_admin · CIS · Keycloak · CORE (auditoría). |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟡 **Parcial**: existen (a) el alta del **Director** en el wizard del `.exe` con contraseña temporal random de 20 chars y cambio forzado, y (b) "Designar Profesional de AFT" desde `core/frontend/` (Directivo). El CRUD completo de usuarios en `web_admin/` está en construcción (DOC-022, `web_admin` sin specs e2e todavía). |

---

## CU-ADM-002 — Asignar Roles y Permisos

| Campo | Detalle |
|---|---|
| **Código** | CU-ADM-002 |
| **Nombre** | Asignar Roles y Permisos |
| **Objetivo** | Definir quién puede ver / crear / modificar / aprobar / administrar (§12.26). |
| **Actor principal** | Administrador SICSAFT (o Directivo, acotado a su organización). |
| **Actores secundarios** | web_admin / core/frontend, CIS, Keycloak, Auditoría. |
| **Precondiciones** | Usuario objetivo existente; administrador autorizado. |
| **Disparador** | Edición de roles de un usuario. |
| **Entradas** | `usuarioId`, organización, conjunto de roles. |
| **Flujo principal** | 1. Seleccionar usuario. 2. Elegir organización y roles. 3. CIS aplica el cambio en Keycloak. 4. Auditoría. 5. Los permisos se re-evalúan **antes de cada proceso protegido** (guards de CIS/CORE, no la UI). |
| **Reglas aplicables** | DOC-023 (matriz Rol × Módulo × Acción, extraída de los guards reales). |
| **Flujos alternativos** | Revocar un rol. Asignar el rol en varias organizaciones. |
| **Excepciones** | Rol no permitido para el actor (ej. Directivo asignando `administrador-sistema`) → 403. |
| **Postcondiciones** | El usuario gana/pierde acceso; efectivo en el siguiente token. |
| **Eventos generados** | Evento de cambio de rol → auditoría de identidad. |
| **Auditoría** | Registro del cambio de roles con antes/después. |
| **Resultado esperado** | Permisos coherentes con DOC-023, verificados en el backend. |
| **Componentes** | web_admin / core/frontend · CIS · Keycloak · CORE. |
| **Prioridad** | Crítica (seguridad). |
| **Estado en el repo** | 🟡 **Parcial**: el patrón de guards existe y está documentado endpoint por endpoint en DOC-023; la asignación de roles funciona desde `core/frontend/` (Directivo, acotada). La pantalla de administración de roles en `web_admin/` sigue en construcción. La matriz "definitiva parametrizable" (§12.31) hoy es código, no configuración. |
