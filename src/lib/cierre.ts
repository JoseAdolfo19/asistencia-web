import { normalizeName, aMinutos } from "@/lib/estado";

export type ClaseCierre = {
  curso: string;
  hora_fin: string;
};

export type PlanCierre = {
  curso: string;
  registros: { alumnoId: string; estado: "Tardanza" | "Falta" }[];
};

// Planifica qué alumnos quedan como Tardanza o Falta al cerrar las clases
// cuyo horario ya terminó, excluyendo quienes ya marcaron en ese curso.
// Incluye también las clases terminadas sin pendientes (registros vacíos).
export function planificarCierre(
  clasesHoy: ClaseCierre[],
  alumnosIds: string[],
  marcaronCurso: Map<string, Set<string>>,
  llegaronHoy: Set<string>,
  ahoraMin: number
): PlanCierre[] {
  const plan: PlanCierre[] = [];

  for (const h of clasesHoy) {
    const fin = aMinutos(h.hora_fin);
    if (ahoraMin < fin) continue;

    const marcaron = marcaronCurso.get(normalizeName(h.curso)) ?? new Set<string>();
    const registros: { alumnoId: string; estado: "Tardanza" | "Falta" }[] = [];

    for (const id of alumnosIds) {
      if (marcaron.has(id)) continue;
      registros.push({ alumnoId: id, estado: llegaronHoy.has(id) ? "Tardanza" : "Falta" });
    }

    plan.push({ curso: h.curso, registros });
  }

  return plan;
}

export type FaltaPendiente = { id: number; alumno: string; curso: string };
export type MultaExistente = { motivo: string | null };

export type PlanSubirFaltas = {
  actualizar: { id: number; curso: string }[];
  multasNuevas: { alumno: string; curso: string; motivo: string }[];
};

// Para un alumno que sí llegó hoy, sube a Tardanza sus Faltas del día y
// decide qué multas de tardanza crear (evitando duplicados por curso).
export function planificarSubirFaltas(
  faltas: FaltaPendiente[],
  multas: MultaExistente[],
  alumnoId: string,
  motivoBase: (curso: string) => string
): PlanSubirFaltas {
  const actualizar: { id: number; curso: string }[] = [];
  const multasNuevas: { alumno: string; curso: string; motivo: string }[] = [];

  for (const f of faltas) {
    if (f.alumno !== alumnoId) continue;
    actualizar.push({ id: f.id, curso: f.curso });

    const yaExiste = multas.some((m) => (m.motivo ?? "").includes(f.curso));
    if (!yaExiste) {
      multasNuevas.push({ alumno: alumnoId, curso: f.curso, motivo: motivoBase(f.curso) });
    }
  }

  return { actualizar, multasNuevas };
}