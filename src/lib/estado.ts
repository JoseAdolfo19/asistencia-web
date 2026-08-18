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
  hora_inicio: string;
  hora_fin: string;
  apertura_qr: string | null;
  cierre_lista: string | null;
};

export function estadoClase(
  h: ClaseEstadoInput,
  tolerancia: number,
  aperturaManual: string | null = null
): string {
  const ahora = aMinutos(horaAhora());
  const hoy = fechaHoy();
  if (hoy < "2026-01-01") return "Programada";
  if (normalizeName(h.dia) !== normalizeName(diaHoy())) return "Programada";

  const ini = aMinutos(h.hora_inicio);
  const fin = aMinutos(h.hora_fin);

  // Se activa automaticamente 5 minutos antes de la hora de inicio
  const apertura = aperturaManual ? aMinutos(aperturaManual) : aMinutos(h.apertura_qr) || ini - 5;
  // Se cierra automaticamente 5 minutos despues de la hora de inicio
  const cierre = (aperturaManual ? aMinutos(aperturaManual) : aMinutos(h.cierre_lista) || ini) + tolerancia;

  if (ahora < apertura) return "Programada";
  if (ahora >= apertura && ahora < cierre) return "Activa";
  if (ahora >= cierre && ahora < fin) return "Cerrada";
  return "Finalizada";
}
