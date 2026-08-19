"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword, randomSalt } from "@/lib/crypto";
import { validarNuevaContrasena } from "@/lib/password";
import { permitirRateLimit } from "@/lib/rateLimit";
import { registrarAuditoria } from "@/lib/auditoria";

export type VerificarResult = { ok: true; id: string; nombre: string } | { ok: false; error: string };
export type RecuperarResult = { ok: true } | { ok: false; error: string };

type Fila = {
  id: string;
  dni: string | null;
  nombres: string;
  apellidos: string;
  estado: string;
};

async function buscarPorCorreo(correo: string): Promise<Fila | null> {
  const email = String(correo || "").trim().toLowerCase();
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("alumnos")
    .select("id,dni,nombres,apellidos,estado")
    .ilike("correo", email)
    .maybeSingle();
  return (data as Fila | null) ?? null;
}

function identidadValida(u: Fila, dni: string): boolean {
  const d = String(dni || "").trim();
  return !!d && String(u.dni || "").trim() === d;
}

// Paso 1: verifica que el correo exista y que el DNI coincida.
// Respuesta genérica para no revelar si un correo existe.
export async function verificarIdentidad(correo: string, dni: string): Promise<VerificarResult> {
  const email = String(correo || "").trim().toLowerCase();
  if (!email || !dni) return { ok: false, error: "Ingresa tu correo y tu DNI" };

  if (!(await permitirRateLimit(`recuperar:${email}`, 5, 60_000))) {
    return { ok: false, error: "Demasiados intentos. Espera un momento." };
  }

  const u = await buscarPorCorreo(email);
  if (!u || !identidadValida(u, dni)) return { ok: false, error: "Correo o DNI incorrecto" };
  if (u.estado !== "Activo") return { ok: false, error: "Cuenta inactiva. Contacta al administrador." };

  return { ok: true, id: u.id, nombre: (u.nombres + " " + u.apellidos).trim() };
}

// Paso 2: confirma la identidad de nuevo en el servidor y guarda la nueva contraseña.
export async function recuperarContrasena(
  correo: string,
  dni: string,
  nueva: string
): Promise<RecuperarResult> {
  const email = String(correo || "").trim().toLowerCase();
  const pw = String(nueva || "").trim();
  if (!email || !dni || !pw) return { ok: false, error: "Faltan datos" };

  if (!(await permitirRateLimit(`recuperar:${email}`, 5, 60_000))) {
    return { ok: false, error: "Demasiados intentos. Espera un momento." };
  }

  const u = await buscarPorCorreo(email);
  if (!u || !identidadValida(u, dni)) return { ok: false, error: "Correo o DNI incorrecto" };
  if (u.estado !== "Activo") return { ok: false, error: "Cuenta inactiva. Contacta al administrador." };

  const errValidacion = validarNuevaContrasena(pw, u.dni, u.nombres);
  if (errValidacion) return { ok: false, error: errValidacion };

  const salt = randomSalt();
  const hash = hashPassword(pw, salt);

  const { error: updError } = await supabaseAdmin
    .from("alumnos")
    .update({
      contrasena_hash: hash,
      salt,
      debe_cambiar_password: false,
      login_intentos: 0,
      login_bloqueado_hasta: null,
    })
    .eq("id", u.id);
  if (updError) return { ok: false, error: "No se pudo guardar la contraseña. Intenta de nuevo." };

  await registrarAuditoria("recuperar_contrasena", `${u.nombres} ${u.apellidos} recuperó su contraseña`);
  return { ok: true };
}