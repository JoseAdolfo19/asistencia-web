import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import CambiarPasswordForm from "@/components/panels/CambiarPasswordForm";

export const dynamic = "force-dynamic";

export default async function CambiarPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.debe_cambiar_password) redirect("/horario");

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex max-w-md flex-col px-4 py-10">
        <h1 className="text-2xl font-bold text-blue-900">Cambiar contraseña</h1>
        <p className="mt-1 text-sm text-slate-500">
          Por seguridad debes cambiar tu contraseña inicial antes de continuar.
        </p>
        <CambiarPasswordForm />
      </main>
    </div>
  );
}
