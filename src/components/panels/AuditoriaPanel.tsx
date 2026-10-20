"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerAuditoria, type RegistroAuditoria } from "@/lib/admin";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";

const VARIANTES_ROL: Record<string, "blue" | "green" | "amber" | "slate"> = {
  Administrador: "blue",
  Docente: "green",
  Tesorera: "amber",
  Alumno: "slate",
};

function fechaLegible(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "America/Lima",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function AuditoriaPanel() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [filtro, setFiltro] = useState("");
  const [buscado, setBuscado] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (f: string) => {
    setLoading(true);
    setError(null);
    const res = await obtenerAuditoria(f);
    if (!Array.isArray(res)) {
      setRegistros([]);
      setError(res.error || "No se pudo cargar la auditoría.");
    } else {
      setRegistros(res);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar("");
  }, [cargar]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setBuscado(filtro);
    cargar(filtro);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Auditoría del sistema</h1>
      <p className="mt-1 text-sm text-slate-500">
        Registro de acciones importantes: justificaciones, cobros, contraseñas, cambios de configuración y más.
        Se muestran los últimos 200 eventos.
      </p>

      <form onSubmit={buscar} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por usuario, acción o detalle..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
        {buscado && (
          <Button
            variant="secondary"
            onClick={() => {
              setFiltro("");
              setBuscado("");
              cargar("");
            }}
            disabled={loading}
          >
            Limpiar
          </Button>
        )}
      </form>

      {error ? (
        <div className="mt-4">
          <ErrorState onReintentar={() => cargar(buscado)} />
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : registros.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No hay eventos registrados{buscado ? " para esa búsqueda" : ""}.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow">
          <table className="w-full text-sm">
            <caption className="sr-only">Eventos de auditoría</caption>
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Fecha / hora</th>
                <th scope="col" className="px-4 py-2 font-medium">Usuario</th>
                <th scope="col" className="px-4 py-2 font-medium">Rol</th>
                <th scope="col" className="px-4 py-2 font-medium">Acción</th>
                <th scope="col" className="px-4 py-2 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fechaLegible(r.creado_en)}</td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-800">{r.usuario_nombre || "—"}</span>
                    <span className="ml-1 text-xs text-slate-400">{r.usuario_id || ""}</span>
                  </td>
                  <td className="px-4 py-2">
                    {r.rol ? <Badge variant={VARIANTES_ROL[r.rol] ?? "slate"}>{r.rol}</Badge> : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-700">{r.accion}</td>
                  <td className="px-4 py-2 text-slate-600">{r.detalle || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
