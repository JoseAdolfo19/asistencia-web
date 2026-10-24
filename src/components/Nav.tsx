"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/lib/auth";
import type { SessionUser } from "@/lib/session";

type BottomNavItem = {
  href: string;
  label: string;
  icon: "clock" | "clipboard" | "camera" | "receipt" | "calendar" | "chart" | "history" | "settings" | "users" | "more";
  roles?: readonly string[];
  prominent?: boolean;
};

const navItems: BottomNavItem[] = [
  { href: "/horario", label: "Horario", icon: "clock" },
  { href: "/dashboard", label: "Dashboard", icon: "chart" },
  { href: "/asistencia", label: "Asistencia", icon: "clipboard", roles: ["Alumno", "Docente", "Tesorera", "Administrador"] },
  { href: "/multas", label: "Multas", icon: "receipt", roles: ["Alumno", "Docente", "Tesorera", "Administrador"] },
  { href: "/actividades", label: "Actividades", icon: "calendar" },
  { href: "/qr", label: "QR", icon: "camera", roles: ["Docente"] },
  { href: "/marcar", label: "Marcar", icon: "camera", roles: ["Alumno", "Tesorera"] },
  { href: "/escanear", label: "Escanear", icon: "camera", roles: ["Docente"] },
  { href: "/auditoria", label: "Auditoría", icon: "history", roles: ["Administrador"] },
  { href: "/configuracion", label: "Configuración", icon: "settings", roles: ["Administrador"] },
  { href: "/usuarios", label: "Usuarios", icon: "users", roles: ["Administrador"] },
];

function getBottomNavItems(rol: string): { principales: BottomNavItem[]; mas: BottomNavItem[] } {
  const principalesPorRol: Record<string, string[]> = {
    Alumno: ["/horario", "/asistencia", "/marcar", "/multas"],
    Tesorera: ["/horario", "/asistencia", "/marcar", "/multas"],
    Docente: ["/horario", "/asistencia", "/escanear", "/multas"],
    Administrador: ["/horario", "/dashboard", "/asistencia", "/multas"],
  };
  const rutasPrincipales = principalesPorRol[rol] ?? ["/horario", "/dashboard", "/asistencia", "/multas"];
  const visibles = navItems.filter((item) => !item.roles || item.roles.includes(rol));
  const principales = rutasPrincipales
    .map((ruta) => visibles.find((item) => item.href === ruta))
    .filter((item): item is (typeof visibles)[number] => item !== undefined)
    .map((item) => ({
      ...item,
      prominent: item.href === "/marcar" || item.href === "/escanear" || (rol === "Administrador" && item.href === "/asistencia"),
    }));

  return {
    principales: [...principales, { href: "#mas", label: "Más", icon: "more" }],
    mas: visibles.filter((item) => !rutasPrincipales.includes(item.href)),
  };
}

function NavIcon({ name, className = "h-5 w-5" }: { name: BottomNavItem["icon"]; className?: string }) {
  const paths = {
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" /></>,
    camera: <><path d="M14 5h-4L8 8H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
    receipt: <><path d="M4 3v18l3-2 3 2 2-2 3 2 2-2 3 2V3l-3 2-2-2-3 2-3-2-3 2z" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9L16 20.7h-2.8l-.3-1.8a8 8 0 0 1-1.7-.7l-1.6.8-1.8-2.1 1.1-1.4a8 8 0 0 1-.2-1.8l-1.5-1 .9-2.6 1.8.1a8 8 0 0 1 1.3-1.2L11.4 7h2.8l.4 1.8a8 8 0 0 1 1.6.7l1.6-.8 1.8 2.1-1.1 1.4c.2.6.3 1.2.2 1.8z" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 5v1" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  } satisfies Record<BottomNavItem["icon"], React.ReactNode>;

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function Nav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [masAbierto, setMasAbierto] = useState(false);
  const bottomItems = getBottomNavItems(user.rol);

  useEffect(() => setMasAbierto(false), [pathname]);

  async function onLogout() {
    await logoutAction();
    router.push("/login");
    router.refresh();
  }

  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(user.rol));

  return (
    <>
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
        <button
          onClick={onLogout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 sm:hidden"
        >
          Salir
        </button>
      </div>
    </header>
    <nav
      aria-label="Funciones principales"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
    >
      <div className="relative mx-auto grid max-w-5xl grid-cols-5 items-end px-2 pt-2">
        {masAbierto && (
          <nav
            id="mas-funciones"
            aria-label="Más funciones"
            className="absolute bottom-full right-2 mb-3 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
          >
            {bottomItems.mas.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                  pathname === item.href ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        {bottomItems.principales.map((item) => {
          if (item.href === "#mas") {
            return (
              <button
                key={item.href}
                type="button"
                aria-expanded={masAbierto}
                aria-controls="mas-funciones"
                onClick={() => setMasAbierto((abierto) => !abierto)}
                className={`flex min-w-0 flex-col items-center justify-end gap-1 pb-2 text-[10px] font-medium leading-tight ${
                  masAbierto ? "text-blue-900" : "text-slate-500 hover:text-blue-800"
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            );
          }

          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-end gap-1 pb-2 text-[10px] font-medium leading-tight ${
                item.prominent ? "-mt-5" : ""
              } ${active ? "text-blue-900" : "text-slate-500 hover:text-blue-800"}`}
            >
              {item.prominent ? (
                <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md ${active ? "bg-blue-950" : "bg-blue-800"}`}>
                  <NavIcon name={item.icon} className="h-6 w-6" />
                </span>
              ) : (
                <NavIcon name={item.icon} />
              )}
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
