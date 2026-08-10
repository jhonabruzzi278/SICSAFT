# RFID SICSAFT (SYS-07)

## Objetivo
Captura automática de activos vía tags RFID, asociada a zonificación y mapas arquitectónicos,
para activos extraordinarios. Dispositivos en entradas/salidas con visualización en tiempo real.

## Estado
🔲 No iniciado. Fase tardía del plan maestro (después de estabilizar CORE + CIS + WEB).

## Arquitectura futura
```
Tag RFID → Lector/Antena → Gateway local → Conector RFID → CIS → CORE
  → Motor de Eventos → Motor de Reglas → Motor de Alertas → CIP
```

## Eventos previstos
RFID_DETECTED, RFID_ZONE_ENTER, RFID_ZONE_EXIT, RFID_UNAUTHORIZED_EXIT, RFID_MISSING,
RFID_REAPPEARED.

## Depende de
CIS (conector RFID) y CORE (motor de eventos/reglas/alertas) ya operativos.

## Bloquea
Nada.

## Documentos relacionados
Pendiente: DOC-015 Arquitectura RFID.

## Próximo paso sugerido
No arrancar todavía — esperar a que CORE MVP y CIS real estén estables (fase 10 del plan).
