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
`Contrato` ya está documentado —
[`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md).
Lo que sigue sin implementar: CORE (no existe todavía) sirviendo ese modelo, y con eso la
validación real de `sedeId`/vigencia de contrato en el CIS (el token solo trae `sub`/identidad,
no sede — ver ADR-002 §"Punto de validación").

## Permisos previstos
Consultar, crear, modificar, eliminar, autorizar, exportar, administrar, configurar — bajo
principio de mínimo privilegio necesario.

## Capacidades previstas
Autenticación, refresh/expiración de sesión, RBAC, segregación por organización, segregación
por área, auditoría de accesos, rate limiting, TLS, gestión de secretos, políticas de
contraseña, protección de APIs, logs de acceso.

## Depende de
Que exista CORE (aunque sea un esqueleto) sirviendo el modelo de `Contrato` ya documentado
(DOC-004) — sin eso, CIS no tiene de dónde resolver `sedeId`/vigencia real.

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
Modelo de `Contrato` ya documentado (DOC-004) — el siguiente paso es un esqueleto mínimo de CORE
que lo sirva (`GET /entitlements`, ver DOC-004 §6) para que CIS deje de usar el seed fijo en
`auth/session`.
