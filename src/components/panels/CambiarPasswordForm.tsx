"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cambiarPasswordAction } from "@/lib/auth";
import { contrasenaFuerte } from "@/lib/password";
import Button from "@/components/ui/Button";
import PasswordStrength from "@/components/ui/PasswordStrength";

export default function CambiarPasswordForm() {
  const router = useRouter();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nueva !== confirmar) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setLoading(true);
    const result = await cambiarPasswordAction(actual, nueva);
    setLoading(false);
    if (result.ok) {
      router.push("/horario");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Contraseña actual
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Nueva contraseña
          </label>
          <input
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <PasswordStrength value={nueva} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Confirmar nueva contraseña
          </label>
          <input
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <Button
          type="submit"
          disabled={loading || !contrasenaFuerte(nueva)}
          size="lg"
        >
          {loading ? "Guardando..." : "Guardar contraseña"}
        </Button>
      </form>
    </div>
  );
}
