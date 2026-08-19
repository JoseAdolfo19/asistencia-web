import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import HorarioEditor from "@/components/panels/HorarioEditor";

export const dynamic = "force-dynamic";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default async function EditarHorarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.rol !== "Administrador") {
    return (
      <div>
        <h1 className="text-xl font-bold text-blue-900">Editar Horario</h1>
        <p className="mt-2 text-slate-500">Solo el administrador puede editar el horario.</p>
      </div>
    );
  }

  const [{ data: horario }, { data: cursos }, { data: docentes }] = await Promise.all([
    supabase.from("horario").select("*").order("hora_inicio"),
    supabase.from("cursos").select("id,nombre").order("id"),
    supabase.from("docentes").select("nombre").eq("estado", "Activo").order("nombre"),
  ]);

  return (
    <HorarioEditor
      clases={horario ?? []}
      cursos={(cursos ?? []).map((c) => c.nombre)}
      docentes={(docentes ?? []).map((d) => d.nombre)}
      dias={DIAS}
    />
  );
}
