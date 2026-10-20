"use client";

import { useEffect, useState } from "react";
import {
  obtenerConfiguracion,
  actualizarConfiguracion,
  type ConfiguracionSistema,
} from "@/lib/admin";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";

type Campo = {
  clave: keyof ConfiguracionSistema;
  etiqueta: string;
  ayuda: string;
  sufijo: string;
};

const CAMPOS: Campo[] = [
  {
    clave: "multa_tardanza",
    etiqueta: "Multa por tardanza",
    ayuda: "Monto que se cobra al alumno cuando llega tarde (se genera en el cierre de lista).",
    sufijo: "S/",
  },
  {
    clave: "multa_buzo",
    etiqueta: "Multa por buzo",
    ayuda: "Monto que se cobra cuando el alumno asiste sin el buzo oficial.",
    sufijo: "S/",
  },
  {
    clave: "multa_actividad",
    etiqueta: "Multa por actividad",
    ayuda: "Monto cuando el alumno no asiste a una actividad obligatoria en la que se inscribió.",
    sufijo: "S/",
  },
  {
    clave: "multa_limpieza",
    etiqueta: "Multa por limpieza",
    ayuda: "Monto cuando el alumno falta a su turno de limpieza.",
    sufijo: "S/",
  },
  {
    clave: "tiempo_apertura_qr",
    etiqueta: "Apertura anticipada del QR",
    ayuda: "Minutos antes del inicio de clase en que se puede empezar a marcar.",
    sufijo: "min",
  },
  {
    clave: "tiempo_cierre_qr",
    etiqueta: "Cierre del QR",
    ayuda: "Minutos después del inicio de clase en que se cierra la lista.",
    sufijo: "min",
  },
];

const VACIO: ConfiguracionSistema = {
  multa_tardanza: 0,
  multa_buzo: 0,
  multa_actividad: 0,
  multa_limpieza: 0,
  tiempo_apertura_qr: 0,
  tiempo_cierre_qr: 0,
};

export default function ConfiguracionPanel() {
  const [valores, setValores] = useState<ConfiguracionSistema>(VACIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const res = await obtenerConfiguracion();
      if ("error" in res) {
        setError(res.error || "No se pudo cargar la configuración.");
      } else {
        setValores(res);
      }
      setLoading(false);
    })();
  }, []);

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setMsg(null);
    const res = await actualizarConfiguracion(valores);
    setGuardando(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Configuración actualizada. Los nuevos montos aplican desde el siguiente cobro." }
        : { ok: false, text: res.error || "Error al guardar." }
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Configuración del sistema</h1>
      <p className="mt-1 text-sm text-slate-500">
        Montos de multas y tiempos del QR. Los cambios quedan registrados en la auditoría.
      </p>

      {msg && (
        <div
          className={`mt-3 rounded-lg px-4 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {error ? (
        <div className="mt-4">
          <ErrorState onReintentar={() => location.reload()} />
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {CAMPOS.map((c) => (
            <div key={c.clave} className="rounded-xl bg-white p-4 shadow">
              <label className="block text-sm font-semibold text-slate-800" htmlFor={`cfg-${c.clave}`}>
                {c.etiqueta}
              </label>
              <p className="mt-0.5 text-xs text-slate-500">{c.ayuda}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500">{c.sufijo}</span>
                <input
                  id={`cfg-${c.clave}`}
                  type="number"
                  min={0}
                  step="0.5"
                  value={valores[c.clave]}
                  onChange={(e) => setValores({ ...valores, [c.clave]: Number(e.target.value) })}
                  className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-4">
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      )}
    </div>
  );
}
