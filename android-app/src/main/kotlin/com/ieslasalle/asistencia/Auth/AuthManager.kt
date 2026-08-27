package com.ieslasalle.asistencia.Auth

import android.content.Context
import android.content.SharedPreferences
import com.supabase.supabase.kt SupabaseClient
import com.supabase.supabase.kt.callbacks.OnAuthStateChangeListener
import com.supabase.supabase.kt.models.User
import com.ieslasalle.asistencia.Modelos.Alumno
import com.ieslasalle.asistencia.R

class AuthManager(
    private val context: Context,
    private val supabase: SupabaseClient
) {

    // Nombre del archivo de preferencias compartidas
    private val SHARED_PREFS_NAME = "auth_prefs"
    private val KEY_USER_ID = "user_id"
    private val KEY_TOKEN = "supabase_token"
    private val KEY_ROLE = "user_role"

    private lateinit var sharedPreferences: SharedPreferences
    private lateinit var sharedPreferencesEditor: SharedPreferences.Editor

    init {
        sharedPreferences = context.getSharedPreferences(SHARED_PREFS_NAME, Context.MODE_PRIVATE)
        sharedPreferencesEditor = sharedPreferences.edit()
    }

    // ======================================
    // AUTENTICACIÓN
    // ======================================

    // Iniciar sesión con email y contraseña
    suspend fun login(email: String, password: String): Result<User> {
        try {
            return supabase.auth.signInWithPassword(
                email = email,
                password = password
            )
        } catch (e: Exception) {
            return Result.failure(e)
        }
    }

    // Registrar nuevo usuario
    suspend fun signUp(email: String, password: String, nombre: String, apellido: String, rol: String): Result<User> {
        try {
            return supabase.auth.signUp(
                email = email,
                password = password,
                data = mapOf(
                    "nombres" to nombre,
                    "apellidos" to apellido,
                    "rol" to rol
                )
            )
        } catch (e: Exception) {
            return Result.failure(e)
        }
    }

    // Cerrar sesión
    suspend fun signOut(): Result<Void> {
        try {
            return supabase.auth.signOut()
        } catch (e: Exception) {
            return Result.failure(e)
        }
    }

    // Obtener usuario actual
    fun getCurrentUser(): User? {
        return supabase.auth.currentUser
    }

    // Verificar si hay sesión activa
    fun isLoggedIn(): Boolean {
        return supabase.auth.currentUser != null
            && sharedPreferences.getString(KEY_TOKEN, "") != ""
    }

    // Obtener token de sesión
    fun getToken(): String {
        return sharedPreferences.getString(KEY_TOKEN, "")
    }

    // Guardar token después de login exitoso
    fun saveToken(token: String) {
        sharedPreferencesEditor.putString(KEY_TOKEN, token)
        sharedPreferencesEditor.apply()
    }

    // Obtener rol del usuario
    fun getRole(): String {
        return sharedPreferences.getString(KEY_ROLE, "Alumno")
    }

    // Guardar rol después de login
    fun saveRole(role: String) {
        sharedPreferencesEditor.putString(KEY_ROLE, role)
        sharedPreferencesEditor.apply()
    }

    // Obtener datos del alumno desde el perfil
    suspend fun getAlumnoPerfil(): Alumno? {
        try {
            final User user = supabase.auth.currentUser
            if (user == null) return null

            final profiles = await supabase
                .from("alumnos")
                .select("id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado")
                .eq("id", user.id)
                .maybeSingle()

            return profiles?.let {
                Alumno(
                    id = it.id,
                    dni = it.dni,
                    nombres = it.nombres,
                    apellidos = it.apellidos,
                    correo = it.correo,
                    registrado = it.registrado,
                    qr_autorizado = it.qr_autorizado,
                    rol = it.rol,
                    estado = it.estado
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
        return null
    }

    // Actualizar perfil del alumno
    suspend fun updateAlumnoPerfil(nombres: String, apellidos: String): Result<Void> {
        try {
            final user = supabase.auth.currentUser
            if (user == null) return Result.failure(Exception("No hay usuario activo"))

            return supabase
                .from("alumnos")
                .update(mapOf(
                    "nombres" to nombres,
                    "apellidos" to apellidos
                )
                .eq("id", user.id)
            )
                .select()
                .single()
                .map { Result.success(it) }
                .recover { e -> Result.failure(e) }
        } catch (e: Exception) {
            return Result.failure(e)
        }
    }

    // Suscribirse a cambios de estado de autenticación
    fun addAuthStateListener(listener: OnAuthStateChangeListener) {
        supabase.auth.addAuthStateChangeListener(listener)
    }

    // Remover listener de cambios de autenticación
    fun removeAuthStateListener(listener: OnAuthStateChangeListener) {
        supabase.auth.removeAuthStateChangeListener(listener)
    }
}

// Clase auxiliar para resultados suspendidos
sealed class Result<T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Failure(val error: Exception) : Result<Nothing>
}