package cl.sicsaft.aft

import android.content.Context
import android.net.Uri

/**
 * Persistencia y validación de la URL de conexión al `sicsaft-core.exe` (DOC-029 apéndice H).
 *
 * La URL siempre es `https://<host>:<puerto>` — el mismo QR que muestra la pantalla "listo" del
 * `.exe` (`QrAppQr.tsx`, `getUrlAppQr()` devuelve `https://<ip-lan>:8765`). Se guarda en
 * SharedPreferences y se relee en cada arranque; "Reconectar" la reemplaza cuando cambia la IP.
 */
object Conexion {
    private const val PREFS = "sicsaft_aft"
    private const val CLAVE_URL = "url_conexion"

    /** URL guardada, o `null` si es el primer arranque / nunca se conectó. */
    fun urlGuardada(ctx: Context): String? =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(CLAVE_URL, null)

    fun guardarUrl(ctx: Context, url: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(CLAVE_URL, url)
            .apply()
    }

    /**
     * Normaliza y valida lo escaneado/tipeado. Devuelve `https://host:puerto` sin path, o `null`
     * si no es una URL http(s) con host. Se rechaza cualquier cosa que no sea una URL absoluta:
     * el `handler.proceed()` del cert autofirmado (MainActivity) solo se autoriza para ESTE host,
     * así que un valor basura acá haría que la app no cargue nada, no que cargue algo inseguro.
     */
    fun normalizar(entrada: String?): String? {
        val texto = entrada?.trim().orEmpty()
        if (texto.isEmpty()) return null
        val uri = runCatching { Uri.parse(texto) }.getOrNull() ?: return null
        val esquema = uri.scheme?.lowercase()
        if (esquema != "http" && esquema != "https") return null
        val host = uri.host ?: return null
        val puerto = if (uri.port != -1) ":${uri.port}" else ""
        return "$esquema://$host$puerto"
    }

    /** Host (sin puerto) de una URL ya normalizada — para acotar el `onReceivedSslError`. */
    fun hostDe(url: String): String? = runCatching { Uri.parse(url).host }.getOrNull()
}
