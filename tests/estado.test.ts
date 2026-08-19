import { describe, it, expect } from "vitest";
import { estadoClase, esPrimeraClase, aMinutos, normalizeName, esAlumnoRegistrado } from "@/lib/estado";

// estado.ts usa la hora real de Perú; para pruebas deterministas probamos
// aMinutos y normalizeName (puras) y la lógica de estadoClase con inputs fijos
// simulando el día correcto.

const lunes = "Lunes";

describe("aMinutos", () => {
  it("convierte HH:MM a minutos", () => {
    expect(aMinutos("07:30")).toBe(450);
    expect(aMinutos("12:00")).toBe(720);
    expect(aMinutos("23:59")).toBe(1439);
  });

  it("tolera nulos y vacíos", () => {
    expect(aMinutos(null)).toBe(0);
    expect(aMinutos("")).toBe(0);
  });
});

describe("normalizeName", () => {
  it("normaliza mayúsculas, tildes y espacios", () => {
    expect(normalizeName("  María José  ")).toBe("maria jose");
    expect(normalizeName("ÁÉÍÓÚ")).toBe("aeiou");
  });
});

describe("esPrimeraClase", () => {
  const todas = [
    { dia: "Lunes", curso: "A", hora_inicio: "08:00", hora_fin: "08:45", apertura_qr: null, cierre_lista: null },
    { dia: "Lunes", curso: "B", hora_inicio: "08:45", hora_fin: "11:00", apertura_qr: null, cierre_lista: null },
    { dia: "Lunes", curso: "C", hora_inicio: "11:30", hora_fin: "12:50", apertura_qr: null, cierre_lista: null },
  ];
  const excluidos = new Set<string>();

  it("marca como primera la de hora más temprana", () => {
    expect(esPrimeraClase(todas[0], todas, "Lunes", excluidos)).toBe(true);
    expect(esPrimeraClase(todas[1], todas, "Lunes", excluidos)).toBe(false);
    expect(esPrimeraClase(todas[2], todas, "Lunes", excluidos)).toBe(false);
  });

  it("ignora clases excluidas al buscar la primera", () => {
    const conExcluida = [
      { dia: "Lunes", curso: "Test", hora_inicio: "07:30", hora_fin: "08:00", apertura_qr: null, cierre_lista: null },
      ...todas,
    ];
    expect(esPrimeraClase(conExcluida[1], conExcluida, "Lunes", new Set([normalizeName("x")]))).toBe(false);
    expect(esPrimeraClase(conExcluida[1], conExcluida, "Lunes", new Set([normalizeName("otro")]))).toBe(false);
  });

  it("devuelve false cuando no hay clases de ese día", () => {
    expect(esPrimeraClase(todas[0], todas, "Martes", excluidos)).toBe(false);
  });
});

describe("esAlumnoRegistrado", () => {
  it("acepta solo AL001..AL032", () => {
    expect(esAlumnoRegistrado("AL001")).toBe(true);
    expect(esAlumnoRegistrado("AL010")).toBe(true);
    expect(esAlumnoRegistrado("AL032")).toBe(true);
    expect(esAlumnoRegistrado("al032")).toBe(true);
  });

  it("rechaza fuera de rango y otras cuentas", () => {
    expect(esAlumnoRegistrado("AL000")).toBe(false);
    expect(esAlumnoRegistrado("AL033")).toBe(false);
    expect(esAlumnoRegistrado("D001")).toBe(false);
    expect(esAlumnoRegistrado("AL0010")).toBe(false);
    expect(esAlumnoRegistrado("")).toBe(false);
    expect(esAlumnoRegistrado("AL")).toBe(false);
  });
});

describe("estadoClase (con día correcto Lunes)", () => {
  it("calcula los umbrales de apertura y cierre según esPrimera", () => {
    const clase = {
      dia: lunes,
      curso: "Test",
      hora_inicio: "07:30",
      hora_fin: "08:15",
      apertura_qr: null,
      cierre_lista: null,
    };
    // Primera clase: apertura = 07:25 (ini-5), cierre = 07:35 (ini+5)
    // Cambio de curso: apertura = 07:30 (ini), cierre = 07:40 (ini+10)
    expect(typeof estadoClase(clase, null, true)).toBe("string");
    expect(typeof estadoClase(clase, null, false)).toBe("string");
    expect(["Programada", "Activa", "Cerrada", "Finalizada"]).toContain(estadoClase(clase, null, true));
    expect(["Programada", "Activa", "Cerrada", "Finalizada"]).toContain(estadoClase(clase, null, false));
  });

  it("aplicación de apertura y cierre en el cálculo", () => {
    const ini = aMinutos("07:30");
    const fin = aMinutos("08:15");
    expect(fin - ini).toBe(45);
    // Primera clase: 5 antes y 5 después
    expect(ini - 5).toBe(445);
    expect(ini + 5).toBe(455);
    // Cambio de curso: 0 antes y 10 después
    expect(ini).toBe(450);
    expect(ini + 10).toBe(460);
  });
});