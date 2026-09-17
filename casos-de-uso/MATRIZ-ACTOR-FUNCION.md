# Matriz Actor–Función (§12.31) — Roles y Permisos

> 📌 **Resumen Rápido (Lectura en 30s)**:
> - **¿Qué es?**: Mapeo entre los actores formales del negocio y los roles de autenticación reales en Keycloak.
> - **Roles en Producción**:
>   1. `administrador-patrimonial` (Profesional de AFT): Opera el portal web `ccp/` con gestión completa de activos (alta, edición, baja), estructura, etiquetas QR, auditoría e importación Excel.
>   2. `profesional-aft` (Operador de Inventario): Opera la APP Móvil QR (`app-qr-sicsaft/`) para escaneo y control físico.
>   3. `directivo` (Director): Accede a `core/frontend/` para ver organigrama de área, dashboards y descargar reportes PDF.
> - **Roles no vigentes**: `administrador-sistema` y `web_admin/` fueron retirados (soporte directo del proveedor vía script/BD).

`✓` permitido · `Según permiso` depende del RBAC fino · `—` no permitido · `⚠` el rol no existe
como tal en el repo todavía (lo cubre otro).

La matriz oficial del tomo, seguida de la lectura real contra los guards de CIS/CORE
([DOC-023](../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md)).

## Matriz del tomo

| Función | Operador de Inventario | Adm. Patrimonial | Supervisor Patrimonial | Auditor | Directivo | Adm. SICSAFT |
|---|---|---|---|---|---|---|
| Consultar activo | ✓ | ✓ | ✓ | ✓ | Según perfil | ✓ |
| Inventariar | ✓ | ✓ | ✓ | — | — | — |
| Crear activo | — | ✓ | Según permiso | — | — | ✓ |
| Modificar activo | — | ✓ | Según permiso | — | — | ✓ |
| Trasladar | Según permiso | ✓ | ✓ | — | — | ✓ |
| Dar de baja | — | Según permiso | Según permiso | — | — | ✓ |
| Consultar auditoría | — | Según permiso | ✓ | ✓ | Según perfil | ✓ |
| CIP | — | Según perfil | ✓ | ✓ | ✓ | ✓ |
| Usuarios / permisos | — | — | — | — | — | ✓ |
| Configuración | — | — | — | — | — | ✓ |

> "La matriz definitiva deberá ser parametrizable mediante el sistema de roles y permisos"
> (§12.31). **Hoy es código, no configuración** — los guards están en CIS/CORE. Parametrizarla es
> trabajo futuro.

## Lectura real contra el repo (roles Keycloak que existen hoy)

| Rol Keycloak | Actor(es) del tomo que cubre | Portal | Notas |
|---|---|---|---|
| `administrador-patrimonial` | **Adm. Patrimonial** + hoy también **Supervisor** y **Auditor** ⚠ | `ccp/` (ahí "Profesional de AFT") | El **CCP va completo en todos los niveles** (RF-A, corrección 2026-09-02): activos con alta/edición/baja, Estructura, ingesta, Resumen, Auditoría, QR/Etiquetas. En **Nivel 1** solo se oculta el **Dashboard** (es CIP). |
| `profesional-aft` | **Operador de Inventario** | `app-qr-sicsaft/` (PWA) | Escaneo, consulta por QR, ejecución y cierre de relevamiento. |
| `directivo` | **Directivo** | `core/frontend/` | Solo consulta CIP / dashboards; puede designar Profesional de AFT en su organización (DOC-022). |
| — | **Adm. SICSAFT** | — | **Sin rol/portal.** `administrador-sistema` y `web_admin/` se eliminaron (2026-09): el CRUD de Organización/Contrato/Sede/usuarios es hoy intervención directa del proveedor (BD / script con service-token) + el bootstrap del wizard; los errores se diagnostican por la consola de logs de `sicsaft-core`. |
| — | **Supervisor Patrimonial** ⚠ | — | **No existe rol propio.** Conciliar/cerrar inventario, resolver incidencias: hoy caerían en `administrador-patrimonial`. Separarlo es trabajo futuro. |
| — | **Auditor** ⚠ | — | **No existe rol propio.** La Auditoría del CCP hoy la ve `administrador-patrimonial`. |

## Impacto en la QA del cliente Nivel 1

- El cliente Nivel 1 usa **dos roles operativos principales**: `administrador-patrimonial` (portal CCP, en el `.exe`) y
  `profesional-aft` (APP QR en el teléfono). El Director (`directivo`) se crea durante el wizard inicial.
- Las funciones de Supervisor/Auditor **no tienen rol separado** — si el cliente los necesita
  distintos, es un cambio de RBAC previo a la entrega. Anotado en `PLAN-QA.md` como riesgo.
- En **Nivel 1**, el portal CCP está disponible con todas sus operaciones patrimoniales (alta manual, edición, baja, importación contable y etiquetas QR). Únicamente se oculta el módulo de Dashboard avanzado analítico (CIP), que corresponde a Nivel 2.
