import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.debe_cambiar_password) redirect("/cambiar-password");

  return (
    <div className="min-h-screen">
      <Nav user={session} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
