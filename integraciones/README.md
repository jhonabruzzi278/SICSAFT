# Integraciones externas SICSAFT (SYS-08)

## Objetivo
Conectores hacia sistemas externos: ERP, contabilidad, RRHH, correo, Power BI, cloud, APIs de
terceros. Cada integración pasa por CIS igual que cualquier otra fuente/destino externo.

## Estado
🔲 No iniciado. Fase tardía del plan maestro (después de CORE + CIS + WEB + CIP).

## Conectores previstos
CON-ERP, CON-CONTABILIDAD, CON-RRHH, CON-EMAIL, CON-POWERBI, CON-RFID, CON-API.

## Registro esperado por integración
fecha, origen, destino, estado, resultado, errores, correlationId.

## Depende de
CIS (registro de conectores) y CORE (motor de eventos/auditoría) operativos.

## Bloquea
Nada.

## Documentos relacionados
Pendiente: DOC-016 Integraciones.

## Próximo paso sugerido
No arrancar todavía — priorizar según qué integración pida primero el negocio (ERP suele ser
la más común).
