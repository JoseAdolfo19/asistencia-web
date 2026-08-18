import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { diaHoy, normalizeName } from "@/lib/estado";
import ScanPanel from "@/components/panels/ScanPanel";

export const dynamic = "force-dynamic";

export default async function EscanearPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const puedeEscanear = session.rol === "Docente" || session.rol === "Administrador";

  if (!puedeEscanear) {
    return (
      <div>
        <h1 className="text-xl font-bold text-blue-900">Escanear QR</h1>
        <p className="mt-2 text-slate-500">
          Esta función es para docentes y administradores. Inicia sesión con una cuenta de docente para marcar asistencia.
        </p>
      </div>
    );
  }

  const [{ data: horario }, { data: cursos }] = await Promise.all([
    supabase.from("horario").select("id,curso,dia,hora_inicio,hora_fin").order("hora_inicio"),
    supabase.from("cursos").select("nombre").eq("asistencia_obligatoria", false),
  ]);

  const excluidos = new Set((cursos ?? []).map((c) => normalizeName(c.nombre)));
  const hoy = diaHoy();

  const clasesHoy = (horario ?? [])
    .filter((h) => h.dia === hoy && !excluidos.has(normalizeName(h.curso)))
    .map((h) => ({ id: h.id, curso: h.curso, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin }));

  return <ScanPanel docente={session.nombres + " " + session.apellidos} clasesHoy={clasesHoy} />;
}
