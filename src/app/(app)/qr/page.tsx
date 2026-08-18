import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { estadoClase, diaHoy, fechaHoy, normalizeName } from "@/lib/estado";
import QrPanel from "@/components/panels/QrPanel";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.rol !== "Alumno") {
    return (
      <div>
        <h1 className="text-xl font-bold text-blue-900">QR de Asistencia</h1>
        <p className="mt-2 text-slate-500">
          La generación de QR está disponible solo para alumnos. Inicia sesión con una cuenta de alumno para ver tu QR.
        </p>
      </div>
    );
  }

  const [{ data: horario }, { data: cursos }, { data: configRows }, { data: abiertas }] = await Promise.all([
    supabase.from("horario").select("*").order("hora_inicio"),
    supabase.from("cursos").select("nombre").eq("asistencia_obligatoria", false),
    supabase.from("configuracion").select("tiempo_cierre_qr").limit(1),
    supabase.from("clases_abiertas").select("curso,hora_abierta").eq("fecha", fechaHoy()),
  ]);

  if (!horario) return <p className="text-red-600">Error al cargar el horario.</p>;

  const excluidos = new Set((cursos ?? []).map((c) => normalizeName(c.nombre)));
  const tolerancia = Number(configRows?.[0]?.tiempo_cierre_qr) || 5;

  const aperturaPorCurso = new Map<string, string>();
  for (const a of abiertas ?? []) aperturaPorCurso.set(normalizeName(a.curso), a.hora_abierta);

  const hoy = diaHoy();
  const clasesHoy = (horario ?? [])
    .filter((h) => h.dia === hoy && !excluidos.has(normalizeName(h.curso)))
    .map((h) => ({
      ...h,
      estado: estadoClase(h, tolerancia, aperturaPorCurso.get(normalizeName(h.curso)) ?? null),
    }));

  return <QrPanel alumnoId={session.id} clases={clasesHoy} />;
}
