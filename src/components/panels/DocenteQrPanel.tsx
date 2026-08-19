"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { fechaHoy } from "@/lib/estado";
import { getDocenteQrToken, abrirClase } from "@/lib/marcar";
import Button from "@/components/ui/Button";

type Clase = {
  id: number;
  curso: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
};

const QR_REFRESH_SECONDS = 30;

export default function DocenteQrPanel({ docente, clases }: { docente: string; clases: Clase[] }) {
  const [seleccionId, setSeleccionId] = useState<number | null>(null);
  const [qrValue, setQrValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [abiertaMsg, setAbiertaMsg] = useState<string | null>(null);

  const enVentana = clases.filter((c) => c.estado === "Activa" || c.estado === "Cerrada");
  const seleccion = enVentana.find((c) => c.id === seleccionId) ?? enVentana[0] ?? null;

  const seed = Math.floor(Date.now() / (QR_REFRESH_SECONDS * 1000));
  const fecha = fechaHoy();

  const cargarToken = useCallback(async () => {
    if (!seleccion) {
      setQrValue("");
      setError(null);
      return;
    }
    setError(null);
    const res = await getDocenteQrToken(seleccion.id, seleccion.curso, fecha, seed);
    if (res.ok) setQrValue(res.token);
    else {
      setQrValue("");
      setError(res.error);
    }
  }, [seleccion, fecha, seed]);

  useEffect(() => {
    cargarToken();
    const id = setInterval(() => cargarToken(), QR_REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, [cargarToken]);

  async function onAbrirClase(curso: string) {
    setAbiertaMsg("Abriendo...");
    const res = await abrirClase(curso);
    setAbiertaMsg(res.ok ? "Clase abierta. Los alumnos ya pueden marcar Presente." : res.error || "Error");
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">QR de la Clase</h1>
      <p className="mt-1 text-sm text-slate-500">
        Docente: {docente}. Los alumnos escanean este QR desde &quot;Marcar&quot; en su celular.
      </p>

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
                  onClick={() => setSeleccionId(c.id)}
                  className={`cursor-pointer rounded-lg border p-3 ${
                    seleccion?.id === c.id ? "border-blue-300 bg-blue-50" : "border-slate-200"
                  }`}
                >
                  <div className="font-medium text-slate-800">{c.curso}</div>
                  <div className="text-xs text-slate-500">
                    {c.hora_inicio?.slice(0, 5)} - {c.hora_fin?.slice(0, 5)} · {c.estado}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              El QR se habilita unos minutos antes de cada clase y se actualiza cada {QR_REFRESH_SECONDS} segundos.
              Si llegas tarde, toca &quot;Abrir clase&quot; al llegar para que los presentes marquen Presente.
            </p>
          </div>

          <div className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 font-semibold text-slate-700">QR para escanear</h2>
            {!seleccion ? (
              <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
                No hay una clase activa en este momento.
                <br />
                <span className="text-xs text-slate-400">El QR se habilita unos minutos antes de cada clase.</span>
              </p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-800">{seleccion.curso}</div>
                  <Button variant="success" size="sm" onClick={() => onAbrirClase(seleccion.curso)}>
                    Abrir clase
                  </Button>
                </div>
                {abiertaMsg && (
                  <div className="mb-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                    {abiertaMsg}
                  </div>
                )}
                {error ? (
                  <p className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">{error}</p>
                ) : !qrValue ? (
                  <p className="text-sm text-slate-400">Generando...</p>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <QRCodeSVG value={qrValue} size={260} />
                    <p className="text-sm text-slate-500">
                      {seleccion.curso} · {fecha}
                    </p>
                    <p className="text-xs text-slate-400">
                      Se actualiza cada {QR_REFRESH_SECONDS} segundos
                    </p>
                    {seleccion.estado === "Cerrada" && (
                      <p className="text-xs font-medium text-amber-700">
                        Clase cerrada: quienes escaneen ahora quedarán en Tardanza.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}