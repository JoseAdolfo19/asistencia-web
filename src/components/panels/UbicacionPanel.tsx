"use client";

import { useState } from "react";
import { marcarPorUbicacion } from "@/lib/marcar";
import { diaHoy } from "@/lib/estado";
import {
  INSTITUTO,
  RADIO_ACEPTACION_M,
  distanciaHaversineMetros,
  ventanasUbicacionDia,
} from "@/lib/ubicacion";
import Button from "@/components/ui/Button";

type Coordenada = { lat: number; lng: number; precision: number };

export default function UbicacionPanel() {
  const [dni, setDni] = useState("");
  const [coords, setCoords] = useState<Coordenada | null>(null);
  const [gpsEstado, setGpsEstado] = useState<"idle" | "obteniendo" | "ok" | "error">("idle");
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<
    { ok: true; estado: string; curso: string; alumno: string } | { ok: false; error: string } | null
  >(null);

  const dia = diaHoy();
  const ventanasHoy = ventanasUbicacionDia(dia);

  function obtenerUbicacion() {
    if (!("geolocation" in navigator)) {
      setGpsEstado("error");
      setGpsMsg("Tu navegador no soporta ubicación. Prueba desde el navegador del celular.");
      return;
    }
    setGpsEstado("obteniendo");
    setGpsMsg("Buscando tu ubicación...mantente quieto unos segundos.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: pos.coords.accuracy ?? 9999,
        });
        setGpsEstado("ok");
        setGpsMsg(null);
      },
      (err) => {
        setCoords(null);
        setGpsEstado("error");
        setGpsMsg(
          err.code === err.PERMISSION_DENIED
            ? "Debes permitir el acceso a tu ubicación para marcar la asistencia."
            : "No pudimos obtener tu ubicación. Sal a un lugar despejado e inténtalo de nuevo."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function marcar() {
    if (loading || !coords) return;
    setLoading(true);
    setResultado(null);
    try {
      const res = await marcarPorUbicacion(dni, coords.lat, coords.lng, coords.precision);
      setResultado(res);
    } catch {
      setResultado({ ok: false, error: "Error al registrar. Inténtalo de nuevo." });
    } finally {
      setLoading(false);
    }
  }

  const distCliente = coords
    ? Math.round(distanciaHaversineMetros(coords.lat, coords.lng, INSTITUTO.lat, INSTITUTO.lng))
    : null;
  const puedeMarcar =
    gpsEstado === "ok" && coords !== null && /^\d{8}$/.test(dni) && !loading;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="text-center">
        <p className="text-sm font-bold text-blue-900">IES La Salle — Urubamba</p>
        <h1 className="mt-1 text-2xl font-bold text-blue-900">Marcar asistencia por ubicación</h1>
        <p className="mt-2 text-sm text-slate-500">
          Activa tu ubicación, ingresa tu DNI y confirma. Debes estar dentro del instituto
          (radio de {RADIO_ACEPTACION_M} m).
        </p>
      </div>

      <div className="mt-6 rounded-xl bg-white p-5 shadow">
        <h2 className="font-semibold text-slate-800">1. Activa tu ubicación</h2>
        <div className="mt-2">
          <Button onClick={obtenerUbicacion} disabled={gpsEstado === "obteniendo"} size="lg" className="w-full">
            {gpsEstado === "obteniendo" ? "Buscando señal GPS..." : gpsEstado === "ok" ? "Actualizar ubicación" : "Activar ubicación"}
          </Button>
        </div>
        {gpsMsg && <p className="mt-2 text-sm text-slate-500">{gpsMsg}</p>}
        {coords && (
          <p className="mt-2 text-sm">
            {distCliente !== null && distCliente <= RADIO_ACEPTACION_M ? (
              <span className="font-medium text-green-700">
                Ubicación lista: estás a {distCliente} m del instituto ✓
              </span>
            ) : (
              <span className="font-medium text-red-600">
                Estás a {distCliente} m del instituto (se permite hasta {RADIO_ACEPTACION_M} m). Acércate.
              </span>
            )}
            {coords.precision < 9999 && (
              <span className="ml-1 text-xs text-slate-400">precisión ±{Math.round(coords.precision)} m</span>
            )}
          </p>
        )}

        <h2 className="mt-5 font-semibold text-slate-800">2. Ingresa tu DNI</h2>
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          value={dni}
          onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
          placeholder="12345678"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.3em] focus:border-blue-500 focus:outline-none"
        />

        <Button onClick={marcar} disabled={!puedeMarcar} size="lg" className="mt-4 w-full">
          {loading ? "Registrando..." : "Marcar mi asistencia"}
        </Button>
      </div>

      {resultado && (
        <div
          role="status"
          className={`mt-4 rounded-xl px-4 py-5 text-center text-base font-semibold ${
            resultado.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
          }`}
        >
          <span className="block text-4xl">{resultado.ok ? "✔" : "✕"}</span>
          {resultado.ok ? (
            <>
              {resultado.alumno}: <span className="font-bold">{resultado.estado}</span>
              <span className="mt-1 block text-sm font-normal text-green-700">
                Registrado en {resultado.curso}. ¡Buen día!
              </span>
            </>
          ) : (
            <span className="text-sm font-medium">{resultado.error}</span>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Horario de hoy ({dia}):</p>
        {ventanasHoy.length === 0 ? (
          <p className="mt-1">Hoy no hay clases, no se puede marcar por ubicación.</p>
        ) : (
          <ul className="mt-1 list-inside list-disc">
            {ventanasHoy.map((v) => (
              <li key={v.tipo}>
                {v.tipo === "asistencia" ? "Presente" : "Tardanza"}: de {v.etiqueta}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Fuera de esas horas no se registra nada. El marcado con QR y código de clase del docente
          sigue funcionando igual.
        </p>
      </div>
    </div>
  );
}
