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
[DOC-021](../ccp/aidlc-docs/design-artifacts/DOC-021-cobertura-ccp-y-administrador-sistema.md).
Único caso de este repo con autorización server-side en dos niveles distintos según el endpoint:
`POST /organizaciones` (solo `administrador-sistema`, vía el Orquestador de CORE — mismo patrón
que el resto) y `GET/POST /organizaciones/:orgId/usuarios` (guard normal de CIS,
`AdministradorSistemaGuard` — no pasa por CORE, es gestión de identidad en Zitadel, no información
patrimonial auditable por Tomo IV). `POST/PATCH /contratos` generalizado para aceptar este rol
además de `administrador-patrimonial` (Tomo III 1.4 no le quita esa capacidad al Profesional de
AFT). Integración real con la API de administración de Zitadel para asignar usuarios —
`cis/src/zitadel-admin/`, shapes de la API sin verificar todavía contra una instancia real (ver
nota en ese módulo).

## Capacidades previstas
Autenticación, refresh/expiración de sesión, RBAC, segregación por organización, segregación
por área, auditoría de accesos, rate limiting, TLS, gestión de secretos, políticas de
contraseña, protección de APIs, logs de acceso.

## Depende de
Más datos reales de Base Patrimonial (hoy solo un caso precargado) y mapeo operador→organización
(membership real de Zitadel) para que `GET /entitlements` deje de devolver el mismo resultado a
cualquier operador — ver DOC-004 7.

## Bloquea
CIS (validar `sedeId`/contrato vigente en cada request — ver ADR-002), CORE (autorización), WEB
(roles/permisos), APP QR (login de operador — TASK futura).

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
