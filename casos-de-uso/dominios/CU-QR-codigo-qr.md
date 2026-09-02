# CU-QR — Código QR

Dominio §12.12–§12.13. Reglas QR-001…QR-005 (tomo). Componentes: APP QR (`app-qr-sicsaft/`),
`cis/`, `core/` (Motor Patrimonial), BPI.

---

## CU-QR-001 — Asignar Código QR

| Campo | Detalle |
|---|---|
| **Código** | CU-QR-001 |
| **Nombre** | Asignar Código QR |
| **Objetivo** | Vincular una identidad QR única a un activo (§12.12). |
| **Actor principal** | Administrador Patrimonial (o el proceso de ingesta RF-B). |
| **Actores secundarios** | CCP, MOP, Motor Patrimonial, Auditoría. |
| **Precondiciones** | Activo existente o en creación; el `codigoQr` propuesto no está en uso. |
| **Disparador** | Alta de activo (CU-PAT-001) o acuñado por el ETL de RF-B. |
| **Entradas** | `activoId` (o alta en curso), `codigoQr`. |
| **Flujo principal** | 1. Activo. 2. Generación / lectura del QR. 3. CORE valida unicidad (`activos.codigo_qr UNIQUE`). 4. Asociación. 5. CORE. 6. BPI. 7. Evento. 8. Auditoría. |
| **Reglas aplicables** | QR-001, QR-002, QR-005. |
| **Flujos alternativos** | Re-asignación de QR (activo cuyo rótulo se dañó) → mismo flujo, con el QR anterior marcado como reemplazado en el historial. |
| **Excepciones** | `codigoQr` duplicado → rechazo (409). Formato inválido → rechazo (patrón `^[A-Z0-9]+(-[A-Z0-9]+)?$`). |
| **Postcondiciones** | Activo con `codigoQr` único y estable. |
| **Eventos generados** | Evento de asignación de identidad → CIP. |
| **Auditoría** | Incluida en la auditoría del alta / de la actualización. |
| **Resultado esperado** | Identidad QR asociada, escaneable desde la APP. |
| **Componentes** | CCP / ETL RF-B · CIS · CORE · BPI. |
| **Prioridad** | Crítica. |
| **Estado en el repo** | 🟢 **Implementado como parte del alta**: `codigoQr` es campo obligatorio de `CU-PAT-001` con `UNIQUE` en la BPI y validación de formato (`core/src/reglas/clasificar-escaneo.ts` usa el mismo patrón). **RF-F (DOC-029)** agrega el acuñado masivo por dirección + la impresión de etiquetas (QR + Code128). No hay un flujo "re-asignar QR" dedicado todavía. |

---

## CU-QR-002 — Consultar Activo mediante QR

| Campo | Detalle |
|---|---|
| **Código** | CU-QR-002 |
| **Nombre** | Consultar Activo mediante QR |
| **Objetivo** | Obtener la ficha de un activo escaneando su código (§12.13). |
| **Actor principal** | Operador de Inventario. |
| **Actores secundarios** | APP QR, PSD/CIS, SICSAFT CORE, BPI. |
| **Precondiciones** | Usuario autenticado en la APP; activo registrado con ese `codigoQr`. |
| **Disparador** | Escaneo del código con la cámara del teléfono. |
| **Entradas** | `codigoQr` leído. |
| **Flujo principal** | 1. APP SICSAFT. 2. Escaneo del QR. 3. Resolución local del formato (`scan-resolve.ts`). 4. PSD / CIS. 5. SICSAFT CORE. 6. Consulta a la BPI. 7. Respuesta acotada al perfil. 8. Ficha del activo en pantalla. |
| **Reglas aplicables** | QR-002; reglas de visibilidad por perfil. |
| **Flujos alternativos** | Sin conexión → mensaje "sin red"; el escaneo no se pierde si es parte de un relevamiento (se encola). |
| **Excepciones** | QR con formato inválido → "código inválido". QR no registrado → "activo no registrado". Activo de otra organización → tratado como no registrado (DOC-008). |
| **Postcondiciones** | Ninguna escritura sobre la BPI (CU consultivo). |
| **Eventos generados** | Registro de consulta si la política de seguridad lo exige. |
| **Auditoría** | Consulta registrada cuando aplica (perfiles sensibles). |
| **Resultado esperado** | El usuario ve **solo** la información autorizada para su perfil. |
| **Componentes** | APP QR · CIS · CORE · BPI. |
| **Prioridad** | Alta. |
| **Estado en el repo** | 🟢 **Implementado**: `app-qr-sicsaft/src/pages/ScanPage.tsx` + `src/lib/scan-resolve.ts` → CIS → CORE → BPI. La PWA la sirve el `.exe` por HTTPS en la LAN (DOC-028 Fase D). Registro de la consulta en `auditoria`: verificar cobertura por perfil en la QA. |
