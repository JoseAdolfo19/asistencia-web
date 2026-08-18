import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import MultasPanel from "@/components/panels/MultasPanel";

export const dynamic = "force-dynamic";

export default async function MultasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const esAlumno = session.rol === "Alumno";
  const puedeCobrar = session.rol === "Tesorera" || session.rol === "Administrador";

  return (
    <MultasPanel
      puedeCobrar={puedeCobrar}
      esAlumno={esAlumno}
      alumnoId={session.id}
    />
  );
}