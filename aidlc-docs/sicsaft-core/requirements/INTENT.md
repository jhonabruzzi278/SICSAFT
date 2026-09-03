# Intención — SICSAFT CORE (app de escritorio nativa)

## Qué se pide

El usuario redirige `devops/onprem/` (2026-08-27) de un stack Podman + navegador (lo que
`aidlc-docs/devops/` documenta y lo que ADR-004 Fase 3 acababa de migrar a Keycloak ese mismo día)
hacia una **app de escritorio nativa de Windows**, empaquetada como un único instalador `.exe`
llamado **`sicsaft-core`**, con todos los beneficios de Nivel 1 (ver
`aidlc-docs/devops/design-artifacts/DOC-025-niveles-producto-onprem.md` 1) embebidos como
procesos nativos dentro de la propia app — **sin Podman, sin Docker, sin WSL2, sin navegador
visible para el cliente**.

Decisión de arquitectura confirmada con el usuario (`AskUserQuestion`, 2026-08-27): Electron o
Tauri, con Postgres/Keycloak/CIS/CORE/CIP corriendo como procesos embebidos dentro del `.exe`, no
como contenedores (sin Redis — ver ADR-005, decidido más tarde ese mismo día: sacado del
ecosistema completo). Esto vuelve obsoleta la capa de empaquetado que
`devops/onprem/docker-compose.yml`/`instalar-cliente.ps1`/Podman construían — el código de
aplicación de `cis/`, `core/`, `cip/`, y los 3 portales (`app-qr-sicsaft`, `ccp`,
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
4. Además de la app de escritorio, el usuario menciona una **APK de Android** que quiere poder
   instalarle a cada cliente junto con `sicsaft-core.exe`. **Corrección (2026-08-27)**: se había
   dado por resuelto (CORE-Q-01) asumiendo que era un wrap Capacitor de `app-qr-sicsaft/` "ya
   compilado, mantenido fuera de este repo" — el usuario aclaró que eso es incorrecto, **esa APK
   todavía no existe**. Queda reabierta (ver "Preguntas abiertas" más abajo). Este incremento no
   la construye — decidir cuándo/cómo hacerlo (dentro de este monorepo con tooling Capacitor nuevo,
   o afuera) es un incremento aparte, no bloqueante para Nivel 1 embebido.

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
- **`devops/onprem/` (Podman) no se abandona — resuelto (2026-08-27, CORE-Q-02)**: queda como
  alternativa para un perfil de cliente distinto (ej. servidor Linux dedicado), pero
  `sicsaft-core.exe` es el camino **prioritario** de instalación de acá en adelante. El trabajo de
  ADR-004 Fase 3 sigue vigente sin cambios — no se archiva ni se reescribe.
- **No incluye construir la APK de Android** en el alcance de este incremento — no existe todavía
  (ver CORE-Q-01, reabierta abajo); cuando se construya, este incremento debería dejar `cis`/
  Keycloak alcanzables por esa APK desde la LAN, pero diseñar ESE mecanismo tampoco es parte de
  este incremento mientras la APK no exista.
- **Redis, resuelto (ADR-005, 2026-08-27)**: no se decide un mecanismo para embeberlo — se saca del
  ecosistema completo. `core/`+`cip/` mueven la cola `cip-eventos` a `pg-boss` sobre Postgres (que
  ya era una dependencia dura embebida acá), `cis/` mueve rate-limiter/device-registry a memoria
  del propio proceso. Ver `ARCHITECTURE.md` "Redis — resuelto".

## Preguntas abiertas (no bloquean el diseño, se documentan)

- **CORE-Q-01 — REABIERTA (2026-08-27)**: se había marcado "resuelta" el mismo día asumiendo que
  la APK Android ya existía como un wrap Capacitor de `app-qr-sicsaft/` compilado fuera del repo —
  el usuario corrigió que eso es falso, no hay ninguna APK construida todavía. Preguntas reales,
  sin resolver: ¿se construye dentro de este monorepo (tooling Capacitor nuevo, ver
  "Qué NO es esta fase") o afuera? ¿Quién la mantiene? Una vez que exista (sea cual sea la
  respuesta), sigue pendiente confirmar su `capacitor.config.ts` real — si sirve los assets
  embebidos por el scheme propio de Capacitor (`https://localhost`/`capacitor://localhost`,
  comportamiento default de una build de producción), el origen ya es secure context y no repite
  el bug de `crypto.subtle` encontrado con `.test`; si en cambio usa `server.url` apuntando a una
  URL de LAN real (típico de `--livereload` de desarrollo, no de producción), sí puede repetirlo —
  hay reportes de esto mismo en el foro de Ionic/Capacitor. No bloquea Nivel 1 embebido
  (Postgres/Keycloak/cis/core/cip), que no depende de la APK.
- **CORE-Q-02 — RESUELTA (2026-08-27)**: `sicsaft-core.exe` **no** reemplaza a `devops/onprem/`
  (Podman) — coexisten. `sicsaft-core.exe` es el camino prioritario; `devops/onprem/` queda como
  alternativa para un perfil de cliente con servidor dedicado. El trabajo de ADR-004 Fase 3 sigue
  vigente.
- **CORE-Q-03**: Nivel 2 (CCP) y Nivel 3 (RFID) — ¿entran a `sicsaft-core.exe` en incrementos
  futuros con el mismo patrón (procesos embebidos), o Nivel 2/3 siguen necesitando el modelo
  Podman/servidor por su mayor carga?
  - **Nivel 2 — resuelto (2026-09-02, [DOC-030](../design-artifacts/DOC-030-nivel-2-en-sicsaft-core-exe.md))**:
    sí, mismo patrón embebido. El `.exe` ya hornea `ccp/` completo; Nivel 2 = servirlo con el flag
    `VITE_SICSAFT_NIVEL=2`, elegido por el vendedor en el wizard. **Sin `web_admin/` en ningún
    nivel** — decisión del usuario: la instalación es autocontenida, ninguna vía de conexión del
    proveedor al cliente (esto además descarta [DOC-028](../design-artifacts/DOC-028-camino-a-cliente-final.md)
    Fase F, el portal de administración remota).
  - **Nivel 3 (RFID) — sigue abierta**: no hay código `rfid/` que empaquetar (ver `ROADMAP.md`).
