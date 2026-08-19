"use client";

import { chequeosContrasena, ChequeosContrasena } from "@/lib/password";

const ITEMS: { key: keyof ChequeosContrasena; label: string }[] = [
  { key: "largo", label: "Mínimo 10 caracteres" },
  { key: "mayuscula", label: "Una mayúscula" },
  { key: "minuscula", label: "Una minúscula" },
  { key: "numero", label: "Un número" },
  { key: "simbolo", label: "Un símbolo (ej. @, #, !, ?)" },
];

const ESTADO: Record<number, { label: string; bar: string; text: string }> = {
  0: { label: "Muy débil", bar: "bg-red-500", text: "text-red-600" },
  1: { label: "Débil", bar: "bg-red-500", text: "text-red-600" },
  2: { label: "Regular", bar: "bg-amber-500", text: "text-amber-700" },
  3: { label: "Aceptable", bar: "bg-yellow-500", text: "text-yellow-700" },
  4: { label: "Buena", bar: "bg-lime-500", text: "text-lime-700" },
  5: { label: "Fuerte", bar: "bg-green-500", text: "text-green-700" },
};

export default function PasswordStrength({ value }: { value: string }) {
  const checks = chequeosContrasena(value);
  const cumplidos = ITEMS.filter((i) => checks[i.key]).length;
  const nivel = value ? cumplidos : 0;
  const est = ESTADO[nivel];

  return (
    <div className="mt-1 space-y-1">
      {value && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded ${i <= nivel ? est.bar : "bg-slate-200"}`}
              />
            ))}
          </div>
          <span className={`text-xs font-medium ${est.text}`}>{est.label}</span>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        {ITEMS.map((i) => (
          <li
            key={i.key}
            className={`flex items-center gap-1.5 text-xs ${
              checks[i.key] ? "text-green-700" : "text-slate-400"
            }`}
          >
            <span>{checks[i.key] ? "✓" : "•"}</span>
            {i.label}
          </li>
        ))}
      </ul>
    </div>
  );
}