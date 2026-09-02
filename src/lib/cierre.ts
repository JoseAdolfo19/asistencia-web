export type ClaseCierre = {
  curso: string;
  hora_fin: string;
};

// Modelo por día: un alumno tiene UN estado por jornada.
//  - Presente: escaneó el QR de asistencia (08:00-08:30)
//  - Tardanza: escaneó el QR de tardanza (09:00-10:00)
//  - Falta: no escaneó ningún QR del día
// Máximo 1 tardanza (y 1 multa) por alumno por día.
export type PlanCierre = {
  curso: string; // primera clase obligatoria del día (referencia de la marca)
  registros: { alumnoId: string; estado: "Falta" }[];
};

// Planifica la Falta del día. Solo actúa cuando TODAS las clases obligatorias de
// la jornada terminaron; para cada alumno sin marca de día (ni Presente ni
// Tardanza) se asigna una única Falta. No genera multas (la Falta no lleva multa).
export function planificarCierre(
  cursoPrimera: string | null,
  finJornada: number,
  alumnosIds: string[],
  marcaronHoy: Set<string>,
  ahoraMin: number
): PlanCierre {
  if (!cursoPrimera) return { curso: "", registros: [] };
  if (ahoraMin < finJornada) return { curso: "", registros: [] };

  const registros = alumnosIds
    .filter((id) => !marcaronHoy.has(id))
    .map((alumnoId) => ({ alumnoId, estado: "Falta" as const }));

  return { curso: cursoPrimera, registros };
}

// ---------------------------------------------------------------------------
// Funciones legacy de subida de Faltas a Tardanza por curso.
// Se mantienen por compatibilidad con el marcado por curso (QR de clase), pero
// el cierre automático ya NO las usa (el modelo es por día).
// ---------------------------------------------------------------------------
export type FaltaPendiente = { id: number; alumno: string; curso: string };
export type MultaExistente = { motivo: string | null; asistencia_id: number | null };

export type PlanSubirFaltas = {
  actualizar: { id: number; curso: string }[];
  multasNuevas: { alumno: string; curso: string; motivo: string; asistenciaId: number }[];
};

export function planificarSubirFaltas(
  faltas: FaltaPendiente[],
  multas: MultaExistente[],
  alumnoId: string,
  motivoBase: (curso: string) => string
): PlanSubirFaltas {
  const actualizar: { id: number; curso: string }[] = [];
  const multasNuevas: { alumno: string; curso: string; motivo: string; asistenciaId: number }[] = [];

  for (const f of faltas) {
    if (f.alumno !== alumnoId) continue;
    actualizar.push({ id: f.id, curso: f.curso });

    const yaExiste = multas.some(
      (m) => m.asistencia_id === f.id || (m.motivo ?? "").includes(f.curso)
    );
    if (!yaExiste) {
      multasNuevas.push({ alumno: alumnoId, curso: f.curso, motivo: motivoBase(f.curso), asistenciaId: f.id });
    }
  }

  return { actualizar, multasNuevas };
}