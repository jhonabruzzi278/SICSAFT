# SICSAFT CORE (SYS-03)

## Objetivo
Núcleo operativo del Modelo Inteligente de Gestión Patrimonial (Tomo IV, Cap. 2). Administra,
coordina, controla y supervisa todo el ciclo de vida de los Activos Fijos Tangibles. Es el
**único** componente autorizado a modificar la Base Patrimonial Central — todas las tecnologías,
aplicaciones y sistemas externos interactúan con el patrimonio exclusivamente a través del CORE.

## Estado
🟡 Esqueleto NestJS (mismo patrón que `../cis/`) + **mock de `GET /entitlements`**
([DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md) §6): resuelve el modelo de `Contrato`
sobre un seed en memoria (mismo caso DUOC UC/Melipilla que ya usa CIS), con la máquina de estados
y el invariante "una sede, un contrato vigente" de DOC-004 §3/§4 implementados y testeados. Todo
probado con lint, unit (100% stmts/lines/funcs, branches sobre el umbral del proyecto), e2e,
build y `docker build`/`docker run` real — corre como servicio `core` en
`../devops/local/docker-compose.yml`, sin ruta de Traefik a propósito (solo lo consume CIS dentro
de la red de contenedores, nunca un navegador directo).

**CIS ya llama a este endpoint**: `auth/session` usa `CoreClientService`
(`cis/src/core-client/`) para pedir entitlements reales acá en vez de un seed fijo — verificado
con conectividad real entre contenedores `cis`↔`core` (`docker network` + `docker exec`), no solo
con mocks. Todavía sin ningún otro motor implementado (Patrimonial, Reglas, Eventos, Auditoría,
Alertas...), sin persistencia real, y sin auth servicio-a-servicio (CORE no valida que quien lo
llama sea realmente CIS — ver "Depende de").

## Desarrollo local
```bash
cd core
npm install
npm run start:dev     # http://localhost:3001 y http://localhost:3001/health
npm run lint
npm run test:cov
npm run test:e2e
npm run build
```
Puerto por defecto `3001` (no `3000`) para poder correr `cis` y `core` en paralelo fuera de
Docker sin chocar — dentro de Docker Compose cada uno tiene su propio namespace de puertos, así
que no sería estrictamente necesario, pero evita sorpresas en desarrollo local sin contenedores.

## Responsabilidades exclusivas (Tomo IV §2.3)
Ningún componente externo puede ejecutar estas operaciones directamente: crear/modificar/dar de
baja activos, autorizar traslados, validar inventarios, registrar movimientos, asignar
responsables, asociar etiquetas QR/RFID, administrar estados patrimoniales, actualizar
historial, registrar eventos, actualizar indicadores, generar alertas, publicar información.

## Arquitectura interna: Orquestador + 9 motores (Tomo IV §2.4–2.14)
Ver también [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §1 — en el MVP estos 9 motores son
módulos internos de un mismo desplegable, no microservicios separados; se separan solo cuando
uno necesite escalar de forma independiente.

- **Orquestador Central**: recibe toda operación (ya autenticada/validada por CIS), identifica
  origen, determina motores involucrados, controla secuencia, publica eventos, cierra
  transacción. Toda operación pasa primero por acá.
- **Motor Patrimonial**: ciclo de vida completo del activo — alta, modificación, traslado, cambio
  de responsable/ubicación/estado, inventario, baja, reincorporación, consulta. Entradas: QR,
  WEB, RFID, ERP, Administrador. Salidas: Base Patrimonial, Historial, Eventos, Indicadores,
  Alertas. (MVP: consulta, inventario, cambio de ubicación/estado, traslado — alta/baja/
  reincorporación/cambio de responsable quedan para después del MVP).
- **Motor de Reglas**: valida invariantes antes de confirmar cualquier transacción — un activo no
  puede tener dos responsables vigentes, una etiqueta QR solo puede estar en un activo, un RFID
  no se repite, un traslado requiere autorización según perfil, un inventario no cierra con
  pendientes sin incidencia registrada. Las 8 categorías de resultado de escaneo de APP QR
  (correcto, otra área, otra ubicación, no registrado, código inválido, duplicado, ya escaneado,
  con incidencia) se resuelven acá, no en la app de captura.
- **Motor de Eventos**: registra todo hecho significativo (alta, lectura QR/RFID, traslado,
  inventario, movimiento, incidencia, mantenimiento, integración, actualización) — genera el
  historial operacional del patrimonio.
- **Motor de Auditoría**: registra usuario, fecha, hora, operación, resultado, equipo, dirección
  IP y tiempo de ejecución de toda acción del sistema — garantiza trazabilidad total.
- **Motor de Alertas**: detecta movimiento no autorizado, inventario pendiente, activo no
  localizado, documento vencido, RFID fuera de zona, inconsistencias, errores de integración.
  Salidas: dashboard, correo, aplicación móvil, portal.
- **Motor de Reportes**: construye inventarios, auditorías, movimientos, altas, bajas,
  indicadores, incidencias, RFID, QR — en PDF, Excel, CSV, JSON.
- **Gestión Documental**: expediente digital único por activo (facturas, garantías, contratos,
  fotografías, manuales, actas, certificados, informes).
- **Gestión de Usuarios**: crear, modificar, desactivar, asignar roles/áreas, controlar sesiones,
  registrar accesos.
- **Gestión de Permisos**: consultar, crear, modificar, eliminar, autorizar, exportar,
  administrar, configurar — bajo el principio de permisos mínimos necesarios (coordina con
  `../seguridad`).

## Flujo/ciclo de vida de una transacción (Tomo IV §2.15–2.16)
`Solicitud → Orquestador → Autenticación → Autorización → Motor de Reglas → Motor Patrimonial →
Base Patrimonial Central → Motor de Eventos → Motor de Auditoría → Motor de Alertas (si aplica) →
CIP → Respuesta`. Estados: Recibida → Validada → Autorizada → Procesada → Persistida → Auditada →
Publicada → Finalizada. Si una validación falla, la transacción se cancela de forma controlada,
registrando el motivo.

## Depende de
- Modelo de dominio y esquema de Base Patrimonial Central (`../base-patrimonial`) — a diseñar en
  conjunto, no por separado. `Contrato` ya está modelado
  ([DOC-004](../base-patrimonial/DOC-004-modelo-contrato.md)); el resto de los 11 dominios sigue
  pendiente (DOC-005).
- Decisión de identidad/auth (afecta también a CIS y `../seguridad`) — ya resuelta a nivel de
  mecanismo (Zitadel/OIDC, ver [ADR-002](../adr/ADR-002-identidad-zitadel-multi-tenant.md)), CIS
  ya la implementa. CORE no valida tokens de operador directamente (eso ya lo hace CIS antes de
  reenviar la request) — sí necesitará su propia forma de confiar en que quien le habla es
  realmente CIS (auth servicio-a-servicio), sin decidir todavía.

## Bloquea
- Nada de CIS ya — `auth/session` consume `GET /entitlements` real (ver
  `cis/src/core-client/`).
- Portal WEB y CIP (consumen datos que produce el CORE) — todavía sin código.

## Documentos relacionados
[ADR-001](../adr/ADR-001-stack-backend-nestjs.md) (stack: NestJS/TypeScript — los 9 motores son
módulos Nest dentro de un mismo desplegable, ver ADR-001).
[`base-patrimonial/DOC-004-modelo-contrato.md`](../base-patrimonial/DOC-004-modelo-contrato.md)
(modelo de `Contrato` — primer dato real que este esqueleto tendría que servir). Pendiente:
DOC-003 Modelo de dominio, DOC-005 resto del modelo Base Patrimonial, DOC-006 API CIS↔CORE
(incluye `GET /entitlements`), DOC-007 Arquitectura CORE, DOC-008 Motor Patrimonial, DOC-009
Motor de Reglas, DOC-010 Motor Eventos, DOC-011 Motor Auditoría.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) para el marco de escalabilidad/resiliencia
aplicable a este sistema.

## Próximo paso sugerido
`GET /entitlements` ya está hecho y CIS ya lo consume (este documento + `cis/src/core-client/`).
El siguiente incremento con valor real es decidir y aplicar auth servicio-a-servicio CIS→CORE
(hoy cualquiera dentro de la red de contenedores puede llamar a `GET /entitlements` sin
credenciales — aceptable localmente porque no hay ruta de Traefik, pero no aceptable en
producción). Tarjeta Trello: `CORE-ADR-001`.
