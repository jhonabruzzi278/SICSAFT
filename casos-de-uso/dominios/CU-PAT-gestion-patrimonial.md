# CU-PAT — Gestión Patrimonial

Dominio §12.7–§12.11. Plantilla §12.5. Reglas CFPS citadas del tomo (capítulo previo, no en git).

Componentes del repo que participan en este dominio: `ccp/` (interfaz), `cis/` (PSD, guard de rol),
`core/` (MOP + Motor Patrimonial + Reglas + Auditoría), Base Patrimonial Central (Postgres,
`core/migrations/`). Endpoints CIS bajo `/admin/*`, ver `ccp/src/lib/cis-client.ts` y
`aidlc-docs/core/design-artifacts/DOC-006-api-cis-core.md`.

---

## CU-PAT-001 — Registrar Nuevo Activo

| Campo | Detalle |
|---|---|
| **Código** | CU-PAT-001 |
| **Nombre** | Registrar Nuevo Activo |
| **Objetivo** | Incorporar oficialmente un Activo Fijo Tangible a la BPI (§12.7). |
| **Actor principal** | Administrador Patrimonial. |
| **Actores secundarios** | CCP, MOP, Motor Patrimonial, Motor de Reglas, Auditoría. |
| **Precondiciones** | Usuario autenticado; permiso de creación (`administrador-patrimonial` en la organización); catálogo tipo configurado; ubicación válida; responsable válido cuando corresponda. |
| **Disparador** | Selección de "Nuevo Activo" / envío del formulario de alta. |
| **Entradas** | `codigoPatrimonial`, `codigoQr`, `catalogoId`; opcionales `serie`, `areaId`, `ubicacionId`, `responsableId`, `descripcion`, `valorPatrimonial`. |
| **Flujo principal** | 1. Usuario solicita registrar activo. 2. CCP presenta formulario. 3. Usuario introduce información. 4. CIS/CORE valida campos obligatorios (Zod `escrituraOficialSchema`). 5. CORE verifica unicidad de `codigoPatrimonial` y `codigoQr`. 6. CORE verifica duplicidades. 7. MOP envía la operación al Motor Patrimonial. 8. Se aplican reglas CFP-001…005. 9. CORE genera el identificador interno (`activos.id`). 10. BPI registra el activo (`estado = activo`). 11. Se crea el historial inicial. 12. Se genera auditoría (`POST /auditoria`). 13. CIS confirma al CCP. |
| **Reglas aplicables** | CFP-001 a CFP-005. |
| **Flujos alternativos** | Alta en lote → **CU-INT-001 / RF-B** (ingesta de Excel supervisada). Alta desde APP QR durante relevamiento → fuera de este CU. |
| **Excepciones** | `codigoPatrimonial`/`codigoQr` duplicado → operación rechazada (409/`conflicto`), nada se escribe. Datos obligatorios incompletos → 400, formulario devuelto con el error por campo. Usuario sin rol → 403 ("No tenés el rol administrador-patrimonial en esta organización"). `catalogoId` inexistente → 400. |
| **Postcondiciones** | Activo en la BPI con `estado = activo`, visible en el mismo catálogo que consume la APP QR (RF-08). |
| **Eventos generados** | Evento patrimonial de alta → cola pg-boss → CIP. |
| **Auditoría** | Fila en `auditoria`: `operacion` = `POST /activos`, `usuario`, `organizacionId`, `resultado`. |
| **Resultado esperado** | Activo oficialmente incorporado a la BPI. |
| **Componentes** | CCP · CIS · CORE (MOP + Motor Patrimonial + Reglas) · BPI · CIP. |
| **Prioridad** | Crítica. |
| **Estado en el repo** | 🟢 **Implementado** (todos los niveles): `ccp/src/pages/ActivosPage.tsx` "Alta de activo" → `cisClient.altaActivo` → `POST /admin/activos` (CIS) → `POST /activos` (CORE, DOC-012 §6). El alta manual está disponible desde Nivel 1 (corrección RF-A 2026-09-02); la ingesta de Excel (**RF-B**) y la APP QR son caminos alternativos. |

---

## CU-PAT-002 — Modificar Información de un Activo

| Campo | Detalle |
|---|---|
| **Código** | CU-PAT-002 |
| **Nombre** | Modificar Información de un Activo |
| **Objetivo** | Actualizar datos de un activo existente **sin sustituir su historia** (§12.8). |
| **Actor principal** | Administrador Patrimonial. |
| **Actores secundarios** | CCP, MOP, Motor Patrimonial, Auditoría. |
| **Precondiciones** | Activo existente en la organización; usuario autorizado. |
| **Disparador** | "Editar" sobre una fila del catálogo. |
| **Entradas** | `activoId` + campos a modificar (`descripcion`, `responsableId`, documentación). |
| **Flujo principal** | 1. Consulta del activo. 2. Solicitud de modificación. 3. Validación de permisos. 4. Presentación de la información vigente. 5. Modificación. 6. Validación CFPS. 7. CORE. 8. Actualización BPI. 9. Historial (la versión anterior se conserva). 10. Auditoría. 11. Confirmación. |
| **Reglas aplicables** | CFP-002, CFP-004. |
| **Flujos alternativos** | Cambio de responsable → **CU-PAT-003**. Traslado → **CU-PAT-004**. |
| **Excepciones** | Activo dado de baja → modificación rechazada. Usuario sin permiso → 403. Activo de otra organización → tratado como inexistente (DOC-008). |
| **Postcondiciones** | Datos actualizados; **la historia anterior permanece disponible**. |
| **Eventos generados** | Evento de actualización → CIP. |
| **Auditoría** | `operacion` = `PATCH /activos/{id}...`, con el detalle del cambio. |
| **Resultado esperado** | Activo actualizado, historia intacta. |
| **Componentes** | CCP · CIS · CORE · BPI. |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟢 **Implementado** (todos los niveles): `ActivosPage.tsx` panel "Editar" → `actualizarDescripcionActivo` / `altaDocumentoActivo`. |

---

## CU-PAT-003 — Cambiar Responsable

| Campo | Detalle |
|---|---|
| **Código** | CU-PAT-003 |
| **Nombre** | Cambiar Responsable |
| **Objetivo** | Transferir formalmente la responsabilidad del activo (§12.9). |
| **Actor principal** | Administrador Patrimonial. |
| **Actores secundarios** | CCP, MOP, Auditoría. |
| **Precondiciones** | Activo vigente; nuevo responsable válido; permisos del usuario; estructura organizacional válida. |
| **Disparador** | "Editar" → campo "Nuevo responsable". |
| **Entradas** | `activoId`, `responsableId` nuevo. |
| **Flujo principal** | 1. Consulta del activo. 2. Selección del nuevo responsable. 3. Validación (RES-001…004). 4. CORE registra el cambio. 5. El responsable anterior queda en el historial. 6. Auditoría. 7. Confirmación. |
| **Reglas aplicables** | RES-001 a RES-004. |
| **Flujos alternativos** | Responsable "sin asignar" (activo de área común) → permitido si la regla lo admite. |
| **Excepciones** | Responsable inexistente o inactivo → rechazo. Activo dado de baja → rechazo. |
| **Postcondiciones** | Nuevo responsable vigente; **el anterior permanece registrado históricamente**. |
| **Eventos generados** | Evento de cambio de responsable → CIP. |
| **Auditoría** | `operacion` = `PATCH /activos/{id}/responsable`. |
| **Resultado esperado** | Responsabilidad transferida, con rastro del responsable previo. |
| **Componentes** | CCP · CIS · CORE · BPI. |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟢 **Implementado** (todos los niveles): `cisClient.cambiarResponsableActivo`. |

---

## CU-PAT-004 — Trasladar Activo

| Campo | Detalle |
|---|---|
| **Código** | CU-PAT-004 |
| **Nombre** | Trasladar Activo |
| **Objetivo** | Cambiar oficialmente la ubicación (área / ubicación) de un activo (§12.10). |
| **Actor principal** | Administrador Patrimonial. |
| **Actores secundarios** | CCP, MOP, Motor de Eventos, Auditoría. |
| **Precondiciones** | Activo vigente; nueva ubicación válida dentro de la estructura; usuario autorizado. |
| **Disparador** | Acción "Trasladar" sobre el activo. |
| **Entradas** | `activoId`, `areaId`/`ubicacionId` nuevos. |
| **Flujo principal** | 1. Seleccionar activo. 2. Seleccionar nueva ubicación. 3. Validar ubicación (UBI-001…004). 4. Validar autorización. 5. Ejecutar traslado en CORE. 6. Actualizar BPI. 7. Registrar la ubicación anterior en el historial. 8. Crear evento. 9. Auditoría. 10. Confirmación. |
| **Reglas aplicables** | UBI-001 a UBI-004. |
| **Flujos alternativos** | Traslado detectado por relevamiento (activo escaneado en otra área) → se registra como discrepancia en **CU-INV-003**, no como traslado formal. |
| **Excepciones** | Ubicación inexistente → rechazo. Activo dado de baja → rechazo. |
| **Postcondiciones** | Ubicación actualizada; ubicación anterior en el historial. |
| **Eventos generados** | Evento de traslado → CIP. |
| **Auditoría** | `operacion` = `PATCH /activos/{id}/ubicacion`. |
| **Resultado esperado** | Activo reubicado oficialmente, con rastro. |
| **Componentes** | CCP · CIS · CORE · BPI · CIP. |
| **Prioridad** | Media. |
| **Estado en el repo** | 🟡 **Parcial**: `areaId`/`ubicacionId` se fijan en el alta y se pueden editar, pero **no hay un flujo "Trasladar" dedicado** con registro explícito de ubicación anterior como evento de traslado. Gap a cubrir (no está en DOC-029 todavía — anotarlo si el cliente lo pide para Nivel 1). |

---

## CU-PAT-005 — Dar de Baja un Activo

| Campo | Detalle |
|---|---|
| **Código** | CU-PAT-005 |
| **Nombre** | Dar de Baja un Activo |
| **Objetivo** | Retirar un activo del uso operativo **sin eliminarlo de la BPI** (§12.11). Operación sensible. |
| **Actor principal** | Administrador Patrimonial autorizado. |
| **Actores secundarios** | CCP, MOP, Motor Patrimonial, Auditoría. |
| **Precondiciones** | Activo existente; autorización correspondiente; causa de baja; evidencia cuando proceda. |
| **Disparador** | Acción "Dar de baja" sobre la fila del activo. |
| **Entradas** | `activoId`, causa de baja, evidencia opcional. |
| **Flujo principal** | 1. Usuario selecciona "Dar de baja". 2. CORE valida permiso y estado del activo. 3. Se aplica la máquina de estados del activo. 4. `activos.estado` pasa a `dado_de_baja` (**no `DELETE`** — Tomo III 4.10, invariante de CLAUDE.md). 5. Historial. 6. Auditoría. 7. Confirmación. |
| **Reglas aplicables** | CFP-005 + reglas de baja del catálogo de estados. |
| **Flujos alternativos** | Reincorporación de un activo extraviado → `reincorporarActivo`. |
| **Excepciones** | Activo ya dado de baja → sin efecto. Usuario sin autorización → 403. |
| **Postcondiciones** | `estado = dado_de_baja`; **la fila y su historia permanecen** para auditoría. |
| **Eventos generados** | Evento de baja → CIP. |
| **Auditoría** | `operacion` = `POST /activos/{id}/baja`, con causa. |
| **Resultado esperado** | Activo fuera de operación, historia preservada, auditable. |
| **Componentes** | CCP · CIS · CORE · BPI. |
| **Prioridad** | Crítica (por lo sensible). |
| **Estado en el repo** | 🟢 **Implementado**: `cisClient.bajaActivo` → `POST /admin/activos/:id/baja` (soft-delete por `estado`, precedente real en el esquema). Disponible en **todos los niveles** (corrección RF-A 2026-09-02). **RF-D** (veredicto accionable → link a baja) sigue siendo una mejora aparte. |
