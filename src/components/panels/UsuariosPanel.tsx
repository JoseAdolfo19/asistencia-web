"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { actualizarPerfil, resetearPassword } from "@/lib/admin";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";

type Usuario = {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  rol: string;
  estado: string;
  debe_cambiar_password: boolean;
};

const ROLES = ["Alumno", "Docente", "Tesorera", "Administrador"];
const ESTADOS = ["Activo", "Inactivo"];

export default function UsuariosPanel() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState({ nombres: "", apellidos: "", correo: "", rol: "Alumno", estado: "Activo" });
  const [guardando, setGuardando] = useState(false);

  const [pwUsuario, setPwUsuario] = useState<Usuario | null>(null);
  const [pwNueva, setPwNueva] = useState("");
  const [pwForzar, setPwForzar] = useState(true);
  const [pwGuardando, setPwGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("alumnos")
      .select("id,nombres,apellidos,correo,rol,estado,debe_cambiar_password")
      .order("id");
    if (error) {
      setUsuarios([]);
      setError("No se pudieron cargar los usuarios.");
      setLoading(false);
      return;
    }
    setUsuarios((data ?? []) as Usuario[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setForm({ nombres: u.nombres, apellidos: u.apellidos, correo: u.correo ?? "", rol: u.rol, estado: u.estado });
  }

  async function guardarPerfil() {
    if (!editando || guardando) return;
    setGuardando(true);
    setMsg(null);
    const res = await actualizarPerfil(editando.id, form);
    setGuardando(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Error" });
    } else {
      setMsg({ ok: true, text: `Perfil de ${editando.id} actualizado.` });
      setEditando(null);
      cargar();
    }
  }

  async function guardarPassword() {
    if (!pwUsuario || pwGuardando) return;
    setPwGuardando(true);
    setMsg(null);
    const res = await resetearPassword(pwUsuario.id, pwNueva, pwForzar);
    setPwGuardando(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error || "Error" });
    } else {
      setMsg({
        ok: true,
        text: `Contraseña de ${pwUsuario.id} actualizada${pwForzar ? " (se pedirá cambiarla en el próximo ingreso)" : ""}.`,
      });
      setPwUsuario(null);
      setPwNueva("");
      cargar();
    }
  }

  const visibles = usuarios.filter(
    (u) =>
      !filtro.trim() ||
      u.id.toLowerCase().includes(filtro.toLowerCase()) ||
      (u.nombres + " " + u.apellidos).toLowerCase().includes(filtro.toLowerCase()) ||
      (u.correo ?? "").toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900">Gestión de Usuarios</h1>
      <p className="mt-1 text-sm text-slate-500">
        Edita el perfil de alumnos y docentes, o restablece su contraseña.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nombre, código o correo..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <span className="text-sm text-slate-500">{visibles.length} usuario(s)</span>
      </div>

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
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow">
          <table className="w-full text-sm">
            <caption className="sr-only">Usuarios del sistema</caption>
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Código</th>
                <th scope="col" className="px-4 py-2 font-medium">Nombre</th>
                <th scope="col" className="px-4 py-2 font-medium">Correo</th>
                <th scope="col" className="px-4 py-2 font-medium">Rol</th>
                <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                <th scope="col" className="px-4 py-2 font-medium">Contraseña</th>
                <th scope="col" className="px-4 py-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">{u.id}</td>
                  <td className="px-4 py-2 text-slate-700">{u.nombres} {u.apellidos}</td>
                  <td className="px-4 py-2 text-slate-600">{u.correo || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{u.rol}</td>
                  <td className="px-4 py-2">
                    <Badge variant={u.estado === "Activo" ? "green" : "red"}>{u.estado}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    {u.debe_cambiar_password ? (
                      <Badge variant="amber">Por cambiar</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Actualizada</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => abrirEditar(u)}>Editar</Button>
                      <Button size="sm" onClick={() => { setPwUsuario(u); setPwNueva(""); setPwForzar(true); }}>Cambiar clave</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Sin usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h2 className="mb-3 font-semibold text-slate-800">Editar perfil de {editando.id}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Nombres</label>
                  <input
                    type="text"
                    value={form.nombres}
                    onChange={(e) => setForm({ ...form, nombres: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Apellidos</label>
                  <input
                    type="text"
                    value={form.apellidos}
                    onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">Correo</label>
                <input
                  type="email"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Rol</label>
                  <select
                    value={form.rol}
                    onChange={(e) => setForm({ ...form, rol: e.target.value })}
                    disabled={editando.id === "AL033" && form.rol === "Administrador"}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button onClick={guardarPerfil} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pwUsuario && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h2 className="mb-1 font-semibold text-slate-800">
              Cambiar contraseña de {pwUsuario.id} ({pwUsuario.nombres} {pwUsuario.apellidos})
            </h2>
            <p className="mb-3 text-xs text-slate-500">Mínimo 8 caracteres; no puede ser el DNI ni el nombre.</p>
            <div>
              <label className="block text-xs font-medium text-slate-600">Nueva contraseña</label>
              <input
                type="password"
                value={pwNueva}
                onChange={(e) => setPwNueva(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={pwForzar}
                onChange={(e) => setPwForzar(e.target.checked)}
                className="h-4 w-4 accent-blue-900"
              />
              Exigir cambio en el próximo ingreso
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPwUsuario(null)}>Cancelar</Button>
              <Button onClick={guardarPassword} disabled={pwGuardando || pwNueva.trim().length < 8}>
                {pwGuardando ? "Guardando..." : "Actualizar contraseña"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}