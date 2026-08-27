package com.ieslasalle.asistencia.Modelos

// Modelo de Alumno
data class Alumno(
    val id: String,
    val dni: String?,
    val nombres: String,
    val apellidos: String,
    val correo: String,
    val registrado: Boolean,
    val qr_autorizado: Boolean,
    val rol: String,
    val estado: String,
    val creado_en: String = ""
)

// Modelo de Asistencia
data class Asistencia(
    val id: Int?,
    val alumno: String,
    val curso: String,
    val fecha: String,
    val hora: String,
    val estado: String // "Presente", "Tardanza", "Falta"
)

// Modelo de Clase/Horario
data class Clase(
    val id: Int?,
    val curso: String,
    val dia: String,
    val hora_inicio: String,
    val hora_fin: String,
    val apertura_qr: String?, // Hora de apertura del QR
    val cierre_lista: String?, // Hora de cierre de lista
    val docente: String?,
    val aula: String?
)

// Modelo de Multa
data class Multa(
    val id: Int?,
    val alumno: String,
    val tipo: String, // "Tardanza", "Buzo", "Actividad"
    val motivo: String?,
    val monto: Int?, // En Soles
    val fecha: String,
    val estado: String, // "Pendiente", "Pagado"
    val asistencia_id: Int? // FK a la tabla asistencia
)