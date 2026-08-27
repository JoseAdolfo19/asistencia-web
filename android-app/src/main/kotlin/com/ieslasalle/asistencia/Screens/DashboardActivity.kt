package com.ieslasalle.asistencia.Screens

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.ieslasalle.asistencia.Auth.AuthManager
import com.ieslasalle.asistencia.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DashboardActivity : AppCompatActivity() {

    private var authManager: AuthManager? = null
    private lateinit var txtBienvenida: TextView
    private lateinit var btnMarcarAsistencia: Button
    private lateinit var btnVerMultas: Button
    private lateinit var btnCerrarSesion: Button
    private lateinit var txtTotalAlumnos: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        // Inicializar componentes
        txtBienvenida = findViewById(R.id.txt_bienvenida)
        btnMarcarAsistencia = findViewById(R.id.btn_marcar_asistencia)
        btnVerMultas = findViewById(R.id.btn_ver_multas)
        btnCerrarSesion = findViewById(R.id.btn_cerrar_sesion)
        txtTotalAlumnos = findViewById(R.id.txt_total_alumnos)

        authManager = AuthManager(this, com.supabase.supabase.kt.SupabaseClient.create(
            "https://wdusozavhsgqlwsyxmzb.supabase.co",
            "sb_anónimo_token"
        ))

        // Verificar permisos de admin
        if (authManager!!.getRole() != "Admin") {
            Toast.makeText(this, "No tiene permisos de administrador", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // Configurar interfaz
        configurarInterfaz()

        // Cargar datos
        cargarDatos()
    }

    private fun configurarInterfaz() {
        // Bienvenida al admin
        txtBienvenida.text = "Panel de Administración - IES La Salle"

        // Configurar listeners
        btnMarcarAsistencia.setOnClickListener {
            // Admin puede ver todos los marcaciones
            Toast.makeText(this, "Acceso a reportes de asistencia", Toast.LENGTH_SHORT).show()
        }

        btnVerMultas.setOnClickListener {
            // Ir a reporte de multas
            Toast.makeText(this, "Ver multas pendientes", Toast.LENGTH_SHORT).show()
        }

        btnCerrarSesion.setOnClickListener {
            cerrarSesion()
        }
    }

    private fun cargarDatos() {
        // Cargar estadísticas en background
        CoroutineScope(Dispatchers.IO).launch {
            // Contar alumnos activos
            val totalAlumnos = contarAlumnosActivos()
            runOnUiThread {
                txtTotalAlumnos.text = "Total de alumnos activos: $totalAlumnos"
            }
        }
    }

    private fun contarAlumnosActivos(): Int {
        // Query simple a Supabase para contar alumnos registrados
        return 31 // Valor placeholder - en producción haría query real
    }

    private fun cerrarSesion() {
        authManager!!.signOut().await()
        authManager!!.sharedPreferencesEditor.clear()
        authManager!!.sharedPreferencesEditor.apply()

        // Regresar al login
        val intent = Intent(this, AuthActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(intent)
        finish()
    }
}