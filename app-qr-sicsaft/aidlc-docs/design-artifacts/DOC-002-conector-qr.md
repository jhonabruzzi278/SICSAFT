# DOC-002: Contrato del Conector QR

Evidencia de la tarjeta DOC-002 del tablero [SICSAFT](https://trello.com/b/nCi6W4oB/sicsaft). Define cómo APP QR SICSAFT habla con el resto del ecosistema, según el diagrama acordado:

```mermaid
flowchart LR
    App["APP QR SICSAFT"] --> Connector["Conector QR"]
    Connector --> CIS["CIS"]
    CIS --> Core["SICSAFT CORE"]
    Core --> Rules["Reglas patrimoniales"]
    Rules --> Database["Base Patrimonial Central"]
```

> **Estado del contrato**: implementado real de punta a punta desde TASK-007 — `cis/src/qr-connector/` sirve exactamente estas 4 rutas (formalizadas del lado de CORE en `core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md`) y `app-qr-sicsaft/src/lib/qr-connector.ts` (`HttpQrConnectorClient`) las consume real. Los puntos que decían **⚠️ Pendiente de confirmar con el equipo de SICSAFT CORE** ya tienen respuesta — se anota la resolución real en cada uno en vez de borrar la pregunta original, para que quede el registro de qué se asumió en el diseño vs. qué resultó ser cierto.

## 1. Alcance del Conector QR

El Conector QR es la **única** vía por la que APP QR SICSAFT toca datos que no son locales al dispositivo. La app nunca escribe directo a la Base Patrimonial Central (ver [ADR-003](./ADR/ADR-003-rename-app-qr-sicsaft.md) y TASK-006). Responsabilidades del conector:

- Autenticar al operador/dispositivo ante CIS.
- Enviar sesiones de inventario cerradas (no escaneos sueltos) hacia CORE.
- Traer el catálogo de activos esperados por organización/área/ubicación (para poder validar activos offline durante el escaneo).
- Reintentar envíos fallidos sin duplicar datos en CORE.
- Producir un identificador de correlación por cada operación, para trazabilidad de punta a punta.

Fuera de alcance del conector: aplicar Reglas patrimoniales (eso vive en CORE) y escribir directo en la Base Patrimonial Central (eso vive en CORE + Reglas).

## 2. Operaciones (contrato de mensajes)

Propuesta REST/HTTPS sobre JSON, una operación por caso de uso del flujo oficial:

| Operación | Método | Cuándo se usa | Request (resumen) | Response (resumen) |
|---|---|---|---|---|
| `POST /auth/session` | POST | Al identificar operador (pantalla 1) | `{ operadorId, credencial, deviceId }` | `{ accessToken, expiresAt, organizaciones[] }` |
| `GET /catalogo?organizacionId&areaId&ubicacionId` | GET | Al iniciar inventario (pantalla 5), para poblar el catálogo local de activos esperados | — | `{ activos: [{ codigoQr, nombre, organizacionId, areaId, ubicacionId, estado }] }` |
| `POST /inventarios` | POST | Al finalizar inventario y confirmar envío (pantallas 10–11) | `{ correlationId, idempotencyKey, operadorId, organizacionId, areaId, ubicacionId, fechaInicio, fechaCierre, escaneos: [...], incidencias: [...] }` | `{ inventarioId, estado: "recibido"\|"rechazado", errores?[] }` |
| `GET /inventarios/{inventarioId}/estado` | GET | Para refrescar el estado de sincronización (pantalla 12) si el envío quedó en cola | — | `{ estado: "pendiente"\|"recibido"\|"rechazado", ultimoIntento }` |

`escaneos[]` transporta la clasificación completa definida en DOC-001 (correcto, otra área, otra ubicación, no registrado, inválido, duplicado, ya escaneado, con incidencia), no solo found/missing — así CORE puede aplicar Reglas patrimoniales con el mismo detalle que vio el operador.

✅ **Resuelto (TASK-007)**: CIS expone estas rutas tal cual — sin cambios de nombre de campo ni versión de API. Única corrección real sobre lo propuesto: `POST /auth/session` ya no recibe `operadorId`/`credencial` en el body (ver sección 3, ADR-002 del lado de CIS) — la identidad viene del access token, no de un campo del payload.

## 3. Autenticación

- El operador se autentica una vez por sesión de trabajo (pantalla 1) contra `POST /auth/session`; el token resultante se usa en todas las llamadas posteriores (`Authorization: Bearer <accessToken>`).
- Vencimiento corto (`expiresAt`) + refresh explícito con refresh token si el operador sigue trabajando; si el token vence en medio de una sesión offline, el envío se reintenta re-autenticando primero (ver sección 4).

✅ **Resuelto (TASK-007)**: mecanismo real es OIDC (Zitadel) — authorization code + PKCE, app tipo User Agent/SPA sin secreto de cliente (ver ADR-002 del lado de CIS y `devops/local/README.md` "Cliente OIDC real"). Implementado en `app-qr-sicsaft/src/lib/oidc/`.

**Decisión sobre dónde persistir el token** (no estaba resuelta en el diseño original, que solo decía "memoria/IndexedDB local, nunca `localStorage` sin cifrar" sin considerar `sessionStorage`): se usa `sessionStorage` — se pierde al cerrar la pestaña/PWA, el operador re-autentica cada turno en vez de dejar un token vivo indefinidamente en el dispositivo. Decisión confirmada explícitamente con el usuario, ver `app-qr-sicsaft/src/lib/oidc/token-store.ts`.

## 4. Reintentos e idempotencia

- **Idempotency key**: cada envío de `POST /inventarios` lleva un `idempotencyKey` generado localmente al cerrar el inventario (ej. UUID v4 derivado del `inventarioId` local). CORE debe tratar reintentos con la misma key como el mismo envío (devolver el resultado ya procesado, no duplicar el inventario).
- **Reintentos**: backoff exponencial (ej. 5s, 15s, 45s, luego cada 5 min) gestionado por la cola sin conexión (TASK-008), no por el usuario reintentando manualmente.
- **Qué se reintenta**: solo el envío completo de la sesión (`POST /inventarios`). Nunca se reintenta parcialmente (no se reenvían escaneos sueltos) — la unidad atómica es la sesión de inventario completa.
- **Qué NO se reintenta indefinidamente**: errores de validación (`400`, catálogo/organización inexistente) no se reintentan automáticamente — se muestran al operador como "rechazado" con el detalle de `errores[]`, porque un reintento no va a cambiar el resultado.
- **Corte**: si tras N reintentos (a definir, ej. 10) sigue sin poder enviarse por error de red, el inventario queda visible como "pendiente" indefinidamente en la pantalla de estado de sincronización (pantalla 12) hasta que el operador o el sistema recuperen conexión — nunca se descarta silenciosamente.

## 5. Manejo de errores

| Código | Significado | Comportamiento esperado en la app |
|---|---|---|
| `401` | Token vencido/ inválido | ✅ Implementado, distinto al texto original: en vez de reaccionar a un 401 de CIS, cada llamada renueva el token *antes* de mandarla si hace falta (`oidcClient.getValidAccessToken()`, refresh token explícito); si igual llega un 401 residual, cae en la misma cola de reintentos de la sección 4 en vez de un retry inmediato — el próximo intento ya vuelve a chequear el token. Si el refresh falla (`AuthenticationRequiredError`), la sesión se limpia y el operador vuelve a la pantalla de login |
| `400` | Payload inválido (ej. escaneo con organización inexistente) | ✅ Implementado — `RejectedInventarioError`, marca el inventario `syncStatus: 'rejected'`, no reintenta (`sync-queue.ts`) |
| `409` | Conflicto (ej. `idempotencyKey` ya usada con payload distinto) | ✅ Implementado — mismo camino que 400 (`RejectedInventarioError`) |
| `5xx` / timeout / sin red | Error transitorio | ✅ Implementado — encola localmente y aplica la política de reintentos de la sección 4, sin cambios |

## 6. Trazabilidad

- Todo envío lleva un `correlationId` generado en el dispositivo al **iniciar** el inventario (no al enviarlo), para poder correlacionar desde el primer escaneo hasta la confirmación de CORE aunque el envío tarde horas en salir de la cola offline.
- El `correlationId` se guarda en el registro de auditoría local (TASK-009: operador, fecha/hora, dispositivo, inventario, código leído, resultado, ubicación, incidencia, estado de sincronización) junto a cada operación relacionada.

✅ **Resuelto (TASK-007)**: CORE sí tiene su propio esquema — un header transversal
`X-Correlation-Id` (WAF 2, `CorrelationIdMiddleware` en CIS y CORE), independiente del
`correlationId` de negocio de este contrato. Conviven, no se reemplazan: el header traza la
request HTTP en logs/tracing de infraestructura; el `correlationId` del payload sigue siendo el
identificador de negocio del inventario en la auditoría local. **Corrección real sobre lo
propuesto**: CORE **no** devuelve el `correlationId` de negocio en el body de la respuesta de
`POST /inventarios` (`PostInventarioResponse` es `{inventarioId, estado, errores?}`, ver DOC-006
3) — solo el header `X-Correlation-Id` viaja de vuelta. El punto anterior de esta sección ("CORE
debe devolver el mismo correlationId... en toda respuesta") no se cumplió tal cual estaba escrito.

## Dependencias hacia el resto del backlog
- **TASK-006** (separar frontend del acceso directo a datos) implementa el cliente de este contrato en lugar de las llamadas directas a IndexedDB.
- **TASK-007** (sincronización con CORE) implementa `POST /inventarios` y el manejo de errores de la sección 5.
- **TASK-008** (cola sin conexión) implementa la política de reintentos de la sección 4.
- **TASK-009** (registro de eventos y auditoría) usa el `correlationId` de la sección 6.
