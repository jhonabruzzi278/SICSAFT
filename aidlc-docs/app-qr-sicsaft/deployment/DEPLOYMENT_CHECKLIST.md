# Deployment Checklist

> Reescrito 2026-09-17 — la versión anterior describía un sitio 100% estático sin build ni CI
> (prototipo de 2026-07-30, ver nota histórica en `../00_PROJECT_METADATA.md`). Hoy es una PWA
> React 19/Vite con build real, `Dockerfile` propio y CI (`.github/workflows/app-qr-ci.yml`).

## Cómo se despliega hoy

**No hay despliegue standalone en Vercel** — el único proyecto Vercel real del repo es `sicsaft` →
`landing/` (`.vercel/repo.json`). `app-qr-sicsaft/` se distribuye de dos formas:

1. **Embebida en el `.exe` de `sicsaft-core`** (camino prioritario, DOC-028 Fase D): servida como
   PWA local por el instalador de escritorio, sin paso de deploy propio — es parte del empaquetado
   `electron-builder` de `sicsaft-core/`.
2. **Imagen Docker propia** (`app-qr-sicsaft/Dockerfile`): usada por `devops/onprem/` para el
   stack Podman/Docker Compose on-premise, y construida en CI para detectar roturas del build de
   contenedor (sin publicarse a un registry todavía).

## Pre-deployment (lo que ya corre en CI)

- [x] Build de producción (`bun run build`, type-check + Vite build).
- [x] Tests e2e Playwright contra mocks MSW (`bun run test:e2e`) — ver
  `../testing/TEST_STRATEGY.md` para qué NO cubre esto (integración real).
- [x] `docker build` de la imagen (`Dockerfile`), con placeholders `VITE_*` en CI, nunca hosts reales.
- [ ] Lint — no configurado todavía (sin ESLint en este sistema, a diferencia de `ccp/`/`core/frontend/`).
- [ ] Cobertura de unit tests — no hay Vitest conectado (ver gap en `TEST_COVERAGE_REPORT.md`).

## Variables de entorno de build (`--build-arg`)

`VITE_KEYCLOAK_ISSUER`, `VITE_KEYCLOAK_CLIENT_ID`, `VITE_CIS_URL` — se inyectan en build time
(Vite las embebe en el bundle estático), nunca en runtime. En CI van con valores placeholder
(`https://id.sicsaft.invalid`, etc.); en producción los provee `devops/onprem/` o el wizard de
`sicsaft-core`.

## Requisitos del entorno de ejecución (sin cambios, siguen siendo ciertos)

- **HTTPS obligatorio**: la Camera API (`getUserMedia`) y los Service Workers requieren un
  contexto seguro — no funcionan en HTTP plano salvo `localhost`. `sicsaft-core` sirve todo por
  HTTPS con certificado autofirmado (TOFU, ver `ccp-desktop/README.md` para el mismo patrón del
  lado cliente).
- Verificar `manifest.json` e íconos en un dispositivo Android real antes de considerar cerrado el
  flujo de instalación "Agregar a inicio" (sigue sin probarse en hardware real, ver gap en
  `00_PROJECT_METADATA.md`).

## Secrets

No hay secretos embebidos en el bundle — los `VITE_*` de arriba son configuración pública (URLs,
client ID de un cliente OIDC público sin secreto), no credenciales.
