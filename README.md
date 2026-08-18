# IES La Salle — Sistema de Asistencia con QR

Sistema web de asistencia por QR y control de multas para el Instituto de Educación Superior La Salle (Urubamba). Reemplaza el sistema anterior basado en Google Apps Script + Hojas de Cálculo.

- **Producción:** https://ieslasalle-web.vercel.app
- **Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Supabase (PostgreSQL + REST), Vercel. Librerías: `recharts` (gráficos), `html5-qrcode` (cámara), `qrcode.react` (QR), `server-only`.
- **Estado:** en uso para pruebas del semestre 2026-II.

---

## 1. Resumen del proyecto

| Área | Detalle |
|---|---|
| Login | Propio contra la tabla `alumnos` (hash SHA-256 de `password \| salt`), cookie httpOnly, cambio de contraseña forzado en el primer login |
| Horario | 31 bloques semanales, editable por el administrador |
| QR de asistencia | Generación por alumno, rota cada 30 s, token firmado por servidor |
| Escaneo | Cámara para docentes, entrada manual por token + nombre completo, apertura manual de clase |
| Cierre automático | 5 min antes abre / al terminar el bloque cierra; tardanzas y faltas automáticas |
| Multas | Tardanza / Buzo / Actividad, cobradas por la tesorera |
| Reportes | Exportar a Excel (2 hojas: detalle + resumen por alumno) y filtros en ambos paneles |
| Dashboard | Gráficos de asistencia (hoy, últimos 7 días, por curso) y multas |
| Roles | Alumno, Docente, Tesorera, Administrador |

---

## 2. Despliegue y enlaces

- URL: https://ieslasalle-web.vercel.app
- Proyecto Vercel: `ieslasalle-web` (usuario `jais2`).
- Cada cambio se publica con:
  ```bash
  npm run build
  vercel deploy --prod --yes
  ```

---

## 3. Roles y permisos

| Función | Alumno | Docente | Tesorera | Admin |
|---|---|---|---|---|
| Ver horario | ✔ | ✔ | ✔ | ✔ |
| Generar QR de asistencia | ✔ | ✖ | ✖ | ✖ |
| Escanear / marcar asistencia | ✖ | ✔ | ✖ | ✔ |
| Abrir clase manualmente | ✖ | ✔ | ✖ | ✔ |
| Ver asistencia de todos | ✖ | ✔ | ✔ | ✔ |
| Ver multas de todos | ✖ | ✔ | ✔ | ✔ |
| Cobrar multas (marcar Pagado) | ✖ | ✖ | ✔ | ✔ |
| Editar horario | ✖ | ✖ | ✖ | ✔ |

> Nota: los docentes son cuentas creadas en `alumnos` con `rol = 'Docente'` (D001, D002, D003, D005, D006, D007; no existe D004).

---

## 4. Lógica de asistencia (zona horaria Perú)

Todas las funciones de fecha/hora usan la zona horaria de **América/Lima** (`src/lib/estado.ts`), tanto en servidor como en cliente.

- **Apertura:** 5 minutos antes de la hora de inicio (`hora_inicio - 5`). El QR se habilita en ese momento.
- **Cierre:** 5 minutos después de la hora de inicio (`hora_inicio + tolerancia`, tolerancia = `configuracion.tiempo_cierre_qr = 5`).
- **Estados por clase:**
  - `Programada` → antes de la apertura.
  - `Activa` → dentro del bloque de marcación (apertura hasta cierre). El alumno puede generar QR y marcar **Presente**.
  - `Cerrada` → después del cierre. Si se escanea aún registra **Tardanza**.
  - `Finalizada` → terminó el bloque (no se muestra en la lista del QR).
- **Cierre automático:** cuando una clase pasa su `hora_fin`, `cerrarClasesPendientes()` (en `src/lib/marcar.ts`) procesa a los que no escanearon, diferenciando por día:
  - **Tardanza + multa (S/1)** si el alumno tiene algún registro de asistencia ese día (llegó, aunque sea a otra clase).
  - **Falta (sin multa)** si el alumno no llegó en todo el día.
  - Si un alumno quedó en Falta en una clase anterior pero luego llega a otra clase del día, `subirFaltasSiLlego()` sube su Falta a Tardanza y genera la multa.
  - Corre cada 30 s mientras el docente está en `/escanear` y antes de cada marcación. Todos los inserts verifican errores de Supabase y los reportan.
- **Apertura manual:** si el docente llega tarde, presiona "Abrir clase": se crea un registro en `clases_abiertas` con la hora de apertura real, y los alumnos presentes marcan Presente sin caer en Tardanza.

### QR
- El QR codifica `token|alumnoId`.
- El token es **firmado por el servidor** (`getQrToken` en `src/lib/marcar.ts`): el cliente solicita el token a la server action, que valida sesión de alumno y que la clase esté activa, y firma `SHA-256([horario.id, curso, fecha, seed].join("|") + "|" + QR_SECRET)`. El secreto `QR_SECRET` vive solo en el servidor (`.env.local` / Vercel) y nunca viaja al bundle del cliente. La validación al escanear (`marcarAsistencia`) usa el mismo secreto de servidor.
- El token rota cada 30 segundos (`seed` = época/30s, se aceptan deltas `0` y `-1`).
- Solo generan QR los cursos con `asistencia_obligatoria = true`. Todos los cursos del horario 2026-II tienen QR (incluidos **Ofimática**, **Lunes Cívico** y **Taller de fortalecimiento**).

---

## 5. Horario semanal (definitivo 2026-II)

Clases de 08:00 a 13:30, receso de 11:00 a 11:30.

| Día | 08:00 | 09:30 | 11:30 | 12:50 |
|---|---|---|---|---|
| **Lun** | Lunes Cívico (08:00–08:45) | Leg. Laboral (08:45–11:00) | Leg. Mercantil y Societ. | Taller de fortalecimiento |
| **Mar** | Interpretación y Producción de Textos | Leg. Mercantil y Societ. | Registro de Libros Auxiliares | Taller de fortalecimiento |
| **Mié** | Leg. Laboral | Leg. Mercantil y Societ. | Ofimática (11:30–13:30) | — |
| **Jue** | Registro de Libros Auxiliares | Administración Empresarial | Planeamiento Estratégico (11:30–13:30) | — |
| **Vie** | Tutoría | Administración Empresarial | Registro de Libros Auxiliares | Taller de fortalecimiento |

- **Lunes Cívico:** 08:00–08:45 (todos los lunes), con QR.
- **Receso:** 11:00–11:30.
- Cursos: Administración Empresarial · Legislación Mercantil y Societaria · Legislación Laboral · Registro de Libros Auxiliares · Ofimática · Planeamiento Estratégico · Interpretación y Producción de Textos · Tutoría · **Lunes Cívico** · **Taller de fortalecimiento**.

El administrador puede editar esta distribución desde **Horario → "Editar horario"**.

---

## 5b. Exportar a Excel

Los paneles de **Asistencia** y **Multas** tienen un botón "Exportar Excel" que descarga un archivo `.xls` compatible con Excel (sin librerías externas, vía `src/lib/exportar.ts`). Cada archivo tiene **dos hojas**:

- **Asistencia:**
  - Hoja 1: detalle de los registros con los filtros aplicados (curso/fecha/alumno). Si eres admin se incluye la columna Alumno.
  - Hoja 2 "Resumen por alumno": conteos de **Presente / Tardanza / Falta** por alumno y el **total de sus multas (S/)**.
- **Multas:**
  - Hoja 1: detalle de las multas filtradas (alumno, fecha, tipo, motivo, monto, estado).
  - Hoja 2 "Resumen por alumno": por alumno y tipo, cantidad de multas **Pendientes / Pagadas** y monto total.

El botón se deshabilita si no hay filas que exportar.

---

## 5c. Dashboard

En **Dashboard** (visible para todos) se muestran:

- Tarjetas: asistencia de hoy, multas pendientes y pagadas (montos).
- Gráfico circular: asistencia de hoy por estado (Presente / Tardanza / Falta).
- Gráfico de barras apiladas: últimos 7 días de asistencia.
- Gráfico de barras por curso (solo no-alumnos).

Gráficos con `recharts` (`src/components/panels/DashboardPanel.tsx`).

---

## 5d. Backups periódicos

- Script `scripts/backup.js`: vuelca las 8 tablas de Supabase vía REST (service_role) a `backups/backup-<fecha>/` en JSON, con paginación.
- Tarea programada de Windows **IESLaSalle-Backup** (diaria a las 22:00) y **IESLaSalle-Backup-Mediodia** (diaria a las 12:00), que ejecutan `scripts/backup_diario.bat`.
- `backup_diario.bat` rota el log: conserva la ejecución anterior en `backups/backup.log.prev` y escribe la actual en `backups/backup.log` (no crece indefinidamente).
- Ejecución manual: `node scripts/backup.js`.
- `backups/` y `.env*` están en `.gitignore`.

## 5e. Seguridad (rate limiting, auditoría, sesiones)

- **Rate limiting** (`src/lib/rateLimit.ts`, tabla `rate_limits`):
  - Login: máx. 5 intentos fallidos → bloqueo 15 min (`alumnos.login_intentos` / `login_bloqueado_hasta`).
  - `getQrToken`: máx. 12 tokens/min por alumno.
  - `marcarAsistencia`: máx. 30 marcaciones/min por docente.
- **Auditoría** (`src/lib/auditoria.ts`, tabla `auditoria`): registra login, bloqueos, cambio de contraseña, cobros, creación/edición de clases, aperturas y marcaciones (usuario, rol, acción, detalle, fecha).
- **Sesiones expirables** (`alumnos.session_version`): el administrador puede `cerrarSesionTodosDispositivos()`; al incrementar la versión, todas las cookies del usuario quedan invalidadas. La firma de la cookie incluye la versión.
- **Botón tesorera "multa por buzo"**: en el panel de Multas, la tesorera/admin selecciona un alumno y crea una multa tipo **Buzo** (monto `multa_buzo`) que el alumno ve en su panel.
- **Justificación de faltas/tardanzas**: docente, tesorera o admin pueden marcar una Falta/Tardanza como **justificada** (con motivo) desde el panel de Asistencia. El registro muestra el badge "Justificada", la multa asociada se **anula** (estado `Anulada`) y no cuenta como pendiente ni en el resumen de multas.

---

## 6. Base de datos (Supabase)

- Proyecto: `wdusozavhsgqlwsyxmzb` (`https://wdusozavhsgqlwsyxmzb.supabase.co`)
- Datos creados en la migración: `C:\xampp\htdocs\frontend-app-mat\migracion_ieslasalle.sql`
- RLS activo: `anon` puede leer las tablas públicas y `clases_abiertas`; las escrituras van por `service_role` (server actions).

### Tablas
| Tabla | Contenido |
|---|---|
| `alumnos` | Alumnos + cuentas de login (docentes/tesorera/admin viven aquí con su rol). Incluye `debe_cambiar_password`, `session_version`, `login_intentos`, `login_bloqueado_hasta` |
| `docentes` | Docentes reales (id 1, 2, 3, 5, 6, 7) |
| `cursos` | Cursos, `docente_id`, `horas_semana`, `asistencia_obligatoria` |
| `horario` | Bloques semanales (día, hora inicio/fin, docente, aula) |
| `asistencia` | Registros: Presente / Tardanza / Falta |
| `multas` | Multas con estado Pendiente / Pagado |
| `configuracion` | Tolerancia (5) y montos de multa (1 / 5 / 50) |
| `clases_abiertas` | Aperturas manuales de clase (curso, fecha, hora_abierta) |
| `auditoria` | Registro de acciones sensibles (login, bloqueos, cobros, edición de clases, marcaciones) |
| `rate_limits` | Control de rate limiting por clave (login, QR, marcación) |

### Cursos (`cursos`)
| id | Nombre | Docente | Horas | QR |
|---|---|---|---|---|
| 1 | Administración Empresarial | Aldo (5) | 5 | ✔ |
| 2 | Legislación Mercantil y Societaria | Amparo (6) | 6 | ✔ |
| 3 | Legislación Laboral | Aldo (5) | 5 | ✔ |
| 4 | Registro de Libros Auxiliares | Amparo (6) | 6 | ✔ |
| 5 | Ofimática | Uriel (7) | 3 | ✔ |
| 6 | Planeamiento Estratégico | Estrella (3) | 3 | ✔ |
| 7 | Interpretación y Producción de Textos | Neil (2) | 2 | ✔ |
| 8 | Tutoría | Norka (1) | 1 | ✔ |
| 9 | Lunes Cívico | — | 1 | ✔ |
| 10 | Taller de fortalecimiento | — | 3 | ✔ |

---

## 7. Estructura del código

```
src/
├── app/
│   ├── layout.tsx              # Layout raíz + viewport móvil
│   ├── page.tsx                # Redirige a /horario o /login
│   ├── login/                  # Ruta de login (formulario en components/panels)
│   ├── cambiar-password/       # Ruta de cambio de contraseña obligatorio
│   └── (app)/
│       ├── layout.tsx          # Layout protegido + Nav
│       ├── horario/            # Tabla semanal + enlace "Editar horario" (admin)
│       │   └── editar/         # Ruta del editor de horario
│       ├── dashboard/          # Ruta del dashboard
│       ├── asistencia/         # Ruta de asistencia
│       ├── multas/             # Ruta de multas
│       ├── qr/                 # Ruta del QR
│       └── escanear/           # Ruta de escaneo
├── components/
│   ├── Nav.tsx                 # Nav responsive con menú hamburguesa móvil
│   ├── panels/                 # Lógica por página (client)
│   │   ├── LoginForm.tsx
│   │   ├── CambiarPasswordForm.tsx
│   │   ├── HorarioEditor.tsx
│   │   ├── DashboardPanel.tsx
│   │   ├── AsistenciaPanel.tsx
│   │   ├── MultasPanel.tsx
│   │   ├── QrPanel.tsx
│   │   └── ScanPanel.tsx
│   └── ui/                     # Primitivas reutilizables
│       ├── Badge.tsx           # Etiqueta de estado (green/amber/red/blue/slate)
│       ├── Button.tsx          # Botón con variantes primary/secondary/success/danger/ghost
│       ├── Skeleton.tsx        # Placeholder de carga animado
│       └── ErrorState.tsx      # Error con botón "Reintentar"
└── lib/
    ├── crypto.ts               # SHA-256 + salt
    ├── supabase.ts             # Cliente anon tipado (lecturas)
    ├── supabaseAdmin.ts        # Cliente service_role tipado (escrituras)
    ├── database.types.ts       # Tipos generados (supabase gen types)
    ├── auth.ts                 # loginAction / logoutAction / cambiarPasswordAction / cerrarSesionTodosDispositivos
    ├── session.ts              # Cookie de sesión httpOnly (incluye session_version)
    ├── estado.ts               # Hora Perú, estados de clase
    ├── exportar.ts             # Genera archivos .xls de 2 hojas (exportar a Excel)
    ├── qr.ts                   # Firma/validación de token QR, seeds y refresco (puro)
    ├── cierre.ts               # planificarCierre / planificarSubirFaltas (lógica pura)
    ├── rateLimit.ts            # permitirRateLimit (tabla rate_limits)
    ├── auditoria.ts            # registrarAuditoria (tabla auditoria)
    ├── marcar.ts               # marcarAsistencia, abrirClase, resolverAlumno, cerrarClasesPendientes, subirFaltasSiLlego, getQrToken
    ├── multas.ts               # cambiarEstadoMulta (cobro), crearMultaBuzo (tesorera)
    └── horario.ts              # guardarClase / eliminarClase (admin)
```

---

## 8. Variables de entorno

Archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://wdusozavhsgqlwsyxmzb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key de Supabase>
SUPABASE_SERVICE_ROLE_KEY=<service_role / secret key de Supabase>
SESSION_SECRET=ies-lasalle-urubamba-session-secret-2026
QR_SECRET=<secreto para firmar el token QR, solo servidor>
```

Las variables de Supabase y `QR_SECRET` están configuradas en producción (Vercel).

---

## 9. Scripts SQL relevantes

Guardados en `C:\Users\jose\AppData\Local\Temp\opencode\`:

| Script | Propósito |
|---|---|
| `migracion_ieslasalle.sql` | DDL + seed inicial (en `frontend-app-mat`) |
| `politicas_rls.sql` | Grants + políticas RLS |
| `bootstrap_admin.sql` | Cuenta admin (AL033) |
| `alumnos_credenciales.sql` | Login de los 32 alumnos (password = DNI) |
| `docentes_credenciales.sql` | Cuentas D001–D006 |
| `tesorera_credenciales.sql` | Cuenta tesorera (AL029) |
| `excepcion_y_apertura.sql` | Exclusión cursos + tabla `clases_abiertas` |
| `eliminar_pruebas.sql` | Borra cursos de prueba |
| `agregar_horas.sql` | Agrega horas a Admin. Empresarial y Leg. Mercantil |
| `horario_final.sql` | Horario semanal definitivo (31 bloques) |
| `migrar_identity.sql` | Migra las columnas `id` a IDENTITY (Postgres genera los IDs) |
| `forzar_cambio_password.sql` | Agrega `alumnos.debe_cambiar_password` y lo activa para Alumno/Docente/Tesorera |
| `seguridad_2026.sql` | RLS: elimina política `insert_asistencia`, tablas `auditoria`/`rate_limits`, columnas `session_version`/`login_intentos`/`login_bloqueado_hasta` |
| `horario_definitivo_2026.sql` | Horario definitivo 2026-II (18 bloques), cursos 9/10, docente Uriel, AL010 → Docente |
| `justificacion_asistencia.sql` | Columnas `asistencia.justificada` / `motivo_justificacion` para justificar faltas/tardanzas |

Scripts de CI/CD (`ieslasalle-web/.github/workflows/`): `ci.yml` (typecheck + lint + tests + build) y `backup.yml` (respaldo nocturno de la BD vía GitHub Actions).

---

## 10. Desarrollo local

```bash
npm install
npm run dev        # http://localhost:3000
```

---

## 11. Historial de hitos

1. Migración de datos desde el sistema Google Apps Script a Supabase.
2. Creación de la app web `ieslasalle-web` (Next.js) e implementación de login propio.
3. RLS y políticas aplicadas; verificación vía REST con clave publishable.
4. QR de asistencia por alumno (token rotativo), escaneo por cámara y entrada manual.
5. Exclusión de cursos sin QR; tabla `clases_abiertas` y apertura manual.
6. Docentes reales + cuentas de acceso; credenciales de los 32 alumnos.
7. Zona horaria Perú, apertura 5 min antes / cierre 5 min después, tardanzas automáticas.
8. Cierre automático de clases: los que no escanearon quedan en Tardanza + multa.
9. Editor de horario para administrador.
10. Filtros de curso/fecha/alumno en Asistencia.
11. Diseño responsive con menú hamburguesa móvil.
12. Rol Tesorera con cobro de multas.
13. Horario semanal definitivo 2026-II (31 bloques, lunes cívico respetado).
14. Exportar a Excel en Asistencia y Multas; filtros en Multas y card "Cobrado hasta el momento".
15. Integridad: IDs migrados a IDENTITY, verificación de errores en inserts, y estado **Falta** real (quien no llegó en el día) diferenciado de **Tardanza** (quien llegó a otra clase del día).
16. Seguridad QR: el token pasa a ser firmado por el servidor (`getQrToken` + `QR_SECRET`), eliminando el secreto hardcodeado del bundle del cliente.
17. Seguridad de cuentas: cambio de contraseña **obligatorio** en el primer login (`debe_cambiar_password`), prohibiendo DNI/nombre como contraseña.
18. Exportar a Excel con **segunda hoja "Resumen por alumno"** (conteos Presente/Tardanza/Falta + multas) en Asistencia y Multas.
19. **Dashboard** con gráficos de asistencia (hoy, últimos 7 días, por curso) y multas (recharts).
20. **Backups periódicos**: `scripts/backup.js` vía REST + tareas de Windows `IESLaSalle-Backup` (12:00 y 22:00) con rotación de log.
21. **Tipado** de respuestas de Supabase (`supabase gen types` → `database.types.ts` conectado a los clientes).
22. **Refactor UI**: primitivas compartidas (`components/ui/`: Badge, Button, Skeleton, ErrorState), paneles movidos a `components/panels/`, manejo de errores con reintentar, skeleton de carga, `caption`/`scope` en tablas, confirm+bloqueo en "Cobrar" y vista de cards en móvil.
23. **Seguridad 2026**: rate limiting (login/QR/marcación, tabla `rate_limits`), auditoría de acciones sensibles (tabla `auditoria`), sesiones expirables (`session_version` + `cerrarSesionTodosDispositivos`) y limpieza RLS (DROP política `insert_asistencia`). Módulos puros `qr.ts`/`cierre.ts` con **22 tests unitarios** (vitest) y script `gen-types`.
24. **GitHub Actions**: `ci.yml` (typecheck + lint + tests + build) y `backup.yml` (respaldo diario de la BD como artefacto).
25. **Horario definitivo 2026-II (Contabilidad II)**: 18 bloques 08:00–13:30 con receso 11:00–11:30; Lunes Cívico y Taller de fortalecimiento **con QR**; Ofimática con docente Uriel (`uriel@ieslasalle.edu.pe`); Jose AL010 cambiado a rol Docente para pruebas.
26. **Botón tesorera "multa por buzo"**: `crearMultaBuzo` crea la multa tipo Buzo por alumno desde el panel de Multas.
27. **Justificación de faltas/tardanzas**: docente/tesorera/admin marcan una Falta/Tardanza como justificada (columnas `justificada`/`motivo_justificacion`); la multa asociada se anula (estado `Anulada`).
