# Integración y Carga Masiva (CU-INT) — Sincronización con ERP y Excel

> 📌 **Resumen Rápido (Lectura en 30s)**:
> - **¿Qué es?**: Carga masiva de activos fijos desde un archivo Excel (`.xls`/`.xlsx`) o sistema contable externo.
> - **¿Cómo funciona?**: El especialista deja el Excel en una carpeta vigilada → el sidecar Python (`etl-contable`) extrae y limpia los datos → CORE crea un lote preliminar → el Administrador Patrimonial revisa y **aprueba en pantalla** → los activos se insertan en la BPI sin duplicados.
> - **Actores**: Especialista Contable / ERP (origen) y Administrador Patrimonial (aprobador).
> - **Estado Real**: 🟡 **Código Completo**: ETL Python, staging en CORE, endpoints en CIS y watcher en `.exe` implementados; pendiente validación de ciclo completo con cliente.

Dominio §12.28. Componentes: fuente externa (ERP / especialista contable), `cis/` (PSD), `core/`
(MOP + Reglas de Integración), BPI. Diseño previo:
[DOC-016](../../aidlc-docs/integraciones/design-artifacts/DOC-016-conector-con-contabilidad.md).
Materialización con Excel + compuerta humana: **RF-B de
[DOC-029](../../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md)**.

---

## CU-INT-001 — Sincronizar con ERP

| Campo | Detalle |
|---|---|
| **Código** | CU-INT-001 |
| **Nombre** | Sincronizar con ERP (o base contable en Excel) |
| **Objetivo** | Incorporar una actualización masiva de datos patrimoniales desde una fuente externa autorizada (§12.28). |
| **Actor principal** | Sistema ERP / proceso programado (o el especialista contable que deja el Excel). |
| **Actores secundarios** | CIS, MOP, Reglas de Integración, CORE, **Administrador Patrimonial** (aprueba). |
| **Precondiciones** | Fuente autorizada; formato/mapeo conocido; organización de destino definida. |
| **Disparador** | Corrida programada (cron) o archivo nuevo en la carpeta vigilada. |
| **Entradas** | Archivo `.xls`/`.xlsx` (o payload ERP) con las columnas de la fuente + un mapeo por organización. |
| **Flujo principal** | 1. ERP / carpeta. 2. **PSD / CIS** recibe. 3. ETL: normaliza al modelo SICSAFT (encabezado, celdas combinadas, mapeo de columnas, acuñado de `codigoQr`). 4. Validación. 5. `POST /importaciones/contable/lote` → CORE crea el lote en estado **`pendiente_revision`** (NO toca la BPI). 6. El **Administrador Patrimonial revisa el dry-run** en el CCP (crear / actualizar / conflicto por fila). 7. **Aprobar** → CORE resuelve-o-crea área/responsable/catálogo por nombre e inserta los activos (idempotente por `codigoPatrimonial`, reglas de integración). 8. BPI. 9. Auditoría. 10. Respuesta. |
| **Reglas aplicables** | Reglas de integración del tomo; idempotencia por fila (DOC-012 §6). |
| **Flujos alternativos** | **Rechazar** el lote → nada toca la BPI. Carga manual puntual de un CSV → `ImportacionesPage` sin staging (el AFT es el humano que revisa en ese acto). |
| **Excepciones** | Archivo mal formado / columnas faltantes → lote no se crea, se reporta el detalle. Fila con `catalogoId`/`categoria` desconocida → marcada como `conflicto`, no bloquea el resto. CORE no disponible → reintento con backoff (circuit breaker de CIS). |
| **Postcondiciones** | Lote `aprobado` → activos en la BPI; o lote `rechazado` → sin efecto. En ambos casos, rastro en `auditoria` y en la bandeja de lotes. |
| **Eventos generados** | Eventos de alta/actualización por fila aprobada → CIP. |
| **Auditoría** | `POST /auditoria` con `operacion` = aprobación/rechazo del lote, `operadorId = ingesta-contable` para el ingreso e identidad humana real para la aprobación. |
| **Resultado esperado** | Datos externos incorporados **solo tras aprobación humana**; **el ERP nunca accede directo a la BPI** (§12.28, invariante de CLAUDE.md). |
| **Componentes** | Carpeta / ERP · CIS · CORE (MOP + Reglas) · BPI · CIP · CCP (revisión). |
| **Prioridad** | Crítica (para el cliente Nivel 1 es el camino de carga inicial). |
| **Estado en el repo** | 🟡 **Código Completo (RF-B de DOC-029)**: Construido y testeado en componentes: ETL Python en `herramientas/etl-contable/`, tablas de staging y resolve-or-create en `core/src/patrimonial/importacion-contable-lote.*`, endpoints en CIS (`/importaciones/contable/lote`), revisión de lotes en CCP, selector de carpeta IPC y watcher desatendido en `sicsaft-core`. Pendiente de prueba con Excel real en el cliente. |
