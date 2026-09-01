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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DashboardActivity : AppCompatActivity() {

    private var authManager: AuthManager? = null
    private lateinit var txtBienvenida: TextView
    private lateinit var btnMarcarAsistencia: Button
    private lateinit var btnVerMultas: Button
    private lateinit var btnCerrarSesion: Button
    private lateinit var txtTotalAlumnos: TextView
    private lateinit var txtFechaHoy: TextView
    private lateinit var txtMultasHoy: TextView
    private lateinit var btnNavInicio: Button
    private lateinit var btnNavAsistencia: Button
    private lateinit var btnNavMultas: Button
    private lateinit var btnNavPerfil: Button
    private lateinit var fabQr: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        // Inicializar componentes
        txtBienvenida = findViewById(R.id.txt_bienvenida)
        btnMarcarAsistencia = findViewById(R.id.btn_marcar_asistencia)
        btnVerMultas = findViewById(R.id.btn_ver_multas)
        btnCerrarSesion = findViewById(R.id.btn_cerrar_sesion)
        txtTotalAlumnos = findViewById(R.id.txt_total_alumnos)
        txtFechaHoy = findViewById(R.id.txt_fecha_hoy)
        txtMultasHoy = findViewById(R.id.txt_multas_hoy)
        btnNavInicio = findViewById(R.id.btn_nav_inicio)
        btnNavAsistencia = findViewById(R.id.btn_nav_asistencia)
        btnNavMultas = findViewById(R.id.btn_nav_multas)
        btnNavPerfil = findViewById(R.id.btn_nav_perfil)
        fabQr = findViewById(R.id.fab_qr)

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
        val fechaHoy = SimpleDateFormat("dd/MM/yyyy", Locale("es", "PE")).format(Date())

        txtBienvenida.text = "Panel de Administración"
        txtFechaHoy.text = "Hoy: $fechaHoy"
        txtMultasHoy.text = "Multas del día: 0 pendientes • Total S/ 0.00"

        btnMarcarAsistencia.setOnClickListener {
            Toast.makeText(this, "Reportes de asistencia", Toast.LENGTH_SHORT).show()
        }

        btnVerMultas.setOnClickListener {
            Toast.makeText(this, "Mostrando multas del día", Toast.LENGTH_SHORT).show()
        }

        btnNavInicio.setOnClickListener { Toast.makeText(this, "Inicio", Toast.LENGTH_SHORT).show() }
        btnNavAsistencia.setOnClickListener { Toast.makeText(this, "Asistencia", Toast.LENGTH_SHORT).show() }
        btnNavMultas.setOnClickListener { Toast.makeText(this, "Multas", Toast.LENGTH_SHORT).show() }
        btnNavPerfil.setOnClickListener { Toast.makeText(this, "Perfil", Toast.LENGTH_SHORT).show() }
        fabQr.setOnClickListener { Toast.makeText(this, "Escanear QR", Toast.LENGTH_SHORT).show() }

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