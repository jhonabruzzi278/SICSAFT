# DevOps — Instalador on-premise por cliente — Metadata del proyecto

**Fase AI-DLC:** Inception

**Sistema:** `devops/` (capacidad transversal — OPS)

**Incremento:** Instalador on-premise por cliente (Nivel 1/Nivel 2), primera versión sin
empaquetar como `.exe`.

## Quick links

- Intención: [`requirements/INTENT.md`](requirements/INTENT.md)
- Requisitos: [`requirements/REQUIREMENTS.md`](requirements/REQUIREMENTS.md)
- Arquitectura: [`design-artifacts/ARCHITECTURE.md`](design-artifacts/ARCHITECTURE.md)
- Niveles de producto: [`design-artifacts/DOC-025-niveles-producto-onprem.md`](design-artifacts/DOC-025-niveles-producto-onprem.md)
- Implementación: [`devops/onprem/`](../../devops/onprem)

## Estado

🟡 Diseño completo + primer entregable construible (stack Podman parametrizado por nivel +
bootstrap de Zitadel). Empaquetado como instalador `.exe` real es un incremento siguiente, no
cubierto acá.

## Depende de

`devops/local/docker-compose.yml` (base reusada), `cis/src/zitadel-admin/` (cliente HTTP de la
Management API de Zitadel, reusado por `bootstrap-zitadel.ps1`).

## Bloquea

Nada de forma dura — es un despliegue alternativo al VPS compartido, no reemplaza
`devops/prod/`.

## Próximo paso sugerido

Verificar el stack Nivel 1/Nivel 2 de punta a punta contra una VM Windows limpia (sin WSL2/Podman
preinstalados) antes de construir el instalador `.exe` empaquetado (Fase 3, ver
`design-artifacts/ARCHITECTURE.md`).
