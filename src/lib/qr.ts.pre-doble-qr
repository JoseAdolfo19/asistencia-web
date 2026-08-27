import crypto from "crypto";

export const QR_REFRESH_SECONDS = 30;

export function qrSecret(): string {
  return process.env.QR_SECRET || "lasalle_qr";
}

export function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function generarFirmaQR(
  claseId: number | string,
  curso: string,
  fecha: string,
  seed: number,
  secret: string
): string {
  return sha256Hex([claseId, curso, fecha, seed].join("|") + "|" + secret);
}

export function seedActual(ms: number): number {
  return Math.floor(ms / (QR_REFRESH_SECONDS * 1000));
}

// Valida el token contra la semilla actual y la anterior (deltas 0 y -1).
export function firmaValida(
  token: string,
  claseId: number | string,
  curso: string,
  fecha: string,
  secret: string,
  ms: number
): boolean {
  for (const delta of [0, -1]) {
    const seed = seedActual(ms) + delta;
    if (generarFirmaQR(claseId, curso, fecha, seed, secret) === token) return true;
  }
  return false;
}

// Devuelve el seed que corresponde a un ms dado (para pruebas deterministas).
export function seedPara(ms: number): number {
  return seedActual(ms);
}

// Código numérico de 6 dígitos de la clase, derivado de la misma firma que el QR.
// Permite marcar asistencia escribiendo el código en vez de escanear.
export function generarCodigoClase(
  claseId: number | string,
  curso: string,
  fecha: string,
  seed: number,
  secret: string
): string {
  const h = sha256Hex([claseId, curso, fecha, seed].join("|") + "|codigo|" + secret);
  const num = parseInt(h.slice(0, 8), 16);
  return String(num % 1000000).padStart(6, "0");
}

// Valida el código contra la semilla actual y la anterior (deltas 0 y -1).
export function codigoValido(
  codigo: string,
  claseId: number | string,
  curso: string,
  fecha: string,
  secret: string,
  ms: number
): boolean {
  const c = String(codigo || "").trim();
  if (!/^\d{6}$/.test(c)) return false;
  for (const delta of [0, -1]) {
    const seed = seedActual(ms) + delta;
    if (generarCodigoClase(claseId, curso, fecha, seed, secret) === c) return true;
  }
  return false;
}