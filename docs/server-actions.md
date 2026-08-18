# Server Actions

Todas las acciones que mutan datos viven en `src/lib/*.ts` con `"use server"`.
Ninguna escritura se hace desde el cliente: todo pasa por `supabaseAdmin`
(service_role). El cliente solo lee con `supabase` (anon, RLS de solo lectura).

## auth.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `loginAction(correo, password)` | Público | Valida credenciales (hash+salt), aplica rate limiting (5 intentos → bloqueo 15 min) y crea la cookie de sesión. |
| `logoutAction()` | Cualquiera | Elimina la cookie de sesión. |
| `cambiarPasswordAction(actual, nueva)` | Autenticado | Verifica la actual, valida la nueva (mín 8, no DNI/nombre), actualiza hash+salt y recrea la sesión. |
| `cerrarSesionTodosDispositivos()` | Administrador | Incrementa `session_version` del usuario: invalida todas sus cookies (incluida la actual). |

## marcar.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `getQrToken(claseId, curso, fecha, seed)` | Alumno | Genera el token QR firmado por el servidor para una clase activa. Rate limit: 12/min. |
| `marcarAsistencia(token, alumnoId)` | Docente/Admin | Valida la firma QR (ventana 30s, semillas actual/anterior), registra Presente/Tardanza y sube Faltas previas. Rate limit: 30/min. |
| `abrirClase(curso)` | Docente/Admin | Abre manualmente una clase hoy. |
| `cerrarClasesPendientes()` | Docente/Admin | Cierra clases cuyo horario terminó: marca Falta/Tardanza y crea las multas. |

## multas.ts

| Acción | Rol | Qué hace |
|---|---|---|
| `cambiarEstadoMulta(id, nuevoEstado)` | Tesorera/Admin | Actualiza el estado de una multa (p.ej. cobrar). |

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
| `estado.ts` | `estadoClase`, `aMinutos`, `normalizeName` | Estados de clase y normalización. |
| `rateLimit.ts` | `permitirRateLimit(clave, max, ventanaMs)` | Ventana de rate limiting sobre la tabla `rate_limits`. |
| `auditoria.ts` | `registrarAuditoria(accion, detalle)` | Registra en la tabla `auditoria`. |
| `session.ts` | `getSession`, `createSession`, `destroySession` | Manejo de cookie firmada con `session_version`. |

## Regenerar tipos

```bash
npm run gen-types   # supabase gen types -> src/lib/database.types.ts
```