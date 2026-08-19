import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import UsuariosPanel from "@/components/panels/UsuariosPanel";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.rol !== "Administrador") {
    return (
      <div>
        <h1 className="text-xl font-bold text-blue-900">Gestión de Usuarios</h1>
        <p className="mt-2 text-slate-500">Solo el administrador puede gestionar usuarios.</p>
      </div>
    );
  }

  return <UsuariosPanel />;
}