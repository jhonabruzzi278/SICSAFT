# DOC-012: Administrador Patrimonial — rol y camino de escritura oficial

> **Estado**: los 4 ítems de código de esta fase están implementados y verificados (unit + e2e
> contra Postgres real) — ítem 1 (rol + claim + autorización), ítem 3 (Motor Patrimonial: alta/
> baja/reincorporación/cambio de responsable), ítem 4 (importación masiva idempotente de base
> contable) e ítem 5 (escritura de `Contrato`). **5.1 agregado 2026-08-17, sin implementar
> todavía** (Fase 3.1/DOC-017, en Inception, confirmado con el usuario) — registro de estado
> operativo y "baja sugerida" por APP QR sin rol nuevo, sin tocar `Activo.estado` en el caso de
> baja (la ejecuta el Administrador Patrimonial). Formaliza el
> rol que Tomo III 1.4 Entrada 4 define como único autorizado a modificar oficialmente la Base
> Patrimonial — hoy no existe en ningún sistema del ecosistema
> ([`seguridad/README.md`](README.md) "Rol pendiente"). Complementa
> [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (mecanismo de identidad),
> [DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) (modelo de `Contrato`, hoy solo se
> lee), [DOC-005](../base-patrimonial/DOC-005-modelo-patrimonial.md) (modelo de `Activo` y su
> máquina de estados) y [DOC-006](../core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md)
> (convenciones de API CIS↔CORE que este documento extiende, no reemplaza).

### Nomenclatura: Profesional de AFT

`administrador-patrimonial` (este documento, el claim de Zitadel, el código) es el **nombre
técnico** del rol — el **nombre funcional/oficial** con el que el negocio identifica a quien lo
ejerce es **Profesional de AFT**: el usuario principal autorizado a acceder al CCP (Portal WEB,
`web/`) y cargar/actualizar/mantener la información patrimonial necesaria para la operación del
sistema. Aclaración provista por el usuario del proyecto (2026-08-18), no cita textual de un tomo
con sección específica — se documenta como tal, sin inventar una referencia `x.y` que no fue
dada.

Alcance funcional del Profesional de AFT dentro del CCP, según sus permisos (mapea 1:1 a las
acciones ya implementadas en 4/5/6/7 de este documento): activos; códigos patrimoniales;
descripciones; familias/categorías; áreas; ubicaciones; responsables; estados; documentación y
fotografías cuando corresponda; información para preparar inventarios; importaciones controladas
desde archivos autorizados. El CCP nunca escribe directo a la base — toda creación/modificación
pasa por CORE, que valida y actualiza la BPI (regla no negociable de `CLAUDE.md`, ya reflejada en
3 de este documento).

**Nivel 1 vs. perfiles futuros**: el Profesional de AFT es el único perfil de Nivel 1 responsable
de la carga y mantenimiento de la información patrimonial — no necesariamente el único que podrá
entrar al CCP más adelante. `web/README.md` "Roles previstos" ya anota Supervisor, Auditor y
Administrador como perfiles futuros con permisos distintos (sin diseño ni rol de Zitadel todavía,
sin consumidor real) — esta aclaración no les da alcance, solo da nombre explícito a la relación
con el Profesional de AFT.

## 1. Por qué esto y no antes

Antes de la Fase 2 no había motores sobre los que escribir; después de la Fase 3 (CIS real + APP
QR verificado) es el bloqueador real: **hoy no hay ninguna forma legítima de meter un activo real
al sistema** — todo lo que existe en Postgres es seed de desarrollo (`1755100000001_seed-dev-fixture-patrimonial.ts`). APP QR y RFID solo pueden *leer* el catálogo y *registrar inventarios*
(Tomo III 1.4: "no puede modificar la Base Patrimonial Oficial") — el único camino de entrada
oficial es este rol y, más adelante (Fase 7), el conector CON-CONTABILIDAD.

## 2. Rol en Zitadel

Se crea un rol de **Proyecto** (no de Organización) llamado `administrador-patrimonial` en el
proyecto "CIS" ya existente en Zitadel (mismo proyecto que las apps `app-qr-sicsaft`/futuras
WEB), asignado a usuarios específicos por organización — un usuario puede tener el rol en una
organización y no en otra (coherente con el modelo Usuario → Organización → Contrato → Rol de
`seguridad/README.md`).

**Cómo llega el claim al JWT**: Zitadel solo incluye roles de proyecto en el token si la
aplicación pide el scope reservado `urn:zitadel:iam:org:project:role:administrador-patrimonial`
(o tiene "Assert Roles on Authentication" habilitado a nivel de proyecto) — sin esto, el rol
existe en Zitadel pero nunca aparece en el JWT y CIS no lo puede leer. Cuando está presente, el
claim tiene esta forma (verificado contra la documentación de Zitadel, no supuesto):

```json
{
  "urn:zitadel:iam:org:project:roles": {
    "administrador-patrimonial": { "<organizacionId-zitadel>": "<nombre-org>" }
  }
}
```

## 3. Qué valida CIS vs qué autoriza CORE (WAF 3 — cero confianza entre niveles)

Ninguno de los dos niveles delega ciegamente en el otro:

1. **CIS solo transporta un hecho ya firmado, no decide autorización.** `ZitadelAuthGuard`
   (`cis/src/common/auth/zitadel-auth.guard.ts`) ya valida firma/`iss`/`aud`/vencimiento del JWT
   — se extiende para además leer `urn:zitadel:iam:org:project:roles` y exponer
   `request.auth.rolesPorOrganizacion: Record<string, string[]>` (invertido de
   `{rol: {orgId: orgName}}` a `{orgId: [rol, ...]}`; vacío si el claim no viene, nunca un error —
   la mayoría de los requests de CIS no lo necesitan). **No** es una lista plana de nombres de rol
   — una implementación inicial de esto aplanó el claim a `string[]` y perdió el contexto de
   organización, lo que le habría permitido a un `administrador-patrimonial` de la Organización A
   escribir sobre activos de la Organización B (hallazgo real de revisión de seguridad, corregido
   antes de cerrar este incremento). CIS **nunca** decide "este usuario puede escribir" — solo
   certifica "Zitadel firmó un token que dice que este usuario tiene este rol en esta
   organización".
2. **CORE es quien autoriza cada escritura, siempre, contra la organización del recurso.** Los
   endpoints de escritura oficial (5) invocan `verificarRolAdministradorPatrimonial(
   rolesPorOrganizacion, organizacionId)` — nunca "¿tiene el rol en algún lado?", siempre "¿tiene
   el rol en *esta* organización?" — el mismo patrón de "cero confianza" que ya existe entre
   CIS→CORE hoy (`ServiceTokenGuard`, secreto compartido `CORE_SERVICE_TOKEN`): el secreto de
   servicio prueba que la llamada viene de una instancia legítima de CIS, pero **no** prueba que
   el usuario final tenga el rol — eso lo re-verifica CORE. Como defensa en profundidad adicional,
   `ActivoRepository.cambiarEstado`/`actualizarResponsable` vuelven a cruzar `organizacionId`
   contra la organización **real** del activo objetivo (no solo la que declaró el payload) antes
   de escribir, devolviendo 404 — no 403 — si no coincide, para no confirmarle a un caller sin ese
   rol que el activo existe en otra organización. Esto es exactamente lo que pide el ROADMAP:
   *"CORE no confía en un scope que no validó CIS, pero tampoco delega la autorización de
   escritura"*.
3. **CIS reenvía `operadorId` + `organizacionId` + `rolesPorOrganizacion` en el body de cada
   llamada de escritura oficial hacia CORE** (mismo mecanismo que ya usa para
   `organizacionId`/`areaId` en `POST /inventarios`, ver DOC-006 3) — no hay canal nuevo que
   inventar, es el mismo canal service-to-service ya protegido por `CORE_SERVICE_TOKEN`.
   `organizacionId` es obligatorio en **todos** los endpoints de escritura oficial, no solo en
   alta — es contra qué organización se verifica el rol.

## 4. Gestión de Permisos — las 8 acciones (Tomo IV 2.14)

Alcance mínimo para esta fase: aplicar las 8 acciones (`Consultar, Crear, Modificar, Eliminar,
Autorizar, Exportar, Administrar, Configurar`) solo al recurso `Activo` y `Contrato`, no a los 11
dominios completos de DOC-005 (mismo criterio YAGNI que recortó DOC-005 8).

| Acción | Recurso | Endpoint (5–7) | Quién más puede |
|---|---|---|---|
| Crear | Activo | `POST /activos` (alta) | Nadie — solo Administrador Patrimonial |
| Eliminar | Activo | `POST /activos/:id/baja` | Nadie |
| Modificar | Activo | `POST /activos/:id/reincorporacion`, `PATCH /activos/:id/responsable` | Nadie |
| Crear | Activo (masivo) | `POST /importaciones/contable` | Nadie (Fase 7 lo automatiza, no lo reemplaza) |
| Crear/Modificar | Contrato | `POST /contratos`, `PATCH /contratos/:id` | Nadie |
| Consultar | Activo/Contrato | `GET /catalogo`, `GET /entitlements` (ya existen) | APP QR, WEB, RFID (Tomo III 1.4 ya se lo permite) |
| Modificar (estado operativo) | Activo | `POST /inventarios`, extendido — ver 5.1 (pendiente, Fase 3.1) | **APP QR, sin rol nuevo** — Tomo III 1.4 ya le concede "registro de inventarios/estados" a esta entrada, distinto de "modificar la Base Patrimonial Oficial" |
| Autorizar/Exportar/Administrar/Configurar | — | Sin endpoint todavía | Fuera de alcance de esta fase — sin consumidor real (WEB Fase 5 los va a necesitar para su propio ABM, no antes) |

**Matriz WAF 11 sin excepciones**: APP QR y RFID conservan exactamente los mismos permisos de
hoy (lectura + registro de inventarios) — ningún cambio de esta fase les da acceso de escritura
oficial, ni siquiera si el operador tuviera el rol (el rol solo existe/se valida en los endpoints
nuevos, las 4 rutas de DOC-006 no lo piden ni lo aceptan).

## 5. Extensión del Motor Patrimonial — ciclo de vida de `Activo` ✅ implementado

Implementa la máquina de estados **ya documentada** en DOC-005 4 "Estados de `Activo`"
(`stateDiagram-v2`):
`[*] → activo → en_transito → activo`, `activo → extraviado → activo|dado_de_baja`,
`activo → dado_de_baja` (terminal, la fila nunca se borra — Tomo III 4.10). Traslado
(`activo ⇄ en_transito`) queda fuera de esta fase (DOC-008 ya lo marca sin consumidor real,
YAGNI) — se implementan las 4 transiciones que sí tienen consumidor inmediato:

| Endpoint | Transición | Invariante |
|---|---|---|
| `POST /activos` | `[*] → activo` (alta) | `codigoQr`/`codigoPatrimonial` únicos (ya en el schema) |
| `POST /activos/:id/baja` | `activo\|extraviado → dado_de_baja` | Irreversible — 400 si el activo ya está `dado_de_baja` |
| `POST /activos/:id/reincorporacion` | `extraviado → activo` | 400 si el activo no está `extraviado` |
| `PATCH /activos/:id/responsable` | sin cambio de estado | Solo actualiza `responsable_id`, no toca `estado` |

Cada transición inserta una fila en `eventos` (tipo `alta`/`baja`/`reincorporacion`/
`cambio_responsable`, mismo patrón que el seed de Fase 1) — `Historial` sigue sin ser tabla
propia, es la lectura cronológica de `eventos` por activo (DOC-005 1, sin cambios).

### 5.1 Registro de estado operativo durante el control (APP QR, sin rol nuevo) — ⬜ pendiente

**Origen**: `ROADMAP.md` Fase 3.1 /
[DOC-017](../app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-017-fase-3.1-brechas-flujo.md) — el
controlador de AFT quiere declarar el estado de cada activo (en servicio/mantenimiento/inactivo)
durante el mismo control de inventario, sin salir a WEB.

**Por qué no necesita el rol `administrador-patrimonial`**: Tomo III 1.4 (tabla completa en
`ARQUITECTURA-WAF.md` 11) le concede a la entrada APP QR *"Lectura, registro de
inventarios/**estados**, generación de informes"* — "registro de estados" es un permiso ya
otorgado por el tomo a **cualquier** operador autenticado de APP QR, no una capacidad exclusiva de
Administrador Patrimonial. Es distinto de "modificar la Base Patrimonial Oficial" (lo que APP QR
explícitamente **no puede**): declarar que un activo está en mantenimiento no reescribe su
identidad, ubicación, responsable ni lo elimina — es información operativa de estado, análoga a
"con_incidencia" en las 8 categorías de escaneo que ya se registran hoy sin rol especial.

**Diseño propuesto**: extender el payload de `POST /inventarios` (DOC-006 3) con un campo
opcional por escaneo, `estadoDeclarado?: 'activo' | 'mantenimiento' | 'inactivo'` — **nunca**
`dado_de_baja` (ver conflicto abajo). CORE aplica la transición dentro del mismo
`OrquestadorService.ejecutarEscrituraOficial` que ya usa el Motor Patrimonial (5), sin
`verificarRolAdministradorPatrimonial` — mismo nivel de autorización que el resto de
`POST /inventarios` hoy (operador autenticado vía Zitadel, sin claim de rol adicional). Cada
transición genera su evento (`tipo: 'mantenimiento'` ya existe en el vocabulario de DOC-005 6;
`inactivo` es evento nuevo, mismo patrón).

**"Baja sugerida" — resuelto 2026-08-17, sin delegar la escritura oficial**: el operador de
escaneo puede marcar `bajaSugerida: { motivo: string }` por activo, que viaja en el mismo
`POST /inventarios` extendido como dato informativo (misma naturaleza que una observación o
incidencia) — **no** ejecuta ninguna transición de `Activo.estado`, no invoca
`verificarRolAdministradorPatrimonial`, no es escritura oficial. El Administrador Patrimonial ve
la sugerencia al revisar el inventario/informe (mismo lugar donde ya revisa auditoría hoy) y, si
la valida, ejecuta él mismo `POST /activos/:id/baja` desde WEB — el único camino que de verdad
cambia `Activo.estado` a `dado_de_baja` sigue siendo exclusivo de ese rol, sin cambios respecto a
5. Esto respeta Tomo III 1.4 sin ambigüedad: "generación de informes" (que el tomo ya le concede
a APP QR) incluye señalar una sugerencia; "eliminar activos" (reservado a Administrador
Patrimonial) sigue siendo un acto exclusivo y explícito de ese rol.

## 6. Importación de base contable (carga masiva) ✅ implementado

Endpoint `POST /importaciones/contable` (`core/src/patrimonial/importacion-contable.*`) — recibe
un array ya parseado de filas (CSV/Excel se parsean del lado de quien construyó DOC-013/WEB o un
script CLI de este mismo repo, fuera de alcance de este documento; CORE solo recibe JSON
validado, mismo criterio que "CORE no confía en datos crudos de un cliente" del resto del
ecosistema).

- **Idempotente por fila, no por request completo** (a diferencia de `POST /inventarios`, que es
  atómico por sesión): cada fila trae su propio `codigoPatrimonial`
  (`ActivoRepository.findByCodigoPatrimonial`) — reintentar la misma fila con el mismo contenido
  se reporta `ya_importado` sin volver a escribir; una fila con `codigoPatrimonial` ya existente
  pero contenido distinto (codigoQr/área/ubicación/responsable) se **reporta como `conflicto`**,
  nunca sobrescribe en silencio. Una fila invalida (ej. `catalogoId` inexistente) tampoco aborta
  el resto del archivo — cada fila se resuelve independiente, el response siempre es 200 con el
  detalle por fila (`creados`/`yaImportados`/`conflictos`).
- **Nunca elimina** (Tomo III 1.4 Entrada 5: "Nunca elimina información histórica") — una fila
  que ya no aparece en un archivo posterior no da de baja el activo; dar de baja es un acto
  explícito (5), no una inferencia de ausencia.
- Cada fila creada registra un evento `alta` (`detalle.origen: 'importacion_contable'`) — mismo
  motor de eventos de la Fase 2, sin mecanismo nuevo.
- Precursor manual y honesto del conector automático `CON-CONTABILIDAD` (Fase 7) — mismo shape de
  payload por fila, para que el conector futuro sea un cliente más de este mismo endpoint, no un
  camino de escritura paralelo (evita repetir el error que la regla no negociable de `CLAUDE.md`
  prohíbe: nadie le escribe a Base Patrimonial sin pasar por CORE).

## 7. Escritura de `Contrato` ✅ implementado

`ContratoRepository` (`core/src/entitlements/`) ya no solo lee:

- `POST /contratos` — alta, valida el invariante de DOC-004 4 ("una sede, un contrato `vigente`
  a la vez") con una consulta previa (`contrato_sedes` × `contratos.estado = 'vigente'`) antes de
  insertar dentro de una transacción real (`BEGIN`/`COMMIT`/`ROLLBACK` vía `pool.connect()`) —
  necesaria para que un `contrato_sedes` invalido no deje una fila de `contratos` huérfana sin
  ninguna sede (hallazgo real encontrado corriendo el e2e contra Postgres real durante este mismo
  incremento, antes de la transacción un FK fallido a mitad de camino sí la dejaba).
- `PATCH /contratos/:id` — solo transiciones válidas de la máquina de estados de DOC-004 3
  (`vigente ⇄ suspendido`, `vigente → vencido|cancelado`, ambos terminales sin transición de
  salida) — cualquier otra combinación es 400 (`ContratoRepository.actualizarEstado`, tabla
  `TRANSICIONES_VALIDAS`). Mismo cruce de `organizacionId` contra la organización real del
  contrato que `ActivoRepository` (404, no 403, si no coincide — defensa en profundidad).
- Emite evento `contrato_actualizado` (`EventoRepository.registrarContrato`, columna
  `eventos.contrato_id` nueva — `eventos.activo_id` pasó a nullable, migración
  `1755300000000_schema-escritura-contrato`) — **sin publicación a una cola todavía** (el patrón
  de outbox transaccional está anotado para Fase 6/CIP, no antes: no hay consumidor real de este
  evento hasta que exista la caché de entitlements en CIS, que la Fase 3 dejó explícitamente
  diferida como opcional). Por ahora el evento queda en Auditoría/Eventos como registro, no como
  disparador activo.

## 8. Auditoría de escritura ✅ implementado (sin mecanismo nuevo — reusa el de Fase 2)

El Motor de Auditoría (Fase 2, `core/src/auditoria/`) ya audita "éxito o rechazo" (Tomo IV
2.15–16) a través del Orquestador Central — los endpoints nuevos de este documento se registran
en el mismo Orquestador, no necesitan un mecanismo de auditoría propio. Lo único nuevo es que un
**403 por falta de rol** también pasa por el Orquestador antes de cortar la request (para que
quede en `auditoria` con `resultado: 'rechazado:403'`), no corta directo en un guard sin auditar
— por eso `verificarRolAdministradorPatrimonial` (`core/src/common/auth/administrador-patrimonial.guard.ts`)
es una función pura invocada dentro de `OrquestadorService.ejecutarEscrituraOficial`, no un
`@UseGuards()` a nivel de controller — un guard corta la request antes de que el Orquestador
pueda envolver el error en su try/catch, así que auditar ahí requería mover el chequeo adentro
(`AdministradorPatrimonialGuard`, la clase `CanActivate`, sigue existiendo y probada, pero no se
usa en ningún endpoint real — queda reservada para un futuro caso donde cortar antes del
Orquestador sea aceptable). `ServiceTokenGuard` sí sigue cortando antes del Orquestador porque
autentica la conexión CIS↔CORE, no una acción de negocio auditable por usuario.

## 9. Fuera de alcance de esta fase (documentado, no implementado)

- Traslado de activo (`activo ⇄ en_transito`) — DOC-008 ya lo marca sin consumidor real.
- Las 4 acciones restantes de Gestión de Permisos (Autorizar/Exportar/Administrar/Configurar) —
  sin consumidor hasta que WEB (Fase 5) tenga su propio ABM.
- Publicación en cola del evento `contrato_actualizado` (patrón outbox) — anotado para Fase 6.
- Parseo de CSV/Excel en sí — este documento define el contrato JSON que CORE recibe, no dónde se
  parsea el archivo origen (queda para quien construya el CLI o el módulo de WEB, Fase 5).
- UI de ningún tipo — Fase 5 (WEB) es quien va a exponer estos endpoints a un humano; esta fase
  entrega solo la API + autorización + auditoría.

## 10. Done (criterio de aceptación, igual al del ROADMAP)

- ✅ Usuario autenticado sin el rol `administrador-patrimonial` **en la organización del
  recurso** recibe 403 en los 7 endpoints de escritura oficial (`POST /activos`, `/baja`,
  `/reincorporacion`, `PATCH /responsable`, `POST /importaciones/contable`, `POST /contratos`,
  `PATCH /contratos/:id`) — cubierto por test e2e por endpoint contra Postgres real
  (`core/test/activo-escritura.e2e-spec.ts`, `contrato-escritura.e2e-spec.ts`,
  `importacion-contable.e2e-spec.ts`), incluido el caso de rol válido en otra organización.
- ✅ Toda escritura de 5/6/7 (éxito o rechazo) queda en `auditoria` con
  usuario/operación/resultado.
- ✅ Importar el mismo archivo dos veces no duplica ni borra ningún activo (6) — verificado e2e
  contra Postgres real: mismo contenido reporta `ya_importado` sin reescribir, contenido distinto
  reporta `conflicto` sin sobrescribir.
- ✅ `seguridad/README.md` y `ARQUITECTURA-WAF.md` 11 actualizados marcando la entrada
  Administrador Patrimonial como implementada — el rol ya puede hacer las 3 operaciones que Tomo
  III 1.4 le exige (incorporar activos, importar bases contables, actualizar estados/contratos).

## 11. Documentos relacionados

[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (identidad/Zitadel),
[DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) (`Contrato`, máquina de estados 3,
invariante 4), [DOC-005](../base-patrimonial/DOC-005-modelo-patrimonial.md) (`Activo`, máquina de
estados 4), [DOC-006](../core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md) (convenciones
de API CIS↔CORE que este documento extiende — `correlationId`, `idempotencyKey`, formato de
error), [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 3 (cero confianza, permisos mínimos) y 11
(matriz de entradas oficiales, Tomo III Cap.1).
