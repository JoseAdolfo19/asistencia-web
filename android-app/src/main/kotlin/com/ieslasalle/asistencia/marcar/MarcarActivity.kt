package com.ieslasalle.asistencia.marcar

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.ieslasalle.asistencia.Auth.AuthManager
import com.ieslasalle.asistencia.R
import com.ieslasalle.asistencia.Modelos.Alumno
import com.ieslasalle.asistencia.Screens.MainActivity

class MarcarActivity : AppCompatActivity() {

    private var authManager: AuthManager? = null
    private var ivQrScanner: ImageView
    private lateinit var etCodigoDia: EditText
    private lateinit var txtNombre: TextView
    private lateinit var btnMarcarQr: Button
    private lateinit var btnMarcarCodigo: Button
    private lateinit var txtInstrucciones: TextView
    private val REQUEST_CAMERA_PERMISSION = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_marcar)

        // Inicializar componentes
        ivQrScanner = findViewById(R.id.iv_qr_scanner)
        etCodigoDia = findViewById(R.id.et_codigo_dia)
        txtNombre = findViewById(R.id.txt_nombre)
        btnMarcarQr = findViewById(R.id.btn_marcar_qr)
        btnMarcarCodigo = findViewById(R.id.btn_marcar_codigo)
        txtInstrucciones = findViewById(R.id.txt_instrucciones)

        authManager = AuthManager(this, com.supabase.supabase.kt.SupabaseClient.create(
            "https://wdusozavhsgqlwsyxmzb.supabase.co",
            "sb_anónimo_token"
        ))

        // Verificar permisos de cámara
        verificarPermisoCamara()

        // Configurar listeners
        btnMarcarQr.setOnClickListener {
            if (checkCamaraPermission()) {
                abrirScanner()
            }
        }

        btnMarcarCodigo.setOnClickListener {
            marcarConCodigoDia()
        }

        // Cargar nombre del usuario
        cargarNombreUsuario()
    }

    private fun verificarPermisoCamara() {
        if (android.content.ContextCompat.checkSelfPermission(
                this, Manifest.permission.CAMERA
            ) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                arrayOf(Manifest.permission.CAMERA),
                REQUEST_CAMERA_PERMISSION)
        }
    }

    private fun checkCamaraPermission(): Boolean {
        return android.content.ContextCompat.checkSelfPermission(
            this, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    @Override
    public void onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                abrirScanner()
            } else {
                Toast.makeText(this, "Permiso de cámara denegado", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun abrirScanner() {
        // Intent para el scanner de QR
        val intent = Intent(this::class.java, ScannerActivity::class.java)
        startActivity(intent)
    }

    private fun cargarNombreUsuario() {
        // Cargar nombre desde la sesión
        val alumno = authManager!!.getAlumnoPerfil()
        if (alumno != null) {
            txtNombre.text = "${alumno.nombres} ${alumno.apellidos}"
        }
    }

    private fun marcarConCodigoDia() {
        val codigo = etCodigoDia.text.toString().trim()
        val nombre = txtNombre.text.toString()

        if (codigo.isNotEmpty() && nombre.isNotEmpty()) {
            // Llamar a la función marcarConCodigo desde AuthManager
            // (implementación simplificada)
            Toast.makeText(this, "Marcando con código: $codigo", Toast.LENGTH_SHORT).show()
            // Aquí iría la llamada a la función de Supabase
            // authManager!!.marcarConCodigo(codigo, nombre)
            
            // Por ahora, navegar a MainActivity
            val intent = Intent(this, MainActivity::class.java)
            startActivity(intent)
            finish()
        } else {
            Toast.makeText(this, "Por favor completa todos los campos", Toast.LENGTH_SHORT).show()
        }
    }
}