# REQUIREMENTS — `ccp-desktop`

Fuente: INTENT.md (este mismo directorio) + decisiones tomadas con el usuario 2026-09-10/11.

## Funcionales

- **CCPD-RF-01 — Descubrimiento automático de la PC madre.** Al abrir, `ccp-desktop` transmite un
  broadcast UDP al puerto `58765` (`PUERTO_DISCOVERY_UDP`, ya definido en
  `sicsaft-core/src/main/services/discovery-service.ts`) con el comando `SICSAFT_DISCOVERY_PING` y
  escucha las respuestas `DISCOVERY_PONG` (`armarRespuestaDiscovery`). No pide al usuario que tipee
  una IP salvo que el descubrimiento no encuentre nada (RF-04).
- **CCPD-RF-02 — Extender la respuesta de discovery con el puerto del CCP.** Hoy
  `armarRespuestaDiscovery` devuelve `url`/`puerto` fijados a `PUERTO_APP_QR` (8765) — pensado
  para `apk-aft`, no para el CCP. Agregar un campo `puertoCcp: PUERTO_CCP_LAN` (8767) a
  `InfoRespuestaDiscovery` en `discovery-service.ts` (cambio del lado de `sicsaft-core`, no de
  `ccp-desktop`) para que un único protocolo sirva a los dos clientes sin que `ccp-desktop` tenga
  que adivinar el puerto.
- **CCPD-RF-03 — Abrir el CCP real, no reimplementarlo.** Tras resolver la IP de la PC madre,
  `ccp-desktop` abre una `BrowserWindow` apuntando a `https://<ip-pc-madre>:8767` — el mismo CCP que
  ya sirve `static-portal-server.ts` (Fase G). `ccp-desktop` no tiene rutas, componentes ni estado
  de negocio propios.
- **CCPD-RF-04 — Fallback manual.** Si no llega ninguna respuesta de discovery en N segundos
  (configurable, default a definir en diseño), mostrar una pantalla simple para ingresar la IP a
  mano — mismo caso de uso que ya cubre el flujo de "Copiar dirección" del wizard de `sicsaft-core`
  (DOC-028 Fase G) para cuando el AFT prefiere pegarla directo.
- **CCPD-RF-05 — Recordar la última PC madre encontrada.** Persistir la última IP resuelta
  (`electron-store` o un JSON propio en `userData`) para no tener que redescubrir en cada arranque;
  reintentar discovery solo si esa IP deja de responder.
- **CCPD-RF-06 — Reautenticación igual que hoy.** El login OIDC/PKCE contra Keycloak lo sigue
  resolviendo el CCP mismo (la página que se carga), `ccp-desktop` no intercepta tokens ni
  credenciales — mismo principio de "el renderer no es confiable con secretos" que ya aplica en
  `sicsaft-core` (ver `sicsaft-core/src/main/index.ts`, comentario de `contextIsolation`/`sandbox`).

## No funcionales

- **CCPD-RNF-01 — Sin backend propio.** Cero Postgres, cero Keycloak, cero proceso NestJS
  embebido — la única responsabilidad de `ccp-desktop` es descubrir + mostrar. Esto es lo que lo
  diferencia de `sicsaft-core` y lo que mantiene bajo el esfuerzo de construcción (decisión
  explícita del usuario, ver INTENT.md).
- **CCPD-RNF-02 — Confianza del certificado autofirmado.** El CCP de la PC madre corre con el
  mismo certificado autofirmado que la APP QR (`appqr-tls.ts`, SAN = IP de LAN + `sicsaft.local`).
  `ccp-desktop` **no puede** simplemente ignorar errores de certificado en el `BrowserWindow`
  (`ignore-certificate-errors` global) sin degradar la seguridad frente a un MITM en la LAN —
  definir en diseño si: (a) se pinnea el cert exacto recibido en el handshake de discovery
  (`certificate-error` + comparar fingerprint), o (b) `sicsaft-core` expone su fingerprint SHA-256
  en la respuesta de discovery (RF-02) para que `ccp-desktop` lo verifique antes de confiar. **No
  cerrar esta fase sin resolver esto** — es la brecha de seguridad más obvia del diseño.
- **CCPD-RNF-03 — Empaquetado Windows.** Mismo mecanismo que `sicsaft-core` (`electron-builder` +
  NSIS, `bun run dist:win`) para que el AFT lo instale con un instalador familiar — no introducir
  una tercera herramienta de empaquetado al ecosistema.
- **CCPD-RNF-04 — Convivencia con Fase G, no reemplazo automático.** Mientras no se decida lo
  contrario con el usuario, `DOC-028` Fase G sigue siendo el camino soportado para quien no quiera
  instalar nada (ver INTENT.md). `ccp-desktop` no borra esa opción — el usuario decide más adelante
  si la deprecia.
- **CCPD-RNF-05 — Mismo criterio de logging/diagnóstico que `sicsaft-core`.** Reusar el patrón de
  `logger.ts` (buffer en memoria + archivo diario en `%APPDATA%`, `redactar()` de secretos) en vez
  de inventar uno nuevo — mismo motivo: un vendedor/soporte no técnico necesita poder copiar el log
  sin exponer credenciales.

## Preguntas abiertas para el diseño (`ARCHITECTURE.md`)

1. ¿Discovery corre una sola vez al abrir, o hay un botón "Buscar de nuevo" visible si la PC madre
   cambió de IP (DHCP)?
2. ¿Qué pasa si hay **más de una** PC madre respondiendo en la misma LAN (dos organizaciones
   instaladas en la misma red física)? Hoy `armarRespuestaDiscovery` no distingue organización más
   que por el campo `nombre` — ¿alcanza para que el AFT elija a mano cuál es la suya?
3. ¿El icono/nombre del `.exe` debe distinguirse claramente de `sicsaft-core.exe` para que el AFT no
   los confunda (uno es "el launcher", el otro es "el servidor de la PC madre")?
