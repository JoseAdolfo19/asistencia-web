import { describe, expect, it } from "vitest";
import { resumirDashboard } from "@/lib/dashboard";

describe("resumirDashboard", () => {
  it("agrupa asistencia por curso y por día, y cuenta los estados de hoy", () => {
    const resumen = resumirDashboard(
      [
        { fecha: "2026-10-22", curso: "Ofimática", estado: "Presente", justificada: false },
        { fecha: "2026-10-23", curso: "Ofimática", estado: "Tardanza", justificada: false },
        { fecha: "2026-10-23", curso: "Tutoría", estado: "Falta", justificada: true },
        { fecha: "2026-10-23", curso: "Tutoría", estado: "Presente", justificada: false },
      ],
      [],
      "2026-10-23"
    );

    expect(resumen.estadoHoy).toEqual([
      { estado: "Presente", total: 1 },
      { estado: "Tardanza", total: 1 },
      { estado: "Falta", total: 1 },
    ]);
    expect(resumen.porCurso).toEqual([
      { curso: "Ofimática", Presente: 1, Tardanza: 1, Falta: 0, Justificada: 0 },
      { curso: "Tutoría", Presente: 1, Tardanza: 0, Falta: 0, Justificada: 1 },
    ]);
    expect(resumen.porDia).toEqual([
      { fecha: "10-22", Presente: 1, Tardanza: 0, Falta: 0, Justificada: 0 },
      { fecha: "10-23", Presente: 1, Tardanza: 1, Falta: 1, Justificada: 1 },
    ]);
  });

  it("excluye multas anuladas y suma por separado las pagadas y pendientes", () => {
    const resumen = resumirDashboard(
      [],
      [
        { estado: "Pendiente", monto: 10 },
        { estado: "Pagado", monto: 5 },
        { estado: "Anulada", monto: 50 },
      ],
      "2026-10-23"
    );

    expect(resumen.multas).toEqual({
      pendiente: 1,
      pagado: 1,
      montoPendiente: 10,
      montoPagado: 5,
    });
  });

  it("limita la serie diaria a los últimos siete días con registros", () => {
    const registros = Array.from({ length: 9 }, (_, index) => ({
      fecha: `2026-10-${String(index + 1).padStart(2, "0")}`,
      curso: "Curso",
      estado: "Presente",
      justificada: false,
    }));

    const resumen = resumirDashboard(registros, [], "2026-10-09");

    expect(resumen.porDia).toHaveLength(7);
    expect(resumen.porDia[0].fecha).toBe("10-03");
    expect(resumen.porDia[6].fecha).toBe("10-09");
  });
});
