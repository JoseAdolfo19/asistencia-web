import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AuditoriaPanel from "@/components/panels/AuditoriaPanel";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "Administrador") redirect("/dashboard");

  return <AuditoriaPanel />;
}
