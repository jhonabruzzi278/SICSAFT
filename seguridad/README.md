# Seguridad / Identidad / Permisos SICSAFT (capacidad transversal — SEC)

## Objetivo
No es un sistema aislado: es una capa transversal que atraviesa CIS, CORE, WEB y toda fuente de
captura. Modelo: Usuario → Organización → Contrato (vigencia, módulos, sedes cubiertas) → Sede/
Área → Rol → Permisos → Acción — ver [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md)
para el porqué de agregar "Contrato" al modelo original.

## Estado
🟡 Mecanismo de identidad decidido **e implementado en CIS**: Zitadel, self-hosted, OIDC/OAuth2 —
ver [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md). `cis/src/common/auth/` valida
tokens Zitadel reales (firma/JWKS, `iss`, `aud`, vencimiento) en los 4 endpoints del Conector QR
mock — ya no está bloqueado por la pregunta de "qué mecanismo de auth" (una de las 4 preguntas
abiertas del handoff de APP QR queda respondida a nivel de mecanismo). El modelo de dominio de
`Contrato` también está documentado **e implementado sobre Postgres real**:
[`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md) +
`core/src/entitlements/` sirviendo `GET /entitlements` contra la base `core` (esquema versionado
en `core/migrations/`), ya consumido por CIS en `auth/session`
(`cis/src/core-client/`) y protegido con auth servicio-a-servicio (secreto compartido
`CORE_SERVICE_TOKEN`, `core/src/common/auth/service-token.guard.ts` — comparación en tiempo
constante, CIS es el único llamador válido). Lo que sigue sin resolver: `sedeId`/vigencia de
contrato con **datos reales de negocio** (la base `core` hoy solo tiene el caso DUOC UC/Melipilla
precargado y no hay mapeo operador→organización — cualquier operador ve el mismo resultado hoy,
ver DOC-004 7). El token del operador solo trae `sub`/identidad, no sede — coincide con ADR-002
"Punto de validación": eso se resuelve en CORE, no en el token.

## Permisos previstos
Consultar, crear, modificar, eliminar, autorizar, exportar, administrar, configurar — bajo
principio de mínimo privilegio necesario.

### Rol ✅ implementado: Administrador Patrimonial (Tomo III 1.4, Entrada 4) — nombre funcional: Profesional de AFT
El tomo oficial define un rol que hasta la Fase 4 no existía en ningún sistema del ecosistema: el
**Administrador Patrimonial** (`administrador-patrimonial` es el nombre técnico del rol de
Zitadel; **Profesional de AFT** es el nombre funcional/oficial con el que el negocio identifica a
quien lo ejerce — ver [DOC-012 "Nomenclatura"](DOC-012-administrador-patrimonial.md)), el único
autorizado a modificar oficialmente la Base Patrimonial
(incorporar/eliminar activos, modificar responsables/áreas, actualizar estados oficiales,
importar bases contables). Ninguna otra entrada (APP QR, Plataforma WEB, RFID) puede hacerlo
directamente — ver [ARQUITECTURA-WAF.md 11](../ARQUITECTURA-WAF.md#11-entradas-y-salidas-oficiales-del-ecosistema-tomo-iii-cap1)
para la matriz completa de permisos por entrada. Diseño completo en
[DOC-012](DOC-012-administrador-patrimonial.md). **Ya implementado, las 3 operaciones que Tomo
III 1.4 le exige**: rol de Proyecto en Zitadel, claim
`urn:zitadel:iam:org:project:roles` leído por `ZitadelAuthGuard` en CIS y reenviado como
`rolesPorOrganizacion` (nunca una lista plana sin organización — corrige un hallazgo real de
revisión de seguridad), autorización verificada en CORE por organización dentro de
`OrquestadorService`, los 4 endpoints de escritura de `Activo` (alta/baja/reincorporación/
cambio de responsable, `core/src/patrimonial/activo-escritura.controller.ts`), importación masiva
idempotente por fila de base contable (`POST /importaciones/contable`,
`core/src/patrimonial/importacion-contable.service.ts`, precursor manual de `CON-CONTABILIDAD`) y
escritura de `Contrato` (`POST /contratos`, `PATCH /contratos/:id`,
`core/src/entitlements/contrato-escritura.controller.ts` + `escritura-contrato.service.ts`).
**Pendiente**: las 4 acciones restantes de Gestión de Permisos (Autorizar/Exportar/Administrar/
Configurar) — sin consumidor real hasta que WEB (Fase 5) tenga su propio ABM.

### Rol ✅ implementado: Administrador del Sistema (DOC-021, sin fuente en un tomo — vision del usuario 2026-08-18)
Segundo rol de Proyecto en Zitadel (`administrador-sistema`), administra la **plataforma**
(organizaciones, contratos además del Profesional de AFT, usuarios, indicadores) — nunca
información patrimonial (Activos/Catálogo/Documentos siguen exclusivos de
`administrador-patrimonial`, y simétricamente el Profesional de AFT nunca administra la
plataforma). Diseño completo en
[DOC-021](../ccp/aidlc-docs/design-artifacts/DOC-021-cobertura-ccp-y-administrador-sistema.md),
extraído a su propio portal (`web_admin/`) por
[DOC-022](../ccp/aidlc-docs/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md).
Único caso de este repo con autorización server-side en dos niveles distintos según el endpoint:
`POST /organizaciones` (verifica el rol en **cualquier** organización del token, vía el
Orquestador de CORE — `verificarRolEnCualquierOrganizacion`, DOC-022 2, no una organización
puntual como el resto de las escrituras oficiales) y `GET/POST /organizaciones/:orgId/usuarios`
(guard normal de CIS, `AdministradorSistemaGuard` — no pasa por CORE, es gestión de identidad en
Zitadel, no información patrimonial auditable por Tomo IV). `POST/PATCH /contratos` generalizado
para aceptar este rol además de `administrador-patrimonial` (Tomo III 1.4 no le quita esa
capacidad al Profesional de AFT). Integración real con la API de administración de Zitadel para
asignar usuarios — `cis/src/zitadel-admin/`, **verificada real contra una instancia de Zitadel el
2026-08-19** (DOC-022 4): corrigió dos bugs genuinos que la documentación pública no revelaba
(`listarGrants` pedía un filtro de organización que la API real no tiene; `crearGrant` no sabía
sumar un rol a un usuario que ya tenía otro rol en el mismo proyecto) — ver `cis/README.md`.

### Rol ✅ implementado: Directivo (DOC-020, reestructurado por DOC-022 3/4 el 2026-08-19)
Tercer rol de Proyecto en Zitadel (`directivo`) — el de **mayor privilegio a nivel de
organización**: dashboard ejecutivo de solo lectura (RF-09/DOC-019) y designación de quién es el
Profesional de AFT de su propia organización (`administrador-patrimonial`). Nunca información
patrimonial en sí (Activos/Catálogo/Documentos exclusivos del Profesional de AFT en CCP) ni
administración de plataforma (exclusiva del Administrador del Sistema en `web_admin/`). Portal
propio (`core/frontend/`, ver ese README) — hasta DOC-022 vivía dentro de CCP con una redirección
automática al Dashboard (DOC-020, superado). El límite de organización es **estructural, no solo
verificado por tests**: `DirectivoGuard` (`cis/src/directivo/directivo.guard.ts`) nunca acepta un
organizacionId de ruta o body para este rol, siempre lo deriva del propio JWT — si el rol
`directivo` no aparece en exactamente una organización del token, rechaza con 403. Mismo enfoque
de autorización en dos niveles que Administrador del Sistema: `GET/POST /directivo/usuarios` es
gestión de identidad en Zitadel (guard normal de CIS, no pasa por CORE), reusando el mismo
`ZitadelAdminService` verificado real (ver arriba). Diseño completo en
[DOC-022](../ccp/aidlc-docs/design-artifacts/DOC-022-reestructuracion-portales-ccp-webadmin-directivo.md).
La tercera capacidad que el usuario mencionó para este rol ("valida") queda explícitamente fuera
de alcance — sin tomo ni definición todavía, ver DOC-022 "Fuera de alcance".

## Mapeo rol → portal → hostname (local)

| Rol (Zitadel) | Nombre funcional | Portal | Hostname (local) |
|---|---|---|---|
| `administrador-patrimonial` | Profesional de AFT | `ccp/` | `ccp.sicsaft.localhost` |
| `administrador-sistema` | Administrador del Sistema | `web_admin/` | `admin.sicsaft.localhost` |
| `directivo` | Directivo | `core/frontend/` | `directivo.sicsaft.localhost` |

Tres portales, tres roles, tres logins — nunca uno compartido (DOC-022, regla no negociable de
`CLAUDE.md`). Los tres son SPAs independientes contra el mismo proyecto "CIS" de Zitadel, cada uno
con su propia Application OIDC (ver `devops/local/README.md` "Cliente OIDC real" para cada uno).

## Capacidades previstas
Autenticación, refresh/expiración de sesión, RBAC, segregación por organización, segregación
por área, auditoría de accesos, rate limiting, TLS, gestión de secretos, políticas de
contraseña, protección de APIs, logs de acceso.

## Depende de
Más datos reales de Base Patrimonial (hoy solo un caso precargado) y mapeo operador→organización
(membership real de Zitadel) para que `GET /entitlements` deje de devolver el mismo resultado a
cualquier operador — ver DOC-004 7.

## Bloquea
CIS (validar `sedeId`/contrato vigente en cada request — ver ADR-002), CORE (autorización), los
tres portales WEB (`ccp/`, `web_admin/`, `core/frontend/` — roles/permisos), APP QR (login de
operador — TASK futura).

## Documentos relacionados
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (mecanismo de identidad, modelo
Organización→Contrato→Sede, flujo de login).
[`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md)
(modelo de `Contrato` — entidades, estados, invariantes, cómo lo consume CIS).
[DOC-012](DOC-012-administrador-patrimonial.md) — diseño del rol Administrador Patrimonial y el
camino de escritura oficial (Fase 4 del ROADMAP), items 1/3/4/5 implementados, ver "Estado" de
este documento.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 3 (cero confianza entre niveles, permisos
mínimos necesarios, segregación por organización/área validada en el CORE, no solo en el cliente
— ahora extendida a sede/contrato).

## Próximo paso sugerido
El círculo CIS↔CORE↔`Contrato` ya está cerrado, protegido y sobre Postgres real (DOC-004,
`core/src/entitlements/`, `cis/src/core-client/`, secreto compartido). El siguiente paso con
valor real es que CORE tenga más datos reales (resto de los 11 dominios, DOC-005) y motores
reales sobre los que aplicar todo esto — hoy solo `Contrato`/`Sede`/`Organizacion` tienen tabla.
