# Integraciones externas SICSAFT (SYS-08)

## Objetivo
Conectores hacia sistemas externos: ERP, contabilidad, RRHH, correo, Power BI, cloud, APIs de
terceros. Cada integración pasa por CIS igual que cualquier otra fuente/destino externo.

## Estado
🔲 No iniciado. Fase tardía del plan maestro (después de CORE + CIS + los portales WEB
(`ccp/`/`web_admin/`/`core/frontend/`, DOC-022) + CIP). `CON-CONTABILIDAD` tiene diseño en curso
en una rama aparte (DOC-016), sin código todavía.

## Conectores previstos
CON-ERP, CON-CONTABILIDAD, CON-RRHH, CON-EMAIL, CON-POWERBI, CON-RFID, CON-API.

`CON-CONTABILIDAD` no es una integración más: Tomo III 1.4 (Entrada 5) lo define como la fuente
de la que **siempre** proviene la Base Oficial (importación/actualización/sincronización, nunca
elimina histórico) — distinto del resto, que son integraciones de salida/consumo. Ver
[ARQUITECTURA-WAF.md 11](../ARQUITECTURA-WAF.md#11-entradas-y-salidas-oficiales-del-ecosistema-tomo-iii-cap1).

## Registro esperado por integración
fecha, origen, destino, estado, resultado, errores, correlationId.

## Depende de
CIS (registro de conectores) y CORE (motor de eventos/auditoría) operativos.

## Bloquea
Nada.

## Documentos relacionados
Pendiente: DOC-016 Integraciones.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 4 (circuit breaker por integración externa —
una caída de ERP/BI nunca bloquea el flujo interno Captura → CIS → CORE → Base Patrimonial).

## Próximo paso sugerido
No arrancar todavía — priorizar según qué integración pida primero el negocio (ERP suele ser
la más común).
