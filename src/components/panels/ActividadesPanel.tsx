"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { esAlumnoRegistrado } from "@/lib/estado";
import { crearActividad, marcarParticipacion, cerrarActividad, reabrirActividad } from "@/lib/actividades";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

type Actividad = {
  id: number;
  nombre: string;
  descripcion: string | null;
  fecha: string;
  estado: string;
  creado_en: string;
};

export default function ActividadesPanel({
  puedeGestionar,
  esAlumno,
  alumnoId,
}: {
  puedeGestionar: boolean;
  esAlumno: boolean;
  alumnoId: string;
}) {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [participacion, setParticipacion] = useState<Record<number, Record<string, boolean>>>({});
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creando, setCreando] = useState(false);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [abiertaSel, setAbiertaSel] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: acts, error: errAct } = await supabase.from("actividades").select("*").order("fecha", { ascending: false });
    if (errAct) {
      setActividades([]);
      setError("No se pudieron cargar las actividades.");
      setLoading(false);
      return;
    }
    setActividades((acts ?? []) as Actividad[]);

    const ids = [...new Set((acts ?? []).map((a) => a.id))];
    if (ids.length > 0) {
      const { data: parts } = await supabase.from("actividad_alumnos").select("*").in("actividad_id", ids);
      const mapa: Record<number, Record<string, boolean>> = {};
      for (const p of parts ?? []) {
        if (!mapa[p.actividad_id]) mapa[p.actividad_id] = {};
        mapa[p.actividad_id][p.alumno] = p.participacion;
      }
      setParticipacion(mapa);
    } else {
      setParticipacion({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    if (!esAlumno) {
      supabase
        .from("alumnos")
        .select("id,nombres,apellidos")
        .order("nombres")
        .then(({ data }) =>
          setAlumnos(
            (data ?? [])
              .filter((a) => esAlumnoRegistrado(a.id))
              .map((a) => ({ id: a.id, nombre: `${a.nombres} ${a.apellidos}` }))
          )
        );
    }
  }, [cargar, esAlumno]);

  async function crear() {
    if (!nombre.trim() || !fecha || creando) return;
    setCreando(true);
    setMsg(null);
    const res = await crearActividad(nombre.trim(), fecha, descripcion.trim());
    setCreando(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Error" });
    } else {
      setMsg({ ok: true, text: `Actividad "${nombre.trim()}" creada. Marca quién participó.` });
      setNombre("");
      setFecha("");
      setDescripcion("");
      cargar();
    }
  }

  async function toggle(actividadId: number, alumno: string, valor: boolean) {
    if (!puedeGestionar || guardandoId !== null) return;
    setGuardandoId(alumno ? actividadId : actividadId);
    setMsg(null);
    const res = await marcarParticipacion(actividadId, alumno, valor);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Error" });
    } else {
      setParticipacion((prev) => ({
        ...prev,
        [actividadId]: { ...(prev[actividadId] ?? {}), [alumno]: valor },
      }));
    }
    setGuardandoId(null);
  }

  async function cerrar(act: Actividad) {
    const noParticiparon = (Object.entries(participacion[act.id] ?? {}).filter(([, v]) => !v)).length;
    if (!window.confirm(`¿Cerrar "${act.nombre}" y generar la multa de S/ 50 a los ${noParticiparon} que no participaron?`)) return;
    setGuardandoId(act.id);
    setMsg(null);
    const res = await cerrarActividad(act.id);
    setGuardandoId(null);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Error" });
    } else {
      setMsg({ ok: true, text: `Actividad cerrada. ${res.multasCreadas ?? 0} multa(s) de S/ 50 generada(s).` });
      cargar();
    }
  }

  async function reabrir(act: Actividad) {
    if (!window.confirm(`¿Reabrir "${act.nombre}"? Se anularán sus multas pendientes.`)) return;
    setGuardandoId(act.id);
    setMsg(null);
    const res = await reabrirActividad(act.id);
    setGuardandoId(null);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Error" });
    } else {
      setMsg({ ok: true, text: `Actividad "${act.nombre}" reabierta.` });
      cargar();
    }
  }

  function contar(act: Actividad) {
    const mapa = participacion[act.id] ?? {};
    const vals = Object.values(mapa);
    const participaron = vals.filter(Boolean).length;
    return { total: vals.length, participaron };
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Control de Actividades</h1>
      <p className="mt-1 text-sm text-slate-500">
        Registra actividades obligatorias. Quien no participe recibe una multa de <strong>S/ 50</strong>.
      </p>

      {puedeGestionar && (
        <div className="mt-4 rounded-xl bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold text-slate-700">Nueva actividad</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <label className="block text-xs font-medium text-slate-600" htmlFor="act-nombre">Nombre</label>
              <input
                id="act-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej: Faena de limpieza del patio"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600" htmlFor="act-fecha">Fecha</label>
              <input
                id="act-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <Button onClick={crear} disabled={!nombre.trim() || !fecha || creando} className="self-end">
              {creando ? "Creando..." : "Crear actividad"}
            </Button>
          </div>
          <div className="mt-2">
            <label className="block text-xs font-medium text-slate-600" htmlFor="act-desc">Descripción (opcional)</label>
            <textarea
              id="act-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Detalle de la actividad..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {msg && (
        <div className={`mt-3 rounded-lg px-4 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {msg.text}
        </div>
      )}

      {error ? (
        <div className="mt-4">
          <ErrorState onReintentar={cargar} />
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : actividades.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No hay actividades registradas.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {actividades.map((act) => {
            const { total, participaron } = contar(act);
            const miEstado = participacion[act.id]?.[alumnoId];
            return (
              <div key={act.id} className="rounded-xl bg-white p-4 shadow">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-800">{act.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {act.fecha} {act.descripcion ? `· ${act.descripcion}` : ""}
                    </div>
                  </div>
                  <Badge variant={act.estado === "Abierta" ? "blue" : act.estado === "Cerrada" ? "green" : "slate"}>
                    {act.estado}
                  </Badge>
                </div>

                {esAlumno ? (
                  <div className="mt-2 text-sm">
                    {act.estado === "Abierta" ? (
                      <span className="text-slate-600">Participación pendiente de registrar.</span>
                    ) : (
                      <span className={miEstado ? "text-green-700" : "text-red-700"}>
                        {miEstado ? "Participaste en esta actividad." : "No participaste: multa de S/ 50 generada."}
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mt-2 text-xs text-slate-500">
                      Participaron {participaron} de {total} alumnos.
                    </div>

                    {puedeGestionar && act.estado === "Abierta" && (
                      <>
                        <button
                          className="mt-2 text-xs font-medium text-blue-700 hover:underline"
                          onClick={() => setAbiertaSel(abiertaSel === act.id ? null : act.id)}
                        >
                          {abiertaSel === act.id ? "Ocultar lista" : "Marcar participación"}
                        </button>
                        {abiertaSel === act.id && (
                          <div className="mt-2 grid gap-1 sm:grid-cols-2">
                            {alumnos.map((a) => (
                              <label
                                key={a.id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={participacion[act.id]?.[a.id] ?? false}
                                  onChange={(e) => toggle(act.id, a.id, e.target.checked)}
                                  className="h-4 w-4 accent-blue-900"
                                />
                                <span className="text-slate-700">{a.nombre}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {puedeGestionar && (
                      <div className="mt-3 flex gap-2">
                        {act.estado === "Abierta" && (
                          <Button variant="danger" size="sm" onClick={() => cerrar(act)} disabled={guardandoId === act.id}>
                            Cerrar y generar multas
                          </Button>
                        )}
                        {act.estado === "Cerrada" && (
                          <Button variant="secondary" size="sm" onClick={() => reabrir(act)} disabled={guardandoId === act.id}>
                            Reabrir
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}