# CU-DOC — Gestión Documental

Dominio §12.23–§12.24. Reglas DOC-001…DOC-004 (tomo). Componentes: `ccp/`, `cis/`, `core/`, BPI
(`documentos_activo`).

> Nota del esquema: `documentos_activo` es la **única** tabla de la Base Patrimonial exenta del
> invariante "sin `DELETE` real" (comentario explícito en
> `core/migrations/1755800000000_gaps-ccp-y-admin-sistema.ts`). El resto de entidades oficiales se
> dan de baja por `estado`.

---

## CU-DOC-001 — Incorporar Documento

| Campo | Detalle |
|---|---|
| **Código** | CU-DOC-001 |
| **Nombre** | Incorporar Documento |
| **Objetivo** | Adjuntar un documento o fotografía al expediente digital de un activo (§12.23). |
| **Actor principal** | Usuario autorizado (Administrador Patrimonial). |
| **Actores secundarios** | CCP, CORE, Auditoría. |
| **Precondiciones** | Activo existente; usuario autorizado. |
| **Disparador** | "Agregar" en el panel de documentación del activo. |
| **Entradas** | `activoId`, `tipo` (`documento` / `fotografia`), `url`, `descripcion` opcional. |
| **Flujo principal** | 1. Seleccionar activo. 2. Abrir el expediente. 3. Seleccionar documento. 4. Clasificar (tipo). 5. Validar. 6. Guardar. 7. Registrar versión. 8. Auditoría. |
| **Reglas aplicables** | DOC-001 a DOC-004. |
| **Flujos alternativos** | Reemplazo de un documento (nueva versión) → la anterior se conserva. |
| **Excepciones** | `url` vacía / inválida → 400. Activo dado de baja → según regla, permitido para completar el expediente histórico. |
| **Postcondiciones** | Documento asociado al activo, versionado. |
| **Eventos generados** | Evento de documentación → CIP. |
| **Auditoría** | `operacion` = alta de documento sobre `{activoId}`. |
| **Resultado esperado** | Expediente digital enriquecido y versionado. |
| **Componentes** | CCP · CIS · CORE · BPI. |
| **Prioridad** | Media. |
| **Estado en el repo** | 🟢 **Implementado** (todos los niveles): `ActivosPage.tsx` panel "Editar" → "Documentación y fotografías" → `altaDocumentoActivo` / `eliminarDocumentoActivo` → `documentos_activo`. Hoy se guarda una `url`, no un archivo subido — verificar en la QA si el cliente necesita carga de archivo real. |

---

## CU-DOC-002 — Consultar Expediente Digital

| Campo | Detalle |
|---|---|
| **Código** | CU-DOC-002 |
| **Nombre** | Consultar Expediente Digital |
| **Objetivo** | Ver la documentación asociada a un activo según permisos (§12.24). |
| **Actor principal** | Usuario autorizado (Administrador Patrimonial / Auditor). |
| **Actores secundarios** | CCP, CIS, CORE. |
| **Precondiciones** | Activo existente; usuario con permiso de consulta. |
| **Disparador** | Apertura del expediente del activo. |
| **Entradas** | `activoId`. |
| **Flujo principal** | 1. Abrir el activo. 2. CORE devuelve la lista de documentos permitidos. 3. El usuario abre fotografías, facturas, garantías, contratos, certificados, actas, informes, documentación histórica según su perfil. |
| **Reglas aplicables** | DOC-003, DOC-004; reglas de visibilidad por perfil. |
| **Flujos alternativos** | Descarga de un documento (según política). |
| **Excepciones** | Sin permiso → el documento no se lista. Documento no disponible → aviso. |
| **Postcondiciones** | Sin cambios en la BPI (CU consultivo). |
| **Eventos generados** | — |
| **Auditoría** | La consulta se registra cuando la política de seguridad lo exige. |
| **Resultado esperado** | El usuario ve solo los documentos autorizados. |
| **Componentes** | CCP · CIS · CORE · BPI. |
| **Prioridad** | Media. |
| **Estado en el repo** | 🟢 **Implementado** (todos los niveles): `getDocumentosActivo` lista los documentos con enlace. Registro de la consulta en `auditoria`: verificar en la QA. |
