import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AsistenciaPanel from "@/components/panels/AsistenciaPanel";

export const dynamic = "force-dynamic";

export default async function AsistenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <AsistenciaPanel isAdmin={session.rol !== "Alumno"} alumnoId={session.id} />;
}
