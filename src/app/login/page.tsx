import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LoginForm from "@/components/panels/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/horario");
  return <LoginForm />;
}
