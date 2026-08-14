# DOC-012: Administrador Patrimonial — rol y camino de escritura oficial

> **Estado**: diseño, sin código todavía (Fase 4 del [ROADMAP.md](../ROADMAP.md)). Formaliza el
> rol que Tomo III §1.4 Entrada 4 define como único autorizado a modificar oficialmente la Base
> Patrimonial — hoy no existe en ningún sistema del ecosistema
> ([`seguridad/README.md`](README.md) § "Rol pendiente"). Complementa
> [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (mecanismo de identidad),
> [DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) (modelo de `Contrato`, hoy solo se
> lee), [DOC-005](../base-patrimonial/DOC-005-modelo-patrimonial.md) (modelo de `Activo` y su
> máquina de estados) y [DOC-006](../core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md)
> (convenciones de API CIS↔CORE que este documento extiende, no reemplaza).

## 1. Por qué esto y no antes

Antes de la Fase 2 no había motores sobre los que escribir; después de la Fase 3 (CIS real + APP
QR verificado) es el bloqueador real: **hoy no hay ninguna forma legítima de meter un activo real
al sistema** — todo lo que existe en Postgres es seed de desarrollo (`1755100000001_seed-dev-fixture-patrimonial.ts`). APP QR y RFID solo pueden *leer* el catálogo y *registrar inventarios*
(Tomo III §1.4: "no puede modificar la Base Patrimonial Oficial") — el único camino de entrada
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

## 3. Qué valida CIS vs qué autoriza CORE (WAF §3 — cero confianza entre niveles)

Ninguno de los dos niveles delega ciegamente en el otro:

1. **CIS solo transporta un hecho ya firmado, no decide autorización.** `ZitadelAuthGuard`
   (`cis/src/common/auth/zitadel-auth.guard.ts`) ya valida firma/`iss`/`aud`/vencimiento del JWT
   — se extiende para además leer `urn:zitadel:iam:org:project:roles` y exponer
   `request.auth.roles: string[]` (vacío si el claim no viene, nunca un error — la mayoría de los
   requests de CIS no lo necesitan). CIS **nunca** decide "este usuario puede escribir" — solo
   certifica "Zitadel firmó un token que dice que este usuario tiene este rol".
2. **CORE es quien autoriza cada escritura, siempre.** Los endpoints nuevos de escritura oficial
   (§5–§7) exigen un `AdministradorPatrimonialGuard` propio en CORE que revisa `roles` en el
   payload de la request — el mismo patrón de "cero confianza" que ya existe entre CIS→CORE hoy
   (`ServiceTokenGuard`, secreto compartido `CORE_SERVICE_TOKEN`): el secreto de servicio prueba
   que la llamada viene de una instancia legítima de CIS, pero **no** prueba que el usuario final
   tenga el rol — eso lo re-verifica CORE contra el campo `roles` que CIS reenvía, nunca confiando
   en que "si CIS dejó pasar el request, ya está autorizado". Esto es exactamente lo que pide el
   ROADMAP: *"CORE no confía en un scope que no validó CIS, pero tampoco delega la autorización de
   escritura"*.
3. **CIS reenvía `operadorId` + `roles` en el body de cada llamada de escritura oficial hacia
   CORE** (mismo mecanismo que ya usa para `organizacionId`/`areaId` en `POST /inventarios`, ver
   DOC-006 §3) — no hay canal nuevo que inventar, es el mismo canal service-to-service ya
   protegido por `CORE_SERVICE_TOKEN`.

## 4. Gestión de Permisos — las 8 acciones (Tomo IV §2.14)

Alcance mínimo para esta fase: aplicar las 8 acciones (`Consultar, Crear, Modificar, Eliminar,
Autorizar, Exportar, Administrar, Configurar`) solo al recurso `Activo` y `Contrato`, no a los 11
dominios completos de DOC-005 (mismo criterio YAGNI que recortó DOC-005 §8).

| Acción | Recurso | Endpoint (§5–§7) | Quién más puede |
|---|---|---|---|
| Crear | Activo | `POST /activos` (alta) | Nadie — solo Administrador Patrimonial |
| Eliminar | Activo | `POST /activos/:id/baja` | Nadie |
| Modificar | Activo | `POST /activos/:id/reincorporacion`, `PATCH /activos/:id/responsable` | Nadie |
| Crear | Activo (masivo) | `POST /importaciones/contable` | Nadie (Fase 7 lo automatiza, no lo reemplaza) |
| Crear/Modificar | Contrato | `POST /contratos`, `PATCH /contratos/:id` | Nadie |
| Consultar | Activo/Contrato | `GET /catalogo`, `GET /entitlements` (ya existen) | APP QR, WEB, RFID (Tomo III §1.4 ya se lo permite) |
| Autorizar/Exportar/Administrar/Configurar | — | Sin endpoint todavía | Fuera de alcance de esta fase — sin consumidor real (WEB Fase 5 los va a necesitar para su propio ABM, no antes) |

**Matriz WAF §11 sin excepciones**: APP QR y RFID conservan exactamente los mismos permisos de
hoy (lectura + registro de inventarios) — ningún cambio de esta fase les da acceso de escritura
oficial, ni siquiera si el operador tuviera el rol (el rol solo existe/se valida en los endpoints
nuevos, las 4 rutas de DOC-006 no lo piden ni lo aceptan).

## 5. Extensión del Motor Patrimonial — ciclo de vida de `Activo`

Implementa la máquina de estados **ya documentada** en DOC-005 §4 "Estados de `Activo`"
(`stateDiagram-v2`):
`[*] → activo → en_transito → activo`, `activo → extraviado → activo|dado_de_baja`,
`activo → dado_de_baja` (terminal, la fila nunca se borra — Tomo III §4.10). Traslado
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
propia, es la lectura cronológica de `eventos` por activo (DOC-005 §1, sin cambios).

## 6. Importación de base contable (carga masiva)

Endpoint `POST /importaciones/contable` — recibe un array ya parseado de filas (CSV/Excel se
parsean del lado de quien construyó DOC-013/WEB o un script CLI de este mismo repo, fuera de
alcance de este documento; CORE solo recibe JSON validado, mismo criterio que "CORE no confía en
datos crudos de un cliente" del resto del ecosistema).

- **Idempotente por fila, no por request completo** (a diferencia de `POST /inventarios`, que es
  atómico por sesión): cada fila trae su propio `codigoPatrimonial` — reintentar la misma fila con
  el mismo contenido no duplica; una fila con `codigoPatrimonial` ya existente pero contenido
  distinto se **reporta como conflicto**, nunca sobrescribe en silencio.
- **Nunca elimina** (Tomo III §1.4 Entrada 5: "Nunca elimina información histórica") — una fila
  que ya no aparece en un archivo posterior no da de baja el activo; dar de baja es un acto
  explícito (§5), no una inferencia de ausencia.
- Cada fila pasa por el Motor de Reglas existente (mismas validaciones que la Fase 2, reusando
  `clasificarEscaneo`-equivalente para el caso "alta" en vez de "escaneo").
- Precursor manual y honesto del conector automático `CON-CONTABILIDAD` (Fase 7) — mismo shape de
  payload por fila, para que el conector futuro sea un cliente más de este mismo endpoint, no un
  camino de escritura paralelo (evita repetir el error que la regla no negociable de `CLAUDE.md`
  prohíbe: nadie le escribe a Base Patrimonial sin pasar por CORE).

## 7. Escritura de `Contrato`

Hoy `ContratoRepository` (`core/src/entitlements/`) solo lee. Se agregan:

- `POST /contratos` — alta, valida el invariante de DOC-004 §4 ("una sede, un contrato `vigente`
  a la vez") antes de insertar.
- `PATCH /contratos/:id` — solo transiciones válidas de la máquina de estados de DOC-004 §3
  (`vigente ⇄ suspendido`, `vigente → vencido|cancelado`) — cualquier otra transición es 400.
- Emite evento `contrato.actualizado` (insertado en `eventos`, mismo patrón que el resto del
  ecosistema) — **sin publicación a una cola todavía** (el patrón de outbox transaccional está
  anotado para Fase 6/CIP, no antes: no hay consumidor real de este evento hasta que exista la
  caché de entitlements en CIS, que la Fase 3 dejó explícitamente diferida como opcional). Por
  ahora el evento queda en Auditoría/Eventos como registro, no como disparador activo.

## 8. Auditoría de escritura (sin código nuevo — ya implementado)

El Motor de Auditoría (Fase 2, `core/src/auditoria/`) ya audita "éxito o rechazo" (Tomo IV
§2.15–16) a través del Orquestador Central — los endpoints nuevos de este documento se registran
en el mismo Orquestador, no necesitan un mecanismo de auditoría propio. Lo único nuevo es que un
**403 por falta de rol** también debe pasar por el Orquestador antes de cortar la request (para
que quede en `auditoria` con `resultado: 'rechazado'`), no cortar directo en el guard sin auditar
— diferencia de implementación a tener en cuenta al escribir `AdministradorPatrimonialGuard`
(otros guards de CORE, como `ServiceTokenGuard`, sí cortan antes del Orquestador porque autentican
la conexión CIS↔CORE, no una acción de negocio auditable por usuario).

## 9. Fuera de alcance de esta fase (documentado, no implementado)

- Traslado de activo (`activo ⇄ en_transito`) — DOC-008 ya lo marca sin consumidor real.
- Las 4 acciones restantes de Gestión de Permisos (Autorizar/Exportar/Administrar/Configurar) —
  sin consumidor hasta que WEB (Fase 5) tenga su propio ABM.
- Publicación en cola del evento `contrato.actualizado` (patrón outbox) — anotado para Fase 6.
- Parseo de CSV/Excel en sí — este documento define el contrato JSON que CORE recibe, no dónde se
  parsea el archivo origen.
- UI de ningún tipo — Fase 5 (WEB) es quien va a exponer estos endpoints a un humano; esta fase
  entrega solo la API + autorización + auditoría.

## 10. Done (criterio de aceptación, igual al del ROADMAP)

- Usuario autenticado sin el rol `administrador-patrimonial` recibe 403 en **cada** endpoint de
  este documento — cubierto por test e2e por endpoint.
- Toda escritura (éxito o rechazo) queda en `auditoria` con usuario/operación/resultado.
- Importar el mismo archivo dos veces no duplica ni borra ningún activo (test e2e con el mismo
  payload dos veces).
- `seguridad/README.md` deja de listar el rol como "pendiente" y `ARQUITECTURA-WAF.md` §11
  actualiza la fila de Administrador Patrimonial de "no implementado" a implementado.

## 11. Documentos relacionados

[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (identidad/Zitadel),
[DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) (`Contrato`, máquina de estados §3,
invariante §4), [DOC-005](../base-patrimonial/DOC-005-modelo-patrimonial.md) (`Activo`, máquina de
estados §4), [DOC-006](../core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md) (convenciones
de API CIS↔CORE que este documento extiende — `correlationId`, `idempotencyKey`, formato de
error), [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §3 (cero confianza, permisos mínimos) y §11
(matriz de entradas oficiales, Tomo III Cap.1).
