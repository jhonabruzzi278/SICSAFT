# REQUIREMENTS — CON-CONTABILIDAD (Fase 7)

Ver [INTENT.md](INTENT.md) para alcance y exclusiones. Detalle técnico completo en
[DOC-016](../design-artifacts/DOC-016-conector-con-contabilidad.md).

## Funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RF-01 | CIS vigila una carpeta local configurable por organización y, en cada corrida programada, detecta archivos CSV nuevos o modificados desde la última corrida exitosa. | Tomo III 1.4 Entrada 5; ROADMAP.md Fase 7 |
| RF-02 | CIS parsea el CSV con las mismas columnas que `filaImportacionSchema` (`codigoPatrimonial,codigoQr,catalogoId,serie,responsableId,areaId,ubicacionId,valorPatrimonial`) — mismo criterio de parseo simple (split por coma) que `ccp/src/pages/ImportacionesPage.tsx`, para que un archivo válido para la carga manual también lo sea para el conector. | DOC-012 §6 |
| RF-03 | CIS envía las filas parseadas a `POST /importaciones/contable` de CORE reusando `CoreClientService.postImportacionContable` (mismo circuit breaker + reintentos que el resto de los proxies CIS→CORE) — nunca escribe directo a la Base Patrimonial. | Regla no negociable de `CLAUDE.md`; WAF 4 |
| RF-04 | La identidad de cada envío es sintética (`operadorId` fijo distinguible, `rolesPorOrganizacion` con `administrador-patrimonial` para la organización configurada) — nunca se inventa un camino de autorización nuevo en CORE, CORE re-verifica el rol igual que a cualquier otro caller. | ROADMAP.md Fase 7 "conector... cliente más de este mismo endpoint, no un camino de escritura paralelo" |
| RF-05 | Cada corrida (con o sin archivo encontrado, con éxito o error) queda registrada vía `POST /auditoria` — reusa el canal ya implementado (`CoreClientService.postAuditoria`), no una tabla nueva. | ROADMAP.md Fase 7 "registro por integración"; DOC-016 §5 |
| RF-06 | El conector reenvía el archivo completo en cada corrida (sin llevar un hash/marca local de "ya procesado") — se apoya enteramente en que `POST /importaciones/contable` ya es idempotente por fila en CORE (DOC-012 §6: contenido igual → `ya_importado`, sin reescribir). Decisión deliberada: evita que CIS necesite estado local propio (hoy no tiene base de datos) y evita drift entre "lo que CIS cree que ya mandó" y lo que CORE realmente tiene — ver DOC-016 §4. | DOC-012 §6 (idempotencia ya probada); YAGNI |
| RF-07 | La cadencia es diaria por defecto, configurable (expresión cron) — no un intervalo fijo hardcodeado. | pptx spec funcional, citado en ROADMAP.md Fase 7 |
| RF-08 | La caída del sistema contable/la ausencia de archivo nuevo nunca bloquea el resto de CIS (Captura→CIS→CORE sigue operando). | ROADMAP.md Fase 7 "Done" |

## No funcionales

| ID | Requisito | Fuente |
|---|---|---|
| RNF-01 | Resiliencia: igual que el resto de CIS→CORE, reintentos con backoff + circuit breaker (WAF 4) — heredado gratis de `CoreClientService`, sin reimplementar. | WAF 4 |
| RNF-02 | Aislamiento de fallos: un error de parseo en una fila no aborta el archivo completo (ya es la semántica de CORE, `ImportacionContableResultado` resuelve fila por fila) — un error de *archivo* (CSV corrupto, columnas faltantes) sí aborta esa corrida y se reporta como error único, no fila por fila. | DOC-012 §6 |
| RNF-03 | Nunca elimina: un activo que deja de aparecer en el CSV no se da de baja — mismo invariante que ya cumple `POST /importaciones/contable`. | Tomo III 1.4 Entrada 5 ("nunca elimina información histórica") |
| RNF-04 | La carpeta vigilada vive en la PC del cliente (dentro de `sicsaft-core`, on-prem — ver CORE-RNF-04 de `aidlc-docs/sicsaft-core/requirements/REQUIREMENTS.md`), nunca en un share de red sin autenticación del sistema operativo — el control de acceso al archivo es responsabilidad del SO del cliente, no de SICSAFT. | Prohibición arquitectónica de conexión directa a ERP (memoria `project_nomenclatura_arquitectura`) |
| RNF-05 | Sin credenciales de un sistema contable/ERP real hardcodeadas en ningún lado — el conector no se autentica contra ningún sistema externo, solo lee un archivo que otro proceso (fuera de SICSAFT) ya dejó ahí. | Regla de secretos de `CLAUDE.md`/`security.md` |

## Explícitamente fuera de alcance (YAGNI, ver INTENT.md)

- Tabla `integraciones_registro`/dominio `Integraciones` modelado completo — se reusa `auditoria`.
- UI de configuración o estado del conector.
- Adaptador para un formato de ERP real específico (Excel PC MASTER, API de un sistema
  contable puntual) — sin sistema real identificado todavía (INTENT.md).
- `Configuración` como dominio propio de DOC-005 — la config del conector vive en variables de
  entorno de `cis/`, no en una tabla.
