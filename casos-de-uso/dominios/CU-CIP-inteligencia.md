# CU-CIP — Inteligencia Patrimonial

Dominio §12.29–§12.30. Componentes: `cip/` (BI), `core/frontend/` (portal del Directivo), `ccp/`
(Resumen del AFT). CIP consume eventos reales de CORE por la cola `pg-boss` (ADR-005); no expone
frontend propio.

---

## CU-CIP-001 — Consultar Dashboard Ejecutivo

| Campo | Detalle |
|---|---|
| **Código** | CU-CIP-001 |
| **Nombre** | Consultar Dashboard Ejecutivo |
| **Objetivo** | Ver indicadores patrimoniales sin modificar registros (§12.29). |
| **Actor principal** | Directivo / Supervisor autorizado. |
| **Actores secundarios** | Portal (core/frontend o ccp), CIS, CIP. |
| **Precondiciones** | Usuario autenticado con rol de consulta; organización con datos. |
| **Disparador** | Apertura del dashboard. |
| **Entradas** | `organizacionId`; filtros opcionales (área, período). |
| **Flujo principal** | 1. Usuario autenticado. 2. Portal → CIS → CIP. 3. Selección del dashboard. 4. Aplicación de permisos. 5. Consulta de indicadores (cobertura, sesiones, veredictos, fuera de área, no localizados, incidencias, categorías). 6. Visualización. |
| **Reglas aplicables** | Reglas de visibilidad por perfil; drill-down Organización → Área → Categoría (DOC-018 §6). |
| **Flujos alternativos** | Filtrar por área (drill-down). Sin datos → estados vacíos ("Sin sesiones", "Sin incidencias"). |
| **Excepciones** | Sin `organizacionId` → aviso "volvé al hub". CIP sin datos aún → dashboard en ceros (correcto tras una base limpia). |
| **Postcondiciones** | **Ninguna escritura** sobre registros patrimoniales (CU consultivo). |
| **Eventos generados** | — |
| **Auditoría** | Consulta registrada si la política lo exige. |
| **Resultado esperado** | El usuario analiza información sin alterar la BPI. |
| **Componentes** | core/frontend / ccp · CIS · CIP. |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟢 **Implementado**: `ccp/src/pages/DashboardPage.tsx` (Resumen del AFT) y `core/frontend/` (Directivo) contra CIP real (`dashboard-connector` en CIS, DOC-019). **RF-C de DOC-029** agrega 3 pestañas nuevas al Resumen (spec pendiente de Guido). |

---

## CU-CIP-002 — Generar Reporte Patrimonial

| Campo | Detalle |
|---|---|
| **Código** | CU-CIP-002 |
| **Nombre** | Generar Reporte Patrimonial |
| **Objetivo** | Producir un reporte parametrizado exportable (§12.30). |
| **Actor principal** | Directivo / Supervisor / Auditor autorizado. |
| **Actores secundarios** | Portal, CIS, CIP. |
| **Precondiciones** | Usuario con permiso de reporte; parámetros válidos. |
| **Disparador** | "Generar reporte". |
| **Entradas** | Período, área, sede, familia, estado, responsable, inventario, incidencias (combinables). |
| **Flujo principal** | 1. Usuario elige parámetros. 2. CIP consulta los datos. 3. Se arma el reporte. 4. Salida: visualización + PDF + Excel u otro formato autorizado. 5. El reporte identifica **fecha, parámetros y contexto de generación**. |
| **Reglas aplicables** | Reglas de visibilidad por perfil; retención/marcado del reporte. |
| **Flujos alternativos** | Reporte guardado / programado (envío periódico). |
| **Excepciones** | Combinación de parámetros sin resultados → reporte vacío con la leyenda de parámetros. Sin permiso para un ámbito → ese ámbito se excluye. |
| **Postcondiciones** | Reporte generado; sin cambios en la BPI. |
| **Eventos generados** | Registro de generación de reporte si la política lo exige. |
| **Auditoría** | Generación registrada con parámetros y usuario. |
| **Resultado esperado** | Documento con fecha, parámetros y contexto, exportable. |
| **Componentes** | core/frontend / ccp · CIS · CIP. |
| **Prioridad** | Media. |
| **Estado en el repo** | 🔲 **Pendiente**: hoy hay dashboards interactivos, **no** un generador de reporte parametrizado con export PDF/Excel y bloque de "fecha + parámetros + contexto". Trabajo nuevo, no cubierto por DOC-029 — anotarlo si el cliente Nivel 1 lo pide (el estilo de informe `.docx` ya está definido, ver memoria del proyecto). |
