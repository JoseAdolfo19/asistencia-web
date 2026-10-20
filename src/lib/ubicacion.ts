// ---------------------------------------------------------------------------
// Marcado de asistencia por UBICACIÓN (DNI + GPS).
//
// El alumno se pone a menos de RADIO_ACEPTACION_M del instituto, ingresa su
// DNI y el sistema valida distancia y ventana horaria antes de registrar la
// asistencia. Funciones puras: se usan en cliente (mostrar distancia) y en
// servidor (validar).
// ---------------------------------------------------------------------------

// IES La Salle Urubamba (https://maps.app.goo.gl/wTYGPbnYgfn977Qs9)
export const INSTITUTO = {
  lat: -13.3028131,
  lng: -72.1214123,
};

// Radio máximo de aceptación desde el instituto
export const RADIO_ACEPTACION_M = 100;

// Si el GPS reporta una precisión peor que esto, se pide repetir la lectura
export const PRECISION_MAX_M = 150;

// Distancia en metros entre dos puntos (fórmula de Haversine)
export function distanciaHaversineMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000; // radio terrestre en metros
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Ventanas horarias del marcado por ubicación (minutos desde medianoche).
//
//   - Martes:        solo Presente, de 9:30 a 9:40 (sin tardanza)
//   - Resto (L-V):   Presente de 8:00 a 8:30, Tardanza de 9:00 a 10:00
//   - Fin de semana: sin marcado por ubicación
// ---------------------------------------------------------------------------
export type VentanaUbicacion = {
  tipo: "asistencia" | "tardanza";
  inicio: number;
  fin: number;
  etiqueta: string;
};

const VENTANA_ASISTENCIA = { inicio: 8 * 60, fin: 8 * 60 + 30, etiqueta: "8:00 a 8:30" };
const VENTANA_TARDANZA = { inicio: 9 * 60, fin: 10 * 60, etiqueta: "9:00 a 10:00" };
const VENTANA_MARTES = { inicio: 9 * 60 + 30, fin: 9 * 60 + 40, etiqueta: "9:30 a 9:40" };

// Ventanas válidas de un día ("Lunes", "Martes", ..., en español como diaHoy())
export function ventanasUbicacionDia(dia: string): VentanaUbicacion[] {
  const d = String(dia || "").toLowerCase();
  if (d === "sábado" || d === "sabado" || d === "domingo") return [];
  if (d === "martes") {
    // Los martes la asistencia se toma recién de 9:30 a 9:40 (sin tardanza)
    return [{ tipo: "asistencia", ...VENTANA_MARTES }];
  }
  return [
    { tipo: "asistencia", ...VENTANA_ASISTENCIA },
    { tipo: "tardanza", ...VENTANA_TARDANZA },
  ];
}

// La ventana abierta a esta hora, o null si no hay ninguna
export function ventanaUbicacionAbierta(dia: string, ahoraMin: number): VentanaUbicacion | null {
  return (
    ventanasUbicacionDia(dia).find((v) => ahoraMin >= v.inicio && ahoraMin < v.fin) ?? null
  );
}

// Texto humano con los horarios del día (para mensajes de error/ayuda)
export function textoVentanasDia(dia: string): string {
  const vs = ventanasUbicacionDia(dia);
  if (vs.length === 0) return "Hoy no hay clases, no se puede marcar por ubicación.";
  const partes = vs.map((v) => (v.tipo === "asistencia" ? "Presente" : "Tardanza") + " de " + v.etiqueta);
  return "El horario de marcado por ubicación hoy es: " + partes.join(" y ") + ".";
}
