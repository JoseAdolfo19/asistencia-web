"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction } from "@/lib/auth";
import Button from "@/components/ui/Button";

export default function LoginForm() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginAction(correo, password);
    setLoading(false);
    if (result.ok) {
      if (result.user.debe_cambiar_password) {
        router.push("/cambiar-password");
      } else {
        router.push("/horario");
      }
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-center text-blue-900">IES La Salle</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sistema de Asistencia</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Correo</label>
            <input
              type="email"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="DNI@ieslasalle.edu.pe"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <Button type="submit" disabled={loading} size="lg">
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link href="/recuperar" className="font-medium text-blue-800 hover:underline">
            ¿Has olvidado tu contraseña?
          </Link>
        </p>
      </div>
    </div>
  );
}
