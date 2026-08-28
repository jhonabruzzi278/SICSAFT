# ADR-001: Stack tecnológico del ecosistema — NestJS + Vite/React + PostgreSQL + Redis

## Status
Aceptado — la cláusula "Cache y colas: Redis" fue enmendada por
[ADR-005](ADR-005-postgres-pgboss-reemplaza-redis.md) (2026-08-27): Redis se reemplaza por
`pg-boss`/Postgres. El resto de esta decisión (NestJS, Vite/React, PostgreSQL) sigue vigente.

## Context
CIS (SYS-02) y SICSAFT CORE (SYS-03) necesitan un ADR de stack antes de tener código real — ya
señalado como "próxima decisión pendiente" en [`ARQUITECTURA-WAF.md`](../ARQUITECTURA-WAF.md) 10.
El contexto que condiciona la elección:

- Equipo pequeño (una persona hoy) operando un **VPS propio administrado por el mismo equipo**, con
  Docker/Docker Compose como unidad de despliegue — no hay plataforma gestionada tipo Vercel/Render
  detrás para los niveles de backend.
- Ya existe una decisión de frontend tomada y en producción: `app-qr-sicsaft` usa Vite + React +
  TypeScript sin SSR (ver `aidlc-docs/app-qr-sicsaft/design-artifacts/ADR/ADR-002-react-shadcn-migration.md`)
  y `landing/` es Vite + TypeScript vanilla. Ambos son 100% client-side.
- Prioridad explícita del usuario: velocidad de desarrollo, código limpio, testeable a fondo
  (unitario + integración + carga), CI/CD estricto antes de llegar a producción.
- Se evaluaron dos lenguajes de backend: **TypeScript (NestJS)** y **Go (Fiber/Echo)**.

## Decision
**Backend (CIS + CORE): NestJS sobre Node.js, en TypeScript.**

- Mismo lenguaje que todo el frontend del ecosistema — un solo `tsconfig`/linter/formatter/CI
  runner para todo el repo, sin duplicar tooling de testing entre dos ecosistemas de lenguaje.
- Arquitectura modular con inyección de dependencias impuesta por el framework (no por disciplina
  del equipo) — encaja directo con el principio de "9 motores como módulos internos de un mismo
  desplegable" de `ARQUITECTURA-WAF.md` 1: cada motor del CORE (Patrimonial, Reglas, Eventos,
  Auditoría, Alertas, Reportes...) es un módulo Nest con límites explícitos, testeable en
  aislamiento sin mockear el framework.
- Ecosistema de testing maduro (Jest/Vitest + `@nestjs/testing`) que soporta el objetivo de
  cobertura estricta + mutation testing sin fricción de configuración.

**Frontend (WEB, CIP): Vite + React + TypeScript, sin SSR** — mismo patrón ya validado en APP QR y
landing. Todo lo que hay detrás de login es un SPA que le habla al CIS; no hay necesidad de SEO/SSR
en esas superficies, y evita correr un runtime Node de SSR adicional en el VPS solo para servir
HTML que ya requiere sesión autenticada.

**Base de datos transaccional (Nivel 4 — Base Patrimonial): PostgreSQL.** Ya recomendado en
`ARQUITECTURA-WAF.md` 5 para el modelo relacional de 11 dominios con relaciones fuertes.

**Cache y colas: Redis** (cache de catálogos/áreas/ubicaciones + colas con BullMQ para eventos
asíncronos entre CIS↔CORE, generalizando el patrón de cola-con-reintentos ya implementado en APP
QR TASK-008). No se introduce Kafka/RabbitMQ todavía — no hay más de una fuente de captura con
tráfico real simultáneo (regla YAGNI ya explícita en `ARQUITECTURA-WAF.md` 9).

### Alternativa descartada: Go (Fiber/Echo)
Más eficiente en CPU/memoria y mejor candidato si el CIS se vuelve un cuello de botella real de
I/O de alto volumen — pero partir en dos lenguajes de backend desde el día 1 duplica pipelines de
CI, convenciones de testing y curva de contexto para un equipo de una persona, sin que exista hoy
carga real que lo justifique. Queda como opción de migración futura para un motor específico si
llega a necesitar escalar independiente del resto (mismo criterio de "separar solo cuando haya
motivo real" de `ARQUITECTURA-WAF.md` 9), no como decisión de partida.

## Consequences
- CIS y CORE se implementan como aplicaciones NestJS separadas (cada una su propio Dockerfile
  multi-stage, ver `devops/README.md`), comunicándose por HTTP/contratos versionados como ya
  define `ARQUITECTURA-WAF.md` 1.
- El pipeline de CI/CD del ecosistema puede compartir gran parte de su configuración entre
  frontend y backend (mismo runtime Node, mismo gestor de paquetes, mismas herramientas de lint/
  test/cobertura) — reduce el costo de mantener `devops/`.
- Cualquier ADR futuro de un sistema nuevo (RFID, Integraciones) parte de este stack por defecto;
  cambiarlo para un sistema puntual requiere su propio ADR justificando el motivo real (no
  preferencia).
