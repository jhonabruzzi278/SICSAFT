package cl.sicsaft.aft

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.http.SslError
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * WebView a pantalla completa que carga la PWA de la APP QR servida por `sicsaft-core.exe`
 * (DOC-029 apéndice H). Sin barra de direcciones, sin pestañas: es "la app", no un navegador.
 *
 * Dos concesiones de seguridad, ambas acotadas al host configurado y documentadas:
 *  - `onReceivedSslError` → `proceed()` SOLO si el error es del host guardado (cert autofirmado
 *    del `.exe` en la IP de LAN — no hay CA que lo firme; el riesgo es un MITM en la LAN del
 *    cliente, aceptado y documentado en DOC-029 apéndice H.2).
 *  - `onPermissionRequest` → concede cámara SOLO si la request viene de ese mismo origen (la PWA
 *    la necesita para `getUserMedia` / escaneo de QR de activos).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var baseUrl: String = ""

    private val pedirCamara =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { concedida ->
            if (!concedida) {
                Toast.makeText(this, R.string.camara_denegada, Toast.LENGTH_LONG).show()
            }
        }

    private val reconectar =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
            val nueva = res.data?.getStringExtra(ConexionActivity.EXTRA_URL)
            if (res.resultCode == RESULT_OK && nueva != null) {
                baseUrl = nueva
                webView.loadUrl(baseUrl)
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val guardada = Conexion.urlGuardada(this)
        if (guardada == null) {
            // Primer arranque: no hay a dónde apuntar todavía.
            startActivity(Intent(this, ConexionActivity::class.java))
            finish()
            return
        }
        baseUrl = guardada

        webView = WebView(this)
        setContentView(webView)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pedirCamara.launch(Manifest.permission.CAMERA)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
        }
        webView.webViewClient = ClienteWeb()
        webView.webChromeClient = ClienteChrome()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState == null) webView.loadUrl(baseUrl)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menu.add(0, MENU_RECONECTAR, 0, R.string.menu_reconectar)
        menu.add(0, MENU_RECARGAR, 1, R.string.menu_recargar)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean = when (item.itemId) {
        MENU_RECONECTAR -> {
            reconectar.launch(Intent(this, ConexionActivity::class.java))
            true
        }
        MENU_RECARGAR -> {
            webView.loadUrl(baseUrl)
            true
        }
        else -> super.onOptionsItemSelected(item)
    }

    private inner class ClienteWeb : WebViewClient() {
        override fun onReceivedSslError(
            view: WebView,
            handler: SslErrorHandler,
            error: SslError,
        ) {
            val hostError = runCatching { android.net.Uri.parse(error.url).host }.getOrNull()
            val hostBase = Conexion.hostDe(baseUrl)
            if (hostError != null && hostError == hostBase) {
                // Cert autofirmado del .exe en la IP de LAN — esperado (DOC-029 apéndice H.2).
                handler.proceed()
            } else {
                handler.cancel()
            }
        }

        override fun shouldOverrideUrlLoading(
            view: WebView,
            request: WebResourceRequest,
        ): Boolean {
            // Todo lo que sea del host configurado se carga acá; cualquier otro host (un link
            // externo) se deriva al navegador del sistema en vez de abrirse dentro de la app.
            val host = request.url.host
            if (host != null && host == Conexion.hostDe(baseUrl)) return false
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
            return true
        }
    }

    private inner class ClienteChrome : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
            val origenOk = request.origin?.host == Conexion.hostDe(baseUrl)
            val soloCamara = request.resources.all {
                it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
            }
            if (origenOk && soloCamara &&
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED
            ) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
            } else {
                request.deny()
            }
        }
    }

    private companion object {
        const val MENU_RECONECTAR = 1
        const val MENU_RECARGAR = 2
    }
}
