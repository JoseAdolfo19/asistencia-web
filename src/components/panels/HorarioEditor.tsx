"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarClase, eliminarClase } from "@/lib/horario";
import Button from "@/components/ui/Button";

type Clase = {
  id: number;
  curso: string;
  dia: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  docente?: string | null;
  aula?: string | null;
};

type HorarioEditorProps = {
  clases: Clase[];
  cursos: string[];
  docentes: string[];
  dias: string[];
};

const HORAS = [
  "07:00", "07:45", "08:00", "08:45", "09:00", "09:30", "10:15", "10:30", "11:00",
  "11:30", "12:10", "12:50", "13:30", "14:00", "15:00", "16:00",
];

export default function HorarioEditor({ clases, cursos, docentes, dias }: HorarioEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Clase | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    curso: "",
    dia: "Lunes",
    hora_inicio: "08:00",
    hora_fin: "08:45",
    docente: "",
    aula: "",
  });

  const porDia = dias.map((dia) => ({
    dia,
    clases: clases.filter((c) => c.dia === dia).sort((a, b) => (a.hora_inicio ?? "").localeCompare(b.hora_inicio ?? "")),
  }));

  function startCreate() {
    setForm({ curso: cursos[0] ?? "", dia: "Lunes", hora_inicio: "08:00", hora_fin: "08:45", docente: "", aula: "" });
    setCreating(true);
    setEditing(null);
  }

  function startEdit(c: Clase) {
    setForm({
      curso: c.curso,
      dia: c.dia,
      hora_inicio: (c.hora_inicio ?? "").slice(0, 5),
      hora_fin: (c.hora_fin ?? "").slice(0, 5),
      docente: c.docente ?? "",
      aula: c.aula ?? "",
    });
    setEditing(c);
    setCreating(false);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await guardarClase(
      editing
        ? { id: editing.id, ...form }
        : form
    );
    setMsg(res.ok ? { ok: true, text: "Guardado correctamente" } : { ok: false, text: res.error || "Error" });
    setSaving(false);
    if (res.ok) {
      setEditing(null);
      setCreating(false);
      router.refresh();
    }
  }

  async function remove(id: number) {
    if (!window.confirm("¿Eliminar esta clase del horario?")) return;
    setMsg(null);
    const res = await eliminarClase(id);
    setMsg(res.ok ? { ok: true, text: "Eliminada" } : { ok: false, text: res.error || "Error" });
    if (res.ok) {
      setEditing(null);
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-900">Editar Horario</h1>
        <Button onClick={startCreate} size="sm">
          + Agregar clase
        </Button>
      </div>

      {msg && (
        <div
          className={`mt-3 rounded-lg px-4 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
        >
          {msg.text}
        </div>
      )}

      {(creating || editing) && (
        <div className="mt-4 rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 font-semibold text-slate-700">{editing ? `Editar: ${editing.curso}` : "Nueva clase"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Curso</label>
              <select
                value={form.curso}
                onChange={(e) => setForm({ ...form, curso: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {cursos.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Día</label>
              <select
                value={form.dia}
                onChange={(e) => setForm({ ...form, dia: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {dias.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Hora inicio</label>
              <select
                value={form.hora_inicio}
                onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {HORAS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Hora fin</label>
              <select
                value={form.hora_fin}
                onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {HORAS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Aula</label>
              <input
                value={form.aula}
                onChange={(e) => setForm({ ...form, aula: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Docente</label>
              <select
                value={form.docente}
                onChange={(e) => setForm({ ...form, docente: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">— Sin docente —</option>
                {docentes.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="success" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button variant="secondary" onClick={() => { setEditing(null); setCreating(false); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {porDia.map(
          ({ dia, clases: diaClases }) =>
            diaClases.length > 0 && (
              <div key={dia} className="rounded-xl bg-white p-4 shadow">
                <h2 className="mb-2 font-semibold text-slate-700">{dia}</h2>
                <ul className="space-y-2">
                  {diaClases.map((c) => (
                    <li key={c.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="font-medium text-slate-800">{c.curso}</div>
                      <div className="text-xs text-slate-500">
                        {c.hora_inicio?.slice(0, 5)} - {c.hora_fin?.slice(0, 5)}
                        {c.aula ? ` · ${c.aula}` : ""}
                        {c.docente ? ` · ${c.docente}` : ""}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(c)} className="bg-slate-800 text-white hover:bg-slate-700">
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(c.id)} className="border border-red-200 bg-transparent text-red-700 hover:bg-red-50">
                          Eliminar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
        )}
      </div>
    </div>
  );
}
