import { describe, it, expect } from "vitest";
import { planificarCierre, planificarSubirFaltas } from "@/lib/cierre";

describe("planificarCierre (modelo por día)", () => {
  const alumnos = ["al1", "al2", "al3"];

  it("asigna 1 Falta por alumno sin marca cuando la jornada terminó", () => {
    const plan = planificarCierre("Matemáticas", 660, alumnos, new Set(), 700);

    expect(plan.curso).toBe("Matemáticas");
    expect(plan.registros).toHaveLength(3);
    expect(plan.registros.every((r) => r.estado === "Falta")).toBe(true);
  });

  it("no asigna Falta a quien ya marcó (Presente o Tardanza)", () => {
    const plan = planificarCierre("Matemáticas", 660, alumnos, new Set(["al2"]), 700);

    expect(plan.registros).toHaveLength(2);
    expect(plan.registros.some((r) => r.alumnoId === "al2")).toBe(false);
  });

  it("no actúa si la jornada aún no termina", () => {
    const plan = planificarCierre("Matemáticas", 660, alumnos, new Set(), 500);
    expect(plan.registros).toHaveLength(0);
  });

  it("devuelve plan vacío si no hay primera clase", () => {
    const plan = planificarCierre(null, 660, alumnos, new Set(), 700);
    expect(plan.registros).toHaveLength(0);
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