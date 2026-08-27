# SICSAFT CORE — app de escritorio nativa — Metadata del proyecto

**Fase AI-DLC:** Inception

**Sistema:** `sicsaft-core/` (nuevo — app de escritorio Electron, reemplaza a `devops/onprem/`
como camino principal de instalación por cliente, ver `INTENT.md` CORE-Q-02)

**Incremento:** Nivel 1 embebido en un único instalador `.exe` (Postgres/Keycloak/CIS/CORE/CIP como
procesos nativos, sin contenedores — sin Redis, ver ADR-005) + wizard de primer arranque (alta del
Director, alta del Profesional de AFT).

## Quick links

- Intención: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requisitos: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Implementación: `sicsaft-core/` (carpeta de código, a crear en la raíz del monorepo)

## Estado

🔴 Scaffold Electron construido (2026-08-27, ver `sicsaft-core/README.md`) — typecheck/lint/build/
test en verde, 0 vulnerabilidades, pero sin binarios embebidos vendorizados todavía. CORE-Q-01 y
CORE-Q-02 resueltas ese mismo día (ver `requirements/INTENT.md`): la APK es un wrap Capacitor de
`app-qr-sicsaft/` ya construido fuera de este repo, y `devops/onprem/` (Podman) se mantiene como
alternativa — `sicsaft-core.exe` es el camino prioritario.

**Redis sacado del ecosistema completo (ADR-005, mismo día)**: el usuario confirmó eliminar Redis
de los 3 perfiles de `devops/`, no solo del embebido — `core/`+`cip/` mueven la cola `cip-eventos`
a `pg-boss` sobre Postgres, `cis/` mueve rate-limiter/device-registry a memoria del propio proceso.
Implementado y verificado real (tests/build/lint en verde en los 3 sistemas + los 3
`docker-compose.yml` + los 2 workflows de CI que tenían Redis). Ver "Redis — resuelto" en
`ARCHITECTURE.md`. Esto simplifica el embebido: un binario menos que vendorizar, y el spike que
bloqueaba integrar `cis`/`core`/`cip` al orquestador queda cerrado.

## Depende de

`cis/`, `core/`, `cip/`, `web_admin/`, `core/frontend/` (código de aplicación reusado tal cual,
sin cambios) — y de todo el trabajo de identidad de ADR-004 Fases 1-3 (`KeycloakAdminService`,
`KeycloakAuthGuard`, el modelo de roles por Organization) y de ADR-005 (`pg-boss`,
`InMemoryRateLimiter`), que se reusan sin reescribir.

## Bloquea

Nada de forma dura — `devops/onprem/` (Podman) sigue existiendo en paralelo de forma permanente
(CORE-Q-02 resuelta: coexisten, no se reemplaza).

## Próximo paso sugerido

1. Confirmar el `capacitor.config.ts` real de la APK ya construida (sub-pregunta de CORE-Q-01 en
   `INTENT.md`) — determina si el mecanismo de descubrimiento LAN de CORE-RF-05 necesita lidiar con
   el bug de secure context otra vez o no.
2. Vendorizar los binarios en `sicsaft-core/resources/` (Postgres, JRE+Keycloak — ya no Redis) e
   integrar `cis`/`core`/`cip` al `service-orchestrator.ts` (código ya escrito en
   `node-backend-service.ts`, sin integrar) — sin bloqueante externo ahora, falta el wiring en sí:
   env vars apuntando a los procesos embebidos, correr las migraciones de `core`/`cip`, crear la
   base `eventos_outbox` nueva de ADR-005 en el Postgres embebido.
3. Portar `KeycloakAdminService.crearUsuarioHuman` para implementar el alta real del Director
   (`ipc/handlers.ts`, hoy tira "no implementado") y conectar el paso del Profesional de AFT al
   endpoint real de `cis` una vez esté embebido.
