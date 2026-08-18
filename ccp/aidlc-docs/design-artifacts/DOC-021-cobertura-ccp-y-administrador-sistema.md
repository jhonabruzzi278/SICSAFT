# DOC-021: Cierre de gaps del CCP + Administrador del Sistema

> **Estado**: diseño (2026-08-18), en construcción el mismo día. Cierra los 5 gaps que
> [DOC-012 § "Cobertura real desde el CCP hoy"](../../../seguridad/DOC-012-administrador-patrimonial.md)
> documentó, y agrega un rol nuevo — **Administrador del Sistema** — para las capacidades que el
> Profesional de AFT no debe tener: crear organizaciones, crear contratos (además del Profesional
> de AFT, que ya podía), asignar usuarios a organizaciones (integración real con la API de
> administración de Zitadel) y ver indicadores de plataforma. Aclaración explícita del usuario del
> proyecto (2026-08-18, no cita textual de tomo): "el admin nunca toca información [patrimonial],
> es la capa solamente de administración del sistema".

## 1. Por qué un rol nuevo y no extender `administrador-patrimonial`

El Profesional de AFT (`administrador-patrimonial`) administra **información patrimonial**
(activos, catálogo, documentos). El Administrador del Sistema administra **la plataforma**
(organizaciones, contratos, usuarios, indicadores). Son responsabilidades distintas — mezclarlas
en un solo rol le daría a cualquiera de los dos más permiso del que necesita (viola mínimo
privilegio, `seguridad/README.md` § "Permisos previstos"). Se crea `administrador-sistema` como
segundo rol de Proyecto en Zitadel, mismo mecanismo ya usado para `directivo` (DOC-020) —
**sin cambios en `ZitadelAuthGuard`**, es genérico por nombre de rol.

## 2. Hallazgo que cambia el diseño de autorización de Contrato

`OrquestadorService.ejecutarOperacionOficial` (`core/src/orquestador/orquestador.service.ts`)
tenía `verificarRolAdministradorPatrimonial` hardcodeado — y `Contrato` (alta/cambio de estado) ya
pasaba por ahí, es decir **crear un contrato ya requería el rol `administrador-patrimonial`**
(Tomo III §1.4 se lo exige al Profesional de AFT, DOC-012 §7 — no se le quita esa capacidad). Para
que Administrador del Sistema también pueda crear contratos, se generaliza el chequeo:

```ts
// core/src/common/auth/administrador-patrimonial.guard.ts
export const ADMINISTRADOR_SISTEMA_ROLE = 'administrador-sistema';

export function verificarRolesPermitidos(
  rolesPorOrganizacion: unknown,
  organizacionId: string,
  rolesPermitidos: readonly string[],
): void { /* misma lógica que antes, generalizada a N roles */ }

// wrapper existente — cero cambios en los callers de Activo/Área/Ubicación/Responsable/Catálogo/Documento:
export function verificarRolAdministradorPatrimonial(r: unknown, o: string) {
  return verificarRolesPermitidos(r, o, [ADMINISTRADOR_PATRIMONIAL_ROLE]);
}
```

`ejecutarOperacionOficial`/`ejecutarEscrituraOficial` ganan un parámetro opcional
`verificarRol: (r: unknown, o: string) => void = verificarRolAdministradorPatrimonial` (default =
comportamiento actual, sin tocar ningún caller existente). Solo `procesarAltaContrato`/
`procesarActualizacionContrato` pasan `[ADMINISTRADOR_PATRIMONIAL_ROLE, ADMINISTRADOR_SISTEMA_ROLE]`.
Los endpoints puramente administrativos nuevos (Organización) usan solo
`[ADMINISTRADOR_SISTEMA_ROLE]` — el Profesional de AFT no puede crear organizaciones, cerrando el
círculo en ambos sentidos.

## 3. Modelo de datos nuevo

**Migración** (`core/migrations/`, siguiente timestamp libre):
- `ALTER TABLE activos ADD COLUMN descripcion text` (nullable) — gap "descripciones".
- `CREATE TABLE documentos_activo (id, activo_id FK → activos, organizacion_id, tipo CHECK IN
  ('documento','fotografia'), url text NOT NULL, descripcion text, creado_en timestamptz DEFAULT
  now(), creado_por text)` — gap "documentación y fotografías", versión mínima: `url` es un enlace
  externo que el operador ya subió a algún lado (sin bucket propio todavía, ver
  `ROADMAP.md` Fase 7 § "Idea futura sin diseñar"). Esta tabla **no** es parte de la BPI oficial
  (metadata operativa, no historial patrimonial) — a diferencia de `activos`, sí admite `DELETE`
  real; no aplica el invariante "nunca elimina" de Tomo III §4.10.
- `catalogo_activos` y `organizaciones` **ya existen** (Fase 1/Fase 0) — sin migración nueva, solo
  repository/endpoints nuevos sobre las tablas existentes (gaps "familias/categorías" y las
  capacidades de Administrador del Sistema sobre Organización).

## 4. Contratos de API nuevos

### CORE (todos vía `Orquestador`, verificador default salvo que se indique otro)

| Endpoint | Verificador | Repository |
|---|---|---|
| `POST /activos/:id/baja`, `:id/reincorporacion`, `PATCH :id/responsable` | default | ya existen (DOC-012 §5) |
| `PATCH /activos/:id/descripcion` | default | `ActivoRepository.actualizarDescripcion` (nuevo) |
| `GET /catalogo-tipos` (lectura abierta) / `POST /catalogo-tipos` | default | `CatalogoTipoActivoRepository` (nuevo) |
| `POST/GET/DELETE /activos/:id/documentos[/:documentoId]` | default | `DocumentoActivoRepository` (nuevo) |
| `GET /organizaciones` (lectura abierta) / `POST /organizaciones` | `[ADMINISTRADOR_SISTEMA_ROLE]` | `OrganizacionRepository` (nuevo, en `entitlements/`) |
| `POST /contratos`, `PATCH /contratos/:id` | `[ADMINISTRADOR_PATRIMONIAL_ROLE, ADMINISTRADOR_SISTEMA_ROLE]` | ya existe, solo cambia el verificador |
| `GET /indicadores` (lectura abierta) | — | `IndicadoresRepository` (nuevo, módulo `core/src/indicadores/`) — conteo de organizaciones, contratos por estado, sedes |

`GET /catalogo` (listado de activos, ya existente) **no se toca** — `catalogo-tipos` es un nombre
deliberadamente distinto para evitar ambigüedad con el catálogo de tipos/familias.

### CIS (`cis/src/administrador/`, mismo patrón que Área/Ubicación/Responsable)

Puentes 1:1 de la tabla de arriba bajo `/admin/*`, más el módulo nuevo `cis/src/zitadel-admin/`
(cliente de la API de administración de Zitadel — client credentials grant, mismo esqueleto que
`core-client`/`cip-client`: config + service con circuit breaker/retry + types) con:

- `GET /admin/organizaciones/:orgId/usuarios` — lista grants de usuarios en la organización.
- `POST /admin/organizaciones/:orgId/usuarios` — `{ email, rol }`, crea el grant en Zitadel.

Guard nuevo `AdministradorSistemaGuard` (`CanActivate` real en CIS, no el patrón "verificar
dentro del Orquestador") — esto no toca CORE ni el Motor de Auditoría de Tomo IV, es gestión de
usuarios en Zitadel, un guard normal de CIS alcanza.

### WEB

`cis-client.ts` (métodos nuevos 1:1), `oidc-client.ts` (`esAdministradorSistema()`),
`ActivosPage.tsx` (baja/reincorporación/responsable/descripción/documentos/catálogo real),
`ImportacionesPage.tsx` (nueva — CSV client-side, sin dependencia nueva), `AdminPage.tsx` (nueva —
Organizaciones/Contratos/Usuarios/Indicadores en una sola pantalla, mismo patrón multi-sección que
`EstructuraPage.tsx`), `HubPage.tsx` (módulo "Administración" cuando `esAdministradorSistema()`).

## 5. Fuera de alcance de este incremento

- Bucket/OCR real para documentos — `documentos_activo.url` es un enlace externo pegado a mano,
  no un upload. Ver `ROADMAP.md` Fase 7 § "Idea futura sin diseñar".
- Edición/eliminación de usuarios ya asignados, roles compuestos, búsqueda de usuarios por texto
  parcial — el v1 de "asignar usuarios" es alta por email exacto.
- Indicadores de infraestructura (latencia, errores, uptime) — eso es Prometheus/Grafana
  (`devops/README.md` § "Cyberseguridad del VPS"), no una feature de aplicación.

## 6. Documentos relacionados

[DOC-012](../../../seguridad/DOC-012-administrador-patrimonial.md) (rol Profesional de AFT, tabla
de cobertura que este documento cierra). [DOC-020](DOC-020-segmentacion-por-rol-directivo.md)
(precedente de rol nuevo sin tocar `ZitadelAuthGuard`). [ADR-002](../../../adr/ADR-002-identidad-zitadel-multi-tenant.md)
(modelo de roles/claim). [DOC-004](../../../base-patrimonial/DOC-004-modelo-contrato.md) (modelo
de Contrato que este documento extiende con un segundo rol autorizado).
