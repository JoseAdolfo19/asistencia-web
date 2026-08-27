import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { esAlumno } from "@/lib/estado";
import DocenteQrPanel from "@/components/panels/DocenteQrPanel";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol === "Administrador") redirect("/dashboard");

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

  if (session.rol === "Docente") {
    return <DocenteQrPanel docente={session.nombres + " " + session.apellidos} />;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">QR de Asistencia</h1>
      <p className="mt-2 text-slate-500">
        La generación de QR está disponible solo para docentes. Inicia sesión con una cuenta válida.
      </p>
    </div>
  );
}