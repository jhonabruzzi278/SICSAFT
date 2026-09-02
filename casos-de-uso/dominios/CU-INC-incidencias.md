# CU-INC — Incidencias

Dominio §12.21–§12.22. Componentes: APP QR, `cis/`, `core/`, `cip/` (dashboard), `ccp/` (Resumen).

Concepto de "incidencia" en el repo: resultado `con_incidencia` del árbol de clasificación de
escaneo (`core/src/reglas/clasificar-escaneo.ts`); esquema `incidenciaSchema = { codigoQr,
descripcion }`; se persiste vía `POST /inventarios` al cerrar la sesión y se lista en el Resumen
del CCP (`GET /dashboard/incidencias`).

---

## CU-INC-001 — Registrar Incidencia

| Campo | Detalle |
|---|---|
| **Código** | CU-INC-001 |
| **Nombre** | Registrar Incidencia |
| **Objetivo** | Abrir un expediente de incidencia sobre un activo (§12.21). |
| **Actor principal** | Operador / Supervisor / Sistema (regla automática). |
| **Actores secundarios** | APP QR, CORE (Motor de Reglas), Auditoría. |
| **Precondiciones** | Activo identificable; usuario autenticado (si el origen es humano). |
| **Disparador** | Manual · durante inventario · evento RFID · regla automática. |
| **Entradas** | `codigoQr`, `descripcion`, categoría, origen, responsable, evidencia opcional. |
| **Flujo principal** | 1. Se detecta / se declara la incidencia. 2. CORE valida el activo. 3. Se crea el expediente con: identificador, activo, categoría, fecha, origen, responsable, evidencia, estado `abierta`. 4. Auditoría. |
| **Reglas aplicables** | Reglas de clasificación de incidencia del tomo. |
| **Flujos alternativos** | Incidencia derivada de una discrepancia de conciliación (**CU-INV-003**). |
| **Excepciones** | Activo inexistente → la incidencia se registra igual, marcada como "activo no registrado". |
| **Postcondiciones** | Expediente de incidencia `abierta` asociado al activo y (si aplica) a la sesión. |
| **Eventos generados** | Evento de incidencia → CIP. |
| **Auditoría** | Registro de la apertura del expediente. |
| **Resultado esperado** | Expediente de incidencia creado y trazable. |
| **Componentes** | APP QR · CIS · CORE · CIP · CCP. |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟡 **Parcial**: solo el origen **"durante inventario"** existe (`incidenciaSchema` → `POST /inventarios` al cerrar la sesión). No hay alta manual de incidencia fuera de un relevamiento, ni origen RFID (Nivel 3), ni categoría/responsable/estado como campos propios del expediente — hoy es `{codigoQr, descripcion}` + fecha de la sesión. Gap para un expediente completo. |

---

## CU-INC-002 — Resolver Incidencia

| Campo | Detalle |
|---|---|
| **Código** | CU-INC-002 |
| **Nombre** | Resolver Incidencia |
| **Objetivo** | Cerrar una incidencia dejando el rastro del análisis y la acción correctiva (§12.22). |
| **Actor principal** | Supervisor Patrimonial. |
| **Actores secundarios** | CORE, Auditoría. |
| **Precondiciones** | Incidencia en estado `abierta`; usuario autorizado. |
| **Disparador** | Acción "Resolver" sobre el expediente. |
| **Entradas** | `incidenciaId`, análisis, acción correctiva, evidencia. |
| **Flujo principal** | 1. Incidencia abierta. 2. Análisis. 3. Acción correctiva. 4. Evidencia. 5. Validación. 6. Resolución. 7. Auditoría. 8. Estado → `cerrada`. |
| **Reglas aplicables** | Reglas de cierre de incidencia del tomo. |
| **Flujos alternativos** | Incidencia "sin acción" (falso positivo) → cierre con motivo, sin acción correctiva. |
| **Excepciones** | Incidencia ya cerrada → sin efecto. Falta de evidencia cuando la política la exige → cierre bloqueado. |
| **Postcondiciones** | Estado `cerrada`; **el expediente original nunca se elimina**. |
| **Eventos generados** | Evento de resolución → CIP. |
| **Auditoría** | Registro del cierre con el análisis y la acción. |
| **Resultado esperado** | Incidencia resuelta y auditable, expediente conservado. |
| **Componentes** | CCP · CIS · CORE. |
| **Prioridad** | Media. |
| **Estado en el repo** | 🔲 **Pendiente**: el Resumen del CCP muestra las incidencias **solo lectura** (`GET /dashboard/incidencias`). No hay acción de resolver, ni estados del expediente, ni endpoint de cierre. Trabajo nuevo, no cubierto por DOC-029 — anotarlo si el cliente lo necesita para Nivel 1. |
