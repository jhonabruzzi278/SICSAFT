# Intención — SICSAFT CORE (app de escritorio nativa)

## Qué se pide

El usuario redirige `devops/onprem/` (2026-08-27) de un stack Podman + navegador (lo que
`aidlc-docs/devops/` documenta y lo que ADR-004 Fase 3 acababa de migrar a Keycloak ese mismo día)
hacia una **app de escritorio nativa de Windows**, empaquetada como un único instalador `.exe`
llamado **`sicsaft-core`**, con todos los beneficios de Nivel 1 (ver
`aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md` §1) embebidos como
procesos nativos dentro de la propia app — **sin Podman, sin Docker, sin WSL2, sin navegador
visible para el cliente**.

Decisión de arquitectura confirmada con el usuario (`AskUserQuestion`, 2026-08-27): Electron o
Tauri, con Postgres/Keycloak/Redis/CIS/CORE/CIP corriendo como procesos embebidos dentro del
`.exe`, no como contenedores. Esto vuelve obsoleta la capa de empaquetado que
`devops/onprem/docker-compose.yml`/`instalar-cliente.ps1`/Podman construían — el código de
aplicación de `cis/`, `core/`, `cip/`, y los 4 portales (`app-qr-sicsaft`, `ccp`, `web_admin`,
`core/frontend`) NO cambia, solo cómo se empaqueta y arranca todo junto.

Flujo de instalación/primer uso que el usuario describió explícitamente:

1. El vendedor (administrador del sistema, el propio usuario) instala `sicsaft-core.exe` en la PC
   del Director del cliente — es el primer equipo donde se instala.
2. Al iniciar sesión por primera vez, el Director le da al vendedor las credenciales que va a usar
   (probablemente: el vendedor completa un formulario dentro de la app con el email del Director).
   El vendedor las setea desde dentro de la app — igual que ya hace
   `KeycloakAdminService.crearUsuarioHuman` (password inicial, cambio obligatorio en el primer
   login) — pero como paso guiado de un wizard nativo, no un script de PowerShell ni la Console de
   Keycloak.
3. Desde ahí, dentro de la misma app, se crea la cuenta del Profesional de AFT — mismo flujo que
   ya existe en `core/frontend` (`GestionarProfesionalAftPage.tsx`, `POST
   /admin/organizaciones/:orgId/usuarios`), pero embebido en la app de escritorio en vez de un
   portal web aparte.
4. Además de la app de escritorio, el usuario menciona una **APK de Android ya desarrollada** que
   quiere poder instalarle a cada cliente junto con `sicsaft-core.exe` — no está en este repo
   todavía (confirmado por búsqueda: sin Capacitor/Cordova/Tauri-mobile en
   `app-qr-sicsaft/package.json` ni en ningún otro `package.json` del monorepo) — **pendiente que
   el usuario aporte ese artefacto o aclare de dónde sale**, ver "Preguntas abiertas" abajo.

## Por qué ahora

Surgió en medio de la verificación en vivo de ADR-004 Fase 3 (Keycloak en `devops/onprem/`) — al
probar el login real de un portal en un navegador, se encontró que los dominios `.test` que genera
`instalar-cliente.ps1` no son "secure context" (rompen `crypto.subtle`/PKCE, ver
`fix-devops-onprem-dominios-localhost` más abajo en el historial de commits). Ese hallazgo hizo que
el usuario reconsiderara todo el modelo de "cliente instala Podman + entra por navegador a
dominios locales" — lo reemplaza por una app nativa que no expone nada de eso al Director/AFT.

## Qué NO es esta fase

- **No reescribe la lógica de negocio de `cis/`, `core/`, `cip/`, ni de los 4 portales** — esos
  siguen siendo los mismos backends NestJS y frontends Vite/React, con la misma matriz RBAC
  (DOC-023) y los mismos endpoints (DOC-006, DOC-021, DOC-024). Este incremento es de empaquetado y
  orquestación de procesos, no de dominio.
- **No decide todavía si `devops/onprem/` (Podman) se abandona por completo o queda como opción
  paralela** (ej. para un cliente con un servidor Linux dedicado en vez de una sola PC Windows) —
  se documenta como pregunta abierta, no se borra el trabajo de ADR-004 Fase 3 sin confirmación
  explícita.
- **No incluye la APK de Android** en el alcance de código de este incremento — se documenta como
  dependencia externa pendiente de aportar por el usuario.
- **No decide todavía el mecanismo de Redis embebido** (ver `ARCHITECTURE.md` "Riesgos reales, no
  supuestos") — es la pieza con menos certeza técnica y se trata como spike/decisión propia, no se
  asume una solución.

## Preguntas abiertas (no bloquean el diseño, se documentan)

- **CORE-Q-01**: ¿La APK de Android ya desarrollada es un build de `app-qr-sicsaft/` (vía
  Capacitor/Bubblewrap/PWABuilder u otra herramienta), o es un proyecto Android nativo aparte no
  versionado en este repo? Determina si hay que traer tooling de build de APK a este monorepo o si
  el usuario simplemente entrega un `.apk` ya compilado para distribuir.
- **CORE-Q-02**: ¿`sicsaft-core.exe` reemplaza a `devops/onprem/` (Podman) por completo, o
  coexisten como dos opciones de instalación según el perfil de cliente (PC única del Director vs.
  servidor dedicado)? Afecta si el trabajo de ADR-004 Fase 3 sigue vigente o queda archivado.
- **CORE-Q-03**: Nivel 2 (CCP) y Nivel 3 (RFID) — ¿entran a `sicsaft-core.exe` en incrementos
  futuros con el mismo patrón (procesos embebidos), o Nivel 2/3 siguen necesitando el modelo
  Podman/servidor por su mayor carga? No se asume una respuesta — Nivel 1 es el alcance confirmado
  de este incremento.
