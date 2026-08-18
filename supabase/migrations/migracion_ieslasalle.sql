-- ===================================================================
-- Sistema Inteligente de Asistencia con QR y Control de Multas
-- IES La Salle Urubamba - Migracion desde Google Sheets a PostgreSQL
-- Generado desde la hoja (SHEET_ID 12a-LrdaodCEB4at1Ed-HRQ27dGv677a6)
-- ===================================================================

create extension if not exists pgcrypto;

drop table if exists public.multas cascade;
drop table if exists public.asistencia cascade;
drop table if exists public.horario cascade;
drop table if exists public.cursos cascade;
drop table if exists public.docentes cascade;
drop table if exists public.alumnos cascade;
drop table if exists public.configuracion cascade;

-- ALUMNOS ------------------------------------------------------------
create table public.alumnos (
  id text primary key,
  dni text,
  nombres text not null default '',
  apellidos text not null default '',
  correo text unique,
  salt text,
  contrasena_hash text,
  registrado boolean not null default false,
  qr_autorizado boolean not null default false,
  rol text not null default 'Alumno',
  estado text not null default 'Activo',
  creado_en timestamptz not null default now()
);

-- DOCENTES -----------------------------------------------------------
create table public.docentes (
  id integer primary key,
  nombre text not null default '',
  correo text,
  telefono text,
  estado text not null default 'Activo'
);

-- CURSOS -------------------------------------------------------------
create table public.cursos (
  id integer primary key,
  nombre text not null,
  docente_id integer references public.docentes(id),
  horas_semana integer not null default 0
);

-- HORARIO ------------------------------------------------------------
create table public.horario (
  id integer primary key,
  curso text not null,
  dia text not null,
  hora_inicio time not null,
  hora_fin time not null,
  apertura_qr time,
  cierre_lista time,
  docente text,
  aula text,
  check (dia in ('Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'))
);

-- ASISTENCIA ---------------------------------------------------------
create table public.asistencia (
  id integer primary key,
  alumno text not null,
  curso text not null,
  fecha date not null,
  hora time not null,
  estado text not null check (estado in ('Presente','Tardanza','Falta'))
);

-- MULTAS -------------------------------------------------------------
create table public.multas (
  id integer primary key,
  alumno text not null,
  tipo text not null check (tipo in ('Tardanza','Buzo','Actividad')),
  motivo text,
  monto numeric(10,2) not null default 0,
  fecha date not null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente','Pagado'))
);

-- CONFIGURACION ------------------------------------------------------
create table public.configuracion (
  id integer primary key default 1,
  multa_tardanza numeric(10,2) not null default 1,
  multa_buzo numeric(10,2) not null default 5,
  multa_actividad numeric(10,2) not null default 50,
  tiempo_apertura_qr integer not null default 5,
  tiempo_cierre_qr integer not null default 15
);

alter table public.alumnos enable row level security;
alter table public.docentes enable row level security;
alter table public.cursos enable row level security;
alter table public.horario enable row level security;
alter table public.asistencia enable row level security;
alter table public.multas enable row level security;
alter table public.configuracion enable row level security;
-- ============= SEED DE DATOS =============

-- Alumnos
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL001', '60995974', 'Michelle Christel', 'AUCCACUSI SICCUS', '60995974@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL002', '61306477', 'Yuvisa', 'AUCCAPFURO PILLCO', '61306477@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL003', '61615114', 'Alcides', 'AUCCAPUMA CANDIA', '61615114@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL004', '62057658', 'Damaris Carla', 'CALDERON CURILLO', '62057658@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL005', '72955638', 'Lourdes', 'CCORAHUA GIMENEZ', '72955638@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL006', '61570810', 'Jose Gabriel', 'CHOQUE GUARDAPUCLLA', '61570810@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL007', '73539030', 'Magnolia', 'CRUZ RAMOS', '73539030@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL008', '60321573', 'Josue Manuel', 'DURAN QUISPE', '60321573@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL009', '62012982', 'Daniela', 'HUANCA MIRANDA', '62012982@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL010', '60021765', 'Jose Adolfo', 'IBERICO SUÑA', '60021765@ieslasalle.edu.pe', true, true, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL011', '72413399', 'Ismael Rodrigo Sebastian', 'LLALLICUNA SERRANO', '72413399@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL012', '77710534', 'Elizabeth', 'MAMANI CHATATA', '77710534@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL013', '76818531', 'Eliazar', 'MAMANI HUILLHUA', '76818531@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL014', '70489506', 'Yaneth Maxima', 'MARCAVILLACA CHOQUE', '70489506@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL015', '76721992', 'Roxana', 'MORA ALLENDE', '76721992@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL016', '76525994', 'Keyli', 'NIEBLE QUISPE', '76525994@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL017', '73905382', 'Carmen Rosa', 'PALMA CORVACHO', '73905382@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL018', '60626223', 'Oscar Albeiro', 'PALOMINO ILLA', '60626223@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL019', '72897787', 'Anthony', 'PUMACCAHUA AVENDAÑO', '72897787@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL020', '61159529', 'Jean Carlos', 'QUISPE HUAMAN', '61159529@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL021', '60494759', 'Claudia', 'QUISPE HUILLCA', '60494759@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL022', '60280036', 'Edy', 'QUISPE QUISPE', '60280036@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL023', '60538111', 'Frecia Luz', 'QUISPE VILCAS', '60538111@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL024', '60717889', 'Yack Esnayder', 'ROBLES CCORAHUA', '60717889@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL025', '62902255', 'Jose Fernando', 'ROMAN GARCIA', '62902255@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL026', '72641207', 'Areli Eugenia', 'SALINAS MORALES', '72641207@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL027', '61613836', 'Blenda Yuli', 'SOTELO CUNZA', '61613836@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL028', '62407194', 'Cristhian', 'TAPARA HUAYTA', '62407194@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL029', '79258583', 'Dayanna Brigette', 'TENE CANAL', '79258583@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL030', '61073109', 'Genaro', 'THUPA HUAMANGA', '61073109@ieslasalle.edu.pe', false, true, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL031', '60280436', 'Reynaldo', 'TTITO QQUEHUAROCHO', '60280436@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL032', '61500406', 'Laura Jasmine', 'UBALDE HERMOZA', '61500406@ieslasalle.edu.pe', false, false, 'Alumno', 'Activo');
insert into public.alumnos (id, dni, nombres, apellidos, correo, registrado, qr_autorizado, rol, estado) values ('AL033', '', '', 'Administrador Sistema', 'admin@ieslasalle.edu.pe', true, false, 'Administrador', 'Activo');

-- Docentes (la hoja Docentes no tenia nombres; placeholders para satisfacer la FK de cursos)
insert into public.docentes (id, nombre, correo, telefono, estado) values
  (1, 'Docente 1', NULL, NULL, 'Activo'),
  (2, 'Docente 2', NULL, NULL, 'Activo'),
  (3, 'Docente 3', NULL, NULL, 'Activo'),
  (5, 'Docente 5', NULL, NULL, 'Activo'),
  (6, 'Docente 6', NULL, NULL, 'Activo')
on conflict (id) do nothing;

-- Cursos
insert into public.cursos (id, nombre, docente_id, horas_semana) values (1, 'Administración Empresarial', 5, 7);
insert into public.cursos (id, nombre, docente_id, horas_semana) values (2, 'LEGISLACIÓN MERCANTIL Y SOCIETARIA', 6, 8);
insert into public.cursos (id, nombre, docente_id, horas_semana) values (3, 'LEGISLACIÓN LABORAL', 5, 9);
insert into public.cursos (id, nombre, docente_id, horas_semana) values (4, 'REGISTRO DE LIBROS AUXILIARES', 6, 1);
insert into public.cursos (id, nombre, docente_id, horas_semana) values (6, 'PLANEAMIENTO ESTRATÉGICO', 3, 10);
insert into public.cursos (id, nombre, docente_id, horas_semana) values (7, 'INTERPRETACIÓN Y PRODUCCIÓN DE TEXTOS', 2, 10);
insert into public.cursos (id, nombre, docente_id, horas_semana) values (8, 'TUTORIA', 1, 7);

-- Horario
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (1, 'Planeamiento Estratégico', 'Lunes', '09:30', '10:15', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (2, 'Planeamiento Estratégico', 'Lunes', '10:15', '11:00', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (3, 'Planeamiento Estratégico', 'Martes', '09:30', '10:15', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (4, 'Planeamiento Estratégico', 'Martes', '10:15', '11:00', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (5, 'Interpretación y Producción de Textos', 'Martes', '11:30', '12:10', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (6, 'Legislación Laboral', 'Miércoles', '08:00', '08:45', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (7, 'Legislación Laboral', 'Miércoles', '08:45', '09:30', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (8, 'Planeamiento Estratégico', 'Miércoles', '09:30', '10:15', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (9, 'Planeamiento Estratégico', 'Miércoles', '10:15', '11:00', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (10, 'Registro de Libros Auxiliares', 'Miércoles', '11:30', '12:10', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (11, 'Interpretación y Producción de Textos', 'Miércoles', '12:10', '12:50', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (12, 'Interpretación y Producción de Textos', 'Miércoles', '12:50', '13:30', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (13, 'Administración Empresarial', 'Jueves', '08:00', '08:45', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (14, 'Administración Empresarial', 'Jueves', '08:45', '09:30', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (15, 'Planeamiento Estratégico', 'Jueves', '09:30', '10:15', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (16, 'Tutoría', 'Jueves', '11:30', '12:10', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (17, 'Interpretación y Producción de Textos', 'Jueves', '12:10', '12:50', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (18, 'Legislación Mercantil y Societaria', 'Viernes', '08:00', '08:45', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (19, 'Legislación Mercantil y Societaria', 'Viernes', '08:45', '09:30', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (20, 'Planeamiento Estratégico', 'Viernes', '09:30', '10:15', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (21, 'Planeamiento Estratégico', 'Viernes', '10:15', '11:00', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (22, 'Tutoría', 'Viernes', '11:30', '12:10', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (23, 'Interpretación y Producción de Textos', 'Viernes', '12:10', '12:50', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (24, 'Planeamiento Estratégico', 'Jueves', '09:30', '10:15', 'CPC Amparo P. Lechuga H.', 'Aula II Semestre');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (25, 'Tutoria', 'Lunes', '11:30', '12:10', 'Jose A. Iberico S,', 'Aula de II Semestre');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (26, 'Administración Empresarial', 'Lunes', '08:00', '08:45', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (27, 'Administración Empresarial', 'Lunes', '08:45', '09:30', '', '');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (28, 'Prueba 1', 'Martes', '08:00', '08:45', 'Prueba 2', 'ejemplo 3');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (29, 'prueba 5', 'Martes', '12:10', '12:50', 'prueba 5', 'prueba 5');
insert into public.horario (id, curso, dia, hora_inicio, hora_fin, docente, aula) values (30, 'prueba 6', 'Martes', '08:45', '09:30', 'prueba 6', 'prueba 6');

-- Configuracion
insert into public.configuracion (id, multa_tardanza, multa_buzo, multa_actividad, tiempo_apertura_qr, tiempo_cierre_qr) values (1, 1.00, 5.00, 50.00, 5, 15);
