// DOC-029 RF-H — APK Android de SICSAFT: una WebView propia mínima que carga la PWA de la APP QR
// servida por sicsaft-core.exe en la IP de LAN, con HTTPS autofirmado. NO es un TWA (Bubblewrap /
// PWABuilder): un TWA es Chrome, y Chrome no ofrece "Continuar" ante un cert propio en IP de LAN,
// así que no cargaría. Ver DOC-029 apéndice H para el diseño completo.

plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
