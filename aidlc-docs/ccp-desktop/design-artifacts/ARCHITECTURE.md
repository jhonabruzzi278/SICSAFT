# Arquitectura — ccp-desktop

## Decisión: launcher delgado, no un CCP nativo

`ccp-desktop` **no reimplementa el CCP** en Electron. Abre el CCP web real
(`https://<ip-pc-madre>:8767`) en una `BrowserWindow` sin preload propio. Alternativa descartada:
reconstruir la UI del CCP en Electron — duplicaría todo `ccp/` y quedaría desincronizado en cada
cambio. El launcher solo resuelve lo que el navegador no resuelve solo: encontrar la PC madre en
la LAN y confiar en su certificado autofirmado.

## Decisión: confianza en primer uso (TOFU) — "Opción A"

El CCP corre sobre HTTPS con certificado autofirmado (no hay CA pública en una LAN on-premise).
`app.on('certificate-error')` intercepta la validación y decide según `ModoConfianza`:

| Modo | Cuándo | Riesgo |
|---|---|---|
| **`tofu`** (Opción A, elegida) | Primera conexión (auto-descubierta o manual) | Acepta el certificado que sea la primera vez; igual que SSH `known_hosts` |
| **`fingerprint`** | Reconexiones siguientes | Ninguno — rechaza si el fingerprint cambió sin aviso |
| **`ninguno`** | Fallback | Rechaza la conexión |

Alternativas descartadas: **CA propia instalada en cada puesto** (carga operativa por PC del
cliente, inviable para un instalador de un clic) y **desactivar la validación de certificado**
(inseguro — cualquiera en la LAN podría suplantar a la PC madre). TOFU + pin de fingerprint da la
mayoría de la seguridad de una CA propia sin su costo de instalación.

## Flujo

```
buscarYConectar() -- UDP broadcast :58765 --> sicsaft-core responde {ip, puertoCcp, fingerprint}
  -> guardarConexion() (conexion-store.ts, persiste para la próxima vez)
  -> conectar(ip, puerto, modo: "fingerprint")
  -> abrirVentanaCcp() -- https://ip:puerto -- certificate-error valida contra el fingerprint guardado
```

Reconexión: `leerConexionGuardada()` salta el broadcast y conecta directo con `modo: "fingerprint"`.
Conexión manual (IP a mano, si el broadcast no llega): `modo: "tofu"` — acepta lo que responda esa IP.

## Componentes

| Archivo | Responsabilidad |
|---|---|
| `src/main/services/discovery-client.ts` | Broadcast UDP, protocolo `SICSAFT_DISCOVERY_PING` |
| `src/main/services/conexion-store.ts` | Persiste última IP + fingerprint |
| `src/main/index.ts` | Orquesta conexión, ventanas, `certificate-error` |

## Estado

🟢 Implementado y en producción desde DOC-028 Fase G (commit `6529d76`). Sin tests e2e propios
todavía — solo unit tests (`vitest`).
