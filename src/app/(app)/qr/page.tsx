import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { estadoClase, esPrimeraClase, esAlumno, diaHoy, fechaHoy, normalizeName } from "@/lib/estado";
import DocenteQrPanel from "@/components/panels/DocenteQrPanel";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ data: horario }, { data: cursos }, { data: abiertas }] = await Promise.all([
    supabase.from("horario").select("*").order("hora_inicio"),
    supabase.from("cursos").select("nombre").eq("asistencia_obligatoria", false),
    supabase.from("clases_abiertas").select("curso,hora_abierta").eq("fecha", fechaHoy()),
  ]);

  if (!horario) return <p className="text-red-600">Error al cargar el horario.</p>;

  const excluidos = new Set((cursos ?? []).map((c) => normalizeName(c.nombre)));

  const aperturaPorCurso = new Map<string, string>();
  for (const a of abiertas ?? []) aperturaPorCurso.set(normalizeName(a.curso), a.hora_abierta);

  const hoy = diaHoy();
  const clasesHoy = (horario ?? [])
    .filter((h) => h.dia === hoy && !excluidos.has(normalizeName(h.curso)))
    .map((h) => ({
      ...h,
      estado: estadoClase(
        h,
        aperturaPorCurso.get(normalizeName(h.curso)) ?? null,
        esPrimeraClase(h, horario ?? [], hoy, excluidos)
      ),
    }));

  if (esAlumno(session.rol)) {
    return (
      <div>
        <h1 className="text-xl font-bold text-blue-900">QR de Asistencia</h1>
        <p className="mt-2 text-slate-500">
          Ahora la asistencia se marca escaneando el QR del docente. Entra a &quot;Marcar&quot; para registrar tu
          asistencia.
        </p>
      </div>
    );
  }

  if (session.rol === "Docente" || session.rol === "Administrador") {
    return <DocenteQrPanel docente={session.nombres + " " + session.apellidos} clases={clasesHoy} />;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">QR de Asistencia</h1>
      <p className="mt-2 text-slate-500">
        La generación de QR está disponible solo para docentes y administradores. Inicia sesión con una cuenta válida.
      </p>
    </div>
  );
}