"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
type PorCurso = { curso: string; Presente: number; Tardanza: number; Falta: number };
type PorDia = { fecha: string; Presente: number; Tardanza: number; Falta: number };

const COLORES: Record<string, string> = {
  Presente: "#16a34a",
  Tardanza: "#f59e0b",
  Falta: "#dc2626",
};

export default function DashboardPanel({ esAlumno, alumnoId }: { esAlumno: boolean; alumnoId: string }) {
  const [estadoHoy, setEstadoHoy] = useState<EstadoCount[]>([]);
  const [porCurso, setPorCurso] = useState<PorCurso[]>([]);
  const [porDia, setPorDia] = useState<PorDia[]>([]);
  const [multas, setMultas] = useState<{ pendiente: number; pagado: number; montoPendiente: number; montoPagado: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = esAlumno ? supabase.from("asistencia").select("*").eq("alumno", alumnoId) : supabase.from("asistencia").select("*");
    const queryMultas = esAlumno ? supabase.from("multas").select("*").eq("alumno", alumnoId) : supabase.from("multas").select("*");

    Promise.all([query, queryMultas]).then(([{ data: asis }, { data: ms }]) => {
      const regs = (asis ?? []) as { fecha: string; curso: string; estado: string }[];
      const filasMultas = (ms ?? []) as { estado: string; monto: number }[];

      // Estado hoy
      const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
      const hoyRegs = regs.filter((r) => r.fecha === hoy);
      const contar = (arr: typeof hoyRegs) =>
        ["Presente", "Tardanza", "Falta"]
          .map((estado) => ({ estado, total: arr.filter((r) => r.estado === estado).length }))
          .filter((c) => c.total > 0);
      setEstadoHoy(contar(hoyRegs));

      // Por curso (todos los registros)
      const porCursoMap = new Map<string, { Presente: number; Tardanza: number; Falta: number }>();
      for (const r of regs) {
        const c = porCursoMap.get(r.curso) ?? { Presente: 0, Tardanza: 0, Falta: 0 };
        if (r.estado === "Presente") c.Presente++;
        else if (r.estado === "Tardanza") c.Tardanza++;
        else if (r.estado === "Falta") c.Falta++;
        porCursoMap.set(r.curso, c);
      }
      setPorCurso([...porCursoMap.entries()].map(([curso, v]) => ({ curso, ...v })));

      // Por día (últimos 7 días)
      const dias = new Set(regs.map((r) => r.fecha));
      const ultimos = [...dias].sort().slice(-7);
      setPorDia(
        ultimos.map((fecha) => {
          const delDia = regs.filter((r) => r.fecha === fecha);
          return {
            fecha: fecha.slice(5),
            Presente: delDia.filter((r) => r.estado === "Presente").length,
            Tardanza: delDia.filter((r) => r.estado === "Tardanza").length,
            Falta: delDia.filter((r) => r.estado === "Falta").length,
          };
        })
      );

      // Multas
      const pendiente = filasMultas.filter((m) => m.estado !== "Pagado" && m.estado !== "Anulada");
      const pagado = filasMultas.filter((m) => m.estado === "Pagado");
      setMultas({
        pendiente: pendiente.length,
        pagado: pagado.length,
        montoPendiente: pendiente.reduce((a, m) => a + Number(m.monto ?? 0), 0),
        montoPagado: pagado.reduce((a, m) => a + Number(m.monto ?? 0), 0),
      });

      setLoading(false);
    });
  }, [esAlumno, alumnoId]);

  const totalHoy = estadoHoy.reduce((a, c) => a + c.total, 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        {esAlumno ? "Resumen de tu asistencia" : "Resumen general de asistencia y multas"}
      </p>

      {loading ? (
        <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">Cargando...</p>
      ) : (
        <div className="mt-4 space-y-4">
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
