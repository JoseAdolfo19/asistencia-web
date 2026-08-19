const DIAS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function peruParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
    hour12: false,
  }).formatToParts(new Date());

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hh = get("hour");
  if (hh === "24") hh = "00";
  const diaEn = get("weekday");
  const idx = DIAS_EN.indexOf(diaEn);

  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    hh: hh.padStart(2, "0"),
    mm: get("minute"),
    ss: get("second"),
    dia: idx >= 0 ? DIAS_ES[idx] : "",
  };
}

export function normalizeName(nombre: string): string {
  return (nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Los alumnos y la tesorera tienen QR y se les registra asistencia.
export function esAlumno(rol: string): boolean {
  return rol === "Alumno" || rol === "Tesorera";
}

// Solo los alumnos registrados AL001..AL032 se marcan asistencia o participación.
// Excluye cuentas de docentes (D001..), admin (AL033) u otras.
export function esAlumnoRegistrado(id: string): boolean {
  const m = /^AL(\d{3})$/.exec(String(id || "").trim().toUpperCase());
  if (!m) return false;
  const n = Number(m[1]);
  return n >= 1 && n <= 32;
}

export function fechaHoy(): string {
  const p = peruParts();
  return `${p.y}-${p.m}-${p.d}`;
}

export function diaHoy(): string {
  return peruParts().dia;
}

export function horaAhora(): string {
  const p = peruParts();
  return `${p.hh}:${p.mm}:${p.ss}`;
}

export function aMinutos(h: string | null): number {
  if (!h) return 0;
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

export type ClaseEstadoInput = {
  dia: string;
  curso: string;
  hora_inicio: string;
  hora_fin: string;
  apertura_qr: string | null;
  cierre_lista: string | null;
};

// Determina si una clase es la primera del día (la de hora de inicio más temprana
// entre las clases de ese día, excluyendo las de asistencia no obligatoria).
export function esPrimeraClase(
  h: ClaseEstadoInput,
  todas: ClaseEstadoInput[],
  dia: string,
  excluidos: Set<string>
): boolean {
  const mismoDia = (todas ?? []).filter(
    (c) => normalizeName(c.dia) === normalizeName(dia) && !excluidos.has(normalizeName(c.curso))
  );
  if (mismoDia.length === 0) return false;
  const horaInicio = aMinutos(h.hora_inicio);
  return mismoDia.every((c) => aMinutos(c.hora_inicio) >= horaInicio);
}

export function estadoClase(
  h: ClaseEstadoInput,
  aperturaManual: string | null = null,
  esPrimera: boolean = false
): string {
  const ahora = aMinutos(horaAhora());
  const hoy = fechaHoy();
  if (hoy < "2026-01-01") return "Programada";
  if (normalizeName(h.dia) !== normalizeName(diaHoy())) return "Programada";

  const ini = aMinutos(h.hora_inicio);
  const fin = aMinutos(h.hora_fin);

  // Primera clase del día: abre 5 min antes del inicio y cierra 5 min después.
  // Cambios de curso: abre justo en el cambio y cierra 10 min después.
  const apertura = aperturaManual
    ? aMinutos(aperturaManual)
    : aMinutos(h.apertura_qr) || (esPrimera ? ini - 5 : ini);
  const cierre = aperturaManual
    ? aMinutos(aperturaManual) + 10
    : aMinutos(h.cierre_lista) || (esPrimera ? ini + 5 : ini + 10);

  if (ahora < apertura) return "Programada";
  if (ahora >= apertura && ahora < cierre) return "Activa";
  if (ahora >= cierre && ahora < fin) return "Cerrada";
  return "Finalizada";
}
