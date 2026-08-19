export type ChequeosContrasena = {
  largo: boolean;
  mayuscula: boolean;
  minuscula: boolean;
  numero: boolean;
  simbolo: boolean;
};

const SIMBOLOS = /[^A-Za-z0-9]/;

export function chequeosContrasena(pw: string): ChequeosContrasena {
  return {
    largo: pw.length >= 10,
    mayuscula: /[A-Z]/.test(pw),
    minuscula: /[a-z]/.test(pw),
    numero: /[0-9]/.test(pw),
    simbolo: SIMBOLOS.test(pw),
  };
}

export function contrasenaFuerte(pw: string): boolean {
  const c = chequeosContrasena(pw);
  return c.largo && c.mayuscula && c.minuscula && c.numero && c.simbolo;
}

export function validarNuevaContrasena(
  pw: string,
  dni: string | null,
  nombres: string | null
): string | null {
  if (pw === String(dni || "")) return "No puedes usar el DNI como contraseña";
  const nombreMayus = String(nombres || "").toUpperCase().split(" ")[0];
  if (nombreMayus && pw.toUpperCase() === nombreMayus) return "No puedes usar el nombre como contraseña";
  const c = chequeosContrasena(pw);
  if (!c.largo) return "La contraseña debe tener al menos 10 caracteres";
  if (!c.mayuscula || !c.minuscula) return "Debe incluir letras mayúsculas y minúsculas";
  if (!c.numero) return "Debe incluir al menos un número";
  if (!c.simbolo) return "Debe incluir al menos un símbolo (ej. @, #, !, ?)";
  return null;
}