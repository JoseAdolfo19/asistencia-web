"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { esAlumno, fechaHoy, horaAhora } from "@/lib/estado";
import { permitirRateLimit } from "@/lib/rateLimit";
import { registrarAuditoria } from "@/lib/auditoria";

export type ClaseLocalInfo = {
  id: number;
  nombre: string;
  puedoMarcar: boolean;
  marcadaHoy: boolean;
  registros: { fecha: string; hora: string; estado: string }[];
};

export type ClaseLocalResult =
  | { ok: true; data: ClaseLocalInfo | null }
  | { ok: false; error: string };

// Devuelve la clase local si el alumno está en `visible_para` (Daniela marca,
// Jose solo la ve). Si las tablas aún no existen o no aplica, devuelve data: null.
export async function getClaseLocalPara(): Promise<ClaseLocalResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!esAlumno(session.rol)) return { ok: false, error: "Solo alumnos" };

  try {
    const { data: clases, error } = await supabaseAdmin
      .from("clases_locales")
      .select("*")
      .eq("activa", true);
    if (error) return { ok: true, data: null };

    const clase = (clases ?? []).find((c) => (c.visible_para ?? []).includes(session.id)) ?? null;
    if (!clase) return { ok: true, data: null };

    const puedoMarcar = String(clase.alumno_marca) === session.id;
    const hoy = fechaHoy();

    const { data: regs } = await supabaseAdmin
      .from("clase_local_registros")
      .select("fecha,hora,estado")
      .eq("clase_local_id", clase.id)
      .order("fecha", { ascending: false })
      .limit(10);

    const registros = (regs ?? []).map((r) => ({
      fecha: String(r.fecha).slice(0, 10),
      hora: String(r.hora).slice(0, 5),
      estado: r.estado,
    }));

    return {
      ok: true,
      data: { id: clase.id, nombre: clase.nombre, puedoMarcar, marcadaHoy: registros.some((r) => r.fecha === hoy), registros },
    };
  } catch {
    return { ok: true, data: null };
  }
}

export type MarcarClaseLocalResult =
  | { ok: true; estado: string; curso: string }
  | { ok: false; error: string };

// Daniela (alumno_marca) marca su asistencia en la clase local. Es voluntario:
// una vez por día, solo guarda el registro, nunca genera faltas ni multas.
export async function marcarClaseLocal(id: number): Promise<MarcarClaseLocalResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!esAlumno(session.rol)) return { ok: false, error: "Solo alumnos" };

  const { data: clases, error } = await supabaseAdmin
    .from("clases_locales")
    .select("*")
    .eq("id", id)
    .eq("activa", true);
  if (error || !clases || clases.length === 0) return { ok: false, error: "Clase local no disponible" };
  const clase = clases[0];
  if (String(clase.alumno_marca) !== session.id) return { ok: false, error: "No puedes marcar en esta clase" };

  // Máximo 6 marcaciones por minuto por alumno
  if (!(await permitirRateLimit(`claselocal:${session.id}`, 6, 60_000))) {
    return { ok: false, error: "Demasiadas solicitudes. Espera un momento." };
  }

  const hoy = fechaHoy();
  const { data: existente } = await supabaseAdmin
    .from("clase_local_registros")
    .select("id")
    .eq("clase_local_id", id)
    .eq("alumno", session.id)
    .eq("fecha", hoy);
  if (existente && existente.length > 0) return { ok: false, error: "Ya marcaste en la clase local hoy" };

  const { error: eIns } = await supabaseAdmin.from("clase_local_registros").insert({
    clase_local_id: id,
    alumno: session.id,
    fecha: hoy,
    hora: horaAhora(),
    estado: "Presente",
  });
  if (eIns) return { ok: false, error: "No se pudo registrar: " + eIns.message };

  await registrarAuditoria(
    "marcar_clase_local",
    `${session.nombres} ${session.apellidos} marcó en la clase local ${clase.nombre}`
  );

  return { ok: true, estado: "Presente", curso: clase.nombre };
}