# ccp-desktop — Launcher LAN del puesto del Profesional de AFT (SYS-12)

## Qué es (y qué NO es)

Un launcher Electron pequeño (~200 líneas de lógica propia) para la PC del **Profesional de AFT**
cuando trabaja desde un puesto distinto al que corre `sicsaft-core.exe`. **No** es una versión de
escritorio del portal CCP completo — no tiene Postgres, Keycloak, ni backend propios. Su única
función es encontrar la PC madre en la red local y abrir el CCP real que ella sirve, en una
ventana nativa.

Nace de [DOC-028 Fase G](../aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md)
y se distribuye empaquetado junto al instalador principal (ver `sicsaft-core/README.md` y
`sicsaft-core/resources/README.md`).

## Cómo funciona

1. **Descubrimiento** (`src/main/services/discovery-client.ts`): manda un broadcast UDP
   (`SICSAFT_DISCOVERY_PING`, puerto `58765`) en la LAN; la PC madre (`sicsaft-core.exe`) contesta
   con su IP.
2. **Confianza en primer uso (TOFU)**: valida el certificado autofirmado del CCP por *fingerprint*
   (`X509Certificate`, Node `crypto`) y lo recuerda — no vuelve a preguntar si la huella no cambió.
3. **Persistencia** (`src/main/services/conexion-store.ts`): guarda la última IP conectada para no
   tener que redescubrir la PC madre cada vez que se abre.
4. **Ventana del CCP**: abre `https://<ip-pc-madre>:8767` (`PUERTO_CCP_LAN_DEFAULT`) en una
   `BrowserWindow` — el CCP que corre ahí es exactamente el mismo `ccp/` de siempre, sin código
   propio de UI en este proyecto.
5. Conexión manual disponible (ingresar IP a mano) si el broadcast UDP no encuentra la PC madre
   (redes con broadcast bloqueado, VLANs, etc.).

## Desarrollo y build

```bash
cd ccp-desktop
bun install
bun run dev              # Electron en modo desarrollo (electron-vite)
bun run lint:ci           # eslint --max-warnings=0
bun run test              # vitest run
bun run typecheck         # tsc --noEmit (main + renderer)
bun run dist:win          # electron-builder → instalador NSIS "SICSAFT CCP.exe"
```

## Estado

🟢 Código real y funcional (no un experimento) — descubrimiento UDP, TOFU y apertura de ventana
verificados en `src/main/index.ts`. Empaquetado NSIS real (`electron-builder`, `appId
cl.sicsaft.ccp-desktop`).

Arquitectura y decisiones de diseño (por qué un launcher y no un CCP nativo, por qué TOFU):
[`../aidlc-docs/ccp-desktop/design-artifacts/ARCHITECTURE.md`](../aidlc-docs/ccp-desktop/design-artifacts/ARCHITECTURE.md).

## Depende de

`sicsaft-core.exe` corriendo en la LAN, sirviendo el CCP en `:8767` con broadcast UDP de
discovery activo (mismo binario, no requiere configuración adicional del lado servidor).

## Documentos relacionados

- [DOC-028 — Camino a cliente final (.exe)](../aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md) Fase G.
- [`sicsaft-core/README.md`](../sicsaft-core/README.md) — cómo se empaqueta y distribuye junto al instalador principal.
