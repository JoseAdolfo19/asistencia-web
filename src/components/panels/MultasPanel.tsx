"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cambiarEstadoMulta, crearMultaBuzo } from "@/lib/multas";
import { exportarExcel } from "@/lib/exportar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

type Multa = {
  id: number;
  alumno: string;
  fecha: string;
  tipo: string;
  motivo: string | null;
  monto: number;
  estado: string;
};

export default function MultasPanel({ puedeCobrar, esAlumno, alumnoId }: { puedeCobrar: boolean; esAlumno: boolean; alumnoId: string }) {
  const [rows, setRows] = useState<Multa[]>([]);
  const [alumnosMap, setAlumnosMap] = useState<Map<string, string>>(new Map());
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string }[]>([]);
  const [config, setConfig] = useState<{ multa_tardanza: number; multa_buzo: number; multa_actividad: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cobrandoId, setCobrandoId] = useState<number | null>(null);

  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroAlumno, setFiltroAlumno] = useState("");

  const [creandoBuzo, setCreandoBuzo] = useState(false);
  const [buzoAlumno, setBuzoAlumno] = useState("");

  const cargar = useCallback(
    async (estado: string, tipo: string, fecha: string, alumno: string) => {
      setLoading(true);
      setError(null);
      let query = supabase.from("multas").select("*");
      if (esAlumno) query = query.eq("alumno", alumnoId);
      if (!esAlumno && alumno) query = query.eq("alumno", alumno);
      if (estado) query = query.eq("estado", estado);
      if (tipo) query = query.eq("tipo", tipo);
      if (fecha) query = query.eq("fecha", fecha);

      const { data, error } = await query.order("fecha", { ascending: false }).limit(200);

      if (error) {
        setRows([]);
        setError("No se pudieron cargar las multas.");
        setLoading(false);
        return;
      }

      const filas = (data ?? []) as Multa[];
      setRows(filas);

      if (!esAlumno && filas.length > 0) {
        const ids = [...new Set(filas.map((m) => m.alumno))];
        const { data: alumnos } = await supabase.from("alumnos").select("id,nombres,apellidos").in("id", ids);
        const map = new Map<string, string>();
        for (const al of alumnos ?? []) map.set(al.id, `${al.nombres} ${al.apellidos}`);
        setAlumnosMap(map);
      }
      setLoading(false);
    },
    [esAlumno, alumnoId]
  );

  useEffect(() => {
    if (!esAlumno) {
      supabase
        .from("alumnos")
        .select("id,nombres,apellidos")
        .order("nombres")
        .then(({ data }) =>
          setAlumnos((data ?? []).map((a) => ({ id: a.id, nombre: `${a.nombres} ${a.apellidos}` })))
        );
    }
  }, [esAlumno]);

  useEffect(() => {
    cargar(filtroEstado, filtroTipo, filtroFecha, filtroAlumno);
    supabase
      .from("configuracion")
      .select("*")
      .limit(1)
      .then(({ data }) => {
        const c = data?.[0] as { multa_tardanza: number; multa_buzo: number; multa_actividad: number } | undefined;
        if (c) setConfig(c);
      });
  }, [cargar, filtroEstado, filtroTipo, filtroFecha, filtroAlumno]);

  async function cobrar(m: Multa) {
    if (m.estado === "Pagado" || cobrandoId !== null) return;
    if (!window.confirm(`¿Cobrar la multa de ${m.tipo} por S/ ${Number(m.monto).toFixed(2)}?`)) return;
    setCobrandoId(m.id);
    setMsg(null);
    const res = await cambiarEstadoMulta(m.id, "Pagado");
    setCobrandoId(null);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Error" });
    } else {
      setMsg({ ok: true, text: `Multa de ${m.tipo} cobrada (S/ ${Number(m.monto).toFixed(2)}).` });
      cargar(filtroEstado, filtroTipo, filtroFecha, filtroAlumno);
    }
  }

  async function registrarBuzo() {
    if (!buzoAlumno || creandoBuzo) return;
    setCreandoBuzo(true);
    setMsg(null);
    const res = await crearMultaBuzo(buzoAlumno);
    setCreandoBuzo(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Error" });
    } else {
      setMsg({ ok: true, text: `Multa de buzo registrada para ${alumnosMap.get(buzoAlumno) ?? buzoAlumno}.` });
      setBuzoAlumno("");
      cargar(filtroEstado, filtroTipo, filtroFecha, filtroAlumno);
    }
  }

  const totalMio = rows.reduce((acc, m) => acc + (m.estado === "Anulada" ? 0 : Number(m.monto ?? 0)), 0);
  const cobradas = rows.filter((m) => m.estado === "Pagado");
  const totalCobrado = cobradas.reduce((acc, m) => acc + Number(m.monto ?? 0), 0);
  const pendientes = rows.filter((m) => m.estado !== "Pagado" && m.estado !== "Anulada");
  const totalPendiente = pendientes.reduce((acc, m) => acc + Number(m.monto ?? 0), 0);

  function exportar() {
    const encabezados = esAlumno
      ? ["Fecha", "Tipo", "Motivo", "Monto", "Estado"]
      : ["Alumno", "Fecha", "Tipo", "Motivo", "Monto", "Estado"];
    const filas = rows.map((m) => [
      ...(esAlumno ? [] : [alumnosMap.get(m.alumno) ?? m.alumno]),
      m.fecha,
      m.tipo,
      m.motivo ?? "",
      `S/ ${Number(m.monto).toFixed(2)}`,
      m.estado,
    ]);

    const resEncabezados = esAlumno
      ? ["Tipo", "Cantidad", "Monto total (S/)"]
      : ["Alumno", "Tipo", "Pendientes", "Pagadas", "Monto total (S/)"];

    const porAlumno = new Map<
      string,
      { nombre: string; tipo: string; pendientes: number; pagadas: number; monto: number }
    >();
    for (const m of rows) {
      const key = `${m.alumno}|${m.tipo}`;
      const e = porAlumno.get(key) ?? {
        nombre: alumnosMap.get(m.alumno) ?? m.alumno,
        tipo: m.tipo,
        pendientes: 0,
        pagadas: 0,
        monto: 0,
      };
      if (m.estado === "Pagado") e.pagadas++;
      else if (m.estado !== "Anulada") e.pendientes++;
      e.monto += m.estado === "Anulada" ? 0 : Number(m.monto ?? 0);
      porAlumno.set(key, e);
    }

    const resFilas: (string | number)[][] = esAlumno
      ? [...porAlumno.values()].map((e) => [e.tipo, e.pendientes + e.pagadas, `S/ ${e.monto.toFixed(2)}`])
      : [...porAlumno.values()].map((e) => [e.nombre, e.tipo, e.pendientes, e.pagadas, `S/ ${e.monto.toFixed(2)}`]);

    exportarExcel("multas", [
      { nombre: "Multas", encabezados, filas },
      { nombre: "Resumen por alumno", encabezados: resEncabezados, filas: resFilas },
    ]);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Multas</h1>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            {esAlumno && (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                Total de tus multas: <strong>S/ {totalMio.toFixed(2)}</strong>
              </div>
            )}

            {!esAlumno && (
              <div className="rounded-xl bg-orange-50 p-4 text-sm text-orange-800">
                Pendientes por cobrar: <strong>S/ {totalPendiente.toFixed(2)}</strong> ({pendientes.length} multa(s))
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={exportar} disabled={rows.length === 0}>
              Exportar Excel
            </Button>
          </div>
        </div>

        {puedeCobrar && (
          <div className="mt-3 rounded-xl bg-white p-4 shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600" htmlFor="multa-buzo-alumno">
                  Registrar multa por buzo (no vino con uniforme)
                </label>
                <select
                  id="multa-buzo-alumno"
                  value={buzoAlumno}
                  onChange={(e) => setBuzoAlumno(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Selecciona un alumno...</option>
                  {alumnos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="danger"
                onClick={registrarBuzo}
                disabled={!buzoAlumno || creandoBuzo}
                className="shrink-0"
              >
                {creandoBuzo ? "Registrando..." : "Registrar multa"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Monto: <strong>S/ {config ? config.multa_buzo : 5}</strong> · Se genera la multa tipo &quot;Buzo&quot; que el alumno verá en su panel.
            </p>
          </div>
        )}

      {!esAlumno && config && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-3 text-sm shadow">
            <p className="text-slate-500">Tardanza</p>
            <p className="font-semibold">S/ {config.multa_tardanza}</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-sm shadow">
            <p className="text-slate-500">Buzo</p>
            <p className="font-semibold">S/ {config.multa_buzo}</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-sm shadow">
            <p className="text-slate-500">Actividad</p>
            <p className="font-semibold">S/ {config.multa_actividad}</p>
          </div>
          <div className="rounded-xl bg-green-50 p-3 text-sm shadow">
            <p className="text-green-700">Cobrado hasta el momento</p>
            <p className="font-semibold text-green-800">S/ {totalCobrado.toFixed(2)}</p>
            <p className="text-xs text-green-600">({cobradas.length} multa(s) pagadas)</p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow sm:grid-cols-2 lg:grid-cols-4">
        {!esAlumno && (
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="filtro-multa-alumno">Alumno</label>
            <select
              id="filtro-multa-alumno"
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

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="filtro-multa-tipo">Tipo</label>
          <select
            id="filtro-multa-tipo"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todos los tipos</option>
            <option value="Tardanza">Tardanza</option>
            <option value="Buzo">Buzo</option>
            <option value="Actividad">Actividad</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="filtro-multa-estado">Estado</label>
          <select
            id="filtro-multa-estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Pagado">Pagado</option>
            <option value="Anulada">Anulada</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="filtro-multa-fecha">Fecha</label>
          <input
            id="filtro-multa-fecha"
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {!esAlumno && (
          <Button
            variant="secondary"
            onClick={() => {
              setFiltroEstado("");
              setFiltroTipo("");
              setFiltroFecha("");
              setFiltroAlumno("");
            }}
            className="lg:col-span-4 lg:justify-self-end"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {msg && (
        <div
          className={`mt-3 rounded-lg px-4 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {error ? (
        <div className="mt-4">
          <ErrorState onReintentar={() => cargar(filtroEstado, filtroTipo, filtroFecha, filtroAlumno)} />
        </div>
      ) : loading ? (
        <div className="mt-4 overflow-hidden rounded-xl bg-white shadow">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-slate-100 px-4 py-3">
              {!esAlumno && <Skeleton className="h-4 w-40" />}
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-14" />
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
                {esAlumno ? "Tus multas" : "Multas de todos los alumnos"}
              </caption>
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  {!esAlumno && <th scope="col" className="px-4 py-2 font-medium">Alumno</th>}
                  <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                  <th scope="col" className="px-4 py-2 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-2 font-medium">Motivo</th>
                  <th scope="col" className="px-4 py-2 font-medium">Monto</th>
                  <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                  {puedeCobrar && <th scope="col" className="px-4 py-2 font-medium">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    {!esAlumno && (
                      <td className="px-4 py-2 text-slate-700">{alumnosMap.get(m.alumno) ?? m.alumno}</td>
                    )}
                    <td className="px-4 py-2 text-slate-600">{m.fecha}</td>
                    <td className="px-4 py-2 text-slate-800">{m.tipo}</td>
                    <td className="px-4 py-2 text-slate-600">{m.motivo || "—"}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">S/ {Number(m.monto).toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={m.estado === "Pagado" ? "green" : m.estado === "Anulada" ? "slate" : "red"}>{m.estado}</Badge>
                    </td>
                    {puedeCobrar && (
                      <td className="px-4 py-2">
                        {m.estado === "Pagado" || m.estado === "Anulada" ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => cobrar(m)}
                            disabled={cobrandoId !== null}
                          >
                            {cobrandoId === m.id ? "Cobrando..." : `Cobrar S/ ${Number(m.monto).toFixed(2)}`}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={puedeCobrar ? (esAlumno ? 6 : 7) : esAlumno ? 5 : 6} className="px-4 py-8 text-center text-slate-400">
                      Sin multas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards (móvil) */}
          <ul className="mt-4 space-y-2 sm:hidden">
            {rows.map((m) => (
              <li key={m.id} className="rounded-xl bg-white p-3 shadow">
                {!esAlumno && <p className="font-medium text-slate-800">{alumnosMap.get(m.alumno) ?? m.alumno}</p>}
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {m.tipo} · {m.fecha}
                    {m.motivo ? ` · ${m.motivo}` : ""}
                  </span>
                  <span className="font-semibold text-slate-800">S/ {Number(m.monto).toFixed(2)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant={m.estado === "Pagado" ? "green" : m.estado === "Anulada" ? "slate" : "red"}>{m.estado}</Badge>
                  {puedeCobrar && m.estado !== "Pagado" && m.estado !== "Anulada" && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => cobrar(m)}
                      disabled={cobrandoId !== null}
                    >
                      {cobrandoId === m.id ? "Cobrando..." : "Cobrar"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-400 shadow">
                Sin multas registradas.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}