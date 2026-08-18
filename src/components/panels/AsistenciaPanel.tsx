"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { exportarExcel } from "@/lib/exportar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

type AsistenciaRow = {
  id: number;
  alumno: string;
  fecha: string;
  hora: string | null;
  curso: string;
  estado: string;
};

const badgePorEstado: Record<string, "green" | "amber" | "red" | "slate"> = {
  Presente: "green",
  Tardanza: "amber",
  Falta: "red",
};

export default function AsistenciaPanel({ isAdmin, alumnoId }: { isAdmin: boolean; alumnoId: string }) {
  const [cursos, setCursos] = useState<string[]>([]);
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string }[]>([]);

  const [filtroCurso, setFiltroCurso] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroAlumno, setFiltroAlumno] = useState("");
  const [rows, setRows] = useState<AsistenciaRow[]>([]);
  const [alumnosMap, setAlumnosMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("cursos")
      .select("nombre")
      .order("nombre")
      .then(({ data }) => setCursos((data ?? []).map((c) => c.nombre)));
    if (isAdmin) {
      supabase
        .from("alumnos")
        .select("id,nombres,apellidos")
        .order("nombres")
        .then(({ data }) =>
          setAlumnos(
            (data ?? []).map((a) => ({ id: a.id, nombre: `${a.nombres} ${a.apellidos}` }))
          )
        );
    }
  }, [isAdmin]);

  const cargar = useCallback(
    async (curso: string, fecha: string, alumno: string) => {
      setLoading(true);
      setError(null);
      let query = supabase.from("asistencia").select("*");
      if (!isAdmin) query = query.eq("alumno", alumnoId);
      if (curso) query = query.eq("curso", curso);
      if (fecha) query = query.eq("fecha", fecha);
      if (isAdmin && alumno) query = query.eq("alumno", alumno);

      const { data, error } = await query
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false })
        .limit(500);

      if (error) {
        setRows([]);
        setError("No se pudieron cargar los registros de asistencia.");
        setLoading(false);
        return;
      }

      const filas = (data ?? []) as AsistenciaRow[];
      setRows(filas);

      if (isAdmin && filas.length > 0) {
        const ids = [...new Set(filas.map((a) => a.alumno))];
        const { data: alumnos } = await supabase.from("alumnos").select("id,nombres,apellidos").in("id", ids);
        const map = new Map<string, string>();
        for (const al of alumnos ?? []) map.set(al.id, `${al.nombres} ${al.apellidos}`);
        setAlumnosMap(map);
      }
      setLoading(false);
    },
    [isAdmin, alumnoId]
  );

  useEffect(() => {
    cargar(filtroCurso, filtroFecha, filtroAlumno);
  }, [cargar, filtroCurso, filtroFecha, filtroAlumno]);

  async function exportar() {
    const encabezados = isAdmin ? ["Alumno", "Fecha", "Hora", "Curso", "Estado"] : ["Fecha", "Hora", "Curso", "Estado"];
    const filas = rows.map((a) => [
      ...(isAdmin ? [alumnosMap.get(a.alumno) ?? a.alumno] : []),
      a.fecha,
      a.hora?.slice(0, 5) ?? "",
      a.curso,
      a.estado,
    ]);

    const resEncabezados = isAdmin
      ? ["Alumno", "Presente", "Tardanza", "Falta", "Total multas (S/)"]
      : ["Presente", "Tardanza", "Falta", "Total multas (S/)"];

    const porAlumno = new Map<string, { nombre: string; presente: number; tardanza: number; falta: number }>();
    for (const a of rows) {
      const e = porAlumno.get(a.alumno) ?? {
        nombre: alumnosMap.get(a.alumno) ?? a.alumno,
        presente: 0,
        tardanza: 0,
        falta: 0,
      };
      if (a.estado === "Presente") e.presente++;
      else if (a.estado === "Tardanza") e.tardanza++;
      else if (a.estado === "Falta") e.falta++;
      porAlumno.set(a.alumno, e);
    }

    const ids = [...porAlumno.keys()];
    const multasPorAlumno = new Map<string, number>();
    if (ids.length > 0) {
      const { data } = await supabase.from("multas").select("alumno,monto").in("alumno", ids);
      for (const m of data ?? [])
        multasPorAlumno.set(m.alumno, (multasPorAlumno.get(m.alumno) ?? 0) + Number(m.monto ?? 0));
    }

    const resFilas: (string | number)[][] = [];
    for (const [id, e] of porAlumno) {
      const totalMultas = multasPorAlumno.get(id) ?? 0;
      resFilas.push([
        ...(isAdmin ? [e.nombre] : []),
        e.presente,
        e.tardanza,
        e.falta,
        `S/ ${totalMultas.toFixed(2)}`,
      ]);
    }

    exportarExcel("asistencia", [
      { nombre: "Asistencia", encabezados, filas },
      { nombre: "Resumen por alumno", encabezados: resEncabezados, filas: resFilas },
    ]);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Asistencia</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isAdmin ? "Registros de todos los alumnos" : "Tus registros de asistencia"}
      </p>

      <div className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="filtro-curso">Curso</label>
          <select
            id="filtro-curso"
            value={filtroCurso}
            onChange={(e) => setFiltroCurso(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todos los cursos</option>
            {cursos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="filtro-fecha">Fecha</label>
          <input
            id="filtro-fecha"
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {isAdmin && (
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="filtro-alumno">Alumno</label>
            <select
              id="filtro-alumno"
              value={filtroAlumno}
              onChange={(e) => setFiltroAlumno(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos los alumnos</option>
              {alumnos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {isAdmin && (
          <Button
            variant="secondary"
            onClick={() => {
              setFiltroCurso("");
              setFiltroFecha("");
              setFiltroAlumno("");
            }}
            className="mt-auto sm:col-span-3 sm:justify-self-end"
          >
            Limpiar filtros
          </Button>
        )}

        <Button
          onClick={exportar}
          disabled={rows.length === 0}
          className="mt-auto sm:justify-self-end"
        >
          Exportar Excel
        </Button>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState onReintentar={() => cargar(filtroCurso, filtroFecha, filtroAlumno)} />
        </div>
      ) : loading ? (
        <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-slate-100 px-4 py-3">
              {isAdmin && <Skeleton className="h-4 w-40" />}
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Tabla (desde sm) */}
          <div className="mt-4 hidden overflow-x-auto rounded-xl bg-white shadow sm:block">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {isAdmin ? "Registros de asistencia de todos los alumnos" : "Tus registros de asistencia"}
              </caption>
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  {isAdmin && <th scope="col" className="px-4 py-2 font-medium">Alumno</th>}
                  <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                  <th scope="col" className="px-4 py-2 font-medium">Hora</th>
                  <th scope="col" className="px-4 py-2 font-medium">Curso</th>
                  <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    {isAdmin && (
                      <td className="px-4 py-2 text-slate-700">{alumnosMap.get(a.alumno) ?? a.alumno}</td>
                    )}
                    <td className="px-4 py-2 text-slate-600">{a.fecha}</td>
                    <td className="px-4 py-2 text-slate-600">{a.hora?.slice(0, 5)}</td>
                    <td className="px-4 py-2 text-slate-800">{a.curso}</td>
                    <td className="px-4 py-2">
                      <Badge variant={badgePorEstado[a.estado] ?? "slate"}>{a.estado}</Badge>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                      Sin registros de asistencia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards (móvil) */}
          <ul className="mt-4 space-y-2 sm:hidden">
            {rows.map((a) => (
              <li key={a.id} className="rounded-xl bg-white p-3 shadow">
                {isAdmin && <p className="font-medium text-slate-800">{alumnosMap.get(a.alumno) ?? a.alumno}</p>}
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {a.curso} · {a.fecha}
                    {a.hora ? ` · ${a.hora.slice(0, 5)}` : ""}
                  </span>
                  <Badge variant={badgePorEstado[a.estado] ?? "slate"}>{a.estado}</Badge>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-400 shadow">
                Sin registros de asistencia.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}