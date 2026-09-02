# apk-aft — APK Android — Metadata del proyecto

**Fase AI-DLC:** Construction (proyecto creado; falta build/firma/verificación en dispositivo).

**Sistema:** `apk-aft/` (nuevo — app Android WebView, no desplegable: se distribuye como archivo
servido por `sicsaft-core.exe`).

**Incremento:** DOC-029 RF-H — cierra la Fase E de DOC-028 (APK Android) con una WebView Kotlin
propia en vez de un TWA/Capacitor.

## Quick links

- Diseño: [DOC-029 apéndice H](../ccp/design-artifacts/DOC-029-endurecimiento-ccp-cliente-real.md)
  (RF-H: por qué WebView y no TWA, QR de conexión, distribución vía el `.exe`).
- README del sistema: [`apk-aft/README.md`](../../apk-aft/README.md) — build, firma, cómo llega al
  `.exe`.
- CI: [`.github/workflows/apk-aft-ci.yml`](../../.github/workflows/apk-aft-ci.yml) — build + firma
  con keystore como secreto (`APK_KEYSTORE_BASE64` / `_PASSWORD` / `APK_KEY_ALIAS` / `_PASSWORD`).

## Estado

🟡 Código Kotlin + Gradle + workflow de CI creados (2026-09-02). Pendiente:

1. Generar el keystore de release y cargar los 4 secretos en GitHub.
2. Correr el workflow `apk-aft` para producir el `.apk` firmado.
3. Instalar en un teléfono real y verificar el flujo end-to-end (conexión por QR → PWA → login
   OIDC → escaneo de activo con permiso de cámara).
4. `gradle-wrapper.jar` no está commiteado desde este entorno (binario) — lo regenera
   `gradle wrapper` / Android Studio / la CI.

## Depende de

`sicsaft-core.exe` (sirve la PWA + el propio `.apk` + el QR de conexión) y `app-qr-sicsaft/` (la
PWA que la WebView carga, referenciada por URL).

## Bloquea

Nada — la PWA por navegador (DOC-028 Fase D) es el camino alternativo permanente.

## Próximo paso sugerido

Ver "Próximo paso sugerido" en [`apk-aft/README.md`](../../apk-aft/README.md).
