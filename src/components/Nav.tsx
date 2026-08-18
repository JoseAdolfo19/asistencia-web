"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/lib/auth";
import type { SessionUser } from "@/lib/session";

const navItems = [
  { href: "/horario", label: "Horario" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/asistencia", label: "Asistencia" },
  { href: "/multas", label: "Multas" },
  { href: "/qr", label: "QR" },
  { href: "/escanear", label: "Escanear", roles: ["Docente", "Administrador"] as const },
];

export default function Nav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function onLogout() {
    await logoutAction();
    router.push("/login");
    router.refresh();
  }

  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(user.rol as never));

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-bold text-blue-900">IES La Salle</p>
          <p className="text-xs text-slate-500">
            {user.nombres} {user.apellidos}
            {user.rol !== "Alumno" && <span className="ml-1 font-medium text-blue-700">({user.rol})</span>}
          </p>
        </div>

        {/* Navegación escritorio */}
        <nav className="hidden items-center gap-1.5 sm:flex">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname === item.href ? "bg-blue-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={onLogout}
            className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Salir
          </button>
        </nav>

        {/* Botón hamburguesa (móvil) */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Abrir menú"
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 p-2 sm:hidden"
        >
          <span className={`h-0.5 w-5 rounded bg-slate-700 transition-transform ${open ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`h-0.5 w-5 rounded bg-slate-700 transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 rounded bg-slate-700 transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Menú desplegable móvil */}
      {open && (
        <div className="border-t border-slate-200 bg-white sm:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col px-4 py-2">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-3 text-sm font-medium ${
                  pathname === item.href ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Salir: botón destacado al final del menú */}
            <button
              onClick={onLogout}
              className="mt-2 flex items-center justify-between rounded-lg border-t border-slate-100 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Cerrar sesión
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
