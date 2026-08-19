import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { esAlumno } from "@/lib/estado";
import MarcarPanel from "@/components/panels/MarcarPanel";

export const dynamic = "force-dynamic";

export default async function MarcarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!esAlumno(session.rol)) {
    return (
      <div>
        <h1 className="text-xl font-bold text-blue-900">Marcar Asistencia</h1>
        <p className="mt-2 text-slate-500">
          Esta función es para alumnos. Inicia sesión con tu cuenta de alumno para marcar asistencia con el QR del
          docente.
        </p>
      </div>
    );
  }

  return <MarcarPanel nombre={session.nombres + " " + session.apellidos} />;
}