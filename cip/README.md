# CIP — Centro de Inteligencia Patrimonial (SYS-06)

## Objetivo
Explota la información que produce el CORE: dashboards, KPI, informes, BI, alertas y análisis.
No se implementa dentro del CORE — el CORE produce datos, el CIP los interpreta.

## Estado
🟡 Diseño (Inception, AI-DLC) completo — [`aidlc-docs/`](aidlc-docs/00_PROJECT_METADATA.md): RF-01
a RF-10 ([`requirements/REQUIREMENTS.md`](aidlc-docs/requirements/REQUIREMENTS.md)), modelo de
datos y arquitectura de ingesta (outbox transaccional en CORE → Redis/BullMQ → worker de
agregación de CIP → base `cip` propia, nunca contra la Base Patrimonial transaccional — DOC-014).

**Primer incremento de Construction ya hecho, del lado de CORE**: `core/src/eventos-outbox/` —
migración + trigger + dispatcher, publicando de verdad a la cola `cip-eventos` (ver
`core/README.md` § "Outbox transaccional hacia CIP"). **Esta carpeta (`cip/`) sigue sin código
todavía** — el segundo incremento (esqueleto NestJS propio, base de datos propia, worker
consumidor y API de lectura) es lo que falta para tener un dashboard real.

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
[DOC-014](aidlc-docs/design-artifacts/DOC-014-cip-dashboard.md) — diseño completo del primer
dashboard (Inception AI-DLC).
Ver [ARQUITECTURA-WAF.md](../ARQUITECTURA-WAF.md) §5 (separar lectura analítica de la Base
Patrimonial transaccional, alimentada de forma asíncrona por el Motor de Eventos del CORE).

## Próximo paso sugerido
Confirmar el diseño con el usuario y pasar a Construction: migración `eventos_outbox` +
trigger en `core/migrations/`, `EventosOutboxDispatcher` en `core/src/eventos-outbox/`, esqueleto
NestJS de `cip/` (mismo patrón que `core/`/`cis/`, ver `CLAUDE.md` § "Al agregar un sistema
nuevo") con su propia base `cip` y migraciones, worker de agregación y API de lectura.
