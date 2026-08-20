# DOC-014 — CIP: primer dashboard (Fase 6)

> Número reservado desde Fase 5 en `cip/README.md` "Documentos relacionados" ("Pendiente:
> DOC-014 CIP") y en `ROADMAP.md` Fase 6 "Done" — este documento lo cierra.

Contrato formal del primer incremento de CIP. No repite contenido ya definido en otros documentos
— referencia por sección.

## 1. Alcance
RF-01 a RF-10 de [`requirements/REQUIREMENTS.md`](../requirements/REQUIREMENTS.md). Fuera de
alcance: ver `requirements/INTENT.md` "Qué NO es esta fase".

## 2. Modelo de datos
[`design-artifacts/DOMAIN_MODEL.md`](DOMAIN_MODEL.md) — `eventos_outbox` (en `core`) + 7 tablas de
agregados + `SYNC_ESTADO` (en `cip`, base nueva y separada).

## 3. Arquitectura de ingesta y lectura
[`design-artifacts/ARCHITECTURE.md`](ARCHITECTURE.md) — outbox transaccional (trigger Postgres) →
dispatcher de CORE (polling) → Redis/BullMQ (`cip-eventos`) → worker de CIP → agregados → API de
lectura de CIP.

## 4. Autenticación y autorización
Mismo mecanismo que CIS↔CORE (`ServiceTokenGuard`, DOC-006 4): CIP se autentica ante CORE con
`CIP_SERVICE_TOKEN` (secreto compartido nuevo, mismo patrón que `CORE_SERVICE_TOKEN` — comparación
en tiempo constante) al llamar `GET /catalogo`/`GET /inventarios`/`GET /inventarios/:id`. CIP no
valida identidad de operador — es lectura agregada, no una acción atribuible a una persona
(distinto de `auditoria`, que si necesita ese detalle y ya lo cubre CORE, DOC-011).

Quién puede *leer* el dashboard de CIP (¿cualquier operador autenticado de la organización, o solo
Administrador Patrimonial?) queda **abierto** para el incremento de Construction que construya el
frontend — no bloquea el diseño de ingesta de este documento, que es interno (CORE→CIP). Ver 7
"Decisiones abiertas".

## 5. Esquema de la base `cip` (a nivel de diseño, sin migración todavía)
Un `core/migrations/`-equivalente propio en `cip/migrations/` (mismo mecanismo node-pg-migrate,
mismo criterio que Fase 0 del ROADMAP) — las 7 tablas de agregados + `sync_estado` de
`DOMAIN_MODEL.md` 2. Se escribe recién en Construction.

## 6. Contrato de la migración de outbox en CORE (a nivel de diseño)
Migración nueva en `core/migrations/` (no se edita una migración ya mergeada, mismo criterio que
todas las anteriores): crea `eventos_outbox` + el trigger `AFTER INSERT ON eventos`. El filtro de
"qué tipo de evento importa" (`DOMAIN_MODEL.md`/`ARCHITECTURE.md` 3) vive en la condición del
trigger, versionado en la misma migración — cambiar qué se publica es una migración nueva, no un
`UPDATE` manual.

## 7. Decisiones abiertas (a resolver al pasar a Construction, no bloquean este diseño)
1. ~~**Quién puede leer el dashboard**~~ — **resuelto** en
   [`aidlc-docs/ccp/design-artifacts/DOC-019-dashboard-cip-frontend.md`](../../../aidlc-docs/ccp/design-artifacts/DOC-019-dashboard-cip-frontend.md)
   2: cualquier operador con contrato vigente en la organización, sin rol adicional.
2. ~~**Cómo llega el frontend de CIP al usuario**~~ — **resuelto** en DOC-019 1: sección nueva
   dentro de WEB (séptimo módulo del hub), no una app propia. WEB nunca le habla a CIP
   directamente — pasa por CIS (DOC-019 3), mismo trust boundary que el resto de WEB.
3. **Umbral de "atrasado"** de `SYNC_ESTADO.alDia` (`ARCHITECTURE.md` 7, default propuesto 15 min)
   — valor a confirmar con datos reales de carga, no una decisión de diseño bloqueante.

## 8. Reconciliación con Tomo IV 2.15/2.19 — publicación al CIP: síncrona en el texto, asíncrona en el diseño

Tomo IV Cap. 2 (2.15 "Flujo General de una Transacción" y 2.19 "Modelo Operacional") describe la
secuencia de toda transacción del CORE terminando en `... → Motor de Alertas (si aplica) → CIP →
Respuesta al Usuario` — el texto ubica la publicación al CIP **antes** de responder al usuario,
dentro de la misma secuencia que ya cita `core/README.md` "Flujo/ciclo de vida de una
transacción". Leído literalmente, sugiere una llamada síncrona al CIP dentro del camino de
request/response.

Esto choca con `ARQUITECTURA-WAF.md` 5, que dice explícitamente: *"Procesamiento asíncrono para
todo lo que no bloquea al usuario: [...] recálculo de indicadores del CIP [...] — nunca en el
camino síncrono de una transacción patrimonial"* — y con el diseño de este mismo documento
(`ARCHITECTURE.md`), que decidió el patrón de outbox precisamente para sacar la publicación al CIP
del camino síncrono.

**Reconciliación adoptada**: el estado `Publicada` del ciclo de vida de la transacción (2.16) se
satisface con la escritura atómica de la fila en `eventos_outbox` (misma transacción que
`eventos`, ver `DOMAIN_MODEL.md` 1) **antes** de responder al usuario — la garantía de que la
publicación va a ocurrir queda persistida y confirmada de forma síncrona, aunque el envío de red
real a Redis/CIP ocurra después, de forma asíncrona. Esto cumple la secuencia del tomo en su
intención (ninguna transacción se da por "Publicada" sin que la publicación esté garantizada) sin
pagar el costo de resiliencia/latencia de esperar una respuesta real del CIP dentro del request
del usuario, que WAF 5 prohíbe explícitamente y que además contradice WAF 8 (CIP debe "escalar
independiente del CORE" — un CORE que bloquea su respuesta esperando al CIP acopla su
disponibilidad a la de CIP, exactamente lo que esa fila de la tabla busca evitar).

**Queda como decisión abierta a confirmar con el usuario** (no autónoma de este diseño): si esta
lectura es aceptable, o si el negocio requiere que la respuesta al usuario efectivamente espere
confirmación de que el CIP ya recibió el dato (lo cual exigiría rediseñar `ARCHITECTURE.md` sin el
outbox, o agregar un mecanismo de espera acotada). Mismo criterio que la Fase 3.1 aplicó al
conflicto de "baja" en DOC-017: se documenta la discrepancia en vez de resolverla en silencio
editando la cita del tomo.

## 9. Documentos relacionados
`base-patrimonial/DOC-005-modelo-patrimonial.md` (entidades fuente), `aidlc-docs/core/design-artifacts/DOC-010-motor-eventos.md`
(si existe — Motor de Eventos, fuente de los eventos que dispara este outbox),
`aidlc-docs/app-qr-sicsaft/design-artifacts/DOC-017-fase-3.1-brechas-flujo.md` (origen del
veredicto de sesión y de los estados `mantenimiento`/`inactivo` que este dashboard muestra),
`ARQUITECTURA-WAF.md` 5/8/9.
