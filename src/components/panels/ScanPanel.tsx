"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { marcarAsistencia, abrirClase, resolverAlumno, cerrarClasesPendientes } from "@/lib/marcar";
import { diaHoy } from "@/lib/estado";
import Button from "@/components/ui/Button";

const CAMERA_ID = "qr-reader-region";

type ClaseHoy = { id: number; curso: string; hora_inicio: string; hora_fin: string };

export default function ScanPanel({ docente, clasesHoy }: { docente: string; clasesHoy: ClaseHoy[] }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scannerOn, setScannerOn] = useState(false);
  const [tokenManual, setTokenManual] = useState("");
  const [nombreManual, setNombreManual] = useState("");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const processingRef = useRef(false);
  const [abiertaMsg, setAbiertaMsg] = useState<Record<string, string>>({});
  const [cierreMsg, setCierreMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function procesarCierres() {
      if (processingRef.current) return;
      const res = await cerrarClasesPendientes();
      if (!alive) return;
      if (res.ok && res.cerradas.length > 0) {
        const partes = [];
        if (res.tardanzas > 0) partes.push(`${res.tardanzas} tardanza(s)`);
        if (res.faltas > 0) partes.push(`${res.faltas} falta(s)`);
        setCierreMsg(
          `Clases cerradas: ${res.cerradas.join(", ")}. ${partes.length ? "Registradas " + partes.join(" y ") + " automáticamente." : "Sin pendientes."}`
        );
      } else if (!res.ok && res.error) {
        setCierreMsg(`Aviso: ${res.error}`);
      }
    }

    procesarCierres();
    const id = setInterval(procesarCierres, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function marcarCon(token: string, alumnoId: string) {
    const res = await marcarAsistencia(token, alumnoId);
    setResult(res.ok ? { ok: true, msg: `Asistencia: ${res.estado} en ${res.curso}` } : { ok: false, msg: res.error });
  }

  async function handleScanned(payload: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    setResult(null);

    const clean = payload.trim();
    const [token, alumnoIdRaw] = clean.split("|");

    if (!token) {
      setResult({ ok: false, msg: "QR vacío" });
      processingRef.current = false;
      setLoading(false);
      return;
    }

    if (alumnoIdRaw) {
      await marcarCon(token, alumnoIdRaw);
    } else {
      const nombre = window.prompt("El QR no incluye el alumno. Escribe el nombre completo del alumno:");
      if (!nombre) {
        setResult({ ok: false, msg: "Cancelado" });
      } else {
        const res = await resolverAlumno(nombre);
        if (!res.ok) setResult({ ok: false, msg: res.error });
        else await marcarCon(token, res.id);
      }
    }

    processingRef.current = false;
    setLoading(false);
  }

  async function handleManual() {
    if (processingRef.current) return;
    const token = tokenManual.trim();
    if (!token) {
      setResult({ ok: false, msg: "Pega el token del QR" });
      return;
    }
    if (!nombreManual.trim()) {
      setResult({ ok: false, msg: "Escribe el nombre completo del alumno" });
      return;
    }

    processingRef.current = true;
    setLoading(true);
    setResult(null);

    const res = await resolverAlumno(nombreManual);
    if (!res.ok) {
      setResult({ ok: false, msg: res.error });
    } else {
      await marcarCon(token, res.id);
    }

    processingRef.current = false;
    setLoading(false);
  }

  async function onAbrirClase(curso: string) {
    setAbiertaMsg((prev) => ({ ...prev, [curso]: "Abriendo..." }));
    const res = await abrirClase(curso);
    setAbiertaMsg((prev) => ({
      ...prev,
      [curso]: res.ok ? "Clase abierta. Los alumnos ya pueden marcar Presente." : res.error || "Error",
    }));
  }

  function startScanner() {
    const scanner = new Html5Qrcode(CAMERA_ID);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanned(decodedText);
          scanner.pause();
          setTimeout(() => scanner.resume(), 2500);
        },
        () => {}
      )
      .then(() => setScannerOn(true))
      .catch((err) => {
        setResult({ ok: false, msg: "No se pudo iniciar la cámara: " + String(err) });
      });
  }

  function stopScanner() {
    if (scannerRef.current && scannerOn) {
      scannerRef.current.stop().then(() => scannerRef.current?.clear());
    }
    setScannerOn(false);
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerOn) {
        scannerRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Marcar Asistencia</h1>
      <p className="mt-1 text-sm text-slate-500">Docente: {docente}</p>

      <div className="mt-4 rounded-xl bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold text-slate-700">Clases de hoy ({diaHoy()})</h2>
        {clasesHoy.length === 0 ? (
          <p className="text-sm text-slate-500">No hay clases programadas para hoy.</p>
        ) : (
          <div className="space-y-2">
            {clasesHoy.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <div className="font-medium text-slate-800">{c.curso}</div>
                  <div className="text-xs text-slate-500">
                    {c.hora_inicio?.slice(0, 5)} - {c.hora_fin?.slice(0, 5)}
                  </div>
                  {abiertaMsg[c.curso] && (
                    <div className="mt-1 text-xs font-medium text-blue-700">{abiertaMsg[c.curso]}</div>
                  )}
                </div>
                <Button variant="success" onClick={() => onAbrirClase(c.curso)}>
                  Abrir clase
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Si llegas tarde, toca &quot;Abrir clase&quot; al llegar: los alumnos presentes podrán marcar Presente y no caerán
          en Tardanza por tu retraso.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Cada clase se cierra automáticamente 5 minutos después de su hora de inicio: quien no escaneó pero llegó
          a otra clase del día queda en Tardanza (con multa); quien no llegó en todo el día queda en Falta.
        </p>
        {cierreMsg && (
          <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">{cierreMsg}</div>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold text-slate-700">Escanear QR</h2>
          <div id={CAMERA_ID} className="w-full overflow-hidden rounded-lg bg-slate-900" />
          {!scannerOn ? (
            <Button onClick={startScanner} size="lg" className="mt-3">
              Iniciar cámara
            </Button>
          ) : (
            <Button variant="secondary" onClick={stopScanner} size="lg" className="mt-3">
              Detener cámara
            </Button>
          )}
        </div>

        <div className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold text-slate-700">Entrada manual</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Token del QR</label>
              <textarea
                value={tokenManual}
                onChange={(e) => setTokenManual(e.target.value)}
                rows={2}
                placeholder="pega aquí el token del QR"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Nombre completo del alumno</label>
              <input
                type="text"
                value={nombreManual}
                onChange={(e) => setNombreManual(e.target.value)}
                placeholder="ej: Michelle Christel AUCCACUSI SICCUS"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <Button onClick={handleManual} disabled={!tokenManual.trim() || !nombreManual.trim() || loading} size="lg">
              Marcar asistencia
            </Button>
          </div>
        </div>
      </div>

      {loading && <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">Procesando...</p>}
      {result && !loading && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {result.msg}
        </div>
      )}
    </div>
  );
}
