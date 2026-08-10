# SICSAFT CORE (SYS-03)

## Objetivo
Núcleo operativo del Modelo Inteligente de Gestión Patrimonial (Tomo IV, Cap. 2). Administra,
coordina, controla y supervisa todo el ciclo de vida de los Activos Fijos Tangibles. Es el
**único** componente autorizado a modificar la Base Patrimonial Central — todas las tecnologías,
aplicaciones y sistemas externos interactúan con el patrimonio exclusivamente a través del CORE.

## Estado
🔲 No iniciado. Carpeta creada como placeholder dentro del plan maestro del ecosistema.

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
  conjunto, no por separado.
- Decisión de identidad/auth (afecta también a CIS y `../seguridad`).

## Bloquea
- CIS real (necesita saber qué contrato expone el CORE).
- Portal WEB y CIP (consumen datos que produce el CORE).

## Documentos relacionados
Pendiente: DOC-003 Modelo de dominio, DOC-007 Arquitectura CORE, DOC-008 Motor Patrimonial,
DOC-009 Motor de Reglas, DOC-010 Motor Eventos, DOC-011 Motor Auditoría.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) para el marco de escalabilidad/resiliencia
aplicable a este sistema.

## Próximo paso sugerido
ADR de stack tecnológico + diseño del modelo de dominio (compartido con Base Patrimonial).
Tarjeta Trello: `CORE-ADR-001`.
