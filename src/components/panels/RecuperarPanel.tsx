"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { verificarIdentidad, recuperarContrasena } from "@/lib/recuperar";
import Button from "@/components/ui/Button";

export default function RecuperarPanel() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [dni, setDni] = useState("");
  const [verificado, setVerificado] = useState<{ id: string; nombre: string } | null>(null);
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await verificarIdentidad(codigo, dni);
    setLoading(false);
    if (res.ok) setVerificado({ id: res.id, nombre: res.nombre });
    else setError(res.error);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nueva !== confirma) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const res = await recuperarContrasena(codigo, dni, nueva);
    setLoading(false);
    if (res.ok) {
      setOk(true);
      setTimeout(() => router.push("/login"), 2000);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-center text-blue-900">Recuperar contraseña</h1>
        <p className="mt-1 text-center text-sm text-slate-500">IES La Salle · Sistema de Asistencia</p>

        {ok ? (
          <p className="mt-6 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            Contraseña actualizada. Redirigiendo al inicio de sesión...
          </p>
        ) : !verificado ? (
          <form onSubmit={verificar} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Código</label>
              <input
                type="text"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="AL001"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">DNI</label>
              <input
                type="text"
                required
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Tu número de DNI"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Verificando..." : "Verificar identidad"}
            </Button>
            <p className="text-center text-xs text-slate-400">
              Si no recuerdas tu código o DNI, contacta al administrador para restablecer tu contraseña.
            </p>
          </form>
        ) : (
          <form onSubmit={guardar} className="mt-6 space-y-4">
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              Identidad confirmada: <strong>{verificado.nombre}</strong>. Define tu nueva contraseña.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700">Nueva contraseña</label>
              <input
                type="password"
                required
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Confirmar contraseña</label>
              <input
                type="password"
                required
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setVerificado(null)}>
                Volver
              </Button>
              <Button type="submit" disabled={loading || nueva.length < 8}>
                {loading ? "Guardando..." : "Guardar contraseña"}
              </Button>
            </div>
            <p className="text-center text-xs text-slate-400">
              Mínimo 8 caracteres; no puede ser tu DNI ni tu nombre.
            </p>
          </form>
        )}

        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-blue-800 hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}