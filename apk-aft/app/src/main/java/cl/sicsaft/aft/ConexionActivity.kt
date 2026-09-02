package cl.sicsaft.aft

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions

/**
 * Primer arranque / "Reconectar" (DOC-029 apéndice H.2): obtener la URL `https://<ip>:8765` del
 * `sicsaft-core.exe`. Dos caminos: escanear el QR que muestra la pantalla "listo" del `.exe`
 * (`QrAppQr.tsx` codifica exactamente esa URL), o tipearla a mano si la cámara falla.
 *
 * Al confirmar: se normaliza/valida (`Conexion.normalizar`), se guarda y se vuelve a
 * `MainActivity` con la URL en el resultado (para el caso "Reconectar" sin reiniciar la app).
 */
class ConexionActivity : AppCompatActivity() {

    private lateinit var campoUrl: EditText

    private val escanear =
        registerForActivityResult(ScanContract()) { resultado ->
            resultado.contents?.let { campoUrl.setText(it); confirmar(it) }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_conexion)

        campoUrl = findViewById(R.id.campo_url)
        findViewById<TextView>(R.id.ayuda).setText(R.string.conexion_ayuda)

        Conexion.urlGuardada(this)?.let { campoUrl.setText(it) }

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
