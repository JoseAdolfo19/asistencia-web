import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ActividadesPanel from "@/components/panels/ActividadesPanel";

export const dynamic = "force-dynamic";

export default async function ActividadesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const puedeGestionar = session.rol === "Tesorera" || session.rol === "Administrador";
  const esAlumno = session.rol === "Alumno";

  return (
    <ActividadesPanel
      puedeGestionar={puedeGestionar}
      esAlumno={esAlumno}
      alumnoId={session.id}
    />
  );
}