"use server";

import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword, randomSalt } from "@/lib/crypto";
import { validarNuevaContrasena } from "@/lib/password";
import { createSession, getSession, SessionUser, destroySession } from "@/lib/session";
import { registrarAuditoria } from "@/lib/auditoria";

type AlumnoRow = {
  id: string;
  dni: string | null;
  nombres: string;
  apellidos: string;
  correo: string | null;
  salt: string | null;
  contrasena_hash: string | null;
  registrado: boolean;
  rol: string;
  qr_autorizado: boolean;
  estado: string;
  debe_cambiar_password: boolean;
  session_version?: number;
  login_intentos?: number;
  login_bloqueado_hasta?: string | null;
};

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string };

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

export async function loginAction(correo: string, password: string): Promise<LoginResult> {
  const email = correo.trim().toLowerCase();
  if (!email || !password) return { ok: false, error: "Ingresa correo y contraseña" };

  // Se leen también las columnas nuevas de seguridad; si el SQL aún no se
  // aplicó en Supabase, se reintenta sin ellas para no romper el login.
  const columnas = "id,dni,nombres,apellidos,correo,salt,contrasena_hash,registrado,rol,qr_autorizado,estado,debe_cambiar_password";
  const columnasSeg = columnas + ",session_version,login_intentos,login_bloqueado_hasta";

  const q1 = await supabase
    .from("alumnos")
    .select(columnasSeg)
    .ilike("correo", email)
    .single();

  let data: AlumnoRow | null = (q1.data as AlumnoRow | null) ?? null;
  let error = q1.error;

  if (error && String(error.message).toLowerCase().includes("column")) {
    const q2 = await supabase
      .from("alumnos")
      .select(columnas)
      .ilike("correo", email)
      .single();
    data = (q2.data as AlumnoRow | null) ?? null;
    error = q2.error;
  }

  if (error || !data) return { ok: false, error: "Correo no registrado" };
  if (!data.registrado) return { ok: false, error: "El alumno aún no ha creado su cuenta" };
  if (data.estado !== "Activo") return { ok: false, error: "Cuenta inactiva" };

  // Rate limiting: si la cuenta está bloqueada temporalmente, rechazar.
  const bloqueadoHasta = data.login_bloqueado_hasta ? new Date(data.login_bloqueado_hasta).getTime() : 0;
  if (bloqueadoHasta > Date.now()) {
    const mins = Math.ceil((bloqueadoHasta - Date.now()) / 60000);
    return { ok: false, error: `Demasiados intentos. Intenta de nuevo en ${mins} min.` };
  }

  const salt = String(data.salt || "");
  const hash = String(data.contrasena_hash || "");
  if (!salt || !hash) return { ok: false, error: "Cuenta sin contraseña configurada" };

  if (hashPassword(password, salt) !== hash) {
    const intentos = (data.login_intentos ?? 0) + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await supabaseAdmin
      .from("alumnos")
      .update({
        login_intentos: bloquear ? 0 : intentos,
        login_bloqueado_hasta: bloquear ? new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString() : null,
      })
      .eq("id", data.id);
    if (bloquear) {
      await registrarAuditoria("login_bloqueado", `Bloqueado tras ${MAX_INTENTOS} intentos fallidos`);
      return { ok: false, error: `Demasiados intentos. Intenta de nuevo en ${BLOQUEO_MIN} min.` };
    }
    await registrarAuditoria("login_fallido", `Intento ${intentos}/${MAX_INTENTOS} para ${email}`);
    return { ok: false, error: "Contraseña incorrecta" };
  }

  // Éxito: resetea el contador de intentos
  await supabaseAdmin
    .from("alumnos")
    .update({ login_intentos: 0, login_bloqueado_hasta: null })
    .eq("id", data.id);

  const user: SessionUser = {
    id: data.id,
    dni: data.dni ?? "",
    nombres: data.nombres,
    apellidos: data.apellidos,
    correo: data.correo ?? "",
    rol: data.rol,
    qr_autorizado: data.qr_autorizado,
    debe_cambiar_password: Boolean(data.debe_cambiar_password),
    session_version: data.session_version ?? 0,
  };

  await createSession(user);
  await registrarAuditoria("login", `Inicio de sesión de ${user.nombres} ${user.apellidos}`);
  return { ok: true, user };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
}

export async function cerrarSesionTodosDispositivos(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (session.rol !== "Administrador") return { ok: false, error: "Solo el administrador puede cerrar sesiones" };

  const { error } = await supabaseAdmin
    .from("alumnos")
    .update({ session_version: (session.session_version ?? 0) + 1 })
    .eq("id", session.id);

  if (error) return { ok: false, error: error.message };

  // Cierra también la sesión actual: la cookie queda con versión anterior
  await destroySession();
  await registrarAuditoria("cerrar_sesiones", `Se cerraron todas las sesiones de ${session.nombres} ${session.apellidos}`);
  return { ok: true };
}

export type CambiarPasswordResult = { ok: true } | { ok: false; error: string };

export async function cambiarPasswordAction(
  actual: string,
  nueva: string
): Promise<CambiarPasswordResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };

  const base = "id,dni,nombres,apellidos,correo,salt,contrasena_hash,registrado,rol,qr_autorizado,estado,debe_cambiar_password";
  const q1 = await supabaseAdmin
    .from("alumnos")
    .select(base + ",session_version")
    .eq("id", session.id)
    .single();

  let user: AlumnoRow | null = (q1.data as AlumnoRow | null) ?? null;
  if (!user && q1.error && String(q1.error.message).toLowerCase().includes("column")) {
    const q2 = await supabaseAdmin
      .from("alumnos")
      .select(base)
      .eq("id", session.id)
      .single();
    user = (q2.data as AlumnoRow | null) ?? null;
  }

  if (!user) return { ok: false, error: "Cuenta no encontrada" };
  const sessionVersion = user.session_version ?? 0;

  const salt = String(user.salt || "");
  const hash = String(user.contrasena_hash || "");
  if (hashPassword(actual, salt) !== hash) return { ok: false, error: "Contraseña actual incorrecta" };

  const trimmed = nueva.trim();
  if (trimmed === actual) return { ok: false, error: "La nueva contraseña no puede ser igual a la actual" };
  const errValidacion = validarNuevaContrasena(trimmed, user.dni, user.nombres);
  if (errValidacion) return { ok: false, error: errValidacion };

  const nuevoSalt = randomSalt();
  const nuevoHash = hashPassword(trimmed, nuevoSalt);

  const { error: updError } = await supabaseAdmin
    .from("alumnos")
    .update({ contrasena_hash: nuevoHash, salt: nuevoSalt, debe_cambiar_password: false })
    .eq("id", session.id);

  if (updError) return { ok: false, error: "Error al guardar la nueva contraseña" };

  await createSession({
    id: session.id,
    dni: user.dni ?? "",
    nombres: user.nombres,
    apellidos: user.apellidos,
    correo: user.correo ?? "",
    rol: user.rol,
    qr_autorizado: user.qr_autorizado,
    debe_cambiar_password: false,
    session_version: sessionVersion,
  });

  await registrarAuditoria("cambiar_password", `Cambió su contraseña (${user.nombres} ${user.apellidos})`);

  return { ok: true };
}
