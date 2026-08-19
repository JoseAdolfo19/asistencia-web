"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { esAlumnoRegistrado } from "@/lib/estado";

export type ActividadResult = { ok: boolean; error?: string; multasCreadas?: number };

function puedeGestionar(rol: string): boolean {
  return rol === "Tesorera" || rol === "Administrador";
}

// Crea una actividad y registra a todos los alumnos con participo=false.
export async function crearActividad(
  nombre: string,
  fecha: string,
  descripcion: string
): Promise<ActividadResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeGestionar(session.rol)) return { ok: false, error: "Solo la tesorera o el administrador" };

  const n = String(nombre || "").trim();
  if (!n) return { ok: false, error: "Escribe el nombre de la actividad" };
  if (!fecha) return { ok: false, error: "Elige la fecha de la actividad" };

  const { data: act, error: errAct } = await supabaseAdmin
    .from("actividades")
    .insert({ nombre: n, descripcion: String(descripcion || "").trim() || null, fecha, estado: "Abierta" })
    .select("id")
    .single();
  if (errAct || !act) return { ok: false, error: "No se pudo crear la actividad: " + errAct?.message };

  // Participación inicial: todos los alumnos (y la tesorera como alumna) en false
  const { data: alumnos } = await supabaseAdmin
    .from("alumnos")
    .select("id")
    .in("rol", ["Alumno", "Tesorera"]);
  const filas = (alumnos ?? [])
    .map((a) => a.id)
    .filter(esAlumnoRegistrado)
    .map((id) => ({ actividad_id: act.id, alumno: id, participacion: false }));
  if (filas.length > 0) {
    const { error: errAl } = await supabaseAdmin.from("actividad_alumnos").insert(filas);
    if (errAl) return { ok: false, error: "Actividad creada pero no se pudieron registrar los alumnos: " + errAl.message };
  }

  await registrarAuditoria("crear_actividad", `Actividad "${n}" del ${fecha}`);
  return { ok: true };
}

// Marca si un alumno participó en la actividad.
export async function marcarParticipacion(
  actividadId: number,
  alumnoId: string,
  participo: boolean
): Promise<ActividadResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeGestionar(session.rol)) return { ok: false, error: "Solo la tesorera o el administrador" };

  const { error } = await supabaseAdmin
    .from("actividad_alumnos")
    .update({ participacion: participo })
    .eq("actividad_id", actividadId)
    .eq("alumno", alumnoId);
  if (error) return { ok: false, error: "No se pudo actualizar la participación: " + error.message };
  return { ok: true };
}

// Cierra la actividad y genera la multa de S/50 a quienes no participaron.
export async function cerrarActividad(actividadId: number): Promise<ActividadResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeGestionar(session.rol)) return { ok: false, error: "Solo la tesorera o el administrador" };

  const { data: act, error: errAct } = await supabaseAdmin
    .from("actividades")
    .select("id,nombre,fecha,estado")
    .eq("id", actividadId)
    .limit(1);
  if (errAct || !act || act.length === 0) return { ok: false, error: "Actividad no encontrada" };
  const a = act[0];
  if (a.estado !== "Abierta") return { ok: false, error: "La actividad ya está cerrada o anulada" };

  const { data: cfg } = await supabaseAdmin.from("configuracion").select("*").limit(1);
  const monto = Number(cfg?.[0]?.multa_actividad) || 50;

  const { data: partes } = await supabaseAdmin
    .from("actividad_alumnos")
    .select("alumno,participacion")
    .eq("actividad_id", actividadId);

  const { data: existentes } = await supabaseAdmin
    .from("multas")
    .select("id")
    .eq("tipo", "Actividad")
    .eq("actividad_id", actividadId);

  // Si ya hay multas de esta actividad, no se generan de nuevo (evita duplicados)
  if (existentes && existentes.length > 0) {
    return { ok: false, error: "Esta actividad ya tiene multas generadas." };
  }

  const nuevas = (partes ?? [])
    .filter((p) => !p.participacion)
    .map((p) => ({
      alumno: p.alumno,
      tipo: "Actividad",
      motivo: "No participó en " + a.nombre,
      monto,
      fecha: a.fecha,
      estado: "Pendiente",
      actividad_id: actividadId,
    }));

  if (nuevas.length > 0) {
    const { error: errMultas } = await supabaseAdmin.from("multas").insert(nuevas);
    if (errMultas) return { ok: false, error: "No se pudieron generar las multas: " + errMultas.message };
  }

  const { error: errCierre } = await supabaseAdmin.from("actividades").update({ estado: "Cerrada" }).eq("id", actividadId);
  if (errCierre) return { ok: false, error: "Multas generadas pero no se pudo cerrar la actividad: " + errCierre.message };

  await registrarAuditoria(
    "cerrar_actividad",
    `Actividad "${a.nombre}" cerrada: ${nuevas.length} multa(s) de S/ ${monto}`
  );
  return { ok: true, multasCreadas: nuevas.length };
}

// Reabre una actividad cerrada (p. ej. por error) y anula sus multas pendientes.
export async function reabrirActividad(actividadId: number): Promise<ActividadResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!puedeGestionar(session.rol)) return { ok: false, error: "Solo la tesorera o el administrador" };

  const { data: act, error: errAct } = await supabaseAdmin
    .from("actividades")
    .select("id,nombre,estado")
    .eq("id", actividadId)
    .limit(1);
  if (errAct || !act || act.length === 0) return { ok: false, error: "Actividad no encontrada" };
  if (act[0].estado !== "Cerrada") return { ok: false, error: "Solo se puede reabrir una actividad cerrada" };

  const { error: errMultas } = await supabaseAdmin
    .from("multas")
    .update({ estado: "Anulada", motivo: "Anulada por reapertura de la actividad: " + act[0].nombre })
    .eq("tipo", "Actividad")
    .eq("actividad_id", actividadId)
    .eq("estado", "Pendiente");
  if (errMultas) return { ok: false, error: "No se pudieron anular las multas: " + errMultas.message };

  const { error: errCierre } = await supabaseAdmin.from("actividades").update({ estado: "Abierta" }).eq("id", actividadId);
  if (errCierre) return { ok: false, error: "No se pudo reabrir la actividad: " + errCierre.message };

  await registrarAuditoria("reabrir_actividad", `Actividad "${act[0].nombre}" reabierta`);
  return { ok: true };
}