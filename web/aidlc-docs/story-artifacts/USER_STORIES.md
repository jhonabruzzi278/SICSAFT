# User Stories — Portal WEB SICSAFT (Fase 5)

## Login y hub

**Como** operador con acceso a WEB (cualquier rol), **quiero** entrar con mi cuenta de Zitadel y
ver solo los módulos que mi contrato habilita, **para** no toparme con pantallas de un módulo que
mi organización no contrató.

- **Criterio de aceptación**: dos operadores de organizaciones distintas, con contratos con
  `modulosContratados` distintos, ven hubs distintos tras el login — nunca la lista completa de
  6 módulos a todos por igual (RF-02).

## Alta de un activo (Administrador Patrimonial)

**Como** Administrador Patrimonial, **quiero** dar de alta un activo nuevo desde WEB (código
patrimonial, catálogo, área, ubicación, responsable), **para** que exista oficialmente en la Base
Patrimonial antes de imprimirle su etiqueta QR.

- **Criterio de aceptación**: al guardar, el activo aparece inmediatamente en `GET /catalogo` —
  el mismo endpoint que consume APP QR (RF-08, criterio "Done" de `ROADMAP.md` Fase 5).

## Consulta de catálogo

**Como** cualquier operador con el módulo Activos habilitado, **quiero** buscar un activo por
código patrimonial, código QR o nombre, filtrando por área/ubicación, **para** verificar sus
datos sin tener que escanearlo físicamente.

## Estado de una sesión de inventario

**Como** supervisor, **quiero** ver el estado de las sesiones de inventario recientes (pendiente/
recibido/rechazado) y su detalle (qué se escaneó, en qué categoría cayó cada activo), **para**
darle seguimiento sin depender de que el operador de campo reporte manualmente.

## ABM de estructura organizacional

**Como** Administrador Patrimonial, **quiero** crear/editar Áreas, Ubicaciones y Responsables,
**para** mantener la estructura contra la que se valida cada escaneo (Motor de Reglas, DOC-009) —
sin esto, todo escaneo caería en `otra_area`/`otra_ubicacion` por datos desactualizados.

## Auditoría de solo lectura

**Como** Auditor, **quiero** filtrar el registro de auditoría por usuario, rango de fecha y tipo
de operación, **para** reconstruir qué pasó ante una discrepancia — sin poder modificar ni
eliminar ningún registro (DOC-011, "el historial nunca se pierde").

## ABM de Contratos

**Como** Administrador Patrimonial, **quiero** crear un contrato nuevo o cambiar su estado
(suspender/reactivar/cancelar), **para** habilitar o cortar el acceso de una organización a un
módulo sin tocar código — hoy la tabla `contratos` (DOC-004) solo se lee, este módulo es el
primer punto de escritura real.

- **Criterio de aceptación**: cambiar el estado de un contrato a `suspendido` hace que, en el
  siguiente login, esa organización deje de ver los módulos que ese contrato habilitaba (mismo
  invariante de DOC-004 §3 — "solo `vigente` habilita acceso").
