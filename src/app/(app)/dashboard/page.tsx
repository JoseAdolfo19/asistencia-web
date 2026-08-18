import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DashboardPanel from "@/components/panels/DashboardPanel";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <DashboardPanel esAlumno={session.rol === "Alumno"} alumnoId={session.id} />;
}
