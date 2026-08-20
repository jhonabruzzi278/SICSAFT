# DOC-001: Flujo oficial de captura (APP QR SICSAFT)

Evidencia de la tarjeta DOC-001 del tablero [SICSAFT](https://trello.com/b/nCi6W4oB/sicsaft). Define el flujo de referencia contra el que se mide la cobertura funcional actual (ver [AUDIT-SICSAFT-FLOW.md](./AUDIT-SICSAFT-FLOW.md)) y contra el que deben construirse TASK-004 a TASK-010.

## 1. Diagrama del flujo

```mermaid
flowchart TD
    A[Identificar operador] --> B[Seleccionar organización]
    B --> C[Seleccionar área y ubicación]
    C --> D[Iniciar inventario]
    D --> E[Escanear código QR]
    E --> F{Clasificar resultado}
    F -->|8 categorías, ver sección 3| G[Mostrar resultado + acción disponible]
    G -->|repetir| E
    G -->|registrar incidencia| H[Registrar incidencia]
    H --> E
    G -->|finalizar| I[Finalizar inventario]
    I --> J[Resumen del inventario]
    J --> K[Confirmar y enviar a SICSAFT CORE]
    K --> L{¿Hay conexión?}
    L -->|sí| M[Enviado — estado sincronizado]
    L -->|no| N[En cola local — pendiente de sincronizar]
    N -.reintento automático.-> K
```

Cada inventario es una **sesión** (operador + organización + área + ubicación + fecha de inicio/cierre + activos esperados/encontrados/faltantes/externos + incidencias + estado de sincronización) — no escaneos sueltos. El detalle de implementación de la sesión es responsabilidad de TASK-004; este documento solo fija el flujo y las pantallas que la sesión debe soportar.

## 2. Pantallas mínimas

| # | Pantalla | Estado en el código actual |
|---|---|---|
| 1 | Inicio de sesión | ❌ No existe — a crear |
| 2 | Selección de organización | ❌ No existe — a crear |
| 3 | Selección de área y ubicación | ❌ No existe — a crear |
| 4 | Lista de inventarios | ⚠️ Existe una lista de sesiones pasadas (`src/pages/HistoryPage.tsx`) pero sin organización/área/ubicación ni estado de sincronización — a adaptar |
| 5 | Creación o inicio de inventario | ⚠️ Existe `startScanning()` en `src/pages/ScanPage.tsx` pero sin los metadatos de sesión (operador/organización/área/ubicación) — a adaptar |
| 6 | Escáner QR | ✅ Existe — `src/components/QrScanner.tsx` |
| 7 | Resultado del escaneo | ⚠️ Existe una clasificación binaria found/not-found — a normalizar a las 8 categorías (sección 3) |
| 8 | Ficha resumida del activo | ⚠️ Existe implícita en `resolveScannedProduct` (nombre del producto) pero no como pantalla propia — a crear |
| 9 | Registro de incidencia | ❌ No existe — a crear |
| 10 | Resumen del inventario | ⚠️ Existe una vista de reporte (`view === 'report'` en `ScanPage.tsx`: total/found/missing + export CSV) — a adaptar para incluir incidencias y activos externos |
| 11 | Confirmación y envío | ❌ No existe (hoy termina en export CSV local, no hay envío a un backend) — a crear junto con el Conector QR (DOC-002) |
| 12 | Estado de sincronización | ❌ No existe — a crear (depende de TASK-008, cola sin conexión) |

## 3. Clasificación de resultados del escaneo

Cada lectura de QR debe resolverse en una de estas categorías. La app debe mostrar claramente qué ocurrió y qué acción puede tomar el operador — nunca solo "encontrado/no encontrado".

| Categoría | Qué significa | Acción disponible para el operador |
|---|---|---|
| Activo correcto | El código pertenece a un activo esperado en esta organización/área/ubicación | Queda marcado como encontrado; continuar escaneando |
| Activo de otra área | El activo existe pero está registrado en otra área de la misma organización | Ver a qué área pertenece; opción de reportarlo como "fuera de lugar" o continuar |
| Activo de otra ubicación | El activo existe pero está registrado en otra ubicación | Igual que arriba, a nivel ubicación |
| Activo no registrado | El código no corresponde a ningún activo conocido en la Base Patrimonial Central | Opción de registrar como hallazgo / activo externo, o descartar |
| Código QR inválido | El código leído no tiene el formato esperado (no es un QR de activo) | Mensaje de error claro; reintentar escaneo |
| Activo duplicado | El mismo código físico aparece registrado más de una vez en la base | Alertar; requiere resolución manual fuera del flujo de escaneo (no la resuelve el operador en campo) |
| Activo ya escaneado | El código ya fue leído en esta misma sesión de inventario | Aviso de "ya contado"; no se duplica en el conteo |
| Activo con incidencia | El activo se identifica correctamente pero el operador necesita dejar una nota (daño, faltante de accesorio, mal estado, etc.) | Abre el formulario de registro de incidencia (pantalla 9) |

## 4. Envío de resultados

Al finalizar el inventario (pantalla 10 → 11), la sesión completa se envía a SICSAFT CORE a través del **Conector QR** (contrato a definir en DOC-002). Si no hay conexión, la sesión queda en cola local (pantalla 12, implementación en TASK-008) y se reintenta automáticamente sin perder los datos ya escaneados.

## Dependencias hacia el resto del backlog
- **TASK-004** (sesiones de inventario) implementa el modelo de datos detrás de las pantallas 1–5.
- **TASK-005** (normalizar resultados) implementa la tabla de la sección 3.
- **DOC-002** (contrato del Conector QR) define cómo se envían los resultados de la sección 4 — bloqueante para las pantallas 11–12 y para TASK-006/007/008.
