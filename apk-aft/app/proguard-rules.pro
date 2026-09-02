# WebView con JavascriptInterface: si en el futuro se agrega un @JavascriptInterface, hay que
# mantener sus métodos. Hoy no hay puente JS<->Kotlin, así que no hace falta ninguna regla extra.
# ZXing embebido ya trae sus propias reglas consumer-proguard.
-keep class cl.sicsaft.aft.** { *; }
