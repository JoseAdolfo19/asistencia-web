package com.ieslasalle.asistencia.scanner

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.zxing.integrator.ZXingScannerView
import com.ieslasalle.asistencia.Auth.AuthManager
import com.ieslasalle.asistencia.R

class ScannerActivity : AppCompatActivity() {

    private var scannerView: ZXingScannerView? = null
    private var authManager: AuthManager? = null
    private val REQUEST_CAMERA_PERMISSION = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Solicitar permiso de cámara si es necesario
        if (android.content.ContextCompat.checkSelfPermission(
                this, Manifest.permission.CAMERA
            ) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                arrayOf(Manifest.permission.CAMERA),
                REQUEST_CAMERA_PERMISSION)
        } else {
            setupScanner()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                setupScanner()
            } else {
                Toast.makeText(this, "Permiso de cámara denegado", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }

    private fun setupScanner() {
        // Crear el scanner view
        scannerView = ZXingScannerView(this)
        setContentView(scannerView!!)

        // Configurar el botón de volver
        val btnVolver = findViewById<Button>(android.R.id.home)
        btnVolver.setOnClickListener {
            finish()
        }

        // Iniciar el escaneo inmediatamente
        scannerView?.startCamera()
        
        // Configurar el resultado del escaneo
        scannerView?.setOnResultListener { result ->
            procesarResultadoEscaneo(result.text)
        }
    }

    private fun procesarResultadoEscaneo(codigoQr: String?) {
        if (codigoQr.isNullOrEmpty()) {
            Toast.makeText(this, "No se detectó QR", Toast.LENGTH_SHORT).show()
            return
        }

        // Aquí procesaríamos el código QR
        // El formato típico es: token|alumno_id o solo el token
        val partes = codigoQr.split("|")
        val token = if (partes.size > 1) partes[0] else codigoQr
        val alumnoId = if (partes.size > 1) partes[1] else ""

        // Verificar el token con Supabase
        authManager!!.marcarConQrDocente(token).await()?.let { result ->
            runOnUiThread {
                when {
                    result.ok -> {
                        Toast.makeText(this, "Asistencia registrada: ${result.estado} en ${result.curso}", Toast.LENGTH_LONG).show()
                        // Regresar al menú principal
                        val intent = Intent(this, MainActivity::class.java)
                        startActivity(intent)
                        finish()
                    }
                    result.error -> {
                        Toast.makeText(this, "QR inválido o expirado: ${result.error}", Toast.LENGTH_LONG).show()
                        // Volver a escanear
                        scannerView?.startCamera()
                    }
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        scannerView?.stopCamera()
    }

    override fun onResume() {
        super.onResume()
        if (scannerView != null) {
            scannerView?.startCamera()
        }
    }
}