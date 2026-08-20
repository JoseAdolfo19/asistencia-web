"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { marcarConQrDocente, marcarConCodigo } from "@/lib/marcar";
import { marcarClaseLocal, type ClaseLocalInfo } from "@/lib/claseLocal";
import Button from "@/components/ui/Button";

const CAMERA_ID = "qr-reader-alumno";

export default function MarcarPanel({ nombre, claseLocal }: { nombre: string; claseLocal: ClaseLocalInfo | null }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scannerOn, setScannerOn] = useState(false);
  const [codigoClase, setCodigoClase] = useState("");
  const [nombreConfirm, setNombreConfirm] = useState(nombre);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const processingRef = useRef(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  async function marcar(raw: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    setResult(null);
    let ok = false;
    let msg = "";
    try {
      // El QR del docente solo lleva el token; si llegara un QR de alumno (token|alumno)
      // se toma solo el token.
      const token = String(raw || "").trim().split("|")[0];
      const res = await marcarConQrDocente(token);
      if (res.ok) {
        ok = true;
        msg = `Asistencia registrada: ${res.estado} en ${res.curso}`;
      } else {
        ok = false;
        msg = res.error;
      }
    } catch {
      ok = false;
      msg = "Error al registrar la asistencia. Intenta de nuevo.";
    } finally {
      processingRef.current = false;
      setLoading(false);
      setResult({ ok, msg });
      // Si falló (QR expirado/cámara), reanuda el escáner rápido; si marcó, deja
      // la confirmación visible unos segundos antes de volver a escanear.
      if (scannerRef.current && scannerOn) {
        setTimeout(() => scannerRef.current?.resume(), ok ? 4000 : 1500);
      }
    }
  }

  async function marcarCodigo() {
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    setResult(null);
    let ok = false;
    let msg = "";
    try {
      const res = await marcarConCodigo(codigoClase, nombreConfirm);
      if (res.ok) {
        ok = true;
        msg = `Asistencia registrada: ${res.estado} en ${res.curso}`;
      } else {
        ok = false;
        msg = res.error;
      }
    } catch {
      ok = false;
      msg = "Error al registrar la asistencia. Intenta de nuevo.";
    } finally {
      processingRef.current = false;
      setLoading(false);
      setResult({ ok, msg });
    }
  }

  async function marcarClase() {
    if (!claseLocal || processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    setResult(null);
    let ok = false;
    let msg = "";
    try {
      const res = await marcarClaseLocal(claseLocal.id);
      if (res.ok) {
        ok = true;
        msg = `Asistencia registrada en la clase local: ${res.estado}`;
      } else {
        ok = false;
        msg = res.error;
      }
    } catch {
      ok = false;
      msg = "Error al registrar. Intenta de nuevo.";
    } finally {
      processingRef.current = false;
      setLoading(false);
      setResult({ ok, msg });
    }
  }

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result]);

  function startScanner() {
    const scanner = new Html5Qrcode(CAMERA_ID);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          marcar(decodedText);
          scanner.pause();
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
      <p className="mt-1 text-sm text-slate-500">
        Alumno: {nombre}. Apunta la cámara al QR del docente.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold text-slate-700">Escanear QR del docente</h2>
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
          <h2 className="mb-2 font-semibold text-slate-700">Código de clase</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Código del docente (6 dígitos)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={codigoClase}
                onChange={(e) => setCodigoClase(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-xl tracking-[0.3em] focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Tu nombre (tal como está registrado)</label>
              <input
                type="text"
                value={nombreConfirm}
                onChange={(e) => setNombreConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <Button
              onClick={marcarCodigo}
              disabled={codigoClase.trim().length !== 6 || !nombreConfirm.trim() || loading}
              size="lg"
            >
              Marcar con código
            </Button>
            <p className="text-xs text-slate-400">
              El docente muestra un código de 6 dígitos que cambia cada 30 segundos. Sirve cuando no puedes
              escanear el QR.
            </p>
          </div>
        </div>
        {claseLocal && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
            <h2 className="mb-2 font-semibold text-purple-800">{claseLocal.nombre}</h2>
            {claseLocal.puedoMarcar ? (
              <>
                <p className="text-sm text-purple-700">
                  Clase de prueba: registra tu asistencia aquí (es voluntaria y no genera multas).
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Button onClick={marcarClase} disabled={loading || claseLocal.marcadaHoy} size="lg">
                    {claseLocal.marcadaHoy ? "Ya marcaste hoy" : "Marcar en clase local"}
                  </Button>
                  {claseLocal.marcadaHoy && (
                    <span className="text-sm font-semibold text-green-700">✔ Asistencia registrada hoy</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-purple-700">
                Clase local de Daniela HUANCA MIRANDA. Puedes ver los registros, pero no marcar.
              </p>
            )}
            {claseLocal.registros.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-purple-500">Últimos registros</p>
                <ul className="mt-1 space-y-1 text-sm text-purple-800">
                  {claseLocal.registros.map((r, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{r.fecha}</span>
                      <span className="text-purple-500">{r.hora}</span>
                      <span className="font-medium">{r.estado}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {loading && <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">Procesando...</p>}

      {result && !loading && (
        <div
          ref={resultRef}
          role="status"
          className={`mt-4 rounded-xl px-4 py-5 text-center text-base font-semibold ${
            result.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
          }`}
        >
          <span className="block text-4xl">{result.ok ? "✔" : "✕"}</span>
          {result.msg}
        </div>
      )}
    </div>
  );
}