# Integraciones externas SICSAFT (SYS-08)

## Objetivo
Conectores hacia sistemas externos: ERP, contabilidad, RRHH, correo, Power BI, cloud, APIs de
terceros. Cada integración pasa por CIS igual que cualquier otra fuente/destino externo.

## Estado
🔲 No iniciado, salvo `CON-CONTABILIDAD`: 🟡 diseñado (`DOC-016`), sin código todavía. El resto
de conectores previstos sigue en fase tardía del plan maestro (después de CORE + CIS + los
portales WEB (`ccp/`/`web_admin/`/`core/frontend/`, DOC-022) + CIP).

**Corrección de clasificación (2026-08-28, ver ROADMAP.md Fase 7)**: esta carpeta decía "todo el
sistema es fase tardía" citando Tomo III 1.2 (Etapa 5). Eso es correcto para CON-ERP/RRHH/EMAIL/
POWERBI/RFID/API, pero **no** para `CON-CONTABILIDAD` — Tomo III 1.4 Entrada 5 lo define como
entrada oficial de **Etapa 1**, al mismo nivel que APP QR/WEB/RFID como fuente de captura, no
como integración de salida/consumo de Etapa 5. Su diseño y futuro código viven fuera de esta
carpeta (en `cis/`, ver `DOC-016`) precisamente porque es una entrada oficial, no un conector de
integración más — `integraciones/` sigue siendo el lugar correcto para el resto de la lista de
abajo.

## Conectores previstos
CON-ERP, CON-CONTABILIDAD, CON-RRHH, CON-EMAIL, CON-POWERBI, CON-RFID, CON-API.

`CON-CONTABILIDAD` no es una integración más: Tomo III 1.4 (Entrada 5) lo define como la fuente
de la que **siempre** proviene la Base Oficial (importación/actualización/sincronización, nunca
elimina histórico) — distinto del resto, que son integraciones de salida/consumo. Ver
[ARQUITECTURA-WAF.md 11](../ARQUITECTURA-WAF.md#11-entradas-y-salidas-oficiales-del-ecosistema-tomo-iii-cap1)
y el diseño real en
[`aidlc-docs/integraciones/design-artifacts/DOC-016-conector-con-contabilidad.md`](../aidlc-docs/integraciones/design-artifacts/DOC-016-conector-con-contabilidad.md).

## Registro esperado por integración
fecha, origen, destino, estado, resultado, errores, correlationId. Para `CON-CONTABILIDAD` esto
se resuelve reusando el canal `POST /auditoria` ya existente, no una tabla nueva — decisión YAGNI
documentada en DOC-016 5/9 (revisar si un futuro conector necesita más detalle del que
`auditoria` puede dar).

## Depende de
CIS (registro de conectores) y CORE (motor de eventos/auditoría) operativos.

## Bloquea
Nada.

## Documentos relacionados
[DOC-016](../aidlc-docs/integraciones/design-artifacts/DOC-016-conector-con-contabilidad.md)
Conector CON-CONTABILIDAD — diseñado, código pendiente (ver "Estado" arriba).
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) 4 (circuit breaker por integración externa —
una caída de ERP/BI nunca bloquea el flujo interno Captura → CIS → CORE → Base Patrimonial).

## Próximo paso sugerido
Implementar `cis/src/importacion-contable-conector/` según DOC-016 2–7. El resto de
conectores (CON-ERP, CON-RRHH, CON-EMAIL, CON-POWERBI, CON-RFID, CON-API) sigue sin arrancar —
priorizar según qué integración pida primero el negocio.
