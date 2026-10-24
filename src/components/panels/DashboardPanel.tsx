"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { resumirDashboard } from "@/lib/dashboard";
import { fechaHoy, formatFechaPeru } from "@/lib/estado";
import ErrorState from "@/components/ui/ErrorState";
import Skeleton from "@/components/ui/Skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type EstadoCount = { estado: string; total: number };
type PorCurso = { curso: string; Presente: number; Tardanza: number; Falta: number; Justificada: number };
type PorDia = { fecha: string; Presente: number; Tardanza: number; Falta: number; Justificada: number };

const APK_URL = "https://github.com/JoseAdolfo19/asistencia-web/releases/latest/download/asistencia-ls-conta.apk";

const COLORES: Record<string, string> = {
  Presente: "#16a34a",
  Tardanza: "#f59e0b",
  Falta: "#dc2626",
  Justificada: "#94a3b8",
};

export default function DashboardPanel({ esAlumno, alumnoId }: { esAlumno: boolean; alumnoId: string }) {
  const [estadoHoy, setEstadoHoy] = useState<EstadoCount[]>([]);
  const [porCurso, setPorCurso] = useState<PorCurso[]>([]);
  const [porDia, setPorDia] = useState<PorDia[]>([]);
  const [multas, setMultas] = useState<{ pendiente: number; pagado: number; montoPendiente: number; montoPagado: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let activo = true;

    const fechaDesde = formatFechaPeru(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000));

    let query = supabase
      .from("asistencia")
      .select("fecha,curso,estado,justificada")
      .gte("fecha", fechaDesde);
    let queryMultas = supabase.from("multas").select("estado,monto").gte("fecha", fechaDesde);

    if (esAlumno) {
      query = query.eq("alumno", alumnoId);
      queryMultas = queryMultas.eq("alumno", alumnoId);
    }

    async function cargar() {
      setLoading(true);
      setError(false);

      try {
        const [resultadoAsistencia, resultadoMultas] = await Promise.all([query, queryMultas]);
        if (resultadoAsistencia.error || resultadoMultas.error) {
          if (activo) setError(true);
          return;
        }

        const resumen = resumirDashboard(
          resultadoAsistencia.data ?? [],
          resultadoMultas.data ?? [],
          fechaHoy()
        );
        if (!activo) return;

        setEstadoHoy(resumen.estadoHoy);
        setPorCurso(resumen.porCurso);
        setPorDia(resumen.porDia);
        setMultas(resumen.multas);
      } catch {
        if (activo) setError(true);
      } finally {
        if (activo) setLoading(false);
      }
    }

    void cargar();
    return () => {
      activo = false;
    };
  }, [esAlumno, alumnoId, reintento]);

  const totalHoy = estadoHoy.reduce((a, c) => a + c.total, 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        {esAlumno ? "Resumen de tu asistencia" : "Resumen general de asistencia y multas"}
      </p>

      {loading ? (
        <div className="mt-4 space-y-4" aria-label="Cargando resumen">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      ) : error ? (
        <div className="mt-4">
          <ErrorState mensaje="No se pudo cargar el resumen." onReintentar={() => setReintento((v) => v + 1)} />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-blue-900">Aplicación móvil</h2>
              <p className="mt-1 text-sm text-blue-800">Descarga la aplicación Android para acceder desde tu celular.</p>
            </div>
            <a
              href={APK_URL}
              download="asistencia-ls-conta.apk"
              className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Descargar Asistencia LS Conta
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-sm text-slate-500">Asistencia de hoy</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{totalHoy} registros</p>
              <p className="text-xs text-slate-400">
                {estadoHoy.map((c) => `${c.estado}: ${c.total}`).join(" · ") || "Sin registros hoy"}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-sm text-slate-500">Multas pendientes</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                S/ {multas?.montoPendiente.toFixed(2) ?? "0.00"}
              </p>
              <p className="text-xs text-slate-400">{multas?.pendiente ?? 0} sin pagar</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-sm text-slate-500">Multas pagadas</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                S/ {multas?.montoPagado.toFixed(2) ?? "0.00"}
              </p>
              <p className="text-xs text-slate-400">{multas?.pagado ?? 0} cobradas</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold text-slate-700">Asistencia de hoy</h2>
              {estadoHoy.length === 0 ? (
                <p className="text-sm text-slate-400">Sin registros.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={estadoHoy} dataKey="total" nameKey="estado" innerRadius={50} outerRadius={80}>
                      {estadoHoy.map((c) => (
                        <Cell key={c.estado} fill={COLORES[c.estado] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-xl bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold text-slate-700">Últimos 7 días</h2>
              {porDia.length === 0 ? (
                <p className="text-sm text-slate-400">Sin registros.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Presente" stackId="a" fill={COLORES.Presente} />
                    <Bar dataKey="Tardanza" stackId="a" fill={COLORES.Tardanza} />
                    <Bar dataKey="Falta" stackId="a" fill={COLORES.Falta} />
                    <Bar dataKey="Justificada" stackId="a" fill={COLORES.Justificada} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {!esAlumno && (
            <div className="rounded-xl bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold text-slate-700">Asistencia por curso</h2>
              {porCurso.length === 0 ? (
                <p className="text-sm text-slate-400">Sin registros.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porCurso}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="curso" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Presente" stackId="a" fill={COLORES.Presente} />
                    <Bar dataKey="Tardanza" stackId="a" fill={COLORES.Tardanza} />
                    <Bar dataKey="Falta" stackId="a" fill={COLORES.Falta} />
                    <Bar dataKey="Justificada" stackId="a" fill={COLORES.Justificada} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
