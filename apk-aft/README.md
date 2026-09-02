# apk-aft — APK Android de SICSAFT (WebView del Profesional de AFT)

## Objetivo

APK Android nativa mínima (Kotlin, un `WebView` a pantalla completa) que carga la **PWA de la APP
QR** servida por `sicsaft-core.exe` en la IP de LAN por HTTPS autofirmado. Reemplaza el camino
"abrir la PWA en el navegador del teléfono" (DOC-028 Fase D) para las instalaciones on-premise
donde ese navegador molesta con el aviso de certificado en cada arranque.

**No es un TWA** (Bubblewrap / PWABuilder): un TWA es Chrome, y Chrome no ofrece "Continuar" ante
un certificado propio en una IP de LAN → no cargaría. Además un TWA hornea la URL de arranque en
el APK (un APK por instalación). Esta app pide la URL en el primer arranque (escanear el mismo QR
que muestra el `.exe`, o tipearla) y la guarda. Diseño completo:
[DOC-029 apéndice H](../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md).

## Estado

🟡 **Proyecto creado, sin `.apk` construido todavía.** El código Kotlin + Gradle + el workflow de
CI están; falta correr el pipeline una vez (necesita un keystore) y probar el APK en un teléfono
real. No es desplegable (no tiene `Dockerfile` ni corre en un contenedor) — se distribuye como
archivo, servido por `sicsaft-core.exe`.

**Qué hace** (`app/src/main/`):

- `MainActivity` — `WebView` a pantalla completa. `onReceivedSslError` → `proceed()` **solo** si el
  error es del host guardado (cert autofirmado del `.exe`, riesgo MITM en LAN aceptado y
  documentado). `WebChromeClient.onPermissionRequest` → concede cámara **solo** para ese origen (la
  PWA la usa para escanear QR de activos). Links a otros hosts → navegador del sistema. Menú
  "Reconectar" / "Recargar".
- `ConexionActivity` — primer arranque / "Reconectar": escanear el QR del `.exe` (ZXing embebido)
  o escribir `https://<ip>:8765` a mano. `Conexion.normalizar()` valida que sea una URL http(s)
  con host y la reduce a `esquema://host:puerto`.
- `Conexion` — persistencia en `SharedPreferences` + validación.

## Cómo se construye y firma

El `.apk` **no está en el repo** (binario). Sale de la CI o de un build local.

### Vía CI (recomendada)

1. Generar un keystore de release **una vez** (guardarlo fuera del repo):
   ```bash
   keytool -genkeypair -v -keystore sicsaft-release.jks -alias sicsaft \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Cargar 4 **secretos** en el repo de GitHub (Settings → Secrets → Actions):
   - `APK_KEYSTORE_BASE64` — `base64 -w0 sicsaft-release.jks`
   - `APK_KEYSTORE_PASSWORD`, `APK_KEY_ALIAS`, `APK_KEY_PASSWORD`
3. Correr el workflow **`apk-aft`** (push a `apk-aft/**` o `workflow_dispatch`). Sube
   `sicsaft-aft-apk-firmada` como artefacto (`app/build/outputs/apk/release/*.apk`).

Sin los secretos el workflow igual corre y firma con la **debug key** — sirve para iterar, **no**
para distribuir.

### Vía local (Android Studio)

Abrir `apk-aft/` en Android Studio (regenera el wrapper solo), poner un `keystore.properties` al
lado de `app/build.gradle.kts` (`storeFile=`, `storePassword=`, `keyAlias=`, `keyPassword=` — está
gitignoreado) y `Build → Generate Signed Bundle / APK`, o:
```bash
gradle wrapper --gradle-version 8.9   # una vez, para tener ./gradlew
./gradlew assembleRelease
```

## Cómo llega al `.exe`

**Empaquetado (hecho).** `sicsaft-core/scripts/prepack.cjs` (`copiarApk`, lo corre
`npm run dist:win`) copia `apk-aft/app/build/outputs/apk/release/*.apk` a
`sicsaft-core/resources/apk/sicsaft-aft.apk` **si existe** — si no, avisa y sigue, y el `.exe` se
empaqueta sin él (la PWA por navegador queda como único camino). `package.json` `extraResources`
lo incluye en `resources/apk/`.

Para incluirlo:

1. Bajar el `.apk` firmado del artefacto de CI (`sicsaft-aft-apk-firmada`) a
   `apk-aft/app/build/outputs/apk/release/`, o buildearlo local (`./gradlew assembleRelease`).
2. `cd sicsaft-core && npm run dist:win`.

**Servirlo + 2º QR (pendiente).** Falta que `sicsaft-core` sirva el `.apk` en
`https://<ip>:8765/sicsaft-aft.apk` (el servidor estático de la APP QR, `static-portal-server.ts`)
y que la pantalla "listo" del wizard (`PasoListoConLogin.tsx`) muestre un segundo QR para
descargarlo. Diseño en DOC-029 apéndice H.2.

## Depende de

- **`sicsaft-core.exe`** — sirve la PWA y el propio `.apk`, muestra el QR de conexión. Sin el
  `.exe` corriendo, la app no tiene a dónde apuntar.
- **`app-qr-sicsaft/`** — la PWA que la WebView carga. Esta app no la contiene, la referencia por
  URL.

## Bloquea

Nada. La PWA por navegador (DOC-028 Fase D) sigue siendo el camino alternativo.

## Documentos relacionados

- [DOC-029 apéndice H](../aidlc-docs/ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md)
  — diseño (por qué WebView y no TWA, QR de conexión, distribución).
- [DOC-028](../aidlc-docs/sicsaft-core/design-artifacts/DOC-028-camino-a-cliente-final.md) Fase D/E
  — la PWA servida por el `.exe`; Fase E (APK) es lo que este proyecto cierra.
- [`sicsaft-core/RUNBOOK-INSTALACION.md`](../sicsaft-core/RUNBOOK-INSTALACION.md) — dónde encaja en
  la instalación al cliente.

## Próximo paso sugerido

1. Generar el keystore + cargar los 4 secretos + correr el workflow `apk-aft` una vez.
2. Instalar el `.apk` en un teléfono real (sideload, "orígenes desconocidos") y verificar: primer
   arranque → escanear el QR del `.exe` → carga la PWA → login OIDC → escaneo de un activo (permiso
   de cámara) → cerrar control de área. Anotar hallazgos en
   [DOC-027](../aidlc-docs/sicsaft-core/design-artifacts/DOC-027-bitacora-bugs-reales.md).
3. En `sicsaft-core`: servir el `.apk` en `https://<ip>:8765/sicsaft-aft.apk`
   (`static-portal-server.ts`) + segundo QR de descarga en la pantalla "listo" del wizard
   (`PasoListoConLogin.tsx`). El copiado a `resources/apk/` en `prepack.cjs` ya está (misma rama
   que el sidecar Python de RF-B.6.2).
