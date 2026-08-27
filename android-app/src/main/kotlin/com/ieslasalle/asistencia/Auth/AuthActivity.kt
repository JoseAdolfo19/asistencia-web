package com.ieslasalle.asistencia.auth

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.isCancellingActive
import kotlinx.coroutines.runBlocking
import com.supabase.supabase.kt.SupabaseClient
import com.ieslasalle.asistencia.Auth.AuthManager
import com.ieslasalle.asistencia.R
import com.ieslasalle.asistencia.Screens.MainActivity

class AuthActivity : AppCompatActivity() {

    private var authManager: AuthManager? = null
    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnLogin: Button
    private lateinit var btnRegistro: Button
    private lateinit var progressBar: ProgressBar
    private var isLoginMode = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_auth)

        // Inicializar componentes
        etEmail = findViewById(R.id.et_email)
        etPassword = findViewById(R.id.et_password)
        btnLogin = findViewById(R.id.btn_login)
        btnRegistro = findViewById(R.id.btn_registro)
        progressBar = findViewById(R.id.progress_bar)

        authManager = AuthManager(this, com.supabase.supabase.kt.SupabaseClient.create(
            "https://wdusozavhsgqlwsyxmzb.supabase.co",
            "sb_anónimo_token"
        ))

        // Configurar listeners
        btnLogin.setOnClickListener {
            loginMode = true
            toggleMode()
        }

        btnRegistro.setOnClickListener {
            loginMode = false
            toggleMode()
        }

        // Configurar login/registro
        setupAuthButton()
    }

    private var loginMode: Boolean
        get() = isLoginMode
        set(value) {
            isLoginMode = value
            toggleModeUI()
            toggleMode()
        }

    private fun toggleMode() {
        isLoginMode = !isLoginMode
        toggleModeUI()
    }

    private fun toggleModeUI() {
        val loginText = findViewById(R.id.txt_mode_text)
        btnLogin.text = if (isLoginMode) "Iniciar Sesión" else "Registrarse"
        txt_mode.text = if (isLoginMode) "¿No tienes una cuenta?" else "¿Ya tienes una cuenta?"
        btnRegistro.text = if (isLoginMode) "Crear Cuenta" else "Iniciar Sesión"
    }

    private fun setupAuthButton() {
        btnLogin.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Por favor completa todos los campos", Toast.LENGTH_SHORT).show()
                return
            }

            progressBar.visibility = android.view.View.VISIBLE

            val result = if (isLoginMode) {
                authManager!!.login(email, password)
            } else {
                // Registro - necesitaríamos nombres adicionales
                authManager!!.signUp(email, password, "Usuario", "Apellido", "Alumno")
            }

            runBlocking {
                result.onSuccess {
                    // Guardar token y role después de éxito
                    authManager!!.saveToken(result.get().session?.access_token ?? "")
                    if (result.get().user.metadata?.role != null) {
                        authManager!!.saveRole(result.get().user.metadata!!.role)
                    } else {
                        authManager!!.saveRole("Alumno") // Default
                    }

                    // Ir a main activity
                    val intent = Intent(this, MainActivity::class.java)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    startActivity(intent)
                    finish()
                }

                result.onFailure { exception ->
                    progressBar.visibility = android.view.View.GONE
                    val errorMsg = when {
                        "already in use" in exception.message -> "El correo ya está registrado"
                        "Invalid login credentials" in exception.message => "Credenciales incorrectas"
                        else -> exception.message ?: "Error desconocido"
                    }
                    Toast.makeText(this, errorMsg, Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}