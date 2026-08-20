# Server Actions

Todas las acciones que mutan datos viven en `src/lib/*.ts` con `"use server"`.
Ninguna escritura se hace desde el cliente: todo pasa por `supabaseAdmin`
(service_role). El cliente solo lee con `supabase` (anon, RLS de solo lectura).

## auth.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `loginAction(correo, password)` | Público | Valida credenciales (hash+salt), aplica rate limiting (5 intentos → bloqueo 15 min) y crea la cookie de sesión. |
| `logoutAction()` | Cualquiera | Elimina la cookie de sesión. |
| `cambiarPasswordAction(actual, nueva)` | Autenticado | Verifica la actual, valida la nueva (mín 10, mayúscula/minúscula/número/símbolo, no DNI/nombre), actualiza hash+salt y recrea la sesión. |
| `cerrarSesionTodosDispositivos()` | Administrador | Incrementa `session_version` del usuario: invalida todas sus cookies (incluida la actual). |

## recuperar.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `verificarIdentidad(correo, dni)` | Público | Verifica que el correo y el DNI coincidan con un usuario activo. Respuesta genérica para no revelar correos existentes. Rate limit: 5/min por correo. |
| `recuperarContrasena(correo, dni, nueva)` | Público | Re-confirma correo+DNI en servidor, valida la nueva contraseña (mín 10, mayúscula/minúscula/número/símbolo, no DNI/nombre) y actualiza hash+salt, limpiando intentos/bloqueos de login. |

## marcar.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `getDocenteQrToken(claseId, curso, fecha, seed)` | Docente/Admin | Genera el token QR firmado por el servidor para la clase activa **y el código de clase de 6 dígitos** (el docente los muestra para que los alumnos marquen). Rate limit: 12/min. |
| `marcarConQrDocente(token)` | Alumno/Tesorera | El alumno escanea el QR del docente y se marca él mismo (su identidad sale de la sesión). Valida la firma QR (ventana efectiva de hasta 60 s: dos periodos de 30 s), registra Presente/Tardanza y sube Faltas previas. Rate limit: 6/min. |
| `marcarConCodigo(codigo, nombre)` | Alumno/Tesorera | Segunda vía sin cámara: el alumno escribe el código de clase (6 dígitos) + su nombre (debe coincidir con su cuenta). Valida el código con la misma ventana de 30 s, registra Presente/Tardanza y sube Faltas previas. Rate limit: 6/min. |
| `marcarAsistencia(token, alumnoId)` | Docente/Admin | Respaldo de escaneo (cámara/entrada manual): igual que la anterior pero indicando el alumno. Rate limit: 30/min. |
| `resolverAlumno(nombre)` | Docente/Admin | Busca un alumno por nombre completo para la entrada manual de `/escanear`. |
| `abrirClase(curso)` | Docente/Admin | Abre manualmente una clase hoy (rechazada si la clase ya terminó). |
| `cerrarClasesPendientes()` | Autenticado | Cierra clases cuyo horario terminó: marca Falta/Tardanza y crea las multas. Throttle de 1/min + inserts en lote. |

## claseLocal.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `getClaseLocalPara()` | Alumno/Tesorera | Devuelve la clase local activa si el alumno está en `visible_para` (Daniela AL009 la marca; Jose Adolfo AL010 la ve). Incluye `puedoMarcar`, `marcadaHoy` y los últimos registros. Si las tablas no existen o no aplica, devuelve `data: null`. |
| `marcarClaseLocal(id)` | Alumno/Tesorera | Registra Presente del alumno en la clase local (solo el `alumno_marca`, una vez por día). Voluntario: nunca genera faltas ni multas. Rate limit: 6/min. |

## actividades.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `crearActividad(nombre, fecha, descripcion)` | Tesorera/Admin | Crea una actividad obligatoria y registra a todos los alumnos AL001–AL032 con participación `false`. |
| `marcarParticipacion(actividadId, alumnoId, participo)` | Tesorera/Admin | Actualiza la participación de un alumno en la actividad. |
| `cerrarActividad(actividadId)` | Tesorera/Admin | Genera la multa de S/50 (tipo `Actividad`) a quienes no participaron y cierra la actividad. |
| `reabrirActividad(actividadId)` | Tesorera/Admin | Anula las multas pendientes de la actividad y la devuelve a "Abierta". |

## admin.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `actualizarPerfil(id, datos)` | Administrador | Actualiza nombres, apellidos, correo, rol y estado de un usuario. Impide que el admin se cambie su propio rol y duplica-correos. |
| `resetearPassword(id, nueva, forzarCambio)` | Administrador | Restablece la contraseña de un usuario (mín 10, mayúscula/minúscula/número/símbolo, no DNI/nombre) y opcionalmente exige cambio en el próximo ingreso (`debe_cambiar_password`). |

## multas.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `cambiarEstadoMulta(id, nuevoEstado)` | Tesorera/Admin | Actualiza el estado de una multa (p.ej. cobrar). |
| `crearMultaBuzo(alumnoId)` | Tesorera/Admin | Crea una multa tipo **Buzo** por el monto de `configuracion.multa_buzo` para el alumno indicado. |
| `justificarAsistencia(registroId, motivo)` | Docente/Tesorera/Admin | Justifica una Falta o Tardanza: la pasa a **Presente** (columnas `justificada`/`motivo_justificacion`) y **anula** la multa pendiente vinculada vía `asistencia_id` (con fallback por alumno+fecha si la columna no existe). |

## horario.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `guardarClase(clase)` | Administrador | Crea o actualiza una clase del horario. |
| `eliminarClase(id)` | Administrador | Elimina una clase del horario. |

## Lógica pura (testeada en `tests/`)

| Módulo | Función | Uso |
|---|---|---|
| `qr.ts` | `generarFirmaQR`, `firmaValida`, `seedActual` | Firma y validación del token QR. |
| `cierre.ts` | `planificarCierre`, `planificarSubirFaltas` | Decide Tardanza/Falta y multas al cerrar clases. |
| `estado.ts` | `estadoClase`, `aMinutos`, `normalizeName`, `esAlumnoRegistrado` | Estados de clase, normalización y restricción AL001–AL032. |
| `rateLimit.ts` | `permitirRateLimit(clave, max, ventanaMs)` | Ventana de rate limiting sobre la tabla `rate_limits`. |
| `auditoria.ts` | `registrarAuditoria(accion, detalle)` | Registra en la tabla `auditoria`. |
| `session.ts` | `getSession`, `createSession`, `destroySession` | Manejo de cookie firmada con `session_version`. |

## Regenerar tipos

```bash
npm run gen-types   # supabase gen types -> src/lib/database.types.ts
```