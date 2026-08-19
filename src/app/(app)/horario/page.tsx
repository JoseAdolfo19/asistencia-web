import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/session";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default async function HorarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { data: horario, error } = await supabase
    .from("horario")
    .select("*")
    .order("hora_inicio");

  if (error) return <p className="text-red-600">Error al cargar el horario.</p>;

  const porDia = DIAS.map((dia) => ({
    dia,
    clases: (horario ?? []).filter((h) => h.dia === dia),
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-900">Horario de Clases</h1>
        {session.rol === "Administrador" && (
          <Link
            href="/horario/editar"
            className="rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Editar horario
          </Link>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {porDia.map(
          ({ dia, clases }) =>
            clases.length > 0 && (
              <div key={dia} className="rounded-xl bg-white p-4 shadow">
                <h2 className="mb-2 font-semibold text-slate-700">{dia}</h2>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 pr-2 font-medium">Hora</th>
                      <th className="py-1 font-medium">Curso</th>
                      <th className="py-1 font-medium">Docente</th>
                      <th className="py-1 font-medium">Aula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clases.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2 whitespace-nowrap text-slate-600">
                          {c.hora_inicio?.slice(0, 5)} - {c.hora_fin?.slice(0, 5)}
                        </td>
                        <td className="py-1.5 font-medium text-slate-800">{c.curso}</td>
                        <td className="py-1.5 text-slate-500">{c.docente || "—"}</td>
                        <td className="py-1.5 text-slate-500">{c.aula || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
}