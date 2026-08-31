# Plan de QA — Cliente SICSAFT Nivel 1 QR

Objetivo: **validar la aplicación antes de entregarla a un cliente real** (`sicsaft-core.exe`,
Nivel 1: APP QR + CCP acotado + Base Patrimonial + CIS + CORE + CIP). Deriva de los Casos de Uso
de este directorio y de la estrategia de validación en 6 pasos del usuario (2026-08-31).

Criterio de "correcto" por CU: §12.36 (actor autorizado puede iniciarlo · precondiciones
verificadas · flujo principal · flujos alternativos · excepciones controladas · reglas CFPS
respetadas · BPI íntegra · eventos generados · auditoría presente · resultado verificable).

---

## 1. Alcance

### Entra en esta QA (CU testeables con lo que hay hoy)

| CU | Qué valida | Suite |
|---|---|---|
| CU-SEG-001 | Login OIDC, roles, timeout controlado (fix RF-G) | QA-0, QA-6 |
| CU-QR-002 | Consulta de activo por escaneo | QA-3 |
| CU-INV-002 | Ejecución de relevamiento QR, sin doble conteo | QA-3 |
| CU-INV-004 | Cierre de sesión, veredicto | QA-3, QA-4 |
| CU-INV-003 | Conciliación (parcial: no localizado / fuera de área / incidencia) | QA-4 |
| CU-INC-001 | Alta de incidencia durante relevamiento | QA-3 |
| CU-CIP-001 | Dashboard / Resumen contra CIP real | QA-4 |
| CU-PAT-005 | Baja por `estado` (si se reexpone en Nivel 1) | QA-5 |
| Matriz Actor–Función | RBAC real (CCP vs APP QR) | QA-6 |
| RF-A | Portal Nivel 1 recortado, redirects | QA-0 |

### NO entra / bloqueado (y por qué)

| CU / tema | Motivo | Desbloquea |
|---|---|---|
| **CU-INT-001** (carga de Excel supervisada) | **RF-B sin construir.** Hoy solo carga manual de CSV con IDs a mano. | Construir RF-B (ETL Python + staging + revisión) |
| **CU-QR-001 masivo / etiquetas** | **RF-F sin construir** (módulo QR/Etiquetas, QR + Code128 por dirección). | Construir RF-F |
| CU-PAT-001..004 desde la UI | RF-A los oculta en Nivel 1 (por diseño). El alta se cubre por RF-B. | — (intencional) |
| CU-INV-001 "programar inventario" | Hoy la sesión la abre el operador en la APP, sin paso previo del Adm/Supervisor. | Decisión de diseño nueva |
| CU-INC-002 (resolver incidencia) | Sin endpoint de cierre; el Resumen solo muestra. | Trabajo nuevo |
| CU-CIP-002 (reporte parametrizado PDF/Excel) | Sin generador. | Trabajo nuevo |
| CU-ADM-001/002 CRUD completo | `web_admin/` en construcción. Para Nivel 1 alcanza el wizard + "designar AFT". | DOC-022 |
| CU-RFID-* | Nivel 3, sin código. | — |
| CU-DOC-* | Nivel 2 (cuelgan de la edición de activo, oculta en Nivel 1). | — |

### Riesgo de RBAC (ver `MATRIZ-ACTOR-FUNCION.md`)

**Supervisor Patrimonial** y **Auditor** no tienen rol propio: hoy los cubre
`administrador-patrimonial`. Si el cliente exige separación de funciones (que el que concilia no
sea el que carga, que el auditor sea solo-lectura), **resolver el RBAC antes de la entrega**.

---

## 2. Precondiciones del entorno de QA

1. PC Windows limpia (idealmente distinta de la de desarrollo) con el `sicsaft-core.exe` recién
   generado (`npm run dist:win` **después** de mergear RF-A + RF-G + RF-B).
2. Reserva de IP fija (DHCP) para esa PC — evita el reprompt de "cambió la IP".
3. Un teléfono en la **misma red Wi-Fi**, con la APP QR (PWA hoy; APK cuando exista RF-H).
4. El Excel de simulación del cliente (`EJEMPLOS DE EMPRESAS Y AFT.xls` u otro real).
5. Wizard corrido de cero → organización + Director + Profesional de AFT creados **con las
   contraseñas temporales reales** que genera el instalador (no las de verificación E2E).

---

## 3. Suites

### QA-0 — Smoke (instalación y arranque)

| # | Paso | Resultado esperado | CU |
|---|---|---|---|
| 0.1 | Instalar el `.exe` en la PC limpia | Instala sin pedir Docker/WSL2/Podman; acceso directo creado | — |
| 0.2 | Primer arranque → wizard | Paso 1 (datos cliente) → Paso 2 (Director) → Paso 3 (Profesional de AFT) → "Instalación completa" | CU-ADM-001 |
| 0.3 | Pantalla "listo" | Se ve el QR de la PWA con `https://<ip-lan>:8765`; layout correcto también a **pantalla completa** (fix RF-G) | — |
| 0.4 | Login embebido como Director | Entra al portal del Directivo sin segundo login; si tarda, mensaje claro y "Cambiar de usuario" (no crash, fix RF-G) | CU-SEG-001 |
| 0.5 | "Cambiar de usuario" → Profesional de AFT | Entra al **CCP en Nivel 1**: menú = Resumen · Activos · Importaciones · Auditoría. **No** aparecen Contratos, Inventarios, Áreas y ubicaciones | RF-A |
| 0.6 | Abrir por URL `/contratos` y `/inventarios` | Redirige al Resumen | RF-A |
| 0.7 | Activos | Solo tabla de consulta; **sin** formulario de alta ni acciones por fila | RF-A / CU-PAT |
| 0.8 | Relanzar el `.exe` | Salta directo al login (no repite el wizard); si cambió la IP, pantalla de reconfiguración y "Reconfigurar y continuar" | DOC-028 C.1 |
| 0.9 | Teléfono: escanear el QR de la pantalla "listo" | Abre la PWA; aviso de certificado propio una sola vez → "Continuar" → login de la APP QR | CU-SEG-001 |

### QA-1 — Carga de datos (paso 1–2 del usuario) — **BLOQUEADA hasta RF-B**

| # | Paso | Resultado esperado | CU |
|---|---|---|---|
| 1.1 | En Importaciones, elegir la carpeta donde el especialista deja los Excel | Carpeta persistida; se muestra en pantalla | CU-INT-001 / RF-B |
| 1.2 | Dejar `EJEMPLOS DE EMPRESAS Y AFT.xls` en esa carpeta | El ETL lo normaliza (encabezado fila 5, celdas combinadas, mapeo de columnas, acuña `codigoQr` desde `CODIGO`) y aparece un **lote `pendiente_revision`** | CU-INT-001 |
| 1.3 | Abrir el lote → revisar el dry-run | Cada fila marcada crear / actualizar / conflicto; totales correctos | CU-INT-001 |
| 1.4 | **Aprobar** el lote | CORE resuelve-o-crea dirección/área/responsable/catálogo por nombre e inserta los activos; el catálogo del CCP y de la APP QR muestran los ~265 activos | CU-PAT-001, CU-QR-001 |
| 1.5 | Re-dejar el mismo archivo sin cambios y aprobar | Todas las filas → `ya_importado`, cero duplicados (idempotencia) | CU-INT-001 |
| 1.6 | **Rechazar** un lote de prueba | Nada toca la BPI; queda `rechazado` con motivo; auditoría | CU-INT-001 |

**Fallback sin RF-B** (para no bloquear QA-3..QA-6): cargar un subconjunto (10–20 activos de una
dirección) por el importador manual de CSV actual, generando los IDs a mano. Suficiente para
validar el ciclo de relevamiento, no para validar CU-INT-001.

### QA-2 — Etiquetas QR por dirección (paso 3 del usuario) — **BLOQUEADA hasta RF-F**

| # | Paso | Resultado esperado | CU |
|---|---|---|---|
| 2.1 | Abrir el módulo QR / Etiquetas | Lista de todos los activos agrupados por **dirección** y área | CU-QR-001 / RF-F |
| 2.2 | Cada activo se ve como etiqueta | QR + código de barras **Code128** + `codigoPatrimonial` + nombre + área | RF-F |
| 2.3 | "Imprimir dirección X" | Hoja de etiquetas (grilla tipo Avery), salto de página por dirección | RF-F |
| 2.4 | Imprimir y meter en sobres por dirección | Un sobre por dirección con sus QR | — |

**Fallback sin RF-F**: generar los QR con un script suelto (`qrcode` CLI) a partir de los
`codigoQr` cargados, agrupando por dirección a mano.

### QA-3 — Relevamiento por dirección (paso 4 del usuario)

Repetir por **cada dirección** del Excel (DIRECCION GENERAL, etc.).

| # | Paso | Resultado esperado | CU |
|---|---|---|---|
| 3.1 | En la APP QR, iniciar sesión de relevamiento eligiendo el área/dirección | Sesión abierta | CU-INV-002 |
| 3.2 | Escanear un QR válido de esa dirección | Ficha del activo; resultado `correcto` | CU-QR-002, CU-INV-002 |
| 3.3 | Escanear **el mismo QR otra vez** | *"El activo ya se encuentra registrado en este inventario"*; **no** cuenta doble | CU-INV-002 (excepción) |
| 3.4 | Escanear un QR de **otra** dirección | Se marca `otra_area` / `otra_ubicacion` | CU-INV-002 |
| 3.5 | Escanear un QR inexistente / mal formado | `no_registrado` / `invalido`; la sesión no se corta | CU-INV-002 (excepción) |
| 3.6 | Marcar una incidencia sobre un activo (ej. "dañado") | Se registra `{codigoQr, descripcion}` en la sesión | CU-INC-001 |
| 3.7 | No escanear 1–2 activos que sí están en la dirección | Quedan como esperados-no-detectados | CU-INV-003 |
| 3.8 | Marcar el **estado de cada AFT** durante el escaneo (EN SERVICIO / EN MANTENIMIENTO / INACTIVO / BAJA) | Se envía como `estadoDeclarado` / `bajaSugerida` por escaneo | CU-INV-002, [Pantalla 8](CONTRATO-PANTALLA-8.md) §3 |
| 3.9 | Cerrar la sesión y **enviar informe resumen a SICSAFT CORE** | La sesión cierra; se calcula el veredicto (`exitoso`/`aceptable`/`defectuoso`); `POST /inventarios` persiste sesión + incidencias; auditoría | CU-INV-004 |
| 3.10 | Ver la **Pantalla 8** que arma la APP | Cumple el [contrato de Pantalla 8](CONTRATO-PANTALLA-8.md): encabezado, escaneados, del-área (n y %), estado por AFT, lista con tipo ordinario/extraordinario, fuera-de-área con su área real, veredicto con fondo verde/amarillo/rojo | CU-INV-003/004, Pantalla 8 |

### QA-4 — Resultados en el Dashboard (paso 5 del usuario)

| # | Paso | Resultado esperado | CU |
|---|---|---|---|
| 4.1 | En el CCP (Profesional de AFT) → Resumen | "% Cobertura", "Activos escaneados" reflejan lo relevado | CU-CIP-001 |
| 4.2 | "Sesiones de inventario" → detalle de una sesión | Muestra la **Pantalla 8** de esa sesión (mismo contrato que en la APP), con los fondos de color | CU-INV-004, [Pantalla 8](CONTRATO-PANTALLA-8.md) |
| 4.3 | "Activos fuera de área" | Lista los QR escaneados en la dirección equivocada (paso 3.4) | CU-INV-003 |
| 4.4 | "Activos no localizados" | Lista los que no se escanearon (paso 3.7) | CU-INV-003 |
| 4.5 | "Incidencias" | Muestra las del paso 3.6; el filtro por código QR funciona | CU-INC-001 |
| 4.6 | Auditoría | Hay entradas por cada cierre de sesión, con usuario y operación | CU-SEG-001, §12.35.4 |
| 4.7 | **Comparar diseñado vs. real** para todas las direcciones | Los totales del Dashboard = la suma de los informes por dirección. Si coincide → **V1.0 del flujo de auditoría OK** | §12.36 |

### QA-5 — Escenarios de prueba y error (paso 6 del usuario)

Con los QR ya separados en sobres por dirección, combinar situaciones reales:

| # | Escenario (hipótesis real) | Qué se valida |
|---|---|---|
| 5.1 | Sacar un QR del sobre A y ponerlo en el sobre B, relevar ambos | El activo aparece como "fuera de área" en B y "no localizado" en A; el veredicto de ambas sesiones lo refleja |
| 5.2 | Quitar un QR de un sobre y no escanearlo en ningún lado | "No localizado" en su dirección; no aparece como sobrante en ninguna |
| 5.3 | Relevar una dirección completa sin faltantes ni intrusos | Veredicto `exitoso` |
| 5.4 | Relevar con un solo problema (falta 1) | Veredicto `aceptable` |
| 5.5 | Relevar con los dos problemas (falta 1 **y** hay 1 de otra área) | Veredicto `defectuoso`; **(con RF-D)** se registra automáticamente una entrada de auditoría `sesiones/{id}/veredicto-defectuoso` |
| 5.6 | Cerrar una sesión y luego intentar modificarla | No hay operación ordinaria que reabra/edite una sesión cerrada (CU-INV-004 postcondición) |
| 5.7 | Dar de baja un activo faltante (si la acción está reexpuesta en Nivel 1) | `estado = dado_de_baja`, la fila **no** se borra, queda en Auditoría | CU-PAT-005 |
| 5.8 | Repetir 5.1–5.6 y revisar el Dashboard general | El Resumen consolida todas las direcciones de forma coherente |

### QA-6 — Seguridad y RBAC

| # | Paso | Resultado esperado | CU |
|---|---|---|---|
| 6.1 | Login con contraseña incorrecta | Mensaje genérico, sin revelar si el usuario existe | CU-SEG-001 |
| 6.2 | Primer login del Director/AFT | Fuerza cambio de la contraseña temporal | CU-ADM-001 |
| 6.3 | Profesional de AFT intenta un endpoint de Nivel 2 (ej. `POST /admin/contratos`) por herramienta | CORE responde 403 aunque la UI no lo muestre (gate real, no de UI) | §12.35.2, DOC-023 |
| 6.4 | Operador de la APP QR intenta operaciones de administración | Denegado | Matriz Actor–Función |
| 6.5 | Revisar que ninguna fuente de captura escribió directo en Postgres | Todo pasó por `CIS → CORE`; sin conexiones directas a la BPI | §12.35.5 |
| 6.6 | Logout y reintento de acceso a una ruta protegida | Redirige a login | CU-SEG-001 |

---

## 4. Tabla de resultados (a completar en la corrida)

| Suite | Caso | Fecha | Resultado (OK / FALLA) | Evidencia / observación |
|---|---|---|---|---|
| QA-0 | 0.1 … 0.9 | | | |
| QA-1 | 1.1 … 1.6 | | | *(bloqueado hasta RF-B)* |
| QA-2 | 2.1 … 2.4 | | | *(bloqueado hasta RF-F)* |
| QA-3 | 3.1 … 3.9 × N direcciones | | | |
| QA-4 | 4.1 … 4.7 | | | |
| QA-5 | 5.1 … 5.8 | | | |
| QA-6 | 6.1 … 6.6 | | | |

Evidencia a conservar (§12.35.4): capturas del Resumen antes/después, informe de cada sesión,
export de la tabla `auditoria` del período de QA, y este documento completado.

---

## 5. Qué construir para desbloquear la QA completa (orden)

Del `§Plan de fases` de [DOC-029](../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md):

1. **RF-G** ✅ hecho (crash + layout).
2. **RF-A** ✅ hecho (Nivel 1, sin Contratos/Inventarios).
3. **RF-B** — ETL Python + staging en CORE (✅ capa CORE) + revisión en el CCP → **desbloquea QA-1**
   y da datos reales para QA-3..QA-5.
4. **RF-F** — módulo QR/Etiquetas → **desbloquea QA-2**.
5. **RF-I** — Pantalla 8 completa (agregación + presentación, ver [`CONTRATO-PANTALLA-8.md`](CONTRATO-PANTALLA-8.md))
   → completa QA-3.10 y QA-4.2.
6. **RF-D** — veredicto accionable + automatización D.3 → completa QA-5.5.
7. **RF-E** — auditoría por área + "Revisar" → refuerza QA-4.6.
8. **RF-H** — APK Android → reemplaza la PWA en QA-0.9 / QA-3.
9. **RF-C** — 3 pestañas del Resumen (cuando llegue el spec de Guido).

Mientras RF-B/RF-F no estén, **QA-3 a QA-6 se pueden correr hoy** con una carga manual acotada
(fallback de QA-1) — sirve para validar la V1.0 del flujo de auditoría antes de invertir en RF-B.

---

## 6. Salida de esta QA

- **Aprobada** si QA-0, QA-3, QA-4, QA-5, QA-6 pasan y QA-1/QA-2 pasan tras construir RF-B/RF-F.
- **Aprobada con reservas** si el flujo de auditoría (QA-3..QA-5) pasa pero queda pendiente la
  carga de Excel (RF-B) — el cliente podría arrancar con carga manual acotada.
- **Bloqueada** si falla cualquier caso de QA-6 (seguridad) o la integridad de la BPI (§12.35.5).
