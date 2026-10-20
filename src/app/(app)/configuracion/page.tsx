import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ConfiguracionPanel from "@/components/panels/ConfiguracionPanel";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "Administrador") redirect("/dashboard");

  return <ConfiguracionPanel />;
}
