# Casos de Uso SICSAFT

Especificación estructurada de las interacciones entre los actores del ecosistema y sus
funcionalidades. Origen: **Cap. 12 — Casos de Uso** del tomo oficial (`.doc` fuente, no versionado
en git; incorporado 2026-08-31). Este directorio es la base documental para el Plan Maestro de
Desarrollo y el Plan Maestro de Pruebas (§12.1).

> **Regla del repo (CLAUDE.md "Documentación")**: al incorporar contenido de un tomo se cita la
> sección exacta (`§12.7`, no "el tomo dice") y se anota explícitamente si lo descrito **ya está
> implementado o sigue pendiente**. Cada CU de `dominios/` lleva un campo **Estado en el repo** con
> esa anotación y los archivos/endpoints reales.

## Contenido

| Archivo | Qué es |
|---|---|
| [`dominios/`](dominios) | El catálogo de CU, un archivo por dominio (§12.6), plantilla oficial §12.5 |
| [`MATRIZ-ACTOR-FUNCION.md`](MATRIZ-ACTOR-FUNCION.md) | §12.31 — quién puede hacer qué, contra los guards reales de CIS/CORE ([DOC-023](../aidlc-docs/ccp/design-artifacts/DOC-023-matriz-permisos-rbac.md)) |
| [`MATRIZ-TRAZABILIDAD.md`](MATRIZ-TRAZABILIDAD.md) | MMTS (§12.38 "Evaluación") — Requisito → Proceso → CU → Regla → Módulo → API → BPI → Prueba → Versión |
| [`PLAN-QA.md`](PLAN-QA.md) | Plan de QA para el cliente **Nivel 1 QR**: qué CU se prueban hoy, en qué orden, criterios de aceptación (§12.36), qué queda fuera y por qué |

## Principio fundamental (§12.3)

Un caso de uso **no es una pantalla**. Es un **objetivo de negocio ejecutado por un actor**. Una
pantalla participa en varios CU; un CU cruza varias pantallas, servicios y motores.

## Plantilla oficial (§12.5)

Todos los CU de `dominios/` usan esta estructura. Campos obligatorios:

| Campo | |
|---|---|
| **Código** | `CU-<DOMINIO>-NNN`, permanente, nunca se reutiliza para otra funcionalidad (§12.6) |
| **Nombre** | Nombre funcional |
| **Objetivo** | Resultado de negocio buscado |
| **Actor principal** | Quién lo inicia |
| **Actores secundarios** | Participantes |
| **Precondiciones** | Condiciones necesarias antes de empezar |
| **Disparador** | Evento que lo inicia |
| **Entradas** | Información requerida |
| **Flujo principal** | Secuencia normal |
| **Reglas aplicables** | Reglas CFPS invocadas |
| **Flujos alternativos** | Variaciones permitidas |
| **Excepciones** | Errores / condiciones anormales y su manejo |
| **Postcondiciones** | Estado del sistema al terminar |
| **Eventos generados** | Eventos del ecosistema emitidos |
| **Auditoría** | Evidencia que queda registrada |
| **Resultado esperado** | Resultado final verificable |
| **Componentes** | Sistemas del ecosistema involucrados |
| **Prioridad** | Crítica / Alta / Media / Baja |
| **Estado en el repo** | *(añadido por el repo)* implementado / parcial / pendiente + archivos y endpoints reales, o el RF de [DOC-029](../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md) que lo cubre |

## Dominios (§12.6)

| Prefijo | Dominio | Archivo |
|---|---|---|
| `CU-PAT` | Gestión Patrimonial | [dominios/CU-PAT-gestion-patrimonial.md](dominios/CU-PAT-gestion-patrimonial.md) |
| `CU-QR` | Código QR | [dominios/CU-QR-codigo-qr.md](dominios/CU-QR-codigo-qr.md) |
| `CU-INV` | Inventarios | [dominios/CU-INV-inventarios.md](dominios/CU-INV-inventarios.md) |
| `CU-INC` | Incidencias | [dominios/CU-INC-incidencias.md](dominios/CU-INC-incidencias.md) |
| `CU-DOC` | Gestión Documental | [dominios/CU-DOC-gestion-documental.md](dominios/CU-DOC-gestion-documental.md) |
| `CU-ADM` | Administración | [dominios/CU-ADM-administracion.md](dominios/CU-ADM-administracion.md) |
| `CU-SEG` | Seguridad | [dominios/CU-SEG-seguridad.md](dominios/CU-SEG-seguridad.md) |
| `CU-INT` | Integraciones | [dominios/CU-INT-integraciones.md](dominios/CU-INT-integraciones.md) |
| `CU-CIP` | Inteligencia Patrimonial | [dominios/CU-CIP-inteligencia.md](dominios/CU-CIP-inteligencia.md) |
| `CU-RFID` | RFID | [dominios/CU-RFID-rfid.md](dominios/CU-RFID-rfid.md) |

Reservados para el futuro (§12.34, sin documentar todavía): `CU-BLE`, `CU-GPS`, `CU-IOT`,
`CU-CAM`, `CU-IA`, `CU-ERP-002`.

## Actores oficiales (§12.4) y su mapeo al repo

### Humanos

| Actor del tomo | En el repo hoy | Notas |
|---|---|---|
| **Administrador SICSAFT** | rol Keycloak `administrador-sistema`, portal `web_admin/` | Config, usuarios, permisos, integraciones. |
| **Administrador Patrimonial** | rol Keycloak `administrador-patrimonial`, portal `ccp/` (ahí se lo llama **Profesional de AFT**) | Activos, responsables, ubicaciones, inventarios, documentación. |
| **Operador de Inventario** | usuario de la **APP QR** (`app-qr-sicsaft/`), rol Keycloak `profesional-aft` | Captura, identificación, ejecución de inventario. |
| **Supervisor Patrimonial** | **⚠️ sin rol propio** — hoy lo cubre `administrador-patrimonial` | Supervisión de operaciones, incidencias, conciliación. Gap: separar el rol es trabajo futuro. |
| **Auditor** | **⚠️ sin rol propio** — la Auditoría del CCP hoy la ve `administrador-patrimonial` | Consulta de historial, evidencias, trazabilidad (solo lectura). |
| **Directivo** | rol Keycloak `directivo`, portal `core/frontend/` | Indicadores, reportes y análisis vía CIP. |

### Tecnológicos

| Actor del tomo | En el repo | Estado |
|---|---|---|
| **APP Móvil SICSAFT** | `app-qr-sicsaft/` (PWA servida por el `.exe`, [DOC-028](../aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md) Fase D) | 🟢 real. APK nativa = RF-H de DOC-029, pendiente. |
| **Centro de Control Patrimonial (CCP)** | `ccp/` | 🟢 real. En Nivel 1 queda acotado (RF-A). |
| **Subsistema RFID** | `rfid/` | 🔲 **no iniciado** (Nivel 3). Todos los `CU-RFID-*` son pendientes. |
| **Sistema ERP** | conector `CU-INT-001` / [DOC-016](../aidlc-docs/integraciones/design-artifacts/DOC-016-conector-con-contabilidad.md) | 🔲 diseñado, sin código. RF-B de DOC-029 lo reemplaza para el flujo Excel. |
| **Sistemas BI / Analítica** | consumen de `cip/` | 🟡 CIP real; API de salida a BI externo, pendiente. |
| **Servicios externos futuros** (BLE, GPS, IoT, cámaras, IA) | — | 🔲 §12.34, reservados. |

## Modelo universal de ejecución (§12.33)

Salvo CU puramente consultivos o tecnológicos, toda operación transaccional respeta:

```
ACTOR
  ↓
INTERFAZ / FUENTE           (APP QR · CCP · web_admin · core/frontend · RFID · ERP)
  ↓
AUTENTICACIÓN Y AUTORIZACIÓN  (Keycloak OIDC/PKCE + guards de rol, DOC-023)
  ↓
PSD / CIS                    (cis/ — único punto de entrada de fuentes de captura)
  ↓
MOP                         (orquestador de core/)
  ↓
REGLAS DE NEGOCIO            (core/src/reglas/ — CFPS)
  ↓
SICSAFT CORE                (core/ — Motor Patrimonial)
  ↓
BPI                         (Base Patrimonial Central — Postgres, core/migrations/)
  ↓
EVENTO + HISTORIAL + AUDITORÍA  (core/src/auditoria/ + cola pg-boss → cip/)
  ↓
CIP                         (cip/ — inteligencia / dashboards)
  ↓
RESPUESTA AL ACTOR
```

## Reglas generales de todo CU (§12.35)

1. **Identidad** — código único, permanente.
2. **Autorización** — ningún actor ejecuta funciones fuera de sus permisos (verificado en CIS/CORE,
   no solo en la UI — DOC-023).
3. **Validación** — toda transacción pasa por las reglas CFPS.
4. **Trazabilidad** — toda operación relevante conserva evidencia (`auditoria`).
5. **Integridad** — **ningún canal modifica la BPI directamente**; todo pasa por `CIS → CORE`
   (invariante de CLAUDE.md, Tomo IV 1.7).
6. **Consistencia** — la misma regla produce el mismo comportamiento venga de APP, WEB, RFID o ERP.

## Criterios de aceptación de un CU (§12.36)

Un CU está correctamente implementado cuando: el actor autorizado puede iniciarlo · las
precondiciones se verifican · el flujo principal funciona · los flujos alternativos funcionan · las
excepciones se controlan · las reglas CFPS se respetan · la BPI conserva integridad · los eventos
se generan · existe auditoría · el resultado es verificable. Estos criterios se transforman en
pruebas en [`PLAN-QA.md`](PLAN-QA.md).
