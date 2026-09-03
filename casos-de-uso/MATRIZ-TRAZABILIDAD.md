# Matriz Maestra de Trazabilidad SICSAFT — MMTS

Instrumento vivo (§12.38 "Evaluación estratégica"). Permite recorrer cualquier funcionalidad:
**Necesidad → Proceso → Caso de Uso → Regla → Software → Datos → Prueba → Versión.**

- **Requisito** / **Proceso RMP**: códigos de capítulos previos del tomo (no versionados en git) —
  se completan cuando se incorporen esos capítulos. `—` = pendiente de mapear.
- **Módulo / API / BPI / Prueba**: realidad del repo a hoy.
- **Estado**: 🟢 implementado · 🟡 parcial · 🔲 pendiente.

| CU | Requisito | Proceso RMP | Reglas CFPS | Módulo (repo) | API (repo) | BPI (tabla) | Prueba | Versión | Estado |
|---|---|---|---|---|---|---|---|---|---|
| CU-PAT-001 Registrar activo | — | PAT-001 | CFP-001…005 | `ccp` · `cis/administrador` · `core/patrimonial` | `POST /admin/activos` → `POST /activos` | `activos` | `core` e2e activos · **falta** e2e UI | 1.0 | 🟢 (CCP — todos los niveles; también vía RF-B) |
| CU-PAT-002 Modificar activo | — | PAT-002 | CFP-002, CFP-004 | `ccp` · `cis` · `core/patrimonial` | `PATCH /admin/activos/:id/...` | `activos`, historial | `core` e2e | 1.0 | 🟢 (CCP — todos los niveles) |
| CU-PAT-003 Cambiar responsable | — | PAT-003 | RES-001…004 | `ccp` · `cis` · `core/patrimonial` | `PATCH /admin/activos/:id/responsable` | `activos`, historial | `core` e2e | 1.0 | 🟢 (CCP — todos los niveles) |
| CU-PAT-004 Trasladar activo | — | PAT-004 | UBI-001…004 | `ccp` · `cis` · `core` | *(sin endpoint dedicado)* | `activos`, historial | — | — | 🟡 parcial (sin flujo de traslado con evento) |
| CU-PAT-005 Dar de baja | — | PAT-005 | CFP-005 + estados | `ccp` · `cis` · `core/patrimonial` | `POST /admin/activos/:id/baja` | `activos.estado` (soft) | `core` e2e baja | 1.0 | 🟢 (CCP — todos los niveles) |
| CU-QR-001 Asignar QR | — | QR-001 | QR-001,002,005 | alta / ETL RF-B | parte de `POST /activos` | `activos.codigo_qr` (UNIQUE) | `core` e2e | 1.0 | 🟢 (en el alta) |
| CU-QR-002 Consultar por QR | — | QR-002 | QR-002 + visibilidad | `app-qr-sicsaft` · `cis` · `core` | `GET` resolución de escaneo | `activos` (lectura) | `app-qr` e2e (`ScanPage`) | 1.0 | 🟢 |
| CU-INV-001 Crear inventario | — | INV-001 | INV-001,002 | *(hoy la abre el operador en la APP)* | — | *(sesión ad-hoc)* | — | — | 🟡 parcial (sin "programar" por Adm/Supervisor) |
| CU-INV-002 Ejecutar inventario QR | — | INV-002 | INV-002…005 + árbol de escaneo | `app-qr-sicsaft` · `cis` · `core/reglas` | `POST /inventarios` | `sesiones`, `escaneos` | `app-qr` e2e · `core` `clasificar-escaneo.spec` | 1.0 | 🟢 |
| CU-INV-003 Conciliar inventario | — | INV-003 | INV-004,006 | `cip/agregacion` · `ccp` Resumen | `GET /dashboard/*` | agregados `cip` | `cip` `veredicto.spec` | 1.0 | 🟡 parcial (faltan "sobrante" y "discrepancia de responsable") |
| CU-INV-004 Cerrar inventario | — | INV-004 | INV-006 | `app-qr` · `cis` · `core` · `cip` | `POST /inventarios` (cierre) | `sesiones` | `app-qr`/`core` e2e | 1.0 | 🟡 parcial (sin informe formal; RF-D §D.3 pendiente) |
| CU-INC-001 Registrar incidencia | — | INC-001 | reglas de incidencia | `app-qr` · `core` | `POST /inventarios` (incidencias) | dentro de la sesión | `core` e2e | 1.0 | 🟡 parcial (solo origen "inventario") |
| CU-INC-002 Resolver incidencia | — | INC-002 | reglas de cierre | `ccp` (solo muestra) | *(sin endpoint de cierre)* | — | — | — | 🔲 pendiente |
| CU-DOC-001 Incorporar documento | — | DOC-001 | DOC-001…004 | `ccp` · `cis` · `core` | `POST /admin/activos/:id/documentos` | `documentos_activo` | `core` e2e | 1.0 | 🟢 (CCP — todos los niveles) |
| CU-DOC-002 Consultar expediente | — | DOC-002 | DOC-003,004 + visibilidad | `ccp` · `cis` · `core` | `GET /admin/activos/:id/documentos` | `documentos_activo` (lectura) | `core` e2e | 1.0 | 🟢 (CCP — todos los niveles) |
| CU-ADM-001 Crear usuario | — | ADM-001 | identidad + RBAC | wizard `.exe` / `core/frontend` | `keycloak-admin` (CIS) | Keycloak + `auditoria` (`identidad`) | `sicsaft-core` keycloak-bootstrap tests | 1.0 | 🟡 parcial (Director en wizard + designar AFT; el CRUD amplio pasó a intervención directa del proveedor, 2026-09) |
| CU-ADM-002 Asignar roles | — | ADM-002 | DOC-023 | `core/frontend` · `cis` | `keycloak-admin` (CIS) | Keycloak + `auditoria` | `cis` guard tests | 1.0 | 🟡 parcial (designar AFT desde `core/frontend`; el resto = intervención directa del proveedor) |
| CU-SEG-001 Autenticar | — | SEG-001 | políticas de realm | los 3 portales `lib/oidc/` · Keycloak | OIDC authorize/token | sesión Keycloak | `lib/oidc/` unit (PKCE/tokens/refresh) | 1.0 | 🟢 |
| CU-INT-001 Sincronizar ERP / Excel | — | INT-001 | reglas de integración + idempotencia | `herramientas/etl-contable` (RF-B) · `cis` · `core` | `POST /importaciones/contable/lote` + aprobar/rechazar | `importacion_contable_lote(_fila)` + `activos` | ETL pytest · `core` e2e ciclo lote (RF-B) | — | 🔲 pendiente (RF-B). Hoy solo CSV manual: `POST /admin/importaciones/contable` |
| CU-CIP-001 Dashboard ejecutivo | — | CIP-001 | visibilidad + drill-down | `ccp`/`core/frontend` · `cis/dashboard-connector` · `cip` | `GET /dashboard/*` | agregados `cip` (lectura) | `ccp` Dashboard tests · `cip` e2e | 1.0 | 🟢 |
| CU-CIP-002 Reporte parametrizado | — | CIP-002 | visibilidad + marcado | — | *(sin generador)* | — | — | — | 🔲 pendiente |
| CU-RFID-001/002/003 | — | RFID-* | RFID-001…006 | `rfid/` *(no existe)* | — | `eventos` | — | — | 🔲 no iniciado (Nivel 3) |

## Cómo se usa

Ante cualquier pregunta sobre una funcionalidad (ej. "¿dónde se valida el código patrimonial
duplicado?"), esta tabla lleva de CU-PAT-001 → CFP-001…005 → `core/patrimonial` →
`POST /activos` → tabla `activos` → prueba e2e de `core`. El **Plan Maestro de Pruebas**
(Cap. 14) hereda la columna **Prueba**; el **Plan Maestro de Desarrollo** hereda **Módulo / API /
Estado**.
