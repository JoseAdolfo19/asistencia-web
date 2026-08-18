"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { fechaHoy } from "@/lib/estado";
import { getQrToken } from "@/lib/marcar";

type Clase = {
  id: number;
  curso: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
};

const QR_REFRESH_SECONDS = 30;

export default function QrPanel({ alumnoId, clases }: { alumnoId: string; clases: Clase[] }) {
  const [qrValue, setQrValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Solo las clases dentro de su bloque activo generan QR
  const activas = clases.filter((c) => c.estado === "Activa");
  const seleccion = activas.length > 0 ? activas[0] : null;

  const seed = Math.floor(Date.now() / (QR_REFRESH_SECONDS * 1000));
  const fecha = fechaHoy();

  const cargarToken = useCallback(async () => {
    if (!seleccion) {
      setQrValue("");
      setError(null);
      return;
    }
    setError(null);
    const res = await getQrToken(seleccion.id, seleccion.curso, fecha, seed);
    if (res.ok) setQrValue(res.token + "|" + alumnoId);
    else {
      setQrValue("");
      setError(res.error);
    }
  }, [seleccion, fecha, seed, alumnoId]);

  useEffect(() => {
    cargarToken();
    const id = setInterval(() => cargarToken(), QR_REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, [cargarToken]);

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">QR de Asistencia</h1>

      {clases.length === 0 && (
        <p className="mt-4 rounded-xl bg-white p-6 text-center text-slate-500 shadow">
          No hay clases programadas para hoy.
        </p>
      )}

      {clases.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 font-semibold text-slate-700">Clases de hoy</h2>
            <ul className="space-y-2 text-sm">
              {clases
                .filter((c) => c.estado !== "Finalizada")
                .map((c) => (
                <li
                  key={c.id}
                  className={`rounded-lg border p-3 ${
                    seleccion?.id === c.id
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="font-medium text-slate-800">{c.curso}</div>
                  <div className="text-xs text-slate-500">
                    {c.hora_inicio?.slice(0, 5)} - {c.hora_fin?.slice(0, 5)} · {c.estado}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 font-semibold text-slate-700">Tu QR</h2>
            {!seleccion ? (
              <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
                No hay una clase activa en este momento.
                <br />
                <span className="text-xs text-slate-400">
                  El QR se habilita unos minutos antes de cada clase (apertura: 5 min antes).
                </span>
              </p>
            ) : error ? (
              <p className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">{error}</p>
            ) : !qrValue ? (
              <p className="text-sm text-slate-400">Generando...</p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <QRCodeSVG value={qrValue} size={Math.min(260, typeof window !== "undefined" ? window.innerWidth - 96 : 260)} />
                <p className="text-sm text-slate-500">
                  {seleccion?.curso} · {fecha}
                </p>
                <p className="text-xs text-slate-400">
                  Se actualiza cada {QR_REFRESH_SECONDS} segundos
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
