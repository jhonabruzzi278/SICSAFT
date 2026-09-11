# INTENT — `ccp-desktop` (launcher instalable del puesto del Profesional de AFT)

## Qué se pidió

Durante una prueba manual de DOC-028 Fase G (`sicsaft-core` sirviendo el CCP por HTTPS en
`https://<ip-lan>:8767` para que el Profesional de AFT lo abra desde su propia PC), el usuario
pidió explícitamente **lo contrario a lo que Fase G construyó**: no quiere que el AFT "entre por
web" (abrir un navegador y tipear/pegar una URL) — quiere un **`.exe` instalable** en la PC del AFT
que **detecte solo la PC madre en la LAN**, igual que ya lo intenta la APP QR/`apk-aft` vía
`discovery-service.ts`, y abra directo la experiencia del CCP.

Decisiones ya tomadas con el usuario (2026-09-10/11), no reabrir sin confirmación:

1. **Alcance: cliente liviano**, no un sistema pesado tipo `sicsaft-core`. `ccp-desktop` **no**
   corre Postgres/Keycloak/CIS/CORE propios — es un *launcher* Electron que descubre la PC madre y
   muestra el CCP que **ya sirve** `sicsaft-core.exe` (Fase G). Análogo a un navegador en modo
   kiosko, no a un nodo más del backend.
2. **Prioridad**: esta fase entra **antes** que la actualización de Linear y el fix de APP QR CI
   (ambos pendientes de una sesión anterior, quedan pospuestos, no cancelados).
3. **Fase G no se toca todavía**: `DOC-028` Fase G (HTTPS/LAN sin instalar nada) sigue viva en
   `sicsaft-core`/`ccp` — `ccp-desktop` es un sistema nuevo que se agrega al lado. Decidir si Fase G
   se deprecia formalmente es una decisión posterior, después de validar `ccp-desktop` con el
   usuario (ver REQUIREMENTS.md RNF-04).

## Por qué ahora

Al probar el `.exe` de punta a punta (ver bitácora de esta sesión, candidato a
[`DOC-027`](../../sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md)), la experiencia
real de "entrar por HTTPS a una IP de LAN, aceptando la advertencia de certificado autofirmado" se
sintió débil para un cliente no técnico — el objetivo declarado del usuario es que **nada se sienta
"web"**: todo lo que el AFT o el Director tocan debe abrirse como una aplicación de escritorio
normal, doble-click e ícono, igual que ya pasa con `sicsaft-core.exe` en la PC madre.

## Qué NO es esta fase

- **No** reemplaza el backend de Fase G — `sicsaft-core.exe` en la PC madre sigue siendo el único
  que corre Postgres/Keycloak/CIS/CORE/CIP y sirve el CCP por HTTPS. `ccp-desktop` es solo la forma
  en la que el AFT **llega** a esa URL, no una reimplementación del CCP.
- **No** decide todavía si reemplaza o convive con Fase G en el instalador final — eso depende de
  cómo salga esta primera versión (ver REQUIREMENTS.md RNF-04 y el criterio de cierre).
- **No** incluye la APK de Android (`apk-aft/`, DOC-029 RF-H) — es un sistema Windows de escritorio
  paralelo, aunque reusa el mismo protocolo de descubrimiento UDP que `apk-aft` ya tiene pensado
  consumir.
- **No** resuelve el descubrimiento *entre redes* (VPN, subredes distintas, Wi-Fi con aislamiento de
  clientes) — sigue acotado a broadcast UDP en la misma LAN, misma limitación que ya tiene
  `discovery-service.ts` para la APP QR.

## Fuente

- Conversación de esta sesión (prueba manual de `sicsaft-core` en dev, 2026-09-10/11).
- [`DOC-028-camino-a-cliente-final.md`](../../sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md)
  Fase G — el flujo que este sistema reemplaza en la experiencia del AFT (no en el backend).
- `sicsaft-core/src/main/services/discovery-service.ts` — protocolo UDP de descubrimiento ya
  implementado del lado servidor, pensado originalmente para `apk-aft` (comentario "Mejora 1 /
  RF-01" en el propio archivo).
