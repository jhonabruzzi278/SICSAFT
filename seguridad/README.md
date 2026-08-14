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
ver DOC-004 §7). El token del operador solo trae `sub`/identidad, no sede — coincide con ADR-002
§"Punto de validación": eso se resuelve en CORE, no en el token.

## Permisos previstos
Consultar, crear, modificar, eliminar, autorizar, exportar, administrar, configurar — bajo
principio de mínimo privilegio necesario.

### Rol pendiente: Administrador Patrimonial (Tomo III §1.4, Entrada 4)
El tomo oficial define un rol que hoy no existe en ningún sistema del ecosistema: el
**Administrador Patrimonial**, el único autorizado a modificar oficialmente la Base Patrimonial
(incorporar/eliminar activos, modificar responsables/áreas, actualizar estados oficiales,
importar bases contables). Ninguna otra entrada (APP QR, Plataforma WEB, RFID) puede hacerlo
directamente — ver [ARQUITECTURA-WAF.md §11](../ARQUITECTURA-WAF.md#11-entradas-y-salidas-oficiales-del-ecosistema-tomo-iii-cap1)
para la matriz completa de permisos por entrada. No implementado todavía: no hay rol Zitadel
dedicado ni endpoint en CORE que distinga este nivel de escritura del resto.

## Capacidades previstas
Autenticación, refresh/expiración de sesión, RBAC, segregación por organización, segregación
por área, auditoría de accesos, rate limiting, TLS, gestión de secretos, políticas de
contraseña, protección de APIs, logs de acceso.

## Depende de
Más datos reales de Base Patrimonial (hoy solo un caso precargado) y mapeo operador→organización
(membership real de Zitadel) para que `GET /entitlements` deje de devolver el mismo resultado a
cualquier operador — ver DOC-004 §7.

## Bloquea
CIS (validar `sedeId`/contrato vigente en cada request — ver ADR-002), CORE (autorización), WEB
(roles/permisos), APP QR (login de operador — TASK futura).

## Documentos relacionados
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (mecanismo de identidad, modelo
Organización→Contrato→Sede, flujo de login).
[`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md)
(modelo de `Contrato` — entidades, estados, invariantes, cómo lo consume CIS). Pendiente: DOC-012
detalle de implementación.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §3 (cero confianza entre niveles, permisos
mínimos necesarios, segregación por organización/área validada en el CORE, no solo en el cliente
— ahora extendida a sede/contrato).

## Próximo paso sugerido
El círculo CIS↔CORE↔`Contrato` ya está cerrado, protegido y sobre Postgres real (DOC-004,
`core/src/entitlements/`, `cis/src/core-client/`, secreto compartido). El siguiente paso con
valor real es que CORE tenga más datos reales (resto de los 11 dominios, DOC-005) y motores
reales sobre los que aplicar todo esto — hoy solo `Contrato`/`Sede`/`Organizacion` tienen tabla.
