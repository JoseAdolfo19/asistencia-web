import { describe, it, expect } from "vitest";
import { planificarCierre, planificarSubirFaltas } from "@/lib/cierre";

describe("planificarCierre", () => {
  const clasesHoy = [
    { curso: "Matemáticas", hora_fin: "08:15" },
    { curso: "Historia", hora_fin: "09:15" },
    { curso: "Inglés", hora_fin: "10:30" },
  ];
  const alumnos = ["al1", "al2", "al3"];

  it("marca Falta a quienes no llegaron ni marcaron en clases terminadas", () => {
    const plan = planificarCierre(
      clasesHoy,
      alumnos,
      new Map(),
      new Set(),
      aMin("08:30")
    );

    // Solo Matemáticas (fin 08:15) terminó; Historia e Inglés aún no.
    expect(plan).toHaveLength(1);
    expect(plan[0].curso).toBe("Matemáticas");
    expect(plan[0].registros).toHaveLength(3);
    expect(plan[0].registros.every((r) => r.estado === "Falta")).toBe(true);
  });

  it("marca Tardanza a quien llegó a otra clase del día", () => {
    const plan = planificarCierre(
      clasesHoy,
      alumnos,
      new Map(),
      new Set(["al2"]),
      aMin("08:30")
    );

    const registros = plan[0].registros;
    expect(registros.find((r) => r.alumnoId === "al2")?.estado).toBe("Tardanza");
    expect(registros.find((r) => r.alumnoId === "al1")?.estado).toBe("Falta");
  });

  it("excluye a quienes ya marcaron en ese curso", () => {
    const marcaron = new Map<string, Set<string>>([
      ["matematicas", new Set(["al1"])],
    ]);
    const plan = planificarCierre(
      clasesHoy,
      alumnos,
      marcaron,
      new Set(),
      aMin("08:30")
    );

    expect(plan[0].registros).toHaveLength(2);
    expect(plan[0].registros.some((r) => r.alumnoId === "al1")).toBe(false);
  });

  it("no cierra clases cuyo horario aún no termina", () => {
    const plan = planificarCierre(clasesHoy, alumnos, new Map(), new Set(), aMin("08:00"));
    expect(plan).toHaveLength(0);
  });

  it("incluye clases terminadas sin pendientes con registros vacíos", () => {
    const marcaron = new Map<string, Set<string>>([
      ["matematicas", new Set(alumnos)],
    ]);
    const plan = planificarCierre(
      clasesHoy,
      alumnos,
      marcaron,
      new Set(alumnos),
      aMin("09:00")
    );
    expect(plan.length).toBeGreaterThanOrEqual(1);
    expect(plan[0].registros).toHaveLength(0);
  });
});

describe("planificarSubirFaltas", () => {
  const motivoBase = (curso: string) => "No escaneó su QR en " + curso;

  it("sube a Tardanza las faltas del alumno y crea las multas que faltan", () => {
    const faltas = [
      { id: 1, alumno: "al1", curso: "Matemáticas" },
      { id: 2, alumno: "al1", curso: "Historia" },
      { id: 3, alumno: "al2", curso: "Matemáticas" },
    ];
    const multas: { motivo: string | null; asistencia_id: number | null }[] = [];

    const plan = planificarSubirFaltas(faltas, multas, "al1", motivoBase);

    expect(plan.actualizar.map((a) => a.id)).toEqual([1, 2]);
    expect(plan.multasNuevas).toHaveLength(2);
    expect(plan.multasNuevas[0].motivo).toContain("Matemáticas");
    expect(plan.multasNuevas[0].asistenciaId).toBe(1);
    expect(plan.multasNuevas[1].asistenciaId).toBe(2);
  });

  it("no duplica multas si ya existe una con el mismo curso", () => {
    const faltas = [{ id: 1, alumno: "al1", curso: "Matemáticas" }];
    const multas: { motivo: string | null; asistencia_id: number | null }[] = [
      { motivo: "No escaneó su QR en Matemáticas", asistencia_id: null },
    ];

    const plan = planificarSubirFaltas(faltas, multas, "al1", motivoBase);

    expect(plan.actualizar).toHaveLength(1);
    expect(plan.multasNuevas).toHaveLength(0);
  });

  it("no duplica multa si la asistencia ya está vinculada a una multa", () => {
    const faltas = [{ id: 7, alumno: "al1", curso: "Matemáticas" }];
    const multas: { motivo: string | null; asistencia_id: number | null }[] = [
      { motivo: "Llegó después del cierre de lista", asistencia_id: 7 },
    ];

    const plan = planificarSubirFaltas(faltas, multas, "al1", motivoBase);

    expect(plan.actualizar).toHaveLength(1);
    expect(plan.multasNuevas).toHaveLength(0);
  });

  it("ignora faltas de otros alumnos", () => {
    const faltas = [{ id: 9, alumno: "otro", curso: "Matemáticas" }];
    const plan = planificarSubirFaltas(faltas, [], "al1", motivoBase);
    expect(plan.actualizar).toHaveLength(0);
    expect(plan.multasNuevas).toHaveLength(0);
  });
});

function aMin(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}