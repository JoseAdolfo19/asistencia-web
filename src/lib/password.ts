export function validarNuevaContrasena(
  pw: string,
  dni: string | null,
  nombres: string | null
): string | null {
  if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (pw === String(dni || "")) return "No puedes usar el DNI como contraseña";
  const nombreMayus = String(nombres || "").toUpperCase().split(" ")[0];
  if (nombreMayus && pw.toUpperCase() === nombreMayus) return "No puedes usar el nombre como contraseña";
  return null;
}