# Seguridad / Identidad / Permisos SICSAFT (capacidad transversal — SEC)

## Objetivo
No es un sistema aislado: es una capa transversal que atraviesa CIS, CORE, WEB y toda fuente de
captura. Modelo: Usuario → Organización → Contrato (vigencia, módulos, sedes cubiertas) → Sede/
Área → Rol → Permisos → Acción — ver [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md)
para el porqué de agregar "Contrato" al modelo original.

## Estado
🟡 Mecanismo de identidad decidido: **Zitadel, self-hosted, OIDC/OAuth2** — ver
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md). Ya no está bloqueado por la pregunta
de "qué mecanismo de auth" (una de las 4 preguntas abiertas del handoff de APP QR queda
respondida a nivel de mecanismo). Lo que sigue sin implementar: el modelo de dominio de
`Contrato` en Base Patrimonial, y la validación de `sedeId`/vigencia en el CIS.

## Permisos previstos
Consultar, crear, modificar, eliminar, autorizar, exportar, administrar, configurar — bajo
principio de mínimo privilegio necesario.

## Capacidades previstas
Autenticación, refresh/expiración de sesión, RBAC, segregación por organización, segregación
por área, auditoría de accesos, rate limiting, TLS, gestión de secretos, políticas de
contraseña, protección de APIs, logs de acceso.

## Depende de
Modelo de dominio de `Contrato` a diseñar en conjunto con `core/` y `base-patrimonial/` (qué
define un contrato, cómo se asocia a sedes, cómo se versiona su vigencia).

## Bloquea
CIS (validar `sedeId`/contrato vigente en cada request — ver ADR-002), CORE (autorización), WEB
(roles/permisos), APP QR (login de operador — TASK futura).

## Documentos relacionados
[ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md) (mecanismo de identidad, modelo
Organización→Contrato→Sede, flujo de login). Pendiente: DOC-012 detalle de implementación.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §3 (cero confianza entre niveles, permisos
mínimos necesarios, segregación por organización/área validada en el CORE, no solo en el cliente
— ahora extendida a sede/contrato).

## Próximo paso sugerido
Levantar Zitadel en el VPS (ver `../devops/README.md`) y diseñar el modelo de datos de `Contrato`
junto con `core/` y `base-patrimonial/`. Decisión de mecanismo ya no está abierta — lo que queda
es implementación.
