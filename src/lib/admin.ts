"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { hashPassword, randomSalt } from "@/lib/crypto";
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
  if (pw.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres" };

  const { data: fila } = await supabaseAdmin
    .from("alumnos")
    .select("id,nombres,apellidos,dni")
    .eq("id", uid)
    .limit(1);
  if (!fila || fila.length === 0) return { ok: false, error: "Usuario no encontrado" };
  const u = fila[0];

  if (pw === String(u.dni || "")) return { ok: false, error: "No puedes usar el DNI como contraseña" };
  const nombreMayus = String(u.nombres || "").toUpperCase().split(" ")[0];
  if (nombreMayus && pw.toUpperCase() === nombreMayus) {
    return { ok: false, error: "No puedes usar el nombre como contraseña" };
  }

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