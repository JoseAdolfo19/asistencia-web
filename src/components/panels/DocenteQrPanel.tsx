"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getDocenteQrDia } from "@/lib/marcar";

type QrDia = {
  token: string;
  codigo: string;
  activo: boolean;
  disponible: boolean;
};

type QrDiaResult = {
  ok: true;
  fecha: string;
  asistencia: QrDia;
  tardanza: QrDia;
} | { ok: false; error: string };

const VENTANA_ASISTENCIA = "08:00 - 08:30";
const VENTANA_TARDANZA = "09:00 - 10:00";

export default function DocenteQrPanel({ docente }: { docente: string }) {
  const [data, setData] = useState<QrDiaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await getDocenteQrDia();
    setData(res);
    setError(res.ok ? null : res.error);
  }, []);

  useEffect(() => {
    cargar();
    // Refresca cada 60 s para actualizar qué QR está activo según la hora.
    const id = setInterval(cargar, 60_000);
    return () => clearInterval(id);
  }, [cargar]);

  if (!data) {
    return <p className="text-sm text-slate-400">Generando QR del día...</p>;
  }

  if (!data.ok) {
    return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">QR del Día</h1>
      <p className="mt-1 text-sm text-slate-500">
        Docente: {docente}. Los alumnos escanean uno de estos dos QRs desde &quot;Marcar&quot; o escriben el
        código + su nombre. Los QRs no cambian durante el día.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <QrCard
          titulo="Asistencia (a tiempo)"
          ventana={VENTANA_ASISTENCIA}
          descripcion="Para quienes llegan a tiempo. Registra Presente."
          color="blue"
          qr={data.asistencia}
        />
        <QrCard
          titulo="Tardanza"
          ventana={VENTANA_TARDANZA}
          descripcion="Para quienes llegan tarde. Registra Tardanza (genera multa)."
          color="amber"
          qr={data.tardanza}
        />
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Fecha: {data.fecha} (hora de Perú). Cada QR es válido solo dentro de su ventana horaria. Si llegas
        tarde, usa el QR de tardanza a partir de las 9:00.
      </p>
    </div>
  );
}

function QrCard({
  titulo,
  ventana,
  descripcion,
  color,
  qr,
}: {
  titulo: string;
  ventana: string;
  descripcion: string;
  color: "blue" | "amber";
  qr: QrDia;
}) {
  const border = color === "blue" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50";
  const text = color === "blue" ? "text-blue-700" : "text-amber-700";

  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <div className={`mb-3 rounded-lg px-3 py-2 ${border}`}>
        <div className={`text-sm font-semibold ${text}`}>{titulo}</div>
        <div className="text-xs text-slate-500">Válido: {ventana}</div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <QRCodeSVG value={qr.token} size={220} />
        <p className="text-sm text-slate-600">{descripcion}</p>

        <div className={`mt-1 w-full rounded-xl border px-3 py-2 text-center ${border}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${text}`}>Código de día</p>
          <p className={`font-mono text-3xl font-bold tracking-[0.3em] ${text}`}>{qr.codigo}</p>
        </div>

        {qr.activo ? (
          <p className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            ● Activo ahora
          </p>
        ) : qr.disponible ? (
          <p className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            Aún no inicia su ventana
          </p>
        ) : (
          <p className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            Ventana terminada
          </p>
        )}
      </div>
    </div>
  );
}