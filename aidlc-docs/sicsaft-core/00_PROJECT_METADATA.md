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

🔴 Solo diseño — recién decidido con el usuario (2026-08-27), sin código todavía. Ver
`ARCHITECTURE.md` para la factibilidad investigada de cada componente embebido (Postgres bajo
riesgo, Keycloak factible con costo real de tamaño/arranque, Redis es el punto de mayor
incertidumbre — sin binario oficial de Windows).

## Depende de

`cis/`, `core/`, `cip/`, `web_admin/`, `core/frontend/` (código de aplicación reusado tal cual,
sin cambios) — y de todo el trabajo de identidad de ADR-004 Fases 1-3 (`KeycloakAdminService`,
`KeycloakAuthGuard`, el modelo de roles por Organization), que se reusa sin reescribir.

## Bloquea

Nada de forma dura todavía — `devops/onprem/` (Podman) sigue existiendo en paralelo hasta que se
confirme (CORE-Q-02) si `sicsaft-core.exe` lo reemplaza por completo o coexisten.

## Próximo paso sugerido

1. Cerrar CORE-Q-01 (qué es la APK de Android) con el usuario — determina el alcance real de
   CORE-RF-05.
2. Spike de Redis embebido en Windows (ver `ARCHITECTURE.md` "Redis — riesgo real") — confirmar
   real, no asumir, que un build comunitario arranca y sostiene la carga de BullMQ/rate-limiting
   antes de comprometerse a esa opción.
3. Scaffold del proyecto Electron (`sicsaft-core/`) con el wizard de primer arranque como primer
   entregable vertical — Postgres + Keycloak + `cis` embebidos y el alta real de un Director de
   punta a punta, antes de sumar `core`/`cip`/los portales embebidos.
