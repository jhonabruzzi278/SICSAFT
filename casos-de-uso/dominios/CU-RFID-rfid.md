# CU-RFID — RFID

Dominio §12.18–§12.20. Reglas RFID-001…RFID-006 (tomo). Componentes previstos: etiquetas → antenas
→ lectores → middleware RFID → conector SICSAFT → `cis/` → `core/` (MOP + Motor de Reglas + Motor
de Alertas) → BPI → CIP.

> **Estado global del dominio: 🔲 NO INICIADO.** RFID es **Nivel 3** ([DOC-025](../../aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md)):
> no hay carpeta `rfid/`, ni conector, ni servicio en ningún `docker-compose.yml`, ni código que
> empaquetar (`ROADMAP.md`). Los tres CU de abajo quedan documentados para el diseño futuro; **no
> entran en la QA del cliente Nivel 1**. Todos seguirán el mismo patrón arquitectónico:
> `Tecnología → Conector → CIS → MOP → CORE → BPI/CIP` (§12.34).

---

## CU-RFID-001 — Registrar Evento RFID

| Campo | Detalle |
|---|---|
| **Código** | CU-RFID-001 |
| **Nombre** | Registrar Evento RFID |
| **Objetivo** | Transformar una lectura física de etiqueta en un evento patrimonial interpretado (§12.18). |
| **Actor principal** | **Subsistema RFID** (actor no humano). |
| **Actores secundarios** | Middleware RFID, Conector SICSAFT, CIS, MOP, Motor de Reglas, BPI, CIP. |
| **Precondiciones** | Etiqueta asociada a un activo; lector/antena operativos; conector autenticado (service token). |
| **Disparador** | Detección de una etiqueta RFID por una antena. |
| **Entradas** | ID de etiqueta, lector, antena, zona, timestamp. |
| **Flujo principal** | Etiqueta → Antena → Lector → Middleware RFID → Conector SICSAFT → CIS → MOP → Motor de Reglas → BPI → Evento / Historial → CIP. |
| **Reglas aplicables** | RFID-001…RFID-003; reglas de zona y movimiento. |
| **Flujos alternativos** | Lecturas repetidas de la misma etiqueta en ventana corta → deduplicación en el middleware/conector. |
| **Excepciones** | Etiqueta no asociada → evento "activo no identificado". Lector caído → **CU-RFID-003** (evento técnico, separado del patrimonial). |
| **Postcondiciones** | Evento patrimonial persistido; historial actualizado. |
| **Eventos generados** | Evento RFID interpretado → CIP. |
| **Auditoría** | Registro del evento con origen `rfid` y `operadorId` del conector. |
| **Resultado esperado** | La lectura física queda como evento patrimonial trazable. |
| **Componentes** | Subsistema RFID · Conector · CIS · CORE · BPI · CIP. |
| **Prioridad** | Alta (Nivel 3). |
| **Estado en el repo** | 🔲 **No iniciado** (Nivel 3). |

---

## CU-RFID-002 — Detectar Movimiento No Autorizado

| Campo | Detalle |
|---|---|
| **Código** | CU-RFID-002 |
| **Nombre** | Detectar Movimiento No Autorizado |
| **Objetivo** | Generar una alerta patrimonial automática ante un movimiento que viola las reglas de zona (§12.19). |
| **Actor principal** | Subsistema RFID. |
| **Actores secundarios** | Motor de Reglas, Motor de Alertas, CIP, CCP. |
| **Precondiciones** | Reglas de zona/movimiento definidas; activo con etiqueta. |
| **Disparador** | Evento RFID incompatible con las reglas autorizadas. |
| **Entradas** | Evento RFID (activo, zona origen/destino, hora). |
| **Flujo principal** | Lectura RFID → Identificación del activo → Identificación de zona → Motor de Reglas → "movimiento no autorizado" → Motor de Alertas → Registro → CIP / CCP → Notificación. |
| **Reglas aplicables** | RFID-004…RFID-006; reglas de perímetro y horario. |
| **Flujos alternativos** | Movimiento autorizado con permiso temporal → no genera alerta. |
| **Excepciones** | Falsa lectura (rebote de señal) → filtro del middleware antes de la regla. |
| **Postcondiciones** | Alerta patrimonial registrada y notificada. |
| **Eventos generados** | Alerta → CIP + CCP. |
| **Auditoría** | Registro de la alerta con la regla violada. |
| **Resultado esperado** | Alerta generada automáticamente, sin intervención humana. |
| **Componentes** | Subsistema RFID · CORE (Reglas + Alertas) · CIP · CCP. |
| **Prioridad** | Alta (Nivel 3). |
| **Estado en el repo** | 🔲 **No iniciado** (Nivel 3). El Motor de Alertas tampoco existe todavía. |

---

## CU-RFID-003 — Supervisar Estado de Infraestructura RFID

| Campo | Detalle |
|---|---|
| **Código** | CU-RFID-003 |
| **Nombre** | Supervisar Estado de Infraestructura RFID |
| **Objetivo** | Consultar la salud de lectores, antenas, zonas y conectividad (§12.20). |
| **Actor principal** | Supervisor / Administrador. |
| **Actores secundarios** | Middleware RFID, CCP. |
| **Precondiciones** | Infraestructura RFID desplegada y reportando. |
| **Disparador** | Apertura del panel de infraestructura RFID. |
| **Entradas** | — (consulta). |
| **Flujo principal** | 1. El panel consulta: lectores, antenas, zonas, conectividad, última comunicación, errores, disponibilidad. 2. Se muestra el estado. |
| **Reglas aplicables** | Umbrales de disponibilidad y latencia. |
| **Flujos alternativos** | Alertar por umbral (integración con el Motor de Alertas). |
| **Excepciones** | Componente sin reportar > umbral → **evento técnico independiente** de los eventos patrimoniales. |
| **Postcondiciones** | Sin cambios patrimoniales. |
| **Eventos generados** | Evento técnico ante falla. |
| **Auditoría** | Registro de la consulta si la política lo exige. |
| **Resultado esperado** | Visibilidad operativa de la infraestructura; una falla técnica **no** contamina los eventos patrimoniales. |
| **Componentes** | Middleware RFID · CCP. |
| **Prioridad** | Media (Nivel 3). |
| **Estado en el repo** | 🔲 **No iniciado** (Nivel 3). |
