"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { hashPassword, randomSalt } from "@/lib/crypto";
import { validarNuevaContrasena } from "@/lib/password";
import { registrarAuditoria } from "@/lib/auditoria";

export type AdminGestionResult = { ok: boolean; error?: string };

function soloAdmin(rol: string): boolean {
  return rol === "Administrador";
}

// Actualiza el perfil (nombres, apellidos, correo, rol, estado) de un usuario.
export async function actualizarPerfil(
  id: string,
  datos: { nombres: string; apellidos: string; correo: string; rol: string; estado: string }
): Promise<AdminGestionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!soloAdmin(session.rol)) return { ok: false, error: "Solo el administrador puede editar perfiles" };

  const uid = String(id || "").trim();
  if (!uid) return { ok: false, error: "Usuario inválido" };

  const nombres = String(datos.nombres || "").trim();
  const apellidos = String(datos.apellidos || "").trim();
  const correo = String(datos.correo || "").trim().toLowerCase();
  const rol = String(datos.rol || "").trim();
  const estado = String(datos.estado || "").trim();

  if (!nombres || !apellidos) return { ok: false, error: "Nombre y apellidos son obligatorios" };
  if (!correo || !correo.includes("@")) return { ok: false, error: "Correo inválido" };
  if (!["Alumno", "Docente", "Tesorera", "Administrador"].includes(rol)) return { ok: false, error: "Rol inválido" };
  if (!["Activo", "Inactivo"].includes(estado)) return { ok: false, error: "Estado inválido" };

  // No permitir que el admin se cambie el rol a sí mismo (evita quedarse sin admin)
  if (uid === session.id && rol !== "Administrador") {
    return { ok: false, error: "No puedes cambiar tu propio rol de Administrador" };
  }

  const { data: existente } = await supabaseAdmin
    .from("alumnos")
    .select("id,correo")
    .eq("correo", correo)
    .neq("id", uid)
    .limit(1);
  if (existente && existente.length > 0) {
    return { ok: false, error: "Ese correo ya está usado por otra cuenta" };
  }

  const { error } = await supabaseAdmin
    .from("alumnos")
    .update({ nombres, apellidos, correo, rol, estado })
    .eq("id", uid);
  if (error) return { ok: false, error: "No se pudo actualizar el perfil: " + error.message };

  await registrarAuditoria(
    "actualizar_perfil",
    `${session.nombres} ${session.apellidos} actualizó el perfil de ${uid}`
  );
  return { ok: true };
}

// Restablece la contraseña de un usuario. Si forzarCambio es true, se le pedirá
// cambiarla en el próximo inicio de sesión.
export async function resetearPassword(
  id: string,
  nueva: string,
  forzarCambio: boolean
): Promise<AdminGestionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!soloAdmin(session.rol)) return { ok: false, error: "Solo el administrador puede restablecer contraseñas" };

  const uid = String(id || "").trim();
  const pw = String(nueva || "").trim();
  if (!uid) return { ok: false, error: "Usuario inválido" };

  const { data: fila } = await supabaseAdmin
    .from("alumnos")
    .select("id,nombres,apellidos,dni")
    .eq("id", uid)
    .limit(1);
  if (!fila || fila.length === 0) return { ok: false, error: "Usuario no encontrado" };
  const u = fila[0];

  const errValidacion = validarNuevaContrasena(pw, u.dni, u.nombres);
  if (errValidacion) return { ok: false, error: errValidacion };

  const salt = randomSalt();
  const hash = hashPassword(pw, salt);

  const { error } = await supabaseAdmin
    .from("alumnos")
    .update({ contrasena_hash: hash, salt, debe_cambiar_password: forzarCambio })
    .eq("id", uid);
  if (error) return { ok: false, error: "No se pudo restablecer la contraseña: " + error.message };

  await registrarAuditoria(
    "resetear_password",
    `${session.nombres} ${session.apellidos} restableció la contraseña de ${uid}${forzarCambio ? " (con cambio obligatorio)" : ""}`
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Crear un usuario nuevo (alumno, docente, tesorera o administrador)
// ---------------------------------------------------------------------------
export type CrearUsuarioResult = { ok: boolean; error?: string; id?: string };

export async function crearUsuario(datos: {
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: string;
  estado: string;
  contrasena: string;
}): Promise<CrearUsuarioResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!soloAdmin(session.rol)) return { ok: false, error: "Solo el administrador puede crear usuarios" };

  const dni = String(datos.dni || "").trim();
  const nombres = String(datos.nombres || "").trim();
  const apellidos = String(datos.apellidos || "").trim();
  const rol = String(datos.rol || "").trim();
  const estado = String(datos.estado || "Activo").trim();
  const contrasena = String(datos.contrasena || "");
  const correo = String(datos.correo || "").trim().toLowerCase() || `${dni}@ieslasalle.edu.pe`;

  if (!/^\d{8}$/.test(dni)) return { ok: false, error: "El DNI debe tener 8 dígitos" };
  if (!nombres || !apellidos) return { ok: false, error: "Nombre y apellidos son obligatorios" };
  if (!correo.includes("@")) return { ok: false, error: "Correo inválido" };
  if (!["Alumno", "Docente", "Tesorera", "Administrador"].includes(rol)) return { ok: false, error: "Rol inválido" };
  if (!["Activo", "Inactivo"].includes(estado)) return { ok: false, error: "Estado inválido" };

  const errPw = validarNuevaContrasena(contrasena, dni, nombres);
  if (errPw) return { ok: false, error: errPw };

  // Unicidad de DNI y correo
  const { data: porDni } = await supabaseAdmin.from("alumnos").select("id").eq("dni", dni).limit(1);
  if (porDni && porDni.length > 0) return { ok: false, error: "Ya existe un usuario con ese DNI" };
  const { data: porCorreo } = await supabaseAdmin.from("alumnos").select("id").eq("correo", correo).limit(1);
  if (porCorreo && porCorreo.length > 0) return { ok: false, error: "Ese correo ya está usado por otra cuenta" };

  // Generar el siguiente código libre (AL### para alumnos/tesorera/admin, D### para docentes)
  const prefijo = rol === "Docente" ? "D" : "AL";
  const { data: todos } = await supabaseAdmin.from("alumnos").select("id").order("id");
  let max = 0;
  for (const u of todos ?? []) {
    const m = new RegExp("^" + prefijo + "(\\d{3})$").exec(String(u.id || ""));
    if (m) max = Math.max(max, Number(m[1]));
  }
  const nuevoId = `${prefijo}${String(max + 1).padStart(3, "0")}`;

  const salt = randomSalt();
  const hash = hashPassword(contrasena, salt);

  const { error } = await supabaseAdmin.from("alumnos").insert({
    id: nuevoId,
    dni,
    nombres,
    apellidos,
    correo,
    salt,
    contrasena_hash: hash,
    registrado: true,
    qr_autorizado: false,
    rol,
    estado,
    debe_cambiar_password: true,
  });
  if (error) return { ok: false, error: "No se pudo crear el usuario: " + error.message };

  // Los docentes también viven en la tabla `docentes` (usada por el horario).
  if (rol === "Docente") {
    const { data: doc } = await supabaseAdmin
      .from("docentes")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);
    const siguiente = (doc?.[0]?.id ?? 0) + 1;
    await supabaseAdmin.from("docentes").insert({
      id: siguiente,
      nombre: `${nombres} ${apellidos}`,
      correo,
      estado: "Activo",
    });
  }

  await registrarAuditoria(
    "crear_usuario",
    `${session.nombres} ${session.apellidos} creó el usuario ${nuevoId} (${rol}): ${nombres} ${apellidos}`
  );
  return { ok: true, id: nuevoId };
}

// ---------------------------------------------------------------------------
// Auditoría del sistema (solo administrador)
// ---------------------------------------------------------------------------
export type RegistroAuditoria = {
  id: number;
  creado_en: string;
  usuario_id: string | null;
  usuario_nombre: string | null;
  rol: string | null;
  accion: string;
  detalle: string | null;
};

export async function obtenerAuditoria(
  filtro: string,
  cantidad = 200
): Promise<RegistroAuditoria[] | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesión expirada" };
  if (!soloAdmin(session.rol)) return { error: "Solo el administrador puede ver la auditoría" };

  const f = String(filtro || "").trim().replace(/[(),]/g, " ").trim();
  let q = supabaseAdmin.from("auditoria").select("id,creado_en,usuario_id,usuario_nombre,rol,accion,detalle");
  if (f) {
    q = q.or(
      `detalle.ilike.%${f}%,accion.ilike.%${f}%,usuario_nombre.ilike.%${f}%,usuario_id.ilike.%${f}%`
    );
  }
  const { data, error } = await q.order("id", { ascending: false }).limit(cantidad);
  if (error) return { error: "No se pudo cargar la auditoría: " + error.message };
  return (data ?? []) as RegistroAuditoria[];
}

// ---------------------------------------------------------------------------
// Configuración del sistema (solo administrador)
// ---------------------------------------------------------------------------
export type ConfiguracionSistema = {
  multa_tardanza: number;
  multa_buzo: number;
  multa_actividad: number;
  multa_limpieza: number;
  tiempo_apertura_qr: number;
  tiempo_cierre_qr: number;
};

export async function obtenerConfiguracion(): Promise<ConfiguracionSistema | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesión expirada" };
  if (!soloAdmin(session.rol)) return { error: "Solo el administrador puede ver la configuración" };

  const { data, error } = await supabaseAdmin.from("configuracion").select("*").limit(1);
  if (error) return { error: "No se pudo cargar la configuración: " + error.message };
  const c = data?.[0];
  if (!c) return { error: "No existe la fila de configuración" };
  return {
    multa_tardanza: Number(c.multa_tardanza),
    multa_buzo: Number(c.multa_buzo),
    multa_actividad: Number(c.multa_actividad),
    multa_limpieza: Number(c.multa_limpieza),
    tiempo_apertura_qr: Number(c.tiempo_apertura_qr),
    tiempo_cierre_qr: Number(c.tiempo_cierre_qr),
  };
}

export async function actualizarConfiguracion(
  datos: ConfiguracionSistema
): Promise<AdminGestionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!soloAdmin(session.rol)) return { ok: false, error: "Solo el administrador puede editar la configuración" };

  const campos: [keyof ConfiguracionSistema, string][] = [
    ["multa_tardanza", "Multa por tardanza"],
    ["multa_buzo", "Multa por buzo"],
    ["multa_actividad", "Multa por actividad"],
    ["multa_limpieza", "Multa por limpieza"],
    ["tiempo_apertura_qr", "Tiempo de apertura del QR"],
    ["tiempo_cierre_qr", "Tiempo de cierre del QR"],
  ];
  const update: ConfiguracionSistema = {
    multa_tardanza: 0,
    multa_buzo: 0,
    multa_actividad: 0,
    multa_limpieza: 0,
    tiempo_apertura_qr: 0,
    tiempo_cierre_qr: 0,
  };
  for (const [campo, etiqueta] of campos) {
    const n = Number(datos[campo]);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: `${etiqueta} debe ser un número mayor o igual a cero` };
    }
    update[campo] = n;
  }

  const { error } = await supabaseAdmin.from("configuracion").update(update).eq("id", 1);
  if (error) return { ok: false, error: "No se pudo actualizar la configuración: " + error.message };

  await registrarAuditoria(
    "actualizar_configuracion",
    `${session.nombres} ${session.apellidos} actualizó la configuración: ` +
      `tardanza S/ ${update.multa_tardanza}, buzo S/ ${update.multa_buzo}, ` +
      `actividad S/ ${update.multa_actividad}, limpieza S/ ${update.multa_limpieza}, ` +
      `apertura QR ${update.tiempo_apertura_qr} min, cierre QR ${update.tiempo_cierre_qr} min`
  );
  return { ok: true };
}