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