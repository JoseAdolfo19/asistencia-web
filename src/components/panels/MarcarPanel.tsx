"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { marcarConQrDocente } from "@/lib/marcar";
import Button from "@/components/ui/Button";

const CAMERA_ID = "qr-reader-alumno";

export default function MarcarPanel({ nombre }: { nombre: string }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scannerOn, setScannerOn] = useState(false);
  const [tokenManual, setTokenManual] = useState("");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const processingRef = useRef(false);

  async function marcar(raw: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    setResult(null);

    // El QR del docente solo lleva el token; si llegara un QR de alumno (token|alumno)
    // se toma solo el token.
    const token = String(raw || "").trim().split("|")[0];
    const res = await marcarConQrDocente(token);
    setResult(
      res.ok
        ? { ok: true, msg: `Asistencia: ${res.estado} en ${res.curso}` }
        : { ok: false, msg: res.error }
    );

    processingRef.current = false;
    setLoading(false);
  }

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
          <h2 className="mb-2 font-semibold text-slate-700">Entrada manual</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Token del QR del docente</label>
              <textarea
                value={tokenManual}
                onChange={(e) => setTokenManual(e.target.value)}
                rows={2}
                placeholder="pega aquí el token del QR"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <Button onClick={() => marcar(tokenManual)} disabled={!tokenManual.trim() || loading} size="lg">
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