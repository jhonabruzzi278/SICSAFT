# SICSAFT CORE — app de escritorio nativa — Metadata del proyecto

**Fase AI-DLC:** Inception

**Sistema:** `sicsaft-core/` (nuevo — app de escritorio Electron, reemplaza a `devops/onprem/`
como camino principal de instalación por cliente, ver `INTENT.md` CORE-Q-02)

**Incremento:** Nivel 1 embebido en un único instalador `.exe` (Postgres/Keycloak/Redis/CIS/CORE/
CIP como procesos nativos, sin contenedores) + wizard de primer arranque (alta del Director, alta
del Profesional de AFT).

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
alternativa — `sicsaft-core.exe` es el camino prioritario. Ver `ARCHITECTURE.md` para la
factibilidad investigada de cada componente embebido (Postgres bajo riesgo, Keycloak factible con
costo real de tamaño/arranque, Redis con la investigación de mercado actualizada ese día — sin
binario oficial de Windows, default sin costo firmado en `redis-windows/redis-windows` pendiente de
spike real).

## Depende de

`cis/`, `core/`, `cip/`, `web_admin/`, `core/frontend/` (código de aplicación reusado tal cual,
sin cambios) — y de todo el trabajo de identidad de ADR-004 Fases 1-3 (`KeycloakAdminService`,
`KeycloakAuthGuard`, el modelo de roles por Organization), que se reusa sin reescribir.

## Bloquea

Nada de forma dura — `devops/onprem/` (Podman) sigue existiendo en paralelo de forma permanente
(CORE-Q-02 resuelta: coexisten, no se reemplaza).

## Próximo paso sugerido

1. **Decisión pendiente del usuario** antes de tocar código: ¿empaquetar un Redis para Windows
   (opción 3 de `ARCHITECTURE.md`, `redis-windows/redis-windows` — más rápido, no toca `cis`/
   `core`/`cip`) o sacar Redis del todo con `pg-boss` (reemplaza BullMQ) +
   `rate-limiter-flexible`/`RateLimiterPostgres` + un `Map` en memoria para device-registry (opción
   4 — más correcto a mediano plazo, pero toca 4 módulos en 3 sistemas, y exige decidir si
   `devops/local/`/`devops/prod/` migran también o quedan con Redis real vía Docker detrás de una
   interfaz pluggable)? Ver "Redis — riesgo real" en `ARCHITECTURE.md` para el detalle completo de
   ambos caminos. Sea cual sea, no se asume que funciona sin un spike real (igual que se hizo hoy
   con Keycloak). Si el camino elegido falla o no alcanza, decidir con el usuario si absorbe el
   costo de licencia de Memurai Enterprise (el camino con respaldo oficial de Redis Inc., sin lista
   de precios pública).
2. Confirmar el `capacitor.config.ts` real de la APK ya construida (sub-pregunta de CORE-Q-01 en
   `INTENT.md`) — determina si el mecanismo de descubrimiento LAN de CORE-RF-05 necesita lidiar con
   el bug de secure context otra vez o no.
3. Vendorizar los binarios en `sicsaft-core/resources/` (Postgres, JRE+Keycloak, Redis una vez
   resuelto el punto 1) e integrar `cis`/`core`/`cip` al `service-orchestrator.ts` (código ya
   escrito en `node-backend-service.ts`, sin integrar) — hoy bloqueado por el spike de Redis.
4. Portar `KeycloakAdminService.crearUsuarioHuman` para implementar el alta real del Director
   (`ipc/handlers.ts`, hoy tira "no implementado") y conectar el paso del Profesional de AFT al
   endpoint real de `cis` una vez esté embebido.
