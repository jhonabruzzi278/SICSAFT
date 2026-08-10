# CIP — Centro de Inteligencia Patrimonial (SYS-06)

## Objetivo
Explota la información que produce el CORE: dashboards, KPI, informes, BI, alertas y análisis.
No se implementa dentro del CORE — el CORE produce datos, el CIP los interpreta.

## Estado
🔲 No iniciado. Carpeta creada como placeholder dentro del plan maestro del ecosistema.

## Primer dashboard previsto
Por organización: activos registrados, activos escaneados, % cobertura de inventario, áreas
controladas vs. pendientes, inventarios exitosos/aceptables/defectuosos, activos fuera de área,
activos no localizados, incidencias, y estado de los AFT (en servicio, mantenimiento, inactivo,
baja).

## Navegación prevista
Organización → Sede → Área → Ubicación → Categoría → Activo (con drill-down).

## Depende de
CORE (fuente de datos), idealmente vía un almacén de solo lectura / reporting, no contra la
Base Patrimonial transaccional directamente.

## Bloquea
Nada.

## Documentos relacionados
Pendiente: DOC-014 CIP.
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §5 (separar lectura analítica de la Base
Patrimonial transaccional, alimentada de forma asíncrona por el Motor de Eventos del CORE).

## Próximo paso sugerido
Definir qué métricas del MVP 1 de CORE ya están disponibles para armar el primer dashboard.
