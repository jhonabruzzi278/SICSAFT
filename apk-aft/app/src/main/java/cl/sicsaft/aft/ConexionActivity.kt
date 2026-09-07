package cl.sicsaft.aft

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

/**
 * Primer arranque / "Reconectar" (DOC-029 apéndice H.2): obtener la URL `https://<ip>:8765` del
 * `sicsaft-core.exe`. Tres caminos:
 *  1. Auto-descubrimiento en Wi-Fi (Mejora 1 / UDP broadcast al puerto 58765).
 *  2. Escanear el QR que muestra la pantalla "listo" del `.exe` (`QrAppQr.tsx`).
 *  3. Tipear la URL a mano.
 *
 * Al confirmar: se normaliza/valida (`Conexion.normalizar`), se guarda y se vuelve a
 * `MainActivity` con la URL en el resultado.
 */
class ConexionActivity : AppCompatActivity() {

    private lateinit var campoUrl: EditText
    private lateinit var botonDescubrir: Button

    private val escanear =
        registerForActivityResult(ScanContract()) { resultado ->
            resultado.contents?.let { campoUrl.setText(it); confirmar(it) }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_conexion)

        campoUrl = findViewById(R.id.campo_url)
        botonDescubrir = findViewById(R.id.boton_descubrir)
        findViewById<TextView>(R.id.ayuda).setText(R.string.conexion_ayuda)

        Conexion.urlGuardada(this)?.let { campoUrl.setText(it) }

        botonDescubrir.setOnClickListener {
            buscarEnWifi()
        }

        findViewById<Button>(R.id.boton_escanear).setOnClickListener {
            escanear.launch(
                ScanOptions()
                    .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                    .setPrompt(getString(R.string.conexion_prompt_scan))
                    .setBeepEnabled(false)
                    .setOrientationLocked(false),
            )
        }
        findViewById<Button>(R.id.boton_conectar).setOnClickListener {
            confirmar(campoUrl.text?.toString())
        }
    }

    private fun buscarEnWifi() {
        botonDescubrir.isEnabled = false
        Toast.makeText(this, R.string.conexion_buscando_wifi, Toast.LENGTH_SHORT).show()

        Thread {
            var urlDetectada: String? = null
            var socket: DatagramSocket? = null
            try {
                socket = DatagramSocket()
                socket.broadcast = true
                socket.soTimeout = 3000

                val mensaje = "SICSAFT_DISCOVERY_PING".toByteArray(Charsets.UTF_8)
                val destino = InetAddress.getByName("255.255.255.255")
                val paqueteEnvio = DatagramPacket(mensaje, mensaje.size, destino, 58765)
                socket.send(paqueteEnvio)

                val bufferRecibo = ByteArray(2048)
                val paqueteRecibo = DatagramPacket(bufferRecibo, bufferRecibo.size)
                socket.receive(paqueteRecibo)

                val respuestaStr = String(paqueteRecibo.data, 0, paqueteRecibo.length, Charsets.UTF_8)
                val json = JSONObject(respuestaStr)
                if (json.optString("app") == "SICSAFT") {
                    urlDetectada = json.optString("url")
                }
            } catch (_: Exception) {
                // Timeout de broadcast o sin servidor en la LAN
            } finally {
                socket?.close()
            }

            runOnUiThread {
                botonDescubrir.isEnabled = true
                if (!urlDetectada.isNullOrBlank()) {
                    campoUrl.setText(urlDetectada)
                    Toast.makeText(this, R.string.conexion_servidor_encontrado, Toast.LENGTH_SHORT).show()
                    confirmar(urlDetectada)
                } else {
                    Toast.makeText(this, R.string.conexion_servidor_no_encontrado, Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun confirmar(entrada: String?) {
        val url = Conexion.normalizar(entrada)
        if (url == null) {
            Toast.makeText(this, R.string.conexion_url_invalida, Toast.LENGTH_LONG).show()
            return
        }
        Conexion.guardarUrl(this, url)
        setResult(Activity.RESULT_OK, Intent().putExtra(EXTRA_URL, url))
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    companion object {
        const val EXTRA_URL = "cl.sicsaft.aft.URL"
    }
}
