# SICSAFT CORE (SYS-03)

## Objetivo
Concentra la lógica funcional patrimonial. Es el único componente autorizado a modificar la
Base Patrimonial Central. Orquesta motores de dominio: patrimonial, reglas, eventos, auditoría,
alertas y reportes.

## Estado
🔲 No iniciado. Carpeta creada como placeholder dentro del plan maestro del ecosistema.

## Componentes previstos
- **Orquestador central**: recibe toda operación ya autenticada/validada por CIS y la enruta.
- **Motor Patrimonial**: consulta de activos, inventario, cambio de ubicación/estado, traslado
  (alta/baja/reincorporación/cambio de responsable quedan para después del MVP).
- **Motor de Reglas**: valida invariantes (QR único por activo, responsable único vigente,
  inventario no cierra con pendientes sin incidencia, etc.). Las 8 categorías de resultado de
  escaneo de APP QR (correcto, otra área, otra ubicación, no registrado, código inválido,
  duplicado, ya escaneado, con incidencia) se resuelven acá, no en la app de captura.
- **Motor de Eventos**, **Motor de Auditoría**, **Motor de Alertas**, **Motor de Reportes**.

## Depende de
- Modelo de dominio y esquema de Base Patrimonial Central (`../base-patrimonial`).
- Decisión de identidad/auth (afecta también a CIS).

## Bloquea
- CIS real (necesita saber qué contrato expone el CORE).
- Portal WEB y CIP (consumen datos que produce el CORE).

## Documentos relacionados
Pendiente: DOC-003 Modelo de dominio, DOC-007 Arquitectura CORE, DOC-008 Motor Patrimonial,
DOC-009 Motor de Reglas, DOC-010 Motor Eventos, DOC-011 Motor Auditoría.

## Próximo paso sugerido
ADR de stack tecnológico + diseño del modelo de dominio (compartido con Base Patrimonial).
