# DOC-024: CRUD completo sin Consola de Zitadel, auditoría de identidad y matriz de roles

> **Estado**: implementado (2026-08-21) — CORE, CIS y `web_admin/` verificados de punta a punta
> contra Docker/Zitadel reales, ver `core/README.md`, `cis/README.md` y `web_admin/README.md`
> "Estado" para el detalle. Diseñado el 2026-08-20. Motivado por un pedido explícito
> del usuario tras cerrar el flujo Admin→Directivo→Profesional AFT (DOC-021/022/023 + el
> incremento de gaps de esta misma sesión): que la Consola de Zitadel deje de ser necesaria para
> operar el día a día, que existan los CRUD que faltan (editar y dar de baja, no solo crear), que
> el flujo quede "más automatizado" y con "un modelo de datos bien estructurado", y una matriz de
> roles visible en `web_admin`.

## 1. Por qué `estado`, nunca `DELETE`, para Organización/Sede

`organizaciones` y `sedes` no tenían columna de estado hasta este incremento — solo se podían
crear, nunca dar de baja. La tentación obvia sería agregar un `DELETE`, pero eso choca con un
invariante ya citado en este mismo código: el comentario de
`core/migrations/1755800000000_gaps-ccp-y-admin-sistema.ts` sobre `documentos_activo` dice
explícitamente que esa tabla "admite DELETE real; no aplica el invariante 'nunca elimina' de
**Tomo III 4.10**" — es decir, todo lo que Tomo III 4.10 sí cubre (los registros oficiales de la
Base Patrimonial, `base-patrimonial/DOC-004-modelo-contrato.md` 2: Organización, Sede, Contrato)
**no puede borrarse nunca**, ni siquiera por un Administrador del Sistema.

El precedente ya existe en el propio esquema: `activos.estado` agregó `'inactivo'` y
`'mantenimiento'` vía migración aditiva (`1755400000000_estados-mantenimiento-inactivo.ts`) en vez
de un DELETE, y `responsables` ya tiene `PATCH /responsables/:id/estado` bidireccional. Este
incremento aplica el mismo patrón a Organización y Sede: `estado text NOT NULL DEFAULT 'activo'
CHECK (estado IN ('activo','inactivo'))`, reversible, nunca DELETE.

**Explícitamente sin cascada**: desactivar una Organización o una Sede es solo una bandera de
bookkeeping en CORE. No desactiva la organización en Zitadel, no cambia el `estado` de ningún
Contrato existente, no filtra ninguna lectura. Cortar el acceso real de una organización sigue
siendo, como ya era, un cambio de `estado` de su Contrato (`vigente` → `suspendido`/`cancelado`).
Cada máquina de estados de este ecosistema (Activo, Contrato, Responsable) ya es independiente de
las demás — mezclar "Organización inactiva" con "sus Contratos dejan de ser válidos" sería una
cascada implícita y sorpresiva que nadie pidió, y que sería mucho más difícil de deshacer que dos
cambios de estado explícitos.

## 2. Por qué Contrato separa "estado" de "condiciones"

`PATCH /contratos/:id` ya existe y ya está testeado — valida una máquina de estados explícita
(`vigente → suspendido/vencido/cancelado`, ver `contrato.repository.ts`). Este incremento agrega la
posibilidad de editar `vigencia_hasta`, `modulos_contratados` y las sedes cubiertas (algo que hoy
solo se puede hacer una vez, al crear el contrato) — pero como endpoint nuevo,
`PATCH /contratos/:id/condiciones`, no como un campo más del body existente. Mezclar ambas
validaciones en un solo endpoint arriesgaría el comportamiento ya probado de la transición de
estados por una razón no relacionada. `vigencia_desde` queda deliberadamente fuera de lo editable
— mover retroactivamente la fecha de inicio de un contrato no es un caso de uso real, y el
invariante DOC-004 4 ("una sede, un contrato vigente") se vuelve a chequear cuando cambian las
sedes cubiertas, excluyendo las filas del propio contrato que se está editando.

## 3. Por qué la auditoría de identidad entra a la misma tabla `auditoria`

DOC-021 4 y DOC-022 4 ya habían decidido, con buena razón en su momento, que la gestión de
identidad en Zitadel (asignar un rol, designar un Profesional de AFT) **no** pasa por
`OrquestadorService` ni por el Motor de Auditoría de Tomo IV: "no toca CORE, un guard de CIS
alcanza". Ese razonamiento sigue siendo válido para la autorización (los guards de CIS siguen
cortando exactamente igual), pero deja un punto ciego real: **hoy no hay ningún registro de quién
asignó o quitó un rol, ni de quién creó una organización en Zitadel** — todo lo que sí pasa por
CORE (Activo, Contrato, Sede, Área, Ubicación, Responsable, y el propio alta de Organización en su
mitad CORE) ya se audita automáticamente, siempre, éxito o rechazo, vía
`OrquestadorService.ejecutarOperacionOficial`/`ejecutarEscrituraOficial`. Los dos únicos flujos que
quedaban afuera son exactamente los que nunca tocan CORE: `asignarUsuarioOrganizacion` (`web_admin`)
y `asignarProfesionalAft` (Directivo).

Este incremento revisa esa decisión, no la revierte: la autorización sigue resolviéndose en los
guards de CIS (no se tocan `AdministradorSistemaGuard`/`DirectivoGuard`), pero el **resultado** de
la operación ahora se reporta a CORE para que quede en el mismo lugar que todo lo demás. Se agrega
una columna `categoria text CHECK (categoria IN ('patrimonial','identidad'))` (default
`'patrimonial'`, así que ninguna fila existente cambia de significado) y `organizacion_id text
REFERENCES organizaciones(id)` (nullable — no todo evento tiene una organización puntual, ej. el
alta de Organización en sí) a la tabla `auditoria` existente, en vez de crear una tabla o un
endpoint de lectura paralelo. Un solo `GET /auditoria` sigue siendo la única fuente para "qué pasó
en esta plataforma", filtrable por categoría y por organización.

**Mecanismo en CIS**: un módulo nuevo, `cis/src/auditoria-identidad/`, con un
`AuditoriaIdentidadService.ejecutar(...)` que es un calco deliberado de
`ejecutarOperacionOficial` — ejecuta la acción, reporta el resultado a CORE (`POST /auditoria`)
siempre, éxito o rechazo, nunca atrapa un fallo del propio reporte (mismo perfil de riesgo que ya
acepta el código existente: si `AuditoriaRepository.registrar` fallara hoy, tampoco hay un
mecanismo especial). No audita rechazos de guard — eso requeriría convertir
`AdministradorSistemaGuard`/`DirectivoGuard` al patrón de DOC-012 8 (verificar rol dentro del
método en vez de un `CanActivate`), un cambio mucho más grande que no fue pedido y que queda
explícitamente fuera de este incremento.

## 4. Matriz de roles: solo lectura, no un motor de roles nuevo

Decidido explícitamente con el usuario (no una inferencia): la pantalla nueva en `web_admin` es una
vista de solo lectura de los 3 roles fijos que ya existen (`administrador-patrimonial`,
`administrador-sistema`, `directivo`) y qué puede hacer cada uno — en la práctica,
[DOC-023](DOC-023-matriz-permisos-rbac.md) 2 convertido en pantalla, transcrito a una constante en
`web_admin/src/lib/matriz-permisos.ts`. No hay tabla de roles/permisos configurable, no hay forma
de crear un cuarto rol desde la UI — eso reemplazaría un supuesto que hoy está escrito a mano en
cada guard de `cis/`/`core/` y es un cambio de arquitectura real que se evaluó y se descartó por
tamaño frente a lo que se pidió.

## 5. Fuera de alcance de este incremento

- Cascada de estado entre Organización/Sede y sus Contratos (ver 1) — explícitamente no.
- Auditar rechazos de guard en `AdministradorSistemaGuard`/`DirectivoGuard` (ver 3) — requiere el
  patrón DOC-012 8, incremento aparte si se decide que hace falta.
- Motor de roles/permisos dinámico (ver 4).
- Borrar una Organización de Zitadel — no existe ese endpoint en esta versión de Zitadel
  (confirmado contra la instancia real de `devops/local`), y aunque existiera, Tomo III 4.10 lo
  prohibiría para los registros ya replicados en CORE.

## Documentos relacionados

- [DOC-004](../../../base-patrimonial/DOC-004-modelo-contrato.md) — modelo de Organización/Sede/
  Contrato, invariante "una sede, un contrato vigente".
- [DOC-011](../../core/design-artifacts/DOC-011-motor-auditoria.md) — diseño original del Motor de
  Auditoría (en `aidlc-docs/core/`) que este documento extiende con `categoria`.
- [DOC-021](DOC-021-cobertura-ccp-y-administrador-sistema.md) / [DOC-022](DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md)
  — decisión original de mantener la gestión de identidad fuera de CORE, revisada en 3.
- [DOC-023](DOC-023-matriz-permisos-rbac.md) — matriz Rol × Módulo × Acción que la pantalla nueva
  de `web_admin` transcribe.

## Próximo paso sugerido

Implementado en el orden planeado: migración de esquema → CORE (auditoría → Organización → Sede →
Contrato condiciones) → CIS (verificado contra Zitadel real antes de codear revocación/baja de
usuario → wrapper de auditoría de identidad → endpoints) → `web_admin`. `core/README.md`,
`cis/README.md` y `web_admin/README.md` actualizados.

Lo que queda explícitamente abierto para un incremento futuro, no por olvido:
- **4 de DOC-023** ("lecturas sin distinción de rol") sigue sin resolver — no lo tocó este
  incremento.
- Una pantalla de Auditoría en `web_admin/` (hoy `GET /admin/auditoria` existe en CIS pero ningún
  frontend lo consume) — sería el consumidor natural de la nueva columna `categoria` para mostrar
  "identidad" junto a "patrimonial" en un solo lugar.
- Exponer `categoria`/`organizacionId` en el contrato de `CoreClientService.getAuditoria` de CIS
  (`auditoriaEntradaSchema`) — no se hizo en este incremento porque nada los consume todavía; Zod
  los descarta en silencio de la respuesta de CORE sin fallar, así que no es una deuda urgente.
- Auditar rechazos de guard (`AdministradorSistemaGuard`/`DirectivoGuard`) — requeriría el patrón
  DOC-012 8, cambio de arquitectura más grande que no fue pedido (ver 3).
