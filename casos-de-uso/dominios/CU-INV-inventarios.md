# CU-INV — Inventarios

Dominio §12.14–§12.17. Reglas INV-001…INV-006 (tomo). Componentes: APP QR (`app-qr-sicsaft/`),
`cis/`, `core/` (Motor de Reglas + Motor Patrimonial + Auditoría), `cip/` (veredicto + dashboard),
`ccp/` (Resumen — el listado de sesiones se retiró del CCP, ver RF-A).

Concepto de "veredicto de sesión" (`exitoso` / `aceptable` / `defectuoso`) = **DOC-017 §2**;
implementación pura en `app-qr-sicsaft/src/lib/verdict.ts` y `cip/src/agregacion/veredicto.ts`.
"Excelente" del negocio = `exitoso`.

---

## CU-INV-001 — Crear Inventario

| Campo | Detalle |
|---|---|
| **Código** | CU-INV-001 |
| **Nombre** | Crear Inventario |
| **Objetivo** | Programar un proceso de control con alcance definido (§12.14). |
| **Actor principal** | Administrador Patrimonial / Supervisor. |
| **Actores secundarios** | CCP, CORE, Auditoría. |
| **Precondiciones** | Estructura (sede / área) cargada; responsables definidos; usuario autorizado. |
| **Disparador** | "Nuevo inventario". |
| **Entradas** | Alcance, sede, área, fecha, responsables, tecnología de captura (QR / RFID / Mixto). |
| **Flujo principal** | 1. Usuario define el alcance. 2. CORE valida la estructura. 3. Se crea el inventario en estado **Programado**. 4. Auditoría. 5. Confirmación. |
| **Reglas aplicables** | INV-001, INV-002. |
| **Flujos alternativos** | Inventario recurrente (mensual) → plantilla reutilizable. |
| **Excepciones** | Área inexistente → rechazo. Solapamiento con otro inventario abierto de la misma área → advertencia / bloqueo según regla. |
| **Postcondiciones** | Inventario en estado `Programado`, visible para los operadores asignados. |
| **Eventos generados** | Evento de creación de inventario → CIP. |
| **Auditoría** | `operacion` = creación de inventario, con alcance. |
| **Resultado esperado** | Inventario creado en estado Programado. |
| **Componentes** | CCP · CIS · CORE · CIP. |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟡 **Parcial**: hoy la sesión de relevamiento la abre el **operador desde la APP QR** eligiendo área/ubicación al momento — no hay un paso previo de "programar inventario" por el Administrador/Supervisor con estado `Programado`, ni selección de tecnología (solo QR; RFID es Nivel 3). El listado de inventarios que existía en el CCP se retiró en RF-A. Gap: si el cliente necesita programar inventarios desde el portal, no está en DOC-029 — anotarlo. |

---

## CU-INV-002 — Ejecutar Inventario QR

| Campo | Detalle |
|---|---|
| **Código** | CU-INV-002 |
| **Nombre** | Ejecutar Inventario QR |
| **Objetivo** | Capturar la existencia real de los activos de un alcance mediante escaneo (§12.15). |
| **Actor principal** | Operador de Inventario. |
| **Actores secundarios** | APP QR, CIS, CORE (Motor de Reglas), BPI, Auditoría. |
| **Precondiciones** | Inventario / sesión asignada; operador autenticado; área y ubicación elegidas. |
| **Disparador** | Inicio de la sesión de escaneo. |
| **Entradas** | Secuencia de `codigoQr` escaneados. |
| **Flujo principal** | 1. Inventario asignado. 2. Escanear QR. 3. Identificar activo. 4. Validar pertenencia al alcance. 5. Verificar duplicidad en la sesión. 6. Confirmar existencia. 7. Registrar resultado del ítem. 8. Actualizar el avance. 9. Auditoría al cerrar. |
| **Reglas aplicables** | INV-002…INV-005; árbol de clasificación de escaneo (`clasificar-escaneo.ts`): `invalido`, `ya_escaneado`, `duplicado`, `no_registrado`, `otra_area`, `otra_ubicacion`, `con_incidencia`, `correcto`. |
| **Flujos alternativos** | Escaneo offline → se encola y se sincroniza al recuperar red. Ítem con incidencia → **CU-INC-001**. |
| **Excepciones** | Activo ya inventariado en esta sesión → mensaje *"El activo ya se encuentra registrado en este inventario"*, **no** se contabiliza dos veces. QR inválido / no registrado → se marca como tal, no frena la sesión. |
| **Postcondiciones** | Cada ítem del alcance queda con un resultado; el avance refleja lo capturado. |
| **Eventos generados** | Evento por sesión (no por ítem) al cerrar → CIP. |
| **Auditoría** | `POST /inventarios` registra la sesión + sus resultados. |
| **Resultado esperado** | Captura completa y sin doble conteo del alcance. |
| **Componentes** | APP QR · CIS · CORE (Reglas) · BPI · CIP. |
| **Prioridad** | Crítica. |
| **Estado en el repo** | 🟢 **Implementado**: `app-qr-sicsaft/src/pages/ScanPage.tsx` + `clasificar-escaneo.ts` (mismo árbol en CORE, `core/src/reglas/`). La rama `duplicado` solo la resuelve CORE contra la BPI real. |

---

## CU-INV-003 — Conciliar Inventario

| Campo | Detalle |
|---|---|
| **Código** | CU-INV-003 |
| **Nombre** | Conciliar Inventario |
| **Objetivo** | Comparar patrimonio **esperado** vs. **detectado** y clasificar las diferencias (§12.16). |
| **Actor principal** | Supervisor Patrimonial. |
| **Actores secundarios** | CORE, CIP, Auditoría. |
| **Precondiciones** | Captura finalizada. |
| **Disparador** | Acción "Conciliar" / cierre de la captura. |
| **Entradas** | Alcance del inventario + resultados de captura. |
| **Flujo principal** | 1. CORE cruza esperado vs. detectado. 2. Clasifica cada ítem: **localizado**, **no localizado**, **sobrante**, **discrepancia de ubicación**, **discrepancia de responsable**, **incidencia**. 3. El resultado queda registrado para el cierre. |
| **Reglas aplicables** | INV-004, INV-006. |
| **Flujos alternativos** | Reconteo parcial de una zona antes de conciliar. |
| **Excepciones** | Alcance vacío → nada que conciliar. |
| **Postcondiciones** | Resultado de conciliación persistido, asociado al inventario. |
| **Eventos generados** | Evento de conciliación → CIP. |
| **Auditoría** | Registro de la conciliación con sus totales. |
| **Resultado esperado** | Clasificación completa de diferencias, lista para el cierre. |
| **Componentes** | CORE · CIP · CCP (visualización en el Resumen). |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟡 **Parcial**: el veredicto de sesión (`exitoso`/`aceptable`/`defectuoso`, `verdict.ts` / `cip/`) y las tarjetas del Resumen ("Activos fuera de área", "Activos no localizados", "Incidencias") cubren **no localizado / discrepancia de ubicación / incidencia**. Falta una vista de conciliación dedicada del Supervisor con las **6 categorías completas** (incluye "sobrante" y "discrepancia de responsable") y un resultado de conciliación persistido como tal. |

---

## CU-INV-004 — Cerrar Inventario

| Campo | Detalle |
|---|---|
| **Código** | CU-INV-004 |
| **Nombre** | Cerrar Inventario |
| **Objetivo** | Consolidar el inventario y dejarlo inmutable (§12.17). |
| **Actor principal** | Administrador Patrimonial / Supervisor autorizado. |
| **Actores secundarios** | CORE, CIP, Auditoría. |
| **Precondiciones** | Captura finalizada; conciliación realizada; incidencias clasificadas; usuario autorizado. |
| **Disparador** | Acción "Cerrar inventario". |
| **Entradas** | `inventarioId`. |
| **Flujo principal** | 1. CORE valida las precondiciones. 2. Se calcula el veredicto de sesión. 3. Se genera el informe final + indicadores. 4. Auditoría. 5. Historial. 6. El inventario pasa a **Cerrado**. |
| **Reglas aplicables** | INV-006. |
| **Flujos alternativos** | Reapertura → **solo** por operación extraordinaria autorizada, nunca ordinaria. |
| **Excepciones** | Precondición faltante (incidencias sin clasificar) → cierre bloqueado con el detalle. |
| **Postcondiciones** | Inventario `Cerrado`, **no modificable por operación ordinaria**; informe, indicadores, auditoría e historial generados. |
| **Eventos generados** | Evento de cierre + veredicto → CIP. Si el veredicto es `defectuoso` → **RF-D §D.3**: CORE registra automáticamente **una entrada de auditoría** (`sesiones/{id}/veredicto-defectuoso`). |
| **Auditoría** | Registro de cierre con el veredicto y los totales. |
| **Resultado esperado** | Inventario cerrado, informe final disponible en el Resumen. |
| **Componentes** | APP QR (dispara el cierre) · CIS · CORE · CIP · CCP. |
| **Prioridad** | Crítica. |
| **Contrato del informe** | El contenido exacto del informe de cierre por área es la **"Pantalla 8"** — ver [`CONTRATO-PANTALLA-8.md`](../CONTRATO-PANTALLA-8.md): encabezado, escaneados, del-área (n y %), estado declarado por AFT, lista con tipo ordinario/extraordinario, fuera-de-área con su área real, y el veredicto con fondo de color. |
| **Estado en el repo** | 🟡 **Parcial**: la sesión se cierra desde la APP QR → `POST /inventarios` persiste sesión + incidencias (y ya acepta `estadoDeclarado`/`bajaSugerida` por escaneo, Fase 3.1), y el Resumen muestra el veredicto por sesión. Falta el resto de la Pantalla 8 (%, desglose por estado, tipo, colores) = **RF-I** de DOC-029, más la automatización de auditoría en `defectuoso` (**RF-D §D.3**) y un informe PDF formal (§12.30). Inmutabilidad post-cierre: verificar en la QA. |
