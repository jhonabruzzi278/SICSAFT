# Seguridad / Identidad / Permisos SICSAFT (capacidad transversal — SEC)

## Objetivo
No es un sistema aislado: es una capa transversal que atraviesa CIS, CORE, WEB y toda fuente de
captura. Modelo: Usuario → Rol → Permisos → Organización → Área → Acción.

## Estado
🔲 No iniciado. Carpeta creada como placeholder — el diseño de este modelo debería resolverse
temprano porque APP QR, CIS y WEB lo necesitan todos.

## Permisos previstos
Consultar, crear, modificar, eliminar, autorizar, exportar, administrar, configurar — bajo
principio de mínimo privilegio necesario.

## Capacidades previstas
Autenticación, refresh/expiración de sesión, RBAC, segregación por organización, segregación
por área, auditoría de accesos, rate limiting, TLS, gestión de secretos, políticas de
contraseña, protección de APIs, logs de acceso.

## Depende de
Definición de mecanismo real de autenticación por parte de SICSAFT CORE (una de las 4 preguntas
abiertas pendientes — ver handoff de APP QR: OAuth2 client credentials vs. JWT propio vs.
certificado de dispositivo).

## Bloquea
CIS (auth), CORE (autorización), WEB (roles/permisos), APP QR (login de operador — TASK futura).

## Documentos relacionados
Pendiente: DOC-012 Seguridad e identidad.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §3 (cero confianza entre niveles, permisos
mínimos necesarios, segregación por organización/área validada en el CORE, no solo en el cliente).

## Próximo paso sugerido
No definir un mecanismo de auth "de facto" sin que CORE confirme el real — usar un stub mientras
tanto, igual que con el Conector QR. Decisión abierta rastreada en Trello: `DEC-001`.
