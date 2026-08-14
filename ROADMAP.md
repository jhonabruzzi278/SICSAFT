# Roadmap de implementación — partes faltantes del ecosistema SICSAFT

> Plan de fases para lo que falta construir, ordenado por dependencia real (verificada en
> código, no solo en READMEs) y no por documento. Complementa [README.md](README.md) (estado
> actual por sistema) y [ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md) (marco de cómo construir cada
> pieza). Generado a partir de una auditoría del código real de `cis/src/` y `core/src/`, no solo
> de la documentación — ver "Estado verificado" abajo.

## Estado verificado (código, no solo README)

Lo que **sí** existe hoy:
- `core/src/entitlements/` — único módulo de negocio de CORE: `GET /entitlements` sobre Postgres
  real (`contrato.repository.ts`), protegido por `ServiceTokenGuard`.
- `cis/src/` — `ZitadelAuthGuard` real, `CoreClientService` con validación Zod y manejo de 502, y
  `QrConnectorService` con **catálogo e inventarios todavía en memoria** (`Map` +
  `SEED_CATALOGO`/`SEED_ORGANIZACIONES`).
- `core/migrations/` (node-pg-migrate, ver Fase 0) — solo 4 tablas: `organizaciones`, `sedes`,
  `contratos`, `contrato_sedes`. Cero tablas patrimoniales.
- CI: solo `cis-ci.yml` y `core-ci.yml`.

Brechas confirmadas en código, no solo declaradas en docs:

1. **CORE no tiene ningún camino de escritura.** No hay `POST` de nada, ni tabla de activos. Los
   9 motores de `core/README.md` están en cero.
2. ~~La idempotencia vive en el lugar equivocado.~~ **Resuelto** (Fase 3): `hashRequest`/
   `inventariosPorIdempotencyKey` en memoria de CIS se eliminaron — la idempotencia vive en
   `sesiones_inventario` de CORE (Postgres real, no memoria de proceso) desde la Fase 2;
   `QrConnectorService` es un proxy delgado, ya no rompe con CIS multi-instancia.
3. ~~No hay herramienta de migraciones.~~ **Resuelto** (Fase 0): `core/migrations/`
   (node-pg-migrate), esquema versionado con `up`/`down` reales, probados contra Postgres real. El
   seed DUOC UC ya no está duplicado en dos lugares: la migración de seed importa
   `contrato.seed.ts` como fuente única, y `cis/src/qr-connector/qr-connector.seed.ts` se eliminó
   en la Fase 3 (CIS dejó de necesitarlo, ver ítem 2).
4. **`GET /entitlements` ignora la organización del operador**: devuelve lo mismo para cualquier
   `operadorId` (DOC-004 §7). No hay mapeo operador→organización de Zitadel.
5. ~~No existe ningún cliente OIDC real.~~ **Resuelto** (Fase 0): app OIDC creada en Zitadel,
   flujo authorization code + PKCE probado real de punta a punta (ver
   `devops/local/README.md` § "Cliente OIDC real"). Sigue faltando que `app-qr-sicsaft/` haga
   este flujo desde su propio código (TASK-006/007, Fase 3).
6. **DOC-006 (API CIS↔CORE) no existe**, y es literalmente lo que bloquea TASK-007 de APP QR.
7. **Administrador Patrimonial** y **CON-CONTABILIDAD**: sin rol, sin endpoint, sin conector — y
   son las dos únicas entradas que Tomo III §1.4 autoriza a poblar/modificar la Base Oficial. Hoy
   no hay *ninguna* forma legítima de meter un activo real al sistema.
8. WEB, CIP, RFID, Integraciones: carpetas placeholder. DevOps: producción sin arrancar.

## Principio de ordenamiento

El cuello de botella real no es la cantidad de sistemas, es que **la Base Patrimonial está vacía
y no hay forma de llenarla**. Todo lo demás (motores, WEB, CIP, TASK-007) depende de eso. Las
fases están ordenadas para que cada una entregue algo verificable de punta a punta, no para
completar documentos.

## Fase 0 — Fundaciones que hay que pagar antes de crecer el dominio

**Por qué primero**: agregar 10 dominios sobre un `init.sql` sin migraciones y con seeds
triplicados a mano multiplica la deuda por 10. Es la fase más barata y la que más riesgo saca.

**Qué se construye**
1. ✅ Herramienta de migraciones en `core/` (node-pg-migrate — dependencia productiva, corre sin
   devDependencies via `jiti`). `migrations/1755000000000_schema-contrato.ts` recrea el esquema
   anterior con `up`/`down` reales; `docker-compose.yml` corre un servicio `core-migrate` una vez
   antes de levantar `core`; `core-ci.yml` corre `npm run migrate:up` en vez de aplicar un `.sql`
   suelto. `devops/local/postgres/init/02-core.sh` ya solo crea la base/usuario vacíos.
2. ✅ Fuente única del seed de desarrollo: `migrations/1755000000001_seed-dev-fixture.ts` importa
   `SEED_CONTRATOS` de `contrato.seed.ts` en vez de retipear los datos en SQL. La copia de
   `cis/src/qr-connector/qr-connector.seed.ts` se eliminó en la Fase 3 al conectar CIS a CORE, no
   queda ninguna duplicación pendiente.
3. ✅ `correlationId` transversal (parcial): `CorrelationIdMiddleware` en CIS y CORE
   (`src/common/correlation-id/`) acepta/genera `X-Correlation-Id` en toda ruta y lo devuelve en
   la respuesta; `CoreClientService.getEntitlements` ya lo propaga como header al llamar a CORE.
   Falta la otra mitad de WAF §2 — **no hay logging estructurado todavía** (ni CIS ni CORE
   loggean nada hoy más allá del arranque de Nest): el `correlationId` está disponible en
   `req.correlationId` para cuando se agregue, pero no se emite a ningún log/trace todavía. Ver
   OPS-1 en el track OPS abajo.
4. ✅ Cliente OIDC real (parcial): app OIDC creada en Zitadel para `app-qr-sicsaft` (User Agent,
   PKCE, tipo de token JWT), flujo authorization code + PKCE probado real de punta a punta
   (login de usuario real → código → JWT real → `POST /auth/session` en CIS → `GET
   /entitlements` en CORE → Postgres real, HTTP 201). Detalle completo y pasos para reproducirlo
   en `devops/local/README.md` § "Cliente OIDC real". En el camino se encontró y corrigió un bug
   real de infraestructura (Zitadel multi-tenant por dominio rechazaba el JWKS pedido por el
   nombre de servicio interno de Docker — fix: alias de red en `traefik`, ver docker-compose.yml).
   **Lo que falta**: el cliente real *dentro* de `app-qr-sicsaft/` (hoy se probó con `curl`
   simulando el cliente) es TASK-006/007 de APP QR — deliberadamente fuera de alcance de la Fase
   0, ver Fase 3. El **mapeo operador→organización real** (`GET /entitlements` sigue devolviendo
   el mismo resultado sin importar qué operador pregunte, DOC-004 §7) tampoco es parte de este
   incremento — es un gap de datos en CORE, no de mecanismo OIDC, y queda para cuando exista más
   de una organización con datos reales.

**Sigue**: ADR-001, ADR-002, DOC-004 §7, `devops/local/README.md` § "Cliente OIDC real", WAF §2/§3.

**Done**: migración corre limpia en compose local y en ambos CI; `GET /entitlements` devuelve
resultados *distintos* para operadores de organizaciones distintas (test e2e); un login real de
navegador produce un token que CIS acepta sin tokens firmados a mano; README de `core/`,
`seguridad/` y `devops/local/` actualizados en el mismo commit.

## Fase 1 — DOC-005: modelo de dominio patrimonial mínimo viable ✅ completa

**Por qué acá**: es la dependencia dura de todo motor, de WEB, de CIP y del rol Administrador
Patrimonial.

**Qué se construyó**
- ✅ [DOC-005](base-patrimonial/DOC-005-modelo-patrimonial.md) en `base-patrimonial/`, mismo
  formato que DOC-004 (entidades, estados, invariantes, cómo lo consume CIS/CORE, qué NO
  resuelve), citando Tomo III §4.2–4.15.
- ✅ Alcance recortado a lo que el flujo QR necesita, no los 11 dominios completos: `Área`,
  `Ubicación` (reconciliando `Sede` con la jerarquía Sede→Edificio→Piso→Oficina, deuda explícita
  de DOC-004 §2 — resuelta en DOC-005 §3), `Responsable`, `Catálogo de Activos`, `Activo` (Base
  Patrimonial Central), `Inventarios`, `Eventos`, `Auditoría`. `Historial` no es tabla propia —
  es la lectura cronológica de `Eventos` por activo (DOC-005 §1).
- ✅ Fuera de alcance deliberado (sin implementar, documentado en DOC-005 §8):
  `Configuración`/`Integraciones` (sin consumidor), Gestión Documental, Zona RFID/coordenadas
  (Etapa 2+), estado `en_mantenimiento` de `Activo` (Tomo III §4.15 lo marca "módulo futuro").
- ✅ Migraciones reales en `core/migrations/` (`1755100000000_schema-patrimonial`,
  `1755100000001_seed-dev-fixture-patrimonial`), con índices en las FK que el patrón de consulta
  ya conocido (por organización/área/ubicación/catálogo) va a necesitar — no "todo indexado".
  Seed de desarrollo con dos activos reales de DUOC UC/Melipilla (notebook + proyector, con su
  área, ubicación, responsable, evento de alta e inventario correcto).

**Done**: DOC-005 mergeado; migraciones `up`/`down` probadas contra Postgres real (standalone y
dentro del stack de `docker-compose.yml` local); `base-patrimonial/README.md` y `core/README.md`
actualizados dejando explícito qué dominios quedan sin modelar. **Sin API todavía** — ningún
endpoint de CORE sirve estas tablas; eso es la Fase 2 (Motor Patrimonial).

## Fase 2 — CORE MVP: Orquestador + 4 motores de lectura ✅ completa

**Por qué acá**: primer valor real de CORE, ya con dominio detrás.

**Diseño**: metodología AI-DLC en [`core/aidlc-docs/`](core/aidlc-docs/00_PROJECT_METADATA.md) —
requirements, historias de usuario, modelo de dominio de orquestación, arquitectura con
diagramas de secuencia, y DOC-006 (API CIS↔CORE) a DOC-011 (Motor de Auditoría). El diseño
encontró (y la implementación corrigió, migración `1755200000000`) dos errores sobre DOC-005 ya
migrado: nombre de categoría `invalido` vs `codigo_invalido`, y faltaba `sesiones_inventario`
para agrupar los escaneos de una misma sesión (DOC-002 confirma que `POST /inventarios` envía
sesiones cerradas completas, no escaneos sueltos).

**Qué se construyó** (módulos Nest dentro del mismo desplegable, WAF §1 y §9 — no microservicios)
1. ✅ **Orquestador Central** (`src/orquestador/`): único punto de entrada, arma
   `ContextoOperacion`, audita siempre — éxito o rechazo (Tomo IV §2.15–16, DOC-007).
2. ✅ **Motor Patrimonial** (`src/patrimonial/`): `GET /catalogo` paginado por
   organización/área/ubicación, resolución de activo por código QR. **Traslado y cambio de
   ubicación/estado quedaron sin endpoint HTTP** — sin consumidor real todavía (DOC-008, YAGNI);
   el repository ya tiene los métodos, falta el controller. Alta/baja/reincorporación/cambio de
   responsable siguen siendo Fase 4.
3. ✅ **Motor de Reglas** (`src/reglas/`): `clasificarEscaneo`, función pura con las 8 categorías
   (DOC-009) — incluida `duplicado`, que solo CORE puede detectar contra la Base Patrimonial real.
4. ✅ **Motor de Eventos** (`src/eventos/`) y **Motor de Auditoría** (`src/auditoria/`): registro
   de todo hecho e intento, con `correlationId` de Fase 0 (Tomo IV §2.9).
5. ✅ `POST /inventarios` y `GET /inventarios/:id/estado` reales, con idempotencia persistida en
   `sesiones_inventario` (ya no en memoria de `QrConnectorService` — esa migración a CIS sigue
   pendiente para la Fase 3, ver abajo).
6. ✅ **DOC-006 — API CIS↔CORE**: formaliza `/catalogo`, `/inventarios`, convención de
   `correlationId` y semántica de idempotencia.

**Qué NO se hizo, a propósito**: Motor de Alertas, Motor de Reportes, Gestión Documental,
Gestión de Usuarios/Permisos como motores completos, y el controller de traslado — sin datos ni
consumidor todavía.

**Done**: 96 tests (100% stmts/lines/funcs, >85% branches), e2e nuevo
(`test/inventarios.e2e-spec.ts`) contra Postgres real cubriendo clasificación real, idempotencia
(reintento + conflicto), y error 400 por organización inexistente; `docker build`/`docker run`
real con `GET /catalogo` y `POST /inventarios` respondiendo contra la base migrada — auditoría y
evento verificados en la fila real de Postgres, no solo en el response. `core/README.md`
actualizado.

## Fase 3 — CIS deja de ser mock + APP QR TASK-007 ✅ completa

**Por qué acá**: solo ahora existe algo real detrás del mock.

**Qué se construye**
1. ✅ `QrConnectorService` pasa de `Map`/seed a proxy hacia CORE: se borraron `SEED_CATALOGO`,
   `SEED_ORGANIZACIONES`, `qr-connector.seed.ts` y los dos `Map` en memoria — idempotencia,
   validación de organización y clasificación de escaneos ahora viven en CORE
   (`sesiones_inventario`, Motor de Reglas, Fase 2), CIS solo propaga sus 400/409/404.
2. ✅ Circuit breaker propio de CIS hacia CORE (WAF §4): `src/core-client/circuit-breaker.ts`,
   compartido entre las 4 llamadas, 5 fallos consecutivos abren el circuito, 30s de reset timeout
   antes de sondear de nuevo (half-open).
3. ✅ Reintentos con backoff exponencial (WAF §4): `src/core-client/retry.ts`, 3 intentos totales
   (200ms/400ms de backoff) solo para fallos transitorios (sin respuesta o 5xx, nunca un
   400/404/409); envuelto por el circuit breaker, así que los 3 intentos de una request cuentan
   como un solo fallo para el umbral del circuito. Seguro para `POST /inventarios` porque CORE
   dedupea por `idempotencyKey` (DOC-006 §3).
4. ✅ Rate limiting por operador (resto de WAF §4): `src/rate-limit/`, `RateLimitGuard` sobre los
   4 endpoints, 30 requests por operador cada 10s, respaldado en Redis (ventana fija atómica
   `INCR`+`PEXPIRE` vía Lua) — primer consumidor de Redis en el código del ecosistema (ya estaba
   en el stack decidido, ADR-001). Elegido sobre un limiter en memoria de proceso porque WAF §4
   exige "multi-instancia sin estado en memoria compartido"; falla abierto si Redis no responde
   (`devops/local/docker-compose.yml` actualizado con `REDIS_URL` para el servicio `cis`). Refactor
   siguiente (ítem 6) extrajo el cliente Redis a `src/redis/` (`RedisModule`, global) para que
   `src/rate-limit/` y `src/device-registry/` compartan una sola conexión.
5. ⬜ Caché de entitlements en CIS invalidada por evento (recién tiene sentido con Fase 4
   escribiendo contratos; si al llegar acá aún no existe, dejarlo fuera y anotarlo).
6. ✅ `deviceId` enforced (un dispositivo por operador, DOC-002 §1): `src/device-registry/`,
   `DeviceRegistryService` registra en Redis el `deviceId` de cada `auth/session` como
   dispositivo activo del operador, con TTL igual a la vigencia del token (expira solo, sin
   logout explícito). Decisión de conflicto (confirmada explícitamente con el usuario, DOC-002 no
   la resuelve): el dispositivo nuevo **reemplaza** al anterior en vez de rechazarse — sin rol
   Administrador todavía (Fase 4) para destrabar manualmente, rechazar dejaría varado a un
   operador que pierde o cambia de celular. Falla abierto ante error de Redis, mismo criterio que
   el rate limiter (es una restricción de negocio complementaria, no un control de seguridad —
   Zitadel ya autentica). **Enforcement parcial por diseño de DOC-002**: `deviceId` solo llega en
   el body de `auth/session`, no en las otras 3 rutas — no hay forma de revalidar el dispositivo
   en cada request sin romper el contrato ya acordado con APP QR.
7. ✅ **APP QR TASK-007**: `qr-connector.ts` (`app-qr-sicsaft/`) reemplazó `LocalQrConnectorClient`
   por `HttpQrConnectorClient` real, con auth OIDC/PKCE (`src/lib/oidc/`) y manejo de
   `400/401/409/5xx` de DOC-002 §5 (`RejectedInventarioError` corta la cola de reintentos en
   400/409 en vez de insistir para siempre). Se activó `rejected` (`SyncStatus`) — `duplicate`
   (`ScanCategory`) sigue sin ser alcanzable: `POST /inventarios` no devuelve reclasificación por
   escaneo, solo el estado de la sesión completa (DOC-006 §3), y activarlo requeriría un cambio de
   contrato nuevo. CORS habilitado en CIS (`CIS_CORS_ORIGIN`, opcional/sin default) — primera vez
   que un navegador le habla directo a CIS. **Hallazgo no anticipado por las 4 preguntas
   originales**: CIS/CORE no modelan "área" con nombre propio (`GET /entitlements` es
   organización→sedes, 2 niveles) — el árbol de 3 niveles que la UI necesita ahora se deriva en
   runtime del catálogo completo de la organización (`buildOrganizationTree`), decisión confirmada
   explícitamente con el usuario, no había otra forma sin inventar un endpoint nuevo.
   **Verificado real de punta a punta el 2026-08-13** (app OIDC de Zitadel ya provisionada,
   client ID cargado en `.env`, stack local completo, recorrido manual login → organización →
   catálogo → escaneo → envío → persistencia confirmada por consulta directa a Postgres). La
   verificación encontró y corrigió **un bug real** en `postInventario()`: mandaba el payload de
   `POST /inventarios` con los nombres de campo internos de la app (`operatorName`,
   `organizationId`, `items`...) en vez del contrato DOC-006 (`operadorId`, `organizacionId`,
   `escaneos[]`...) — CORE rechazaba cada envío con 400, invisible en la UI porque
   `sync-queue.ts` no relanza el error (queda como `rejected` local). Ninguno de los 37 tests de
   Playwright lo detectaba porque los mocks MSW no validan la forma del request saliente (queda
   anotado como brecha de cobertura pendiente, ver HANDOFF §7). También se encontró que la imagen
   Docker de `cis` del compose local estaba compilada de antes de agregar CORS — recordatorio
   operativo, no bug de código: reconstruir con `--build` al levantar el stack tras cambios.

**Done**: unit (100% stmts/funcs/lines, 90%+ branches, incluye reintentos con fake timers y el
rate limiter/device registry con Redis mockeado) y e2e de CIS actualizados a proxy delgado
(`CoreClientService`/`REDIS_CLIENT` stubeados, sin CORE ni Redis reales — la idempotencia y
validación real ya se probaron contra Postgres en la Fase 2); `cis/README.md` actualizado
quitando "mock" para catálogo/inventarios; TASK-007 verificado real de punta a punta contra
Postgres, no solo por la respuesta HTTP. **Diferido, no bloqueante**: item 5 (caché de
entitlements, opcional) y la brecha de cobertura de payload-shape en los mocks MSW.

**Hito de negocio**: primera vez que el ecosistema completo funciona de punta a punta, verificado
en la práctica (no solo en código) — login real, catálogo real, inventario persistido en la Base
Patrimonial vía CIS→CORE. Todo lo anterior a esto es infraestructura.

## Fase 4 — Administrador Patrimonial y camino de escritura oficial (pieza nueva)

**Por qué acá y no antes**: es el rol que Tomo III §1.4 define como único autorizado a modificar
oficialmente la Base Patrimonial, y hoy no existe en ningún sistema
(`seguridad/README.md` § "Rol pendiente"). Antes de la Fase 2 no tenía sobre qué escribir;
después de la Fase 3 es el bloqueador para que la base tenga activos reales en vez de seeds.

**Qué se construye**
1. Rol `administrador-patrimonial` en Zitadel + claim de rol validado en CIS y **autorizado en
   CORE** (WAF §3: el CORE no confía en un scope que no validó CIS, pero tampoco delega la
   autorización de escritura).
2. Primer alcance real de **Gestión de Permisos** (Tomo IV §2.14): las 8 acciones con mínimo
   privilegio, y separación explícita de que APP QR/WEB/RFID no pueden escribir la base aunque el
   usuario sea admin (matriz de WAF §11).
3. Extensión del Motor Patrimonial a alta, baja, reincorporación y cambio de responsable — resto
   del ciclo de vida de Tomo III §4.15.
4. **Importación de base contable** como operación de este rol: carga masiva (CSV/Excel) con
   validación por Motor de Reglas, idempotente, que nunca elimina historial (Tomo III §1.4
   Entrada 5). Precursor manual y honesto del conector automático (Fase 7).
5. Escritura de `Contrato` (hoy la tabla solo se lee) y evento `contrato.actualizado` que
   invalida la caché del CIS.
6. **DOC-012** (detalle de implementación de seguridad) y WAF §11 actualizado marcando la entrada
   como implementada.

**Done**: usuario sin el rol recibe 403 en toda escritura oficial (test e2e); toda escritura
queda en Auditoría con usuario/IP/operación/resultado; importar dos veces el mismo archivo no
duplica ni borra nada; `seguridad/README.md` y `ARQUITECTURA-WAF.md` §11 actualizados.

## Fase 5 — Portal WEB mínimo 🟡 en diseño

**Por qué acá**: `web/README.md` dice "depende de CORE MVP + CIS real" — ambos existen recién
después de la Fase 3, y la Fase 4 crea las operaciones que el portal necesita exponer.

**Diseño completo, sin código todavía**: metodología AI-DLC en
[`web/aidlc-docs/`](web/aidlc-docs/00_PROJECT_METADATA.md) — requirements, historias, DOC-013 y
un mockup visual (hub + Activos + Contratos, paleta `BRAND.md`), diseñado adelantado por pedido
explícito del usuario en la misma sesión de Fase 2. DOC-013 §3 deja explícito que solo Activos
(consulta) e Inventarios tienen endpoint real hoy (los de DOC-006) — el resto de la escritura
(Estructura, Contratos, alta de Activos) depende de que Fase 4 defina sus propios endpoints.

**Qué se construye**
- Vite/React (ADR-001) con OIDC authorization code + PKCE contra Zitadel (`app.sicsaft.cl`).
- Solo 6 módulos: Activos (consulta **+ alta**, ver "Done" abajo), Inventarios (estado y
  detalle), Áreas/Ubicaciones/Responsables (ABM del Administrador Patrimonial), Auditoría
  (lectura), Contratos (ABM), hub post-login que muestra solo módulos habilitados por contrato
  vigente (ADR-002 § flujo de login). El resto (Dashboard, RFID, Documentos, Reportes,
  Integraciones, Roles, Configuración) queda para después.
- Identidad visual desde `BRAND.md`.
- Dockerfile multi-stage, workflow `web-ci.yml` con path filter, servicio en el compose local.

**Done**: un Administrador Patrimonial puede dar de alta un activo desde WEB y verlo aparecer en
el catálogo que baja APP QR; e2e Playwright del flujo de login + alta; `web/README.md` y DOC-013.

## Fase 6 — CIP: primer dashboard

**Por qué acá**: `cip/README.md` pide "definir qué métricas del MVP de CORE ya están
disponibles" — recién después de la Fase 3/4 hay inventarios y eventos reales que medir.

**Qué se construye**
- Métricas ya listadas en `cip/README.md` (cobertura de inventario, activos fuera de área, no
  localizados, incidencias, estado de AFT), con drill-down Organización→Sede→Área→Ubicación→
  Activo.
- Alimentado **asíncronamente desde el Motor de Eventos** contra réplica de lectura o vistas
  materializadas de la misma Postgres — no un motor analítico dedicado (WAF §9 lo prohíbe hasta
  tener el modelo estable y carga medida).
- Motor de Reportes en alcance mínimo (exportación bajo demanda, WAF §6); Motor de Alertas solo
  si aparece un consumidor real.
- **Patrón a adoptar acá, no antes**: transactional outbox para la publicación de eventos hacia
  CIP/Alertas — el Motor de Eventos hoy (Fase 2) solo inserta en `eventos`, sin publicar a nadie;
  el día que CIP consuma eventos en (casi) tiempo real vía la cola de Redis/BullMQ (ADR-001),
  escribir en Postgres y publicar en la cola dejan de ser atómicos (riesgo de perder o duplicar
  eventos si el proceso muere entre medio). El patrón estándar: insertar el evento y un registro
  "pendiente de publicar" en la misma transacción; un worker aparte lo despacha con reintentos.
  No implementar antes de tener un consumidor real (YAGNI, mismo criterio que WAF §9).

**Done**: CIP no toca la base transaccional en ninguna consulta (verificable en código);
dashboard degrada a "últimos datos conocidos" si la fuente está caída (WAF §8); DOC-014.

## Fase 7 — CON-CONTABILIDAD (pieza nueva)

**Por qué acá y no antes**: Tomo III §1.4 Entrada 5 lo define como la fuente de la que siempre
proviene la Base Oficial — conceptualmente crítico, pero técnicamente depende de Motor de
Eventos + Auditoría + el camino de escritura del Administrador Patrimonial (Fase 4), y de saber
contra qué sistema contable concreto se integra (dato de negocio que hoy no está en el repo). La
importación manual de la Fase 4 cubre el 80% del valor mientras tanto.

**Ojo con la clasificación**: `integraciones/README.md` marca todo el sistema como "fase tardía",
y Tomo III §1.2 pone las integraciones en Etapa 5. Pero CON-CONTABILIDAD **no es una integración
de Etapa 5** — es una entrada oficial de Etapa 1 según §1.4. Vale la pena corregir esa
clasificación en `integraciones/README.md` cuando se llegue a esta fase.

**Qué se construye**: conector en CIS (no un servicio que escriba directo a la base — regla no
negociable de `CLAUDE.md`), sincronización idempotente, aislamiento de fallos y circuit breaker
(WAF §4), registro por integración (fecha/origen/destino/estado/resultado/errores/
`correlationId`), dominio `Integraciones` de DOC-005 que quedó fuera de la Fase 1, DOC-016.

**Done**: caída del sistema contable no bloquea el flujo Captura→CIS→CORE (test de resiliencia);
ninguna sincronización elimina historial (invariante testeado).

## Fase 8 — RFID

Cierra la Etapa 1 declarada en Tomo III §1.2 (APP QR + WEB + RFID). Entra como un conector más en
CIS, sin tocar CORE ni Base Patrimonial — así está diseñado el límite de módulo (WAF §1).
Requiere el módulo `inventario-rfid` ya reservado en DOC-004 §5, el dominio Zona RFID de
Ubicaciones, y los eventos `RFID_*` de `rfid/README.md`. Depende de hardware/lector real: no
arrancar sin un piloto concreto.

## Track paralelo: OPS (no es una fase, es continuo)

`devops/` no tiene una posición en la cadena de dependencias — tiene hitos atados a las fases:

| Hito | Cuándo | Contenido |
|---|---|---|
| OPS-1 | con Fase 0 | Migraciones en CI, branch protection verificada, `correlationId` en logs |
| OPS-2 | antes de Fase 3 | VPS + staging real con dominios `sicsaft.cl` y TLS Traefik, deploy automático a staging, smoke tests |
| OPS-3 | con Fase 3 | Observabilidad (Prometheus/Grafana/Loki), backups con restauración probada (Tomo III §4.10) |
| OPS-4 | con Fase 4 | Gestor de secretos real reemplazando `CORE_SERVICE_TOKEN` como env var plana, rotación, SAST/secret scan/Trivy |
| OPS-5 | con Fase 5 | WAF/rate limiting en Traefik, producción con aprobación manual, k6 en cron |

Nota de cumplimiento: Ley 21.719 entra en vigencia ~diciembre 2026. El modelo de datos de
operadores/usuarios de la Fase 1 debería contemplar derechos ARCO y registro de tratamiento
mientras se diseña, no como retrofit.

## YAGNI: qué NO construir todavía

Explícitamente descartado por política del propio proyecto (WAF §9 y Tomo III §1.2), aunque
aparezca en documentos:
- **BLE / GPS** (Etapa 2), **IoT / cámaras inteligentes** (Etapa 3), **IA / ML / analítica
  predictiva** (Etapa 4), **ERP / Power BI / RRHH** (Etapa 5). El tomo dice explícitamente "nunca
  desarrollaremos funciones que el mercado aún no demanda".
- Separar los 9 motores en microservicios — módulos Nest dentro de un desplegable hasta tener
  motivo real de escalado.
- Cola de mensajes dedicada — con una sola fuente de captura con tráfico real, la cola local de
  TASK-008 alcanza. Reevaluar en Fase 8 (RFID = segunda fuente concurrente).
- Motor analítico dedicado para CIP — hasta que el modelo de dominio esté estable.
- Autoscaling / multi-región — antes de tener carga real medida.
- Los 11 dominios completos en DOC-005 — modelar Configuración/Integraciones/Gestión Documental
  sin consumidor es especulativo. Reservar campos, no implementar.
- Los 17 módulos de WEB y las 8 pantallas de reportes — 6 módulos cubren el ciclo real.
- Módulo de Mantenimiento — el propio Tomo III §4.15 lo marca como "módulo futuro".

## Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Fase 1 (DOC-005) se convierte en modelar los 11 dominios completos y bloquea meses | Alcance recortado y escrito en el propio DOC-005: solo lo que consume el flujo QR |
| La idempotencia en memoria de CIS ya es un bug latente con más de una instancia | Se mueve a CORE en Fase 2; hasta entonces, CIS corre en una sola instancia (documentarlo) |
| `duplicate`/`rejected` reservados en APP QR nunca se activan | Criterio de aceptación explícito de TASK-007 en Fase 3 |
| Construir CON-CONTABILIDAD contra un sistema contable hipotético | Importación manual primero (Fase 4); el conector solo con un sistema real identificado |
| Contradicción tomo vs. código al implementar Administrador Patrimonial | `CLAUDE.md` es claro: gana el tomo, se levanta la discrepancia — no editar la cita |
| READMEs quedan desactualizados fase a fase | Regla de `CLAUDE.md`: README del sistema actualizado en el mismo commit o el inmediatamente siguiente |

## Cadena de dependencias

```
Fase 0 (migraciones + correlationId + OIDC real) ✅
  └─ Fase 1 (DOC-005 mínimo) ✅
       └─ Fase 2 (CORE MVP: 4 motores + DOC-006) ✅
            └─ Fase 3 (CIS real + APP QR TASK-007) ✅ verificado real de punta a punta 2026-08-13
                 ├─ Fase 4 (Administrador Patrimonial + escritura oficial)  [pieza nueva]
                 │    ├─ Fase 5 (WEB mínimo) — diseño ✅, código pendiente
                 │    └─ Fase 7 (CON-CONTABILIDAD)   [pieza nueva]
                 └─ Fase 6 (CIP primer dashboard)
                      └─ Fase 8 (RFID — cierra Etapa 1)

Track OPS ─────── paralelo, con hitos atados a Fases 0/3/4/5
```

Archivos clave para quien implemente cada fase: [CLAUDE.md](CLAUDE.md),
[ARQUITECTURA-WAF.md](ARQUITECTURA-WAF.md),
[base-patrimonial/DOC-004-modelo-contrato.md](base-patrimonial/DOC-004-modelo-contrato.md),
[app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md](app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md),
[adr/ADR-002-identidad-zitadel-multi-tenant.md](adr/ADR-002-identidad-zitadel-multi-tenant.md),
[core/migrations](core/migrations),
`cis/src/qr-connector/qr-connector.service.ts`, `core/src/entitlements/contrato.repository.ts`.
