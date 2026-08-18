"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { registrarAuditoria } from "@/lib/auditoria";

type ClaseInput = {
  id?: number;
  curso: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  docente?: string;
  aula?: string;
};

export async function guardarClase(clase: ClaseInput): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (session.rol !== "Administrador") return { ok: false, error: "Solo el administrador puede editar el horario" };

  const curso = String(clase.curso || "").trim();
  const dia = String(clase.dia || "").trim();
  const inicio = String(clase.hora_inicio || "").trim();
  const fin = String(clase.hora_fin || "").trim();

  if (!curso || !dia || !inicio || !fin) return { ok: false, error: "Completa curso, día, hora de inicio y fin" };

  const data = {
    curso,
    dia,
    hora_inicio: inicio,
    hora_fin: fin,
    docente: String(clase.docente || "").trim(),
    aula: String(clase.aula || "").trim(),
  };

  if (clase.id) {
    const { error } = await supabaseAdmin.from("horario").update(data).eq("id", clase.id);
    if (error) return { ok: false, error: error.message };
    await registrarAuditoria("editar_clase", `${curso} ${dia} ${inicio}-${fin}`);
    return { ok: true };
  }

  const { error } = await supabaseAdmin.from("horario").insert(data);
  if (error) return { ok: false, error: error.message };
  await registrarAuditoria("crear_clase", `${curso} ${dia} ${inicio}-${fin}`);
  return { ok: true };
}

export async function eliminarClase(id: number): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada" };
  if (session.rol !== "Administrador") return { ok: false, error: "Solo el administrador puede editar el horario" };

  const { error } = await supabaseAdmin.from("horario").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await registrarAuditoria("eliminar_clase", `Clase #${id}`);
  return { ok: true };
}
