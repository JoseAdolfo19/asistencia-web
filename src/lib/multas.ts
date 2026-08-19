"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { fechaHoy } from "@/lib/estado";

export type CobrarResult = { ok: boolean; error?: string; nuevaEstado?: string };

function esTesorera(rol: string): boolean {
  return rol === "Tesorera" || rol === "Administrador";
}

export async function cambiarEstadoMulta(id: number, nuevoEstado: string): Promise<CobrarResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!esTesorera(session.rol)) return { ok: false, error: "Solo la tesorera o el administrador pueden actualizar multas" };

  const { data: fila, error: errSelect } = await supabaseAdmin
    .from("multas")
    .select("id,monto")
    .eq("id", id)
    .limit(1);
  if (errSelect || !fila || fila.length === 0) return { ok: false, error: "Multa no encontrada" };

  const { error } = await supabaseAdmin.from("multas").update({ estado: nuevoEstado }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar: " + error.message };

  await registrarAuditoria(
    "cambiar_estado_multa",
    `Multa #${id} (S/ ${fila[0].monto}) -> ${nuevoEstado}`
  );
  return { ok: true, nuevaEstado: nuevoEstado };
}

export type CrearMultaResult = { ok: boolean; error?: string };

export async function crearMultaBuzo(alumnoId: string): Promise<CrearMultaResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (!esTesorera(session.rol)) return { ok: false, error: "Solo la tesorera o el administrador pueden registrar multas" };

  const id = String(alumnoId || "").trim();
  if (!id) return { ok: false, error: "Selecciona un alumno" };

  const { data: configRows } = await supabaseAdmin.from("configuracion").select("*").limit(1);
  const monto = Number(configRows?.[0]?.multa_buzo) || 5;

  const { error } = await supabaseAdmin.from("multas").insert({
    alumno: id,
    tipo: "Buzo",
    motivo: "No vino con buzo (uniforme)",
    monto,
    fecha: fechaHoy(),
    estado: "Pendiente",
  });
  if (error) return { ok: false, error: "No se pudo crear la multa: " + error.message };

  await registrarAuditoria("crear_multa_buzo", `Multa de buzo (S/ ${monto}) a ${id}`);
  return { ok: true };
}

export type JustificarResult = { ok: boolean; error?: string };

export async function justificarAsistencia(
  registroId: number,
  motivo: string
): Promise<JustificarResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };

  // Docente, Tesorera o Administrador pueden justificar faltas/tardanzas
  if (!["Docente", "Tesorera", "Administrador"].includes(session.rol)) {
    return { ok: false, error: "Solo docentes, tesorera o administrador pueden justificar asistencia" };
  }

  const id = Number(registroId);
  if (!id) return { ok: false, error: "Registro inválido" };
  const texto = String(motivo || "").trim();
  if (!texto) return { ok: false, error: "Escribe el motivo de la justificación" };

  const { data: fila, error: errSelect } = await supabaseAdmin
    .from("asistencia")
    .select("id,alumno,curso,fecha,estado")
    .eq("id", id)
    .limit(1);
  if (errSelect || !fila || fila.length === 0) return { ok: false, error: "Registro no encontrado" };

  const reg = fila[0];
  if (reg.estado !== "Falta" && reg.estado !== "Tardanza") {
    return { ok: false, error: "Solo se puede justificar una Falta o Tardanza" };
  }

  // Marca el registro como justificado
  const { error: errUpdate } = await supabaseAdmin
    .from("asistencia")
    .update({ justificada: true, motivo_justificacion: texto })
    .eq("id", id);
  if (errUpdate) return { ok: false, error: "No se pudo justificar: " + errUpdate.message };

  // Anula la multa pendiente asociada a este registro de tardanza
  // (usando la conexión asistencia_id cuando existe; fallback por alumno+fecha).
  const q = supabaseAdmin
    .from("multas")
    .update({ estado: "Anulada", motivo: "Anulada por justificación: " + texto })
    .eq("estado", "Pendiente");

  let errMulta: { message: string } | null = null;
  try {
    const viaId = await q.eq("asistencia_id", id);
    if (viaId.error && String(viaId.error.message).toLowerCase().includes("column")) {
      const { error: errFallback } = await supabaseAdmin
        .from("multas")
        .update({ estado: "Anulada", motivo: "Anulada por justificación: " + texto })
        .eq("alumno", reg.alumno)
        .eq("fecha", reg.fecha)
        .eq("estado", "Pendiente");
      errMulta = errFallback;
    } else {
      errMulta = viaId.error;
    }
  } catch {
    const { error: errFallback } = await supabaseAdmin
      .from("multas")
      .update({ estado: "Anulada", motivo: "Anulada por justificación: " + texto })
      .eq("alumno", reg.alumno)
      .eq("fecha", reg.fecha)
      .eq("estado", "Pendiente");
    errMulta = errFallback;
  }
  if (errMulta) return { ok: false, error: "Registro justificado pero no se pudo anular la multa: " + errMulta.message };

  await registrarAuditoria(
    "justificar_asistencia",
    `${session.nombres} ${session.apellidos} justificó ${reg.estado} de ${reg.alumno} en ${reg.curso} (${reg.fecha}): ${texto}`
  );
  return { ok: true };
}