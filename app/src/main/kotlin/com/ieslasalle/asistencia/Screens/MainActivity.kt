package com.ieslasalle.asistencia.Screens

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.ieslasalle.asistencia.Auth.AuthManager
import com.ieslasalle.asistencia.R
import com.ieslasalle.asistencia.Modelos.Alumno
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private var authManager: AuthManager? = null
    private lateinit var txtBienvenida: TextView
    private lateinit var btnMarcarAsistencia: Button
    private lateinit var btnVerHistorial: Button
    private lateinit var btnCerrarSesion: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Inicializar componentes
        txtBienvenida = findViewById(R.id.txt_bienvenida)
        btnMarcarAsistencia = findViewById(R.id.btn_marcar_asistencia)
        btnVerHistorial = findViewById(R.id.btn_ver_historial)
        btnCerrarSesion = findViewById(R.id.btn_cerrar_sesion)

        authManager = AuthManager(this, com.supabase.supabase.kt.SupabaseClient.create(
            "https://wdusozavhsgqlwsyxmzb.supabase.co",
            "sb_anónimo_token"
        ))

        // Verificar si hay sesión activa
        if (!authManager!!.isLoggedIn()) {
            // Ir al login si no hay sesión
            loginToActivity()
            return
        }

        // Mostrar bienvenida personalizada
        loadUserProfile()

        // Configurar listeners
        btnMarcarAsistencia.setOnClickListener {
            intentToMarcarActivity()
        }

        btnVerHistorial.setOnClickListener {
            intentToHistorialActivity()
        }

        btnCerrarSesion.setOnClickListener {
            cerrarSesion()
        }
    }

    private fun loadUserProfile() {
        // Cargar perfil en background
        CoroutineScope(Dispatchers.IO).launch {
            val alumno = authManager!!.getAlumnoPerfil()
            runOnUiThread {
                if (alumno != null) {
                    txtBienvenida.text = "Bienvenido, ${alumno.nombres} ${alumno.apellidos}"
                } else {
                    txtBienvenida.text = "Bienvenido a Asistencia IES"
                }
            }
        }
    }

    private fun intentToMarcarActivity() {
        val intent = Intent(this, MarcarActivity::class.java)
        startActivity(intent)
    }

    private fun intentToHistorialActivity() {
        val intent = Intent(this, HistorialActivity::class.java)
        startActivity(intent)
    }

    private fun cerrarSesion() {
        authManager!!.signOut().await()
        // Limpiar preferencias locales
        authManager!!.sharedPreferencesEditor.clear()
        authManager!!.sharedPreferencesEditor.apply()

        // Regresar al login
        loginToActivity()
    }

    private fun loginToActivity() {
        val intent = Intent(this, AuthActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(intent)
    }
}